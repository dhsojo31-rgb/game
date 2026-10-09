// IndexedDB 저장소: 이미지(Blob)·도서·틀린그림 세트·운영 설정을 기기에 지속 저장한다.
const DB_NAME = 'bookcover-detective';
const DB_VER = 1;
const STORES = ['assets', 'books', 'diffsets', 'config'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('저장소를 열 수 없습니다.'));
    req.onblocked = () => reject(new Error('다른 탭이 저장소를 사용 중입니다.'));
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    try { result = fn(os); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(friendlyError(t.error));
    t.onabort = () => reject(friendlyError(t.error));
  }));
}

function friendlyError(err) {
  if (!err) return new Error('저장소 오류가 발생했습니다.');
  if (err.name === 'QuotaExceededError') return new Error('저장 용량이 부족합니다. 불필요한 자료를 삭제하거나 더 작은 이미지를 사용하세요.');
  return new Error(`저장소 오류: ${err.name} ${err.message || ''}`.trim());
}

export const put = (store, obj) => tx(store, 'readwrite', os => os.put(obj));
export const get = (store, id) => tx(store, 'readonly', os => os.get(id));
export const getAll = (store) => tx(store, 'readonly', os => os.getAll());
export const del = (store, id) => tx(store, 'readwrite', os => os.delete(id));

export function putMany(store, objs) {
  return tx(store, 'readwrite', os => { for (const o of objs) os.put(o); });
}

// ---------- 이미지 자산 ----------
const urlCache = new Map();

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];

/** 파일을 디코딩해 실제 크기를 확인한 뒤 자산으로 저장한다. 실패하면 저장하지 않고 이유를 던진다. */
export async function importImageFile(file) {
  if (!file || file.size === 0) throw new Error('빈 파일입니다.');
  if (!SUPPORTED.includes(file.type)) throw new Error(`지원하지 않는 형식입니다 (${file.type || '알 수 없음'}). JPG·PNG·WebP만 사용할 수 있습니다.`);
  const dim = await decodeBlob(file).catch(() => null);
  if (!dim) throw new Error('이미지를 열 수 없습니다. 손상된 파일일 수 있습니다.');
  const asset = { id: uid('asset'), blob: file, width: dim.width, height: dim.height, mimeType: file.type, createdAt: Date.now() };
  await put('assets', asset);
  return asset;
}

export async function saveBlobAsset(blob, id) {
  const dim = await decodeBlob(blob);
  const asset = { id: id || uid('asset'), blob, width: dim.width, height: dim.height, mimeType: blob.type, createdAt: Date.now() };
  await put('assets', asset);
  return asset;
}

export function decodeBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { const r = { width: img.naturalWidth, height: img.naturalHeight }; URL.revokeObjectURL(url); if (r.width > 0 && r.height > 0) resolve(r); else reject(new Error('크기 0')); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('디코딩 실패')); };
    img.src = url;
  });
}

/** 자산 ID → 표시용 URL. 없으면 null. */
export async function getAssetURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const asset = await get('assets', id);
  if (!asset || !asset.blob) return null;
  const url = URL.createObjectURL(asset.blob);
  urlCache.set(id, url);
  return url;
}

export function forgetAssetURL(id) {
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

/** URL이 실제로 그림으로 열리는지 확인 */
export function verifyImageURL(url) {
  return new Promise(resolve => {
    if (!url) { resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** 아무 도서·틀린그림에서도 참조하지 않는 자산 삭제 */
export async function cleanupOrphanAssets(books, diffsets) {
  const used = new Set();
  for (const b of books) used.add(b.originalAssetId);
  for (const d of diffsets) { used.add(d.originalAssetId); used.add(d.modifiedAssetId); }
  const all = await getAll('assets');
  for (const a of all) if (!used.has(a.id)) { forgetAssetURL(a.id); await del('assets', a.id); }
}

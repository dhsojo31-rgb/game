// 운영 자료 검증: 부족한 자료·중복 도서·영역 오류를 항목별로 안내한다.

/** 난이도별 구성 규격 */
export const LEVEL_SPEC = {
  easy: { key: 'easy', name: '쉬운 모드', hintsPerStage: 2, puzzles: 1, puzzleGrids: [[2, 3]], diffs: 1, memory: [4], hidden: 1, previewMs: 3000, desc: '퍼즐 1 · 틀린그림 1 · 카드 8장 · 숨은그림 1' },
  hard: { key: 'hard', name: '어려운 모드', hintsPerStage: 3, puzzles: 3, puzzleGrids: [[2, 3], [2, 3], [3, 3]], diffs: 3, memory: [6, 6], hidden: 2, previewMs: 4000, desc: '퍼즐 3(마지막 9조각) · 틀린그림 3 · 카드 12장 × 2판 · 숨은그림 2' },
};

export function emptyLevel(spec) {
  return { puzzleBookIds: Array(spec.puzzles).fill(null), differenceSetIds: Array(spec.diffs).fill(null), memoryRounds: spec.memory.map(n => Array(n).fill(null)), hiddenSetIds: Array(spec.hidden).fill(null) };
}

/** 설정에 levels 구조를 보장하고, 예전 형식(puzzleBookId 등)을 쉬운 모드로 옮긴다. */
export function ensureLevels(cfg) {
  cfg.levels = cfg.levels || {};
  for (const key of Object.keys(LEVEL_SPEC)) {
    const spec = LEVEL_SPEC[key];
    const base = emptyLevel(spec);
    const lv = cfg.levels[key] || {};
    base.puzzleBookIds = base.puzzleBookIds.map((_, i) => (lv.puzzleBookIds || [])[i] || null);
    base.differenceSetIds = base.differenceSetIds.map((_, i) => (lv.differenceSetIds || [])[i] || null);
    base.memoryRounds = base.memoryRounds.map((round, r) => round.map((_, i) => ((lv.memoryRounds || [])[r] || [])[i] || null));
    base.hiddenSetIds = base.hiddenSetIds.map((_, i) => (lv.hiddenSetIds || [])[i] || null);
    cfg.levels[key] = base;
  }
  if (cfg.puzzleBookId || cfg.differenceSetId || (cfg.memoryBookIds && cfg.memoryBookIds.length)) {
    const e = cfg.levels.easy;
    if (!e.puzzleBookIds[0]) e.puzzleBookIds[0] = cfg.puzzleBookId || null;
    if (!e.differenceSetIds[0]) e.differenceSetIds[0] = cfg.differenceSetId || null;
    if (e.memoryRounds[0].every(v => !v)) e.memoryRounds[0] = e.memoryRounds[0].map((_, i) => (cfg.memoryBookIds || [])[i] || null);
    delete cfg.puzzleBookId; delete cfg.differenceSetId; delete cfg.memoryBookIds;
  }
  return cfg;
}

export function validateRegions(regions) {
  const errs = [];
  if (!Array.isArray(regions) || regions.length !== 3) errs.push(`정답 영역은 정확히 3개여야 합니다 (현재 ${regions ? regions.length : 0}개).`);
  (regions || []).forEach((r, i) => {
    const ok = [r.x, r.y, r.width, r.height].every(v => typeof v === 'number' && isFinite(v));
    if (!ok || r.width <= 0 || r.height <= 0 || r.x < 0 || r.y < 0 || r.x + r.width > 1.0001 || r.y + r.height > 1.0001) errs.push(`정답 영역 ${i + 1}이(가) 이미지 경계를 벗어났거나 크기가 잘못되었습니다.`);
  });
  const ids = new Set((regions || []).map(r => r.id));
  if (ids.size !== (regions || []).length) errs.push('정답 영역 ID가 중복되었습니다.');
  return errs;
}

export function diffsetStatus(d, books, assetsById) {
  const errs = [];
  const book = books.find(b => b.id === d.bookId);
  if (!book) errs.push('틀린그림 도서가 없습니다.');
  if (!d.originalAssetId || (book && d.originalAssetId !== book.originalAssetId)) errs.push('원본 표지가 도서와 연결되지 않았습니다.');
  if (!d.modifiedAssetId) errs.push('수정본 준비 필요: 수정본 이미지를 등록하세요.');
  if (d.modifiedAssetId && d.originalAssetId && assetsById) {
    const a = assetsById.get(d.originalAssetId), m = assetsById.get(d.modifiedAssetId);
    if (a && m) {
      const r1 = a.width / a.height, r2 = m.width / m.height;
      if (Math.abs(r1 - r2) > 0.02) errs.push(`원본(${a.width}×${a.height})과 수정본(${m.width}×${m.height})의 비율이 다릅니다. 같은 비율로 다시 준비하세요.`);
    }
  }
  errs.push(...validateRegions(d.regions));
  if (!d.reviewed) errs.push('교사 검수가 완료되지 않았습니다. 미리보기로 확인한 뒤 검수 완료에 표시하세요.');
  return errs;
}

export function hiddensetStatus(h, books) {
  const errs = [];
  const book = books.find(b => b.id === h.bookId);
  if (!book) errs.push('숨은그림 도서가 없습니다.');
  if (!h.originalAssetId || (book && h.originalAssetId !== book.originalAssetId)) errs.push('표지가 도서와 연결되지 않았습니다.');
  const items = h.items || [];
  if (items.length < 3 || items.length > 10) errs.push(`찾을 물건은 3~10개여야 합니다 (현재 ${items.length}개).`);
  items.forEach((it, i) => {
    const ok = [it.x, it.y, it.width, it.height].every(v => typeof v === 'number' && isFinite(v));
    if (!ok || it.width <= 0 || it.height <= 0 || it.x < 0 || it.y < 0 || it.x + it.width > 1.0001 || it.y + it.height > 1.0001) errs.push(`물건 ${i + 1}의 위치가 이미지 경계를 벗어났거나 크기가 잘못되었습니다.`);
    if (!it.name || !String(it.name).trim()) errs.push(`물건 ${i + 1}의 이름을 적으세요.`);
  });
  if (new Set(items.map(it => it.id)).size !== items.length) errs.push('물건 ID가 중복되었습니다.');
  if (!h.reviewed) errs.push('교사 검수가 완료되지 않았습니다. 미리보기로 확인한 뒤 검수 완료에 표시하세요.');
  return errs;
}

/** 한 난이도의 구성 검증 (실제 표지 기준). */
export function validateLevel(levelKey, cfg, books, diffsets, assetsById, hiddensets = []) {
  const spec = LEVEL_SPEC[levelKey];
  const lv = (cfg.levels || {})[levelKey] || emptyLevel(spec);
  const errs = [];
  const name = spec.name;
  const bookById = id => books.find(b => b.id === id);

  const pz = lv.puzzleBookIds.filter(Boolean);
  if (pz.length !== spec.puzzles) errs.push(`[${name}] 퍼즐 도서 ${spec.puzzles}권을 선택하세요 (현재 ${pz.length}권).`);
  if (new Set(pz).size !== pz.length) errs.push(`[${name}] 퍼즐 도서가 중복 선택되었습니다.`);
  pz.forEach(id => { const b = bookById(id); if (!b) errs.push(`[${name}] 퍼즐 도서 중 없는 도서가 있습니다.`); else if (b.isDemo) errs.push(`[${name}] 퍼즐 도서에 연습용 표지가 선택되어 있습니다.`); });

  const ds = lv.differenceSetIds.filter(Boolean);
  if (ds.length !== spec.diffs) errs.push(`[${name}] 틀린그림 자료 준비 필요: 세트 ${spec.diffs}개를 선택하세요 (현재 ${ds.length}개).`);
  if (new Set(ds).size !== ds.length) errs.push(`[${name}] 틀린그림 세트가 중복 선택되었습니다.`);
  ds.forEach((id, i) => {
    const d = diffsets.find(x => x.id === id);
    if (!d) { errs.push(`[${name}] 틀린그림 ${i + 1}: 세트가 없습니다.`); return; }
    if (d.isDemo) errs.push(`[${name}] 틀린그림 ${i + 1}: 연습용 세트가 선택되어 있습니다.`);
    diffsetStatus(d, books, assetsById).forEach(e => errs.push(`[${name}] 틀린그림 ${i + 1}: ${e}`));
  });

  lv.memoryRounds.forEach((round, r) => {
    const need = spec.memory[r];
    const mem = round.filter(Boolean);
    const label = spec.memory.length > 1 ? `메모리 ${r + 1}판` : '메모리';
    if (mem.length !== need) errs.push(`[${name}] ${label}: 서로 다른 ${need}권을 선택해야 합니다 (현재 ${mem.length}권).`);
    if (new Set(mem).size !== mem.length) errs.push(`[${name}] ${label}: 도서가 중복 선택되었습니다. 서로 다른 ${need}종을 선택하세요.`);
    const assetUse = new Map();
    mem.forEach(id => {
      const b = bookById(id);
      if (!b) errs.push(`[${name}] ${label}: 없는 도서가 있습니다.`);
      else if (b.isDemo) errs.push(`[${name}] ${label}: 연습용 표지(${b.title})가 들어 있습니다.`);
      else assetUse.set(b.originalAssetId, (assetUse.get(b.originalAssetId) || 0) + 1);
    });
    if ([...assetUse.values()].some(n => n > 1)) errs.push(`[${name}] ${label}: 같은 표지 이미지를 쓰는 도서가 있습니다.`);
  });

  const hs = (lv.hiddenSetIds || []).filter(Boolean);
  if (hs.length !== spec.hidden) errs.push(`[${name}] 숨은그림 자료 준비 필요: 세트 ${spec.hidden}개를 선택하세요 (현재 ${hs.length}개).`);
  if (new Set(hs).size !== hs.length) errs.push(`[${name}] 숨은그림 세트가 중복 선택되었습니다.`);
  hs.forEach((id, i) => {
    const h = hiddensets.find(x => x.id === id);
    if (!h) { errs.push(`[${name}] 숨은그림 ${i + 1}: 세트가 없습니다.`); return; }
    if (h.isDemo) errs.push(`[${name}] 숨은그림 ${i + 1}: 연습용 세트가 선택되어 있습니다.`);
    hiddensetStatus(h, books).forEach(e => errs.push(`[${name}] 숨은그림 ${i + 1}: ${e}`));
  });
  return errs;
}

/** 운영 시작 가능 여부(쉬운 모드 기준). 반환: 오류 문장 배열(비어 있으면 통과). */
export function validateConfig(cfg, books, diffsets, assetsById, hiddensets = []) {
  if (!cfg) return ['운영 설정이 없습니다.'];
  if (cfg.mode === 'demo') {
    const errs = [];
    if (books.filter(b => b.isDemo).length < 4) errs.push('연습용 표지가 준비되지 않았습니다.');
    if (!diffsets.some(d => d.isDemo)) errs.push('연습용 틀린그림이 준비되지 않았습니다.');
    if (!hiddensets.some(h => h.isDemo)) errs.push('연습용 숨은그림이 준비되지 않았습니다.');
    return errs;
  }
  const errs = [];
  const real = books.filter(b => !b.isDemo);
  if (real.length < 4) errs.push(`실제 원본 표지가 4종보다 적습니다 (현재 ${real.length}종). ${4 - real.length}종을 더 등록하세요.`);
  errs.push(...validateLevel('easy', cfg, books, diffsets, assetsById, hiddensets));
  return errs;
}

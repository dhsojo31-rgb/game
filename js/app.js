// 책표지 탐정단 — 앱 본체: 상태, 화면 이동, 세션 초기화, 자료 로드
import * as db from './db.js';
import { setSoundEnabled, isSoundEnabled, sfx } from './sound.js';
import { ensureDemoData, DEMO_BOOK_IDS, DEMO_DIFF_ID } from './demo.js';
import { validateConfig, validateLevel, ensureLevels, LEVEL_SPEC } from './validate.js';
import { renderPuzzle } from './games/puzzle.js';
import { renderDiff } from './games/diff.js';
import { renderMemory } from './games/memory.js';
import { renderStart, renderIntro, renderClue, renderEnding, renderBooks } from './story.js';
import { renderAdmin } from './admin.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const DEFAULT_CONFIG = { id: 'main', mode: 'demo', soundEnabled: false, bundleImported: false, levels: {} };
const data = { books: [], diffsets: [], config: ensureLevels({ ...DEFAULT_CONFIG }), assets: new Map() };

// ---------- 세션 ----------
let session = null;
let seq = 0;
function newSession() {
  seq += 1;
  session = {
    id: seq, timers: new Set(), screen: 'S00', level: 'easy', stage: 0, clues: [], completed: false, runtime: null,
    rounds: { puzzle: 0, diff: 0, memory: 0 }, puzzle: null, diff: null, memory: null, ending: null,
  };
  return session;
}
function later(fn, ms) {
  const id = session.id;
  const t = setTimeout(() => { session.timers.delete(t); if (session.id !== id) return; fn(); }, ms);
  session.timers.add(t);
  return t;
}
function resetSession() {
  if (session) for (const t of session.timers) clearTimeout(t);
  closeModal();
  newSession();
  session.inspect = inspectMode;
  go('S00');
}
// 교사용 점검 모드: 세션이 바뀌어도 종료 전까지 유지된다.
let inspectMode = false;
let inspectLevel = 'easy';
// 검수·자동 확인용 (개인정보 없음)
window.__bcd = { session: () => session };

// ---------- 모달 ----------
function showModal(html, { dismissible = true } = {}) {
  modalRoot.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  modalRoot.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  // 바깥을 눌러 닫을 수 있는 창만 닫는다. 회차 안내처럼 반드시 버튼으로 진행해야 하는 창은 닫지 않는다.
  if (dismissible) modalRoot.querySelector('.modal-bg').addEventListener('click', e => { if (e.target.classList.contains('modal-bg')) closeModal(); });
  const first = modalRoot.querySelector('button'); if (first) first.focus();
}
function closeModal() { modalRoot.innerHTML = ''; }
function confirmDialog(message, okLabel = '확인', cancelLabel = '취소') {
  return new Promise(resolve => {
    showModal(`<p style="font-size:20px;white-space:pre-line">${message}</p>
      <div class="btn-row"><button class="btn ghost" id="m-cancel">${cancelLabel}</button><button class="btn primary" id="m-ok">${okLabel}</button></div>`);
    modalRoot.querySelector('#m-ok').addEventListener('click', () => { closeModal(); resolve(true); });
    modalRoot.querySelector('#m-cancel').addEventListener('click', () => { closeModal(); resolve(false); });
  });
}

// ---------- 자료 ----------
async function loadData() {
  data.books = await db.getAll('books');
  data.diffsets = await db.getAll('diffsets');
  data.config = ensureLevels({ ...DEFAULT_CONFIG, ...((await db.get('config', 'main')) || {}) });
  const assets = await db.getAll('assets');
  data.assets = new Map(assets.map(a => [a.id, { width: a.width, height: a.height }]));
  setSoundEnabled(!!data.config.soundEnabled);
}

/** assets/manifest.json 의 실제 표지를 저장소로 가져온다. 이미 있는 도서·세트는 건너뛴다. 반환: 새로 가져온 도서 수 */
async function importBundle(draft) {
  const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('manifest.json 을 열 수 없습니다.');
  const m = await res.json();
  const books = draft ? draft.books : data.books;
  const diffsets = draft ? draft.diffsets : data.diffsets;
  let n = 0;
  for (const b of m.books) {
    if (books.some(x => x.id === b.id)) continue;
    const r = await fetch('assets/' + b.file, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${b.file} 을 열 수 없습니다.`);
    const asset = await db.saveBlobAsset(await r.blob(), 'bundle-' + b.id);
    data.assets.set(asset.id, { width: asset.width, height: asset.height });
    const book = { id: b.id, title: b.title, author: b.author, authorConfirmed: !!b.authorConfirmed, originalAssetId: asset.id, isDemo: false };
    books.push(book);
    if (!draft) await db.put('books', book);
    n += 1;
  }
  const bundleVersion = m.version || 1;
  const storedVersion = data.config.bundleVersion || 1;
  // 기본 제공 틀린그림(수정본·정답 영역)이 새 버전이면 자동 시작 시 갱신한다. 관리자의 '다시 불러오기'(draft)는 없는 것만 채운다.
  const refreshDiffs = !draft && storedVersion < bundleVersion;
  for (const d of m.diffsets || []) {
    const idx = diffsets.findIndex(x => x.id === d.id);
    if (idx >= 0 && !refreshDiffs) continue;
    const book = books.find(b => b.id === d.bookId);
    if (!book) continue;
    const r = await fetch('assets/' + d.modifiedFile, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${d.modifiedFile} 을 열 수 없습니다.`);
    const asset = await db.saveBlobAsset(await r.blob(), 'bundle-' + d.id + '-mod');
    data.assets.set(asset.id, { width: asset.width, height: asset.height });
    const ds = { id: d.id, bookId: d.bookId, originalAssetId: book.originalAssetId, modifiedAssetId: asset.id, regions: d.regions.map(g => ({ id: g.id, x: g.x, y: g.y, width: g.width, height: g.height })), reviewed: !!d.reviewed, isDemo: false };
    if (idx >= 0) diffsets[idx] = ds; else diffsets.push(ds);
    if (!draft) await db.put('diffsets', ds);
  }
  if (!draft) {
    const applyConfig = !data.config.bundleImported || storedVersion < 2; // 처음 가져올 때(또는 모드 구성이 없던 버전)만 기본 운영 구성을 적용
    data.config = ensureLevels({
      ...data.config,
      ...(applyConfig ? { mode: (m.config && m.config.mode) || data.config.mode, levels: (m.config && m.config.levels) || data.config.levels } : {}),
      bundleImported: true, bundleVersion, id: 'main',
    });
    if (applyConfig || storedVersion !== bundleVersion) await db.put('config', data.config);
  }
  return n;
}

function currentErrors() { return validateConfig(data.config, data.books, data.diffsets, data.assets); }
function levelErrors(level) {
  if (data.config.mode === 'demo') return level === 'easy' ? [] : ['연습 모드에서는 쉬운 모드만 할 수 있어요.'];
  return validateLevel(level, data.config, data.books, data.diffsets, data.assets);
}

/** 세션 시작용 자료 묶음을 만들고 모든 이미지가 열리는지 확인한다. */
async function resolveRuntime(level) {
  const cfg = data.config;
  const isDemo = cfg.mode === 'demo';
  const spec = LEVEL_SPEC[level];
  const bookById = id => data.books.find(b => b.id === id);
  const lv = isDemo
    ? { puzzleBookIds: [DEMO_BOOK_IDS[0]], differenceSetIds: [DEMO_DIFF_ID], memoryRounds: [DEMO_BOOK_IDS.slice()] }
    : cfg.levels[level];
  const url = async id => { const u = await db.getAssetURL(id); if (!u || !(await db.verifyImageURL(u))) throw new Error('이미지를 열 수 없습니다. 운영자에게 알려 주세요.'); return u; };
  const rt = { level, isDemo, previewMs: spec.previewMs, puzzles: [], diffs: [], memoryRounds: [], usedBooks: [] };
  const used = [];
  for (const id of lv.puzzleBookIds) {
    const b = bookById(id); if (!b) throw new Error('퍼즐 도서가 부족합니다.');
    const a = data.assets.get(b.originalAssetId);
    rt.puzzles.push({ book: b, url: await url(b.originalAssetId), width: a ? a.width : 3, height: a ? a.height : 4 }); used.push(b);
  }
  for (const id of lv.differenceSetIds) {
    const d = data.diffsets.find(x => x.id === id); if (!d) throw new Error('틀린그림 자료가 부족합니다.');
    const b = bookById(d.bookId); if (!b) throw new Error('틀린그림 도서가 없습니다.');
    rt.diffs.push({ set: d, book: b, originalURL: await url(d.originalAssetId), modifiedURL: await url(d.modifiedAssetId), regions: d.regions }); used.push(b);
  }
  for (const round of lv.memoryRounds) {
    const books = [];
    for (const id of round) { const b = bookById(id); if (!b) throw new Error('메모리 도서가 부족합니다.'); books.push({ id: b.id, title: b.title, url: await url(b.originalAssetId) }); used.push(b); }
    rt.memoryRounds.push(books);
  }
  const seen = new Set();
  for (const b of used) {
    if (seen.has(b.id)) continue; seen.add(b.id);
    rt.usedBooks.push({ id: b.id, title: b.title, author: b.author, url: await url(b.originalAssetId) });
  }
  return rt;
}

// ---------- 화면 ----------
const STEPS = [{ key: 'puzzle', ico: '🧩', name: '조각 작업대' }, { key: 'diff', ico: '🔍', name: '관찰 책상' }, { key: 'memory', ico: '📚', name: '기억 책장' }];
const STAGE_OF = { S02: 0, S03: 1, S04: 1, S05: 2, S06: 2, S07: 3, S08: 3, S09: 3 };

function roundTotal(kind) {
  const rt = session.runtime; if (!rt) return 1;
  return kind === 'puzzle' ? rt.puzzles.length : kind === 'diff' ? rt.diffs.length : rt.memoryRounds.length;
}
function roundLabel(kind) {
  const total = roundTotal(kind);
  return total > 1 ? `${session.rounds[kind] + 1}/${total}` : '';
}

function topbarHTML(screen) {
  const stage = session.stage;
  const cur = STAGE_OF[screen] ?? 0;
  const rt = session.runtime;
  return `<header class="topbar">
    <div class="steps" aria-label="진행 단계">
      ${STEPS.map((s, i) => {
        const lab = roundLabel(s.key);
        return `<div class="step ${i < stage ? 'done' : ''} ${i === cur && i >= stage ? 'current' : ''}"><span class="ico">${s.ico}</span><span>${s.name}${i === cur && i >= stage && lab ? ` ${lab}` : ''}</span>${i < stage ? '<span class="stamp" aria-label="완료">✔</span>' : ''}</div>`;
      }).join('')}
      ${rt && rt.isDemo ? '<span class="badge-demo">연습용</span>' : ''}
      ${rt && !rt.isDemo ? `<span class="step" style="font-size:15px">${LEVEL_SPEC[rt.level].name}</span>` : ''}
    </div>
    <div class="topbar-right"><button class="icon-btn" id="btn-home" aria-label="처음으로 (운영자용)" title="처음으로 (운영자용)">⌂</button></div>
  </header>`;
}
function bindTopbar() {
  app.querySelector('#btn-home')?.addEventListener('click', async () => {
    const ok = await confirmDialog('운영자용 버튼입니다.\n진행 중인 체험을 끝내고 처음 화면으로 돌아갈까요?', '처음으로', '계속하기');
    if (ok) resetSession();
  });
}

const GUARD = { S01: 0, S02: 0, S03: 1, S04: 1, S05: 2, S06: 2, S07: 3, S08: 3, S09: 3 };

async function startLevel(level) {
  try { session.runtime = await resolveRuntime(level); session.level = level; go('S01'); }
  catch (e) { showModal(`<p class="msg-err">${e.message}</p><p class="sub">운영자가 교사용 설정에서 자료를 확인해 주세요.</p><div class="btn-row"><button class="btn" data-close>닫기</button></div>`); }
}

async function go(screen) {
  if (GUARD[screen] !== undefined) {
    if (!session.runtime) { screen = 'S00'; }
    else if (session.stage < GUARD[screen]) { screen = ['S00', 'S02', 'S04', 'S06'][session.stage] || 'S00'; }
  }
  if (screen === 'S09' && !session.completed) screen = 'S08';
  session.screen = screen;
  closeModal();
  window.scrollTo(0, 0);
  app.innerHTML = '';
  app.classList.remove('inspecting');

  if (screen === 'S00') {
    const errors = currentErrors();
    renderStart(app, {
      ready: errors.length === 0, errors, isDemo: data.config.mode === 'demo', soundEnabled: isSoundEnabled(),
      levels: Object.values(LEVEL_SPEC).map(s => ({ key: s.key, name: s.name, desc: s.desc, errors: levelErrors(s.key) })),
      onStart: level => startLevel(level),
      onToggleSound: async () => {
        const v = !isSoundEnabled(); setSoundEnabled(v);
        data.config.soundEnabled = v; try { await db.put('config', { ...data.config, id: 'main' }); } catch {}
        go('S00');
      },
      onAdmin: async () => { if (await confirmDialog('교사용 설정 화면으로 이동할까요?\n(학생용 화면이 아닙니다)')) go('A00'); },
      onInspect: () => askInspectLevel(),
    });
    mountInspectBar();
    return;
  }
  if (screen === 'A00') {
    await renderAdmin(app, {
      data, showModal, confirm: confirmDialog, reimportBundle: importBundle,
      onSaved: async () => { await loadData(); },
      onExit: async () => { if (await confirmDialog('시작 화면으로 돌아갈까요?')) resetSession(); },
      onPreviewPlay: async level => { await loadData(); resetSession(); await startLevel(level); },
      onInspect: async (level, targetId) => { await loadData(); await startInspect(level, targetId); },
      inspectTargets,
    });
    return;
  }

  // 학생 화면 (S01~S09)
  const rt = session.runtime;
  const wrap = document.createElement('div');
  wrap.innerHTML = topbarHTML(screen);
  const body = document.createElement('section'); body.className = 'screen game';
  app.appendChild(wrap.firstElementChild); app.appendChild(body);
  bindTopbar();


  if (screen === 'S01') renderIntro(body, { onDone: () => go('S02') });
  else if (screen === 'S02') {
    const p = rt.puzzles[session.rounds.puzzle];
    const grid = (rt.isDemo ? [2, 3] : ((LEVEL_SPEC[rt.level].puzzleGrids || [])[session.rounds.puzzle] || [2, 3]));
    renderPuzzle(body, { session, later, sfx, url: p.url, width: p.width, height: p.height, cols: grid[0], rows: grid[1], roundLabel: roundLabel('puzzle'), onComplete: () => roundDone('puzzle', 'S02', 1, 'blue', 'S03') });
  }
  else if (screen === 'S03') renderClue(body, { clueKey: 'blue', clues: session.clues, onNext: () => go('S04') });
  else if (screen === 'S04') {
    const d = rt.diffs[session.rounds.diff];
    renderDiff(body, { session, later, sfx, originalURL: d.originalURL, modifiedURL: d.modifiedURL, regions: d.regions, roundLabel: roundLabel('diff'), onComplete: () => roundDone('diff', 'S04', 2, 'star', 'S05') });
  }
  else if (screen === 'S05') renderClue(body, { clueKey: 'star', clues: session.clues, onNext: () => go('S06') });
  else if (screen === 'S06') {
    const books = rt.memoryRounds[session.rounds.memory];
    renderMemory(body, { session, later, sfx, books, previewMs: rt.previewMs, roundLabel: roundLabel('memory'), onComplete: () => roundDone('memory', 'S06', 3, 'box', 'S07') });
  }
  else if (screen === 'S07') renderClue(body, { clueKey: 'box', clues: session.clues, onNext: () => go('S08') });
  else if (screen === 'S08') renderEnding(body, { session, later, sfx, onOpened: () => { session.completed = true; }, onBooks: () => go('S09') });
  else if (screen === 'S09') renderBooks(body, { books: rt.usedBooks, isDemo: rt.isDemo, showModal, onNextDetective: () => resetSession() });
  mountInspectBar();
}

/** 시작 화면에서 점검 모드로 들어갈 때 모드를 고른다. */
function askInspectLevel() {
  const isDemo = data.config.mode === 'demo';
  const opts = isDemo ? [['easy', '연습용으로 점검']] : Object.values(LEVEL_SPEC).map(s => [s.key, s.name + '로 점검']);
  showModal(`<h3 style="margin:0 0 8px">교사용 점검 모드</h3><p class="sub">학생용 화면이 아닙니다. 어떤 모드로 점검할까요?</p>
    <div class="btn-row">${opts.map(([k, l]) => `<button class="btn small primary" data-inspect-level="${k}">${l}</button>`).join('')}<button class="btn small ghost" data-close>취소</button></div>`);
  modalRoot.querySelectorAll('[data-inspect-level]').forEach(b => b.addEventListener('click', () => { closeModal(); startInspect(b.dataset.inspectLevel, 'S00'); }));
}

// ---------- 교사용 점검 모드 ----------
/** 난이도 규격에 따른 점검 지점 목록 */
function inspectTargets(level, isDemo) {
  const spec = isDemo ? { puzzles: 1, diffs: 1, memory: [1] } : LEVEL_SPEC[level];
  const t = [{ id: 'S00', label: '시작 화면', screen: 'S00' }, { id: 'S01', label: '사건 소개', screen: 'S01' }];
  for (let i = 0; i < spec.puzzles; i++) t.push({ id: `S02-${i}`, label: `퍼즐 ${spec.puzzles > 1 ? i + 1 : ''}`.trim(), screen: 'S02', kind: 'puzzle', round: i });
  t.push({ id: 'S03', label: '첫 단서', screen: 'S03' });
  for (let i = 0; i < spec.diffs; i++) t.push({ id: `S04-${i}`, label: `틀린그림 ${spec.diffs > 1 ? i + 1 : ''}`.trim(), screen: 'S04', kind: 'diff', round: i });
  t.push({ id: 'S05', label: '두 번째 단서', screen: 'S05' });
  for (let i = 0; i < spec.memory.length; i++) t.push({ id: `S06-${i}`, label: `메모리 ${spec.memory.length > 1 ? i + 1 + '판' : ''}`.trim(), screen: 'S06', kind: 'memory', round: i });
  t.push({ id: 'S07', label: '마지막 단서', screen: 'S07' });
  t.push({ id: 'S08', label: '사건 해결', screen: 'S08' });
  t.push({ id: 'S09', label: '오늘 만난 책', screen: 'S09' });
  return t;
}
const STAGE_NEEDED = { S01: 0, S02: 0, S03: 1, S04: 1, S05: 2, S06: 2, S07: 3, S08: 3, S09: 3 };
const CLUE_ORDER = ['blue', 'star', 'box'];

/** 점검 지점으로 바로 이동: 그 화면에 필요한 진행 상태를 만들어 준다. */
async function jumpTo(target) {
  if (target.screen === 'S00') { resetSession(); return; }
  if (!session.runtime) {
    try { session.runtime = await resolveRuntime(inspectLevel); session.level = inspectLevel; }
    catch (e) { showModal(`<p class="msg-err">${e.message}</p><div class="btn-row"><button class="btn" data-close>닫기</button></div>`); return; }
  }
  const stage = STAGE_NEEDED[target.screen];
  session.stage = stage;
  session.clues = CLUE_ORDER.slice(0, stage);
  session.rounds = { puzzle: 0, diff: 0, memory: 0 };
  if (target.kind) session.rounds[target.kind] = target.round;
  if (target.kind === 'diff') session.rounds.puzzle = session.runtime.puzzles.length - 1;
  if (target.kind === 'memory') { session.rounds.puzzle = session.runtime.puzzles.length - 1; session.rounds.diff = session.runtime.diffs.length - 1; }
  session.puzzle = null; session.diff = null; session.memory = null; session.ending = null;
  session.completed = target.screen === 'S09';
  for (const t of session.timers) clearTimeout(t); session.timers.clear();
  go(target.screen);
}

async function startInspect(level, targetId) {
  inspectMode = true; inspectLevel = level;
  resetSession();
  const isDemo = data.config.mode === 'demo';
  const targets = inspectTargets(level, isDemo);
  await jumpTo(targets.find(t => t.id === targetId) || targets[0]);
}

function endInspect(toAdmin) {
  inspectMode = false;
  for (const t of session.timers) clearTimeout(t);
  closeModal(); newSession();
  go(toAdmin ? 'A00' : 'S00');
}

function currentTargetIndex(targets) {
  const s = session.screen;
  const kind = { S02: 'puzzle', S04: 'diff', S06: 'memory' }[s];
  return targets.findIndex(t => t.screen === s && (!kind || t.round === session.rounds[kind]));
}

/** 현재 화면의 판을 건너뛰어 정상 흐름대로 다음으로 보낸다. */
function skipCurrent() {
  const s = session.screen;
  if (s === 'S00') startLevel(inspectLevel);
  else if (s === 'S01') go('S02');
  else if (s === 'S02') roundDone('puzzle', 'S02', 1, 'blue', 'S03');
  else if (s === 'S03') go('S04');
  else if (s === 'S04') roundDone('diff', 'S04', 2, 'star', 'S05');
  else if (s === 'S05') go('S06');
  else if (s === 'S06') roundDone('memory', 'S06', 3, 'box', 'S07');
  else if (s === 'S07') go('S08');
  else if (s === 'S08') { session.completed = true; go('S09'); }
}

// ---- 점검 메모: 화면별로 고칠 점을 적어 두고 한 번에 복사한다 (기기 저장, 개인정보 없음) ----
const NOTES_KEY = 'bcd-inspect-notes';
function loadNotes() { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; } }
function saveNotes(n) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); } catch {} }
function notesText(n) { return n.map((x, i) => `${i + 1}. [${x.screen}] ${x.text}`).join('\n'); }

function inspectBarHTML() {
  const isDemo = data.config.mode === 'demo';
  const targets = inspectTargets(inspectLevel, isDemo);
  const idx = currentTargetIndex(targets);
  const cur = targets[idx];
  const notes = loadNotes();
  return `<div class="inspect-bar" role="region" aria-label="교사용 점검 막대">
    <span class="inspect-tag">교사 점검 · ${isDemo ? '연습용' : LEVEL_SPEC[inspectLevel].name} · 현재: ${cur ? cur.label : session.screen}</span>
    <select id="ins-jump" aria-label="바로 가기">${targets.map((t, i) => `<option value="${t.id}" ${i === idx ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
    <button class="btn small ghost" id="ins-prev" ${idx <= 0 ? 'disabled' : ''}>◀ 이전</button>
    <button class="btn small ghost" id="ins-next" ${idx >= targets.length - 1 ? 'disabled' : ''}>다음 ▶</button>
    <button class="btn small" id="ins-skip" ${session.screen === 'S09' ? 'disabled' : ''}>이 판 건너뛰기</button>
    <button class="btn small ghost" id="ins-notes">📝 메모${notes.length ? ` (${notes.length})` : ''}</button>
    <button class="btn small danger" id="ins-exit">점검 종료</button>
    <button class="btn small ghost" id="ins-admin">설정으로</button>
    <div class="inspect-notes" id="ins-panel" hidden>
      <div class="inspect-notes-head"><strong>점검 메모</strong> <span class="sub">고칠 점을 적어 두고 '전체 복사'로 붙여넣어 전달하세요.</span></div>
      <div class="row" style="align-items:stretch"><textarea id="ins-text" rows="2" placeholder="예: 틀린그림 2의 동그라미가 너무 작아요" aria-label="메모 내용"></textarea><button class="btn small primary" id="ins-add">이 화면에 메모 추가</button></div>
      <ol class="inspect-note-list" id="ins-list">${notes.map((n, i) => `<li><span class="n-screen">[${n.screen}]</span> ${n.text} <button class="n-del" data-del="${i}" aria-label="메모 삭제">✕</button></li>`).join('') || '<li class="sub">아직 메모가 없습니다.</li>'}</ol>
      <div class="btn-row" style="justify-content:flex-start;margin-top:6px">
        <button class="btn small" id="ins-copy" ${notes.length ? '' : 'disabled'}>전체 복사</button>
        <button class="btn small danger" id="ins-clear" ${notes.length ? '' : 'disabled'}>모두 지우기</button>
        <span id="ins-copy-msg" class="msg-ok"></span>
      </div>
    </div>
  </div>`;
}
function bindInspectBar() {
  const isDemo = data.config.mode === 'demo';
  const targets = inspectTargets(inspectLevel, isDemo);
  const idx = currentTargetIndex(targets);
  const cur = targets[idx];
  app.querySelector('#ins-jump')?.addEventListener('change', e => jumpTo(targets.find(t => t.id === e.target.value)));
  app.querySelector('#ins-prev')?.addEventListener('click', () => { if (idx > 0) jumpTo(targets[idx - 1]); });
  app.querySelector('#ins-next')?.addEventListener('click', () => { if (idx < targets.length - 1) jumpTo(targets[idx + 1]); });
  app.querySelector('#ins-skip')?.addEventListener('click', skipCurrent);
  app.querySelector('#ins-exit')?.addEventListener('click', () => endInspect(false));
  app.querySelector('#ins-admin')?.addEventListener('click', () => endInspect(true));
  const panel = app.querySelector('#ins-panel');
  app.querySelector('#ins-notes')?.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) app.querySelector('#ins-text').focus(); });
  const refresh = () => { const bar = app.querySelector('.inspect-bar'); const open = !panel.hidden; bar.outerHTML = inspectBarHTML(); bindInspectBar(); if (open) { const p = app.querySelector('#ins-panel'); p.hidden = false; } };
  app.querySelector('#ins-add')?.addEventListener('click', () => {
    const text = app.querySelector('#ins-text').value.trim(); if (!text) return;
    const notes = loadNotes(); notes.push({ screen: cur ? cur.label : session.screen, text, at: new Date().toISOString() }); saveNotes(notes); refresh();
  });
  app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { const notes = loadNotes(); notes.splice(Number(b.dataset.del), 1); saveNotes(notes); refresh(); }));
  app.querySelector('#ins-clear')?.addEventListener('click', async () => { if (await confirmDialog('점검 메모를 모두 지울까요?')) { saveNotes([]); refresh(); } });
  app.querySelector('#ins-copy')?.addEventListener('click', async () => {
    const text = notesText(loadNotes()); const msg = app.querySelector('#ins-copy-msg');
    try { await navigator.clipboard.writeText(text); msg.textContent = '복사했습니다. 붙여넣어 전달하세요.'; }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); msg.textContent = '복사했습니다.'; } catch { msg.textContent = '복사 실패: 메모를 직접 드래그해 복사하세요.'; } ta.remove(); }
  });
}
function mountInspectBar() {
  if (!inspectMode) return;
  app.classList.add('inspecting');
  const holder = document.createElement('div'); holder.innerHTML = inspectBarHTML();
  app.appendChild(holder.firstElementChild); bindInspectBar();
}

/** 한 판 완료: 남은 판이 있으면 다음 판으로, 없으면 단계 완료 처리 */
function roundDone(kind, screen, stageNo, clue, next) {
  if (session.stage >= stageNo) return;
  const total = roundTotal(kind);
  const r = session.rounds[kind];
  if (r + 1 < total) {
    session.rounds[kind] = r + 1;
    session[kind] = null; // 다음 판은 새 상태로
    const names = { puzzle: '표지', diff: '표지', memory: '판' };
    showModal(`<p style="font-size:26px;font-weight:700;color:var(--blue-dark);margin:0 0 6px">${r + 1}/${total} 완료!</p>
      <p style="font-size:20px">다음 ${names[kind]}도 살펴볼까?</p>
      <div class="btn-row"><button class="btn primary" id="btn-round-next">다음 ${names[kind]} ▶</button></div>`, { dismissible: false });
    modalRoot.querySelector('#btn-round-next').addEventListener('click', () => go(screen));
    return;
  }
  advance(stageNo, clue, next);
}

/** 단계 완료: 같은 세션에서 한 번만 단서를 지급하고 다음 화면으로 */
function advance(stageNo, clue, next) {
  if (session.stage >= stageNo) return;
  session.stage = stageNo;
  if (!session.clues.includes(clue)) session.clues.push(clue);
  sfx.clue();
  go(next);
}

// ---------- 시작 ----------
async function boot() {
  app.innerHTML = '<section class="screen center"><p class="sub">준비 중…</p></section>';
  try {
    await db.openDB();
    await ensureDemoData();
    await loadData();
    try { await importBundle(null); await loadData(); }
    catch (e) { console.warn('기본 제공 표지를 불러오지 못했습니다:', e.message); }
  } catch (e) {
    app.innerHTML = `<section class="screen center"><p class="msg-err">앱을 준비할 수 없습니다: ${e.message}</p><p class="sub">브라우저의 저장소(IndexedDB)를 사용할 수 있는지 확인하세요. 시크릿 창에서는 자료가 유지되지 않을 수 있습니다.</p></section>`;
    return;
  }
  newSession();
  go(location.hash === '#admin' ? 'A00' : 'S00');
  if (location.hash === '#inspect') askInspectLevel();
}

window.addEventListener('hashchange', () => {
  if (location.hash === '#admin' && session && session.screen !== 'A00') go('A00');
  if (location.hash === '#inspect' && session && !inspectMode) askInspectLevel();
});
boot();

// 1단계: 책 표지 퍼즐 (가로 2 × 세로 3, 6조각). 누르기→자리 누르기, 드래그 모두 지원.

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  // 처음부터 모두 제자리면 다시 섞기
  if (a.every((v, i) => v === i)) return shuffled(arr);
  return a;
}

/**
 * ctx: { session, later, sfx, url, width, height, onComplete, setFeedback }
 */
export function renderPuzzle(root, ctx) {
  const { session, later, sfx } = ctx;
  const COLS = ctx.cols || 2, ROWS = ctx.rows || 3, N = COLS * ROWS;
  if (!session.puzzle) {
    session.puzzle = { placed: Array(N).fill(false), order: shuffled([...Array(N).keys()]), selected: null, locked: false, done: false };
  }
  const st = session.puzzle;
  const ratio = ctx.width / ctx.height;
  const pieceRatio = ratio * ROWS / COLS;
  const bgPos = p => `${COLS > 1 ? (p % COLS) / (COLS - 1) * 100 : 0}% ${ROWS > 1 ? Math.floor(p / COLS) / (ROWS - 1) * 100 : 0}%`;

  root.innerHTML = `
    <p class="guide"><span class="gt">책 표지를 <em>맞춰요!</em>${N > 6 ? ` <span class="round-label">${N}조각</span>` : ''}${ctx.roundLabel ? ` <span class="round-label">${ctx.roundLabel}</span>` : ''}</span><span class="gs">조각을 누르고, 자리를 눌러요.</span></p>
    <div class="puzzle-layout" style="--ratio:${ratio};--pr:${pieceRatio}">
      <div class="board" id="board" aria-label="퍼즐 판" style="--ratio:${ratio};grid-template-columns:repeat(${COLS},1fr);grid-template-rows:repeat(${ROWS},1fr)">
        ${[...Array(N).keys()].map(i => `<button class="slot" data-slot="${i}" aria-label="${Math.floor(i / COLS) + 1}번째 줄 ${i % COLS + 1}번째 자리"></button>`).join('')}
      </div>
      <div class="side">
        <div class="preview-mini"><img src="${ctx.url}" alt="완성 표지 미리보기"><div class="lab">완성 모습</div></div>
        <div class="tray" id="tray" aria-label="조각 보관함" style="grid-template-columns:repeat(${N > 6 ? 5 : 3},1fr)">
          ${st.order.map(p => `<div class="piece-wrap ${st.placed[p] ? 'placed' : ''}">
            <button class="piece" data-piece="${p}" aria-label="조각 ${p + 1}" style="background-image:url('${ctx.url}');background-size:${COLS * 100}% ${ROWS * 100}%;background-position:${bgPos(p)}"></button><span class="check">✔</span></div>`).join('')}
        </div>
        <div class="help-area">
          <span class="progress" id="pz-progress">붙인 조각 ${st.placed.filter(Boolean).length}/${N}</span>
          <button class="btn small ghost" id="pz-hint">💡 도와줘</button>
        </div>
      </div>
    </div>
    <div class="feedback" id="pz-feedback"></div>`;

  const board = root.querySelector('#board');
  const tray = root.querySelector('#tray');
  const feedback = root.querySelector('#pz-feedback');
  const progress = root.querySelector('#pz-progress');

  // 이미 배치된 조각 복원 (화면 다시 그릴 때)
  st.placed.forEach((v, i) => { if (v) fillSlot(i); });
  if (st.selected !== null) markSelected(st.selected);

  function pieceStyle(p) {
    return `background-image:url('${ctx.url}');background-size:${COLS * 100}% ${ROWS * 100}%;background-position:${bgPos(p)}`;
  }
  function fillSlot(i) {
    const slot = board.querySelector(`[data-slot="${i}"]`);
    slot.classList.add('filled');
    slot.innerHTML = `<div class="piece" style="${pieceStyle(i)}" aria-hidden="true"></div>`;
    slot.setAttribute('aria-label', `${i + 1}번 조각이 붙은 자리`);
    slot.disabled = true;
  }
  function markSelected(p) {
    tray.querySelectorAll('.piece').forEach(el => el.classList.toggle('selected', Number(el.dataset.piece) === p));
  }
  function say(t) { feedback.textContent = t; }

  function tryPlace(p, slotIdx) {
    if (st.locked || st.done) return;
    if (st.placed[p]) return;
    if (p === slotIdx && !st.placed[slotIdx]) {
      st.placed[p] = true; st.selected = null;
      fillSlot(p);
      const wrap = tray.querySelector(`[data-piece="${p}"]`).parentElement;
      wrap.classList.add('placed'); markSelected(null);
      progress.textContent = `붙인 조각 ${st.placed.filter(Boolean).length}/${N}`;
      sfx.ok(); say('딱 맞아요!');
      if (st.placed.every(Boolean)) finish();
    } else {
      const slot = board.querySelector(`[data-slot="${slotIdx}"]`);
      slot.classList.remove('wrong'); void slot.offsetWidth; slot.classList.add('wrong');
      sfx.no(); say('다시 살펴볼까? 다른 자리를 눌러 봐요.');
    }
  }

  function finish() {
    if (st.done) return;
    st.done = true; st.locked = true;
    say('완성!'); sfx.done();
    const ov = document.createElement('div');
    ov.className = 'overlay-full';
    ov.innerHTML = `<h2 style="margin:0;color:var(--brown)">표지를 되살렸어!</h2><img src="${ctx.url}" alt="완성된 책 표지">`;
    root.appendChild(ov);
    later(() => ctx.onComplete(), 1600);
  }

  // ---- 누르기 입력 ----
  tray.addEventListener('click', e => {
    const btn = e.target.closest('.piece'); if (!btn || st.locked) return;
    const p = Number(btn.dataset.piece); if (st.placed[p]) return;
    st.selected = (st.selected === p) ? null : p;
    markSelected(st.selected); sfx.select();
    say(st.selected === null ? '' : '이제 알맞은 자리를 눌러요.');
  });
  board.addEventListener('click', e => {
    const slot = e.target.closest('.slot'); if (!slot || st.locked) return;
    const i = Number(slot.dataset.slot);
    if (st.selected === null) { say('먼저 조각을 눌러요.'); return; }
    tryPlace(st.selected, i);
  });

  // ---- 드래그 입력 (포인터 기반, 터치·마우스 공통) ----
  let drag = null;
  tray.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.piece'); if (!btn || st.locked) return;
    const p = Number(btn.dataset.piece); if (st.placed[p]) return;
    drag = { p, sx: e.clientX, sy: e.clientY, moving: false, ghost: null, btn, pid: e.pointerId };
  });
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moving) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moving = true;
      const r = drag.btn.getBoundingClientRect();
      const gh = drag.btn.cloneNode(true);
      gh.classList.add('drag-ghost'); gh.classList.remove('selected');
      gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px'; gh.style.left = r.left + 'px'; gh.style.top = r.top + 'px';
      document.body.appendChild(gh); drag.ghost = gh; drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top;
      try { drag.btn.setPointerCapture(e.pointerId); } catch {}
    }
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
    drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
    board.querySelectorAll('.slot').forEach(s => s.classList.remove('hint'));
    const el = hitSlot(e.clientX, e.clientY);
    if (el && !el.classList.contains('filled')) el.classList.add('hint');
  }
  function hitSlot(x, y) {
    if (drag && drag.ghost) drag.ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (drag && drag.ghost) drag.ghost.style.display = '';
    return el ? el.closest('.slot') : null;
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    board.querySelectorAll('.slot').forEach(s => s.classList.remove('hint'));
    if (d.ghost) d.ghost.remove();
    if (!d.moving) return; // 단순 누르기는 click 이벤트가 처리
    e.preventDefault();
    const slot = hitSlot(e.clientX, e.clientY);
    if (slot) { st.selected = null; markSelected(null); tryPlace(d.p, Number(slot.dataset.slot)); }
    else say('조각은 보관함에 그대로 있어요. 다시 해 봐요.');
    // click 이벤트가 뒤따라 선택을 바꾸지 않도록
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  }
  let suppressClick = false;
  tray.addEventListener('click', e => { if (suppressClick) { e.stopImmediatePropagation(); } }, true);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  // ---- 도움 ----
  root.querySelector('#pz-hint').addEventListener('click', () => {
    if (st.locked) return;
    let p = st.selected;
    if (p === null || st.placed[p]) { p = st.order.find(i => !st.placed[i]); if (p === undefined) return; }
    const piece = tray.querySelector(`[data-piece="${p}"]`);
    const slot = board.querySelector(`[data-slot="${p}"]`);
    piece.classList.add('hint'); slot.classList.add('hint');
    say('반짝이는 조각을 반짝이는 자리에 넣어요.');
    later(() => { piece.classList.remove('hint'); slot.classList.remove('hint'); }, 2000);
  });
}

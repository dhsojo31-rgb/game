// 3단계: 책 표지 메모리 게임. 서로 다른 책 4종 × 2장 = 8장, 4쌍.
const PREVIEW_MS = 3000, MISMATCH_MS = 1000, HINT_MS = 2000, MATCH_DELAY = 500;

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** ctx: { session, later, sfx, books: [{id,title,url}] x4, onComplete } */
export function renderMemory(root, ctx) {
  const { session, later, sfx } = ctx;
  if (!session.memory) {
    const cards = [];
    ctx.books.forEach(b => { cards.push({ cardId: `${b.id}#1`, bookId: b.id, url: b.url, title: b.title }); cards.push({ cardId: `${b.id}#2`, bookId: b.id, url: b.url, title: b.title }); });
    session.memory = { cards: shuffled(cards), open: [], matched: new Set(), found: 0, lock: false, previewing: true, hinting: false, done: false, started: false };
  }
  const st = session.memory;
  const total = ctx.books.length;
  const cols = st.cards.length > 8 ? 6 : 4;
  const previewMs = ctx.previewMs || PREVIEW_MS;

  root.innerHTML = `
    <p class="guide"><span class="gt">같은 책 표지를 <em>찾아요!</em>${ctx.roundLabel ? ` <span class="round-label">${ctx.roundLabel}</span>` : ''}</span><span class="gs" id="mm-sub">카드 두 장을 눌러 같은 표지를 찾아요.</span></p>
    <div class="memory-wrap"><div class="pv-count" id="mm-count" aria-live="assertive" hidden></div><div class="memory-grid" id="mgrid" style="--cols:${cols}">
      ${st.cards.map((c, i) => `<button class="mcard" data-i="${i}" aria-label="카드 ${i + 1}">
        <span class="done-mark">✔</span>
        <div class="inner">
          <div class="face back" aria-hidden="true">📘</div>
          <div class="face front"><img src="${c.url}" alt="${c.title}" draggable="false"></div>
        </div></button>`).join('')}
    </div></div>
    <div class="help-area">
      <span class="progress" id="mm-progress">찾은 짝 ${st.found}/${total}</span>
      <button class="btn small ghost" id="mm-hint">${ctx.hints.label()}</button>
    </div>
    <div class="feedback" id="mm-feedback"></div>`;

  const grid = root.querySelector('#mgrid');
  const cardsEl = [...grid.querySelectorAll('.mcard')];
  const feedback = root.querySelector('#mm-feedback');
  const progress = root.querySelector('#mm-progress');
  const hintBtn = root.querySelector('#mm-hint');
  const subEl = root.querySelector('#mm-sub');
  const say = t => { feedback.textContent = t; };

  function sync() {
    st.cards.forEach((c, i) => {
      const el = cardsEl[i];
      const matched = st.matched.has(c.cardId);
      el.classList.toggle('matched', matched);
      el.classList.toggle('open', !matched && (st.open.includes(i) || st.previewing || st.hinting));
      el.disabled = matched || st.previewing || st.hinting || st.lock;
    });
    hintBtn.disabled = st.previewing || st.hinting || st.lock || st.done || ctx.hints.left() <= 0;
    hintBtn.textContent = ctx.hints.label();
    subEl.innerHTML = st.previewing ? `<span class="pv-badge">미리보기</span> 먼저 표지를 살펴봐요. <b class="pv-sec">${st.countdown ?? ''}</b>` : '카드 두 장을 눌러 같은 표지를 찾아요.';
    progress.textContent = `찾은 짝 ${st.found}/${total}`;
  }

  // 최초 미리보기: 전체 앞면 3초
  const countEl = root.querySelector('#mm-count');
  function showCount(n) {
    st.countdown = n;
    countEl.hidden = false; countEl.textContent = String(n);
    countEl.classList.remove('tick'); void countEl.offsetWidth; countEl.classList.add('tick');
    sync();
  }
  if (!st.started) {
    st.started = true; st.previewing = true;
    say('카드를 잘 기억해요!');
    // 3 → 2 → 1 초를 센 뒤 카드를 뒤집는다 (미리보기 시간만큼)
    const secs = Math.max(1, Math.round(previewMs / 1000));
    showCount(secs);
    for (let k = 1; k < secs; k++) later(() => showCount(secs - k), k * 1000);
    later(() => { st.previewing = false; st.countdown = null; countEl.hidden = true; say('이제 같은 표지 두 장을 찾아요.'); sync(); }, previewMs);
  } else if (st.previewing && st.countdown) {
    showCount(st.countdown);
  }
  sync();

  grid.addEventListener('click', e => {
    const el = e.target.closest('.mcard'); if (!el) return;
    const i = Number(el.dataset.i);
    if (st.previewing || st.hinting || st.lock || st.done) return;
    const c = st.cards[i];
    if (st.matched.has(c.cardId) || st.open.includes(i)) return; // 같은 카드 연속 입력·맞춘 카드 무시
    st.open.push(i); sfx.flip(); sync();
    if (st.open.length === 2) {
      st.lock = true; sync();
      const [a, b] = st.open.map(k => st.cards[k]);
      if (a.bookId === b.bookId && a.cardId !== b.cardId) {
        later(() => {
          st.matched.add(a.cardId); st.matched.add(b.cardId);
          st.found += 1; st.open = []; st.lock = false;
          sfx.ok(); say('짝을 찾았어!'); sync();
          if (st.found >= total) finish();
        }, MATCH_DELAY);
      } else {
        later(() => { st.open = []; st.lock = false; say('다른 짝이에요. 다시 살펴볼까?'); sync(); }, MISMATCH_MS);
      }
    }
  });

  hintBtn.addEventListener('click', () => {
    if (st.previewing || st.hinting || st.lock || st.done) return;
    if (!ctx.hints.use()) { sync(); return; }
    st.open = []; // 한 장만 열린 상태면 선택 해제
    st.hinting = true; sync(); say('남은 카드를 잘 봐 두세요!');
    later(() => { st.hinting = false; st.open = []; sync(); say(''); }, HINT_MS);
  });

  function finish() {
    if (st.done) return;
    st.done = true; st.lock = true; sync();
    sfx.done(); say('카드 정리 끝!');
    later(() => ctx.onComplete(), 1400);
  }
}

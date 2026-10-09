// 2단계: 책 표지 틀린그림 찾기. 원본·수정본에서 정확히 3곳.
// 정답 영역은 이미지 내부 상대 좌표(0~1). 판정은 실제 이미지가 표시된 사각형 기준.

/** ctx: { session, later, sfx, originalURL, modifiedURL, regions, onComplete } */
export function renderDiff(root, ctx) {
  const { session, later, sfx } = ctx;
  const regions = ctx.regions;
  if (!session.diff) session.diff = { found: [], locked: false, done: false };
  const st = session.diff;

  root.innerHTML = `
    <p class="guide"><span class="gt">다른 곳 <em>3개</em>를 찾아요!${ctx.roundLabel ? ` <span class="round-label">${ctx.roundLabel}</span>` : ''}</span><span class="gs">두 표지에서 다른 곳 3개를 눌러요.</span></p>
    <div class="diff-layout">
      <div class="diff-col"><div class="lab">원래 표지</div><div class="diff-wrap" data-side="a"><img src="${ctx.originalURL}" alt="원래 책 표지" draggable="false"><div class="marks"></div></div></div>
      <div class="diff-col"><div class="lab">달라진 표지</div><div class="diff-wrap" data-side="b"><img src="${ctx.modifiedURL}" alt="달라진 책 표지" draggable="false"><div class="marks"></div></div></div>
    </div>
    <div class="help-area">
      <span class="progress" id="df-progress">찾은 곳 ${st.found.length}/${regions.length}</span>
      <button class="btn small ghost" id="df-hint">💡 도와줘</button>
    </div>
    <div class="feedback" id="df-feedback"></div>`;

  const wraps = [...root.querySelectorAll('.diff-wrap')];
  const feedback = root.querySelector('#df-feedback');
  const progress = root.querySelector('#df-progress');
  const say = t => { feedback.textContent = t; };

  function regionAt(rx, ry) {
    // 손가락 오차를 위해 영역을 약간 넓혀 판정하되, 하나만 반환
    const pad = 0.015;
    return regions.find(r => rx >= r.x - pad && rx <= r.x + r.width + pad && ry >= r.y - pad && ry <= r.y + r.height + pad);
  }

  function drawMark(r, cls = '') {
    for (const w of wraps) {
      const m = document.createElement('div');
      m.className = 'mark ' + cls;
      m.style.left = `${r.x * 100}%`; m.style.top = `${r.y * 100}%`;
      m.style.width = `${r.width * 100}%`; m.style.height = `${r.height * 100}%`;
      m.dataset.region = r.id;
      w.querySelector('.marks').appendChild(m);
    }
  }
  // 이미 찾은 곳 복원
  for (const id of st.found) { const r = regions.find(x => x.id === id); if (r) drawMark(r); }

  function handle(e) {
    if (st.locked || st.done) return;
    const wrap = e.currentTarget;
    const img = wrap.querySelector('img');
    const rect = img.getBoundingClientRect(); // 여백을 제외한 실제 이미지 사각형
    if (rect.width === 0) return;
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return; // 이미지 밖
    const r = regionAt(rx, ry);
    if (r && !st.found.includes(r.id)) {
      st.found.push(r.id);
      drawMark(r);
      progress.textContent = `찾은 곳 ${st.found.length}/${regions.length}`;
      sfx.ok(); say('찾았다!');
      if (st.found.length >= regions.length) finish();
    } else if (r) {
      say('여기는 이미 찾았어요!');
    } else {
      const miss = document.createElement('div');
      miss.className = 'miss'; miss.style.left = `${rx * 100}%`; miss.style.top = `${ry * 100}%`;
      wrap.querySelector('.marks').appendChild(miss);
      later(() => miss.remove(), 1000);
      sfx.no(); say('다른 곳도 살펴볼까?');
    }
  }
  wraps.forEach(w => w.addEventListener('click', handle));

  function finish() {
    if (st.done) return;
    st.done = true; st.locked = true;
    sfx.done(); say('세 곳 모두 찾았어!');
    later(() => ctx.onComplete(), 1400);
  }

  root.querySelector('#df-hint').addEventListener('click', () => {
    if (st.locked || st.done) return;
    const r = regions.find(x => !st.found.includes(x.id));
    if (!r) return;
    root.querySelectorAll('.mark.ring').forEach(m => m.remove());
    drawMark(r, 'ring');
    say('반짝이는 곳을 자세히 봐요.');
    later(() => root.querySelectorAll('.mark.ring').forEach(m => m.remove()), 2500);
  });
}

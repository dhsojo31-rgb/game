// 4단계: 책 표지 숨은 그림 찾기. 위쪽 '찾을 물건' 목록(표지에서 오려낸 작은 그림 + 이름)을 보고 그림에서 눌러 찾는다.
// 물건 위치는 이미지 내부 상대 좌표(0~1). 판정은 실제 이미지가 표시된 사각형 기준.
// kind 가 있는 물건은 표지 위에 숨겨 둔 그림(objects.js)이고, 없으면 표지 속 그림을 오려 보여 준다.
import { objectSVG, objectName } from '../objects.js';

/** ctx: { session, later, sfx, url, width, height, items, roundLabel, hints, onComplete } */
export function renderHidden(root, ctx) {
  const { session, later, sfx } = ctx;
  const items = ctx.items;
  if (!session.hidden) session.hidden = { found: [], locked: false, done: false };
  const st = session.hidden;
  const imgRatio = ctx.width / ctx.height;

  const nameOf = it => it.name || objectName(it.kind);
  const thumbHTML = it => it.kind ? `<div class="hid-thumb obj">${objectSVG(it.kind)}</div>` : `<div class="hid-thumb" style="${thumbStyle(it)}" role="img" aria-label="${nameOf(it)}"></div>`;
  const thumbStyle = it => {
    const bw = 100 / Math.max(it.width, 0.01), bh = 100 / Math.max(it.height, 0.01);
    const px = it.width >= 1 ? 0 : it.x / (1 - it.width) * 100, py = it.height >= 1 ? 0 : it.y / (1 - it.height) * 100;
    return `background-image:url('${ctx.url}');background-size:${bw}% ${bh}%;background-position:${px}% ${py}%;aspect-ratio:${(it.width * imgRatio) / it.height}`;
  };

  root.innerHTML = `
    <p class="guide"><span class="gt">숨은 그림을 <em>찾아요!</em>${ctx.roundLabel ? ` <span class="round-label">${ctx.roundLabel}</span>` : ''}</span><span class="gs">위의 물건 ${items.length}개를 표지에서 찾아 눌러요.</span></p>
    <div class="hid-layout"><div class="hid-list" id="hid-list" aria-label="찾을 물건">
      <span class="hid-list-title">찾을 물건</span>
      ${items.map(it => `<div class="hid-item ${st.found.includes(it.id) ? 'found' : ''}" data-item="${it.id}">${thumbHTML(it)}<span class="hid-name">${nameOf(it)}</span><span class="hid-check" aria-hidden="true">✔</span></div>`).join('')}
    </div>
    <div class="hid-wrap" id="hid-wrap" style="--r:${imgRatio}"><img src="${ctx.url}" alt="숨은 그림이 있는 책 표지" draggable="false"><div class="hid-objs" aria-hidden="true">${items.filter(it => it.kind).map(it => `<div class="hid-obj" data-obj="${it.id}" style="left:${it.x * 100}%;top:${it.y * 100}%;width:${it.width * 100}%;height:${it.height * 100}%;transform:rotate(${it.rot || 0}deg)">${objectSVG(it.kind)}</div>`).join('')}</div><div class="marks"></div></div></div>
    <div class="help-area">
      <span class="progress" id="hid-progress">찾은 물건 ${st.found.length}/${items.length}</span>
      <button class="btn small ghost" id="hid-hint">${ctx.hints.label()}</button>
    </div>
    <div class="feedback" id="hid-feedback"></div>`;

  const wrap = root.querySelector('#hid-wrap');
  const marks = wrap.querySelector('.marks');
  const feedback = root.querySelector('#hid-feedback');
  const progress = root.querySelector('#hid-progress');
  const hintBtn = root.querySelector('#hid-hint');
  const say = t => { feedback.textContent = t; };
  const syncHint = () => { hintBtn.textContent = ctx.hints.label(); hintBtn.disabled = ctx.hints.left() <= 0; };
  syncHint();

  function itemAt(rx, ry) {
    const pad = 0.015;
    // 아직 못 찾은 물건을 우선 판정 (겹치는 경우 대비)
    const hit = items.filter(it => rx >= it.x - pad && rx <= it.x + it.width + pad && ry >= it.y - pad && ry <= it.y + it.height + pad);
    return hit.find(it => !st.found.includes(it.id)) || hit[0] || null;
  }
  function drawMark(it, cls = '') {
    const m = document.createElement('div');
    m.className = 'mark ' + cls;
    m.style.left = `${it.x * 100}%`; m.style.top = `${it.y * 100}%`; m.style.width = `${it.width * 100}%`; m.style.height = `${it.height * 100}%`;
    m.dataset.item = it.id;
    marks.appendChild(m);
  }
  for (const id of st.found) { const it = items.find(x => x.id === id); if (it) drawMark(it); }

  wrap.addEventListener('click', e => {
    if (st.locked || st.done) return;
    const img = wrap.querySelector('img');
    const rect = img.getBoundingClientRect();
    if (rect.width === 0) return;
    const rx = (e.clientX - rect.left) / rect.width, ry = (e.clientY - rect.top) / rect.height;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return;
    const it = itemAt(rx, ry);
    if (it && !st.found.includes(it.id)) {
      st.found.push(it.id);
      drawMark(it);
      root.querySelector(`.hid-item[data-item="${it.id}"]`)?.classList.add('found');
      progress.textContent = `찾은 물건 ${st.found.length}/${items.length}`;
      sfx.ok(); say(`${nameOf(it)} 찾았다!`);
      if (st.found.length >= items.length) finish();
    } else if (it) {
      say('여기는 이미 찾았어요!');
    } else {
      const miss = document.createElement('div');
      miss.className = 'miss'; miss.style.left = `${rx * 100}%`; miss.style.top = `${ry * 100}%`;
      marks.appendChild(miss);
      later(() => miss.remove(), 1000);
      sfx.no(); say('다른 곳도 살펴볼까?');
    }
  });

  hintBtn.addEventListener('click', () => {
    if (st.locked || st.done) return;
    const it = items.find(x => !st.found.includes(x.id));
    if (!it) return;
    if (!ctx.hints.use()) { syncHint(); return; }
    syncHint();
    marks.querySelectorAll('.mark.ring').forEach(m => m.remove());
    drawMark(it, 'ring');
    root.querySelector(`.hid-item[data-item="${it.id}"]`)?.classList.add('hint');
    say(`반짝이는 곳에 ${nameOf(it)}이(가) 있어요.`);
    later(() => { marks.querySelectorAll('.mark.ring').forEach(m => m.remove()); root.querySelectorAll('.hid-item.hint').forEach(el => el.classList.remove('hint')); }, 2500);
  });

  function finish() {
    if (st.done) return;
    st.done = true; st.locked = true;
    sfx.done(); say('물건을 모두 찾았어!');
    later(() => ctx.onComplete(), 1400);
  }
}

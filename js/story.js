// 이야기 화면: 시작, 사건 소개, 단서 획득, 사건 해결, 오늘 만난 책
import { moaSVG, clueSVG, CLUES, introPanelSVG, endingSceneSVG, badgeSVG } from './art.js';

export function renderStart(root, ctx) {
  const { ready, errors, isDemo, soundEnabled } = ctx;
  root.innerHTML = `
    <section class="screen center">
      ${moaSVG('start-moa')}
      <h1 class="title-main">책표지 탐정단</h1>
      <p class="title-sub">사라진 이야기 열쇠 ${isDemo ? '<span class="badge-demo">연습용</span>' : ''}</p>
      ${ready
        ? `<p class="sub">책 표지를 살펴보며 열쇠를 찾는 탐정 놀이예요. 어떤 모드로 할까요?</p>
           <div class="level-row">
             ${ctx.levels.map((lv, i) => `<button class="btn level-btn ${i === 0 ? 'primary' : ''}" id="btn-start-${lv.key}" data-level="${lv.key}" ${lv.errors.length ? 'disabled' : ''}>
               <span class="lv-name">${lv.name}</span><span class="lv-desc">${lv.desc}</span></button>`).join('')}
           </div>
           ${ctx.levels.filter(lv => lv.errors.length).map(lv => `<p class="level-note">${lv.name}은(는) 아직 준비되지 않았어요 (운영자 확인: ${lv.errors[0]})</p>`).join('')}`
        : `<div class="card" style="max-width:640px;text-align:left">
             <p class="msg-err">운영 자료가 아직 준비되지 않았어요. 운영자가 교사용 설정에서 확인해 주세요.</p>
             <ul class="check-list">${errors.map(e => `<li>${e}</li>`).join('')}</ul>
             <div class="btn-row"><button class="btn small" id="btn-admin2">교사용 설정 열기</button></div>
           </div>`}
      <div class="step-strip" aria-label="세 가지 게임 순서">
        <span class="st"><i>🧩</i>퍼즐</span><span class="dots"></span><span class="st"><i>🔍</i>틀린그림</span><span class="dots"></span><span class="st"><i>📚</i>메모리</span>
      </div>
      <div class="btn-row">
        <button class="btn small ghost" id="btn-sound" aria-pressed="${soundEnabled}">${soundEnabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'}</button>
      </div>
      <div class="footer-links">
        <button id="btn-admin">교사용 설정</button>
        <button id="btn-inspect">교사용 점검</button>
      </div>
    </section>`;
  root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => ctx.onStart(b.dataset.level)));
  root.querySelector('#btn-sound').addEventListener('click', ctx.onToggleSound);
  root.querySelector('#btn-admin').addEventListener('click', ctx.onAdmin);
  root.querySelector('#btn-inspect')?.addEventListener('click', ctx.onInspect);
  root.querySelector('#btn-admin2')?.addEventListener('click', ctx.onAdmin);
}

export function renderIntro(root, ctx) {
  const lines = ['“오늘은 책 축제 날이야!”', '“앗! 문을 여는 열쇠가 없어졌어!”', '“책 표지에 단서가 있대. 함께 찾아줄래?”'];
  let shown = 1;
  root.innerHTML = `
    <section class="screen center">
      <div style="align-self:flex-end"><button class="btn small ghost" id="btn-skip">바로 출동 ▶</button></div>
      <div class="comic" id="comic">
        ${[1, 2, 3].map(n => `<div class="panel ${n === 1 ? 'shown' : ''}" data-n="${n}">${introPanelSVG(n)}<div class="cap">${n === 1 ? lines[0] : ''}</div></div>`).join('')}
      </div>
      <div class="moa-say">${moaSVG()}<div class="bubble" id="bubble">${lines[0]}</div></div>
      <div class="btn-row"><button class="btn primary" id="btn-next">다음</button></div>
    </section>`;
  const next = root.querySelector('#btn-next');
  next.addEventListener('click', () => {
    if (shown < 3) {
      shown++;
      const p = root.querySelector(`.panel[data-n="${shown}"]`);
      p.classList.add('shown'); p.querySelector('.cap').textContent = lines[shown - 1];
      root.querySelector('#bubble').textContent = lines[shown - 1];
      if (shown === 3) next.textContent = '탐정 출동!';
    } else ctx.onDone();
  });
  root.querySelector('#btn-skip').addEventListener('click', ctx.onDone);
}

export function notebookHTML(clues) {
  return `<div class="notebook" aria-label="단서 수첩">
    ${['blue', 'star', 'box', 'map'].map(k => clues.includes(k)
      ? `<div class="slotc got">${clueSVG(k)}<span>${CLUES[k].name}</span></div>`
      : `<div class="slotc"><span style="font-size:40px">?</span><span>아직</span></div>`).join('')}
  </div>`;
}

export function renderClue(root, ctx) {
  const c = CLUES[ctx.clueKey];
  root.innerHTML = `
    <section class="screen center clue-screen">
      <h2 style="color:var(--brown);margin:0">${ctx.clueKey === 'map' ? '마지막 단서' : ctx.clueKey === 'box' ? '세 번째 단서' : ctx.clueKey === 'star' ? '두 번째 단서' : '첫 단서'}</h2>
      <div class="clue-big">${clueSVG(ctx.clueKey)}</div>
      <p class="sub" style="font-weight:700">${c.item}을(를) 찾았어요!</p>
      <div class="moa-say">${moaSVG()}<div class="bubble">${c.line}</div></div>
      ${notebookHTML(ctx.clues)}
      <div class="btn-row sticky-next"><button class="btn primary" id="btn-next">${ctx.clueKey === 'map' ? '열쇠 찾으러 가기' : '다음 단서 찾기'}</button></div>
    </section>`;
  root.querySelector('#btn-next').addEventListener('click', ctx.onNext);
}

export function renderEnding(root, ctx) {
  const { session, later, sfx } = ctx;
  if (!session.ending) session.ending = { opened: false, celebrated: false };
  const st = session.ending;
  root.innerHTML = `
    <section class="screen center">
      <h2 style="color:var(--brown);margin:0">사건 해결</h2>
      ${notebookHTML(['blue', 'star', 'box', 'map'])}
      <div class="moa-say">${moaSVG()}<div class="bubble" id="bubble">“책장 아래, 별이 붙은 파란 상자! 열쇠가 그 안에 있겠어!”</div></div>
      <button class="box-btn" id="box" aria-label="별이 붙은 파란 상자 열기">${endingSceneSVG(st.opened ? 'open' : 'closed')}</button>
      <div id="celebrate"></div>
    </section>`;
  const box = root.querySelector('#box');
  const bubble = root.querySelector('#bubble');
  function showCelebration(instant) {
    const cel = root.querySelector('#celebrate');
    cel.innerHTML = `
      <div class="confetti" aria-hidden="true">🎉 📖 ✨ 📚 🎉</div>
      ${badgeSVG()}
      <p style="font-size:24px;font-weight:700;color:var(--blue-dark);margin:8px 0">사건 해결! 책표지 탐정단, 고마워!</p>
      <p class="sub" style="font-weight:700">자세히 보고, 비교하고, 기억해서 열쇠를 찾았어!</p>
      <div class="btn-row sticky-next"><button class="btn primary" id="btn-books">오늘 만난 책</button></div>`;
    cel.querySelector('#btn-books').addEventListener('click', ctx.onBooks);
    if (!instant) cel.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  if (st.opened) { box.disabled = true; bubble.textContent = '“찾았다! 바람이 열쇠를 이곳으로 날려 보냈구나!”'; showCelebration(true); }
  box.addEventListener('click', () => {
    if (st.opened) return;
    st.opened = true; box.disabled = true;
    box.innerHTML = endingSceneSVG('open');
    bubble.textContent = '“찾았다! 바람이 열쇠를 이곳으로 날려 보냈구나!”';
    sfx.done();
    ctx.onOpened();
    const skip = document.createElement('div');
    skip.className = 'btn-row'; skip.innerHTML = `<button class="btn small ghost" id="btn-skipc">건너뛰기 ▶</button>`;
    root.querySelector('#celebrate').appendChild(skip);
    let shown = false;
    const show = () => { if (shown) return; shown = true; showCelebration(false); };
    skip.querySelector('#btn-skipc').addEventListener('click', show);
    later(show, 1800);
  });
}

export function renderBooks(root, ctx) {
  const { books, isDemo } = ctx;
  root.innerHTML = `
    <section class="screen center">
      <h2 style="color:var(--brown);margin:0">오늘 만난 책 ${isDemo ? '<span class="badge-demo">연습용</span>' : ''}</h2>
      <div class="moa-say">${moaSVG()}<div class="bubble">“어떤 책이 가장 궁금해?”</div></div>
      <div class="book-grid">
        ${books.map(b => `<button class="book-tile" data-id="${b.id}" aria-label="${b.title} 크게 보기"><div class="cover"><img src="${b.url}" alt="${b.title}"></div><div class="t">${b.title}</div></button>`).join('')}
      </div>
      <p class="sub" style="margin-top:14px">표지를 누르면 크게 볼 수 있어요.</p>
      <div class="btn-row sticky-next"><button class="btn primary" id="btn-next" style="font-size:26px">처음 화면으로</button></div>
    </section>`;
  root.querySelectorAll('.book-tile').forEach(el => el.addEventListener('click', () => {
    const b = books.find(x => x.id === el.dataset.id);
    ctx.showModal(`
      <img class="big" src="${b.url}" alt="${b.title}">
      <h3 style="margin:12px 0 4px">${b.title}</h3>
      <p class="sub" style="margin:0 0 10px">${b.author || '저자 확인 필요'}</p>
      <p style="font-weight:700;color:var(--blue-dark);font-size:22px">도서관에서 이 책을 찾아봐!</p>
      <div class="btn-row"><button class="btn" data-close>닫기</button></div>`);
  }));
  root.querySelector('#btn-next').addEventListener('click', ctx.onNextDetective);
}

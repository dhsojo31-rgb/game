// 교사용 설정(A00): 도서 등록, 난이도별 도서 선택, 수정본·정답 영역 편집, 검증, 저장.
import * as db from './db.js';
import { validateConfig, validateLevel, diffsetStatus, hiddensetStatus, ensureLevels, LEVEL_SPEC } from './validate.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * ctx: { data: {books, diffsets, config, assets(Map)}, onSaved(), onExit(), onPreviewPlay(level), showModal, confirm, reimportBundle }
 */
export async function renderAdmin(root, ctx) {
  // 초안(draft)에서 편집하고 '저장'에서만 기록한다.
  const draft = {
    books: ctx.data.books.map(b => ({ ...b })),
    diffsets: ctx.data.diffsets.map(d => ({ ...d, regions: (d.regions || []).map(r => ({ ...r })) })),
    hiddensets: (ctx.data.hiddensets || []).map(h => ({ ...h, items: (h.items || []).map(it => ({ ...it })) })),
    config: ensureLevels(JSON.parse(JSON.stringify(ctx.data.config))),
  };
  const assets = ctx.data.assets; // Map id -> {width,height}
  const firstReal = draft.diffsets.find(d => !d.isDemo);
  let editingDiffId = draft.config.levels.easy.differenceSetIds[0] && draft.diffsets.some(d => d.id === draft.config.levels.easy.differenceSetIds[0]) ? draft.config.levels.easy.differenceSetIds[0] : (firstReal ? firstReal.id : null);
  let activeRegion = null;
  let testMode = false;
  const firstHidden = draft.hiddensets.find(h => !h.isDemo);
  let editingHiddenId = draft.config.levels.easy.hiddenSetIds?.[0] && draft.hiddensets.some(h => h.id === draft.config.levels.easy.hiddenSetIds[0]) ? draft.config.levels.easy.hiddenSetIds[0] : (firstHidden ? firstHidden.id : null);
  let activeItem = null;
  let hidTestMode = false;
  let status = { type: '', text: '' };

  const urlOf = id => db.getAssetURL(id);
  const allLevelIds = (fn) => { const out = []; for (const k of Object.keys(LEVEL_SPEC)) out.push(...fn(draft.config.levels[k], k)); return out; };

  function usedIn(b) {
    const u = new Set();
    for (const k of Object.keys(LEVEL_SPEC)) {
      const lv = draft.config.levels[k]; const n = LEVEL_SPEC[k].name.replace(' 모드', '');
      if (lv.puzzleBookIds.includes(b.id)) u.add(`${n}·퍼즐`);
      if (lv.memoryRounds.some(r => r.includes(b.id))) u.add(`${n}·메모리`);
    }
    if (draft.diffsets.some(d => d.bookId === b.id && !d.isDemo)) u.add('틀린그림');
    if (draft.hiddensets.some(h => h.bookId === b.id && !h.isDemo)) u.add('숨은그림');
    return [...u].join(', ');
  }

  async function draw() {
    const errs = validateConfig(draft.config, draft.books, draft.diffsets, assets, draft.hiddensets);
    const hardErrs = draft.config.mode === 'demo' ? [] : validateLevel('hard', draft.config, draft.books, draft.diffsets, assets, draft.hiddensets);
    const realBooks = draft.books.filter(b => !b.isDemo);
    const bookOpts = (sel) => `<option value="">— 선택 —</option>` + realBooks.map(b => `<option value="${b.id}" ${sel === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('');
    const hidOpts = (sel) => `<option value="">— 선택 —</option>` + draft.hiddensets.filter(h => !h.isDemo).map(h => { const b = draft.books.find(x => x.id === h.bookId); const ok = hiddensetStatus(h, draft.books).length === 0; return `<option value="${h.id}" ${sel === h.id ? 'selected' : ''}>${esc(b ? b.title : '(도서 없음)')} (${(h.items || []).length}개) ${ok ? '✔' : '— 준비 필요'}</option>`; }).join('');
    const diffOpts = (sel) => `<option value="">— 선택 —</option>` + draft.diffsets.filter(d => !d.isDemo).map(d => { const b = draft.books.find(x => x.id === d.bookId); const ok = diffsetStatus(d, draft.books, assets).length === 0; return `<option value="${d.id}" ${sel === d.id ? 'selected' : ''}>${esc(b ? b.title : '(도서 없음)')} ${ok ? '✔' : '— 준비 필요'}</option>`; }).join('');

    const bookRows = await Promise.all(realBooks.map(async b => `
      <tr data-book="${b.id}">
        <td><img src="${await urlOf(b.originalAssetId)}" alt=""></td>
        <td><input type="text" data-f="title" value="${esc(b.title)}" aria-label="제목"></td>
        <td><input type="text" data-f="author" value="${esc(b.author)}" placeholder="저자 확인 필요" aria-label="저자">
            <label style="font-weight:400;font-size:14px"><input type="checkbox" data-f="authorConfirmed" ${b.authorConfirmed ? 'checked' : ''}> 도서 정보 확인함</label></td>
        <td>${assets.get(b.originalAssetId) ? `${assets.get(b.originalAssetId).width}×${assets.get(b.originalAssetId).height}` : '<span class="msg-err">이미지 없음</span>'}</td>
        <td style="font-size:14px">${usedIn(b) || '-'}</td>
        <td><button class="btn small danger" data-del="${b.id}">삭제</button></td>
      </tr>`));

    const levelSection = key => {
      const spec = LEVEL_SPEC[key]; const lv = draft.config.levels[key];
      return `<div class="card">
        <h3>${spec.name} 도서 선택 <span class="sub" style="font-weight:400">(${spec.desc})</span></h3>
        <div class="row">
          ${lv.puzzleBookIds.map((id, i) => `<div><label>퍼즐 ${spec.puzzles > 1 ? i + 1 : ''}</label><select data-lv="${key}" data-kind="puzzle" data-i="${i}">${bookOpts(id)}</select></div>`).join('')}
        </div>
        <div class="row">
          ${lv.differenceSetIds.map((id, i) => `<div><label>틀린그림 세트 ${spec.diffs > 1 ? i + 1 : ''}</label><select data-lv="${key}" data-kind="diff" data-i="${i}">${diffOpts(id)}</select></div>`).join('')}
        </div>
        <div class="row">
          ${(lv.hiddenSetIds || []).map((id, i) => `<div><label>숨은그림 세트 ${spec.hidden > 1 ? i + 1 : ''}</label><select data-lv="${key}" data-kind="hidden" data-i="${i}">${hidOpts(id)}</select></div>`).join('')}
        </div>
        ${lv.memoryRounds.map((round, r) => `<div class="row">
          ${round.map((id, i) => `<div><label>메모리${spec.memory.length > 1 ? ` ${r + 1}판` : ''} · ${i + 1}</label><select data-lv="${key}" data-kind="memory" data-r="${r}" data-i="${i}">${bookOpts(id)}</select></div>`).join('')}
        </div>`).join('')}
        <div class="btn-row" style="justify-content:flex-start"><button class="btn small" data-preview="${key}">${spec.name} 전체 미리보기</button></div>
      </div>`;
    };

    const hs = draft.hiddensets.find(h => h.id === editingHiddenId);
    const hsErrs = hs ? hiddensetStatus(hs, draft.books) : [];
    const hsURL = hs && hs.originalAssetId ? await urlOf(hs.originalAssetId) : null;
    const ds = draft.diffsets.find(d => d.id === editingDiffId);
    const dsBook = ds && draft.books.find(b => b.id === ds.bookId);
    const dsErrs = ds ? diffsetStatus(ds, draft.books, assets) : [];
    const origURL = ds ? await urlOf(ds.originalAssetId) : null;
    const modURL = ds && ds.modifiedAssetId ? await urlOf(ds.modifiedAssetId) : null;
    const regionDivs = r => (ds ? ds.regions : []).map((g, i) => `
      <div class="region ${activeRegion === g.id ? 'active' : ''}" data-region="${g.id}" style="left:${g.x * 100}%;top:${g.y * 100}%;width:${g.width * 100}%;height:${g.height * 100}%">
        <span class="num">${i + 1}</span>${r ? '<span class="handle" data-handle></span>' : ''}</div>`).join('');

    root.innerHTML = `
    <section class="screen admin">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h2>교사용 설정</h2>
        <div class="btn-row" style="margin:0">
          <button class="btn small ghost" id="ad-exit">처음으로 돌아가기</button>
        </div>
      </div>
      <p class="sub">이 기기의 브라우저에 저장됩니다. 다른 기기에서는 다시 등록해야 하며, 원본 자료는 따로 보관하세요.</p>

      <div class="card">
        <h3>운영 자료 상태</h3>
        <div class="row">
          <div><label>운영 방식</label>
            <select id="ad-mode"><option value="real" ${draft.config.mode === 'real' ? 'selected' : ''}>실제 표지로 운영</option><option value="demo" ${draft.config.mode === 'demo' ? 'selected' : ''}>연습 모드 (자체 제작 도형 표지, 쉬운 모드만)</option></select></div>
          <div><label>소리 기본값</label>
            <select id="ad-sound"><option value="0" ${!draft.config.soundEnabled ? 'selected' : ''}>꺼짐</option><option value="1" ${draft.config.soundEnabled ? 'selected' : ''}>켜짐</option></select></div>
        </div>
        ${errs.length ? `<ul class="check-list">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : `<ul class="check-list"><li class="ok">쉬운 모드 운영 자료가 모두 준비되었습니다.</li></ul>`}
        ${draft.config.mode === 'demo' ? '' : (hardErrs.length ? `<ul class="check-list">${hardErrs.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p class="sub">어려운 모드가 준비되지 않으면 시작 화면에서 어려운 모드 버튼이 비활성화됩니다.</p>` : `<ul class="check-list"><li class="ok">어려운 모드 운영 자료가 모두 준비되었습니다.</li></ul>`)}
        <div class="btn-row" style="justify-content:flex-start">
          <button class="btn primary" id="ad-save">검수 결과 저장</button>
          <button class="btn small ghost" id="ad-reimport">기본 제공 표지 다시 불러오기</button>
        </div>
        <div id="ad-status" class="${status.type}">${esc(status.text)}</div>
      </div>

      <div class="card">
        <h3>도서 등록 (실제 표지 ${realBooks.length}종)</h3>
        <div class="row">
          <div><label>표지 이미지 (JPG·PNG·WebP)</label><input type="file" id="ad-file" accept="image/jpeg,image/png,image/webp"></div>
          <div><label>제목</label><input type="text" id="ad-title" placeholder="책 제목"></div>
          <div><label>저자</label><input type="text" id="ad-author" placeholder="저자 (확인된 정보)"></div>
          <div style="flex:0"><button class="btn small" id="ad-add">등록</button></div>
        </div>
        <div id="ad-add-msg"></div>
        <table style="margin-top:10px"><thead><tr><th>표지</th><th>제목</th><th>저자</th><th>크기</th><th>사용</th><th></th></tr></thead>
        <tbody>${bookRows.join('') || '<tr><td colspan="6">등록된 실제 표지가 없습니다.</td></tr>'}</tbody></table>
      </div>

      <div class="card">
        <h3>교사용 점검 모드</h3>
        <p class="sub">원하는 화면을 바로 열어 확인합니다. 처음부터 다시 할 필요가 없습니다. 열린 화면 아래 빨간 점검 막대에서 이전·다음 화면 이동, 현재 판 건너뛰기, 점검 종료를 할 수 있습니다. (저장된 자료 기준으로 열리며, 누르면 현재 변경 내용을 먼저 저장합니다.)</p>
        ${(draft.config.mode === 'demo' ? ['easy'] : Object.keys(LEVEL_SPEC)).map(key => `
          <div style="margin-top:10px"><strong>${draft.config.mode === 'demo' ? '연습용' : LEVEL_SPEC[key].name}</strong></div>
          <div class="inspect-grid">
            ${ctx.inspectTargets(key, draft.config.mode === 'demo').map(t => `<button class="btn small ${t.kind ? '' : 'ghost'}" data-inspect="${key}" data-target="${t.id}">${t.label}</button>`).join('')}
          </div>`).join('')}
      </div>

      ${levelSection('easy')}
      ${levelSection('hard')}

      <div class="card">
        <h3>숨은그림 세트 편집 (4단계)</h3>
        <div class="row">
          <div><label>편집할 세트</label><select id="ad-hsedit"><option value="">— 선택 —</option>${draft.hiddensets.filter(h => !h.isDemo).map(h => { const b = draft.books.find(x => x.id === h.bookId); return `<option value="${h.id}" ${editingHiddenId === h.id ? 'selected' : ''}>${esc(b ? b.title : '(도서 없음)')} (${(h.items || []).length}개)</option>`; }).join('')}</select></div>
          <div style="flex:0"><button class="btn small" id="ad-hsnew">새 세트 만들기</button></div>
          ${hs ? `<div style="flex:0"><button class="btn small danger" id="ad-hsdel">이 세트 삭제</button></div>` : ''}
        </div>
        ${hs ? `
        <div class="row">
          <div><label>표지 도서</label><select id="ad-hsbook">${bookOpts(hs.bookId)}</select></div>
          <div><label><input type="checkbox" id="ad-hsrev" ${hs.reviewed ? 'checked' : ''}> 교사 검수 완료 (직접 눌러본 뒤 표시)</label></div>
        </div>
        ${hsErrs.length ? `<ul class="check-list">${hsErrs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<ul class="check-list"><li class="ok">이 세트는 운영에 사용할 수 있습니다.</li></ul>'}
        <div class="btn-row" style="justify-content:flex-start">
          <button class="btn small" id="ad-hsadd" ${hs.items.length >= 10 ? 'disabled' : ''}>찾을 물건 추가 (${hs.items.length}/10)</button>
          <button class="btn small danger" id="ad-hsdelitem" ${activeItem ? '' : 'disabled'}>선택한 물건 삭제</button>
          <button class="btn small ${hidTestMode ? 'primary' : 'ghost'}" id="ad-hstest">${hidTestMode ? '눌러보기 중 (편집으로 돌아가기)' : '미리보기: 직접 눌러보기'}</button>
        </div>
        <p class="sub">물건 상자를 끌어서 옮기고 오른쪽 아래 동그라미로 크기를 바꿉니다. 아래 목록에서 물건 이름을 적으세요. 물건은 3~10개.</p>
        <div class="editor-pair">
          <div class="region-editor" id="ad-hsimg">${hsURL ? `<img src="${hsURL}" alt="표지" draggable="false">` : '<div style="padding:40px;line-height:1.4">도서를 선택하세요</div>'}${hsURL ? hs.items.map((it, i) => `<div class="region ${activeItem === it.id ? 'active' : ''}" data-item="${it.id}" style="left:${it.x * 100}%;top:${it.y * 100}%;width:${it.width * 100}%;height:${it.height * 100}%"><span class="num">${i + 1} ${esc(it.name || '')}</span>${hidTestMode ? '' : '<span class="handle" data-handle></span>'}</div>`).join('') : ''}</div>
          <div style="flex:1;min-width:220px">
            <table><thead><tr><th>#</th><th>물건 이름</th><th></th></tr></thead><tbody>
              ${hs.items.map((it, i) => `<tr class="${activeItem === it.id ? 'row-active' : ''}"><td>${i + 1}</td><td><input type="text" data-hsname="${it.id}" value="${esc(it.name || '')}" placeholder="예: 시계" aria-label="물건 ${i + 1} 이름"></td><td><button class="btn small ghost" data-hssel="${it.id}">선택</button></td></tr>`).join('') || '<tr><td colspan="3">물건을 추가하세요.</td></tr>'}
            </tbody></table>
          </div>
        </div>
        <div id="ad-hstestmsg" class="feedback"></div>` : '<p class="sub">세트를 선택하거나 새로 만드세요.</p>'}
      </div>

      <div class="card">
        <h3>틀린그림 세트 편집</h3>
        <div class="row">
          <div><label>편집할 세트</label><select id="ad-dsedit"><option value="">— 선택 —</option>${draft.diffsets.filter(d => !d.isDemo).map(d => { const b = draft.books.find(x => x.id === d.bookId); return `<option value="${d.id}" ${editingDiffId === d.id ? 'selected' : ''}>${esc(b ? b.title : '(도서 없음)')}</option>`; }).join('')}</select></div>
          <div style="flex:0"><button class="btn small" id="ad-dsnew">새 세트 만들기</button></div>
          ${ds ? `<div style="flex:0"><button class="btn small danger" id="ad-dsdel">이 세트 삭제</button></div>` : ''}
        </div>
        ${ds ? `
        <div class="row">
          <div><label>원본 도서</label><select id="ad-dsbook">${bookOpts(ds.bookId)}</select></div>
          <div><label>수정본 이미지 (차이 3곳, 원본과 같은 비율)</label><input type="file" id="ad-dsmod" accept="image/jpeg,image/png,image/webp"></div>
          <div><label><input type="checkbox" id="ad-dsrev" ${ds.reviewed ? 'checked' : ''}> 교사 검수 완료 (직접 눌러본 뒤 표시)</label></div>
        </div>
        ${dsErrs.length ? `<ul class="check-list">${dsErrs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<ul class="check-list"><li class="ok">이 세트는 운영에 사용할 수 있습니다.</li></ul>'}
        <div class="btn-row" style="justify-content:flex-start">
          <button class="btn small" id="ad-addregion" ${ds.regions.length >= 3 ? 'disabled' : ''}>정답 영역 추가 (${ds.regions.length}/3)</button>
          <button class="btn small danger" id="ad-delregion" ${activeRegion ? '' : 'disabled'}>선택한 영역 삭제</button>
          <button class="btn small ${testMode ? 'primary' : 'ghost'}" id="ad-test">${testMode ? '눌러보기 중 (편집으로 돌아가기)' : '미리보기: 직접 눌러보기'}</button>
        </div>
        <p class="sub">영역을 끌어서 옮기고, 오른쪽 아래 동그라미를 끌어 크기를 바꿉니다. 손가락으로 누르기 편하게 넉넉히 잡으세요.</p>
        <div class="editor-pair">
          <div><div class="sub">원본 ${dsBook ? esc(dsBook.title) : ''}</div>
            <div class="region-editor" id="ad-orig">${origURL ? `<img src="${origURL}" alt="원본" draggable="false">` : '<div style="padding:40px;line-height:1.4">원본 없음</div>'}${regionDivs(false)}</div></div>
          <div><div class="sub">수정본 ${modURL ? '' : '<span class="msg-err">— 수정본 준비 필요</span>'}</div>
            <div class="region-editor" id="ad-mod">${modURL ? `<img src="${modURL}" alt="수정본" draggable="false">` : '<div style="padding:40px;width:300px;height:400px;line-height:1.4;color:#a66a00">수정본 이미지를 등록하세요.<br>원본 두 장으로는 출제하지 않습니다.</div>'}${modURL ? regionDivs(!testMode) : ''}</div></div>
        </div>
        <div id="ad-testmsg" class="feedback"></div>` : '<p class="sub">세트를 선택하거나 새로 만드세요.</p>'}
      </div>
    </section>`;

    bind(ds);
    bindHidden(hs);
  }

  function setStatus(type, text) { status = { type, text }; const el = root.querySelector('#ad-status'); if (el) { el.className = type; el.textContent = text; } }

  function bindHidden(hs) {
    const q = s => root.querySelector(s);
    q('#ad-hsedit')?.addEventListener('change', e => { editingHiddenId = e.target.value || null; activeItem = null; hidTestMode = false; draw(); });
    q('#ad-hsnew')?.addEventListener('click', () => {
      const h = { id: db.uid('hid'), bookId: null, originalAssetId: null, items: [], reviewed: false, isDemo: false };
      draft.hiddensets.push(h); editingHiddenId = h.id; activeItem = null; hidTestMode = false; draw();
    });
    if (!hs) return;
    q('#ad-hsdel')?.addEventListener('click', async () => {
      if (!(await ctx.confirm('이 숨은그림 세트를 삭제할까요?'))) return;
      draft.hiddensets = draft.hiddensets.filter(h => h.id !== hs.id);
      for (const k of Object.keys(LEVEL_SPEC)) draft.config.levels[k].hiddenSetIds = (draft.config.levels[k].hiddenSetIds || []).map(id => id === hs.id ? null : id);
      editingHiddenId = null; draw();
    });
    q('#ad-hsbook').addEventListener('change', e => {
      const b = draft.books.find(x => x.id === e.target.value);
      hs.bookId = b ? b.id : null; hs.originalAssetId = b ? b.originalAssetId : null; hs.reviewed = false; draw();
    });
    q('#ad-hsrev').addEventListener('change', e => { hs.reviewed = e.target.checked; draw(); });
    q('#ad-hsadd').addEventListener('click', () => {
      if (hs.items.length >= 10) return;
      const n = hs.items.length;
      const it = { id: db.uid('it'), name: '', x: Math.min(0.1 + (n % 5) * 0.16, 0.8), y: Math.min(0.1 + Math.floor(n / 5) * 0.3, 0.8), width: 0.14, height: 0.1 };
      hs.items.push(it); hs.reviewed = false; activeItem = it.id; draw();
    });
    q('#ad-hsdelitem').addEventListener('click', () => { hs.items = hs.items.filter(it => it.id !== activeItem); hs.reviewed = false; activeItem = null; draw(); });
    q('#ad-hstest').addEventListener('click', () => { hidTestMode = !hidTestMode; activeItem = null; draw(); });
    root.querySelectorAll('[data-hsname]').forEach(inp => inp.addEventListener('change', () => { const it = hs.items.find(x => x.id === inp.dataset.hsname); if (it) { it.name = inp.value.trim(); hs.reviewed = false; const num = root.querySelector(`#ad-hsimg .region[data-item="${it.id}"] .num`); if (num) num.textContent = `${hs.items.indexOf(it) + 1} ${it.name}`; } }));
    root.querySelectorAll('[data-hssel]').forEach(btn => btn.addEventListener('click', () => { activeItem = btn.dataset.hssel; draw(); }));
    const ed = q('#ad-hsimg'); const img = ed.querySelector('img'); if (!img) return;
    if (hidTestMode) {
      ed.addEventListener('click', e => {
        const rect = img.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / rect.width, ry = (e.clientY - rect.top) / rect.height; const pad = 0.015;
        const hit = hs.items.findIndex(it => rx >= it.x - pad && rx <= it.x + it.width + pad && ry >= it.y - pad && ry <= it.y + it.height + pad);
        q('#ad-hstestmsg').textContent = hit >= 0 ? `물건 ${hit + 1} (${hs.items[hit].name || '이름 없음'}) 판정 ✔` : '물건 아님';
      });
      return;
    }
    let drag = null;
    ed.addEventListener('pointerdown', e => {
      const rg = e.target.closest('.region'); if (!rg) return;
      const it = hs.items.find(x => x.id === rg.dataset.item); if (!it) return;
      activeItem = it.id;
      ed.querySelectorAll('.region').forEach(el => el.classList.toggle('active', el === rg));
      q('#ad-hsdelitem').disabled = false;
      const rect = img.getBoundingClientRect();
      drag = { it, mode: e.target.hasAttribute('data-handle') ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.width, oh: it.height, rect, el: rg, pid: e.pointerId };
      try { ed.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    ed.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = (e.clientX - drag.sx) / drag.rect.width, dy = (e.clientY - drag.sy) / drag.rect.height; const it = drag.it;
      if (drag.mode === 'move') { it.x = Math.min(Math.max(0, drag.ox + dx), 1 - it.width); it.y = Math.min(Math.max(0, drag.oy + dy), 1 - it.height); }
      else { it.width = Math.min(Math.max(0.03, drag.ow + dx), 1 - it.x); it.height = Math.min(Math.max(0.03, drag.oh + dy), 1 - it.y); }
      [it.x, it.y, it.width, it.height] = [it.x, it.y, it.width, it.height].map(v => Math.round(v * 1000) / 1000);
      drag.el.style.left = `${it.x * 100}%`; drag.el.style.top = `${it.y * 100}%`; drag.el.style.width = `${it.width * 100}%`; drag.el.style.height = `${it.height * 100}%`;
    });
    const end = e => { if (drag && e.pointerId === drag.pid) { drag = null; hs.reviewed = false; const c = q('#ad-hsrev'); if (c) c.checked = false; } };
    ed.addEventListener('pointerup', end); ed.addEventListener('pointercancel', end);
  }

  function bind(ds) {
    const q = s => root.querySelector(s);
    q('#ad-exit').addEventListener('click', ctx.onExit);
    root.querySelectorAll('[data-preview]').forEach(btn => btn.addEventListener('click', async () => {
      const level = btn.dataset.preview;
      const errs = draft.config.mode === 'demo' ? (level === 'easy' ? [] : ['연습 모드에서는 쉬운 모드만 미리볼 수 있습니다.']) : validateLevel(level, draft.config, draft.books, draft.diffsets, assets, draft.hiddensets);
      if (errs.length) { setStatus('msg-err', '미리보기 전에 자료를 완성하고 저장하세요: ' + errs[0]); window.scrollTo(0, 0); return; }
      if (!(await save())) return;
      ctx.onPreviewPlay(level);
    }));
    root.querySelectorAll('[data-inspect]').forEach(btn => btn.addEventListener('click', async () => {
      const level = btn.dataset.inspect;
      const errs = draft.config.mode === 'demo' ? [] : validateLevel(level, draft.config, draft.books, draft.diffsets, assets, draft.hiddensets);
      if (errs.length) { setStatus('msg-err', '점검 전에 자료를 완성하고 저장하세요: ' + errs[0]); window.scrollTo(0, 0); return; }
      if (!(await save())) return;
      ctx.onInspect(level, btn.dataset.target);
    }));
    q('#ad-mode').addEventListener('change', e => { draft.config.mode = e.target.value; draw(); });
    q('#ad-sound').addEventListener('change', e => { draft.config.soundEnabled = e.target.value === '1'; });
    q('#ad-save').addEventListener('click', () => save());
    q('#ad-reimport').addEventListener('click', async () => {
      setStatus('', '기본 제공 표지를 불러오는 중…');
      try { const n = await ctx.reimportBundle(draft); setStatus('msg-ok', `기본 제공 표지 ${n}종을 불러왔습니다. 저장을 눌러 확정하세요.`); } catch (e) { setStatus('msg-err', '불러오기 실패: ' + e.message); }
      draw();
    });

    // 도서 편집
    root.querySelectorAll('tr[data-book]').forEach(tr => {
      const b = draft.books.find(x => x.id === tr.dataset.book);
      tr.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', () => {
        if (inp.type === 'checkbox') b[inp.dataset.f] = inp.checked; else b[inp.dataset.f] = inp.value.trim();
      }));
    });
    root.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      const b = draft.books.find(x => x.id === btn.dataset.del);
      const uses = usedIn(b);
      const ok = await ctx.confirm(`'${b.title}'을(를) 삭제할까요?${uses ? `\n이 도서는 ${uses}에 사용 중입니다. 삭제하면 해당 단계를 다시 설정해야 합니다.` : ''}`);
      if (!ok) return;
      draft.books = draft.books.filter(x => x.id !== b.id);
      for (const k of Object.keys(LEVEL_SPEC)) {
        const lv = draft.config.levels[k];
        lv.puzzleBookIds = lv.puzzleBookIds.map(id => id === b.id ? null : id);
        lv.memoryRounds = lv.memoryRounds.map(r => r.map(id => id === b.id ? null : id));
      }
      const removedHidden = draft.hiddensets.filter(h => h.bookId === b.id).map(h => h.id);
      draft.hiddensets = draft.hiddensets.filter(h => h.bookId !== b.id);
      for (const k of Object.keys(LEVEL_SPEC)) draft.config.levels[k].hiddenSetIds = (draft.config.levels[k].hiddenSetIds || []).map(id => removedHidden.includes(id) ? null : id);
      if (!draft.hiddensets.some(h => h.id === editingHiddenId)) editingHiddenId = null;
      const removedSets = draft.diffsets.filter(d => d.bookId === b.id).map(d => d.id);
      draft.diffsets = draft.diffsets.filter(d => d.bookId !== b.id);
      for (const k of Object.keys(LEVEL_SPEC)) draft.config.levels[k].differenceSetIds = draft.config.levels[k].differenceSetIds.map(id => removedSets.includes(id) ? null : id);
      if (!draft.diffsets.some(d => d.id === editingDiffId)) editingDiffId = null;
      draw();
    }));
    q('#ad-add').addEventListener('click', async () => {
      const msg = q('#ad-add-msg');
      const file = q('#ad-file').files[0];
      const title = q('#ad-title').value.trim(), author = q('#ad-author').value.trim();
      if (!file) { msg.innerHTML = '<span class="msg-err">표지 이미지를 선택하세요.</span>'; return; }
      if (!title) { msg.innerHTML = '<span class="msg-err">제목을 입력하세요.</span>'; return; }
      msg.textContent = '이미지 확인 중…';
      try {
        const asset = await db.importImageFile(file);
        assets.set(asset.id, { width: asset.width, height: asset.height });
        draft.books.push({ id: db.uid('bk'), title, author, authorConfirmed: !!author, originalAssetId: asset.id, isDemo: false });
        msg.innerHTML = `<span class="msg-ok">등록됨 (${asset.width}×${asset.height}). 저장을 눌러 확정하세요.</span>`;
        draw();
      } catch (e) { msg.innerHTML = `<span class="msg-err">등록 실패: ${esc(e.message)}</span>`; }
    });

    // 난이도별 선택
    root.querySelectorAll('select[data-lv]').forEach(sel => sel.addEventListener('change', () => {
      const lv = draft.config.levels[sel.dataset.lv]; const v = sel.value || null; const i = Number(sel.dataset.i);
      if (sel.dataset.kind === 'puzzle') lv.puzzleBookIds[i] = v;
      else if (sel.dataset.kind === 'diff') lv.differenceSetIds[i] = v;
      else if (sel.dataset.kind === 'hidden') lv.hiddenSetIds[i] = v;
      else lv.memoryRounds[Number(sel.dataset.r)][i] = v;
      draw();
    }));

    // 틀린그림 세트
    q('#ad-dsedit').addEventListener('change', e => { editingDiffId = e.target.value || null; activeRegion = null; testMode = false; draw(); });
    q('#ad-dsnew').addEventListener('click', () => {
      const d = { id: db.uid('diff'), bookId: null, originalAssetId: null, modifiedAssetId: null, regions: [], reviewed: false, isDemo: false };
      draft.diffsets.push(d); editingDiffId = d.id; activeRegion = null; testMode = false; draw();
    });
    if (!ds) return;
    q('#ad-dsdel')?.addEventListener('click', async () => {
      if (!(await ctx.confirm('이 틀린그림 세트를 삭제할까요?'))) return;
      draft.diffsets = draft.diffsets.filter(d => d.id !== ds.id);
      for (const k of Object.keys(LEVEL_SPEC)) draft.config.levels[k].differenceSetIds = draft.config.levels[k].differenceSetIds.map(id => id === ds.id ? null : id);
      editingDiffId = null; draw();
    });
    q('#ad-dsbook').addEventListener('change', e => {
      const b = draft.books.find(x => x.id === e.target.value);
      ds.bookId = b ? b.id : null; ds.originalAssetId = b ? b.originalAssetId : null;
      ds.reviewed = false; // 원본 교체 시 검수 해제
      draw();
    });
    q('#ad-dsmod').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const asset = await db.importImageFile(file);
        assets.set(asset.id, { width: asset.width, height: asset.height });
        ds.modifiedAssetId = asset.id; ds.reviewed = false; // 수정본 교체 시 검수 해제
        setStatus('msg-ok', `수정본 등록됨 (${asset.width}×${asset.height}). 영역을 확인한 뒤 검수 완료에 표시하세요.`);
      } catch (err) { setStatus('msg-err', '수정본 등록 실패: ' + err.message); }
      draw();
    });
    q('#ad-dsrev').addEventListener('change', e => { ds.reviewed = e.target.checked; draw(); });
    q('#ad-addregion').addEventListener('click', () => {
      if (ds.regions.length >= 3) return;
      const n = ds.regions.length;
      const r = { id: db.uid('rg'), x: 0.3 + n * 0.1, y: 0.3 + n * 0.1, width: 0.2, height: 0.15 };
      ds.regions.push(r); ds.reviewed = false; activeRegion = r.id; draw();
    });
    q('#ad-delregion').addEventListener('click', () => {
      ds.regions = ds.regions.filter(r => r.id !== activeRegion); ds.reviewed = false; activeRegion = null; draw();
    });
    q('#ad-test').addEventListener('click', () => { testMode = !testMode; activeRegion = null; draw(); });

    // 영역 편집기 (수정본 위)
    const ed = q('#ad-mod');
    const img = ed.querySelector('img');
    if (!img) return;
    if (testMode) {
      const handler = e => {
        const target = e.currentTarget.querySelector('img'); if (!target) return;
        const rect = target.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / rect.width, ry = (e.clientY - rect.top) / rect.height;
        const pad = 0.015;
        const hit = ds.regions.findIndex(r => rx >= r.x - pad && rx <= r.x + r.width + pad && ry >= r.y - pad && ry <= r.y + r.height + pad);
        q('#ad-testmsg').textContent = hit >= 0 ? `정답 영역 ${hit + 1} 판정 ✔` : '정답 아님 (여백·그림 밖)';
      };
      ed.addEventListener('click', handler); q('#ad-orig').addEventListener('click', handler);
      return;
    }
    let drag = null;
    ed.addEventListener('pointerdown', e => {
      const rg = e.target.closest('.region'); if (!rg) return;
      const r = ds.regions.find(x => x.id === rg.dataset.region); if (!r) return;
      activeRegion = r.id;
      ed.querySelectorAll('.region').forEach(el => el.classList.toggle('active', el === rg));
      q('#ad-delregion').disabled = false;
      const rect = img.getBoundingClientRect();
      drag = { r, mode: e.target.hasAttribute('data-handle') ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, ow: r.width, oh: r.height, rect, el: rg, pid: e.pointerId };
      try { ed.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    ed.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = (e.clientX - drag.sx) / drag.rect.width, dy = (e.clientY - drag.sy) / drag.rect.height;
      const r = drag.r;
      if (drag.mode === 'move') {
        r.x = Math.min(Math.max(0, drag.ox + dx), 1 - r.width); r.y = Math.min(Math.max(0, drag.oy + dy), 1 - r.height);
      } else {
        r.width = Math.min(Math.max(0.04, drag.ow + dx), 1 - r.x); r.height = Math.min(Math.max(0.04, drag.oh + dy), 1 - r.y);
      }
      [r.x, r.y, r.width, r.height] = [r.x, r.y, r.width, r.height].map(v => Math.round(v * 1000) / 1000);
      for (const box of [drag.el, q('#ad-orig').querySelector(`[data-region="${r.id}"]`)]) {
        if (!box) continue;
        box.style.left = `${r.x * 100}%`; box.style.top = `${r.y * 100}%`; box.style.width = `${r.width * 100}%`; box.style.height = `${r.height * 100}%`;
      }
    });
    const end = e => { if (drag && e.pointerId === drag.pid) { drag = null; ds.reviewed = false; const c = q('#ad-dsrev'); if (c) c.checked = false; } };
    ed.addEventListener('pointerup', end); ed.addEventListener('pointercancel', end);
  }

  async function save() {
    const errs = validateConfig(draft.config, draft.books, draft.diffsets, assets, draft.hiddensets);
    try {
      const existingBooks = await db.getAll('books');
      for (const b of existingBooks) if (!b.isDemo && !draft.books.some(x => x.id === b.id)) await db.del('books', b.id);
      await db.putMany('books', draft.books.filter(b => !b.isDemo));
      const existingDs = await db.getAll('diffsets');
      for (const d of existingDs) if (!d.isDemo && !draft.diffsets.some(x => x.id === d.id)) await db.del('diffsets', d.id);
      await db.putMany('diffsets', draft.diffsets.filter(d => !d.isDemo));
      const existingHs = await db.getAll('hiddensets');
      for (const h of existingHs) if (!h.isDemo && !draft.hiddensets.some(x => x.id === h.id)) await db.del('hiddensets', h.id);
      await db.putMany('hiddensets', draft.hiddensets.filter(h => !h.isDemo));
      await db.put('config', { ...draft.config, id: 'main' });
      await db.cleanupOrphanAssets([...draft.books, ...existingBooks.filter(b => b.isDemo)], [...draft.diffsets, ...existingDs.filter(d => d.isDemo)], [...draft.hiddensets, ...existingHs.filter(h => h.isDemo)]);
      if (errs.length) setStatus('msg-warn', `저장했지만 운영 시작 조건이 아직 충족되지 않았습니다 (${errs.length}개 항목).`);
      else setStatus('msg-ok', '저장 완료. 쉬운 모드 운영 자료가 모두 준비되었습니다.');
      await ctx.onSaved();
      return true;
    } catch (e) {
      setStatus('msg-err', '저장 실패: ' + e.message + ' (기존 자료는 유지됩니다)');
      return false;
    }
  }

  await draw();
}

// 연습용 자료: 실제 표지가 없을 때 쓰는 자체 제작 단순 도형 표지.
// 학생 화면에는 '연습용'이 표시된다. 실제 운영 자료와 섞어 쓰지 않는다.
import { saveBlobAsset, get, put } from './db.js';

export const DEMO_BOOK_IDS = ['demo-book-1', 'demo-book-2', 'demo-book-3', 'demo-book-4'];
export const DEMO_DIFF_ID = 'demo-diff-1';

const W = 600, H = 800;

function canvasToBlob(c) {
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

function base(ctx, bg, title) {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(40, 40, W - 80, 90);
  ctx.fillStyle = '#3b2a1a'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 100);
  ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#6b4423';
  ctx.fillText('연습용 표지 · 실제 책 아님', W / 2, H - 40);
}

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

// 표지 1: 집·해·사과 (틀린그림 원본)
function drawCover1(ctx, modified) {
  base(ctx, '#bfe3ff', '연습용 표지 ①');
  // 해 (차이 1: 수정본에는 없음)
  if (!modified) { ctx.fillStyle = '#f6c543'; ctx.beginPath(); ctx.arc(470, 200, 48, 0, Math.PI * 2); ctx.fill(); }
  // 집
  ctx.fillStyle = '#f0d9a8'; ctx.fillRect(150, 400, 300, 220);
  // 지붕 (차이 3: 수정본은 줄무늬)
  ctx.fillStyle = '#d9534f'; ctx.beginPath(); ctx.moveTo(120, 400); ctx.lineTo(300, 260); ctx.lineTo(480, 400); ctx.closePath(); ctx.fill();
  if (modified) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(120, 400); ctx.lineTo(300, 260); ctx.lineTo(480, 400); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#fff'; for (let x = 100; x < 500; x += 40) ctx.fillRect(x, 250, 16, 160);
    ctx.restore();
  }
  ctx.fillStyle = '#6b4423'; ctx.fillRect(270, 500, 60, 120);
  ctx.fillStyle = '#9fd3ff'; ctx.fillRect(180, 440, 60, 50); ctx.fillRect(360, 440, 60, 50);
  // 사과 셋 (차이 2: 가운데가 배로 바뀜)
  const apples = [[180, 690], [300, 690], [420, 690]];
  apples.forEach(([x, y], i) => {
    if (modified && i === 1) {
      ctx.fillStyle = '#9ccc3c'; ctx.beginPath(); ctx.ellipse(x, y + 8, 28, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 22, 18, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#e03b3b'; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2e9e5b'; ctx.fillRect(x - 3, y - 48, 6, 18);
  });
}

function drawCover2(ctx) {
  base(ctx, '#1f2a5c', '연습용 표지 ②');
  for (let i = 0; i < 20; i++) star(ctx, 60 + (i * 97) % 480, 160 + (i * 61) % 560, 8 + (i % 3) * 4, '#fff');
  ctx.fillStyle = '#d9d9d9'; ctx.fillRect(260, 300, 80, 240);
  ctx.fillStyle = '#d9534f'; ctx.beginPath(); ctx.moveTo(260, 300); ctx.lineTo(300, 220); ctx.lineTo(340, 300); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(260, 540); ctx.lineTo(220, 600); ctx.lineTo(260, 580); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(340, 540); ctx.lineTo(380, 600); ctx.lineTo(340, 580); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fd3ff'; ctx.beginPath(); ctx.arc(300, 380, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6c543'; ctx.beginPath(); ctx.moveTo(275, 600); ctx.lineTo(300, 680); ctx.lineTo(325, 600); ctx.closePath(); ctx.fill();
}

function drawCover3(ctx) {
  base(ctx, '#d6f5e3', '연습용 표지 ③');
  ctx.fillStyle = '#2e9e5b'; ctx.beginPath(); ctx.arc(300, 380, 150, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4423'; ctx.fillRect(270, 500, 60, 180);
  ctx.fillStyle = '#e03b3b'; [[230, 330], [340, 300], [300, 430], [380, 400]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); });
}

function drawCover4(ctx) {
  base(ctx, '#ffe0e8', '연습용 표지 ④');
  ctx.fillStyle = '#2f6fde'; ctx.beginPath(); ctx.ellipse(300, 450, 200, 110, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(480, 420); ctx.lineTo(560, 360); ctx.lineTo(540, 460); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(200, 420, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fd3ff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(300, 300 - i * 40, 10 + i * 5, 0, Math.PI * 2); ctx.fill(); }
}

/** 연습용 도서 4권과 틀린그림 세트를 생성·저장한다 (이미 있으면 유지). */
export async function ensureDemoData() {
  const exists = await get('books', DEMO_BOOK_IDS[0]);
  const diff = await get('diffsets', DEMO_DIFF_ID);
  if (exists && diff) return;

  const drawers = [drawCover1, drawCover2, drawCover3, drawCover4];
  const books = [];
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    drawers[i](c.getContext('2d'), false);
    const asset = await saveBlobAsset(await canvasToBlob(c), `demo-asset-${i + 1}`);
    const book = { id: DEMO_BOOK_IDS[i], title: `연습용 표지 ${'①②③④'[i]}`, author: '자체 제작(연습용)', originalAssetId: asset.id, isDemo: true };
    await put('books', book); books.push(book);
  }
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
  drawCover1(mc.getContext('2d'), true);
  const modAsset = await saveBlobAsset(await canvasToBlob(mc), 'demo-asset-1-mod');
  await put('diffsets', {
    id: DEMO_DIFF_ID, bookId: DEMO_BOOK_IDS[0], originalAssetId: 'demo-asset-1', modifiedAssetId: modAsset.id, isDemo: true, reviewed: true,
    regions: [
      { id: 'r-sun', x: 410 / W, y: 140 / H, width: 120 / W, height: 120 / H },
      { id: 'r-pear', x: 250 / W, y: 630 / H, width: 100 / W, height: 110 / H },
      { id: 'r-roof', x: 120 / W, y: 255 / H, width: 360 / W, height: 150 / H },
    ],
  });
}

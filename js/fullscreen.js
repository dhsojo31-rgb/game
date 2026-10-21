// 전체화면: 시작 화면 버튼과 태블릿 터치에서 사용. 들어간 뒤에는 가로로 고정을 시도한다.
export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

let pending = null;
export function enterFullscreen() {
  if (isFullscreen()) return Promise.resolve();
  if (pending) return pending;
  const el = document.documentElement;
  const req = el.requestFullscreen
    ? el.requestFullscreen({ navigationUI: 'hide' })
    : el.webkitRequestFullscreen ? Promise.resolve(el.webkitRequestFullscreen()) : Promise.reject(new Error('지원하지 않는 브라우저'));
  pending = req.then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(e => { console.warn('전체화면 실패:', e?.message); })
    .finally(() => { pending = null; });
  return pending;
}

export function exitFullscreen() {
  if (!isFullscreen()) return Promise.resolve();
  return (document.exitFullscreen ? document.exitFullscreen() : Promise.resolve(document.webkitExitFullscreen?.())).catch(() => {});
}

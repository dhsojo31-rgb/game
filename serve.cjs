// 의존성 없는 정적 파일 서버. 실행: node serve.cjs [포트]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

function log(...a) { console.log(new Date().toLocaleTimeString('ko-KR'), ...a); }

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    const stream = fs.createReadStream(file);
    stream.on('error', e => { log('read error', file, e.message); try { res.destroy(); } catch {} });
    res.on('error', () => { stream.destroy(); });
    req.on('aborted', () => { stream.destroy(); });
    stream.pipe(res);
  });
});

server.on('error', e => { log('server error', e.message); if (e.code === 'EADDRINUSE') { console.log(`포트 ${PORT}가 이미 사용 중입니다. 다른 창에서 서버가 실행 중인지 확인하세요.`); process.exit(1); } });
process.on('exit', code => log('exit', code));
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) { try { process.on(sig, () => { log('signal', sig); process.exit(0); }); } catch {} }
process.on('uncaughtException', e => log('uncaught', e && e.stack || e));
process.on('unhandledRejection', e => log('unhandled', e && e.stack || e));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`책표지 탐정단 실행 중: http://localhost:${PORT}  (종료: Ctrl+C)`);
});

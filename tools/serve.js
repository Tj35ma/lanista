// Máy chủ tĩnh nhỏ cho việc phát triển: phục vụ thư mục game và nhận ảnh chụp canvas (POST /shot?name=x).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), port = +process.argv[2] || 8765, shots = process.argv[3] || path.join(root, 'tools', 'shots');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/shot') {
    const chunks = []; req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const b64 = Buffer.concat(chunks).toString('utf8').replace(/^data:image\/\w+;base64,/, '');
      fs.mkdirSync(shots, { recursive: true });
      const f = path.join(shots, (u.searchParams.get('name') || 'shot').replace(/[^\w.-]/g, '_'));
      fs.writeFileSync(f, Buffer.from(b64, 'base64')); res.end(f);
    });
    return;
  }
  let p = path.normalize(path.join(root, decodeURIComponent(u.pathname)));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
  });
}).listen(port, () => console.log('LANISTA dev server http://localhost:' + port));

// LANISTA — tạo kho đội hình mẫu (js/core/ghosts.js) từ các chiến dịch chơi thử của bot.
// node tools/ghostgen.js [số chiến dịch=6] [số đội giữ lại=160]
// Mỗi lần bot ra trận, đội hình của nó được chụp lại; sau đó lấy mẫu rải đều theo sức mạnh để trận phụ luôn có đối thủ vừa sức.
const fs = require('fs'), path = require('path');
const G = require('./load.js');
const N = +process.argv[2] || 6, KEEP = +process.argv[3] || 160;
const all = [];
G.GHOST_SEED = [];                                   // khi tạo kho, trận phụ của bot dùng NPC sinh sẵn
G.Ghosts.record = snap => { if (snap && snap.team.length) all.push(snap); };
process.argv = [process.argv[0], path.join(__dirname, 'bot.js'), '--quiet'];
const { runCampaign } = require('./bot.js');
for (let i = 0; i < N; i++) { const L = runCampaign(7001 + i * 131, { light: true }); console.error('ván ' + (i + 1) + '/' + N + ': ' + (L.won ? 'thắng' : 'dở') + ' sau ' + L.days + ' ngày, ' + all.length + ' lần ra trận'); }
(() => {

  // mỗi (ván, đấu trường, chặng) giữ đội cuối cùng; rồi rải đều theo sức mạnh
  const last = {}; all.forEach(s => { last[s.run + ':' + s.tier + ':' + s.stage] = s; });
  let L = Object.values(last).sort((a, b) => a.pw - b.pw);
  if (L.length > KEEP) { const step = L.length / KEEP, out = []; for (let i = 0; i < KEEP; i++) out.push(L[Math.floor(i * step)]); L = out; }
  L.forEach(s => s.team.forEach(o => { delete o.g.look; }));   // dáng vẻ được gieo lại từ tên, khỏi tốn chỗ
  const body = '// Kho đội hình mẫu cho trận phụ — tạo bằng tools/ghostgen.js, đừng sửa tay.\n(function (G) {\n  G.GHOST_SEED = ' + JSON.stringify(L) + ';\n})(typeof window !== \'undefined\' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));\n';
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'core', 'ghosts.js'), body);
  console.log('ghi ' + L.length + ' đội (từ ' + all.length + ' lần ra trận), sức mạnh ' + L[0].pw + ' … ' + L[L.length - 1].pw + ', ' + Math.round(body.length / 1024) + ' KB');
})();

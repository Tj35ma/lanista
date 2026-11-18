// LANISTA — so sánh các họ vũ khí, 3 đấu 3, cùng cấp và cùng ngân sách giáp, hai bên đối xứng.
//   "thuần": cả ba người cùng một họ vũ khí.
//   "kèm":   một người cầm vũ khí cần đo + hai đồng đội gladius cầm khiên đứng trước (cách dùng thật của giáo, đinh ba, lao).
// node tools/weapons.js [n=120] [--matrix]  → tỉ lệ thắng trung bình theo ba kiểu giáp; --matrix in cả ma trận.
const G = require('./load.js');
const args = process.argv.slice(2);
const N = +(args.find(a => !a.startsWith('--')) || 120);
const SHOW = args.includes('--matrix');
const KINDS = ['caestus', 'gladius', 'sica', 'mace', 'hasta', 'trident', 'twin', 'axe', 'javelin'];
const BODIES = ['big', 'bal', 'agi'];
const SETUPS = [
  { name: 'KHÔNG GIÁP (cấp 2, hạng 1)', lvl: 2, wt: 1, gear: [], shield: null, esc: 's_plank' },
  { name: 'GIÁP VỪA (cấp 5, hạng 2)', lvl: 5, wt: 2, gear: ['b_leather', 'h_cap', 'a_manica', 'l_wraps'], shield: 's_parma', esc: 's_parma' },
  { name: 'GIÁP NẶNG (cấp 9, hạng 3)', lvl: 9, wt: 3, gear: ['b_hamata', 'h_legion', 'a_scale', 'l_ocrea'], shield: 's_scutum', esc: 's_scutum', cap: 10 }
];
function colOf(kind) { const K = G.WKIND[kind]; return K.ai === 'ranged' ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0); }
function mk(name, body, S, kind, shield, col, row, side, i) {
  const K = G.WKIND[kind], gear = S.gear.slice(); if (shield && K.hands === 1) gear.push(shield);
  return { g: G.makeFoe(G.e(name, body, S.lvl, kind + S.wt, gear, col, row, S.cap ? { capAdd: S.cap } : null), i + side * 10, 3), c: col, r: row };
}
function teamMono(kind, S, side) { return BODIES.map((b, i) => mk(kind + i, b, S, kind, S.shield, colOf(kind), i + 1, side, i)); }
function teamEsc(kind, S, side) {
  return [mk('hộ vệ', 'big', S, 'gladius', S.esc, 0, 1, side, 0), mk('hộ vệ', 'bal', S, 'gladius', S.esc, 0, 3, side, 1), mk(kind, 'bal', S, kind, S.shield, colOf(kind), 2, side, 2)];
}
function wr(a, b, S, mkTeam) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) { if (G.runBattle(mkTeam(a, S, 0), mkTeam(b, S, 1), { seed: 99 + i * 131 }).winner === 0) w++; }
    else { if (G.runBattle(mkTeam(b, S, 0), mkTeam(a, S, 1), { seed: 99 + i * 131 }).winner === 1) w++; }
  }
  return w / N;
}
const pad = (s, n) => String(s).padStart(n);
const res = {}; KINDS.forEach(k => res[k] = { mono: [], esc: [] });
[['thuần', teamMono, 'mono'], ['kèm', teamEsc, 'esc']].forEach(([label, mkTeam, key]) => {
  SETUPS.forEach(S => {
    const M = {}; KINDS.forEach(a => { M[a] = {}; });
    for (let i = 0; i < KINDS.length; i++) for (let j = i + 1; j < KINDS.length; j++) { const v = wr(KINDS[i], KINDS[j], S, mkTeam); M[KINDS[i]][KINDS[j]] = v; M[KINDS[j]][KINDS[i]] = 1 - v; }
    if (SHOW) { console.log('\n[' + label + '] ' + S.name + '   (hàng thắng cột, %)'); console.log(pad('', 9) + KINDS.map(k => pad(k.slice(0, 5), 6)).join('') + '   | TB'); }
    KINDS.forEach(a => {
      const m = KINDS.filter(b => b !== a).reduce((s, b) => s + M[a][b], 0) / (KINDS.length - 1);
      res[a][key].push(m);
      if (SHOW) console.log(pad(a, 9) + KINDS.map(b => a === b ? pad('·', 6) : pad(Math.round(M[a][b] * 100), 6)).join('') + '   | ' + Math.round(m * 100));
    });
  });
});
console.log('\nTỈ LỆ THẮNG TRUNG BÌNH (%)        thuần: không/vừa/nặng     kèm: không/vừa/nặng     → chung');
KINDS.forEach(k => {
  const r = res[k], all = r.mono.concat(r.esc), m = all.reduce((a, b) => a + b, 0) / all.length;
  console.log(pad(k, 9) + '              ' + r.mono.map(v => pad(Math.round(v * 100), 5)).join('') + '          ' + r.esc.map(v => pad(Math.round(v * 100), 5)).join('') + '         → ' + pad(Math.round(m * 100), 3) + (m < 0.35 || m > 0.65 ? '  !!' : ''));
});

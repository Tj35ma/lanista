// LANISTA — bảng chuẩn: 8 kiểu đội hình ở trần cấp của hạng, đủ đồ, đấu với từng trùm.
// node tools/bosses.js [n=120] [--fights]   (--fights: thêm cả 6 trận thường của mỗi hạng)
const G = require('./load.js');
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 120);
const ALL = process.argv.includes('--fights');

const KIT = [
  { head: 'h_cap', body: { big: 'b_leather', bal: 'b_leather', agi: 'b_harness' }, arms: 'a_wrap', legs: { big: 'l_wraps', bal: 'l_wraps', agi: 'l_sandal' }, shield: { big: 's_plank', bal: 's_plank', agi: 's_plank' } },
  { head: 'h_legion', body: { big: 'b_linen', bal: 'b_linen', agi: 'b_linen' }, arms: 'a_manica', legs: { big: 'l_caliga', bal: 'l_caliga', agi: 'l_sandal' }, shield: { big: 's_parma', bal: 's_parma', agi: 's_parma' } },
  { head: 'h_murmillo', body: { big: 'b_hamata', bal: 'b_hamata', agi: 'b_linen' }, arms: 'a_scale', legs: { big: 'l_ocrea', bal: 'l_ocrea', agi: 'l_caliga' }, shield: { big: 's_scutum', bal: 's_hoplon', agi: 's_parma' } },
  { head: 'h_thraex', body: { big: 'b_segment', bal: 'b_muscle', agi: 'b_linen' }, arms: 'a_plate', legs: { big: 'l_ocrea2', bal: 'l_ocrea2', agi: 'l_caliga' }, shield: { big: 's_tower', bal: 's_hoplon', agi: 's_parma' } }
];
// [vũ khí, thể hình, khiên?]
const ARCH = {
  'kiếm+khiên': [['gladius', 'big', 1], ['gladius', 'bal', 1], ['gladius', 'big', 1], ['gladius', 'bal', 1], ['gladius', 'bal', 1]],
  'khiên+giáo': [['gladius', 'big', 1], ['hasta', 'bal', 1], ['gladius', 'big', 1], ['hasta', 'bal', 1], ['hasta', 'bal', 1]],
  'nhiều lao': [['gladius', 'big', 1], ['javelin', 'agi', 0], ['javelin', 'agi', 0], ['javelin', 'bal', 0], ['javelin', 'agi', 0]],
  'hai tay': [['axe', 'big', 0], ['trident', 'agi', 0], ['axe', 'big', 0], ['sica', 'bal', 0], ['axe', 'big', 0]],
  'song đao+găng': [['twin', 'agi', 0], ['caestus', 'bal', 0], ['twin', 'agi', 0], ['caestus', 'agi', 0], ['twin', 'agi', 0]],
  'lưới+khiên': [['gladius', 'big', 1], ['trident', 'agi', 0], ['trident', 'agi', 0], ['gladius', 'bal', 1], ['trident', 'agi', 0]],
  'sách vở': [['gladius', 'big', 1], ['sica', 'bal', 1], ['hasta', 'bal', 0], ['trident', 'agi', 0], ['javelin', 'agi', 0]],
  'chùy phá giáp': [['mace', 'big', 1], ['mace', 'bal', 1], ['hasta', 'bal', 1], ['mace', 'big', 1], ['sica', 'bal', 1]]
};
const PERKS = { big: ['grit', 'second'], bal: ['riposte', 'gangup'], agi: ['fleet', 'sharp'] };
function mk(spec, tier, lvl, idx) {
  const [kind, body, sh] = spec, B = G.BODY[body], K = KIT[tier];
  const g = { id: 'p' + idx, name: kind + idx, origin: 'italia', body, lvl, xp: 0, str: Math.round(B.str), agi: Math.round(B.agi), vit: Math.round(B.vit), traits: [], talent: null, cards: [], morale: 60, fame: 0, wins: 10, kills: 0, fights: 0, injuries: [], gear: {}, look: { h: 1, w: 1 } };
  const pref = body === 'big' ? ['vit', 'str'] : (body === 'agi' ? ['agi', 'str'] : ['str', 'vit', 'agi']);
  let perks = 0;
  for (let l = 2; l <= lvl; l++) { if (l % 3 === 0 && perks < 2) g.cards.push(PERKS[body][perks++]); else g.cards.push(pref[(l) % pref.length]); }
  g.gear.weapon = { id: kind + (tier + 1) };
  const two = G.WKIND[kind].hands === 2;
  // bộ đồ vừa túi tiền (~2/3 giá một bộ đủ): người cầm khiên: khiên + mũ + giáp thân; người không khiên: mũ + giáp thân + giáp tay
  const want = [['head', K.head], ['body', K.body[body]]];
  if (sh && !two) want.unshift(['shield', K.shield[body]]); else want.push(['arms', K.arms]);
  if (process.argv.includes('--full')) { if (sh && !two) want.push(['arms', K.arms]); want.push(['legs', K.legs[body]]); }
  want.forEach(([slot, id]) => { g.gear[slot] = { id }; const st = G.calcStats(g); if (st.weight > st.cap + 1e-6) delete g.gear[slot]; });
  return g;
}
function team(name, tier) {
  const n = G.TIERS[tier].field, lvl = G.TIERS[tier].cap, rows = [2, 1, 3, 0, 4], used = {};
  return ARCH[name].slice(0, n).map((sp, i) => {
    const g = mk(sp, tier, lvl, i), K = G.WKIND[sp[0]];
    const col = K.ai === 'ranged' ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0);
    let r = rows.find(x => !used[col + ',' + x]); used[col + ',' + r] = 1;
    return { g, c: col, r };
  });
}
function foes(def) { return def.foes.map((d, i) => ({ g: G.makeFoe(d, i, 0), c: d.c, r: d.r })); }
function run(tm, fs, n) { let w = 0, t = 0; for (let i = 0; i < n; i++) { const b = G.runBattle(tm, fs, { seed: 77 + i * 613 }); if (b.winner === 0) w++; t += b.time; } return [Math.round(w / n * 100), t / n]; }

const names = Object.keys(ARCH);
console.log('TRÙM × KIỂU ĐỘI (thắng %, n=' + N + ')'.padEnd(10));
console.log(''.padEnd(16) + ['Vitus', 'Nereus', 'Ferox', 'Maximus'].map(s => s.padStart(12)).join(''));
const col = [[], [], [], []];
names.forEach(nm => {
  let line = nm.padEnd(16);
  for (let t = 0; t < 4; t++) { const [w, d] = run(team(nm, t), foes(G.CAMPAIGN[t][6]), N); col[t].push(w); line += (w + '% ' + d.toFixed(0) + 's').padStart(12); }
  console.log(line);
});
console.log('min–max'.padEnd(16) + col.map(c => (Math.min(...c) + '–' + Math.max(...c)).padStart(12)).join(''));
if (ALL) {
  console.log('\nTRẬN THƯỜNG × KIỂU ĐỘI (thắng %)');
  for (let t = 0; t < 4; t++) for (let s = 0; s < 6; s++) {
    const ws = names.map(nm => run(team(nm, t), foes(G.CAMPAIGN[t][s]), Math.round(N / 3))[0]);
    console.log(`  ${t + 1}.${s + 1} ${G.CAMPAIGN[t][s].name.padEnd(30)} ` + ws.map(w => String(w).padStart(4)).join('') + '   tb ' + Math.round(ws.reduce((a, b) => a + b, 0) / ws.length));
  }
}

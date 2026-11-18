// Đo "trang bị đáng giá bao nhiêu": các cặp đấu mẫu giữa người có đồ và người không có đồ.
// node tools/gearcheck.js [n=400]
const G = require('./load.js');
const N = +process.argv[2] || 400;
const KIT = [null, ['s_plank', 'h_cap', 'b_leather', 'a_wrap', 'l_wraps'], ['s_parma', 'h_legion', 'b_linen', 'a_manica', 'l_caliga'], ['s_scutum', 'h_murmillo', 'b_hamata', 'a_scale', 'l_ocrea'], ['s_tower', 'h_thraex', 'b_segment', 'a_plate', 'l_ocrea2']];
function team(defs, off) { return defs.map((d, i) => ({ g: G.makeFoe(d, i + (off || 0), 7), c: d.c, r: d.r })); }
function run(a, b, n) {
  let w = 0, t = 0; n = n || N;
  for (let i = 0; i < n; i++) { const bt = G.runBattle(team(a, 0), team(b, 20), { seed: 101 + i * 37 }); if (bt.winner === 0) w++; t += bt.time; }
  return (w / n * 100).toFixed(0).padStart(3) + '%  ' + (t / n).toFixed(0).padStart(2) + 's';
}
function kit(tier, w) { const two = G.WKIND[w].hands === 2; return KIT[tier].filter(id => !(two && G.ITEMS[id].slot === 'shield')); }
function man(w, gear, c, r, lvl, body, x) { return G.e('M', body || 'bal', lvl || 1, w, gear || [], c || 0, r == null ? 2 : r, x); }
const thieves = G.CAMPAIGN[0][0].foes;
console.log('--- Hạng I, cấp 1, thể hình cân đối (thắng của bên trái | thời lượng) ---');
console.log('1 đủ đồ (gladius, khiên, mũ, giáp, tay, chân) vs 2 trộm gà :', run([man('gladius1', kit(1, 'gladius'))], thieves));
console.log('1 chỉ có gladius                          vs 2 trộm gà :', run([man('gladius1')], thieves));
console.log('1 chỉ có giáp+khiên, tay không            vs 2 trộm gà :', run([man(null, kit(1, 'gladius'))], thieves));
console.log('1 tay không                               vs 1 tay không:', run([man(null)], [man(null)]));
console.log('1 chỉ có gladius                          vs 1 tay không:', run([man('gladius1')], [man(null)]));
console.log('1 đủ đồ                                   vs 1 chỉ gladius:', run([man('gladius1', kit(1, 'gladius'))], [man('gladius1')]));
console.log('1 đủ đồ                                   vs 2 chỉ gladius:', run([man('gladius1', kit(1, 'gladius'))], [man('gladius1', [], 0, 1), man('gladius1', [], 0, 3)]));
console.log('2 chỉ gladius                             vs 2 trộm gà :', run([man('gladius1', [], 0, 1), man('gladius1', [], 0, 3)], thieves));
console.log('--- 1 người đủ đồ hạng I với từng vũ khí vs 2 trộm gà ---');
['caestus', 'gladius', 'sica', 'mace', 'hasta', 'trident', 'twin', 'axe', 'javelin'].forEach(k => console.log('  ' + k.padEnd(8), run([man(k + '1', kit(1, k))], thieves)));
console.log('--- Giá trị của giáp theo hạng: 1 đủ đồ hạng T vs 1 chỉ có vũ khí hạng T (cùng cấp) | vs 2 tay không cùng cấp ---');
for (let t = 1; t <= 4; t++) {
  const lvl = G.TIERS[t - 1].lvl + 1;
  console.log('  hạng ' + t + ' cấp ' + lvl + ':', run([man('gladius' + t, kit(t, 'gladius'), 0, 2, lvl)], [man('gladius' + t, [], 0, 2, lvl)]), ' |', run([man('gladius' + t, kit(t, 'gladius'), 0, 2, lvl)], [man(null, [], 0, 1, lvl), man(null, [], 0, 3, lvl)]));
}

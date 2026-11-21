// LANISTA — đo sức mạnh của chỉ số / nét tính cách / thiên phú / thẻ bằng mô phỏng ghép cặp.
// In ra ĐCT (điểm chỉ số tương đương; 1 ĐCT = +1 Sức mạnh) của từng thứ ở cấp 1/3/6/9 để cập nhật trường 'esp' trong data.js.
// node tools/value.js [N=2500]   (N cặp trận cho mỗi biến thể mỗi cấp; ~10 phút với N=2500)
const G = require('./load.js');
const byT = {}; for (const k in G.ITEMS) { const it = G.ITEMS[k]; (byT[it.slot + it.tier] = byT[it.slot + it.tier] || []).push(k); }
const tierOf = L => L <= 2 ? 1 : L <= 5 ? 2 : L <= 8 ? 3 : 4;
function gear(rng, g, L, wkinds) {
  const t = tierOf(L); g.gear = {};
  let wl = byT['weapon' + t]; if (wkinds) wl = wl.filter(id => wkinds.includes(G.ITEMS[id].kind));
  g.gear.weapon = { id: rng.pick(wl), uid: 'w' };
  const two = G.WKIND[G.ITEMS[g.gear.weapon.id].kind].hands === 2;
  for (const s of ['body', 'head', 'legs', 'arms']) if (rng.chance(0.85)) g.gear[s] = { id: rng.pick(byT[s + t]), uid: s };
  if (!two && rng.chance(0.5)) g.gear.shield = { id: rng.pick(byT['shield' + t]), uid: 'sh' };
  for (const s of ['shield', 'arms', 'head', 'legs', 'body']) { const st = G.calcStats(g); if (st.weight <= st.cap) break; delete g.gear[s]; }
}
function mk(rng, L, wkinds) {
  const g = G.makeGladiator(rng, { lvl: L, talent: false, quality: 0 });
  g.traits = []; g.morale = 60; gear(rng, g, L, wkinds); return g;
}
const clone = o => JSON.parse(JSON.stringify(o));
function place(team) { let r = [1, 3, 0, 4, 2]; return team.map((g, i) => ({ g, c: G.WKIND[G.weaponOf(g).kind].ranged ? 1 : 0, r: team.length === 1 ? 2 : r[i] })); }
function score(b) { return b.winner === 0 ? 1 : b.winner === 1 ? 0 : 0.5; }
// mod(g) mutates variant. size = team size. Returns paired win rates.
function measure(mod, { L = 3, N = 400, size = 1, seed = 1, wkinds = null, which = 0, pre = null } = {}) {
  let sb = 0, sv = 0;
  for (let i = 0; i < N; i++) {
    const rng = new G.Rng(seed * 100003 + i * 7919 + L * 31);
    const A = [], B = [];
    for (let j = 0; j < size; j++) A.push(mk(rng, L, j === which ? wkinds : null));
    for (let j = 0; j < size; j++) B.push(mk(rng, L));
    if (pre) pre(A[which]);   // bỏ thẻ đã có sẵn để bản gốc thật sự thiếu nó
    const Av = A.map(clone); mod(Av[which], Av);
    const s = rng.int(1, 1e9);
    sb += score(G.runBattle(place(A), place(B), { seed: s, radius: 9 }));
    sv += score(G.runBattle(place(Av), place(B), { seed: s, radius: 9 }));
  }
  return { pb: sb / N, pv: sv / N };
}
const logit = p => Math.log(Math.max(1e-3, Math.min(1 - 1e-3, p)) / (1 - Math.max(1e-3, Math.min(1 - 1e-3, p))));

const two = Object.keys(G.WKIND).filter(k => G.WKIND[k].hands === 2 || k === 'twin');
const V = { 'str+2': g => g.str += 2, 'agi+2': g => g.agi += 2, 'hp+30': g => g.hp += 30, 'sta+10': g => g.sta += 10,
  'lvl+1 (máu+thẻ)': g => { g.lvl++; const o = G.cardOptions(g, new G.Rng(g.cardSeed + g.lvl * 7919)); G.applyCard(g, o[0]); },
  'lvl+1 (chỉ máu)': g => g.lvl++, 'tinh thần 85': g => g.morale = 85, 'tinh thần 25': g => g.morale = 25 };
const WK = {};
for (const k in G.TRAITS) V['nét ' + k] = g => g.traits.push(k);
for (const k in G.TALENTS) V['tp ' + k] = g => g.talent = k;
WK['tp venator'] = ['javelin', 'hasta']; WK['tp fistmaster'] = ['caestus']; WK['tp twinborn'] = two;
const PRE = {};
for (const c in G.CARDS) { V['thẻ ' + c] = g => g.cards.push(c); if (G.CARDS[c].uniq) PRE['thẻ ' + c] = g => { g.cards = g.cards.filter(x => x !== c); }; }
WK['thẻ heavy'] = ['axe', 'trident'];
if (process.argv[3]) { const re = new RegExp(process.argv[3]); for (const k in V) if (k !== 'str+2' && !re.test(k)) delete V[k]; }   // tham số 2: chỉ đo các biến thể khớp regex
const N = +process.argv[2] || 2500, LV = [[1, 2], [3, 3], [6, 4], [9, 5]], out = {};
for (const [L, size] of LV) {
  out[L] = {};
  for (const k in V) { const r = measure(V[k], { L, N, size, wkinds: WK[k] || null, pre: PRE[k] }); out[L][k] = logit(r.pv) - logit(r.pb); }
  process.stderr.write('cấp ' + L + ' xong\n');
}
console.log('biến thể'.padEnd(22) + LV.map(([L]) => ('C' + L).padStart(7)).join('') + '   tb');
for (const k in V) {
  const row = LV.map(([L]) => { const u = out[L]['str+2'] / 2; return out[L][k] / u; });
  console.log(k.padEnd(22) + row.map(x => x.toFixed(2).padStart(7)).join('') + (row.reduce((a, b) => a + b, 0) / row.length).toFixed(2).padStart(7));
}

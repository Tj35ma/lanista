// LANISTA — bot chơi trọn chiến dịch không đồ họa, để đo độ dài và độ khó.
// node tools/bot.js [runs=40] [seed0=1] [--noarmor] [--noside] [--norelic] [--quiet] [--trials=30] [--trace=SEED]
const G = require('./load.js');

const args = process.argv.slice(2);
const flags = {}; const nums = [];
args.forEach(a => { if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); flags[k] = v == null ? true : v; } else nums.push(+a); });
const RUNS = nums[0] || 40, SEED0 = nums[1] || 1;
const TRIALS = +(flags.trials || 30);

function median(a) { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; }

// ---------------------------------------------------------------- ước lượng
function nakedPower(g) { const gear = g.gear; g.gear = {}; const p = G.power(g); g.gear = gear; return p; }
// sức mạnh nếu mang thêm món này (−1 nếu không mang nổi / sai luật)
function powerWith(g, item, inst) {
  const wNow = G.weaponOf(g);
  if (item.slot === 'shield' && G.WKIND[wNow.kind].hands === 2) return -1;
  const old = g.gear[item.slot]; let oldShield = null;
  g.gear[item.slot] = inst || { id: item.id };   // món cụ thể (có độ hiếm) nếu biết
  if (item.slot === 'weapon' && G.WKIND[item.kind].hands === 2 && g.gear.shield) { oldShield = g.gear.shield; delete g.gear.shield; }
  const st = G.calcStats(g);
  const p = st.weight <= st.cap + 1e-6 ? G.power(g) : -1;
  if (old) g.gear[item.slot] = old; else delete g.gear[item.slot];
  if (oldShield) g.gear.shield = oldShield;
  return p;
}
function kindCount(gm, kind, except) { let n = 0; gm.s.roster.forEach(g => { if (g !== except && G.weaponOf(g).kind === kind) n++; }); return n; }
// lợi ích của một món với một người, có tính sở thích đa dạng vũ khí
function gain(gm, g, item, opt, inst) {
  if (opt.noarmor && item.slot !== 'weapon') return -1;
  const cur = G.power(g), p = powerWith(g, item, inst);
  if (p < 0) return -1;
  let d = p - cur;
  if (item.slot === 'trinket' && !g.gear.trinket) {
    // giá trị mà G.power không thấy: sống sót, sức hút, tinh thần, sức mang
    if (item.deathMul) d += cur * 0.03;
    if (item.appeal) d += cur * 0.02;
    if (item.moraleFight) d += cur * 0.02;
    if (item.cap && G.calcStats(g).load > 0.8) d += cur * 0.04;
  }
  if (item.slot === 'weapon') {
    d *= 1 - Math.min(0.7, 0.35 * kindCount(gm, item.kind, g));
    // sở thích theo thể hình (như người chơi thường làm)
    const K = G.WKIND[item.kind];
    if (g.body === 'big' && (item.kind === 'axe' || item.kind === 'mace')) d *= 1.15;
    if (g.body === 'agi' && (item.kind === 'twin' || item.kind === 'bow' || item.kind === 'crossbow' || item.kind === 'trident' || item.kind === 'sica')) d *= 1.15;
    if (item.kind === 'hasta' || item.kind === 'trident') d *= 1.05; // tầm xa có giá trị mà G.power không thấy
  }
  return d;
}

// ---------------------------------------------------------------- hành vi
function pickCards(gm) {
  gm.s.roster.forEach(g => {
    let guard = 0;
    while (g.pending > 0 && guard++ < 20) {
      const ch = gm.cardChoices(g);
      const pref = g.body === 'big' ? ['vit', 'str'] : (g.body === 'agi' ? ['agi', 'str'] : ['str', 'vit', 'agi']);
      const perks = g.cards.filter(c => G.CARDS[c].r === 2).length;
      let pick = null;
      const rare = ch.find(c => G.CARDS[c].r === 2 && c !== 'wall' || (c === 'wall' && g.gear.shield));
      if (rare && perks < Math.ceil(g.lvl / 3)) pick = rare;
      if (!pick) pick = pref.map(p => ch.find(c => c === p)).find(Boolean);
      if (!pick) pick = ch.find(c => ['hide', 'porter', 'str', 'vit', 'agi'].includes(c)) || ch[0];
      if (!gm.pickCard(g.id, pick)) break;
    }
  });
}

function equipFromInv(gm, opt) {
  const s = gm.s; let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false; let best = null;
    const order = s.roster.slice().sort((a, b) => (s.form[b.id] ? 1 : 0) - (s.form[a.id] ? 1 : 0));
    for (const g of order) for (const inst of s.inv) {
      const d = gain(gm, g, G.ITEMS[inst.id], opt, inst);
      if (d > 0.05 && (!best || d > best.d)) best = { d, g, inst };
    }
    if (best && gm.equip(best.g.id, best.inst.uid).ok) changed = true;
  }
}

function shopping(gm, opt, log) {
  const s = gm.s, lim = gm.fieldLimit();
  equipFromInv(gm, opt);
  const buffer = () => gm.upkeep() * 2;
  // 1) đủ người ra sân
  let guard = 0;
  while (s.roster.length < lim && guard++ < 6) {
    let best = null;
    s.market.slaves.forEach((o, i) => {
      if (o.sold || o.price > s.gold) return;
      const v = nakedPower(o.g) / (o.price + 12);
      if (!best || v > best.v) best = { v, i };
    });
    if (!best) break;
    if (!gm.buySlave(best.i).ok) break;
    log.bought++;
  }
  // 2) ai chưa có vũ khí thì mua trước
  const buyBest = (filterG, filterItem, minGain) => {
    let best = null;
    s.market.shop.forEach((o, i) => {
      if (o.sold || o.price > s.gold) return;
      const it = G.ITEMS[o.id]; if (filterItem && !filterItem(it)) return;
      s.roster.forEach(g => {
        if (filterG && !filterG(g)) return;
        const d = gain(gm, g, it, opt, o); if (d <= (minGain || 0.05)) return;
        const v = d / o.price * (s.form[g.id] ? 1 : 0.5);
        if (!best || v > best.v) best = { v, i, g, d };
      });
    });
    if (!best) return false;
    const r = gm.buyItem(best.i); if (!r.ok) return false;
    if (!gm.equip(best.g.id, r.inst.uid).ok) { gm.sellItem(r.inst.uid); return false; }
    return true;
  };
  guard = 0;
  while (guard++ < 8 && s.roster.some(g => !g.gear.weapon)) { if (!buyBest(g => !g.gear.weapon, it => it.slot === 'weapon')) break; }
  // 3) một người dự bị
  if (s.roster.length >= lim && s.roster.length < Math.min(G.Game.MAX_ROSTER, lim + 1)) {
    let best = null;
    s.market.slaves.forEach((o, i) => {
      if (o.sold || o.price + buffer() + 10 > s.gold) return;
      const v = nakedPower(o.g) / (o.price + 12);
      if (!best || v > best.v) best = { v, i };
    });
    if (best && gm.buySlave(best.i).ok) log.bought++;
  }
  // 3b) thay kẻ yếu nhất nếu chợ có người hơn hẳn
  if (s.roster.length >= lim + 1) {
    let weak = null; s.roster.forEach(g => { const p = nakedPower(g); if (!weak || p < weak.p) weak = { g, p }; });
    let cand = null; s.market.slaves.forEach((o, i) => { if (o.sold) return; const p = nakedPower(o.g); if (!cand || p > cand.p) cand = { o, i, p }; });
    if (weak && cand && cand.p > weak.p * 1.35 && s.gold + gm.sellValue(weak.g) - cand.o.price >= buffer()) {
      gm.sellSlave(weak.g.id);
      if (gm.buySlave(cand.i).ok) { log.bought++; log.replaced++; }
      equipFromInv(gm, opt);
    }
  }
  // 4) nâng cấp đồ
  guard = 0;
  while (guard++ < 12 && s.gold > buffer()) {
    const before = s.gold;
    let best = null;
    s.market.shop.forEach((o, i) => {
      if (o.sold || o.price > s.gold - buffer()) return;
      const it = G.ITEMS[o.id];
      s.roster.forEach(g => {
        const d = gain(gm, g, it, opt, o); if (d <= 0.25) return;
        // trừ giá bán lại món cũ; đổi ngang (thay món đang có) phải đáng kể mới mua
        const old = g.gear[it.slot];
        if (old && d < G.power(g) * (it.slot === 'weapon' ? 0.08 : 0.015)) return; const net = o.price - (old ? G.ITEMS[old.id].price * 0.5 : 0);
        const v = d / Math.max(4, net) * (s.form[g.id] ? 1 : 0.4) * (it.slot === 'weapon' ? 1.3 : 1);
        if (!best || v > best.v) best = { v, i, g };
      });
    });
    if (!best) break;
    const r = gm.buyItem(best.i); if (!r.ok) break;
    if (!gm.equip(best.g.id, r.inst.uid).ok) { gm.sellItem(r.inst.uid); break; }
    if (s.gold === before) break;
  }
  // 5) vật của lanista khi dư dả
  const rel = s.market.relic;
  if (!opt.norelic && rel && !rel.sold && s.gold >= rel.price + buffer()) { if (gm.buyRelic().ok) log.relics++; }
  // 5b) gọi thầy thuốc cho người sẽ ra sân
  s.roster.slice().sort((a, b) => nakedPower(b) - nakedPower(a)).slice(0, lim).forEach(g => {
    const c = gm.treatCost(g);
    if (c > 0 && s.gold >= c + buffer()) { const r = gm.treat(g.id); if (r.ok) { log.treats++; log.treatGold += r.cost; } }
  });
  // 6) bán đồ thừa
  equipFromInv(gm, opt);
  if (s.roster.length >= lim) {
    s.inv.slice().forEach(inst => {
      const it = G.ITEMS[inst.id];
      const useful = s.roster.some(g => gain(gm, g, it, opt, inst) > 0.05);
      if (!useful) gm.sellItem(inst.uid);
    });
  }
  // 7) tiệc
  if (s.roster.length) {
    const am = avg(s.roster.map(g => g.morale));
    s.roster.forEach(g => { while (g.morale < 45 && s.gold >= gm.rewardCost() + buffer()) { if (!gm.reward(g.id).ok) break; log.feasts++; } });
  }
}

function formation(gm) {
  const s = gm.s, lim = gm.fieldLimit();
  Object.keys(s.form).forEach(k => gm.bench(k));
  const order = s.roster.slice().sort((a, b) => G.power(b) - G.power(a)).slice(0, lim);
  const rows = { 0: [2, 1, 3, 0, 4], 1: [2, 1, 3, 0, 4], 2: [2, 1, 3, 0, 4] }, used = {};
  order.forEach(g => {
    const K = G.WKIND[G.weaponOf(g).kind];
    let col = K.ai === 'ranged' ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0);
    for (const r of rows[col]) { if (!used[col + ',' + r]) { used[col + ',' + r] = 1; gm.place(g.id, col, r); break; } }
  });
}

function fightNow(gm, kind) {
  const b = gm.makeBattle(kind); if (!b) return null;
  let n = 0; while (!b.over && n++ < 30 * 200) { b.step(1 / 30); b.events.length = 0; }
  const res = gm.resolveBattle(b);
  res._time = b.time; res._reason = b.reason;
  return res;
}

// Kẹt ở một trận chính: thử đổi vũ khí (trong kho hoặc ngoài lò rèn) cho từng người ra sân, giữ lại phương án làm tỉ lệ thắng tăng rõ.
function tryCounter(gm, opt, log, p0) {
  const s = gm.s, team = gm.playerTeam().map(p => p.g), T = 12;
  const base = gm.trial('main', T);
  let best = null;
  const cands = [];
  s.inv.forEach(inst => { if (G.ITEMS[inst.id].slot === 'weapon') cands.push({ id: inst.id, inst, price: 0 }); });
  s.market.shop.forEach((o, i) => { if (!o.sold && G.ITEMS[o.id].slot === 'weapon' && o.price <= s.gold - gm.upkeep() * 2) cands.push({ id: o.id, shop: i, price: o.price }); });
  team.forEach(g => cands.forEach(c => {
    const it = G.ITEMS[c.id]; if (g.gear.weapon && g.gear.weapon.id === c.id) return;
    const oldW = g.gear.weapon, oldS = g.gear.shield;
    g.gear.weapon = { id: c.id }; if (G.WKIND[it.kind].hands === 2) delete g.gear.shield;
    const st = G.calcStats(g); let p = -1;
    if (st.weight <= st.cap + 1e-6) p = gm.trial('main', T);
    if (oldW) g.gear.weapon = oldW; else delete g.gear.weapon; if (oldS) g.gear.shield = oldS;
    if (p > base + 0.12 && (!best || p > best.p)) best = { p, g, c };
  }));
  if (!best) return p0;
  let uid = null;
  if (best.c.inst) uid = best.c.inst.uid; else { const r = gm.buyItem(best.c.shop); if (!r.ok) return p0; uid = r.inst.uid; }
  if (!gm.equip(best.g.id, uid).ok) return p0;
  log.swaps++;
  return gm.trial('main', TRIALS);
}

// ---------------------------------------------------------------- một chiến dịch
function runCampaign(seed, opt) {
  const gm = G.Game.create(seed), s = gm.s;
  const log = { seed, bought: 0, replaced: 0, relics: 0, feasts: 0, sides: 0, sideWins: 0, mains: 0, rests: 0,
    treats: 0, treatGold: 0, maxGold: 0, swaps: 0, attempts: {}, first: {}, fdur: {}, stageDays: {}, arriveP: {}, winLvl: {}, winGear: {}, winGold: {}, tierDays: G.TIERS.map(() => 0), tierEndGold: [], tierEndGoldPre: [], tierEndLvl: [], tierEndDay: [], dur: G.TIERS.map(() => []), sideDur: [], upkeep: 0, income: 0, deadEnd: false, mainWinRate: [] };
  let stuck = 0, dead = 0;
  while (!s.won && s.day <= 400) {
    const tier = s.tier;
    pickCards(gm);
    shopping(gm, opt, log);
    formation(gm);
    log.tierDays[tier]++;
    if (!s.roster.length) { dead++; if (dead > 10) { log.deadEnd = true; break; } }
    else dead = 0;
    let kind = null;
    if (gm.fielded() > 0) {
      const pm = gm.trial('main', TRIALS);
      { const k0 = s.tier + '.' + s.stage; log.stageDays[k0] = (log.stageDays[k0] || 0) + 1; if (log.arriveP[k0] == null) log.arriveP[k0] = pm; }
      let pm2 = pm;
      if (pm < 0.55 && stuck >= 4 && stuck % 2 === 0) { pm2 = tryCounter(gm, opt, log, pm); formation(gm); }
      if (opt.trace) console.log(`  d${s.day} ${s.tier + 1}.${s.stage + 1} vàng ${s.gold} nuôi ${gm.upkeep()} p=${pm.toFixed(2)}${pm2 !== pm ? '→' + pm2.toFixed(2) : ''} kẹt ${stuck} | ` + s.roster.map(g => (s.form[g.id] ? '*' : '') + g.name.slice(0, 6) + ' L' + g.lvl + ' ' + G.weaponOf(g).id + (g.injuries.length ? ' inj' + g.injuries.length : '') + ' m' + g.morale).join(', '));
      if (pm2 >= 0.55 || (stuck > 6 && pm2 >= 0.4) || (stuck > 30 && pm2 >= 0.3)) kind = 'main';
      else if (!opt.noside) {
        const p1 = gm.trial('side1', TRIALS), p0 = opt.light ? gm.trial('side0', TRIALS) : 0;   // game chỉ còn một trận phụ; opt.light cho bot dùng lại trận nhẹ (khi tạo kho đội mẫu)
        if (p1 >= 0.75) kind = 'side1';
        else if (p0 >= 0.7) kind = 'side0';
        else if (s.gold < gm.upkeep() * 3) {
          // túng quẫn: không còn gì để mất, đánh trận có kỳ vọng tiền cao nhất
          const e1 = p1 * s.side[1].gold, e0 = p0 * s.side[0].gold, em = pm * (gm.mainFight() ? gm.mainFight().gold : 0);
          const best = Math.max(e1, e0, em);
          if (best > 0 && Math.max(p1, p0, pm) >= 0.2) kind = best === em ? 'main' : (best === e1 ? 'side1' : 'side0');
        }
      }
    }
    if (kind) {
      const key = s.tier + '.' + s.stage;
      const g0 = s.gold;
      const teamGear = gm.playerTeam().reduce((a, p) => a + Object.keys(p.g.gear).reduce((b, sl) => b + (p.g.gear[sl] ? G.ITEMS[p.g.gear[sl].id].price : 0), 0), 0);
      const teamLvl = avg(gm.playerTeam().map(p => p.g.lvl));
      const res = fightNow(gm, kind);
      log.income += s.gold - g0;
      if (kind === 'main') {
        log.mains++;
        log.attempts[key] = (log.attempts[key] || 0) + 1;
        if (log.attempts[key] === 1) log.first[key] = res.win ? 1 : 0;
        log.dur[tier].push(res._time); (log.fdur[key] = log.fdur[key] || []).push(res._time);
        if (res.win) { log.winLvl[key] = teamLvl; log.winGear[key] = teamGear; log.winGold[key] = g0; }
        if (res.win) { stuck = 0; if (s.tier !== tier || s.won) { log.tierEndGold[tier] = s.gold; log.tierEndGoldPre[tier] = g0; log.tierEndDay[tier] = s.day; log.tierEndLvl[tier] = avg(gm.playerTeam().map(p => p.g.lvl)); } }
        else stuck++;
      } else { log.sides++; if (res.win) log.sideWins++; log.sideDur.push(res._time); stuck++; }
      pickCards(gm);
    } else { log.rests++; stuck++; }
    if (opt.trace) console.log('     → ' + (kind || 'nghỉ') + '  vàng ' + s.gold);
    if (s.gold > log.maxGold) log.maxGold = s.gold;
    const g1 = s.gold; gm.nextDay(); log.upkeep += g1 - s.gold;
  }
  log.won = s.won; log.days = s.day; log.tier = s.tier; log.stage = s.stage;
  log.deaths = s.stat.deaths; log.deserted = s.stat.deserted; log.gold = s.gold; log.wins = s.stat.wins; log.losses = s.stat.losses;
  log.lvl = avg(s.roster.map(g => g.lvl));
  log.perm = s.roster.map(g => g.injuries.filter(x => x.perm).length);
  return log;
}

// ---------------------------------------------------------------- chạy nhiều lần
function main() {
  const opt = { noarmor: !!flags.noarmor, noside: !!flags.noside, norelic: !!flags.norelic };
  if (flags.trace) { const L = runCampaign(+flags.trace, Object.assign({ trace: true }, opt)); console.log(JSON.stringify({ won: L.won, days: L.days, deaths: L.deaths, deserted: L.deserted, tierDays: L.tierDays })); return; }
  const logs = [];
  const t0 = Date.now();
  for (let i = 0; i < RUNS; i++) {
    const L = runCampaign(SEED0 + i * 101, opt); logs.push(L);
    if (!flags.quiet) console.log(`seed ${String(L.seed).padStart(5)}  ${L.won ? 'THẮNG' : (L.deadEnd ? 'CỤT  ' : 'dở   ')} ngày ${String(L.days).padStart(3)}  tới ${L.tier + 1}.${L.stage + 1}  chết ${L.deaths} trốn ${L.deserted}  phụ ${L.sides}(${L.sideWins})  chính ${L.mains}  nghỉ ${L.rests}  mua ${L.bought}  vật ${L.relics}  vàng ${L.gold}  cấp ${L.lvl.toFixed(1)}  ngày/hạng ${L.tierDays.join('/')}`);
  }
  const won = logs.filter(l => l.won);
  console.log('\n=== TỔNG HỢP (' + RUNS + ' lượt, ' + ((Date.now() - t0) / 1000).toFixed(0) + 's' + (opt.noarmor ? ', KHÔNG GIÁP' : '') + (opt.noside ? ', KHÔNG TRẬN PHỤ' : '') + ') ===');
  console.log('Hoàn thành: ' + won.length + '/' + RUNS + ' (' + Math.round(won.length / RUNS * 100) + '%)');
  if (won.length) console.log('Số ngày để thắng: trung vị ' + median(won.map(l => l.days)) + ', min ' + Math.min(...won.map(l => l.days)) + ', max ' + Math.max(...won.map(l => l.days)));
  console.log('Ngày mỗi hạng (trung vị, các lượt đã qua hạng đó): ' + G.TIERS.map((_, i) => i).map(t => { const a = logs.filter(l => l.tier > t || l.won).map(l => l.tierDays[t]); return a.length ? median(a) : '-'; }).join(' / '));
  console.log('Vàng cuối mỗi hạng (trung vị): ' + G.TIERS.map((_, i) => i).map(t => { const a = logs.map(l => l.tierEndGold[t]).filter(x => x != null); return a.length ? median(a) : '-'; }).join(' / '));
  console.log('Vàng ngay trước trận trùm thắng (trung vị): ' + G.TIERS.map((_, i) => i).map(t => { const a = logs.map(l => l.tierEndGoldPre[t]).filter(x => x != null); return a.length ? median(a) : '-'; }).join(' / ') + '     Cấp tb đội ra sân cuối hạng: ' + G.TIERS.map((_, i) => i).map(t => { const a = logs.map(l => l.tierEndLvl[t]).filter(x => x != null && !isNaN(x)); return a.length ? avg(a).toFixed(1) : '-'; }).join(' / '));
  console.log('Chết: tb ' + avg(logs.map(l => l.deaths)).toFixed(1) + ' (trung vị ' + median(logs.map(l => l.deaths)) + ', min ' + Math.min(...logs.map(l => l.deaths)) + ', max ' + Math.max(...logs.map(l => l.deaths)) + ')   Bỏ trốn: tb ' + avg(logs.map(l => l.deserted)).toFixed(1) +
    '   Trận phụ: tb ' + avg(logs.map(l => l.sides)).toFixed(0) + ' (thắng ' + Math.round(avg(logs.map(l => l.sideWins / Math.max(1, l.sides))) * 100) + '%)   Ngày nghỉ: tb ' + avg(logs.map(l => l.rests)).toFixed(0) + '   Người mua: tb ' + avg(logs.map(l => l.bought)).toFixed(1) + '   Vật lanista: tb ' + avg(logs.map(l => l.relics)).toFixed(1));
  console.log('Phí nuôi / thu nhập: ' + Math.round(avg(logs.map(l => l.upkeep / Math.max(1, l.income))) * 100) + '%   Vàng nhiều nhất từng cầm (trung vị / max): ' + median(logs.map(l => l.maxGold)) + ' / ' + Math.max(...logs.map(l => l.maxGold)) +
    '   Thầy thuốc: tb ' + avg(logs.map(l => l.treats)).toFixed(1) + ' lần, ' + avg(logs.map(l => l.treatGold)).toFixed(0) + ' vàng   Đổi vũ khí khi kẹt: tb ' + avg(logs.map(l => l.swaps)).toFixed(1));
  { const pp = [].concat(...logs.map(l => l.perm || [])); console.log('Thương tật vĩnh viễn cuối chiến dịch: tb ' + avg(pp).toFixed(2) + '/người, nhiều nhất ' + (pp.length ? Math.max(...pp) : 0) + ', tb mỗi trường ' + avg(logs.map(l => (l.perm || []).reduce((a, b) => a + b, 0))).toFixed(1)); }
  console.log('\nTrận chính: lần thử tb | thắng ngay | lượt tới | ngày ở trận | p lúc mới tới | cấp tb khi thắng | giá trị đồ | vàng trong túi | thời lượng');
  for (let t = 0; t < G.TIERS.length; t++) for (let st = 0; st < 7; st++) {
    const key = t + '.' + st, a = logs.map(l => l.won || l.tier > t || (l.tier === t && l.stage > st) ? l.attempts[key] : null).filter(x => x != null);
    const reached = logs.filter(l => l.attempts[key] != null);
    const f = reached.map(l => l.first[key]);
    const stuckN = reached.length - a.length;
    console.log(`  ${t + 1}.${st + 1} ${G.CAMPAIGN[t][st].name.padEnd(36)} ${a.length ? avg(a).toFixed(2).padStart(5) : '    -'} | ${f.length ? (Math.round(avg(f) * 100) + '%').padStart(4) : '   -'} | ${String(reached.length).padStart(3)} | ${avg(reached.map(l => l.stageDays[key] || 0)).toFixed(1).padStart(5)} | ${(Math.round(avg(reached.map(l => l.arriveP[key] || 0)) * 100) + '%').padStart(4)} | ${avg(reached.map(l => l.winLvl[key]).filter(x => x != null && !isNaN(x))).toFixed(1).padStart(4)} | ${avg(reached.map(l => l.winGear[key]).filter(x => x != null)).toFixed(0).padStart(5)} | ${avg(reached.map(l => l.winGold[key]).filter(x => x != null)).toFixed(0).padStart(5)} | ${avg([].concat(...reached.map(l => l.fdur[key] || []))).toFixed(0).padStart(3)}s${stuckN ? '  (kẹt lại: ' + stuckN + ', đã thử tb ' + avg(reached.filter(l => !(l.won || l.tier > t || (l.tier === t && l.stage > st))).map(l => l.attempts[key])).toFixed(1) + ')' : ''}`);
  }
  console.log('\nThời lượng trận chính theo hạng (giây, tb | <10s | <12s | >35s):');
  for (let t = 0; t < G.TIERS.length; t++) {
    const d = [].concat(...logs.map(l => l.dur[t]));
    if (!d.length) { console.log('  Hạng ' + (t + 1) + ': -'); continue; }
    console.log('  Hạng ' + (t + 1) + ': ' + avg(d).toFixed(1) + ' | ' + Math.round(d.filter(x => x < 10).length / d.length * 100) + '% | ' + Math.round(d.filter(x => x < 12).length / d.length * 100) + '% | ' + Math.round(d.filter(x => x > 35).length / d.length * 100) + '%   (n=' + d.length + ')');
  }
  const sd = [].concat(...logs.map(l => l.sideDur));
  if (sd.length) console.log('  Trận phụ: ' + avg(sd).toFixed(1) + ' | ' + Math.round(sd.filter(x => x < 10).length / sd.length * 100) + '% | ' + Math.round(sd.filter(x => x < 12).length / sd.length * 100) + '% | ' + Math.round(sd.filter(x => x > 35).length / sd.length * 100) + '%   (n=' + sd.length + ')');
}
if (require.main === module) main();
module.exports = { runCampaign };

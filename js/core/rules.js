// LANISTA — luật: RNG, tạo đấu sĩ, tính chỉ số, giá cả. Không phụ thuộc đồ họa.
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- RNG có hạt giống (mulberry32), trạng thái lưu được
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    var t = (this.s += 0x6D2B79F5) >>> 0;
    this.s = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.weighted = function (ws) {
    var s = 0, i; for (i = 0; i < ws.length; i++) s += ws[i];
    var r = this.next() * s; for (i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; } return ws.length - 1;
  };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(this.next() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  G.Rng = Rng;
  G.hashStr = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  var FIST = { id: 'fist', slot: 'weapon', kind: 'fist', tier: 0, name: 'Tay không', dmg: 3, wt: 0, price: 0, look: {} };
  G.FIST = FIST;
  // Hệ số hiệu lực của giáp trong công thức sát thương: dmg = base² / (base + giáp × ARMOR_K)
  G.ARMOR_K = 1.4;

  // ---------------------------------------------------------------- Ngoại hình
  var CLOTH = [0x8c6a4a, 0x9a7b55, 0x7d6a58, 0xa08a6a, 0x6e5a48, 0x8f7f6a];
  function genLook(rng, originId) {
    var o = G.ORIGINS[originId];
    return {
      skin: rng.pick(o.skin), hair: rng.pick(o.hair),
      hairStyle: rng.weighted([2, 4, 2, 1.5, 1]),   // 0 trọc, 1 ngắn, 2 dài, 3 búi, 4 mào
      beard: rng.weighted([5, 2, 2]),               // 0 không, 1 ria cằm, 2 rậm
      h: rng.range(0.95, 1.05), w: rng.range(0.94, 1.07),
      cloth: rng.pick(CLOTH), scar: rng.chance(0.25) ? rng.int(1, 3) : 0,
      jaw: rng.range(0.9, 1.12), nose: rng.range(0.8, 1.3)
    };
  }
  G.genLook = genLook;

  // ---------------------------------------------------------------- Tạo đấu sĩ
  var uidN = 1;
  G.newUid = function (rng) { return 'u' + Math.floor(rng.next() * 1e9).toString(36) + (uidN++); };

  // opts: {tier, talent(bool|id), lvl, quality}
  G.makeGladiator = function (rng, opts) {
    opts = opts || {};
    var tier = opts.tier || 0;
    var originId = rng.pick(Object.keys(G.ORIGINS));
    var o = G.ORIGINS[originId];
    var body = ['big', 'bal', 'agi'][rng.weighted(o.body)];
    var B = G.BODY[body];
    var q = opts.quality != null ? opts.quality : rng.range(-1.2, 1.2) + tier * 0.25;
    function st(base) { return Math.max(1, Math.round(base + q * 0.5 + rng.range(-1.1, 1.1))); }
    var g = {
      id: G.newUid(rng), name: rng.pick(o.names), origin: originId, body: body,
      lvl: 1, xp: 0, str: st(B.str), agi: st(B.agi), vit: st(B.vit),
      traits: [], talent: null, cards: [], morale: rng.int(50, 70), fame: 0, wins: 0, kills: 0, fights: 0,
      injuries: [], gear: {}, look: genLook(rng, originId), pending: 0, cardSeed: Math.floor(rng.next() * 1e9)
    };
    // nét tính cách: 0–2
    var keys = Object.keys(G.TRAITS), n = rng.weighted([2, 5, 3]);
    while (g.traits.length < n) {
      var k = rng.pick(keys);
      if (g.traits.indexOf(k) < 0) g.traits.push(k);
    }
    var wantTalent = opts.talent === true || (opts.talent == null && rng.chance(0.09 + tier * 0.03));
    if (typeof opts.talent === 'string') g.talent = opts.talent;
    else if (wantTalent) g.talent = rng.pick(Object.keys(G.TALENTS));
    // cấp khởi đầu theo hạng đấu trường
    var base = G.TIERS[tier].lvl;
    var lvl = opts.lvl != null ? opts.lvl : Math.max(1, base - 1 + rng.int(-1, 1) - (tier > 0 ? rng.int(0, 1) : 0));
    for (var i = 1; i < lvl; i++) {
      g.lvl++;
      var opt = G.cardOptions(g, new Rng(g.cardSeed + g.lvl * 7919));
      G.applyCard(g, rng.pick(opt));
    }
    return g;
  };

  // Kẻ địch từ định nghĩa chiến dịch
  G.makeFoe = function (def, idx, seed) {
    var rng = new Rng(G.hashStr(def.name) + idx * 977 + (seed || 0));
    var B = G.BODY[def.body];
    var x = def.x || {};
    var grow = (def.lvl - 1) * 0.42;
    var originId = x.origin || rng.pick(Object.keys(G.ORIGINS));
    var g = {
      id: 'foe' + idx, foe: true, name: def.name, origin: originId, body: def.body, lvl: def.lvl, xp: 0,
      str: B.str + grow, agi: B.agi + grow, vit: B.vit + grow,
      traits: [], talent: x.talent || null, cards: x.cards || [], morale: 60, fame: 0, wins: 0, kills: 0, fights: 0,
      injuries: [], gear: {}, look: genLook(rng, originId), boss: !!x.boss, x: x
    };
    if (x.scale) { g.look.h *= x.scale; g.look.w *= x.scale * 1.04; }
    if (def.w) g.gear.weapon = { id: def.w };
    for (var i = 0; i < def.gear.length; i++) { var it = G.ITEMS[def.gear[i]]; g.gear[it.slot] = { id: it.id }; }
    var rv = x.rv != null ? x.rv : (x.boss ? (x.enrage ? 4 : 3) : 0);
    if (rv) for (var sk in g.gear) g.gear[sk].rv = rv;
    return g;
  };

  // ---------------------------------------------------------------- Thẻ
  G.cardOptions = function (g, rng) {
    var pool = [], k;
    for (k in G.CARDS) {
      var c = G.CARDS[k];
      if (c.uniq && g.cards.indexOf(k) >= 0) continue;
      if (k === 'wall' && !(g.gear.shield)) { if (rng.chance(0.6)) continue; }
      pool.push(k);
    }
    var out = [];
    // luôn có ít nhất một thẻ chỉ số và cố gắng có một thẻ hiếm
    var commons = pool.filter(function (k) { return G.CARDS[k].r === 1; });
    var rares = pool.filter(function (k) { return G.CARDS[k].r === 2; });
    out.push(rng.pick(commons));
    if (rares.length) out.push(rng.pick(rares));
    var guard = 0;
    while (out.length < 3 && guard++ < 50) { var p = rng.pick(pool); if (out.indexOf(p) < 0) out.push(p); }
    return out;
  };
  G.applyCard = function (g, id) { g.cards.push(id); };

  G.xpNeed = function (lvl) { return 45 + lvl * 32; };
  // Đấu trường nhỏ không dạy được gì thêm cho kẻ đã quá giỏi: kinh nghiệm giảm dần khi cấp chạm trần của hạng.
  G.xpTierMul = function (lvl, tier) {
    var cap = G.TIERS[tier].cap; if (cap == null || lvl < cap) return 1;
    return Math.max(0.08, Math.pow(0.5, lvl - cap + 1));
  };
  G.MAX_LVL = 15;
  G.addXp = function (g, xp) {
    if (g.lvl >= G.MAX_LVL) return 0;
    g.xp += xp; var ups = 0;
    while (g.lvl < G.MAX_LVL && g.xp >= G.xpNeed(g.lvl)) { g.xp -= G.xpNeed(g.lvl); g.lvl++; g.pending = (g.pending || 0) + 1; ups++; }
    return ups;
  };

  // ---------------------------------------------------------------- Chỉ số
  var MOD_KEYS = ['str', 'agi', 'vit', 'hpMul', 'dmgMul', 'aspd', 'moveMul', 'dodge', 'crit', 'appeal', 'cap', 'armorAll',
    'upkeepMul', 'xpMul', 'antiBlock', 'deflect', 'netRes', 'steady', 'missileBlock', 'injuryMul', 'moraleFight', 'resist'];
  function addMods(m, src) { if (!src) return; for (var i = 0; i < MOD_KEYS.length; i++) { var k = MOD_KEYS[i]; if (src[k]) m[k] += src[k]; } }

  // ---------------------------------------------------------------- Món đồ cụ thể: độ hiếm, phụ tố, hiệu ứng
  function fitsCat(on, it) { var cat = it.slot === 'weapon' ? 'weapon' : (it.slot === 'shield' ? 'shield' : (it.slot === 'trinket' ? 'trinket' : 'armor')); return on.indexOf(cat) >= 0 || on.indexOf(it.slot) >= 0; }
  var SLOT_AFFIX = { body: 'hardy', head: 'steadfast', arms: 'nimble', legs: 'spry' };
  // Gieo một món cho cửa hàng ở hạng đấu trường tier (0..3). Trả về {id, r, aff, fx, ep}.
  G.rollItem = function (rng, id, tier, forceR) {
    var it = G.ITEMS[id], r = forceR != null ? forceR : rng.weighted(G.RAR_ODDS[Math.max(0, Math.min(3, tier))]), R = G.RAR[r], o = { id: id, r: r };
    if (r > 0) {
      var pool = Object.keys(G.AFFIX).filter(function (k) { return fitsCat(G.AFFIX[k].on, it); });
      rng.shuffle(pool);
      var own = SLOT_AFFIX[it.slot];
      if (own) { pool.splice(pool.indexOf(own), 1); pool.unshift(own); }   // mũ luôn có kháng hiệu ứng, găng có tốc đánh, giày có tốc chạy, giáp thân có máu
      o.aff = pool.slice(0, R.aff);
      if (R.fx) { var fp = Object.keys(G.EFFECT).filter(function (k) { return G.EFFECT[k].on.indexOf(it.slot) >= 0; }); if (fp.length) o.fx = rng.pick(fp); }
      if (r === 4) o.ep = rng.int(0, G.LEGEND.length - 1);
    }
    return o;
  };
  G.instName = function (inst) { var it = G.itemOf(inst); return it ? it.name + (inst && inst.r === 4 && inst.ep != null ? ' ' + G.LEGEND[inst.ep] : '') : ''; };
  G.instPrice = function (inst) { var it = G.ITEMS[inst.id]; return Math.round(it.price * G.RAR[inst.r || 0].price); };
  // Số liệu thật của một món sau độ hiếm và phụ tố (để hiển thị)
  G.instInfo = function (inst) {
    var it = G.itemOf(inst), R = G.RAR[(inst && inst.r) || 0], o = { dmg: it.dmg, armor: it.armor || 0, wt: it.wt || 0, block: it.block || 0 }, armMul = R.arm, wtMul = R.wt, wd = 1, list = [];
    if (inst && inst.aff) inst.aff.forEach(function (a) { if (G.AFFIX[a]) list.push(G.AFFIX[a]); });
    if (inst && inst.fx && G.EFFECT[inst.fx]) list.push(G.EFFECT[inst.fx]);
    list.forEach(function (a) { if (a.armMul) armMul += a.armMul; if (a.wtMul) wtMul += a.wtMul; if (a.block) o.block += a.block; if (a.wdmg) wd += a.wdmg; });
    if (it.dmg) o.dmg = it.dmg * R.dmg * wd;
    o.armor *= armMul; o.wt *= wtMul; if (it.block) o.block += R.blk;
    return o;
  };

  G.itemOf = function (inst) { return inst ? (inst.id === 'fist' ? FIST : G.ITEMS[inst.id]) : null; };
  G.weaponOf = function (g) { return g.gear.weapon ? G.ITEMS[g.gear.weapon.id] : FIST; };
  G.has = function (g, card) { return g.cards.indexOf(card) >= 0; };
  G.hasTrait = function (g, t) { return g.traits.indexOf(t) >= 0; };

  G.calcStats = function (g) {
    var B = G.BODY[g.body], x = g.x || {};
    var m = {}, i, k;
    for (i = 0; i < MOD_KEYS.length; i++) m[MOD_KEYS[i]] = 0;
    for (i = 0; i < g.traits.length; i++) addMods(m, G.TRAITS[g.traits[i]]);
    for (i = 0; i < g.cards.length; i++) addMods(m, G.CARDS[g.cards[i]]);
    for (i = 0; i < g.injuries.length; i++) addMods(m, G.INJURIES[g.injuries[i].id]);
    var w = G.weaponOf(g), K = G.WKIND[w.kind];
    var armor = { head: 0, body: 0, arms: 0, legs: 0 }, weight = 0, block = 0;
    // đặc tính (perk): từ thẻ lên cấp, từ món đồ, từ hiệu ứng đặc biệt của đồ hiếm
    var perks = {}, wdmg = 1, wreach = 0, wpen = 0, wspd = 1, spcd = 1, deathMul = 1, j;
    for (i = 0; i < g.cards.length; i++) perks[g.cards[i]] = 1;
    var fitted = !!perks.fitted;
    for (i = 0; i < G.SLOTS.length; i++) {
      var s = G.SLOTS[i], inst = g.gear[s], it = G.itemOf(inst);
      if (!it) continue;
      // khiên vô dụng nếu vũ khí cần hai tay
      if (s === 'shield' && K.hands === 2) continue;
      var R = G.RAR[inst.r || 0], armMul = R.arm, wtMul = R.wt, blk = R.blk, fxs = [];
      addMods(m, it);
      if (it.perk) perks[it.perk] = 1;
      if (it.deathMul) deathMul *= it.deathMul;
      if (inst.aff) for (j = 0; j < inst.aff.length; j++) if (G.AFFIX[inst.aff[j]]) fxs.push(G.AFFIX[inst.aff[j]]);
      if (inst.fx && G.EFFECT[inst.fx]) fxs.push(G.EFFECT[inst.fx]);
      for (j = 0; j < fxs.length; j++) {
        var af = fxs[j];
        addMods(m, af);
        if (af.armMul) armMul += af.armMul; if (af.wtMul) wtMul += af.wtMul; if (af.block) blk += af.block;
        if (af.wdmg) wdmg += af.wdmg; if (af.reach) wreach += af.reach; if (af.pen) wpen += af.pen;
        if (af.spCd) spcd *= af.spCd; if (af.perk) perks[af.perk] = 1; if (af.deathMul) deathMul *= af.deathMul;
      }
      if (s === 'weapon') { wdmg *= R.dmg; wreach += it.reach || 0; wpen += it.pen || 0; wspd = it.spd || 1; }
      var wt = (it.wt || 0) * wtMul;
      if (fitted && s !== 'weapon' && s !== 'trinket') wt *= 0.8;
      weight += wt;
      if (armor[s] != null) armor[s] += (it.armor || 0) * armMul;
      if (s === 'shield') block = (it.block || 0) + blk;
    }
    if (wdmg !== 1) { var w0 = w; w = {}; for (k in w0) w[k] = w0[k]; w.dmg = w0.dmg * wdmg; }
    if (g.talent === 'giant') { m.cap += 12; m.hpMul += 0.2; m.dodge -= 0.10; }
    if (g.talent === 'idol') m.appeal += 4;
    if (g.talent === 'twinborn' && K.hands === 2) m.aspd += 0.15;
    var str = g.str + m.str, agi = g.agi + m.agi, vit = g.vit + m.vit;
    var cap = 2 + str * 2.5 + vit * 2 + B.cap + m.cap + (x.capAdd || 0);   // người khỏe và dai sức mới gánh nổi giáp nặng
    var load = Math.min(1.3, weight / Math.max(1, cap));
    for (k in armor) armor[k] += m.armorAll;
    var mor = g.morale >= 80 ? 1.06 : (g.morale <= 30 ? 0.9 : 1);
    var st = {
      str: str, agi: agi, vit: vit, cap: cap, weight: weight, load: load,
      hp: Math.round((70 + vit * 14 + g.lvl * 8) * (1 + m.hpMul) * (x.hpMul || 1)),
      dmgMul: (1 + (str - 5) * 0.07) * (1 + m.dmgMul) * mor * (x.dmgMul || 1) * (g.talent === 'venator' && (w.kind === 'javelin' || w.kind === 'hasta') ? 1.25 : 1) * (perks.heavy && (w.kind === 'axe' || w.kind === 'trident') ? 1.18 : 1),
      aspd: Math.max(0.4, (1 + (agi - 5) * 0.05 + m.aspd) * (1 - 0.22 * Math.min(1, load))),
      move: (2.6 + agi * 0.13) * (1 + m.moveMul) * (1 - 0.4 * Math.min(1, load)) * (x.moveMul || 1),
      dodge: Math.max(0, Math.min(0.45, (agi * 0.02) * (1 - 0.65 * Math.min(1, load)) + m.dodge)),
      block: block > 0 ? block + (perks.wall ? 0.12 : 0) : 0,
      deflect: m.deflect, missileBlock: m.missileBlock, antiBlock: m.antiBlock,
      crit: Math.max(0, 0.05 + m.crit + (w.kind === 'gladius' ? 0.15 : 0)),
      armor: armor, netRes: Math.min(0.9, m.netRes), steady: Math.min(0.9, m.steady), resist: Math.max(0, Math.min(0.8, m.resist)),
      appeal: Math.max(0, 1 + m.appeal + Math.min(3, Math.floor((g.wins || 0) / 10))),
      upkeepMul: Math.max(0.25, 1 + m.upkeepMul), xpMul: 1 + m.xpMul, injuryMul: 1 + m.injuryMul, moraleFight: m.moraleFight,
      hasShield: block > 0, weapon: w, kind: w.kind,
      reach: K.reach + wreach, interval: K.interval * wspd, pen: Math.min(0.95, K.pen + wpen), perks: perks, deathMul: deathMul,
      radius: B.radius * (g.look ? g.look.w : 1),
      spCdMul: (perks.drilled ? 0.65 : 1) * spcd * (g.talent === 'veteran' ? 0.75 : 1) * (x.spCd || 1),
      boss: !!g.boss, enrage: !!x.enrage,
      wall: !!x.wall,          // khiên che cả hai sườn (chỉ hở sau lưng)
      crush: x.crush || 0      // phần lực vẫn xuyên qua khi bị khiên chặn
    };
    st.armorAvg = armor.head * 0.15 + armor.body * 0.45 + armor.arms * 0.18 + armor.legs * 0.22;
    return st;
  };

  // Sau khi thêm món này, có vượt sức mang không?
  G.canCarry = function (g, item, inst) {
    var old = g.gear[item.slot];
    g.gear[item.slot] = inst || { id: item.id };
    var st = G.calcStats(g);
    if (old) g.gear[item.slot] = old; else delete g.gear[item.slot];
    return st.weight <= st.cap + 1e-6;
  };

  // Ước lượng sức mạnh một đấu sĩ (cho AI mua sắm của bot và độ khó trận phụ)
  G.power = function (g) {
    var st = G.calcStats(g), K = G.WKIND[st.kind];
    // giáp điển hình của địch thủ ngang cấp: đòn nhỏ nhiều nhát bị giáp ăn nhiều hơn
    var A = Math.max(0, 0.55 * g.lvl - 0.4) * (1 - st.pen), d = st.weapon.dmg * st.dmgMul;
    var eff = A > 0 ? d * d / (d + A) : d;
    var dps = eff * (st.kind === 'twin' ? 2 : 1) / (st.interval / st.aspd) * (1 + st.crit * 0.6) * (K.ranged ? 1.12 : (K.reach > 2 ? 1.08 : 1));
    var ehp = st.hp * (1 + st.armorAvg * 0.07) / Math.max(0.4, (1 - st.dodge) * (1 - st.block * 0.8));
    return Math.sqrt(dps * ehp);
  };

  // ---------------------------------------------------------------- Giá cả
  G.gladValue = function (g) {
    var v = 26 + (g.str + g.agi + g.vit - 15) * 6 + (g.lvl - 1) * 24 + (g.lvl - 1) * (g.lvl - 1) * 4;
    for (var i = 0; i < g.traits.length; i++) v += G.TRAITS[g.traits[i]].good ? 9 : -8;
    if (g.talent) v = v * 1.35 + 45;
    for (i = 0; i < g.injuries.length; i++) v *= g.injuries[i].perm ? 0.75 : 0.9;
    return Math.max(8, Math.round(v));
  };
  G.upkeepOf = function (g, tier, relics) {
    var st = G.calcStats(g);
    var u = (1.5 + g.lvl * 0.5) * G.TIERS[tier].upkeepMul * st.upkeepMul;
    if (relics && relics.indexOf('granary') >= 0) u *= 0.75;
    return Math.max(1, Math.round(u));
  };

})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));

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
  G.genLook = function (rng, originId) { return genLook(rng, originId); };
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

  // Nét tính cách (như bản Unity): ít nhất 1 tốt và 1 xấu, nhiều nhất 3 mỗi loại, hai số chênh nhau không quá 1;
  // hai nét trái ngược nhau không bao giờ đi cùng.
  var TRAIT_PAIRS = [[1, 1, 40], [2, 1, 15], [1, 2, 15], [2, 2, 18], [3, 2, 4], [2, 3, 4], [3, 3, 4]];
  G.TRAIT_OPP = { tough: 'sickly', quick: 'slowhand', keen: 'poorsight', darling: 'plain', loyal: 'runaway', frugal: 'glutton', healer: 'brittle', learner: 'lazy', brave: 'coward',
    fleetfoot: 'slow', supple: 'weakling', thickskin: 'thinskin', steadyhead: 'jumpy', stamina: 'winded', chief: 'unruly', shieldhand: 'clumsy', hardy: 'drunk', lefty: 'rash', bloodthirst: 'proud', broad: 'sullen' };
  G.traitsClash = function (a, b) { return G.TRAIT_OPP[a] === b || G.TRAIT_OPP[b] === a; };
  G.rollTraits = function (rng, g) {
    var pr = TRAIT_PAIRS[rng.weighted(TRAIT_PAIRS.map(function (p) { return p[2]; }))], want = [pr[0], pr[1]], keys = Object.keys(G.TRAITS);
    g.traits = [];
    for (var good = 1; good >= 0; good--) {
      var pool = keys.filter(function (k) { return (G.TRAITS[k].good ? 1 : 0) === good; }), n = want[good ? 0 : 1], guard = 0;
      while (n > 0 && guard++ < 200) {
        var k = rng.pick(pool);
        if (g.traits.indexOf(k) >= 0 || g.traits.some(function (t) { return G.traitsClash(t, k); })) continue;
        g.traits.push(k); n--;
      }
    }
    return g.traits;
  };

  // Bốn chỉ số (như bản Unity): giá trị cấp 1 của thân Cân đối và mức tăng mỗi cấp
  G.STAT0 = { str: 4.5, agi: 4.5, hp: 110, sta: 90 };   // nô lệ trung bình: 9 điểm chia đôi cho Sức mạnh và Nhanh nhẹn
  G.STAT_SUM = [6, 12];                                  // tổng Sức mạnh + Nhanh nhẹn lúc sinh
  G.STAT_SPLIT = { big: 0.64, bal: 0.5, agi: 0.36 };     // phần của Sức mạnh trong tổng đó, theo thể hình
  G.STAT_LV = { str: 1, agi: 0.5, hp: 6, sta: 8 };
  // mang nặng (tổng trọng lượng ÷ Thể lực) làm mất Nhanh nhẹn theo bậc
  // Chỉ số cộng thẳng: MỖI điểm (tính từ 0) cho một lượng cố định, không còn mốc 10.
  //   Sức mạnh:   +str sát thương mỗi điểm
  //   Nhanh nhẹn: +aspd tốc độ đánh, +dodge né, +move tốc chạy mỗi điểm
  // Các mẫu số (1 + k × chỉ số chuẩn) giữ cho nô lệ trung bình (4,5 / 4,5) đánh và chạy đúng mức gốc của vũ khí.
  G.STATK = { str: 0.05, aspd: 0.04, dodge: 0.015, move: 0.015 };
  G.LOAD_AGI = [[0.9, 10], [0.8, 8], [0.65, 6], [0.5, 4], [0.35, 2], [0.2, 1]];
  G.loadAgiLoss = function (load) { for (var i = 0; i < G.LOAD_AGI.length; i++) if (load >= G.LOAD_AGI[i][0]) return G.LOAD_AGI[i][1]; return 0; };

  // opts: {tier, talent(bool|id), lvl, quality}
  G.makeGladiator = function (rng, opts) {
    opts = opts || {};
    var tier = opts.tier || 0;
    var originId = rng.pick(Object.keys(G.ORIGINS));
    var o = G.ORIGINS[originId];
    var body = ['big', 'bal', 'agi'][rng.weighted(o.body)];
    var B = G.BODY[body];
    var q = opts.quality != null ? opts.quality : rng.range(-1.2, 1.2) + tier * 0.25;
    // chỉ số lúc sinh (cấp 1): tổng 6–12 điểm chia cho Sức mạnh và Nhanh nhẹn (người tốt thì tổng cao; thể hình quyết định nghiêng về bên nào); Máu 110, Thể lực 90 (−10%…+15%)
    var sum = Math.max(G.STAT_SUM[0], Math.min(G.STAT_SUM[1], Math.round(8.7 + q * 1.8 + rng.range(-1.2, 1.2))));
    var s0 = Math.max(1, Math.min(sum - 1, Math.round(sum * (G.STAT_SPLIT[body] + rng.range(-0.1, 0.1)))));
    function big(base, mul) { return Math.round(base * mul * rng.range(0.9, 1.15) * (1 + q * 0.04)); }
    var g = {
      id: G.newUid(rng), name: rng.pick(o.names), origin: originId, body: body,
      lvl: 1, xp: 0, str: s0, agi: sum - s0, hp: big(G.STAT0.hp, B.hp), sta: big(G.STAT0.sta, B.sta),
      traits: [], talent: null, cards: [], morale: rng.int(50, 70), fame: 0, wins: 0, kills: 0, fights: 0,
      injuries: [], gear: {}, look: genLook(rng, originId), pending: 0, cardSeed: Math.floor(rng.next() * 1e9)
    };
    G.rollTraits(rng, g);
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
  // mul: { foe: [máu, sát thương], boss: [máu, sát thương] } — hệ số của hạng đấu trường cho trận chính
  G.makeFoe = function (def, idx, seed, mul) {
    var rng = new Rng(G.hashStr(def.name) + idx * 977 + (seed || 0));
    var B = G.BODY[def.body];
    var x = def.x || {};
    if (mul) { var mm = x.boss ? mul.boss : mul.foe; if (mm && (mm[0] !== 1 || mm[1] !== 1)) { var x2 = {}; for (var xk in x) x2[xk] = x[xk]; x2.hpMul = (x.hpMul || 1) * mm[0]; x2.dmgMul = (x.dmgMul || 1) * mm[1]; x = x2; } if (x.summon && !x.summonMul) { var x3 = {}; for (xk in x) x3[xk] = x[xk]; x3.summonMul = { foe: mul.foe, boss: mul.foe }; x = x3; } }
    var originId = x.origin || rng.pick(Object.keys(G.ORIGINS));
    var g = {
      id: 'foe' + idx, foe: true, name: def.name, origin: originId, body: def.body, lvl: def.lvl, xp: 0,
      str: G.STAT0.str + B.str, agi: G.STAT0.agi + B.agi, hp: Math.round(G.STAT0.hp * B.hp), sta: Math.round(G.STAT0.sta * B.sta),
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
  // Thẻ chỉ có tác dụng với đồ nhất định: trả về lý do nếu với đồ đang mang thì thẻ chưa làm gì, ngược lại null.
  G.cardIdle = function (g, k) {
    if (k === 'wall' && !(g.gear && g.gear.shield)) return 'Chưa mang khiên: thẻ này chưa có tác dụng.';
    if (k === 'heavy') {
      var wk = G.weaponOf(g).kind;
      if (wk !== 'axe' && wk !== 'trident') return (wk === 'fist' ? 'Đang tay không' : 'Đang cầm ' + G.WKIND[wk].name) + ': thẻ này chưa có tác dụng.';
    }
    return null;
  };
  G.cardOptions = function (g, rng) {
    var pool = [], k;
    for (k in G.CARDS) {
      var c = G.CARDS[k];
      if (c.uniq && g.cards.indexOf(k) >= 0) continue;
      // thẻ vô dụng với đồ đang mang thì ít khi được mời (vẫn có thể ra, vì sau này có thể đổi đồ)
      if ((k === 'wall' || k === 'heavy') && G.cardIdle(g, k)) { if (rng.chance(0.6)) continue; }
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
  var MOD_KEYS = ['str', 'agi', 'hp', 'sta', 'hpMul', 'dmgMul', 'aspd', 'moveMul', 'dodge', 'crit', 'appeal', 'cap', 'armorAll',
    'upkeepMul', 'xpMul', 'antiBlock', 'deflect', 'netRes', 'steady', 'missileBlock', 'injuryMul', 'moraleFight', 'resist'];
  function addMods(m, src) { if (!src) return; for (var i = 0; i < MOD_KEYS.length; i++) { var k = MOD_KEYS[i]; if (src[k]) m[k] += src[k]; } }

  // ---------------------------------------------------------------- Món đồ cụ thể: độ hiếm, phụ tố, hiệu ứng
  function fitsCat(on, it) { var cat = it.slot === 'weapon' ? 'weapon' : (it.slot === 'shield' ? 'shield' : (it.slot === 'trinket' ? 'trinket' : 'armor')); return on.indexOf(cat) >= 0 || on.indexOf(it.slot) >= 0; }
  var SLOT_AFFIX = { body: 'hardy', head: 'steadfast', arms: 'nimble', legs: 'spry' };
  // Gieo một món cho cửa hàng ở hạng đấu trường tier (0..3). Trả về {id, r, aff, fx, ep}.
  G.rollItem = function (rng, id, tier, forceR) {
    var it = G.ITEMS[id], r = forceR != null ? forceR : G.rollRar(rng, tier), R = G.RAR[r], o = { id: id, r: r };
    o.q = Math.round(rng.range(R.qLo, R.qHi) * 1000) / 1000;   // chất lượng trong khoảng của độ hiếm (±10%)
    o.m = rng.int(0, 2);                                         // một trong 3 kiểu dáng của độ hiếm
    if (r > 0) {
      var pool = Object.keys(G.AFFIX).filter(function (k) { return fitsCat(G.AFFIX[k].on, it); });
      rng.shuffle(pool);
      var own = SLOT_AFFIX[it.slot];
      if (own) { pool.splice(pool.indexOf(own), 1); pool.unshift(own); }   // mũ luôn có kháng hiệu ứng, găng có tốc đánh, giày có tốc chạy, giáp thân có máu
      o.aff = pool.slice(0, R.aff);
      if (R.fx) {
        var fp = Object.keys(G.EFFECT).filter(function (k) { return !G.EFFECT[k].minR && G.EFFECT[k].on.indexOf(it.slot) >= 0; }); if (fp.length) o.fx = rng.pick(fp);
        // Thần khí: chùy luôn mang Đập sọ, song đao luôn mang Hút máu
        for (var sk in G.EFFECT) if (G.EFFECT[sk].minR && r >= G.EFFECT[sk].minR && G.EFFECT[sk].only === it.kind) o.fx = sk;
      }
      if (r >= 4) o.ep = rng.int(0, G.LEGEND.length - 1);
    }
    return o;
  };
  // kiểu cao nhất mà loại món này có (phụ kiện bậc IV chỉ có một món…)
  var _mk = null;
  G.maxKind = function (it) { if (!_mk) { _mk = {}; for (var k in G.ITEMS) { var i2 = G.ITEMS[k], c = i2.slot === 'weapon' ? 'w' : i2.slot; _mk[c] = Math.max(_mk[c] || 0, i2.tier); } } return _mk[it.slot === 'weapon' ? 'w' : it.slot] || 4; };
  G.rollRar = function (rng, tier) { return rng.weighted(G.RAR_ODDS[Math.max(0, Math.min(G.RAR_ODDS.length - 1, tier))]); };
  // chất lượng của một món: q đã gieo, hoặc giữa khoảng của độ hiếm
  G.instQ = function (inst) { return inst && inst.q ? inst.q : G.RAR[(inst && inst.r) || 0].dmg; };
  G.instName = function (inst) { var it = G.itemOf(inst); return it ? it.name + (inst && inst.r >= 4 && inst.ep != null ? ' ' + G.LEGEND[inst.ep] : '') : ''; };
  // giá: hệ số độ hiếm, chất lượng cao trong khoảng đắt hơn tới ±10%
  G.instPrice = function (inst) {
    var it = G.ITEMS[inst.id], R = G.RAR[inst.r || 0], span = R.qHi - R.qLo, sh = span > 0 && inst.q ? ((inst.q - R.qLo) / span - 0.5) * 0.2 : 0;
    return Math.round(it.price * R.price * (1 + sh));
  };
  // Số liệu thật của một món sau độ hiếm và phụ tố (để hiển thị)
  G.instInfo = function (inst) {
    var it = G.itemOf(inst), R = G.RAR[(inst && inst.r) || 0], Q = G.instQ(inst), o = { dmg: it.dmg, armor: it.armor || 0, wt: it.wt || 0, block: it.block || 0 }, armMul = Q, wtMul = R.wt, wd = 1, list = [];
    if (inst && inst.aff) inst.aff.forEach(function (a) { if (G.AFFIX[a]) list.push(G.AFFIX[a]); });
    if (inst && inst.fx && G.EFFECT[inst.fx]) list.push(G.EFFECT[inst.fx]);
    list.forEach(function (a) { if (a.armMul) armMul += a.armMul; if (a.wtMul) wtMul += a.wtMul; if (a.block) o.block += a.block; if (a.wdmg) wd += a.wdmg; });
    if (it.dmg) o.dmg = it.dmg * Q * wd;
    o.armor *= armMul; o.wt = o.wt > 0 ? o.wt * wtMul + R.wtAdd : 0; if (it.block) o.block += R.blk;
    return o;
  };

  G.itemOf = function (inst) { return inst ? (inst.id === 'fist' ? FIST : G.ITEMS[inst.id]) : null; };
  G.weaponOf = function (g) { if (g.x && g.x.beast) return G.BEAST_W[g.x.beast]; return g.gear.weapon ? G.ITEMS[g.gear.weapon.id] : FIST; };
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
      var R = G.RAR[inst.r || 0], Q = G.instQ(inst), armMul = Q, wtMul = R.wt, blk = R.blk, fxs = [];
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
      if (s === 'weapon') { wdmg *= Q; wreach += it.reach || 0; wpen += it.pen || 0; wspd = it.spd || 1; }
      var wt = it.wt ? it.wt * wtMul + R.wtAdd : 0;   // càng hiếm càng nặng
      if (fitted && s !== 'weapon' && s !== 'trinket') wt *= 0.8;
      weight += wt;
      if (armor[s] != null) armor[s] += (it.armor || 0) * armMul;
      if (s === 'shield') block = (it.block || 0) + blk;
    }
    if (wdmg !== 1) { var w0 = w; w = {}; for (k in w0) w[k] = w0[k]; w.dmg = w0.dmg * wdmg; }
    if (g.talent === 'giant') { m.sta += 36; m.hpMul += 0.2; m.dodge -= 0.10; }
    if (g.talent === 'idol') m.appeal += 4;
    if (g.talent === 'twinborn' && K.hands === 2) m.aspd += 0.15;
    if (g.talent === 'twohand' && K.hands === 2 && !K.beast) m.dmgMul += 0.15;   // mọi món cầm hai tay, kể cả cung, nỏ và găng (như bản Unity)
    if (g.talent === 'fistmaster' && (w.kind === 'caestus' || w.kind === 'fist')) { m.dmgMul += 0.15; m.dodge += 0.05; }
    var shIt = g.gear.shield && K.hands !== 2 ? G.itemOf(g.gear.shield) : null, shM = shIt ? shIt.look.m : null, bigShield = !!(shIt && shIt.cls === 'big'), smallShield = !!(shIt && shIt.cls === 'small');
    if (g.talent === 'parry' && shM && !bigShield) block += 0.08;
    if (g.talent === 'phalanx' && bigShield) block += 0.05;
    if (g.talent === 'slippery') { m.netRes += 1; perks.unslowed = 1; }
    var loadA = g.talent === 'strongman' ? 0 : 1;   // lực sĩ: nặng không làm chậm tay, không làm khó né
    var lv = g.lvl - 1, L = G.STAT_LV;
    var str = g.str + lv * L.str + m.str, agiRaw = g.agi + lv * L.agi + m.agi, hpBase = g.hp + lv * L.hp + m.hp;
    var sta = (g.sta + lv * L.sta + m.sta + (x.capAdd || 0)) * (G.hasTrait(g, 'supple') ? 1.15 : (G.hasTrait(g, 'weakling') ? 0.85 : 1));
    if (G.hasTrait(g, 'broad')) weight *= 0.85;
    if (g.foe) sta = Math.max(sta, weight / (g.boss ? 0.19 : 0.5));   // kẻ địch đủ Thể lực cho bộ đồ được thiết kế (trùm không bị chậm)
    var armK = G.hasTrait(g, 'thickskin') ? 1.15 : (G.hasTrait(g, 'thinskin') ? 0.85 : 1);
    if (armK !== 1) for (k in armor) armor[k] *= armK;
    if (block > 0 && G.hasTrait(g, 'shieldhand')) block += 0.06;
    var cap = sta;   // Thể lực = sức mang
    var load = Math.min(1.3, weight / Math.max(1, cap));
    var agi = agiRaw - (loadA ? G.loadAgiLoss(load) : 0);   // mang nặng: mất Nhanh nhẹn
    for (k in armor) armor[k] += m.armorAll;
    var mor = g.morale >= 80 ? 1.06 : (g.morale <= 30 ? 0.9 : 1);
    var st = {
      str: str, agi: agi, agiRaw: agiRaw, sta: sta, cap: cap, weight: weight, load: load,
      hp: Math.round(hpBase * (1 + m.hpMul) * (x.hpMul || 1)),
      dmgMul: (1 + G.STATK.str * str) / (1 + G.STATK.str * G.STAT0.str) * (1 + m.dmgMul) * mor * (x.dmgMul || 1) * (g.talent === 'venator' && (w.kind === 'javelin' || w.kind === 'hasta') ? 1.15 : 1) * (perks.heavy && (w.kind === 'axe' || w.kind === 'trident') ? 1.18 : 1),
      aspd: Math.max(0.5, (1 + G.STATK.aspd * Math.max(0, agi)) / (1 + G.STATK.aspd * G.STAT0.agi) + m.aspd),
      move: 3.3 * (1 + G.STATK.move * Math.max(0, agi)) / (1 + G.STATK.move * G.STAT0.agi) * (1 + m.moveMul) * (1 - 0.4 * Math.max(0, Math.min(1, (load - 0.25) / 0.75))) * (x.moveMul || 1),
      dodge: Math.max(0, Math.min(0.30, G.STATK.dodge * Math.max(0, agi) + m.dodge)),
      block: block > 0 ? block + (perks.wall ? 0.12 : 0) : 0,
      deflect: m.deflect, missileBlock: m.missileBlock, antiBlock: m.antiBlock,
      crit: Math.max(0, 0.05 + m.crit + (w.kind === 'gladius' ? 0.15 : 0)),
      armor: armor, netRes: Math.min(0.9, m.netRes), steady: Math.min(0.9, m.steady), resist: Math.max(0, Math.min(0.8, m.resist)),
      appeal: Math.max(0, 1 + m.appeal + Math.min(3, Math.floor((g.wins || 0) / 10))),
      upkeepMul: Math.max(0.25, 1 + m.upkeepMul), xpMul: 1 + m.xpMul, injuryMul: 1 + m.injuryMul, moraleFight: m.moraleFight,
      hasShield: block > 0, parry: smallShield && block > 0, weapon: w, kind: w.kind,   // khiên nhỏ: đỡ gạt
      reach: K.reach + wreach, interval: K.interval * wspd, pen: Math.min(0.95, K.pen + wpen), perks: perks, deathMul: deathMul * (G.hasTrait(g, 'hardy') ? 0.5 : 1),
      radius: B.radius * (g.look ? g.look.w : 1),
      spCdMul: (perks.drilled ? 0.65 : 1) * spcd * (g.talent === 'veteran' ? 0.75 : 1) * (x.spCd || 1),
      boss: !!g.boss, enrage: !!x.enrage,
      wall: !!x.wall || (g.talent === 'phalanx' && bigShield),
      ccMul: (G.hasTrait(g, 'steadyhead') ? 0.75 : (G.hasTrait(g, 'jumpy') ? 1.25 : 1)) * (1 - (x.ccRes || 0)), ccRes: x.ccRes || 0,   // thời gian choáng / lưới / chậm          // khiên che cả hai sườn (chỉ hở sau lưng)
      crush: x.crush || 0      // phần lực vẫn xuyên qua khi bị khiên chặn
    };
    // Kỵ binh: ngựa chạy nhanh gấp đôi, thân to khó né, khó bị đẩy lùi, chở được giáp nặng.
    if (x.mount) { st.cap += 120; st.load = Math.min(1.3, weight / Math.max(1, st.cap)); st.move = 3.3 * (1 + G.STATK.move * Math.max(0, agiRaw)) / (1 + G.STATK.move * G.STAT0.agi) * (1 + m.moveMul) * (x.moveMul || 1); }   // con thú gánh giáp, người không bị chậm vì nặng
    if (x.mount === 'elephant') {   // voi chiến: chậm hơn ngựa, to như bức tường, giẫm nát mọi thứ trên đường
      st.move *= 1.0; st.radius = 1.05; st.dodge = 0; st.hp = Math.round(st.hp * 2.6); st.steady = 0.92; st.resist = Math.max(st.resist, 0.4); st.mounted = 'elephant';
    } else if (x.mount) {
      st.move *= 1.75; st.radius = 0.62; st.dodge = Math.max(0, st.dodge * 0.4);
      st.hp = Math.round(st.hp * 1.3); st.steady = Math.max(st.steady, 0.6); st.mounted = x.mount;
    }
    // Thú: không mặc giáp mà có da lông; gấu to và lì, chó nhỏ và nhanh.
    if (x.beast) {
      var A0 = x.armor || 0; for (k in armor) armor[k] = A0;
      st.beast = x.beast; st.hasShield = false; st.block = 0; st.load = 0;
      if (x.beast === 'bear') { st.radius = 0.62 * (x.scale || 1); st.reach += st.radius - 0.62; st.steady = Math.max(st.steady, 0.7 + Math.min(0.25, (x.scale || 1) * 0.05)); st.resist = Math.max(st.resist, 0.3); st.dodge = 0; st.move = 3.1 * (x.moveMul || 1) * (x.scale > 2 ? 1.15 : 1); st.crush = Math.max(st.crush, 0.5); }
      else if (x.beast === 'dog') { st.radius = 0.3; st.move = 4.6 * (x.moveMul || 1); st.dodge = Math.min(0.45, st.dodge + 0.1); }
      else if (x.beast === 'lion') { st.radius = 0.46 * (x.scale || 1); st.move = 5.0 * (x.moveMul || 1); st.dodge = Math.min(0.45, st.dodge + 0.08); st.steady = Math.max(st.steady, 0.4); st.resist = Math.max(st.resist, 0.15); }
    }
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
  // Định giá đấu sĩ = giá trị chiến đấu + giá trị kinh tế, rồi trừ thương tật.
  //  • Chiến đấu: mọi thứ quy về ĐCT (điểm chỉ số tương đương: 1 ĐCT = sức của +1 điểm chỉ số trung bình),
  //    đo bằng mô phỏng ghép cặp (tools/value.js). Tổng ĐCT lệch so với nô lệ chuẩn đổi thành "cấp hiệu dụng",
  //    rồi tra bảng giá theo cấp — nên một điểm chỉ số ở cấp 9 đắt hơn ở cấp 1, đúng như sức kiếm tiền của nó.
  //  • Kinh tế: vàng hắn làm ra / tốn đi trong thời gian thường được giữ (phí nuôi, sức hút, kinh nghiệm,
  //    chấn thương, cái chết, bỏ trốn), đo từ bot chơi trọn chiến dịch (tools/bot.js).
  G.VAL = {
    STAT: { str: 1.0, agi: 1.0, hp: 3.85, sta: 0.2 },   // ĐCT mỗi điểm Sức mạnh / Nhanh nhẹn, mỗi 30 Máu, mỗi 10 Thể lực
    REF: 0.5,         // ĐCT chỉ số của nô lệ chuẩn (thân cân đối 5,3/5,3/5,3 ≈ 16), chọn để giá trung bình ở chợ giữ gần như cũ
    LVL: 3.8,          // một cấp = chỉ số tăng theo cấp (≈2,4) + một thẻ trung bình (≈1,6) ĐCT; 1 ĐCT = sức của +1 Sức mạnh
    CARD: 1.6,         // ĐCT của thẻ trung bình (thẻ thật được tính theo 'esp' của nó)
    // theo hạng đấu trường (suy từ cấp): số ngày giữ người đã chiết khấu ×0,6, trận/người/ngày,
    // tỉ lệ thắng mà còn đứng (mới được tiền khán giả), vàng khán giả mỗi điểm sức hút, cấp lên/người/ngày,
    // vết thương tạm/người/ngày, thương tật vĩnh viễn/người/ngày, chết/người/ngày, vàng làm ra/người/ngày, số người trong trường
    H: [17, 14, 11, 7], FIGHT: [0.74, 0.77, 0.82, 0.80], ALIVEWIN: [0.66, 0.62, 0.60, 0.51], APPEAL: [2, 3, 4, 4],
    UPS: [0.23, 0.28, 0.29, 0.25], TEMP: [0.068, 0.099, 0.103, 0.132], TEMP_DAYS: 4.2, PERM: [0.010, 0.011, 0.016, 0.016],
    DEATH: [0.0076, 0.0105, 0.0107, 0.0118], EARN: [25, 45, 92, 108], ROSTER: [2.9, 3.9, 4.9, 5.8],
    INJ_DAY: 0.15,     // một ngày mang vết thương mất ~15% số vàng một người làm ra (thường có người dự bị thay); A/B 150 chiến dịch không thấy khác biệt lớn hơn
    XP_USE: 0.5,       // nửa số kinh nghiệm thêm bị trần cấp của hạng nuốt mất
    DESERT: { proud: 0.0015, sullen: 0.0005, loyal: -0.0003, runaway: 0.0012, unruly: 0.0008 },
    SPEND: [6, 15, 35, 60],   // vàng tiêu ở lò rèn mỗi ngày (để định giá Lái buôn)   // bỏ trốn thêm/ngày so với người thường
    UPKEEP: [0.75, 1.25, 2.0, 2.7]   // hệ số phí nuôi của bốn mức cấp (cấp 1–2, 3–5, 6–8, 9+)
  };
  G.lvlTier = function (lvl) { return lvl >= 9 ? 3 : lvl >= 6 ? 2 : lvl >= 3 ? 1 : 0; };
  // Bảng giá theo cấp (cấp có thể lẻ). Dưới cấp 1 giảm dần theo hàm mũ (cùng độ dốc tại cấp 1) để kẻ yếu không dồn cả về giá sàn.
  G.lvlPrice = function (L) { var d = L - 1; return d >= 0 ? 26 + 24 * d + 4 * d * d : 26 * Math.exp(d * 24 / 26); };
  G.gladValueParts = function (g) {
    var V = G.VAL, i, t = G.lvlTier(g.lvl), H = V.H[t];
    // --- chiến đấu
    var espStat = (g.str - G.STAT0.str) * V.STAT.str + (g.agi - G.STAT0.agi) * V.STAT.agi + (g.hp - 110) / 30 * V.STAT.hp + (g.sta - 90) / 10 * V.STAT.sta - V.REF;
    var espTrait = 0, espTalent = g.talent ? (G.TALENTS[g.talent].esp || 0) : 0, espCard = 0;
    for (i = 0; i < g.traits.length; i++) espTrait += G.TRAITS[g.traits[i]].esp || 0;
    for (i = 0; i < g.cards.length; i++) espCard += (G.CARDS[g.cards[i]].esp || 0) - V.CARD;
    var esp = espStat + espTrait + espTalent + espCard;
    var effLvl = g.lvl + esp / V.LVL, combat = G.lvlPrice(effLvl), base = G.lvlPrice(g.lvl);
    // --- kinh tế
    var m = { upkeepMul: 0, appeal: 0, xpMul: 0, injuryMul: 0 };
    var src = g.traits.map(function (t) { return G.TRAITS[t]; }).concat(g.cards.map(function (c) { return G.CARDS[c]; }));
    for (i = 0; i < src.length; i++) for (var k in m) if (src[i][k]) m[k] += src[i][k];
    if (g.talent === 'idol') m.appeal += 4;
    var econ = {};
    var upk = (1.5 + g.lvl * 0.5) * V.UPKEEP[t];
    econ.upkeep = -m.upkeepMul * upk * H;
    var units = (1 + m.appeal) * (g.talent === 'idol' ? 2 : 1) - 1;   // điểm sức hút ra tiền thêm so với người thường
    econ.appeal = units * V.APPEAL[t] * V.FIGHT[t] * V.ALIVEWIN[t] * H;
    var deathRatio = Math.max(0.5, 1 - 0.06 * (1 + m.appeal)) / 0.94;   // sức hút làm khán giả tha mạng
    var lvlStep = G.lvlPrice(g.lvl + 1) - base;
    econ.xp = m.xpMul * V.UPS[t] * H * V.XP_USE * lvlStep;
    var injCost = V.TEMP[t] * H * V.TEMP_DAYS * V.INJ_DAY * V.EARN[t];   // giá của vết thương tạm trong cả thời gian giữ
    econ.injury = -m.injuryMul * (injCost + V.PERM[t] * H * 0.25 * combat);
    if (G.hasTrait(g, 'healer')) econ.injury += 0.5 * injCost;
    var deathMul = deathRatio * (g.talent === 'survivor' ? 0.35 : 1) * (G.hasTrait(g, 'hardy') ? 0.5 : 1);   // kẻ sống sót không chết khi đội thắng (≈65% số cái chết)
    econ.death = (1 - deathMul) * V.DEATH[t] * H * combat;
    var desert = 0; for (i = 0; i < g.traits.length; i++) desert += V.DESERT[g.traits[i]] || 0;
    econ.desert = -desert * H * combat;
    var R = V.ROSTER[t];
    if (g.talent === 'medicus') econ.team = R * (0.5 * injCost + 0.3 * V.DEATH[t] * H * base);
    else if (g.talent === 'doctore') econ.team = R * 0.25 * V.UPS[t] * H * V.XP_USE * lvlStep;
    else if (g.talent === 'merchant') econ.team = 0.14 * V.SPEND[t] * H;
    var eco = 0; for (k in econ) eco += econ[k];
    // Khoản lỗ không thể vượt quá giá trị đánh trận: chủ sẽ bán hắn sớm thay vì nuôi lỗ mãi → lỗ bị chặn mềm ở 60% giá chiến đấu.
    if (eco < 0) eco = -0.6 * combat * (1 - Math.exp(eco / (0.6 * combat)));
    // --- thương tật
    var injMul = 1;
    for (i = 0; i < g.injuries.length; i++) injMul *= g.injuries[i].perm ? 0.75 : 0.9;
    var total = Math.max(8, Math.round((combat + eco) * injMul));
    return { esp: esp, espStat: espStat, espTrait: espTrait, espTalent: espTalent, espCard: espCard, effLvl: effLvl, combat: combat, econ: econ, eco: eco, injMul: injMul, total: total };
  };
  G.gladValue = function (g) { return G.gladValueParts(g).total; };
  G.upkeepOf = function (g, tier, relics) {
    var st = G.calcStats(g);
    var u = (1.5 + g.lvl * 0.5) * G.TIERS[tier].upkeepMul * st.upkeepMul;
    if (relics && relics.indexOf('granary') >= 0) u *= 0.75;
    return Math.max(1, Math.round(u));
  };

})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));

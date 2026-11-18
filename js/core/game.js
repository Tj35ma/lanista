// LANISTA — trạng thái chiến dịch: ngày, chợ, mua bán, trận đấu, hậu quả, lưu game. Không đồ họa.
(function (G) {
  'use strict';
  var SAVE_KEY = 'lanista_save_v1';
  var APPEAL_GOLD = [2, 3, 4, 4];

  function Game(state) { this.s = state; this.rng = new G.Rng(state.rs); }
  G.Game = Game;

  Game.create = function (seed) {
    seed = seed || (Date.now() & 0x7fffffff);
    var s = {
      v: 1, seed: seed, rs: seed, day: 1, gold: 100, tier: 0, stage: 0, won: false,
      roster: [], inv: [], relics: [], market: null, side: [], form: {}, fought: false, feasted: false,
      stat: { wins: 0, losses: 0, deaths: 0, deserted: 0, earned: 0, mainLosses: 0 }, news: [], seenIntro: false
    };
    var gm = new Game(s);
    gm.genDay();
    gm.sync();
    return gm;
  };
  Game.load = function () {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      var s = JSON.parse(raw); if (!s || s.v !== 1) return null;
      return new Game(s);
    } catch (e) { return null; }
  };
  Game.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } };
  Game.prototype.sync = function () { this.s.rs = this.rng.s; };
  Game.prototype.save = function () {
    this.sync();
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { }
  };

  Game.prototype.has = function (relic) { return this.s.relics.indexOf(relic) >= 0; };
  Game.prototype.tierDef = function () { return G.TIERS[this.s.tier]; };
  Game.prototype.fieldLimit = function () { return this.tierDef().field; };
  Game.prototype.glad = function (id) { for (var i = 0; i < this.s.roster.length; i++) if (this.s.roster[i].id === id) return this.s.roster[i]; return null; };
  Game.prototype.upkeep = function () { var u = 0; for (var i = 0; i < this.s.roster.length; i++) u += G.upkeepOf(this.s.roster[i], this.s.tier, this.s.relics); return u; };
  Game.MAX_ROSTER = 8;
  Game.MAX_PERM = 2;

  // ---------------------------------------------------------------- Sinh hàng mỗi ngày
  Game.prototype.genDay = function () {
    var s = this.s, rng = this.rng, i;
    // chợ nô lệ
    var n = 3 + (this.has('ledger') ? 1 : 0), slaves = [];
    for (i = 0; i < n; i++) {
      var opts = { tier: s.tier };
      if (i === 0 && this.has('ledger')) opts.lvl = G.TIERS[s.tier].lvl + 1;
      var g = G.makeGladiator(rng, opts);
      slaves.push({ g: g, price: this.slavePrice(g, rng.range(0.92, 1.15)) });
    }
    // cửa cứu sinh: không còn ai và không đủ tiền → một kẻ tự bán mình
    var minP = 1e9; for (i = 0; i < slaves.length; i++) minP = Math.min(minP, slaves[i].price);
    if (s.roster.length === 0 && s.gold < minP) {
      var a = G.makeGladiator(rng, { tier: s.tier, quality: -1, lvl: G.TIERS[s.tier].lvl, talent: false });
      a.traits = ['sullen']; a.name = a.name + ' Kẻ Mắc Nợ'; a.gear.weapon = { id: 'mace' + Math.max(1, s.tier), uid: G.newUid(rng) };
      slaves[0] = { g: a, price: 0, auct: true };
    }
    // cửa hàng
    var shopTier = s.tier + 1, shop = this.genShop(), k;
    // vật của lanista
    var relic = null, rk = [];
    for (k in G.RELICS) if (!this.has(k) && G.RELICS[k].tier <= shopTier) rk.push(k);
    if (rk.length && rng.chance(0.4)) { var id = rng.pick(rk); relic = { id: id, price: G.RELICS[id].price }; }
    s.market = { slaves: slaves, shop: shop, relic: relic };
    // trận phụ
    s.side = [this.genSide(0), this.genSide(1)];
    s.fought = false; s.feasted = false;
  };
  Game.REROLL_COST = 5;
  // Bày hàng cho lò rèn: 4 vũ khí, 4 giáp/khiên, 1 phụ kiện; mỗi món được gieo độ hiếm theo hạng đấu trường.
  Game.prototype.genShop = function () {
    var s = this.s, rng = this.rng, shopTier = s.tier + 1, pool = { weapon: [], armor: [], trinket: [] }, k, shop = [], self = this;
    for (k in G.ITEMS) {
      var it = G.ITEMS[k]; if (it.tier > shopTier) continue;
      var w = it.tier === shopTier ? 5 : (it.tier === shopTier - 1 ? 2 : 0.3);
      var cat = it.slot === 'weapon' ? 'weapon' : (it.slot === 'trinket' ? 'trinket' : 'armor');
      pool[cat].push({ id: k, w: w });
    }
    function draw(cat, cnt) {
      var p = pool[cat].slice();
      for (var j = 0; j < cnt && p.length; j++) {
        var idx = rng.weighted(p.map(function (o) { return o.w; }));
        var id = p[idx].id; p.splice(idx, 1);
        var o = G.rollItem(rng, id, s.tier);
        o.price = self.itemPrice({ price: G.instPrice(o) }, rng.range(0.92, 1.12));
        shop.push(o);
      }
    }
    draw('weapon', 4); draw('armor', 4); draw('trinket', 1);
    return shop;
  };
  // Trả 5 vàng để lò rèn bày một lượt hàng mới (vật của lanista giữ nguyên).
  Game.prototype.reroll = function () {
    var s = this.s;
    if (s.gold < Game.REROLL_COST) return { ok: false, msg: 'Không đủ ' + Game.REROLL_COST + ' vàng.' };
    s.gold -= Game.REROLL_COST; s.market.shop = this.genShop(); s.stat.rerolls = (s.stat.rerolls || 0) + 1;
    this.save(); return { ok: true };
  };
  Game.prototype.slavePrice = function (g, f) { return Math.max(6, Math.round(G.gladValue(g) * (f || 1) * (this.has('scale') ? 0.85 : 1))); };
  Game.prototype.itemPrice = function (it, f) { return Math.max(2, Math.round(it.price * (f || 1) * (this.has('anvil') ? 0.85 : 1))); };

  var W_KINDS = ['caestus', 'gladius', 'sica', 'mace', 'hasta', 'trident', 'twin', 'axe', 'javelin'];
  Game.prototype.genSide = function (hard) {
    var s = this.s, rng = this.rng, T = G.TIERS[s.tier];
    var st = Math.min(6, s.stage);
    var L = T.lvl + st * 0.42 + (hard ? 0.4 : -0.9);
    var n = T.field + (hard ? (rng.chance(0.5) ? 1 : 0) : (rng.chance(0.35) ? -1 : 0));
    n = Math.max(1, n);
    if (!hard) {
      n = Math.min(n, Math.max(1, s.roster.length));   // trận nhẹ không bao giờ đông hơn số người anh có
      // …và không bao giờ trên cơ những người giỏi nhất của anh: một trường vừa mất người vẫn kiếm được bữa ăn
      var lv = s.roster.map(function (g) { return g.lvl; }).sort(function (a, b) { return b - a; }).slice(0, T.field);
      if (lv.length) { var pl = 0; for (var q = 0; q < lv.length; q++) pl += lv[q]; L = Math.min(L, pl / lv.length - 0.4); }
    }
    var foes = [], cells = [];
    for (var c = 0; c < 2; c++) for (var r = 0; r < 5; r++) cells.push([c, r]);
    var gearTier = Math.max(1, s.tier + (hard ? 1 : (rng.chance(0.5) ? 1 : 0)) - (st < 2 && s.tier > 0 ? 1 : 0));
    var nm = G.SIDE_NAMES[rng.int(0, G.SIDE_NAMES.length - 1)];
    var foeName = rng.pick(G.FOE_NAMES);
    for (var i = 0; i < n; i++) {
      var kind = rng.pick(W_KINDS), body = rng.pick(['big', 'bal', 'bal', 'agi']);
      var wt = Math.max(1, gearTier - (rng.chance(0.4) ? 1 : 0));
      var wid = (s.tier === 0 && st < 2 && rng.chance(0.4)) ? null : kind + wt;
      var gear = [], K = wid ? G.WKIND[kind] : G.WKIND.fist;
      var pieces = Math.max(0, Math.round((hard ? 1.2 : 0.4) + s.tier * 0.8 + st * 0.12 + rng.range(-0.8, 0.8)));
      var slots = rng.shuffle(['head', 'body', 'arms', 'legs', 'shield']);
      for (var j = 0; j < slots.length && pieces > 0; j++) {
        if (slots[j] === 'shield' && K.hands === 2) continue;
        var cand = [];
        for (var k in G.ITEMS) { var it = G.ITEMS[k]; if (it.slot === slots[j] && it.tier <= gearTier && it.tier >= gearTier - 1) cand.push(k); }
        if (cand.length) { gear.push(rng.pick(cand)); pieces--; }
      }
      // xếp: tầm xa đứng sau
      var col = (K.ai === 'ranged') ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0);
      var row, tries = 0;
      do { row = rng.int(0, 4); tries++; } while (foes.some(function (f) { return f.c === col && f.r === row; }) && tries < 20);
      foes.push(G.e(foeName, body, Math.max(1, Math.round(L + rng.range(-0.6, 0.6))), wid, gear, col, row, wid ? null : { hpMul: 0.7 }));   // kẻ tay không trong trận phụ: dân thường, mau gục
    }
    var base = T.reward * (1 + 0.08 * st), bored = this.boredMul();
    return {
      side: true, hard: !!hard, name: nm[0] + (hard ? ' (nặng)' : ' (nhẹ)'), desc: nm[1], foes: foes,
      bored: bored < 1 ? { n: s.sideRun || 0, pct: Math.round((1 - bored) * 100) } : null,
      gold: Math.round(base * (hard ? 0.42 : 0.23) * bored), xp: Math.round((40 + s.tier * 25 + st * 4) * (hard ? 0.8 : 0.55)), seed: rng.int(1, 1e9)
    };
  };

  // Khán giả chán: mỗi trận phụ kể từ lần thắng trận chính gần nhất làm túi thưởng trận phụ vơi đi 5%, thấp nhất còn một nửa.
  Game.BORED_STEP = 0.05; Game.BORED_FLOOR = 0.5;
  Game.prototype.boredMul = function () { return Math.max(Game.BORED_FLOOR, 1 - Game.BORED_STEP * (this.s.sideRun || 0)); };

  // ---------------------------------------------------------------- Trận đấu hiện có
  Game.prototype.mainFight = function () {
    var s = this.s;
    if (s.stage >= 7) return null;
    var d = G.CAMPAIGN[s.tier][s.stage], T = G.TIERS[s.tier];
    return {
      main: true, boss: !!d.boss, final: !!d.final, name: d.name, desc: d.desc, hint: d.hint, foes: d.foes,
      gold: Math.round(T.reward * (1 + 0.14 * s.stage) * (d.boss ? 2.6 : 1)),
      xp: Math.round((40 + s.tier * 25 + s.stage * 4) * (d.boss ? 1.5 : 1)), seed: 0, tier: s.tier, stage: s.stage
    };
  };
  Game.prototype.fight = function (kind) { return kind === 'main' ? this.mainFight() : this.s.side[kind === 'side1' ? 1 : 0]; };
  Game.prototype.foeTeam = function (fight) {
    var out = [];
    for (var i = 0; i < fight.foes.length; i++) { var d = fight.foes[i]; out.push({ g: G.makeFoe(d, i, fight.seed || 0), c: d.c, r: d.r }); }
    return out;
  };
  Game.prototype.playerTeam = function () {
    var out = [], s = this.s;
    for (var i = 0; i < s.roster.length; i++) { var g = s.roster[i], p = s.form[g.id]; if (p) out.push({ g: g, c: p[0], r: p[1] }); }
    return out;
  };
  Game.prototype.fielded = function () { return this.playerTeam().length; };

  // Đội hình
  Game.prototype.place = function (id, c, r) {
    var s = this.s, k;
    if (c < 0 || c >= G.GRID.cols || r < 0 || r >= G.GRID.rows) return false;
    var other = null;
    for (k in s.form) if (k !== id && s.form[k][0] === c && s.form[k][1] === r) other = k;
    if (!s.form[id]) {
      if (other) { delete s.form[other]; }
      else if (this.fielded() >= this.fieldLimit()) return false;
    } else if (other) { s.form[other] = s.form[id]; }
    s.form[id] = [c, r];
    return true;
  };
  Game.prototype.bench = function (id) { delete this.s.form[id]; };
  Game.prototype.cleanForm = function () {
    var s = this.s, k, n = 0;
    for (k in s.form) { if (!this.glad(k)) delete s.form[k]; }
    for (k in s.form) { n++; if (n > this.fieldLimit()) delete s.form[k]; }
  };
  Game.prototype.autoForm = function () {
    var s = this.s; this.cleanForm();
    var rows = [2, 1, 3, 0, 4];
    for (var i = 0; i < s.roster.length && this.fielded() < this.fieldLimit(); i++) {
      var g = s.roster[i]; if (s.form[g.id]) continue;
      var K = G.WKIND[G.weaponOf(g).kind], col = K.ai === 'ranged' ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0);
      for (var j = 0; j < rows.length; j++) {
        var occ = false; for (var k in s.form) if (s.form[k][0] === col && s.form[k][1] === rows[j]) occ = true;
        if (!occ && this.place(g.id, col, rows[j])) break;
      }
    }
  };

  // ---------------------------------------------------------------- Mua bán
  Game.prototype.buySlave = function (i) {
    var s = this.s, o = s.market.slaves[i];
    if (!o || o.sold) return { ok: false, msg: 'Đã bán.' };
    if (s.roster.length >= Game.MAX_ROSTER) return { ok: false, msg: 'Trường đã đủ ' + Game.MAX_ROSTER + ' người.' };
    if (s.gold < o.price) return { ok: false, msg: 'Không đủ tiền.' };
    s.gold -= o.price; o.sold = true; s.roster.push(o.g);
    if (this.fielded() < this.fieldLimit()) this.autoForm();
    this.save(); return { ok: true, g: o.g };
  };
  Game.prototype.sellValue = function (g) { return Math.round(G.gladValue(g) * 0.5); };
  Game.prototype.sellSlave = function (id) {
    var s = this.s, g = this.glad(id); if (!g) return { ok: false };
    this.stripGear(g);
    s.gold += this.sellValue(g);
    s.roster.splice(s.roster.indexOf(g), 1); delete s.form[id];
    this.save(); return { ok: true };
  };
  Game.prototype.stripGear = function (g) { for (var k in g.gear) { if (g.gear[k]) this.s.inv.push(g.gear[k]); } g.gear = {}; };
  Game.prototype.buyItem = function (i) {
    var s = this.s, o = s.market.shop[i];
    if (!o || o.sold) return { ok: false, msg: 'Đã bán.' };
    if (s.gold < o.price) return { ok: false, msg: 'Không đủ tiền.' };
    s.gold -= o.price; o.sold = true;
    var inst = { id: o.id, uid: G.newUid(this.rng), r: o.r || 0 }; if (o.aff) inst.aff = o.aff; if (o.fx) inst.fx = o.fx; if (o.ep != null) inst.ep = o.ep;
    s.inv.push(inst);
    this.save(); return { ok: true, inst: inst };
  };
  Game.prototype.sellItem = function (uid) {
    var s = this.s;
    for (var i = 0; i < s.inv.length; i++) if (s.inv[i].uid === uid) {
      s.gold += Math.round(G.instPrice(s.inv[i]) * 0.5); s.inv.splice(i, 1); this.save(); return { ok: true };
    }
    return { ok: false };
  };
  Game.prototype.buyRelic = function () {
    var s = this.s, o = s.market.relic;
    if (!o || o.sold) return { ok: false, msg: 'Đã bán.' };
    if (s.gold < o.price) return { ok: false, msg: 'Không đủ tiền.' };
    s.gold -= o.price; o.sold = true; s.relics.push(o.id);
    this.save(); return { ok: true };
  };
  Game.prototype.equip = function (gid, uid) {
    var s = this.s, g = this.glad(gid), idx = -1;
    for (var i = 0; i < s.inv.length; i++) if (s.inv[i].uid === uid) idx = i;
    if (!g || idx < 0) return { ok: false, msg: '' };
    var inst = s.inv[idx], it = G.ITEMS[inst.id];
    var wNow = G.weaponOf(g);
    if (it.slot === 'shield' && G.WKIND[wNow.kind].hands === 2) return { ok: false, msg: G.WKIND[wNow.kind].name + ' cần cả hai tay — không cầm khiên được.' };
    // thử mang
    var old = g.gear[it.slot], oldShield = null;
    g.gear[it.slot] = inst;
    if (it.slot === 'weapon' && G.WKIND[it.kind].hands === 2 && g.gear.shield) { oldShield = g.gear.shield; delete g.gear.shield; }
    var st = G.calcStats(g);
    if (st.weight > st.cap + 1e-6) {
      if (old) g.gear[it.slot] = old; else delete g.gear[it.slot];
      if (oldShield) g.gear.shield = oldShield;
      return { ok: false, msg: 'Quá nặng: ' + g.name + ' chỉ mang được ' + Math.round(st.cap) + ', bộ này nặng ' + (Math.round(st.weight * 10) / 10) + '.' };
    }
    s.inv.splice(idx, 1);
    if (old) s.inv.push(old);
    if (oldShield) s.inv.push(oldShield);
    this.save(); return { ok: true };
  };
  Game.prototype.unequip = function (gid, slot) {
    var g = this.glad(gid); if (!g || !g.gear[slot]) return { ok: false };
    this.s.inv.push(g.gear[slot]); delete g.gear[slot]; this.save(); return { ok: true };
  };
  Game.prototype.feastCost = function () { return Math.round(5 * Math.max(1, this.s.roster.length) * this.tierDef().upkeepMul); };
  Game.prototype.feast = function () {
    var s = this.s, c = this.feastCost();
    if (s.feasted) return { ok: false, msg: 'Hôm nay đã đãi tiệc rồi.' };
    if (s.gold < c) return { ok: false, msg: 'Không đủ tiền.' };
    s.gold -= c; s.feasted = true;
    for (var i = 0; i < s.roster.length; i++) this.addMorale(s.roster[i], 14);
    this.save(); return { ok: true };
  };
  // Gọi thầy thuốc: trả tiền để chữa ngay mọi vết thương tạm thời của một người (thương tật vĩnh viễn thì không).
  Game.prototype.treatCost = function (g) {
    var c = 0; if (!g) return 0;
    for (var i = 0; i < g.injuries.length; i++) if (!g.injuries[i].perm) c += 4 + 3 * Math.max(1, g.injuries[i].days);
    return c ? Math.max(3, Math.round(c * this.tierDef().upkeepMul * 1.2)) : 0;
  };
  Game.prototype.treat = function (gid) {
    var s = this.s, g = this.glad(gid), c = this.treatCost(g);
    if (!g || !c) return { ok: false, msg: 'Không có vết thương nào chữa được.' };
    if (s.gold < c) return { ok: false, msg: 'Không đủ tiền.' };
    s.gold -= c; g.injuries = g.injuries.filter(function (x) { return x.perm; });
    this.save(); return { ok: true, cost: c };
  };
  Game.prototype.addMorale = function (g, d) {
    var lo = G.hasTrait(g, 'brave') ? 30 : 0;
    g.morale = Math.max(lo, Math.min(100, Math.round(g.morale + d)));
  };

  // Thẻ lên cấp
  Game.prototype.cardChoices = function (g) { return G.cardOptions(g, new G.Rng(g.cardSeed + (g.lvl - g.pending + 1) * 7919)); };
  Game.prototype.pickCard = function (gid, card) {
    var g = this.glad(gid); if (!g || !g.pending) return false;
    if (this.cardChoices(g).indexOf(card) < 0) return false;
    G.applyCard(g, card); g.pending--; this.save(); return true;
  };

  // ---------------------------------------------------------------- Ra trận
  Game.prototype.makeBattle = function (kind, seedOverride) {
    var fight = this.fight(kind); if (!fight) return null;
    var team = this.playerTeam(); if (!team.length) return null;
    var seed = seedOverride != null ? seedOverride : this.rng.int(1, 1e9);
    var b = new G.Battle(team, this.foeTeam(fight), { seed: seed, radius: 9 });
    b.fight = fight; b.kind = kind;
    return b;
  };
  // Thử n trận giả lập (không đổi trạng thái) → tỉ lệ thắng
  Game.prototype.trial = function (kind, n) {
    var fight = this.fight(kind), team = this.playerTeam(), w = 0;
    if (!fight || !team.length) return 0;
    var foes = this.foeTeam(fight);
    for (var i = 0; i < n; i++) { var b = G.runBattle(team, foes, { seed: 1000 + i * 7717 }); if (b.winner === 0) w++; }
    return w / n;
  };

  Game.prototype.resolveBattle = function (b) {
    var s = this.s, rng = this.rng, fight = b.fight, win = b.winner === 0, T = G.TIERS[s.tier], i;
    var res = { win: win, fight: fight, reason: b.reason, gold: 0, appealGold: 0, appealBy: [], fates: [], xp: [], levelups: [], lines: [], unlocked: null, time: b.time, final: false };
    var mine = b.f.filter(function (f) { return f.team === 0; });
    var medicus = s.roster.some(function (g) { return g.talent === 'medicus'; });
    var doctore = s.roster.some(function (g) { return g.talent === 'doctore'; });
    var died = 0;
    // vàng
    if (win) {
      res.gold = Math.round(fight.gold * (this.has('patron') ? 1.2 : 1));
      for (i = 0; i < mine.length; i++) {
        var f = mine[i];
        if (f.alive) {
          var ag = Math.round(f.st.appeal * APPEAL_GOLD[s.tier] * (f.g.talent === 'idol' ? 2 : 1) * (this.has('cornu') ? 1.6 : 1));
          if (ag > 0) { res.appealGold += ag; res.appealBy.push({ id: f.g.id, name: f.g.name, gold: ag }); }
        }
      }
    } else {
      res.gold = Math.round(fight.gold * 0.15);
    }
    s.gold += res.gold + res.appealGold; s.stat.earned += res.gold + res.appealGold;
    if (win) s.stat.wins++; else { s.stat.losses++; if (fight.main) s.stat.mainLosses++; }
    if (fight.side) s.sideRun = (s.sideRun || 0) + 1; else if (win) s.sideRun = 0;
    // số phận người gục
    for (i = 0; i < mine.length; i++) {
      f = mine[i]; var g = f.g;
      g.fights++; if (win) g.wins++; g.kills += f.stats.kills;
      var fate = { id: g.id, name: g.name, down: !f.alive, fate: 'ok', injury: null };
      if (!f.alive) {
        var st = f.st, tr = G.itemOf(g.gear.trinket);
        var pDeath = (win ? 0.02 : 0.06) + Math.min(0.06, f.overkill * 0.2);
        pDeath *= (1 - Math.min(0.5, st.appeal * 0.06));
        pDeath *= st.deathMul;
        if (this.has('surgeon')) pDeath *= 0.65;
        if (medicus) pDeath *= 0.7;
        if (g.injuries.some(function (x) { return !x.perm; })) pDeath *= 1.25;
        if (g.talent === 'survivor' && win) pDeath = 0;
        if (died) pDeath *= 0.4;   // khán giả đã thấy đủ máu: sau cái chết đầu tiên trong một trận, những kẻ gục còn lại dễ được tha hơn
        if (rng.chance(pDeath)) { fate.fate = 'dead'; died++; }
        else if (rng.chance(Math.min(0.95, (win ? 0.32 : 0.5) * st.injuryMul))) {
          var loc = f.downLoc || 'body';
          var perm = rng.chance(0.1 + Math.min(0.12, f.overkill * 0.25));
          if (g.injuries.filter(function (x) { return x.perm; }).length >= Game.MAX_PERM) perm = false;   // một người chỉ mang tối đa hai thương tật
          var list = perm ? G.INJ_PERM[loc] : G.INJ_TEMP[loc];
          var have = g.injuries.map(function (x) { return x.id; });
          var cand = list.filter(function (x) { return have.indexOf(x) < 0; });
          if (!cand.length && perm) { perm = false; cand = G.INJ_TEMP[loc].filter(function (x) { return have.indexOf(x) < 0; }); }
          if (cand.length) {
            var iid = rng.pick(cand), I = G.INJURIES[iid];
            var days = perm ? -1 : Math.max(1, I.days - (this.has('surgeon') ? 1 : 0));
            g.injuries.push({ id: iid, days: days, perm: perm ? 1 : 0 });
            fate.fate = 'injury'; fate.injury = iid;
          }
        }
      }
      res.fates.push(fate);
    }
    // tinh thần
    for (i = 0; i < mine.length; i++) {
      g = mine[i].g;
      var dm = win ? 8 + (mine[i].stats.kills > 0 ? 3 : 0) : -12 * (G.hasTrait(g, 'proud') ? 2 : 1) * (this.has('nemesis') ? 0.5 : 1);
      dm += mine[i].st.moraleFight || 0;
      this.addMorale(g, dm);
    }
    if (died) for (i = 0; i < s.roster.length; i++) this.addMorale(s.roster[i], -7 * died * (this.has('nemesis') ? 0.5 : 1));
    // kinh nghiệm
    var baseXp = fight.xp * (win ? 1 : 0.4);
    var inFight = {};
    for (i = 0; i < mine.length; i++) {
      g = mine[i].g; inFight[g.id] = 1;
      var xp = Math.round(baseXp * mine[i].st.xpMul * (doctore ? 1.25 : 1) * (1 + 0.1 * mine[i].stats.kills) * G.xpTierMul(g.lvl, fight.tier != null ? fight.tier : s.tier));
      var ups = G.addXp(g, xp);
      res.xp.push({ id: g.id, name: g.name, xp: xp, ups: ups });
    }
    if (this.has('rudis')) for (i = 0; i < s.roster.length; i++) {
      g = s.roster[i]; if (inFight[g.id]) continue;
      xp = Math.round(baseXp * 0.5 * (doctore ? 1.25 : 1) * G.xpTierMul(g.lvl, fight.tier != null ? fight.tier : s.tier)); ups = G.addXp(g, xp);
      res.xp.push({ id: g.id, name: g.name, xp: xp, ups: ups, bench: true });
    }
    // chôn người chết
    for (i = 0; i < res.fates.length; i++) if (res.fates[i].fate === 'dead') {
      g = this.glad(res.fates[i].id);
      if (g) { this.stripGear(g); s.roster.splice(s.roster.indexOf(g), 1); delete s.form[g.id]; s.stat.deaths++; }
    }
    // tiến độ
    if (win && fight.main) {
      s.stage++;
      if (s.stage >= 7) {
        if (s.tier < 3) { s.tier++; s.stage = 0; res.unlocked = G.TIERS[s.tier]; }
        else { s.won = true; res.final = true; }
      }
    }
    res.lines = G.battleLines(b);
    res.stats = b.f.map(function (f) { return { id: f.id, team: f.team, name: f.name, alive: f.alive, s: f.stats, hp: f.hp, maxHp: f.maxHp, kind: f.kind }; });
    s.fought = true;
    this.save();
    return res;
  };

  // Vì sao thắng / thua — vài câu rút từ số liệu trận
  G.battleLines = function (b) {
    var L = [], T = [{ dealt: 0, raw: 0, blk: 0, dod: 0, sw: 0, fl: 0, abs: 0 }, { dealt: 0, raw: 0, blk: 0, dod: 0, sw: 0, fl: 0, abs: 0 }];
    var top = [null, null], first = null, i, f;
    for (i = 0; i < b.f.length; i++) {
      f = b.f[i]; var t = T[f.team], o = T[1 - f.team];
      t.dealt += f.stats.dealt; t.sw += f.stats.swings; t.blk += f.stats.blockedBy; t.dod += f.stats.dodgedBy; t.fl += f.stats.flank;
      o.abs += f.stats.absorbed;
      if (!top[f.team] || f.stats.dealt > top[f.team].stats.dealt) top[f.team] = f;
      if (!f.alive && (!first || f.downT < first.downT)) first = f;
    }
    var win = b.winner === 0;
    if (b.reason === 'concede') L.push('Anh đã ra hiệu xin thua ở giây thứ ' + Math.round(b.time) + '.');
    if (b.reason === 'time') L.push('Hết giờ: trọng tài xử thắng cho bên còn nhiều máu hơn.');
    if (top[0] && top[0].stats.dealt > 0) L.push(top[0].name + ' gây nhiều sát thương nhất bên ta: ' + Math.round(top[0].stats.dealt) + ' (' + G.WKIND[top[0].kind].name + ').');
    if (top[1] && top[1].stats.dealt > 0) L.push('Nguy hiểm nhất bên địch: ' + top[1].name + ' với ' + Math.round(top[1].stats.dealt) + ' sát thương (' + G.WKIND[top[1].kind].name + ').');
    var me = T[0], en = T[1];
    if (me.sw > 3 && me.blk / me.sw > 0.25) L.push('Khiên địch chặn ' + Math.round(me.blk / me.sw * 100) + '% số đòn của ta. Đao cong, rìu, lao ghim khiên hoặc đánh từ sau lưng sẽ qua được.');
    if (me.sw > 3 && me.dod / me.sw > 0.22) L.push('Địch né ' + Math.round(me.dod / me.sw * 100) + '% số đòn của ta. Lưới và choáng làm chúng hết né.');
    var absMe = T[0].abs, rawMe = me.dealt + absMe; // abs của đội 0 = phần giáp địch nuốt
    if (rawMe > 0 && absMe / rawMe > 0.3) L.push('Giáp và khiên địch nuốt ' + Math.round(absMe / rawMe * 100) + '% lực đánh của ta. Chùy và nhát đâm xuyên giáp bỏ qua giáp.');
    var absEn = T[1].abs, rawEn = en.dealt + absEn;
    if (rawEn > 0 && absEn / rawEn > 0.3) L.push('Giáp và khiên của ta đỡ được ' + Math.round(absEn / rawEn * 100) + '% lực đánh của địch.');
    if (en.sw > 3 && (en.blk + en.dod) / en.sw > 0.3) L.push('Người của ta chặn và né ' + Math.round((en.blk + en.dod) / en.sw * 100) + '% số đòn địch.');
    if (me.fl >= 3) L.push(me.fl + ' đòn của ta trúng từ sau lưng địch.');
    if (en.fl >= 3) L.push(en.fl + ' đòn của địch trúng vào lưng người của ta — đội hình bị vòng sườn.');
    if (first) {
      var by = first.downBy >= 0 ? b.f[first.downBy] : null;
      L.push((first.team === 0 ? 'Người gục đầu tiên bên ta: ' : 'Kẻ gục đầu tiên bên địch: ') + first.name + ' ở giây ' + Math.round(first.downT) + (by ? ', bởi ' + by.name : '') + '.');
    }
    return L;
  };

  // ---------------------------------------------------------------- Sang ngày
  Game.prototype.nextDay = function () {
    var s = this.s, rng = this.rng, news = [], i, g;
    var up = this.upkeep(), paid = true;
    if (s.gold >= up) s.gold -= up; else { paid = false; s.gold = 0; }
    news.push(paid ? 'Trả ' + up + ' vàng tiền nuôi người.' : 'Không đủ ' + up + ' vàng tiền nuôi: cả trường nhịn đói. Tinh thần sụt mạnh.');
    var medicus = s.roster.some(function (x) { return x.talent === 'medicus'; });
    for (i = s.roster.length - 1; i >= 0; i--) {
      g = s.roster[i];
      if (!paid) this.addMorale(g, -12);
      if (!s.fought) this.addMorale(g, 2);
      if (G.hasTrait(g, 'sullen')) this.addMorale(g, -1);
      // lành thương
      var heal = (G.hasTrait(g, 'healer') ? 2 : 1) * (medicus ? 2 : 1);
      for (var j = g.injuries.length - 1; j >= 0; j--) {
        var inj = g.injuries[j]; if (inj.perm) continue;
        inj.days -= heal;
        if (inj.days <= 0) { news.push(g.name + ' đã lành: ' + G.INJURIES[inj.id].name + '.'); g.injuries.splice(j, 1); }
      }
      // bỏ trốn
      if (g.morale < 15 && !G.hasTrait(g, 'loyal') && rng.chance(0.5)) {
        news.push(g.name + ' đã bỏ trốn trong đêm, mang theo mọi thứ trên người.');
        s.roster.splice(i, 1); delete s.form[g.id]; s.stat.deserted++;
      } else if (g.morale < 25 && !G.hasTrait(g, 'loyal')) {
        news.push(g.name + ' lầm lì, mắt cứ nhìn ra cổng. Tinh thần quá thấp — hắn có thể bỏ trốn.');
      }
    }
    s.day++;
    this.genDay();
    s.news = news;
    this.save();
    return news;
  };

})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));

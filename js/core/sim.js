// LANISTA — mô phỏng trận đấu. Thuần logic, tất định theo hạt giống, không đồ họa.
// Đồ họa chỉ đọc vị trí và hàng đợi sự kiện (battle.events).
(function (G) {
  'use strict';

  G.GRID = { cols: 3, rows: 5, gap: 1.5, front: 1.7 };
  G.cellPos = function (team, c, r) {
    var x = G.GRID.front + c * G.GRID.gap;
    return { x: team === 0 ? -x : x, z: (r - 2) * G.GRID.gap };
  };
  var PI = Math.PI;
  function angDiff(a, b) { var d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; }
  function dist(a, b) { var dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }

  function Battle(teamA, teamB, opts) {
    opts = opts || {};
    this.rng = new G.Rng(opts.seed || 12345);
    this.R = opts.radius || 9;
    this.time = 0; this.events = []; this.over = false; this.winner = -1; this.reason = '';
    this.f = []; this.proj = []; this.maxTime = opts.maxTime || 80;
    var i;
    for (i = 0; i < teamA.length; i++) this.f.push(this.mk(0, teamA[i]));
    for (i = 0; i < teamB.length; i++) this.f.push(this.mk(1, teamB[i]));
    // hào quang đội hình
    for (i = 0; i < this.f.length; i++) {
      var f = this.f[i];
      f.auraGuard = !!f.st.perks.guardian; f.auraLegion = f.g.talent === 'legionary';
    }
  }
  G.Battle = Battle;

  Battle.prototype.mk = function (team, spec) {
    var g = spec.g, st = G.calcStats(g), K = G.WKIND[st.kind], rng = this.rng;
    var p = G.cellPos(team, spec.c, spec.r);
    return {
      id: this.f.length, team: team, g: g, st: st, K: K, name: g.name, kind: st.kind,
      x: p.x, z: p.z, face: team === 0 ? PI / 2 : -PI / 2, kx: 0, kz: 0, moving: false,
      hp: st.hp, maxHp: st.hp, alive: true, state: 'idle', t: 0, target: null, retT: 0,
      cd: (0.15 + rng.next() * 0.5) * (st.perks.quickdraw ? 0.3 : 1), boostT: 0, frenzy: 0, usedGuard: false, sp: g.talent === 'veteran' ? 0.5 : K.special.cd * st.spCdMul * (0.3 + rng.next() * 0.45),
      stun: 0, net: 0, slowT: 0, slowF: 1, noBlock: 0, shieldOff: false, bleed: [], bleedAcc: 0,
      comboT: -1, combo: 0, opened: false, riposte: false, usedSecond: false, usedSurv: false, braced: {}, enraged: false, hand: 0,
      atk: null, flankSide: rng.next() < 0.5 ? 1 : -1, hate: st.boss ? {} : null,
      stats: { dealt: 0, taken: 0, blocked: 0, dodged: 0, absorbed: 0, kills: 0, hits: 0, crits: 0, swings: 0, specials: 0, flank: 0, blockedBy: 0, dodgedBy: 0 },
      downBy: -1, downLoc: null, overkill: 0, downT: 0
    };
  };

  Battle.prototype.emit = function (ev) { ev.time = this.time; this.events.push(ev); };
  Battle.prototype.foesOf = function (f) { var o = []; for (var i = 0; i < this.f.length; i++) { var e = this.f[i]; if (e.alive && e.team !== f.team) o.push(e); } return o; };
  Battle.prototype.alliesOf = function (f) { var o = []; for (var i = 0; i < this.f.length; i++) { var e = this.f[i]; if (e.alive && e.team === f.team && e !== f) o.push(e); } return o; };
  Battle.prototype.aliveCount = function (team) { var n = 0; for (var i = 0; i < this.f.length; i++) if (this.f[i].alive && this.f[i].team === team) n++; return n; };

  Battle.prototype.concede = function (team) {
    if (this.over) return;
    this.over = true; this.winner = 1 - team; this.reason = 'concede';
    this.emit({ e: 'end', winner: this.winner, reason: 'concede' });
  };

  // ---------------------------------------------------------------- Vòng lặp
  Battle.prototype.step = function (dt) {
    if (this.over) return;
    this.time += dt;
    var F = this.f, i, f;
    for (i = 0; i < F.length; i++) {
      f = F[i]; if (!f.alive) continue;
      if (f.cd > 0) f.cd -= dt;
      if (f.sp > 0) f.sp -= dt;
      if (f.stun > 0) f.stun -= dt;
      if (f.net > 0) f.net -= dt;
      if (f.slowT > 0) f.slowT -= dt;
      if (f.boostT > 0) f.boostT -= dt;
      if (f.noBlock > 0) f.noBlock -= dt;
      if (f.hate) { var hd = Math.exp(-dt / 3.5); for (var hk in f.hate) f.hate[hk] *= hd; }
      if (f.bleed.length) {
        f.bleedAcc += dt;
        if (f.bleedAcc >= 0.5) {
          f.bleedAcc -= 0.5;
          var tot = 0, src = null;
          for (var j = f.bleed.length - 1; j >= 0; j--) {
            var b = f.bleed[j]; tot += b.dps * 0.5; src = b.src; b.t -= 0.5;
            if (b.t <= 0) f.bleed.splice(j, 1);
          }
          if (tot > 0) {
            if (src) src.stats.dealt += tot;
            this.emit({ e: 'bleed', id: f.id, dmg: tot });
            this.damage(src, f, tot, 'body', true);
          }
        }
      }
    }
    for (i = 0; i < F.length; i++) { f = F[i]; if (f.alive) this.think(f, dt); if (this.over) return; }
    // lao và lưới đang bay
    for (i = this.proj.length - 1; i >= 0; i--) {
      var p = this.proj[i]; p.t += dt;
      if (p.t >= p.dur) { this.proj.splice(i, 1); this.landProj(p); }
    }
    // đẩy lùi + va chạm
    for (i = 0; i < F.length; i++) {
      f = F[i]; if (!f.alive) continue;
      if (f.kx || f.kz) {
        f.x += f.kx * dt; f.z += f.kz * dt;
        var dec = Math.exp(-12 * dt); f.kx *= dec; f.kz *= dec;
        if (Math.abs(f.kx) + Math.abs(f.kz) < 0.05) { f.kx = 0; f.kz = 0; }
      }
    }
    for (var it = 0; it < 2; it++) {
      for (i = 0; i < F.length; i++) {
        var a = F[i]; if (!a.alive) continue;
        for (var k = i + 1; k < F.length; k++) {
          var c = F[k]; if (!c.alive) continue;
          var dx = c.x - a.x, dz = c.z - a.z, d = Math.sqrt(dx * dx + dz * dz), min = a.st.radius + c.st.radius + 0.08;
          if (d < min) {
            if (d < 1e-4) { dx = 0.01; dz = 0.01 * (i % 2 ? 1 : -1); d = 0.0141; }
            var push = (min - d) / 2, ux = dx / d, uz = dz / d;
            // kẻ đang ra đòn/bị lưới thì đứng vững hơn
            var wa = (a.state === 'windup' || a.net > 0 || a.st.boss) ? 0.2 : 1, wc = (c.state === 'windup' || c.net > 0 || c.st.boss) ? 0.2 : 1, ws = wa + wc;
            a.x -= ux * push * 2 * wa / ws; a.z -= uz * push * 2 * wa / ws;
            c.x += ux * push * 2 * wc / ws; c.z += uz * push * 2 * wc / ws;
          }
        }
        var rr = Math.sqrt(a.x * a.x + a.z * a.z), lim = this.R - 0.55;
        if (rr > lim) { a.x *= lim / rr; a.z *= lim / rr; }
      }
    }
    this.checkEnd();
  };

  Battle.prototype.checkEnd = function () {
    if (this.over) return;
    var a = this.aliveCount(0), b = this.aliveCount(1);
    if (a === 0 || b === 0) {
      this.over = true; this.winner = a > 0 ? 0 : 1; this.reason = 'down';
      this.emit({ e: 'end', winner: this.winner, reason: 'down' });
    } else if (this.time >= this.maxTime) {
      var hp = [0, 0], mx = [0, 0];
      for (var i = 0; i < this.f.length; i++) { var f = this.f[i]; mx[f.team] += f.maxHp; if (f.alive) hp[f.team] += f.hp; }
      this.over = true; this.winner = hp[0] / mx[0] > hp[1] / mx[1] ? 0 : 1; this.reason = 'time';
      this.emit({ e: 'end', winner: this.winner, reason: 'time' });
    }
  };

  // ---------------------------------------------------------------- Chọn mục tiêu
  Battle.prototype.pickTarget = function (f) {
    var foes = this.foesOf(f); if (!foes.length) return null;
    var best = null, bs = 1e9, ai = f.K.ai, allies = null;
    for (var i = 0; i < foes.length; i++) {
      var e = foes[i], d = dist(f, e), s = d;
      if (ai === 'breaker') s = d - e.st.armorAvg * 0.35;
      else if (ai === 'hunt') s = d * 0.55 + e.st.armorAvg * 0.6 + (e.st.hasShield && !e.shieldOff ? 1.5 : 0);
      else if (ai === 'flank') s = d - (e.target && e.target !== f && e.target.alive ? 1.6 : 0) - (e.st.hasShield ? 1.0 : 0);
      else if (ai === 'ranged') s = d * 0.25 + (e.st.hasShield && !e.shieldOff ? 3 : 0) + (e.hp / e.maxHp) * 1.5;
      else if (ai === 'support') {
        if (!allies) allies = this.alliesOf(f);
        for (var j = 0; j < allies.length; j++) if (allies[j].target === e && dist(allies[j], e) < 2.2) { s -= 1.5; break; }
      }
      // trùm quay sang kẻ vừa làm hắn đau nhất — nhất là kẻ ném lao từ xa
      if (f.hate && f.hate[e.id]) s -= Math.min(7, f.hate[e.id] / (f.maxHp * 0.015));
      if (e === f.target) s -= 1.2;
      if (e.net > 0 && ai !== 'kite') s -= 0.8;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  };
  Battle.prototype.nearest = function (f) {
    var foes = this.foesOf(f), best = null, bd = 1e9;
    for (var i = 0; i < foes.length; i++) { var d = dist(f, foes[i]); if (d < bd) { bd = d; best = foes[i]; } }
    return best;
  };

  function turn(f, want, rate, dt) {
    var d = angDiff(want, f.face), m = rate * dt;
    f.face += Math.abs(d) <= m ? d : (d > 0 ? m : -m);
  }

  // ---------------------------------------------------------------- Suy nghĩ
  Battle.prototype.think = function (f, dt) {
    f.moving = false;
    if (f.stun > 0) {
      if (f.state !== 'stun') { if (f.atk) this.emit({ e: 'cancel', id: f.id }); f.atk = null; f.state = 'stun'; }
      return;
    } else if (f.state === 'stun') { f.state = 'idle'; f.cd = Math.max(f.cd, 0.25); }

    var a = f.atk, t;
    if (f.state === 'windup') {
      f.t += dt;
      if (a.t.alive) turn(f, Math.atan2(a.t.x - f.x, a.t.z - f.z), 3.5, dt);
      while (a.i < a.hits.length && f.t >= a.hits[a.i].at) {
        this.resolve(f, a.hits[a.i]); a.i++;
        if (this.over || !f.alive || f.state !== 'windup') return;
      }
      if (a.i >= a.hits.length) { f.state = 'recover'; f.t = 0; }
      return;
    }
    if (f.state === 'recover') {
      f.t += dt;
      if (f.t >= a.rec) { f.state = 'idle'; f.cd = a.cdAfter; f.atk = null; }
      return;
    }

    f.retT -= dt;
    if (!f.target || !f.target.alive || f.retT <= 0) { f.target = this.pickTarget(f); f.retT = 0.5 + this.rng.next() * 0.3; }
    t = f.target; if (!t) return;
    var ai = f.K.ai, reach = f.st.reach;
    var near = (ai === 'ranged' || ai === 'kite' || ai === 'support') ? this.nearest(f) : t;
    var dn = dist(f, near);
    var melee = false;
    if (ai === 'ranged' && dn < 1.9) { t = near; melee = true; reach = f.K.meleeReach; }
    var dx = t.x - f.x, dz = t.z - f.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    var ux = dx / d, uz = dz / d;
    var want = Math.atan2(dx, dz);
    turn(f, want, f.st.boss ? 7 : 10, dt);
    var facingOk = Math.abs(angDiff(want, f.face)) < 0.6;

    // --- chiêu lưới: ném được từ xa
    if (f.kind === 'trident' && f.sp <= 0 && f.cd <= 0 && f.net <= 0) {
      var nt = null, foes = this.foesOf(f), bsc = 1e9;
      for (var i = 0; i < foes.length; i++) {
        var e = foes[i], de = dist(f, e);
        if (de > 5.2 || e.net > 0) continue;
        var sc = de - (e.target === f ? 2 : 0) - e.st.dmgMul - (f.hate && f.hate[e.id] ? Math.min(4, f.hate[e.id] / (f.maxHp * 0.015)) : 0);
        if (sc < bsc) { bsc = sc; nt = e; }
      }
      if (nt && Math.abs(angDiff(Math.atan2(nt.x - f.x, nt.z - f.z), f.face)) < 0.9) { this.startAttack(f, nt, 'net'); return; }
    }
    // --- ra đòn
    if (f.cd <= 0 && d <= reach + 0.05 && facingOk) {
      if (ai === 'ranged' && !melee && dn < 1.9) { /* quá gần để ném */ }
      else { this.startAttack(f, t, null, melee); return; }
    }

    // --- di chuyển
    var speed = f.st.move * (f.slowT > 0 ? f.slowF : 1) * (f.boostT > 0 ? 1.25 : 1) * (f.st.perks.sprint && this.time < 5 ? 1.4 : 1);
    if (f.net > 0) return;
    var mx = 0, mz = 0, sp = speed;
    var cornered = Math.sqrt(f.x * f.x + f.z * f.z) > this.R - 1.5;
    var nx = (f.x - near.x) / (dn || 1), nz = (f.z - near.z) / (dn || 1);
    if (ai === 'ranged') {
      // người cầm vũ khí tầm xa luôn muốn giữ kẻ địch gần nhất ở ngoài ~60% tầm bắn: bắn xong là lùi
      var keep = Math.max(4.0, f.st.reach * 0.6);
      if (dn < keep && !cornered) { mx = nx; mz = nz; sp = speed * 0.9; }
      else if ((melee || dn >= keep) && d > reach * 0.9) { mx = ux; mz = uz; }
    } else if (ai === 'kite') {
      if (dn < (near.net > 0 ? reach * 0.9 : reach * 0.62) && !cornered) { mx = nx; mz = nz; sp = speed * 0.7; }
      else if (d > reach * 0.9) { mx = ux; mz = uz; }
    } else if (ai === 'support') {
      if (dn < reach * 0.5 && !cornered && near.st.reach < reach) { mx = nx; mz = nz; sp = speed * 0.5; }
      else if (d > reach * 0.92) { mx = ux; mz = uz; }
    } else if ((ai === 'flank' || ai === 'hunt') && t.target && t.target !== f && t.target.alive && d < 4) {
      // vòng ra sau lưng
      var bx = -Math.sin(t.face), bz = -Math.cos(t.face);      // hướng "sau lưng" của mục tiêu
      var rx = -ux, rz = -uz;                                  // từ mục tiêu tới ta
      var behind = rx * bx + rz * bz;
      if (behind > 0.75) { if (d > reach * 0.85) { mx = ux; mz = uz; } }
      else {
        var tx = -rz, tz = rx;                                 // tiếp tuyến
        var sgn = (tx * bx + tz * bz);
        if (Math.abs(sgn) < 0.15) sgn = f.flankSide; else sgn = sgn > 0 ? 1 : -1;
        var rad = d > reach * 0.9 ? 0.6 : (d < reach * 0.6 ? -0.5 : 0);
        mx = tx * sgn * 0.85 + ux * rad; mz = tz * sgn * 0.85 + uz * rad;
      }
    } else {
      if (d > reach * 0.88) { mx = ux; mz = uz; }
    }
    var ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      // né đồng đội chắn ngay trước mặt
      var al = this.alliesOf(f);
      for (var q = 0; q < al.length; q++) {
        var o = al[q], ox = o.x - f.x, oz = o.z - f.z, od = Math.sqrt(ox * ox + oz * oz);
        if (od < 1.15 && od > 0.01 && (ox * mx + oz * mz) / od > 0.6) {
          var side = (ox * mz - oz * mx) > 0 ? 1 : -1;
          var px = -mz, pz = mx; // vuông góc
          mx += px * side * 0.8; mz += pz * side * 0.8;
          var l2 = Math.sqrt(mx * mx + mz * mz); mx /= l2; mz /= l2;
          break;
        }
      }
      f.x += mx * sp * dt; f.z += mz * sp * dt; f.moving = true;
    }
  };

  // ---------------------------------------------------------------- Ra đòn
  var LOCW = { def: [15, 45, 18, 22], trident: [8, 30, 12, 50], javelin: [10, 55, 15, 20], head: [55, 30, 10, 5], fist: [22, 58, 12, 8] };
  Battle.prototype.rollLoc = function (f, t, table) {
    var w = LOCW[table] || LOCW.def, i = this.rng.weighted(w), loc = G.LOCS[i];
    if (f.kind === 'twin') { var l2 = G.LOCS[this.rng.weighted(w)]; if (t.st.armor[l2] < t.st.armor[loc]) loc = l2; }
    return loc;
  };
  // góc tấn công so với hướng mặt của mục tiêu: 0 trước mặt, 1 bên sườn, 2 sau lưng
  function flankOf(f, t) {
    var a = Math.abs(angDiff(Math.atan2(f.x - t.x, f.z - t.z), t.face));
    return a < 1.15 ? 0 : (a < 2.2 ? 1 : 2);
  }
  Battle.prototype.rollOutcome = function (f, t, o) {
    o = o || {};
    var fl = flankOf(f, t), can = t.stun <= 0;
    var pDodge = (can && t.net <= 0 && fl < 2) ? t.st.dodge * (fl === 1 ? 0.6 : 1) : 0;
    var pBlock = 0, pDefl = 0;
    if (can && !o.unblockable && fl < 2) {
      if (t.st.hasShield && !t.shieldOff && t.noBlock <= 0) {
        pBlock = t.st.block + (o.missile ? t.st.missileBlock : 0) - f.st.antiBlock;
        // cựu lính lê dương đứng cạnh
        var al = this.alliesOf(t);
        for (var i = 0; i < al.length; i++) if (al[i].auraLegion && dist(al[i], t) < 2.1) { pBlock += 0.12; break; }
        if (f.kind === 'sica') pBlock *= 0.5;
        else if (f.kind === 'caestus') pBlock *= 0.6;   // đấm trong tầm khiên
        if (fl === 1 && !t.st.wall) pBlock *= 0.5;
        pBlock = Math.max(0, Math.min(0.8, pBlock));
      }
      pDefl = t.st.deflect * (fl === 1 ? 0.5 : 1) + (o.missile && !t.st.hasShield ? t.st.missileBlock : 0);
    }
    var r = this.rng.next();
    if (r < pDodge) return { out: 'dodge', fl: fl };
    r -= pDodge;
    if (r < pBlock) return { out: 'block', fl: fl };
    r -= pBlock;
    if (r < pDefl) return { out: 'block', arm: true, fl: fl };
    var crit = this.rng.next() < f.st.crit || (o.forceCrit);
    return { out: crit ? 'crit' : 'hit', fl: fl };
  };

  Battle.prototype.startAttack = function (f, t, forced, melee) {
    var K = f.K, sp = forced || null, rng = this.rng;
    if (!sp && f.sp <= 0 && K.special.id !== 'net' && !(K.ranged && melee)) sp = K.special.id;
    var as = f.st.aspd * (f.net > 0 ? 0.5 : 1) * (f.enraged ? 1.5 : 1) * (1 + 0.04 * (f.frenzy || 0));
    var tm = 1 / Math.min(1.35, Math.max(0.6, as));
    var wu = K.windup * tm, rec = K.recover * tm, hits = [], h, i, table = 'def';
    if (f.kind === 'trident') table = 'trident'; else if (K.ranged) table = 'javelin'; else if (f.kind === 'fist' || f.kind === 'caestus') table = 'fist';
    var missile = K.ranged && !melee, self = this;
    function mkHit(at, mul, hand, o) {
      var loc = self.rollLoc(f, t, (o && o.table) || table);
      var ro = self.rollOutcome(f, t, o);
      return { at: at, mul: mul, hand: hand || 0, loc: loc, out: ro.out, arm: !!ro.arm, fl: ro.fl };
    }
    var firstCrit = f.g.talent === 'venator' && !f.opened && (f.kind === 'javelin' || f.kind === 'hasta');
    if (sp === 'triple') { for (i = 0; i < 3; i++) hits.push(mkHit(wu + i * 0.27, 0.7, 0)); }
    else if (sp === 'flurry') { for (i = 0; i < 4; i++) hits.push(mkHit(wu + i * 0.19, 0.65, i % 2)); }
    else if (sp === 'hook') { wu *= 1.3; h = mkHit(wu, f.kind === 'caestus' ? 1.6 : 1.5, 0, { table: 'head' }); h.stun = f.kind === 'caestus' ? 1.3 : 1.0; hits.push(h); }
    else if (sp === 'hookshield') { h = mkHit(wu, 1.1, 0, { unblockable: true }); h.hook = true; hits.push(h); }
    else if (sp === 'stun') { wu *= 1.25; h = mkHit(wu, 1.0, 0, { table: 'head' }); h.stun = 2.0; hits.push(h); }
    else if (sp === 'pierce') { wu *= 1.2; h = mkHit(wu, 1.6, 0, { missile: missile }); h.pen = 1; h.kb = 1.0; hits.push(h); }
    else if (sp === 'volley') { for (i = 0; i < 3; i++) hits.push(mkHit(wu + i * 0.27, 0.75, 0, { missile: true })); }
    else if (sp === 'sweep') { wu *= 1.15; hits.push({ at: wu, mul: 0.85, hand: 0, loc: 'body', out: 'hit', sweep: true }); }
    else if (sp === 'net') { wu = 0.42; rec = 0.36; hits.push({ at: wu, mul: 0, hand: 1, loc: 'body', out: 'hit', net: true }); }
    else if (sp === 'pin') { wu *= 1.15; h = mkHit(wu, 1.0, 0, { missile: true, unblockable: true }); h.pin = true; hits.push(h); }
    else if (f.kind === 'twin') { hits.push(mkHit(wu, 1, 0)); hits.push(mkHit(wu + 0.2, 1, 1)); }
    else if (f.kind === 'caestus' || f.kind === 'fist') { hits.push(mkHit(wu, 1, f.hand)); f.hand = 1 - f.hand; }
    else if (melee && K.ranged) { hits.push(mkHit(wu, K.meleeMul || 0.7, 0)); }
    else hits.push(mkHit(wu, 1, 0, { missile: missile, forceCrit: firstCrit }));
    var total = hits[hits.length - 1].at + rec;
    var interval = f.st.interval / as;
    if (sp) { f.sp = K.special.cd * f.st.spCdMul; f.stats.specials++; }
    f.atk = { t: t, hits: hits, i: 0, rec: rec, cdAfter: Math.max(0.05, interval - total), special: sp, missile: missile || sp === 'pin', melee: !!melee };
    f.state = 'windup'; f.t = 0;
    this.emit({ e: 'attack', a: f.id, d: t.id, kind: f.kind, special: sp, windup: wu, recover: rec, hits: hits, melee: !!melee });
  };

  Battle.prototype.resolve = function (f, h) {
    var a = f.atk, t = a.t, i;
    f.stats.swings++;
    if (h.net) {
      this.proj.push({ type: 'net', a: f, d: t, t: 0, dur: 0.4, h: h });
      this.emit({ e: 'proj', type: 'net', a: f.id, d: t.id, dur: 0.4 });
      return;
    }
    if (a.missile) {
      var ptype = f.K.proj || 'javelin', dur = Math.max(0.14, dist(f, t) / (f.K.projSpeed || 17));
      this.proj.push({ type: ptype, a: f, d: t, t: 0, dur: dur, h: h });
      this.emit({ e: 'proj', type: ptype, a: f.id, d: t.id, dur: dur, out: h.out, loc: h.loc, arm: h.arm, pin: !!h.pin, toShield: !!(h.pin && t.st.hasShield && !t.shieldOff) });
      return;
    }
    if (h.sweep) {
      var foes = this.foesOf(f), any = false;
      for (i = 0; i < foes.length; i++) {
        var e = foes[i];
        if (dist(f, e) > f.st.reach + 0.3) continue;
        if (Math.abs(angDiff(Math.atan2(e.x - f.x, e.z - f.z), f.face)) > 1.35) continue;
        var ro = this.rollOutcome(f, e, {});
        this.strike(f, e, { mul: h.mul, loc: this.rollLoc(f, e, 'def'), out: ro.out, arm: ro.arm, fl: ro.fl, kb: 1.0, hand: 0, sweep: true });
        any = true;
      }
      if (!any) this.emit({ e: 'hit', a: f.id, d: t.id, out: 'whiff', loc: 'body', dmg: 0 });
      return;
    }
    this.strike(f, t, h);
  };

  Battle.prototype.landProj = function (p) {
    var f = p.a, t = p.d;
    if (p.type === 'net') {
      if (!t.alive) return;
      var dur = 3.0 * (1 - t.st.netRes) * (t.st.perks.stubborn ? 0.5 : 1) * (t.st.boss ? 0.45 : 1) * (1 - t.st.resist);
      t.net = Math.max(t.net, dur);
      this.emit({ e: 'effect', id: t.id, type: 'net', dur: dur, by: f.id });
      return;
    }
    this.strike(f, t, p.h, true);
  };

  Battle.prototype.strike = function (f, t, h, viaProj) {
    var rng = this.rng, K = f.K, out = h.out;
    if (!t.alive || (!viaProj && dist(f, t) > f.st.reach * 1.25 + 0.4)) {
      this.emit({ e: 'hit', a: f.id, d: t.id, out: 'whiff', loc: h.loc, dmg: 0, hand: h.hand }); return;
    }
    if ((out === 'dodge' || out === 'block') && t.stun > 0) out = 'hit';
    if (out === 'block' && !h.arm && (t.shieldOff || t.noBlock > 0)) out = 'hit';
    if (out === 'dodge' && t.net > 0) out = 'hit';
    var dx = t.x - f.x, dz = t.z - f.z, d = Math.sqrt(dx * dx + dz * dz) || 1, ux = dx / d, uz = dz / d;
    var steady = 1 - t.st.steady;
    var fl = flankOf(f, t);

    if (out === 'dodge') {
      t.stats.dodged++; f.stats.dodgedBy++;
      if (t.st.perks.riposte) t.riposte = true;
      t.kx += ux * 3.6; t.kz += uz * 3.6;
      if (t.st.perks.dodgeStep) t.boostT = 2;
      this.emit({ e: 'hit', a: f.id, d: t.id, out: 'dodge', loc: h.loc, dmg: 0, hand: h.hand, proj: !!viaProj });
      if (h.pin) return;
      return;
    }
    // sát thương gốc
    var base = f.st.weapon.dmg * f.st.dmgMul * h.mul * (0.88 + rng.next() * 0.24);
    var crit = out === 'crit';
    if (crit) base *= 1.6;
    if (fl === 2) { base *= (f.kind === 'twin' ? 1.5 : 1.25); }
    if (h.loc === 'head') base *= 1.35;
    var g = f.g, notes = [];
    if (!f.opened) { f.opened = true; if (f.st.perks.opener) { base *= 2; notes.push('Phủ đầu'); } }
    if (f.riposte) { f.riposte = false; base *= 1.7; notes.push('Phản đòn'); }
    if (f.st.perks.execute && t.hp < t.maxHp * 0.35) base *= 1.45;
    if (f.st.perks.gangup) {
      var al = this.alliesOf(f);
      for (var i = 0; i < al.length; i++) if (al[i].target === t && dist(al[i], t) < al[i].st.reach + 0.6) { base *= 1.25; break; }
    }
    if (f.st.perks.lonewolf) {
      var alone = true, al2 = this.alliesOf(f);
      for (i = 0; i < al2.length; i++) if (dist(al2[i], f) < 3) { alone = false; break; }
      if (alone) base *= 1.25;
    }
    if (f.hp < f.maxHp * 0.5) { if (G.hasTrait(g, 'coward')) base *= 0.8; if (G.hasTrait(g, 'brave')) base *= 1.1; }
    if (f.kind === 'caestus') {
      if (f.comboT === t.id) f.combo = Math.min(5, f.combo + 1); else { f.comboT = t.id; f.combo = 0; }
      base *= 1 + f.combo * 0.08;
    }
    if (f.kind === 'hasta' && !f.braced[t.id]) { f.braced[t.id] = 1; base *= 1.6; notes.push('Đón đầu'); }
    if (f.kind === 'javelin' && viaProj && (!t.st.hasShield || t.shieldOff)) base *= 1.3;

    if (out === 'block') {
      t.stats.blocked++; f.stats.blockedBy++;
      if (t.st.perks.riposte) t.riposte = true;
      var through = h.arm ? 0 : Math.max(f.kind === 'axe' ? 0.5 : 0, f.st.crush || 0, f.st.perks.blockPierce ? 0.3 : 0);
      if (h.pin && !h.arm) { /* không thể xảy ra: pin là unblockable */ }
      if (through <= 0) {
        t.stats.absorbed += base;
        t.kx += ux * 0.8 * steady; t.kz += uz * 0.8 * steady;
        this.emit({ e: 'hit', a: f.id, d: t.id, out: 'block', arm: h.arm, loc: h.loc, dmg: 0, hand: h.hand, proj: !!viaProj });
        return;
      }
      base *= through; notes.push('Xuyên khiên');
    }
    // lao ghim khiên
    if (h.pin) {
      if (t.st.hasShield && !t.shieldOff && t.st.boss) {
        // trùm giật được cây lao ra: khiên chỉ vô dụng 5 giây
        t.noBlock = Math.max(t.noBlock, 5); base *= 0.5;
        this.emit({ e: 'effect', id: t.id, type: 'shieldoff', by: f.id, dur: 5 });
      } else if (t.st.hasShield && !t.shieldOff) {
        t.shieldOff = true; base *= 0.5;
        this.emit({ e: 'effect', id: t.id, type: 'shieldoff', by: f.id });
      } else base *= 1.6;
    }
    // giáp
    var pen = h.pen != null ? h.pen : f.st.pen;
    var arm = t.st.armor[h.loc] * (1 - pen);
    var dmg = arm > 0 ? base * base / (base + arm * G.ARMOR_K) : base;   // giáp ăn đòn nhẹ nhiều hơn đòn nặng
    // giảm sát thương phía mục tiêu
    if (t.st.perks.grit && t.hp < t.maxHp * 0.35) dmg *= 0.65;
    var ta = this.alliesOf(t), gd = false, lg = false;
    for (i = 0; i < ta.length; i++) {
      if (dist(ta[i], t) < 2.1) { if (ta[i].auraGuard) gd = true; if (ta[i].auraLegion) lg = true; }
    }
    if (gd) dmg *= 0.85;
    if (lg) dmg *= 0.9;
    t.stats.absorbed += Math.max(0, base - dmg);
    if (f.st.perks.frenzy) f.frenzy = Math.min(5, (f.frenzy || 0) + 1);
    f.stats.hits++; if (crit) f.stats.crits++; if (fl === 2) f.stats.flank++;
    f.stats.dealt += dmg;
    if (t.hate) { t.hate[f.id] = (t.hate[f.id] || 0) + dmg * (viaProj ? 2.2 : 1); if (viaProj) t.retT = 0; }
    // đẩy lùi
    var kb = (h.kb != null ? h.kb : (f.kind === 'axe' ? 0.55 : (f.kind === 'mace' ? 0.3 : 0.14))) * steady * (t.st.boss ? 0.3 : 1);
    t.kx += ux * kb * 12; t.kz += uz * kb * 12;
    // hiệu ứng
    var rs = 1 - t.st.resist, nb = !!t.st.perks.noBleed;   // kháng hiệu ứng: mọi hiệu ứng xấu ngắn lại
    if (h.stun) this.stunOn(t, h.stun, f);
    if (h.hook) { t.noBlock = 3 * rs; if (!nb) { t.bleed.push({ t: 5 * rs, dps: base * 0.14, src: f }); this.emit({ e: 'effect', id: t.id, type: 'bleed', dur: 5 * rs, by: f.id }); } }
    else if (f.kind === 'sica' && crit && !nb) { t.bleed.push({ t: 4 * rs, dps: dmg * 0.12, src: f }); this.emit({ e: 'effect', id: t.id, type: 'bleed', dur: 4 * rs, by: f.id }); }
    if (f.kind === 'trident' && h.loc === 'legs' && !nb && !t.st.perks.unslowed) { t.slowT = 2 * rs; t.slowF = 0.75; this.emit({ e: 'effect', id: t.id, type: 'slow', dur: 2 * rs, by: f.id }); }
    this.emit({ e: 'hit', a: f.id, d: t.id, out: out === 'block' ? 'hit' : out, through: out === 'block', loc: h.loc, dmg: dmg, fl: fl, hand: h.hand, proj: !!viaProj, notes: notes, sweep: !!h.sweep, kb: kb });
    // hiệu ứng của đồ hiếm
    if (f.st.perks.bleedHit && !h.hook && !nb) t.bleed.push({ t: 3 * rs, dps: dmg * 0.1, src: f });
    if (f.st.perks.stagger && !h.stun && rng.next() < 0.18) this.stunOn(t, 0.5, f);
    this.damage(f, t, dmg, h.loc, false);
    if (t.st.perks.thorns && !viaProj && f.alive && !this.over) { var th = Math.max(1, dmg * 0.15); t.stats.dealt += th; this.emit({ e: 'bleed', id: f.id, dmg: th }); this.damage(t, f, th, 'arms', true); }
  };

  // Làm choáng: tính cả giày bám cát, kháng hiệu ứng của mũ, "Tỉnh đòn"
  Battle.prototype.stunOn = function (t, base, f) {
    if (t.st.perks.stunGuard && !t.usedGuard) { t.usedGuard = true; this.emit({ e: 'effect', id: t.id, type: 'guard', by: f.id }); return; }
    var sd = base * (1 - t.st.steady) * (t.st.perks.stubborn ? 0.5 : 1) * (t.st.boss ? 0.4 : 1) * (1 - t.st.resist);
    t.stun = Math.max(t.stun, sd); t.frenzy = 0;
    this.emit({ e: 'effect', id: t.id, type: 'stun', dur: sd, by: f.id });
  };

  // Trừ máu, xử lý gục
  Battle.prototype.damage = function (f, t, dmg, loc, dot) {
    if (!t.alive) return;
    t.stats.taken += dmg;
    t.hp -= dmg;
    if (t.hp <= 0 && t.g.talent === 'survivor' && !t.usedSurv) {
      t.usedSurv = true; t.hp = 1;
      this.emit({ e: 'effect', id: t.id, type: 'survive' });
    }
    if (t.hp > 0 && !t.usedSecond && t.hp < t.maxHp * 0.25 && t.st.perks.second) {
      t.usedSecond = true; var heal = t.maxHp * 0.3; t.hp += heal;
      this.emit({ e: 'effect', id: t.id, type: 'heal', amount: heal });
    }
    if (t.hp > 0 && t.st.enrage && !t.enraged && t.hp < t.maxHp * 0.5) {
      t.enraged = true; this.emit({ e: 'effect', id: t.id, type: 'enrage' });
    }
    if (t.hp <= 0) {
      t.overkill = -t.hp / t.maxHp; t.hp = 0; t.alive = false; t.state = 'down';
      t.downBy = f ? f.id : -1; t.downLoc = loc; t.downT = this.time;
      if (t.atk) t.atk = null;
      if (f) {
        f.stats.kills++;
        if (f.st.perks.bloodlust && f.alive) { var hl = f.maxHp * 0.25; f.hp = Math.min(f.maxHp, f.hp + hl); this.emit({ e: 'effect', id: f.id, type: 'heal', amount: hl }); }
      }
      this.emit({ e: 'down', id: t.id, by: f ? f.id : -1, loc: loc, dot: !!dot });
      this.checkEnd();
    }
  };

  // Chạy trọn một trận không đồ họa
  G.runBattle = function (teamA, teamB, opts) {
    var b = new Battle(teamA, teamB, opts), dt = 1 / 30, n = 0;
    while (!b.over && n++ < 30 * 200) { b.step(dt); if (opts && opts.keepEvents !== true) b.events.length = 0; }
    return b;
  };

})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));

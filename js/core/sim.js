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
    this.f = []; this.proj = []; this.maxTime = opts.maxTime || 300;   // không giới hạn thật; 300 giây chỉ là chốt an toàn
    this.ot = false;   // hiệp phụ
    var i;
    for (i = 0; i < teamA.length; i++) this.f.push(this.mk(0, teamA[i]));
    for (i = 0; i < teamB.length; i++) this.f.push(this.mk(1, teamB[i]));
    // hào quang đội hình
    for (i = 0; i < this.f.length; i++) {
      var f = this.f[i];
      f.auraGuard = !!f.st.perks.guardian; f.auraLegion = f.g.talent === 'legionary'; f.auraInspire = !!f.st.perks.inspire;
    }
    this.initForms();
  }
  G.Battle = Battle;
  // sát thương vũ khí (thang của bản web) nhân hệ số này để hợp với lượng Máu kiểu bản Unity (110 ở cấp 1, +6 mỗi cấp)
  G.DMG_SCALE = 0.62 / (1 - 0.0675);   // nô lệ trung bình có sẵn 6,75% né (1,5% mỗi điểm Nhanh nhẹn): bù lại để trận không dài ra
  Battle.OT_AT = 30;

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
      downBy: -1, downLoc: null, overkill: 0, downT: 0,
      hd: team === 0 ? PI / 2 : -PI / 2, ride: st.mounted ? { mode: 'circle', dir: rng.next() < 0.5 ? 1 : -1, passT: 2 + rng.next() * 2, t: null } : null,
      pila: (g.x && g.x.pila) || 0, howlN: 0, howlT: g.x && g.x.howl ? g.x.howl.every : 0, chT: g.x && g.x.charge ? (g.x.charge.first != null ? g.x.charge.first : g.x.charge.every * 0.6) : 0, rush: null, sumT: g.x && g.x.summon && g.x.summon.every ? g.x.summon.every : 0, sumAt: 0, sumN: 0, roarT: g.x && g.x.roar ? 3 + rng.next() * 2 : 0, form: null, slot: null, dragBy: null, dragT: 0
    };
  };

  // ---------------------------------------------------------------- Đội hình (lê dương)
  // Thành viên cùng x.formation giữ chỗ của mình quanh một "mỏ neo" chung; mỏ neo tiến về phía địch,
  // dừng lại khi hàng đầu đã chạm địch. Mất người chỉ huy (x.leader) hoặc còn dưới hai người thì đội hình tan.
  Battle.prototype.initForms = function () {
    this.forms = [];
    var by = {}, i, f;
    for (i = 0; i < this.f.length; i++) {
      f = this.f[i]; var id = f.g.x && f.g.x.formation; if (!id) continue;
      var key = f.team + ':' + id; if (!by[key]) { by[key] = { team: f.team, m: [], leader: null, broken: false, x: 0, z: 0, face: f.face, holdT: 0 }; this.forms.push(by[key]); }
      by[key].m.push(f); f.form = by[key]; if (f.g.x.leader) by[key].leader = f;
    }
    for (var k = 0; k < this.forms.length; k++) {
      var F = this.forms[k], n = F.m.length;
      for (i = 0; i < n; i++) { F.x += F.m[i].x / n; F.z += F.m[i].z / n; }
      var fx = Math.sin(F.face), fz = Math.cos(F.face), rx = Math.cos(F.face), rz = -Math.sin(F.face);
      for (i = 0; i < n; i++) { f = F.m[i]; var dx = f.x - F.x, dz = f.z - F.z; f.slot = [dx * rx + dz * rz, dx * fx + dz * fz]; }
    }
  };
  Battle.prototype.slotPos = function (f, out) {
    var F = f.form, fx = Math.sin(F.face), fz = Math.cos(F.face), rx = Math.cos(F.face), rz = -Math.sin(F.face);
    out.x = F.x + rx * f.slot[0] + fx * f.slot[1]; out.z = F.z + rz * f.slot[0] + fz * f.slot[1]; return out;
  };
  Battle.prototype.updateForms = function (dt) {
    for (var k = 0; k < this.forms.length; k++) {
      var F = this.forms[k]; if (F.broken) continue;
      var alive = F.m.filter(function (f) { return f.alive; });
      if ((F.leader && !F.leader.alive) || alive.length < 2) {
        F.broken = true;
        for (var j = 0; j < alive.length; j++) { alive[j].retT = 0; this.emit({ e: 'effect', id: alive[j].id, type: 'broken' }); }
        continue;
      }
      var foes = this.foesOf(alive[0]); if (!foes.length) continue;
      var cx = 0, cz = 0, i; for (i = 0; i < foes.length; i++) { cx += foes[i].x; cz += foes[i].z; } cx /= foes.length; cz /= foes.length;
      var want = Math.atan2(cx - F.x, cz - F.z), d = angDiff(want, F.face), tr = 0.7 * dt;
      F.face += Math.abs(d) <= tr ? d : (d > 0 ? tr : -tr);
      // khoảng cách từ hàng đầu tới kẻ địch gần nhất
      var front = 1e9, pilaLeft = false, slow = 1e9, nearest = 1e9;
      for (i = 0; i < alive.length; i++) {
        var f = alive[i]; if (f.pila > 0) pilaLeft = true; slow = Math.min(slow, f.st.move);
        for (j = 0; j < foes.length; j++) { var de = dist(f, foes[j]); if (de < nearest) nearest = de; if (f.slot[1] >= -0.3 && de < front) front = de; }
      }
      if (pilaLeft && nearest < 8.5 && nearest > 3) F.holdT = Math.max(F.holdT, 0.25);   // dừng chân ném pilum
      if (F.holdT > 0) { F.holdT -= dt; continue; }
      var v = front > 1.5 ? slow * 0.55 : (front > 1.05 ? 0.25 : 0);
      F.x += Math.sin(F.face) * v * dt; F.z += Math.cos(F.face) * v * dt;
      var rr = Math.sqrt(F.x * F.x + F.z * F.z), lim = this.R - 2.2; if (rr > lim) { F.x *= lim / rr; F.z *= lim / rr; }
    }
  };
  var SP = { x: 0, z: 0 };
  Battle.prototype.thinkLegion = function (f, dt) {
    var foes = this.foesOf(f), i, e, best = null, bd = 1e9, near = null, nd = 1e9;
    for (i = 0; i < foes.length; i++) { e = foes[i]; var de = dist(f, e); if (de < nd) { nd = de; near = e; } if (de <= f.st.reach + 0.1 && de < bd) { bd = de; best = e; } }
    // một loạt pilum trước khi giáp lá cà
    if (f.pila > 0 && f.cd <= 0 && near && nd > 3 && nd < 8.5) {
      f.target = near; f.face = Math.atan2(near.x - f.x, near.z - f.z); f.pila--; this.startAttack(f, near, 'pila'); return;
    }
    if (best) {
      f.target = best;
      var want = Math.atan2(best.x - f.x, best.z - f.z); turn(f, want, 10, dt);
      if (f.cd <= 0 && Math.abs(angDiff(want, f.face)) < 0.6) { this.startAttack(f, best, null, false); return; }
    } else turn(f, near && nd < 4 ? Math.atan2(near.x - f.x, near.z - f.z) : f.form.face, 6, dt);
    if (f.net > 0) return;
    this.slotPos(f, SP);
    var dx = SP.x - f.x, dz = SP.z - f.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.06) { var sp = Math.min(f.st.move * (f.slowT > 0 ? f.slowF : 1), d * 5); f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; f.moving = true; }
  };

  // ---------------------------------------------------------------- Kỹ năng của trùm
  // howl: { every, dmg, max } — cứ mỗi `every` giây gầm lên, mỗi lần +dmg sát thương (cộng dồn tới max lần).
  // summon: { at: [ngưỡng máu…] | every: giây, max, foes: [định nghĩa e(...)] } — gọi viện binh chạy ra từ cổng.
  Battle.prototype.bossSkills = function (f, dt) {
    var x = f.g.x, H = x.howl, S = x.summon, C = x.charge;
    // xung phong: lao thẳng vào một mục tiêu (kẻ xa nhất nếu far), hất ngã những ai chắn đường
    if (C && !f.rush) {
      f.chT -= dt;
      if (f.chT <= 0 && f.state === 'idle' && f.stun <= 0 && f.net <= 0) {
        var fo = this.foesOf(f), tg = null, bd = C.far ? -1 : 1e9;
        for (var q = 0; q < fo.length; q++) { var dq = dist(f, fo[q]); if (dq < 2.5 && !C.whirl) continue; if (C.far ? dq > bd : dq < bd) { bd = dq; tg = fo[q]; } }
        if (tg) { f.rush = { t: tg, T: 2.4, hit: {} }; f.chT = C.every; this.emit({ e: 'effect', id: f.id, type: C.whirl ? 'whirl' : 'charge', to: tg.id }); }
        else f.chT = 1;
      }
    }
    if (H && f.howlN < H.max && f.stun <= 0) {
      f.howlT -= dt;
      if (f.howlT <= 0) { f.howlT = H.every; f.howlN++; this.emit({ e: 'effect', id: f.id, type: 'howl', n: f.howlN, pct: Math.round(f.howlN * H.dmg * 100) }); }
    }
    if (S && f.sumN < (S.max || 99)) {
      var go = false;
      if (S.at) { while (f.sumAt < S.at.length && f.hp / f.maxHp <= S.at[f.sumAt]) { f.sumAt++; go = true; } }
      else if (S.every) { f.sumT -= dt; if (f.sumT <= 0) { f.sumT = S.every; go = true; } }
      if (go) this.summon(f, S);
    }
  };
  Battle.prototype.doRush = function (f, dt) {
    var R = f.rush, t = R.t, C = f.g.x.charge;
    R.T -= dt;
    if (!t.alive || R.T <= 0 || f.net > 0) { f.rush = null; f.cd = Math.max(f.cd, 0.4); return; }
    var dx = t.x - f.x, dz = t.z - f.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001, ang = Math.atan2(dx, dz);
    f.face = ang; f.hd = ang;
    var sp = Math.max(f.st.move * 2.4, 8.5) * dt, ux = dx / d, uz = dz / d;
    f.x += ux * sp; f.z += uz * sp; f.moving = true;
    var W = C.whirl; if (W) R.spin = (R.spin || 0) + 18 * dt;   // chém xoay tròn: vừa lao vừa quay
    // những kẻ đứng chắn trên đường lao (chém xoay: mọi kẻ trong tầm kiếm)
    if (C.path || W) {
      var fo = this.foesOf(f);
      for (var i = 0; i < fo.length; i++) {
        var e = fo[i]; if (e === t || R.hit[e.id]) continue;
        var ex = e.x - f.x, ez = e.z - f.z, ed = Math.sqrt(ex * ex + ez * ez);
        if (W ? ed > W.r + e.st.radius : (ed > f.st.radius + e.st.radius + 0.4 || (ex * ux + ez * uz) < -0.2)) continue;
        R.hit[e.id] = 1;
        var r1 = this.rollOutcome(f, e, { unblockable: true });
        this.strike(f, e, { mul: W ? W.mul : (C.pathMul || 1), loc: 'body', out: r1.out === 'crit' ? 'crit' : (r1.out === 'dodge' ? 'dodge' : 'hit'), fl: r1.fl, kb: W ? 0.9 : 1.8, hand: 0, stun: W ? (W.stun || 0) : (C.stun || 1), sweep: true, notes: W ? ['Chém xoay'] : null }, true);
        if (this.over) return;
      }
    }
    if (d <= f.st.radius + t.st.radius + 0.35) {
      var r2 = this.rollOutcome(f, t, { unblockable: true });
      this.strike(f, t, { mul: C.mul, loc: r2.out === 'dodge' ? 'body' : this.rollLoc(f, t, 'def'), out: r2.out === 'block' ? 'hit' : r2.out, fl: r2.fl, kb: 1.6, hand: 0, stun: C.stun || 1, notes: ['Xung phong'] }, true);
      f.rush = null; f.cd = Math.max(f.cd, 0.5);
    }
  };
  Battle.prototype.summon = function (f, S) {
    var n = S.n || S.foes.length, side = f.team === 0 ? -1 : 1, gx = side * (this.R - 1.0);
    this.emit({ e: 'effect', id: f.id, type: 'summon' });
    for (var i = 0; i < n && f.sumN < (S.max || 99); i++) {
      var def = S.foes[i % S.foes.length], g = G.makeFoe(def, 50 + this.f.length, f.sumN * 131 + 7, f.g.x.summonMul || null);
      g.id = 'sum' + this.f.length;
      var nf = this.mk(f.team, { g: g, c: 0, r: 2 });
      nf.x = gx; nf.z = (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 1.1); nf.face = nf.hd = side > 0 ? -PI / 2 : PI / 2; nf.cd = 0.6;
      nf.auraGuard = !!nf.st.perks.guardian; nf.auraLegion = g.talent === 'legionary'; nf.auraInspire = !!nf.st.perks.inspire;
      this.f.push(nf); f.sumN++;
      this.emit({ e: 'spawn', id: nf.id, by: f.id });
    }
  };

  // ---------------------------------------------------------------- Kỵ binh
  // Ngựa có hướng chạy riêng (hd) và chỉ rẽ được từ từ: phi vòng quanh sân, xông qua mục tiêu rồi vòng lại.
  Battle.prototype.rideMove = function (f, dt, gx, gz, mul) {
    if (f.net > 0 || f.stun > 0) return;
    var want = Math.atan2(gx - f.x, gz - f.z), d = angDiff(want, f.hd), tr = 2.4 * dt;
    f.hd += Math.abs(d) <= tr ? d : (d > 0 ? tr : -tr);
    var sp = f.st.move * (mul || 1) * (f.slowT > 0 ? f.slowF : 1) * (Math.abs(d) > 1.2 ? 0.7 : 1);
    f.x += Math.sin(f.hd) * sp * dt; f.z += Math.cos(f.hd) * sp * dt; f.moving = true;
  };
  Battle.prototype.circleGoal = function (f, out) {
    var a = Math.atan2(f.x, f.z) + 0.75 * f.ride.dir, r = this.R - 2.1;
    out.x = Math.sin(a) * r; out.z = Math.cos(a) * r; return out;
  };
  // mục tiêu để móc kéo: kẻ đứng lẻ, đứng sau, ít giáp; tránh kẻ cầm giáo đang chờ
  Battle.prototype.pickRideTarget = function (f) {
    var foes = this.foesOf(f), best = null, bs = 1e9;
    for (var i = 0; i < foes.length; i++) {
      var e = foes[i], al = this.alliesOf(e), lone = 9;
      for (var j = 0; j < al.length; j++) lone = Math.min(lone, dist(al[j], e));
      var sc = dist(f, e) * 0.35 - Math.min(4, lone) * 1.1 + e.st.armorAvg * 0.25 - (e.K.ranged ? 1.5 : 0) + (e.kind === 'hasta' || e.kind === 'trident' ? 1.5 : 0) + (e.dragBy ? 9 : 0);
      if (sc < bs) { bs = sc; best = e; }
    }
    return this.tauntGuard(best, foes);   // kỵ binh móc kéo cũng bị kẻ khiêu khích hút
  };
  Battle.prototype.thinkRider = function (f, dt) {
    var R = f.ride, foes = this.foesOf(f); if (!foes.length) return;
    var ranged = f.K.ranged, i, e;
    R.passT -= dt;
    if (R.mode === 'circle') {
      if (!ranged && (f.sp <= 0 || R.passT <= 0)) { R.t = this.pickRideTarget(f); if (R.t) { R.mode = 'charge'; R.drag = f.sp <= 0 && f.st.mounted !== 'elephant'; R.chT = 4; } }
    }
    if (R.mode === 'charge' && (!R.t || !R.t.alive || (R.chT -= dt) <= 0)) { R.mode = 'circle'; R.passT = 3 + this.rng.next() * 2; }
    // ra đòn khi có kẻ trong tầm phía trước (cung kỵ bắn được mọi hướng)
    if (f.cd <= 0) {
      var tgt = null, td = 1e9;
      for (i = 0; i < foes.length; i++) {
        e = foes[i]; var de = dist(f, e);
        if (de > f.st.reach + 0.05) continue;
        if (!ranged && Math.abs(angDiff(Math.atan2(e.x - f.x, e.z - f.z), f.hd)) > 1.0) continue;
        if (ranged && de < 1.9) continue;
        var sc = de - (R.mode === 'charge' && e === R.t ? 5 : 0) + (ranged ? e.st.armorAvg * 0.3 : 0);
        if (sc < td) { td = sc; tgt = e; }
      }
      if (tgt) {
        f.target = tgt; f.face = Math.atan2(tgt.x - f.x, tgt.z - f.z);
        var drag = !ranged && R.mode === 'charge' && R.drag && tgt === R.t && f.sp <= 0;
        this.startAttack(f, tgt, drag ? 'drag' : null);
        if (R.mode === 'charge' && tgt === R.t) { R.mode = 'circle'; R.passT = 4 + this.rng.next() * 2; R.dir = this.rng.next() < 0.5 ? 1 : -1; }
        return;
      }
    }
    if (R.mode === 'charge') {
      var t = R.t, lead = 0.6;
      this.rideMove(f, dt, t.x + Math.sin(f.hd) * lead, t.z + Math.cos(f.hd) * lead, 1.12);
    } else { this.circleGoal(f, SP); this.rideMove(f, dt, SP.x, SP.z, 1); }
    f.face = f.hd;
    if (f.st.mounted === 'elephant') this.trample(f);
  };
  // Voi đang đi tới giẫm và hất văng mọi kẻ địch chắn trước mặt (mỗi người tối đa một lần mỗi 1,5 giây).
  Battle.prototype.trample = function (f) {
    if (!f.moving) return;
    var foes = this.foesOf(f), fx = Math.sin(f.hd), fz = Math.cos(f.hd);
    f.tramp = f.tramp || {};
    for (var i = 0; i < foes.length; i++) {
      var e = foes[i], dx = e.x - f.x, dz = e.z - f.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > f.st.radius + e.st.radius + 0.35 || (dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      if (f.tramp[e.id] != null && this.time - f.tramp[e.id] < 1.5) continue;
      f.tramp[e.id] = this.time;
      var ro = this.rollOutcome(f, e, { unblockable: true });
      this.strike(f, e, { mul: 1.0, loc: 'body', out: ro.out === 'dodge' ? 'dodge' : (ro.out === 'crit' ? 'crit' : 'hit'), fl: ro.fl, kb: 1.6, hand: 0, stun: 0.8, sweep: true, trample: true }, true);
      this.emit({ e: 'effect', id: e.id, type: 'trample', by: f.id });
    }
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
    // Hiệp phụ: từ giây 30, mọi người gây gấp đôi sát thương, đánh nhanh gấp đôi, chiêu hồi nhanh gấp đôi
    if (!this.ot && this.time >= Battle.OT_AT) { this.ot = true; this.emit({ e: 'overtime' }); }
    var F = this.f, i, f, ot = this.ot ? 2 : 1;
    for (i = 0; i < F.length; i++) {
      f = F[i]; if (!f.alive) continue;
      if (f.cd > 0) f.cd -= dt * ot;
      if (f.sp > 0) f.sp -= dt * ot;
      if (f.stun > 0) f.stun -= dt;
      if (f.net > 0) f.net -= dt;
      if (f.slowT > 0) f.slowT -= dt;
      if (f.boostT > 0) f.boostT -= dt;
      if (f.noBlock > 0) f.noBlock -= dt;
      if (f.goreT > 0) f.goreT -= dt;
      if (f.st.perks.regen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * dt);   // Sinh lực
      if (f.hate) { var hd = Math.exp(-dt / 3.5); for (var hk in f.hate) f.hate[hk] *= hd; }
      if (f.poison) {
        var P = f.poison; P.acc += dt; P.t -= dt;
        if (P.acc >= 0.5 || P.t <= 0) {
          var pd = P.dps * Math.min(P.acc, 0.5 + Math.max(0, P.t + 0)); pd = P.dps * P.acc; P.acc = 0;
          if (P.t <= 0) f.poison = null;
          if (pd > 0) { if (P.src) P.src.stats.dealt += pd; this.emit({ e: 'bleed', id: f.id, dmg: pd, poison: 1 }); this.damage(P.src, f, pd, 'body', true); }
        }
      }
      if (f.alive && f.bleed.length) {
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
    if (this.forms.length) this.updateForms(dt);
    for (i = 0; i < F.length; i++) { f = F[i]; if (f.alive && f.g.x && (f.g.x.howl || f.g.x.summon || f.g.x.charge)) this.bossSkills(f, dt); }
    for (i = 0; i < F.length; i++) { f = F[i]; if (f.alive) this.think(f, dt); if (this.over) return; }
    // kẻ bị móc kéo lê theo ngựa
    for (i = 0; i < F.length; i++) {
      f = F[i]; if (!f.dragBy) continue;
      var by = f.dragBy; f.dragT -= dt;
      if (!f.alive || !by.alive || f.dragT <= 0 || by.stun > 0 || by.net > 0) {
        f.dragBy = null; f.dragT = 0;
        if (f.alive) { this.stunOn(f, 0.7, by); this.emit({ e: 'effect', id: f.id, type: 'dragend', by: by.id }); }
        continue;
      }
      var tx = by.x - Math.sin(by.hd) * 1.15, tz = by.z - Math.cos(by.hd) * 1.15, kk = Math.min(1, dt * 10);
      f.x += (tx - f.x) * kk; f.z += (tz - f.z) * kk; f.stun = Math.max(f.stun, 0.1);
    }
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
            var wa = (a.st.mounted === 'elephant' || a.st.radius > 1.2) ? 0.03 : ((a.state === 'windup' || a.net > 0 || a.st.boss || a.st.mounted || a.st.beast === 'bear') ? 0.2 : (a.dragBy ? 0.05 : 1)), wc = (c.st.mounted === 'elephant' || c.st.radius > 1.2) ? 0.03 : ((c.state === 'windup' || c.net > 0 || c.st.boss || c.st.mounted || c.st.beast === 'bear') ? 0.2 : (c.dragBy ? 0.05 : 1));
            if (a.st.mounted && a.moving && !c.st.mounted) { wa = 0.05; wc = 1; } else if (c.st.mounted && c.moving && !a.st.mounted) { wc = 0.05; wa = 1; }   // ngựa đang phi húc dạt người
            var ws = wa + wc;
            a.x -= ux * push * 2 * wa / ws; a.z -= uz * push * 2 * wa / ws;
            c.x += ux * push * 2 * wc / ws; c.z += uz * push * 2 * wc / ws;
          }
        }
        var rr = Math.sqrt(a.x * a.x + a.z * a.z), lim = this.R - 0.15 - a.st.radius;
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
    if (G.hasTrait(f.g, 'rash')) return this.nearest(f);   // hấp tấp: lao vào kẻ gần nhất
    var best = null, bs = 1e9, ai = f.K.ai, allies = null;
    for (var i = 0; i < foes.length; i++) {
      var e = foes[i], d = dist(f, e), s = d;
      if (ai === 'breaker') s = d - e.st.armorAvg * 0.35;
      else if (ai === 'hunt') s = d * 0.55 + e.st.armorAvg * 0.6 + (e.st.hasShield && !e.shieldOff ? 1.5 : 0) - (f.kind === 'twin' && e.K.ranged ? 3 : 0);
      else if (ai === 'flank') s = d - (e.target && e.target !== f && e.target.alive ? 1.6 : 0) - (e.st.hasShield ? 1.0 : 0);
      else if (ai === 'ranged' && f.kind === 'bow') s = d * 0.15 - (e.K.ranged ? 6 : 0) + e.st.armorAvg * 0.45;   // cung: bắn kẻ đánh xa trước, rồi tới kẻ ít giáp
      else if (ai === 'ranged') s = d * 0.25 + (e.st.hasShield && !e.shieldOff ? 3 : 0) + (e.hp / e.maxHp) * 1.5;
      else if (f.st.beast === 'bear') { var cl = 0; for (var q = 0; q < foes.length; q++) if (foes[q] !== e && dist(foes[q], e) < 1.9) cl++; s = d - cl * 1.2; }
      else if (ai === 'support') {
        if (!allies) allies = this.alliesOf(f);
        for (var j = 0; j < allies.length; j++) if (allies[j].target === e && dist(allies[j], e) < 2.2) { s -= 1.5; break; }
      }
      // trùm quay sang kẻ vừa làm hắn đau nhất — nhất là kẻ ném lao từ xa
      if (f.hate && f.hate[e.id]) s -= Math.min(7, f.hate[e.id] / (f.maxHp * 0.015));
      if (e === f.target) s -= 1.2;
      if (e.g.talent === 'taunt' && d < 4) s -= 4;                       // kẻ khiêu khích hút đòn
      if (f.g.talent === 'archerhunter' && e.K.ranged) s -= 3;
      if (e.net > 0 && ai !== 'kite') s -= 0.8;
      // kỵ binh đang phi vòng: người đi bộ không đuổi kịp, chỉ đánh khi nó ở gần hoặc bị giữ chân
      if (e.ride && !f.K.ranged && !f.ride && e.st.mounted !== 'elephant' && d > 2.6 && e.net <= 0 && e.stun <= 0) s += 4;
      if (s < bs) { bs = s; best = e; }
    }
    return this.tauntGuard(best, foes, f.K.ranged);
  };
  // Kẻ khiêu khích bảo kê: ai định đánh một đồng đội đứng trong 3,5 m quanh hắn thì bị kéo sang đánh hắn (trừ đòn bắn từ xa).
  Battle.prototype.tauntGuard = function (best, foes, ranged) {
    if (!best || best.g.talent === 'taunt' || ranged) return best;
    for (var i = 0; i < foes.length; i++) { var e = foes[i]; if (e.g.talent === 'taunt' && e.stun <= 0 && dist(e, best) < 3.5) return e; }
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
    if (f.ride && (f.state === 'windup' || f.state === 'recover')) {   // ngựa vẫn phi khi kỵ sĩ ra đòn
      if (f.ride.mode === 'charge' && f.ride.t && f.ride.t.alive) this.rideMove(f, dt, f.x + Math.sin(f.hd) * 3, f.z + Math.cos(f.hd) * 3, 1);
      else { this.circleGoal(f, SP); this.rideMove(f, dt, SP.x, SP.z, 0.9); }
    }
    if (f.state === 'windup') {
      f.t += dt;
      if (a.special === 'pounce' && a.t.alive && f.t < a.hits[0].at) {   // sư tử phóng qua khoảng trống
        var px = a.t.x - f.x, pz = a.t.z - f.z, pd = Math.sqrt(px * px + pz * pz), stp = Math.max(0, pd - (f.st.radius + a.t.st.radius + 0.1));
        var mv = Math.min(stp, stp / Math.max(dt, a.hits[0].at - f.t + dt) * dt * 1.0); if (pd > 0.01) { f.x += px / pd * mv; f.z += pz / pd * mv; f.moving = true; }
      }
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

    // gấu gầm: choáng những kẻ đứng sát
    if (f.roarT > 0) {
      f.roarT -= dt;
      if (f.roarT <= 0) {
        var rf = this.foesOf(f), hit = 0;
        var rR = 2.6 + f.st.radius;   // gấu càng to tiếng gầm càng xa
        for (var ri = 0; ri < rf.length; ri++) if (dist(f, rf[ri]) < rR) hit++;
        if (hit) { this.emit({ e: 'effect', id: f.id, type: 'roar' }); for (ri = 0; ri < rf.length; ri++) if (dist(f, rf[ri]) < rR) this.stunOn(rf[ri], 0.9, f); f.roarT = (f.enraged ? 7 : 11) * f.st.spCdMul / (f.st.spCdMul || 1); f.cd = Math.max(f.cd, 0.5); return; }
        f.roarT = 1;
      }
    }
    if (f.rush) { this.doRush(f, dt); return; }
    if (f.ride) { this.thinkRider(f, dt); return; }
    // sư tử: vồ từ xa khi chiêu sẵn sàng
    if (f.kind === 'lion' && f.sp <= 0 && f.cd <= 0 && f.net <= 0) {
      var pt = f.target && f.target.alive ? f.target : this.pickTarget(f);
      if (pt) { var pdd = dist(f, pt); if (pdd > 2.4 && pdd < 6.2) { f.target = pt; f.face = Math.atan2(pt.x - f.x, pt.z - f.z); this.startAttack(f, pt, 'pounce'); return; } }
    }
    if (f.form && !f.form.broken) { this.thinkLegion(f, dt); return; }
    f.retT -= dt;
    if (!f.target || !f.target.alive || f.retT <= 0) { f.target = this.pickTarget(f); f.retT = 0.5 + this.rng.next() * 0.3; }
    t = f.target; if (!t) return;
    var ai = f.K.ai, reach = f.st.reach;
    var near = (ai === 'ranged' || ai === 'kite' || ai === 'support') ? this.nearest(f) : t;
    var dn = dist(f, near);
    var melee = false;
    if (ai === 'ranged' && dn < 1.9) { t = near; melee = true; reach = f.K.meleeReach; }
    // đánh xa: mục tiêu đã chọn ngoài tầm mà có kẻ khác trong tầm thì ném / bắn luôn kẻ đó (kẻ gần nhất trong tầm)
    // (cung thì khác: cung chủ đích bắn hàng sau, nên chỉ bắn tạm kẻ khác khi mục tiêu ưu tiên còn ở xa quá tầm hơn 4 m)
    if (ai === 'ranged' && !melee && f.cd <= 0.3 && dist(f, t) > reach && (f.kind !== 'bow' || dist(f, t) > reach + 4)) {
      var fs = this.foesOf(f), alt = null, ad = 1e9;
      for (var q = 0; q < fs.length; q++) { var dq = dist(f, fs[q]); if (dq <= reach && dq >= 1.9 && dq < ad) { ad = dq; alt = fs[q]; } }
      if (alt) { t = f.target = alt; f.retT = 0.8; }
    }
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
    var speed = f.st.move * (f.slowT > 0 ? f.slowF : 1) * (f.goreT > 0 ? 0.75 : 1) * (f.boostT > 0 ? 1.25 : 1) * (f.st.perks.sprint && this.time < 5 ? 1.4 : 1) * (f.kind === 'twin' && !f.opened ? 1.3 : 1);
    if (f.net > 0) return;
    var mx = 0, mz = 0, sp = speed;
    var rr0 = Math.sqrt(f.x * f.x + f.z * f.z);
    if (f.atWall) { if (rr0 < this.R - 2.6) f.atWall = false; } else if (rr0 > this.R - 1.5) f.atWall = true;
    var cornered = !!f.atWall;
    var nx = (f.x - near.x) / (dn || 1), nz = (f.z - near.z) / (dn || 1);
    if (ai === 'ranged') {
      // người cầm vũ khí tầm xa luôn muốn giữ kẻ địch gần nhất ở ngoài ~60% tầm bắn: bắn xong là lùi
      var keep = Math.max(4.0, f.st.reach * 0.6);
      if (near.K.ranged && !near.ride) keep = Math.min(keep, 2.2);   // kẻ gần nhất cũng đánh xa: lùi chẳng ích gì, cứ áp vào tầm mà ném
      // hai chế độ: "lùi" giữ khoảng cách, "trụ" đứng đánh (bị dồn sát rào thì hết đường lùi).
      // Có trễ và giữ mỗi chế độ ít nhất 0,8 giây để không đổi qua đổi lại từng khung hình.
      if (f.modeT > 0) f.modeT -= dt;
      var back = f.mode === 'back';
      if (back && cornered) back = false;                                   // chạm rào: dừng lùi ngay (trạng thái rào đã có trễ nên không bật lại)
      else if (!(f.modeT > 0)) back = back ? dn < keep + 0.6 : (dn < keep && !cornered);
      if ((back ? 'back' : 'hold') !== f.mode) { f.mode = back ? 'back' : 'hold'; f.modeT = 0.8; }
      if (back) { mx = nx; mz = nz; sp = speed * 0.9; }
      else {
        // tiến vào tầm có trễ: đã bước tới thì đi hẳn vào 75% tầm rồi mới dừng, kẻo mục tiêu nhích ra một bước là lại giật tới giật lui
        if (d > reach * 0.92) f.adv = true; else if (d < reach * 0.75) f.adv = false;
        if ((melee || dn >= keep) && (d > reach * 0.92 || (f.adv && !melee))) { mx = ux; mz = uz; }
      }
    } else if (ai === 'kite') {
      if (dn < (near.net > 0 ? reach * 0.9 : reach * 0.62) && !cornered) { mx = nx; mz = nz; sp = speed * 0.7; }
      else if (d > reach * 0.9) { mx = ux; mz = uz; }
    } else if (ai === 'support') {
      if (dn < reach * 0.5 && !cornered && near.st.reach < reach) { mx = nx; mz = nz; sp = speed * 0.5; }
      else if (d > reach * 0.92) { mx = ux; mz = uz; }
    } else if ((ai === 'flank' || ai === 'hunt' || (f.g.talent === 'assassin' && !f.K.ranged)) && t.target && t.target !== f && t.target.alive && d < 4) {
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
  var LOCW = { legs: [4, 14, 10, 72], def: [15, 45, 18, 22], trident: [8, 30, 12, 50], javelin: [10, 55, 15, 20], head: [55, 30, 10, 5], fist: [22, 58, 12, 8] };
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
    var pBlock = 0, pDefl = 0, reap = !!f.reap;   // Lưỡi hái: đòn sau khi hạ gục không thể bị chặn và chắc chắn chí mạng
    if (can && !o.unblockable && !reap && fl < 2) {
      if (t.st.hasShield && !t.shieldOff && t.noBlock <= 0) {
        pBlock = t.st.block + (o.missile ? t.st.missileBlock : 0) - f.st.antiBlock;
        // cựu lính lê dương đứng cạnh
        var al = this.alliesOf(t);
        for (var i = 0; i < al.length; i++) if (al[i].auraLegion && dist(al[i], t) < 2.1) { pBlock += 0.12; break; }
        if (f.kind === 'caestus') pBlock *= 0.6;   // đấm trong tầm khiên
        if (fl === 1 && !t.st.wall) pBlock *= 0.5;
        if (o.missile && t.form && !t.form.broken) pBlock += 0.2;   // đội hình giơ khiên đón tên
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
    var crit = this.rng.next() < f.st.crit || (o.forceCrit) || reap;
    if (reap) f.reap = false;
    return { out: crit ? 'crit' : 'hit', fl: fl };
  };

  Battle.prototype.startAttack = function (f, t, forced, melee) {
    var K = f.K, sp = forced || null, rng = this.rng;
    if (!sp && f.sp <= 0 && K.special.id !== 'net' && !(K.ranged && melee) && !(f.ride && !K.ranged)) sp = K.special.id;   // kỵ binh cầm giáo để dành chiêu cho cú móc kéo
    var ot = this.ot ? 2 : 1;
    var as = f.st.aspd * (f.net > 0 ? 0.5 : 1) * (f.enraged ? 1.5 : 1) * (1 + 0.04 * (f.frenzy || 0)) * (1 + 0.15 * (f.thirst || 0)) * ot;
    var tm = 1 / Math.min(1.35 * ot, Math.max(0.6, as));
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
    else if (sp === 'pila') { wu = 0.62; rec = 0.5; h = mkHit(wu, 1.15, 0, { missile: true, unblockable: true, table: 'javelin' }); h.pin = true; hits.push(h); missile = true; }
    else if (sp === 'drag') { wu = 0.26; h = mkHit(wu, 0.8, 0, { unblockable: true }); h.drag = true; hits.push(h); }
    else if (sp === 'maul') { wu *= 1.2; h = mkHit(wu, 1.4, 0, { unblockable: true }); h.stun = 1.6; h.maul = true; hits.push(h); }
    else if (sp === 'pounce') { wu = 0.5; rec = 0.45; h = mkHit(wu, 1.5, 0, { unblockable: true }); h.stun = 1.2; h.maul = true; hits.push(h); }
    else if (sp === 'hamstring') { h = mkHit(wu, 1.0, 0, { table: 'legs' }); h.loc = 'legs'; h.ham = true; hits.push(h); }
    else if (f.kind === 'claw') { hits.push({ at: wu, mul: 1, hand: f.hand, loc: 'body', out: 'hit', sweep: true }); f.hand = 1 - f.hand; }
    else if (f.kind === 'twin') { hits.push(mkHit(wu, 1, 0)); hits.push(mkHit(wu + 0.2, 1, 1)); }
    else if (f.kind === 'caestus' || f.kind === 'fist') { hits.push(mkHit(wu, 1, f.hand)); f.hand = 1 - f.hand; }
    else if (melee && K.ranged) { hits.push(mkHit(wu, K.meleeMul || 0.7, 0)); }
    else hits.push(mkHit(wu, 1, 0, { missile: missile, forceCrit: firstCrit }));
    var total = hits[hits.length - 1].at + rec;
    var interval = f.st.interval / as;
    if (sp && sp !== 'pila') { f.sp = K.special.cd * f.st.spCdMul; f.stats.specials++; }
    if (sp === 'pila') f.stats.specials++;
    f.atk = { t: t, hits: hits, i: 0, rec: rec, cdAfter: Math.max(0.05, interval - total), special: sp, missile: missile || sp === 'pin', melee: !!melee };
    f.state = 'windup'; f.t = 0;
    this.emit({ e: 'attack', a: f.id, d: t.id, kind: sp === 'pila' ? 'javelin' : f.kind, special: sp, windup: wu, recover: rec, hits: hits, melee: !!melee, mounted: !!f.ride, beast: f.st.beast || null });
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
    // đánh lan: mỗi đòn cận chiến của trùm còn trúng những kẻ đứng cạnh mục tiêu, phía trước mặt hắn
    var cv = (f.g.x && f.g.x.cleave) || (f.kind === 'axe' && !f.st.perks.quake ? 0.7 : 0);   // rìu hai tay: đòn nào cũng lan (búa Nứt đất lan theo vòng tròn quanh mục tiêu)
    if (cv && !a.missile && !h.sweep && f.alive && !this.over) {
      var fo = this.foesOf(f);
      for (i = 0; i < fo.length; i++) {
        var e2 = fo[i]; if (e2 === t || dist(f, e2) > f.st.reach + 0.35) continue;
        if (Math.abs(angDiff(Math.atan2(e2.x - f.x, e2.z - f.z), f.face)) > 1.25) continue;
        var r2 = this.rollOutcome(f, e2, {});
        this.strike(f, e2, { mul: h.mul * cv, loc: this.rollLoc(f, e2, 'def'), out: r2.out, arm: r2.arm, fl: r2.fl, kb: 0.6, hand: h.hand, sweep: true });
        if (this.over) return;
      }
    }
  };

  Battle.prototype.landProj = function (p) {
    var f = p.a, t = p.d;
    if (p.type === 'net') {
      if (!t.alive) return;
      var dur = 3.0 * Math.max(0, 1 - t.st.netRes) * (t.st.perks.stubborn ? 0.5 : 1) * (t.st.boss && !t.st.ccRes ? 0.45 : 1) * (1 - t.st.resist) * (t.st.ccMul || 1);
      if (dur <= 0.05) { this.emit({ e: 'effect', id: t.id, type: 'slip' }); return; }
      t.net = Math.max(t.net, dur);
      this.emit({ e: 'effect', id: t.id, type: 'net', dur: dur, by: f.id });
      return;
    }
    this.strike(f, t, p.h, true);
  };

  Battle.prototype.strike = function (f, t, h, viaProj) {
    var rng = this.rng, K = f.K, out = h.out;
    if (!t.alive || (!viaProj && !h.far && dist(f, t) > f.st.reach * 1.25 + 0.4)) {
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
      if (t.st.perks.riposte || t.g.talent === 'parry') t.riposte = true;
      t.kx += ux * 3.6; t.kz += uz * 3.6;
      if (t.st.perks.dodgeStep) t.boostT = 2;
      this.emit({ e: 'hit', a: f.id, d: t.id, out: 'dodge', loc: h.loc, dmg: 0, hand: h.hand, proj: !!viaProj });
      if (h.pin) return;
      return;
    }
    // sát thương gốc
    var base = f.st.weapon.dmg * f.st.dmgMul * h.mul * (0.88 + rng.next() * 0.24);
    var crit = out === 'crit';
    if (crit) base *= f.st.perks.critDmg ? 2.0 : 1.6;   // Mắt đại bàng
    if (fl === 2) { base *= (f.kind === 'twin' || f.g.talent === 'assassin' ? (f.kind === 'twin' && f.g.talent === 'assassin' ? 1.75 : 1.5) : 1.25); }
    if (f.g.talent === 'archerhunter' && t.K.ranged) base *= 1.3;
    if (h.loc === 'head') base *= 1.35;
    var g = f.g, notes = h.notes ? h.notes.slice() : [];
    if (!f.opened) { f.opened = true; if (f.st.perks.opener) { base *= 2; notes.push('Phủ đầu'); } }
    if (f.riposte) { f.riposte = false; base *= f.g.talent === 'parry' ? 2.2 : 1.7; notes.push(f.st.parry ? 'Đỡ gạt' : 'Phản đòn'); }
    if (f.howlN) base *= 1 + f.howlN * f.g.x.howl.dmg;
    if (this.ot) base *= 2;   // hiệp phụ
    if (this.time > 20) { if (G.hasTrait(g, 'stamina')) base *= 1.2; else if (G.hasTrait(g, 'winded')) base *= 0.8; }
    if (f.st.perks.execute && t.hp < t.maxHp * 0.35) base *= 1.45;
    if (f.st.perks.lastStand && f.hp < f.maxHp * 0.35) { base *= 1.3; notes.push('Tử thủ'); }
    if (f.st.perks.fourth && out !== 'block' && out !== 'dodge') { f.hitN = (f.hitN || 0) + 1; if (f.hitN % 4 === 0) { base *= 1.6; notes.push('Sấm sét'); } }
    if (!f.auraInspire) { var ia = this.alliesOf(f); for (var iq = 0; iq < ia.length; iq++) if (ia[iq].auraInspire && dist(ia[iq], f) < 3.1) { base *= 1.1; break; } } else if (this.alliesOf(f).some(function (o) { return o.auraInspire && dist(o, f) < 3.1; })) base *= 1.1;
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
    if (f.kind === 'bow' && viaProj && t.K.ranged) { base *= 1.4; notes.push('Khắc tầm xa'); }                    // cung: khắc chế kẻ đánh xa

    if (f.kind === 'twin' && t.K.ranged) base *= 1.25;                                                                 // song đao: xử kẻ đánh xa
                                // lao: khắc chế kẻ cầm khiên
    var aLoc = t.st.armor[h.loc] * (1 - 0.05 * (t.sunder || 0));
    if (f.kind === 'gladius') base *= 1 + 0.35 * Math.max(0, 1 - aLoc / 6);                                            // kiếm: mạnh trước kẻ không giáp
    if (f.kind === 'crossbow' && viaProj) base *= 1 + Math.min(0.25, aLoc * 0.025);                                    // nỏ: giáp càng dày càng đau
    // giáo đón ngựa: kỵ binh đang xông tới ăn trọn mũi giáo và khựng lại
    if (t.ride && !viaProj && (f.kind === 'hasta' || f.kind === 'trident')) { base *= 1.3; if (t.ride.mode === 'charge') { t.ride.mode = 'circle'; t.ride.passT = 3; this.stunOn(t, 0.7, f); notes.push('Chặn ngựa'); } }

    if (out === 'block') {
      t.stats.blocked++; f.stats.blockedBy++;
      if (t.st.perks.riposte || t.g.talent === 'parry' || t.st.parry) t.riposte = true;   // khiên nhỏ: đỡ gạt
      if (t.st.perks.blockStun && !viaProj && !h.arm && f.alive) this.stunOn(f, 0.3, t);     // Khiên dội
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
      if (t.st.hasShield && !t.shieldOff) {
        // cây lao cắm vào khiên: khiên vô dụng 3 giây, rồi giật ra được
        var pd = (f.st.weapon && f.st.weapon.pinDur) || 3;   // pilum: cọng sắt cong lại, giữ khiên lâu hơn
        t.noBlock = Math.max(t.noBlock, pd); base *= 0.5;
        this.emit({ e: 'effect', id: t.id, type: 'shieldoff', by: f.id, dur: pd });
      } else base *= 1.6;
    }
    // giáp
    var pen = h.pen != null ? h.pen : f.st.pen;
    var arm = t.st.armor[h.loc] * (1 - 0.05 * (t.sunder || 0)) * (1 - pen);   // giáp đã bị chùy đập móp
    var dmg = (arm > 0 ? base * base / (base + arm * G.ARMOR_K) : base) * G.DMG_SCALE;   // giáp ăn đòn nhẹ nhiều hơn đòn nặng
    base *= G.DMG_SCALE;
    // giảm sát thương phía mục tiêu
    if (t.st.perks.grit && t.hp < t.maxHp * 0.35) dmg *= 0.65;
    var ta = this.alliesOf(t), gd = false, lg = false;
    for (i = 0; i < ta.length; i++) {
      if (dist(ta[i], t) < 2.1) { if (ta[i].auraGuard) gd = true; if (ta[i].auraLegion) lg = true; }
    }
    if (gd) dmg *= 0.85;
    if (lg) dmg *= 0.9;
    for (i = 0; i < ta.length; i++) {   // lá chắn sống: chịu thay 30% cho đồng đội yếu nhất đứng gần
      var bg = ta[i]; if (bg.g.talent !== 'bodyguard' || dist(bg, t) > 3) continue;
      var weakest = t, wr = t.hp / t.maxHp, al3 = this.alliesOf(bg);
      for (var k3 = 0; k3 < al3.length; k3++) if (dist(al3[k3], bg) <= 3 && al3[k3].hp / al3[k3].maxHp < wr) { wr = al3[k3].hp / al3[k3].maxHp; weakest = al3[k3]; }
      if (weakest !== t) continue;
      var share = dmg * 0.3; dmg -= share; bg.stats.absorbed += share;
      this.emit({ e: 'effect', id: bg.id, type: 'cover', amount: share, for: t.id });
      this.damage(f, bg, share, 'body', true);
      break;
    }
    t.stats.absorbed += Math.max(0, base - dmg);
    if (f.st.perks.frenzy) f.frenzy = Math.min(5, (f.frenzy || 0) + 1);
    f.stats.hits++; if (crit) f.stats.crits++; if (fl === 2) f.stats.flank++;
    f.stats.dealt += dmg;
    if (t.hate) { t.hate[f.id] = (t.hate[f.id] || 0) + dmg * (viaProj ? 2.2 : 1); if (viaProj) t.retT = 0; }
    // đẩy lùi
    var kb = (h.kb != null ? h.kb : (f.kind === 'axe' ? 0.55 : (f.kind === 'mace' ? 0.3 : 0.14))) * steady * (t.st.boss ? 0.3 : 1);
    t.kx += ux * kb * 12; t.kz += uz * kb * 12;
    // hiệu ứng
    var rs = (1 - t.st.resist) * (t.st.ccMul || 1), nb = !!t.st.perks.noBleed;   // kháng hiệu ứng: mọi hiệu ứng xấu ngắn lại
    if (h.stun) this.stunOn(t, h.stun, f);
    if (h.maul && !nb) { t.bleed.push({ t: 4 * rs, dps: base * 0.12, src: f }); this.emit({ e: 'effect', id: t.id, type: 'bleed', dur: 4 * rs, by: f.id }); }
    if (h.ham) { if (!t.st.perks.unslowed) { t.slowT = 3 * rs; t.slowF = 0.6; this.emit({ e: 'effect', id: t.id, type: 'slow', dur: 3 * rs, by: f.id }); } if (!nb) t.bleed.push({ t: 3 * rs, dps: base * 0.1, src: f }); }
    if (h.drag && t.alive && !t.st.boss && !t.st.mounted && t.st.beast !== 'bear' && t.g.talent !== 'slippery') { t.dragBy = f; t.dragT = 1.4 * rs; t.stun = Math.max(t.stun, 0.2); if (t.atk) { t.atk = null; this.emit({ e: 'cancel', id: t.id }); t.state = 'stun'; } this.emit({ e: 'effect', id: t.id, type: 'drag', by: f.id, dur: t.dragT }); }
    if (h.hook) { t.noBlock = 3 * rs; if (!nb) { t.bleed.push({ t: 5 * rs, dps: base * 0.14, src: f }); this.emit({ e: 'effect', id: t.id, type: 'bleed', dur: 5 * rs, by: f.id }); } }
    else if (f.kind === 'sica' && !nb) { t.bleed.push({ t: 4 * rs, dps: dmg * (crit ? 0.12 : 0.06), src: f }); if (crit) this.emit({ e: 'effect', id: t.id, type: 'bleed', dur: 4 * rs, by: f.id }); }   // đao cong: nhát nào cũng rỉ máu
    if (f.kind === 'mace' && (t.sunder || 0) < 6 && t.st.armor[h.loc] > 0) { t.sunder = (t.sunder || 0) + 1; this.emit({ e: 'effect', id: t.id, type: 'sunder', n: t.sunder }); }   // chùy: mỗi đòn làm móp giáp −5%, tối đa −30%
    if (f.kind === 'trident' && !nb && !t.st.perks.unslowed) { t.slowT = 2 * rs; t.slowF = h.loc === 'legs' ? 0.55 : 0.75; this.emit({ e: 'effect', id: t.id, type: 'slow', dur: 2 * rs, by: f.id }); }
    this.emit({ e: 'hit', a: f.id, d: t.id, out: out === 'block' ? 'hit' : out, through: out === 'block', loc: h.loc, dmg: dmg, fl: fl, hand: h.hand, proj: !!viaProj, notes: notes, sweep: !!h.sweep, kb: kb });
    // hiệu ứng của đồ hiếm
    if (f.st.perks.bleedHit && !h.hook && !nb) t.bleed.push({ t: 3 * rs, dps: dmg * 0.1, src: f });
    if (f.st.perks.stagger && !h.stun && rng.next() < 0.18) this.stunOn(t, 0.5, f);
    if (f.st.perks.critStun && crit && !h.stun) this.stunOn(t, 0.6, f);   // Tay búa
    if (f.st.perks.venom && dmg > 0 && t.alive) {   // Tẩm độc: 1,5% máu tối đa mỗi giây trong 2 giây, không cộng dồn (cùng ô với độc của Độc sư: giữ liều mạnh hơn)
      var vd = t.maxHp * 0.015 * (t.st.boss ? 0.35 : 1), fresh2 = !t.poison;
      t.poison = { t: 2 * rs, dps: Math.max(vd, t.poison ? t.poison.dps : 0), src: f, acc: t.poison ? t.poison.acc : 0 };
      if (fresh2) this.emit({ e: 'effect', id: t.id, type: 'poison', dur: 2 * rs, by: f.id });
    }
    if (f.st.perks.skull && !h.stun && rng.next() < 0.2) { this.stunOn(t, 1.0, f); this.emit({ e: 'effect', id: t.id, type: 'skull', by: f.id }); }   // Đập sọ (chùy Thần khí)
    if (f.st.perks.leech && f.alive && dmg > 0 && f.hp < f.maxHp) { var lh = Math.min(f.maxHp - f.hp, dmg * 0.15); f.hp += lh; f.leechAcc = (f.leechAcc || 0) + lh; if (f.leechAcc >= f.maxHp * 0.04) { this.emit({ e: 'effect', id: f.id, type: 'heal', amount: f.leechAcc }); f.leechAcc = 0; } }   // Hút máu (song đao Thần khí)
    if (f.g.talent === 'poisoner' && dmg > 0 && t.alive) {   // Độc sư: trúng độc 2 giây, không cộng dồn — đòn sau làm mới
      var fresh = !t.poison; t.poison = { t: 2 * rs, dps: f.g.lvl, src: f, acc: t.poison ? t.poison.acc : 0 };
      if (fresh) this.emit({ e: 'effect', id: t.id, type: 'poison', dur: 2 * rs, by: f.id });
    }
    this.damage(f, t, dmg, h.loc, false);
    if (t.st.perks.thorns && !viaProj && f.alive && !this.over) { var th = Math.max(1, dmg * 0.15); t.stats.dealt += th; this.emit({ e: 'bleed', id: f.id, dmg: th }); this.damage(t, f, th, 'arms', true); }
  };

  // ---------------------------------------------------------------- hiệu ứng huyền thoại riêng của từng loại vũ khí
  // Bọc quanh strike(): chỉnh hệ số trước khi đánh, rồi sinh các đòn phụ (echo) sau khi đòn chính đã xử xong.
  var strikeCore = Battle.prototype.strike;
  Battle.prototype.strike = function (f, t, h, viaProj) {
    var P = f.st.perks, self = this, rng = this.rng, main = !h.echo, pre = t.hp;
    function ext(o) { var c = {}; for (var k in h) c[k] = h[k]; for (k in o) c[k] = o[k]; return c; }
    function echo(e, mul, note, proj) {   // một đòn phụ vào e
      if (!e || !e.alive || self.over) return;
      var ro = self.rollOutcome(f, e, { missile: !!proj });
      strikeCore.call(self, f, e, { mul: mul, loc: self.rollLoc(f, e, 'def'), out: ro.out, arm: ro.arm, fl: ro.fl, kb: 0.5, hand: h.hand || 0, echo: true, sweep: true, far: true, notes: note ? [note] : null }, !!proj);
    }
    var second = null;
    if (t.goreT > 0) h = ext({ mul: h.mul * 1.2 });                                                         // Máu loang: nạn nhân nhận thêm 20% từ mọi nguồn
    if (main && viaProj) {
      if (P.sniper) h = ext({ mul: h.mul * (1 + Math.min(0.4, 0.05 * dist(f, t))) });                       // Bắn tỉa
      if (P.twoShot && !h.pin) {                                                                             // Song tiễn: kẻ địch gần mục tiêu nhất, còn trong tầm
        var fo0 = this.foesOf(f), bd = 1e9;
        for (var q = 0; q < fo0.length; q++) { var e0 = fo0[q]; if (e0 === t || dist(f, e0) > f.st.reach + 0.5) continue; var d0 = dist(t, e0); if (d0 < bd) { bd = d0; second = e0; } }
        if (second) h = ext({ mul: h.mul * 0.75 });
      }
    }
    var ux = t.x - f.x, uz = t.z - f.z, ul = Math.sqrt(ux * ux + uz * uz) || 1; ux /= ul; uz /= ul;
    strikeCore.call(this, f, t, h, viaProj);
    if (this.over) return;
    var dealt = Math.max(0, pre - Math.max(0, t.hp)), landed = dealt > 0.01, fo, i, e;
    if (second) { this.emit({ e: 'proj', type: f.K.proj || 'arrow', a: f.id, d: second.id, dur: 0.12, out: 'hit', loc: 'body' }); echo(second, h.mul, 'Song tiễn', true); }
    if (main && landed) {
      if (P.bloodaxe && !f.g.gear.body && f.alive && f.hp < f.maxHp) { var hl = Math.min(f.maxHp - f.hp, dealt * 0.4); f.hp += hl; f.leechAcc = (f.leechAcc || 0) + hl; if (f.leechAcc >= f.maxHp * 0.04) { this.emit({ e: 'effect', id: f.id, type: 'heal', amount: f.leechAcc }); f.leechAcc = 0; } }
      if (P.gore) t.goreT = 4 * (1 - t.st.resist) * (t.st.ccMul || 1);
      if (P.pinfoot && h.out === 'crit' && t.alive && !t.st.perks.unslowed) { var pd = 1.5 * (1 - t.st.resist) * (t.st.ccMul || 1); t.slowT = Math.max(t.slowT, pd); t.slowF = 0; this.emit({ e: 'effect', id: t.id, type: 'pinfoot', dur: pd, by: f.id }); }
      if (P.combo3 && !viaProj) { f.c3 = (f.c3 || 0) + 1; if (f.c3 % 3 === 0) echo(t, 1.0, 'Liên hoàn'); }
    }
    if (main && !h.sweep && f.alive) {
      if (P.quake && !viaProj) { fo = this.foesOf(f); for (i = 0; i < fo.length; i++) { e = fo[i]; if (e !== t && dist(t, e) <= 1.5 + e.st.radius) echo(e, h.mul * 0.7, 'Nứt đất'); } this.emit({ e: 'effect', id: t.id, type: 'quake', by: f.id }); }
      if (P.whirl3 && !viaProj) { f.w3 = (f.w3 || 0) + 1; if (f.w3 % 3 === 0) { fo = this.foesOf(f); for (i = 0; i < fo.length; i++) { e = fo[i]; if (e !== t && dist(f, e) <= 2.0 + e.st.radius) echo(e, h.mul, 'Lốc xoáy'); } this.emit({ e: 'effect', id: f.id, type: 'whirlaxe' }); } }
      if ((P.skewer && !viaProj) || (P.pierce && viaProj && !h.pin)) {   // Xiên que / Xuyên táo: một kẻ ngay sau mục tiêu theo hướng đòn
        fo = this.foesOf(f); var best = null, bdist = P.skewer && !viaProj ? 1.5 : 2.0;
        for (i = 0; i < fo.length; i++) { e = fo[i]; if (e === t) continue; var ex = e.x - t.x, ez = e.z - t.z, ed = Math.sqrt(ex * ex + ez * ez); if (ed <= bdist + e.st.radius && ex * ux + ez * uz > 0.2 * ed) { bdist = ed - e.st.radius; best = e; } }
        if (best && landed) echo(best, h.mul * 0.6, viaProj ? 'Xuyên táo' : 'Xiên que', viaProj);
      }
    }
    // Phản kiếm: người cầm kiếm không khiên chém trả kẻ vừa đánh mình
    var TP = t.st.perks;
    if (TP.counter && !h.counter && !viaProj && t.alive && f.alive && !t.st.hasShield && t.stun <= 0 && t.net <= 0 && dist(f, t) <= t.st.reach * 1.25 + 0.4 && rng.next() < 0.6) {
      var rc = this.rollOutcome(t, f, {});
      this.emit({ e: 'effect', id: t.id, type: 'counter', by: f.id });
      strikeCore.call(this, t, f, { mul: 1, loc: this.rollLoc(t, f, 'def'), out: rc.out, arm: rc.arm, fl: rc.fl, kb: 0.4, hand: 0, echo: true, counter: true, notes: ['Phản kiếm'] }, false);
    }
  };

  // Làm choáng: tính cả giày bám cát, kháng hiệu ứng của mũ, "Tỉnh đòn\"
  Battle.prototype.stunOn = function (t, base, f) {
    if (t.st.perks.stunGuard && !t.usedGuard) { t.usedGuard = true; this.emit({ e: 'effect', id: t.id, type: 'guard', by: f.id }); return; }
    var sd = base * (1 - t.st.steady) * (t.st.perks.stubborn ? 0.5 : 1) * (t.st.boss && !t.st.ccRes ? 0.4 : 1) * (1 - t.st.resist) * (t.st.ccMul || 1);
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
      t.usedSecond = true; var heal = t.maxHp * 0.2; t.hp += heal;
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
        if (G.hasTrait(f.g, 'bloodthirst')) f.thirst = (f.thirst || 0) + 1;
        if (f.st.perks.reap && f.alive) f.reap = true;   // Lưỡi hái: đòn kế tiếp chắc chắn chí mạng
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

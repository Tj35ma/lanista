// LANISTA — trình diễn trận đấu: chạy mô phỏng theo thời gian thực và biến sự kiện thành chuyển động, máu, âm thanh.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, A = V.Anim;
  var STEP = 1 / 60;
  var p1 = new T.Vector3(), p2 = new T.Vector3(), p3 = new T.Vector3(), sp = { x: 0, y: 0, behind: false };

  function snd(name, o) { if (G.Audio && G.Audio.play) G.Audio.play(name, o); }
  function vary() { return { pitch: 0.92 + Math.random() * 0.16 }; }
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = document.createElement('style');
    s.textContent = '.hpb{position:absolute;width:46px;height:5px;margin-left:-23px;background:rgba(20,14,10,.75);border:1px solid rgba(0,0,0,.6);box-sizing:border-box;pointer-events:none}' +
      '.hpb i{display:block;height:100%;transition:width .12s linear}.hpb.t0 i{background:#d9562c}.hpb.t1 i{background:#4d8fbd}.hpb.boss{width:110px;margin-left:-55px;height:7px}' +
      '.hpb b{position:absolute;left:50%;top:-15px;transform:translateX(-50%);font:10px "Palatino Linotype","Book Antiqua",serif;color:#e6d6b4;opacity:.85;white-space:nowrap;text-shadow:0 1px 2px #000;font-weight:normal}.hpb.boss b{font-size:12px;opacity:1;top:-17px}' +
      '.hpb u{position:absolute;right:-9px;top:-3px;width:7px;height:7px;border-radius:50%;text-decoration:none}' +
      '.ft{position:absolute;transform:translate(-50%,-50%);font:700 15px "Palatino Linotype","Book Antiqua",serif;color:#f3e3bd;text-shadow:0 1px 3px #000,0 0 2px #000;pointer-events:none;white-space:nowrap;animation:ftup .95s ease-out forwards}' +
      '.ft.dmg{color:#ffd9b0}.ft.crit{color:#ffb347;font-size:21px}.ft.small{font-size:12px;color:#c9b99a}.ft.bad{color:#ff7a5a}.ft.sp{color:#ffe08a;font-size:14px;font-variant:small-caps;letter-spacing:.5px}.ft.heal{color:#a8d08a}' +
      '@keyframes ftup{0%{opacity:0;margin-top:6px}12%{opacity:1}70%{opacity:1}100%{opacity:0;margin-top:-34px}}';
    document.head.appendChild(s);
  }

  function BattleView(scene, battle, opts) {
    opts = opts || {};
    this.scene = scene; this.b = battle; this.env = opts.env; this.cb = opts.cb || {}; this.quiet = !!opts.quiet;
    this.fx = new V.Fx(scene); this.sched = []; this.acc = 0; this.clock = 0; this.running = false; this.figs = []; this.bars = []; this.trails = []; this.drops = []; this.onShake = opts.onShake || null;
    var self = this;
    for (var i = 0; i < battle.f.length; i++) {
      var f = battle.f[i], fig = V.makeFig(f.g, f.team);
      scene.add(fig.group);
      if (opts.intro) fig.place((f.team === 0 ? -1 : 1) * 8.3, f.z * 0.3, f.ride ? f.hd : f.face); else fig.place(f.x, f.z, f.ride ? f.hd : f.face);
      fig.onStep = function (pos, s, yaw) { self.fx.print(pos, yaw); if (s > 2.4) self.fx.puff(pos, 1, 0.45); if (s > 1 && !self.quiet && Math.random() < 0.5) snd('step', { vol: 0.35, pitch: 0.85 + Math.random() * 0.3 }); };
      this.figs.push(fig);
    }
    if (!this.quiet && V.overlay) { style(); this.makeBars(); }
    this.introT = opts.intro ? 0 : -1; this.introDur = 1.7;   // hai đội chạy từ cổng ra vị trí trước khi kèn nổi
  }
  V.BattleView = BattleView;

  BattleView.prototype.makeBars = function () { for (var i = 0; i < this.b.f.length; i++) this.makeBar(this.b.f[i]); };
  BattleView.prototype.makeBar = function (f) {
    var el = document.createElement('div');
    el.className = 'hpb t' + f.team + (f.st.boss ? ' boss' : '');
    el.innerHTML = '<b>' + f.name + '</b><i style="width:100%"></i>';
    V.overlay.appendChild(el); this.bars.push({ el: el, bar: el.querySelector('i'), hp: -1 });
  };
  // viện binh của trùm chạy ra từ cổng
  BattleView.prototype.on_spawn = function (ev) {
    var self = this, f = this.b.f[ev.id], fig = V.makeFig(f.g, f.team);
    this.scene.add(fig.group); fig.place(f.x, f.z, f.ride ? f.hd : f.face);
    fig.onStep = function (pos, s, yaw) { self.fx.print(pos, yaw); if (s > 2.4) self.fx.puff(pos, 1, 0.45); };
    this.figs[ev.id] = fig;
    if (!this.quiet && V.overlay) { style(); this.makeBar(f); }
    this.fx.puff(p2.set(f.x, 0, f.z), 6, 1.0);
  };
  BattleView.prototype.float = function (fig, text, cls, dy) {
    if (this.quiet || !V.overlay) return;
    fig.headTop(p3); p3.y += 0.25 + (dy || 0); V.project(p3, sp); if (sp.behind) return;
    var el = document.createElement('div'); el.className = 'ft ' + (cls || ''); el.textContent = text;
    el.style.left = (sp.x + (Math.random() - 0.5) * 26) + 'px'; el.style.top = sp.y + 'px';
    V.overlay.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
  };
  BattleView.prototype.at = function (delay, fn) { this.sched.push({ t: this.clock + Math.max(0, delay), fn: fn }); };
  BattleView.prototype.start = function () { this.running = true; };
  BattleView.prototype.posOf = function (fig, out) { return out.set(fig.base.x, 1.15, fig.base.z); };

  BattleView.prototype.update = function (dt) {
    var b = this.b, i;
    this.clock += dt;
    if (this.running && !b.over) {
      this.acc += dt;
      while (this.acc >= STEP && !b.over) { b.step(STEP); this.acc -= STEP; this.pump(); }
    } else if (b.events.length) this.pump();
    for (i = this.sched.length - 1; i >= 0; i--) if (this.sched[i].t <= this.clock) { var s = this.sched[i]; this.sched.splice(i, 1); s.fn(); }
    var iu = 1;
    if (this.introT >= 0) { this.introT += dt; iu = V.smooth(Math.min(1, this.introT / this.introDur)); if (this.introT >= this.introDur + 0.3) { this.introT = -1; this.running = true; } }
    for (i = 0; i < this.figs.length; i++) {
      var f = b.f[i], fig = this.figs[i];
      var face = f.ride ? f.hd : f.face; if (f.rush && f.rush.spin) face += f.rush.spin;   // kỵ sĩ ngồi thẳng theo hướng ngựa chạy
      if (iu < 1) { var gx = (f.team === 0 ? -1 : 1) * 8.3, gz = f.z * 0.3; fig.setBase(gx + (f.x - gx) * iu, gz + (f.z - gz) * iu, face); }
      else fig.setBase(f.x, f.z, face);
      if (f.alive) A.setState(fig, f.stun > 0 ? 'stun' : (f.net > 0 ? 'net' : (this.won === f.team ? 'win' : 'stance')));
      A.update(fig, dt);
      var sn = A.strikeNode(fig);
      if (sn) {
        var nd = fig.n[sn], tr = this.trails[i] || (this.trails[i] = this.fx.trail()), fist = sn.charAt(0) === 'h', L = fist ? 0.07 : fig.tip + (fig.R.ws || 0) * fig.D.S;
        nd.updateWorldMatrix(true, false);
        p1.set(0, L, 0); nd.localToWorld(p1); p2.set(0, fist ? -0.1 : L * 0.6, 0); nd.localToWorld(p2);
        tr.push(p1, p2, fig.kind === 'axe' || fig.kind === 'mace' ? 1.5 : 1);
      }
    }
    this.fx.update(dt);
    if (this.drops.length) this.updateDrops(dt);
    if (this.bars.length) for (i = 0; i < this.figs.length; i++) {
      var br = this.bars[i]; f = b.f[i];
      if (!f.alive) { if (br.hp !== 0) { br.hp = 0; br.el.style.display = 'none'; } continue; }
      this.figs[i].headTop(p3); p3.y += 0.12; V.project(p3, sp);
      br.el.style.transform = 'translate(' + Math.round(sp.x) + 'px,' + Math.round(sp.y) + 'px)';
      if (br.hp !== f.hp) { br.hp = f.hp; br.bar.style.width = Math.max(0, f.hp / f.maxHp * 100).toFixed(1) + '%'; }
    }
  };

  BattleView.prototype.pump = function () {
    var ev = this.b.events;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      try { if (this['on_' + e.e]) this['on_' + e.e](e); } catch (err) { console.error(err); }
      if (this.cb.onEvent) this.cb.onEvent(e, this.b);
    }
    ev.length = 0;
  };

  var SPN = { pila: 'Pilum', drag: 'Móc kéo', maul: 'Vồ', hamstring: 'Đớp gân' };
  BattleView.prototype.on_attack = function (ev) {
    var self = this, a = this.figs[ev.a], d = this.figs[ev.d], K = G.WKIND[ev.kind];
    A.attack(a, ev, d);
    var missile = (K.ranged && !ev.melee) || ev.special === 'pin' || ev.special === 'pila';
    if (ev.special) this.float(a, SPN[ev.special] || K.special.name, 'sp', 0.2);
    if (ev.special === 'maul' || ev.special === 'drag') snd('swingHeavy', vary());
    var heavy = ev.kind === 'axe' || ev.kind === 'mace';
    ev.hits.forEach(function (h) {
      self.at(h.at - 0.11, function () { if (!a.dead) snd(heavy ? 'swingHeavy' : 'swing', vary()); });
      if (missile || ev.special === 'sweep' || ev.special === 'net') return;
      if (h.out === 'block') { var lead = Math.min(0.18, h.at); self.at(h.at - lead, function () { A.react(d, 'block', { from: self.posOf(a, new T.Vector3()), loc: h.loc, lead: lead, arm: h.arm }); }); }
      else if (h.out === 'dodge') self.at(h.at - 0.12, function () { A.react(d, 'dodge', { from: self.posOf(a, new T.Vector3()), side: Math.random() < 0.5 ? 1 : -1 }); });
    });
  };

  BattleView.prototype.on_hit = function (ev) {
    var a = this.figs[ev.a], d = this.figs[ev.d], fa = this.b.f[ev.a], fd = this.b.f[ev.d];
    this.posOf(a, p1);
    if (ev.out === 'hit' || ev.out === 'crit') {
      var pw = V.clamp(ev.dmg / fd.maxHp * 7, 0.5, 1.7);
      A.react(d, 'flinch', { from: p1.clone(), power: pw });
      d.point(ev.loc, p1, p2);
      p3.set(d.base.x - a.base.x, 0, d.base.z - a.base.z).normalize();
      this.fx.bleed(p2, p3, pw * (ev.out === 'crit' ? 1.3 : 0.7));
      if (ev.out === 'crit' || Math.random() < 0.2) this.fx.stain(d.base.x + p3.x * 0.3 + (Math.random() - 0.5) * 0.4, d.base.z + p3.z * 0.3 + (Math.random() - 0.5) * 0.4, 0.08 + pw * 0.08);
      var kd = fa.kind;
      snd(ev.out === 'crit' ? 'crit' : (kd === 'axe' || kd === 'mace' ? 'hitHeavy' : (kd === 'fist' || kd === 'caestus' ? 'punch' : 'hitFlesh')), vary());
      if (ev.through) snd('block', vary());
      this.float(d, '−' + Math.max(1, Math.round(ev.dmg)) + (ev.out === 'crit' ? '!' : ''), ev.out === 'crit' ? 'crit' : 'dmg');
      if (ev.out === 'crit' || ev.fl === 2) this.cheer(0.35);
      if (this.onShake) this.onShake(ev.out === 'crit' ? 0.11 : (kd === 'axe' || kd === 'mace' ? 0.09 : 0.03));
      if (ev.sweep) this.fx.puff(p2.set(d.base.x, 0, d.base.z), 2, 0.8);
    } else if (ev.out === 'block') {
      if (ev.arm) d.point('arms', p1, p2); else d.point('shield', null, p2);
      this.fx.sparks(p2, ev.arm ? 5 : 3);
      snd(ev.arm ? 'clang' : 'block', vary());
      this.float(d, 'Chặn', 'small');
    } else if (ev.out === 'dodge') { snd('dodge', vary()); this.float(d, 'Né', 'small'); }
  };

  BattleView.prototype.on_proj = function (ev) {
    var self = this, a = this.figs[ev.a], d = this.figs[ev.d], fx = this.fx;
    if (ev.type === 'net') {
      a.n.hand1.getWorldPosition(p1); snd('net');
      fx.throwNet(p1.clone(), function (out) { d.point('body', null, out); out.y += 0.3; }, ev.dur, null);
      return;
    }
    a.n.hand0.getWorldPosition(p1); snd('javelin', vary());
    var from = p1.clone(), miss = ev.out === 'dodge', blk = ev.out === 'block' && !ev.arm, toSh = blk || ev.toShield, fixed = null;
    if (miss) { fixed = new T.Vector3(d.base.x - a.base.x, 0, d.base.z - a.base.z).normalize().multiplyScalar(1.6); fixed.x += d.base.x + (Math.random() - 0.5); fixed.z += d.base.z + (Math.random() - 0.5); fixed.y = 0.12; }
    fx.throwJavelin(from, function (out) { if (fixed) out.copy(fixed); else d.point(toSh ? 'shield' : ev.loc, from, out); }, ev.dur, function (p) {
      snd('javelinHit', vary());
      if (miss) { fx.puff(p.obj.position, 2, 0.6); fx.stick(p.obj, self.scene, 0); }
      else if (toSh && d.hasShield) { d.n.shield.attach(p.obj); fx.stick(p.obj, d.n.shield, 0); }
      else { d.n.chest.attach(p.obj); p.obj.translateY(-0.12); self.at(1.4, function () { if (p.obj.parent) p.obj.parent.remove(p.obj); }); }
    }, ev.type);
    if (ev.out === 'block') this.at(ev.dur - 0.17, function () { A.react(d, 'block', { from: self.posOf(a, new T.Vector3()), loc: ev.loc, lead: 0.17, arm: ev.arm }); });
    else if (miss) this.at(ev.dur - 0.14, function () { A.react(d, 'dodge', { from: self.posOf(a, new T.Vector3()), side: Math.random() < 0.5 ? 1 : -1 }); });
  };

  BattleView.prototype.on_effect = function (ev) {
    var fig = this.figs[ev.id];
    if (ev.type === 'stun') { this.float(fig, 'Choáng', 'bad', 0.15); snd('stun'); }
    else if (ev.type === 'net') { this.fx.drape(fig, ev.dur); this.float(fig, 'Dính lưới', 'bad', 0.15); }
    else if (ev.type === 'bleed') this.float(fig, 'Chảy máu', 'bad', 0.15);
    else if (ev.type === 'poison') this.float(fig, 'Trúng độc', 'bad', 0.15);
    else if (ev.type === 'skull') { this.float(fig, 'ĐẬP SỌ', 'crit', 0.25); if (this.onShake) this.onShake(0.06); }
    else if (ev.type === 'shieldoff') { this.float(fig, 'Khiên bị ghim', 'bad', 0.15); A.react(fig, 'hooked', {}); }
    else if (ev.type === 'enrage') { this.float(fig, 'NỔI ĐIÊN', 'crit', 0.2); snd('enrage'); if (fig.ring) fig.ring.material.color.set(0xff3a1a); this.cheer(0.8); }
    else if (ev.type === 'heal') this.float(fig, '+' + Math.round(ev.amount), 'heal', 0.1);
    else if (ev.type === 'survive') this.float(fig, 'Chưa chịu chết', 'sp', 0.15);
    else if (ev.type === 'guard') this.float(fig, 'Tỉnh đòn', 'sp', 0.15);
    else if (ev.type === 'howl') { this.float(fig, (this.b.f[ev.id].st.beast ? 'HÚ' : 'GẦM THÉT') + ' +' + ev.pct + '%', 'crit', 0.25); snd('enrage'); if (fig.roar) fig.roar(); else A.react(fig, 'flinch', { power: 0.6 }); if (this.onShake) this.onShake(0.08); this.cheer(0.6); }
    else if (ev.type === 'sunder') this.float(fig, 'Móp giáp −' + ev.n * 5 + '%', 'bad', 0.15);
    else if (ev.type === 'crack') this.float(fig, 'Nứt khiên −' + ev.n * 12 + '%', 'bad', 0.15);
    else if (ev.type === 'cover') this.float(fig, 'Đỡ thay', 'small', 0.15);
    else if (ev.type === 'slip') this.float(fig, 'Tuột lưới', 'sp', 0.15);
    else if (ev.type === 'whirl') { this.float(fig, 'CHÉM XOAY', 'crit', 0.3); snd('enrage'); if (this.onShake) this.onShake(0.1); this.cheer(0.8); }
    else if (ev.type === 'charge') { this.float(fig, 'XUNG PHONG', 'crit', 0.3); snd('enrage'); if (fig.roar) fig.roar(); if (this.onShake) this.onShake(0.1); this.cheer(0.7); }
    else if (ev.type === 'summon') { this.float(fig, 'GỌI VIỆN BINH', 'sp', 0.3); snd('enrage'); if (fig.roar) fig.roar(); this.cheer(0.8); }
    else if (ev.type === 'roar') { this.float(fig, 'GẦM', 'crit', 0.25); snd('enrage'); if (fig.roar) fig.roar(); if (this.onShake) this.onShake(0.12); this.cheer(0.5); }
    else if (ev.type === 'drag') { this.float(fig, 'Bị móc kéo', 'bad', 0.15); A.react(fig, 'flinch', { power: 1.5 }); this.cheer(0.6); }
    else if (ev.type === 'dragend') { p2.set(fig.base.x, 0, fig.base.z); this.fx.puff(p2, 5, 1.0); snd('thud'); }
    else if (ev.type === 'broken') this.float(fig, 'Vỡ đội hình', 'small', 0.15);
  };
  BattleView.prototype.on_bleed = function (ev) {
    var fig = this.figs[ev.id]; fig.point('body', null, p2); p3.set(0, 0, 0);
    this.fx.bleed(p2, p3, 0.15); if (Math.random() < 0.6) this.fx.stain(fig.base.x + (Math.random() - 0.5) * 0.3, fig.base.z + (Math.random() - 0.5) * 0.3, 0.07);
    snd('bleed');
  };
  BattleView.prototype.on_cancel = function (ev) { A.cancel(this.figs[ev.id]); };
  BattleView.prototype.on_down = function (ev) {
    var self = this, fig = this.figs[ev.id], by = ev.by >= 0 ? this.figs[ev.by] : null;
    A.die(fig, by ? this.posOf(by, p1) : null);
    fig.setRingVisible(false);
    snd('death');
    this.at(0.32, function () { self.dropWeapon(fig); });
    this.at(0.55, function () { snd('thud'); p2.set(fig.base.x, 0, fig.base.z); self.fx.puff(p2, 6, 1.2); self.fx.stain(fig.base.x, fig.base.z, 0.35 + Math.random() * 0.2); });
    this.cheer(this.b.f[ev.id].st.boss ? 1 : 0.6);
    if (this.onShake) this.onShake(0.16);
  };
  // vũ khí tuột khỏi tay kẻ vừa gục và rơi xuống cát
  var dq = new T.Quaternion(), dv = new T.Vector3(), UPV = new T.Vector3(0, 1, 0);
  BattleView.prototype.dropWeapon = function (fig) {
    var list = [fig.n.wR, fig.n.wL]; fig.dropped = true;
    for (var i = 0; i < list.length; i++) {
      var o = list[i]; if (!o || !o.children.length || !o.visible) continue;
      this.scene.attach(o);
      dv.set(0, 1, 0).applyQuaternion(o.quaternion); dv.y = 0; if (dv.lengthSq() < 1e-4) dv.set(1, 0, 0); dv.normalize();
      this.drops.push({ obj: o, vy: 0.4, q: new T.Quaternion().setFromUnitVectors(UPV, dv), vx: dv.x * 0.6, vz: dv.z * 0.6, done: false });
    }
  };
  BattleView.prototype.updateDrops = function (dt) {
    for (var i = 0; i < this.drops.length; i++) {
      var d = this.drops[i]; if (d.done) continue;
      d.vy -= 9.8 * dt; d.obj.position.y += d.vy * dt; d.obj.position.x += d.vx * dt; d.obj.position.z += d.vz * dt;
      d.obj.quaternion.slerp(d.q, Math.min(1, dt * 9));
      if (d.obj.position.y <= 0.03) { d.obj.position.y = 0.03; d.obj.quaternion.copy(d.q); d.done = true; this.fx.puff(d.obj.position, 1, 0.4); }
    }
  };
  BattleView.prototype.on_overtime = function () {
    this.cheer(1); if (this.onShake) this.onShake(0.1); snd('enrage');
    if (this.quiet || !V.overlay) return;
    var el = document.createElement('div'); el.className = 'ft crit'; el.textContent = 'HIỆP PHỤ — sát thương, tốc đánh, hồi chiêu ×2';
    el.style.left = '50%'; el.style.top = '22%'; el.style.fontSize = '26px'; el.style.animationDuration = '2.6s';
    V.overlay.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  };
  BattleView.prototype.on_end = function (ev) {
    var self = this;
    this.at(0.7, function () { self.won = ev.winner; });
    this.cheer(1);
    if (this.cb.onEnd) this.cb.onEnd(this.b);
  };
  BattleView.prototype.cheer = function (a) {
    if (this.env && this.env.cheer) this.env.cheer(a);
    if (!this.quiet && G.Audio && G.Audio.cheer) G.Audio.cheer(a);
  };
  BattleView.prototype.dispose = function () {
    for (var i = 0; i < this.figs.length; i++) this.figs[i].dispose();
    this.fx.dispose();
    for (i = 0; i < this.drops.length; i++) { var o = this.drops[i].obj; if (o.parent) o.parent.remove(o); o.traverse(function (m) { if (m.geometry) m.geometry.dispose(); }); }
    this.drops = [];
    for (i = 0; i < this.bars.length; i++) if (this.bars[i].el.parentNode) this.bars[i].el.parentNode.removeChild(this.bars[i].el);
    this.figs = []; this.bars = []; this.sched = [];
  };
})(window.G = window.G || {});

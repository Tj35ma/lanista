// LANISTA — bốn không gian 3D: chợ nô lệ, lò rèn, phòng chờ, đấu trường. Mỗi không gian là một cảnh riêng.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, A = V.Anim, P = V.PAL, PI = Math.PI;
  var invis = new T.MeshBasicMaterial({ visible: false });
  var ground = new T.Plane(new T.Vector3(0, 1, 0), 0), gp = new T.Vector3(), bb = new T.Box3(), bc = new T.Vector3(), bs = new T.Vector3();
  function aud(fn, a) { if (G.Audio && G.Audio[fn]) G.Audio[fn](a); }
  function ringMesh(r, col, op) {
    var g = new T.RingGeometry(r * 0.8, r, 24); g.rotateX(-PI / 2);
    var m = new T.Mesh(g, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })); m.renderOrder = 2; return m;
  }

  // =================================================================== ĐẤU TRƯỜNG
  var arena = V.arena = V.spaces.arena = { tier: -1, view: null, mode: 'idle', overT: 0, stages: {} };
  arena.build = function (tier) {
    tier = tier == null ? (this.tier < 0 ? 0 : this.tier) : tier;
    if (this.tier === tier && this.scene) return;
    this.stop();
    var st = this.stages[tier];
    if (!st) {
      var env = V.getEnv('arena', tier, function () { return V.fallbackEnv({ pos: [0, 13.5, 14.5], look: [0, 0.6, 0.5], fov: 36 }); });
      // đấu trường càng cao thì nắng càng phải đứng hơn, nếu không khán đài che hết mặt cát
      if (env.sun && tier >= 1) {
        var el = [0, 0.6, 0.76, 0.93][tier], sp = env.sun.position, d = sp.length(), az = Math.atan2(sp.x, sp.z);
        sp.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
      }
      st = this.stages[tier] = V.makeStage(env);
      // nắng thấp từ phía sau làm mặt nhân vật quay về máy quay chìm trong bóng: thêm một nguồn hắt nhẹ từ phía máy
      var fill = new T.DirectionalLight(0xffe8d2, 0.6); fill.position.set(4, 7, 13); st.scene.add(fill);
    }
    this.scene = st.scene; this.camera = st.camera; this.env = st.env; this.fov = st.fov; this.tier = tier;
  };
  arena.kick = function (a) { this.shake = Math.max(this.shake || 0, a); };
  arena.setCam = function () {
    var c = this.env.cam; this.camera.position.set(c.pos[0], c.pos[1], c.pos[2]); this.camera.lookAt(c.look[0], c.look[1], c.look[2]);
    this.camDir = new T.Vector3(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]); this.camMax = this.camDir.length(); this.camDir.normalize();
    this.camLook = new T.Vector3(c.look[0], c.look[1], c.look[2]); this.camDist = this.camMax;
  };
  // máy quay tự lấy khung: luôn ôm trọn những người còn đứng, lại gần khi họ dồn vào nhau
  arena.frameCam = function (dt) {
    var f = this.view.b.f, n = 0, cx = 0, cz = 0, i, over = this.view.b.over;
    for (i = 0; i < f.length; i++) if (f[i].alive || over) { cx += f[i].x; cz += f[i].z; n++; }
    if (!n) return; cx /= n; cz /= n;
    var r = 0; for (i = 0; i < f.length; i++) if (f[i].alive || over) { var d = Math.sqrt((f[i].x - cx) * (f[i].x - cx) + (f[i].z - cz) * (f[i].z - cz) * 1.6); if (d > r) r = d; }
    var wantD = Math.min(this.camMax, Math.max(9.5, r * 1.95 + 7.4)), k = 1 - Math.exp(-dt * 1.4);
    this.camLook.x += (cx * 0.9 - this.camLook.x) * k; this.camLook.z += (cz * 0.85 + 0.3 - this.camLook.z) * k; this.camLook.y += (0.8 - this.camLook.y) * k;
    this.camDist += (wantD - this.camDist) * k;
    this.camera.position.copy(this.camLook).addScaledVector(this.camDir, this.camDist); this.camera.lookAt(this.camLook);
    if (this.shake > 0.002) { var sh = this.shake; this.camera.position.x += (Math.random() - 0.5) * sh; this.camera.position.y += (Math.random() - 0.5) * sh; this.camera.position.z += (Math.random() - 0.5) * sh * 0.6; this.shake *= Math.exp(-dt * 11); }
  };
  arena.enter = function (opts) {
    this.build(opts.tier);
    aud('crowdSize', this.tier);
    if (opts.title) { if (this.mode !== 'idle' || !this.view) this.idle(this.tier); aud('crowd', 0.12); }
    else { this.setCam(); aud('crowd', 0.4); }
  };
  arena.leave = function () { aud('crowd', 0); };
  arena.stop = function () { if (this.view) { this.view.dispose(); this.view = null; } if (V.overlay) V.overlay.innerHTML = ''; };
  arena.idle = function (tier) { this.build(tier); this.stop(); this.mode = 'idle'; this.demo(); };
  arena.demo = function () {
    var rng = new G.Rng((Math.random() * 1e9) | 0), kinds = ['gladius', 'sica', 'mace', 'hasta', 'trident', 'twin', 'axe', 'javelin', 'caestus'];
    var t = this.tier, wt = t + 1, armor = [['b_harness'], ['b_leather', 'h_legion'], ['b_linen', 'h_galea', 'l_ocrea'], ['b_hamata', 'h_murmillo', 'l_ocrea', 'a_scale']][t];
    var shields = ['s_plank', 's_parma', 's_hoplon', 's_scutum'];
    function team(n, off) {
      var o = [];
      for (var i = 0; i < n; i++) {
        var k = rng.pick(kinds), gear = armor.slice(0, rng.int(0, armor.length));
        if (G.WKIND[k].hands === 1 && rng.chance(0.6)) gear.push(shields[t]);
        var d = G.e('Demo', rng.pick(['big', 'bal', 'agi']), G.TIERS[t].lvl + 1, k + wt, gear, k === 'javelin' ? 1 : 0, [2, 1, 3][i]);
        o.push({ g: G.makeFoe(d, i + off, rng.int(1, 1e6)), c: d.c, r: d.r });
      }
      return o;
    }
    var b = new G.Battle(team(2, 0), team(2, 10), { seed: rng.int(1, 1e9) });
    this.view = new V.BattleView(this.scene, b, { env: this.env, quiet: true });
    this.view.start(); this.overT = 0;
  };
  arena.start = function (battle, tier, cb) {
    this.build(tier); this.stop(); this.mode = 'fight'; this.setCam();
    var view = this.view = new V.BattleView(this.scene, battle, { env: this.env, cb: cb, intro: true, onShake: function (a) { arena.kick(a); } });
    if (G.Audio && G.Audio.play) { G.Audio.play('gate'); setTimeout(function () { G.Audio.play('horn'); }, 250); }
    aud('crowdSize', tier); aud('crowd', 0.45);
  };
  arena.update = function (dt) {
    if (this.env.update) this.env.update(V.time, dt);
    if (this.view) this.view.update(dt);
    if (this.mode === 'fight' && this.view && this.camDir) this.frameCam(dt);
    if (this.mode === 'idle') {
      var a = Math.sin(V.time * 0.07) * 0.5;
      this.camera.position.set(Math.sin(a) * 12.5, 4.8, Math.cos(a) * 12.5); this.camera.lookAt(0, 1.1, 0);
      if (this.view && this.view.b.over) { this.overT += dt; if (this.overT > 5) { this.stop(); this.demo(); } }
    }
  };

  // =================================================================== CHỢ NÔ LỆ
  var market = V.market = V.spaces.market = { shiftX: 0.07, figs: [], key: '', hi: -1, onHover: null, onClick: null, slaves: null };
  market.build = function () {
    if (this.scene) return;
    var env = V.getEnv('market', 0, function () {
      return V.fallbackEnv({ pos: [0, 2.3, 8.4], look: [0, 1.4, 0], fov: 40 }, { slots: [{ x: -2.4, y: 0, z: 0, ry: 0 }, { x: -0.8, y: 0, z: 0, ry: 0 }, { x: 0.8, y: 0, z: 0, ry: 0 }, { x: 2.4, y: 0, z: 0, ry: 0 }] });
    });
    var fill = new T.DirectionalLight(0xffe2bd, 1.1); fill.position.set(3, 3.5, 9); env.group.add(fill);   // hắt sáng vào người đứng dưới mái che
    var st = V.makeStage(env); this.scene = st.scene; this.camera = st.camera; this.env = env; this.fov = st.fov;
    this.proxies = []; this.rings = [];
    for (var i = 0; i < env.slots.length; i++) {
      var s = env.slots[i], p = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 1.95, 6), invis);
      p.position.set(s.x, s.y + 0.98, s.z); p.userData.i = i; this.scene.add(p); this.proxies.push(p);
      var r = ringMesh(0.55, 0xffe08a, 0.9); r.position.set(s.x, s.y + 0.02, s.z); r.visible = false; this.scene.add(r); this.rings.push(r);
    }
  };
  market.show = function (slaves) { this.slaves = slaves; if (this.scene) this.sync(); };
  market.sync = function () {
    var sl = this.slaves || [], key = sl.map(function (o) { return o.g.id + (o.sold ? 'x' : ''); }).join(',');
    if (key === this.key) return; this.key = key;
    var i; for (i = 0; i < this.figs.length; i++) if (this.figs[i]) this.figs[i].dispose();
    this.figs = [];
    for (i = 0; i < sl.length && i < this.env.slots.length; i++) {
      if (sl[i].sold) { this.figs.push(null); continue; }
      var s = this.env.slots[i], fig = new V.Figure(sl[i].g, null, { ring: false, bound: true });
      fig.state = 'stand'; this.scene.add(fig.group); fig.place(s.x, s.z, s.ry || 0, s.y);
      fig.look = [(G.hashStr(sl[i].g.id) % 100) / 100 - 0.5, sl[i].g.morale < 50 ? 0.25 : 0.02];
      this.figs.push(fig);
    }
    this.highlight(this.hi);
  };
  market.enter = function () { this.build(); this.sync(); };
  market.update = function (dt) {
    if (this.env.update) this.env.update(V.time, dt);
    for (var i = 0; i < this.figs.length; i++) {
      var f = this.figs[i]; if (!f) continue;
      // nhìn quanh chậm rãi
      f.pStand.hd[0] = f.look[0] * 0.8 + Math.sin(V.time * 0.4 + i * 2.1) * 0.25; f.pStand.hd[1] = f.look[1];
      A.update(f, dt);
    }
  };
  market.pick = function (ray) { var h = ray ? ray.intersectObjects(this.proxies, false) : []; if (!h.length) return -1; var i = h[0].object.userData.i; return (this.figs[i]) ? i : -1; };
  market.hover = function (ray, x, y) { var i = this.pick(ray); if (i !== this.hi) { this.highlight(i); if (this.onHover) this.onHover(i); } V.canvas.style.cursor = i >= 0 ? 'pointer' : ''; };
  market.click = function (ray) { var i = this.pick(ray); if (i >= 0 && this.onClick) this.onClick(i); };
  // toạ độ màn hình ngay dưới chân từng nô lệ còn trên bục (cho nút mua)
  var ap = new T.Vector3(), asp = { x: 0, y: 0, behind: false };
  market.anchors = function () {
    var out = []; if (V.cur !== this || !this.env) return out;
    for (var i = 0; i < this.figs.length; i++) { if (!this.figs[i]) continue; var s = this.env.slots[i]; ap.set(s.x, s.y - 0.03, s.z + 0.62); V.project(ap, asp); out.push({ i: i, x: asp.x, y: asp.y }); }
    return out;
  };
  market.highlight = function (i) { this.hi = i; if (!this.rings) return; for (var k = 0; k < this.rings.length; k++) this.rings[k].visible = (k === i && !!this.figs[k]); };

  // =================================================================== LÒ RÈN
  var shop = V.shop = V.spaces.shop = { shiftX: 0.1, objs: [], key: '', hi: -1, onHover: null, onClick: null, list: null, relic: null };
  shop.build = function () {
    if (this.scene) return;
    var env = V.getEnv('shop', 0, function () {
      var sl = { weapon: [], armor: [], trinket: [{ x: 3.9, y: 0.95, z: -0.4 }], relic: { x: -4.3, y: 1.05, z: -0.2 } };
      for (var i = 0; i < 4; i++) { sl.weapon.push({ x: -3.0 + i * 0.8, y: 1.55, z: -0.95 }); sl.armor.push({ x: 0.4 + i * 0.9, y: 0.95, z: -0.5 }); }
      return V.fallbackEnv({ pos: [0, 1.95, 6.2], look: [0, 1.25, -0.5], fov: 40 }, { slots: sl });
    });
    env.cam = { pos: [0, 2.15, 8.7], look: [0, 1.3, -0.5], fov: env.cam.fov || 40 };   // lùi máy để cả giá vũ khí, bàn giáp và bệ đá lọt khung
    var st = V.makeStage(env); this.scene = st.scene; this.camera = st.camera; this.env = env; this.fov = st.fov;
  };
  shop.show = function (list, relic) { this.list = list; this.relic = relic; if (this.scene) this.sync(); };
  shop.sync = function () {
    var list = this.list || [], relic = this.relic, i;
    var key = list.map(function (o) { return o.id + ':' + (o.r || 0) + (o.sold ? 'x' : ''); }).join(',') + '|' + (relic ? relic.id + (relic.sold ? 'x' : '') : '');
    if (key === this.key) return; this.key = key;
    for (i = 0; i < this.objs.length; i++) { var o = this.objs[i]; this.scene.remove(o.grp); this.scene.remove(o.proxy); o.grp.traverse(function (m) { if (m.geometry) m.geometry.dispose(); }); }
    this.objs = [];
    var sl = this.env.slots, used = { weapon: 0, armor: 0, trinket: 0 }, self = this;
    function put(grp, slot, wall, idx) {
      grp.updateMatrixWorld(true); bb.setFromObject(grp); bb.getCenter(bc); bb.getSize(bs);
      if (wall) grp.position.set(slot.x - bc.x, slot.y - bc.y, slot.z - bc.z + 0.12);
      else grp.position.set(slot.x - bc.x, slot.y - bb.min.y + 0.01, slot.z - bc.z);
      self.scene.add(grp);
      var px = new T.Mesh(new T.BoxGeometry(Math.max(0.45, bs.x + 0.15), bs.y + 0.1, Math.max(0.4, bs.z + 0.2)), invis);
      px.position.set(slot.x, wall ? slot.y : slot.y + bs.y / 2, slot.z + (wall ? 0.12 : 0)); px.userData.i = idx; self.scene.add(px);
      // điểm neo cho nút mua: hàng treo tường → một hàng ngang dưới giá; hàng trên bàn → mép bàn phía trước
      var an = wall ? new T.Vector3(slot.x, 0.76, slot.z + 0.2) : new T.Vector3(slot.x, slot.y - 0.07, slot.z + Math.max(0.34, bs.z / 2 + 0.14));
      self.objs.push({ grp: grp, proxy: px, idx: idx, base: grp.position.clone(), wall: wall, s0: grp.scale.x, anchor: an });
    }
    for (i = 0; i < list.length; i++) {
      if (list[i].sold) continue;
      var it = G.ITEMS[list[i].id], cat = it.slot === 'weapon' ? 'weapon' : (it.slot === 'trinket' ? 'trinket' : 'armor');
      var arr = sl[cat], slot = arr[used[cat]]; if (!slot) { slot = sl.armor[used.armor]; cat = 'armor'; if (!slot) continue; }
      used[cat]++;
      var grp = V.Gear.display(it, 0, list[i].r || 0); grp.scale.setScalar(cat === 'weapon' ? 1.22 : 1.15);
      if (cat === 'armor' && it.slot === 'weapon') grp.rotation.z = PI / 2;
      put(grp, slot, cat === 'weapon', i);
    }
    if (relic && !relic.sold) put(V.relicMesh(relic.id), sl.relic, false, 'relic');
    this.highlight(this.hi);
  };
  shop.enter = function () { this.build(); this.sync(); };
  shop.update = function (dt) {
    if (this.env.update) this.env.update(V.time, dt);
    for (var i = 0; i < this.objs.length; i++) {
      var o = this.objs[i], on = o.idx === this.hi, k = Math.min(1, dt * 10);
      o.t = (o.t || 0) + ((on ? 1 : 0) - (o.t || 0)) * k;
      o.grp.position.y = o.base.y + o.t * 0.06; o.grp.position.z = o.base.z + o.t * 0.12;
      o.grp.scale.setScalar(o.s0 * (1 + o.t * 0.1));
      if (!o.wall) o.grp.rotation.y = o.t * Math.sin(V.time * 1.6) * 0.5;
    }
  };
  shop.pick = function (ray) { if (!ray) return -1; var h = ray.intersectObjects(this.objs.map(function (o) { return o.proxy; }), false); return h.length ? h[0].object.userData.i : -1; };
  shop.hover = function (ray) { var i = this.pick(ray); if (i !== this.hi) { this.highlight(i); if (this.onHover) this.onHover(i); } V.canvas.style.cursor = i !== -1 ? 'pointer' : ''; };
  shop.click = function (ray) { var i = this.pick(ray); if (i !== -1 && this.onClick) this.onClick(i); };
  shop.highlight = function (i) { this.hi = i; };
  var ap2 = new T.Vector3(), asp2 = { x: 0, y: 0, behind: false };
  shop.anchors = function () {
    var out = []; if (V.cur !== this) return out;
    for (var i = 0; i < this.objs.length; i++) { var o = this.objs[i]; ap2.copy(o.anchor); V.project(ap2, asp2); out.push({ i: o.idx, x: asp2.x, y: asp2.y }); }
    return out;
  };

  // hình tượng trưng cho vật của lanista
  V.relicMesh = function (id) {
    var g = new V.Geo(), m = new V.Geo(), grp = new T.Group();
    if (id === 'scale') { g.cyl(0.02, 0.03, 0.4, 5, P.wood, { y: 0.2 }); m.box(0.5, 0.02, 0.02, P.bronze, { y: 0.4, rz: 0.12 }); m.cyl(0.09, 0.06, 0.03, 8, P.bronze, { x: -0.23, y: 0.27 }); m.cyl(0.09, 0.06, 0.03, 8, P.bronze, { x: 0.23, y: 0.33 }); g.beam([-0.23, 0.38, 0], [-0.23, 0.28, 0], 0.004, P.rope); g.beam([0.23, 0.43, 0], [0.23, 0.34, 0], 0.004, P.rope); g.box(0.2, 0.03, 0.14, P.woodDark, { y: 0.015 }); }
    else if (id === 'granary') { g.cyl(0.1, 0.16, 0.22, 8, P.terracotta, { y: 0.31 }); g.cyl(0.16, 0.08, 0.2, 8, P.terracotta, { y: 0.1 }); g.cyl(0.06, 0.1, 0.08, 8, P.terracotta, { y: 0.46 }); g.cyl(0.07, 0.07, 0.03, 8, P.rope, { y: 0.51 }); }
    else if (id === 'rudis') { for (var i = 0; i < 3; i++) { g.box(0.03, 0.5, 0.05, P.woodLight, { x: (i - 1) * 0.06, y: 0.28, rz: (i - 1) * 0.12 }); g.box(0.1, 0.02, 0.05, P.wood, { x: (i - 1) * 0.045, y: 0.1, rz: (i - 1) * 0.12 }); } g.torus(0.09, 0.012, 4, 8, P.rope, { y: 0.22, rx: PI / 2 }); }
    else if (id === 'surgeon') { g.box(0.36, 0.06, 0.22, P.woodDark, { y: 0.03 }); g.box(0.36, 0.015, 0.22, P.leather, { y: 0.1, z: -0.1, rx: -1.0 }); for (var j = 0; j < 4; j++) m.box(0.012, 0.012, 0.15, j % 2 ? P.steel : P.bronze, { x: -0.12 + j * 0.08, y: 0.07 }); }
    else if (id === 'cornu') { m.torus(0.17, 0.022, 5, 12, 0xc8ccd0, { y: 0.22, rz: 0.6 }, PI * 1.5); m.cone(0.07, 0.12, 8, 0xc8ccd0, { x: 0.15, y: 0.34, rz: 2.2 }); g.cyl(0.02, 0.03, 0.2, 5, P.wood, { y: 0.1 }); }
    else if (id === 'nemesis') { g.box(0.22, 0.08, 0.18, P.marble, { y: 0.04 }); g.cyl(0.05, 0.07, 0.26, 6, P.marble, { y: 0.21 }); g.ico(0.05, 1, P.marble, { y: 0.39 }); g.box(0.2, 0.12, 0.02, P.marble, { y: 0.26, z: -0.05, rz: 0.2 }); m.torus(0.07, 0.01, 4, 8, P.bronze, { x: 0.1, y: 0.2 }); }
    else if (id === 'patron') { g.cyl(0.035, 0.035, 0.34, 8, P.linen, { y: 0.06, rz: PI / 2 }); g.cyl(0.045, 0.045, 0.03, 8, P.wood, { x: 0.18, y: 0.06, rz: PI / 2 }); g.cyl(0.045, 0.045, 0.03, 8, P.wood, { x: -0.18, y: 0.06, rz: PI / 2 }); g.cyl(0.03, 0.03, 0.02, 8, P.clothRed, { y: 0.1, z: 0.02 }); g.box(0.03, 0.1, 0.005, P.clothRed, { y: 0.06, z: 0.04, rx: 0.3 }); }
    else if (id === 'ledger') { for (var k = 0; k < 3; k++) { g.box(0.26, 0.022, 0.18, P.wood, { y: 0.02 + k * 0.03, ry: k * 0.15 }); g.box(0.21, 0.004, 0.14, 0x3a2c1e, { y: 0.033 + k * 0.03, ry: k * 0.15 }); } m.cyl(0.006, 0.003, 0.16, 4, P.bronze, { x: 0.12, y: 0.12, z: 0.06, rz: 1.3 }); }
    else { g.cyl(0.12, 0.14, 0.26, 7, P.woodDark, { y: 0.13 }); m.box(0.34, 0.1, 0.14, P.ironDark, { y: 0.33 }); m.box(0.2, 0.06, 0.12, P.iron, { y: 0.4 }); m.cone(0.06, 0.16, 5, P.ironDark, { x: 0.24, y: 0.36, rz: -PI / 2 }); }
    grp.add(V.mesh(g)); if (!m.empty()) grp.add(V.mesh(m, 'metal'));
    grp.scale.setScalar(1.25);
    return grp;
  };

  // =================================================================== PHÒNG CHỜ
  var ready = V.ready = V.spaces.ready = { figs: [], key: '', sel: null, data: null, onPick: null, onHover: null, hoverCell: -1, stages: {}, tier: -1 };
  ready.build = function (tier) {
    tier = tier == null ? (this.tier < 0 ? 0 : this.tier) : tier;
    if (this.tier === tier && this.scene) return;
    var i; for (i = 0; i < this.figs.length; i++) this.figs[i].fig.dispose();
    this.figs = []; this.key = '';
    var st = this.stages[tier];
    if (!st) {
      var env = V.getEnv('ready', tier, function () {
        var bench = []; for (var i = 0; i < 8; i++) bench.push({ x: -8.3 + i * 0.9, z: -4.1, ry: 0 });
        return V.fallbackEnv({ pos: [-0.8, 9.6, 11.8], look: [-0.4, 0.7, 0], fov: 38 }, { bench: bench });
      });
      st = this.stages[tier] = V.makeStage(env);
      st.cells = [];
      for (var c = 0; c < G.GRID.cols; c++) for (var r = 0; r < G.GRID.rows; r++) {
        var p = G.cellPos(0, c, r), pg = new T.PlaneGeometry(1.36, 1.36); pg.rotateX(-PI / 2);
        var m = new T.Mesh(pg, new T.MeshBasicMaterial({ color: 0xd8b060, transparent: true, opacity: 0.1, depthWrite: false }));
        m.position.set(p.x, 0.022, p.z); m.renderOrder = 1; m.userData = { c: c, r: r }; st.scene.add(m); st.cells.push(m);
      }
    }
    this.scene = st.scene; this.camera = st.camera; this.env = st.env; this.fov = st.fov; this.cells = st.cells; this.tier = tier;
  };
  ready.show = function (d) { this.data = d; if (this.scene && V.cur === this) { if (d.tier != null && d.tier !== this.tier) this.build(d.tier); this.sync(); } };
  ready.sync = function () {
    var d = this.data; if (!d) return;
    var key = d.roster.map(function (g) {
      var f = d.form[g.id];
      return g.id + ':' + G.SLOTS.map(function (s) { return g.gear[s] ? g.gear[s].id + (g.gear[s].r || '') : ''; }).join('/') + ':' + (f ? f[0] + '' + f[1] : 'b') + ':' + g.injuries.length;
    }).join(',') + '|' + (d.foes ? d.foes.map(function (o) { return o.g.name + o.g.lvl + o.c + o.r + (o.g.gear.weapon ? o.g.gear.weapon.id : ''); }).join(',') : '');
    if (key === this.key) { this.select(this.sel); return; }
    this.key = key;
    var i; for (i = 0; i < this.figs.length; i++) { this.figs[i].fig.dispose(); this.scene.remove(this.figs[i].proxy); }
    this.figs = [];
    var bi = 0, self = this;
    function add(g, team, x, z, face, state, info) {
      var fig = new V.Figure(g, team); fig.state = state; self.scene.add(fig.group); fig.place(x, z, face);
      var px = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 1.95, 6), invis); px.position.set(x, 0.98, z); px.userData = info; self.scene.add(px);
      info.fig = fig; info.proxy = px; self.figs.push(info);
    }
    for (i = 0; i < d.roster.length; i++) {
      var g = d.roster[i], f = d.form[g.id];
      if (f) { var p = G.cellPos(0, f[0], f[1]); add(g, 0, p.x, p.z, PI / 2, 'stance', { type: 'glad', id: g.id }); }
      else { var nb = this.env.bench.length, b = this.env.bench[nb - 1 - (bi++ % nb)]; /* lấp từ phía cổng vào để không bị bảng giao diện che */ add(g, 0, b.x, b.z, b.ry || 0, 'stand', { type: 'glad', id: g.id }); }
    }
    if (d.foes) for (i = 0; i < d.foes.length; i++) { var o = d.foes[i], q = G.cellPos(1, o.c, o.r); add(o.g, 1, q.x, q.z, -PI / 2, 'stance', { type: 'foe', idx: i }); }
    this.select(this.sel);
  };
  ready.enter = function (opts) { this.build(opts && opts.tier != null ? opts.tier : (this.data ? this.data.tier : null)); V.cur = this; this.sync(); };
  ready.select = function (id) { this.sel = id; for (var i = 0; i < this.figs.length; i++) { var f = this.figs[i]; if (f.type === 'glad') f.fig.setSelected(f.id === id); } };
  ready.update = function (dt) {
    if (this.env.update) this.env.update(V.time, dt);
    for (var i = 0; i < this.figs.length; i++) A.update(this.figs[i].fig, dt);
    for (i = 0; i < this.cells.length; i++) { var m = this.cells[i].material, want = i === this.hoverCell ? (this.sel ? 0.5 : 0.28) : (this.sel ? 0.16 : 0.07); m.opacity += (want - m.opacity) * Math.min(1, dt * 12); }
  };
  ready.pickAt = function (ray) {
    if (!ray) return null;
    var h = ray.intersectObjects(this.figs.map(function (f) { return f.proxy; }), false);
    if (h.length) { var u = h[0].object.userData; return u.type === 'glad' ? { type: 'glad', id: u.id } : { type: 'foe', idx: u.idx }; }
    if (!ray.ray.intersectPlane(ground, gp)) return null;
    var c = Math.round((-gp.x - G.GRID.front) / G.GRID.gap), r = Math.round(gp.z / G.GRID.gap + 2);
    if (c >= 0 && c < G.GRID.cols && r >= 0 && r < G.GRID.rows && Math.abs(-gp.x - G.GRID.front - c * G.GRID.gap) < 0.72 && Math.abs(gp.z - (r - 2) * G.GRID.gap) < 0.72) return { type: 'cell', c: c, r: r };
    if (gp.x < -1 && gp.x > -9.2 && gp.z < -3.3 && gp.z > -5.2) return { type: 'bench' };
    return null;
  };
  ready.hover = function (ray, x, y) {
    var p = this.pickAt(ray);
    this.hoverCell = p && p.type === 'cell' ? p.c * G.GRID.rows + p.r : -1;
    var fp = p && (p.type === 'glad' || p.type === 'foe') ? p : null;
    var k = fp ? fp.type + (fp.id || fp.idx) : '';
    if (k !== this.hk || fp) { this.hk = k; if (this.onHover) this.onHover(fp, x, y); }
    V.canvas.style.cursor = p ? 'pointer' : '';
  };
  ready.click = function (ray) { var p = this.pickAt(ray); if (p && this.onPick) this.onPick(p); };

})(window.G = window.G || {});

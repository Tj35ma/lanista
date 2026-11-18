// LANISTA — hiệu ứng: máu, bụi, tia lửa, vết máu trên cát, lao và lưới đang bay.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, P = V.PAL, PI = Math.PI;
  var m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), eu = new T.Euler(), UP = new T.Vector3(0, 1, 0), tv = new T.Vector3();

  function Pool(scene, geo, mat, n, shadow) {
    this.mesh = new T.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.mesh.castShadow = !!shadow; this.mesh.receiveShadow = false;
    this.n = n; this.items = []; this.next = 0;
    for (var i = 0; i < n; i++) { this.items.push({ on: false, p: new T.Vector3(), v: new T.Vector3(), life: 0, max: 1, s: 1, rot: 0, rv: 0 }); m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m4); }
    scene.add(this.mesh);
  }
  Pool.prototype.spawn = function () { var it = this.items[this.next]; this.next = (this.next + 1) % this.n; it.on = true; it.life = 0; it.rot = Math.random() * 6; it.rv = (Math.random() - 0.5) * 12; return it; };

  function Fx(scene) {
    this.scene = scene;
    this.blood = new Pool(scene, new T.TetrahedronGeometry(0.03, 0), new T.MeshLambertMaterial({ color: 0x7a0f0a, flatShading: true }), 160, false);
    this.dust = new Pool(scene, new T.IcosahedronGeometry(0.12, 0), new T.MeshLambertMaterial({ color: 0xd8bc8c, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false }), 90, false);
    this.spark = new Pool(scene, new T.TetrahedronGeometry(0.018, 0), new T.MeshBasicMaterial({ color: 0xffd98a }), 60, false);
    var dg = new T.CircleGeometry(1, 7); dg.rotateX(-PI / 2);
    this.decal = new Pool(scene, dg, new T.MeshBasicMaterial({ color: 0x4a0c08, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 220, false);
    this.decal.mesh.renderOrder = 1; this.decalY = 0.012;
    this.projs = []; this.nets = []; this.debris = []; this.trails = [];
    var pg = new T.CircleGeometry(1, 6); pg.rotateX(-PI / 2);
    this.prints = new T.InstancedMesh(pg, new T.MeshBasicMaterial({ color: 0x6f573c, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 240);
    this.prints.frustumCulled = false; this.prints.count = 0; this.printN = 0; scene.add(this.prints);
  }
  V.Fx = Fx;

  // Vệt sáng mờ theo mũi vũ khí trong lúc ra đòn: giúp mắt bắt được đường vung từ trên cao.
  function Trail(scene, n) {
    this.n = n || 14; this.pts = []; this.life = 0.17;
    var g = new T.BufferGeometry(), idx = [];
    this.pos = new Float32Array(this.n * 6); this.col = new Float32Array(this.n * 6);
    for (var i = 0; i < this.n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3)); g.setIndex(idx);
    this.mesh = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 3; scene.add(this.mesh); this.scene = scene;
  }
  Trail.prototype.push = function (tip, base, power) {
    this.pts.unshift({ a: tip.clone(), b: base.clone(), age: 0, p: power || 1 }); if (this.pts.length > this.n) this.pts.length = this.n;
  };
  Trail.prototype.update = function (dt) {
    var p = this.pts, i;
    for (i = p.length - 1; i >= 0; i--) { p[i].age += dt; if (p[i].age > this.life) p.splice(i, 1); }
    if (p.length < 2) { if (this.mesh.visible) this.mesh.visible = false; return; }
    this.mesh.visible = true;
    for (i = 0; i < this.n; i++) {
      var q = p[Math.min(i, p.length - 1)], k = i < p.length ? Math.pow(1 - q.age / this.life, 1.6) * 0.3 * q.p : 0, o = i * 6;
      this.pos[o] = q.a.x; this.pos[o + 1] = q.a.y; this.pos[o + 2] = q.a.z; this.pos[o + 3] = q.b.x; this.pos[o + 4] = q.b.y; this.pos[o + 5] = q.b.z;
      this.col[o] = k; this.col[o + 1] = k * 0.93; this.col[o + 2] = k * 0.78; this.col[o + 3] = 0; this.col[o + 4] = 0; this.col[o + 5] = 0;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  };
  Fx.prototype.trail = function () { var t = new Trail(this.scene); this.trails.push(t); return t; };
  // dấu chân in trên cát (vòng đệm: dấu cũ nhất bị thay)
  Fx.prototype.print = function (pos, yaw) {
    var i = this.printN % 240; this.printN++;
    eu.set(0, yaw, 0); q.setFromEuler(eu); ps.set(pos.x, 0.008, pos.z); sc.set(0.055, 1, 0.125); m4.compose(ps, q, sc);
    this.prints.setMatrixAt(i, m4); if (this.prints.count < 240) this.prints.count = Math.min(240, this.printN); this.prints.instanceMatrix.needsUpdate = true;
  };

  Fx.prototype.bleed = function (pos, dir, amount) {
    var n = Math.round(4 + amount * 9);
    for (var i = 0; i < n; i++) {
      var it = this.blood.spawn(); it.p.copy(pos);
      it.v.set(dir.x * (1 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.8, 0.8 + Math.random() * 2.4, dir.z * (1 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.8);
      it.max = 1.2; it.s = 0.6 + Math.random() * 1.1;
    }
  };
  Fx.prototype.stain = function (x, z, r) {
    var it = this.decal.spawn(); it.p.set(x, this.decalY + Math.random() * 0.004, z); it.s = r * 0.3; it.grow = r; it.max = 1e9; it.rot = Math.random() * 6;
  };
  Fx.prototype.puff = function (pos, n, power) {
    for (var i = 0; i < n; i++) {
      var it = this.dust.spawn(); it.p.set(pos.x + (Math.random() - 0.5) * 0.25, 0.06, pos.z + (Math.random() - 0.5) * 0.25);
      it.v.set((Math.random() - 0.5) * 0.9 * power, 0.25 + Math.random() * 0.5 * power, (Math.random() - 0.5) * 0.9 * power);
      it.max = 0.7 + Math.random() * 0.5; it.s = 0.5 + Math.random() * 0.8 * power;
    }
  };
  Fx.prototype.sparks = function (pos, n) {
    for (var i = 0; i < n; i++) {
      var it = this.spark.spawn(); it.p.copy(pos);
      it.v.set((Math.random() - 0.5) * 5, Math.random() * 3.5, (Math.random() - 0.5) * 5); it.max = 0.22 + Math.random() * 0.2; it.s = 1;
    }
  };

  function upd(pool, dt, f) {
    var any = false;
    for (var i = 0; i < pool.n; i++) {
      var it = pool.items[i]; if (!it.on) continue; any = true;
      it.life += dt;
      var s = f(it, dt);
      if (s <= 0) { it.on = false; m4.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, m4); continue; }
      eu.set(it.rot, it.rot * 0.7, 0); q.setFromEuler(eu); sc.set(s, pool.flat ? 1 : s, s);
      m4.compose(it.p, q, sc); pool.mesh.setMatrixAt(i, m4);
    }
    if (any) pool.mesh.instanceMatrix.needsUpdate = true;
  }
  Fx.prototype.update = function (dt) {
    var self = this, i;
    upd(this.blood, dt, function (it, dt) {
      if (it.life > it.max) return 0;
      it.v.y -= 9.8 * dt; it.p.addScaledVector(it.v, dt); it.rot += it.rv * dt;
      if (it.p.y < 0.02 && it.v.y < 0) { if (Math.random() < 0.22) self.stain(it.p.x, it.p.z, 0.04 + Math.random() * 0.07); return 0; }
      return it.s;
    });
    upd(this.dust, dt, function (it, dt) {
      if (it.life > it.max) return 0;
      it.p.addScaledVector(it.v, dt); it.v.multiplyScalar(1 - dt * 2.2); it.rot += dt * 0.6;
      var u = it.life / it.max; return it.s * (0.5 + u * 1.6) * (1 - u * u);
    });
    upd(this.spark, dt, function (it, dt) { if (it.life > it.max) return 0; it.v.y -= 12 * dt; it.p.addScaledVector(it.v, dt); return 1 - it.life / it.max; });
    for (i = 0; i < this.trails.length; i++) this.trails[i].update(dt);
    // vết máu: loang dần rồi nằm yên
    var dp = this.decal, any = false;
    for (i = 0; i < dp.n; i++) {
      var it = dp.items[i]; if (!it.on || it.done) continue;
      it.s += (it.grow - it.s) * Math.min(1, dt * 3); if (it.grow - it.s < 0.004) it.done = true;
      eu.set(0, it.rot, 0); q.setFromEuler(eu); sc.set(it.s, 1, it.s * 0.8); m4.compose(it.p, q, sc); dp.mesh.setMatrixAt(i, m4); any = true;
    }
    if (any) dp.mesh.instanceMatrix.needsUpdate = true;
    // vật bay
    for (i = this.projs.length - 1; i >= 0; i--) {
      var p = this.projs[i]; p.t += dt; var u = Math.min(1, p.t / p.dur);
      p.to(tv); // đích di động
      ps.lerpVectors(p.from, tv, u); ps.y += Math.sin(u * PI) * p.arc;
      if (p.type === 'net') { p.obj.position.copy(ps); p.obj.rotation.y += dt * 14; p.obj.rotation.x = 0.5; p.obj.scale.setScalar(0.35 + u * 0.75); }
      else {
        tv.sub(p.prev); if (tv.lengthSq() > 1e-8) { p.obj.quaternion.setFromUnitVectors(UP, tv.normalize()); }
        p.obj.position.copy(ps); p.prev.copy(ps);
      }
      if (u >= 1) { this.projs.splice(i, 1); if (p.done) p.done(p); else this.scene.remove(p.obj); }
    }
    for (i = this.nets.length - 1; i >= 0; i--) {
      var n = this.nets[i]; n.t += dt;
      n.obj.position.set(n.fig.base.x, 0, n.fig.base.z);
      var k = Math.min(1, n.t / 0.15), out = n.t > n.dur ? Math.max(0, 1 - (n.t - n.dur) / 0.3) : 1;
      n.obj.scale.set(k * out, (0.4 + 0.6 * k) * out, k * out); n.obj.rotation.y = Math.sin(n.t * 9) * 0.08;
      if (n.fig.dead) n.dur = Math.min(n.dur, n.t);
      if (n.t > n.dur + 0.3) { this.scene.remove(n.obj); this.nets.splice(i, 1); }
    }
  };

  var javGeo = null, netGeo = null, drapeGeo = null;
  function javelinMesh() {
    if (!javGeo) { var g = new V.Geo(); g.cyl(0.011, 0.012, 1.26, 5, 0x7a5a3a, { y: -0.12 }); g.cyl(0.006, 0.008, 0.2, 4, P.iron, { y: 0.6 }); g.cone(0.016, 0.07, 4, P.steel, { y: 0.735 }); javGeo = g.build(); }
    return new T.Mesh(javGeo, V.M.matte);
  }
  function netMat() { return new T.LineBasicMaterial({ color: 0xb8a070 }); }
  function netFlat() {
    if (!netGeo) {
      var pts = [], n = 10, r, i, a, b;
      for (r = 1; r <= 3; r++) for (i = 0; i < n; i++) { a = i / n * PI * 2; b = (i + 1) / n * PI * 2; pts.push(Math.cos(a) * r * 0.25, 0, Math.sin(a) * r * 0.25, Math.cos(b) * r * 0.25, 0, Math.sin(b) * r * 0.25); }
      for (i = 0; i < n; i++) { a = i / n * PI * 2; pts.push(0, 0, 0, Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75); }
      netGeo = new T.BufferGeometry(); netGeo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    }
    return new T.LineSegments(netGeo, netMat());
  }
  function netDrape() {
    if (!drapeGeo) {
      var pts = [], n = 10, rings = [[0.12, 1.62], [0.36, 1.45], [0.5, 1.05], [0.58, 0.6], [0.72, 0.18], [0.9, 0.02]], r, i, a, b;
      for (r = 0; r < rings.length; r++) for (i = 0; i < n; i++) {
        a = i / n * PI * 2; b = (i + 1) / n * PI * 2;
        pts.push(Math.cos(a) * rings[r][0], rings[r][1], Math.sin(a) * rings[r][0], Math.cos(b) * rings[r][0], rings[r][1], Math.sin(b) * rings[r][0]);
        if (r > 0) pts.push(Math.cos(a) * rings[r - 1][0], rings[r - 1][1], Math.sin(a) * rings[r - 1][0], Math.cos(a) * rings[r][0], rings[r][1], Math.sin(a) * rings[r][0]);
        else pts.push(0, 1.7, 0, Math.cos(a) * rings[0][0], rings[0][1], Math.sin(a) * rings[0][0]);
      }
      drapeGeo = new T.BufferGeometry(); drapeGeo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    }
    return new T.LineSegments(drapeGeo, netMat());
  }
  // from: V3; to: hàm(out) trả điểm đích hiện tại; done(p): gọi khi tới nơi
  Fx.prototype.throwJavelin = function (from, to, dur, done) {
    var o = javelinMesh(); o.castShadow = true; o.position.copy(from); this.scene.add(o);
    this.projs.push({ type: 'javelin', obj: o, from: from.clone(), prev: from.clone(), to: to, t: 0, dur: dur, arc: 0.25 + dur * 0.9, done: done });
  };
  Fx.prototype.throwNet = function (from, to, dur, done) {
    var o = netFlat(); o.position.copy(from); this.scene.add(o);
    this.projs.push({ type: 'net', obj: o, from: from.clone(), prev: from.clone(), to: to, t: 0, dur: dur, arc: 0.8, done: done });
  };
  Fx.prototype.drape = function (fig, dur) { var o = netDrape(); o.scale.setScalar(0.01); this.scene.add(o); this.nets.push({ obj: o, fig: fig, t: 0, dur: dur }); };
  // cây lao cắm lại trên cát hoặc trên khiên
  Fx.prototype.stick = function (obj, parent, life) { this.debris.push({ obj: obj, parent: parent, life: life }); if (this.debris.length > 14) { var d = this.debris.shift(); if (d.obj.parent) d.obj.parent.remove(d.obj); } };
  Fx.prototype.javelinMesh = javelinMesh;
  Fx.prototype.dispose = function () {
    var s = this.scene, self = this;
    ['blood', 'dust', 'spark', 'decal'].forEach(function (k) { s.remove(self[k].mesh); self[k].mesh.geometry.dispose(); self[k].mesh.material.dispose(); });
    this.projs.forEach(function (p) { s.remove(p.obj); }); this.nets.forEach(function (n) { s.remove(n.obj); });
    this.debris.forEach(function (d) { if (d.obj.parent) d.obj.parent.remove(d.obj); });
    this.trails.forEach(function (t) { s.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); });
    s.remove(this.prints); this.prints.geometry.dispose(); this.prints.material.dispose();
  };
})(window.G = window.G || {});

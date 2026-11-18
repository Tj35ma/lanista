// LANISTA — các không gian 3D tĩnh (Env): đấu trường ×4, chợ nô lệ, lò rèn, phòng chờ.
// Mọi thứ dựng bằng mã: khối low-poly gom vào vài mesh, không texture ngoài, không tệp ngoài.
(function (G) {
  'use strict';
  var T = THREE, V = G.V = G.V || {}, P = V.PAL, PI = Math.PI;
  var ZC = 7.0;                       // mặt cắt phía camera: vật cao hơn ~1.3 m chỉ được nằm ở z <= ZC
  var sd = 7;
  function rnd() { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var CLOTHS = [0x8f7a5e, 0xa08a6a, 0x7d6248, 0xb9a988, 0x9a5a3c, 0x6f7a5a, 0x6a7786, 0xc2b594, 0x8a4a34, 0xa39070, 0x5f6b45, 0xb58a3c];
  var SKINS = [0xc99a78, 0xd9a888, 0xb98660, 0x8a6044, 0xcf9f7f];
  var AWN = [0x8c4232, 0xa58549, 0xc6bca2, 0x62694a, 0x4a5f70, 0x7d4a3a];
  var _mc = new T.Color(), _mg = new T.Color(0x8a7866);
  function mute(c, k) { return _mc.set(c).lerp(_mg, k == null ? 0.28 : k).getHex(); }
  var WOODS = [P.wood, P.woodDark, P.woodLight];

  // ---------------------------------------------------------------- Bộ gom hình
  function Kit() { this.m = new V.Geo(0.07, 0.04); this.x = new V.Geo(0.05, 0.04); this.g = new V.Geo(0.05, 0.08); this.d = new V.Geo(0.06, 0.03); }
  Kit.prototype.into = function (grp) {
    if (!this.m.empty()) grp.add(V.mesh(this.m, 'matte'));
    if (!this.x.empty()) grp.add(V.mesh(this.x, 'metal'));
    if (!this.d.empty()) grp.add(V.mesh(this.d, 'matteDouble'));
    if (!this.g.empty()) grp.add(V.mesh(this.g, 'glow', false, false));
  };
  // toạ độ cục bộ (lx, lz) của một vật quay ry đặt tại (x, z) → tf thế giới (thứ tự YXZ: quay riêng trước, quay ry sau)
  function loc(x, z, ry, lx, lz) { var s = Math.sin(ry), c = Math.cos(ry); return [x + lx * c + lz * s, z - lx * s + lz * c]; }
  function at(x, z, ry, lx, lz, y, o) {
    var p = loc(x, z, ry, lx, lz); o = o || {};
    o.x = p[0]; o.z = p[1]; o.y = y; o.ry = (o.ry || 0) + ry; o.order = 'YXZ'; return o;
  }
  // một đoạn vành (rộng ~0.12R, dày <1 m) ở bán kính R, góc a có nằm trọn sau mặt cắt không
  function vis(R, a, m) { return R * Math.cos(a) + 0.062 * R * Math.abs(Math.sin(a)) + 0.45 <= ZC - (m || 0); }

  // ---------------------------------------------------------------- Nền chung: nắng, trời, bụi
  function base(o) {
    var grp = new T.Group(), c = o.center || [0, 0, 0];
    var sun = new T.DirectionalLight(o.sunCol || 0xffd7a6, o.sunInt);
    var d = new T.Vector3(o.sunDir[0], o.sunDir[1], o.sunDir[2]).normalize().multiplyScalar(40);
    sun.position.set(c[0] + d.x, c[1] + d.y, c[2] + d.z); sun.target.position.set(c[0], c[1], c[2]);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -o.shadow[0]; sc.right = o.shadow[0]; sc.top = o.shadow[1]; sc.bottom = -o.shadow[1]; sc.near = 4; sc.far = 95; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2.5;
    grp.add(sun); grp.add(sun.target);
    var hemi = new T.HemisphereLight(o.hemi[0], o.hemi[1], o.hemi[2]); grp.add(hemi);
    // vòm trời: mù ấm ở chân trời, xanh bụi phía trên, quầng sáng quanh mặt trời
    var sdir = new T.Vector3(o.sunDir[0], o.sunDir[1], o.sunDir[2]).normalize();
    var g = new T.SphereGeometry(170, 28, 14), p = g.attributes.position, col = [], a = new T.Color(o.skyHor || 0xe6cfa6), b = new T.Color(o.skyTop || 0x8fb0c8), gl = new T.Color(o.skyGlow || 0xffedc8), cc = new T.Color(), vv = new T.Vector3(), i;
    for (i = 0; i < p.count; i++) {
      vv.fromBufferAttribute(p, i).normalize();
      var t = V.clamp(vv.y * 1.5, 0, 1); cc.copy(a).lerp(b, Math.pow(t, 0.65));
      var sdot = Math.max(0, vv.x * sdir.x + vv.y * sdir.y + vv.z * sdir.z);
      cc.lerp(gl, Math.min(1, Math.pow(sdot, 4) * 0.7 + Math.pow(sdot, 30) * 0.3));
      col.push(cc.r, cc.g, cc.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    var sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sky.frustumCulled = false; grp.add(sky);
    var env = { group: grp, sun: sun, hemi: hemi, fog: o.fog, bg: o.bg, upd: [] };
    env.update = function (t, dt) { for (var i = 0; i < env.upd.length; i++) env.upd[i](t, dt || 0.016); };
    if (!o.noSun) {                  // đĩa mặt trời thấp + quầng
      var sm = new T.SpriteMaterial({ map: sprite(), color: 0xffe9c2, fog: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true, opacity: 0.55 });
      var s1 = new T.Sprite(sm); s1.position.copy(sdir).multiplyScalar(160); s1.scale.setScalar(80); s1.renderOrder = -9; grp.add(s1);
      var s2 = new T.Sprite(sm.clone()); s2.material.opacity = 1; s2.material.color.set(0xfff6e0); s2.position.copy(s1.position); s2.scale.setScalar(20); s2.renderOrder = -8; grp.add(s2);
    }
    if (o.hills !== false) {         // hai lớp đồi xa chìm trong mù
      var hg = new V.Geo(0.02, 0.015), hc = new T.Color(), hd = new T.Color(o.hillCol || 0x7b6f5e), layer, N2 = 80, h0 = 0;
      for (layer = 0; layer < 2; layer++) {
        var Rh = layer ? 112 : 150, prev = null;
        hc.copy(a).lerp(hd, layer ? 0.34 : 0.17);
        for (i = 0; i <= N2; i++) {
          var an = i / N2 * 2 * PI, hh = (layer ? 3 : 8) + (layer ? 8 : 15) * (0.5 + 0.5 * Math.sin(an * 3 + layer * 2.1) * Math.sin(an * 7.3 + 1.7 + layer)) + rr(0, layer ? 2.5 : 4);
          if (i === N2) hh = h0; else if (i === 0) h0 = hh;
          var cur = [Rh * Math.sin(an), hh, Rh * Math.cos(an)];
          if (prev) hg.quad([prev[0], -4, prev[2]], [cur[0], -4, cur[2]], cur, prev, hc.getHex());
          prev = cur;
        }
      }
      var hm = new T.Mesh(hg.build(), new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: T.DoubleSide })); hm.renderOrder = -7; hm.frustumCulled = false; grp.add(hm);
    }
    if (o.birds) {                   // vài con chim lượn chậm
      var bgm = new T.BufferGeometry(); bgm.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.14, 0.55, 0.16, 0, 0, 0, -0.14, 0, 0, 0.14, 0, 0, -0.14, -0.55, 0.16, 0], 3));
      var bm = new T.MeshBasicMaterial({ color: 0x2c2620, side: T.DoubleSide });
      for (i = 0; i < o.birds; i++) (function (ph, r, hgt, spd) {
        var m = new T.Mesh(bgm, bm); m.frustumCulled = false; grp.add(m);
        env.upd.push(function (t) { var an = t * spd + ph; m.position.set(c[0] + Math.sin(an) * r, hgt + Math.sin(t * 0.3 + ph) * 1.5, c[2] - 14 + Math.cos(an) * r); m.rotation.y = an + (spd > 0 ? PI / 2 : -PI / 2); m.scale.y = Math.sin(t * 7 + ph * 3) * 1.5; });
      })(rr(0, 6.28), rr(10, 24), rr(13, 22), rr(0.1, 0.2) * (rnd() < 0.5 ? 1 : -1));
    }
    return env;
  }
  var spriteTex = null;
  function sprite() {
    if (spriteTex) return spriteTex;
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    spriteTex = new T.CanvasTexture(c); return spriteTex;
  }
  // bụi lơ lửng trong hộp b = [x0,y0,z0,x1,y1,z1]
  function dust(env, b, n, size) {
    var pos = new Float32Array(n * 3), vel = [], i;
    for (i = 0; i < n; i++) { pos[i * 3] = rr(b[0], b[3]); pos[i * 3 + 1] = rr(b[1], b[4]); pos[i * 3 + 2] = rr(b[2], b[5]); vel.push(rr(-0.12, 0.12), rr(-0.03, 0.05), rr(-0.1, 0.1), rr(0, 6.28)); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ size: size || 0.07, map: sprite(), color: 0xffe2b8, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
    var pts = new T.Points(g, m); pts.frustumCulled = false; env.group.add(pts);
    env.upd.push(function (t, dt) {
      for (var i = 0; i < n; i++) {
        var k = i * 3, v = i * 4;
        pos[k] += (vel[v] + Math.sin(t * 0.4 + vel[v + 3]) * 0.05) * dt; pos[k + 1] += vel[v + 1] * dt; pos[k + 2] += vel[v + 2] * dt;
        if (pos[k] < b[0]) pos[k] = b[3]; else if (pos[k] > b[3]) pos[k] = b[0];
        if (pos[k + 1] < b[1]) pos[k + 1] = b[4]; else if (pos[k + 1] > b[4]) pos[k + 1] = b[1];
        if (pos[k + 2] < b[2]) pos[k + 2] = b[5]; else if (pos[k + 2] > b[5]) pos[k + 2] = b[2];
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- Khán giả (InstancedMesh thân + đầu + tay giơ)
  function Crowd() { this.pts = []; }
  Crowd.prototype.add = function (x, y, z, s, col) { this.pts.push([x, y, z, s || 1, col || 0]); };
  Crowd.prototype.build = function (env) {
    var n = this.pts.length, i; env.crowdCount = n;
    if (!n) { env.cheer = function () { }; return; }
    var bg = new V.Geo(0, 0.07); bg.cyl(0.16, 0.21, 0.8, 5, 0xffffff, { y: 0.4 }); bg.cyl(0.25, 0.17, 0.5, 6, 0xffffff, { y: 1.02, sz: 0.6 });
    var hg = new V.Geo(0, 0.06); hg.ico(0.118, 0, 0xffffff, { y: 1.45 }); hg.cyl(0.05, 0.065, 0.1, 4, 0xffffff, { y: 1.3 });
    var ag = new V.Geo(0, 0.05); ag.box(0.075, 0.52, 0.075, 0xffffff, { x: 0.3, y: 1.5, rz: -0.42 }); ag.box(0.075, 0.52, 0.075, 0xffffff, { x: -0.3, y: 1.5, rz: 0.42 });
    var isArm = [], na = 0; for (i = 0; i < n; i++) { var f = rnd() < 0.42; isArm.push(f); if (f) na++; }
    var mat = new T.MeshLambertMaterial({ flatShading: true });
    var body = new T.InstancedMesh(bg.build(), mat, n), head = new T.InstancedMesh(hg.build(), mat, n), arms = new T.InstancedMesh(ag.build(), mat, Math.max(1, na));
    var o = new T.Object3D(), c = new T.Color(), ph = [], by = [], ang = [], sy = [], k = 0;
    for (i = 0; i < n; i++) {
      var p = this.pts[i];
      o.position.set(p[0], p[1], p[2]); o.rotation.set(0, Math.atan2(-p[0], -p[2]) + rr(-0.5, 0.5), 0); o.scale.set(p[3] * rr(0.88, 1.14), p[3] * rr(0.86, 1.1), p[3] * rr(0.9, 1.1)); o.updateMatrix();
      body.setMatrixAt(i, o.matrix); head.setMatrixAt(i, o.matrix);
      body.setColorAt(i, c.set(p[4] || pick(CLOTHS))); head.setColorAt(i, c.set(pick(SKINS)));
      if (isArm[i]) { o.scale.y = 0.0001; o.updateMatrix(); arms.setMatrixAt(k, o.matrix); arms.setColorAt(k, c.set(pick(SKINS))); k++; }
      ph.push(rr(0, 6.28), rr(0.45, 1)); by.push(p[1]); ang.push(Math.atan2(p[0], p[2])); sy.push(p[3]);
    }
    body.castShadow = head.castShadow = arms.castShadow = false; body.receiveShadow = head.receiveShadow = arms.receiveShadow = false;
    body.frustumCulled = head.frustumCulled = arms.frustumCulled = false;
    env.group.add(body); env.group.add(head); env.group.add(arms);
    var lvl = 0, wt = 9, w0 = 0, A = body.instanceMatrix.array, B = head.instanceMatrix.array, C = arms.instanceMatrix.array;
    // reo hò lan thành sóng quanh khán đài, bắt đầu từ một góc ngẫu nhiên
    env.cheer = function (a) { a = Math.min(1, a == null ? 1 : a); if (lvl < 0.25) { wt = 0; w0 = Math.random() * 6.28; } lvl = Math.max(lvl, a); };
    env.upd.push(function (t, dt) {
      lvl *= Math.exp(-dt / 0.6); wt += dt;
      var front = wt * 5.5 + 0.5, k = 0;
      for (var i = 0; i < n; i++) {
        var y = by[i] + Math.sin(t * 1.3 + ph[i * 2]) * 0.012, act = 0;
        if (lvl > 0.01) {
          var d = Math.abs(ang[i] - w0); if (d > PI) d = 2 * PI - d;
          act = lvl * V.clamp((front - d) / 0.7, 0, 1);
          y += act * ph[i * 2 + 1] * 0.28 * Math.abs(Math.sin(t * 8.5 + ph[i * 2]));
        }
        A[i * 16 + 13] = y; B[i * 16 + 13] = y;
        if (isArm[i]) { C[k * 16 + 13] = y; C[k * 16 + 5] = sy[i] * Math.max(0.0001, Math.min(1, act * 2.4 * ph[i * 2 + 1])); k++; }
      }
      body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true; arms.instanceMatrix.needsUpdate = true;
    });
  };

  // ---------------------------------------------------------------- Đạo cụ
  function amphora(k, x, y, z, s) {
    s = s || 1; var c = pick([P.terracotta, P.brick, 0xa0623e]);
    k.m.cyl(0.16 * s, 0.06 * s, 0.5 * s, 6, c, { x: x, y: y + 0.27 * s, z: z });
    k.m.cyl(0.06 * s, 0.16 * s, 0.14 * s, 6, c, { x: x, y: y + 0.59 * s, z: z });
    k.m.cyl(0.07 * s, 0.05 * s, 0.12 * s, 6, c, { x: x, y: y + 0.72 * s, z: z });
  }
  function crate(k, x, y, z, s, ry) { k.m.box(s, s * 0.8, s, pick(WOODS), { x: x, y: y + s * 0.4, z: z, ry: ry != null ? ry : rr(0, 1.5) }); }
  function barrel(k, x, y, z, s) {
    s = s || 1; k.m.cyl(0.26 * s, 0.24 * s, 0.75 * s, 8, P.wood, { x: x, y: y + 0.375 * s, z: z });
    k.m.cyl(0.275 * s, 0.275 * s, 0.05 * s, 8, P.ironDark, { x: x, y: y + 0.2 * s, z: z }); k.m.cyl(0.275 * s, 0.275 * s, 0.05 * s, 8, P.ironDark, { x: x, y: y + 0.58 * s, z: z });
  }
  function hay(k, x, y, z, ry) { k.m.box(0.9, 0.5, 0.55, P.straw, { x: x, y: y + 0.25, z: z, ry: ry || 0 }); }
  function column(k, x, z, h, r, c, y0) {
    y0 = y0 || 0; k.m.box(r * 2.8, 0.18, r * 2.8, c, { x: x, y: y0 + 0.09, z: z });
    k.m.cyl(r * 0.85, r, h - 0.4, 8, c, { x: x, y: y0 + h / 2, z: z }); k.m.box(r * 2.7, 0.22, r * 2.7, c, { x: x, y: y0 + h - 0.11, z: z });
  }
  // mái hai dốc, sống mái dọc trục z cục bộ; y = chân mái
  function gable(k, x, y, z, w, d, h, ry, c) {
    k.m.cyl(1, 1, d, 3, mute(c), { x: x, y: y + h / 3, z: z, rx: -PI / 2, ry: ry || 0, order: 'YXZ', sx: w / 1.732, sz: h / 1.5 });
  }
  function house(k, x, z, w, d, h, ry, wall, roof) {
    k.m.box(w, h, d, wall || P.plaster, { x: x, y: h / 2, z: z, ry: ry });
    gable(k, x, h, z, w + 0.5, d + 0.5, w * 0.3, ry, roof || P.terracotta);
    var f = d / 2 + 0.02;
    k.m.box(0.8, 1.7, 0.06, P.woodDark, at(x, z, ry, 0, f, 0.85));
    k.m.box(0.5, 0.6, 0.06, P.black, at(x, z, ry, w * 0.3, f, h * 0.64)); k.m.box(0.5, 0.6, 0.06, P.black, at(x, z, ry, -w * 0.3, f, h * 0.64));
  }
  function stall(k, x, z, ry, col) {
    var i, p, pts = [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]];
    for (i = 0; i < 4; i++) { var h = pts[i][1] > 0 ? 1.9 : 2.3; p = loc(x, z, ry, pts[i][0], pts[i][1]); k.m.cyl(0.05, 0.05, h, 4, P.woodDark, { x: p[0], y: h / 2, z: p[1] }); }
    k.m.box(2.1, 0.08, 1.0, P.wood, { x: x, y: 0.85, z: z, ry: ry });
    k.d.box(2.4, 0.04, 1.6, col, { x: x, y: 2.13, z: z, ry: ry, rx: 0.32, order: 'YXZ' });
    for (i = 0; i < 4; i++) {
      p = loc(x, z, ry, rr(-0.8, 0.8), rr(-0.3, 0.3));
      if (rnd() < 0.5) amphora(k, p[0], 0.89, p[1], 0.6); else k.m.box(0.3, 0.2, 0.3, pick([P.straw, P.clothOchre, P.leaf, P.terracotta]), { x: p[0], y: 0.99, z: p[1], ry: rr(0, 1) });
    }
  }
  function cart(k, x, z, ry) {
    k.m.box(1.9, 0.1, 1.0, P.wood, at(x, z, ry, 0, 0, 0.62));
    k.m.box(1.9, 0.32, 0.05, P.woodDark, at(x, z, ry, 0, 0.5, 0.82)); k.m.box(1.9, 0.32, 0.05, P.woodDark, at(x, z, ry, 0, -0.5, 0.82));
    k.m.cyl(0.42, 0.42, 0.07, 8, P.woodDark, at(x, z, ry, -0.3, 0.58, 0.42, { rx: PI / 2 })); k.m.cyl(0.42, 0.42, 0.07, 8, P.woodDark, at(x, z, ry, -0.3, -0.58, 0.42, { rx: PI / 2 }));
    k.m.box(1.5, 0.06, 0.06, P.wood, at(x, z, ry, 1.6, 0.3, 0.42, { rz: -0.22 })); k.m.box(1.5, 0.06, 0.06, P.wood, at(x, z, ry, 1.6, -0.3, 0.42, { rz: -0.22 }));
  }
  function well(k, x, z) {
    k.m.cyl(0.75, 0.8, 0.7, 8, P.stone, { x: x, y: 0.35, z: z }); k.m.cyl(0.55, 0.55, 0.04, 8, P.black, { x: x, y: 0.71, z: z });
    k.m.box(0.1, 1.6, 0.1, P.woodDark, { x: x - 0.7, y: 1.2, z: z }); k.m.box(0.1, 1.6, 0.1, P.woodDark, { x: x + 0.7, y: 1.2, z: z });
    k.m.cyl(0.06, 0.06, 1.5, 5, P.wood, { x: x, y: 1.75, z: z, rz: PI / 2 }); gable(k, x, 2.0, z, 1.3, 1.9, 0.45, PI / 2, P.woodDark);
  }
  function tree(k, x, z, s) {
    k.m.cyl(0.12 * s, 0.2 * s, 2.2 * s, 5, P.woodDark, { x: x, y: 1.1 * s, z: z });
    k.m.ico(1.1 * s, 0, P.leaf, { x: x, y: 2.9 * s, z: z, sy: 0.8, ry: rr(0, 3) }); k.m.ico(0.8 * s, 0, 0x4f6336, { x: x + 0.5 * s, y: 3.5 * s, z: z + 0.3 * s, ry: rr(0, 3) });
  }
  function cypress(k, x, z, s) { k.m.cyl(0.1 * s, 0.14 * s, 1.0 * s, 5, P.woodDark, { x: x, y: 0.5 * s, z: z }); k.m.cone(0.7 * s, 5.5 * s, 6, 0x3f5232, { x: x, y: 3.6 * s, z: z }); }
  function ox(k, x, z, ry) {
    var c = pick([0x7a5a40, 0xb9a488, 0x5a4434]);
    k.m.box(1.5, 0.7, 0.6, c, at(x, z, ry, 0, 0, 1.0)); k.m.box(0.45, 0.42, 0.4, c, at(x, z, ry, 0.95, 0, 1.15));
    k.m.box(0.14, 0.7, 0.14, c, at(x, z, ry, 0.55, 0.2, 0.35)); k.m.box(0.14, 0.7, 0.14, c, at(x, z, ry, 0.55, -0.2, 0.35));
    k.m.box(0.14, 0.7, 0.14, c, at(x, z, ry, -0.55, 0.2, 0.35)); k.m.box(0.14, 0.7, 0.14, c, at(x, z, ry, -0.55, -0.2, 0.35));
    k.m.box(0.06, 0.06, 0.7, P.white, at(x, z, ry, 1.05, 0, 1.4));
  }
  function statue(k, x, y, z, ry, c, s) {
    c = c || P.marble; s = s || 1;
    k.m.box(0.6 * s, 0.7 * s, 0.6 * s, c, { x: x, y: y + 0.35 * s, z: z, ry: ry }); k.m.box(0.72 * s, 0.08 * s, 0.72 * s, c, { x: x, y: y + 0.74 * s, z: z, ry: ry });
    k.m.cyl(0.17 * s, 0.25 * s, 0.95 * s, 6, c, { x: x, y: y + 1.25 * s, z: z, ry: ry });
    k.m.cyl(0.25 * s, 0.18 * s, 0.5 * s, 6, c, { x: x, y: y + 1.95 * s, z: z, ry: ry, sz: 0.62 });
    k.m.ico(0.13 * s, 1, c, { x: x, y: y + 2.38 * s, z: z });
    k.m.box(0.09 * s, 0.55 * s, 0.09 * s, c, at(x, z, ry, 0.3 * s, 0.05, y + 2.3 * s, { rz: -0.45 }));
    k.m.box(0.09 * s, 0.5 * s, 0.09 * s, c, at(x, z, ry, -0.27 * s, 0.03, y + 1.75 * s, { rz: 0.12 }));
  }
  // cờ vải đung đưa (mesh riêng để quay được). (x,y,z) = mép trên
  function banner(env, x, y, z, ry, col, w, h) {
    var g = new V.Geo(0.05, 0.03); g.box(w, h, 0.03, col, { y: -h / 2 }); g.box(w + 0.12, 0.06, 0.06, P.woodDark, {});
    g.box(w * 0.45, h * 0.12, 0.05, P.clothOchre, { y: -h * 0.35 });
    var m = V.mesh(g, 'matteDouble', true, false); m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.y = ry; env.group.add(m);
    var ph = rr(0, 6);
    env.upd.push(function (t) { m.rotation.x = Math.sin(t * 1.1 + ph) * 0.06 + Math.sin(t * 2.3 + ph) * 0.025; });
  }
  // đuốc: light = cường độ PointLight (0 = không đèn)
  function torch(env, k, x, y, z, light) {
    k.m.cyl(0.035, 0.025, 0.5, 5, P.woodDark, { x: x, y: y, z: z }); k.x.cyl(0.08, 0.05, 0.1, 6, P.ironDark, { x: x, y: y + 0.28, z: z });
    var g = new V.Geo(0, 0.2); g.cone(0.09, 0.3, 5, 0xffb347, { y: 0.15 }); g.cone(0.05, 0.2, 4, 0xfff0a0, { y: 0.12 });
    var f = V.mesh(g, 'glow', false, false); f.position.set(x, y + 0.33, z); env.group.add(f);
    var L = null; if (light) { L = new T.PointLight(0xff9a48, light, 12, 1.7); L.position.set(x, y + 0.5, z + 0.2); env.group.add(L); }
    var ph = rr(0, 9);
    env.upd.push(function (t) {
      var n = 0.82 + 0.18 * Math.sin(t * 11 + ph) * Math.sin(t * 7.3 + ph * 2) + 0.08 * Math.sin(t * 23 + ph);
      f.scale.set(1, 0.85 + n * 0.35, 1); f.rotation.y = t * 3; if (L) L.intensity = light * n;
    });
  }
  // vòng hộp tiếp tuyến quanh tâm; hFn(a, i) → null (bỏ) hoặc {h, y0, c}
  function ring(geo, R, N, thick, col, hFn, a0) {
    var w = 2 * R * Math.tan(PI / N) + 0.02;
    for (var i = 0; i < N; i++) {
      var a = (a0 || 0) + i / N * 2 * PI, h = hFn(a, i); if (!h) continue;
      geo.box(w, h.h, thick, h.c || col, { x: R * Math.sin(a), y: (h.y0 || 0) + h.h / 2, z: R * Math.cos(a), ry: a });
    }
  }
  function hash2(x, z) { var q = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return q - Math.floor(q); }
  function vnoise(x, z) {
    var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    var a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  var SANDS = [0xc2a273, 0xcaa978, 0xd0b381, 0xdec995], _sc = new T.Color(), _sd = new T.Color();
  // sân cát: đĩa phẳng y = 0 (góc a0..a0+aLen), mỗi mặt một sắc theo nhiễu; giữa sân bị giẫm sậm hơn, chân rào sậm hơn;
  // thêm vết cào vòng cung, vết kéo lê, dấu chân, sỏi, vết máu cũ. Mọi thứ nằm dưới y = 0.011.
  function sandFloor(k, R, a0, aLen, base) {
    var NR = 13, NS = Math.max(8, Math.round(64 * aLen / (2 * PI))), i, j, jt = k.m.jit, fj = k.m.fj, full = aLen > 6, G0 = [], a, r, x, z;
    function col(x, z) {
      var d = Math.sqrt(x * x + z * z) / R, n = vnoise(x * 0.33 + 7, z * 0.33 + 3) * 0.6 + vnoise(x * 0.9, z * 0.9 + 11) * 0.3 + vnoise(x * 2.3 + 5, z * 2.3) * 0.1;
      var f = 0.875 + n * 0.28 - 0.075 * Math.exp(-d * d / 0.2) - 0.11 * V.smooth((d - 0.87) / 0.13);
      _sc.set(base).multiplyScalar(f); _sc.lerp(_sd.set(0x7a4a34), 0.09 * Math.exp(-d * d / 0.1) * (0.4 + n));
      return _sc.getHex();
    }
    k.m.jit = 0.012; k.m.fj = 0;
    for (i = 0; i <= NR; i++) {
      G0.push([]); r = R * Math.pow(i / NR, 0.9);
      for (j = 0; j <= NS; j++) {
        if (full && j === NS) { G0[i].push(G0[i][0]); continue; }
        var edge = i === 0 || i === NR || (!full && (j === 0 || j === NS));
        a = a0 + (j + (edge ? 0 : rr(-0.3, 0.3))) / NS * aLen; var rj = edge ? r : r + rr(-0.16, 0.16);
        G0[i].push([rj * Math.sin(a), 0, rj * Math.cos(a)]);
      }
    }
    for (i = 0; i < NR; i++) for (j = 0; j < NS; j++) {
      var A = G0[i][j], B = G0[i + 1][j], C = G0[i + 1][j + 1], D = G0[i][j + 1];
      if ((i + j) % 2) { k.m.tri(A, B, C, col((A[0] + B[0] + C[0]) / 3, (A[2] + B[2] + C[2]) / 3)); if (i) k.m.tri(A, C, D, col((A[0] + C[0] + D[0]) / 3, (A[2] + C[2] + D[2]) / 3)); }
      else { if (i) k.m.tri(A, B, D, col((A[0] + B[0] + D[0]) / 3, (A[2] + B[2] + D[2]) / 3)); k.m.tri(i ? B : A, i ? C : B, i ? D : C, col((B[0] + C[0] + D[0]) / 3, (B[2] + C[2] + D[2]) / 3)); }
    }
    k.m.jit = 0.02;
    function pt(pw, lim) { a = a0 + rr(0.03, 0.97) * aLen; r = R * Math.pow(rnd(), pw) * (lim || 0.93); x = r * Math.sin(a); z = r * Math.cos(a); }
    for (i = 0; i < (full ? 13 : 6); i++) {                      // vết cào vòng cung
      r = rr(2.0, R - 0.9); var st = a0 + rr(0, 0.75) * aLen, ln = Math.min(rr(0.4, 1.5), a0 + aLen - st);
      _sc.set(col(r * Math.sin(st + ln / 2), r * Math.cos(st + ln / 2))).multiplyScalar(rnd() < 0.55 ? 0.91 : 1.06);
      k.m.add(new T.RingGeometry(r - 0.025, r + 0.025, Math.max(4, Math.round(ln * 9)), 1, st - PI / 2, ln), _sc.getHex(), { rx: -PI / 2, y: 0.004 });
    }
    for (i = 0; i < (full ? 30 : 14); i++) {                     // vết kéo lê, vết trượt chân
      pt(0.7); _sc.set(col(x, z)).multiplyScalar(rr(0.88, 0.94));
      var ln2 = rr(0.4, 1.5), an2 = rr(0, 6.28), w2 = rr(0.02, 0.055), dx = Math.cos(an2), dz = Math.sin(an2);
      k.m.tri([x + dz * w2, 0.0045, z - dx * w2], [x - dz * w2, 0.0045, z + dx * w2], [x + dx * ln2, 0.0045, z + dz * ln2], _sc.getHex());
    }
    for (i = 0; i < (full ? 90 : 40); i++) {                     // dấu chân lún
      pt(0.8, 0.8); _sc.set(col(x, z)).multiplyScalar(rr(0.9, 0.955));
      k.m.add(new T.CircleGeometry(rr(0.07, 0.13), 5), _sc.getHex(), { rx: -PI / 2, rz: rr(0, 3), x: x, z: z, y: 0.003, sx: rr(1, 1.7) });
    }
    for (i = 0; i < (full ? 5 : 2); i++) {                       // vết máu cũ đã ngấm
      pt(1.2, 0.55); _sc.set(col(x, z)).lerp(_sd.set(0x4f1f14), rr(0.16, 0.28));
      for (j = 0; j < 4; j++) k.m.add(new T.CircleGeometry(rr(0.12, 0.34), j ? 5 : 6), _sc.getHex(), { rx: -PI / 2, rz: rr(0, 3), x: x + (j ? rr(-0.3, 0.3) : 0), z: z + (j ? rr(-0.3, 0.3) : 0), y: 0.0035 + j * 0.0002, sx: rr(1, 1.9) });
    }
    k.m.jit = 0.08;
    for (i = 0; i < (full ? 44 : 20); i++) {                     // sỏi
      pt(0.35, 0.96); k.m.ico(rr(0.025, 0.06), 0, pick([0x9a8f7e, 0x857a6a, 0xb0a48e]), { x: x, y: 0.008, z: z, sy: 0.5, ry: rr(0, 3) });
    }
    k.m.jit = jt; k.m.fj = fj;
  }
  // mặt cắt phía camera: tấm sẫm màu che đầu các bậc khán đài bị xẻ ở z = ZC, để vết cắt trông có chủ ý
  function section(k, r0, rings, col) {
    for (var s = -1; s <= 1; s += 2) {
      var x0 = Math.sqrt(Math.max(0, r0 * r0 - ZC * ZC));
      for (var i = 0; i < rings.length; i++) {
        var x1 = Math.sqrt(Math.max(0, rings[i][0] * rings[i][0] - ZC * ZC)), h = rings[i][1];
        if (x1 > x0 + 0.01) k.m.box(x1 - x0 + 0.03, h, 0.14, col, { x: s * (x0 + x1) / 2, y: h / 2, z: ZC + 0.03 });
        x0 = x1;
      }
    }
  }
  function flame(env, x, y, z, s) {
    var g = new V.Geo(0, 0.2); g.cone(0.09, 0.3, 5, 0xffb347, { y: 0.15 }); g.cone(0.05, 0.2, 4, 0xfff0a0, { y: 0.12 });
    var f = V.mesh(g, 'glow', false, false); f.position.set(x, y, z); env.group.add(f); var ph = rr(0, 9);
    env.upd.push(function (t) { var n = 0.82 + 0.18 * Math.sin(t * 11 + ph) * Math.sin(t * 7.3 + ph * 2); f.scale.set(s, s * (0.85 + n * 0.4), s); f.rotation.y = t * 3; });
  }
  function brazier(env, k, x, y, z, s) {
    s = s || 1;
    for (var i = 0; i < 3; i++) { var a = i * 2.094 + 0.4; k.x.beam([x + Math.cos(a) * 0.3 * s, y, z + Math.sin(a) * 0.3 * s], [x + Math.cos(a) * 0.08 * s, y + 0.95 * s, z + Math.sin(a) * 0.08 * s], 0.022, P.ironDark, 4); }
    k.x.cyl(0.27 * s, 0.14 * s, 0.17 * s, 7, P.ironDark, { x: x, y: y + 1.0 * s, z: z });
    k.g.cyl(0.21 * s, 0.21 * s, 0.03, 7, 0xff8a30, { x: x, y: y + 1.09 * s, z: z });
    flame(env, x, y + 1.1 * s, z, 1.7 * s);
  }
  function dog(k, x, z, ry) {
    var c = pick([0x6a5238, 0x8a7a5e, 0x3e3228]);
    k.m.box(0.52, 0.2, 0.17, c, at(x, z, ry, 0, 0, 0.36)); k.m.box(0.19, 0.16, 0.15, c, at(x, z, ry, 0.33, 0, 0.46)); k.m.box(0.1, 0.07, 0.08, c, at(x, z, ry, 0.46, 0, 0.42));
    for (var i = 0; i < 4; i++) k.m.box(0.05, 0.28, 0.05, c, at(x, z, ry, i < 2 ? 0.2 : -0.2, i % 2 ? 0.06 : -0.06, 0.14));
    k.m.box(0.2, 0.04, 0.04, c, at(x, z, ry, -0.33, 0, 0.47, { rz: -0.7 }));
  }
  // sạp thịt của gã đồ tể
  function butcher(k, x, z, ry) {
    var i, pts = [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]], p;
    for (i = 0; i < 4; i++) { p = loc(x, z, ry, pts[i][0], pts[i][1]); k.m.cyl(0.06, 0.06, 2.4, 4, P.woodDark, { x: p[0], y: 1.2, z: p[1] }); }
    k.m.box(2.3, 0.12, 0.9, P.woodDark, at(x, z, ry, 0, 0, 0.84)); k.m.box(2.3, 0.08, 0.08, P.woodDark, at(x, z, ry, 0, 0.5, 2.3));
    for (i = 0; i < 5; i++) { k.m.cyl(0.12, 0.07, rr(0.5, 0.7), 5, pick([0x8a3a2c, 0x9c4a3a, 0x7a2e24]), at(x, z, ry, -0.8 + i * 0.4, 0.5, 1.92)); k.x.box(0.02, 0.14, 0.02, P.ironDark, at(x, z, ry, -0.8 + i * 0.4, 0.5, 2.25)); }
    k.m.box(0.5, 0.1, 0.34, 0x8a3a2c, at(x, z, ry, -0.5, 0, 0.95)); k.m.box(0.36, 0.08, 0.3, 0x9c4a3a, at(x, z, ry, 0.3, 0.05, 0.94, { ry: 0.4 }));
    k.m.cyl(0.26, 0.28, 0.55, 7, P.wood, at(x, z, ry, 1.55, 0.4, 0.275)); k.x.box(0.3, 0.17, 0.02, P.iron, at(x, z, ry, 1.55, 0.4, 0.66, { rz: 0.5 }));
    k.d.box(2.6, 0.04, 1.5, 0x8a4a34, { x: x, y: 2.5, z: z, ry: ry, rx: 0.28, order: 'YXZ' });
  }
  function isGate(a, w) { return Math.abs(Math.sin(a)) > (w || 0.988); }
  // rải khán giả ngồi trên một hàng ghế bán kính R, mặt ghế cao y
  function seat(cr, R, y, occ, gateW, col, skip) {
    var n = Math.floor(2 * PI * R / 0.6);
    for (var i = 0; i < n; i++) {
      var a = (i + rr(0.2, 0.8)) / n * 2 * PI;
      if (!vis(R, a, 0.4 + 0.066 * R) || (gateW && isGate(a, gateW)) || (skip && skip(a)) || rnd() > occ) continue;
      cr.add(R * Math.sin(a), y - 0.5, R * Math.cos(a), 1, col);
    }
  }
  function woodGate(k, s) {
    var x = s * 9.62;
    k.m.box(0.3, 3.0, 0.3, P.woodDark, { x: x, y: 1.5, z: 1.3 }); k.m.box(0.3, 3.0, 0.3, P.woodDark, { x: x, y: 1.5, z: -1.3 });
    k.m.box(0.36, 0.3, 3.2, P.woodDark, { x: x, y: 3.0, z: 0 });
    k.m.box(1.15, 2.3, 0.08, P.wood, { x: x + s * 0.62, y: 1.15, z: 1.25, ry: 0.15 * s }); k.m.box(1.15, 2.3, 0.08, P.wood, { x: x + s * 0.62, y: 1.15, z: -1.25, ry: -0.15 * s });
  }
  // cổng vòm đá ở x = ±R: hai trụ, đà ngang, miệng hầm tối, song sắt kéo lên
  function stoneGate(k, s, R, h, col) {
    var x = s * R, i;
    k.m.box(0.9, h + 0.5, 0.5, col, { x: x, y: (h + 0.5) / 2, z: 1.6 }); k.m.box(0.9, h + 0.5, 0.5, col, { x: x, y: (h + 0.5) / 2, z: -1.6 });
    k.m.box(0.9, h + 0.5 - 2.3, 2.75, col, { x: x, y: 2.3 + (h + 0.5 - 2.3) / 2, z: 0 });
    k.m.box(0.4, 2.3, 2.7, P.black, { x: x + s * 0.7, y: 1.15, z: 0 });
    for (i = -4; i <= 4; i++) k.x.box(0.05, 0.4, 0.05, P.ironDark, { x: x - s * 0.2, y: 2.12, z: i * 0.3 });
    k.x.box(0.05, 0.05, 2.7, P.ironDark, { x: x - s * 0.2, y: 2.05, z: 0 });
    k.m.box(0.96, 0.2, 3.1, P.stoneLight, { x: x, y: 2.42, z: 0 });                 // đà cửa và mũ trụ sáng màu
    for (i = -1; i <= 1; i += 2) {
      k.m.box(0.98, 0.26, 0.64, P.stoneLight, { x: x, y: h + 0.63, z: i * 1.6 });
      k.m.box(0.9, 2.2, 0.08, P.woodDark, { x: x + s * 0.5, y: 1.1, z: i * 1.31 });   // cánh cửa gỗ mở áp vách hầm
      k.x.box(0.92, 0.06, 0.1, P.ironDark, { x: x + s * 0.5, y: 0.6, z: i * 1.3 }); k.x.box(0.92, 0.06, 0.1, P.ironDark, { x: x + s * 0.5, y: 1.6, z: i * 1.3 });
    }
  }
  function hut(k, x, z, s) {
    k.m.cyl(1.9 * s, 2.0 * s, 2.1 * s, 8, pick([P.plaster, P.clothBrown, P.wood]), { x: x, y: 1.05 * s, z: z });
    k.m.cone(2.6 * s, 2.0 * s, 8, P.straw, { x: x, y: 3.1 * s, z: z });
  }
  function scatter(k, n, r0, r1) {   // thùng, vò, rơm rải quanh vành ngoài (chỉ phía z <= ZC)
    for (var i = 0; i < n; i++) {
      var a = rr(1.25, 5.03), r = rr(r0, r1), x = r * Math.sin(a), z = r * Math.cos(a), t = rnd();
      if (isGate(a, 0.95) && r < 14) continue;
      if (t < 0.35) amphora(k, x, 0, z, rr(0.8, 1.2)); else if (t < 0.65) crate(k, x, 0, z, rr(0.45, 0.8)); else if (t < 0.85) hay(k, x, 0, z, rr(0, 3)); else barrel(k, x, 0, z, 1);
    }
  }

  // ---------------------------------------------------------------- Hạng 0: bãi chợ Capua
  function arenaMarket(env, k, cr) {
    var i, a, a2, R = 9.6, N = 52, p, q, h, r;
    k.m.add(new T.RingGeometry(9.45, 90, 40, 5), P.dirt, { rx: -PI / 2 });
    for (i = 0; i < N; i++) {
      a = (i + 0.5) / N * 2 * PI; a2 = (i + 1.5) / N * 2 * PI;
      var g1 = isGate(a, 0.99), g2 = isGate(a2, 0.99);
      p = [R * Math.sin(a), R * Math.cos(a)]; q = [R * Math.sin(a2), R * Math.cos(a2)];
      h = g1 ? 2.3 : rr(1.1, 1.26);
      k.m.cyl(0.07, 0.085, h, 5, P.woodDark, { x: p[0], y: h / 2, z: p[1], rz: rr(-0.04, 0.04) });
      if (g1 && g2) { k.m.beam([p[0], 2.2, p[1]], [q[0], 2.2, q[1]], 0.07, P.woodDark, 5); continue; }
      var y1 = rr(0.45, 0.6), y2 = rr(0.92, 1.05);
      k.m.beam([p[0], y1, p[1]], [q[0], y1 + rr(-0.05, 0.05), q[1]], 0.04, P.wood, 4);
      k.m.beam([p[0], y2, p[1]], [q[0], y2 + rr(-0.05, 0.05), q[1]], 0.04, P.woodLight, 4);
    }
    for (i = 0; i < 90; i++) {       // dân chợ đứng tựa rào
      a = i / 90 * 2 * PI + rr(-0.02, 0.02); r = 10.2 * rr(1, 1.05);
      if (!vis(10.6, a) || isGate(a, 0.96) || rnd() > 0.74) continue;
      cr.add(r * Math.sin(a), 0, r * Math.cos(a));
    }
    var SA = [1.75, 2.2, 2.65, 3.14, 3.65, 4.1, 4.55];
    for (i = 0; i < SA.length; i++) { a = SA[i]; r = rr(13.2, 15.5); stall(k, r * Math.sin(a), r * Math.cos(a), a + PI, pick(AWN)); }
    cart(k, -12.6, -3.6, 0.4); cart(k, 12.9, -5.2, 2.4);
    for (i = 0; i < 5; i++) { hay(k, 11.6 + (i % 2) * 0.95, Math.floor(i / 2) * 0.5, 2.6 + (i > 3 ? 0.2 : 0), 0.2); hay(k, -11.9, i * 0.5 * (i < 3 ? 1 : 0), 3.4 + (i > 2 ? (i - 2) * 0.6 : 0), 1.4); }
    scatter(k, 26, 11.6, 13);
    well(k, -11, -12.5);
    banner(env, -9.52, 2.12, 0, PI / 2, V.TEAM[0].cloth, 1.3, 0.75); banner(env, 9.52, 2.12, 0, -PI / 2, V.TEAM[1].cloth, 1.3, 0.75);
    for (i = 0; i < N; i++) {        // vải phơi trên rào, giỏ, trẻ con đứng trên thùng
      a = (i + 1) / N * 2 * PI; if (!vis(10.4, a) || isGate(a, 0.96)) continue;
      var tt = rnd(), sn = Math.sin(a), cs = Math.cos(a);
      if (tt < 0.17) k.d.box(0.8, rr(0.38, 0.6), 0.03, pick(AWN), { x: 9.68 * sn, y: 0.74, z: 9.68 * cs, ry: a, rx: 0.07, order: 'YXZ' });
      else if (tt < 0.27) k.m.cyl(0.2, 0.15, 0.26, 7, P.straw, { x: 10.0 * sn, y: 0.13, z: 10.0 * cs });
      else if (tt < 0.38) { crate(k, 10.15 * sn, 0, 10.15 * cs, 0.5, a); cr.add(10.15 * sn, 0.4, 10.15 * cs, 0.62); }
    }
    butcher(k, 11.9 * Math.sin(3.52), 11.9 * Math.cos(3.52), 3.52 + PI);
    dog(k, 10.5 * Math.sin(2.45), 10.5 * Math.cos(2.45), 1.2); dog(k, 11.2 * Math.sin(4.0), 11.2 * Math.cos(4.0), 3.6);
    // chuồng bò
    var px = 16.6, pz = 3.6;
    for (i = 0; i < 4; i++) {
      var c0 = [[-2.6, -2], [2.6, -2], [2.6, 2], [-2.6, 2]][i], c1 = [[2.6, -2], [2.6, 2], [-2.6, 2], [-2.6, -2]][i];
      k.m.cyl(0.07, 0.08, 1.2, 5, P.woodDark, { x: px + c0[0], y: 0.6, z: pz + c0[1] });
      k.m.beam([px + c0[0], 0.5, pz + c0[1]], [px + c1[0], 0.5, pz + c1[1]], 0.04, P.wood, 4); k.m.beam([px + c0[0], 1.0, pz + c0[1]], [px + c1[0], 1.0, pz + c1[1]], 0.04, P.wood, 4);
    }
    ox(k, px - 1, pz - 0.8, 0.5); ox(k, px + 1, pz + 0.6, 2.6); ox(k, px + 0.2, pz - 0.2, 4.2);
    // nhà trát vữa mái ngói, cổng cột
    for (a = 1.56; a < 4.74; a += rr(0.34, 0.46)) {
      r = rr(22, 28);
      house(k, r * Math.sin(a), r * Math.cos(a), rr(5, 8), rr(4, 6), rr(3, 5.5), a + PI, pick([P.plaster, 0xbfa888, 0xd2c2a2, 0xb89a78]), pick([P.terracotta, P.brick, P.rust]));
    }
    for (i = -2; i <= 2; i++) column(k, i * 2.1, -20, 4, 0.3, P.stoneLight);
    k.m.box(9.6, 0.5, 1.0, P.stoneLight, { x: 0, y: 4.25, z: -20 }); gable(k, 0, 4.5, -20.5, 2.6, 10, 1.1, PI / 2, P.terracotta);
    k.m.box(9.4, 4, 0.4, P.plaster, { x: 0, y: 2, z: -21.6 });
  }

  // ---------------------------------------------------------------- Hạng 1: đấu trường gỗ Nuceria
  function arenaVillage(env, k, cr) {
    var i, j, a, N = 236, R = 9.62, h, c, r;
    k.m.add(new T.RingGeometry(9.45, 90, 40, 5), P.dirt, { rx: -PI / 2 });
    for (i = 0; i < N; i++) {
      a = (i + 0.5) / N * 2 * PI; if (isGate(a, 0.992)) continue;
      var low = !vis(R, a); h = low ? rr(1.12, 1.22) : rr(1.9, 2.15); c = pick(WOODS);
      k.m.cyl(0.12, 0.13, h, 5, c, { x: R * Math.sin(a), y: h / 2, z: R * Math.cos(a), ry: rr(0, 1) });
      if (!low) k.m.cone(0.12, 0.24, 5, c, { x: R * Math.sin(a), y: h + 0.12, z: R * Math.cos(a) });
    }
    woodGate(k, 1); woodGate(k, -1);
    for (i = -1; i <= 1; i += 2) { brazier(env, k, i * 9.15, 0, 2.0); brazier(env, k, i * 9.15, 0, -2.0); banner(env, i * 9.4, 2.82, 0, -i * PI / 2, V.TEAM[i < 0 ? 0 : 1].cloth, 1.7, 0.95); }
    for (a = 1.25; a < 5.05; a += 0.37) {      // khiên sơn treo trên hàng cọc
      if (isGate(a, 0.95) || !vis(9.62, a)) continue;
      k.m.cyl(0.32, 0.32, 0.05, 8, pick(AWN), { x: 9.44 * Math.sin(a), y: 1.42, z: 9.44 * Math.cos(a), rx: PI / 2, ry: a, order: 'YXZ' });
      k.x.sph(0.09, 6, 4, P.bronze, { x: 9.4 * Math.sin(a), y: 1.42, z: 9.4 * Math.cos(a), sz: 0.6 });
    }
    section(k, 10.17, [0, 1, 2, 3, 4].map(function (q) { return [10.6 + q * 0.85 + 0.43, 1.35 + q * 0.5]; }).concat([[15.0, 4.4]]), 0x6a5038);
    for (j = 0; j < 5; j++) {
      var Rj = 10.6 + j * 0.85, yj = 1.35 + j * 0.5;
      ring(k.m, Rj, 40, 0.86, P.wood, function (a) { return vis(Rj + 0.45, a) && !isGate(a, 0.972) ? { h: yj, c: pick(WOODS) } : null; }, PI / 40);
      seat(cr, Rj, yj, 0.56, 0.972);
    }
    // lan can sau + cột cờ
    for (i = 0; i < 40; i++) {
      a = (i + 0.5) / 40 * 2 * PI; if (!vis(15, a) || isGate(a, 0.972)) continue;
      k.m.cyl(0.07, 0.08, 4.6, 4, P.woodDark, { x: 14.85 * Math.sin(a), y: 2.3, z: 14.85 * Math.cos(a) });
    }
    ring(k.m, 14.85, 40, 0.08, P.woodDark, function (a) { return vis(15, a) && !isGate(a, 0.972) ? { h: 0.12, y0: 4.3 } : null; }, PI / 40);
    var BA = [1.95, 2.55, 3.14, 3.75, 4.35];
    for (i = 0; i < BA.length; i++) {
      a = BA[i]; k.m.cyl(0.06, 0.08, 7, 4, P.woodDark, { x: 15.3 * Math.sin(a), y: 3.5, z: 15.3 * Math.cos(a) });
      banner(env, 15.2 * Math.sin(a), 6.9, 15.2 * Math.cos(a), a, pick(AWN), 1.0, 2.0);
    }
    for (a = 1.56; a < 4.74; a += rr(0.3, 0.42)) {
      r = rr(19, 27);
      if (rnd() < 0.42) hut(k, r * Math.sin(a), r * Math.cos(a), rr(0.85, 1.2)); else tree(k, r * Math.sin(a), r * Math.cos(a), rr(1.1, 1.7));
      if (rnd() < 0.6) tree(k, (r + 6) * Math.sin(a + 0.1), (r + 6) * Math.cos(a + 0.1), rr(1.2, 1.9));
    }
    scatter(k, 10, 16.5, 19);
  }

  // ---------------------------------------------------------------- Hạng 2: đấu trường đá Pompeii
  function arenaCity(env, k, cr) {
    var j, i, a, r, N = 48, a0 = PI / N, VO = [2.356, 3.1416, 3.927];
    function vom(a) { for (var q = 0; q < 3; q++) if (Math.abs(a - VO[q]) < 0.075) return true; return false; }
    k.m.add(new T.RingGeometry(9.45, 90, 40, 5), P.stoneDark, { rx: -PI / 2 });
    ring(k.m, 9.76, N, 0.62, P.stone, function (a) { return isGate(a) ? null : { h: vis(9.76, a) ? 2.5 : 1.2 }; }, a0);
    ring(k.m, 9.76, N, 0.74, P.stoneLight, function (a) { return isGate(a) ? null : { h: 0.14, y0: vis(9.76, a) ? 2.5 : 1.2 }; }, a0);
    ring(k.m, 9.435, N, 0.03, mute(P.rust, 0.2), function (a) { return isGate(a) ? null : { h: 0.85, y0: 0.02 }; }, a0);
    stoneGate(k, 1, 9.76, 2.5, P.stone); stoneGate(k, -1, 9.76, 2.5, P.stone);
    for (i = -1; i <= 1; i += 2) for (j = -1; j <= 1; j += 2) banner(env, i * 9.4, 2.45, j * 1.6, -i * PI / 2, V.TEAM[i < 0 ? 0 : 1].cloth, 0.6, 1.25);
    for (i = 0; i < N; i += 2) {               // trụ ốp tường bệ
      a = i / N * 2 * PI; if (isGate(a, 0.975) || !vis(9.76, a)) continue;
      k.m.box(0.34, 2.5, 0.1, P.stoneLight, { x: 9.42 * Math.sin(a), y: 1.25, z: 9.42 * Math.cos(a), ry: a });
    }
    var ST2 = [2.55, 2.95, 3.33, 3.73];
    for (i = 0; i < ST2.length; i++) statue(k, 9.82 * Math.sin(ST2[i]), 2.64, 9.82 * Math.cos(ST2[i]), ST2[i] + PI, P.marble);
    var AW = [1.95, 2.75, 3.53, 4.33];
    for (i = 0; i < AW.length; i++) {          // mái vải che nắng trên khán đài
      a = AW[i]; var sn = Math.sin(a), cs = Math.cos(a);
      k.d.box(3.4, 0.05, 2.8, AWN[i], { x: 14.2 * sn, y: 7.0, z: 14.2 * cs, ry: a, rx: -0.22, order: 'YXZ' });
      for (j = -1; j <= 1; j += 2) { var pp = loc(14.2 * sn, 14.2 * cs, a, j * 1.6, -1.3); k.m.cyl(0.05, 0.05, 2.8, 4, P.woodDark, { x: pp[0], y: 5.3, z: pp[1] }); }
    }
    section(k, 10.1, [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (q) { return [10.5 + q * 0.78 + 0.4, 2.62 + q * 0.42]; }).concat([[18.0, 7.4]]), 0x8a7b68);
    for (j = 0; j < 9; j++) {
      var Rj = 10.5 + j * 0.78, yj = 2.62 + j * 0.42;
      ring(k.m, Rj, N, 0.8, P.stone, function (a) { return !vis(Rj + 0.4, a) || (j < 4 && (isGate(a) || vom(a))) ? null : { h: yj, c: j % 3 === 2 ? P.stoneLight : P.stone }; }, a0);
      seat(cr, Rj, yj, 0.74, j < 4 ? 0.985 : 0, 0, j < 4 ? vom : null);
    }
    for (i = 0; i < 3; i++) {        // vomitoria: hốc tối + đà
      a = VO[i]; k.m.box(2.5, 3.9, 2.6, P.black, { x: 11.9 * Math.sin(a), y: 1.95, z: 11.9 * Math.cos(a), ry: a });
      k.m.box(3.0, 0.3, 0.5, P.stoneLight, { x: 10.3 * Math.sin(a), y: 4.1, z: 10.3 * Math.cos(a), ry: a });
    }
    ring(k.m, 17.75, N, 0.5, P.stoneLight, function (a) { return vis(18, a) ? { h: 7.4 } : null; }, a0);
    var SA = [1.9, 2.75, 3.53, 4.4];
    for (i = 0; i < SA.length; i++) statue(k, 17.75 * Math.sin(SA[i]), 7.4, 17.75 * Math.cos(SA[i]), SA[i] + PI);
    var BA = [1.2, 2.0, 2.75, 3.53, 4.28, 5.08];
    for (i = 0; i < BA.length; i++) banner(env, 9.3 * Math.sin(BA[i]), 2.4, 9.3 * Math.cos(BA[i]), BA[i], i % 2 ? P.clothWhite : P.clothOchre, 0.9, 1.4);
    for (a = 1.56; a < 4.74; a += rr(0.3, 0.45)) {
      r = rr(24, 30);
      if (rnd() < 0.5) cypress(k, r * Math.sin(a), r * Math.cos(a), rr(1.3, 1.9));
      else house(k, r * Math.sin(a), r * Math.cos(a), rr(6, 9), rr(5, 7), rr(6, 9), a + PI, pick([P.plaster, 0xbfa888, 0xd2c2a2]), pick([P.terracotta, P.brick]));
    }
  }

  // ---------------------------------------------------------------- Hạng 3: Colosseum
  function arenaColosseum(env, k, cr) {
    var j, i, s, a, N = 56, a0 = PI / N, Rj, yj, PUR = 0x86407c, DK = 0x2a2420;
    function ibox(a) { return Math.abs(a - PI) < 0.3; }
    k.m.add(new T.RingGeometry(9.45, 90, 40, 5), P.stoneDark, { rx: -PI / 2 });
    ring(k.m, 9.8, N, 0.7, P.marble, function (a) { return isGate(a, 0.99) ? null : { h: vis(9.8, a) ? 3.0 : 1.14 }; }, a0);
    ring(k.m, 9.8, N, 0.82, P.stoneLight, function (a) { return isGate(a, 0.99) ? null : { h: 0.16, y0: vis(9.8, a) ? 3.0 : 1.14 }; }, a0);
    ring(k.m, 9.435, N, 0.03, 0x7a3b30, function (a) { return isGate(a, 0.99) ? null : { h: 1.0, y0: 0.02 }; }, a0);
    stoneGate(k, 1, 9.8, 3.0, P.marble); stoneGate(k, -1, 9.8, 3.0, P.marble);
    for (i = -1; i <= 1; i += 2) for (j = -1; j <= 1; j += 2) banner(env, i * 9.43, 2.9, j * 1.6, -i * PI / 2, V.TEAM[i < 0 ? 0 : 1].cloth, 0.65, 1.5);
    ring(k.x, 9.52, N, 0.05, P.bronze, function (a) { return isGate(a, 0.99) || !vis(9.8, a) ? null : { h: 0.07, y0: 3.5 }; }, a0);   // lan can đồng
    for (i = 0; i < N; i++) { a = i / N * 2 * PI; if (isGate(a, 0.985) || !vis(9.8, a)) continue; k.x.box(0.06, 0.36, 0.06, P.bronze, { x: 9.52 * Math.sin(a), y: 3.34, z: 9.52 * Math.cos(a) }); }
    section(k, 10.2, [0, 1, 2, 3, 4, 5, 6, 7].map(function (q) { return [10.7 + q * 0.8 + 0.41, 3.2 + q * 0.5]; }).concat([[17.75, 8.2]], [0, 1, 2, 3, 4, 5, 6, 7].map(function (q) { return [18.2 + q * 0.8 + 0.41, 8.9 + q * 0.62]; }), [[25.5, 23]]), 0x8a7b68);
    for (i = 0; i < 14; i++) {       // khiên mạ vàng trên tường bệ
      a = 1.15 + i * 0.306; if (isGate(a, 0.97) || ibox(a)) continue;
      k.x.cyl(0.32, 0.32, 0.05, 8, P.bronzeLight, { x: 9.41 * Math.sin(a), y: 2.2, z: 9.41 * Math.cos(a), rx: PI / 2, ry: a, order: 'YXZ' });
    }
    for (j = 0; j < 8; j++) {        // tầng ghế dưới
      Rj = 10.7 + j * 0.8; yj = 3.2 + j * 0.5;
      ring(k.m, Rj, N, 0.82, P.stone, function (a) { return !vis(Rj + 0.4, a) || (j < 3 && (isGate(a, 0.99) || ibox(a))) ? null : { h: yj, c: j < 2 ? P.marble : P.stone }; }, a0);
      seat(cr, Rj, yj, 0.78, j < 3 ? 0.985 : 0, j < 2 ? 0xd8cdb4 : 0, j < 3 ? ibox : null);
    }
    ring(k.m, 17.5, N, 0.5, P.stoneLight, function (a) { return vis(17.8, a) ? { h: 8.2 } : null; }, a0);
    for (j = 0; j < 8; j++) {        // tầng ghế trên
      Rj = 18.2 + j * 0.8; yj = 8.9 + j * 0.62;
      ring(k.m, Rj, N, 0.82, P.stoneDark, function (a) { return vis(Rj + 0.4, a) ? { h: yj, c: j % 2 ? P.stone : P.stoneDark } : null; }, a0);
      seat(cr, Rj, yj, 0.78);
    }
    ring(k.m, 25, N, 1.0, P.stone, function (a) { return vis(25.5, a) ? { h: 23 } : null; }, a0);
    for (s = 0; s < 4; s++) ring(k.m, 24.4, N, 0.3, P.stoneLight, function (a) { return vis(25.5, a) ? { h: 0.2, y0: 13.4 + s * 3.1 } : null; }, a0);
    for (i = 0; i < N; i++) {        // ba tầng vòm cuốn ở vành trên
      a = (i + 0.5) / N * 2 * PI; if (!vis(25.5, a)) continue;
      var sn = Math.sin(a), cs = Math.cos(a), ae = i / N * 2 * PI;
      for (s = 0; s < 3; s++) {
        var y0 = 13.6 + s * 3.1;
        k.m.box(1.3, 1.5, 0.06, DK, { x: 24.47 * sn, y: y0 + 0.75, z: 24.47 * cs, ry: a });
        k.m.add(new T.CircleGeometry(0.65, 6, 0, PI), DK, { x: 24.44 * sn, y: y0 + 1.5, z: 24.44 * cs, ry: a + PI });
        k.m.torus(0.65, 0.09, 4, 6, P.stoneLight, { x: 24.42 * sn, y: y0 + 1.5, z: 24.42 * cs, ry: a }, PI);
        k.m.box(0.4, 2.9, 0.16, P.stoneLight, { x: 24.42 * Math.sin(ae), y: y0 + 1.45, z: 24.42 * Math.cos(ae), ry: ae });
      }
      if (i % 2 === 0) {             // cột buồm + dải velarium
        k.m.cyl(0.07, 0.09, 5, 4, P.woodDark, { x: 25.3 * sn, y: 25.5, z: 25.3 * cs });
        k.d.box(2.3, 0.04, 8.5, i % 4 ? P.clothWhite : P.clothOchre, { x: 20.6 * sn, y: 22.7, z: 20.6 * cs, ry: a, rx: -0.16, order: 'YXZ' });
      }
    }
    // khán đài hoàng đế (phía xa, giữa)
    k.m.box(5.4, 0.5, 2.8, P.marble, at(0, 0, PI, 0, 11.2, 3.25));
    k.x.box(5.4, 0.5, 0.12, P.bronzeLight, at(0, 0, PI, 0, 9.9, 3.75));
    for (i = 0; i < 4; i++) k.x.cyl(0.07, 0.07, 3, 6, P.bronzeLight, at(0, 0, PI, i % 2 ? 2.5 : -2.5, i < 2 ? 10.0 : 12.4, 5.0));
    k.d.box(5.6, 0.05, 3.0, PUR, at(0, 0, PI, 0, 11.2, 6.5, { rx: 0.08 }));
    k.d.box(5.2, 3.0, 0.05, PUR, at(0, 0, PI, 0, 12.55, 5.0));
    k.m.box(0.9, 1.3, 0.8, P.marble, at(0, 0, PI, 0, 11.7, 4.15)); k.m.box(0.7, 0.12, 0.6, PUR, at(0, 0, PI, 0, 11.6, 4.2));
    cr.add(0, 3.35, -10.9, 1.08, PUR);
    for (i = 0; i < 4; i++) cr.add([-1.9, -1.1, 1.1, 1.9][i], 3.3, -11.1, 1, i % 2 ? 0xd8cdb4 : 0xc9b98f);
    k.d.box(4.2, 1.9, 0.03, PUR, at(0, 0, PI, 0, 9.40, 2.0));
    k.x.box(4.3, 0.1, 0.04, P.bronzeLight, at(0, 0, PI, 0, 9.385, 1.1)); k.x.box(4.3, 0.1, 0.04, P.bronzeLight, at(0, 0, PI, 0, 9.385, 2.9));
    k.x.box(1.0, 0.14, 0.04, P.bronzeLight, at(0, 0, PI, 0, 9.37, 2.25)); k.x.box(0.22, 0.6, 0.04, P.bronzeLight, at(0, 0, PI, 0, 9.37, 2.05));
    // đại bàng mạ vàng trên mái lọng, diềm vải, hai cột cờ tía
    k.x.ico(0.24, 0, P.bronzeLight, at(0, 0, PI, 0, 9.72, 6.95, { sy: 1.25 })); k.x.ico(0.11, 0, P.bronzeLight, at(0, 0, PI, 0, 9.6, 7.3));
    k.x.box(0.95, 0.07, 0.34, P.bronzeLight, at(0, 0, PI, 0.6, 9.75, 7.08, { rz: 0.4 })); k.x.box(0.95, 0.07, 0.34, P.bronzeLight, at(0, 0, PI, -0.6, 9.75, 7.08, { rz: -0.4 }));
    for (i = 0; i < 7; i++) k.d.box(0.7, 0.45, 0.03, i % 2 ? 0xc9a25e : PUR, at(0, 0, PI, -2.4 + i * 0.8, 9.72, 6.38));
    banner(env, -2.95, 7.6, -9.9, 0, PUR, 0.7, 1.7); banner(env, 2.95, 7.6, -9.9, 0, PUR, 0.7, 1.7);
    k.x.cyl(0.04, 0.05, 4.4, 5, P.bronzeLight, { x: -2.95, y: 5.5, z: -9.9 }); k.x.cyl(0.04, 0.05, 4.4, 5, P.bronzeLight, { x: 2.95, y: 5.5, z: -9.9 });
  }

  // ---------------------------------------------------------------- V.Env.arena
  V.Env = V.Env || {};
  V.Env.arena = function (tier) {
    tier = Math.max(0, Math.min(3, tier | 0)); sd = 100 + tier * 17; V.jseed(4242 + tier);
    var env = base({ sunDir: tier === 3 ? [-0.93, 0.45, -0.06] : [-0.82, 0.45, 0.28], sunInt: 2.4, hemi: [0xc6d2dc, 0x8a6a48, 0.8], shadow: [14, 14], fog: { color: 0xd9bd96, near: 35, far: 120 }, bg: 0xd9bd96, birds: 5 });
    var k = new Kit(), cr = new Crowd();
    sandFloor(k, 9.45, 0, 2 * PI, SANDS[tier]);
    [arenaMarket, arenaVillage, arenaCity, arenaColosseum][tier](env, k, cr);
    k.into(env.group); cr.build(env);
    dust(env, [-11, 0.3, -11, 11, 6, 9], 230, 0.08);
    env.cam = { pos: [0, 13.5, 14.5], look: [0, 0.6, 0.5], fov: 36 }; env.radius = 9; env.tier = tier;
    return env;
  };

  // ---------------------------------------------------------------- CHỢ NÔ LỆ
  V.Env.market = function () {
    sd = 31; V.jseed(999);
    var env = base({ sunDir: [-0.75, 0.42, 0.38], sunInt: 2.3, hemi: [0xc4d0dc, 0x8a6a48, 0.85], shadow: [13, 9], center: [0, 0, 0.5], fog: { color: 0xd8bf9c, near: 30, far: 110 }, bg: 0xd8bf9c, birds: 4 });
    var k = new Kit(), i, x, z, o;
    var fj = k.m.fj; k.m.fj = 0.07;
    k.m.add(new T.PlaneGeometry(48, 32, 48, 32), P.stone, { rx: -PI / 2, z: 1 });   // nền đá cuội
    k.m.fj = fj;
    // bục gỗ (catasta): mặt trên y = 0.6
    for (i = 0; i < 9; i++) k.m.box(0.79, 0.1, 2.2, pick(WOODS), { x: -3.2 + i * 0.8, y: 0.55, z: 0 });
    k.m.box(7.2, 0.14, 0.1, P.woodDark, { x: 0, y: 0.43, z: 1.05 }); k.m.box(7.2, 0.14, 0.1, P.woodDark, { x: 0, y: 0.43, z: -1.05 });
    for (i = 0; i < 5; i++) for (z = -1; z <= 1; z += 2) k.m.box(0.16, 0.5, 0.16, P.woodDark, { x: -3.5 + i * 1.75, y: 0.25, z: z * 0.98 });
    for (i = 0; i < 4; i++) k.m.box(1.7, 0.05, 0.05, P.wood, { x: -2.62 + i * 1.75, y: 0.2, z: 1.02, rz: (i % 2 ? 1 : -1) * 0.2 });
    k.m.box(0.5, 0.2, 1.2, P.wood, { x: -4.35, y: 0.1, z: 0 }); k.m.box(0.5, 0.4, 1.2, P.wood, { x: -3.87, y: 0.2, z: 0 });
    // cọc, dây thừng, xích — phía sau chỗ nô lệ đứng
    for (i = 0; i < 5; i++) {
      x = -3.2 + i * 1.6;
      k.m.box(0.14, 2.3, 0.14, P.woodDark, { x: x, y: 1.75, z: -0.88 });
      k.x.torus(0.07, 0.018, 4, 8, P.iron, { x: x, y: 1.75, z: -0.78 });
      if (i < 4) { k.m.beam([x, 1.6, -0.86], [x + 0.8, 1.35, -0.84], 0.02, P.rope, 4); k.m.beam([x + 0.8, 1.35, -0.84], [x + 1.6, 1.6, -0.86], 0.02, P.rope, 4); }
    }
    k.m.box(6.7, 0.14, 0.14, P.woodDark, { x: 0, y: 2.9, z: -0.88 });
    for (i = 0; i < 4; i++) { x = -2.15 + i * 1.6; k.x.cyl(0.015, 0.015, 0.9, 4, P.ironDark, { x: x, y: 2.4, z: -0.86 }); k.x.torus(0.06, 0.015, 4, 8, P.ironDark, { x: x, y: 1.9, z: -0.86 }); }
    // mái vải cao phía sau
    for (i = 0; i < 8; i++) { k.d.box(1.0, 0.04, 2.9, i % 2 ? P.clothRed : P.linen, { x: -3.5 + i, y: 3.75, z: -1.7, rx: -0.14 }); k.g.box(0.99, 0.01, 2.88, i % 2 ? 0x5c2c20 : 0x8c846e, { x: -3.5 + i, y: 3.722, z: -1.7, rx: -0.14 }); }
    for (x = -1; x <= 1; x += 2) { k.m.cyl(0.07, 0.08, 3.6, 5, P.woodDark, { x: x * 4.05, y: 1.8, z: -3.05 }); k.m.cyl(0.06, 0.07, 3.95, 5, P.woodDark, { x: x * 4.05, y: 1.975, z: -0.3 }); }
    // bàn lái buôn: cân, rương tiền
    var tx = 5.3, tz = 1.7, tr = -0.3;
    k.m.box(1.5, 0.08, 0.8, P.wood, at(tx, tz, tr, 0, 0, 0.8));
    for (i = 0; i < 4; i++) k.m.box(0.08, 0.76, 0.08, P.woodDark, at(tx, tz, tr, i % 2 ? 0.65 : -0.65, i < 2 ? 0.3 : -0.3, 0.38));
    k.x.cyl(0.02, 0.03, 0.5, 5, P.bronze, at(tx, tz, tr, -0.3, 0, 1.09)); k.x.box(0.5, 0.02, 0.02, P.bronze, at(tx, tz, tr, -0.3, 0, 1.33));
    k.x.cyl(0.09, 0.06, 0.03, 6, P.bronze, at(tx, tz, tr, -0.53, 0, 1.16)); k.x.cyl(0.09, 0.06, 0.03, 6, P.bronze, at(tx, tz, tr, -0.07, 0, 1.16));
    k.m.box(0.5, 0.3, 0.34, P.woodDark, at(tx, tz, tr, 0.35, 0, 0.99)); k.x.box(0.52, 0.04, 0.36, P.iron, at(tx, tz, tr, 0.35, 0, 0.93));
    k.x.box(0.44, 0.04, 0.28, P.bronzeLight, at(tx, tz, tr, 0.35, 0, 1.15)); k.m.box(0.5, 0.05, 0.34, P.woodDark, at(tx, tz, tr, 0.35, -0.22, 1.3, { rx: -1.1 }));
    k.m.cyl(0.2, 0.2, 0.45, 6, P.wood, { x: 5.7, y: 0.225, z: 0.75 });
    for (i = 0; i < 5; i++) amphora(k, -5.7 + rr(-0.7, 0.7), 0, 1.9 + rr(-0.6, 0.6), rr(0.9, 1.3));
    crate(k, -6.7, 0, 0.5, 0.8, 0.2); crate(k, -6.6, 0.64, 0.55, 0.55, 0.6); crate(k, 6.7, 0, -0.6, 0.9, 0.1); barrel(k, 7.0, 0, 0.8, 1.1);
    // cũi sắt
    var cx = -6.0, cz = -2.5;
    k.m.box(1.7, 0.1, 1.7, P.woodDark, { x: cx, y: 0.05, z: cz }); k.x.box(1.7, 0.08, 1.7, P.ironDark, { x: cx, y: 1.9, z: cz });
    for (i = 0; i < 7; i++) {
      o = -0.8 + i * 0.2667;
      k.x.cyl(0.02, 0.02, 1.8, 4, P.ironDark, { x: cx + o, y: 1, z: cz + 0.8 }); k.x.cyl(0.02, 0.02, 1.8, 4, P.ironDark, { x: cx + o, y: 1, z: cz - 0.8 });
      k.x.cyl(0.02, 0.02, 1.8, 4, P.ironDark, { x: cx + 0.8, y: 1, z: cz + o }); k.x.cyl(0.02, 0.02, 1.8, 4, P.ironDark, { x: cx - 0.8, y: 1, z: cz + o });
    }
    // hàng cột, hiên ngói, nhà phố phía sau
    for (i = -5; i <= 5; i++) column(k, i * 2.5, -5.6, 4.2, 0.28, P.stoneLight);
    k.m.box(27, 0.5, 0.9, P.stoneLight, { x: 0, y: 4.45, z: -5.6 });
    k.m.box(27, 0.12, 3.2, P.terracotta, { x: 0, y: 5.0, z: -7.0, rx: 0.2 });
    k.m.box(27, 5.4, 0.4, P.plaster, { x: 0, y: 2.7, z: -8.4 });
    k.m.box(27, 1.1, 0.04, mute(P.rust, 0.3), { x: 0, y: 0.55, z: -8.18 });
    for (i = -4; i <= 4; i += 2) k.m.box(1.1, 2.3, 0.1, P.black, { x: i * 2.5 + 1.25, y: 1.15, z: -8.16 });
    k.m.box(12, 4.5, 5, 0xbfa888, { x: -5, y: 7.6, z: -11.2 }); gable(k, -5, 9.85, -11.2, 5.6, 12.6, 1.5, PI / 2, P.terracotta);
    k.m.box(10, 3, 5, P.plaster, { x: 7, y: 6.9, z: -11.2 }); gable(k, 7, 8.4, -11.2, 5.6, 10.6, 1.3, PI / 2, P.brick);
    for (i = 0; i < 5; i++) k.m.box(0.6, 0.8, 0.1, P.black, { x: -9.5 + i * 2.2, y: 7.8, z: -8.68 });
    for (i = 0; i < 4; i++) k.m.box(0.6, 0.7, 0.1, P.black, { x: 3.7 + i * 2.2, y: 7.0, z: -8.68 });
    house(k, -17.5, -1.5, 6, 7, 4, PI / 2, P.plaster, P.terracotta); house(k, 15, -2.5, 6, 8, 6, -PI / 2, 0xd2c2a2, P.brick);
    statue(k, 8.4, 0, -3.5, 0); cypress(k, -10.8, -4, 1.3); cypress(k, 11.4, -4.4, 1.5);
    // dân chợ đứng xem, lái buôn cạnh bàn, sạp hàng hai bên, dây phơi, chim đậu mái hiên, xích chân
    var cr = new Crowd(), PP = [[-8.6, -4.6], [-7.3, -5.0], [-5.7, -5.05], [5.4, -5.0], [6.2, -4.7], [9.3, -4.9], [-9.5, 0.9], [-8.7, 1.9], [9.9, 2.6], [10.8, 1.6], [8.3, -2.2], [-11.5, -2.4], [12.4, -1.2], [-6.7, -6.4], [-13.2, -4.2], [-12.2, 2.4], [7.6, 3.3]];
    for (i = 0; i < PP.length; i++) cr.add(PP[i][0], 0, PP[i][1], rr(0.92, 1.06));
    cr.add(4.5, 0, 1.2, 1.08, 0x7a5a2e);
    k.m.cyl(0.02, 0.02, 1.75, 4, P.woodDark, { x: 4.2, y: 0.87, z: 1.3, rz: 0.08 });
    stall(k, -10.4, -1.2, PI / 2, AWN[1]); stall(k, 11.0, -0.6, -PI / 2, AWN[4]); stall(k, 12.8, 3.4, -PI / 2 - 0.3, AWN[3]);
    k.m.beam([-10.6, 6.62, -8.62], [-0.4, 6.34, -8.62], 0.012, P.rope, 3);
    for (i = 0; i < 7; i++) k.d.box(rr(0.5, 0.9), rr(0.5, 0.8), 0.02, pick([P.linen, P.clothWhite, P.clothOchre, 0x8a4a34, P.clothBlue]), { x: -9.7 + i * 1.32, y: 6.2 - i * 0.04, z: -8.6, rz: rr(-0.05, 0.05) });
    for (i = 0; i < 7; i++) { x = -9 + i * 0.55 + rr(-0.12, 0.12) + (i > 3 ? 9 : 0); k.m.box(0.09, 0.09, 0.17, 0x2e2822, { x: x, y: 4.79, z: -5.5, ry: rr(-0.6, 0.6) }); k.m.box(0.05, 0.05, 0.06, 0x2e2822, { x: x, y: 4.86, z: -5.42 }); }
    for (i = 0; i < 4; i++) { x = -2.4 + i * 1.6; k.x.beam([x + 0.22, 0.61, -0.25], [x + 0.8 - (i % 2 ? 1.6 : 0), 0.66, -0.86], 0.012, P.ironDark, 3); k.x.torus(0.05, 0.014, 4, 6, P.ironDark, { x: x + 0.22, y: 0.615, z: -0.25, rx: PI / 2 }); }
    amphora(k, 6.5, 0, 2.6, 1.1); amphora(k, 6.95, 0, 2.3, 0.9); hay(k, -8.2, 0, 3.4, 0.5); hay(k, -8.3, 0.5, 3.45, 0.7); barrel(k, -7.4, 0, 2.7, 1);
    cr.build(env);
    k.into(env.group);
    dust(env, [-7, 0.5, -3, 7, 4.2, 6], 140);
    env.slots = [{ x: -2.4, y: 0.6, z: 0, ry: 0 }, { x: -0.8, y: 0.6, z: 0, ry: 0 }, { x: 0.8, y: 0.6, z: 0, ry: 0 }, { x: 2.4, y: 0.6, z: 0, ry: 0 }];
    env.cam = { pos: [0, 2.3, 8.4], look: [0, 1.4, 0], fov: 40 };
    return env;
  };

  // ---------------------------------------------------------------- LÒ RÈN / CỬA HÀNG
  V.Env.shop = function () {
    sd = 57; V.jseed(555);
    var env = base({ sunDir: [0.35, 0.3, 0.9], sunCol: 0xffc890, sunInt: 2.0, hemi: [0xb8a890, 0x6a4a30, 0.8], shadow: [9, 7], center: [0, 1.2, 0.5], fog: { color: 0x4a3a2c, near: 22, far: 70 }, bg: 0x2e241b });
    var k = new Kit(), i, x, WS = [-3.0, -2.2, -1.4, -0.6];
    k.m.add(new T.PlaneGeometry(30, 22, 20, 14), P.dirt, { rx: -PI / 2, z: 4 });
    // tường, mái, cột
    k.m.box(13.6, 4.0, 0.3, P.plaster, { x: 0, y: 2, z: -1.35 }); k.m.box(13.0, 0.85, 0.04, P.brick, { x: 0, y: 0.43, z: -1.185 });
    for (x = -1; x <= 1; x += 2) { k.m.box(0.3, 4.0, 3.9, P.plaster, { x: x * 6.65, y: 2, z: 0.6 }); k.m.box(0.22, 3.8, 0.22, P.woodDark, { x: x * 6.38, y: 1.9, z: 2.42 }); }
    k.m.box(13.6, 0.12, 3.9, P.woodDark, { x: 0, y: 3.86, z: 0.6 });
    for (i = 0; i < 3; i++) k.m.box(13.0, 0.18, 0.18, P.wood, { x: 0, y: 3.7, z: -0.7 + i * 1.35 });
    for (i = 0; i < 8; i++) k.d.box(1.72, 0.05, 1.8, i % 2 ? P.clothOchre : P.linen, { x: -6.02 + i * 1.72, y: 4.1, z: 3.3, rx: -0.3 });
    // giá treo vũ khí trên tường (khe vũ khí: y=1.55, z=-0.95)
    k.m.box(3.5, 1.75, 0.04, 0xdacdab, { x: -1.8, y: 1.58, z: -1.18 });      // nền vải lanh sáng cho vũ khí nổi hình
    k.m.box(0.09, 1.92, 0.07, P.woodDark, { x: -3.56, y: 1.58, z: -1.13 }); k.m.box(0.09, 1.92, 0.07, P.woodDark, { x: -0.04, y: 1.58, z: -1.13 });
    k.m.box(3.5, 0.09, 0.07, P.woodDark, { x: -1.8, y: 2.25, z: -1.13 }); k.m.box(3.5, 0.09, 0.07, P.woodDark, { x: -1.8, y: 0.92, z: -1.13 });
    for (i = 0; i < 4; i++) for (x = -1; x <= 1; x += 2) {
      k.m.cyl(0.02, 0.02, 0.2, 4, P.woodDark, { x: WS[i] + x * 0.08, y: 2.25, z: -1.02, rx: PI / 2 });
      k.m.cyl(0.02, 0.02, 0.2, 4, P.woodDark, { x: WS[i] + x * 0.08, y: 0.92, z: -1.02, rx: PI / 2 });
    }
    // bàn dài bày giáp: mặt bàn y = 0.9
    k.m.box(4.4, 0.08, 1.0, P.wood, { x: 2.1, y: 0.86, z: -0.45 });
    for (i = 0; i < 4; i++) k.m.box(0.1, 0.82, 0.1, P.woodDark, { x: i % 2 ? 4.15 : 0.05, y: 0.41, z: i < 2 ? -0.85 : -0.05 });
    k.m.box(4.1, 0.05, 0.7, P.woodDark, { x: 2.1, y: 0.28, z: -0.45 });
    // bệ đá cho vật của lanista: mặt bệ y = 1.0
    k.m.box(0.62, 0.12, 0.62, P.stoneDark, { x: -4.3, y: 0.06, z: -0.2 }); k.m.box(0.46, 0.78, 0.46, P.stone, { x: -4.3, y: 0.51, z: -0.2 }); k.m.box(0.58, 0.1, 0.58, P.stoneLight, { x: -4.3, y: 0.95, z: -0.2 });
    // lò rèn + than hồng + ống khói
    var fx = -5.7, fz = -0.45;
    k.m.box(1.5, 0.85, 1.3, P.stoneDark, { x: fx, y: 0.425, z: fz });
    k.m.box(1.5, 0.14, 0.14, P.stone, { x: fx, y: 0.92, z: fz + 0.58 }); k.m.box(1.5, 0.14, 0.14, P.stone, { x: fx, y: 0.92, z: fz - 0.58 });
    k.m.box(0.14, 0.14, 1.02, P.stone, { x: fx + 0.68, y: 0.92, z: fz }); k.m.box(0.14, 0.14, 1.02, P.stone, { x: fx - 0.68, y: 0.92, z: fz });
    for (i = 0; i < 12; i++) k.g.box(rr(0.12, 0.24), 0.09, rr(0.12, 0.24), pick([0xff7a2a, 0xffa040, 0xd8421c, 0xffd070, 0x8a2a14]), { x: fx + rr(-0.5, 0.5), y: 0.9 + rr(0, 0.04), z: fz + rr(-0.38, 0.38), ry: rr(0, 1.5) });
    k.m.cyl(0.45, 1.0, 1.3, 4, P.stoneDark, { x: fx, y: 2.55, z: fz - 0.1, ry: PI / 4 }); k.m.box(0.6, 0.8, 0.6, P.stoneDark, { x: fx, y: 3.5, z: fz - 0.1 });
    k.m.box(0.56, 0.04, 0.44, P.woodDark, { x: -4.85, y: 0.6, z: -0.92 });
    var blg = new V.Geo(); blg.box(0.5, 0.24, 0.4, P.leather, { y: 0.12 }); blg.box(0.56, 0.04, 0.44, P.woodDark, { y: 0.26 });
    var bl = V.mesh(blg); bl.position.set(-4.85, 0.62, -0.92); env.group.add(bl);          // ống bễ phập phồng
    env.upd.push(function (t) { bl.scale.y = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2)); });
    var fl = new T.PointLight(0xff7a30, 22, 9, 1.6); fl.position.set(fx + 0.3, 1.45, fz + 0.4); env.group.add(fl);
    env.upd.push(function (t) { fl.intensity = 22 * (0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 21)); });
    var fill = new T.PointLight(0xffe2c0, 16, 14, 1.5); fill.position.set(0.8, 2.9, 3.2); env.group.add(fill);
    var rl = new T.PointLight(0xffecd0, 11, 7, 1.6); rl.position.set(-1.8, 2.3, 1.7); env.group.add(rl);      // đèn rọi giá vũ khí
    (function () {                   // tàn lửa bay lên từ lò
      var n = 22, pos = new Float32Array(n * 3), sp = [], q;
      for (q = 0; q < n; q++) { pos[q * 3] = fx + rr(-0.45, 0.45); pos[q * 3 + 1] = rr(0.95, 2.6); pos[q * 3 + 2] = fz + rr(-0.35, 0.35); sp.push(rr(0.35, 0.9), rr(0, 6.28)); }
      var eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(pos, 3));
      var pts = new T.Points(eg, new T.PointsMaterial({ size: 0.06, map: sprite(), color: 0xffb060, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending })); pts.frustumCulled = false; env.group.add(pts);
      env.upd.push(function (t, dt) {
        for (var q = 0; q < n; q++) { pos[q * 3 + 1] += sp[q * 2] * dt; pos[q * 3] += Math.sin(t * 2 + sp[q * 2 + 1]) * 0.15 * dt; if (pos[q * 3 + 1] > 2.7) { pos[q * 3 + 1] = 0.95; pos[q * 3] = fx + (Math.random() - 0.5) * 0.9; } }
        eg.attributes.position.needsUpdate = true;
      });
    })();
    for (i = 0; i < 2; i++) { x = i ? 3.4 : 0.9; k.x.beam([x, 3.62, 1.1], [x, 2.86, 1.1], 0.008, P.ironDark, 3); k.x.cyl(0.13, 0.07, 0.08, 7, P.bronzeDark, { x: x, y: 2.82, z: 1.1 }); flame(env, x, 2.86, 1.1, 0.55); }
    k.m.box(4.3, 0.045, 0.94, 0x8a4a34, { x: 2.1, y: 0.925, z: -0.45 }); k.d.box(4.3, 0.26, 0.02, 0x7d4230, { x: 2.1, y: 0.8, z: 0.03 });   // khăn trải bàn
    k.g.box(0.55, 0.02, 0.05, 0xff8a3a, { x: -4.5, y: 0.815, z: 1.5, ry: 0.35 }); k.x.box(0.2, 0.02, 0.03, P.ironDark, { x: -4.16, y: 0.815, z: 1.37, ry: 0.35 });   // lưỡi kiếm rèn dở
    // đe trên gốc cây, búa, kìm, thùng nước
    k.m.cyl(0.3, 0.33, 0.5, 7, P.woodDark, { x: -4.5, y: 0.25, z: 1.5 });
    k.x.box(0.26, 0.14, 0.16, P.ironDark, { x: -4.5, y: 0.57, z: 1.5 }); k.x.box(0.5, 0.16, 0.2, P.ironDark, { x: -4.5, y: 0.72, z: 1.5 });
    k.x.cone(0.08, 0.3, 5, P.ironDark, { x: -4.9, y: 0.74, z: 1.5, rz: PI / 2 });
    k.m.cyl(0.016, 0.016, 0.4, 4, P.wood, { x: -4.42, y: 0.83, z: 1.5, rz: PI / 2, ry: 0.5, order: 'YXZ' }); k.x.box(0.07, 0.07, 0.15, P.iron, { x: -4.58, y: 0.84, z: 1.59, ry: 0.5 });
    k.x.beam([-4.2, 0, 1.75], [-4.3, 0.75, 1.62], 0.014, P.ironDark, 4); k.x.beam([-4.14, 0, 1.7], [-4.34, 0.75, 1.66], 0.014, P.ironDark, 4);
    barrel(k, -5.8, 0, 1.6, 1.15); k.m.cyl(0.27, 0.27, 0.02, 8, 0x3a4a52, { x: -5.8, y: 0.84, z: 1.6 });
    // đá mài, khiên dựng tường, thùng (bên phải)
    k.m.box(0.08, 0.8, 0.08, P.woodDark, { x: 5.0, y: 0.4, z: 0.9 }); k.m.box(0.08, 0.8, 0.08, P.woodDark, { x: 5.4, y: 0.4, z: 0.9 });
    k.m.cyl(0.35, 0.35, 0.1, 10, P.stone, { x: 5.2, y: 0.75, z: 0.9, rz: PI / 2 }); k.m.box(0.5, 0.2, 0.9, P.wood, { x: 5.2, y: 0.2, z: 0.9 });
    k.m.cyl(0.42, 0.42, 0.05, 10, P.clothRed, { x: 6.3, y: 0.5, z: 0.0, rz: PI / 2 - 0.22 }); k.x.sph(0.09, 6, 4, P.bronze, { x: 6.22, y: 0.52, z: 0.0 });
    k.m.cyl(0.38, 0.38, 0.05, 10, P.wood, { x: 6.25, y: 0.46, z: -0.75, rz: PI / 2 - 0.28 });
    crate(k, 5.7, 0, 1.9, 0.7, 0.2); crate(k, 5.75, 0.56, 1.95, 0.45, 0.7);
    // đồ trang trí treo cao (y > 2.4)
    var SX = [-3.9, 0.1, 3.4], SC = [P.clothRed, P.clothOchre, P.clothBlue];
    for (i = 0; i < 3; i++) { k.m.cyl(0.38, 0.38, 0.05, 10, SC[i], { x: SX[i], y: 3.0, z: -1.16, rx: PI / 2 }); k.x.sph(0.1, 6, 4, P.bronze, { x: SX[i], y: 3.0, z: -1.12, sz: 0.6 }); }
    k.m.box(1.8, 0.05, 0.28, P.wood, { x: 1.7, y: 2.6, z: -1.05 });
    k.x.sph(0.13, 6, 4, P.bronze, { x: 1.3, y: 2.74, z: -1.05, sy: 0.9 }); k.x.sph(0.13, 6, 4, P.iron, { x: 2.1, y: 2.74, z: -1.05, sy: 0.9 });
    k.d.box(0.03, 0.12, 0.26, P.clothRed, { x: 1.3, y: 2.9, z: -1.05 });
    k.m.beam([-2.6, 2.62, -1.15], [-1.0, 3.5, -1.15], 0.02, P.woodLight, 4); k.m.beam([-1.0, 2.62, -1.13], [-2.6, 3.5, -1.13], 0.02, P.woodLight, 4);
    k.into(env.group);
    dust(env, [-5, 0.4, -1, 5, 3.2, 3], 60, 0.05);
    env.slots = {
      weapon: WS.map(function (x) { return { x: x, y: 1.55, z: -0.95 }; }),
      armor: [0.4, 1.3, 2.2, 3.1].map(function (x) { return { x: x, y: 0.95, z: -0.5 }; }),
      trinket: [{ x: 3.9, y: 0.95, z: -0.4 }], relic: { x: -4.3, y: 1.05, z: -0.2 }
    };
    env.cam = { pos: [0, 1.95, 6.2], look: [0, 1.25, -0.5], fov: 40 };
    return env;
  };

  // ---------------------------------------------------------------- PHÒNG CHỜ (toạ độ trận đấu)
  V.Env.ready = function (tier) {
    tier = Math.max(0, Math.min(3, tier | 0)); sd = 77 + tier * 13; V.jseed(808 + tier);
    var env = base({ sunDir: [0.8, 0.5, 0.3], sunInt: 2.4, hemi: [0xc8cdd2, 0x8a6e52, 0.95], shadow: [13, 12], fog: { color: 0xd6bc98, near: 34, far: 110 }, bg: 0xd6bc98 });
    var k = new Kit(), cr = new Crowd(), i, j, x, z, a, h, X0 = -9.2, ZR = 5.2;
    function visR(R, a) { return R * Math.cos(a) <= ZR; }
    k.m.add(new T.PlaneGeometry(160, 160, 8, 8), P.dirt, { rx: -PI / 2, y: -0.06 });
    // sàn lát đá + vạch phấn 15 ô đội hình
    var jt = k.m.jit, fj = k.m.fj; k.m.jit = 0.1; k.m.fj = 0.012;
    k.m.box(8.7, 0.03, 10, P.black, { x: -4.85, y: -0.04, z: 0 });
    for (i = 0; i < 12; i++) for (j = 0; j < 14; j++) k.m.box(0.705, 0.05, 0.694, P.stone, { x: X0 + 0.3625 + i * 0.725, y: -0.025, z: -5 + 0.357 + j * 0.7143 });
    k.m.jit = jt; k.m.fj = fj;
    var CH = 0xd6cfbc;
    for (i = 0; i <= 3; i++) for (j = 0; j < 5; j++) k.m.box(0.05, 0.006, 1.5 * rr(0.8, 0.95), CH, { x: -0.95 - i * 1.5 + rr(-0.015, 0.015), y: 0.013, z: (j - 2) * 1.5 + rr(-0.03, 0.03) });
    for (j = 0; j <= 5; j++) for (i = 0; i < 3; i++) k.m.box(1.5 * rr(0.8, 0.95), 0.006, 0.05, CH, { x: -1.7 - i * 1.5 + rr(-0.03, 0.03), y: 0.014, z: -3.75 + j * 1.5 + rr(-0.015, 0.015) });
    // tường khối đá
    function wall(xa, za, xb, zb, hh, thick, col) {
      var len = Math.hypot(xb - xa, zb - za), ry = Math.atan2(-(zb - za), xb - xa), rows = Math.round(hh / 0.8), n = Math.max(1, Math.round(len / 1.4));
      for (var r = 0; r < rows; r++) for (var q = 0; q < n; q++) {
        var t = (q + 0.5) / n;
        k.m.box(len / n + 0.004, hh / rows + 0.004, thick + (q + r) % 2 * 0.02, col, { x: xa + (xb - xa) * t, y: (r + 0.5) * hh / rows, z: za + (zb - za) * t, ry: ry });
      }
    }
    wall(-9.6, -5.2, -0.2, -5.2, 3.2, 0.4, P.stone);            // tường sau (mặt trong z = -5)
    wall(-9.4, -5.0, -9.4, 5.3, 3.2, 0.4, P.stone);             // tường trái (mặt trong x = -9.2)
    wall(-0.5, -5.4, -0.5, -9.7, 3.2, 0.6, P.stone);            // tường đấu trường phía xa
    k.m.box(0.7, 3.2, 1.0, P.stoneLight, { x: -0.5, y: 1.6, z: 4.5 }); k.m.box(0.7, 3.2, 1.0, P.stoneLight, { x: -0.5, y: 1.6, z: -4.5 });
    k.m.box(0.72, 0.5, 8.0, P.stone, { x: -0.5, y: 2.95, z: 0 });
    k.m.box(0.6, 0.25, 4.6, P.stone, { x: -0.5, y: 0.125, z: 7.3 });
    k.m.box(8.7, 0.25, 0.3, P.stoneDark, { x: -4.85, y: 0.125, z: 5.15 });
    k.m.box(40, 3.2, 26, P.stoneDark, { x: -20.2, y: 1.6, z: -18.4 }); k.m.box(31, 3.2, 10.7, P.stoneDark, { x: -25.1, y: 1.6, z: -0.05 });
    k.m.box(0.5, 0.05, 8.0, P.stoneLight, { x: -0.25, y: -0.025, z: 0 });
    k.m.box(0.5, 0.05, 5.6, P.sand, { x: -0.25, y: -0.025, z: 6.8 }); k.m.box(0.5, 0.05, 5.6, P.sand, { x: -0.25, y: -0.025, z: -6.8 });
    // song sắt kéo lên trong đà cổng
    for (z = -3.75; z <= 3.76; z += 0.5) { k.x.box(0.05, 0.45, 0.05, P.ironDark, { x: -0.5, y: 2.5, z: z }); k.x.cone(0.035, 0.12, 4, P.ironDark, { x: -0.5, y: 2.22, z: z, rz: PI }); }
    k.x.box(0.05, 0.05, 7.8, P.ironDark, { x: -0.5, y: 2.45, z: 0 });
    // mái vô hình: chỉ đổ bóng, để phòng tối và nắng chỉ lọt qua cổng
    var roof = new T.Mesh(new T.BoxGeometry(9.5, 0.1, 13.6), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    roof.position.set(-4.95, 3.22, 1.5); roof.castShadow = true; roof.receiveShadow = false; env.group.add(roof);
    // đuốc, giá vũ khí, ghế băng, kệ
    var TX = [-7.6, -4.65, -1.8];
    for (i = 0; i < 3; i++) { k.m.box(0.1, 0.1, 0.16, P.woodDark, { x: TX[i], y: 1.75, z: -4.92 }); torch(env, k, TX[i], 1.9, -4.8, 16); }
    for (i = 0; i < 2; i++) {
      x = i ? -3.2 : -6.1;
      k.m.box(1.3, 0.08, 0.1, P.woodDark, { x: x, y: 1.5, z: -4.92 }); k.m.box(1.3, 0.08, 0.1, P.woodDark, { x: x, y: 0.5, z: -4.92 });
      for (j = 0; j < 4; j++) { k.m.cyl(0.018, 0.018, 2.0, 4, P.woodLight, { x: x - 0.45 + j * 0.3, y: 1.02, z: -4.85 }); k.x.cone(0.03, 0.16, 4, P.iron, { x: x - 0.45 + j * 0.3, y: 2.1, z: -4.85 }); }
    }
    k.m.box(0.4, 0.08, 3.0, P.wood, { x: -8.95, y: 0.45, z: 0.4 });
    for (i = 0; i < 3; i++) k.m.box(0.34, 0.42, 0.08, P.woodDark, { x: -8.95, y: 0.21, z: -0.9 + i * 1.3 });
    k.m.box(0.06, 2.1, 1.1, P.black, { x: -9.18, y: 1.05, z: 3.3 });
    k.m.box(0.3, 0.05, 1.6, P.wood, { x: -9.03, y: 1.5, z: -2.6 });
    amphora(k, -9.03, 1.53, -3.1, 0.6); amphora(k, -9.03, 1.53, -2.6, 0.55); k.x.sph(0.13, 6, 4, P.bronze, { x: -9.03, y: 1.63, z: -2.05, sy: 0.9 });
    k.m.cyl(0.9, 1.0, 0.1, 7, P.straw, { x: -8.3, y: 0.05, z: 4.0 }); barrel(k, -8.8, 0, -3.0, 1); amphora(k, -1.3, 0, -4.6, 1.1);
    // sân cát bên kia cổng + tường đấu trường và khán giả phía xa
    sandFloor(k, 9.45, 0, PI, SANDS[tier]);
    for (i = 0; i <= 3; i++) for (j = 0; j < 5; j++) k.m.box(0.04, 0.003, 1.5 * rr(0.75, 0.92), mute(SANDS[tier], 0.45), { x: 0.95 + i * 1.5, y: 0.0065, z: (j - 2) * 1.5 + rr(-0.03, 0.03) });   // vạch mờ phía địch
    for (j = 0; j <= 5; j++) for (i = 0; i < 3; i++) k.m.box(1.5 * rr(0.75, 0.92), 0.003, 0.04, mute(SANDS[tier], 0.45), { x: 1.7 + i * 1.5 + rr(-0.03, 0.03), y: 0.0065, z: -3.75 + j * 1.5 });
    k.m.add(new T.RingGeometry(9.45, 70, 20, 3, -PI / 2, PI), tier < 2 ? P.dirt : P.stoneDark, { rx: -PI / 2 });
    var WH = [1.2, 2.0, 2.5, 3.0][tier], WC = [P.wood, P.wood, P.stone, P.marble][tier], rows = [0, 3, 4, 5][tier], N = 44, a0 = PI / N, R = 9.7;
    if (tier < 2) {
      for (i = 0; i < (tier ? 118 : 26); i++) {
        a = (i + 0.5) / (tier ? 118 : 26) * PI; if (isGate(a, 0.992)) continue;
        h = tier ? (visR(R, a) ? rr(1.9, 2.15) : 1.15) : rr(1.1, 1.25);
        k.m.cyl(tier ? 0.12 : 0.07, tier ? 0.13 : 0.085, h, 5, pick(WOODS), { x: R * Math.sin(a), y: h / 2, z: R * Math.cos(a) });
      }
      if (!tier) { ring(k.m, R, N, 0.07, P.wood, function (a) { return Math.sin(a) > 0.03 && !isGate(a, 0.992) ? { h: 0.09, y0: 0.5 } : null; }, a0); ring(k.m, R, N, 0.07, P.woodLight, function (a) { return Math.sin(a) > 0.03 && !isGate(a, 0.992) ? { h: 0.09, y0: 0.98 } : null; }, a0); }
      else woodGate(k, 1);
    } else {
      ring(k.m, R + 0.06, N, 0.62, WC, function (a) { return Math.sin(a) > 0.03 && !isGate(a) ? { h: visR(R, a) ? WH : 1.2 } : null; }, a0);
      ring(k.m, R + 0.06, N, 0.74, P.stoneLight, function (a) { return Math.sin(a) > 0.03 && !isGate(a) ? { h: 0.14, y0: visR(R, a) ? WH : 1.2 } : null; }, a0);
      ring(k.m, 9.435, N, 0.03, tier === 2 ? P.rust : 0x7a3b30, function (a) { return Math.sin(a) > 0.03 && !isGate(a) ? { h: 0.9, y0: 0.02 } : null; }, a0);
      stoneGate(k, 1, R + 0.06, WH, WC);
    }
    for (j = 0; j < rows; j++) {
      var Rj = 10.55 + j * 0.8, yj = WH + 0.12 + j * 0.45, n = Math.floor(PI * Rj / 0.6);
      ring(k.m, Rj, N, 0.82, tier === 1 ? P.wood : P.stone, function (a) { return Math.sin(a) > 0.05 && visR(Rj + 0.4, a) && !(j < 2 && isGate(a, 0.985)) ? { h: yj, c: tier === 1 ? pick(WOODS) : 0 } : null; }, a0);
      for (i = 0; i < n; i++) {
        a = (i + rr(0.2, 0.8)) / n * PI;
        if (Math.sin(a) < 0.08 || !visR(Rj + 0.3, a) || (j < 2 && isGate(a, 0.985)) || rnd() > 0.62) continue;
        cr.add(Rj * Math.sin(a), yj - 0.5, Rj * Math.cos(a));
      }
    }
    if (rows) ring(k.m, 10.55 + rows * 0.8 + 0.1, N, 0.4, tier === 1 ? P.woodDark : P.stoneLight, function (a) { return Math.sin(a) > 0.05 && visR(10.6 + rows * 0.8, a) ? { h: WH + rows * 0.45 + 1.3 } : null; }, a0);
    else for (i = 0; i < 40; i++) {
      a = (i + rr(0.2, 0.8)) / 40 * PI; if (Math.sin(a) < 0.1 || !visR(10.4, a) || isGate(a, 0.97) || rnd() > 0.6) continue;
      cr.add(10.25 * Math.sin(a), 0, 10.25 * Math.cos(a));
    }
    // rơm, xích, bàn thờ nhỏ, vạch đếm trên tường, áo choàng treo, luồng nắng qua cổng
    for (i = 0; i < 34; i++) k.m.box(rr(0.25, 0.6), 0.008, rr(0.015, 0.035), pick([0x8f7d4c, 0x9c8a55, 0x7d6c44]), { x: rr(-9.0, -6.0), y: 0.008 + i * 0.0003, z: rr(-4.7, 4.7), ry: rr(0, 3.14) });
    for (i = 0; i < 3; i++) { k.x.beam([-9.17, 2.3, 4.2 + i * 0.25], [-9.17, 1.2 + i * 0.15, 4.24 + i * 0.25], 0.018, P.ironDark, 4); k.x.torus(0.07, 0.018, 4, 6, P.ironDark, { x: -9.15, y: 1.12 + i * 0.15, z: 4.24 + i * 0.25, ry: PI / 2 }); }
    k.m.box(0.04, 0.9, 0.8, 0x8a4a34, { x: -9.17, y: 1.75, z: 1.9 }); k.m.box(0.28, 0.06, 0.6, P.wood, { x: -9.04, y: 1.3, z: 1.9 });
    k.m.box(0.1, 0.34, 0.14, P.marble, { x: -9.06, y: 1.5, z: 1.9 }); k.m.ico(0.06, 0, P.marble, { x: -9.06, y: 1.72, z: 1.9 });
    k.x.cyl(0.05, 0.03, 0.04, 6, P.bronze, { x: -9.0, y: 1.35, z: 2.1 }); flame(env, -9.0, 1.37, 2.1, 0.35);
    for (i = 0; i < 3; i++) { for (j = 0; j < 4; j++) k.m.box(0.018, 0.17, 0.008, CH, { x: -8.95 + i * 0.36 + j * 0.055, y: 1.32 + rr(-0.01, 0.01), z: -4.992, rz: rr(-0.06, 0.06) }); k.m.box(0.018, 0.3, 0.008, CH, { x: -8.87 + i * 0.36, y: 1.32, z: -4.99, rz: 1.1 }); }
    k.d.box(0.42, 0.85, 0.05, 0x7d6248, { x: -6.95, y: 1.45, z: -4.94 }); k.d.box(0.42, 0.8, 0.05, 0x6f7a5a, { x: -2.5, y: 1.45, z: -4.94 });
    amphora(k, -8.9, 0, 4.55, 1.0); amphora(k, -8.45, 0, 4.7, 0.8);
    var shm = new T.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.055, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false });
    var shp = []; for (z = -3.4; z <= 3.41; z += 0.85) shp.push(-0.5, 0.02, z, -0.5, 2.68, z, -4.8, 0.02, z - 1.62);
    var shg = new T.BufferGeometry(); shg.setAttribute('position', new T.Float32BufferAttribute(shp, 3));
    var shaft = new T.Mesh(shg, shm); shaft.renderOrder = 3; shaft.frustumCulled = false; env.group.add(shaft);
    env.upd.push(function (t) { shm.opacity = 0.05 + 0.012 * Math.sin(t * 0.7); });
    var fl2 = new T.PointLight(0xffc890, 9, 13, 1.4); fl2.position.set(-6.6, 2.6, 2.6); env.group.add(fl2);      // đỡ tối góc gần máy quay
    k.into(env.group); cr.build(env);
    dust(env, [-5.2, 0.2, -4, -0.4, 2.7, 4], 150, 0.07);
    env.bench = []; for (i = 0; i < 8; i++) env.bench.push({ x: -8.3 + i * 0.9, z: -4.1, ry: 0 });
    env.cam = { pos: [-0.8, 9.6, 11.8], look: [-0.4, 0.7, 0], fov: 38 }; env.tier = tier;
    return env;
  };

})(window.G = window.G || {});

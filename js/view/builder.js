// LANISTA — công cụ dựng hình low-poly: gom các khối cơ bản thành một BufferGeometry phẳng mặt, tô màu theo đỉnh.
(function (G) {
  'use strict';
  var T = THREE;
  var V = G.V = G.V || {};

  V.PAL = {
    sand: 0xc9a877, sandDark: 0xa98a5e, sandLight: 0xdcc090, dirt: 0x8a6e4c,
    stone: 0x9a8f7e, stoneDark: 0x6f675b, stoneLight: 0xb8ad9a, marble: 0xd6cdbb, plaster: 0xc9b89a,
    wood: 0x7a5a3a, woodDark: 0x54402c, woodLight: 0x9a7a52,
    rust: 0x9c4a2a, terracotta: 0xb0603a, brick: 0x8e5a3c,
    bronze: 0xa8824a, bronzeDark: 0x7a5e34, bronzeLight: 0xc9a25e, iron: 0x7d7f82, ironDark: 0x4e5053, steel: 0xa9adb0,
    leather: 0x6b4a2f, leatherDark: 0x4a3322, linen: 0xcfc4a6, rope: 0xa8946a,
    clothRed: 0x9a3b28, clothBlue: 0x3d5a72, clothOchre: 0xb58a3c, clothGreen: 0x5f6b45, clothWhite: 0xd8cdb4, clothBrown: 0x7d6248,
    blood: 0x6e120c, black: 0x1c1814, white: 0xe8dfcc, ember: 0xff7a2a, straw: 0xc2a85a, leaf: 0x566b3a
  };
  // Màu nhận diện hai phe: ta = đỏ gỉ, địch = xanh chàm bạc màu
  V.TEAM = [
    { cloth: 0xa5371f, trim: 0xd8b060, ring: 0xd9562c, css: '#d9562c' },
    { cloth: 0x2f5878, trim: 0xb7c4cc, ring: 0x4d8fbd, css: '#4d8fbd' }
  ];

  var _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color(), _v = new T.Vector3();
  function toMatrix(tf) {
    if (!tf) return _m.identity();
    if (tf.isMatrix4) return _m.copy(tf);
    _e.set(tf.rx || 0, tf.ry || 0, tf.rz || 0, tf.order || 'XYZ'); _q.setFromEuler(_e);
    _p.set(tf.x || 0, tf.y || 0, tf.z || 0);
    var s = tf.s != null ? tf.s : 1; _s.set((tf.sx != null ? tf.sx : 1) * s, (tf.sy != null ? tf.sy : 1) * s, (tf.sz != null ? tf.sz : 1) * s);
    return _m.compose(_p, _q, _s);
  }
  V.toMatrix = function (tf) { return toMatrix(tf).clone(); };

  // rng nhỏ, tất định, để màu không nhấp nháy giữa các lần dựng
  var jseed = 1234567;
  function jr() { jseed = (jseed * 1664525 + 1013904223) >>> 0; return jseed / 4294967296; }
  V.jseed = function (s) { jseed = s >>> 0; };

  function Geo(jit, faceJit) { this.p = []; this.c = []; this.jit = jit != null ? jit : 0.06; this.fj = faceJit != null ? faceJit : 0.035; }
  V.Geo = Geo;
  // Thêm một BufferGeometry bất kỳ với màu và phép biến đổi.
  Geo.prototype.add = function (geom, color, tf) {
    var g = geom.index ? geom.toNonIndexed() : geom;
    var m = toMatrix(tf), pos = g.attributes.position, n = pos.count;
    _c.set(V.remap && V.remap[color] != null ? V.remap[color] : color);
    var k = 1 + (jr() - 0.5) * 2 * this.jit, r = _c.r * k, gg = _c.g * k, b = _c.b * k, f = 1;
    for (var i = 0; i < n; i++) {
      if (i % 3 === 0) f = 1 + (jr() - 0.5) * 2 * this.fj;
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      this.p.push(_v.x, _v.y, _v.z); this.c.push(r * f, gg * f, b * f);
    }
    if (g !== geom) g.dispose();
    geom.dispose();
    return this;
  };
  Geo.prototype.box = function (w, h, d, color, tf) { return this.add(new T.BoxGeometry(w, h, d), color, tf); };
  // trụ dọc trục Y, tâm ở gốc
  Geo.prototype.cyl = function (rTop, rBot, h, seg, color, tf, open) { return this.add(new T.CylinderGeometry(rTop, rBot, h, seg || 6, 1, !!open), color, tf); };
  Geo.prototype.cone = function (r, h, seg, color, tf) { return this.add(new T.ConeGeometry(r, h, seg || 5), color, tf); };
  Geo.prototype.ico = function (r, detail, color, tf) { return this.add(new T.IcosahedronGeometry(r, detail || 0), color, tf); };
  Geo.prototype.sph = function (r, ws, hs, color, tf) { return this.add(new T.SphereGeometry(r, ws || 6, hs || 4), color, tf); };
  Geo.prototype.torus = function (r, tube, rs, ts, color, tf, arc) { return this.add(new T.TorusGeometry(r, tube, rs || 4, ts || 8, arc || Math.PI * 2), color, tf); };
  // đoạn thẳng dày giữa hai điểm (cho dây, cột xiên, thanh giằng)
  Geo.prototype.beam = function (a, b, r, color, seg) {
    var ax = new T.Vector3(a[0], a[1], a[2]), bx = new T.Vector3(b[0], b[1], b[2]);
    var d = bx.clone().sub(ax), len = d.length(); if (len < 1e-5) return this;
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    var m = new T.Matrix4().compose(ax.add(bx).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1));
    return this.add(new T.CylinderGeometry(r, r, len, seg || 4, 1), color, m);
  };
  Geo.prototype.tri = function (a, b, c, color) {
    _c.set(V.remap && V.remap[color] != null ? V.remap[color] : color); var k = 1 + (jr() - 0.5) * 2 * this.jit;
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (var i = 0; i < 3; i++) this.c.push(_c.r * k, _c.g * k, _c.b * k);
    return this;
  };
  Geo.prototype.quad = function (a, b, c, d, color) { this.tri(a, b, c, color); return this.tri(a, c, d, color); };
  // Vỏ nối các vòng elip nằm ngang (từ dưới lên): rings = [[y, rx, rz, ox, oz], ...], n cạnh.
  // caps: 1 = nắp dưới, 2 = nắp trên, 3 = cả hai. colorFn(i) cho màu từng đai.
  Geo.prototype.loft = function (rings, n, color, tf, caps, colorFn) {
    var m = toMatrix(tf).clone(), pts = [], i, j, self = this;
    for (i = 0; i < rings.length; i++) {
      var r = rings[i], row = [];
      for (j = 0; j < n; j++) { var a = (j + 0.5) / n * Math.PI * 2; row.push(new T.Vector3((r[3] || 0) + Math.sin(a) * r[1], r[0], (r[4] || 0) + Math.cos(a) * r[2]).applyMatrix4(m)); }
      pts.push(row);
    }
    function tri(a, b, c, col, k) { _c.set(V.remap && V.remap[col] != null ? V.remap[col] : col); var f = k * (1 + (jr() - 0.5) * 2 * self.fj); self.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); for (var q = 0; q < 3; q++) self.c.push(_c.r * f, _c.g * f, _c.b * f); }
    var k0 = 1 + (jr() - 0.5) * 2 * this.jit;
    for (i = 0; i < rings.length - 1; i++) {
      var col = colorFn ? colorFn(i) : color;
      for (j = 0; j < n; j++) { var a0 = pts[i][j], a1 = pts[i][(j + 1) % n], b0 = pts[i + 1][j], b1 = pts[i + 1][(j + 1) % n]; tri(a0, a1, b1, col, k0); tri(a0, b1, b0, col, k0); }
    }
    function cap(row, r, up, col) {
      var c = new T.Vector3(r[3] || 0, r[0], r[4] || 0).applyMatrix4(m);
      for (var q = 0; q < n; q++) { if (up) tri(row[q], row[(q + 1) % n], c, col, k0); else tri(row[(q + 1) % n], row[q], c, col, k0); }
    }
    if (caps & 1) cap(pts[0], rings[0], false, colorFn ? colorFn(0) : color);
    if (caps & 2) cap(pts[rings.length - 1], rings[rings.length - 1], true, colorFn ? colorFn(rings.length - 2) : color);
    return this;
  };
  Geo.prototype.build = function () {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  Geo.prototype.empty = function () { return this.p.length === 0; };

  // Vật liệu dùng chung
  V.M = {
    matte: new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    metal: new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 55, specular: 0x4a4034 }),
    glow: new T.MeshBasicMaterial({ vertexColors: true }),
    matteDouble: new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: T.DoubleSide })
  };
  // Tạo Mesh từ Geo. mat: 'matte' | 'metal' | 'glow' | 'matteDouble' hoặc một Material.
  V.mesh = function (geo, mat, cast, receive) {
    var m = new T.Mesh(geo.isBufferGeometry ? geo : geo.build(), typeof mat === 'string' ? V.M[mat] : (mat || V.M.matte));
    m.castShadow = cast !== false; m.receiveShadow = receive !== false;
    return m;
  };
  V.lerp = function (a, b, t) { return a + (b - a) * t; };
  V.clamp = function (x, a, b) { return x < a ? a : (x > b ? b : x); };
  V.smooth = function (t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); };

})(window.G = window.G || {});

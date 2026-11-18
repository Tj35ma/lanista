// LANISTA — icon của thẻ lên cấp: mỗi thẻ là một vật nhỏ low-poly dựng bằng mã, chụp ra ảnh như icon trang bị.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, P = V.PAL, PI = Math.PI, cache = {};
  var SK = 0xc79a72, SKD = 0xa67a56, RED = 0xa3231a, BLOOD = 0x8f150d, GOLD = 0xd9b04a, GOLDD = 0xb08a30, BONE = 0xe6dcc4;
  var E = {};

  function kit() { return { m: new V.Geo(0.05, 0.05), t: new V.Geo(0.04, 0.05), g: new V.Geo(0.03, 0.07), d: new V.Geo(0.05, 0.05) }; }
  // ma trận con trong khung cha
  function at(parent, local) { var a = V.toMatrix(parent), b = V.toMatrix(local); return a.multiply(b); }
  // khung có gốc ở `from`, trục +y chĩa về `to`, tỉ lệ s
  function aim(from, to, s) {
    var a = new T.Vector3(from[0], from[1], from[2]), d = new T.Vector3(to[0], to[1], to[2]).sub(a).normalize();
    return new T.Matrix4().compose(a, new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d), new T.Vector3(s || 1, s || 1, s || 1));
  }
  // lăng trụ từ một đa giác lồi 2D (mặt hướng +z), dày từ z0 đến z1 — dựng trên Geo hai mặt nên không cần lo chiều quấn
  function prism(geo, pts, z0, z1, col, colSide) {
    var n = pts.length, i;
    for (i = 1; i < n - 1; i++) {
      geo.tri([pts[0][0], pts[0][1], z1], [pts[i][0], pts[i][1], z1], [pts[i + 1][0], pts[i + 1][1], z1], col);
      geo.tri([pts[0][0], pts[0][1], z0], [pts[i + 1][0], pts[i + 1][1], z0], [pts[i][0], pts[i][1], z0], col);
    }
    for (i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; geo.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], colSide || col); }
  }
  // kiếm gladius: chuôi ở gốc, lưỡi dọc +y, dài ~0.92
  function sword(k, Pm, o) {
    o = o || {};
    var len = o.len != null ? o.len : 0.62, bl = o.wood ? k.m : k.t, cb = o.wood ? P.woodLight : P.steel;
    bl.box(0.09, len, 0.026, cb, at(Pm, { y: 0.16 + len / 2 }));
    if (!o.noTip) bl.cone(0.045, 0.14, 4, cb, at(Pm, { y: 0.16 + len + 0.07, sz: 0.3 }));
    if (!o.wood) k.t.box(0.02, len * 0.94, 0.034, P.ironDark, at(Pm, { y: 0.16 + len / 2 }));
    (o.wood ? k.m : k.t).box(0.22, 0.045, 0.07, o.wood ? P.wood : P.bronzeLight, at(Pm, { y: 0.14 }));
    k.m.cyl(0.03, 0.03, 0.14, 6, o.wood ? P.woodDark : P.leatherDark, at(Pm, { y: 0.06 }));
    (o.wood ? k.m : k.t).ico(0.05, 0, o.wood ? P.wood : P.bronzeLight, at(Pm, { y: -0.03 }));
    if (o.blood) { k.m.box(0.096, len * 0.5, 0.032, BLOOD, at(Pm, { y: 0.16 + len * 0.75 })); k.m.cone(0.048, 0.145, 4, BLOOD, at(Pm, { y: 0.16 + len + 0.07, sz: 0.34 })); }
  }
  function roundShield(k, Pm, r, col) {
    k.m.cyl(r, r, 0.05, 12, col, at(Pm, { rx: PI / 2 }));
    k.t.torus(r, 0.032, 4, 14, P.bronzeLight, Pm);
    k.t.ico(0.1, 1, P.bronzeLight, at(Pm, { z: 0.04, sz: 0.55 }));
    for (var i = 0; i < 4; i++) k.t.ico(0.022, 0, P.bronze, at(Pm, { x: Math.cos(i * PI / 2 + PI / 4) * r * 0.62, y: Math.sin(i * PI / 2 + PI / 4) * r * 0.62, z: 0.03 }));
  }
  function scutum(k, Pm, w, h, col) {
    k.m.box(w, h, 0.05, col, Pm);
    k.t.box(w + 0.03, 0.045, 0.062, P.bronzeLight, at(Pm, { y: h / 2 })); k.t.box(w + 0.03, 0.045, 0.062, P.bronzeLight, at(Pm, { y: -h / 2 }));
    k.t.box(0.04, h, 0.062, P.bronzeLight, at(Pm, { x: w / 2 })); k.t.box(0.04, h, 0.062, P.bronzeLight, at(Pm, { x: -w / 2 }));
    k.t.box(0.03, h * 0.9, 0.06, GOLDD, at(Pm, { z: 0.005 }));
    k.t.ico(0.1, 1, P.bronzeLight, at(Pm, { z: 0.045, sz: 0.6 })); k.t.box(0.26, 0.16, 0.06, P.bronze, at(Pm, { z: 0.004 }));
  }
  function drop(k, x, y, s, z) { k.m.ico(0.1 * s, 1, BLOOD, { x: x, y: y, z: z || 0 }); k.m.cone(0.085 * s, 0.2 * s, 6, BLOOD, { x: x, y: y + 0.14 * s, z: z || 0 }); }
  function feather(k, a, b, w, c1, c2) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy), nx = -dy / L * w, ny = dx / L * w, z = a[2];
    var q = [a[0] + dx * 0.12, a[1] + dy * 0.12, z], m1 = [a[0] + dx * 0.5 + nx, a[1] + dy * 0.5 + ny, z], m2 = [a[0] + dx * 0.5 - nx * 0.8, a[1] + dy * 0.5 - ny * 0.8, z];
    k.d.tri(q, m1, b, c1); k.d.tri(q, b, m2, c2);
    k.m.beam(a, [b[0], b[1], z + 0.004], 0.012, 0xb8ad94, 4);
  }

  // ---- thẻ chỉ số
  E.str = function (k) {   // cánh tay gồng
    var m = k.m;
    m.ico(0.165, 1, SK, { x: -0.47, y: -0.07 });
    m.beam([-0.46, -0.08, 0], [0.3, -0.2, 0], 0.14, SK, 7);
    m.ico(0.17, 1, SK, { x: -0.06, y: 0.01, sx: 1.75, sy: 0.9, sz: 0.85 });
    m.ico(0.15, 1, SKD, { x: 0.32, y: -0.2 });
    m.beam([0.32, -0.2, 0], [0.13, 0.22, 0], 0.13, SK, 7);
    m.beam([0.13, 0.22, 0], [0.05, 0.42, 0], 0.1, SK, 7);
    k.t.beam([0.2, 0.06, 0], [0.13, 0.22, 0], 0.142, P.bronzeLight, 8);
    m.box(0.25, 0.22, 0.24, SK, { x: 0.0, y: 0.55, rz: 0.4 });
    m.box(0.08, 0.15, 0.1, SKD, { x: -0.1, y: 0.47, z: 0.09, rz: 0.55 });
    return { ry: 0.25, rx: 0.1 };
  };
  E.agi = function (k) {   // con rắn uốn mình
    var m = k.m, n = 14, pts = [], i, c1 = 0x5a7a3a, c2 = 0x86993f;
    for (i = 0; i <= n; i++) { var t = i / n; pts.push([0.3 * Math.sin(t * PI * 2.2 + 0.4), -0.55 + t * 0.95, 0.12 * Math.cos(t * PI * 2.2)]); }
    for (i = 0; i < n; i++) {
      var r = 0.04 + 0.07 * Math.sin(PI * (0.05 + 0.75 * (i + 1) / n));
      m.beam(pts[i], pts[i + 1], r, i % 2 ? c2 : c1, 6); m.ico(r * 1.02, 0, i % 2 ? c2 : c1, { x: pts[i + 1][0], y: pts[i + 1][1], z: pts[i + 1][2] });
    }
    var h = pts[n], hx = h[0] + 0.07, hy = h[1] + 0.05, hz = h[2] + 0.03;
    m.ico(0.14, 1, c1, { x: hx, y: hy, z: hz, sx: 1.3, sy: 0.72 });
    k.g.ico(0.026, 0, 0xffd24a, { x: hx + 0.07, y: hy + 0.045, z: hz + 0.1 }); k.g.ico(0.026, 0, 0xffd24a, { x: hx + 0.07, y: hy + 0.045, z: hz - 0.1 });
    k.d.tri([hx + 0.17, hy - 0.01, hz], [hx + 0.34, hy + 0.05, hz + 0.02], [hx + 0.24, hy - 0.01, hz], RED); k.d.tri([hx + 0.17, hy - 0.01, hz], [hx + 0.34, hy - 0.07, hz - 0.02], [hx + 0.24, hy - 0.01, hz], RED);
    return { ry: 0.2, rx: 0.1 };
  };
  E.hp = function (k) {   // trái tim: máu
    var m = k.m, c = 0xb5302a;
    m.ico(0.27, 1, c, { x: -0.19, y: 0.14, sz: 0.62 }); m.ico(0.27, 1, c, { x: 0.19, y: 0.14, sz: 0.62 });
    m.cone(0.455, 0.62, 8, c, { y: -0.2, rx: PI, sz: 0.5 });
    return { ry: 0.3, rx: 0.05 };
  };
  E.vit = function (k) {   // thân người vạm vỡ: thể chất
    var m = k.m, i;
    m.loft([[-0.5, 0.2, 0.14], [-0.3, 0.21, 0.15], [0.0, 0.27, 0.18], [0.25, 0.34, 0.2], [0.4, 0.3, 0.16]], 8, SK, null, 3);
    m.cyl(0.085, 0.1, 0.16, 7, SK, { y: 0.47 });
    for (i = -1; i <= 1; i += 2) {
      m.ico(0.15, 1, SK, { x: i * 0.37, y: 0.32, sy: 0.9 });
      m.ico(0.14, 1, SKD, { x: i * 0.135, y: 0.2, z: 0.15, sz: 0.5, sy: 0.85 });
      for (var j = 0; j < 3; j++) m.box(0.105, 0.075, 0.03, SKD, { x: i * 0.062, y: -0.05 - j * 0.105, z: 0.186 - j * 0.012 });
    }
    m.box(0.46, 0.09, 0.32, P.leatherDark, { y: -0.53 }); m.box(0.3, 0.2, 0.3, V.TEAM[0].cloth, { y: -0.66 });
    return { ry: 0.3, rx: 0.08 };
  };
  E.aspd = function (k) {   // lưỡi kiếm vung nhanh: tốc độ đánh
    var bx = -0.3, by = -0.52, a = -0.62, s = 1.2, ux = -Math.sin(a), uy = Math.cos(a), nx = -uy, ny = ux, i;
    sword(k, { x: bx, y: by, rz: a, s: s });
    for (i = 0; i < 3; i++) {
      var t = (0.34 + i * 0.22) * s, px = bx + ux * t, py = by + uy * t, L = 0.42 + i * 0.12;
      k.d.tri([px + ux * 0.085, py + uy * 0.085, -0.03], [px - ux * 0.085, py - uy * 0.085, -0.03], [px + nx * L - ux * 0.12, py + ny * L - uy * 0.12, -0.03], i % 2 ? 0xf0cf7a : 0xffe7a8);
    }
    return { ry: 0.15, rx: 0.08 };
  };
  E.hide = function (k) {   // tấm da thú căng nhiều lớp
    var m = k.m, L = [[P.leatherDark, 0, 1], [P.leather, 0.06, 0.86], [0x8a6240, 0.12, 0.72]], i, sx, sy;
    for (i = 0; i < 3; i++) {
      var c = L[i][0], z = L[i][1], s = L[i][2];
      m.box(0.62 * s, 0.74 * s, 0.05, c, { z: z }); m.box(0.24 * s, 0.22 * s, 0.05, c, { y: 0.45 * s, z: z });
      for (sx = -1; sx <= 1; sx += 2) for (sy = -1; sy <= 1; sy += 2) m.box(0.2 * s, 0.34 * s, 0.05, c, { x: sx * 0.36 * s, y: sy * 0.32 * s, z: z, rz: -sx * sy * 0.75 });
    }
    for (i = 0; i < 5; i++) { m.box(0.018, 0.06, 0.02, P.rope, { x: -0.16, y: -0.2 + i * 0.1, z: 0.155 }); m.box(0.018, 0.06, 0.02, P.rope, { x: 0.16, y: -0.2 + i * 0.1, z: 0.155 }); }
    return { ry: 0.45, rx: 0.2 };
  };
  E.porter = function (k) {   // đòn gánh hai đầu
    var m = k.m;
    m.beam([-0.64, 0.3, 0], [0, 0.37, 0], 0.035, P.wood, 6); m.beam([0, 0.37, 0], [0.64, 0.3, 0], 0.035, P.wood, 6);
    [-1, 1].forEach(function (s) {
      var x = s * 0.56;
      m.beam([x, 0.3, 0], [x - 0.11, -0.08, 0.07], 0.012, P.rope, 4); m.beam([x, 0.3, 0], [x + 0.11, -0.08, 0.07], 0.012, P.rope, 4); m.beam([x, 0.3, 0], [x, -0.08, -0.11], 0.012, P.rope, 4);
      if (s < 0) { m.ico(0.22, 1, P.linen, { x: x, y: -0.27, sy: 1.1 }); m.cyl(0.05, 0.09, 0.08, 6, P.rope, { x: x, y: -0.03 }); }
      else { m.cyl(0.2, 0.15, 0.3, 8, P.straw, { x: x, y: -0.26 }); m.cyl(0.215, 0.215, 0.03, 8, P.woodLight, { x: x, y: -0.11 }); m.ico(0.1, 0, P.terracotta, { x: x - 0.05, y: -0.07 }); m.ico(0.09, 0, 0x8a9a4a, { x: x + 0.07, y: -0.06, z: 0.04 }); }
    });
    return { ry: 0.3, rx: 0.15 };
  };
  E.showman = function (k) {   // vòng nguyệt quế vàng
    var d = k.d, n = 10, R = 0.42, i, side;
    k.m.torus(R, 0.016, 4, 22, P.bronzeDark, null);
    for (side = -1; side <= 1; side += 2) for (i = 0; i < n; i++) {
      var a = -PI / 2 + side * (0.3 + i / (n - 1) * 2.45), cx = R * Math.cos(a), cy = R * Math.sin(a);
      var tx = -Math.sin(a) * side, ty = Math.cos(a) * side, nx = Math.cos(a), ny = Math.sin(a), z = 0.02 + (i % 2) * 0.012;
      var base = [cx - tx * 0.03, cy - ty * 0.03, z];
      d.tri(base, [cx + tx * 0.08 + nx * 0.13, cy + ty * 0.08 + ny * 0.13, z + 0.03], [cx + tx * 0.2 + nx * 0.07, cy + ty * 0.2 + ny * 0.07, z], i % 2 ? GOLD : 0xe9c868);
      d.tri(base, [cx + tx * 0.2 - nx * 0.05, cy + ty * 0.2 - ny * 0.05, z], [cx + tx * 0.08 - nx * 0.11, cy + ty * 0.08 - ny * 0.11, z + 0.03], i % 2 ? GOLDD : GOLD);
    }
    k.m.box(0.12, 0.07, 0.05, RED, { y: -R, z: 0.03 });
    d.tri([-0.03, -R - 0.02, 0.03], [-0.16, -R - 0.22, 0.03], [-0.05, -R - 0.2, 0.03], RED); d.tri([0.03, -R - 0.02, 0.03], [0.05, -R - 0.2, 0.03], [0.16, -R - 0.22, 0.03], RED);
    return { ry: 0.2, rx: 0.1 };
  };
  E.fitted = function (k) {   // giáp ngực với chiếc lông vũ: giáp nhẹ đi
    var t = k.t, m = k.m, i;
    t.loft([[-0.42, 0.25, 0.17], [-0.2, 0.27, 0.19], [0.1, 0.33, 0.21], [0.3, 0.34, 0.2], [0.42, 0.25, 0.15]], 8, P.bronze, null, 2);
    m.cyl(0.11, 0.11, 0.02, 8, P.black, { y: 0.425 });
    for (i = -1; i <= 1; i += 2) { m.box(0.1, 0.06, 0.3, P.leather, { x: i * 0.2, y: 0.44 }); t.ico(0.13, 1, P.bronzeLight, { x: i * 0.12, y: 0.17, z: 0.155, sz: 0.5 }); }
    t.box(0.02, 0.4, 0.02, P.bronzeDark, { y: -0.14, z: 0.2 }); t.box(0.26, 0.02, 0.02, P.bronzeDark, { y: -0.08, z: 0.2 }); t.box(0.24, 0.02, 0.02, P.bronzeDark, { y: -0.22, z: 0.195 });
    for (i = 0; i < 5; i++) m.box(0.09, 0.2, 0.03, i % 2 ? P.clothRed : P.leather, { x: -0.22 + i * 0.11, y: -0.53, z: 0.13 - Math.abs(i - 2) * 0.03 });
    feather(k, [-0.4, -0.34, 0.3], [0.44, 0.5, 0.3], 0.12, 0xf2ead8, 0xd8cdb4);
    return { ry: 0.35, rx: 0.08 };
  };

  // ---- thẻ hiếm
  E.riposte = function (k) {   // khiên đỡ, kiếm trả
    sword(k, { x: -0.47, y: -0.62, z: -0.1, rz: -0.6, s: 1.3 });
    roundShield(k, { x: 0, y: -0.04, z: 0.04 }, 0.33, P.clothBlue);
    return { ry: 0.3, rx: 0.1 };
  };
  E.bloodlust = function (k) {   // lưỡi dao nhỏ máu
    sword(k, { x: 0.4, y: 0.52, rz: 2.45 }, { blood: true });
    drop(k, -0.3, -0.44, 1.0); drop(k, -0.06, -0.6, 0.6); drop(k, -0.46, -0.18, 0.5);
    return { ry: 0.2, rx: 0.1 };
  };
  E.grit = function (k) {   // tảng đá và thanh kiếm gãy trên nó
    var m = k.m;
    m.ico(0.42, 1, P.stone, { y: -0.2, sy: 0.8, sx: 1.15 }); m.ico(0.2, 0, P.stoneDark, { x: -0.4, y: -0.42 }); m.ico(0.16, 0, P.stoneLight, { x: 0.42, y: -0.46, z: 0.1 });
    sword(k, { x: 0.5, y: 0.66, z: 0.05, rz: 2.2 }, { len: 0.2, noTip: true });
    k.t.box(0.09, 0.26, 0.026, P.steel, { x: -0.34, y: 0.4, rz: 0.85 }); k.t.cone(0.045, 0.14, 4, P.steel, { x: -0.49, y: 0.53, rz: 0.85, sz: 0.3 });
    var s = [[0.16, 0.2], [0.02, 0.36], [0.2, 0.42], [-0.02, 0.2], [0.3, 0.26]], i;
    for (i = 0; i < s.length; i++) k.g.tri([0.1, 0.24, 0.3], [s[i][0], s[i][1], 0.3], [(0.1 + s[i][0]) / 2 + 0.03, (0.24 + s[i][1]) / 2 - 0.03, 0.3], 0xffd866);
    return { ry: 0.25, rx: 0.12 };
  };
  E.opener = function (k) {   // tia sét của Jupiter: đánh trước
    var d = k.d, z0 = -0.06, z1 = 0.06;
    var P0 = [0.05, 0.65], P1 = [0.36, 0.65], P2 = [0.1, 0.12], P3 = [0.34, 0.12], P4 = [-0.24, -0.66], P5 = [-0.02, -0.05], P6 = [-0.32, -0.05];
    prism(d, [P0, P1, P2, P6], z0, z1, GOLD, GOLDD); prism(d, [P5, P2, P3, P4], z0, z1, 0xe9c868, GOLDD); prism(d, [P6, P2, P5], z0, z1, GOLD, GOLDD);
    return { ry: 0.4, rx: 0.1 };
  };
  E.gangup = function (k) {   // ba lưỡi kiếm chụm vào một điểm
    for (var i = 0; i < 3; i++) {
      var a = PI / 2 + i * PI * 2 / 3, r = 0.7;
      sword(k, { x: Math.cos(a) * r, y: Math.sin(a) * r - 0.04, z: i * 0.03, rz: Math.atan2(Math.cos(a), -Math.sin(a)), s: 0.74 });
    }
    k.m.ico(0.1, 1, RED, { y: -0.04, z: 0.08 });
    return { ry: 0.15, rx: 0.08 };
  };
  E.guardian = function (k) {   // tấm khiên che cho người đứng sau
    k.m.cyl(0.075, 0.17, 0.56, 6, V.TEAM[0].cloth, { x: 0.3, y: -0.2, z: -0.16 }); k.m.ico(0.115, 1, SK, { x: 0.3, y: 0.2, z: -0.16 });
    k.m.box(0.09, 0.3, 0.09, SK, { x: 0.44, y: -0.12, z: -0.16, rz: 0.2 });
    scutum(k, { x: -0.12, y: -0.02, z: 0.1, ry: -0.25 }, 0.5, 0.9, RED);
    return { ry: 0.32, rx: 0.08 };
  };
  E.lonewolf = function (k) {   // sói tru dưới trăng
    var m = k.m, F = 0x80848a, FD = 0x565a60, FL = 0xbcc0c4, Pt = { x: 0.02, y: 0.1, rz: 0.5 };
    k.d.add(new T.CircleGeometry(0.3, 12), 0xe9dfae, { x: 0.3, y: 0.34, z: -0.3 });
    m.box(0.4, 0.36, 0.34, F, at(Pt, { x: -0.05 }));
    m.box(0.34, 0.17, 0.2, F, at(Pt, { x: 0.3, y: -0.02 }));
    m.box(0.3, 0.06, 0.16, FL, at(Pt, { x: 0.26, y: -0.18, rz: -0.3 }));
    m.ico(0.05, 0, P.black, at(Pt, { x: 0.485, y: 0.04 }));
    m.cone(0.085, 0.26, 4, FD, at(Pt, { x: -0.17, y: 0.28, z: 0.11, rz: 0.4 })); m.cone(0.085, 0.26, 4, FD, at(Pt, { x: -0.17, y: 0.28, z: -0.11, rz: 0.4 }));
    k.g.ico(0.032, 0, 0xffd24a, at(Pt, { x: 0.09, y: 0.07, z: 0.175 }));
    m.cone(0.03, 0.08, 4, BONE, at(Pt, { x: 0.4, y: -0.1, z: 0.07, rx: PI })); m.cone(0.03, 0.08, 4, BONE, at(Pt, { x: 0.3, y: -0.1, z: 0.08, rx: PI }));
    m.box(0.36, 0.56, 0.3, FD, { x: -0.22, y: -0.36, rz: -0.2 });
    m.cone(0.1, 0.24, 4, F, { x: -0.44, y: -0.06, rz: 1.0 }); m.cone(0.1, 0.24, 4, F, { x: -0.5, y: -0.3, rz: 1.25 }); m.cone(0.09, 0.2, 4, FL, { x: -0.06, y: -0.3, z: 0.14, rz: -2.6 });
    return { ry: -0.25, rx: 0.05 };
  };
  E.drilled = function (k) {   // cọc tập và kiếm gỗ
    var m = k.m, i;
    m.cyl(0.1, 0.12, 1.1, 7, P.wood, { x: -0.14 });
    m.cyl(0.128, 0.128, 0.05, 7, P.rope, { x: -0.14, y: 0.3 }); m.cyl(0.134, 0.134, 0.05, 7, P.rope, { x: -0.14, y: -0.06 });
    for (i = 0; i < 3; i++) m.box(0.12, 0.028, 0.05, P.woodDark, { x: -0.1 + (i % 2) * 0.03, y: 0.44 - i * 0.26, z: 0.1, rz: i % 2 ? -0.5 : 0.5 });
    m.cyl(0.22, 0.27, 0.08, 8, P.sandDark, { x: -0.14, y: -0.58 });
    sword(k, { x: 0.46, y: -0.56, z: 0.16, rz: 0.52, s: 1.08 }, { wood: true });
    return { ry: 0.3, rx: 0.12 };
  };
  E.execute = function (k) {   // ngón cái chĩa xuống
    var m = k.m, i;
    m.cyl(0.13, 0.15, 0.42, 7, SK, { x: 0.44, y: 0.13, rz: PI / 2 - 0.2 });
    k.t.cyl(0.165, 0.165, 0.09, 8, P.bronzeLight, { x: 0.37, y: 0.115, rz: PI / 2 - 0.2 });
    m.box(0.42, 0.37, 0.3, SK, { y: 0.08 });
    for (i = 0; i < 4; i++) m.box(0.3, 0.078, 0.1, i % 2 ? SKD : SK, { x: -0.04, y: 0.215 - i * 0.09, z: 0.16 });
    m.box(0.13, 0.36, 0.14, SK, { x: -0.11, y: -0.26, z: 0.03 }); m.box(0.105, 0.09, 0.11, 0xe2c6a4, { x: -0.11, y: -0.4, z: 0.095 });
    return { ry: -0.3, rx: 0.1 };
  };
  E.fleet = function (k) {   // bàn chân có cánh
    var m = k.m, d = k.d, i, s;
    m.cyl(0.105, 0.085, 0.62, 7, SK, { x: -0.1, y: 0.24, rz: -0.1 });
    m.box(0.44, 0.13, 0.17, SK, { x: 0.07, y: -0.16 }); m.ico(0.1, 0, SK, { x: -0.13, y: -0.14 }); m.box(0.14, 0.09, 0.165, SKD, { x: 0.33, y: -0.18 });
    m.box(0.6, 0.035, 0.2, P.leatherDark, { x: 0.09, y: -0.245 });
    m.box(0.035, 0.15, 0.19, P.leather, { x: 0.1, y: -0.15 }); m.box(0.035, 0.14, 0.19, P.leather, { x: 0.24, y: -0.16 });
    m.cyl(0.1, 0.1, 0.045, 7, P.leather, { x: -0.125, y: -0.02 });
    var tips = [[-0.62, -0.02], [-0.66, 0.2], [-0.58, 0.4], [-0.42, 0.54]];
    for (s = -1; s <= 1; s += 2) for (i = 0; i < 4; i++) {
      var z = s * 0.1, bx = -0.14, by = 0.0 + i * 0.05, tx = tips[i][0], ty = tips[i][1], dx = tx - bx, dy = ty - by, L = Math.sqrt(dx * dx + dy * dy), nx = -dy / L * 0.075, ny = dx / L * 0.075;
      var mx = bx + dx * 0.45, my = by + dy * 0.45, zt = z + s * 0.05, c = i % 2 ? 0xd8cdb4 : 0xf2ead8;
      d.tri([bx, by, z], [mx + nx, my + ny, zt], [tx, ty, zt], c); d.tri([bx, by, z], [tx, ty, zt], [mx - nx, my - ny, zt], i % 2 ? 0xc4b89c : 0xe0d6c0);
    }
    return { ry: -0.3, rx: 0.1 };
  };
  E.wall = function (k) {   // tấm scutum chạm cánh đại bàng
    var Pm = {}, d = k.d, s, z = 0.031;
    scutum(k, Pm, 0.6, 0.98, RED);
    for (s = -1; s <= 1; s += 2) {
      d.tri([s * 0.07, 0.12, z], [s * 0.26, 0.3, z], [s * 0.22, 0.1, z], GOLD); d.tri([s * 0.07, 0.06, z], [s * 0.26, 0.04, z], [s * 0.2, -0.08, z], GOLD);
      d.tri([s * 0.07, -0.12, z], [s * 0.26, -0.3, z], [s * 0.22, -0.1, z], GOLD); d.tri([0, 0.2, z], [s * 0.05, 0.4, z], [0, 0.36, z], GOLD); d.tri([0, -0.2, z], [s * 0.05, -0.4, z], [0, -0.36, z], GOLD);
    }
    return { ry: 0.35, rx: 0.08 };
  };
  E.sharp = function (k) {   // dao cắm giữa hồng tâm
    var m = k.m;
    m.cyl(0.5, 0.5, 0.07, 14, P.straw, { rx: PI / 2 });
    m.cyl(0.4, 0.4, 0.075, 14, RED, { rx: PI / 2, z: 0.005 }); m.cyl(0.27, 0.27, 0.08, 12, P.white, { rx: PI / 2, z: 0.01 }); m.cyl(0.13, 0.13, 0.085, 10, RED, { rx: PI / 2, z: 0.015 });
    sword(k, aim([0.52, 0.56, 0.36], [0.0, 0.0, 0.02], 1.0), { len: 0.46 });
    return { ry: 0.25, rx: 0.1 };
  };
  E.stubborn = function (k) {   // đầu bò đực
    var m = k.m, B = 0x6e4c36, BD = 0x4a3324, BL = 0xb89e7e, s;
    m.box(0.5, 0.46, 0.4, B, { y: 0.08 }); m.box(0.34, 0.3, 0.34, BL, { y: -0.25, z: 0.1 }); m.box(0.56, 0.11, 0.43, BD, { y: 0.31 });
    for (s = -1; s <= 1; s += 2) {
      m.ico(0.035, 0, P.black, { x: s * 0.085, y: -0.29, z: 0.275 });
      m.box(0.2, 0.09, 0.06, B, { x: s * 0.37, y: 0.1, rz: -s * 0.35 });
      m.beam([s * 0.24, 0.31, 0], [s * 0.5, 0.36, 0.03], 0.07, BONE, 6); m.beam([s * 0.5, 0.36, 0.03], [s * 0.63, 0.56, 0.06], 0.055, BONE, 6); m.ico(0.062, 0, BONE, { x: s * 0.5, y: 0.36, z: 0.03 });
      m.beam([s * 0.63, 0.56, 0.06], [s * 0.57, 0.8, 0.1], 0.034, 0xcfc4a6, 5); m.ico(0.05, 0, BONE, { x: s * 0.63, y: 0.56, z: 0.06 });
      k.g.ico(0.036, 0, 0xff6a2a, { x: s * 0.15, y: 0.1, z: 0.205 });
      m.box(0.17, 0.045, 0.05, BD, { x: s * 0.15, y: 0.175, z: 0.21, rz: -s * 0.35 });
    }
    k.t.torus(0.085, 0.02, 4, 10, P.bronzeLight, { y: -0.41, z: 0.27 });
    return { ry: 0.3, rx: 0.08 };
  };
  E.second = function (k) {   // ngọn lửa bùng lại từ tro
    var m = k.m, g = k.g;
    m.box(0.74, 0.1, 0.13, P.woodDark, { y: -0.5, rz: 0.14 }); m.box(0.7, 0.1, 0.13, 0x3a2a22, { y: -0.5, z: 0.08, rz: -0.2 });
    m.ico(0.12, 0, 0x2e2420, { x: -0.3, y: -0.56, z: 0.1 }); m.ico(0.1, 0, 0x4a3a30, { x: 0.3, y: -0.58, z: 0.12 });
    g.cone(0.3, 0.86, 6, 0xcf4018, { y: -0.04 }); g.cone(0.16, 0.44, 5, 0xcf4018, { x: -0.22, y: -0.2, rz: 0.32 }); g.cone(0.15, 0.4, 5, 0xcf4018, { x: 0.23, y: -0.22, rz: -0.36 });
    g.cone(0.2, 0.58, 6, 0xf08a22, { y: -0.16, z: 0.1 }); g.cone(0.11, 0.34, 5, 0xffd866, { y: -0.26, z: 0.2 });
    return { ry: 0.2, rx: 0.08 };
  };
  E.heavy = function (k) {   // rìu hai lưỡi
    var m = k.m, t = k.t, s;
    m.cyl(0.036, 0.042, 1.28, 6, P.wood, { y: -0.06 }); m.cyl(0.05, 0.05, 0.14, 6, P.leatherDark, { y: -0.52 }); m.cyl(0.05, 0.05, 0.05, 6, P.leatherDark, { y: -0.2 });
    for (s = 0; s < 2; s++) {
      var a0 = s ? PI + 0.72 : 0.72, x0 = s ? -0.05 : 0.05;
      t.add(new T.CylinderGeometry(0.46, 0.46, 0.03, 7, 1, false, a0, PI - 1.44), P.ironDark, { x: x0, y: 0.36, rx: PI / 2 });
      t.add(new T.CylinderGeometry(0.36, 0.36, 0.055, 7, 1, false, a0, PI - 1.44), P.steel, { x: x0, y: 0.36, rx: PI / 2 });
    }
    t.box(0.13, 0.26, 0.09, P.bronzeLight, { y: 0.36 }); t.cone(0.04, 0.16, 5, P.bronzeLight, { y: 0.66 });
    return { ry: 0.3, rx: 0.1 };
  };

  // Dựng vật tượng trưng của một thẻ thành Group (để chụp icon).
  V.cardEmblem = function (id) {
    var k = kit(), fn = E[id] || E.str;
    V.jseed(7001 + id.length * 131 + id.charCodeAt(0) * 17);
    var rot = fn(k) || {}, grp = new T.Group();
    [['m', 'matte'], ['t', 'metal'], ['g', 'glow'], ['d', 'matteDouble']].forEach(function (p) { if (!k[p[0]].empty()) grp.add(V.mesh(k[p[0]], p[1], false, false)); });
    grp.rotation.set(rot.rx || 0, rot.ry || 0, rot.rz || 0);
    return grp;
  };
  // Icon của thẻ lên cấp `id` (data URL, nền trong suốt).
  V.cardIcon = function (id, size) {
    size = size || 96; var key = id + '@' + size; if (cache[key]) return cache[key];
    var grp = V.cardEmblem(id), holder = new T.Group(); holder.add(grp);
    var url = V.shoot(holder, size, size, 0.12);
    grp.traverse(function (m) { if (m.geometry) m.geometry.dispose(); });
    return (cache[key] = url);
  };
  // Icon của một chỉ số: str, agi, vit, hp, move, aspd.
  var STAT = { str: 'str', agi: 'agi', vit: 'vit', hp: 'hp', move: 'fleet', aspd: 'aspd' };
  V.statIcon = function (key, size) { return V.cardIcon(STAT[key] || key, size || 28); };
  V.CARD_ICONS = E;
})(window.G = window.G || {});

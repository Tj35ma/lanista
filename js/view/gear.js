// LANISTA — hình khối trang bị: vũ khí, khiên, mũ, giáp. Mọi thứ dựng bằng mã.
// Mỗi hàm vẽ vào một "Kit": tập các Geo theo (khớp xương, vật liệu).
(function (G) {
  'use strict';
  var T = THREE, V = G.V, P = V.PAL, PI = Math.PI;

  function Kit() { this.m = {}; }
  Kit.prototype.g = function (node, mat) { var k = node + '|' + (mat || 'matte'); return this.m[k] || (this.m[k] = new V.Geo(0.05, 0.04)); };
  // gắn các mesh vào bộ khớp {tên: Object3D}; trả về danh sách mesh
  Kit.prototype.attach = function (nodes, list) {
    for (var k in this.m) {
      var geo = this.m[k]; if (geo.empty()) continue;
      var sp = k.split('|'), n = nodes[sp[0]]; if (!n) continue;
      var mesh = V.mesh(geo, sp[1]); n.add(mesh); if (list) list.push(mesh);
    }
  };
  V.Kit = Kit;

  var STEEL = [0x857c70, 0xa4a8aa, 0xbcc2c6, 0xd2d8dc];
  var WOODS = [0x6b4e32, 0x7a5a3a, 0x6a4a30, 0x5a3e2a];
  function teamCol(team, what) { return team == null ? (what === 'trim' ? P.clothOchre : P.clothBrown) : V.TEAM[team][what || 'cloth']; }

  // ---------------------------------------------------------------- Vũ khí (gốc = chỗ nắm, +Y = mũi, +Z = lưỡi)
  var Wp = {};
  function blade(gt, len, w, col, y0) {
    var bl = len - y0 - 0.07;
    gt.box(0.011, bl, w, col, { y: y0 + bl / 2 });
    gt.add(new T.ConeGeometry(w * 0.5, 0.075, 4), col, { y: len - 0.035, sx: 0.24, ry: PI / 4 });
  }
  function hilt(gm, gt, q, gw) {
    gm.cyl(0.017, 0.017, 0.11, 5, P.leatherDark, {});
    gt.ico(0.024, 0, q > 1 ? P.bronzeLight : P.bronzeDark, { y: -0.072 });
    gt.box(0.03, 0.022, gw || 0.1, q > 1 ? P.bronze : P.ironDark, { y: 0.063 });
  }
  function curved(gt, c, sc, heavy) {
    gt.box(0.011, 0.24 * sc, heavy ? 0.052 : 0.048, c, { y: 0.07 + 0.12 * sc });
    gt.box(0.011, 0.19 * sc, heavy ? 0.064 : 0.045, c, { y: 0.07 + 0.315 * sc, z: 0.028 * sc, rx: 0.36 });
    gt.box(0.011, 0.15 * sc, heavy ? 0.074 : 0.036, c, { y: 0.07 + 0.45 * sc, z: 0.095 * sc, rx: 0.78 });
  }
  function axeHead(gt, c, y, dir, sc) {
    var z0 = 0.02 * dir, z1 = 0.19 * dir * sc, t = 0.012;
    var a = [[t, y - 0.045 * sc, z0], [t, y + 0.055 * sc, z0], [0.002, y + 0.13 * sc, z1], [0.002, y - 0.13 * sc, z1]];
    var bb = a.map(function (p) { return [-p[0], p[1], p[2]]; });
    if (dir > 0) { gt.quad(a[0], a[3], a[2], a[1], c); gt.quad(bb[0], bb[1], bb[2], bb[3], c); gt.quad(a[1], a[2], bb[2], bb[1], c); gt.quad(a[3], a[0], bb[0], bb[3], c); }
    else { gt.quad(a[0], a[1], a[2], a[3], c); gt.quad(bb[0], bb[3], bb[2], bb[1], c); gt.quad(a[1], bb[1], bb[2], a[2], c); gt.quad(a[3], bb[3], bb[0], a[0], c); }
  }
  Wp.gladius = function (gm, gt, q, L) {
    var v = L && L.v;
    hilt(gm, gt, q, v === 'spatha' ? 0.125 : (v === 'pugio' ? 0.085 : 0.1));
    blade(gt, v === 'spatha' ? 0.78 : (v === 'pugio' ? 0.42 : 0.62), v === 'pugio' ? 0.062 : (v === 'spatha' ? 0.046 : 0.052), STEEL[q], 0.074);
    if (v === 'spatha') gt.box(0.013, 0.4, 0.012, 0x6f747a, { y: 0.32 });
  };
  Wp.twin = function (gm, gt, q, L) {
    var v = L && L.v, c = STEEL[q];
    if (v === 'taxe') { gm.cyl(0.015, 0.017, 0.46, 5, WOODS[q], { y: 0.13 }); axeHead(gt, c, 0.3, 1, 0.72); gt.box(0.04, 0.08, 0.04, P.ironDark, { y: 0.3 }); return; }
    gm.cyl(0.015, 0.015, 0.1, 5, P.leatherDark, {});
    gt.box(0.026, 0.018, 0.075, P.ironDark, { y: 0.056 });
    if (v === 'tsica') curved(gt, c, 0.72, false); else blade(gt, 0.44, 0.04, c, 0.065);
  };
  Wp.sica = function (gm, gt, q, L) {
    gm.cyl(0.017, 0.017, 0.11, 5, P.leatherDark, {});
    gt.box(0.03, 0.02, 0.085, P.bronzeDark, { y: 0.062 });
    curved(gt, STEEL[q], 1, !!(L && L.v === 'kopis'));
  };
  Wp.mace = function (gm, gt, q, L) {
    var v = L && L.v, i, a;
    if (v === 'pick') {
      gm.cyl(0.018, 0.02, 0.74, 5, WOODS[q], { y: 0.28 }); gt.box(0.04, 0.05, 0.06, P.ironDark, { y: 0.62 });
      gt.cone(0.022, 0.2, 4, STEEL[q], { y: 0.6, z: 0.12, rx: PI / 2 + 0.25 }); gt.box(0.035, 0.04, 0.06, STEEL[q], { y: 0.62, z: -0.05 }); return;
    }
    if (v === 'nail') {
      gm.cyl(0.046, 0.021, 0.76, 6, WOODS[q], { y: 0.31 });
      for (i = 0; i < 7; i++) { a = i * 0.9; gt.cone(0.012, 0.06, 4, q ? P.bronze : P.iron, { y: 0.5 + (i % 3) * 0.07, x: Math.cos(a) * 0.05, z: Math.sin(a) * 0.05, rz: -Math.cos(a) * 1.57, rx: Math.sin(a) * 1.57 }); }
      return;
    }
    if (q === 0) { gm.cyl(0.042, 0.02, 0.74, 6, WOODS[0], { y: 0.3 }); gm.ico(0.05, 0, WOODS[3], { y: 0.66 }); return; }
    gm.cyl(0.018, 0.018, 0.72, 5, WOODS[1], { y: 0.27 });
    if (q === 1) { gt.ico(0.062, 0, P.ironDark, { y: 0.66 }); for (i = 0; i < 6; i++) gt.cone(0.016, 0.06, 4, P.iron, { y: 0.66 + Math.sin(i * 2.1) * 0.03, x: Math.cos(i * 1.05) * 0.07, z: Math.sin(i * 1.05) * 0.07, rz: -Math.cos(i * 1.05) * 1.57, rx: Math.sin(i * 1.05) * 1.57 }); }
    else if (q === 2) { gt.box(0.07, 0.085, 0.17, P.iron, { y: 0.65 }); gt.box(0.08, 0.03, 0.03, P.ironDark, { y: 0.65, z: 0.085 }); }
    else { gt.ico(0.055, 0, P.bronze, { y: 0.66 }); for (i = 0; i < 6; i++) gt.box(0.012, 0.13, 0.05, P.bronzeLight, { y: 0.66, x: Math.cos(i * 1.047) * 0.06, z: Math.sin(i * 1.047) * 0.06, ry: -i * 1.047 + PI / 2 }); }
  };
  Wp.hasta = function (gm, gt, q, L) {
    var v = L && L.v, ext = v === 'pike' ? 0.3 : (v === 'boar' ? -0.1 : 0);
    gm.cyl(0.014, 0.016, 1.86 + ext, 5, WOODS[q], { y: 0.08 + ext / 2 });
    if (q === 0 && !v) { gm.cone(0.016, 0.16, 5, 0x2e2418, { y: 1.09 }); return; }
    gt.add(new T.OctahedronGeometry(0.1, 0), STEEL[q], { y: 1.1 + ext, sx: 0.12, sy: v === 'boar' ? 1.7 : 1.5, sz: v === 'boar' ? 0.64 : 0.42 });
    if (v === 'boar') gt.box(0.016, 0.02, 0.2, P.ironDark, { y: 0.88 });
    if (v === 'pike') gt.cyl(0.019, 0.019, 0.1, 5, P.bronzeDark, { y: 1.22 });
    gt.cone(0.014, 0.08, 4, P.bronzeDark, { y: -0.89, rx: PI });
  };
  Wp.trident = function (gm, gt, q, L) {
    var c = STEEL[q], v = L && L.v;
    gm.cyl(0.016, 0.018, 1.82, 5, WOODS[q], { y: 0.4 });
    if (v === 'harpoon') { gt.cone(0.02, 0.36, 4, c, { y: 1.48 }); gt.cone(0.016, 0.13, 4, c, { y: 1.4, z: 0.04, rx: PI - 0.5 }); gt.cone(0.016, 0.13, 4, c, { y: 1.4, z: -0.04, rx: PI + 0.5 }); gt.cyl(0.02, 0.02, 0.06, 5, P.ironDark, { y: 1.3 }); return; }
    gt.box(0.022, 0.028, v === 'bident' ? 0.2 : 0.25, c, { y: 1.31 });
    if (v === 'bident') { gt.cone(0.018, 0.36, 4, c, { y: 1.49, z: -0.085 }); gt.cone(0.018, 0.36, 4, c, { y: 1.49, z: 0.085 }); return; }
    gt.cone(0.014, 0.3, 4, c, { y: 1.46, z: -0.11 }); gt.cone(0.014, 0.3, 4, c, { y: 1.46, z: 0.11 }); gt.cone(0.015, 0.34, 4, c, { y: 1.48 });
  };
  Wp.axe = function (gm, gt, q, L) {
    var c = STEEL[q], v = L && L.v;
    gm.cyl(0.02, 0.023, 1.45, 5, WOODS[q], { y: 0.125 });
    if (v === 'maul') { gt.box(0.11, 0.12, 0.2, P.ironDark, { y: 0.74 }); gt.box(0.12, 0.03, 0.03, c, { y: 0.74, z: 0.1 }); gt.box(0.12, 0.03, 0.03, c, { y: 0.74, z: -0.1 }); return; }
    if (q === 2 && !v) { // falx: lưỡi liềm cong về trước
      gt.box(0.012, 0.3, 0.05, c, { y: 0.93, z: 0.01 }); gt.box(0.012, 0.22, 0.046, c, { y: 1.15, z: 0.06, rx: 0.5 }); gt.box(0.012, 0.18, 0.038, c, { y: 1.29, z: 0.16, rx: 1.05 });
      return;
    }
    axeHead(gt, c, 0.72, 1, v === 'dolabra' ? 0.8 : 1); gt.box(0.05, 0.12, 0.05, P.ironDark, { y: 0.725 });
    if (v === 'labrys' || (q === 3 && !v)) axeHead(gt, c, 0.72, -1, 1);
    else if (v === 'dolabra') gt.cone(0.02, 0.2, 4, c, { y: 0.72, z: -0.12, rx: -PI / 2 });
    else gt.cone(0.018, 0.07, 4, P.ironDark, { y: 0.72, z: -0.05, rx: -PI / 2 });
  };
  Wp.javelin = function (gm, gt, q, L) {
    var v = L && L.v, i;
    if (v === 'dart') {
      gm.cyl(0.011, 0.012, 0.6, 5, WOODS[q], {}); gt.ico(0.028, 0, 0x5a5d60, { y: 0.26, sy: 1.4 }); gt.cone(0.014, 0.12, 4, STEEL[q], { y: 0.36 });
      for (i = 0; i < 3; i++) gm.box(0.004, 0.1, 0.045, 0xd8cdb4, { y: -0.24, ry: i * 2.09 });
      return;
    }
    gm.cyl(v === 'venab' ? 0.014 : 0.011, v === 'venab' ? 0.016 : 0.012, 1.26, 5, WOODS[q], { y: -0.12 });
    if (v === 'venab') { gt.add(new T.OctahedronGeometry(0.1, 0), STEEL[q], { y: 0.66, sx: 0.12, sy: 1.5, sz: 0.5 }); gt.box(0.014, 0.018, 0.14, P.ironDark, { y: 0.5 }); return; }
    if (q === 0) { gm.cone(0.012, 0.14, 4, 0x2e2418, { y: 0.58 }); return; }
    gt.cyl(0.006, 0.008, 0.2, 4, STEEL[q], { y: 0.6 });
    gt.cone(0.016, 0.07, 4, STEEL[q], { y: 0.735 });
    if (q >= 2) gt.box(0.035, 0.05, 0.035, P.ironDark, { y: 0.5 });
  };
  // Cung: gốc = chỗ nắm; hai cánh cung dọc ±Y, bụng cung quay về +Z (phía mục tiêu), dây ở phía −Z
  Wp.bow = function (gm, gt, q, L) {
    var wood = [0x8a6a42, 0x6b4e32, 0x4a3828, 0x3a2c22][q], tip = q >= 2 ? 0xe6dcc4 : wood, n = 5, i, s;
    for (s = -1; s <= 1; s += 2) {
      var prev = [0, 0, 0.02];
      for (i = 1; i <= n; i++) { var t = i / n, p = [0, s * 0.62 * t, 0.02 - 0.2 * t * t]; gm.beam(prev, p, 0.017 - 0.007 * t, i === n ? tip : wood, 5); prev = p; }
    }
    gm.cyl(0.023, 0.023, 0.15, 6, P.leatherDark, { z: 0.02 });
    gm.beam([0, 0.62, -0.18], [0, -0.62, -0.18], 0.004, 0xd8cdb4, 3);
    if (q >= 3) { gt.cyl(0.021, 0.021, 0.03, 6, P.bronzeLight, { y: 0.11, z: 0.014 }); gt.cyl(0.021, 0.021, 0.03, 6, P.bronzeLight, { y: -0.11, z: 0.014 }); }
  };
  // Nỏ: gốc = tay cầm; thân nỏ dọc +Y (hướng bắn), cánh nỏ nằm ngang theo ±X, mặt trên (rãnh tên) quay về +Z
  Wp.crossbow = function (gm, gt, q, L) {
    var wood = WOODS[q], c = STEEL[q], s, i;
    gm.box(0.05, 0.78, 0.045, wood, { y: 0.14 });
    gm.box(0.046, 0.2, 0.075, wood, { y: -0.17, z: -0.014 });
    gt.box(0.02, 0.07, 0.03, P.ironDark, { y: -0.02, z: -0.04 });
    for (s = -1; s <= 1; s += 2) {
      var prev = [0, 0.46, 0.012];
      for (i = 1; i <= 3; i++) { var t = i / 3, p = [s * 0.34 * t, 0.46 - 0.13 * t * t, 0.012]; (q >= 2 ? gt : gm).beam(prev, p, 0.017 - 0.006 * t, q >= 2 ? c : 0x5a4030, 5); prev = p; }
      gm.beam([s * 0.34, 0.33, 0.012], [0, 0.2, 0.03], 0.004, 0xd8cdb4, 3);
    }
    gt.box(0.012, 0.3, 0.012, c, { y: 0.35, z: 0.032 }); gt.cone(0.014, 0.05, 4, c, { y: 0.525, z: 0.032 });
    gt.box(0.03, 0.04, 0.05, P.ironDark, { y: 0.2, z: 0.03 });
    if (q >= 1) gt.box(0.056, 0.03, 0.05, P.bronze, { y: 0.5 });
  };
  // chiều dài từ chỗ nắm tới mũi — dùng cho động tác ngắm (cộng thêm look.dl của từng biến thể)
  V.WEAPON_TIP = { fist: 0.05, caestus: 0.06, gladius: 0.62, sica: 0.6, mace: 0.7, hasta: 1.2, trident: 1.63, twin: 0.44, axe: 0.85, javelin: 0.77, bow: 0.62, crossbow: 0.55 };

  // găng: vẽ quanh nắm tay
  function caestus(k, q, D, L) {
    caestus0(k, q, D);
    if (L && L.v === 'spike') for (var s = 0; s < 2; s++) for (var i = -1; i <= 1; i++) k.g('hand' + s, 'metal').cone(0.014, 0.055, 4, P.iron, { x: i * 0.028 * D.W, y: 0.085 * D.S, z: 0.012 });
  }
  function caestus0(k, q, D) {
    for (var s = 0; s < 2; s++) {
      var gm = k.g('hand' + s), gt = k.g('hand' + s, 'metal'), w = D.W;
      gm.box(0.082 * w, 0.1 * D.S, 0.094 * w, q === 0 ? P.leather : P.leatherDark, {});
      gm.cyl(0.04 * w, 0.045 * w, 0.1 * D.S, 6, P.leatherDark, { y: -0.09 * D.S });
      if (q >= 1) for (var i = -1; i <= 1; i++) gt.cone(0.012, 0.03, 4, q >= 2 ? P.iron : P.bronze, { x: i * 0.025 * w, y: 0.062 * D.S, z: 0.01 });
    }
  }

  // ---------------------------------------------------------------- Khiên (gốc = tay nắm, +Z = mặt ngoài, +Y = trên)
  var Sh = {};
  Sh.plank = function (gm, gt, team) {
    for (var i = -1; i <= 1; i++) gm.box(0.165, 0.78, 0.026, WOODS[(i + 2) % 4], { x: i * 0.168, y: -0.05, z: 0.035 });
    gm.box(0.5, 0.05, 0.02, P.woodDark, { y: 0.2, z: 0.012 }); gm.box(0.5, 0.05, 0.02, P.woodDark, { y: -0.28, z: 0.012 });
    gm.box(0.5, 0.12, 0.008, teamCol(team), { y: 0.05, z: 0.054 });
  };
  Sh.parma = function (gm, gt, team) {
    gm.cyl(0.31, 0.31, 0.03, 10, teamCol(team), { rx: PI / 2, z: 0.04 });
    gt.torus(0.305, 0.018, 4, 10, P.bronzeDark, { z: 0.045 });
    gt.ico(0.06, 0, P.bronze, { z: 0.065, sz: 0.6 });
  };
  // khiên nhỏ: buckler tròn (gỗ / da / màu đội) với núm lớn ở giữa
  Sh.buckler = function (gm, gt, team, L) {
    var v = L && L.v, face = v === 'wood' ? WOODS[1] : (v === 'hide' ? 0x8a6f52 : teamCol(team)), rim = v === 'wood' ? P.ironDark : P.bronzeDark;
    gm.cyl(0.19, 0.19, 0.026, 12, face, { rx: PI / 2, z: 0.04 });
    gt.torus(0.188, 0.016, 4, 12, rim, { z: 0.046 });
    if (v === 'wood') for (var i = -1; i <= 1; i += 2) gm.box(0.012, 0.36, 0.006, P.woodDark, { x: i * 0.07, z: 0.055 });
    if (v === 'hide') { gm.torus(0.13, 0.008, 3, 12, P.leatherDark, { z: 0.056 }); }
    gt.cyl(0.075, 0.075, 0.014, 8, v === 'wood' ? P.iron : P.bronze, { rx: PI / 2, z: 0.058 });
    gt.ico(0.05, 0, v === 'wood' ? P.iron : P.bronzeLight, { z: 0.072, sz: 0.7 });
  };
  // khiên tròn khuyết (pelta): trăng lưỡi liềm, mép trên khoét vào
  Sh.pelta = function (gm, gt, team) {
    var sh = new T.Shape(), R = 0.22, r = 0.24, N = 18, i, a;
    for (i = 0; i <= N; i++) { a = 0.814 + i / N * (2 * PI - 1.628); if (i) sh.lineTo(Math.sin(a) * R, Math.cos(a) * R); else sh.moveTo(Math.sin(a) * R, Math.cos(a) * R); }
    for (i = 0; i <= N; i++) { a = -0.73 + i / N * 1.46; sh.lineTo(Math.sin(a) * r, 0.33 - Math.cos(a) * r); }   // vòng khoét sâu: đáy ở y≈0,09
    gm.add(new T.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: false }), teamCol(team), { z: 0.03 });
    gt.cyl(0.055, 0.055, 0.014, 8, P.bronze, { rx: PI / 2, y: -0.04, z: 0.06 });
    gt.ico(0.04, 0, P.bronzeLight, { y: -0.04, z: 0.07, sz: 0.7 });
    gm.box(0.3, 0.014, 0.006, teamCol(team, 'trim'), { y: -0.04, z: 0.058 });
  };
  Sh.hoplon = function (gm, gt, team) {
    gt.cyl(0.25, 0.44, 0.07, 12, P.bronze, { rx: PI / 2, z: 0.05 });
    gm.cyl(0.24, 0.24, 0.02, 10, teamCol(team), { rx: PI / 2, z: 0.092 });
    gt.ico(0.07, 0, P.bronzeLight, { z: 0.11, sz: 0.5 });
  };
  function scutum(gm, gt, team, h, banded) {
    var c = teamCol(team), y = -0.14;
    gm.box(0.25, h, 0.028, c, { y: y, z: 0.06 });
    gm.box(0.2, h, 0.028, c, { x: 0.205, y: y, z: 0.018, ry: -0.5 }); gm.box(0.2, h, 0.028, c, { x: -0.205, y: y, z: 0.018, ry: 0.5 });
    gt.box(0.62, 0.03, 0.05, P.bronzeDark, { y: y + h / 2, z: 0.04 }); gt.box(0.62, 0.03, 0.05, P.bronzeDark, { y: y - h / 2, z: 0.04 });
    gt.box(0.13, 0.2, 0.05, P.bronze, { y: y, z: 0.09 }); gt.ico(0.055, 0, P.bronzeLight, { y: y, z: 0.12 });
    gm.box(0.2, 0.012, 0.01, teamCol(team, 'trim'), { y: y + 0.25, z: 0.078, rz: 0.5 }); gm.box(0.2, 0.012, 0.01, teamCol(team, 'trim'), { y: y + 0.25, z: 0.078, rz: -0.5 });
    gm.box(0.2, 0.012, 0.01, teamCol(team, 'trim'), { y: y - 0.25, z: 0.078, rz: 0.5 }); gm.box(0.2, 0.012, 0.01, teamCol(team, 'trim'), { y: y - 0.25, z: 0.078, rz: -0.5 });
    if (banded) for (var i = -1; i <= 1; i++) gt.box(0.27, 0.035, 0.012, P.iron, { y: y + i * 0.36, z: 0.082 });
  }
  Sh.scutum = function (gm, gt, team) { scutum(gm, gt, team, 1.02, false); };
  Sh.tower = function (gm, gt, team) { scutum(gm, gt, team, 1.16, true); };

  // ---------------------------------------------------------------- Mũ (hệ đầu: tâm sọ ở y=0.115·S)
  var He = {};
  function dome(g, r, col, y, sy) { g.add(new T.SphereGeometry(r, 8, 4, 0, PI * 2, 0, PI / 2), col, { y: y, sy: sy || 1 }); }
  He.cap = function (k, D) { var g = k.g('head'), s = D.S; dome(g, 0.112 * s, P.leather, 0.12 * s, 0.95); g.box(0.02, 0.07 * s, 0.06, P.leatherDark, { x: 0.1 * s, y: 0.085 * s }); g.box(0.02, 0.07 * s, 0.06, P.leatherDark, { x: -0.1 * s, y: 0.085 * s }); };
  He.legion = function (k, D) {
    var g = k.g('head', 'metal'), s = D.S;
    dome(g, 0.114 * s, P.iron, 0.12 * s); g.box(0.2 * s, 0.022, 0.03, P.ironDark, { y: 0.135 * s, z: 0.1 * s });
    g.box(0.21 * s, 0.018, 0.1 * s, P.iron, { y: 0.07 * s, z: -0.125 * s, rx: 0.5 });
    g.box(0.016, 0.1 * s, 0.065 * s, P.iron, { x: 0.1 * s, y: 0.065 * s, z: 0.045 * s }); g.box(0.016, 0.1 * s, 0.065 * s, P.iron, { x: -0.1 * s, y: 0.065 * s, z: 0.045 * s });
  };
  He.galea = function (k, D, team) {
    var g = k.g('head', 'metal'), s = D.S;
    dome(g, 0.113 * s, P.bronze, 0.12 * s); g.cyl(0.15 * s, 0.15 * s, 0.012, 10, P.bronzeDark, { y: 0.125 * s });
    g.box(0.016, 0.1 * s, 0.06 * s, P.bronze, { x: 0.1 * s, y: 0.065 * s, z: 0.04 * s }); g.box(0.016, 0.1 * s, 0.06 * s, P.bronze, { x: -0.1 * s, y: 0.065 * s, z: 0.04 * s });
    var m = k.g('head'); m.box(0.035, 0.085 * s, 0.26 * s, teamCol(team), { y: 0.275 * s, z: -0.01 }); m.box(0.035, 0.05 * s, 0.1 * s, teamCol(team), { y: 0.2 * s, z: -0.15 * s, rx: -0.9 });
  };
  He.secutor = function (k, D) {
    var g = k.g('head', 'metal'), s = D.S;
    g.add(new T.SphereGeometry(0.12 * s, 8, 6), 0x8a8e91, { y: 0.112 * s, sy: 1.14 }); g.box(0.15 * s, 0.014, 0.03, P.ironDark, { y: 0.15 * s, z: 0.105 * s });
    g.box(0.014, 0.05 * s, 0.22 * s, P.iron, { y: 0.255 * s }); g.cyl(0.14 * s, 0.15 * s, 0.03, 8, P.iron, { y: -0.01 });
    var m = k.g('head'); m.cyl(0.013, 0.013, 0.02, 5, P.black, { x: 0.04 * s, y: 0.125 * s, z: 0.113 * s, rx: PI / 2 }); m.cyl(0.013, 0.013, 0.02, 5, P.black, { x: -0.04 * s, y: 0.125 * s, z: 0.113 * s, rx: PI / 2 });
  };
  He.murmillo = function (k, D, team) {
    var g = k.g('head', 'metal'), s = D.S;
    dome(g, 0.116 * s, P.bronze, 0.12 * s); g.cyl(0.185 * s, 0.185 * s, 0.014, 10, P.bronzeDark, { y: 0.135 * s });
    g.box(0.16 * s, 0.13 * s, 0.02, P.bronzeDark, { y: 0.065 * s, z: 0.108 * s }); g.box(0.016, 0.13 * s, 0.12 * s, P.bronze, { x: 0.105 * s, y: 0.065 * s, z: 0.04 * s }); g.box(0.016, 0.13 * s, 0.12 * s, P.bronze, { x: -0.105 * s, y: 0.065 * s, z: 0.04 * s });
    g.box(0.02, 0.13 * s, 0.2 * s, P.bronzeLight, { y: 0.29 * s, z: -0.01 });
    k.g('head').box(0.03, 0.04 * s, 0.22 * s, teamCol(team), { y: 0.37 * s, z: -0.01 });
  };
  He.thraex = function (k, D, team) {
    var g = k.g('head', 'metal'), s = D.S;
    dome(g, 0.116 * s, P.bronzeLight, 0.12 * s); g.cyl(0.175 * s, 0.175 * s, 0.014, 10, P.bronze, { y: 0.135 * s });
    g.box(0.16 * s, 0.12 * s, 0.02, P.bronze, { y: 0.07 * s, z: 0.108 * s });
    g.box(0.022, 0.15 * s, 0.07 * s, P.bronzeLight, { y: 0.3 * s, z: -0.01 }); g.box(0.022, 0.05 * s, 0.1 * s, P.bronzeLight, { y: 0.37 * s, z: 0.04 * s });
    var m = k.g('head'); m.box(0.04, 0.14 * s, 0.05, teamCol(team), { y: 0.33 * s, z: -0.08 * s, rx: -0.4 }); m.box(0.02, 0.1 * s, 0.03, P.white, { x: 0.13 * s, y: 0.23 * s, rz: -0.3 }); m.box(0.02, 0.1 * s, 0.03, P.white, { x: -0.13 * s, y: 0.23 * s, rz: 0.3 });
  };

  // ---------------------------------------------------------------- Giáp thân (hệ ngực: gốc ở eo)
  // áo giáp = vỏ thân người nới rộng thêm pad, cắt giữa hai độ cao y0..y1 (theo tỉ lệ thân)
  function hull(g, D, col, pad, y0, y1) {
    var R = V.torsoFor(D), a = y0 * D.S, b = y1 * D.S, out = [], i, e = 0.012;
    function at(y) {
      for (var q = 0; q < R.length - 1; q++) if (y <= R[q + 1][0]) { var u = V.clamp((y - R[q][0]) / (R[q + 1][0] - R[q][0]), 0, 1), r0 = R[q], r1 = R[q + 1]; return [y, r0[1] + (r1[1] - r0[1]) * u, r0[2] + (r1[2] - r0[2]) * u, 0, r0[4] + (r1[4] - r0[4]) * u]; }
      var l = R[R.length - 1]; return [y, l[1], l[2], 0, l[4]];
    }
    out.push(at(a)); for (i = 0; i < R.length; i++) if (R[i][0] > a + 0.01 && R[i][0] < b - 0.01) out.push(R[i].slice()); out.push(at(b));
    for (i = 0; i < out.length; i++) { out[i][1] = out[i][1] * (1 + pad) + e; out[i][2] = out[i][2] * (1 + pad) + e; }
    g.loft(out, 8, col, null, 2);
  }
  function skirt(g, D, col, pad, len) { var w = D.W * (1 + pad); g.cyl(0.15 * w, 0.175 * w, len * D.S, 6, col, { y: (0.06 - len / 2) * D.S, sz: 0.74 }, true); }
  function pteruges(g, D, col, len) {
    for (var i = 0; i < 10; i++) { var a = i / 10 * PI * 2, r = 0.165 * D.W; g.box(0.07 * D.W, len * D.S, 0.012, col, { x: Math.sin(a) * r, y: (0.03 - len / 2) * D.S, z: Math.cos(a) * r * 0.74, ry: a }); }
  }
  function yoke(g, D, col, h) { for (var s = -1; s <= 1; s += 2) g.box(0.11 * D.W, h, 0.2 * D.W, col, { x: s * 0.15 * D.W, y: 0.365 * D.S, rz: -s * 0.18 }); }
  var Bo = {};
  // Cầu vai của giáp nhẹ: n lớp vòm chồng nhau ôm mặt ngoài vai (dựng trên khúc tay trên, nên theo tay khi vung)
  function pauldron(k, D, cols, trim, n) {
    var W = D.W;
    for (var sd = 0; sd < 2; sd++) {
      var g = k.g('armU' + sd, 'matteDouble'), mid = sd === 0 ? PI / 2 : -PI / 2, span = 2.7;   // trục X của khúc tay trên hướng vào trong người, nên mặt ngoài là +X (tay phải) / −X (tay trái)
      for (var i = 0; i < n; i++) {
        var r = (0.082 + 0.006 * (n - i)) * W, h = 0.06 * D.S, y = 0.01 - i * 0.042 * D.S;
        g.add(new T.CylinderGeometry(r * 0.92, r * 1.08, h, 7, 1, true, mid - span / 2, span), cols[i % cols.length], { y: y });
        if (trim) g.add(new T.CylinderGeometry(r * 1.09, r * 1.1, 0.012, 7, 1, true, mid - span / 2, span), trim, { y: y - h / 2 });
      }
      g.add(new T.SphereGeometry(0.085 * W, 7, 3, mid - span / 2, span, 0, PI / 2), cols[0], { y: 0.03, sy: 0.55 });   // nắp vai
    }
  }
  Bo.harness = function (k, D) {
    var g = k.g('chest'), s = D.S, w = D.W;
    for (var z = -1; z <= 1; z += 2) { g.box(0.045, 0.46 * s, 0.014, P.leather, { y: 0.21 * s, z: z * 0.128 * w, rz: 0.62 }); g.box(0.045, 0.46 * s, 0.014, P.leather, { y: 0.21 * s, z: z * 0.128 * w, rz: -0.62 }); }
    k.g('chest', 'metal').cyl(0.035, 0.035, 0.014, 6, P.bronze, { y: 0.22 * s, z: 0.14 * w, rx: PI / 2 });
    pauldron(k, D, [P.leather, P.leatherDark], null, 2);
  };
  Bo.leather = function (k, D) { var g = k.g('chest'); hull(g, D, P.leather, 0.1, 0.0, 0.36); yoke(g, D, P.leatherDark, 0.03); g.box(0.3 * D.W, 0.03, 0.22 * D.W, P.leatherDark, { y: 0.02 }); pauldron(k, D, [P.leather, P.leatherDark], P.bronzeDark, 3); };
  Bo.linen = function (k, D) { var g = k.g('chest'); hull(g, D, P.linen, 0.1, 0.0, 0.36); yoke(g, D, P.clothWhite, 0.035); g.box(0.31 * D.W, 0.035, 0.22 * D.W, P.clothOchre, { y: 0.03 }); pteruges(k.g('hips'), D, P.linen, 0.2); pauldron(k, D, [P.linen, P.clothWhite], P.clothOchre, 3); };
  Bo.hamata = function (k, D) {
    var g = k.g('chest', 'metal'); g.fj = 0.16; hull(g, D, 0x7f8183, 0.11, 0.0, 0.36); yoke(g, D, 0x6e7073, 0.035);
    var h = k.g('hips', 'metal'); h.fj = 0.16; skirt(h, D, 0x7f8183, 0.1, 0.2);
    k.g('chest').box(0.31 * D.W, 0.04, 0.23 * D.W, P.leatherDark, { y: 0.03 });
  };
  Bo.squamata = function (k, D) {
    var g = k.g('chest', 'metal'); g.fj = 0.22; hull(g, D, P.bronze, 0.12, 0.0, 0.36); yoke(g, D, P.bronzeDark, 0.035);
    var h = k.g('hips', 'metal'); h.fj = 0.22; skirt(h, D, P.bronze, 0.11, 0.17);
  };
  Bo.segment = function (k, D) {
    var g = k.g('chest', 'metal'), s = D.S, w = D.W * 1.14;
    // sáu đai thép ôm theo đúng dáng thân (kể cả bụng to của người vạm vỡ), đai trên dưới so le cho ra nếp chồng
    for (var i = 0; i < 6; i++) hull(g, D, i % 2 ? P.steel : 0x979b9e, i % 2 ? 0.1 : 0.135, i * 0.058 - 0.008, i * 0.058 + 0.066);
    for (var sd = -1; sd <= 1; sd += 2) for (var j = 0; j < 3; j++) g.box(0.13 * D.W, 0.02, (0.22 - j * 0.03) * D.W, P.steel, { x: sd * (0.15 + j * 0.035) * D.W, y: (0.385 - j * 0.03) * s, rz: -sd * (0.15 + j * 0.3) });
    pteruges(k.g('hips'), D, P.leather, 0.16);
  };
  Bo.muscle = function (k, D) {
    var g = k.g('chest', 'metal'), s = D.S, w = D.W;
    hull(g, D, P.bronzeLight, 0.1, 0.0, 0.37); yoke(g, D, P.bronze, 0.03);
    for (var sd = -1; sd <= 1; sd += 2) { g.box(0.15 * w, 0.1 * s, 0.04, P.bronzeLight, { x: sd * 0.085 * w, y: 0.285 * s, z: 0.12 * w, rx: -0.2 }); for (var j = 0; j < 2; j++) g.box(0.085 * w, 0.055 * s, 0.03, P.bronze, { x: sd * 0.05 * w, y: (0.1 + j * 0.065) * s, z: 0.108 * w }); }
    pteruges(k.g('hips'), D, P.leatherDark, 0.2);
  };

  // ---------------------------------------------------------------- Giáp tay (tay cầm vũ khí = bên 0)
  function hoops(g, r0, r1, len, n, col, pad, y0) { for (var i = 0; i < n; i++) { var t = (i + 0.5) / n, r = (r0 + (r1 - r0) * t) * (1 + pad); g.cyl(r, r * 0.94, len / n * 1.02, 6, col, { y: -(y0 || 0) - t * len }); } }
  var Ar = {};
  Ar.wrap = function (k, D) { hoops(k.g('armL0'), 0.046 * D.W, 0.039 * D.W, D.fore * 0.6, 3, P.clothWhite, 0.14, D.fore * 0.25); };
  Ar.manica = function (k, D) { hoops(k.g('armU0'), 0.059 * D.W, 0.048 * D.W, D.upper * 0.85, 3, P.leather, 0.2, 0.03); hoops(k.g('armL0'), 0.049 * D.W, 0.038 * D.W, D.fore * 0.8, 3, P.leatherDark, 0.2, 0.02); };
  function metalArm(k, D, col, col2) {
    hoops(k.g('armU0', 'metal'), 0.059 * D.W, 0.048 * D.W, D.upper * 0.85, 4, col, 0.24, 0.03); hoops(k.g('armL0', 'metal'), 0.049 * D.W, 0.038 * D.W, D.fore * 0.8, 4, col2, 0.24, 0.02);
    k.g('armU0', 'metal').ico(0.085 * D.W, 0, col2, { y: 0.01, sy: 0.8 });
  }
  Ar.scale = function (k, D) { metalArm(k, D, P.bronze, P.bronzeDark); };
  Ar.plate = function (k, D) { metalArm(k, D, P.steel, P.iron); };
  Ar.galerus = function (k, D) {
    var g = k.g('chest', 'metal'), w = D.W, s = D.S;
    g.box(0.014, 0.17 * s, 0.13 * w, P.bronze, { x: 0.262 * w, y: 0.43 * s, rz: -0.3 }); g.box(0.014, 0.15 * s, 0.09 * w, P.bronzeLight, { x: 0.247 * w, y: 0.42 * s, z: 0.1 * w, rz: -0.3, ry: -0.6 }); g.box(0.014, 0.15 * s, 0.09 * w, P.bronzeLight, { x: 0.247 * w, y: 0.42 * s, z: -0.1 * w, rz: -0.3, ry: 0.6 });
    g.box(0.1 * w, 0.016, 0.22 * w, P.bronzeDark, { x: 0.212 * w, y: 0.345 * s }); g.box(0.03, 0.012, 0.24 * w, P.bronzeDark, { x: 0.29 * w, y: 0.515 * s });
    hoops(k.g('armU1'), 0.059 * D.W, 0.048 * D.W, D.upper * 0.85, 3, P.leather, 0.2, 0.03);
  };

  // ---------------------------------------------------------------- Chân
  var Le = {};
  function eachLeg(f) { for (var s = 0; s < 2; s++) f(s); }
  function sole(k, D, col) { eachLeg(function (s) { k.g('foot' + s).box(0.095 * D.W, 0.016, 0.26 * D.S, col, { y: -0.062 * D.S, z: 0.07 * D.S }); }); }
  Le.sandal = function (k, D, team, L) {
    var v = L && L.v;
    sole(k, D, P.leatherDark);
    eachLeg(function (s) {
      var g = k.g('foot' + s), lg = k.g('legL' + s), ya = -D.shin + 0.05, w = D.W;
      g.box(0.1 * w, 0.012, 0.02, P.leather, { y: -0.004, z: 0.1 * D.S }); g.box(0.1 * w, 0.012, 0.02, P.leather, { y: -0.01, z: 0.03 * D.S });
      lg.cyl(0.05 * w, 0.05 * w, 0.016, 6, P.leather, { y: ya });
      if (v === 'run') {   // giày người đưa thư: dây buộc chéo lên nửa ống chân, gót có đệm
        hoops(lg, 0.05 * w, 0.054 * w, D.shin * 0.3, 3, P.leather, 0.1, D.shin * 0.62);
        g.box(0.09 * w, 0.05 * D.S, 0.05 * D.S, P.leather, { y: -0.03 * D.S, z: -0.045 * D.S });
      }
      if (v === 'wing') {  // dép Mercurius: hai cánh nhỏ ở mắt cá, vuốt ra sau
        for (var sd = -1; sd <= 1; sd += 2) {
          var x0 = sd * 0.05 * w, x1 = sd * 0.085 * w, x2 = sd * 0.11 * w;
          var F = [[[x0, ya - 0.012, 0.01], [x0, ya + 0.03, -0.005], [x1, ya + 0.02, -0.11]],
                   [[x0, ya + 0.012, 0.005], [x0, ya + 0.05, -0.01], [x2, ya + 0.075, -0.13]],
                   [[x0, ya + 0.036, 0], [x0, ya + 0.068, -0.012], [x2, ya + 0.13, -0.1]]];
          for (var i = 0; i < 3; i++) { var c = i === 1 ? 0xf2ead8 : P.clothWhite; lg.tri(F[i][0], F[i][1], F[i][2], c); lg.tri(F[i][0], F[i][2], F[i][1], c); }
        }
      }
    });
  };
  Le.wraps = function (k, D) { eachLeg(function (s) { hoops(k.g('legL' + s), 0.061 * D.W, 0.046 * D.W, D.shin * 0.72, 4, P.clothWhite, 0.1, D.shin * 0.22); }); };
  Le.caliga = function (k, D) { sole(k, D, 0x2e241a); eachLeg(function (s) { k.g('foot' + s).box(0.094 * D.W, 0.07 * D.S, 0.2 * D.S, P.leather, { y: -0.03 * D.S, z: 0.05 * D.S }); hoops(k.g('legL' + s), 0.052 * D.W, 0.047 * D.W, D.shin * 0.3, 3, P.leather, 0.14, D.shin * 0.68); }); };
  function greave(k, D, col, top, both) {
    eachLeg(function (s) {
      if (!both && s === 0) return;
      var g = k.g('legL' + s, 'metal'), h = D.shin * (1 - top) * 0.95;
      g.add(new T.CylinderGeometry(0.075 * D.W, 0.056 * D.W, h, 6, 1, true, -1.25, 2.5), col, { y: -D.shin * top - h / 2 });
      g.ico(0.056 * D.W, 0, col, { y: -0.01, z: 0.04 * D.W, sz: 0.6 });
    });
  }
  Le.ocrea = function (k, D) { greave(k, D, P.bronze, 0.08, true); sole(k, D, P.leatherDark); };
  Le.ocrea2 = function (k, D) {
    greave(k, D, P.bronzeLight, 0.04, true); sole(k, D, P.leatherDark);
    eachLeg(function (s) { k.g('legU' + s, 'metal').add(new T.CylinderGeometry(0.098 * D.W, 0.08 * D.W, D.thigh * 0.5, 6, 1, true, -1.2, 2.4), P.bronze, { y: -D.thigh * 0.68 }); });
  };

  // ---------------------------------------------------------------- Phụ kiện
  var Tr = {};
  Tr.belt = function (k, D) { k.g('hips').box(0.33 * D.W, 0.075 * D.S, 0.225 * D.W, P.leatherDark, { y: 0.085 * D.S }); var g = k.g('hips', 'metal'); for (var i = -1; i <= 1; i++) g.box(0.05, 0.05, 0.01, P.bronze, { x: i * 0.08, y: 0.085 * D.S, z: 0.116 * D.W }); };
  Tr.pouch = function (k, D) { k.g('hips').box(0.07, 0.085, 0.05, P.leather, { x: -0.16 * D.W, y: 0.02, z: 0.03 }); };
  Tr.flask = function (k, D) { var g = k.g('hips'); g.ico(0.05, 0, 0x7a3b22, { x: -0.17 * D.W, y: 0.0, z: -0.02, sy: 1.2 }); g.cyl(0.015, 0.02, 0.04, 5, P.wood, { x: -0.17 * D.W, y: 0.07, z: -0.02 }); };
  Tr.laurel = function (k, D) { k.g('head').torus(0.108 * D.S, 0.014, 4, 10, P.leaf, { y: 0.165 * D.S, rx: PI / 2 }); };
  Tr.oil = function () { };

  // Vẽ toàn bộ trang bị của một đấu sĩ vào kit. opts: {team, helmetOnly...}
  // ---------------------------------------------------------------- Biến thể: bọc các hàm gốc
  var _legion = He.legion; He.legion = function (k, D, team, L) {
    _legion(k, D, team);
    if (L && L.v === 'horns') { var g = k.g('head'), s = D.S; g.cone(0.024 * s, 0.15 * s, 5, 0xd8cdb4, { x: 0.115 * s, y: 0.215 * s, rz: -0.95 }); g.cone(0.024 * s, 0.15 * s, 5, 0xd8cdb4, { x: -0.115 * s, y: 0.215 * s, rz: 0.95 }); }
  };
  var _galea = He.galea; He.galea = function (k, D, team, L) {
    if (!(L && L.v === 'nocrest')) return _galea(k, D, team);
    var g = k.g('head', 'metal'), s = D.S;
    dome(g, 0.113 * s, P.bronze, 0.12 * s); g.cyl(0.175 * s, 0.185 * s, 0.014, 10, P.bronzeDark, { y: 0.118 * s });
    g.box(0.016, 0.08 * s, 0.05 * s, P.bronze, { x: 0.1 * s, y: 0.075 * s, z: 0.04 * s }); g.box(0.016, 0.08 * s, 0.05 * s, P.bronze, { x: -0.1 * s, y: 0.075 * s, z: 0.04 * s });
  };
  var _harness = Bo.harness; Bo.harness = function (k, D, team, L) {
    _harness(k, D, team);
    if (L && L.v === 'disc') { var g = k.g('chest', 'metal'); g.cyl(0.085 * D.W, 0.085 * D.W, 0.016, 9, P.bronze, { y: 0.24 * D.S, z: 0.142 * D.W, rx: PI / 2 }); g.cyl(0.075 * D.W, 0.075 * D.W, 0.016, 9, P.bronzeDark, { y: 0.24 * D.S, z: -0.132 * D.W, rx: PI / 2 }); g.ico(0.03, 0, P.bronzeLight, { y: 0.24 * D.S, z: 0.155 * D.W, sz: 0.5 }); }
  };
  var _scale = Ar.scale; Ar.scale = function (k, D, team, L) {
    if (L && L.v === 'fore') { hoops(k.g('armL0', 'metal'), 0.049 * D.W, 0.038 * D.W, D.fore * 0.75, 3, P.bronze, 0.26, 0.03); return; }
    _scale(k, D, team);
  };
  var _plate = Ar.plate; Ar.plate = function (k, D, team, L) {
    _plate(k, D, team);
    if (L && L.v === 'spikes') { var g = k.g('armL0', 'metal'), u = k.g('armU0', 'metal'); for (var i = 0; i < 3; i++) { g.cone(0.014, 0.06, 4, P.steel, { x: -0.06 * D.W, y: -0.05 - i * 0.07, rz: 1.57 }); u.cone(0.014, 0.06, 4, P.steel, { x: -0.07 * D.W, y: -0.06 - i * 0.07, rz: 1.57 }); } }
  };
  var _ocrea = Le.ocrea; Le.ocrea = function (k, D, team, L) {
    if (L && L.v === 'single') { greave(k, D, P.bronze, 0.08, false); sole(k, D, P.leatherDark); return; }
    _ocrea(k, D, team);
  };
  var _parma = Sh.parma; Sh.parma = function (gm, gt, team, L) {
    var v = L && L.v; if (!v) return _parma(gm, gt, team);
    var sx = v === 'oval' ? 1.0 : (v === 'pelta' ? 1.14 : 0.94), sy = v === 'oval' ? 1.5 : (v === 'pelta' ? 0.72 : 0.94);
    gm.cyl(0.31, 0.31, 0.03, 10, v === 'hide' ? 0x8a6f52 : teamCol(team), { rx: PI / 2, z: 0.04, sx: sx, sz: sy });
    if (v === 'hide') { gm.box(0.34 * sx, 0.07, 0.012, teamCol(team), { z: 0.062 }); gm.cyl(0.05, 0.05, 0.02, 6, 0x5d4a38, { rx: PI / 2, z: 0.062 }); }
    else { gt.cyl(0.07, 0.07, 0.03, 8, P.bronze, { rx: PI / 2, z: 0.065 }); gm.box(0.02, 0.56 * sy, 0.012, teamCol(team, 'trim'), { z: 0.06 }); }
    if (v === 'pelta') gm.cyl(0.13, 0.13, 0.05, 8, 0x1c1814, { rx: PI / 2, y: 0.25, z: 0.03 });
  };

  // ---------------------------------------------------------------- Độ hiếm: càng hiếm càng nhiều chi tiết
  var TRIM = [0, P.bronze, 0xc4c8cc, 0xdcb040, 0xf4d264, 0xf4d264, 0xffe08a], GEMS = [0xa01c2c, 0x1f7a4e, 0x2a52a8, 0x6e2c92], PURPLE = 0x5c2a66, CRIMSON = 0x8e2626, CORD = 0x7a2a22;
  function adorn(k, slot, it, D, r) {
    if (!r) return;
    var tc = TRIM[r], s = D.S, w = D.W, gem = GEMS[G.hashStr(it.id) % 4], i, gt, gm, sd;
    if (slot === 'weapon') {
      var kind = it.kind;
      if (kind === 'caestus') { for (i = 0; i < 2; i++) { gt = k.g('hand' + i, 'metal'); gt.box(0.09 * w, 0.02, 0.1 * w, tc, { y: 0.052 * s }); if (r >= 3) gt.ico(0.014, 0, gem, { y: 0.075 * s, z: 0.02 }); if (r >= 4) gt.box(0.092 * w, 0.02, 0.102 * w, tc, { y: -0.03 * s }); } return; }
      var shaft = kind === 'mace' || kind === 'hasta' || kind === 'trident' || kind === 'axe' || kind === 'javelin';
      var top = { mace: 0.5, hasta: 0.93, trident: 1.2, axe: 0.58, javelin: 0.44 }[kind], len = (V.WEAPON_TIP[kind] || 0.6) + ((it.look && it.look.dl) || 0);
      (kind === 'twin' ? ['wR', 'wL'] : ['wR']).forEach(function (nn) {
        var gm = k.g(nn), gt = k.g(nn, 'metal');
        if (shaft) {
          gt.cyl(0.025, 0.025, 0.02, 6, tc, { y: 0.1 }); gt.cyl(0.025, 0.025, 0.02, 6, tc, { y: -0.1 });
          if (r >= 2) gm.cyl(0.022, 0.022, 0.16, 6, CORD, {});
          if (r >= 3) { gt.cyl(0.027, 0.027, 0.03, 6, tc, { y: top }); gt.ico(0.018, 0, gem, { y: top - 0.05, z: 0.024 }); }
          if (r >= 4) { gm.box(0.012, 0.2, 0.035, PURPLE, { y: top - 0.15, z: 0.032, rx: 0.25 }); gm.box(0.012, 0.16, 0.03, PURPLE, { y: top - 0.13, z: -0.032, rx: -0.3 }); gt.cyl(0.028, 0.028, 0.03, 6, tc, { y: top - 0.22 }); }
        } else {
          gt.cyl(0.023, 0.023, 0.016, 6, tc, { y: 0.05 });
          if (r >= 2) { gm.cyl(0.021, 0.021, 0.028, 6, CORD, { y: -0.022 }); gm.cyl(0.021, 0.021, 0.028, 6, CORD, { y: 0.02 }); }
          if (r >= 3) { gt.box(0.034, 0.016, 0.14, tc, { y: 0.066 }); gt.ico(0.021, 0, gem, { y: -0.092 }); }
          if (r >= 4) { gt.box(0.015, len * 0.5, 0.014, tc, { y: 0.1 + len * 0.27 }); gm.box(0.014, 0.13, 0.03, PURPLE, { y: -0.17, rz: 0.25 }); }
        }
      });
    } else if (slot === 'shield') {
      var m = it.look.m, small = m === 'buckler' || m === 'pelta', round = m === 'parma' || m === 'hoplon' || small, oval = it.look.v === 'oval', R0 = m === 'hoplon' ? 0.42 : (small ? 0.19 : 0.29), zf = m === 'hoplon' ? 0.11 : (m === 'scutum' || m === 'tower' ? 0.1 : 0.07), cy = (m === 'scutum' || m === 'tower') ? -0.14 : (m === 'plank' ? -0.05 : 0), hh = m === 'tower' ? 0.5 : (m === 'plank' ? 0.33 : 0.44);
      gt = k.g('shield', 'metal'); gm = k.g('shield');
      for (i = 0; i < (round ? 6 : 4); i++) {
        var a = i / 6 * PI * 2;
        if (m === 'pelta' && Math.cos(a) > 0.5) continue;   // khiên khuyết: không đóng đinh vào chỗ khoét
        if (round) gt.ico(0.018, 0, tc, { x: Math.sin(a) * R0 * 0.82, y: Math.cos(a) * R0 * 0.82 * (oval ? 1.5 : 1), z: zf - 0.02 });
        else gt.ico(0.02, 0, tc, { x: (i % 2 ? 1 : -1) * 0.2, y: cy + (i < 2 ? 1 : -1) * hh, z: zf - 0.03 });
      }
      if (r >= 2) { var xl = small ? 0.2 : 0.3; gm.box(xl, 0.016, 0.008, TRIM[Math.max(2, r)], { y: cy, z: zf, rz: 0.78 }); gm.box(xl, 0.016, 0.008, TRIM[Math.max(2, r)], { y: cy, z: zf, rz: -0.78 }); }
      if (r >= 3) { gt.ico(0.07, 1, tc, { y: cy, z: zf + 0.03, sz: 0.55 }); gt.torus(0.11, 0.012, 4, 10, tc, { y: cy, z: zf + 0.012 }); }
      if (r >= 4) {
        if (!small) { gt.box(0.24, 0.045, 0.012, tc, { x: 0.13, y: cy + 0.17, z: zf + 0.012, rz: 0.45 }); gt.box(0.24, 0.045, 0.012, tc, { x: -0.13, y: cy + 0.17, z: zf + 0.012, rz: -0.45 }); gt.box(0.05, 0.13, 0.014, tc, { y: cy + 0.14, z: zf + 0.014 }); }
        if (round) { if (m !== 'pelta') gt.torus(R0 * (m === 'hoplon' ? 1.03 : 1.06), 0.018, 4, 12, tc, { z: zf - 0.04, sy: oval ? 1.5 : 1 }); } else { gt.box(0.03, hh * 2 + 0.1, 0.04, tc, { x: 0.29, y: cy, z: 0.0 }); gt.box(0.03, hh * 2 + 0.1, 0.04, tc, { x: -0.29, y: cy, z: 0.0 }); }
      }
    } else if (slot === 'head') {
      var hm = it.look.m, crest = (hm === 'galea' && it.look.v !== 'nocrest') || hm === 'murmillo' || hm === 'thraex' || hm === 'secutor';
      gt = k.g('head', 'metal'); gm = k.g('head');
      gt.torus(0.119 * s, 0.009, 4, 10, tc, { y: 0.128 * s, rx: PI / 2 });
      if (r >= 2) { if (crest) for (sd = -1; sd <= 1; sd += 2) gm.box(0.016, 0.09 * s, 0.03, 0xd8cdb4, { x: sd * 0.128 * s, y: 0.225 * s, rz: -sd * 0.35 }); else gm.box(0.03, 0.09 * s, 0.07 * s, r >= 3 ? CRIMSON : 0xd8cdb4, { y: 0.275 * s, z: -0.01 }); }
      if (r >= 3) { for (sd = -1; sd <= 1; sd += 2) gt.ico(0.014, 0, tc, { x: sd * 0.108 * s, y: 0.075 * s, z: 0.055 * s }); if (!crest) gm.box(0.034, 0.08 * s, 0.1 * s, r >= 4 ? PURPLE : CRIMSON, { y: 0.345 * s, z: -0.03 * s, rx: -0.3 }); }
      if (r >= 4) { for (i = 0; i < 7; i++) { var la = (i - 3) * 0.42; gt.cone(0.016, 0.06, 4, tc, { x: Math.sin(la) * 0.122 * s, y: 0.165 * s, z: Math.cos(la) * 0.122 * s, rx: 0.35 * Math.cos(la), rz: -0.35 * Math.sin(la) }); } gt.ico(0.018, 0, gem, { y: 0.16 * s, z: 0.118 * s }); }
    } else if (slot === 'body') {
      gt = k.g('chest', 'metal');
      for (sd = -1; sd <= 1; sd += 2) gt.ico(0.022, 0, tc, { x: sd * 0.168 * w, y: 0.375 * s, z: 0.055 * w });
      if (r >= 2) gt.cyl(0.046, 0.046, 0.014, 8, tc, { y: 0.268 * s, z: 0.146 * w, rx: PI / 2 });
      if (r >= 3) { for (sd = -1; sd <= 1; sd += 2) gt.cyl(0.036, 0.036, 0.014, 8, tc, { x: sd * 0.06 * w, y: 0.165 * s, z: 0.134 * w, rx: PI / 2 }); gt.box(0.21 * w, 0.034, 0.014, tc, { y: 0.03 * s, z: 0.128 * w }); gt.ico(0.016, 0, gem, { y: 0.268 * s, z: 0.156 * w }); }
      if (r >= 4) {
        gt.torus(0.078 * w, 0.013, 4, 9, tc, { y: 0.398 * s, rx: PI / 2 });
        var cg = k.g('chest'); cg.box(0.37 * w, 0.56 * s, 0.018, PURPLE, { y: 0.1 * s, z: -0.158 * w, rx: 0.1 }); cg.box(0.36 * w, 0.05 * s, 0.05, PURPLE, { y: 0.375 * s, z: -0.11 * w });
      }
    } else if (slot === 'arms') {
      gt = k.g('armL0', 'metal'); gt.cyl(0.05 * w, 0.047 * w, 0.03, 6, tc, { y: -0.2 * s });
      if (r >= 2) gt.cyl(0.058 * w, 0.056 * w, 0.03, 6, tc, { y: -0.04 * s });
      if (r >= 3) k.g('armU0', 'metal').cyl(0.066 * w, 0.063 * w, 0.03, 6, tc, { y: -0.11 * s });
      if (r >= 4) { gt.ico(0.058 * w, 0, tc, { z: -0.01, sy: 0.8 }); gt.ico(0.014, 0, gem, { y: -0.2 * s, z: 0.05 * w }); }
    } else if (slot === 'legs') {
      for (i = 0; i < 2; i++) {
        gt = k.g('legL' + i, 'metal'); gt.cyl(0.05 * w, 0.047 * w, 0.028, 6, tc, { y: -0.37 * s });
        if (r >= 2) gt.cyl(0.036, 0.036, 0.014, 7, tc, { y: -0.015, z: 0.066 * w, rx: PI / 2 });
        if (r >= 3) gt.cyl(0.07 * w, 0.068 * w, 0.028, 6, tc, { y: -0.09 * s });
        if (r >= 4) gt.ico(0.02, 0, gem, { y: -0.015, z: 0.078 * w });
      }
    } else if (slot === 'trinket' && r >= 2) {
      k.g('hips', 'metal').ico(0.022, 0, r >= 3 ? gem : tc, { x: 0.1 * w, y: 0.085 * s, z: 0.118 * w });
    }
  }
  function rarOf(inst) { return inst ? (inst.r != null ? inst.r : (inst.rv || 0)) : 0; }
  // Ba kiểu dáng của mỗi độ hiếm: cùng chỉ số, khác hình. Áp lên các đỉnh vừa dựng cho một món (từ dấu mark).
  //  kiểu 1: thon dài, sắc ấm (đồng); kiểu 2: to bản, sắc lạnh (thép xanh, vải sẫm).
  var MODEL_TINT = [null, [1.22, 1.0, 0.74], [0.68, 0.8, 1.06]];
  function modelOf(inst) { return inst && inst.m ? inst.m : 0; }
  function styleModel(k, mark, slot, m) {
    if (!m) return;
    var tint = MODEL_TINT[m], sh = slot === 'weapon' ? (m === 1 ? [0.85, 1.12, 0.85] : [1.45, 0.92, 1.45]) : (slot === 'shield' ? (m === 1 ? [0.95, 1.1, 1.0] : [1.1, 0.94, 1.0]) : null);
    for (var key in k.m) {
      var geo = k.m[key], p = geo.p, c = geo.c, i0 = mark[key] || 0;
      for (var i = i0; i < p.length; i += 3) {
        if (sh) { p[i] *= sh[0]; p[i + 1] *= sh[1]; p[i + 2] *= sh[2]; }
        c[i] *= tint[0]; c[i + 1] *= tint[1]; c[i + 2] *= tint[2];
      }
    }
  }
  // chi tiết riêng của từng kiểu (dựng sau khi đổi dáng nên giữ nguyên cỡ)
  function modelBits(k, slot, m, r, D, it) {
    if (!m) return;
    var tc = TRIM[Math.max(1, r)] || P.bronze, S = D ? D.S : 1, W = D ? D.W : 1, i, a;
    if (slot === 'weapon') {
      var gt = k.g('wR', 'metal'), gm = k.g('wR');
      if (m === 1) { gt.box(0.2, 0.026, 0.034, tc, { y: 0.062 }); gt.cyl(0.022, 0.022, 0.014, 6, tc, { y: -0.015 }); gt.cyl(0.022, 0.022, 0.014, 6, tc, { y: 0.025 }); }
      else { gt.ico(0.04, 0, tc, { y: -0.085 }); gm.box(0.016, 0.12, 0.01, CRIMSON, { y: -0.15, z: 0.012 }); gm.box(0.016, 0.1, 0.01, CRIMSON, { y: -0.14, z: -0.012, rx: 0.2 }); }
    } else if (slot === 'shield') {
      var st = k.g('shield', 'metal');
      var sm = it && it.cls === 'small', rx = sm ? 0.15 : 0.24, ry = sm ? 0.15 : 0.3;
      if (m === 1) for (i = 0; i < 10; i++) { a = i / 10 * Math.PI * 2; if (it && it.look.m === 'pelta' && Math.sin(a) > 0.5) continue; st.ico(sm ? 0.014 : 0.02, 0, tc, { x: Math.cos(a) * rx, y: Math.sin(a) * ry, z: 0.065 }); }
      else { st.box(sm ? 0.3 : 0.5, 0.03, 0.02, tc, { y: sm ? 0.1 : 0.2, z: 0.065 }); st.box(sm ? 0.3 : 0.5, 0.03, 0.02, tc, { y: sm ? -0.1 : -0.2, z: 0.065 }); }
    } else if (slot === 'head') {
      var hm = k.g('head', 'metal');
      if (m === 1) hm.box(0.025, 0.06, 0.26 * S, tc, { y: 0.29 * S });                       // gờ mào kim loại
      else { hm.ico(0.022, 0, tc, { x: 0.1 * W, y: 0.08 * S, z: 0.06 * S }); hm.ico(0.022, 0, tc, { x: -0.1 * W, y: 0.08 * S, z: 0.06 * S }); }   // đinh má
    } else if (slot === 'body') {
      var bm = k.g('chest', 'metal');
      if (m === 1) bm.cyl(0.05, 0.05, 0.015, 8, tc, { y: 0.22 * S, z: 0.14 * W, rx: Math.PI / 2 });   // huy hiệu ngực
      else for (i = -1; i <= 1; i += 2) bm.ico(0.03, 0, tc, { x: 0.17 * W * i, y: 0.3 * S, z: 0.02 });   // đinh vai
    }
  }
  // dựng một món với bảng đổi màu riêng của nó (look.re)
  function withLook(it, fn) {
    var L = it.look || {};
    if (L.re) { V.remap = {}; for (var i = 0; i < L.re.length; i++) V.remap[L.re[i][0]] = L.re[i][1]; }
    try { fn(L); } finally { V.remap = null; }
  }

  // Mũ và giáp thân dựng to hơn thân người một chút để đầu và ngực không lòi ra ngoài.
  // Vì mũ/giáp dùng chung lưới với thân (cùng Kit), ta ghi lại số đỉnh trước khi dựng rồi chỉ phóng phần mới thêm.
  var FIT = 1.15;
  function markKit(k) { var m = {}; for (var key in k.m) m[key] = k.m[key].p.length; return m; }
  function growKit(k, mark, slot, D) {
    for (var key in k.m) {
      var geo = k.m[key], p = geo.p, i0 = mark[key] || 0, node = key.split('|')[0], sx = FIT, sy = FIT, sz = FIT, py = 0;
      if (p.length <= i0) continue;
      if (slot === 'head') { if (node !== 'head') continue; py = 0.115 * D.S; }                      // quanh tâm sọ
      else if (node === 'chest') py = 0.2 * D.S;                                                      // quanh giữa thân
      else if (node === 'hips') sy = 1;                                                               // váy giáp: chỉ rộng ra, không dài thêm
      else if (node !== 'armU0' && node !== 'armU1') continue;                                        // giáp vai: quanh khớp vai
      for (var i = i0; i < p.length; i += 3) { p[i] *= sx; p[i + 1] = py + (p[i + 1] - py) * sy; p[i + 2] *= sz; }
    }
  }

  V.Gear = {
    build: function (k, g, D, team) {
      var inst = g.gear.weapon, it = G.itemOf(inst), q;
      var kind = it ? it.kind : 'fist', K = G.WKIND[kind];
      if (it) {
        q = it.look.q || 0;
        var mk0 = markKit(k);
        if (kind === 'caestus') caestus(k, q, D, it.look);
        else {
          Wp[kind](k.g('wR'), k.g('wR', 'metal'), q, it.look);
          if (kind === 'twin') Wp.twin(k.g('wL'), k.g('wL', 'metal'), q, it.look);
        }
        styleModel(k, mk0, 'weapon', modelOf(inst)); modelBits(k, 'weapon', modelOf(inst), rarOf(inst), D);
        adorn(k, 'weapon', it, D, rarOf(inst));
      }
      inst = g.gear.shield; it = G.itemOf(inst);
      if (it && K.hands !== 2) { var mk1 = markKit(k); (function (it) { withLook(it, function (L) { Sh[it.look.m](k.g('shield'), k.g('shield', 'metal'), team, L); }); })(it); styleModel(k, mk1, 'shield', modelOf(inst)); modelBits(k, 'shield', modelOf(inst), rarOf(inst), D, it); adorn(k, 'shield', it, D, rarOf(inst)); }
      var TB = { head: He, body: Bo, arms: Ar, legs: Le, trinket: Tr };
      ['head', 'body', 'arms', 'legs', 'trinket'].forEach(function (sl) {
        var ins = g.gear[sl], item = G.itemOf(ins);
        if (!item || !TB[sl][item.look.m]) return;
        var mark = (sl === 'head' || sl === 'body') ? markKit(k) : null;
        var mk2 = markKit(k); withLook(item, function (L) { TB[sl][item.look.m](k, D, team, L); }); styleModel(k, mk2, sl, modelOf(ins)); modelBits(k, sl, modelOf(ins), rarOf(ins), D);
        adorn(k, sl, item, D, rarOf(ins));
        if (mark) growKit(k, mark, sl, D);
      });
      // phụ tùng theo vũ khí
      if (kind === 'trident') { var n = k.g('hips'); n.fj = 0.2; n.ico(0.11, 0, P.rope, { x: 0.19 * D.W, y: -0.02, z: -0.02, sy: 1.3, sx: 0.6 }); }
      if (kind === 'bow' || kind === 'crossbow') {
        var qv = k.g('chest'), ql = kind === 'bow' ? 0.5 : 0.3;
        qv.box(0.09, ql, 0.07, P.leather, { x: 0.07, y: 0.24 * D.S, z: -0.16 * D.W, rz: -0.3 }); qv.box(0.095, 0.04, 0.075, P.leatherDark, { x: 0.07 + ql * 0.14, y: 0.24 * D.S + ql * 0.46, z: -0.16 * D.W, rz: -0.3 });
        for (var qi = 0; qi < 3; qi++) { qv.cyl(0.006, 0.006, 0.2, 4, 0xd8cdb4, { x: 0.07 + ql * 0.2 + (qi - 1) * 0.022, y: 0.24 * D.S + ql * 0.64, z: -0.16 * D.W + (qi - 1) * 0.015, rz: -0.3 }); }
      }
      if (kind === 'javelin') {
        var b = k.g('chest'), bt = k.g('chest', 'metal');
        b.box(0.07, 0.3, 0.06, P.leather, { y: 0.24 * D.S, z: -0.15 * D.W, rz: 0.35 });
        for (var i = 0; i < 2; i++) { b.cyl(0.01, 0.01, 0.95, 4, WOODS[1], { x: 0.05 + i * 0.03, y: 0.42 * D.S, z: -0.16 * D.W - i * 0.02, rz: 0.35 }); bt.cone(0.014, 0.06, 4, P.iron, { x: -0.12 + i * 0.03, y: 0.42 * D.S + 0.47, z: -0.16 * D.W - i * 0.02, rz: 0.35 }); }
      }
    },
    // Hình trưng bày một món hàng cho cửa hàng
    display: function (item, team, rar, model) {
      var grp = new T.Group(), k = new Kit(), D = V.dims('bal', { h: 1, w: 1 }), nodes = {}, add = function (n, x, y, z) { var o = new T.Object3D(); o.position.set(x, y, z); grp.add(o); nodes[n] = o; };
      var stand = new V.Geo();
      if (item.slot === 'weapon') {
        add('wR', 0, 0, 0); add('wL', 0.12, 0, 0); add('hand0', -0.07, 0, 0); add('hand1', 0.07, 0, 0);
        var q = item.look.q || 0;
        if (item.kind === 'caestus') { caestus(k, q, D, item.look); }
        else { Wp[item.kind](k.g('wR'), k.g('wR', 'metal'), q, item.look); if (item.kind === 'twin') Wp.twin(k.g('wL'), k.g('wL', 'metal'), q, item.look); }
        var L = { hasta: 0.25, trident: 0.2, axe: 0.3, javelin: 0.5 }[item.kind];
        grp.userData.lift = L != null ? L : 0.0;
      } else if (item.slot === 'shield') { add('shield', 0, 0.45, 0); withLook(item, function (L) { Sh[item.look.m](k.g('shield'), k.g('shield', 'metal'), team, L); }); nodes.shield.rotation.x = -0.15; }
      else if (item.slot === 'head') { add('head', 0, 0.02, 0); withLook(item, function (L) { He[item.look.m](k, D, team, L); }); }
      else if (item.slot === 'body') { add('chest', 0, 0.3, 0); add('hips', 0, 0.2, 0); add('armU0', -D.shW, 0.3 + D.shY, 0); add('armU1', D.shW, 0.3 + D.shY, 0); nodes.armU0.rotation.y = nodes.armU1.rotation.y = PI; withLook(item, function (L) { Bo[item.look.m](k, D, team, L); }); }
      else if (item.slot === 'arms') { add('armU0', 0, 0.62, 0); add('armL0', 0, 0.33, 0); add('chest', -0.2, 0.2, 0); add('armU1', 0.12, 0.62, 0); withLook(item, function (L) { Ar[item.look.m](k, D, team, L); }); }
      else if (item.slot === 'legs') { for (var s = 0; s < 2; s++) { add('legL' + s, (s ? 0.1 : -0.1), 0.5, 0); add('legU' + s, (s ? 0.1 : -0.1), 0.9, 0); add('foot' + s, (s ? 0.1 : -0.1), 0.07, 0); } withLook(item, function (L) { Le[item.look.m](k, D, team, L); }); }
      else {
        add('hips', 0, 0.12, 0); add('head', 0, 0.0, 0);
        if (item.look.m === 'oil') { stand.cyl(0.05, 0.035, 0.16, 6, P.terracotta, { y: 0.1 }); stand.cyl(0.02, 0.03, 0.06, 6, P.terracotta, { y: 0.21 }); }
        else if (Tr[item.look.m]) Tr[item.look.m](k, D, team);
        if (item.look.m === 'pouch') nodes.hips.position.x = 0.16;
        if (item.look.m === 'flask') nodes.hips.position.x = 0.17;
      }
      styleModel(k, {}, item.slot, model || 0); modelBits(k, item.slot, model || 0, rar || 0, D, item);
      adorn(k, item.slot, item, D, rar || 0);
      k.attach(nodes);
      if (!stand.empty()) grp.add(V.mesh(stand));
      return grp;
    }
  };
})(window.G = window.G || {});

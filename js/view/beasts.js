// LANISTA — thú và ngựa: hình khối thấp, khớp đơn giản, chuyển động tự sinh (không dùng bộ IK của người).
// V.Horse: con ngựa dưới chân một kỵ sĩ (kỵ sĩ vẫn là V.Figure, ngồi cao lên nhờ y0).
// V.Beast: gấu / chó, cài cùng giao diện mà BattleView và Anim gọi tới (place, setBase, point, headTop, attack, react, die…).
(function (G) {
  'use strict';
  var T = THREE, V = G.V, P = V.PAL, PI = Math.PI;
  var v1 = new T.Vector3();

  function part(parent, geo, mat) { var m = V.mesh(geo, mat || 'matte'); parent.add(m); return m; }
  function node(parent, x, y, z) { var o = new T.Object3D(); o.position.set(x || 0, y || 0, z || 0); parent.add(o); return o; }
  function shade(c, k) { return new T.Color(c).multiplyScalar(k).getHex(); }
  function ringMesh(team, r) {
    var rg = new T.RingGeometry(r * 0.8, r, 24); rg.rotateX(-PI / 2);
    var m = new T.Mesh(rg, new T.MeshBasicMaterial({ color: V.TEAM[team].ring, transparent: true, opacity: 0.75, depthWrite: false }));
    m.position.y = 0.02; m.renderOrder = 2; return m;
  }
  function lerpAng(a, b, t) { var d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * t; }

  // =================================================================== NGỰA
  var HORSE_COAT = [0x7a5638, 0x6a4a30, 0x8a6a48, 0x5a4a3e, 0x9a8a78];
  function Horse(team, seed) {
    var rnd = new G.Rng(seed || 1), coat = HORSE_COAT[rnd.int(0, HORSE_COAT.length - 1)], dark = shade(coat, 0.6), mane = shade(coat, 0.35);
    this.group = new T.Group(); this.root = node(this.group);
    this.body = node(this.root, 0, 1.02, 0);
    var g = new V.Geo(0.02, 0.03);
    g.box(0.44, 0.5, 1.15, coat, { z: 0 });                       // thân
    g.box(0.4, 0.44, 0.34, coat, { z: 0.58, y: 0.04, rx: -0.15 }); // ức
    g.box(0.4, 0.42, 0.3, coat, { z: -0.58, y: 0.02 });            // mông
    g.box(0.48, 0.07, 0.62, V.TEAM[team].cloth, { y: 0.27, z: -0.02 });   // tấm vải yên
    g.box(0.5, 0.2, 0.6, V.TEAM[team].cloth, { y: 0.14, z: -0.02, sx: 1.04 });
    g.box(0.3, 0.1, 0.42, P.leather, { y: 0.33, z: -0.02 });      // yên
    g.box(0.06, 0.12, 0.06, P.leatherDark, { y: 0.4, z: 0.16 }); g.box(0.06, 0.12, 0.06, P.leatherDark, { y: 0.4, z: -0.2 });   // núm yên
    part(this.body, g);
    // cổ và đầu
    this.neck = node(this.body, 0, 0.18, 0.62);
    g = new V.Geo(0.02, 0.03);
    g.box(0.26, 0.62, 0.3, coat, { y: 0.26, z: 0.1, rx: 0.55 });
    g.box(0.06, 0.5, 0.12, mane, { y: 0.32, z: -0.02, rx: 0.55 });
    part(this.neck, g);
    this.head = node(this.neck, 0, 0.55, 0.33);
    g = new V.Geo(0.02, 0.03);
    g.box(0.22, 0.24, 0.3, coat, { z: 0.02 }); g.box(0.17, 0.17, 0.32, coat, { z: 0.28, y: -0.06 });
    g.box(0.18, 0.04, 0.05, P.leatherDark, { z: 0.3, y: 0.02 }); g.box(0.04, 0.1, 0.06, dark, { x: 0.07, y: 0.17, z: -0.06 }); g.box(0.04, 0.1, 0.06, dark, { x: -0.07, y: 0.17, z: -0.06 });
    g.box(0.05, 0.05, 0.04, 0x111111, { x: 0.11, y: 0.03, z: 0.08 }); g.box(0.05, 0.05, 0.04, 0x111111, { x: -0.11, y: 0.03, z: 0.08 });
    part(this.head, g);
    // đuôi
    this.tail = node(this.body, 0, 0.12, -0.74);
    g = new V.Geo(0.02, 0.03); g.box(0.09, 0.62, 0.08, mane, { y: -0.3, z: -0.06, rx: -0.25 }); part(this.tail, g);
    // bốn chân: đùi + ống chân + móng, khớp vai/hông
    this.legs = [];
    var L = [[0.15, 0.5], [-0.15, 0.5], [0.15, -0.5], [-0.15, -0.5]];
    for (var i = 0; i < 4; i++) {
      var hip = node(this.body, L[i][0], -0.12, L[i][1]), knee = node(hip, 0, -0.42, 0);
      g = new V.Geo(0.02, 0.03); g.box(0.13, 0.46, 0.17, coat, { y: -0.2 }); part(hip, g);
      g = new V.Geo(0.02, 0.03); g.box(0.08, 0.42, 0.09, dark, { y: -0.2 }); g.box(0.1, 0.07, 0.12, 0x2a2420, { y: -0.43, z: 0.01 }); part(knee, g);
      this.legs.push({ hip: hip, knee: knee, ph: [0, 0.5, 0.15, 0.65][i] });
    }
    this.blob = new T.Mesh(new T.CircleGeometry(0.75, 14), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
    this.blob.rotation.x = -PI / 2; this.blob.scale.set(0.6, 1.25, 1); this.blob.position.y = 0.012; this.blob.renderOrder = 1; this.group.add(this.blob);
    this.cyc = rnd.next(); this.hd = 0; this.speed = 0; this.fallT = -1; this.prev = null;
  }
  V.Horse = Horse;
  Horse.prototype.update = function (x, z, hd, dt, dead, hold) {
    if (!this.prev) this.prev = { x: x, z: z };
    var vx = dt > 0 ? (x - this.prev.x) / dt : 0, vz = dt > 0 ? (z - this.prev.z) / dt : 0; this.prev.x = x; this.prev.z = z;
    var sp = Math.sqrt(vx * vx + vz * vz); this.speed += (sp - this.speed) * Math.min(1, dt * 6);
    this.hd = lerpAng(this.hd, hd, Math.min(1, dt * 10));
    this.root.position.set(x, 0, z); this.root.rotation.y = this.hd; this.blob.position.set(x, 0.012, z); this.blob.rotation.z = -this.hd;
    if (dead) {   // ngựa khuỵu xuống rồi nằm nghiêng
      if (this.fallT < 0) this.fallT = 0; this.fallT += dt; var f = V.smooth(this.fallT / 0.7);
      this.root.rotation.z = f * 1.35; this.root.position.y = -f * 0.25; this.body.rotation.x = 0;
      for (var j = 0; j < 4; j++) { this.legs[j].hip.rotation.x = f * (j < 2 ? -0.6 : 0.5); this.legs[j].knee.rotation.x = f * 0.8; }
      this.neck.rotation.x = f * 0.5; return;
    }
    var s = Math.min(1, this.speed / 4), gal = this.speed > 2.4;
    this.cyc += dt * (gal ? 2.3 : 1.4) * Math.max(0.15, this.speed / 3.2) * (hold ? 0 : 1);
    var c = this.cyc * 2 * PI;
    for (var i = 0; i < 4; i++) {
      var L = this.legs[i], ph = c + L.ph * 2 * PI * (gal ? 1 : 0.9), sw = Math.sin(ph);
      L.hip.rotation.x = sw * (0.15 + 0.5 * s);
      L.knee.rotation.x = (i < 2 ? 1 : -1) * Math.max(0, Math.cos(ph)) * (0.2 + 0.9 * s) * (i < 2 ? 1 : 0.8);
    }
    this.body.position.y = 1.02 + Math.abs(Math.sin(c)) * 0.06 * s;
    this.body.rotation.x = Math.sin(c) * 0.06 * s;
    this.neck.rotation.x = -0.05 + Math.sin(c + 0.6) * 0.12 * s + (hold ? -0.3 : 0);
    this.tail.rotation.x = -0.4 * s + Math.sin(c * 0.5) * 0.08;
  };
  Horse.prototype.saddleY = function () { return this.body.position.y + 0.35; };
  Horse.prototype.dispose = function () {
    this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    if (this.group.parent) this.group.parent.remove(this.group);
  };

  // =================================================================== VOI CHIẾN
  function Elephant(team, seed) {
    var hide = 0x8a8478, dark = 0x6a655c, tusk = 0xe8dfc8;
    this.group = new T.Group(); this.root = node(this.group);
    this.body = node(this.root, 0, 1.95, 0);
    var g = new V.Geo(0.03, 0.03);
    g.box(1.3, 1.3, 2.1, hide, {}); g.box(1.2, 1.15, 0.5, hide, { z: 1.1, y: 0.1 }); g.box(1.15, 1.1, 0.4, dark, { z: -1.1, y: -0.05 });
    // tháp gỗ (howdah) trên lưng, thảm vải màu đội
    g.box(1.5, 0.12, 1.9, V.TEAM[team].cloth, { y: 0.66 }); g.box(1.42, 0.5, 1.8, V.TEAM[team].cloth, { y: 0.4, sx: 1.02 });
    g.box(1.1, 0.12, 1.2, P.wood, { y: 0.78, z: -0.25 });
    var c = [[-0.52, 0.32], [0.52, 0.32], [-0.52, -0.82], [0.52, -0.82]];
    for (var i = 0; i < 4; i++) g.box(0.08, 0.9, 0.08, P.woodDark, { x: c[i][0], y: 1.25, z: c[i][1] });
    g.box(1.12, 0.08, 0.08, P.woodDark, { y: 1.15, z: 0.32 }); g.box(1.12, 0.08, 0.08, P.woodDark, { y: 1.15, z: -0.82 });
    g.box(0.08, 0.08, 1.2, P.woodDark, { x: 0.52, y: 1.15, z: -0.25 }); g.box(0.08, 0.08, 1.2, P.woodDark, { x: -0.52, y: 1.15, z: -0.25 });
    for (i = 0; i < 3; i++) g.cyl(0.13, 0.13, 0.04, 8, P.bronzeLight, { x: 0.72, y: 0.42, z: -0.6 + i * 0.6, rz: PI / 2 });
    part(this.body, g);
    this.neck = node(this.body, 0, 0.15, 1.25);
    this.head = node(this.neck, 0, 0, 0.25);
    g = new V.Geo(0.02, 0.03);
    g.box(0.95, 0.95, 0.75, hide, { z: 0.1 }); g.box(0.12, 0.85, 0.8, dark, { x: 0.58, y: -0.05, z: -0.15, ry: -0.35 }); g.box(0.12, 0.85, 0.8, dark, { x: -0.58, y: -0.05, z: -0.15, ry: 0.35 });   // tai
    g.box(0.06, 0.06, 0.05, 0x111111, { x: 0.36, y: 0.12, z: 0.47 }); g.box(0.06, 0.06, 0.05, 0x111111, { x: -0.36, y: 0.12, z: 0.47 });
    g.cone(0.06, 0.75, 5, tusk, { x: 0.25, y: -0.45, z: 0.6, rx: 1.15 }); g.cone(0.06, 0.75, 5, tusk, { x: -0.25, y: -0.45, z: 0.6, rx: 1.15 });   // ngà
    g.box(0.98, 0.3, 0.06, V.TEAM[team].cloth, { y: 0.32, z: 0.5 });   // trán bọc vải
    part(this.head, g);
    this.trunk = [];
    var tp = this.head;
    for (i = 0; i < 4; i++) {
      var tn = node(tp, 0, i ? -0.32 : -0.3, i ? 0 : 0.38); g = new V.Geo(0.02, 0.03); g.box(0.3 - i * 0.05, 0.36, 0.3 - i * 0.05, hide, { y: -0.16 }); part(tn, g); this.trunk.push(tn); tp = tn;
    }
    this.tail = node(this.body, 0, 0.3, -1.3); g = new V.Geo(0.02, 0.03); g.box(0.07, 0.8, 0.07, dark, { y: -0.4, rx: -0.1 }); part(this.tail, g);
    this.legs = [];
    var L = [[0.42, 0.72], [-0.42, 0.72], [0.42, -0.72], [-0.42, -0.72]];
    for (i = 0; i < 4; i++) {
      var hip = node(this.body, L[i][0], -0.4, L[i][1]), knee = node(hip, 0, -0.78, 0);
      g = new V.Geo(0.02, 0.03); g.box(0.42, 0.85, 0.44, hide, { y: -0.38 }); part(hip, g);
      g = new V.Geo(0.02, 0.03); g.box(0.38, 0.8, 0.4, i < 2 ? hide : dark, { y: -0.38 }); g.cyl(0.25, 0.25, 0.1, 8, 0xc8bea8, { y: -0.76 }); part(knee, g);
      this.legs.push({ hip: hip, knee: knee, ph: [0, 0.5, 0.25, 0.75][i] });
    }
    this.blob = new T.Mesh(new T.CircleGeometry(1.25, 16), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    this.blob.rotation.x = -PI / 2; this.blob.scale.set(0.75, 1.3, 1); this.blob.position.y = 0.012; this.blob.renderOrder = 1; this.group.add(this.blob);
    this.cyc = 0; this.hd = 0; this.speed = 0; this.fallT = -1; this.prev = null; this.t = 0;
  }
  V.Elephant = Elephant;
  Elephant.prototype.update = function (x, z, hd, dt, dead, hold) {
    if (!this.prev) this.prev = { x: x, z: z };
    var vx = dt > 0 ? (x - this.prev.x) / dt : 0, vz = dt > 0 ? (z - this.prev.z) / dt : 0; this.prev.x = x; this.prev.z = z; this.t += dt;
    var sp = Math.sqrt(vx * vx + vz * vz); this.speed += (sp - this.speed) * Math.min(1, dt * 5);
    this.hd = lerpAng(this.hd, hd, Math.min(1, dt * 6));
    this.root.position.set(x, 0, z); this.root.rotation.y = this.hd; this.blob.position.set(x, 0.012, z); this.blob.rotation.z = -this.hd;
    var i;
    if (dead) {
      if (this.fallT < 0) this.fallT = 0; this.fallT += dt; var f = V.smooth(this.fallT / 1.1);
      this.root.rotation.z = f * 1.3; this.root.position.y = -f * 0.5;
      for (i = 0; i < 4; i++) this.legs[i].hip.rotation.x = f * (i < 2 ? -0.4 : 0.3);
      for (i = 0; i < 4; i++) this.trunk[i].rotation.x = f * 0.3; return;
    }
    var s = Math.min(1, this.speed / 3);
    this.cyc += dt * 1.1 * Math.max(0.12, this.speed / 2.4) * (hold ? 0 : 1);
    var c = this.cyc * 2 * PI;
    for (i = 0; i < 4; i++) { var L = this.legs[i], ph = c + L.ph * 2 * PI; L.hip.rotation.x = Math.sin(ph) * (0.06 + 0.32 * s); L.knee.rotation.x = (i < 2 ? -1 : 1) * Math.max(0, Math.cos(ph)) * 0.35 * s; }
    this.body.position.y = 1.95 + Math.abs(Math.sin(c)) * 0.05 * s; this.body.rotation.z = Math.sin(c) * 0.025 * s;
    var sw = Math.sin(this.t * 1.3) * 0.25 + (hold ? Math.sin(this.t * 6) * 0.3 : 0);
    for (i = 0; i < 4; i++) { this.trunk[i].rotation.x = 0.12 + Math.sin(this.t * 1.1 + i * 0.6) * 0.12 + (s > 0.6 ? -0.25 : 0); this.trunk[i].rotation.z = sw * 0.25; }
    this.neck.rotation.y = Math.sin(this.t * 0.7) * 0.1; this.tail.rotation.z = Math.sin(this.t * 2.1) * 0.25;
  };
  Elephant.prototype.saddleY = function () { return this.body.position.y + 0.84; };
  Elephant.prototype.dispose = Horse.prototype.dispose;

  // Ghép kỵ sĩ (V.Figure) lên ngựa hoặc voi: người ngồi cao lên, hai chân buông theo hông thú, không bước.
  V.mountFigure = function (fig, team, seed, kind) {
    var h = kind === 'elephant' ? new Elephant(team, seed) : new Horse(team, seed); fig.horse = h; fig.group.add(h.group);
    fig.mount = kind || 'horse'; fig.y0 = 0.62;
    return fig;
  };

  // =================================================================== THÚ: gấu, chó
  var BEAR_COAT = [0x7a5434, 0x6b4a2e, 0x8a6240, 0x5e4430], DOG_COAT = [0x6a5238, 0x8a7a5e, 0x5a4a38, 0x7a6248], LION_COAT = [0xc09252, 0xb48446, 0xc8a062, 0xa87a42];
  function Beast(g, team, opts) {
    this.g = g; this.team = team; this.opts = opts || {}; this.beast = g.x.beast; this.kind = this.beast === 'bear' ? 'claw' : (this.beast === 'lion' ? 'lion' : 'fang');
    this.group = new T.Group(); this.base = { x: 0, z: 0, face: 0 }; this.prev = { x: 0, z: 0 }; this.vel = { x: 0, z: 0 }; this.speed = 0;
    this.dead = false; this.state = 'stance'; this.onStep = null; this.hasShield = false; this.tip = 0; this.R = { ws: 0 }; this.rx = []; this.act = null; this.time = 0; this.cyc = 0;
    var lion = this.beast === 'lion', sc = (g.x.scale || 1) * (this.beast === 'bear' ? 1 : (lion ? 1.75 : 0.85)); this.D = { S: sc, W: sc };
    var rnd = new G.Rng(G.hashStr(g.name + (g.id || ''))), coat = (this.beast === 'bear' ? BEAR_COAT : (lion ? LION_COAT : DOG_COAT))[rnd.int(0, 3)], dark = shade(coat, 0.65);
    var bear = this.beast === 'bear';
    this.root = node(this.group); this.root.scale.setScalar(sc);
    this.body = node(this.root, 0, bear ? 0.78 : 0.42, 0);
    var g1 = new V.Geo(0.03, 0.04);
    if (bear) {
      g1.box(0.78, 0.66, 1.18, coat, {}); g1.box(0.84, 0.72, 0.5, coat, { z: 0.34, y: 0.08 });   // thân, u vai
      g1.box(0.7, 0.58, 0.36, dark, { z: -0.6, y: -0.02 });
    } else {
      g1.box(0.24, 0.24, 0.66, coat, {}); g1.box(0.27, 0.28, 0.24, coat, { z: 0.22, y: 0.03 });
      if (lion) { g1.box(0.36, 0.36, 0.26, shade(coat, 0.55), { z: 0.3, y: 0.08 }); }   // bờm
      else { g1.box(0.22, 0.05, 0.05, P.leatherDark, { z: 0.36, y: 0.13 });   // vòng cổ gai
        for (var q = -1; q <= 1; q++) g1.cone(0.025, 0.07, 4, P.iron, { x: q * 0.08, z: 0.36, y: 0.17 }); }
    }
    part(this.body, g1);
    this.neck = node(this.body, 0, bear ? 0.1 : 0.08, bear ? 0.62 : 0.34);
    this.head = node(this.neck, 0, bear ? 0.02 : 0.08, bear ? 0.22 : 0.1);
    var g2 = new V.Geo(0.02, 0.03);
    if (bear) {
      g2.box(0.46, 0.4, 0.4, coat, {}); g2.box(0.26, 0.22, 0.26, shade(coat, 1.25), { z: 0.28, y: -0.06 }); g2.box(0.1, 0.07, 0.06, 0x111111, { z: 0.42, y: -0.02 });
      g2.box(0.12, 0.12, 0.08, coat, { x: 0.18, y: 0.24, z: -0.05 }); g2.box(0.12, 0.12, 0.08, coat, { x: -0.18, y: 0.24, z: -0.05 });
      g2.box(0.05, 0.05, 0.03, 0x1a0e08, { x: 0.12, y: 0.07, z: 0.2 }); g2.box(0.05, 0.05, 0.03, 0x1a0e08, { x: -0.12, y: 0.07, z: 0.2 });
    } else {
      g2.box(0.18, 0.17, 0.2, coat, {}); g2.box(0.11, 0.1, 0.2, dark, { z: 0.17, y: -0.03 }); g2.box(0.05, 0.04, 0.04, 0x111111, { z: 0.28, y: 0 });
      if (lion) { g2.box(0.3, 0.3, 0.12, shade(coat, 0.55), { z: -0.08, y: 0.02 }); g2.box(0.26, 0.12, 0.14, shade(coat, 0.5), { z: -0.04, y: -0.12 }); }
      else { g2.box(0.05, 0.1, 0.04, dark, { x: 0.07, y: 0.12, z: -0.05, rz: 0.3 }); g2.box(0.05, 0.1, 0.04, dark, { x: -0.07, y: 0.12, z: -0.05, rz: -0.3 }); }
    }
    part(this.head, g2);
    this.jaw = node(this.head, 0, bear ? -0.14 : -0.06, bear ? 0.2 : 0.12);
    var g3 = new V.Geo(0.02, 0.03); g3.box(bear ? 0.2 : 0.09, bear ? 0.07 : 0.04, bear ? 0.24 : 0.16, dark, { z: bear ? 0.06 : 0.04 }); g3.box(bear ? 0.16 : 0.07, 0.02, 0.02, 0xe8dfcc, { z: bear ? 0.17 : 0.11, y: 0.04 }); part(this.jaw, g3);
    this.tail = node(this.body, 0, bear ? 0.1 : 0.08, bear ? -0.76 : -0.34);
    var g4 = new V.Geo(0.02, 0.03); g4.box(bear ? 0.14 : 0.05, bear ? 0.12 : 0.05, bear ? 0.12 : (lion ? 0.4 : 0.3), coat, { z: bear ? -0.04 : -0.13, rx: bear ? 0 : (lion ? -0.5 : 0.6) }); if (lion) g4.box(0.07, 0.07, 0.08, shade(coat, 0.5), { z: -0.33, y: -0.12 }); part(this.tail, g4);
    this.legs = []; this.n = {};
    var LX = bear ? 0.28 : 0.09, LZ = bear ? 0.42 : 0.24, LY = bear ? -0.2 : -0.1, TH = bear ? 0.36 : 0.2, SH = bear ? 0.36 : 0.18;
    var LL = [[LX, LZ], [-LX, LZ], [LX, -LZ], [-LX, -LZ]];
    for (var i = 0; i < 4; i++) {
      var hip = node(this.body, LL[i][0], LY, LL[i][1]), knee = node(hip, 0, -TH, 0), paw = node(knee, 0, -SH, 0.04);
      var gl = new V.Geo(0.02, 0.03); gl.box(bear ? 0.24 : 0.07, TH + 0.06, bear ? 0.28 : 0.08, coat, { y: -TH / 2 }); part(hip, gl);
      gl = new V.Geo(0.02, 0.03); gl.box(bear ? 0.2 : 0.05, SH + 0.04, bear ? 0.22 : 0.06, i < 2 ? coat : dark, { y: -SH / 2 }); gl.box(bear ? 0.24 : 0.07, 0.08, bear ? 0.3 : 0.1, dark, { y: -SH, z: 0.04 });
      if (bear && i < 2) for (var cl = -1; cl <= 1; cl++) gl.cone(0.022, 0.1, 4, 0xd8cdb4, { x: cl * 0.07, y: -SH - 0.02, z: 0.2, rx: PI / 2 });
      part(knee, gl);
      this.legs.push({ hip: hip, knee: knee, paw: paw, ph: [0, 0.5, 0.5, 0][i] });
    }
    this.n = { hand0: this.legs[0].paw, hand1: this.legs[1].paw, chest: this.body, head: this.head, shield: node(this.body), wR: node(this.body), wL: node(this.body) };
    var W = bear ? 0.62 * (g.x.scale || 1) : (lion ? 0.46 * (g.x.scale || 1) : 0.32);
    if (team != null && this.opts.ring !== false) { this.ring = ringMesh(team, W); this.group.add(this.ring); }
    this.blob = new T.Mesh(new T.CircleGeometry(W * 0.95, 14), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    this.blob.rotation.x = -PI / 2; this.blob.scale.set(0.75, 1.3, 1); this.blob.position.y = 0.012; this.blob.renderOrder = 1; this.group.add(this.blob);
    this.update(0);
  }
  V.Beast = Beast;
  Beast.prototype.place = function (x, z, face) { this.base.x = x; this.base.z = z; this.base.face = face; this.prev.x = x; this.prev.z = z; this.speed = 0; this.update(0); };
  Beast.prototype.setBase = function (x, z, face) { this.base.x = x; this.base.z = z; this.base.face = face; };
  Beast.prototype.setRingVisible = function (v) { if (this.ring) this.ring.visible = v; };
  Beast.prototype.setSelected = function () { };
  Beast.prototype.headTop = function (out) { out.set(0, this.beast === 'bear' ? 0.3 : 0.15, 0); this.head.localToWorld(out); return out; };
  Beast.prototype.point = function (loc, from, out) {
    if (loc === 'head') { out.set(0, 0, 0.1); this.head.localToWorld(out); }
    else if (loc === 'legs') { out.set(0, -0.1, 0); this.legs[from && Math.random() < 0.5 ? 2 : 0].knee.localToWorld(out); }
    else { out.set(0, 0.1, 0.1); this.body.localToWorld(out); }
    return out;
  };
  Beast.prototype.dispose = function () {
    this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    if (this.ring) this.ring.material.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  };
  // hành động: { type, t, dur, wu } — attack (tát/cắn), maul (chồm lên vồ), roar (gầm), flinch
  Beast.prototype.attack = function (ev) {
    if (this.dead) return;
    var sp = ev.special, wu = ev.windup, last = ev.hits.length ? ev.hits[ev.hits.length - 1].at : wu;
    this.act = { type: sp === 'maul' ? 'maul' : (sp === 'pounce' ? 'pounce' : (this.beast === 'bear' ? 'swipe' : 'bite')), t: 0, wu: wu, dur: last + Math.max(0.3, ev.recover), side: (ev.hits[0] && ev.hits[0].hand) || 0 };
  };
  Beast.prototype.roar = function () { if (!this.dead) this.act = { type: 'roar', t: 0, wu: 0.25, dur: 1.1 }; };
  Beast.prototype.react = function (type, o) { if (this.dead) return; if (type === 'flinch') this.rx.push({ t: 0, p: (o && o.power) || 1 }); };
  Beast.prototype.cancel = function () { this.act = null; };
  Beast.prototype.die = function () { if (this.dead) return; this.dead = true; this.state = 'dead'; this.act = null; this.dieT = 0; this.dieSide = Math.random() < 0.5 ? 1 : -1; };
  Beast.prototype.update = function (dt) {
    var b = this.base, bear = this.beast === 'bear', i;
    this.time += dt;
    if (dt > 0) {
      var vx = (b.x - this.prev.x) / dt, vz = (b.z - this.prev.z) / dt, kf = Math.min(1, dt * 10);
      this.vel.x += (vx - this.vel.x) * kf; this.vel.z += (vz - this.vel.z) * kf; this.speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    }
    this.prev.x = b.x; this.prev.z = b.z;
    this.root.position.set(b.x, 0, b.z); this.root.rotation.set(0, b.face, 0);
    if (this.ring) this.ring.position.set(b.x, 0.02, b.z);
    this.blob.position.set(b.x, 0.012, b.z); this.blob.rotation.z = -b.face;
    var by = bear ? 0.78 : 0.42;
    if (this.dead) {
      this.dieT += dt; var f = V.smooth(this.dieT / 0.6);
      this.root.rotation.z = this.dieSide * f * 1.4; this.body.position.y = by - f * by * 0.35;
      for (i = 0; i < 4; i++) { this.legs[i].hip.rotation.x = f * (i < 2 ? 0.5 : -0.4); this.legs[i].knee.rotation.x = f * 0.3; }
      this.jaw.rotation.x = f * 0.4; return;
    }
    // đi / chạy
    var s = Math.min(1, this.speed / (bear ? 3 : 4)), stun = this.state === 'stun' || this.state === 'net';
    var old = this.cyc; this.cyc += dt * (bear ? 1.5 : 2.6) * Math.max(0.1, this.speed / (bear ? 2.4 : 3.2));
    if (this.onStep && Math.floor(old * 2) !== Math.floor(this.cyc * 2) && s > 0.2) { v1.set(b.x, 0, b.z); this.onStep(v1, this.speed, b.face); }
    var c = this.cyc * 2 * PI;
    for (i = 0; i < 4; i++) {
      var L = this.legs[i], ph = c + L.ph * 2 * PI, sw = Math.sin(ph);
      L.hip.rotation.x = sw * (0.08 + 0.55 * s); L.knee.rotation.x = (i < 2 ? -1 : 1) * Math.max(0, Math.cos(ph)) * (0.1 + 0.7 * s); L.hip.rotation.z = 0;
    }
    this.body.position.y = by + Math.abs(Math.sin(c)) * (bear ? 0.04 : 0.03) * s; this.body.rotation.set(Math.sin(c) * 0.04 * s, 0, 0);
    this.neck.rotation.set(-0.1 + Math.sin(this.time * 1.7) * 0.05, Math.sin(this.time * 0.8) * 0.15 * (1 - s), 0);
    this.jaw.rotation.x = 0.05 + (stun ? 0.2 : 0); this.tail.rotation.y = Math.sin(this.time * (bear ? 2 : 7)) * (bear ? 0.1 : 0.4);
    if (stun) { this.body.rotation.z = Math.sin(this.time * 3) * 0.06; this.neck.rotation.y += Math.sin(this.time * 2.3) * 0.3; }
    // hành động
    var a = this.act;
    if (a) {
      a.t += dt; var u = a.t, k;
      if (a.type === 'swipe') {   // nhấc một chân trước, vươn người, quật ngang
        var leg = this.legs[a.side ? 1 : 0], sd = a.side ? -1 : 1;
        if (u < a.wu) { k = V.smooth(u / a.wu); leg.hip.rotation.x = -1.6 * k; leg.hip.rotation.z = sd * 0.5 * k; this.body.rotation.x = -0.18 * k; this.body.rotation.y = sd * 0.25 * k; this.jaw.rotation.x = 0.35 * k; }
        else { k = Math.min(1, (u - a.wu) / 0.18); leg.hip.rotation.x = -1.6 + 1.9 * k; leg.hip.rotation.z = sd * (0.5 - 1.0 * k); this.body.rotation.x = -0.18 + 0.28 * k; this.body.rotation.y = sd * (0.25 - 0.55 * k); this.root.position.addScaledVector(v1.set(Math.sin(b.face), 0, Math.cos(b.face)), 0.15 * Math.sin(k * PI)); }
      } else if (a.type === 'maul') {   // chồm đứng lên hai chân rồi đổ ập xuống
        if (u < a.wu) { k = V.smooth(u / a.wu); this.body.rotation.x = -0.9 * k; this.body.position.y = by + 0.45 * k; this.legs[0].hip.rotation.x = this.legs[1].hip.rotation.x = -1.4 * k; this.jaw.rotation.x = 0.5 * k; }
        else { k = Math.min(1, (u - a.wu) / 0.16); this.body.rotation.x = -0.9 + 1.1 * k; this.body.position.y = by + 0.45 - 0.5 * k; this.legs[0].hip.rotation.x = this.legs[1].hip.rotation.x = -1.4 + 1.8 * k; this.root.position.addScaledVector(v1.set(Math.sin(b.face), 0, Math.cos(b.face)), 0.35 * k); }
      } else if (a.type === 'bite') {   // chó: nhún rồi lao tới đớp
        if (u < a.wu) { k = V.smooth(u / a.wu); this.body.rotation.x = 0.15 * k; this.neck.rotation.x = 0.25 * k; this.jaw.rotation.x = 0.6 * k; }
        else { k = Math.min(1, (u - a.wu) / 0.12); this.neck.rotation.x = 0.25 - 0.55 * k; this.jaw.rotation.x = 0.6 - 0.55 * k; this.root.position.addScaledVector(v1.set(Math.sin(b.face), 0, Math.cos(b.face)), 0.25 * Math.sin(k * PI)); }
      } else if (a.type === 'pounce') {   // sư tử: thu mình rồi phóng vọt lên, hai chân trước giơ cao
        if (u < a.wu * 0.35) { k = V.smooth(u / (a.wu * 0.35)); this.body.position.y = by - 0.06 * k; this.body.rotation.x = 0.12 * k; }
        else if (u < a.wu) { k = (u - a.wu * 0.35) / (a.wu * 0.65); this.body.position.y = by + Math.sin(k * PI) * 0.35; this.body.rotation.x = -0.5 * Math.sin(k * PI * 0.8); this.legs[0].hip.rotation.x = this.legs[1].hip.rotation.x = -1.3 * Math.sin(k * PI * 0.9); this.jaw.rotation.x = 0.6; }
        else { k = Math.min(1, (u - a.wu) / 0.2); this.body.rotation.x = 0.2 * (1 - k); this.jaw.rotation.x = 0.6 * (1 - k); }
      } else if (a.type === 'roar') {   // ngẩng đầu, há miệng, rung người
        k = Math.sin(Math.min(1, u / a.dur) * PI); this.neck.rotation.x = -0.5 * k; this.jaw.rotation.x = 0.75 * k; this.body.rotation.x = -0.25 * k; this.body.position.y = by + 0.2 * k; this.body.rotation.z = Math.sin(u * 30) * 0.03 * k;
      }
      if (u >= a.dur) this.act = null;
    }
    for (i = this.rx.length - 1; i >= 0; i--) {
      var x = this.rx[i]; x.t += dt; var e = x.t < 0.05 ? x.t / 0.05 : Math.exp(-(x.t - 0.05) * 8);
      this.body.rotation.x += 0.12 * x.p * e; this.neck.rotation.y += 0.2 * x.p * e;
      if (x.t > 0.6) this.rx.splice(i, 1);
    }
  };

  // Tạo hình cho một đấu sĩ / kẻ địch: thú → V.Beast, kỵ binh → V.Figure ngồi trên V.Horse, còn lại → V.Figure.
  V.makeFig = function (g, team, opts) {
    var x = g.x || {};
    if (x.beast) return new Beast(g, team, opts);
    var fig = new V.Figure(g, team, opts);
    if (x.mount) V.mountFigure(fig, team == null ? 0 : team, G.hashStr(g.name + (g.id || '')), x.mount);
    return fig;
  };
})(window.G = window.G || {});

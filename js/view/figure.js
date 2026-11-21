// LANISTA — hình người: thân thể low-poly, bộ khớp, IK tay chân, bước chân bám đất.
// Bàn chân được "cắm" trong không gian thế giới và chỉ nhấc lên khi cần bước → không trượt chân.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, P = V.PAL, PI = Math.PI;
  var v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), v4 = new T.Vector3(), v5 = new T.Vector3();
  var m4 = new T.Matrix4(), eu = new T.Euler(0, 0, 0, 'YXZ');
  var UP = new T.Vector3(0, 1, 0);

  var blobMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  V.dims = function (body, look) {
    var bw = { big: 1.17, bal: 1.0, agi: 0.9 }[body], bs = { big: 1.03, bal: 1.0, agi: 0.985 }[body];
    var S = bs * look.h, W = bw * look.w;
    return {
      S: S, W: W, body: body, hipW: 0.09 * W, thigh: 0.43 * S, shin: 0.42 * S, ankle: 0.07 * S, waist: 0.10 * S,
      shY: 0.30 * S, shW: 0.195 * W, neck: 0.405 * S, upper: 0.275 * S, fore: 0.27 * S, leg: 0.85 * S, arm: 0.545 * S
    };
  };

  // các vòng thân (mét) cho một thể hình — giáp dùng lại để ôm sát người
  var TORSO = [[-0.02, 0.128, 0.092], [0.06, 0.124, 0.09], [0.14, 0.142, 0.098], [0.225, 0.173, 0.113, 0, 0.006], [0.305, 0.192, 0.106], [0.36, 0.15, 0.084, 0, -0.004], [0.395, 0.062, 0.06, 0, -0.004]];
  V.torsoFor = function (D) {
    var R = TORSO.map(function (r) { return r.slice(); });
    if (D.body === 'big') { R[0][2] *= 1.22; R[1][2] *= 1.36; R[1][4] = 0.024; R[1][1] *= 1.08; R[2][2] *= 1.22; R[2][4] = 0.016; }
    if (D.body === 'agi') { R[1][1] *= 0.94; R[0][1] *= 0.95; }
    return R.map(function (r) { return [r[0] * D.S, r[1] * D.W, r[2] * D.W, (r[3] || 0) * D.W, (r[4] || 0) * D.W]; });
  };
  function darken(hex, k) { var c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); }

  function Figure(g, team, opts) {
    this.g = g; this.team = team; this.opts = opts || {};
    this.group = new T.Group();
    this.base = { x: 0, z: 0, face: 0 }; this.prev = { x: 0, z: 0 }; this.vel = { x: 0, z: 0 }; this.speed = 0;
    this.feet = [mkFoot(), mkFoot()];
    this.sh = [new T.Vector3(), new T.Vector3()]; this.elbow = [new T.Vector3(), new T.Vector3()]; this.knee = [new T.Vector3(), new T.Vector3()];
    this.hipYs = null; this.dead = false; this.onStep = null; this.y0 = 0; this.flapA = [0, 0]; this.hipJ = [new T.Vector3(), new T.Vector3()];
    this.n = {}; this.meshes = [];
    this.makeNodes();
    this.build();
    if (V.Anim) V.Anim.init(this);
  }
  V.Figure = Figure;
  function mkFoot() { return { pos: new T.Vector3(), yaw: 0, stepping: false, t: 0, dur: 0.2, from: new T.Vector3(), fromYaw: 0, lift: 0, h: 0.06, pitch: 0 }; }

  Figure.prototype.makeNodes = function () {
    var n = this.n, names = ['hips', 'armU0', 'armU1', 'armL0', 'armL1', 'hand0', 'hand1', 'legU0', 'legU1', 'legL0', 'legL1', 'foot0', 'foot1'];
    for (var i = 0; i < names.length; i++) { n[names[i]] = new T.Object3D(); this.group.add(n[names[i]]); }
    n.chest = new T.Object3D(); n.hips.add(n.chest);
    n.head = new T.Object3D(); n.chest.add(n.head);
    n.wR = new T.Object3D(); n.hand0.add(n.wR);
    n.wL = new T.Object3D(); n.hand1.add(n.wL);
    n.shield = new T.Object3D(); n.hand1.add(n.shield);
    n.flapF = new T.Object3D(); n.hips.add(n.flapF); n.flapB = new T.Object3D(); n.hips.add(n.flapB);
    n.hips.rotation.order = 'YXZ'; n.chest.rotation.order = 'YXZ'; n.head.rotation.order = 'YXZ';
  };

  Figure.prototype.build = function () {
    var i, g = this.g, L = g.look;
    for (i = 0; i < this.meshes.length; i++) { var me = this.meshes[i]; me.parent.remove(me); me.geometry.dispose(); }
    this.meshes = [];
    var D = this.D = V.dims(g.body, L), S = D.S, W = D.W, n = this.n;
    n.chest.position.set(0, D.waist, 0); n.head.position.set(0, D.neck, 0.012 * S);
    V.jseed((G.hashStr(g.id || g.name) ^ 0x9e3779b9) >>> 0);
    var k = new V.Kit(), skin = L.skin, skinD = darken(skin, 0.86), hair = L.hair;
    var cloth = (this.team == null) ? L.cloth : V.TEAM[this.team].cloth;
    var helm = !!g.gear.head;
    var bodyIt = G.itemOf(g.gear.body), covered = !!(bodyIt && bodyIt.look && bodyIt.look.m !== 'harness');   // giáp che kín thân (không phải đai da chéo)
    var skinL = darken(skin, 1.07), skinS = darken(skin, 0.76), trim = (this.team == null) ? darken(cloth, 0.7) : V.TEAM[this.team].trim;
    function rs(list, wx) { return list.map(function (r) { var w = wx || W; return [r[0] * S, r[1] * w, r[2] * w, (r[3] || 0) * w, (r[4] || 0) * w]; }); }
    n.flapF.position.set(0, 0.055 * S, 0.108 * W); n.flapB.position.set(0, 0.055 * S, -0.108 * W);
    // --- hông + khố
    var h = k.g('hips');
    h.loft(rs([[-0.1, 0.1, 0.082], [-0.035, 0.148, 0.108], [0.05, 0.15, 0.106], [0.1, 0.136, 0.098]]), 8, cloth, null, 3);
    h.loft(rs([[0.058, 0.157, 0.113], [0.104, 0.151, 0.109]]), 8, P.leather, null, 0);
    k.g('hips', 'metal').box(0.05 * W, 0.04 * S, 0.014, P.bronzeDark, { y: 0.082 * S, z: 0.112 * W });
    k.g('flapF').box(0.15 * W, 0.26 * S, 0.02, cloth, { y: -0.13 * S }); k.g('flapF').box(0.152 * W, 0.03 * S, 0.024, trim, { y: -0.243 * S });
    k.g('flapB').box(0.17 * W, 0.21 * S, 0.02, darken(cloth, 0.84), { y: -0.105 * S });
    // --- thân: vỏ nhiều vòng (eo thon, ngực nở, vai dốc)
    var c = k.g('chest'), TR = V.torsoFor(D);
    c.loft(TR, 8, skin, null, 3, function (i) { return i === 3 ? skinL : skin; });
    c.loft(rs([[0.385, 0.058, 0.056, 0, -0.004], [0.475, 0.05, 0.052, 0, -0.004]]), 8, skin, null, 0);
    if (!covered) {
    c.box(0.15 * W, 0.085 * S, 0.04 * W, skinL, { x: 0.083 * W, y: 0.262 * S, z: 0.103 * W, rx: -0.14, ry: 0.14 });
    c.box(0.15 * W, 0.085 * S, 0.04 * W, skinL, { x: -0.083 * W, y: 0.262 * S, z: 0.103 * W, rx: -0.14, ry: -0.14 });
    c.box(0.3 * W, 0.014 * S, 0.02 * W, skinS, { y: 0.348 * S, z: 0.072 * W });
    c.box(0.11 * W, 0.11 * S, 0.02 * W, skinS, { x: 0.075 * W, y: 0.27 * S, z: -0.103 * W, rx: 0.1 }); c.box(0.11 * W, 0.11 * S, 0.02 * W, skinS, { x: -0.075 * W, y: 0.27 * S, z: -0.103 * W, rx: 0.1 });
    if (g.body !== 'big') { c.box(0.012, 0.15 * S, 0.012, skinS, { y: 0.1 * S, z: 0.086 * W }); c.box(0.11 * W, 0.01, 0.012, skinS, { y: 0.13 * S, z: 0.087 * W }); c.box(0.1 * W, 0.01, 0.012, skinS, { y: 0.075 * S, z: 0.084 * W }); }
    }
    // --- đầu: sọ, hàm, gò má
    var hd = k.g('head'), hw = S * (g.body === 'big' ? 1.04 : 1);
    hd.loft(rs([[0.008, 0.03, 0.036, 0, 0.034], [0.04, 0.06 * L.jaw, 0.068, 0, 0.014], [0.088, 0.074, 0.086, 0, 0.004], [0.135, 0.079, 0.094, 0, -0.004], [0.185, 0.071, 0.088, 0, -0.008], [0.224, 0.04, 0.052, 0, -0.01]], hw), 8, skin, null, 3);
    hd.box(0.024 * S, 0.046 * S, 0.03 * S * L.nose, skinS, { y: 0.1 * S, z: 0.092 * S, rx: -0.22 });
    hd.box(0.132 * S, 0.016 * S, 0.024 * S, skinS, { y: 0.139 * S, z: 0.08 * S });
    hd.box(0.022 * S, 0.011 * S, 0.012, 0x17110d, { x: 0.035 * S, y: 0.122 * S, z: 0.084 * S }); hd.box(0.022 * S, 0.011 * S, 0.012, 0x17110d, { x: -0.035 * S, y: 0.122 * S, z: 0.084 * S });
    hd.box(0.046 * S, 0.008 * S, 0.012, darken(skin, 0.55), { y: 0.058 * S, z: 0.078 * S });
    hd.box(0.014 * S, 0.042 * S, 0.024 * S, skinS, { x: 0.079 * S, y: 0.108 * S, z: -0.004 }); hd.box(0.014 * S, 0.042 * S, 0.024 * S, skinS, { x: -0.079 * S, y: 0.108 * S, z: -0.004 });
    if (!helm) {
      if (L.hairStyle >= 1) hd.ico(0.1 * S, 1, hair, { y: 0.15 * S, z: -0.02 * S, sx: 0.9, sy: 0.86 });
      if (L.hairStyle === 2) hd.box(0.15 * S, 0.17 * S, 0.06 * S, hair, { y: 0.045 * S, z: -0.082 * S });
      if (L.hairStyle === 3) hd.ico(0.044 * S, 0, hair, { y: 0.238 * S, z: -0.06 * S });
      if (L.hairStyle === 4) hd.box(0.034 * S, 0.06 * S, 0.19 * S, hair, { y: 0.24 * S, z: -0.015 * S });
    } else if (L.hairStyle === 2) hd.box(0.14 * S, 0.1 * S, 0.05 * S, hair, { y: 0.012 * S, z: -0.086 * S });
    if (L.beard === 1) hd.box(0.066 * S, 0.042 * S, 0.046 * S, hair, { y: 0.014 * S, z: 0.058 * S });
    if (L.beard === 2) { hd.box(0.118 * S, 0.08 * S, 0.07 * S, hair, { y: 0.022 * S, z: 0.046 * S }); hd.box(0.146 * S, 0.05 * S, 0.03 * S, hair, { y: 0.07 * S, z: 0.03 * S }); }
    // --- tay chân: mỗi khúc có bắp cơ
    for (var s = 0; s < 2; s++) {
      var au = k.g('armU' + s), al = k.g('armL' + s), ha = k.g('hand' + s), lu = k.g('legU' + s), ll = k.g('legL' + s), ft = k.g('foot' + s), sg = s === 0 ? -1 : 1;
      au.loft(rs([[-0.275, 0.045, 0.043], [-0.18, 0.055, 0.051], [-0.08, 0.066, 0.061, 0, 0.004], [0, 0.057, 0.055]]), 6, skin, null, 3); au.ico(0.073 * W, 0, skin, { sy: 0.9 });
      al.loft(rs([[-0.238, 0.034, 0.032], [-0.15, 0.044, 0.041], [-0.06, 0.054, 0.049], [0, 0.046, 0.044]]), 6, skin, null, 3); al.ico(0.049 * W, 0, skinS, {});
      ha.box(0.074 * W, 0.09 * S, 0.086 * W, skinD, {}); ha.box(0.03 * W, 0.045 * S, 0.034 * W, skinD, { x: -sg * 0.012 * W, y: 0.024 * S, z: 0.052 * W });
      lu.loft(rs([[-0.43, 0.063, 0.063], [-0.3, 0.08, 0.082], [-0.12, 0.1, 0.101, 0, 0.006], [0, 0.097, 0.098]]), 6, skin, null, 3);
      ll.loft(rs([[-0.42, 0.041, 0.043], [-0.27, 0.051, 0.055, 0, -0.006], [-0.1, 0.069, 0.073, 0, -0.012], [0, 0.063, 0.065]]), 6, skin, null, 3); ll.ico(0.062 * W, 0, skinS, { z: 0.022 * W, sz: 0.7 });
      ft.box(0.086 * W, 0.07 * S, 0.115 * S, skinD, { y: -0.035 * S, z: 0.0 }); ft.box(0.098 * W, 0.046 * S, 0.165 * S, skinD, { y: -0.047 * S, z: 0.128 * S });
    }
    if (this.opts.bound) { // dây trói cổ tay
      for (var bs = 0; bs < 2; bs++) k.g('armL' + bs).cyl(0.04 * W, 0.04 * W, 0.035 * S, 6, P.rope, { y: -0.2 * S });
      k.g('hand0').cyl(0.012, 0.012, 0.13 * W, 5, P.rope, { x: 0.06 * W, y: -0.04 * S, rz: PI / 2 });
    }
    // --- sẹo và băng vết thương
    if (L.scar && !covered) c.box(0.012, 0.16 * S, 0.012, darken(skin, 0.7), { x: (L.scar - 2) * 0.06 * W, y: 0.24 * S, z: 0.125 * W, rz: 0.5 });
    for (i = 0; i < g.injuries.length; i++) {
      var I = G.INJURIES[g.injuries[i].id], bc = 0xd9d0bc;
      if (g.injuries[i].id === 'eye') { if (!helm) { hd.box(0.045 * S, 0.035 * S, 0.012, 0x1a1410, { x: 0.036 * S, y: 0.119 * S, z: 0.096 * S }); hd.box(0.2 * S, 0.012 * S, 0.19 * S, 0x1a1410, { y: 0.14 * S, z: 0.0, rz: 0.25 }); } }
      else if (I.loc === 'head') { if (!helm) hd.cyl(0.103 * S, 0.103 * S, 0.035 * S, 7, bc, { y: 0.165 * S }); }
      else if (I.loc === 'arms') k.g('armU1').cyl(0.058 * W, 0.055 * W, 0.07 * S, 6, bc, { y: -0.13 * S });
      else if (I.loc === 'legs') k.g('legU1').cyl(0.08 * W, 0.074 * W, 0.09 * S, 6, bc, { y: -0.2 * S });
      else c.box(0.06, 0.5 * S, 0.012, bc, { y: 0.2 * S, z: 0.128 * W, rz: -0.6 });
    }
    V.Gear.build(k, g, D, this.team);
    k.attach(n, this.meshes);
    var it = G.itemOf(g.gear.weapon);
    this.kind = it ? it.kind : 'fist';
    this.hasShield = !!g.gear.shield && G.WKIND[this.kind].hands !== 2;
    this.tip = V.WEAPON_TIP[this.kind] + ((it && it.look && it.look.dl) || 0);
    if (this.hasShield) { var sm = G.itemOf(g.gear.shield).look.m; this.shieldOff = (sm === 'scutum' || sm === 'tower') ? -0.14 : (sm === 'pelta' ? -0.04 : 0); }
    // vòng nhận diện phe dưới chân
    if (this.ring) { this.group.remove(this.ring); this.ring.geometry.dispose(); this.ring = null; }
    if (this.team != null && this.opts.ring !== false) {
      var rg = new T.RingGeometry(0.4 * W, 0.5 * W, 20); rg.rotateX(-PI / 2);
      this.ring = new T.Mesh(rg, new T.MeshBasicMaterial({ color: V.TEAM[this.team].ring, transparent: true, opacity: 0.75, depthWrite: false }));
      this.ring.position.y = 0.02; this.ring.renderOrder = 2; this.group.add(this.ring);
    }
    // bóng mờ dưới chân: giữ nhân vật "dính" xuống đất kể cả khi đứng trong bóng râm
    if (this.blob) { this.group.remove(this.blob); this.blob.geometry.dispose(); this.blob = null; }
    if (this.opts.blob !== false) {
      var bn = 14, bp = [0, 0, 0], bc = [0, 0, 0, 0.42], bi = [], br = 0.52 * W;
      for (i = 0; i < bn; i++) { var ba = i / bn * PI * 2; bp.push(Math.sin(ba) * br, 0, Math.cos(ba) * br); bc.push(0, 0, 0, 0); bi.push(0, 1 + i, 1 + (i + 1) % bn); }
      var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(bc, 4)); bg.setIndex(bi);
      this.blob = new T.Mesh(bg, blobMat); this.blob.renderOrder = 1; this.group.add(this.blob);
    }
    if (V.Anim && this.anim) V.Anim.refresh(this);
  };

  Figure.prototype.dispose = function () {
    if (this.horse) this.horse.dispose();
    for (var i = 0; i < this.meshes.length; i++) this.meshes[i].geometry.dispose();
    if (this.ring) { this.ring.geometry.dispose(); this.ring.material.dispose(); }
    if (this.blob) this.blob.geometry.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  };

  // khung gốc (base) → thế giới
  Figure.prototype.toWorld = function (x, y, z, out) {
    var b = this.base, c = Math.cos(b.face), s = Math.sin(b.face);
    return out.set(b.x + x * c + z * s, y + this.y0, b.z - x * s + z * c);
  };
  Figure.prototype.toBase = function (w, out) {
    var b = this.base, c = Math.cos(b.face), s = Math.sin(b.face), dx = w.x - b.x, dz = w.z - b.z;
    out[0] = dx * c - dz * s; out[1] = w.y - this.y0; out[2] = dx * s + dz * c; return out;
  };
  Figure.prototype.dirToWorld = function (a, out) { var b = this.base, c = Math.cos(b.face), s = Math.sin(b.face); return out.set(a[0] * c + a[2] * s, a[1], -a[0] * s + a[2] * c); };
  Figure.prototype.dirToBase = function (w, out) { var b = this.base, c = Math.cos(b.face), s = Math.sin(b.face); out[0] = w.x * c - w.z * s; out[1] = w.y; out[2] = w.x * s + w.z * c; return out; };

  // Đặt tức thời (không bước)
  Figure.prototype.place = function (x, z, face, y0) {
    if (y0 != null) this.y0 = y0;
    this.base.x = x; this.base.z = z; this.base.face = face; this.prev.x = x; this.prev.z = z; this.vel.x = this.vel.z = 0; this.speed = 0;
    this.hipYs = null;
    if (V.Anim) V.Anim.snap(this);
  };
  Figure.prototype.setBase = function (x, z, face) { this.base.x = x; this.base.z = z; this.base.face = face; };

  function lerpAngle(a, b, t) { var d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * t; }
  V.lerpAngle = lerpAngle;

  // ---------------------------------------------------------------- Bước chân
  // homes: [[x,z,yaw],[x,z,yaw]] trong khung gốc (đã nhân tỉ lệ), 0 = phải, 1 = trái
  Figure.prototype.stepFeet = function (dt, homes, instant) {
    var b = this.base, sp = this.speed, vx = this.vel.x, vz = this.vel.z, i, f;
    // dáng đi đối xứng: bàn chân đáp xuống trước hông nửa sải, rời đất khi tụt sau hông nửa sải
    var dur = V.clamp(0.34 - sp * 0.036, 0.19, 0.3), lead = dur * 0.5;
    var hw = [v1, v2], hy = [0, 0];
    for (i = 0; i < 2; i++) { this.toWorld(homes[i][0], 0, homes[i][1], hw[i]); hy[i] = b.face + homes[i][2]; }
    if (instant) { for (i = 0; i < 2; i++) { f = this.feet[i]; f.pos.copy(hw[i]); f.yaw = hy[i]; f.stepping = false; f.lift = 0; f.pitch = 0; } return; }
    if (this.dead) { // trượt nhẹ về chỗ khi đã ngã
      var k = 1 - Math.exp(-7 * dt);
      for (i = 0; i < 2; i++) { f = this.feet[i]; f.stepping = false; f.lift *= (1 - k); f.pitch *= (1 - k); f.pos.x += (hw[i].x - f.pos.x) * k; f.pos.z += (hw[i].z - f.pos.z) * k; f.yaw = lerpAngle(f.yaw, hy[i], k); }
      return;
    }
    var err = [0, 0], yerr = [0, 0];
    for (i = 0; i < 2; i++) {
      f = this.feet[i];
      var tx = hw[i].x + vx * lead, tz = hw[i].z + vz * lead;
      if (f.stepping) {
        f.t += dt / f.dur;
        var u = Math.min(1, f.t), e = V.smooth(u);
        f.pos.x = f.from.x + (tx - f.from.x) * e; f.pos.z = f.from.z + (tz - f.from.z) * e;
        f.lift = Math.sin(PI * u) * f.h; f.pitch = Math.sin(PI * 2 * u) * 0.35 * Math.min(1, sp / 2);
        f.yaw = lerpAngle(f.fromYaw, hy[i], e);
        if (u >= 1) { f.stepping = false; f.lift = 0; f.pitch = 0; if (this.onStep) this.onStep(f.pos, sp, f.yaw); }
      }
      var ex = f.pos.x - tx, ez = f.pos.z - tz;
      err[i] = Math.sqrt(ex * ex + ez * ez);
      var ya = hy[i] - f.yaw; while (ya > PI) ya -= 2 * PI; while (ya < -PI) ya += 2 * PI; yerr[i] = Math.abs(ya);
    }
    var thr = sp > 0.3 ? Math.max(0.13, sp * dur * 0.9) : 0.085;
    var a = this.feet[0], c = this.feet[1];
    var pick = -1;
    if (!a.stepping && !c.stepping) {
      if (err[0] > thr || err[1] > thr || yerr[0] > 0.55 || yerr[1] > 0.55) pick = (err[0] + yerr[0] * 0.3 > err[1] + yerr[1] * 0.3) ? 0 : 1;
    } else if (sp > 2.2) { // chạy: chân kia được nhấc sớm
      if (a.stepping && !c.stepping && a.t > 0.62 && err[1] > thr) pick = 1;
      if (c.stepping && !a.stepping && c.t > 0.62 && err[0] > thr) pick = 0;
    }
    // bị hất mạnh: chân còn lại cũng phải nhảy theo
    if (pick < 0 && a.stepping !== c.stepping) { var o = a.stepping ? 1 : 0; if (err[o] > 0.45) pick = o; }
    if (pick >= 0) { f = this.feet[pick]; f.stepping = true; f.t = 0; f.dur = dur * (err[pick] > 0.3 ? 0.62 : 1); f.from.copy(f.pos); f.fromYaw = f.yaw; f.h = (0.045 + Math.min(0.09, sp * 0.028)) * this.D.S; }
  };

  // ---------------------------------------------------------------- IK hai khúc
  // A gốc, C đích (bị kẹp nếu quá tầm), pole hướng khuỷu/gối. Ghi B vào outB, trả về C đã kẹp trong outC.
  function ik2(A, C, l1, l2, pole, outB, outC, outP) {
    v3.subVectors(C, A); var d = v3.length(), mx = (l1 + l2) * 0.998, mn = Math.abs(l1 - l2) + 0.02;
    if (d < 1e-5) { v3.set(0, -1, 0); d = 1e-5; }
    v3.multiplyScalar(1 / d);
    if (d > mx) d = mx; else if (d < mn) d = mn;
    outC.copy(A).addScaledVector(v3, d);
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    v4.copy(pole).addScaledVector(v3, -pole.dot(v3));
    if (v4.lengthSq() < 1e-6) { v4.set(v3.y, -v3.x, 0); if (v4.lengthSq() < 1e-6) v4.set(0, 0, 1); }
    v4.normalize();
    outB.copy(A).addScaledVector(v3, a).addScaledVector(v4, hh);
    outP.copy(v4);
  }
  var bx = new T.Vector3(), by = new T.Vector3(), bz = new T.Vector3();
  // đặt một khúc (mesh dọc −Y) từ A tới B, mặt trước (+Z) hướng theo fwd
  function setSeg(obj, A, B, fwd) {
    by.subVectors(A, B).normalize();
    bz.copy(fwd).addScaledVector(by, -fwd.dot(by));
    if (bz.lengthSq() < 1e-6) bz.set(by.y, -by.x, 0);
    bz.normalize(); bx.crossVectors(by, bz);
    m4.makeBasis(bx, by, bz); obj.quaternion.setFromRotationMatrix(m4); obj.position.copy(A);
  }
  function setHand(obj, pos, dir, hint) {
    by.copy(dir).normalize();
    bz.copy(hint).addScaledVector(by, -hint.dot(by));
    if (bz.lengthSq() < 1e-5) { bz.set(0, 0, 1).addScaledVector(by, -by.z); if (bz.lengthSq() < 1e-5) bz.set(1, 0, 0); }
    bz.normalize(); bx.crossVectors(by, bz);
    m4.makeBasis(bx, by, bz); obj.quaternion.setFromRotationMatrix(m4); obj.position.copy(pos);
  }

  var A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), PL = new T.Vector3(), PO = new T.Vector3(), HP = new T.Vector3();
  // Giải bộ khớp từ một tư thế đã quy về số (xem anim.js).
  // R: { hip:[x,y,z], hr:[y,p,r], ch:[y,p,r], hd:[y,p], hand:[{p:V3 thế giới, d:V3, hint:V3, pole:V3}×2], kneeUp }
  Figure.prototype.solve = function (R, dt) {
    var D = this.D, b = this.base, n = this.n, i, f;
    // chiều cao hông không vượt quá tầm chân
    this.toWorld(R.hip[0], 0, R.hip[2], HP);
    var yaw = b.face + R.hr[0];
    var hy = R.hip[1];
    for (i = 0; i < 2; i++) {
      f = this.feet[i]; if (f.stepping && !this.dead) continue;
      var sx = i === 0 ? -1 : 1, jx = HP.x + sx * D.hipW * Math.cos(yaw), jz = HP.z - sx * D.hipW * Math.sin(yaw);
      var dx = f.pos.x - jx, dz = f.pos.z - jz, hd2 = dx * dx + dz * dz, ll = D.leg * 0.985;
      var my = D.ankle + 0.03 * D.S + (hd2 < ll * ll ? Math.sqrt(ll * ll - hd2) : 0.1);
      if (my < hy) hy = my;
    }
    if (!this.dead && hy < R.hip[1] - 0.09 * D.S) hy = R.hip[1] - 0.09 * D.S;   // không khuỵu quá sâu khi chân chưa kịp bước
    if (this.hipYs == null) this.hipYs = hy;
    this.hipYs += (hy - this.hipYs) * (dt ? Math.min(1, dt * 22) : 1);
    if (this.hipYs > R.hip[1]) this.hipYs = R.hip[1];
    n.hips.position.set(HP.x, this.hipYs + this.y0, HP.z);
    n.hips.rotation.set(R.hr[1], yaw, R.hr[2]);
    n.chest.rotation.set(R.ch[1], R.ch[0], R.ch[2]);
    n.head.rotation.set(R.hd[1], R.hd[0], 0);
    n.hips.updateMatrixWorld(true);
    // --- tay
    for (i = 0; i < 2; i++) {
      var sg = i === 0 ? -1 : 1, h = R.hand[i];
      A.set(sg * D.shW, D.shY, 0); n.chest.localToWorld(A); this.sh[i].copy(A);
      ik2(A, h.p, D.upper, D.fore, h.pole, B, C, PO);
      this.elbow[i].copy(B);
      setSeg(n['armU' + i], A, B, PO); setSeg(n['armL' + i], B, C, PO);
      setHand(n['hand' + i], C, h.d, h.hint);
    }
    // --- chân
    for (i = 0; i < 2; i++) {
      f = this.feet[i]; sg = i === 0 ? -1 : 1;
      A.set(sg * D.hipW, -0.03 * D.S, 0); n.hips.localToWorld(A); this.hipJ[i].copy(A);
      HP.set(f.pos.x, D.ankle + f.lift + this.y0, f.pos.z);
      if (R.kneeUp) PL.set(Math.sin(f.yaw) * 0.25, 1, Math.cos(f.yaw) * 0.25); else PL.set(Math.sin(f.yaw), 0.15, Math.cos(f.yaw));
      ik2(A, HP, D.thigh, D.shin, PL, B, C, PO);
      this.knee[i].copy(B);
      setSeg(n['legU' + i], A, B, PO); setSeg(n['legL' + i], B, C, PO);
      var ft = n['foot' + i]; ft.position.copy(C);
      eu.set(f.pitch + (R.footPitch || 0), f.yaw, 0, 'YXZ'); ft.quaternion.setFromEuler(eu);
    }
    // vạt khố: rủ theo trọng lực, bị đùi hất lên khi bước
    var fsn = Math.sin(yaw), fcs = Math.cos(yaw), fr = 0, bk = 0;
    for (i = 0; i < 2; i++) { var kv = this.knee[i], hj = this.hipJ[i], sv = ((kv.x - hj.x) * fsn + (kv.z - hj.z) * fcs) / D.thigh; if (sv > fr) fr = sv; if (-sv > bk) bk = -sv; }
    var grav = this.dead ? 0 : V.clamp(-R.hr[1] * 0.8, -0.6, 0.6), kk = dt ? Math.min(1, dt * 14) : 1;
    this.flapA[0] += ((grav - Math.asin(Math.min(1, fr)) * 0.92) - this.flapA[0]) * kk; this.flapA[1] += ((grav + Math.asin(Math.min(1, bk)) * 0.92) - this.flapA[1]) * kk;
    n.flapF.rotation.x = Math.min(0.15, this.flapA[0]); n.flapB.rotation.x = Math.max(-0.15, this.flapA[1]);
    var gy = this.horse ? 0 : this.y0;
    if (this.ring) { this.ring.position.set(b.x, gy + 0.02, b.z); if (this.horse) this.ring.scale.setScalar(1.45); }
    if (this.blob) { this.blob.position.set(n.hips.position.x, gy + 0.014, n.hips.position.z); this.blob.visible = !this.horse; }
  };

  // Điểm trên cơ thể để đối thủ ngắm tới (thế giới). from: vị trí kẻ tấn công.
  Figure.prototype.point = function (loc, from, out) {
    var n = this.n, D = this.D, r = 0.1;
    if (loc === 'head') { out.set(0, 0.11 * D.S, 0); n.head.localToWorld(out); r = 0.085 * D.S; }
    else if (loc === 'arms') { out.copy(this.elbow[0]).lerp(this.sh[0], 0.4); r = 0.05 * D.W; }
    else if (loc === 'legs') { out.copy(this.knee[1]); n.hips.getWorldPosition(v5); out.lerp(v5, 0.45); r = 0.07 * D.W; }
    else if (loc === 'shield') { out.set(0, this.shieldOff || 0, 0.06); n.shield.localToWorld(out); r = 0; }
    else { out.set(0, 0.21 * D.S, 0); n.chest.localToWorld(out); r = 0.115 * D.W; }
    if (from && r > 0) { v5.subVectors(from, out); v5.y *= 0.3; var l = v5.length(); if (l > 1e-4) out.addScaledVector(v5, r / l); }
    return out;
  };
  Figure.prototype.headTop = function (out) { out.set(0, 0.3 * this.D.S, 0); this.n.head.localToWorld(out); return out; };
  Figure.prototype.setSelected = function (on) {
    if (!this.ring) return;
    this.ring.material.color.set(on ? 0xffe08a : V.TEAM[this.team].ring); this.ring.material.opacity = on ? 1 : 0.75;
    this.ring.scale.setScalar(on ? 1.25 : 1);
  };
  Figure.prototype.setRingVisible = function (v) { if (this.ring) this.ring.visible = v; };

})(window.G = window.G || {});

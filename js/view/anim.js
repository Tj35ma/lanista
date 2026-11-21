// LANISTA — chuyển động: thế thủ theo vũ khí, đòn đánh ngắm vào đúng đối thủ, phản ứng, ngã gục.
// Mọi tư thế là một bộ số trong "khung gốc" (gốc ở mặt đất dưới thân, +Z = hướng mặt, +X = bên trái).
// Mọi động tác bắt đầu từ ảnh chụp tư thế hiện tại và kết thúc ở thế thủ → không giật.
(function (G) {
  'use strict';
  var T = THREE, V = G.V, PI = Math.PI;
  var A = V.Anim = {};
  var F3 = ['hip', 'hr', 'ch', 'rh', 'rd', 'rp', 'rhint', 'lh', 'ld', 'lp', 'lhint', 'rf', 'lf'], F2 = ['hd'], F1 = ['lg', 'lgw', 'kneeUp', 'wvis', 'footPitch', 'ws'];
  var POSF = ['hip', 'rh', 'lh'];

  var BASE = {
    hip: [0, 0.88, 0], hr: [-0.3, 0.06, 0], ch: [-0.12, 0.1, 0], hd: [0.4, 0],
    rh: [-0.26, 1.02, 0.2], rd: [0.12, 0.45, 0.88], rp: [-0.6, -0.5, -0.6], rhint: [0, -0.3, 1],
    lh: [0.2, 1.18, 0.3], ld: [0, 1, 0.15], lp: [0.6, -0.7, -0.25], lhint: [0.2, 0, 1],
    lg: 0, lgw: 0, rf: [-0.15, -0.22, -0.6], lf: [0.13, 0.24, 0.1], kneeUp: 0, wvis: 1, footPitch: 0, ws: 0
  };
  var ST = {
    fist: { hr: [-0.35, 0.08, 0], rh: [-0.15, 1.33, 0.26], rd: [0.1, 0.9, 0.3], lh: [0.13, 1.36, 0.37], ld: [-0.1, 0.9, 0.3], rp: [-0.5, -0.8, -0.2], lp: [0.5, -0.8, -0.1] },
    gladius: {},
    sica: { rh: [-0.3, 1.12, 0.18], rd: [0.3, 0.8, 0.5] },
    mace: { rh: [-0.29, 1.2, 0.1], rd: [0.08, 0.92, -0.36], rp: [-0.7, -0.5, -0.4] },
    hasta: { rh: [-0.28, 1.52, -0.05], rd: [0.06, -0.12, 0.99], rp: [-1, 0.25, -0.3], rhint: [1, 0, 0] },
    trident: { hr: [-0.5, 0.08, 0], ch: [-0.15, 0.1, 0], hd: [0.6, 0], rh: [-0.27, 0.98, -0.05], rd: [0.3, 0.1, 0.95], rp: [-0.6, -0.3, -0.8], lg: 0.45, lgw: 1, lp: [0.5, -0.8, 0.1], rhint: [1, 0, 0] },
    twin: { rh: [-0.25, 1.1, 0.26], rd: [0.2, 0.75, 0.6], lh: [0.27, 1.16, 0.34], ld: [-0.2, 0.75, 0.6], lhint: [0, -0.3, 1] },
    axe: { hr: [-0.4, 0.06, 0], rh: [-0.12, 1.2, 0.22], rd: [-0.25, 0.9, 0.1], lg: -0.43, lgw: 1, rp: [-0.8, -0.4, -0.3], lp: [0.6, -0.6, 0.2], rhint: [0.3, 0, 1] },
    javelin: { rh: [-0.3, 1.56, -0.12], rd: [0.03, 0.1, 0.99], rp: [-1, 0.2, -0.3], lh: [0.17, 1.3, 0.42], rhint: [1, 0, 0] }
  };
  ST.bow = { rh: [-0.16, 1.2, 0.4], rd: [0.08, 0.98, 0.18], rhint: [0.25, 0, 1], rp: [-0.8, -0.5, -0.2], lh: [0.14, 1.12, 0.3], ld: [0, 1, 0.2] };
  ST.crossbow = { rh: [-0.14, 1.08, 0.3], rd: [0.1, -0.12, 0.98], rhint: [0, 1, 0], rp: [-0.8, -0.5, -0.3], lg: 0.3, lgw: 1 };
  ST.caestus = ST.fist;
  var SHIELD = { lh: [0.21, 1.1, 0.33], ld: [0, 1, 0], lhint: [0.3, 0, 1], lp: [0.7, -0.6, -0.2] };
  var STUN = { hip: [0, 0.8, -0.03], hr: [-0.1, 0.3, 0.05], ch: [0, 0.36, 0.08], hd: [0.1, 0.45], rh: [-0.3, 0.72, 0.2], rd: [0.2, -0.62, 0.75], lh: [0.3, 0.76, 0.22], ld: [0, 1, 0.1], lgw: 0 };
  var NET = { hip: [0, 0.74, 0], hr: [-0.1, 0.26, 0], ch: [0, 0.3, 0], hd: [0.2, 0.2], rh: [-0.27, 0.95, 0.22], lh: [0.25, 1.0, 0.26], lgw: 0 };
  var STAND = { hip: [0, 0.935, 0], hr: [0, 0, 0], ch: [0, 0.02, 0], hd: [0, 0.04], rh: [-0.27, 0.84, 0.05], rd: [0.1, -0.9, 0.42], rp: [-0.5, -0.5, -0.7], lh: [0.27, 0.84, 0.05], ld: [0, 1, 0.2], lp: [0.5, -0.5, -0.7], rf: [-0.1, -0.02, -0.14], lf: [0.1, 0.02, 0.14], lgw: 0 };
  var STAND_LONG = { rh: [-0.3, 1.0, 0.14], rd: [0, 1, 0], rp: [-0.6, -0.6, -0.5] };
  var STAND_SHIELD = { lh: [0.3, 0.98, 0.08], ld: [0, 1, 0], lhint: [0.7, 0, 0.7] };
  var BOUND = { rh: [-0.055, 0.87, 0.17], rd: [0.3, 0.6, 0.74], lh: [0.055, 0.87, 0.17], ld: [-0.3, 0.6, 0.74], rp: [-0.9, -0.3, -0.3], lp: [0.9, -0.3, -0.3], hd: [0, 0.16], ch: [0, 0.07, 0] };
  var RUN = { hip: [0, 0.9, 0.02], hr: [0, 0.14, 0], ch: [0, 0.12, 0], hd: [0, -0.05], rf: [-0.1, 0, 0], lf: [0.1, 0, 0] };
  var LIE_BACK = { hip: [0, 0.14, -0.4], hr: [0.15, -1.47, 0], ch: [0, -0.06, 0.05], hd: [0.5, -0.1], rh: [-0.6, 0.06, -0.55], rd: [-0.5, 0.02, 0.86], rhint: [0, 1, 0], lh: [0.55, 0.06, -0.9], ld: [0.3, 0, -0.95], lhint: [0, 1, 0], rf: [-0.2, 0.42, -0.4], lf: [0.2, 0.2, 0.5], kneeUp: 1, lgw: 0, rp: [-1, 0.3, 0], lp: [1, 0.3, 0] };
  var LIE_FRONT = { hip: [0, 0.13, 0.45], hr: [-0.1, 1.47, 0], ch: [0, 0.05, 0], hd: [0.7, 0.1], rh: [-0.45, 0.06, 1.25], rd: [-0.3, 0, 0.95], rhint: [0, 1, 0], lh: [0.4, 0.06, 0.98], ld: [0.2, 0, 0.98], lhint: [0, 1, 0], rf: [-0.14, -0.38, 0.2], lf: [0.14, -0.38, -0.2], lgw: 0, rp: [-1, 0.3, 0], lp: [1, 0.3, 0], footPitch: 1.2 };

  function clonePose(p) { var o = {}, i; for (i = 0; i < F3.length; i++) { var a = p[F3[i]]; o[F3[i]] = [a[0], a[1], a[2]]; } o.hd = [p.hd[0], p.hd[1]]; for (i = 0; i < F1.length; i++) o[F1[i]] = p[F1[i]]; return o; }
  function copyPose(p, o) { var i, a, b; for (i = 0; i < F3.length; i++) { a = p[F3[i]]; b = o[F3[i]]; b[0] = a[0]; b[1] = a[1]; b[2] = a[2]; } o.hd[0] = p.hd[0]; o.hd[1] = p.hd[1]; for (i = 0; i < F1.length; i++) o[F1[i]] = p[F1[i]]; return o; }
  function lerpPose(a, b, t, o) {
    var i, x, y, z, k;
    for (i = 0; i < F3.length; i++) { k = F3[i]; x = a[k]; y = b[k]; z = o[k]; z[0] = x[0] + (y[0] - x[0]) * t; z[1] = x[1] + (y[1] - x[1]) * t; z[2] = x[2] + (y[2] - x[2]) * t; }
    o.hd[0] = a.hd[0] + (b.hd[0] - a.hd[0]) * t; o.hd[1] = a.hd[1] + (b.hd[1] - a.hd[1]) * t;
    for (i = 0; i < F1.length; i++) { k = F1[i]; o[k] = a[k] + (b[k] - a[k]) * t; }
    return o;
  }
  // gộp tư thế viết tay (tỉ lệ 1) lên một tư thế đầy đủ đã nhân tỉ lệ
  function over(fig, base, part) {
    var o = clonePose(base), S = fig.D.S, k;
    for (k in part) {
      var v = part[k];
      if (typeof v === 'number') o[k] = v;
      else if (POSF.indexOf(k) >= 0) o[k] = [v[0] * S, v[1] * S, v[2] * S];
      else if (k === 'rf' || k === 'lf') o[k] = [v[0] * S * fig.wide, v[1] * S, v[2]];
      else o[k] = v.slice();
    }
    return o;
  }
  function ease(kind, t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); if (kind === 'in') return t * t; if (kind === 'out') return 1 - (1 - t) * (1 - t); if (kind === 'lin') return t; return t * t * (3 - 2 * t); }

  // ---------------------------------------------------------------- Khởi tạo
  A.init = function (fig) {
    fig.anim = true; fig.clip = null; fig.rx = []; fig.state = 'stance'; fig.hold = null; fig.phase = Math.random() * 6.28; fig.runW = 0; fig.time = 0;
    A.refresh(fig);
    fig.cur = clonePose(fig.stance); fig.R = clonePose(fig.stance); fig.tmpA = clonePose(fig.stance); fig.tmpB = clonePose(fig.stance);
    fig.hand = [{ p: new T.Vector3(), d: new T.Vector3(), hint: new T.Vector3(), pole: new T.Vector3() }, { p: new T.Vector3(), d: new T.Vector3(), hint: new T.Vector3(), pole: new T.Vector3() }];
    A.snap(fig);
  };
  A.refresh = function (fig) {
    fig.wide = fig.D.body === 'big' ? 1.18 : (fig.D.body === 'agi' ? 0.95 : 1.05);
    var zero = clonePose(BASE); // BASE chưa nhân tỉ lệ → dùng over với part = BASE
    var st = over(fig, zero, BASE);
    st = over(fig, st, ST[fig.kind] || {});
    if (fig.hasShield) st = over(fig, st, SHIELD);
    fig.stance = st;
    fig.pStun = over(fig, st, STUN); fig.pNet = over(fig, st, NET); fig.pRun = over(fig, st, RUN);
    var sd = over(fig, st, STAND);
    if (fig.kind === 'hasta' || fig.kind === 'trident' || fig.kind === 'axe' || fig.kind === 'javelin' || fig.kind === 'bow') sd = over(fig, sd, STAND_LONG);
    if (fig.kind === 'fist' || fig.kind === 'caestus') sd = over(fig, sd, { rd: [0, 1, 0.2] });
    if (fig.hasShield) sd = over(fig, sd, STAND_SHIELD);
    fig.pStand = fig.opts.bound ? over(fig, sd, BOUND) : sd;
  };
  A.snap = function (fig) {
    if (!fig.cur) return;
    copyPose(fig.hold || (fig.state === 'stand' ? fig.pStand : fig.stance), fig.cur); fig.clip = fig.hold ? fig.clip : null; fig.rx.length = 0;
    fig.stepFeet(0, [fig.cur.rf, fig.cur.lf], true);
    A.update(fig, 0);
  };

  // ---------------------------------------------------------------- Ngắm
  var S0 = new T.Vector3(), SK = new T.Vector3(), TT = new T.Vector3(), HH = new T.Vector3(), DD = new T.Vector3(), OO = new T.Vector3(), NN = new T.Vector3(), FW = new T.Vector3(), LF = new T.Vector3(), tv = new T.Vector3();
  var arr = [0, 0, 0];
  function targetPoint(fig, c, side, out) {
    if (c.frozen) return out.copy(c.frozen);
    if (c.tf) {
      if (c.loc === 'armL') { out.copy(c.tf.sh[1]); out.y += 0.07; }
      else c.tf.point(c.loc, fig.sh[side], out);
    } else fig.toWorld(0, 1.2, 1.2, out);
    if (c.freezeAt != null && fig.clip && fig.clip.t >= c.freezeAt) c.frozen = out.clone();
    return out;
  }
  function doAim(fig, a, pose) {
    var side = a.side, D = fig.D, arm = D.arm, b = fig.base;
    FW.set(Math.sin(b.face), 0, Math.cos(b.face)); LF.set(Math.cos(b.face), 0, -Math.sin(b.face));
    var curZ = fig.cur.hip[2] - fig.stance.hip[2];
    S0.copy(fig.sh[side]).addScaledVector(FW, -curZ);
    targetPoint(fig, a.c, side, TT);
    var L = a.L, lunge = 0, short, dist, r, cL;
    var sgn = side === 0 ? -1 : 1;
    if (a.type === 'thrust') {
      var dy = a.over ? 0.1 : -(a.drop != null ? a.drop : 0.16);
      OO.copy(S0); OO.y += dy * D.S;
      DD.subVectors(TT, OO).normalize(); HH.copy(TT).addScaledVector(DD, -L * 0.96);
      short = HH.distanceTo(S0) - arm * 0.9;
      lunge = V.clamp(short + 0.03, 0, a.lunge);
      SK.copy(S0).addScaledVector(FW, lunge);
      OO.copy(SK); OO.y += dy * D.S;
      DD.subVectors(TT, OO).normalize(); HH.copy(TT).addScaledVector(DD, -L * 0.96);
      tv.subVectors(HH, SK); r = tv.length();
      if (r > arm * 0.97) HH.copy(SK).addScaledVector(tv, arm * 0.97 / r);
      else if (r < 0.2) { if (r < 1e-3) tv.copy(DD).negate(); HH.copy(SK).addScaledVector(tv.normalize(), 0.2); }
      tv.subVectors(TT, HH); if (tv.lengthSq() > 1e-4) DD.copy(tv).normalize();
    } else if (a.type === 'slash') {
      cL = L * (a.cf || 0.9);
      dist = TT.distanceTo(S0);
      short = (dist - cL * 0.95) - arm * 0.88;
      lunge = V.clamp(short + 0.03, 0, a.lunge);
      SK.copy(S0).addScaledVector(FW, lunge);
      NN.subVectors(TT, SK); dist = NN.length(); NN.multiplyScalar(1 / dist);
      r = V.clamp(dist - cL * 0.95, 0.22, arm * 0.95);
      if (a.over) NN.y += 0.45; else { NN.y += 0.22; NN.addScaledVector(LF, sgn * (a.back ? -0.35 : 0.25)); }
      HH.copy(SK).addScaledVector(NN.normalize(), r);
      DD.subVectors(TT, HH).normalize();
    } else if (a.type === 'punch') {
      dist = TT.distanceTo(S0); short = dist - arm * 0.93;
      lunge = V.clamp(short + 0.03, 0, a.lunge);
      SK.copy(S0).addScaledVector(FW, lunge);
      NN.subVectors(TT, SK); dist = NN.length(); NN.multiplyScalar(1 / dist);
      HH.copy(TT).addScaledVector(NN, -0.045);
      tv.subVectors(HH, SK); r = tv.length(); if (r > arm * 0.97) HH.copy(SK).addScaledVector(tv, arm * 0.97 / r);
      if (a.under) DD.set(NN.x * 0.3, 1, NN.z * 0.3).normalize(); else DD.set(NN.x * 0.6, 0.8, NN.z * 0.6).normalize();
    } else { // throw: giữ vị trí tay, chỉ ngắm hướng
      fig.toWorld(pose.rh[0], pose.rh[1], pose.rh[2], HH);
      DD.subVectors(TT, HH); DD.y += DD.length() * 0.06; DD.normalize();
      fig.dirToBase(DD, arr); pose.rd[0] = arr[0]; pose.rd[1] = arr[1]; pose.rd[2] = arr[2];
      return;
    }
    var hk = side === 0 ? 'rh' : 'lh', dk = side === 0 ? 'rd' : 'ld';
    fig.toBase(HH, arr); pose[hk][0] = arr[0]; pose[hk][1] = arr[1]; pose[hk][2] = arr[2];
    fig.dirToBase(DD, arr); pose[dk][0] = arr[0]; pose[dk][1] = arr[1]; pose[dk][2] = arr[2];
    pose.hip[2] = fig.stance.hip[2] + lunge;
    return lunge;
  }
  function resolveKey(fig, key, out) {
    copyPose(key.p, out);
    if (key.aim) for (var i = 0; i < key.aim.length; i++) doAim(fig, key.aim[i], out);
    return out;
  }

  // ---------------------------------------------------------------- Clip
  function Clip(fig) { this.fig = fig; this.keys = [{ t: 0, p: clonePose(fig.cur), ease: 'lin' }]; this.t = 0; this.i = 0; this.wins = []; }
  // nút đang vung (wR / wL / hand0 / hand1) tại thời điểm hiện tại của clip, hoặc null
  A.strikeNode = function (fig) {
    var c = fig.clip; if (!c || fig.dead || fig.beast) return null;
    for (var i = 0; i < c.wins.length; i++) if (c.t >= c.wins[i].t0 && c.t <= c.wins[i].t1) return c.wins[i].node;
    return null;
  };
  Clip.prototype.k = function (t, part, es, aim, from) {
    var last = this.keys[this.keys.length - 1];
    if (t <= last.t + 0.01) t = last.t + 0.01;
    this.keys.push({ t: t, p: over(this.fig, from || this.fig.stance, part || {}), ease: es || 'io', aim: aim || null });
    return this;
  };
  Clip.prototype.end = function () { this.dur = this.keys[this.keys.length - 1].t; return this; };
  A.play = function (fig, clip) { clip.end(); fig.clip = clip; };

  function evalClip(fig, dt) {
    var c = fig.clip; c.t += dt;
    var ks = c.keys;
    while (c.i < ks.length - 2 && c.t >= ks[c.i + 1].t) c.i++;
    var k0 = ks[c.i], k1 = ks[c.i + 1];
    var u = ease(k1.ease, (c.t - k0.t) / (k1.t - k0.t));
    resolveKey(fig, k0, fig.tmpA); resolveKey(fig, k1, fig.tmpB);
    lerpPose(fig.tmpA, fig.tmpB, u, fig.cur);
    if (c.t >= c.dur) { if (c.hold) fig.hold = clonePose(fig.cur); fig.clip = null; }
  }

  // ---------------------------------------------------------------- Dựng đòn đánh từ sự kiện mô phỏng
  function ctxOf(tf, h) {
    return { tf: tf, loc: h.out === 'block' ? (h.arm ? 'armL' : 'shield') : h.loc, frozen: null, freezeAt: h.out === 'dodge' ? h.at - 0.12 : null };
  }
  var CL = {
    gladius: {
      cock: { rh: [-0.3, 1.0, -0.06], rd: [0.1, 0.25, 0.96], hr: [-0.52, 0.06, 0], ch: [-0.25, 0.1, 0], hip: [0, 0.87, -0.03] },
      imp: { hr: [-0.02, 0.1, 0], ch: [0.28, 0.16, 0], hip: [0, 0.84, 0.06], hd: [-0.15, 0] },
      re: { rh: [-0.28, 1.02, 0.04], rd: [0.1, 0.3, 0.95], hr: [-0.3, 0.08, 0], ch: [0, 0.12, 0], hip: [0, 0.85, 0.05] },
      aim: { type: 'thrust', L: 0.62, lunge: 0.3 }
    },
    hasta: {
      cock: { rh: [-0.3, 1.6, -0.3], rd: [0.04, -0.08, 0.99], hr: [-0.5, 0.04, 0], ch: [-0.3, 0.05, 0], hip: [0, 0.88, -0.05] },
      imp: { hr: [-0.05, 0.12, 0], ch: [0.25, 0.2, 0], hip: [0, 0.84, 0.08], hd: [-0.15, 0.05] },
      aim: { type: 'thrust', L: 1.2, over: true, lunge: 0.32 }
    },
    trident: {
      cock: { rh: [-0.3, 0.98, -0.32], rd: [0.28, 0.1, 0.95], hr: [-0.62, 0.08, 0], ch: [-0.25, 0.1, 0], lg: 0.5 },
      imp: { hr: [-0.2, 0.14, 0], ch: [0.2, 0.2, 0], hip: [0, 0.82, 0.08], hd: [0.1, 0.05], lg: 0.3 },
      aim: { type: 'thrust', L: 1.63, drop: 0.34, lunge: 0.32 }
    },
    jstab: {
      cock: { rh: [-0.3, 1.5, -0.25], rd: [0.03, -0.15, 0.98], hr: [-0.5, 0.04, 0], ch: [-0.3, 0.05, 0] },
      imp: { hr: [-0.05, 0.12, 0], ch: [0.25, 0.2, 0], hip: [0, 0.84, 0.08], hd: [-0.15, 0.05] },
      aim: { type: 'thrust', L: 0.77, over: true, lunge: 0.3 }
    },
    sica: {
      cock: { rh: [-0.36, 1.5, -0.02], rd: [-0.3, 0.72, -0.62], hr: [-0.5, 0.05, 0], ch: [-0.35, 0.05, 0], rp: [-1, -0.2, -0.3] },
      imp: { hr: [0, 0.1, 0], ch: [0.35, 0.18, 0], hip: [0, 0.85, 0.06], hd: [-0.2, 0] },
      follow: { rh: [0.12, 0.88, 0.38], rd: [0.75, -0.45, 0.5], ch: [0.5, 0.2, 0], hr: [0.05, 0.1, 0] },
      aim: { type: 'slash', L: 0.6, lunge: 0.28 }
    },
    hookshield: {
      cock: { rh: [0.12, 1.3, 0.2], rd: [0.8, 0.45, 0.35], hr: [-0.1, 0.06, 0], ch: [0.3, 0.1, 0] },
      imp: { hr: [-0.35, 0.1, 0], ch: [-0.2, 0.15, 0], hip: [0, 0.85, 0.08] },
      follow: { rh: [-0.4, 1.05, 0.3], rd: [-0.7, 0.2, 0.7] },
      aim: { type: 'slash', L: 0.6, lunge: 0.28, back: true }
    },
    mace: {
      cock: { rh: [-0.3, 1.72, -0.12], rd: [0, 0.5, -0.86], hr: [-0.42, 0, 0], ch: [-0.2, -0.12, 0], rp: [-1, 0.1, -0.2], hip: [0, 0.9, -0.03] },
      imp: { hr: [-0.05, 0.14, 0], ch: [0.2, 0.32, 0], hip: [0, 0.82, 0.06], hd: [-0.1, 0.1] },
      follow: { rh: [-0.1, 0.62, 0.5], rd: [0.1, -0.75, 0.65], ch: [0.25, 0.4, 0], hip: [0, 0.8, 0.1] },
      aim: { type: 'slash', L: 0.7, over: true, lunge: 0.28 }
    },
    axe: {
      cock: { rh: [-0.24, 1.64, -0.14], rd: [-0.15, 0.58, -0.8], hr: [-0.55, 0, 0], ch: [-0.42, -0.08, 0], rp: [-1, 0.1, -0.2], hip: [0, 0.9, -0.04], ws: 0.12, lg: -0.34 },
      imp: { hr: [-0.05, 0.16, 0], ch: [0.38, 0.3, 0], hip: [0, 0.84, 0.08], hd: [-0.25, 0.1], ws: 0.3, lg: -0.18 },
      follow: { rh: [0.1, 0.6, 0.45], rd: [0.45, -0.6, 0.66], ch: [0.5, 0.4, 0], hip: [0, 0.82, 0.12], ws: 0.3, lg: -0.18 },
      aim: { type: 'slash', L: 1.15, cf: 0.9, over: true, lunge: 0.3 }
    },
    twinR: { cock: { rh: [-0.36, 1.44, 0], rd: [-0.3, 0.78, -0.55], ch: [-0.3, 0.08, 0] }, imp: { ch: [0.32, 0.15, 0], hr: [-0.1, 0.08, 0], hip: [0, 0.85, 0.05], hd: [0, 0] }, aim: { type: 'slash', L: 0.44, lunge: 0.26 } },
    twinL: { cock: { lh: [0.38, 1.44, 0.05], ld: [0.3, 0.78, -0.55], ch: [0.25, 0.08, 0] }, imp: { ch: [-0.42, 0.15, 0], hr: [-0.42, 0.08, 0], hip: [0, 0.85, 0.06], hd: [0.7, 0] }, aim: { type: 'slash', L: 0.44, lunge: 0.26, side: 1 } },
    punchR: { cock: { rh: [-0.2, 1.3, 0.1], ch: [-0.3, 0.1, 0] }, imp: { ch: [0.42, 0.14, 0], hr: [-0.05, 0.08, 0], hip: [0, 0.86, 0.06], hd: [-0.3, 0] }, aim: { type: 'punch', L: 0, lunge: 0.28 } },
    punchL: { cock: { lh: [0.14, 1.34, 0.22], ch: [0.1, 0.1, 0] }, imp: { ch: [-0.32, 0.12, 0], hr: [-0.45, 0.08, 0], hip: [0, 0.86, 0.06], hd: [0.65, 0] }, aim: { type: 'punch', L: 0, lunge: 0.26, side: 1 } },
    hook: { cock: { rh: [-0.24, 0.95, 0.16], rd: [0.1, 0.6, 0.8], hip: [0, 0.78, 0.02], ch: [-0.38, 0.22, 0] }, imp: { hip: [0, 0.91, 0.06], ch: [0.42, -0.06, 0], hr: [0, 0.02, 0], hd: [-0.3, -0.1] }, aim: { type: 'punch', L: 0, lunge: 0.3, under: true } }
  };
  function mkAim(spec, c) { var a = {}; for (var k in spec) a[k] = spec[k]; a.side = spec.side || 0; a.c = c; return a; }

  // một chuỗi đòn bằng cùng một kiểu (đâm / chém / đấm)
  function seq(fig, ev, tf, pick) {
    var c = new Clip(fig), hits = ev.hits, prev = 0, i;
    for (i = 0; i < hits.length; i++) {
      var h = hits[i], S = pick(h, i), miss = h.out === 'dodge', cx = ctxOf(tf, h), aim = [mkAim(S.aim, cx)];
      var ct = i === 0 ? h.at * (S.cockAt || 0.52) : prev + (h.at - prev) * 0.5;
      c.k(ct, (i > 0 && S.re) ? S.re : S.cock, i === 0 ? 'io' : 'out');
      c.k(h.at, S.imp, 'in', aim);
      var fistK = fig.kind === 'fist' || fig.kind === 'caestus';
      c.wins.push({ t0: ct - 0.01, t1: h.at + 0.035, node: aim[0].side === 1 ? (fistK ? 'hand1' : 'wL') : (fistK ? 'hand0' : 'wR') });
      if (i === 0) { // đoán trước độ lao người để chân trước bước sớm, chân sau kéo theo
        var probe = clonePose(c.keys[c.keys.length - 1].p), lg = doAim(fig, mkAim(S.aim, { tf: tf, loc: cx.loc, frozen: null, freezeAt: null }), probe) || 0;
        c.lunge = lg;
      }
      var kk = c.keys;
      kk[kk.length - 2].p.lf[1] += c.lunge * 0.8; kk[kk.length - 1].p.lf[1] += c.lunge * 0.85; kk[kk.length - 1].p.rf[1] += c.lunge * 0.45;
      if (i === hits.length - 1) {
        var rec = Math.max(0.26, ev.recover);
        if (miss && S.follow) { c.k(h.at + 0.13, S.follow, 'out'); c.k(h.at + rec + 0.1, {}, 'io'); }
        else { if (!miss) { c.k(h.at + 0.075, S.imp, 'lin', aim); var kl = c.keys[c.keys.length - 1].p; kl.lf[1] += c.lunge * 0.85; kl.rf[1] += c.lunge * 0.45; } c.k(h.at + rec + (miss ? 0 : 0.05), {}, 'io'); }
      }
      prev = h.at;
    }
    return c;
  }

  A.attack = function (fig, ev, tf) {
    if (fig.dead) return;
    if (fig.beast) return fig.attack(ev);
    var kind = ev.kind, sp = ev.special, c, wu = ev.windup, rec = Math.max(0.26, ev.recover), h0 = ev.hits[0];
    if (sp === 'net') {
      c = new Clip(fig);
      c.k(wu * 0.55, { lgw: 0, lh: [0.3, 0.95, -0.12], ld: [0, 1, 0], ch: [0.3, 0.05, 0], rh: [-0.3, 1.05, 0], rd: [0.1, 0.9, 0.4] }, 'io');
      c.k(wu, { lgw: 0, lh: [0.22, 1.5, 0.55], ld: [0, 0.6, 0.8], ch: [-0.5, 0.15, 0], hr: [-0.6, 0.1, 0], hip: [0, 0.85, 0.08], rh: [-0.3, 1.05, 0], rd: [0.1, 0.9, 0.4] }, 'in');
      c.k(wu + rec + 0.2, {}, 'io');
    } else if (sp === 'sweep') {
      c = new Clip(fig);
      c.k(wu * 0.55, { rh: [-0.42, 1.18, -0.12], rd: [-0.86, 0.12, -0.5], hr: [-0.7, 0.05, 0], ch: [-0.5, 0.05, 0], rp: [-0.6, -0.6, -0.5], hip: [0, 0.86, -0.03] }, 'io');
      c.k(wu, { rh: [0, 1.12, 0.5], rd: [0.1, 0, 0.99], hr: [0, 0.1, 0], ch: [0.25, 0.12, 0], hip: [0, 0.84, 0.1], hd: [-0.2, 0] }, 'in');
c.k(wu + 0.16, { rh: [0.3, 1.08, 0.3], rd: [0.92, -0.08, 0.38], hr: [0.3, 0.1, 0], ch: [0.55, 0.12, 0], hip: [0, 0.84, 0.1], hd: [-0.6, 0] }, 'lin');
      c.wins.push({ t0: wu * 0.55, t1: wu + 0.17, node: 'wR' });
      c.k(wu + rec + 0.2, {}, 'io');
    } else if (kind === 'javelin' && !ev.melee) {
      c = new Clip(fig);
      var cx = ctxOf(tf, h0); cx.loc = h0.loc; cx.freezeAt = null;
      var rel = { rh: [-0.1, 1.7, 0.5], hr: [0, 0.12, 0], ch: [0.4, 0.2, 0], hip: [0, 0.85, 0.14], hd: [-0.3, 0], lf: [0.13, 0.4, 0.1] };
      c.k(wu * 0.55, { rh: [-0.32, 1.6, -0.42], rd: [0.02, 0.2, 0.98], hr: [-0.6, 0, 0], ch: [-0.4, -0.08, 0], hip: [0, 0.88, -0.08], hd: [0.75, 0] }, 'io');
      c.k(wu, rel, 'in', [{ type: 'throw', side: 0, c: cx }]);
      var rel2 = {}; for (var kk in rel) rel2[kk] = rel[kk]; rel2.wvis = 0;
      c.k(wu + 0.02, rel2, 'lin', [{ type: 'throw', side: 0, c: cx }]);
      c.k(wu + 0.2, { rh: [0.05, 1.1, 0.45], rd: [0.3, -0.6, 0.74], ch: [0.55, 0.25, 0], hip: [0, 0.85, 0.12], wvis: 0 }, 'out');
      c.k(wu + 0.52, { rh: [-0.2, 1.52, -0.28], rd: [0.2, 0.9, -0.3], wvis: 0 }, 'io');
      c.k(wu + 0.55, { rh: [-0.2, 1.52, -0.28], rd: [0.2, 0.9, -0.3], wvis: 1 }, 'lin');
      c.k(wu + 0.85, {}, 'io');
    } else if (kind === 'bow' && !ev.melee) {
      // giương cung về phía địch, tay kia kéo dây về má rồi buông; chiêu ba mũi thì kéo–buông ba lần
      c = new Clip(fig);
      var up = { rh: [-0.1, 1.42, 0.62], rd: [0, 1, 0], rhint: [0, 0, 1], lh: [0.0, 1.4, 0.38], ld: [0, 0.3, 0.95], hr: [-0.7, 0, 0], ch: [-0.5, 0, 0], hd: [0.9, 0], hip: [0, 0.9, 0] };
      var drawn = {}, loose = {}, bk; for (bk in up) { drawn[bk] = up[bk]; loose[bk] = up[bk]; }
      drawn.lh = [0.15, 1.45, -0.05]; loose.lh = [0.09, 1.42, 0.22];
      c.k(wu * 0.45, up, 'io');
      for (var bi = 0; bi < ev.hits.length; bi++) {
        var ha = ev.hits[bi].at;
        if (bi > 0) c.k(ha - 0.14, up, 'io');
        c.k(ha, drawn, 'in'); c.k(ha + 0.05, loose, 'out');
      }
      c.k(ev.hits[ev.hits.length - 1].at + rec + 0.18, {}, 'io');
    } else if (kind === 'crossbow' && !ev.melee) {
      // nâng nỏ lên vai, ngắm, bắn (giật nhẹ), rồi hạ xuống lên dây lại
      c = new Clip(fig);
      var cx2 = ctxOf(tf, h0); cx2.loc = h0.loc; cx2.freezeAt = null;
      var aimP = { rh: [-0.12, 1.4, 0.34], rd: [0, 0, 1], rhint: [0, 1, 0], lg: 0.3, lgw: 1, hr: [-0.25, 0, 0], ch: [-0.2, 0, 0], hd: [0.3, 0], hip: [0, 0.9, 0.02] };
      var kick = {}, ck; for (ck in aimP) kick[ck] = aimP[ck]; kick.rh = [-0.12, 1.44, 0.26];
      c.k(wu * 0.6, aimP, 'io', [{ type: 'throw', side: 0, c: cx2 }]);
      c.k(wu, aimP, 'lin', [{ type: 'throw', side: 0, c: cx2 }]);
      c.k(wu + 0.07, kick, 'out');
      c.k(wu + 0.07 + rec * 0.5, { rh: [-0.1, 0.98, 0.3], rd: [0.05, -0.75, 0.66], rhint: [0, 0.66, 0.75], lgw: 0, lh: [0.06, 0.93, 0.44], ld: [0, 0.6, 0.8], hip: [0, 0.86, 0.04], ch: [0.1, 0.25, 0] }, 'io');
      c.k(wu + 0.07 + rec * 0.85, { rh: [-0.1, 0.98, 0.3], rd: [0.05, -0.75, 0.66], rhint: [0, 0.66, 0.75], lgw: 0, lh: [0.04, 1.12, 0.3], ld: [0, 0.6, 0.8], hip: [0, 0.9, 0.02] }, 'io');
      c.k(wu + rec + 0.32, {}, 'io');
    } else if (kind === 'twin') {
      c = seq(fig, ev, tf, function (h) { return h.hand ? CL.twinL : CL.twinR; });
    } else if (kind === 'fist' || kind === 'caestus') {
      c = seq(fig, ev, tf, function (h) { return sp === 'hook' ? CL.hook : (h.hand ? CL.punchL : CL.punchR); });
    } else {
      var S = sp === 'hookshield' ? CL.hookshield : (G.WKIND[kind].ranged ? CL.jstab : CL[kind]);
      if (sp === 'pierce') S = { cock: S.cock, imp: { hr: [-0.05, 0.14, 0], ch: [0.3, 0.3, 0], hip: [0, 0.8, 0.1], hd: [-0.15, 0.05] }, aim: { type: 'thrust', L: 1.2, over: true, lunge: 0.5 } };
      c = seq(fig, ev, tf, function () { return S; });
    }
    A.play(fig, c);
  };

  // ---------------------------------------------------------------- Trạng thái và phản ứng
  A.setState = function (fig, st) { if (fig.dead) return; fig.state = st; };
  A.cancel = function (fig) { if (fig.beast) return fig.cancel(); if (fig.clip && !fig.dead) fig.clip = null; };
  A.react = function (fig, type, o) { if (fig.dead) return; if (fig.beast) return fig.react(type, o); o = o || {}; o.type = type; o.t = 0; fig.rx.push(o); };
  A.die = function (fig, from) {
    if (fig.dead) return;
    if (fig.beast) return fig.die(from);
    fig.toBase(from || tv.set(fig.base.x, 0, fig.base.z + 1), arr);
    var back = arr[2] >= 0;   // kẻ đánh ở phía trước → ngã ngửa
    var c = new Clip(fig), side = (Math.random() < 0.5 ? 1 : -1) * 0.25;
    fig.dead = true; fig.rx.length = 0; fig.state = 'dead';
    if (back) {
      c.k(0.24, { hip: [side * 0.2, 0.62, -0.12], hr: [side, -0.38, 0.1], ch: [0, -0.2, 0], hd: [0, -0.3], rh: [-0.42, 0.9, 0.1], rd: [0.3, -0.3, 0.9], lh: [0.42, 1.0, 0], lgw: 0 }, 'out');
      var lb = {}; for (var k in LIE_BACK) lb[k] = LIE_BACK[k]; lb.hr = [0.15 + side, -1.47, 0]; lb.hip = [side * 0.3, 0.14, -0.4];
      c.k(0.66, lb, 'in');
    } else {
      c.k(0.26, { hip: [side * 0.2, 0.6, 0.12], hr: [side, 0.5, 0], ch: [0, 0.3, 0], hd: [0, 0.3], rh: [-0.35, 0.7, 0.4], rd: [0.2, -0.4, 0.9], lh: [0.35, 0.7, 0.4], lgw: 0 }, 'out');
      var lf = {}; for (var k2 in LIE_FRONT) lf[k2] = LIE_FRONT[k2]; lf.hr = [-0.1 + side, 1.47, 0];
      c.k(0.68, lf, 'in');
    }
    c.hold = true; A.play(fig, c);
  };

  function env(t, a, h, r) { return t < a ? t / a : (t < a + h ? 1 : Math.max(0, 1 - (t - a - h) / r)); }
  var PB = new T.Vector3(), PA = new T.Vector3();
  function applyReactions(fig, R, dt) {
    for (var i = fig.rx.length - 1; i >= 0; i--) {
      var x = fig.rx[i]; x.t += dt; var e, p = x.power || 1;
      if (x.from) fig.toBase(PA.copy(x.from), arr);
      var az = x.from ? arr[2] : 1, ax = x.from ? arr[0] : 0, al = Math.sqrt(ax * ax + az * az) || 1; ax /= al; az /= al;
      if (x.type === 'flinch') {
        e = x.t < 0.05 ? x.t / 0.05 : Math.exp(-(x.t - 0.05) * 7.5);
        R.ch[1] -= 0.3 * p * e * az; R.ch[0] += 0.28 * p * e * ax; R.hd[1] -= 0.28 * p * e * az; R.hd[0] += 0.3 * p * e * ax;
        R.hip[2] -= 0.05 * p * e * az; R.hip[0] -= 0.05 * p * e * ax; R.hip[1] -= 0.025 * p * e;
        R.rh[1] -= 0.05 * e; R.lh[1] -= 0.04 * e;
        if (x.t > 0.7) fig.rx.splice(i, 1);
      } else if (x.type === 'dodge') {
        e = env(x.t, 0.1, 0.12, 0.3); var sd = x.side || 1;
        R.hip[0] += sd * 0.1 * e; R.ch[2] += sd * 0.26 * e; R.ch[1] -= 0.22 * e * az; R.hip[1] -= 0.05 * e; R.hd[1] -= 0.1 * e;
        if (x.t > 0.52) fig.rx.splice(i, 1);
      } else if (x.type === 'block') {
        var lead = Math.max(0.06, x.lead || 0.12);
        e = V.smooth(env(x.t, lead, 0.14, 0.28));
        if (x.arm || !fig.hasShield) {
          R.ch[0] -= 0.3 * e; R.lh[0] += (0.12 * fig.D.S - R.lh[0] * 0.3) * e; R.lh[1] += (1.42 * fig.D.S - R.lh[1]) * e; R.lh[2] += (0.3 * fig.D.S - R.lh[2]) * e;
        } else {
          // đưa tâm khiên ra chắn giữa đòn đánh và chỗ bị nhắm
          fig.point(x.loc === 'legs' ? 'legs' : (x.loc === 'head' ? 'head' : 'body'), null, PB);
          PA.copy(x.from); PA.y = PB.y; PA.sub(PB).normalize();
          PB.addScaledVector(PA, 0.34); PB.y -= (fig.shieldOff || 0) - (x.loc === 'head' ? 0.05 : 0);
          fig.toBase(PB, arr);
          R.lh[0] += (arr[0] - R.lh[0]) * e; R.lh[1] += (arr[1] - R.lh[1]) * e; R.lh[2] += (arr[2] - R.lh[2]) * e;
          fig.dirToBase(PA, arr); R.lhint[0] += (arr[0] - R.lhint[0]) * e; R.lhint[1] += (arr[1] - R.lhint[1]) * e; R.lhint[2] += (arr[2] - R.lhint[2]) * e;
          if (x.t > lead && x.t < lead + 0.2) { var k = Math.exp(-(x.t - lead) * 14); R.lh[2] -= 0.07 * k * az; R.ch[1] -= 0.06 * k; }
        }
        if (x.t > lead + 0.44) fig.rx.splice(i, 1);
      } else if (x.type === 'hooked') {
        e = env(x.t, 0.1, 0.5, 0.4); R.lh[0] += 0.3 * e; R.lh[2] -= 0.1 * e; R.lhint[0] += 0.9 * e; R.ch[0] += 0.2 * e;
        if (x.t > 1.0) fig.rx.splice(i, 1);
      } else fig.rx.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- Mỗi khung hình
  var TG = null, MOUNT_FEET = [[-0.27, 0.1, 0.1], [0.27, 0.1, -0.1]];
  A.update = function (fig, dt) {
    if (fig.beast) return fig.update(dt);
    var b = fig.base, D = fig.D, S = D.S, R = fig.R, i;
    if (fig.horse) {   // kỵ sĩ: ngựa chạy theo, người ngồi trên yên, ngựa ngã thì người rơi xuống đất
      fig.horse.update(b.x, b.z, b.face, dt, fig.dead, fig.state === 'stun' || fig.state === 'net');
      var sy = fig.mount === 'elephant' ? fig.horse.saddleY() : fig.horse.saddleY() - fig.stance.hip[1] + 0.04;   // trên voi: đứng trong tháp
      fig.y0 = fig.dead ? Math.max(0, fig.y0 - dt * 2.2) : sy;
    }
    fig.time += dt;
    // vận tốc thân
    if (dt > 0) {
      var vx = (b.x - fig.prev.x) / dt, vz = (b.z - fig.prev.z) / dt, kf = Math.min(1, dt * 14);
      fig.vel.x += (vx - fig.vel.x) * kf; fig.vel.z += (vz - fig.vel.z) * kf;
      fig.speed = Math.sqrt(fig.vel.x * fig.vel.x + fig.vel.z * fig.vel.z);
    }
    fig.prev.x = b.x; fig.prev.z = b.z;
    // tư thế nền
    if (fig.clip) evalClip(fig, dt);
    if (!fig.clip) {
      var tgt = fig.hold || (fig.state === 'stun' ? fig.pStun : (fig.state === 'net' ? fig.pNet : (fig.state === 'win' ? winPose(fig) : (fig.state === 'stand' ? fig.pStand : fig.stance))));
      if (!fig.hold && fig.state === 'stance') {
        // chạy thẳng tới thì xoay hông theo hướng chạy
        var fwd = (fig.vel.x * Math.sin(b.face) + fig.vel.z * Math.cos(b.face));
        var want = V.smooth((fwd - 1.3) / 1.4);
        fig.runW += (want - fig.runW) * Math.min(1, dt * 6);
        if (fig.runW > 0.01) { TG = fig.tg || (fig.tg = clonePose(fig.stance)); lerpPose(fig.stance, fig.pRun, fig.runW, TG); tgt = TG; }
      }
      if (dt > 0) lerpPose(fig.cur, tgt, fig.hold ? 1 : 1 - Math.exp(-dt * 11), fig.cur); else copyPose(tgt, fig.cur);
    }
    copyPose(fig.cur, R);
    if (!fig.dead) {
      var t = fig.time, br = Math.sin(t * 1.9 + fig.phase);
      R.ch[1] += br * 0.012; R.rh[1] += br * 0.006 * S; R.lh[1] += br * 0.005 * S;
      if (!fig.clip && fig.state === 'stance') { var sw = Math.sin(t * 0.9 + fig.phase * 1.7); R.hip[0] += sw * 0.012 * S; R.ch[2] += sw * 0.014; R.rd[1] += Math.sin(t * 1.3 + fig.phase) * 0.025; R.hd[0] += Math.sin(t * 0.6 + fig.phase * 2.3) * 0.05; }
      var sp = Math.min(1, fig.speed / 3);
      R.ch[1] += sp * 0.1 * (1 - fig.runW); R.hip[1] -= sp * 0.02 * S;
      R.hip[1] += (fig.feet[0].lift + fig.feet[1].lift) * 0.25;
      if (fig.state === 'stun' && !fig.clip) { R.ch[2] += Math.sin(t * 3.1) * 0.07; R.hip[0] += Math.sin(t * 2.3) * 0.03; R.hd[0] += Math.sin(t * 2.7) * 0.15; }
      if (fig.state === 'net' && !fig.clip) { R.ch[0] += Math.sin(t * 9) * 0.1; R.rh[0] += Math.sin(t * 11) * 0.04; R.lh[0] += Math.cos(t * 10) * 0.04; }
      applyReactions(fig, R, dt);
    }
    if (fig.horse && !fig.dead) fig.stepFeet(dt, fig.mount === 'elephant' ? [R.rf, R.lf] : MOUNT_FEET, true); else fig.stepFeet(dt, [R.rf, R.lf]);
    // tay → thế giới
    var H = fig.hand;
    fig.toWorld(R.rh[0], R.rh[1], R.rh[2], H[0].p); fig.dirToWorld(R.rd, H[0].d).normalize(); fig.dirToWorld(R.rhint, H[0].hint); fig.dirToWorld(R.rp, H[0].pole);
    fig.toWorld(R.lh[0], R.lh[1], R.lh[2], H[1].p); fig.dirToWorld(R.ld, H[1].d).normalize(); fig.dirToWorld(R.lhint, H[1].hint); fig.dirToWorld(R.lp, H[1].pole);
    if (R.lgw > 0.001) { // tay trái nắm cán vũ khí hai tay
      tv.copy(H[0].p).addScaledVector(H[0].d, R.lg * S);
      H[1].p.lerp(tv, R.lgw); H[1].d.lerp(H[0].d, R.lgw).normalize(); H[1].hint.lerp(H[0].hint, R.lgw);
    }
    R.hand = H;
    fig.solve(R, dt);
    if (!fig.dropped) { fig.n.wR.visible = R.wvis > 0.5; fig.n.wR.position.y = R.ws * S; }
  };
  var WP = null;
  function winPose(fig) {
    var t = fig.time, pump = Math.sin(t * 5 + fig.phase) * 0.07;
    var two = G.WKIND[fig.kind].hands === 2 && fig.kind !== 'twin' && fig.kind !== 'caestus';
    return over(fig, fig.stance, {
      hip: [0, 0.93, 0], hr: [-0.1, 0, 0], ch: [0, -0.1, 0], hd: [0.1, -0.25],
      rh: [-0.3, 1.86 + pump, 0.05], rd: [0.05, 1, 0.1], rp: [-1, 0, -0.2],
      lh: fig.hasShield ? [0.32, 1.4 + pump * 0.5, 0.25] : [0.3, 1.78 - pump, 0.06], ld: [0, 1, 0], lgw: 0, lg: two ? 0 : 0
    });
  }

})(window.G = window.G || {});

// LANISTA — âm thanh: mọi tiếng động đều được tổng hợp lúc chạy bằng Web Audio API (không có tệp âm thanh nào).
// API: G.Audio.unlock / setMuted / isMuted / setVolume / getVolume / play(name, opts) / crowd(level) / crowdSize(tier)
//      / cheer(amount) / gasp() / boo() / ambience(name|null)
(function (G) {
  'use strict';
  var A = G.Audio = {};
  var KEY = 'lanista_audio';

  var ctx = null, master = null, comp = null, sfxBus = null, crowdBus = null, ambBus = null;
  var bufs = {};                       // w: trắng 2 s, p: hồng, b: nâu
  var muted = false, volume = 0.8;
  var active = 0, lastPlay = {};
  var want = { amb: null, crowd: 0, tier: 0 };
  var crowd = null, crowdTimer = null;
  var bed = null, bedName = null;
  var pluckCache = {}, pluckCount = 0, shapeCurve = null;
  var listening = false;

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) { muted = !!saved.m; if (typeof saved.v === 'number') volume = Math.max(0, Math.min(1, saved.v)); }
  } catch (e) { }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ m: muted, v: volume })); } catch (e) { } }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function ok() { return !!ctx && ctx.state === 'running'; }

  // ---------------------------------------------------------------- Khởi tạo
  function makeBuffers() {
    var sr = ctx.sampleRate, i, n, d;
    // trắng 2 s
    n = Math.floor(sr * 2); bufs.w = ctx.createBuffer(1, n, sr); d = bufs.w.getChannelData(0);
    for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // hồng (Paul Kellet) 3,7 s — độ dài lệch nhau để vòng lặp không trùng pha
    n = Math.floor(sr * 3.7); bufs.p = ctx.createBuffer(1, n, sr); d = bufs.p.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, w;
    for (i = 0; i < n; i++) {
      w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    // nâu 4,3 s
    n = Math.floor(sr * 4.3); bufs.b = ctx.createBuffer(1, n, sr); d = bufs.b.getChannelData(0);
    var last = 0;
    for (i = 0; i < n; i++) { w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    // khử tiếng "tách" ở chỗ nối vòng lặp: trừ đi độ trôi tuyến tính để mẫu cuối khớp mẫu đầu
    var ks = ['p', 'b'];
    for (var k = 0; k < ks.length; k++) {
      d = bufs[ks[k]].getChannelData(0); n = d.length;
      var drift = d[n - 1] - d[0];
      for (i = 0; i < n; i++) d[i] -= drift * i / (n - 1);
    }
  }

  function init() {
    if (ctx) return true;
    var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
      crowdBus = ctx.createGain(); crowdBus.gain.value = 1.0; crowdBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0.7; ambBus.connect(master);
      makeBuffers();
      buildCrowd();
      applyCrowdSize(want.tier, true);
      applyCrowdLevel();
      if (want.amb) { bedName = null; setAmb(want.amb); }
      return true;
    } catch (e) { ctx = null; return false; }
  }

  A.unlock = function () {
    try {
      if (!init()) return;
      if (ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) ctx.resume();
      if (listening && typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', A.unlock, true); window.removeEventListener('keydown', A.unlock, true); listening = false;
      }
    } catch (e) { }
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    listening = true;
    window.addEventListener('pointerdown', A.unlock, true);
    window.addEventListener('keydown', A.unlock, true);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () {
      try { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) { }
    });
  }

  A.setMuted = function (m) {
    muted = !!m; persist();
    try { if (ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.03); } catch (e) { }
  };
  A.isMuted = function () { return muted; };
  A.setVolume = function (v) {
    volume = clamp(+v || 0, 0, 1); persist();
    try { if (ctx && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03); } catch (e) { }
  };
  A.getVolume = function () { return volume; };

  // ---------------------------------------------------------------- Viên gạch tổng hợp
  // bao hình: 0 → peak trong a giây, giữ hold, tắt dần trong d giây
  function env(param, t, a, peak, hold, d) {
    peak = Math.max(0.0002, peak);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
    if (hold > 0) param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + Math.max(0.005, d));
  }
  // tiếng ồn qua lọc. o: {buf, type, f, f2, ft, q, a, d, hold, g, rate}
  function nz(t, out, o) {
    var src = ctx.createBufferSource(); src.buffer = bufs[o.buf || 'w']; src.loop = true; src.playbackRate.value = o.rate || 1;
    var fl = ctx.createBiquadFilter(); fl.type = o.type || 'lowpass'; fl.Q.value = o.q != null ? o.q : 0.7;
    var a = o.a != null ? o.a : 0.002, d = o.d != null ? o.d : 0.1, hold = o.hold || 0, tot = a + hold + d;
    fl.frequency.setValueAtTime(Math.max(20, o.f), t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.ft || tot));
    var g = ctx.createGain(); env(g.gain, t, a, o.g != null ? o.g : 0.5, hold, d);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t, Math.random() * (src.buffer.duration - 0.1)); src.stop(t + tot + 0.05);
    return g;
  }
  // dao động. o: {w, f, f2, ft, a, d, hold, g, det}
  function os(t, out, o) {
    var osc = ctx.createOscillator(); osc.type = o.w || 'sine';
    var a = o.a != null ? o.a : 0.002, d = o.d != null ? o.d : 0.1, hold = o.hold || 0, tot = a + hold + d;
    osc.frequency.setValueAtTime(Math.max(10, o.f), t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.f2), t + (o.ft || tot));
    if (o.det) osc.detune.value = o.det;
    var g = ctx.createGain(); env(g.gain, t, a, o.g != null ? o.g : 0.3, hold, d);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + tot + 0.05);
    return { osc: osc, g: g };
  }
  // điều biên: rung biên độ một nút gain
  function am(t, dur, gainNode, freq, depth) {
    var l = ctx.createOscillator(); l.type = 'sine'; l.frequency.value = freq;
    var lg = ctx.createGain(); lg.gain.value = depth;
    l.connect(lg); lg.connect(gainNode.gain); l.start(t); l.stop(t + dur + 0.05);
  }
  // chùm họa âm phi điều hòa (kim loại)
  function ring(t, out, base, ratios, g, d, w) {
    for (var i = 0; i < ratios.length; i++) {
      os(t, out, { w: w || 'sine', f: base * ratios[i] * rnd(0.995, 1.005), a: 0.001, d: d * Math.max(0.25, 1 - i * 0.13) * rnd(0.8, 1.1), g: g / (1 + i * 0.55) });
    }
  }
  function shaper() {
    if (!shapeCurve) {
      shapeCurve = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = i / 512 - 1; shapeCurve[i] = Math.tanh(x * 4.5); }
    }
    var ws = ctx.createWaveShaper(); ws.curve = shapeCurve; return ws;
  }
  // trống trầm
  function drum(t, out, f, g, muffled) {
    os(t, out, { w: 'sine', f: f * 1.9, f2: f, ft: 0.07, a: 0.002, d: muffled ? 0.22 : 0.34, g: g });
    nz(t, out, { buf: 'b', type: 'lowpass', f: muffled ? 200 : 520, a: 0.002, d: 0.12, g: g * 0.8 });
  }
  // nốt kèn đồng: răng cưa qua lọc thông thấp, vào chậm
  function hornNote(t, out, f, dur, g, dark) {
    var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.7;
    var top = dark ? 850 : 2200, a = Math.min(0.09, dur * 0.35);
    fl.frequency.setValueAtTime(Math.max(200, f * 1.1), t);
    fl.frequency.linearRampToValueAtTime(top, t + Math.min(0.16, dur * 0.45));
    fl.frequency.setTargetAtTime(top * 0.55, t + dur * 0.55, Math.max(0.05, dur * 0.35));
    var eg = ctx.createGain(); env(eg.gain, t, a, g, Math.max(0, dur - a - 0.12), 0.14);
    fl.connect(eg); eg.connect(out);
    var vib = ctx.createOscillator(); vib.frequency.value = 5.3; var vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(dur, 0.45));
    vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.2);
    var dets = [-7, 6];
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.06);
      o.detune.value = dets[i]; vg.connect(o.frequency);
      var og = ctx.createGain(); og.gain.value = 0.5; o.connect(og); og.connect(fl); o.start(t); o.stop(t + dur + 0.2);
    }
    // hơi thổi
    nz(t, out, { buf: 'p', type: 'bandpass', f: f * 3, q: 1.2, a: 0.03, d: 0.1, g: g * 0.25 });
  }
  // dây gảy Karplus-Strong, tính sẵn vào bộ đệm
  function pluckBuf(freq) {
    var key = Math.round(freq * 2);
    if (pluckCache[key]) return pluckCache[key];
    if (pluckCount > 60) { pluckCache = {}; pluckCount = 0; }
    var sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * 1.5);
    var buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), line = new Float32Array(N), i, prev = 0;
    for (i = 0; i < N; i++) { var w = Math.random() * 2 - 1; prev = prev * 0.45 + w * 0.55; line[i] = prev; }
    var idx = 0, damp = 0.9945;
    for (i = 0; i < len; i++) {
      var a = line[idx], nx = idx + 1; if (nx >= N) nx = 0;
      d[i] = a; line[idx] = (a + line[nx]) * 0.5 * damp; idx = nx;
    }
    for (i = 0; i < 400 && i < len; i++) d[len - 1 - i] *= i / 400;
    pluckCache[key] = buf; pluckCount++;
    return buf;
  }
  function pluck(t, out, freq, vol) {
    var src = ctx.createBufferSource(); src.buffer = pluckBuf(freq);
    var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = Math.min(6000, 1400 + freq * 5);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0.0001, t + 0.5, 0.35);
    src.connect(fl); fl.connect(g); g.connect(out); src.start(t); src.stop(t + 1.5);
  }
  // một tiếng người xa xa (nguyên âm thô): răng cưa qua hai formant
  var VOW = [[700, 1150], [420, 1900], [520, 920], [320, 2200], [600, 1500]];
  function voiceBlip(t, out, vol, hi) {
    var v = VOW[Math.floor(Math.random() * VOW.length)], dur = hi ? rnd(0.2, 0.45) : rnd(0.14, 0.4);
    var f0 = hi ? rnd(240, 430) : rnd(105, 210);
    var o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (hi ? rnd(1.25, 1.6) : rnd(0.92, 1.15)), t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(f0 * (hi ? rnd(0.9, 1.2) : rnd(0.8, 1.0)), t + dur);
    var eg = ctx.createGain(); env(eg.gain, t, dur * 0.25, vol, dur * 0.2, dur * 0.55);
    for (var i = 0; i < 2; i++) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = v[i] * (hi ? 1.15 : 1) * rnd(0.92, 1.08); bp.Q.value = 5;
      o.connect(bp); bp.connect(eg);
    }
    eg.connect(out); o.start(t); o.stop(t + dur + 0.1);
    return dur;
  }

  // một "giọng" phát một lần: nút gain (+ pan) tự tháo sau khi xong
  function mkVoice(dest, vol, pan) {
    var g = ctx.createGain(); g.gain.value = vol;
    var tail = g;
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; }
    tail.connect(dest);
    return { g: g, tail: tail };
  }
  function freeVoice(v, dur) {
    active++;
    setTimeout(function () { active--; try { v.g.disconnect(); if (v.tail !== v.g) v.tail.disconnect(); } catch (e) { } }, (dur + 0.3) * 1000);
  }

  // ---------------------------------------------------------------- Tiếng phát một lần
  // mỗi hàm: (t, out, p = hệ số cao độ) → thời lượng (giây)
  var SFX = {
    // ---- giao diện
    click: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 1900 * p, q: 3, a: 0.001, d: 0.03, g: 0.55 });
      os(t, o, { f: 820 * p, f2: 540 * p, ft: 0.02, a: 0.001, d: 0.025, g: 0.22 });
      return 0.08;
    },
    hover: function (t, o, p) { nz(t, o, { type: 'bandpass', f: 2600 * p, q: 2, a: 0.002, d: 0.018, g: 0.09 }); return 0.05; },
    coin: function (t, o, p) {
      var n = 2 + (Math.random() < 0.5 ? 1 : 0), tt = t;
      for (var i = 0; i < n; i++) {
        ring(tt, o, rnd(2900, 3500) * p, [1, 1.41, 2.03, 2.71], 0.14, rnd(0.07, 0.13));
        nz(tt, o, { type: 'highpass', f: 5000, a: 0.001, d: 0.012, g: 0.12 });
        tt += rnd(0.05, 0.08);
      }
      return 0.4;
    },
    buy: function (t, o, p) {
      nz(t, o, { buf: 'p', type: 'lowpass', f: 700, a: 0.01, d: 0.12, g: 0.25 });           // túi tiền đặt xuống
      var n = 8 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var tt = t + 0.03 + Math.pow(i / n, 0.8) * 0.4 + rnd(0, 0.02);
        ring(tt, o, rnd(2600, 3900) * p, [1, 1.43, 2.07], 0.09 * rnd(0.6, 1), rnd(0.04, 0.1));
        nz(tt, o, { type: 'highpass', f: 5200, a: 0.001, d: 0.01, g: 0.07 });
      }
      return 0.7;
    },
    equip: function (t, o, p) {
      var g = nz(t, o, { buf: 'p', type: 'bandpass', f: 280 * p, f2: 560 * p, q: 7, a: 0.03, d: 0.15, g: 0.9 });  // da cót két
      am(t, 0.2, g, 37, 0.5);
      nz(t, o, { type: 'lowpass', f: 900, a: 0.005, d: 0.06, g: 0.15 });
      ring(t + 0.19, o, 2350 * p, [1, 1.58, 2.4], 0.1, 0.05);                                 // khóa cài
      nz(t + 0.19, o, { type: 'bandpass', f: 3200, q: 2, a: 0.001, d: 0.015, g: 0.25 });
      return 0.35;
    },
    error: function (t, o, p) {
      for (var i = 0; i < 2; i++) {
        var tt = t + i * 0.1, k = i ? 0.6 : 1;
        os(tt, o, { f: 118 * p, f2: 78 * p, ft: 0.08, a: 0.002, d: 0.11, g: 0.55 * k });
        nz(tt, o, { buf: 'b', type: 'lowpass', f: 320, a: 0.002, d: 0.05, g: 0.5 * k });
      }
      return 0.3;
    },
    card: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 3400 * p, f2: 1500 * p, q: 0.9, a: 0.012, d: 0.09, g: 0.22 });  // giấy da lật
      nz(t + 0.05, o, { type: 'highpass', f: 2600, a: 0.004, d: 0.03, g: 0.08 });
      pluck(t + 0.07, o, 880 * p, 0.14); pluck(t + 0.1, o, 1318.5 * p, 0.09);
      return 1.6;
    },
    day: function (t, o, p) {
      drum(t, o, 62 * p, 0.8, false);
      nz(t + 0.05, o, { buf: 'p', type: 'bandpass', f: 380, f2: 1250, ft: 0.9, q: 0.7, a: 0.5, d: 0.75, g: 0.14 });
      os(t + 0.1, o, { w: 'triangle', f: 146.83 * p, a: 0.45, d: 0.8, g: 0.07 });
      os(t + 0.1, o, { w: 'sine', f: 220 * p, a: 0.55, d: 0.75, g: 0.05 });
      os(t + 0.25, o, { w: 'sine', f: 293.66 * p, a: 0.5, d: 0.65, g: 0.035 });
      return 1.5;
    },
    gate: function (t, o, p) {
      os(t, o, { f: 52, a: 0.1, hold: 0.65, d: 0.25, g: 0.28 });                               // rền nền
      var cg = nz(t, o, { type: 'bandpass', f: 2300, q: 1.4, a: 0.05, hold: 0.7, d: 0.15, g: 0.07 });  // xích
      am(t, 1, cg, 19, 0.05);
      var tt = t + 0.02, n = 0;
      while (tt < t + 0.88 && n++ < 14) {
        var b = rnd(170, 330) * p;
        ring(tt, o, b, [1, 1.52, 2.31, 3.4, 4.7], 0.12 * rnd(0.6, 1), rnd(0.06, 0.12), 'triangle');
        nz(tt, o, { type: 'bandpass', f: rnd(1500, 2800), q: 2.5, a: 0.001, d: 0.02, g: 0.14 });
        tt += rnd(0.06, 0.1);
      }
      os(t + 0.95, o, { f: 85 * p, f2: 44 * p, ft: 0.12, a: 0.002, d: 0.3, g: 0.8 });          // chốt hạ
      nz(t + 0.95, o, { buf: 'b', type: 'lowpass', f: 420, a: 0.002, d: 0.16, g: 0.7 });
      ring(t + 0.95, o, 240 * p, [1, 1.47, 2.6], 0.1, 0.3, 'triangle');
      return 1.5;
    },
    // ---- trận đấu
    horn: function (t, o, p) {
      hornNote(t, o, 196 * p, 0.34, 0.3);
      hornNote(t + 0.38, o, 196 * p, 0.22, 0.28);
      hornNote(t + 0.64, o, 293.66 * p, 0.95, 0.34);
      return 1.9;
    },
    swing: function (t, o, p) {
      var g = nz(t, o, { type: 'bandpass', f: 520 * p, f2: 2300 * p, ft: 0.09, q: 1.3, a: 0.05, d: 0.11, g: 0.36 });
      void g; return 0.25;
    },
    swingHeavy: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 230 * p, f2: 950 * p, ft: 0.15, q: 1.1, a: 0.09, d: 0.2, g: 0.5 });
      nz(t, o, { buf: 'p', type: 'lowpass', f: 300, a: 0.1, d: 0.16, g: 0.25 });
      return 0.4;
    },
    hitFlesh: function (t, o, p) {
      nz(t, o, { buf: 'p', type: 'lowpass', f: 950 * p, f2: 280, q: 0.9, a: 0.003, d: 0.12, g: 1.0 });
      os(t, o, { f: 100 * p, f2: 55 * p, ft: 0.09, a: 0.002, d: 0.14, g: 0.9 });
      nz(t, o, { type: 'bandpass', f: 2300, q: 1.2, a: 0.001, d: 0.022, g: 0.22 });           // tiếng ướt
      return 0.25;
    },
    hitHeavy: function (t, o, p) {
      nz(t, o, { buf: 'p', type: 'lowpass', f: 1300 * p, f2: 240, q: 1, a: 0.003, d: 0.2, g: 1.1 });
      os(t, o, { f: 82 * p, f2: 38 * p, ft: 0.14, a: 0.002, d: 0.26, g: 1.0 });
      for (var i = 0; i < 3; i++) nz(t + 0.008 + i * rnd(0.012, 0.022), o, { type: 'bandpass', f: rnd(1500, 2600), q: 3, a: 0.001, d: 0.014, g: 0.3 });  // xương
      return 0.4;
    },
    crit: function (t, o, p) {
      SFX.hitFlesh(t, o, p * 0.94);
      nz(t, o, { type: 'highpass', f: 3000, a: 0.001, d: 0.05, g: 0.5 });
      os(t, o, { w: 'square', f: 1750 * p, f2: 900 * p, ft: 0.03, a: 0.001, d: 0.03, g: 0.12 });
      os(t + 0.01, o, { f: 60, f2: 40, ft: 0.15, a: 0.004, d: 0.2, g: 0.5 });
      return 0.35;
    },
    block: function (t, o, p) {
      os(t, o, { f: 168 * p, f2: 108 * p, ft: 0.08, a: 0.002, d: 0.16, g: 0.85 });
      nz(t, o, { buf: 'p', type: 'lowpass', f: 780 * p, q: 1.5, a: 0.002, d: 0.07, g: 0.8 });
      os(t, o, { w: 'triangle', f: 412 * p, a: 0.001, d: 0.09, g: 0.25 });                    // gỗ cộng hưởng
      ring(t, o, 540 * p, [1, 2.09, 3.46, 4.87], 0.085, 0.32);                                // núm đồng ngân
      return 0.45;
    },
    clang: function (t, o, p) {
      ring(t, o, rnd(1180, 1320) * p, [1, 1.47, 2.09, 2.56, 3.71, 4.3], 0.2, 0.34);
      ring(t, o, 2890 * p, [1, 1.34], 0.06, 0.12, 'triangle');
      nz(t, o, { type: 'highpass', f: 4200, a: 0.001, d: 0.012, g: 0.4 });
      return 0.5;
    },
    dodge: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 1700 * p, f2: 3600 * p, ft: 0.05, q: 1.5, a: 0.02, d: 0.07, g: 0.22 });
      nz(t, o, { buf: 'p', type: 'lowpass', f: 520, a: 0.005, d: 0.035, g: 0.2 });           // vải phất
      return 0.15;
    },
    punch: function (t, o, p) {
      nz(t, o, { buf: 'p', type: 'lowpass', f: 650 * p, q: 1, a: 0.002, d: 0.06, g: 0.9 });
      os(t, o, { f: 135 * p, f2: 78 * p, ft: 0.05, a: 0.002, d: 0.075, g: 0.7 });
      nz(t, o, { type: 'bandpass', f: 1500, q: 1.5, a: 0.001, d: 0.015, g: 0.14 });
      return 0.15;
    },
    thud: function (t, o, p) {
      os(t, o, { f: 74 * p, f2: 38 * p, ft: 0.12, a: 0.003, d: 0.24, g: 0.95 });
      nz(t, o, { buf: 'b', type: 'lowpass', f: 320, a: 0.004, d: 0.24, g: 0.9 });
      nz(t + 0.01, o, { type: 'highpass', f: 2600, a: 0.02, d: 0.26, g: 0.1 });               // cát văng
      nz(t + 0.09, o, { buf: 'p', type: 'lowpass', f: 400, a: 0.005, d: 0.12, g: 0.3 });     // tay chân rơi theo
      return 0.45;
    },
    step: function (t, o, p) { nz(t, o, { type: 'bandpass', f: 1100 * p, q: 0.6, a: 0.01, d: 0.07, g: 0.05 }); return 0.12; },
    net: function (t, o, p) {
      var g = nz(t, o, { buf: 'p', type: 'bandpass', f: 520 * p, f2: 1050 * p, ft: 0.34, q: 2, a: 0.08, hold: 0.18, d: 0.1, g: 0.5 });  // dây vù
      am(t, 0.4, g, 21, 0.3);
      nz(t + 0.37, o, { buf: 'p', type: 'lowpass', f: 480, a: 0.004, d: 0.13, g: 0.6 });     // lưới phủ xuống
      nz(t + 0.38, o, { type: 'bandpass', f: 1900, q: 0.8, a: 0.01, d: 0.1, g: 0.1 });
      return 0.6;
    },
    javelin: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 2700 * p, f2: 1850 * p, ft: 0.3, q: 12, a: 0.04, hold: 0.1, d: 0.16, g: 0.7 });
      os(t, o, { f: 2700 * p, f2: 1850 * p, ft: 0.3, a: 0.05, hold: 0.08, d: 0.15, g: 0.02 });
      nz(t, o, { type: 'bandpass', f: 800, f2: 1500, ft: 0.2, q: 1, a: 0.04, d: 0.18, g: 0.1 });
      return 0.4;
    },
    javelinHit: function (t, o, p) {
      os(t, o, { f: 225 * p, f2: 140 * p, ft: 0.05, a: 0.001, d: 0.07, g: 0.7 });
      nz(t, o, { type: 'bandpass', f: 900 * p, q: 2, a: 0.001, d: 0.05, g: 0.6 });
      os(t, o, { w: 'triangle', f: 480 * p, a: 0.001, d: 0.11, g: 0.16 });                    // cán lao rung
      os(t + 0.02, o, { w: 'sine', f: 36, a: 0.01, d: 0.12, g: 0.25 });
      return 0.25;
    },
    stun: function (t, o, p) {
      var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1500; fl.connect(o);
      var a = os(t, fl, { f: 312 * p, a: 0.003, d: 0.55, g: 0.4 });
      os(t, fl, { f: 312 * 2.76 * p, a: 0.003, d: 0.3, g: 0.16 });
      os(t, fl, { f: 312 * 5.4 * p, a: 0.002, d: 0.14, g: 0.07 });
      am(t, 0.6, a.g, 7.5, 0.12);
      nz(t, o, { buf: 'p', type: 'lowpass', f: 500, a: 0.002, d: 0.05, g: 0.4 });
      setTimeout(function () { try { fl.disconnect(); } catch (e) { } }, 900);
      return 0.7;
    },
    bleed: function (t, o, p) {
      nz(t, o, { type: 'bandpass', f: 1500 * p, f2: 600 * p, ft: 0.03, q: 2.5, a: 0.002, d: 0.03, g: 0.22 });
      os(t, o, { f: 420 * p, f2: 190 * p, ft: 0.025, a: 0.001, d: 0.025, g: 0.1 });
      return 0.08;
    },
    enrage: function (t, o, p) {
      var ws = shaper(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 2;
      fl.frequency.setValueAtTime(420, t); fl.frequency.linearRampToValueAtTime(1300, t + 0.6); fl.frequency.linearRampToValueAtTime(500, t + 1.1);
      var eg = ctx.createGain(); env(eg.gain, t, 0.25, 0.42, 0.35, 0.5);
      ws.connect(fl); fl.connect(eg); eg.connect(o);
      am(t, 1.2, eg, 27, 0.14);
      var fs = [62, 93.5, 124.6];
      for (var i = 0; i < fs.length; i++) {
        var oc = ctx.createOscillator(); oc.type = 'sawtooth';
        oc.frequency.setValueAtTime(fs[i] * p * 0.85, t); oc.frequency.linearRampToValueAtTime(fs[i] * p * 1.12, t + 0.7); oc.frequency.linearRampToValueAtTime(fs[i] * p * 0.95, t + 1.15);
        var og = ctx.createGain(); og.gain.value = 0.45 / (i + 1); oc.connect(og); og.connect(ws); oc.start(t); oc.stop(t + 1.25);
      }
      nz(t, ws, { buf: 'p', type: 'bandpass', f: 300, q: 1, a: 0.3, hold: 0.3, d: 0.4, g: 0.25 });
      setTimeout(function () { try { ws.disconnect(); fl.disconnect(); eg.disconnect(); } catch (e) { } }, 1600);
      return 1.3;
    },
    death: function (t, o, p) {
      drum(t, o, 56 * p, 0.9, false);
      // đám đông ồ lên rồi tắt ngang
      var src = ctx.createBufferSource(); src.buffer = bufs.p; src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(520, t); bp.frequency.linearRampToValueAtTime(900, t + 0.45); bp.Q.value = 0.6;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.42); g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      src.connect(bp); bp.connect(g); g.connect(o); src.start(t, Math.random() * 2); src.stop(t + 0.6);
      os(t, o, { f: 41, a: 0.02, d: 0.6, g: 0.3 });
      return 0.8;
    },
    // ---- kết quả
    win: function (t, o, p) {
      drum(t, o, 70, 0.7); drum(t + 0.2, o, 70, 0.5); drum(t + 0.62, o, 58, 0.85);
      hornNote(t, o, 293.66 * p, 0.17, 0.27);
      hornNote(t + 0.2, o, 293.66 * p, 0.17, 0.27);
      hornNote(t + 0.4, o, 440 * p, 0.2, 0.3);
      hornNote(t + 0.62, o, 587.33 * p, 0.85, 0.3);
      hornNote(t + 0.62, o, 293.66 * p, 0.85, 0.2);
      return 1.8;
    },
    lose: function (t, o, p) {
      drum(t, o, 52, 0.7, true); drum(t + 0.75, o, 46, 0.6, true);
      hornNote(t, o, 220 * p, 0.7, 0.28, true);
      hornNote(t + 0.75, o, 174.61 * p, 1.1, 0.3, true);
      return 2.2;
    },
    levelup: function (t, o, p) {
      // D Dorian: D F A B D' — rồi hợp âm kết
      var notes = [146.83, 174.61, 220, 246.94, 293.66, 440];
      for (var i = 0; i < notes.length; i++) pluck(t + i * 0.085, o, notes[i] * p, 0.2);
      pluck(t + 0.62, o, 293.66 * p, 0.2); pluck(t + 0.63, o, 440 * p, 0.16); pluck(t + 0.64, o, 587.33 * p, 0.14);
      return 2.3;
    }
  };

  A.play = function (name, opts) {
    try {
      if (!ok() || muted) return;
      var fn = SFX[name]; if (!fn) return;
      var nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (lastPlay[name] && nowMs - lastPlay[name] < 30) return;
      if (active > 24 && name !== 'horn' && name !== 'win' && name !== 'lose' && name !== 'death') return;
      lastPlay[name] = nowMs;
      opts = opts || {};
      var vol = opts.vol != null ? clamp(opts.vol, 0, 1.5) : 1, p = opts.pitch || 1;
      var v = mkVoice(sfxBus, vol, opts.pan || 0);
      var dur = fn(ctx.currentTime + 0.005, v.g, p) || 0.5;
      freeVoice(v, dur);
    } catch (e) { }
  };
  A.names = function () { return Object.keys(SFX); };

  // ---------------------------------------------------------------- Đám đông
  var CROWD_CFG = [
    { low: [260, 0.08], mid: [720, 0.55], hi: [1750, 0.40], wob: 0.5, mul: 0.45 },
    { low: [230, 0.20], mid: [650, 0.65], hi: [1550, 0.40], wob: 0.42, mul: 0.62 },
    { low: [190, 0.42], mid: [560, 0.75], hi: [1350, 0.42], wob: 0.33, mul: 0.82 },
    { low: [150, 0.70], mid: [480, 0.85], hi: [1200, 0.45], wob: 0.26, mul: 1.0 }
  ];
  var crowdLevel = 0, crowdTier = 0;

  function buildCrowd() {
    crowd = { out: ctx.createGain(), boost: ctx.createGain(), cheer: ctx.createGain(), bands: [] };
    crowd.out.gain.value = 0; crowd.boost.gain.value = 1; crowd.cheer.gain.value = 0;
    crowd.boost.connect(crowd.out); crowd.out.connect(crowdBus);
    var rates = [0.71, 1.0, 1.37], lfos = [[0.17, 0.43], [0.23, 0.61], [0.29, 0.53]];
    for (var i = 0; i < 3; i++) {
      var src = ctx.createBufferSource(); src.buffer = bufs.p; src.loop = true; src.playbackRate.value = rates[i];
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [0.8, 0.6, 0.8][i]; bp.frequency.value = [200, 600, 1400][i];
      var g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(bp); bp.connect(g); g.connect(crowd.boost);
      var band = { src: src, bp: bp, g: g, lg: [] };
      for (var j = 0; j < 2; j++) {
        var l = ctx.createOscillator(); l.frequency.value = lfos[i][j] * rnd(0.9, 1.1);
        var lg = ctx.createGain(); lg.gain.value = 0.1; l.connect(lg); lg.connect(g.gain); l.start();
        band.lg.push(lg);
      }
      src.start(0, Math.random() * 3);
      crowd.bands.push(band);
    }
    // lớp reo hò: sáng hơn, nằm trên tiếng gầm
    var cs = ctx.createBufferSource(); cs.buffer = bufs.p; cs.loop = true; cs.playbackRate.value = 1.21;
    var cb = ctx.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 1750; cb.Q.value = 0.5;
    var cs2 = ctx.createBufferSource(); cs2.buffer = bufs.w; cs2.loop = true; cs2.playbackRate.value = 0.83;
    var cb2 = ctx.createBiquadFilter(); cb2.type = 'bandpass'; cb2.frequency.value = 3200; cb2.Q.value = 0.7;
    var c2g = ctx.createGain(); c2g.gain.value = 0.12;
    cs.connect(cb); cb.connect(crowd.cheer); cs2.connect(cb2); cb2.connect(c2g); c2g.connect(crowd.cheer);
    var cl = ctx.createOscillator(); cl.frequency.value = 0.9; var clg = ctx.createGain(); clg.gain.value = 0; cl.connect(clg); clg.connect(crowd.cheer.gain); cl.start();
    crowd.cheerLfo = clg; crowd.cheerBp = cb;
    crowd.cheer.connect(crowdBus);
    cs.start(0, 1.1); cs2.start(0, 0.4);
  }
  function applyCrowdSize(tier, instant) {
    crowdTier = clamp(Math.round(tier) || 0, 0, 3);
    if (!ctx || !crowd) return;
    var c = CROWD_CFG[crowdTier], t = ctx.currentTime, tc = instant ? 0.01 : 0.3, keys = ['low', 'mid', 'hi'];
    for (var i = 0; i < 3; i++) {
      var b = crowd.bands[i], cfg = c[keys[i]];
      b.bp.frequency.setTargetAtTime(cfg[0], t, tc);
      b.g.gain.setTargetAtTime(cfg[1], t, tc);
      for (var j = 0; j < 2; j++) b.lg[j].gain.setTargetAtTime(cfg[1] * c.wob * 0.5, t, tc);
    }
    crowd.cheerBp.frequency.setTargetAtTime(crowdTier >= 2 ? 1500 : 1900, t, tc);
    applyCrowdLevel();
  }
  function applyCrowdLevel() {
    if (!ctx || !crowd) return;
    var g = Math.pow(crowdLevel, 1.4) * 0.6 * CROWD_CFG[crowdTier].mul;
    crowd.out.gain.setTargetAtTime(g, ctx.currentTime, 0.17);
    if (crowdLevel > 0.03 && !crowdTimer) crowdTimer = setTimeout(crowdTick, 300);
  }
  // tiếng người lẻ nổi lên trên nền: đám đông nhỏ nghe ra từng giọng
  function crowdTick() {
    crowdTimer = null;
    if (!ctx || crowdLevel <= 0.03) return;
    var delay = 600;
    try {
      if (ok() && !muted) {
        var t = ctx.currentTime + 0.02, v, d;
        if (crowdTier <= 1) {
          v = mkVoice(crowdBus, crowdLevel * (crowdTier === 0 ? 0.11 : 0.07), rnd(-0.8, 0.8));
          d = voiceBlip(t, v.g, 1, Math.random() < 0.15 + crowdLevel * 0.25);
          freeVoice(v, d);
          delay = crowdTier === 0 ? rnd(160, 620) : rnd(320, 900);
          delay /= (0.5 + crowdLevel);
        } else {
          if (crowdLevel > 0.5) {
            v = mkVoice(crowdBus, crowdLevel * 0.035, rnd(-0.9, 0.9));
            d = voiceBlip(t, v.g, 1, true); freeVoice(v, d);
          }
          delay = rnd(700, 2400);
        }
      }
    } catch (e) { }
    crowdTimer = setTimeout(crowdTick, delay);
  }
  function hold(param, t) {
    try { if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else { var v = param.value; param.cancelScheduledValues(t); param.setValueAtTime(v, t); } } catch (e) { }
  }

  A.crowd = function (level) {
    crowdLevel = clamp(+level || 0, 0, 1); want.crowd = crowdLevel;
    try { applyCrowdLevel(); } catch (e) { }
  };
  A.crowdSize = function (tier) {
    want.tier = clamp(Math.round(+tier) || 0, 0, 3);
    try { applyCrowdSize(want.tier); } catch (e) { crowdTier = want.tier; }
  };
  A.cheer = function (amount) {
    try {
      if (!ok() || muted || !crowd) return;
      var a = clamp(amount == null ? 0.6 : +amount, 0, 1), t = ctx.currentTime, mul = CROWD_CFG[crowdTier].mul;
      var peak = (0.12 + 0.5 * a) * mul, dec = 0.5 + a * 0.35;      // tắt dần ~1,5–2,5 s
      hold(crowd.cheer.gain, t);
      crowd.cheer.gain.setTargetAtTime(peak, t, 0.06);
      crowd.cheer.gain.setTargetAtTime(0, t + 0.35, dec);
      hold(crowd.cheerLfo.gain, t);
      crowd.cheerLfo.gain.setTargetAtTime(peak * 0.25, t, 0.1); crowd.cheerLfo.gain.setTargetAtTime(0, t + 0.4, dec);
      hold(crowd.boost.gain, t);
      crowd.boost.gain.setTargetAtTime(1 + a * 0.8, t, 0.08);
      crowd.boost.gain.setTargetAtTime(1, t + 0.4, dec);
      // vài tiếng hú cao
      var n = 2 + Math.floor(a * 4);
      for (var i = 0; i < n; i++) {
        var v = mkVoice(crowdBus, (0.05 + 0.07 * a) * (0.6 + mul * 0.4), rnd(-0.9, 0.9));
        var d = voiceBlip(t + rnd(0.05, 0.9), v.g, 1, true);
        freeVoice(v, d + 1);
      }
    } catch (e) { }
  };
  A.gasp = function () {
    try {
      if (!ok() || muted) return;
      var t = ctx.currentTime + 0.01, mul = CROWD_CFG[crowdTier].mul, v = mkVoice(crowdBus, 0.4 + 0.6 * mul, 0);
      nz(t, v.g, { buf: 'p', type: 'bandpass', f: 1050, f2: 1750, ft: 0.25, q: 0.9, a: 0.17, d: 0.4, g: 0.55 });
      nz(t, v.g, { type: 'highpass', f: 3000, a: 0.15, d: 0.25, g: 0.06 });
      freeVoice(v, 0.7);
    } catch (e) { }
  };
  A.boo = function () {
    try {
      if (!ok() || muted) return;
      var t = ctx.currentTime + 0.01, mul = CROWD_CFG[crowdTier].mul, v = mkVoice(crowdBus, 0.45 + 0.55 * mul, 0);
      var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 1.2;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 330; bp.Q.value = 2.5;
      var eg = ctx.createGain(); env(eg.gain, t, 0.28, 0.5, 0.5, 0.85);
      fl.connect(eg); bp.connect(eg); eg.connect(v.g);
      for (var i = 0; i < 6; i++) {
        var f = rnd(102, 172), o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * rnd(1.0, 1.06), t); o.frequency.exponentialRampToValueAtTime(f * rnd(0.74, 0.82), t + 1.6);
        var l = ctx.createOscillator(); l.frequency.value = rnd(3.5, 6); var lg = ctx.createGain(); lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency);
        var og = ctx.createGain(); og.gain.value = 0.11;
        o.connect(og); og.connect(fl); og.connect(bp);
        var st = t + rnd(0, 0.15); o.start(st); o.stop(t + 1.75); l.start(st); l.stop(t + 1.75);
      }
      nz(t, v.g, { buf: 'p', type: 'lowpass', f: 380, a: 0.3, hold: 0.4, d: 0.8, g: 0.35 });
      freeVoice(v, 2.0);
    } catch (e) { }
  };

  // ---------------------------------------------------------------- Âm nền
  function loopNoise(b, buf, type, f, q, gain, rate) {
    var src = ctx.createBufferSource(); src.buffer = bufs[buf]; src.loop = true; src.playbackRate.value = rate || 1;
    var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    var g = ctx.createGain(); g.gain.value = gain;
    src.connect(fl); fl.connect(g); g.connect(b.g); src.start(0, Math.random() * 1.5);
    b.nodes.push(src);
    return { src: src, fl: fl, g: g };
  }
  function lfo(b, param, freq, depth) {
    var l = ctx.createOscillator(); l.frequency.value = freq; var lg = ctx.createGain(); lg.gain.value = depth;
    l.connect(lg); lg.connect(param); l.start(); b.nodes.push(l);
  }
  // lặp lại một sự kiện ngẫu nhiên; dừng khi âm nền đổi
  function every(b, minS, maxS, fn, first) {
    function tick() {
      if (b.dead) return;
      try { if (ok() && !muted) fn(ctx.currentTime + 0.03); } catch (e) { }
      b.timers.push(setTimeout(tick, rnd(minS, maxS) * 1000));
      if (b.timers.length > 40) b.timers.splice(0, 20);
    }
    b.timers.push(setTimeout(tick, (first != null ? first : rnd(minS, maxS)) * 1000));
  }
  function wind(b, cutoff, gain) {
    var w = loopNoise(b, 'b', 'lowpass', cutoff, 0.6, gain, 1);
    lfo(b, w.fl.frequency, 0.11, cutoff * 0.35); lfo(b, w.g.gain, 0.07, gain * 0.4);
    return w;
  }
  var DORIAN = [0, 2, 3, 5, 7, 9, 10];
  function scaleFreq(i) { return 146.83 * Math.pow(2, (12 * Math.floor(i / 7) + DORIAN[i % 7]) / 12); }

  var AMB = {
    market: function (b) {
      wind(b, 420, 0.13);
      var m = loopNoise(b, 'p', 'bandpass', 520, 0.5, 0.07, 0.9);
      lfo(b, m.g.gain, 0.19, 0.03); lfo(b, m.g.gain, 0.47, 0.015);
      every(b, 0.5, 1.8, function (t) { voiceBlip(t, b.g, rnd(0.008, 0.02), Math.random() < 0.15); });
      every(b, 2.5, 6.5, function (t) {
        var r = Math.random(), i, tt;
        if (r < 0.35) {                      // búa gõ xa
          var n = 2 + Math.floor(Math.random() * 3); tt = t;
          for (i = 0; i < n; i++) {
            os(tt, b.g, { f: 210, f2: 150, ft: 0.04, a: 0.002, d: 0.06, g: 0.05 });
            nz(tt, b.g, { type: 'bandpass', f: 1100, q: 2, a: 0.001, d: 0.03, g: 0.035 });
            tt += rnd(0.28, 0.4);
          }
        } else if (r < 0.6) {                // gia súc rống
          var f = rnd(85, 120), fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = rnd(320, 480); fl.Q.value = 2.5; fl.connect(b.g);
          os(t, fl, { w: 'sawtooth', f: f * 0.9, f2: f * 1.12, ft: 0.35, a: 0.15, hold: 0.25, d: 0.4, g: 0.09 });
          setTimeout(function () { try { fl.disconnect(); } catch (e) { } }, 1500);
        } else if (r < 0.8) {                // xe kéo cót két
          nz(t, b.g, { buf: 'p', type: 'bandpass', f: rnd(600, 900), f2: rnd(900, 1300), q: 14, a: 0.15, hold: 0.2, d: 0.3, g: 0.25 });
        } else {                             // tiền leng keng
          ring(t, b.g, rnd(2800, 3600), [1, 1.41, 2.03], 0.012, 0.08);
        }
      });
    },
    shop: function (b) {
      var fire = loopNoise(b, 'b', 'lowpass', 900, 0.5, 0.16, 1.1);
      lfo(b, fire.g.gain, 0.6, 0.05); lfo(b, fire.g.gain, 1.7, 0.03);
      loopNoise(b, 'p', 'bandpass', 2400, 0.7, 0.012, 1);
      every(b, 0.04, 0.22, function (t) {    // lửa nổ lách tách
        nz(t, b.g, { type: 'highpass', f: rnd(1800, 4200), a: 0.001, d: rnd(0.006, 0.025), g: rnd(0.02, 0.11) });
      });
      every(b, 3.0, 3.6, function (t) {      // ống bễ thở
        nz(t, b.g, { buf: 'p', type: 'bandpass', f: 300, f2: 480, ft: 0.6, q: 1.1, a: 0.45, hold: 0.1, d: 0.6, g: 0.16 });
      }, 1.2);
      every(b, 3, 7, function (t) {          // đe ngân
        var n = Math.random() < 0.45 ? 2 : (Math.random() < 0.3 ? 3 : 1), tt = t;
        for (var i = 0; i < n; i++) {
          var k = i === n - 1 ? 1 : 0.55;
          ring(tt, b.g, 1620 * rnd(0.98, 1.02), [1, 1.51, 2.32, 3.3], 0.06 * k, 0.5);
          nz(tt, b.g, { type: 'bandpass', f: 3000, q: 1, a: 0.001, d: 0.015, g: 0.12 * k });
          os(tt, b.g, { f: 180, f2: 120, ft: 0.03, a: 0.001, d: 0.05, g: 0.1 * k });
          tt += rnd(0.32, 0.42);
        }
      }, 2);
    },
    ready: function (b) {
      wind(b, 230, 0.2);
      var c = loopNoise(b, 'p', 'lowpass', 290, 0.7, 0.11, 0.8);     // đám đông vọng qua tường đá
      lfo(b, c.g.gain, 0.13, 0.05); lfo(b, c.g.gain, 0.37, 0.03);
      every(b, 2, 6, function (t) {          // nước nhỏ giọt, có vọng
        var f = rnd(950, 1500);
        for (var i = 0; i < 3; i++) os(t + i * 0.13, b.g, { f: f, f2: f * 0.62, ft: 0.05, a: 0.001, d: 0.06, g: 0.07 / (1 + i * 2.2) });
      });
      every(b, 7, 16, function (t) {         // xích sắt khẽ động đâu đó
        for (var i = 0; i < 3; i++) ring(t + i * rnd(0.07, 0.14), b.g, rnd(900, 1500), [1, 1.5, 2.4], 0.012, 0.1, 'triangle');
      });
      every(b, 9, 20, function (t) {         // khán đài rộ lên phía trên
        nz(t, b.g, { buf: 'p', type: 'lowpass', f: 380, a: 0.6, hold: 0.4, d: 1.2, g: 0.16 });
      }, 5);
    },
    arena: function (b) {
      wind(b, 520, 0.11);
      var h = loopNoise(b, 'w', 'highpass', 4200, 0.5, 0.012, 1);    // cát rít
      lfo(b, h.g.gain, 0.21, 0.008);
      every(b, 4, 10, function (t) {         // một cơn gió
        nz(t, b.g, { buf: 'p', type: 'bandpass', f: 500, f2: 900, ft: 1.0, q: 1.4, a: 0.8, hold: 0.2, d: 1.2, g: 0.07 });
      });
    },
    title: function (b) {
      wind(b, 400, 0.1);
      // bè trì tục
      var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 520;
      var dg = ctx.createGain(); dg.gain.value = 0.05; dl.connect(dg); dg.connect(b.g);
      var fs = [73.42, 110, 146.83], ty = ['sine', 'sine', 'triangle'], gs = [1, 0.6, 0.25];
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator(); o.type = ty[i]; o.frequency.value = fs[i]; o.detune.value = rnd(-5, 5);
        var og = ctx.createGain(); og.gain.value = gs[i]; o.connect(og); og.connect(dl); o.start(); b.nodes.push(o);
      }
      lfo(b, dg.gain, 0.09, 0.02);
      // giai điệu đàn lia: bước ngẫu nhiên chậm trên thang Dorian
      var idx = 4, steps = [-2, -1, -1, 1, 1, 2, 0, -3, 3];
      every(b, 0.6, 1.6, function (t) {
        if (Math.random() < 0.1) return;                              // lặng
        idx += steps[Math.floor(Math.random() * steps.length)];
        if (idx < 0) idx = 1; if (idx > 11) idx = 10;
        if (idx > 8 && Math.random() < 0.4) idx -= 2; if (idx < 2 && Math.random() < 0.4) idx += 2;
        pluck(t, b.g, scaleFreq(idx), rnd(0.13, 0.19));
        if (Math.random() < 0.18 && idx >= 4) pluck(t + 0.015, b.g, scaleFreq(idx - 4), 0.1);
        else if (Math.random() < 0.12) pluck(t + rnd(0.18, 0.3), b.g, scaleFreq(Math.min(11, idx + 2)), 0.09);
      }, 1.0);
    }
  };

  function stopBed(b) {
    if (!b) return;
    b.dead = true;
    for (var i = 0; i < b.timers.length; i++) clearTimeout(b.timers[i]);
    b.timers.length = 0;
    try { b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } catch (e) { }
    setTimeout(function () {
      for (var j = 0; j < b.nodes.length; j++) { try { b.nodes[j].stop(); } catch (e) { } }
      try { b.g.disconnect(); } catch (e) { }
    }, 1400);
  }
  function setAmb(name) {
    if (!ctx) return;
    if (name === bedName) return;
    stopBed(bed); bed = null; bedName = name;
    if (!name || !AMB[name]) return;
    var b = { g: ctx.createGain(), nodes: [], timers: [], dead: false };
    b.g.gain.value = 0; b.g.connect(ambBus);
    b.g.gain.setTargetAtTime(1, ctx.currentTime, 0.27);               // vào trong ~0,8 s
    AMB[name](b);
    bed = b;
  }
  A.ambience = function (name) {
    want.amb = name || null;
    try { setAmb(want.amb); } catch (e) { }
  };

})(window.G = window.G || {});

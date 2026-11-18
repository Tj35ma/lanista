// Công cụ soi chuyển động: nạp bằng cách chèn <script src="tools/dbg.js"> từ console.
(function () {
  var V = G.V, ar = V.arena;
  var off = [2.2, 1.5, 3.2], lookY = 1.0, follow = true;
  var base = ar.update;
  ar.update = function (dt) {
    base.call(ar, dt);
    if (ar.mode === 'dbg' && ar.view && follow) {
      var f = ar.view.b.f, mx = 0, mz = 0, n = 0;
      for (var i = 0; i < f.length; i++) { if (G.dbg.only != null && i !== G.dbg.only) continue; mx += f[i].x; mz += f[i].z; n++; }
      mx /= n; mz /= n;
      ar.camera.position.set(mx + off[0], off[1], mz + off[2]); ar.camera.lookAt(mx, lookY, mz);
    }
  };
  G.dbg = {
    only: null,
    duel: function (a, b, o) {
      o = o || {}; ar.stop(); ar.mode = 'dbg';
      function mk(d, i) { var x = d.x || {}; if (x.hpMul == null) x.hpMul = o.hp || 30; var g = G.makeFoe(G.e(d.name || ('X' + i), d.body || 'bal', d.lvl || 3, d.w, d.gear || [], d.c || 0, d.r == null ? 2 : d.r, x), i, o.look || 3); return { g: g, c: d.c || 0, r: d.r == null ? 2 : d.r }; }
      var A = (a.length ? a : [a]).map(function (d, i) { return mk(d, i); }), B = (b.length ? b : [b]).map(function (d, i) { return mk(d, i + 10); });
      var bt = new G.Battle(A, B, { seed: o.seed || 5 });
      ar.view = new V.BattleView(ar.scene, bt, { env: ar.env, quiet: !!o.quiet });
      ar.view.start(); G.dbg.b = bt; return 'ok';
    },
    cam: function (x, y, z, ly) { off = [x, y, z]; if (ly != null) lookY = ly; follow = true; },
    free: function (px, py, pz, lx, ly, lz) { follow = false; ar.camera.position.set(px, py, pz); ar.camera.lookAt(lx, ly, lz); },
    pause: function (p) { V.debug.paused = p !== false; },
    step: function (sec) { V.debug.paused = true; var n = Math.round(sec * 60); for (var i = 0; i < n; i++) V.frame(1 / 60); return G.dbg.b ? G.dbg.b.time.toFixed(2) : ''; },
    // tấm ảnh nhiều khung: mỗi ô là trạng thái sau khi tiến thêm steps[i] giây
    sheet: function (steps, cols) {
      V.debug.freeze = true; var r = V.renderer, w = V.w, h = V.h, n = steps.length; cols = cols || 4;
      var rows = Math.ceil(n / cols), cw = Math.floor(w / cols), ch = Math.floor(h / rows), cam = V.cur.camera;
      r.autoClear = false; r.setScissorTest(true);
      for (var i = 0; i < n; i++) {
        var k = Math.round(steps[i] * 120); for (var j = 0; j < k; j++) V.cur.update(1 / 120);
        V.cur.update(0);
        var x = (i % cols) * cw, y = h - (Math.floor(i / cols) + 1) * ch;
        r.setViewport(x, y, cw, ch); r.setScissor(x, y, cw, ch); cam.aspect = cw / ch; cam.updateProjectionMatrix(); r.clear(); r.render(V.cur.scene, cam);
      }
      r.setScissorTest(false); r.autoClear = true; r.setViewport(0, 0, w, h);
      return G.dbg.b ? G.dbg.b.time.toFixed(2) : '';
    },
    resume: function () { V.debug.freeze = false; V.debug.paused = false; V.resize(); },
    untilQ: function (i, sp, maxSec) { // như until nhưng không vẽ
      var b = G.dbg.b, n = 0, lim = (maxSec || 20) * 120;
      while (n++ < lim) { V.cur.update(1 / 120); var f = b.f[i]; if (f.atk && f.state === 'windup' && f.t < 0.02 && (!sp || f.atk.special === sp)) return { t: b.time.toFixed(2), sp: f.atk.special, wu: f.atk.hits[0].at.toFixed(2), hits: f.atk.hits.map(function (h) { return h.at.toFixed(2) + ':' + h.out + ':' + h.loc; }) }; }
      return 'timeout';
    },
    // chạy tới khi có sự kiện attack của đấu sĩ i (đặc biệt nếu sp), dừng ở pha u của đòn (0..1 = vung, >1 = sau chạm)
    until: function (i, sp, maxSec) {
      V.debug.paused = true; var b = G.dbg.b, n = 0, lim = (maxSec || 20) * 60;
      while (n++ < lim) {
        V.frame(1 / 60);
        var f = b.f[i];
        if (f.atk && f.state === 'windup' && f.t < 0.03 && (!sp || f.atk.special === sp)) return { t: b.time.toFixed(2), sp: f.atk.special, hits: f.atk.hits.map(function (h) { return h.at.toFixed(2) + ':' + h.out + ':' + h.loc; }) };
      }
      return 'timeout';
    }
  };
})();
// giữ cho trình duyệt luôn có khung hình mới để chụp màn hình khi vòng lặp bị đóng băng
(function () { var s = document.createElement('style'); s.textContent = '@keyframes dbgspin{to{transform:rotate(360deg)}}#dbgtick{position:fixed;right:0;bottom:0;width:2px;height:2px;background:#000;animation:dbgspin 1s linear infinite;z-index:99}'; document.head.appendChild(s); var d = document.createElement('div'); d.id = 'dbgtick'; document.body.appendChild(d); })();
// chụp canvas ở độ phân giải thật và gửi về máy chủ phát triển (tools/serve.js)
G.dbg.shot = async function (name, w) {
  var c = G.V.canvas, o = document.createElement('canvas'); w = w || 960; o.width = w; o.height = Math.round(w * c.height / c.width);
  if (!G.V.debug.freeze) G.V.frame(0);
  o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
  var r = await fetch('/shot?name=' + name, { method: 'POST', body: o.toDataURL('image/jpeg', 0.82) });
  return await r.text();
};

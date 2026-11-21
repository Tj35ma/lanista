// LANISTA — icon trang bị và chân dung đấu sĩ: vẽ chính mô hình 3D ra ảnh nhỏ (không có tệp ảnh nào).
(function (G) {
  'use strict';
  var T = THREE, V = G.V, cache = {}, S = null, LUT = null;
  var bb = new T.Box3(), bc = new T.Vector3(), bs = new T.Vector3(), oc = new T.Color();

  function setup() {
    S = { scene: new T.Scene(), cam: new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 60), rts: {} };
    S.scene.add(new T.HemisphereLight(0xfff1dc, 0x7a6650, 1.5));
    var d = new T.DirectionalLight(0xfff0d8, 2.0); d.position.set(-2.5, 3.5, 5); S.scene.add(d);
    var d2 = new T.DirectionalLight(0xc8d6ff, 0.7); d2.position.set(3, 1.5, -2); S.scene.add(d2);
    LUT = new Uint8Array(256);
    for (var i = 0; i < 256; i++) LUT[i] = Math.round(255 * Math.pow(Math.min(1, i / 255 * 0.9), 1 / 2.2));
  }
  function rtFor(w, h) { var k = w + 'x' + h; return S.rts[k] || (S.rts[k] = new T.WebGLRenderTarget(w, h, { depthBuffer: true })); }

  // Vẽ obj (nhìn chính diện, khung vừa khít hộp bao) vào ảnh w×h; trả về data URL (nền trong suốt).
  function shoot(obj, w, h, pad) {
    if (!S) setup();
    var r = V.renderer, ss = 2, W = w * ss, H = h * ss, rt = rtFor(W, H), cam = S.cam;
    S.scene.add(obj); obj.updateMatrixWorld(true);
    bb.setFromObject(obj); bb.getCenter(bc); bb.getSize(bs);
    var asp = w / h, hh = Math.max(bs.y / 2, bs.x / 2 / asp, 0.05) * (1 + (pad || 0.08)), hw = hh * asp;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.near = 0.1; cam.far = 60;
    cam.position.set(bc.x, bc.y, bc.z + 20); cam.lookAt(bc.x, bc.y, bc.z); cam.updateProjectionMatrix();
    r.getClearColor(oc); var oa = r.getClearAlpha();
    r.setClearColor(0x000000, 0); r.setRenderTarget(rt); r.clear(); r.render(S.scene, cam);
    var buf = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    r.setRenderTarget(null); r.setClearColor(oc, oa); S.scene.remove(obj);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), dd = img.data, x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var si = ((H - 1 - y) * W + x) * 4, di = (y * W + x) * 4;
      dd[di] = LUT[buf[si]]; dd[di + 1] = LUT[buf[si + 1]]; dd[di + 2] = LUT[buf[si + 2]]; dd[di + 3] = buf[si + 3];
    }
    ctx.putImageData(img, 0, 0);
    var out = document.createElement('canvas'); out.width = w; out.height = h;
    var o2 = out.getContext('2d'); o2.imageSmoothingQuality = 'high'; o2.drawImage(cv, 0, 0, w, h);
    return out.toDataURL('image/png');
  }

  V.shoot = shoot;

  // Icon của một món trang bị hoặc một vật của lanista (theo id).
  V.itemIcon = function (id, size, rar, model) {
    size = size || 64; rar = rar || 0; model = model || 0; var key = id + '@' + size + '#' + rar + 'm' + model; if (cache[key]) return cache[key];
    var it = G.ITEMS[id], grp = it ? V.Gear.display(it, 0, rar, model) : V.relicMesh(id), holder = new T.Group();
    holder.add(grp);
    if (it && it.slot === 'weapon' && it.kind !== 'caestus') {
      grp.rotation.y = it.kind === 'crossbow' ? 0.2 : 1.25; holder.rotation.z = -0.78;
      // vũ khí cán dài quá mảnh ở cỡ icon: vẽ đậm nét hơn
      if (it.kind === 'hasta' || it.kind === 'trident' || it.kind === 'javelin' || it.kind === 'axe' || it.kind === 'mace') grp.scale.set(1.9, 1, 1.9);
    }   // nằm chéo, phô mặt lưỡi
    else if (it && it.slot === 'shield') { grp.rotation.y = 0.45; }
    else { grp.rotation.y = 0.6; holder.rotation.x = 0.22; }
    var url = shoot(holder, size, size, 0.1);
    grp.traverse(function (m) { if (m.geometry) m.geometry.dispose(); });
    return (cache[key] = url);
  };

  // Chân dung toàn thân một đấu sĩ với đúng trang bị đang mang.
  V.portrait = function (g, w, h, pose) {
    var fig = g.x && g.x.beast ? new V.Beast(g, 0, { ring: false }) : new V.Figure(g, 0, { ring: false, blob: false });
    fig.state = 'stand'; fig.place(0, 0, 0.42);
    if (pose === 'win') { fig.state = 'win'; fig.phase = 1.2; for (var i = 0; i < 50; i++) V.Anim.update(fig, 1 / 30); }
    var url = shoot(fig.group, w, h, 0.05);
    fig.dispose();
    return url;
  };
})(window.G = window.G || {});

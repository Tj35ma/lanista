// LANISTA — bộ máy hiển thị: renderer, vòng lặp, chuyển không gian, chuột.
(function (G) {
  'use strict';
  var T = THREE, V = G.V;
  V.time = 0; V.spaces = {}; V.cur = null; V.debug = { scale: 1, paused: false };
  var ray = new T.Raycaster(), ndc = new T.Vector2(), last = 0, fading = false;
  V.ray = ray;

  V.init = function (canvas, overlay) {
    V.canvas = canvas; V.overlay = overlay;
    var r = V.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    V.fadeEl = document.getElementById('fade');
    window.addEventListener('resize', V.resize);
    canvas.addEventListener('mousemove', function (e) { V.mouse = e; if (V.cur && V.cur.hover && !fading) { setRay(e); V.cur.hover(ray, e.clientX, e.clientY); } });
    canvas.addEventListener('mouseleave', function () { if (V.cur && V.cur.hover) V.cur.hover(null, 0, 0); });
    canvas.addEventListener('mousedown', function (e) { if (e.button === 0 && V.cur && V.cur.down && !fading) { setRay(e); V.cur.down(ray, e.clientX, e.clientY, e); } });
    canvas.addEventListener('click', function (e) { if (V.cur && V.cur.click && !fading) { setRay(e); V.cur.click(ray, e.clientX, e.clientY); } });
    try { initPost(); } catch (e) { console.warn('Không bật được hậu kỳ:', e); V.post = { ok: false }; }
    V.resize();
    last = performance.now();
    requestAnimationFrame(loop);
  };
  // tia nhìn qua điểm (x, y) của cửa sổ — dùng khi con trỏ đang ở trên một bảng giao diện
  V.rayAt = function (x, y) { if (!V.cur || !V.cur.camera) return null; setRay({ clientX: x, clientY: y }); return ray; };
  function setRay(e) {
    var rc = V.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, V.cur.camera);
  }
  V.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    V.w = w; V.h = h;
    if (V.renderer) V.renderer.setSize(w, h, false);
    if (V.canvas) { V.canvas.style.width = w + 'px'; V.canvas.style.height = h + 'px'; }
    if (V.post && V.post.ok) V.post.resize(w, h);
    if (V.cur) fitCam(V.cur);
  };
  function fitCam(sp) {
    var cam = sp.camera, asp = V.w / V.h; cam.aspect = asp;
    var f0 = (sp.fov || 40) * Math.PI / 180;
    cam.fov = 2 * Math.atan(Math.tan(f0 / 2) * Math.max(1, 1.65 / asp)) * 180 / Math.PI;
    if (sp.shiftX) cam.setViewOffset(V.w, V.h, -sp.shiftX * V.w, 0, V.w, V.h); else if (cam.view) cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  V.fitCam = fitCam;

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (V.debug.freeze) return;
    if (V.debug.paused) dt = 0; else dt *= V.debug.scale;
    V.frame(dt);
  }
  V.frame = function (dt) {
    V.time += dt;
    var sp = V.cur; if (!sp) return;
    try { sp.update(dt); } catch (e) { if (!V._err) { V._err = e; console.error(e); } }
    if (V.post && V.post.ok && V.post.on) V.post.render(sp.scene, sp.camera); else V.renderer.render(sp.scene, sp.camera);
  };

  // ---------------------------------------------------------------- Hậu kỳ
  var VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  var FS_BRIGHT = 'varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; void main(){ vec3 c = vec3(0.0); c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb; c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb; c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb; c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb; c *= 0.25; float l = max(c.r, max(c.g, c.b)); c *= smoothstep(0.85, 1.9, l); gl_FragColor = vec4(min(c, vec3(6.0)), 1.0); }';
  var FS_BLUR = 'varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir; void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227; c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316; c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }';
  var FS_FINAL = [
    'varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uExposure; uniform float uVig; uniform float uGrain; uniform float uTime; uniform vec2 uRes;',
    'vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
    'vec3 aces(vec3 c){ const mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c *= uExposure / 0.6; c = mi * c; c = fit(c); c = mo * c; return clamp(c, 0.0, 1.0); }',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    '  vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;',
    '  c = aces(c);',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  c = mix(vec3(l), c, 1.08);',                                    // đậm màu nhẹ
    '  c += (l - 0.45) * vec3(0.035, 0.012, -0.03);',                  // vùng sáng ấm, vùng tối lạnh
    '  vec2 d = (vUv - 0.5) * vec2(1.0, 0.86); float v = smoothstep(0.78, 0.22, length(d));',
    '  c *= mix(1.0 - uVig, 1.0, v);',
    '  c += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;',
    '  c = clamp(c, 0.0, 1.0);',
    '  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n');
  function initPost() {
    var r = V.renderer, gl = r.getContext(), P = V.post = { ok: false, on: true, bloom: 0.5, vig: 0.26, grain: 0.022 };
    if (!r.capabilities.isWebGL2 || !gl.getExtension('EXT_color_buffer_float')) return;
    var pr = r.getPixelRatio(), type = T.HalfFloatType;
    function rt(w, h, samples) { var t = new T.WebGLRenderTarget(w, h, { type: type, samples: samples || 0, depthBuffer: !!samples, minFilter: T.LinearFilter, magFilter: T.LinearFilter }); t.texture.generateMipmaps = false; return t; }
    P.scene = rt(4, 4, 4); P.a = rt(2, 2); P.b = rt(2, 2);
    function mat(fs, u) { return new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false }); }
    P.mBright = mat(FS_BRIGHT, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
    P.mBlur = mat(FS_BLUR, { tSrc: { value: null }, uDir: { value: new T.Vector2() } });
    P.mFinal = mat(FS_FINAL, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: P.bloom }, uExposure: { value: 1.08 }, uVig: { value: P.vig }, uGrain: { value: P.grain }, uTime: { value: 0 }, uRes: { value: new T.Vector2() } });
    P.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); P.quad = new T.Mesh(new T.PlaneGeometry(2, 2), P.mFinal); P.quad.frustumCulled = false; P.qs = new T.Scene(); P.qs.add(P.quad);
    P.resize = function (w, h) {
      var pr = r.getPixelRatio(), W = Math.max(4, Math.floor(w * pr)), H = Math.max(4, Math.floor(h * pr));
      P.scene.setSize(W, H); P.a.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2)); P.b.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      P.mFinal.uniforms.uRes.value.set(W, H); P.w = W; P.h = H;
    };
    function pass(m, target) { P.quad.material = m; r.setRenderTarget(target); r.render(P.qs, P.cam); }
    P.render = function (scene, cam) {
      r.setRenderTarget(P.scene); r.render(scene, cam);
      P.mBright.uniforms.tSrc.value = P.scene.texture; P.mBright.uniforms.uTexel.value.set(1 / P.w, 1 / P.h); pass(P.mBright, P.a);
      var bx = 1 / P.a.width, by = 1 / P.a.height;
      for (var i = 0; i < 2; i++) {
        var k = 1 + i * 1.6;
        P.mBlur.uniforms.tSrc.value = P.a.texture; P.mBlur.uniforms.uDir.value.set(bx * k, 0); pass(P.mBlur, P.b);
        P.mBlur.uniforms.tSrc.value = P.b.texture; P.mBlur.uniforms.uDir.value.set(0, by * k); pass(P.mBlur, P.a);
      }
      var u = P.mFinal.uniforms; u.tScene.value = P.scene.texture; u.tBloom.value = P.a.texture; u.uBloom.value = P.bloom; u.uVig.value = P.vig; u.uGrain.value = P.grain; u.uTime.value = V.time; u.uExposure.value = r.toneMappingExposure;
      pass(P.mFinal, null);
    };
    P.ok = true;
  }

  // Chuyển không gian 3D, có mờ dần. name: title | market | shop | ready | arena
  V.go = function (name, opts) {
    var key = name === 'title' ? 'arena' : name;
    var sp = V.spaces[key]; if (!sp) return;
    opts = opts || {}; opts.title = name === 'title';
    function sw() {
      if (V.cur && V.cur !== sp && V.cur.leave) V.cur.leave();
      V.cur = sp; V.curName = name;
      sp.enter(opts); fitCam(sp);
      if (V.overlay) V.overlay.innerHTML = '';
      if (sp.afterEnter) sp.afterEnter(opts);
    }
    if (!V.cur || !V.fadeEl) { sw(); return; }
    if (V.cur === sp) { sw(); return; }
    fading = true; V.fadeEl.style.opacity = 1;
    setTimeout(function () { sw(); V.frame(0); setTimeout(function () { V.fadeEl.style.opacity = 0; fading = false; }, 60); }, 230);
  };

  // điểm thế giới → toạ độ màn hình
  var pv = new T.Vector3();
  V.project = function (pos, out) {
    pv.copy(pos).project(V.cur.camera);
    out.x = (pv.x * 0.5 + 0.5) * V.w; out.y = (-pv.y * 0.5 + 0.5) * V.h; out.behind = pv.z > 1;
    return out;
  };

  // Tạo một không gian từ một Env (xem scenes.js). Trả về {scene, camera, env}.
  V.makeStage = function (env) {
    var scene = new T.Scene();
    scene.add(env.group);
    if (env.bg != null) scene.background = new T.Color(env.bg);
    if (env.fog) scene.fog = new T.Fog(env.fog.color, env.fog.near, env.fog.far);
    var cam = new T.PerspectiveCamera(env.cam.fov || 40, 1.6, 0.1, 400);
    cam.position.set(env.cam.pos[0], env.cam.pos[1], env.cam.pos[2]);
    cam.lookAt(env.cam.look[0], env.cam.look[1], env.cam.look[2]);
    return { scene: scene, camera: cam, env: env, fov: env.cam.fov || 40 };
  };

  // Env dự phòng khi scenes.js chưa có hoặc lỗi: mặt đất + nắng.
  V.fallbackEnv = function (cam, extra) {
    var g = new T.Group(), geo = new V.Geo();
    geo.box(60, 0.2, 60, V.PAL.sand, { y: -0.1 });
    g.add(V.mesh(geo, 'matte', false, true));
    var sun = new T.DirectionalLight(0xffd7a6, 2.4); sun.position.set(-14, 12, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); var sc = sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 60; sun.shadow.bias = -0.0006;
    g.add(sun); g.add(sun.target); g.add(new T.HemisphereLight(0xbfd0e0, 0x8a6a48, 0.8));
    var env = { group: g, update: function () { }, sun: sun, fog: { color: 0xd9bd96, near: 40, far: 140 }, bg: 0xd9c8a8, cam: cam, cheer: function () { }, radius: 9 };
    if (extra) for (var k in extra) env[k] = extra[k];
    return env;
  };
  V.getEnv = function (name, tier, fallback) {
    try { if (V.Env && V.Env[name]) return V.Env[name](tier); } catch (e) { console.error('Env ' + name + ' lỗi:', e); }
    return fallback();
  };
})(window.G = window.G || {});

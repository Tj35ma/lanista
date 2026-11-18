// LANISTA — khởi động: dựng phần 3D rồi giao luồng chơi cho G.UI.
(function () {
  'use strict';

  function fatal(title, err) {
    var box = document.getElementById('fatal');
    if (!box) return;
    box.style.display = 'flex';
    var d = document.createElement('div'); d.className = 'box';
    var h2 = document.createElement('h2'); h2.textContent = title;
    var p = document.createElement('div');
    p.textContent = 'Trò chơi cần một trình duyệt máy tính có WebGL (Chrome, Edge, Firefox bản mới). Nếu mở thẳng tệp index.html không được, hãy chạy qua máy chủ cục bộ như hướng dẫn trong README.md.';
    var pre = document.createElement('pre'); pre.textContent = err && (err.stack || err.message) ? (err.stack || err.message) : String(err || '');
    var c = document.createElement('div'); c.style.cssText = 'margin-top:6px;font-size:12px;color:#a8946a;cursor:pointer'; c.textContent = '(bấm để đóng thông báo này)';
    d.appendChild(h2); d.appendChild(p); d.appendChild(pre); d.appendChild(c);
    d.addEventListener('click', function () { box.style.display = 'none'; box.innerHTML = ''; });
    box.innerHTML = ''; box.appendChild(d);
  }

  function boot() {
    var G = window.G || {};
    try {
      if (!window.THREE) throw new Error('Thiếu thư viện three.js (lib/three.min.js).');
      if (!G.V || !G.V.init) throw new Error('Thiếu phần dựng hình 3D (js/view/engine.js).');
      G.V.init(document.getElementById('c'), document.getElementById('overlay3d'));
    } catch (e) {
      if (window.console) console.error(e);
      fatal('Không khởi động được phần 3D', e);
    }
    try {
      if (!G.UI || !G.UI.start) throw new Error('Thiếu giao diện (js/ui/ui.js).');
      G.UI.start();
    } catch (e2) {
      if (window.console) console.error(e2);
      fatal('Không khởi động được trò chơi', e2);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

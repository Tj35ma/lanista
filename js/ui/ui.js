// LANISTA — giao diện DOM và luồng chơi. Mọi chi tiết nằm trong tooltip; danh sách chỉ có tên và nút giá.
(function (G) {
  'use strict';

  var UI = G.UI = { game: null, state: 'title', tab: 'market', sel: null, fightKind: 'main', battle: null, deploy: false };
  var root, elTop, elHint, elLeft, elRight, elBottom, elTip, elToasts, elModals, elTitle, elHud, elPop, elTags, elEquip, elStash;
  var tagList = [], drag = null, fdrag = null, noRowClick = 0;
  var mouse = { x: 0, y: 0 };
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  var MUTE_KEY = 'lanista_muted';

  // ---------------------------------------------------------------- tiện ích
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function show(n, on) { if (n) n.classList[on ? 'remove' : 'add']('hidden'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(x, d) {
    d = d || 0;
    var s = (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (d && s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function coin(n) { return '<span class="coin"></span>' + n; }
  function snd(n) { try { if (G.Audio && G.Audio.play) G.Audio.play(n); } catch (e) { } }
  function amb(n) { try { if (G.Audio && G.Audio.ambience) G.Audio.ambience(n); } catch (e) { } }
  function vsub(name) { return (G.V && G.V[name]) ? G.V[name] : null; }
  function spaceName() { return UI.tab === 'ready' ? (UI.deploy ? 'ready' : 'lobby') : UI.tab; }
  function vgo(name, opts) { try { if (G.V && G.V.go) G.V.go(name, opts || {}); } catch (e) { if (window.console) console.error(e); } }
  function vtry(fn) { try { return fn(); } catch (e) { if (window.console) console.error(e); } }

  function btn(html, cls, fn, silent) {
    var b = h('button', 'btn' + (cls ? ' ' + cls : ''));
    b.innerHTML = html;
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (b.disabled) return;
      if (!silent) snd('click');
      fn(ev, b);
    });
    return b;
  }

  // ---------------------------------------------------------------- tooltip
  var tipOwner = null;
  function tipShow(html, x, y, owner) {
    if (drag && drag.on) return;
    if (!html) { tipHide(); return; }
    elTip.innerHTML = html; elTip.style.display = 'block'; tipOwner = owner || 'dom';
    tipMove(x, y);
  }
  function tipMove(x, y) {
    if (x == null) { x = mouse.x; y = mouse.y; }
    var w = elTip.offsetWidth, hh = elTip.offsetHeight, W = window.innerWidth, H = window.innerHeight;
    var px = x + 18, py = y + 14;
    if (px + w > W - 6) px = x - w - 14;
    if (px < 6) px = 6;
    if (py + hh > H - 6) py = H - hh - 6;
    if (py < 6) py = 6;
    elTip.style.left = px + 'px'; elTip.style.top = py + 'px';
  }
  function tipHide(owner) {
    if (owner && tipOwner !== owner) return;
    if (elTip) elTip.style.display = 'none';
    tipOwner = null; tip3dKey = null;
  }
  // Tooltip do phần 3D gọi (mỗi lần chuột nhúc nhích): chỉ dựng lại nội dung khi đổi đối tượng.
  var tip3dKey = null;
  function tip3d(key, fn, x, y) {
    if (tipOwner === 'dom') return;               // chuột đang ở trên một bảng: bảng thắng
    if (x == null) { x = mouse.x; y = mouse.y; }
    if (tipOwner === '3d' && tip3dKey === key) { tipMove(x, y); return; }
    var html = fn();
    if (!html) { tipHide('3d'); return; }
    tipShow(html, x, y, '3d'); tip3dKey = key;
  }
  function bindTip(node, fn, enter, leave) {
    node.addEventListener('mouseenter', function (e) { tipShow(fn(), e.clientX, e.clientY, 'dom'); if (enter) enter(); });
    node.addEventListener('mousemove', function (e) { if (tipOwner === 'dom') tipMove(e.clientX, e.clientY); });
    node.addEventListener('mouseleave', function () { tipHide('dom'); if (leave) leave(); });
  }

  // ---------------------------------------------------------------- thông báo, hộp thoại
  function toast(msg, cls) {
    if (!msg) return;
    var t = h('div', 'toast' + (cls ? ' ' + cls : ''), msg);
    elToasts.appendChild(t);
    while (elToasts.childNodes.length > 4) elToasts.removeChild(elToasts.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }
  function fail(res) { snd('error'); toast(res && res.msg ? res.msg : 'Không được.', 'err'); }

  var modalStack = [];
  function modal(node, opts) {
    opts = opts || {};
    var bg = h('div', 'modal-bg' + (opts.clear ? ' clear' : ''));
    var box = h('div', 'panel modal' + (opts.cls ? ' ' + opts.cls : ''));
    box.appendChild(node); bg.appendChild(box); elModals.appendChild(bg);
    var m = {
      bg: bg, opts: opts, closed: false,
      close: function (silent) {
        if (m.closed) return; m.closed = true;
        var i = modalStack.indexOf(m); if (i >= 0) modalStack.splice(i, 1);
        if (bg.parentNode) bg.parentNode.removeChild(bg);
        if (!silent && opts.onClose) opts.onClose();
      }
    };
    modalStack.push(m);
    if (opts.closable !== false) bg.addEventListener('mousedown', function (e) { if (e.target === bg) m.close(); });
    tipHide();
    return m;
  }
  function closeAllModals() { while (modalStack.length) modalStack[modalStack.length - 1].close(true); }
  function confirmBox(title, text, yes, onYes) {
    var d = h('div'), m;
    add(d, h('h2', null, title), h('p', null, text));
    var f = h('div', 'foot');
    add(f, btn('Thôi', null, function () { m.close(); }), btn(yes, 'warn', function () { m.close(true); onYes(); }));
    d.appendChild(f);
    m = modal(d);
    return m;
  }

  // ---------------------------------------------------------------- chữ cho tooltip
  function moraleWord(m) { return m < 15 ? 'sắp bỏ trốn' : (m <= 30 ? 'chán nản' : (m >= 80 ? 'hăng hái' : 'bình thường')); }
  function stars(n) { n = Math.max(0, Math.round(n)); var s = ''; for (var i = 0; i < Math.min(n, 12); i++) s += '★'; return s || '—'; }
  function kv(k, v) { return '<span>' + k + '</span><b>' + v + '</b>'; }

  function weaponBlock(w) {
    var K = G.WKIND[w.kind], H = [];
    H.push('<div class="tt-sec tt-w"><b>' + esc(w.name) + '</b> — ' + esc(K.role) + '</div>');
    H.push('<div>' + esc(K.strength) + '</div>');
    if (K.behave) H.push('<div><span class="tt-desc">Hành vi:</span> ' + esc(K.behave) + '</div>');
    if (K.special) H.push('<div><span class="tal">Chiêu: ' + esc(K.special.name) + '</span> — ' + esc(K.special.desc) + '</div>');
    return H.join('');
  }

  // Tooltip đấu sĩ. o: {foe, price, sell}
  function gladTip(g, o) {
    o = o || {};
    if (!g) return '';
    var st = G.calcStats(g), K = G.WKIND[st.kind], w = st.weapon, B = G.BODY[g.body], H = [], i;
    var gm = UI.game, tier = gm ? gm.s.tier : 0;
    H.push('<div class="tt-h ' + (o.foe ? 'foe' : 'own') + '">' + (g.boss ? '☠ ' : '') + esc(g.name) + '</div>');
    var sub = [];
    if (!o.foe && g.origin && G.ORIGINS[g.origin]) sub.push('Người ' + G.ORIGINS[g.origin].name);
    var X = g.x || {};
    sub.push(X.beast ? { bear: 'Gấu', dog: 'Chó trận', lion: 'Sư tử' }[X.beast] : B.name + (X.mount === 'elephant' ? ' · cưỡi voi' : (X.mount ? ' · cưỡi ngựa' : '')));
    sub.push('Cấp ' + g.lvl + (!o.foe && g.lvl >= G.MAX_LVL ? ' (tối đa)' : ''));
    H.push('<div class="tt-sub">' + sub.join(' · ') + '</div>');
    if (!o.foe && G.TIERS[tier].cap != null && g.lvl >= G.TIERS[tier].cap && g.lvl < G.MAX_LVL) H.push('<div class="tt-sub">Đã chạm trần của ' + esc(G.TIERS[tier].name) + ' (cấp ' + G.TIERS[tier].cap + '): kinh nghiệm ở đấu trường này chỉ còn một nửa, và giảm tiếp một nửa cho mỗi cấp sau đó.</div>');
    H.push('<div class="tt-grid">' +
      kv('Sức mạnh', num(st.str, 1)) + kv('Máu', st.hp) +
      kv('Nhanh nhẹn', num(st.agi, 1)) + kv('Sát thương', num(w.dmg * st.dmgMul, 1) + (st.kind === 'twin' ? ' ×2' : '')) +
      kv('Thể lực', num(st.sta, 0)) + kv('Nhịp đánh', num(K.interval / st.aspd, 2) + ' giây') +
      kv('Né', pct(st.dodge)) + kv('Tốc độ', num(st.move, 1) + ' m/s') +
      kv('Chặn', st.block > 0 ? pct(st.block) : (st.deflect > 0 ? 'gạt ' + pct(st.deflect) : '—')) + kv('Chí mạng', pct(st.crit)) +
      kv('Kháng hiệu ứng', pct(st.resist)) + kv('', '') +
      '</div>');
    // người không mặc giáp thì không cần một dòng toàn số 0
    if (st.armor.head + st.armor.body + st.armor.arms + st.armor.legs > 0) H.push('<div class="tt-line"><span>Giáp —</span> đầu <b>' + num(st.armor.head, 1) + '</b> · thân <b>' + num(st.armor.body, 1) + '</b> · tay <b>' + num(st.armor.arms, 1) + '</b> · chân <b>' + num(st.armor.legs, 1) + '</b></div>');
    H.push('<div class="tt-line"><span>Mang</span> <b class="' + (st.load > 0.85 ? 'warn' : '') + '">' + num(st.weight, 1) + '/' + num(st.cap, 0) + '</b>' +
      (st.load > 0.5 ? ' <span>(nặng: chậm ' + Math.round(40 * Math.min(1, st.load)) + '%)</span>' : '') + '</div>');
    if (!o.foe) {
      H.push('<div class="tt-line"><span>Tinh thần</span> <b class="' + (g.morale <= 30 ? 'warn' : (g.morale >= 80 ? 'ok' : '')) + '">' + g.morale + ' — ' + moraleWord(g.morale) + '</b></div>');
      H.push('<div class="tt-line"><span>Sức hút</span> <b class="tal">' + stars(st.appeal) + '</b> &nbsp; <span>Phí nuôi</span> <b>' + G.upkeepOf(g, tier, gm ? gm.s.relics : []) + ' vàng/ngày</b></div>');
    } else {
      // kẻ địch đặc biệt: cách nó đánh và kỹ năng của trùm
      var nt = [];
      if (X.beast) nt.push(esc(K.strength) + ' ' + esc(K.special.name) + ': ' + esc(K.special.desc));
      if (X.roar) nt.push('Gầm: làm choáng mọi kẻ đứng sát.');
      if (X.mount === 'elephant') nt.push('Voi chiến: giẫm và hất văng mọi người đứng trên đường nó đi.');
      else if (X.mount) nt.push(K.ranged ? 'Kỵ xạ: vừa phi vòng quanh sân vừa bắn; người đi bộ không đuổi kịp.' : 'Kỵ binh: phi vòng quanh sân, xông vào móc kéo kẻ đứng lẻ. Giáo đón đầu làm ngựa khựng lại.');
      if (X.formation) nt.push(X.leader ? 'Chỉ huy đội hình: hắn gục là cả hàng tan.' : 'Đứng trong đội hình: giữ hàng khiên, ' + (X.pila ? 'ném một loạt pilum, ' : '') + 'không đuổi theo ai.');
      if (X.cleave) nt.push('Đánh lan: mỗi đòn còn trúng những người đứng cạnh mục tiêu (' + Math.round(X.cleave * 100) + '% sát thương).');
      if (X.howl) nt.push((X.beast ? 'Hú' : 'Gầm thét') + ': cứ ' + X.howl.every + ' giây mạnh thêm ' + Math.round(X.howl.dmg * 100) + '% (tối đa ' + X.howl.max + ' lần).');
      if (X.summon) nt.push('Gọi viện binh: ' + (X.summon.at ? 'khi còn ' + X.summon.at.map(function (a) { return Math.round(a * 100) + '%'; }).join(' và ') + ' máu' : 'cứ ' + X.summon.every + ' giây') + ' có thêm ' + X.summon.foes.map(function (d) { return esc(d.name); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ' ra sân' + (X.summon.max ? ' (tối đa ' + X.summon.max + ')' : '') + '.');
      if (X.ccRes) nt.push('Kháng hiệu ứng bất lợi: lưới, choáng, làm chậm, chảy máu, mất thế đỡ chỉ còn ' + Math.round((1 - X.ccRes) * 100) + '% thời gian.');
      if (X.charge && X.charge.whirl) nt.push('Chém xoay: cứ ' + X.charge.every + ' giây xoay tròn lao tới kẻ đứng xa nhất (×' + String(X.charge.mul).replace('.', ',') + ' sát thương), chém mọi người trong ' + String(X.charge.whirl.r).replace('.', ',') + ' m trên đường đi (×' + String(X.charge.whirl.mul).replace('.', ',') + ').');
      else if (X.charge) nt.push('Xung phong: cứ ' + X.charge.every + ' giây lao thẳng vào ' + (X.charge.far ? 'kẻ đứng xa nhất' : 'một người') + ', ×' + String(X.charge.mul).replace('.', ',') + ' sát thương, làm choáng' + (X.charge.path ? '; hất ngã mọi kẻ chắn đường' : '') + '.');
      if (X.enrage) nt.push('Còn nửa máu sẽ nổi điên: đánh nhanh gấp rưỡi.');
      for (i = 0; i < nt.length; i++) H.push('<div class="warn">' + nt[i] + '</div>');
    }
    // trang bị đang mang
    var gear = [];
    for (i = 0; i < G.SLOTS.length; i++) { var it = G.itemOf(g.gear[G.SLOTS[i]]); if (it && G.SLOTS[i] !== 'weapon') gear.push(esc(it.name)); }
    if (gear.length) H.push('<div class="tt-line"><span>Trên người:</span> ' + gear.join(', ') + '</div>');
    // nét, thiên phú, thẻ, thương tích
    var sec = [];
    if (g.talent && G.TALENTS[g.talent]) sec.push('<div class="tal">✦ ' + esc(G.TALENTS[g.talent].name) + ' — ' + esc(G.TALENTS[g.talent].desc) + '</div>');
    for (i = 0; i < g.traits.length; i++) { var tr = G.TRAITS[g.traits[i]]; if (tr) sec.push('<div class="' + (tr.good ? 'good' : 'bad') + '">' + esc(tr.name) + ' — ' + esc(tr.desc) + '</div>'); }
    if (g.cards && g.cards.length) {
      var cnt = {}, order = [];
      for (i = 0; i < g.cards.length; i++) { if (!cnt[g.cards[i]]) { cnt[g.cards[i]] = 0; order.push(g.cards[i]); } cnt[g.cards[i]]++; }
      var cs = order.map(function (k) { if (!G.CARDS[k]) return ''; var u = cardIconUrl(k, 22); return '<span class="tt-card">' + (u ? '<img src="' + u + '" alt="">' : '') + esc(G.CARDS[k].name) + (cnt[k] > 1 ? ' ×' + cnt[k] : '') + '</span>'; });
      sec.push('<div class="tt-cards"><span class="tt-desc">Thẻ:</span> ' + cs.join(' ') + '</div>');
    }
    for (i = 0; i < g.injuries.length; i++) {
      var inj = g.injuries[i], I = G.INJURIES[inj.id]; if (!I) continue;
      sec.push('<div class="inj">✚ ' + esc(I.name) + ' — ' + esc(I.desc) + ' (' + (inj.perm ? 'vĩnh viễn' : 'còn ' + Math.max(1, Math.ceil(inj.days)) + ' ngày') + ')</div>');
    }
    if (!o.foe && g.pending > 0) sec.push('<div class="tal">▲ Có ' + g.pending + ' thẻ lên cấp chưa chọn.</div>');
    if (sec.length) H.push('<div class="tt-sec">' + sec.join('') + '</div>');
    H.push(weaponBlock(w));
    if (o.price != null) H.push('<div class="tt-sec tt-price">Giá: ' + o.price + ' vàng' + (o.price === 0 ? ' — hắn tự bán mình để trả nợ.' : '') + '</div>');
    if (o.sell != null) H.push('<div class="tt-sec tt-price">Bán lại được ' + o.sell + ' vàng.</div>');
    return H.join('');
  }

  var EXTRA = [
    ['hpMul', function (v) { return '+' + pct(v) + ' máu'; }],
    ['aspd', function (v) { return '+' + pct(v) + ' tốc độ đánh'; }],
    ['resist', function (v) { return '+' + pct(v) + ' kháng hiệu ứng (choáng, lưới, chậm, chảy máu ngắn lại)'; }],
    ['missileBlock', function (v) { return '+' + pct(v) + ' chặn lao'; }],
    ['deflect', function (v) { return 'Gạt ' + pct(v) + ' đòn, không cần khiên'; }],
    ['appeal', function (v) { return (v > 0 ? '+' : '') + v + ' sức hút khán giả'; }],
    ['netRes', function (v) { return '−' + pct(v) + ' thời gian dính lưới'; }],
    ['steady', function (v) { return '−' + pct(v) + ' choáng và bị đẩy lùi'; }],
    ['moveMul', function (v) { return (v > 0 ? '+' : '−') + pct(Math.abs(v)) + ' tốc độ di chuyển'; }],
    ['dodge', function (v) { return (v > 0 ? '+' : '−') + pct(Math.abs(v)) + ' né'; }],
    ['sta', function (v) { return '+' + v + ' Thể lực'; }],
    ['hp', function (v) { return '+' + v + ' Máu'; }],
    ['crit', function (v) { return '+' + pct(v) + ' chí mạng'; }],
    ['deathMul', function (v) { return '−' + pct(1 - v) + ' khả năng chết khi gục'; }],
    ['moraleFight', function (v) { return '+' + v + ' tinh thần mỗi lần ra sân'; }]
  ];

  // Tooltip vật phẩm. o: {price, sell, g (đấu sĩ để so sánh), worn (đang mặc: bấm để tháo)}
  // các dòng do độ hiếm mang lại: phụ tố (chỉ số) và hiệu ứng đặc biệt
  function rarLines(inst) {
    if (!inst || !inst.r) return '';
    var out = '';
    if (inst.aff) inst.aff.forEach(function (a) { var A = G.AFFIX[a]; if (A) out += '<div class="aff rr' + inst.r + '">◆ ' + esc(A.n) + ': ' + esc(A.t) + '</div>'; });
    if (inst.fx && G.EFFECT[inst.fx]) out += '<div class="fx">★ ' + esc(G.EFFECT[inst.fx].n) + ' — ' + esc(G.EFFECT[inst.fx].t) + '</div>';
    return out;
  }
  function itemTip(it, o) {
    o = o || {};
    if (!it) return '';
    var H = [], i, inst = o.inst || null, rr = (inst && inst.r) || 0, RR = G.RAR[rr], inf = G.instInfo(inst || { id: it.id }), afx = [], rch = 0, pn = 0;
    if (inst && inst.aff) inst.aff.forEach(function (a) { if (G.AFFIX[a]) afx.push(G.AFFIX[a]); });
    afx.forEach(function (a) { rch += a.reach || 0; pn += a.pen || 0; });
    H.push('<div class="tt-h rr' + rr + '">' + esc(inst ? G.instName(inst) : it.name) + '</div>');
    H.push('<div class="tt-sub">' + G.SLOT_NAME[it.slot] + (it.id !== 'fist' ? ' · <span class="rr' + rr + '">Độ hiếm ' + RR.name + '</span>' : '') + '</div>');
    if (it.slot === 'weapon') {
      var K = G.WKIND[it.kind];
      H.push('<div class="tt-grid">' +
        kv('Sát thương', num(inf.dmg, 1) + (it.kind === 'twin' ? ' ×2' : '')) + kv('Nhịp', num(K.interval * (it.spd || 1), 2) + ' giây') +
        kv('Tầm', num(K.reach + (it.reach || 0) + rch, 2) + ' m') + kv('Nặng', num(inf.wt, 1)) +
        kv('Xuyên giáp', pct(Math.min(0.95, K.pen + (it.pen || 0) + pn))) + kv('Tay', K.hands === 2 ? 'cần hai tay' : 'một tay') +
        '</div>');
      if (it.desc) H.push('<div class="tt-desc">' + esc(it.desc) + '</div>');
      H.push(rarLines(inst));
      H.push(weaponBlock(it));
    } else {
      var ln = [];
      if (it.armor) ln.push('<span>Giáp ' + G.LOC_NAME[it.slot] + '</span> <b>' + num(inf.armor, 1) + '</b>');
      if (it.slot === 'shield') ln.push('<span>Chặn</span> <b>' + pct(inf.block) + '</b>');
      ln.push('<span>Nặng</span> <b>' + num(inf.wt, 1) + '</b>');
      H.push('<div class="tt-line">' + ln.join(' &nbsp; ') + '</div>');
      var ex = [];
      for (i = 0; i < EXTRA.length; i++) if (it[EXTRA[i][0]]) ex.push(EXTRA[i][1](it[EXTRA[i][0]]));
      if (ex.length) H.push('<div class="good">' + ex.join(' · ') + '</div>');
      if (it.desc) H.push('<div class="tt-desc">' + esc(it.desc) + '</div>');
      H.push(rarLines(inst));
    }
    // so với người đang chọn
    var g = o.g;
    if (g && !o.worn) {
      var cur = G.itemOf(g.gear[it.slot]), c = [], ci = cur ? G.instInfo(g.gear[it.slot]) : null;
      if (it.slot === 'weapon') c.push(cur ? 'đang cầm ' + esc(cur.name) + ' (sát thương ' + num(ci.dmg, 1) + ')' : 'đang tay không');
      else if (cur) c.push('đang mang ' + esc(cur.name) + (cur.armor ? ' (giáp ' + num(ci.armor, 1) + ', nặng ' + num(ci.wt, 1) + ')' : (cur.block ? ' (chặn ' + pct(ci.block) + ')' : '')));
      else c.push('ô này đang trống');
      var can = true, why = '';
      if (it.slot === 'shield' && G.WKIND[G.weaponOf(g).kind].hands === 2) { can = false; why = 'vũ khí của hắn cần cả hai tay'; }
      else if (!G.canCarry(g, it, inst)) { can = false; why = 'quá nặng với hắn'; }
      if (!can) H.push('<div class="tt-sec"><span class="warn">' + esc(g.name) + ' không dùng được — ' + why + '.</span></div>');   // chỉ báo khi người đang chọn không dùng nổi
    }
    if (o.worn) H.push('<div class="tt-sec tt-desc">Bấm để tháo ra, cất vào kho.</div>');
    if (o.price != null) H.push('<div class="tt-sec tt-price">Giá: ' + o.price + ' vàng</div>');
    if (o.sell != null) H.push('<div class="tt-sec tt-price">Bán được ' + o.sell + ' vàng (nửa giá).</div>');
    return H.join('');
  }
  function relicTip(id, price) {
    var R = G.RELICS[id]; if (!R) return '';
    return '<div class="tt-h tal">' + esc(R.name) + '</div><div class="tt-sub">Của riêng cho lanista · có tác dụng mãi mãi</div><div>' + esc(R.desc) + '</div>' +
      (price != null ? '<div class="tt-sec tt-price">Giá: ' + price + ' vàng</div>' : '');
  }
  function fightTip(f) {
    if (!f) return '';
    var H = [];
    H.push('<div class="tt-h">' + (f.boss ? '☠ ' : '') + esc(f.name) + '</div>');
    H.push('<div class="tt-sub">' + (f.main ? (f.boss ? 'Trận chính — trùm' : 'Trận chính — thua thì hôm khác đấu lại') : 'Trận phụ — đấu lại bao nhiêu lần cũng được') + '</div>');
    if (f.desc) H.push('<div>' + esc(f.desc) + '</div>');
    if (f.hint) H.push('<div class="tt-sec"><span class="tal">Lời mách:</span> ' + esc(f.hint) + '</div>');
    H.push('<div class="tt-sec"><span class="tt-price">Thưởng ' + f.gold + ' vàng</span>, ' + f.xp + ' kinh nghiệm mỗi người ra sân · Địch: ' + f.foes.length + ' người</div>');
    var gm = UI.game, sb = gm ? gm.streakBonus() : 0, sk = gm ? (gm.s.streak || 0) : 0;
    if (sb > 0) H.push('<div class="tt-sec good">Đang thắng liền ' + sk + ' trận: thắng trận này được thêm ' + Math.round(sb * 100) + '% túi thưởng (+' + Math.round(f.gold * sb * (gm.has('patron') ? 1.2 : 1)) + ' vàng). Thua là mất chuỗi.</div>');
    else H.push('<div class="tt-desc">Thắng liên tiếp: từ trận thắng thứ hai liền nhau, mỗi trận thắng trước đó cộng thêm 10% túi thưởng (tối đa +50%). Thua là mất chuỗi.</div>');
    if (f.side && f.bored) H.push('<div class="tt-sec bad">Khán giả đã chán: túi thưởng vơi ' + f.bored.pct + '% (anh đã đấu ' + f.bored.n + ' trận phụ kể từ lần thắng trận chính gần nhất). Thắng một trận chính thì họ hào hứng lại.</div>');
    else if (f.side) H.push('<div class="tt-desc">Mỗi trận phụ làm khán giả chán thêm: túi thưởng trận phụ vơi 5% mỗi lần, thấp nhất còn một nửa, cho tới khi anh thắng một trận chính.</div>');
    H.push('<div class="tt-desc">Thua vẫn nhận tiền xuất trận: ' + Math.round(f.gold * G.Game.LOSS_PAY) + ' vàng.</div>');
    return H.join('');
  }

  // ---------------------------------------------------------------- khung chính
  function build() {
    root = document.getElementById('ui');
    clear(root);
    elTop = h('div'); elTop.id = 'topbar';
    elHint = h('div'); elHint.id = 'hint';
    elLeft = h('div', 'panel'); elLeft.id = 'left';
    elRight = h('div', 'panel'); elRight.id = 'right';
    elBottom = h('div', 'panel'); elBottom.id = 'bottom';
    elTitle = h('div'); elTitle.id = 'title';
    elHud = h('div'); elHud.id = 'hud';
    elToasts = h('div'); elToasts.id = 'toasts';
    elModals = h('div'); elModals.id = 'modals';
    elTip = h('div'); elTip.id = 'tip';
    elTags = h('div'); elTags.id = 'tags'; elEquip = h('div', 'panel'); elEquip.id = 'equip'; show(elEquip, false);
    elStash = h('div', 'panel'); elStash.id = 'stash'; show(elStash, false);
    add(root, elTags, elTop, elHint, elLeft, elRight, elEquip, elBottom, elStash, elTitle, elHud, elToasts, elModals);
    document.addEventListener('mousemove', dragMove); document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', formDragMove); document.addEventListener('mouseup', formDragEnd);
    requestAnimationFrame(tagLoop);
    document.body.appendChild(elTip);
    showHub(false); show(elTitle, false); show(elHud, false);

    document.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; if (tipOwner === '3d') tipMove(mouse.x, mouse.y); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (elPop) { closePop(); return; }
        var m = modalStack[modalStack.length - 1];
        if (m && m.opts.closable !== false) m.close();
      }
    });
    var unlock = function () { try { if (G.Audio && G.Audio.unlock) G.Audio.unlock(); } catch (e) { } };
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    document.addEventListener('mousedown', function (e) { if (elPop && !elPop.contains(e.target) && !(e.target.closest && e.target.closest('.popbtn'))) closePop(); });
    try { if (localStorage.getItem(MUTE_KEY) === '1' && G.Audio && G.Audio.setMuted) G.Audio.setMuted(true); } catch (e) { }
  }
  function showHub(on) { show(elTags, on); if (!on) { show(elEquip, false); UI.equipOpen = false; show(elStash, false); } show(elTop, on); show(elHint, on); show(elLeft, on); show(elRight, on); show(elBottom, on); if (!on) closePop(); }
  function isMuted() { try { return !!(G.Audio && G.Audio.isMuted && G.Audio.isMuted()); } catch (e) { return false; } }
  function toggleMute() {
    var m = !isMuted();
    try { if (G.Audio && G.Audio.setMuted) G.Audio.setMuted(m); localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { }
    return m;
  }
  function soundBtn(cls) {
    var b = btn(isMuted() ? 'Âm thanh: tắt' : 'Âm thanh: bật', cls, function () { var m = toggleMute(); b.innerHTML = m ? 'Âm thanh: tắt' : 'Âm thanh: bật'; });
    if (!G.Audio) b.classList.add('hidden');
    return b;
  }

  // ---------------------------------------------------------------- màn hình chính
  function showTitle() {
    UI.state = 'title'; UI.battle = null;
    closeAllModals(); tipHide(); showHub(false); show(elHud, false); clear(elHud);
    var old = root.querySelector('.result'); if (old) old.parentNode.removeChild(old);
    var saved = G.Game.load();
    var tier = saved ? saved.s.tier : 0;
    var ar = vsub('arena');
    vtry(function () { if (ar && ar.stop) ar.stop(); });
    vtry(function () { if (ar && ar.idle) ar.idle(tier); });
    vgo('title', { tier: tier });
    amb('title');
    clear(elTitle); show(elTitle, true);
    var logo = h('div', 'logo'); add(logo, h('div', 't', G.TITLE || 'LANISTA'), h('div', 's', G.SUBTITLE || 'Cát & Máu'));
    var menu = h('div', 'menu');
    if (saved) {
      add(menu, btn('Tiếp tục', null, function () { UI.game = saved; show(elTitle, false); enterHub(); }));
      add(menu, h('div', 'saveinfo', 'Ngày ' + saved.s.day + ' · ' + G.TIERS[saved.s.tier].name + ' · ' + saved.s.roster.length + ' người · ' + saved.s.gold + ' vàng'));
    }
    add(menu, btn('Chơi mới', null, function () {
      if (saved) confirmBox('Chơi mới', 'Trường cũ của anh (ngày ' + saved.s.day + ') sẽ bị xóa hẳn.', 'Xóa và chơi mới', newGame);
      else newGame();
    }));
    add(menu, soundBtn('sm'));
    var tb = btn('Hướng dẫn: ' + (tutOff() ? 'tắt' : 'bật'), 'sm', function () { tutSet(!tutOff()); tb.innerHTML = 'Hướng dẫn: ' + (tutOff() ? 'tắt' : 'bật'); });
    add(menu, tb);
    add(menu, h('div', 'saveinfo dim', 'Mỗi lần mở link là một ván mới. Lỡ tải lại trang (F5) thì vẫn chơi tiếp được; đóng tab là mất ván.'));
    add(elTitle, logo, menu);
  }
  function newGame() {
    G.Game.clearSave();
    UI.game = G.Game.create();
    if (!tutOff()) UI.game.s.tut = 1;
    UI.game.save();
    show(elTitle, false);
    UI.sel = null;
    if (!UI.game.s.seenIntro) showIntro(); else enterHub();
  }
  function showIntro() {
    var d = h('div'), m;
    add(d, h('h2', null, 'Trường đấu sĩ của anh'));
    var P = [
      'Anh là một lanista — chủ một trường đấu sĩ chưa có lấy một đấu sĩ. Trong túi anh có 160 đồng vàng: vừa đủ mua một hai nô lệ rẻ tiền ở chợ Capua.',
      'Mua người. Sắm cho họ vũ khí và giáp. Xếp họ lên ô đội hình. Rồi đứng nhìn: trên cát họ tự đánh, còn anh chỉ có đúng một quyền — xin thua.',
      'Mỗi ngày chỉ một trận. Ngày nào người của anh cũng phải ăn, kể cả ngày không đấu.',
      'Mỗi đấu trường có bảy trận chính. Trận thứ bảy là một nhà vô địch: một mình hắn đấu với cả đội của anh.',
      'Từ bãi chợ, qua làng, lên thành phố, tới Colosseum. Người của anh có thể bị thương, có thể chết, có thể bỏ trốn. Còn tiền thì không bao giờ đủ.'
    ];
    for (var i = 0; i < P.length; i++) add(d, h('p', null, P[i]));
    var f = h('div', 'foot');
    add(f, btn('Bắt đầu', 'big', function () { m.close(); }));
    d.appendChild(f);
    m = modal(d, { closable: false, onClose: function () { UI.game.s.seenIntro = true; UI.game.save(); enterHub(); } });
  }

  // ---------------------------------------------------------------- trung tâm ngày
  function enterHub(tab) {
    var gm = UI.game;
    UI.state = 'hub'; UI.battle = null;
    show(elTitle, false); show(elHud, false); clear(elHud);
    UI.fightKind = gm.mainFight() ? 'main' : 'side1';
    fixSel();
    goldShown = gm.s.gold;
    showHub(true);
    setTab(tab || (gm.s.roster.length && gm.s.fought ? 'ready' : 'market'), true);
  }
  function fixSel() {
    var gm = UI.game;
    if (!UI.sel || !gm.glad(UI.sel)) UI.sel = gm.s.roster.length ? gm.s.roster[0].id : null;
  }
  function setTab(tab, force) {
    if (!force && UI.tab === tab) return;
    UI.tab = tab; UI.deploy = false;
    tipHide();
    vgo(spaceName(), { tier: UI.game.s.tier });
    amb(tab);
    if (tab === 'ready' && UI.game.fielded() === 0 && UI.game.s.roster.length) { UI.game.autoForm(); fillField(); UI.game.save(); }
    UI.refresh();
  }
  // Xếp nốt những người chưa ra sân vào ô trống cho đến khi đủ số người được phép.
  function fillField() {
    var gm = UI.game, s = gm.s;
    for (var i = 0; i < s.roster.length && gm.fielded() < gm.fieldLimit(); i++) if (!s.form[s.roster[i].id]) quickPlace(s.roster[i]);
  }
  UI.refresh = function () {
    if (UI.state !== 'hub' || !UI.game) return;
    fixSel();
    tipHide();
    renderTop(); renderHint();
    clear(elTags); tagList = [];
    if (UI.tab !== 'ready') { UI.equipOpen = false; show(elEquip, false); }
    if (UI.tab !== 'shop') { show(elStash, false); UI.lastSold = null; }
    if (UI.tab === 'market') renderMarket();
    else if (UI.tab === 'shop') renderShop();
    else renderReady();
    pushView();
    tutApply();
  };

  var foeCache = { key: '', foes: null };
  function currentFight() {
    var gm = UI.game, f = gm.fight(UI.fightKind);
    if (!f) { UI.fightKind = gm.mainFight() ? 'main' : 'side1'; f = gm.fight(UI.fightKind); }
    return f;
  }
  function currentFoes() {
    var gm = UI.game, f = currentFight(); if (!f) return null;
    var key = gm.s.day + '|' + UI.fightKind + '|' + gm.s.tier + '|' + gm.s.stage + '|' + (f.seed || 0);
    if (f.ghost) key += '|g' + f.ghost.run + ':' + f.ghost.stage;
    if (foeCache.key !== key) { foeCache.key = key; foeCache.foes = gm.foeTeam(f); }
    return foeCache.foes;
  }

  // đẩy dữ liệu sang phần 3D và gắn callback
  function pushView() {
    var gm = UI.game, s = gm.s;
    if (UI.tab === 'market') {
      var mk = vsub('market'); if (!mk) return;
      mk.onHover = function (i) {
        hlRow(i);
        var o = s.market.slaves[i];
        if (i >= 0 && o && !o.sold) tip3d('m' + i, function () { return gladTip(o.g, { price: o.price }); }); else tipHide('3d');
      };
      mk.onClick = function (i) { hlRow(i, true); };
      vtry(function () { if (mk.show) mk.show(s.market.slaves); });
    } else if (UI.tab === 'shop') {
      var sh = vsub('shop'); if (!sh) return;
      sh.onHover = function (i) {
        hlRow(i);
        if (i === 'relic' && s.market.relic && !s.market.relic.sold) tip3d('relic', function () { return relicTip(s.market.relic.id, s.market.relic.price); });
        else if (typeof i === 'number' && i >= 0 && s.market.shop[i] && !s.market.shop[i].sold) tip3d('s' + i, function () { return itemTip(G.ITEMS[s.market.shop[i].id], { price: s.market.shop[i].price, g: gm.glad(UI.sel), inst: s.market.shop[i] }); });
        else tipHide('3d');
      };
      sh.onClick = function (i) { hlRow(i, true); };
      vtry(function () { if (sh.show) sh.show(s.market.shop, s.market.relic); });
    } else if (!UI.deploy) {
      var lb = vsub('lobby'); if (!lb) return;
      lb.onPick = function (p) { if (p && p.type === 'glad' && gm.glad(p.id)) { UI.sel = p.id; UI.equipOpen = true; snd('click'); UI.refresh(); } };
      lb.onHover = function (p, x, y) { if (p && p.type === 'glad') { var g = gm.glad(p.id); if (g) { tip3d('g' + p.id, function () { return gladTip(g, {}); }, x, y); return; } } tipHide('3d'); };
      vtry(function () { if (lb.show) lb.show({ roster: s.roster, form: s.form }); });
      vtry(function () { if (lb.select) lb.select(UI.sel); });
    } else {
      var rd = vsub('ready'); if (!rd) return;
      rd.onPick = onReadyPick;
      rd.onDown = function (p, x, y, e) { if (p.type === 'glad' && gm.glad(p.id)) formDragStart(p.id, e, '3d'); };
      rd.onHover = function (p, x, y) {
        if (p && p.type === 'glad') { var g = gm.glad(p.id); if (g) { tip3d('g' + p.id, function () { return gladTip(g, {}); }, x, y); return; } }
        if (p && p.type === 'foe') { var fs = currentFoes(); if (fs && fs[p.idx]) { tip3d('f' + p.idx, function () { return gladTip(fs[p.idx].g, { foe: true }); }, x, y); return; } }
        tipHide('3d');
      };
      vtry(function () { if (rd.show) rd.show({ roster: s.roster, form: s.form, foes: currentFoes(), limit: gm.fieldLimit(), tier: s.tier }); });
      vtry(function () { if (rd.select) rd.select(UI.sel); });
    }
  }
  function hlRow(i, flash) {
    var rows = elLeft.querySelectorAll('.row[data-i]');
    for (var k = 0; k < rows.length; k++) {
      var on = rows[k].getAttribute('data-i') === String(i);
      rows[k].classList[on ? 'add' : 'remove']('hl');
      if (on && flash && rows[k].scrollIntoView) rows[k].scrollIntoView({ block: 'nearest' });
    }
  }
  function onReadyPick(p) {
    var gm = UI.game; if (!p) return;
    if (p.type === 'glad') { if (gm.glad(p.id)) { UI.sel = p.id; UI.equipOpen = true; snd('click'); UI.refresh(); } }
    else if (p.type === 'cell') {
      if (!UI.sel) { toast('Chọn một người trước đã.'); return; }
      if (gm.place(UI.sel, p.c, p.r)) { snd('equip'); gm.save(); UI.refresh(); }
      else { snd('error'); toast('Đấu trường này chỉ cho ' + gm.fieldLimit() + ' người ra sân. Rút bớt một người về ghế trước.', 'err'); }
    } else if (p.type === 'bench') {
      if (UI.sel && gm.s.form[UI.sel]) { gm.bench(UI.sel); gm.save(); snd('click'); UI.refresh(); }
    }
  }

  // ---------------------------------------------------------------- thanh trên
  var goldShown = 0, goldAnim = 0;
  function renderTop() {
    var gm = UI.game, s = gm.s, T = gm.tierDef();
    clear(elTop);
    add(elTop, h('div', 'brand', G.TITLE || 'LANISTA'));
    var i1 = h('div', 'info'); i1.innerHTML = esc(T.name) + ' · ' + (s.won ? '<b>đã vô địch</b>' : 'Trận chính <b>' + Math.min(7, s.stage + 1) + '/7</b>');
    bindTip(i1, function () { return '<div class="tt-h">' + esc(T.name) + '</div><div>' + esc(T.desc) + '</div><div class="tt-sec">Được ra sân ' + T.field + ' người. Hàng ở chợ và lò rèn tốt dần theo đấu trường.</div>'; });
    var i2 = h('div', 'info'); i2.innerHTML = 'Ngày <b>' + s.day + '</b>';
    var ig = h('div', 'info gold'); ig.innerHTML = '<span class="coin"></span><b id="goldnum">' + Math.round(goldShown) + '</b> vàng';
    var up = gm.upkeep();
    var i3 = h('div', 'info'); i3.innerHTML = 'Phí nuôi <b>−' + up + '</b>/ngày';
    bindTip(i3, function () {
      var H = ['<div class="tt-h">Phí nuôi mỗi ngày</div><div>Trả khi qua ngày, đấu hay không cũng trả. Không đủ tiền thì cả trường nhịn đói và tinh thần sụt mạnh.</div>'];
      if (s.roster.length) { H.push('<div class="tt-sec">'); for (var i = 0; i < s.roster.length; i++) H.push('<div class="tt-line"><span>' + esc(s.roster[i].name) + '</span> <b>' + G.upkeepOf(s.roster[i], s.tier, s.relics) + '</b></div>'); H.push('</div>'); }
      return H.join('');
    });
    add(elTop, i1, i2, ig, i3);
    // vay tiền / đang nợ
    if (s.loan) {
      var i4 = h('div', 'info'); i4.innerHTML = 'Nợ <b class="warn">' + s.loan.owed + '</b>';
      bindTip(i4, function () { return '<div class="tt-h">Khoản vay</div><div>Còn nợ ' + s.loan.owed + ' vàng. Mỗi lần qua ngày trả ' + Math.min(s.loan.daily, s.loan.owed) + ' vàng (sau tiền nuôi), còn khoảng ' + Math.ceil(s.loan.owed / s.loan.daily) + ' ngày.</div><div class="tt-sec">Thiếu tiền trả: chủ nợ lấy hết số đang có, phần còn lại vẫn nợ, và cả trường −5 tinh thần.</div>'; });
      add(elTop, i4);
    } else {
      var lo = gm.loanOffer();
      if (lo) {
        var lb = btn('Vay tiền', 'small', function () {
          confirmBox('Vay tiền', 'Vay ' + lo.amount + ' vàng (bằng 150% túi thưởng trận chính đang chờ). Trả góp trong ' + lo.days + ' ngày, mỗi ngày ' + lo.daily + ' vàng — tổng ' + lo.owed + ' vàng, lãi 20%. Thiếu tiền trả thì cả trường mất tinh thần. Chưa trả hết thì không vay thêm được.', 'Vay ' + lo.amount + ' vàng', function () {
            var res = gm.takeLoan();
            if (res.ok) { snd('coin'); toast('Đã vay ' + res.amount + ' vàng.'); UI.refresh(); } else fail(res);
          });
        });
        bindTip(lb, function () { return '<div class="tt-h">Vay tiền</div><div>Vay ' + lo.amount + ' vàng ngay bây giờ; trả ' + lo.daily + ' vàng mỗi ngày trong ' + lo.days + ' ngày (tổng ' + lo.owed + ', lãi 20%).</div>'; });
        add(elTop, lb);
      }
    }
    var tabs = h('div', 'tabs');
    var defs = [['market', 'Chợ nô lệ'], ['shop', 'Lò rèn'], ['ready', 'Phòng chờ']];
    var pend = s.roster.some(function (g) { return g.pending > 0; });
    defs.forEach(function (d) {
      var b = h('button', 'tab' + (UI.tab === d[0] ? ' on' : '')); b.setAttribute('data-tab', d[0]);
      b.innerHTML = d[1] + (d[0] === 'ready' && pend ? '<span class="pip">▲</span>' : '');
      b.addEventListener('click', function () { snd('click'); setTab(d[0]); });
      tabs.appendChild(b);
    });
    add(elTop, h('div', 'sep'), tabs, h('div', 'sep'));
    var rb = btn('Của riêng' + (s.relics.length ? ' (' + s.relics.length + ')' : ''), 'small popbtn', function () { togglePop('relics'); });
    add(elTop, rb, soundBtn('small'), btn('≡', 'small popbtn', function () { togglePop('menu'); }));
    var nd = btn(s.fought ? 'Qua ngày ▸' : 'Nghỉ một ngày ▸', s.fought ? 'warn' : '', nextDay);
    bindTip(nd, function () {
      return '<div class="tt-h">Sang ngày ' + (s.day + 1) + '</div><div>Trả ' + up + ' vàng phí nuôi' + (s.gold < up ? ' <span class="warn">(không đủ — cả trường sẽ nhịn đói)</span>' : '') +
        '. Vết thương lành dần, chợ và lò rèn đổi hàng, trận phụ mới.' + (s.fought ? '' : ' Hôm nay anh chưa đấu: người nghỉ ngơi được +2 tinh thần.') + '</div>';
    });
    add(elTop, nd);
    animateGold();
  }
  function animateGold() {
    var target = UI.game.s.gold;
    if (Math.round(goldShown) === target) return;
    var from = goldShown, t0 = Date.now(), my = ++goldAnim;
    var box = elTop.querySelector('.info.gold');
    if (box) box.classList.add(target > from ? 'up' : 'down');
    if (target > from) snd('coin');
    function step() {
      if (my !== goldAnim) return;
      var k = Math.min(1, (Date.now() - t0) / 550);
      goldShown = from + (target - from) * (1 - (1 - k) * (1 - k));
      var e = document.getElementById('goldnum'); if (e) e.textContent = Math.round(goldShown);
      if (k < 1) requestAnimationFrame(step);
      else { goldShown = target; var b2 = elTop.querySelector('.info.gold'); if (b2) { b2.classList.remove('up'); b2.classList.remove('down'); } }
    }
    requestAnimationFrame(step);
  }
  // ---------------------------------------------------------------- HƯỚNG DẪN NGÀY 1
  // Bảy bước, suy ra từ trạng thái ván (không khóa người chơi): thanh gợi ý nói bước kế tiếp, vòng sáng chỉ vào thứ cần bấm.
  // Chỉ chạy ở ngày 1 của ván vừa tạo; xong một lần thì tự tắt (nút "Hướng dẫn" ở màn hình đầu bật lại được).
  var TUT_KEY = 'lanista_tut';
  function tutOff() { try { return localStorage.getItem(TUT_KEY) === 'off'; } catch (e) { return false; } }
  function tutSet(off) { try { if (off) localStorage.setItem(TUT_KEY, 'off'); else localStorage.removeItem(TUT_KEY); } catch (e) { } }
  function tutOn() { var g = UI.game; return !!g && g.s.tut === 1 && g.s.day === 1 && !tutOff(); }
  function tutStep() {
    if (!tutOn()) return null;
    var gm = UI.game, s = gm.s;
    function q(root, sel) { return root ? [].slice.call(root.querySelectorAll(sel)) : []; }
    function tab(id) { return q(elTop, '.tab[data-tab="' + id + '"]'); }
    function byText(root, re) { return q(root, 'button').filter(function (b) { return re.test(b.textContent); }); }
    if (UI.state === 'fight') return { n: 6, text: 'Trên cát họ tự đánh. Anh chỉ có một quyền: xin thua.', els: [] };
    if (UI.state === 'result') return { n: 7, text: 'Tiền thưởng và thương tích của trận nằm trong bảng này. Bấm Qua ngày để sang ngày mới.', els: byText(root.querySelector('.panel.result'), /^Qua ngày/) };
    if (UI.state !== 'hub') return null;
    if (!s.roster.length) return { n: 1, text: 'Rê chuột lên từng người để xem, rồi mua một nô lệ.', els: UI.tab === 'market' ? q(elTags, '.tag3d .btn.price') : tab('market') };
    var armed = s.roster.some(function (g) { return !!g.gear.weapon; });
    var invW = s.inv.some(function (x) { return G.ITEMS[x.id].slot === 'weapon'; });
    if (!armed && !invW && s.market.shop.some(function (o) { return !o.sold && G.ITEMS[o.id].slot === 'weapon' && o.price <= s.gold; })) {
      var wt = [];
      tagList.forEach(function (tg) { var o = tg.space === 'shop' && typeof tg.key === 'number' ? s.market.shop[tg.key] : null; if (o && G.ITEMS[o.id].slot === 'weapon' && o.price <= s.gold) { var b = tg.el.querySelector('.btn.price'); if (b) wt.push(b); } });
      return { n: 2, text: 'Sang Lò rèn mua cho hắn một thứ vũ khí.', els: UI.tab === 'shop' ? wt : tab('shop') };
    }
    if (UI.tab === 'ready' && UI.deploy) return { n: 5, text: 'Kéo người vào ô trên sân; người đánh xa nên đứng sau. Xong thì bấm Chiến đấu.', els: byText(elBottom, /CHIẾN ĐẤU/) };
    if (!armed && invW) {
      var e3 = UI.tab !== 'ready' ? tab('ready') : (UI.equipOpen ? q(elEquip, '.eq-inv .itile') : q(elLeft, '.row.click'));
      return { n: 3, text: 'Vào Phòng chờ, bấm vào hắn rồi kéo vũ khí thả lên người.', els: e3 };
    }
    if (UI.tab !== 'ready') return { n: 4, text: (armed ? '' : 'Không đủ tiền mua vũ khí thì cứ đánh tay không: thắng trận sẽ có tiền. ') + 'Vào Phòng chờ để ra trận.', els: tab('ready') };
    if (!gm.fielded()) return { n: 4, text: 'Bấm nút Ra trận cạnh tên để chọn người ra sân.', els: q(elLeft, '.btn.toggle') };
    return { n: 4, text: (UI.equipOpen ? 'Trang bị xong.' : 'Bên phải là đối thủ hôm nay.') + ' Bấm Ra đấu trường.', els: byText(elBottom, /RA ĐẤU TRƯỜNG/) };
  }
  function tutApply() {
    [].slice.call(document.querySelectorAll('.tut-glow')).forEach(function (e) { e.classList.remove('tut-glow'); });
    var st = tutStep();
    elHint.classList.toggle('tut', !!st);
    if (!st) return false;
    clear(elHint);
    add(elHint, h('b', null, 'Hướng dẫn ' + st.n + '/7'), document.createTextNode(' · ' + st.text + ' '));
    var sk = h('button', 'tut-skip', 'Bỏ hướng dẫn');
    sk.addEventListener('click', function (ev) { ev.stopPropagation(); tutSet(true); tutApply(); if (UI.state === 'hub') UI.refresh(); else show(elHint, false); });
    add(elHint, sk);
    show(elHint, true);
    st.els.forEach(function (e) { e.classList.add('tut-glow'); });
    return true;
  }
  function renderHint() {
    var gm = UI.game, s = gm.s, t = '';
    elHint.classList.remove('tut');
    if (tutStep()) return;   // đang hướng dẫn: tutApply() ở cuối UI.refresh sẽ viết thanh gợi ý
    if (!s.roster.length) t = UI.tab === 'market' ? 'Trường chưa có ai. Nút mua nằm ngay dưới chân từng người — di chuột lên để xem hắn là ai.' : 'Trường chưa có ai. Sang Chợ nô lệ mua người trước.';
    else if (s.fought) t = 'Hôm nay đã đấu. Sắm sửa xong thì qua ngày.';
    else {
      var bare = gm.playerTeam().some(function (p) { return !p.g.gear.weapon; });
      if (bare && UI.tab !== 'shop' && !s.inv.some(function (x) { return G.ITEMS[x.id].slot === 'weapon'; })) t = 'Có người ra sân tay không. Lò rèn có bán vũ khí.';
      else if (bare && UI.tab === 'ready' && !UI.deploy) t = 'Có vũ khí trong kho: bấm vào một người để mở bảng trang bị, rồi kéo món đồ thả vào người hắn.';
      else if (UI.tab === 'ready' && UI.deploy) t = 'Dàn quân: kéo người vào ô trên sân để xếp chỗ, thả vào ô có người để đổi chỗ. Xong thì bấm Chiến đấu.';
      else if (UI.tab === 'ready' && gm.fielded() === 0) t = 'Bấm nút Ra trận cạnh tên để chọn người ra sân.';
    }
    elHint.textContent = t; show(elHint, !!t);
  }
  function closePop() { if (elPop) { if (elPop.parentNode) elPop.parentNode.removeChild(elPop); elPop = null; } }
  function togglePop(kind) {
    if (elPop && elPop._kind === kind) { closePop(); return; }
    closePop();
    var gm = UI.game, s = gm.s;
    elPop = h('div', 'panel pop'); elPop._kind = kind;
    if (kind === 'relics') {
      add(elPop, h('h3', null, 'Của riêng của lanista'));
      if (!s.relics.length) add(elPop, h('div', 'note', 'Anh chưa có gì ngoài cái tên. Thỉnh thoảng lò rèn có bán những thứ dành riêng cho chủ trường.'));
      s.relics.forEach(function (id) { var R = G.RELICS[id]; if (!R) return; var d = h('div', 'rel'); add(d, h('b', null, R.name)); d.appendChild(document.createTextNode(R.desc)); elPop.appendChild(d); });
    } else {
      add(elPop, h('h3', null, 'Trình đơn'));
      var st = s.stat, d2 = h('div', 'rel');
      d2.textContent = 'Thắng ' + st.wins + ' · Thua ' + st.losses + ' · Người chết ' + st.deaths + ' · Bỏ trốn ' + st.deserted + '. Trò chơi tự lưu.';
      var a = h('div', 'acts');
      add(a, btn('Về màn hình chính', null, function () { closePop(); UI.game.save(); showTitle(); }));
      add(elPop, d2, a);
    }
    root.appendChild(elPop);
  }

  // ---------------------------------------------------------------- chợ nô lệ
  function priceBtn(price, can, label, fn) {
    return btn((label ? label + ' ' : '') + coin(price), 'price' + (can ? '' : ' cant'), fn, true);
  }
  function renderMarket() {
    var gm = UI.game, s = gm.s;
    clear(elLeft); clear(elRight); show(elRight, false); show(elBottom, false); show(elLeft, true);
    var hd = h('h3', null, 'Chợ nô lệ'); add(hd, h('small', null, 'Trường: ' + s.roster.length + '/' + G.Game.MAX_ROSTER));
    add(elLeft, hd);
    s.market.slaves.forEach(function (o, i) {
      var r = h('div', 'row' + (o.sold ? ' sold' : '')); r.setAttribute('data-i', i);
      add(r, h('span', 'nm' + (o.g.talent ? ' tal' : ''), o.g.name));
      var buy = function () {
        var res = gm.buySlave(i);
        if (res.ok) { snd('buy'); UI.sel = res.g.id; fillField(); gm.save(); toast(res.g.name + ' đã vào trường của anh.'); UI.refresh(); }
        else fail(res);
      };
      add(r, priceBtn(o.price, s.gold >= o.price, o.price === 0 ? 'Nhận' : 'Mua', buy));
      if (!o.sold) {
        bindTip(r, function () { return gladTip(o.g, { price: o.price }); }, function () { vhl('market', i); }, function () { vhl('market', -1); });
        addTag('market', i, o.g.name, o.g.talent ? 'tal' : '', o.price, s.gold >= o.price, o.price === 0 ? 'Nhận' : 'Mua', buy, function () { return gladTip(o.g, { price: o.price }); });
        addStatCol('market', i, o.g);
      }
      elLeft.appendChild(r);
    });
    add(elLeft, h('div', 'note', 'Mỗi ngày chợ đổi người.'));
    if (s.roster.length) {
      add(elLeft, h('h3', null, 'Trong trường'));
      s.roster.forEach(function (g) {
        var r = h('div', 'row click' + (g.id === UI.sel ? ' sel' : ''));
        add(r, h('span', 'nm' + (g.talent ? ' tal' : ''), g.name), markers(g));
        r.addEventListener('click', function () { UI.sel = g.id; snd('click'); UI.refresh(); });
        bindTip(r, function () { return gladTip(g, { sell: gm.sellValue(g) }); });
        elLeft.appendChild(r);
      });
    }
  }
  function vhl(space, i) { var v = vsub(space); vtry(function () { if (v && v.highlight) v.highlight(i); }); }
  function markers(g) {
    var m = h('span', 'mk'), s = '';
    if (g.pending > 0) s += '<span class="up">▲</span> ';
    if (g.injuries.length) s += '<span class="inj">✚</span> ';
    if (g.morale <= 30) s += '<span class="low">' + (g.morale < 15 ? '⚑!' : '⚑') + '</span>';
    m.innerHTML = s;
    return m;
  }

  // ---------------------------------------------------------------- lò rèn
  function renderShop() {
    var gm = UI.game, s = gm.s, selG = gm.glad(UI.sel);
    clear(elLeft); clear(elRight); show(elRight, false); show(elBottom, false); show(elLeft, true);
    add(elLeft, h('h3', null, 'Lò rèn'));
    s.market.shop.forEach(function (o, i) {
      var it = G.ITEMS[o.id];
      var buy = function () {
        var res = gm.buyItem(i);
        if (res.ok) { snd('buy'); toast(it.name + ' đã vào kho. Sang Phòng chờ để trang bị.'); UI.refresh(); } else fail(res);
      };
      if (!o.sold) {
        addTag('shop', i, null, 'rr' + (o.r || 0), o.price, s.gold >= o.price, '', buy, function () { return itemTip(it, { price: o.price, g: selG, inst: o }); });
        addItemStats('shop', i, o);
      }
    });
    var rc = G.Game.REROLL_COST, rb = btn('Đổi lượt hàng ' + coin(rc), 'small' + (s.gold >= rc ? '' : ' off'), function () {
      var res = gm.reroll();
      if (res.ok) { snd('coin'); UI.invSel = null; UI.refresh(); } else fail(res);
    }, true);
    bindTip(rb, function () { return '<div class="tt-h">Đổi lượt hàng</div><div>Trả ' + rc + ' vàng để thợ rèn dọn hết hàng đang bày và bày một lượt mới — độ hiếm cũng gieo lại. Bấm bao nhiêu lần cũng được.</div><div class="tt-sec tt-desc">Vật riêng cho lanista không đổi.</div>'; });
    var ra = h('div', 'acts'); add(ra, rb); add(elLeft, ra);
    var rl = s.market.relic;
    if (rl) {
      var R = G.RELICS[rl.id];
      var buyR = function () {
        var res = gm.buyRelic();
        if (res.ok) { snd('buy'); toast(R.name + ' giờ là của anh.'); UI.refresh(); } else fail(res);
      };
      if (!rl.sold) {
        addTag('shop', 'relic', null, 'tal', rl.price, s.gold >= rl.price, '', buyR, function () { return relicTip(rl.id, rl.price); });
      }
    }
    renderStash();
  }
  // Thanh kho ở đáy Lò rèn: mọi món chưa mặc, kèm giá bán; bấm là bán, bán nhầm thì lấy lại được.
  function renderStash() {
    var gm = UI.game, s = gm.s, selG = gm.glad(UI.sel), inv = sortedInv(), total = 0, ls = UI.lastSold;
    if (ls && ls.day !== s.day) ls = UI.lastSold = null;
    clear(elStash); show(elStash, true); elStash.style.top = (elLeft.offsetTop + elLeft.offsetHeight + 8) + 'px';   // kho là một ô riêng ngay dưới nút đổi hàng
    inv.forEach(function (inst) { total += UI.game.itemSellValue(inst); });
    var hd = h('div', 'st-head'), ttl = h('h3', null, 'Bán đồ trong kho');
    add(ttl, h('small', null, inv.length ? inv.length + ' món · bán hết được ' + total + ' vàng' : 'kho trống'));
    add(hd, ttl);
    if (ls) {
      var I = G.ITEMS[ls.inst.id], undo = h('div', 'st-undo');
      undo.innerHTML = 'Vừa bán <span class="nm rr' + (ls.inst.r || 0) + '">' + esc(G.instName(ls.inst)) + '</span> ' + coin('+' + ls.gold);
      add(undo, btn('Lấy lại', 'small' + (s.gold >= ls.gold ? '' : ' off'), function () {
        var res = gm.undoSell(ls.inst, ls.gold);
        if (res.ok) { snd('equip'); UI.lastSold = null; UI.refresh(); } else fail(res);
      }));
      add(hd, undo);
    }
    add(elStash, hd);
    if (!inv.length) { add(elStash, h('div', 'note', 'Chưa có món nào để bán. Đồ đang mặc trên người phải tháo ra ở Phòng chờ trước.')); return; }
    var grid = h('div', 'st-grid');
    inv.forEach(function (inst) {
      var it = G.ITEMS[inst.id], val = UI.game.itemSellValue(inst), cell = h('div', 'st-cell'), t = itemTile(it, '', inst), pr = h('div', 'st-price');
      pr.innerHTML = coin(val);
      add(cell, t, pr);
      function sell() {
        var res = gm.sellItem(inst.uid);
        if (res.ok) { snd('coin'); UI.lastSold = { inst: res.inst, gold: res.gold, day: s.day }; UI.refresh(); } else fail(res);
      }
      cell.addEventListener('click', function () {
        if ((inst.r || 0) >= 3) confirmBox('Bán ' + G.instName(inst) + '?', 'Món ' + G.RAR[inst.r].name.toLowerCase() + ' này bán lại được ' + val + ' vàng (nửa giá).', 'Bán', sell);
        else sell();
      });
      bindTip(cell, function () { return itemTip(it, { sell: val, g: selG, inst: inst }); });
      grid.appendChild(cell);
    });
    add(elStash, grid);
    add(elStash, h('div', 'note', 'Bấm một món để bán ngay với nửa giá; bán nhầm thì bấm Lấy lại. Đồ đang mặc trên người phải tháo ở Phòng chờ trước.' + (selG ? ' Tooltip đang so với ' + selG.name + '.' : '')));
  }
  function sortedInv() {
    var inv = UI.game.s.inv.slice();
    inv.sort(function (a, b) {
      var A = G.ITEMS[a.id], B = G.ITEMS[b.id], d = G.SLOTS.indexOf(A.slot) - G.SLOTS.indexOf(B.slot);
      return d || ((b.r || 0) - (a.r || 0)) || (B.tier - A.tier) || (A.name < B.name ? -1 : 1);
    });
    return inv;
  }

  // ---------------------------------------------------------------- phòng chờ (phòng đá): chọn ai ra trận, trang bị, xem đối thủ
  function goDeploy() {
    var gm = UI.game;
    if (gm.s.fought) return;
    if (!gm.fielded()) { snd('error'); toast('Chưa chọn ai ra trận.', 'err'); return; }
    if (!currentFight()) { snd('error'); toast('Không có trận nào.', 'err'); return; }
    UI.deploy = true; UI.equipOpen = false; tipHide(); snd('gate');
    vgo('ready', { tier: gm.s.tier }); UI.refresh();
  }
  function backLobby() { UI.deploy = false; tipHide(); vgo('lobby', { tier: UI.game.s.tier }); UI.refresh(); }
  // cột phải: đối thủ của trận đang chọn, so sánh sức mạnh
  function renderFoes(el) {
    var gm = UI.game, f = currentFight(), foes = currentFoes();
    var hd = h('h3', null, f ? (f.main ? 'Đối thủ · trận chính ' + (f.stage + 1) + '/7' : 'Đối thủ · trận phụ') : 'Đối thủ'); add(el, hd);
    if (!f || !foes) { add(el, h('div', 'note', 'Không có trận nào.')); return; }
    add(el, h('div', 'foe-name', (f.boss ? '☠ ' : '') + f.name));
    foes.forEach(function (o, i) {
      var g = o.g, w = G.weaponOf(g), r = h('div', 'row');
      add(r, h('span', 'nm', (g.boss ? '☠ ' : '') + g.name), h('small', null, 'cấp ' + g.lvl + ' · ' + (g.x && g.x.beast ? '' : w.name)));
      bindTip(r, function () { return gladTip(g, { foe: true }); });
      el.appendChild(r);
    });
    if (f.hint) add(el, h('div', 'note', f.hint));
  }
  function renderReady() {
    if (UI.deploy) return renderDeploy();
    var gm = UI.game, s = gm.s;
    clear(elLeft); clear(elRight); clear(elBottom); show(elLeft, true); show(elBottom, true);
    var hd0 = h('h3', null, 'Đấu sĩ của anh'); add(hd0, h('small', null, s.roster.length + '/' + G.Game.MAX_ROSTER + ' · ra trận ' + gm.fielded() + '/' + gm.fieldLimit()));
    add(elLeft, hd0);
    if (!s.roster.length) {
      add(elLeft, h('div', 'note', 'Chưa có ai. Không có người thì không có trận.'));
      var a1 = h('div', 'acts'); add(a1, btn('Ra chợ nô lệ', null, function () { setTab('market'); })); add(elLeft, a1);
    }
    s.roster.forEach(function (g) {
      var on = !!s.form[g.id], r = h('div', 'row click' + (g.id === UI.sel ? ' sel' : ''));
      var nm = h('span', 'nm' + (g.talent ? ' tal' : ''), g.name);
      var tg = btn(on ? 'Ra trận' : 'Dự bị', 'small toggle' + (on ? ' on' : ''), function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (on) gm.bench(g.id); else if (!quickPlace(g)) { snd('error'); toast('Đấu trường này chỉ cho ' + gm.fieldLimit() + ' người ra trận. Cho một người làm dự bị trước.', 'err'); return; }
        snd('click'); gm.save(); UI.refresh();
      }, true);
      add(r, nm, markers(g), tg);
      addStatusIcons('lobby', g);
      r.addEventListener('click', function () { UI.sel = g.id; UI.equipOpen = true; snd('click'); UI.refresh(); });
      bindTip(r, function () { return gladTip(g, { sell: gm.sellValue(g) }); });
      elLeft.appendChild(r);
    });
    if (s.roster.length) add(elLeft, h('div', 'note', 'Bấm nút cạnh tên để chọn ai ra trận, ai dự bị. Bấm vào người để mở bảng trang bị. Dàn quân làm ở ngoài đấu trường, ngay trước khi đánh.'));
    var g = gm.glad(UI.sel);
    if (g && UI.equipOpen) { show(elRight, false); renderEquip(g); }
    else { show(elEquip, false); show(elRight, true); renderFoes(elRight); }
    renderFightBar(false);
  }
  // Dàn quân: ngoài đấu trường, kéo người vào ô trên lưới rồi bấm Chiến đấu
  function renderDeploy() {
    var gm = UI.game, s = gm.s;
    clear(elLeft); clear(elRight); clear(elBottom); show(elLeft, true); show(elBottom, true); show(elEquip, false); show(elRight, true);
    // --- trái: danh sách người
    var hd = h('h3', null, 'Người của anh'); add(hd, h('small', null, 'Ra sân ' + gm.fielded() + '/' + gm.fieldLimit()));
    add(elLeft, hd);
    if (!s.roster.length) {
      add(elLeft, h('div', 'note', 'Chưa có ai. Không có người thì không có trận.'));
      var a0 = h('div', 'acts'); add(a0, btn('Ra chợ nô lệ', null, function () { setTab('market'); })); add(elLeft, a0);
    }
    s.roster.forEach(function (g) {
      var r = h('div', 'row click' + (g.id === UI.sel ? ' sel' : ''));
      var nm = h('span', 'nm' + (g.talent ? ' tal' : ''));
      add(nm, h('i', 'dot' + (s.form[g.id] ? ' on' : ''))); nm.appendChild(document.createTextNode(g.name));
      add(r, nm, markers(g));
      r.classList.add('grab');
      addStatusIcons('ready', g);
      r.addEventListener('mousedown', function (e) { formDragStart(g.id, e, 'row'); });
      r.addEventListener('click', function () { if (Date.now() - noRowClick < 350) return; UI.sel = g.id; UI.equipOpen = true; snd('click'); UI.refresh(); });
      bindTip(r, function () { return gladTip(g, { sell: gm.sellValue(g) }); });
      elLeft.appendChild(r);
    });
    if (s.roster.length) add(elLeft, h('div', 'note', 'Kéo một người (trên sân, trên ghế hoặc từ danh sách này) thả vào ô để xếp chỗ; thả vào ô có người để đổi chỗ; thả ra ghế để rút về. ◆ = ra sân.'));
    renderFoes(elRight);
    renderFightBar(true);
  }
  // thanh dưới: chọn giải (ở phòng chờ) hoặc nút Chiến đấu (khi dàn quân)
  function renderFightBar(deploy) {
    var gm = UI.game, s = gm.s;
    var fights = h('div', 'fights'), mf = gm.mainFight();
    function fb(kind, f, label) {
      var b = h('button', 'fbtn' + (UI.fightKind === kind ? ' on' : '') + (f.boss ? ' boss' : ''));
      b.innerHTML = esc(label) + '<span class="rw">' + coin(f.gold) + '</span>';
      b.addEventListener('click', function () { snd('click'); UI.fightKind = kind; UI.refresh(); });
      bindTip(b, function () { return fightTip(f); });
      fights.appendChild(b);
    }
    if (mf) fb('main', mf, (mf.boss ? '☠ ' : '') + 'Trận chính ' + (s.stage + 1) + '/7: ' + mf.name);
    else { var won = h('span', 'fbtn on'); won.textContent = 'Đã vô địch Colosseum'; won.style.cursor = 'default'; fights.appendChild(won); }
    if (s.side[1]) fb('side1', s.side[1], 'Trận phụ');
    var line = h('div', 'go-line'), nF = gm.fielded();
    if (s.streak > 0) {
      var sb = gm.streakBonus(), chip = h('span', 'streak' + (sb >= G.Game.STREAK_STEP * G.Game.STREAK_MAX ? ' max' : ''), 'Chuỗi thắng ' + s.streak + ' · +' + Math.round(sb * 100) + '%');
      bindTip(chip, function () {
        return '<div class="tt-h">Chuỗi thắng: ' + s.streak + ' trận</div><div>Trận thắng tới được thêm <b>' + Math.round(sb * 100) + '%</b> túi thưởng. Mỗi trận thắng liền nhau cộng thêm 10%, tối đa +50%.</div><div class="tt-desc">Thua một trận (kể cả xin thua) là mất cả chuỗi. Nghỉ ngày không mất chuỗi.</div>';
      });
      add(line, chip);
    }
    add(line, h('span', 'cnt' + (nF ? '' : ' zero'), 'Ra sân ' + nF + '/' + gm.fieldLimit()));
    if (deploy) {
      add(line, btn('‹ Về phòng chờ', null, backLobby));
      var go = btn('CHIẾN ĐẤU ▸', 'big', startFight); go.disabled = s.fought || nF === 0; add(line, go);
      add(elBottom, line);
    } else {
      var gd = btn(s.fought ? 'Hôm nay đã đấu' : 'RA ĐẤU TRƯỜNG ▸', 'big', goDeploy); gd.disabled = s.fought || nF === 0; add(line, gd);
      add(elBottom, fights, line);
    }
  }

  function barline(lb, frac, tx, cls) {
    var l = h('div', 'barline'), b = h('div', 'bar' + (cls ? ' ' + cls : '')), i = h('i');
    i.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    b.appendChild(i); add(l, h('span', 'lb', lb), b, h('span', 'tx', tx));
    return l;
  }
  // các nút hành động cho một đấu sĩ: chọn thẻ, ra sân / về ghế, thầy thuốc
  function gladActions(g) {
    var gm = UI.game, s = gm.s, acts = h('div', 'acts');
    if (g.pending > 0) add(acts, btn('▲ Chọn thẻ' + (g.pending > 1 ? ' (' + g.pending + ')' : ''), 'warn', function () { showCardPicker(g, function () { UI.refresh(); }); }));
    if (s.form[g.id]) add(acts, btn('Rút về ghế', 'small', function () { gm.bench(g.id); gm.save(); UI.refresh(); }));
    else add(acts, btn('Cho ra sân', 'small', function () {
      if (quickPlace(g)) { gm.save(); UI.refresh(); }
      else { snd('error'); toast('Đấu trường này chỉ cho ' + gm.fieldLimit() + ' người ra sân.', 'err'); }
    }));
    var rc = gm.rewardCost(), rb = btn('Thưởng ' + coin(rc), 'small' + (g.morale >= 100 ? ' off' : ''), function () {
      var r = gm.reward(g.id);
      if (r.ok) { snd('buy'); toast(g.name + ': +' + G.Game.REWARD_MORALE + ' tinh thần.'); UI.refresh(); } else fail(r);
    }, true);
    bindTip(rb, function () { return '<div class="tt-h">Thưởng riêng ' + esc(g.name) + '</div><div>Vài đồng bạc và một bình rượu: +' + G.Game.REWARD_MORALE + ' tinh thần cho người này. Thưởng bao nhiêu lần cũng được.</div><div class="tt-sec tt-price">Giá: ' + rc + ' vàng</div>'; });
    add(acts, rb);
    var tc = gm.treatCost ? gm.treatCost(g) : 0;
    if (tc > 0) {
      var tb = btn('Gọi thầy thuốc ' + coin(tc), 'small', function () {
        var r = gm.treat(g.id);
        if (r.ok) { snd('coin'); toast(g.name + ' được thầy thuốc chữa lành. −' + r.cost + ' vàng.'); UI.refresh(); } else fail(r);
      });
      bindTip(tb, function () { return '<div class="tt-h">Gọi thầy thuốc</div><div>Trả ' + tc + ' vàng để chữa ngay mọi vết thương tạm thời của ' + esc(g.name) + '. Thương tật vĩnh viễn thì không ai chữa được. Không gọi thì vết thương tự lành theo ngày.</div>'; });
      add(acts, tb);
    }
    return acts;
  }
  function sellButton(g) {
    var gm = UI.game, val = gm.sellValue(g), armed = false, sb;
    sb = btn('Bán ' + coin(val), 'small', function () {
      if (!armed) { armed = true; sb.innerHTML = 'Chắc chắn bán ' + esc(g.name) + '? ' + coin(val); sb.classList.add('warn'); setTimeout(function () { armed = false; if (sb.parentNode) { sb.innerHTML = 'Bán ' + coin(val); sb.classList.remove('warn'); } }, 2500); return; }
      if (gm.sellSlave(g.id).ok) { snd('coin'); toast(g.name + ' đã bị bán. Đồ của hắn về kho.'); UI.sel = null; UI.equipOpen = false; UI.refresh(); }
    });
    bindTip(sb, function () { return '<div class="tt-h">Bán ' + esc(g.name) + '</div><div>Lái buôn trả nửa giá: ' + val + ' vàng. Đồ trên người hắn trở về kho.</div>'; });
    return sb;
  }

  function renderGladPanel(g) {
    var gm = UI.game, st = G.calcStats(g), B = G.BODY[g.body];
    var hd = h('div', 'gl-head');
    add(hd, h('div', 'n', g.name), h('div', 's', 'Cấp ' + g.lvl + ' · ' + B.name + ' · ' + G.WKIND[st.kind].role));
    bindTip(hd, function () { return gladTip(g, { sell: gm.sellValue(g) }); });
    add(elRight, hd);
    var need = G.xpNeed(g.lvl);
    add(elRight, barline('Kinh nghiệm', g.lvl >= G.MAX_LVL ? 1 : g.xp / need, g.lvl >= G.MAX_LVL ? 'tối đa' : Math.round(g.xp) + '/' + need));
    add(elRight, barline('Tinh thần', g.morale / 100, g.morale + ' ' + moraleWord(g.morale), 'mor' + (g.morale <= 30 ? ' low' : (g.morale >= 80 ? ' high' : ''))));
    add(elRight, barline('Mang', st.weight / Math.max(1, st.cap), num(st.weight, 1) + '/' + num(st.cap, 0), 'wt' + (st.load > 0.85 ? ' heavy' : '')));
    var acts = gladActions(g);
    if (acts.firstChild) add(elRight, acts);
    // trang bị đang mang: một hàng icon nhỏ; bấm để mở bảng trang bị
    var hk = h('h3', null, 'Trang bị'); add(hk, h('small', null, 'bấm để mở bảng'));
    add(elRight, hk);
    var row = h('div', 'igrid mini');
    G.SLOTS.forEach(function (slot) {
      var it = G.itemOf(g.gear[slot]), t;
      if (it) { t = itemTile(it, 'mini', g.gear[slot]); bindTip(t, function () { return itemTip(it, { worn: true, inst: g.gear[slot] }); }); }
      else { t = h('div', 'itile mini empty'); t.appendChild(h('span', 'ph', G.SLOT_NAME[slot].charAt(0))); bindTip(t, function () { return '<div class="tt-h">' + G.SLOT_NAME[slot] + '</div><div>Trống.</div>'; }); }
      t.addEventListener('click', function () { UI.equipOpen = true; snd('click'); UI.refresh(); });
      row.appendChild(t);
    });
    add(elRight, row);
    var foot = h('div', 'acts');
    add(foot, btn('Mở bảng trang bị ▸', 'small', function () { UI.equipOpen = true; UI.refresh(); }), sellButton(g));
    add(elRight, foot);
  }

  // ---------------------------------------------------------------- icon trang bị
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  function iconUrl(id, size, rar, model) { try { return (G.V && G.V.itemIcon) ? G.V.itemIcon(id, size || 64, rar || 0, model || 0) : ''; } catch (e) { if (window.console) console.error(e); return ''; } }
  function itemTile(it, cls, inst) {
    var rr = (inst && inst.r) || 0;
    var t = h('div', 'itile t' + (it.tier || 0) + ' r' + rr + (cls ? ' ' + cls : '')), u = iconUrl(it.id, 64, rr, inst && inst.m);
    if (u) { var im = document.createElement('img'); im.src = u; im.draggable = false; im.alt = ''; t.appendChild(im); }
    else t.appendChild(h('span', 'ph', it.name));
    if (it.id !== 'fist') t.appendChild(h('i', 'tr', G.ROMAN[rr]));
    return t;
  }

  // ---------------------------------------------------------------- nút mua gắn dưới chân nô lệ / dưới món hàng trong cảnh 3D
  function addTag(space, key, name, nameCls, price, can, label, onBuy, tipFn) {
    var t = h('div', 'tag3d' + (nameCls ? ' ' + nameCls : ''));
    if (name) add(t, h('div', 'tn' + (nameCls ? ' ' + nameCls : ''), name));
    add(t, priceBtn(price, can, label, onBuy));
    bindTip(t, tipFn, function () { vhl(space, key); hlRow(key); }, function () { vhl(space, -1); hlRow(-1); });
    t.style.visibility = 'hidden';
    elTags.appendChild(t); tagList.push({ el: t, key: key, space: space });
  }
  // Cột chỉ số luôn hiện bên trái một nô lệ trên bục: icon + con số, rê chuột lên từng dòng để xem nó làm gì.
  var STAT_ROWS = [
    ['str', 'Sức mạnh', 'Mỗi điểm: +5% sát thương gốc của vũ khí. +1 mỗi cấp.'],
    ['agi', 'Nhanh nhẹn', 'Mỗi điểm: +4% tốc độ đánh, +1,5% né (tối đa 30%), +1,5% tốc chạy. +0,5 mỗi cấp.'],
    ['sta', 'Thể lực', 'Tổng trọng lượng đồ mang được. +8 mỗi cấp.'],
    ['hp', 'Máu', 'Hết máu là gục. +6 mỗi cấp.'],
    ['move', 'Tốc chạy', 'Mét mỗi giây. Đồ nặng làm chậm lại.'],
    ['aspd', 'Tốc đánh', 'Số giây giữa hai đòn với thứ đang cầm — càng nhỏ càng nhanh.']
  ];
  function statValues(g) {
    var st = G.calcStats(g), K = G.WKIND[st.kind];
    return { str: num(st.str, 1), agi: num(st.agi, 1) + (st.agiRaw > st.agi + 0.01 ? ' (−' + num(st.agiRaw - st.agi, 0) + ')' : ''), sta: num(st.sta, 0), hp: String(st.hp), move: num(st.move, 1), aspd: num(K.interval / st.aspd, 2) + 's' };
  }
  function addStatCol(space, i, g) {
    var col = h('div', 'tag3d statcol'), v = statValues(g);
    STAT_ROWS.forEach(function (R) {
      var row = h('div', 'sc-row'), ic = h('div', 'sc-ic'), u = '';
      try { u = G.V.statIcon(R[0], 48); } catch (e) { if (window.console) console.error(e); }
      if (u) { var im = document.createElement('img'); im.src = u; im.draggable = false; im.alt = ''; ic.appendChild(im); }
      add(row, ic, h('span', null, v[R[0]]));
      bindTip(row, function () { return '<div class="tt-h">' + esc(R[1]) + ' ' + esc(v[R[0]]) + '</div><div>' + esc(R[2]) + '</div>'; }, function () { vhl(space, i); hlRow(i); }, function () { vhl(space, -1); hlRow(-1); });
      col.appendChild(row);
    });
    col.style.visibility = 'hidden';
    elTags.appendChild(col); tagList.push({ el: col, key: 'st' + i, space: space, tf: 'translate(-100%, -50%)' });
  }
  // Cặp chỉ số luôn hiện cạnh một món hàng ở Lò rèn: giáp/chặn/sát thương + cân nặng (đã tính độ hiếm và phụ tố).
  var ITEM_STAT = {
    dmg: ['Sát thương', 'Mỗi đòn trúng, trước khi nhân với Sức mạnh của người cầm và trừ giáp của địch.'],
    armor: ['Giáp', 'Giảm sát thương của những đòn trúng vào vùng món này che.'],
    block: ['Chặn', 'Tỉ lệ đỡ hẳn một đòn đánh tới từ phía trước.'],
    wt: ['Cân nặng', 'Tổng đồ không được vượt Thể lực. Càng nặng so với Thể lực, người càng mất Nhanh nhẹn và chạy chậm.']
  };
  function addItemStats(space, i, inst) {
    var it = G.ITEMS[inst.id], inf = G.instInfo(inst), rows = [];
    if (it.slot === 'weapon') rows.push(['dmg', num(inf.dmg, 1) + (it.kind === 'twin' ? '×2' : '')]);
    else if (it.slot === 'shield') rows.push(['block', pct(inf.block)]);
    else if (it.slot !== 'trinket') rows.push(['armor', num(inf.armor, 1)]);
    if (it.slot !== 'trinket' || inf.wt > 0) rows.push(['wt', num(inf.wt, 1)]);
    if (!rows.length) return;   // phụ kiện không nặng gì thì không có gì để hiện
    var col = h('div', 'tag3d statcol small' + (it.slot === 'weapon' ? ' row' : ''));
    rows.forEach(function (R) {
      var row = h('div', 'sc-row'), ic = h('div', 'sc-ic'), u = '', S = ITEM_STAT[R[0]];
      try { u = G.V.statIcon(R[0], 44); } catch (e) { if (window.console) console.error(e); }
      if (u) { var im = document.createElement('img'); im.src = u; im.draggable = false; im.alt = ''; ic.appendChild(im); }
      add(row, ic, h('span', null, R[1]));
      bindTip(row, function () { return '<div class="tt-h">' + esc(S[0]) + ' ' + esc(R[1]) + '</div><div>' + esc(S[1]) + '</div>'; }, function () { vhl(space, i); hlRow(i); }, function () { vhl(space, -1); hlRow(-1); });
      col.appendChild(row);
    });
    col.style.visibility = 'hidden';
    // vũ khí: hai ô nằm ngang trên bàn, sát mép trước, ngay trên nút giá; giáp: canh phải, cùng một hàng phía trên; phụ kiện: cạnh món
    var tf = it.slot === 'weapon' ? 'translate(-50%, -100%)' : (it.slot === 'trinket' ? 'translate(0, 0)' : 'translate(-100%, 0)');
    elTags.appendChild(col); tagList.push({ el: col, key: 'st' + i, space: space, tf: tf });
  }
  // Hàng icon trên đầu một người ở Phòng chờ: tinh thần, thiên phú, nét tốt/xấu, từng chấn thương.
  var TRAIT_ICON = { tough: 'hp', quick: 'aspd', keen: 'sharp', darling: 'showman', loyal: 'bond', frugal: 'food', healer: 'inj', lefty: 'riposte', learner: 'drilled', brave: 'mor_hi',
    coward: 'mor_flee', drunk: 'food', brittle: 'bone', slow: 'fleet', proud: 'mor_low', plain: 'showman', sullen: 'mor_low', lazy: 'drilled', glutton: 'food', clumsy: 'agi',
    fleetfoot: 'fleet', bloodthirst: 'bloodlust', hardy: 'grit', chief: 'bond', supple: 'vit', broad: 'porter', thickskin: 'hide', shieldhand: 'block', stamina: 'second', steadyhead: 'stubborn',
    slowhand: 'aspd', rash: 'mor_flee', unruly: 'mor_low', weakling: 'vit', sickly: 'hp', thinskin: 'armor', winded: 'second', jumpy: 'stubborn', poorsight: 'sharp', runaway: 'mor_flee' };
  function moraleState(m) { return m < 15 ? 'flee' : (m <= 30 ? 'low' : (m >= 80 ? 'hi' : 'ok')); }
  function moraleTip(g) {
    var m = g.morale, st = moraleState(m), eff = st === 'hi' ? '+6% sát thương.' : (st === 'low' ? '−10% sát thương.' : (st === 'flee' ? '−10% sát thương, và hắn có thể bỏ trốn khi qua ngày.' : 'Không cộng, không trừ.'));
    return '<div class="tt-h">Tinh thần ' + m + ' — ' + esc(moraleWord(m)) + '</div><div>' + eff + '</div><div class="tt-sec tt-desc">Từ 80 trở lên: +6% sát thương. Từ 30 trở xuống: −10%. Dưới 15: có thể bỏ trốn. Thắng trận +10 cả trường; thua −20 cả trường; mỗi người chết −30 cả trường; bị thương −10 riêng người đó; mang tật vĩnh viễn −10 cả trường và −30 riêng người đó. Thưởng riêng (nút Thưởng ở bảng của từng người) +10.</div>';
  }
  function addStatusIcons(space, g) {
    var row = h('div', 'tag3d sticons'), n = 0;
    function badge(icon, cls, tipFn) {
      var b = h('div', 'sb ' + cls), u = '';
      try { u = G.V.cardIcon(icon, 44); } catch (e) { if (window.console) console.error(e); }
      if (u) { var im = document.createElement('img'); im.src = u; im.draggable = false; im.alt = ''; b.appendChild(im); }
      bindTip(b, tipFn); row.appendChild(b); n++;
    }
    var ms = moraleState(g.morale);
    badge('mor_' + ms, 'mor-' + ms, function () { return moraleTip(g); });
    if (g.talent && G.TALENTS[g.talent]) badge('talent', 'tal', function () { return '<div class="tt-h">✦ ' + esc(G.TALENTS[g.talent].name) + '</div><div>' + esc(G.TALENTS[g.talent].desc) + '</div>'; });
    g.traits.forEach(function (id) {
      var T = G.TRAITS[id]; if (!T) return;
      badge(TRAIT_ICON[id] || (T.good ? 'mor_hi' : 'mor_low'), T.good ? 'good' : 'bad', function () { return '<div class="tt-h ' + (T.good ? 'good' : 'bad') + '">' + esc(T.name) + '</div><div>' + esc(T.desc) + '</div>'; });
    });
    g.injuries.forEach(function (inj) {
      var I = G.INJURIES[inj.id]; if (!I) return;
      badge('inj', inj.perm ? 'perm' : 'hurt', function () { return '<div class="tt-h inj">✚ ' + esc(I.name) + '</div><div>' + esc(I.desc) + '</div><div class="tt-sec tt-desc">' + (inj.perm ? 'Vĩnh viễn.' : 'Còn ' + Math.max(1, Math.ceil(inj.days)) + ' ngày. Gọi thầy thuốc để chữa ngay.') + '</div>'; });
    });
    row.style.visibility = 'hidden';
    elTags.appendChild(row); tagList.push({ el: row, key: 'hd' + g.id, space: space, tf: 'translate(-50%, -100%)' });
  }
  function tagLoop() {
    requestAnimationFrame(tagLoop);
    if (!tagList.length || UI.state !== 'hub') return;
    var sp = vsub(spaceName()), ok = sp && sp.anchors && G.V.cur === sp, list = ok ? vtry(function () { return sp.anchors(); }) : null, i, j;
    for (i = 0; i < tagList.length; i++) {
      var t = tagList[i], a = null;
      if (list) for (j = 0; j < list.length; j++) if (list[j].i === t.key) { a = list[j]; break; }
      if (!a) { t.el.style.visibility = 'hidden'; continue; }
      t.el.style.visibility = 'visible';
      t.el.style.transform = 'translate(' + Math.round(a.x) + 'px,' + Math.round(a.y) + 'px) ' + (t.tf || 'translate(-50%, 0)');
    }
  }

  // ---------------------------------------------------------------- bảng trang bị: kéo đồ từ kho thả vào người
  var portraitCache = { key: '', url: '' };
  function portraitUrl(g) {
    var key = g.id + '|' + G.SLOTS.map(function (sl) { return g.gear[sl] ? g.gear[sl].id : ''; }).join('/') + '|' + g.injuries.length;
    if (portraitCache.key !== key) { portraitCache.key = key; try { portraitCache.url = G.V.portrait(g, 170, 250); } catch (e) { if (window.console) console.error(e); portraitCache.url = ''; } }
    return portraitCache.url;
  }
  // chỉ số chính; nếu có "preview" (món đang kéo) thì hiện luôn giá trị sau khi mang
  function statRows(g, preview, pinst) {
    var st = G.calcStats(g), st2 = null;
    if (preview) {
      var old = g.gear[preview.slot], oldSh = null;
      g.gear[preview.slot] = pinst || { id: preview.id };
      if (preview.slot === 'weapon' && G.WKIND[preview.kind].hands === 2 && g.gear.shield) { oldSh = g.gear.shield; delete g.gear.shield; }
      st2 = G.calcStats(g);
      if (old) g.gear[preview.slot] = old; else delete g.gear[preview.slot];
      if (oldSh) g.gear.shield = oldSh;
    }
    function dmg(x) { return x.weapon.dmg * x.dmgMul * (x.kind === 'twin' ? 2 : 1); }
    function ivl(x) { return G.WKIND[x.kind].interval / x.aspd; }
    var rows = [
      ['Máu', st.hp, st2 && st2.hp, 0, 1, ''], ['Sát thương', dmg(st), st2 && dmg(st2), 1, 1, ''], ['Nhịp đánh', ivl(st), st2 && ivl(st2), 2, -1, ' s'],
      ['Tốc độ', st.move, st2 && st2.move, 1, 1, ''], ['Né', st.dodge * 100, st2 && st2.dodge * 100, 0, 1, '%'], ['Chặn', st.block * 100, st2 && st2.block * 100, 0, 1, '%'],
      ['Kháng h.ứng', st.resist * 100, st2 && st2.resist * 100, 0, 1, '%'],
      ['Giáp đầu', st.armor.head, st2 && st2.armor.head, 1, 1, ''], ['Giáp thân', st.armor.body, st2 && st2.armor.body, 1, 1, ''],
      ['Giáp tay', st.armor.arms, st2 && st2.armor.arms, 1, 1, ''], ['Giáp chân', st.armor.legs, st2 && st2.armor.legs, 1, 1, ''],
      ['Mang', st.weight, st2 && st2.weight, 1, -1, '/' + num(st.cap, 0)]
    ], out = '';
    rows.forEach(function (r) {
      var v = num(r[1], r[3]) + r[5], ex = '';
      if (st2 && Math.abs(r[2] - r[1]) > 0.004) { var good = (r[2] - r[1]) * r[4] > 0; if (r[0] === 'Mang' && st2.weight > st2.cap) good = false; ex = ' <em class="' + (good ? 'up' : 'down') + '">→ ' + num(r[2], r[3]) + (r[5] === '%' || r[5] === ' s' ? r[5] : '') + '</em>'; }
      out += '<span>' + r[0] + '</span><b>' + v + ex + '</b>';
    });
    return out;
  }
  function canWear(g, it, inst) {
    if (it.slot === 'shield' && G.WKIND[G.weaponOf(g).kind].hands === 2) return false;
    return G.canCarry(g, it, inst);
  }
  function renderEquip(g) {
    var gm = UI.game, s = gm.s, st = G.calcStats(g), B = G.BODY[g.body], ro = s.roster, idx = ro.indexOf(g);
    clear(elEquip); show(elEquip, true);
    var head = h('div', 'eq-head'), nb = h('div', 'nb');
    add(nb, h('div', 'n', g.name), h('div', 's', 'Cấp ' + g.lvl + ' · ' + B.name + ' · ' + G.WKIND[st.kind].role));
    bindTip(nb, function () { return gladTip(g, { sell: gm.sellValue(g) }); });
    add(head, btn('◂', 'small', function () { UI.sel = ro[(idx + ro.length - 1) % ro.length].id; UI.refresh(); }), nb,
      btn('▸', 'small', function () { UI.sel = ro[(idx + 1) % ro.length].id; UI.refresh(); }),
      btn('✕', 'small', function () { UI.equipOpen = false; UI.refresh(); }));
    add(elEquip, head);
    function slotTile(slot) {
      var it = G.itemOf(g.gear[slot]), d = h('div', 'eslot' + (it ? ' fill' : ''));
      d.setAttribute('data-slot', slot);
      if (it) {
        d.appendChild(itemTile(it, '', g.gear[slot]));
        bindTip(d, function () { return itemTip(it, { worn: true, inst: g.gear[slot] }); });
        dragSource(d, { from: 'slot', slot: slot, it: it, g: g, inst: g.gear[slot] });
      } else {
        var e = h('div', 'itile empty'); e.appendChild(h('span', 'ph', slot === 'weapon' ? 'tay không' : 'trống')); d.appendChild(e);
        if (slot === 'weapon') bindTip(d, function () { return itemTip(G.FIST, {}); });
      }
      d.appendChild(h('span', 'lb', G.SLOT_NAME[slot]));
      return d;
    }
    var doll = h('div', 'eq-doll'), cl = h('div', 'col'), cr = h('div', 'col'), port = h('div', 'eq-port'), stats = h('div', 'eq-stats');
    ['head', 'body', 'arms', 'legs'].forEach(function (sl) { cl.appendChild(slotTile(sl)); });
    ['weapon', 'shield', 'trinket'].forEach(function (sl) { cr.appendChild(slotTile(sl)); });
    var pu = portraitUrl(g);
    if (pu) { var im = document.createElement('img'); im.src = pu; im.draggable = false; im.alt = ''; port.appendChild(im); }
    stats.innerHTML = statRows(g, null);
    add(doll, cl, port, cr, stats);
    add(elEquip, doll);
    add(elEquip, barline('Mang', st.weight / Math.max(1, st.cap), num(st.weight, 1) + '/' + num(st.cap, 0), 'wt' + (st.load > 0.85 ? ' heavy' : '')));
    var hk = h('h3', null, 'Kho'); add(hk, h('small', null, 'kéo thả vào người để mang · kéo ra để tháo'));
    add(elEquip, hk);
    var inv = h('div', 'igrid eq-inv'), list = sortedInv();
    if (!list.length) inv.appendChild(h('div', 'note', 'Kho trống. Lò rèn bán vũ khí và giáp.'));
    list.forEach(function (inst) {
      var it = G.ITEMS[inst.id], t = itemTile(it, canWear(g, it, inst) ? '' : 'bad', inst);
      bindTip(t, function () { return itemTip(it, { g: g, inst: inst }); });
      dragSource(t, { from: 'inv', inst: inst, it: it, g: g });
      inv.appendChild(t);
    });
    add(elEquip, inv);
    var foot = gladActions(g); foot.appendChild(sellButton(g));
    add(elEquip, foot);
  }

  // --- kéo thả (tự xử lý bằng chuột để dùng được cả bấm lẫn kéo)
  function dragSource(node, info) {
    node.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { info: info, x0: e.clientX, y0: e.clientY, on: false, ghost: null, over: null };
    });
  }
  function dropTarget(x, y) {
    var el = document.elementFromPoint(x, y); if (!el || !el.closest) return null;
    return el.closest('.eslot') || el.closest('.eq-port') || el.closest('.eq-inv') || (el.closest('#equip') ? 'panel' : null);
  }
  function dragMove(e) {
    if (!drag) return;
    var d = drag;
    if (!d.on) {
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 6) return;
      d.on = true; tipHide();
      d.ghost = itemTile(d.info.it, 'ghost', d.info.inst); document.body.appendChild(d.ghost);
      elEquip.classList.add('dragging');
      if (d.info.from === 'inv') {
        var ok = canWear(d.info.g, d.info.it, d.info.inst), sl = elEquip.querySelector('.eslot[data-slot="' + d.info.it.slot + '"]');
        if (sl) sl.classList.add(ok ? 'can' : 'cant');
        var pt = elEquip.querySelector('.eq-port'); if (pt) pt.classList.add(ok ? 'can' : 'cant');
        var sg = elEquip.querySelector('.eq-stats'); if (sg) sg.innerHTML = statRows(d.info.g, d.info.it, d.info.inst);
      } else { var iv = elEquip.querySelector('.eq-inv'); if (iv) iv.classList.add('can'); }
    }
    d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
    var t = dropTarget(e.clientX, e.clientY);
    if (d.over && d.over !== t && d.over.classList) d.over.classList.remove('over');
    if (t && t.classList) t.classList.add('over');
    d.over = t;
  }
  function dragEnd(e) {
    if (!drag) return;
    var d = drag, gm = UI.game, res; drag = null;
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    if (elEquip) elEquip.classList.remove('dragging');
    var t = d.on ? dropTarget(e.clientX, e.clientY) : null;
    if (d.info.from === 'inv') {
      // bấm, hoặc thả lên người / lên một ô trang bị → mang vào
      var equip = !d.on || (t && t !== 'panel' && t.classList && !t.classList.contains('eq-inv'));
      if (equip) { res = gm.equip(d.info.g.id, d.info.inst.uid); if (res.ok) snd('equip'); else fail(res); }
    } else {
      // bấm, hoặc kéo ra kho / ra ngoài bảng → tháo
      var off = !d.on || !t || (t.classList && t.classList.contains('eq-inv'));
      if (off) { res = gm.unequip(d.info.g.id, d.info.slot); if (res.ok) snd('equip'); }
    }
    UI.refresh();
  }

  // ---------------------------------------------------------------- kéo thả đội hình (phòng chờ)
  function formDragStart(id, e, src) {
    if (e.button !== 0 || UI.state !== 'hub' || UI.tab !== 'ready' || !UI.deploy) return;
    fdrag = { id: id, x0: e.clientX, y0: e.clientY, on: false, src: src, ghost: null };
  }
  // Chỗ con trỏ đang chỉ nghĩa là gì với người đang kéo.
  function formDropInfo(e, t) {
    var gm = UI.game, s = gm.s, id = fdrag.id, mine = !!s.form[id], k, other = null;
    var inLeft = elLeft && elLeft.contains(e.target), onCanvas = e.target === G.V.canvas;
    if (inLeft || (onCanvas && t && t.type === 'bench')) return { act: mine ? 'bench' : null, ok: true, label: mine ? 'Rút về ghế' : 'Đang ngồi ghế' };
    if (!onCanvas || !t || t.type !== 'cell') return { act: null, ok: true, label: 'Thả vào một ô trên sân' };
    for (k in s.form) if (k !== id && s.form[k][0] === t.c && s.form[k][1] === t.r) other = gm.glad(k);
    if (mine && s.form[id][0] === t.c && s.form[id][1] === t.r) return { act: null, ok: true, label: 'Chỗ đang đứng' };
    if (!mine && !other && gm.fielded() >= gm.fieldLimit()) return { act: 'full', ok: false, label: 'Sân chỉ cho ' + gm.fieldLimit() + ' người — thả lên một người để thay' };
    return { act: 'cell', c: t.c, r: t.r, ok: true, label: other ? (mine ? 'Đổi chỗ với ' + other.name : 'Vào thay ' + other.name) : 'Xếp vào ô này' };
  }
  function formDragMove(e) {
    var d = fdrag; if (!d) return;
    var rd = vsub('ready'), g = UI.game && UI.game.glad(d.id);
    if (!rd || !g || UI.state !== 'hub' || UI.tab !== 'ready') { formDragStop(); return; }
    if (!d.on) {
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 7) return;
      var began = false; vtry(function () { began = rd.dragBegin(d.id, d.src === '3d' ? d.x0 : null, d.y0); });
      if (!began) { fdrag = null; return; }
      d.on = true; tipHide(); document.body.classList.add('fdragging');
      d.ghost = h('div', 'fghost'); root.appendChild(d.ghost); snd('click');
    }
    var t = null; vtry(function () { t = rd.dragTo(e.clientX, e.clientY); });
    var info = formDropInfo(e, t);
    if (rd.drag) { rd.drag.ok = info.ok; if (info.act !== 'cell' && info.act !== 'full') rd.hoverCell = -1; if (info.act !== 'bench' && rd.drag.tgt && rd.drag.tgt.type === 'bench' && !UI.game.s.form[d.id]) rd.drag.tgt = null; }
    d.ghost.className = 'fghost' + (info.ok ? '' : ' bad');
    d.ghost.innerHTML = '<b>' + esc(g.name) + '</b>' + (info.label ? ' · ' + esc(info.label) : '');
    d.ghost.style.left = Math.min(window.innerWidth - d.ghost.offsetWidth - 6, e.clientX + 16) + 'px'; d.ghost.style.top = (e.clientY + 18) + 'px';
    e.preventDefault();
  }
  function formDragStop() {
    var d = fdrag; fdrag = null; if (!d) return;
    var rd = vsub('ready'); vtry(function () { if (rd && rd.dragEnd) rd.dragEnd(); });
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    document.body.classList.remove('fdragging');
  }
  function formDragEnd(e) {
    var d = fdrag; if (!d) return;
    if (!d.on) { fdrag = null; return; }   // chỉ là một cú bấm: để sự kiện click lo
    var gm = UI.game, rd = vsub('ready'), t = null;
    vtry(function () { t = rd.dragTo(e.clientX, e.clientY); });
    var info = formDropInfo(e, t);
    formDragStop();
    if (d.src === 'row') noRowClick = Date.now();
    if (info.act === 'bench') { gm.bench(d.id); snd('click'); }
    else if (info.act === 'cell') { if (gm.place(d.id, info.c, info.r)) snd('equip'); }
    else if (info.act === 'full') { snd('error'); toast('Đấu trường này chỉ cho ' + gm.fieldLimit() + ' người ra sân. Thả lên một người đang đứng để thay, hoặc rút bớt một người về ghế.', 'err'); }
    UI.sel = d.id; gm.save(); UI.refresh();
  }

  function quickPlace(g) {
    var gm = UI.game, s = gm.s;
    if (gm.fielded() >= gm.fieldLimit()) return false;
    var K = G.WKIND[G.weaponOf(g).kind], col = K.ai === 'ranged' ? 2 : (K.ai === 'support' || K.ai === 'kite' ? 1 : 0);
    var rows = [2, 1, 3, 0, 4], cols = [col, 0, 1, 2];
    for (var ci = 0; ci < cols.length; ci++) for (var j = 0; j < rows.length; j++) {
      var c = cols[ci], r = rows[j], taken = false;
      for (var k in s.form) if (s.form[k][0] === c && s.form[k][1] === r) taken = true;
      if (!taken && gm.place(g.id, c, r)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- thẻ lên cấp
  function cardIconUrl(id, size) { try { return G.V.cardIcon(id, size); } catch (e) { if (window.console) console.error(e); return ''; } }
  function cardIconEl(id, size, cls) {
    var w = h('div', 'cicon' + (cls ? ' ' + cls : '')), u = cardIconUrl(id, size);
    if (u) { var im = document.createElement('img'); im.src = u; im.draggable = false; im.alt = ''; w.appendChild(im); }
    return w;
  }
  function cardTip(id, n) {
    var C = G.CARDS[id];
    return '<div class="tt-h">' + esc(C.name) + (n > 1 ? ' ×' + n : '') + '</div><div>' + esc(C.desc) + '</div>';
  }
  function showCardPicker(g, cb) {
    var gm = UI.game, opts = gm.cardChoices(g), done = false, m, lvl = g.lvl - g.pending + 1, B = G.BODY[g.body];
    var d = h('div', 'lvlup');
    // --- trái: chính người đang lên cấp, với đồ đang mang
    var who = h('div', 'lv-who'), port = h('div', 'lv-port'), pu = '';
    try { pu = G.V.portrait(g, 204, 300, 'win'); } catch (e) { if (window.console) console.error(e); }
    if (pu) { var im = document.createElement('img'); im.src = pu; im.draggable = false; im.alt = ''; port.appendChild(im); }
    add(port, h('div', 'lv-badge', '▲ ' + lvl));
    add(who, port, h('div', 'lv-name' + (g.talent ? ' tal' : ''), g.name), h('div', 'lv-sub', 'Cấp ' + (lvl - 1) + ' → ' + lvl + ' · ' + B.name + ' · ' + G.WKIND[G.weaponOf(g).kind].role));
    if (g.cards && g.cards.length) {
      var cnt = {}, order = [], have = h('div', 'lv-have');
      g.cards.forEach(function (id) { if (!cnt[id]) { cnt[id] = 0; order.push(id); } cnt[id]++; });
      order.forEach(function (id) {
        if (!G.CARDS[id]) return;
        var e = cardIconEl(id, 34, 'mini'); if (cnt[id] > 1) add(e, h('b', null, '×' + cnt[id]));
        bindTip(e, function () { return cardTip(id, cnt[id]); });
        have.appendChild(e);
      });
      add(who, h('div', 'lv-cap', 'Thẻ đã có'), have);
    }
    bindTip(port, function () { return gladTip(g, {}); });
    // --- phải: ba thẻ
    var main = h('div', 'lv-main');
    add(main, h('h2', null, g.name + ' lên cấp ' + lvl));
    add(main, h('p', null, 'Chọn một thẻ. Thẻ ở lại với hắn đến hết đời.'));
    var cs = h('div', 'cards');
    opts.forEach(function (id) {
      var C = G.CARDS[id]; if (!C) return;
      var c = h('div', 'card' + (C.r === 2 ? ' rare' : ''));
      add(c, cardIconEl(id, 96), h('div', 'cn', C.name), h('div', 'cr', C.r === 2 ? 'Hiếm' + (C.uniq ? ' · chỉ một lần' : '') : 'Thường' + (C.uniq ? ' · chỉ một lần' : ' · chọn lại được')), h('div', 'cd', C.desc));
      var idle = G.cardIdle(g, id); if (idle) add(c, h('div', 'cw', idle));
      c.addEventListener('click', function () {
        if (done) return;
        if (gm.pickCard(g.id, id)) { done = true; snd('card'); m.close(true); cb(true); }
      });
      cs.appendChild(c);
    });
    main.appendChild(cs);
    var f = h('div', 'foot');
    add(f, btn('Để sau', null, function () { m.close(); }));
    main.appendChild(f);
    add(d, who, main);
    m = modal(d, { cls: 'wide lvl', onClose: function () { if (!done) { done = true; cb(false); } } });
    snd('levelup');
  }
  function cardChain(done) {
    var gm = UI.game, skip = {};
    function next() {
      var g = null;
      for (var i = 0; i < gm.s.roster.length; i++) { var c = gm.s.roster[i]; if (c.pending > 0 && !skip[c.id]) { g = c; break; } }
      if (!g) { done(); return; }
      showCardPicker(g, function (picked) { if (!picked) skip[g.id] = 1; next(); });
    }
    next();
  }

  // ---------------------------------------------------------------- qua ngày
  function nextDay() {
    var gm = UI.game;
    closePop();
    var tutEnd = gm.s.tut === 1 && !tutOff();
    var news = gm.nextDay();
    if (gm.s.tut) { gm.s.tut = 0; if (tutEnd) tutSet(true); gm.save(); }
    show(elHint, false);
    snd('day');
    UI.fightKind = gm.mainFight() ? 'main' : 'side1';
    foeCache.key = '';
    setTab('market', true);
    var d = h('div'), m;
    add(d, h('h2', null, 'Ngày ' + gm.s.day));
    var ul = h('ul');
    (news || []).forEach(function (t) { add(ul, h('li', null, t)); });
    add(ul, h('li', null, 'Chợ có người mới, lò rèn đổi hàng.'));
    if (tutEnd) add(ul, h('li', null, 'Hết phần hướng dẫn. Từ đây anh tự lo liệu: rê chuột lên bất cứ thứ gì để xem nó làm gì.'));
    d.appendChild(ul);
    if (!gm.s.roster.length) add(d, h('p', null, 'Trường của anh không còn ai. Ra chợ xem còn mua nổi người nào không.'));
    var f = h('div', 'foot'); add(f, btn('Tiếp', null, function () { m.close(); })); d.appendChild(f);
    m = modal(d, { clear: true });
  }

  // ---------------------------------------------------------------- trận đấu
  var VERB = { fist: 'đấm', caestus: 'đấm', gladius: 'đâm', sica: 'chém', mace: 'đập', hasta: 'đâm', trident: 'đâm', twin: 'chém', axe: 'bổ', javelin: 'đâm', bow: 'bắn', crossbow: 'bắn' };
  var hud = null;

  function startFight() {
    var gm = UI.game, kind = UI.fightKind;
    if (gm.s.fought) return;
    if (!gm.fielded()) { snd('error'); toast('Chưa xếp ai ra sân.', 'err'); return; }
    var b = gm.makeBattle(kind);
    if (!b) { snd('error'); toast('Không có trận nào.', 'err'); return; }
    gm.save();
    UI.state = 'fight'; UI.battle = b;
    closeAllModals(); tipHide(); showHub(false);
    tutApply();
    snd('gate'); amb('arena');
    var tier = gm.s.tier;
    vgo('arena', { tier: tier });
    buildHud(b);
    var intro = h('div', 'intro');
    add(intro, h('div', 'a', b.fight.main ? (b.fight.boss ? 'Trùm' : 'Trận chính ' + (b.fight.stage + 1) + '/7') : 'Trận phụ'), h('div', 'b', b.fight.name), h('div', 'c', b.fight.desc || ''));
    elHud.appendChild(intro);
    setTimeout(function () { intro.style.opacity = '0'; setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 600); }, 1500);
    setTimeout(function () {
      if (UI.battle !== b) return;
      var cb = { onEvent: function (ev, bt) { hudEvent(ev, bt || b); }, onEnd: function () { fightEnded(b); } };
      var ar = vsub('arena'), ok = false;
      if (ar && ar.start) { try { ar.start(b, tier, cb); ok = true; } catch (e) { if (window.console) console.error(e); } }
      if (!ok) fallbackRun(b, cb);
      hud.live = true;
    }, 1500);
    hudLoop(b);
  }
  // Nếu phần 3D chưa sẵn sàng: tự chạy mô phỏng theo thời gian thực để luồng chơi vẫn thông.
  function fallbackRun(b, cb) {
    var last = Date.now(), acc = 0;
    var iv = setInterval(function () {
      if (UI.battle !== b) { clearInterval(iv); return; }
      var now = Date.now(); acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= 1 / 30) {
        acc -= 1 / 30; b.step(1 / 30);
        var evs = b.events.splice(0, b.events.length);
        for (var i = 0; i < evs.length; i++) cb.onEvent(evs[i], b);
      }
      if (b.over) {
        var rest = b.events.splice(0, b.events.length);
        for (var j = 0; j < rest.length; j++) cb.onEvent(rest[j], b);
        clearInterval(iv); cb.onEnd(b);
      }
    }, 33);
  }

  function buildHud(b) {
    clear(elHud); show(elHud, true);
    hud = { b: b, rows: [], log: null, lines: [], ended: false, live: false, overAt: 0, sawEnd: false };
    var top = h('div', 'top'); hud.time = h('div', 'ft', '0 giây');
    add(top, h('div', 'fn', b.fight.name), hud.time);
    var L = h('div', 'team l'), R = h('div', 'team r');
    b.f.forEach(function (f) {
      var r = h('div', 'frow'), nm = h('div', 'fnm'), stt = h('span', 'fst'), bar = h('div', 'bar'), fill = h('i');
      add(nm, h('span', null, f.name), stt); bar.appendChild(fill); add(r, nm, bar);
      (f.team === 0 ? L : R).appendChild(r);
      hud.rows.push({ f: f, row: r, fill: fill, st: stt, hp: -1, txt: '' });
    });
    hud.log = h('div', 'log');
    var cb = h('div', 'concede'), armed = false, timer = null, cbtn;
    cbtn = btn('Xin thua', 'warn', function () {
      if (b.over) return;
      if (!armed) {
        armed = true; cbtn.innerHTML = 'Chắc chắn xin thua?';
        timer = setTimeout(function () { armed = false; if (cbtn.parentNode) cbtn.innerHTML = 'Xin thua'; }, 2500);
        return;
      }
      clearTimeout(timer);
      b.concede(0);
      cbtn.disabled = true; cbtn.innerHTML = 'Đã xin thua';
    });
    bindTip(cbtn, function () { return '<div class="tt-h">Xin thua</div><div>Giơ ngón tay xin tha. Trận thua ngay; ai còn đứng thì không bị gì thêm, ai đã gục vẫn chịu số phận của kẻ thua.</div>'; });
    hud.cbtn = cbtn;
    cb.appendChild(cbtn);
    add(elHud, top, L, R, hud.log, cb);
  }
  function hudLoop(b) {
    function tick() {
      if (!hud || hud.b !== b || UI.battle !== b) return;
      hud.time.textContent = Math.floor(b.time) + ' giây';
      for (var i = 0; i < hud.rows.length; i++) {
        var r = hud.rows[i], f = r.f, hp = Math.max(0, f.hp / f.maxHp);
        if (hp !== r.hp) { r.hp = hp; r.fill.style.width = (hp * 100).toFixed(1) + '%'; }
        var t = '';
        if (!f.alive) t = 'gục';
        else {
          if (f.enraged) t += 'điên ';
          if (f.stun > 0) t += 'choáng ';
          if (f.net > 0) t += 'lưới ';
          if (f.bleed && f.bleed.length) t += 'chảy máu ';
          if (f.shieldOff) t += 'mất khiên';
        }
        if (t !== r.txt) { r.txt = t; r.st.textContent = t; r.row.classList[f.alive ? 'remove' : 'add']('down'); }
      }
      if (b.over && !hud.ended) {
        if (hud.cbtn && !hud.cbtn.disabled) { hud.cbtn.disabled = true; }
        if (!hud.overAt) hud.overAt = Date.now();
        // lưới an toàn: nếu phần 3D không báo kết thúc sau 7 giây thì tự kết thúc
        else if (Date.now() - hud.overAt > 7000) fightEnded(b);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function nm(f) { return '<span class="' + (f.team === 0 ? 'own' : 'foe') + '">' + esc(f.name) + '</span>'; }
  function logLine(html, cls) {
    if (!hud || !hud.log) return;
    var d = h('div', cls || ''); d.innerHTML = html;
    hud.log.appendChild(d); hud.lines.push(d);
    while (hud.lines.length > 5) { var o = hud.lines.shift(); if (o.parentNode) o.parentNode.removeChild(o); }
    for (var i = 0; i < hud.lines.length; i++) hud.lines[i].style.opacity = String(0.35 + 0.65 * (i + 1) / hud.lines.length);
  }
  function hudEvent(ev, b) {
    if (!hud || hud.b !== b || !ev) return;
    var F = b.f, a, d, s;
    switch (ev.e) {
      case 'attack':
        if (ev.special) { a = F[ev.a]; logLine(nm(a) + ' tung chiêu <i>' + esc(G.WKIND[ev.kind].special.name) + '</i>', 'big'); }
        break;
      case 'hit':
        a = F[ev.a]; d = F[ev.d]; if (!a || !d) break;
        if (ev.out === 'whiff') logLine(nm(a) + ' đánh hụt', 'dim');
        else if (ev.out === 'dodge') logLine(nm(d) + ' né đòn của ' + nm(a), 'dim');
        else if (ev.out === 'block') logLine(nm(d) + (ev.arm ? ' gạt đòn của ' + nm(a) + ' bằng giáp vai' : ' chặn đòn của ' + nm(a) + ' bằng khiên'), 'dim');
        else {
          var verb = ev.proj ? 'phóng lao' : (ev.sweep ? 'quét' : (VERB[a.kind] || 'đánh'));
          s = nm(a) + ' ' + verb + ' trúng ' + (G.LOC_NAME[ev.loc] || 'người') + ' ' + nm(d) + ' <b>−' + Math.max(1, Math.round(ev.dmg)) + '</b>';
          if (ev.out === 'crit') s += ' chí mạng!';
          if (ev.fl === 2) s += ' từ sau lưng!';
          if (ev.notes && ev.notes.length) s += ' (' + esc(ev.notes.join(', ').toLowerCase()) + ')';
          logLine(s, ev.out === 'crit' ? 'crit' : '');
        }
        break;
      case 'effect':
        d = F[ev.id]; if (!d) break;
        if (ev.type === 'stun') logLine(nm(d) + ' choáng váng', 'big');
        else if (ev.type === 'net') logLine(nm(d) + ' dính lưới', 'big');
        else if (ev.type === 'bleed') logLine(nm(d) + ' chảy máu');
        else if (ev.type === 'poison') logLine(nm(d) + ' trúng độc');
        else if (ev.type === 'skull') logLine(nm(d) + ' bị đập sọ, choáng');
        else if (ev.type === 'shieldoff') logLine('Khiên của ' + nm(d) + ' bị lao ghim — vô dụng ' + (ev.dur || 3) + ' giây', 'big');
        else if (ev.type === 'enrage') logLine(nm(d) + ' NỔI ĐIÊN!', 'big crit');
        else if (ev.type === 'heal') logLine(nm(d) + ' gượng lại, hồi sức');
        else if (ev.type === 'survive') logLine(nm(d) + ' đứng dậy sau đòn chí tử!', 'big');
        break;
      case 'down':
        d = F[ev.id]; a = ev.by >= 0 ? F[ev.by] : null; if (!d) break;
        logLine(nm(d) + ' gục' + (ev.dot ? ' vì mất máu' : (a ? ' dưới tay ' + nm(a) : '')), 'big');
        break;
      case 'end':
        hud.sawEnd = true;
        var ec = h('div', 'endcard ' + (ev.winner === 0 ? 'win' : 'lose'), ev.winner === 0 ? 'Thắng' : 'Thua');
        elHud.appendChild(ec);
        break;
    }
  }
  function fightEnded(b) {
    if (!hud || hud.b !== b || hud.ended) return;
    hud.ended = true;
    setTimeout(function () {
      if (UI.battle !== b) return;
      var res;
      try { res = UI.game.resolveBattle(b); } catch (e) { if (window.console) console.error(e); toast('Lỗi khi tính kết quả trận.', 'err'); afterResult(null); return; }
      snd(res.win ? 'win' : 'lose');
      showResult(res);
    }, 1800);
  }

  // ---------------------------------------------------------------- kết quả
  function showResult(res) {
    var gm = UI.game, s = gm.s;
    UI.state = 'result';
    var ec = elHud.querySelector('.endcard'); if (ec) ec.parentNode.removeChild(ec);
    var cc = elHud.querySelector('.concede'); if (cc) cc.parentNode.removeChild(cc);
    var tr = elHud.querySelector('.team.r'); if (tr) tr.classList.add('hidden');   // bảng kết quả nằm ở mép phải
    var tp = elHud.querySelector('.top'); if (tp) tp.classList.add('hidden');
    var p = h('div', 'panel result');
    add(p, h('div', 'verdict ' + (res.win ? 'win' : 'lose'), res.win ? 'Thắng' : 'Thua'));
    add(p, h('div', 'sub', res.fight.name + ' · ' + Math.round(res.time) + ' giây' + (res.reason === 'concede' ? ' · xin thua' : (res.reason === 'time' ? ' · hết giờ' : ''))));
    if (res.final) {
      var ep = h('div', 'banner');
      add(ep, h('b', null, 'Colosseum gọi tên trường của anh'));
      add(ep, h('div', null, 'Maximus Invictus nằm trên cát, và năm vạn người im lặng đúng một nhịp thở trước khi gào lên. Từ một vòng rào gỗ ở chợ gia súc Capua, anh đã tới đây.'));
      add(ep, h('div', null, s.day + ' ngày · ' + s.stat.wins + ' trận thắng · ' + s.stat.losses + ' trận thua · ' + s.stat.deaths + ' người chết trên cát · ' + s.stat.deserted + ' kẻ bỏ trốn · ' + s.stat.earned + ' vàng đã kiếm.'));
      add(ep, h('div', null, 'Anh có thể chơi tiếp: các trận phụ vẫn mở mỗi ngày.'));
      p.appendChild(ep);
    }
    if (res.unlocked) {
      var bn = h('div', 'banner');
      add(bn, h('b', null, 'Mở đấu trường mới: ' + res.unlocked.name));
      add(bn, h('div', null, res.unlocked.desc));
      add(bn, h('div', null, 'Từ nay được ra sân ' + res.unlocked.field + ' người. Chợ và lò rèn có hàng tốt hơn; phí nuôi cũng đắt hơn.'));
      p.appendChild(bn);
    }
    function ln(l, r, cls) { var d = h('div', 'ln'); add(d, h('span', null, l), h('span', cls || '', r)); return d; }
    // tiền
    add(p, h('h4', null, 'Tiền'));
    if (res.win) {
      add(p, ln('Thưởng trận', '+' + res.gold + ' vàng', 'g'));
      if (res.streakGold > 0) add(p, ln('Chuỗi thắng ' + res.streak + ' trận liền (+' + res.streakPct + '%)', '+' + res.streakGold + ' vàng', 'g'));
      else if (res.streak === 1) add(p, ln('Chuỗi thắng', 'bắt đầu: thắng trận tới được thêm 10%', 'meh'));
      res.appealBy.forEach(function (a) { add(p, ln('Khán giả ném tiền cho ' + a.name, '+' + a.gold + ' vàng', 'g')); });
      if (!res.appealBy.length) add(p, ln('Tiền khán giả', 'không ai còn đứng để nhận', 'meh'));
    } else {
      add(p, ln('Tiền xuất trận', '+' + res.gold + ' vàng', 'g'));
      if (res.streakLost > 0) add(p, ln('Mất chuỗi thắng', res.streakLost + ' trận liền', 'hurt'));
    }
    add(p, ln('Trong túi', s.gold + ' vàng', 'g'));
    // số phận
    add(p, h('h4', null, 'Người của anh'));
    res.fates.forEach(function (f) {
      var txt, cls;
      if (f.fate === 'dead') { txt = 'ĐÃ CHẾT'; cls = 'dead'; }
      else if (f.fate === 'injury') { var I = G.INJURIES[f.injury]; txt = (f.down ? 'gục, bị thương: ' : 'bị thương: ') + I.name + ' — ' + I.desc; cls = 'hurt'; }
      else if (f.down) { txt = 'gục nhưng không sao'; cls = 'meh'; }
      else { txt = 'đứng vững'; cls = 'fine'; }
      add(p, ln(f.name, txt, cls));
    });
    // kinh nghiệm
    if (res.xp.length) {
      add(p, h('h4', null, 'Kinh nghiệm'));
      res.xp.forEach(function (x) {
        if (!gm.glad(x.id)) return;
        add(p, ln(x.name + (x.bench ? ' (ngồi ngoài)' : ''), '+' + x.xp + (x.ups ? ' · lên cấp!' + (x.ups > 1 ? ' ×' + x.ups : '') : ''), x.ups ? 'lv' : 'meh'));
      });
    }
    // vì sao
    if (res.lines && res.lines.length) {
      add(p, h('h4', null, 'Vì sao'));
      var ul = h('ul'); res.lines.forEach(function (t) { add(ul, h('li', null, t)); }); p.appendChild(ul);
    }
    // bảng số liệu
    add(p, h('h4', null, 'Từng người'));
    [0, 1].forEach(function (team) {
      var tb = h('table'), tr = h('tr');
      ['', 'Gây', 'Nhận', 'Chặn', 'Né', 'Hạ'].forEach(function (c, i) { var th = h('th', null, i === 0 ? (team === 0 ? 'Ta' : 'Địch') : c); tr.appendChild(th); });
      tb.appendChild(tr);
      (res.stats || []).forEach(function (f) {
        if (f.team !== team) return;
        var r = h('tr', f.alive ? '' : 'dn');
        var td = h('td', team === 0 ? 'own' : 'foe', f.name + (f.alive ? '' : ' †'));
        r.appendChild(td);
        [Math.round(f.s.dealt), Math.round(f.s.taken), f.s.blocked, f.s.dodged, f.s.kills].forEach(function (v) { r.appendChild(h('td', null, String(v))); });
        tb.appendChild(r);
      });
      p.appendChild(tb);
    });
    var foot = h('div', 'foot');
    add(foot, btn(res.final ? 'Chơi tiếp ▸' : 'Qua ngày ▸', 'big', function () { afterResult(p); }));
    p.appendChild(foot);
    root.appendChild(p);
    tutApply();
  }
  function afterResult(panel) {
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    var ar = vsub('arena');
    vtry(function () { if (ar && ar.stop) ar.stop(); });
    show(elHud, false); clear(elHud); hud = null;
    UI.battle = null;
    foeCache.key = '';
    enterHub('ready');
    cardChain(function () { if (UI.game.s.fought) nextDay(); else UI.refresh(); });   // đấu xong (và chọn thẻ lên cấp xong) là tự sang ngày mới
  }

  // ---------------------------------------------------------------- khởi động
  // Trang được mở từ một đường link / gõ địa chỉ (không phải bấm tải lại)?
  function freshVisit() {
    try { var n = performance.getEntriesByType('navigation')[0]; return !n || (n.type !== 'reload' && n.type !== 'back_forward'); } catch (e) { return true; }
  }
  UI.start = function () {
    // Ai mở link cũng bắt đầu ván đầu tiên, không thấy "Tiếp tục" của ván cũ; chỉ khi tải lại trang (F5) ván đang dở mới còn.
    if (freshVisit()) G.Game.clearSave();
    // đóng tab là mất ván: để trình duyệt hỏi lại trước khi rời trang lúc đang chơi dở
    window.addEventListener('beforeunload', function (e) {
      var s = UI.game && UI.state !== 'title' ? UI.game.s : null;
      if (s && !s.won && (s.day > 1 || s.roster.length)) { e.preventDefault(); e.returnValue = ''; }
    });
    build();
    if (G.Ghosts) G.Ghosts.fetchRemote();   // kho đội hình chung cho trận phụ
    if (/[?&]debug\b/.test(window.location.search)) {
      UI.debugGold = function (n) { if (!UI.game) return; UI.game.s.gold += (n || 1000); UI.game.save(); UI.refresh(); return UI.game.s.gold; };
    }
    showTitle();
  };
  UI.toast = toast;
  UI.gladTip = gladTip; UI.itemTip = itemTip;

})(window.G = window.G || {});

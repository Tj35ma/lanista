// Công cụ chụp các không gian (Env) để soi bằng mắt. Nạp sau tools/dbg.js.
(function () {
  var V = G.V;
  function hideUI() { document.querySelectorAll('body > div').forEach(function (d) { if (d.id !== 'overlay3d' && d.id !== 'fade' && d.id !== 'dbgtick') d.style.display = 'none'; }); var f = document.getElementById('fade'); if (f) f.style.opacity = 0; }
  function frames(n) { for (var i = 0; i < n; i++) V.frame(1 / 60); }
  function use(sp, name, opts) { if (V.cur && V.cur !== sp && V.cur.leave) V.cur.leave(); V.cur = sp; V.curName = name; sp.enter(opts || {}); V.fitCam(sp); if (V.overlay) V.overlay.innerHTML = ''; }
  function teams(t, n) {
    var w = t + 1, A = [{ w: 'gladius' + w, gear: ['s_scutum', 'h_murmillo', 'b_hamata', 'l_ocrea'], c: 0, r: 1, body: 'big' }, { w: 'hasta' + w, gear: ['s_parma', 'h_legion'], c: 1, r: 2 }, { w: 'javelin' + w, gear: [], c: 2, r: 3, body: 'agi' }, { w: 'axe' + w, gear: ['b_leather'], c: 0, r: 3, body: 'big' }, { w: 'sica' + w, gear: ['s_parma', 'h_thraex', 'b_linen'], c: 0, r: 0 }];
    var B = [{ w: 'trident' + w, gear: ['a_galerus'], c: 1, r: 2, body: 'agi' }, { w: 'sica' + w, gear: ['s_parma', 'h_galea'], c: 0, r: 1 }, { w: 'twin' + w, gear: [], c: 0, r: 3, body: 'agi' }, { w: 'mace' + w, gear: ['s_plank', 'b_leather'], c: 0, r: 2, body: 'big' }, { w: 'gladius' + w, gear: ['s_hoplon', 'h_secutor', 'b_segment'], c: 0, r: 4, body: 'big' }];
    return [A.slice(0, n), B.slice(0, n)];
  }
  var E = G.envcap = {
    hideUI: hideUI, frames: frames,
    // which: chuỗi gồm f (máy quay trận), w (toàn cảnh), t (hai góc tiêu đề), s (đứng im trước trận)
    arena: async function (tier, tag, which, n, secs) {
      hideUI(); which = which || 'fwt';
      V.arena.stop(); V.arena.build(tier); use(V.arena, 'arena', { tier: tier });
      var tm = teams(tier, n || 4);
      G.dbg.duel(tm[0], tm[1], { quiet: true, hp: 1.6 }); V.debug.paused = true;
      var out = [], nm = tag + '_a' + tier;
      if (which.indexOf('s') >= 0) { V.arena.mode = 'dbg'; G.dbg.free(0, 13.5, 14.5, 0, 0.6, 0.5); frames(2); out.push(await G.dbg.shot(nm + '_start.jpg')); }
      V.arena.mode = 'fight'; V.arena.setCam(); frames(Math.round((secs || 4) * 60));
      if (which.indexOf('f') >= 0) out.push(await G.dbg.shot(nm + '_fight.jpg'));
      V.arena.mode = 'dbg';
      if (which.indexOf('w') >= 0) { G.dbg.free(0, 13.5, 14.5, 0, 0.6, 0.5); frames(2); out.push(await G.dbg.shot(nm + '_wide.jpg')); }
      if (which.indexOf('t') >= 0) {
        G.dbg.free(Math.sin(0.4) * 12.5, 4.8, Math.cos(0.4) * 12.5, 0, 1.1, 0); frames(2); out.push(await G.dbg.shot(nm + '_t1.jpg'));
        G.dbg.free(Math.sin(-0.5) * 12.5, 4.8, Math.cos(-0.5) * 12.5, 0, 1.1, 0); frames(2); out.push(await G.dbg.shot(nm + '_t2.jpg'));
      }
      return out.length;
    },
    cheer: async function (tier, tag) { V.arena.env.cheer(1); frames(12); G.dbg.free(-3, 3.2, 4, 2, 2.4, -10); frames(1); return await G.dbg.shot(tag + '_a' + tier + '_cheer.jpg'); },
    free: async function (name, px, py, pz, lx, ly, lz, n) { V.arena.mode = 'dbg'; G.dbg.free(px, py, pz, lx, ly, lz); frames(n || 2); return await G.dbg.shot(name + '.jpg'); },
    market: async function (tag, n) {
      hideUI(); var rng = new G.Rng(11), sl = [];
      for (var i = 0; i < (n || 4); i++) sl.push({ g: G.makeGladiator(rng, { tier: 0 }), price: 30, sold: false });
      V.market.key = ''; V.market.show(sl); use(V.market, 'market'); V.debug.paused = true; frames(40);
      return await G.dbg.shot(tag + '_market.jpg');
    },
    shop: async function (tag) {
      hideUI(); var ids = ['gladius1', 'axe2', 'hasta1', 'trident2', 'h_galea', 'b_hamata', 's_scutum', 'l_ocrea', 't_oil'];
      V.shop.key = ''; V.shop.show(ids.map(function (id) { return { id: id, price: 10, sold: false }; }), { id: 'cornu', price: 300 }); use(V.shop, 'shop'); V.debug.paused = true; frames(40);
      return await G.dbg.shot(tag + '_shop.jpg');
    },
    ready: async function (tier, tag) {
      hideUI(); var rng = new G.Rng(5), roster = [], kinds = ['gladius', 'hasta', 'trident', 'twin', 'axe', 'javelin', 'mace'], w = tier + 1, i;
      for (i = 0; i < 6; i++) { var g = G.makeGladiator(rng, { tier: tier }); g.gear.weapon = { id: kinds[i] + w }; if (i < 2) g.gear.shield = { id: 's_scutum' }; if (i % 2) g.gear.body = { id: 'b_hamata' }; if (i % 3 === 0) g.gear.head = { id: 'h_murmillo' }; roster.push(g); }
      var form = {}, cells = [[0, 1], [1, 2], [1, 3], [0, 3], [0, 2]], lim = G.TIERS[tier].field;
      for (i = 0; i < lim && i < roster.length; i++) form[roster[i].id] = cells[i];
      var foes = G.CAMPAIGN[tier][5].foes.map(function (d, i) { return { g: G.makeFoe(d, i, 0), c: d.c, r: d.r }; });
      V.ready.key = ''; V.ready.show({ roster: roster, form: form, foes: foes, limit: lim, tier: tier }); use(V.ready, 'ready', { tier: tier });
      V.ready.key = ''; V.ready.sync(); V.debug.paused = true; frames(40);
      return await G.dbg.shot(tag + '_ready' + tier + '.jpg');
    },
    perf: function (tier) {
      hideUI(); V.arena.stop(); V.arena.build(tier); use(V.arena, 'arena', { tier: tier });
      var tm = teams(tier, 5); G.dbg.duel(tm[0], tm[1], { quiet: true, hp: 3 }); V.arena.mode = 'fight'; V.arena.setCam(); V.debug.paused = true;
      frames(30); var t0 = performance.now(); frames(200); var ms = (performance.now() - t0) / 200, info = V.renderer.info;
      return { ms: +ms.toFixed(2), tris: info.render.triangles, calls: info.render.calls };
    },
    tris: function (env) { var n = 0; env.group.traverse(function (o) { if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) { var c = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; n += c * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); }
  };
})();

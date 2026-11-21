// LANISTA — dữ liệu nội dung (không phụ thuộc đồ họa). Chạy được cả trong trình duyệt lẫn Node.
(function (G) {
  'use strict';

  G.TITLE = 'LANISTA';
  G.SUBTITLE = 'Cát & Máu';

  // ---------------------------------------------------------------- Thể hình
  G.BODY = {
    // độ lệch so với thân Cân đối (Sức mạnh 10, Nhanh nhẹn 10, Máu 110, Thể lực 90 ở cấp 1)
    big: { name: 'Vạm vỡ', desc: 'To xác, khỏe và lì đòn, mang được nhiều nhưng chậm.', str: 1.5, agi: -2, hp: 1.15, sta: 1.12, radius: 0.44 },
    bal: { name: 'Cân đối', desc: 'Không mạnh nhất, không nhanh nhất, nhưng không có điểm yếu.', str: 0, agi: 0, hp: 1, sta: 1, radius: 0.40 },
    agi: { name: 'Nhanh nhẹn', desc: 'Gầy, dẻo và nhanh; khó trúng đòn nhưng mang được ít và dễ gục.', str: -1, agi: 2, hp: 0.9, sta: 0.88, radius: 0.37 }
  };

  G.LOCS = ['head', 'body', 'arms', 'legs'];
  G.LOC_NAME = { head: 'đầu', body: 'thân', arms: 'tay', legs: 'chân' };
  G.SLOTS = ['weapon', 'shield', 'head', 'body', 'arms', 'legs', 'trinket'];
  G.SLOT_NAME = { weapon: 'Vũ khí', shield: 'Khiên', head: 'Mũ', body: 'Giáp thân', arms: 'Giáp tay', legs: 'Chân', trinket: 'Phụ kiện' };

  // ---------------------------------------------------------------- Họ vũ khí
  // reach: khoảng cách tâm–tâm tối đa để ra đòn. interval: chu kỳ giữa hai đòn. windup: từ lúc vung đến lúc chạm.
  // ai: cách hành xử trên cát.
  G.WKIND = {
    fist: {
      name: 'Tay không', reach: 1.05, interval: 0.95, windup: 0.26, recover: 0.24, hands: 1, ai: 'brawl', pen: 0, len: 0,
      role: 'Đấm đá', strength: 'Không có gì cả. Hãy mua cho hắn một thứ vũ khí.',
      special: { id: 'hook', name: 'Móc hàm', cd: 9, desc: 'Cú móc ×1,5 sát thương, làm choáng 1 giây.' }
    },
    caestus: {
      name: 'Găng Caestus', reach: 1.05, interval: 0.78, windup: 0.22, recover: 0.2, hands: 2, ai: 'brawl', pen: 0.3, len: 0,
      role: 'Đấu tay đôi', strength: 'Dồn đòn: mỗi cú trúng liên tiếp vào cùng một địch thủ +8% sát thương (tối đa +40%). Đấm trong tầm khiên: khiên địch chỉ còn 60% tác dụng. Móc hàm làm choáng.',
      behave: 'Bám dính mục tiêu gần nhất, đấm liên tục, không buông.',
      special: { id: 'hook', name: 'Móc hàm', cd: 7, desc: 'Cú móc ×1,6 sát thương, làm choáng 1,3 giây.' }
    },
    gladius: {
      name: 'Đoản kiếm Gladius', reach: 1.35, interval: 1.15, windup: 0.34, recover: 0.28, hands: 1, ai: 'line', pen: 0, len: 0.62,
      role: 'Khắc chế kẻ không giáp', strength: 'Mạnh trước kẻ không giáp: tới +35% sát thương vào chỗ không có giáp (giảm dần, hết khi giáp từ 6). +15% chí mạng. Không xuyên được giáp.',
      behave: 'Tiến đều, đánh kẻ địch gần nhất, không rời đồng đội quá xa.',
      special: { id: 'triple', name: 'Đâm liên hoàn', cd: 8, desc: 'Ba nhát đâm chớp nhoáng, mỗi nhát 70% sát thương.' }
    },
    sica: {
      name: 'Đao cong Sica', reach: 1.35, interval: 1.2, windup: 0.38, recover: 0.3, hands: 1, ai: 'flank', pen: 0.1, len: 0.6,
      role: 'Kẻ vòng sườn, gây chảy máu', strength: 'Nhát nào trúng cũng rỉ máu (thêm khoảng 24% sát thương trong 4 giây, chí mạng gấp đôi); máu chảy bỏ qua giáp.',
      behave: 'Tìm kẻ địch đang bận đánh người khác rồi vòng ra sau lưng.',
      special: { id: 'hookshield', name: 'Móc khiên', cd: 10, desc: 'Giật khiên sang bên: đòn không thể chặn, gây chảy máu, địch mất khả năng chặn 3 giây.' }
    },
    mace: {
      name: 'Chùy', reach: 1.4, interval: 1.45, windup: 0.5, recover: 0.4, hands: 1, ai: 'breaker', pen: 0.6, len: 0.7,
      role: 'Chuyên phá giáp', strength: 'Bỏ qua 60% giáp, và mỗi đòn trúng làm móp giáp của địch thêm 15% (tối đa 60%) cho cả đội cùng hưởng tới hết trận.',
      behave: 'Bỏ qua kẻ yếu, tìm đến kẻ địch mặc giáp dày nhất.',
      special: { id: 'stun', name: 'Đập choáng', cd: 9, desc: 'Cú bổ từ trên xuống làm choáng 2 giây.' }
    },
    hasta: {
      name: 'Giáo Hasta', reach: 2.25, interval: 1.5, windup: 0.44, recover: 0.4, hands: 1, ai: 'support', pen: 0.2, len: 2.0,
      role: 'Tấn công tầm trung', strength: 'Tầm 2,25 m: đâm qua vai đồng đội. Đón đầu: nhát đầu tiên vào mỗi kẻ địch +60% sát thương. Chặn được ngựa đang xông tới.',
      behave: 'Nấp sau đồng đội đứng trước và đâm qua vai họ; giữ kẻ địch ở cuối tầm giáo.',
      special: { id: 'pierce', name: 'Xuyên giáp', cd: 8.5, desc: 'Nhát đâm dồn cả người: ×1,6 sát thương, bỏ qua toàn bộ giáp, đẩy lùi địch.' }
    },
    trident: {
      name: 'Đinh ba & lưới', reach: 2.4, interval: 1.7, windup: 0.5, recover: 0.44, hands: 2, ai: 'kite', pen: 0.15, len: 2.1,
      role: 'Chuyên khống chế', strength: 'Đòn nào trúng cũng làm địch chậm 25% trong 2 giây (trúng chân: chậm 45%). Lưới giữ chân 3 giây. Tầm xa nhất trong vũ khí cận chiến.',
      behave: 'Giữ khoảng cách, lùi khi bị áp sát, quăng lưới vào kẻ nguy hiểm nhất.',
      special: { id: 'net', name: 'Quăng lưới', cd: 9.5, desc: 'Trùm lưới một kẻ địch trong 5 m: 3 giây không di chuyển, không né, đánh chậm một nửa.' }
    },
    twin: {
      name: 'Song đao', reach: 1.2, interval: 1.0, windup: 0.28, recover: 0.24, hands: 2, ai: 'hunt', pen: 0.35, len: 0.42,
      role: 'Áp sát tuyến sau', strength: 'Chạy nhanh hơn 30% cho tới nhát chém đầu tiên, ưu tiên lao vào kẻ đánh xa và kẻ ít giáp, +25% sát thương lên kẻ cầm vũ khí tầm xa. Mỗi lượt hai nhát; từ sau lưng +50%. Yếu trước giáp dày.',
      behave: 'Lao vòng qua hàng đầu để săn cung thủ, lính lao và kẻ mặc ít giáp ở phía sau.',
      special: { id: 'flurry', name: 'Bão thép', cd: 8, desc: 'Bốn nhát chém liên tiếp, mỗi nhát 65% sát thương.' }
    },
    axe: {
      name: 'Rìu hai tay', reach: 1.75, interval: 2.2, windup: 0.66, recover: 0.52, hands: 2, ai: 'charge', pen: 0.3, len: 1.25,
      role: 'Sát thương lan', strength: 'Đòn nào cũng chém lan: mọi kẻ địch đứng cạnh mục tiêu, phía trước mặt, ăn 70% sát thương. Khiên chỉ chặn được một nửa lực. Chậm.',
      behave: 'Xông thẳng vào kẻ địch gần nhất, không phòng thủ.',
      special: { id: 'sweep', name: 'Quét vòng', cd: 9, desc: 'Quét ngang trúng mọi kẻ địch trước mặt (85% sát thương) và hất chúng ra xa.' }
    },
    javelin: {
      name: 'Lao', reach: 5.5, interval: 2.4, windup: 0.64, recover: 0.56, hands: 1, ai: 'ranged', pen: 0.4, len: 1.5, ranged: true, meleeReach: 1.6, meleeMul: 0.7, proj: 'javelin', projSpeed: 16,
      role: 'Khắc chế khiên', strength: 'Lao nặng xuyên khiên: khiên chỉ còn một phần tư tác dụng trước lao, +50% sát thương vào kẻ cầm khiên; mỗi cây lao trúng làm khiên nứt, −12% chặn tới hết trận cho cả đội cùng hưởng (tối đa 3 lần). Ném xa 5,5 m, chậm.',
      behave: 'Giữ khoảng cách mà ném, lùi khi địch tới gần. Một tay nên vẫn cầm được khiên.',
      special: { id: 'pin', name: 'Lao ghim khiên', cd: 9, desc: 'Cây lao nặng cắm vào khiên làm khiên vô dụng đến hết trận (nhà vô địch thì giật ra được sau 5 giây); nếu địch không có khiên: ×1,6 sát thương.' }
    },
    bow: {
      name: 'Cung', reach: 10, interval: 0.85, windup: 0.36, recover: 0.16, hands: 2, ai: 'ranged', pen: 0, len: 1.2, ranged: true, meleeReach: 1.15, meleeMul: 0.5, proj: 'arrow', projSpeed: 28,
      role: 'Khắc chế tầm xa', strength: 'Bắn xa nhất (10 m) và nhanh nhất. +40% sát thương vào kẻ cầm vũ khí tầm xa, và luôn bắn chúng trước. Mũi tên nhẹ: giáp dày gần như chặn hết.',
      behave: 'Đứng thật xa mà bắn, vừa lùi vừa bắn khi địch tới gần. Ưu tiên bắn kẻ đánh xa của địch, rồi tới kẻ mặc ít giáp. Cần cả hai tay.',
      special: { id: 'volley', name: 'Ba mũi liên tiếp', cd: 9, desc: 'Bắn liền ba mũi tên vào cùng một mục tiêu, mỗi mũi 75% sát thương.' }
    },
    crossbow: {
      name: 'Nỏ', reach: 9, interval: 1.8, windup: 0.4, recover: 0.5, hands: 2, ai: 'ranged', pen: 0.65, len: 0.75, ranged: true, meleeReach: 1.15, meleeMul: 0.5, proj: 'bolt', projSpeed: 32,
      role: 'Khắc chế giáp dày', strength: 'Bỏ qua 65% giáp, và giáp chỗ trúng càng dày càng đau: +2,5% sát thương mỗi điểm giáp (tối đa +25%). Bắn xa 9 m nhưng lên dây lâu.',
      behave: 'Đứng xa mà bắn, lùi khi địch tới gần. Cần cả hai tay.',
      special: { id: 'pierce', name: 'Phát bắn xuyên giáp', cd: 9, desc: 'Một phát căng hết dây: ×1,6 sát thương, bỏ qua toàn bộ giáp, đẩy lùi địch.' }
    },
    // ---- thú (chỉ kẻ địch dùng; không bán ở lò rèn)
    claw: {
      name: 'Vuốt gấu', reach: 1.75, interval: 2.0, windup: 0.55, recover: 0.5, hands: 2, ai: 'charge', pen: 0.25, len: 0, beast: true,
      role: 'Thú dữ', strength: 'Mỗi cú tát quét trúng mọi kẻ đứng trước mặt nó. Khiên chỉ đỡ được một nửa lực. Da lông dày.',
      behave: 'Xông vào chỗ đông người nhất mà quật.',
      special: { id: 'maul', name: 'Vồ', cd: 8, desc: 'Vồ lấy một người: đè xuống 1,6 giây, ×1,4 sát thương, chảy máu.' }
    },
    fang: {
      name: 'Răng nanh', reach: 1.0, interval: 0.85, windup: 0.22, recover: 0.2, hands: 2, ai: 'hunt', pen: 0.2, len: 0, beast: true,
      role: 'Chó trận', strength: 'Nhanh, cắn liên tục, thích đớp chân. Ít máu.',
      behave: 'Chạy vòng tìm kẻ đang bận đánh nhau mà cắn từ phía sau.',
      special: { id: 'hamstring', name: 'Đớp gân', cd: 7, desc: 'Cắn vào bắp chân: chậm 40% trong 3 giây, chảy máu.' }
    },
    lion: {
      name: 'Vuốt sư tử', reach: 1.25, interval: 1.1, windup: 0.3, recover: 0.3, hands: 2, ai: 'hunt', pen: 0.3, len: 0, beast: true,
      role: 'Sư tử', strength: 'Nhanh hơn mọi người, vồ từ xa 6 m, cào xé chảy máu.',
      behave: 'Rình kẻ đứng lẻ hoặc đang quay lưng rồi vồ tới.',
      special: { id: 'pounce', name: 'Vồ mồi', cd: 7, desc: 'Phóng tới từ 2,5–6 m, đè ngã mục tiêu: ×1,5 sát thương, choáng 1,2 giây, chảy máu.' }
    }
  };
  // vũ khí giả cho thú (không nằm trong G.ITEMS nên không xuất hiện ở lò rèn)
  G.BEAST_W = {
    bear: { id: 'claw', slot: 'weapon', kind: 'claw', tier: 0, name: 'Vuốt gấu', dmg: 22, wt: 0, price: 0, look: {} },
    dog: { id: 'fang', slot: 'weapon', kind: 'fang', tier: 0, name: 'Răng nanh', dmg: 9, wt: 0, price: 0, look: {} },
    lion: { id: 'lion', slot: 'weapon', kind: 'lion', tier: 0, name: 'Vuốt sư tử', dmg: 15, wt: 0, price: 0, look: {} }
  };

  // ---------------------------------------------------------------- Vật phẩm
  var TIER_DMG = [1, 1.32, 1.7, 2.15];
  var TIER_PRICE = [1.1, 2.9, 7, 16.5];
  var items = {};
  function W(kind, baseDmg, wt, basePrice, names, color) {
    for (var t = 0; t < names.length; t++) {
      if (!names[t]) continue;
      var id = kind + (t + 1);
      items[id] = {
        id: id, slot: 'weapon', kind: kind, tier: t + 1, name: names[t],
        dmg: Math.round(baseDmg * TIER_DMG[t] * 10) / 10, wt: Math.round((wt * (1 + t * 0.06)) * 10) / 10,
        price: Math.round(basePrice * TIER_PRICE[t]), look: { q: t, c: color }
      };
    }
  }
  W('caestus', 5.5, 1, 8, ['Dây da quấn tay', 'Caestus đinh đồng', 'Caestus sắt Myrmex', 'Caestus của nhà vô địch']);
  W('gladius', 10.2, 3, 14, ['Gladius gỉ', 'Gladius lính', 'Gladius Hispania', 'Gladius thép Noricum']);
  W('sica', 9.7, 2.8, 14, ['Dao cong mục đồng', 'Sica Thracia', 'Sica lưỡi kép', 'Sica Dacia rèn tay']);
  W('mace', 13.5, 5, 12, ['Gậy gỗ sồi', 'Chùy đinh', 'Búa chiến', 'Chùy đồng Sarmatia']);
  W('hasta', 12.6, 4, 13, ['Sào vót nhọn', 'Giáo Hasta', 'Giáo Hoplite', 'Giáo lưỡi lá Celt']);
  W('trident', 19.5, 5, 18, ['Chĩa ba ngư phủ', 'Đinh ba Fuscina', 'Đinh ba thép', 'Đinh ba Neptunus']);
  W('twin', 6, 2.6, 16, ['Đôi dao găm Pugio', 'Song kiếm ngắn', 'Song đao Dimachaerus', 'Song kiếm thép Noricum']);
  W('axe', 23, 8, 16, ['Rìu đốn củi', 'Rìu chiến Germania', 'Liềm Falx Dacia', 'Đại rìu Bipennis']);
  W('javelin', 26, 6.5, 15, ['Lao gỗ tôi lửa', 'Lao Verutum', 'Lao Pilum', 'Pilum nặng lê dương']);
  W('bow', 12.5, 1.6, 15, ['Cung săn gỗ tần bì', 'Cung ngắn Numidia', 'Cung sừng Scythia', 'Cung ghép Parthia']);
  W('crossbow', 23.5, 2.6, 17, ['Nỏ gỗ thợ săn', 'Nỏ bụng Gastraphetes', 'Nỏ tay Manuballista', 'Nỏ thép Arcuballista']);

  function A(id, slot, tier, name, armor, wt, price, extra, look, desc) {
    var it = { id: id, slot: slot, tier: tier, name: name, armor: armor, wt: wt, price: Math.round(price * 1.12), look: look || {}, desc: desc || '' };
    if (extra) for (var k in extra) it[k] = extra[k];
    items[id] = it;
  }
  // Mũ
  A('h_cap', 'head', 1, 'Mũ da', 2, 1, 9, null, { m: 'cap' }, 'Một miếng da bò khâu vội. Có còn hơn không.');
  A('h_legion', 'head', 2, 'Mũ sắt lê dương', 5, 3, 38, null, { m: 'legion' }, 'Mũ lính cũ, che gáy và má.');
  A('h_galea', 'head', 2, 'Galea đồng có mào', 4, 2.5, 46, { appeal: 1 }, { m: 'galea' }, 'Nhẹ hơn mũ sắt; chùm lông ngựa làm khán giả thích mắt. +1 sức hút.');
  A('h_secutor', 'head', 3, 'Mũ trơn Secutor', 8, 4.5, 120, { netRes: 0.6, dodge: -0.03 }, { m: 'secutor' }, 'Kín mặt, nhẵn thín: lưới trượt đi (−60% thời gian bị lưới). Tầm nhìn hẹp: −3% né.');
  A('h_murmillo', 'head', 3, 'Mũ mào cá Murmillo', 7, 4, 130, { appeal: 1, missileBlock: 0.12 }, { m: 'murmillo' }, 'Vành rộng che vai: +12% chặn lao. +1 sức hút.');
  A('h_thraex', 'head', 4, 'Mũ mào Thracia', 9, 4, 300, { appeal: 2 }, { m: 'thraex' }, 'Đồng dát, mào sư tử đầu chim. +2 sức hút.');
  // Giáp thân
  A('b_harness', 'body', 1, 'Đai da chéo', 2, 1.5, 10, null, { m: 'harness' }, 'Hai dải da bắt chéo ngực.');
  A('b_leather', 'body', 1, 'Giáp da cứng', 4, 4, 24, null, { m: 'leather' }, 'Da luộc sáp. Đỡ được dao, không đỡ nổi rìu.');
  A('b_linen', 'body', 2, 'Áo lanh chần', 5, 3.5, 60, null, { m: 'linen' }, 'Nhiều lớp lanh dán keo, kiểu Hy Lạp. Nhẹ so với sức che.');
  A('b_hamata', 'body', 3, 'Giáp lưới Hamata', 8.5, 9, 165, null, { m: 'hamata' }, 'Áo vòng sắt đan. Nặng, nhưng dao kiếm khó xuyên.');
  A('b_squamata', 'body', 3, 'Giáp vảy Squamata', 9.5, 10.5, 190, { appeal: 1 }, { m: 'squamata' }, 'Vảy đồng lấp lánh dưới nắng. +1 sức hút.');
  A('b_segment', 'body', 4, 'Giáp tấm Segmentata', 13, 12.5, 430, null, { m: 'segment' }, 'Đai thép chồng lớp của lính lê dương. Nặng nhất, chắc nhất.');
  A('b_muscle', 'body', 4, 'Giáp ngực đồng', 10.5, 9, 470, { appeal: 2 }, { m: 'muscle' }, 'Đồng đúc hình cơ bắp. Nhẹ hơn giáp tấm. +2 sức hút.');
  // Giáp tay
  A('a_wrap', 'arms', 1, 'Băng vải quấn tay', 1.5, 0.5, 6, null, { m: 'wrap' }, 'Vải thô quấn nhiều lớp.');
  A('a_manica', 'arms', 2, 'Manica da', 3.5, 1.5, 34, null, { m: 'manica' }, 'Ống tay da chần che tay cầm vũ khí.');
  A('a_galerus', 'arms', 2, 'Giáp vai Galerus', 3, 2.5, 52, { deflect: 0.12, missileBlock: 0.15 }, { m: 'galerus' }, 'Tấm đồng dựng trên vai: 12% gạt được đòn ngay cả khi không có khiên; trước lao thì gạt được 27%.');
  A('a_scale', 'arms', 3, 'Manica vảy đồng', 6, 3, 110, null, { m: 'scale' }, 'Vảy đồng khâu trên da.');
  A('a_plate', 'arms', 4, 'Manica thép', 8.5, 4, 260, null, { m: 'plate' }, 'Đai thép chồng lớp từ vai đến cổ tay.');
  // Chân
  A('l_sandal', 'legs', 1, 'Dép Sandal', 0, 0.3, 7, { moveMul: 0.07 }, { m: 'sandal' }, 'Nhẹ tênh: +7% tốc độ di chuyển.');
  A('l_wraps', 'legs', 1, 'Quấn chân Fasciae', 1.5, 1, 8, null, { m: 'wraps' }, 'Vải quấn ống chân.');
  A('l_caliga', 'legs', 2, 'Giày đinh Caligae', 2, 1.2, 36, { steady: 0.4 }, { m: 'caliga' }, 'Đế đóng đinh bám cát: −40% thời gian choáng và quãng bị đẩy lùi.');
  A('l_ocrea', 'legs', 3, 'Giáp ống Ocrea', 5.5, 3.2, 96, null, { m: 'ocrea' }, 'Ống đồng che từ gối xuống cổ chân.');
  A('l_ocrea2', 'legs', 4, 'Ocrea cao chạm nổi', 8, 5, 240, { appeal: 1 }, { m: 'ocrea2' }, 'Che cả đùi. +1 sức hút.');
  // Khiên
  // Khiên chia hai loại: khiên lớn (cls 'big') chặn nhiều nhưng nặng; khiên nhỏ (cls 'small') chặn bằng 1/3, nặng bằng 1/2
  // khiên lớn cùng kiểu, nhưng có đỡ gạt: chặn được một đòn thì đòn đánh kế tiếp +70% sát thương.
  A('s_plank', 'shield', 1, 'Khiên ván ọp ẹp', 0, 2.75, 11, { block: 0.067, cls: 'small' }, { m: 'buckler', v: 'wood' }, 'Khiên tròn nhỏ bằng gỗ, núm sắt. Chặn 7%; khiên nhỏ: có đỡ gạt — chặn được một đòn thì đòn đánh kế tiếp +70% sát thương.');
  A('s_parma', 'shield', 3, 'Khiên tròn Parma', 0, 4.25, 80, { block: 0.1, cls: 'small' }, { m: 'buckler' }, 'Khiên tròn nhỏ viền đồng, tay khiên thoải mái. Chặn 10%; khiên nhỏ: có đỡ gạt — chặn được một đòn thì đòn đánh kế tiếp +70% sát thương.');
  A('s_hoplon', 'shield', 2, 'Khiên đồng Hoplon', 0, 7, 95, { block: 0.25, cls: 'big' }, { m: 'hoplon' }, 'Khiên tròn lớn bọc đồng. Chặn 25%. Nặng.');
  A('s_scutum', 'shield', 3, 'Khiên lớn Scutum', 0, 8.5, 150, { block: 0.3, missileBlock: 0.2, cls: 'big' }, { m: 'scutum' }, 'Che từ vai đến gối. Chặn 30%, thêm 20% trước lao. Rất nặng.');
  A('s_tower', 'shield', 4, 'Scutum bọc sắt', 0, 10.5, 380, { block: 0.35, missileBlock: 0.25, cls: 'big' }, { m: 'tower' }, 'Một cánh cửa biết đi. Chặn 35%, thêm 25% trước lao. Rất nặng.');
  // Phụ kiện
  A('t_belt', 'trinket', 1, 'Thắt lưng Balteus', 0, 0.5, 22, { sta: 24 }, { m: 'belt' }, 'Đai da bản rộng đỡ lưng: +24 Thể lực.');
  A('t_oil', 'trinket', 1, 'Dầu ô-liu xoa mình', 0, 0, 26, { dodge: 0.06 }, { m: 'oil' }, 'Trơn như lươn: +6% né.');
  A('t_bandage', 'trinket', 2, 'Túi thuốc và băng vải', 0, 0.5, 48, { deathMul: 0.5 }, { m: 'pouch' }, 'Băng bó kịp lúc: giảm một nửa khả năng chết khi gục.');
  A('t_whet', 'trinket', 2, 'Đá mài', 0, 0.5, 52, { crit: 0.1 }, { m: 'pouch' }, 'Lưỡi luôn bén: +10% chí mạng.');
  A('t_laurel', 'trinket', 3, 'Vòng nguyệt quế', 0, 0, 105, { appeal: 2 }, { m: 'laurel' }, 'Khán giả yêu kẻ chiến thắng: +2 sức hút.');
  A('t_wine', 'trinket', 2, 'Bầu rượu Falernum', 0, 0.8, 58, { moraleFight: 4 }, { m: 'flask' }, 'Một ngụm sau mỗi trận: +4 tinh thần mỗi lần ra sân.');
  // ---------------------------------------------------------------- Biến thể vũ khí: cùng họ (cùng cách đánh), khác tính
  function WV(prefix, kind, tiers, names, o) {
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i], b = items[kind + t], id = prefix + t;
      var it = { id: id, slot: 'weapon', kind: kind, tier: t, name: names[i], dmg: Math.round(b.dmg * (o.dmg || 1) * 10) / 10, wt: Math.round(b.wt * (o.wt || 1) * 10) / 10,
        price: Math.round(b.price * (o.price || 1)), look: { q: t - 1, v: o.v, dl: o.dl || 0 }, desc: o.desc };
      if (o.spd) it.spd = o.spd; if (o.reach) it.reach = o.reach; if (o.pen) it.pen = o.pen; if (o.crit) it.crit = o.crit;
      items[id] = it;
    }
  }
  WV('pugio', 'gladius', [1, 2, 3], ['Dao găm Pugio', 'Pugio lính', 'Pugio chuôi ngà'], { dmg: 0.78, spd: 0.8, reach: -0.12, crit: 0.08, wt: 0.5, price: 0.85, v: 'pugio', dl: -0.2, desc: 'Ngắn và nhanh: đâm dày hơn, mỗi nhát nhẹ hơn, tầm ngắn hơn. +8% chí mạng.' });
  WV('spatha', 'gladius', [2, 3, 4], ['Kiếm dài Spatha', 'Spatha kỵ binh', 'Spatha thép Noricum'], { dmg: 1.14, spd: 1.12, reach: 0.16, wt: 1.3, price: 1.15, v: 'spatha', dl: 0.16, desc: 'Dài hơn gladius một gang tay: với xa hơn, đòn nặng hơn, vung chậm hơn.' });
  WV('kopis', 'sica', [2, 3], ['Kopis Hy Lạp', 'Kopis lưỡi nặng'], { dmg: 1.16, spd: 1.12, wt: 1.2, v: 'kopis', desc: 'Lưỡi dồn nặng về mũi: chém mạnh hơn, chậm hơn.' });
  WV('falcata', 'sica', [3, 4], ['Falcata Hispania', 'Falcata Iberia rèn gấp'], { dmg: 1.08, pen: 0.12, price: 1.2, v: 'kopis', desc: 'Thép Iberia cắt qua cả mép giáp: +12% xuyên giáp.' });
  WV('pick', 'mace', [1, 2, 3], ['Cuốc chim', 'Cuốc Dolabra', 'Mỏ quạ chiến'], { dmg: 0.9, pen: 0.2, spd: 1.04, v: 'pick', desc: 'Mỏ nhọn đục thủng giáp: bỏ qua 85% giáp, nhưng đòn nhẹ hơn chùy.' });
  WV('nailed', 'mace', [1, 2], ['Gậy đóng đinh', 'Chùy gai đồng'], { dmg: 1.1, spd: 1.1, wt: 1.15, v: 'nail', desc: 'Nặng đầu: đập mạnh hơn, chậm hơn.' });
  WV('pike', 'hasta', [2, 3, 4], ['Sào dài Kontos', 'Sarissa cụt', 'Kontos Sarmatia'], { dmg: 1.05, reach: 0.32, spd: 1.15, wt: 1.3, v: 'pike', dl: 0.3, desc: 'Dài nhất trong các loại giáo: giữ địch ở xa hơn nữa, nhưng nặng và chậm.' });
  WV('boar', 'hasta', [1, 2, 3], ['Giáo săn lợn', 'Giáo ngạnh', 'Giáo ngạnh thép'], { dmg: 1.13, reach: -0.12, v: 'boar', dl: -0.1, desc: 'Lưỡi to có ngạnh: vết đâm sâu hơn, tầm ngắn hơn một chút.' });
  WV('bident', 'trident', [1, 2, 3], ['Chĩa hai răng', 'Bident ngư phủ', 'Bident thép'], { dmg: 1.12, spd: 1.06, v: 'bident', desc: 'Hai răng to thay vì ba: đâm sâu hơn, chậm hơn một chút.' });
  WV('harpoon', 'trident', [3, 4], ['Lao móc cá voi', 'Lao móc Neptunus'], { dmg: 0.96, pen: 0.2, v: 'harpoon', desc: 'Ngạnh ngược xé toạc mép giáp: +20% xuyên giáp.' });
  WV('tsica', 'twin', [2, 3, 4], ['Song Sica', 'Song Sica Thracia', 'Song Sica Dacia'], { dmg: 1.06, crit: 0.06, price: 1.15, v: 'tsica', desc: 'Hai lưỡi cong: +6% chí mạng.' });
  WV('taxe', 'twin', [2, 3], ['Song rìu Securis', 'Song rìu Francisca'], { dmg: 1.22, spd: 1.16, pen: 0.12, wt: 1.3, v: 'taxe', desc: 'Hai rìu tay: chậm hơn song đao nhưng bổ được qua giáp (+12% xuyên giáp).' });
  WV('dolabra', 'axe', [1, 2], ['Rìu cuốc Dolabra', 'Dolabra lê dương'], { dmg: 0.9, spd: 0.9, wt: 0.85, v: 'dolabra', desc: 'Nhẹ hơn rìu chiến: vung nhanh hơn, đòn nhẹ hơn.' });
  WV('maul', 'axe', [2, 3, 4], ['Búa tạ', 'Búa tạ đầu sắt', 'Búa tạ Vulcanus'], { dmg: 0.96, pen: 0.3, v: 'maul', desc: 'Búa hai tay: bỏ qua 60% giáp.' });
  WV('labrys', 'axe', [3, 4], ['Rìu đôi Labrys', 'Labrys xứ Crete'], { dmg: 1.1, spd: 1.08, wt: 1.15, v: 'labrys', desc: 'Hai lưỡi: nặng và tàn bạo hơn, vung chậm hơn.' });
  WV('dart', 'javelin', [2, 3, 4], ['Phi tiêu chì Plumbata', 'Plumbata lê dương', 'Plumbata nặng'], { dmg: 0.7, spd: 0.72, reach: -1.5, wt: 0.7, v: 'dart', dl: -0.35, desc: 'Ngắn, gắn chì: ném dày gần gấp rưỡi, tầm gần hơn 1,5 m, mỗi phát nhẹ hơn.' });
  WV('venab', 'javelin', [1, 2, 3], ['Lao săn Venabulum', 'Venabulum lưỡi rộng', 'Venabulum thép'], { dmg: 1.2, spd: 1.15, wt: 1.25, v: 'venab', desc: 'Lao săn thú lớn: nặng tay hơn, ném thưa hơn.' });
  WV('spiked', 'caestus', [2, 3], ['Găng gai', 'Găng gai sắt'], { dmg: 1.1, pen: 0.12, v: 'spike', desc: 'Gai nhọn trên khớp tay: +12% xuyên giáp.' });

  // ---------------------------------------------------------------- Thêm mũ, giáp, khiên, phụ kiện
  var FUR = 0x6f6557, SILVER = 0xc2c7cb;
  A('h_hide', 'head', 1, 'Mũ da sói', 2.5, 1.2, 12, null, { m: 'cap', re: [[0x6b4a2f, FUR], [0x4a3322, 0x4d463c]] }, 'Da sói còn nguyên lông.');
  A('h_monte', 'head', 2, 'Mũ Montefortino', 4.5, 2.6, 42, null, { m: 'legion', re: [[0x7d7f82, 0xa8824a], [0x4e5053, 0x7a5e34]] }, 'Mũ đồng chóp nhọn kiểu cũ của lính Cộng hòa.');
  A('h_boeo', 'head', 2, 'Mũ Boeotia vành xòe', 3.5, 2, 40, { dodge: 0.01 }, { m: 'galea', v: 'nocrest' }, 'Vành rộng, tầm nhìn thoáng: +1% né.');
  A('h_gallic', 'head', 3, 'Mũ sừng Gallia', 6.5, 3.6, 118, { appeal: 1, moraleFight: 1 }, { m: 'legion', v: 'horns' }, 'Hai chiếc sừng làm khán giả reo lên. +1 sức hút, +1 tinh thần mỗi lần ra sân.');
  A('h_provoc', 'head', 3, 'Mũ Provocator', 7.5, 4.2, 125, { missileBlock: 0.08 }, { m: 'murmillo', re: [[0xa8824a, 0x7d7f82], [0x7a5e34, 0x4e5053], [0xc9a25e, 0xa9adb0]] }, 'Che mặt bằng tấm sắt đục lỗ: +8% chặn lao.');
  A('h_attic', 'head', 4, 'Mũ Attic dát bạc', 8, 3.2, 320, { appeal: 1, dodge: 0.01 }, { m: 'galea', re: [[0xa8824a, SILVER], [0x7a5e34, 0x8d9296]] }, 'Nhẹ, hở mặt, sáng loáng. +1 sức hút, +1% né.');
  A('b_fur', 'body', 1, 'Áo da sói', 3, 2.6, 16, null, { m: 'leather', re: [[0x6b4a2f, FUR], [0x4a3322, 0x4d463c]] }, 'Ấm, hôi, đỡ được dao cùn.');
  A('b_cardio', 'body', 2, 'Đĩa ngực Cardiophylax', 4, 2.4, 55, null, { m: 'harness', v: 'disc' }, 'Một đĩa đồng che tim: nhẹ nhất trong các loại giáp kim loại.');
  A('b_quilt', 'body', 2, 'Áo chần bông Subarmalis', 4.5, 3, 50, { steady: 0.1 }, { m: 'linen', re: [[0xcfc4a6, 0x8a6f52], [0xd8cdb4, 0x7a6248], [0xb58a3c, 0x54402c]] }, 'Đệm dày nuốt lực: −10% thời gian choáng và quãng bị đẩy lùi.');
  A('b_lamell', 'body', 3, 'Giáp lá Lamellar', 9, 8.5, 180, null, { m: 'segment', re: [[0xa9adb0, 0xa8824a], [0x979b9e, 0x7a5e34]] }, 'Những lá đồng buộc dây da, kiểu phương Đông.');
  A('b_plumata', 'body', 4, 'Giáp lông vũ Plumata', 11.5, 9.5, 520, { appeal: 2 }, { m: 'squamata', re: [[0xa8824a, SILVER], [0x7a5e34, 0x8d9296]] }, 'Vảy bạc nhỏ như lông chim khâu trên áo lưới. +2 sức hút.');
  A('a_bracer', 'arms', 1, 'Bao tay da', 2, 0.8, 10, null, { m: 'wrap', re: [[0xd8cdb4, 0x6b4a2f]] }, 'Da dày buộc quanh cẳng tay.');
  A('a_vambrace', 'arms', 3, 'Giáp cẳng tay đồng', 4.5, 2, 95, { crit: 0.03 }, { m: 'scale', v: 'fore' }, 'Che cẳng tay, cổ tay vẫn linh hoạt: +3% chí mạng.');
  A('a_spiked', 'arms', 3, 'Manica gai', 5, 3.2, 125, { perk: 'thorns' }, { m: 'plate', v: 'spikes', re: [[0xa9adb0, 0x7d7f82]] }, 'Kẻ đánh cận chiến trúng người mang nó nhận lại 15% sát thương.');
  A('l_boot', 'legs', 2, 'Ủng da cao', 2.5, 1.5, 34, { moveMul: 0.03 }, { m: 'caliga', re: [[0x6b4a2f, 0x4a3322]] }, 'Ôm chân, đi nhanh: +3% tốc độ.');
  A('l_greave1', 'legs', 2, 'Giáp ống một chân', 3, 1.6, 48, null, { m: 'ocrea', v: 'single' }, 'Chỉ che chân trước: nhẹ bằng nửa.');
  A('l_pteryg', 'legs', 3, 'Ocrea sắt và đệm gối', 6.5, 3.8, 115, { steady: 0.15 }, { m: 'ocrea', re: [[0xa8824a, 0x7d7f82]] }, 'Đứng vững hơn: −15% thời gian choáng và quãng bị đẩy lùi.');
  A('s_hide', 'shield', 2, 'Khiên da bò', 0, 3.5, 30, { block: 0.083, cls: 'small' }, { m: 'buckler', v: 'hide' }, 'Khiên tròn nhỏ, da bò căng trên khung liễu, rất nhẹ. Chặn 8%; khiên nhỏ: có đỡ gạt — chặn được một đòn thì đòn đánh kế tiếp +70% sát thương.');
  A('s_pelta', 'shield', 4, 'Khiên Pelta bán nguyệt', 0, 5.25, 220, { block: 0.117, dodge: 0.02, cls: 'small' }, { m: 'pelta' }, 'Khiên tròn khuyết hình trăng lưỡi liềm, không vướng chân (+2% né). Chặn 12%; khiên nhỏ: có đỡ gạt — chặn được một đòn thì đòn đánh kế tiếp +70% sát thương.');
  A('s_thureos', 'shield', 1, 'Khiên bầu dục Thureos', 0, 5.5, 40, { block: 0.2, missileBlock: 0.1, cls: 'big' }, { m: 'parma', v: 'oval' }, 'Khiên lớn che từ vai xuống hông. Chặn 20%, thêm 10% trước lao. Nặng.');
  A('s_clipeus', 'shield', 4, 'Clipeus đồng mạ vàng', 0, 9.5, 340, { block: 0.33, appeal: 1, cls: 'big' }, { m: 'hoplon', re: [[0xa8824a, 0xdcb040], [0xc9a25e, 0xf2d060]] }, 'Khiên tròn lớn sáng như mặt trời. Chặn 33%, +1 sức hút. Nặng.');
  A('t_fascinum', 'trinket', 1, 'Bùa Fascinum', 0, 0.1, 24, { moraleFight: 2, crit: 0.02 }, { m: 'pouch' }, 'Đeo cho đỡ sợ: +2 tinh thần mỗi lần ra sân, +2% chí mạng.');
  A('t_strigil', 'trinket', 1, 'Dao cạo Strigil', 0, 0.2, 28, { appeal: 1 }, { m: 'pouch' }, 'Sạch sẽ thì khán giả ưa: +1 sức hút.');
  A('t_sponge', 'trinket', 2, 'Bọt biển và giấm', 0, 0.4, 55, { hpMul: 0.06 }, { m: 'flask' }, 'Lau vết thương giữa trận: +6% máu.');
  A('t_sandbag', 'trinket', 2, 'Túi cát tập tay', 0, 0.6, 60, { dmgMul: 0.05 }, { m: 'pouch' }, 'Cổ tay cứng cáp: +5% sát thương.');
  A('t_torque', 'trinket', 3, 'Vòng cổ Torque', 0, 0.5, 120, { appeal: 1, hpMul: 0.05 }, { m: 'laurel' }, 'Vòng xoắn của tù trưởng Gallia. +1 sức hút, +5% máu.');
  A('t_lion', 'trinket', 4, 'Da sư tử Nemea', 0, 1.2, 380, { appeal: 2, steady: 0.2, hpMul: 0.05 }, { m: 'belt' }, 'Khoác như Hercules. +2 sức hút, +5% máu, đứng vững hơn 20%.');

  // ---------------------------------------------------------------- Vai của từng ô giáp, và giá tính từ chỉ số
  // Giáp thân: giáp dày nhất + máu.  Mũ: kháng hiệu ứng (choáng, lưới, chậm, chảy máu ngắn lại).
  // Giáp tay / găng: tốc độ đánh.     Chân / giày: tốc độ di chuyển.
  A('b_studded', 'body', 3, 'Giáp da nạm đinh', 0, 0, 0, null, { m: 'leather', re: [[0x6b4a2f, 0x54392a], [0x4a3322, 0x7d7f82]] }, '');
  A('b_gilded', 'body', 4, 'Áo lanh dát vàng', 0, 0, 0, null, { m: 'linen', re: [[0xcfc4a6, 0xe6dcc0], [0xd8cdb4, 0xdcb040], [0xb58a3c, 0xdcb040]] }, '');
  A('a_hermes', 'arms', 4, 'Bao tay Hermes', 0, 0, 0, null, { m: 'manica', re: [[0x6b4a2f, 0xdcb040], [0x4a3322, 0xa8824a]] }, '');
  A('l_runner', 'legs', 3, 'Giày chạy Cursor', 0, 0, 0, null, { m: 'sandal', v: 'run' }, '');
  A('l_mercury', 'legs', 4, 'Dép cánh Mercurius', 0, 0, 0, null, { m: 'sandal', v: 'wing', re: [[0x6b4a2f, 0xdcb040], [0x4a3322, 0xa8824a]] }, '');
  var ROLE_KEYS = ['hpMul', 'aspd', 'moveMul', 'resist', 'dodge', 'crit', 'appeal', 'steady', 'netRes', 'missileBlock', 'deflect', 'moraleFight'];
  // giá trị của một điểm chỉ số (đơn vị "điểm"); giá = điểm × vàng-mỗi-điểm của hạng
  var PT = { hpMul: 45, aspd: 60, moveMul: 30, resist: 9, dodge: 80, crit: 70, appeal: 2.2, steady: 6, netRes: 5, missileBlock: 10, deflect: 35, moraleFight: 0.6 };
  var ARMOR_PT = { body: 1, head: 0.75, arms: 0.7, legs: 0.7 }, TIER_GOLD = [0, 5, 6.5, 8.5, 11];
  var ARMOR_WT = 2;   // mọi món giáp (mũ, thân, tay, chân) nặng gấp đôi con số ghi trong bảng dưới
  function S(id, armor, wt, extra, desc) {
    var it = items[id], k, pts;
    for (k = 0; k < ROLE_KEYS.length; k++) delete it[ROLE_KEYS[k]];
    it.armor = armor; it.wt = Math.round(wt * ARMOR_WT * 10) / 10; it.desc = desc;
    for (k in extra) it[k] = extra[k];
    pts = armor * ARMOR_PT[it.slot] - wt * 0.18 + (it.perk ? 3 : 0);
    for (k in PT) if (it[k]) pts += it[k] * PT[k];
    it.price = Math.max(4, Math.round(Math.max(1, pts) * TIER_GOLD[it.tier]));
  }
  // --- giáp thân
  S('b_harness', 2.5, 0.8, { hpMul: 0.02 }, 'Hai dải da bắt chéo ngực.');
  S('b_fur', 4, 1.8, { hpMul: 0.03 }, 'Ấm, hôi, đỡ được dao cùn.');
  S('b_leather', 5, 3.2, { hpMul: 0.04 }, 'Da luộc sáp. Đỡ được dao, không đỡ nổi rìu.');
  S('b_cardio', 6.5, 1.8, { hpMul: 0.03 }, 'Một đĩa đồng che tim: nhẹ nhất trong các loại giáp kim loại.');
  S('b_quilt', 6.5, 2.4, { hpMul: 0.08, steady: 0.1 }, 'Đệm bông dày nuốt lực đòn đánh.');
  S('b_linen', 8, 3, { hpMul: 0.05 }, 'Nhiều lớp lanh dán keo, kiểu Hy Lạp. Nhẹ so với sức che.');
  S('b_hamata', 13, 12.5, { hpMul: 0.06 }, 'Áo vòng sắt đan. Nặng, nhưng dao kiếm khó xuyên.');
  S('b_lamell', 13.5, 10.5, { hpMul: 0.05 }, 'Những lá đồng buộc dây da, kiểu phương Đông.');
  S('b_squamata', 14, 13.5, { hpMul: 0.06, appeal: 1 }, 'Vảy đồng lấp lánh dưới nắng.');
  S('b_segment', 20, 17.5, { hpMul: 0.08 }, 'Đai thép chồng lớp của lính lê dương. Nặng nhất, chắc nhất.');
  S('b_muscle', 16.5, 13, { hpMul: 0.08, appeal: 2 }, 'Đồng đúc hình cơ bắp. Nhẹ hơn giáp tấm.');
  S('b_plumata', 18, 15, { hpMul: 0.07, appeal: 2 }, 'Vảy bạc nhỏ như lông chim khâu trên áo lưới.');
  S('b_studded', 9.5, 3.6, { hpMul: 0.05 }, 'Da dày đóng đinh sắt: che được kha khá mà vẫn nhẹ, cho kẻ sống bằng đôi chân.');
  S('b_gilded', 12, 4.4, { hpMul: 0.06, appeal: 1 }, 'Lanh chần nhiều lớp, viền dát vàng: thứ giáp nhẹ tốt nhất mà tiền mua được.');
  // --- mũ
  S('h_cap', 2.5, 0.6, { resist: 0.08 }, 'Một miếng da bò khâu vội. Có còn hơn không.');
  S('h_hide', 3, 0.8, { resist: 0.06 }, 'Da sói còn nguyên lông.');
  S('h_legion', 5.5, 3.2, { resist: 0.15 }, 'Mũ lính cũ, che gáy và má.');
  S('h_monte', 5, 2.6, { resist: 0.14 }, 'Mũ đồng chóp nhọn kiểu cũ của lính Cộng hòa.');
  S('h_galea', 4.5, 2, { resist: 0.12, appeal: 1 }, 'Nhẹ hơn mũ sắt; chùm lông ngựa làm khán giả thích mắt.');
  S('h_boeo', 4, 1.2, { resist: 0.1, dodge: 0.01 }, 'Vành rộng, tầm nhìn thoáng.');
  S('h_secutor', 9, 6, { resist: 0.25, netRes: 0.6, dodge: -0.03 }, 'Kín mặt, nhẵn thín: lưới trượt đi. Tầm nhìn hẹp.');
  S('h_murmillo', 8, 5.2, { resist: 0.22, appeal: 1, missileBlock: 0.12 }, 'Vành rộng che vai trước lao.');
  S('h_gallic', 7.5, 3.6, { resist: 0.2, appeal: 1, moraleFight: 1 }, 'Hai chiếc sừng làm khán giả reo lên.');
  S('h_provoc', 8.5, 5.6, { resist: 0.24, missileBlock: 0.08 }, 'Che mặt bằng tấm sắt đục lỗ.');
  S('h_thraex', 11, 6.8, { resist: 0.3, appeal: 2 }, 'Đồng dát, mào sư tử đầu chim.');
  S('h_attic', 9.5, 3, { resist: 0.26, appeal: 1, dodge: 0.01 }, 'Nhẹ, hở mặt, sáng loáng.');
  // --- giáp tay / găng
  S('a_wrap', 1.5, 0.3, { aspd: 0.03 }, 'Vải thô quấn nhiều lớp, cổ tay vẫn nhẹ.');
  S('a_bracer', 2.5, 0.7, { aspd: 0.02 }, 'Da dày buộc quanh cẳng tay.');
  S('a_manica', 4, 1.6, { aspd: 0.04 }, 'Ống tay da chần che tay cầm vũ khí.');
  S('a_galerus', 3.5, 2.4, { aspd: 0.03, deflect: 0.12, missileBlock: 0.15 }, 'Tấm đồng dựng trên vai: gạt được đòn ngay cả khi không có khiên.');
  S('a_vambrace', 5, 1.6, { aspd: 0.07, crit: 0.03 }, 'Che cẳng tay, cổ tay vẫn linh hoạt.');
  S('a_scale', 6.5, 4.2, { aspd: 0.05 }, 'Vảy đồng khâu trên da.');
  S('a_spiked', 5.5, 3.8, { aspd: 0.04 }, 'Kẻ đánh cận chiến trúng người mang nó nhận lại 15% sát thương.');
  S('a_plate', 9, 5.8, { aspd: 0.06 }, 'Đai thép chồng lớp từ vai đến cổ tay.');
  S('a_hermes', 6.5, 1.6, { aspd: 0.11 }, 'Da mỏng dát vàng, nhẹ như không: cho kẻ sống bằng tốc độ ra đòn.');
  // --- chân / giày
  S('l_sandal', 0.5, 0.2, { moveMul: 0.08 }, 'Nhẹ tênh.');
  S('l_wraps', 2, 0.6, { moveMul: 0.03 }, 'Vải quấn ống chân.');
  S('l_boot', 3.5, 1.1, { moveMul: 0.06 }, 'Ôm chân, đi nhanh.');
  S('l_caliga', 3, 1.3, { moveMul: 0.04, steady: 0.4 }, 'Đế đóng đinh bám cát.');
  S('l_greave1', 4.5, 2.2, { moveMul: 0.04 }, 'Chỉ che chân trước: nhẹ bằng nửa.');
  S('l_ocrea', 7, 4.6, { moveMul: 0.05 }, 'Ống đồng che từ gối xuống cổ chân.');
  S('l_pteryg', 8, 5.6, { moveMul: 0.04, steady: 0.15 }, 'Sắt dày, có đệm gối: đứng vững hơn.');
  S('l_runner', 3, 0.6, { moveMul: 0.12 }, 'Giày của người đưa thư: nhẹ và bám.');
  S('l_ocrea2', 10.5, 7.2, { moveMul: 0.06, appeal: 1 }, 'Che cả đùi, chạm nổi.');
  S('l_mercury', 5, 0.8, { moveMul: 0.14, dodge: 0.02 }, 'Dép có cánh, như của thần Mercurius.');

  // --- khiên: khiên to che nhiều thì nặng hẳn, khiên nhỏ nhẹ hẳn
  // khiên lớn nặng nề; khiên nhỏ nặng bằng một nửa khiên lớn cùng kiểu
  (function () { var SW = { s_thureos: 6.5, s_hoplon: 8, s_scutum: 10.5, s_tower: 13, s_clipeus: 11, s_plank: 3.25, s_hide: 4, s_parma: 5.25, s_pelta: 6.5 }; for (var k in SW) if (items[k]) items[k].wt = SW[k]; })();

  // ---------------------------------------------------------------- Năm độ hiếm
  // dmg/arm: hệ số sát thương vũ khí / giáp; wt: hệ số trọng lượng; blk: cộng thêm chặn cho khiên; aff: số phụ tố; fx: số hiệu ứng đặc biệt
  // Bảy độ hiếm (như bản Unity, không còn bậc đồ theo đấu trường). Độ hiếm N gieo một món thuộc "kiểu" min(4, N)
  // (kiểu I–IV là các món cùng loại từ thô tới tinh), rồi gieo chất lượng q trong khoảng ±10% quanh mức của độ hiếm (qLo…qHi), nhân lên sát thương / giáp;
  // và gieo một trong 3 kiểu dáng (m = 0, 1, 2): cùng chỉ số, khác hình.
  // Càng hiếm càng nặng (× wt rồi + wtAdd). price: hệ số giá. aff: số phụ tố. fx: có hiệu ứng đặc biệt.
  G.RAR = [
    { name: 'I · Thường', css: '#b9ad98', qLo: 0.9, qHi: 1.1, wt: 1, wtAdd: 0, blk: 0, price: 1, aff: 0, fx: 0 },
    { name: 'II · Tốt', css: '#8cc46a', qLo: 0.945, qHi: 1.155, wt: 1.03, wtAdd: 1.5, blk: 0.012, price: 2, aff: 1, fx: 0 },
    { name: 'III · Hiếm', css: '#5aa2e0', qLo: 0.999, qHi: 1.221, wt: 1.06, wtAdd: 3, blk: 0.024, price: 3.6, aff: 2, fx: 0 },
    { name: 'IV · Quý', css: '#b684e6', qLo: 1.044, qHi: 1.276, wt: 1.1, wtAdd: 4.5, blk: 0.036, price: 6.5, aff: 2, fx: 1 },
    { name: 'V · Sử thi', css: '#f2b23e', qLo: 1.143, qHi: 1.397, wt: 1.15, wtAdd: 6, blk: 0.05, price: 11, aff: 3, fx: 1 },
    { name: 'VI · Huyền thoại', css: '#ff7a3d', qLo: 1.305, qHi: 1.595, wt: 1.2, wtAdd: 8, blk: 0.06, price: 18, aff: 3, fx: 1 },
    { name: 'VII · Thần khí', css: '#ff5ad2', qLo: 1.53, qHi: 1.87, wt: 1.3, wtAdd: 12, blk: 0.08, price: 30, aff: 3, fx: 1 }
  ];
  G.RAR.forEach(function (R) { R.dmg = R.arm = (R.qLo + R.qHi) / 2; });   // giá trị giữa khoảng, khi món không có q riêng
  G.ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // tỉ lệ ra từng độ hiếm theo đấu trường (Chợ → Làng → Thành phố → Biên giới → Colosseum); VII chỉ có ở Biên giới và Colosseum, rất hiếm
  G.RAR_ODDS = [[74, 21, 4.5, 0.5, 0, 0, 0], [52, 31, 13, 3.5, 0.5, 0, 0], [36, 34, 21, 7.3, 1.5, 0.2, 0], [30, 33, 24, 10, 2.5, 0.4, 0.1], [23, 32, 27, 13, 3.7, 1, 0.3]];
  G.rarKind = function (r) { return Math.min(4, (r || 0) + 1); };   // kiểu món (1–4) ứng với độ hiếm
  // Phụ tố: chỉ số cộng thêm. on: loại món nhận được (weapon / shield / armor = mũ, giáp thân, tay, chân / trinket)
  G.AFFIX = {
    keen: { n: 'Bén', on: ['weapon'], t: '+6% chí mạng', crit: 0.06 },
    hefty: { n: 'Đầm tay', on: ['weapon'], t: '+8% sát thương', wdmg: 0.08 },
    swift: { n: 'Cân tay', on: ['weapon'], t: '+7% tốc độ đánh', aspd: 0.07 },
    spike: { n: 'Mũi tôi cứng', on: ['weapon'], t: '+12% xuyên giáp', pen: 0.12 },
    longer: { n: 'Dài hơn thường lệ', on: ['weapon'], t: '+0,12 m tầm đánh', reach: 0.12 },
    tricky: { n: 'Khó đoán', on: ['weapon'], t: 'địch −7% chặn', antiBlock: 0.07 },
    handy: { n: 'Vừa tay', on: ['weapon'], t: 'chiêu đặc biệt hồi nhanh hơn 12%', spCd: 0.88 },
    showy: { n: 'Chạm trổ', on: ['weapon', 'shield', 'armor'], t: '+1 sức hút', appeal: 1 },
    thick: { n: 'Dày', on: ['armor'], t: '+18% giáp của món này', armMul: 0.18 },
    light: { n: 'Nhẹ', on: ['armor', 'shield'], t: '−22% trọng lượng món này', wtMul: -0.22 },
    padded: { n: 'Lót đệm', on: ['armor'], t: '+4% máu', hpMul: 0.04 },
    snug: { n: 'Vừa vặn', on: ['armor'], t: '+2% né', dodge: 0.02 },
    braced: { n: 'Chằng chắc', on: ['armor', 'shield'], t: '−15% thời gian choáng và quãng bị đẩy lùi', steady: 0.15 },
    broad: { n: 'Bản rộng', on: ['shield'], t: '+4% chặn', block: 0.04 },
    rimmed: { n: 'Viền sắt', on: ['shield'], t: '+10% chặn lao', missileBlock: 0.1 },
    hardy: { n: 'Chắc thịt', on: ['body'], t: '+5% máu', hpMul: 0.05 },
    steadfast: { n: 'Vững trí', on: ['head'], t: '+10% kháng hiệu ứng', resist: 0.1 },
    nimble: { n: 'Khéo tay', on: ['arms'], t: '+4% tốc độ đánh', aspd: 0.04 },
    spry: { n: 'Nhẹ chân', on: ['legs'], t: '+4% tốc độ di chuyển', moveMul: 0.04 },
    lucky: { n: 'May mắn', on: ['trinket'], t: '+3% chí mạng', crit: 0.03 },
    hearty: { n: 'Bổ dưỡng', on: ['trinket'], t: '+4% máu', hpMul: 0.04 },
    proud: { n: 'Hãnh diện', on: ['trinket'], t: '+1 sức hút', appeal: 1 },
    sturdy: { n: 'Đai chắc', on: ['trinket'], t: '+12 Thể lực', sta: 12 },
    cheer: { n: 'Vui vẻ', on: ['trinket'], t: '+2 tinh thần mỗi lần ra sân', moraleFight: 2 }
  };
  // Hiệu ứng đặc biệt (chỉ có ở đồ Sử thi và Huyền thoại). on: ô trang bị nhận được.
  G.EFFECT = {
    // hiệu ứng riêng của Thần khí (độ hiếm VII): only = loại vũ khí duy nhất mang nó
    skull: { n: 'Đập sọ', on: ['weapon'], only: 'mace', minR: 6, t: '20% số đòn trúng làm địch choáng 1 giây.', perk: 'skull' },
    leech: { n: 'Hút máu', on: ['weapon'], only: 'twin', minR: 6, t: 'Mỗi nhát chém trúng hồi máu bằng 15% sát thương gây ra.', perk: 'leech' },
    serrated: { n: 'Răng cưa', on: ['weapon'], t: 'Mỗi đòn trúng làm địch chảy máu 3 giây.', perk: 'bleedHit' },
    execute: { n: 'Đoạt mạng', on: ['weapon'], t: '+45% sát thương lên kẻ dưới 35% máu.', perk: 'execute' },
    opener: { n: 'Phủ đầu', on: ['weapon'], t: 'Đòn đầu tiên trong trận gây gấp đôi.', perk: 'opener' },
    stagger: { n: 'Chấn động', on: ['weapon'], t: '18% số đòn trúng làm địch choáng nửa giây.', perk: 'stagger' },
    thirst: { n: 'Khát máu', on: ['weapon'], t: 'Hạ gục một địch thủ: hồi 25% máu.', perk: 'bloodlust' },
    breaker: { n: 'Xuyên khiên', on: ['weapon'], t: 'Đòn bị khiên chặn vẫn gây 30% sát thương.', perk: 'blockPierce' },
    drilled: { n: 'Thuần tay', on: ['weapon'], t: 'Chiêu đặc biệt hồi nhanh hơn 35%.', perk: 'drilled' },
    pack: { n: 'Bầy sói', on: ['weapon'], t: '+25% sát thương lên kẻ đang bị đồng đội đánh.', perk: 'gangup' },
    spiked: { n: 'Gai nhọn', on: ['shield', 'body'], t: 'Kẻ đánh cận chiến trúng người này nhận lại 15% sát thương.', perk: 'thorns' },
    grit: { n: 'Lì đòn', on: ['body'], t: 'Dưới 35% máu: nhận ít hơn 35% sát thương.', perk: 'grit' },
    second: { n: 'Hơi thở thứ hai', on: ['body', 'trinket'], t: 'Một lần mỗi trận, khi xuống dưới 25% máu: hồi 20% máu.', perk: 'second' },
    riposte: { n: 'Phản đòn', on: ['shield'], t: 'Sau khi chặn hoặc né, đòn kế tiếp +70% sát thương.', perk: 'riposte' },
    stubborn: { n: 'Cứng đầu', on: ['head'], t: 'Choáng và lưới chỉ còn một nửa thời gian.', perk: 'stubborn' },
    guardian: { n: 'Hộ vệ', on: ['shield', 'body'], t: 'Đồng đội trong 2 m nhận ít hơn 15% sát thương.', perk: 'guardian' },
    bulwark: { n: 'Thành lũy', on: ['shield'], t: '+12% chặn.', perk: 'wall' },
    stunguard: { n: 'Tỉnh đòn', on: ['head'], t: 'Cú choáng đầu tiên trong trận bị vô hiệu.', perk: 'stunGuard' },
    coolhead: { n: 'Đầu lạnh', on: ['head'], t: 'Không bị chảy máu, không bị làm chậm.', perk: 'noBleed' },
    ironwill: { n: 'Ý chí sắt', on: ['head'], t: '+30% kháng hiệu ứng.', resist: 0.3 },
    frenzy: { n: 'Dồn dập', on: ['arms'], t: 'Mỗi đòn trúng: +4% tốc độ đánh, cộng dồn tới +20%; mất khi bị choáng.', perk: 'frenzy' },
    quickdraw: { n: 'Ra tay trước', on: ['arms'], t: 'Đòn đầu tiên trong trận ra sớm hơn hẳn; +6% tốc độ đánh.', perk: 'quickdraw', aspd: 0.06 },
    ambi: { n: 'Hai tay như một', on: ['arms'], t: '+10% tốc độ đánh.', aspd: 0.1 },
    sprint: { n: 'Xuất phát', on: ['legs'], t: '5 giây đầu trận: +40% tốc độ di chuyển.', perk: 'sprint' },
    slip: { n: 'Thoát vòng vây', on: ['legs'], t: 'Không thể bị làm chậm; lưới giữ ngắn hơn 30%.', perk: 'unslowed', netRes: 0.3 },
    sidestep: { n: 'Đảo chân', on: ['legs'], t: '+4% né; sau mỗi lần né: +25% tốc độ di chuyển trong 2 giây.', perk: 'dodgeStep', dodge: 0.04 },
    fleet: { n: 'Nhẹ gót', on: ['legs'], t: '+12% tốc độ di chuyển.', moveMul: 0.12 },
    sure: { n: 'Bám cát', on: ['legs'], t: '−40% thời gian choáng và quãng bị đẩy lùi.', steady: 0.4 },
    splendid: { n: 'Lộng lẫy', on: ['body', 'trinket', 'shield'], t: '+2 sức hút khán giả.', appeal: 2 },
    ward: { n: 'Hộ thân', on: ['trinket', 'head'], t: 'Giảm một nửa khả năng chết khi gục.', deathMul: 0.5 }
  };
  G.LEGEND = ['của Achilles', 'của Hector', 'của Leonidas', 'của Spartacus', 'của Hannibal', 'của Scipio', 'của Alexandros', 'của Hercules', 'của thần Mars', 'của Nemesis', 'của Romulus', 'của Ajax'];
  // trọng lượng tính theo đơn vị Thể lực (Thể lực 90 ở cấp 1)
  for (var wk0 in items) if (items[wk0].wt) items[wk0].wt = Math.round(items[wk0].wt * 3 * 10) / 10;
  G.ITEMS = items;

  // ---------------------------------------------------------------- Nét tính cách
  G.TRAITS = {
    // tốt
    tough: { name: 'Trâu bò', esp: 2.77, good: 1, desc: '+15% máu.', hpMul: 0.15 },
    quick: { name: 'Nhanh tay', esp: 1.28, good: 1, desc: '+8% tốc độ đánh.', aspd: 0.08 },
    keen: { name: 'Mắt cú', esp: 0.88, good: 1, desc: '+8% chí mạng.', crit: 0.08 },
    darling: { name: 'Có duyên', esp: 0, good: 1, desc: '+2 sức hút khán giả.', appeal: 2 },
    loyal: { name: 'Trung thành', esp: 0.05, good: 1, desc: 'Không bao giờ bỏ trốn.', loyal: 1 },
    frugal: { name: 'Ăn ít', esp: 0, good: 1, desc: 'Phí nuôi giảm một nửa.', upkeepMul: -0.5 },
    healer: { name: 'Mau lành', esp: 0, good: 1, desc: 'Vết thương lành nhanh gấp đôi.', healMul: 2 },
    lefty: { name: 'Thuận tay trái', esp: 0.24, good: 1, desc: 'Đòn đánh khó đoán: địch −10% chặn.', antiBlock: 0.1 },
    learner: { name: 'Sáng dạ', esp: 0, good: 1, desc: '+30% kinh nghiệm.', xpMul: 0.3 },
    fleetfoot: { name: 'Nhanh chân', esp: 0.1, good: 1, desc: '+15% tốc độ di chuyển.', moveMul: 0.15 },
    bloodthirst: { name: 'Khát máu', esp: 0.5, good: 1, desc: 'Mỗi lần hạ một kẻ địch: +15% tốc độ đánh tới hết trận.' },
    hardy: { name: 'Lì đòn', esp: 0, good: 1, desc: 'Khả năng chết khi gục giảm một nửa.' },
    chief: { name: 'Thủ lĩnh', esp: 0.1, good: 1, desc: 'Khi hắn ra trận: đồng đội không mất tinh thần nếu thua.' },
    supple: { name: 'Dẻo dai', esp: 0.66, good: 1, desc: '+15% Thể lực.' },
    broad: { name: 'Vai rộng', esp: 0.7, good: 1, desc: 'Đồ mang trên người chỉ tính 85% trọng lượng.' },
    thickskin: { name: 'Da dày', esp: 0.36, good: 1, desc: '+15% giáp ở mọi chỗ.' },
    shieldhand: { name: 'Khéo khiên', esp: 0.23, good: 1, desc: 'Khi cầm khiên: chặn thêm 6%.' },
    stamina: { name: 'Bền hơi', esp: 0.05, good: 1, desc: 'Trận kéo dài (sau giây thứ 20): +20% sát thương.' },
    steadyhead: { name: 'Tỉnh đòn', esp: 0.18, good: 1, desc: 'Choáng, lưới và bị làm chậm ngắn đi 25%.' },
    brave: { name: 'Gan dạ', esp: 0.56, good: 1, desc: 'Tinh thần không tụt dưới 30. +10% sát thương khi dưới nửa máu.', brave: 1 },
    // xấu
    coward: { name: 'Nhát gan', esp: -1.52, good: 0, desc: '−20% sát thương khi dưới nửa máu.', coward: 1 },
    drunk: { name: 'Nghiện rượu', esp: 0, good: 0, desc: 'Phí nuôi gấp đôi.', upkeepMul: 1 },
    brittle: { name: 'Xương giòn', esp: 0, good: 0, desc: 'Dễ bị thương nặng khi gục.', injuryMul: 0.6 },   // cộng vào 1: khả năng bị thương ×1,6
    slow: { name: 'Chậm chạp', esp: -0.46, good: 0, desc: '−12% tốc độ di chuyển.', moveMul: -0.12 },
    proud: { name: 'Kiêu ngạo', esp: -0.1, good: 0, desc: 'Thua thì mất gấp đôi tinh thần.', proud: 1 },
    plain: { name: 'Vô duyên', esp: 0, good: 0, desc: '−1 sức hút khán giả.', appeal: -1 },
    sullen: { name: 'Hay oán thán', esp: -0.05, good: 0, desc: '−1 tinh thần mỗi ngày.', sullen: 1 },
    lazy: { name: 'Lười nhác', esp: 0, good: 0, desc: '−25% kinh nghiệm.', xpMul: -0.25 },
    glutton: { name: 'Phàm ăn', esp: 0, good: 0, desc: 'Phí nuôi +60%.', upkeepMul: 0.6 },
    slowhand: { name: 'Chậm tay', esp: -2.4, good: 0, desc: '−10% tốc độ đánh.', aspd: -0.1 },
    rash: { name: 'Hấp tấp', esp: -0.26, good: 0, desc: 'Luôn lao vào kẻ địch gần nhất, bỏ qua mọi tính toán.' },
    unruly: { name: 'Bất trị', esp: -0.1, good: 0, desc: '−3 tinh thần mỗi ngày không được ra trận.' },
    weakling: { name: 'Yếu sức', esp: -1.19, good: 0, desc: '−15% Thể lực.' },
    sickly: { name: 'Ốm yếu', esp: -2.1, good: 0, desc: '−10% máu.', hpMul: -0.1 },
    thinskin: { name: 'Da mỏng', esp: -0.48, good: 0, desc: '−15% giáp ở mọi chỗ.' },
    winded: { name: 'Mau mệt', esp: -0.05, good: 0, desc: 'Trận kéo dài (sau giây thứ 20): −20% sát thương.' },
    jumpy: { name: 'Hay hoảng', esp: -0.1, good: 0, desc: 'Choáng, lưới và bị làm chậm dài thêm 25%.' },
    poorsight: { name: 'Mắt kém', esp: -0.8, good: 0, desc: '−6% chí mạng.', crit: -0.06 },
    runaway: { name: 'Hay trốn', esp: 0, good: 0, desc: 'Khi tinh thần thấp: khả năng bỏ trốn gấp đôi.' },
    clumsy: { name: 'Vụng về', esp: -0.49, good: 0, desc: '−6% né.', dodge: -0.06 }
  };

  // ---------------------------------------------------------------- Thiên phú (nô lệ hiếm)
  G.TALENTS = {
    legionary: { name: 'Cựu lính lê dương', esp: 0.79, desc: 'Đồng đội đứng trong 2 m quanh hắn được +12% chặn và nhận ít hơn 10% sát thương.' },
    medicus: { name: 'Học trò thầy thuốc', esp: 0, desc: 'Khi hắn ở trong trường: vết thương của cả đội lành nhanh gấp đôi, khả năng chết khi gục giảm 30%.' },
    doctore: { name: 'Từng là Doctore', esp: 0, desc: 'Thầy dạy kiếm: cả đội nhận +25% kinh nghiệm.' },
    idol: { name: 'Con cưng của khán đài', esp: 0, desc: '+4 sức hút. Tiền thưởng khán giả của hắn gấp đôi.' },
    giant: { name: 'Người khổng lồ', esp: 4.46, desc: '+36 Thể lực, +20% máu, nhưng −10% né.' },
    venator: { name: 'Thợ săn thú', esp: 9.17, desc: 'Lao và giáo: +15% sát thương, đòn đầu tiên trong trận luôn chí mạng.' },
    twinborn: { name: 'Thuận cả hai tay', esp: 2.18, desc: 'Vũ khí hai tay và song đao: +15% tốc độ đánh.' },
    survivor: { name: 'Kẻ sống sót', esp: 2.34, desc: 'Một lần mỗi trận, đòn chí tử chỉ để lại cho hắn 1 máu. Không bao giờ chết trên cát khi đội thắng.' },
    parry: { name: 'Bậc thầy đỡ gạt', esp: 1.17, desc: 'Cầm khiên nhỏ: chặn thêm 8%. Sau mỗi lần chặn hoặc né, đòn kế tiếp +120% sát thương (thay vì +70%).' },
    phalanx: { name: 'Lính Phalanx', esp: 0.3, desc: 'Cầm khiên lớn: +5% chặn, và đòn đánh vào sườn bị chặn đủ như đòn trước mặt.' },
    assassin: { name: 'Sát thủ', esp: 0.42, desc: 'Đánh từ sau lưng +50% sát thương (thường +25%). Cầm vũ khí cận chiến nào cũng tìm đường vòng ra sau mục tiêu.' },
    taunt: { name: 'Kẻ khiêu khích', esp: 0.3, desc: 'Bảo kê tuyến sau: kẻ địch đứng trong 4 m quanh hắn ưu tiên đánh hắn, và kẻ nào lao vào một đồng đội đứng trong 3,5 m quanh hắn (kể cả sát thủ, kỵ binh, thú vồ) bị kéo sang đánh hắn. Không cản được tên và lao.' },
    bodyguard: { name: 'Lá chắn sống', esp: 0.1, desc: 'Đồng đội ít máu nhất đứng trong 3 m quanh hắn chỉ nhận 70% sát thương; hắn chịu thay 30% còn lại.' },
    strongman: { name: 'Lực sĩ', esp: 3.67, desc: 'Mang nặng không làm hắn đánh chậm đi hay khó né hơn.' },
    slippery: { name: 'Trơn như lươn', esp: 0.2, desc: 'Không bị móc kéo, không bị lưới trùm, không bị làm chậm.' },
    archerhunter: { name: 'Thợ săn cung thủ', esp: 0.2, desc: '+30% sát thương lên kẻ cầm vũ khí tầm xa, và ưu tiên lao vào chúng.' },
    warden: { name: 'Cai ngục', esp: 0, desc: 'Khi hắn ở trong trường: không đấu sĩ nào bỏ trốn.' },
    merchant: { name: 'Lái buôn', esp: 0, desc: 'Khi hắn ở trong trường: đồ ở lò rèn rẻ hơn 10%, bán đồ được thêm 20%.' },
    twohand: { name: 'Thông thạo vũ khí hai tay', esp: 1.45, desc: 'Mọi vũ khí cầm hai tay (rìu, song đao, đinh ba, cung, nỏ, găng Caestus): +15% sát thương.' },
    fistmaster: { name: 'Thông thạo găng đấm', esp: 1.5, desc: 'Găng Caestus và tay không: +15% sát thương, +5% né.' },
    poisoner: { name: 'Độc sư', esp: 2.0, desc: 'Đòn đánh trúng làm địch trúng độc 2 giây: mỗi giây mất máu bằng 15% sát thương của đòn đó, bỏ qua giáp. Không cộng dồn: đòn sau chỉ làm mới thời gian.' },
    veteran: { name: 'Bách chiến', esp: 0.77, desc: 'Chiêu đặc biệt sẵn sàng ngay từ đầu trận và hồi nhanh hơn 25%.' }
  };

  // ---------------------------------------------------------------- Thẻ lên cấp
  // r: 1 thường, 2 hiếm. uniq: mỗi người chỉ nhận một lần.
  G.CARDS = {
    str: { name: 'Cơ bắp', esp: 2.0, r: 1, desc: '+2 Sức mạnh.', str: 2 },
    agi: { name: 'Dẻo dai', esp: 1.0, r: 1, desc: '+2 Nhanh nhẹn.', agi: 2 },
    vit: { name: 'Bền bỉ', esp: 3.0, r: 1, desc: '+20 Máu.', hp: 20 },
    hide: { name: 'Da dày', esp: 1.25, r: 1, desc: '+2 giáp ở mọi chỗ.', armorAll: 2 },
    porter: { name: 'Vai gánh', esp: 0.2, r: 1, desc: '+10 Thể lực.', sta: 10 },
    riposte: { name: 'Phản đòn', esp: 0.86, r: 2, uniq: 1, desc: 'Sau khi chặn hoặc né, đòn kế tiếp +70% sát thương.' },
    bloodlust: { name: 'Khát máu', esp: 1.23, r: 2, uniq: 1, desc: 'Hạ gục một địch thủ: hồi 25% máu.' },
    grit: { name: 'Lì đòn', esp: 2.45, r: 2, uniq: 1, desc: 'Dưới 35% máu: nhận ít hơn 35% sát thương.' },
    opener: { name: 'Phủ đầu', esp: 3.37, r: 2, uniq: 1, desc: 'Đòn đầu tiên trong trận gây gấp đôi sát thương.' },
    gangup: { name: 'Đánh hội đồng', esp: 2.2, r: 2, uniq: 1, desc: '+25% sát thương lên kẻ đang bị đồng đội đánh.' },
    guardian: { name: 'Hộ vệ', esp: 1.13, r: 2, uniq: 1, desc: 'Đồng đội trong 2 m nhận ít hơn 15% sát thương.' },
    lonewolf: { name: 'Sói đơn độc', esp: 2.5, r: 2, uniq: 1, desc: '+25% sát thương khi không có đồng đội nào trong 3 m.' },
    drilled: { name: 'Thuộc bài', esp: 1.13, r: 2, uniq: 1, desc: 'Chiêu đặc biệt hồi nhanh hơn 35%.' },
    execute: { name: 'Kết liễu', esp: 2.45, r: 2, uniq: 1, desc: '+45% sát thương lên kẻ địch dưới 35% máu.' },
    fleet: { name: 'Chân nhanh', esp: 0.45, r: 2, uniq: 1, desc: '+18% tốc độ di chuyển, +4% né.', moveMul: 0.18, dodge: 0.04 },
    wall: { name: 'Bậc thầy khiên', esp: 0.43, r: 2, uniq: 1, desc: '+12% chặn khi cầm khiên.' },
    sharp: { name: 'Ra đòn hiểm', esp: 1.3, r: 2, uniq: 1, desc: '+12% chí mạng.', crit: 0.12 },
    showman: { name: 'Biết diễn', esp: 0, r: 1, uniq: 1, desc: '+2 sức hút khán giả.', appeal: 2 },
    stubborn: { name: 'Cứng đầu', esp: 0.2, r: 2, uniq: 1, desc: 'Choáng và lưới chỉ còn một nửa thời gian.' },
    second: { name: 'Hơi thở thứ hai', esp: 4.45, r: 2, uniq: 1, desc: 'Một lần mỗi trận, khi xuống dưới 25% máu: hồi 20% máu.' },
    heavy: { name: 'Tay nặng', esp: 3.1, r: 2, uniq: 1, desc: '+18% sát thương, chỉ khi cầm rìu hai tay hoặc đinh ba & lưới (cung, nỏ, song đao, găng không được tính).' },
    fitted: { name: 'Quen giáp', esp: 0.83, r: 1, uniq: 1, desc: 'Giáp và khiên trên người nhẹ đi 20%.' }
  };

  // ---------------------------------------------------------------- Chấn thương
  G.INJURIES = {
    bruise: { name: 'Bầm dập', days: 2, desc: '−10% máu.', hpMul: -0.10, loc: 'body' },
    gash: { name: 'Rách thịt', days: 4, desc: '−18% máu.', hpMul: -0.18, loc: 'body' },
    shoulder: { name: 'Trật vai', days: 5, desc: '−20% sát thương.', dmgMul: -0.20, loc: 'arms' },
    ankle: { name: 'Bong gân', days: 5, desc: '−25% tốc độ di chuyển, −6% né.', moveMul: -0.25, dodge: -0.06, loc: 'legs' },
    concuss: { name: 'Chấn động', days: 4, desc: '−18% tốc độ đánh.', aspd: -0.18, loc: 'head' },
    ribs: { name: 'Gãy xương sườn', days: 8, desc: '−28% máu.', hpMul: -0.28, loc: 'body' },
    // vĩnh viễn
    eye: { name: 'Mất một mắt', perm: 1, desc: 'Vĩnh viễn: −8% né, mất hết chí mạng cơ bản.', dodge: -0.08, crit: -0.05, loc: 'head' },
    limp: { name: 'Què chân', perm: 1, desc: 'Vĩnh viễn: −18% tốc độ di chuyển.', moveMul: -0.18, loc: 'legs' },
    crooked: { name: 'Tay lành lệch', perm: 1, desc: 'Vĩnh viễn: −12% sát thương.', dmgMul: -0.12, loc: 'arms' },
    fingers: { name: 'Mất hai ngón tay', perm: 1, desc: 'Vĩnh viễn: −10% tốc độ đánh.', aspd: -0.10, loc: 'arms' },
    lung: { name: 'Thủng phổi', perm: 1, desc: 'Vĩnh viễn: −15% máu.', hpMul: -0.15, loc: 'body' },
    scarface: { name: 'Mặt sẹo', perm: 1, desc: 'Vĩnh viễn: khán giả nhớ mặt (+1 sức hút), nhưng −3% né.', appeal: 1, dodge: -0.03, loc: 'head' }
  };
  G.INJ_TEMP = { head: ['concuss', 'bruise'], body: ['bruise', 'gash', 'ribs'], arms: ['shoulder', 'gash'], legs: ['ankle', 'gash'] };
  G.INJ_PERM = { head: ['eye', 'scarface'], body: ['lung'], arms: ['crooked', 'fingers'], legs: ['limp'] };

  // ---------------------------------------------------------------- Vật của lanista
  G.RELICS = {
    scale: { name: 'Bộ cân gian', tier: 1, price: 90, desc: 'Lái buôn nào cũng có giá của hắn. Nô lệ rẻ hơn 15%.' },
    granary: { name: 'Hũ ngũ cốc niêm phong', tier: 1, price: 110, desc: 'Mua sỉ từ Ai Cập. Phí nuôi hằng ngày giảm 25%.' },
    rudis: { name: 'Bó kiếm gỗ Rudis', tier: 1, price: 130, desc: 'Người ngồi ngoài vẫn tập: đấu sĩ không ra sân nhận 50% kinh nghiệm của trận đấu.' },
    surgeon: { name: 'Bộ dao mổ Hy Lạp', tier: 2, price: 260, desc: 'Khả năng chết khi gục giảm 35%. Vết thương lành nhanh hơn 1 ngày.' },
    cornu: { name: 'Kèn Cornu bạc', tier: 2, price: 300, desc: 'Người của anh ra sân trong tiếng kèn. Tiền thưởng khán giả +60%.' },
    nemesis: { name: 'Bàn thờ Nemesis', tier: 2, price: 240, desc: 'Đấu sĩ tin nữ thần đứng về phía họ. Mất tinh thần khi thua giảm một nửa.' },
    patron: { name: 'Thư bảo trợ của nguyên lão', tier: 3, price: 620, desc: 'Một cái tên lớn đứng sau trường của anh. Tiền thưởng mọi trận +20%.' },
    ledger: { name: 'Sổ nợ của lái buôn', tier: 3, price: 540, desc: 'Hắn nợ anh. Chợ nô lệ mỗi ngày bày thêm một người, và luôn có ít nhất một kẻ có nghề.' },
    anvil: { name: 'Đe riêng trong trường', tier: 3, price: 580, desc: 'Thợ rèn làm riêng cho anh. Giá vũ khí và giáp giảm 15%.' }
  };

  // ---------------------------------------------------------------- Tên và quê quán
  G.ORIGINS = {
    gallia: { name: 'xứ Gallia', skin: [0xd9a888, 0xcf9f7f, 0xe0b396], hair: [0xa06a32, 0x7a4a22, 0xc28a40, 0x8a3b1c], names: ['Brennus', 'Vercas', 'Dumnorix', 'Ambiorix', 'Segovax', 'Lugos', 'Caturix', 'Orgetor', 'Taranis', 'Biturix', 'Divico', 'Epos'], body: [3, 4, 2] },
    germania: { name: 'xứ Germania', skin: [0xe2b99c, 0xd9ae90, 0xe8c4a8], hair: [0xcaa055, 0xb58a3a, 0x9c6b2c, 0xd8b877], names: ['Arminius', 'Sigimer', 'Gerwulf', 'Odo', 'Adalric', 'Ingomar', 'Hrodgar', 'Wulfila', 'Baldo', 'Theudo', 'Haric', 'Segest'], body: [5, 3, 1] },
    thracia: { name: 'xứ Thracia', skin: [0xc99a78, 0xbf8f6c, 0xd2a482], hair: [0x2e2218, 0x3d2a1a, 0x4a3320], names: ['Spartos', 'Rhesus', 'Sitalces', 'Kotys', 'Teres', 'Seuthes', 'Bithus', 'Dromos', 'Mukatral', 'Zalmox', 'Amadok', 'Oroles'], body: [3, 4, 3] },
    graecia: { name: 'Hy Lạp', skin: [0xc9996f, 0xc08e66, 0xd4a57c], hair: [0x1e1812, 0x2c2016, 0x3a2a1c], names: ['Nikias', 'Lykos', 'Demos', 'Philon', 'Xanthos', 'Kleon', 'Timon', 'Agathon', 'Damon', 'Herakles', 'Iason', 'Myron'], body: [2, 5, 3] },
    numidia: { name: 'xứ Numidia', skin: [0x7a5238, 0x6b4630, 0x8a6044], hair: [0x14100c, 0x1c1610], names: ['Juba', 'Masin', 'Gauda', 'Hiempsal', 'Adherbal', 'Syphax', 'Tacfar', 'Micipsa', 'Bocchus', 'Gulussa', 'Iarbas', 'Zelalsen'], body: [2, 3, 5] },
    aegyptus: { name: 'Ai Cập', skin: [0xa87a55, 0x9c6f4c, 0xb48660], hair: [0x120e0a, 0x1a140e], names: ['Amasis', 'Petos', 'Horion', 'Sarapion', 'Nechos', 'Pakhom', 'Psenos', 'Harsies', 'Onnophris', 'Teos', 'Imuthes', 'Kephalas'], body: [2, 4, 4] },
    hispania: { name: 'xứ Hispania', skin: [0xc48f68, 0xb98460, 0xcf9c76], hair: [0x241a12, 0x33241a, 0x47301e], names: ['Viriatus', 'Indibil', 'Mandon', 'Corocot', 'Retogen', 'Olindic', 'Caros', 'Tanginus', 'Punicus', 'Caesaros', 'Leukon', 'Ambon'], body: [3, 5, 2] },
    syria: { name: 'xứ Syria', skin: [0xb98660, 0xae7b56, 0xc4926c], hair: [0x16110c, 0x231a12], names: ['Bargates', 'Malchus', 'Zabdas', 'Abgar', 'Sohaemus', 'Iamblichus', 'Azizus', 'Barsemis', 'Maron', 'Thaimos', 'Odainath', 'Bassus'], body: [2, 5, 3] },
    britannia: { name: 'xứ Britannia', skin: [0xe6c0a6, 0xdcb298, 0xecc9b0], hair: [0xa1451f, 0x8b3a1a, 0xb86a30, 0x6b3a1c], names: ['Caratac', 'Togodum', 'Cunobel', 'Prasutag', 'Venutius', 'Calgac', 'Bodvoc', 'Tincom', 'Dubnovel', 'Mandubrac', 'Segonax', 'Eppil'], body: [4, 3, 3] },
    dacia: { name: 'xứ Dacia', skin: [0xd2a585, 0xc89a7a, 0xdab092], hair: [0x3a2a1c, 0x4f3622, 0x2a1e14], names: ['Decebal', 'Burebis', 'Diurpan', 'Scorilo', 'Duras', 'Cotiso', 'Dicomes', 'Rholes', 'Zyraxes', 'Dapyx', 'Comosic', 'Vezinas'], body: [4, 4, 2] },
    italia: { name: 'đất Ý', skin: [0xd0a07c, 0xc69572, 0xd8ab88], hair: [0x2a1e14, 0x3a2a1a, 0x1e1610], names: ['Felix', 'Priscus', 'Verus', 'Flamma', 'Celadus', 'Crescens', 'Hilarus', 'Severus', 'Rutilus', 'Asper', 'Faustus', 'Niger'], body: [3, 5, 2] }
  };
  G.EPITHETS = ['Gã Thọt', 'Mắt Lác', 'Răng Sún', 'Lầm Lì', 'Sẹo', 'Còm', 'Đầu Bò', 'Tay Dài', 'Chó Điên', 'Cáo Già'];

  // ---------------------------------------------------------------- Chiến dịch
  G.TIERS = [
    { id: 'market', name: 'Bãi chợ Capua', short: 'Chợ', field: 2, reward: 40, upkeepMul: 0.75, lvl: 1, cap: 4, gear: 1, foe: [1, 1], boss: [0.8, 0.85], desc: 'Một vòng rào gỗ giữa chợ gia súc. Khán giả là dân buôn và ruồi.' },
    { id: 'village', name: 'Đấu trường gỗ Nuceria', short: 'Làng', field: 3, reward: 95, upkeepMul: 1.25, lvl: 3, cap: 7, gear: 2, foe: [1, 1], boss: [1.05, 1.0], desc: 'Khán đài ván ghép, mùi rượu chua. Ở đây người ta đã biết đặt cược.' },
    { id: 'city', name: 'Đấu trường đá Pompeii', short: 'Thành phố', field: 4, reward: 220, upkeepMul: 2.0, lvl: 6, cap: 10, gear: 3, foe: [1, 1], boss: [0.75, 0.85], desc: 'Hai vạn chỗ ngồi bằng đá. Tên đấu sĩ được viết lên tường.' },
    { id: 'frontier', name: 'Doanh trại Carnuntum', short: 'Biên giới', field: 5, reward: 300, upkeepMul: 2.3, lvl: 8, cap: 12, gear: 4, foe: [1.75, 1.3], boss: [2.0, 1.4], desc: 'Sân đất nện giữa doanh trại lê dương bên bờ Danube. Năm nghìn lính trên tường lũy gỗ, và họ đã quá quen thấy máu.' },
    { id: 'colosseum', name: 'Colosseum', short: 'Colosseum', field: 5, reward: 400, upkeepMul: 2.7, lvl: 9, cap: 13, gear: 4, foe: [1.85, 1.4], boss: [1.6, 1.25], desc: 'Rome. Năm vạn người, và hoàng đế đang nhìn.' }
  ];

  // e(tên, thể hình, cấp, vũ khí, [đồ], cột, hàng, tùy chọn)
  function e(name, body, lvl, w, gear, c, r, x) { return { name: name, body: body, lvl: lvl, w: w, gear: gear || [], c: c, r: r, x: x || null }; }
  G.e = e;
  G.CAMPAIGN = [
    // ================= CHỢ (2 người)
    [
      { name: 'Hai tên trộm gà', desc: 'Bị bắt quả tang ở chuồng gà nhà quan coi chợ. Tay không, và sợ.',
        hint: 'Chúng không có gì trong tay. Bất kỳ vũ khí nào cũng hơn nắm đấm.',
        foes: [e('Tên trộm gầy', 'agi', 1, null, [], 0, 1, { hpMul: 0.6 }), e('Tên trộm lùn', 'bal', 1, null, [], 0, 3, { hpMul: 0.6 })] },
      { name: 'Anh em thợ thuộc da', desc: 'Hai gã hôi mùi vôi và nước tiểu, mỗi gã một cây gậy sồi.',
        hint: 'Gậy chậm nhưng nặng. Kẻ nhanh tay sẽ đánh được hai đòn trước mỗi cú vung của chúng.',
        foes: [e('Thợ thuộc da anh', 'big', 1, 'mace1', [], 0, 1, { hpMul: 0.85 }), e('Thợ thuộc da em', 'bal', 1, 'mace1', ['a_wrap'], 0, 3, { hpMul: 0.85 })] },
      { name: 'Gã say và con dao', desc: 'Một lão lính già giữ khiên, và thằng cháu của lão lẩn phía sau với đôi dao găm.',
        hint: 'Thằng cầm dao sẽ vòng ra sau lưng người của anh. Đừng để ai đứng một mình.',
        foes: [e('Lão lính say', 'big', 2, 'gladius1', ['s_plank', 'b_harness'], 0, 2), e('Thằng cháu', 'agi', 1, 'twin1', [], 1, 3, { hpMul: 0.75, dmgMul: 0.8 })] },
      { name: 'Phường săn thỏ', desc: 'Ba thợ săn nghèo. Họ chưa giết người bao giờ, nhưng ném thì trúng.',
        hint: 'Lao bay 5,5 m. Khiên chặn được lao; chân nhanh thì tới nơi trước cây lao thứ hai.',
        foes: [e('Thợ săn già', 'bal', 2, 'javelin1', [], 1, 0, { hpMul: 0.58, dmgMul: 0.68 }), e('Thợ săn trẻ', 'agi', 1, 'javelin1', [], 1, 4, { hpMul: 0.58, dmgMul: 0.68 }), e('Gã đánh bẫy', 'bal', 1, 'mace1', ['l_wraps'], 0, 2, { hpMul: 0.75 })] },
      { name: 'Lính đào ngũ', desc: 'Hai tên bỏ hàng ngũ ở Gallia. Chúng vẫn còn giữ khiên và thói quen đánh theo đội.',
        hint: 'Lần đầu gặp giáp và khiên thật. Gậy xuyên giáp, đao cong vòng qua khiên.',
        foes: [e('Đào binh Marcus', 'bal', 3, 'gladius1', ['s_plank', 'b_leather', 'h_cap'], 0, 1, { hpMul: 0.88 }), e('Đào binh Titus', 'bal', 2, 'hasta1', ['s_plank', 'b_harness', 'h_cap'], 0, 3, { hpMul: 0.88 })] },
      { name: 'Bầy chó đói', desc: 'Năm tù nhân bị thả ra cùng lúc. Yếu, nhưng đông gấp đôi.',
        hint: 'Đông không có nghĩa là mạnh — nhưng bị vây thì khiên vô dụng. Dựa lưng vào nhau.',
        foes: [e('Tù nhân', 'agi', 1, 'twin1', [], 0, 0, { hpMul: 0.5, dmgMul: 0.72 }), e('Tù nhân', 'bal', 1, null, [], 0, 2, { hpMul: 0.5, dmgMul: 0.72 }), e('Tù nhân', 'agi', 1, 'caestus1', [], 0, 4, { hpMul: 0.5, dmgMul: 0.72 }), e('Tù nhân', 'bal', 1, 'mace1', [], 1, 1, { hpMul: 0.5, dmgMul: 0.72 }), e('Tù nhân', 'bal', 1, null, [], 1, 3, { hpMul: 0.5, dmgMul: 0.72 })] },
      { name: 'Vitus Đồ Tể', boss: 1, desc: 'Gã mổ bò của chợ Capua, nặng bằng hai người. Hắn đã bổ đôi ba đấu sĩ bằng cây rìu xẻ thịt và dân chợ trả tiền để xem lần thứ tư.',
        hint: 'Rìu của hắn quét trúng mọi người đứng trước mặt, nhưng mỗi cú vung mất hơn hai giây. Tách hai người ra hai phía; kẻ đứng sau lưng hắn đánh mạnh hơn. Giáo, đinh ba và lao với tới hắn từ ngoài tầm rìu. Khiên chỉ đỡ được nửa lực rìu, và kẻ phải áp sát (găng, song đao) sẽ ăn trọn cú quét. Bị lao cắm, hắn quay sang đuổi kẻ ném. Mỗi nhát rìu thường của hắn cũng chém lan sang người đứng cạnh, và cứ mười giây hắn gầm lên một tiếng, mạnh thêm 15% (tối đa bốn lần): kéo dài trận là chết.',
        foes: [e('Vitus Đồ Tể', 'big', 5, 'axe1', ['b_leather', 'a_wrap', 'l_wraps'], 0, 2, { boss: 1, hpMul: 2.45, dmgMul: 1.4, scale: 1.12, spCd: 0.75, moveMul: 1.2, cleave: 0.45, howl: { every: 10, dmg: 0.15, max: 4 } })] }
    ],
    // ================= LÀNG (3 người)
    [
      { name: 'Ba người chăn cừu', desc: 'Dân núi Samnium, quen đuổi sói bằng giáo dài.',
        hint: 'Ba mũi giáo với tầm 2 m. Kẻ áp sát được thì giáo thành vô dụng — hoặc ném lao từ xa hơn.',
        foes: [e('Mục đồng cả', 'bal', 3, 'hasta2', ['b_leather'], 0, 1, { hpMul: 0.9 }), e('Mục đồng giữa', 'bal', 3, 'hasta1', ['b_harness', 'h_cap'], 0, 2, { hpMul: 0.9 }), e('Mục đồng út', 'agi', 2, 'hasta1', ['l_sandal'], 0, 3)] },
      { name: 'Phường săn thú', desc: 'Venatores hết việc vì thú đắt. Hai cây lao và một tấm lưới.',
        hint: 'Kẻ bị lưới trùm đứng yên ba giây cho lao cắm. Đưa kẻ lì đòn nhất lên trước hứng lưới.',
        foes: [e('Thợ lưới Glaucus', 'agi', 3, 'trident1', ['a_galerus'], 0, 2), e('Thợ lao', 'bal', 3, 'javelin2', ['b_harness'], 2, 1), e('Thợ lao', 'bal', 3, 'javelin1', ['b_harness'], 2, 3)] },
      { name: 'Bức tường khiên', desc: 'Ba cựu binh giải ngũ không ruộng. Khiên kề khiên, không ai lùi.',
        hint: 'Ba tấm khiên chặn gần nửa số đòn trước mặt. Đao cong, chùy, hoặc một kẻ lọt ra sau lưng.',
        foes: [e('Cựu binh Gaius', 'big', 4, 'gladius2', ['s_parma', 'b_leather', 'h_legion'], 0, 1, { hpMul: 1.08 }), e('Cựu binh Lucius', 'bal', 3, 'gladius2', ['s_parma', 'b_leather', 'h_legion'], 0, 2, { hpMul: 1.08 }), e('Cựu binh Quintus', 'big', 3, 'gladius1', ['s_parma', 'b_leather', 'h_legion'], 0, 3, { hpMul: 1.08 })] },
      { name: 'Song sinh xứ Thracia', desc: 'Hai anh em bị bán cùng một ngày. Nhanh, và chém đâu chảy máu đó.',
        hint: 'Chỉ có hai, nhưng mỗi tên bằng hai người của anh. Dồn cả ba vào một đứa trước.',
        foes: [e('Bithus Anh', 'agi', 6, 'sica2', ['h_galea', 'a_manica', 'l_wraps'], 0, 1, { hpMul: 1.88, dmgMul: 1.15 }), e('Bithus Em', 'agi', 6, 'sica2', ['s_parma', 'a_manica', 'l_wraps'], 0, 3, { hpMul: 1.88, dmgMul: 1.15 })] },
      { name: 'Phu mỏ đá nổi loạn', desc: 'Sáu phu mỏ bị kết án. Cuốc chim, búa tạ, không giáp, không sợ.',
        hint: 'Búa và rìu của họ chậm nhưng chỉ cần trúng một lần. Giáp nhẹ và chân nhanh sống lâu hơn giáp dày ở đây.',
        foes: [e('Phu mỏ', 'big', 2, 'axe1', [], 0, 0, { hpMul: 0.7, dmgMul: 0.82 }), e('Phu mỏ', 'big', 2, 'mace1', [], 0, 2, { hpMul: 0.7, dmgMul: 0.82 }), e('Phu mỏ', 'big', 2, 'axe1', [], 0, 4, { hpMul: 0.7, dmgMul: 0.82 }), e('Phu mỏ', 'bal', 2, 'mace2', [], 1, 1, { hpMul: 0.7, dmgMul: 0.82 }), e('Phu mỏ', 'bal', 2, 'mace1', [], 1, 3, { hpMul: 0.7, dmgMul: 0.82 }), e('Cai mỏ', 'big', 3, 'mace2', ['b_harness', 'h_cap'], 2, 2, { hpMul: 0.8 })] },
      { name: 'Trường của lão Batiatus', desc: 'Một lanista khác, đội hình sách vở: khiên lớn, đao cong, đinh ba.',
        hint: 'Trận đầu tiên với một đội được sắp xếp tử tế như của anh. Xem ai của chúng làm gì rồi xếp người khắc chế.',
        foes: [e('Murmillo Ursus', 'big', 6, 'gladius2', ['s_parma', 'h_legion', 'b_leather', 'a_manica'], 0, 2), e('Thraex Kotys', 'agi', 6, 'sica2', ['s_plank', 'h_galea', 'l_wraps'], 0, 3), e('Retiarius Pontus', 'agi', 6, 'trident2', ['a_galerus', 'l_sandal'], 1, 1)] },
      { name: 'Nereus — Lưới Tử Thần', boss: 1, desc: 'Ngư phủ xứ Rhodes, chưa ai chạm được vào hắn. Hắn giăng lưới, lùi, đâm, rồi lại lùi — và cười.',
        hint: 'Hắn nhanh hơn mọi người của anh và tầm đinh ba dài hơn mọi thanh kiếm. Lao bắt được hắn từ xa — nhưng bị lao cắm, hắn sẽ quăng lưới rồi lao thẳng tới kẻ ném, nên vẫn cần một tấm khiên đứng trước. Khiên chặn được mũi đinh ba. Kẻ không khiên xông vào sẽ dính lưới rồi ăn đòn. Cứ chín giây hắn phóng thẳng tới kẻ đứng xa nhất — thường là người ném lao hay cung thủ — đâm một nhát ×2,4 sát thương làm choáng: đừng để hàng sau đứng trơ trọi.',
        foes: [e('Nereus', 'agi', 8, 'trident2', ['a_galerus', 'l_sandal', 't_oil'], 0, 2, { boss: 1, hpMul: 4.5, dmgMul: 1.8, scale: 1.06, spCd: 0.55, moveMul: 1.1, charge: { every: 9, mul: 2.4, far: 1, stun: 0.9 } })] }
    ],
    // ================= THÀNH PHỐ (4 người)
    [
      { name: 'Lính đánh thuê xứ Gallia', desc: 'Bốn tên tóc vàng bôi vôi, hai rìu hai khiên, hát trước khi đánh.',
        hint: 'Hai cây rìu sẽ xông thẳng vào hàng đầu của anh. Khiên chỉ đỡ được nửa lực rìu — hãy giết chúng trước khi chúng vung lần hai.',
        foes: [e('Brennos', 'big', 7, 'axe2', ['b_leather', 'h_cap'], 0, 1), e('Catuvolc', 'big', 7, 'axe2', ['b_leather'], 0, 3), e('Lính Gallia', 'bal', 7, 'gladius2', ['s_hoplon', 'b_linen', 'h_legion'], 1, 2), e('Lính Gallia', 'bal', 6, 'hasta2', ['s_parma', 'b_linen'], 1, 0)] },
      { name: 'Bóng ma hẻm tối', desc: 'Sát thủ thuê của khu Subura, bị bắt cả ổ. Không giáp, song đao, không bao giờ đánh trước mặt.',
        hint: 'Chúng sẽ bỏ qua hàng đầu để tìm kẻ mặc ít giáp nhất. Giáp cho cả những người đứng sau, hoặc xếp thành cụm để không ai hở lưng.',
        foes: [e('Bóng ma', 'agi', 7, 'twin2', ['a_manica', 'l_sandal'], 0, 0, { hpMul: 1.2 }), e('Bóng ma', 'agi', 7, 'twin2', ['a_manica', 'l_sandal'], 0, 4, { hpMul: 1.2 }), e('Bóng ma', 'agi', 7, 'twin2', ['l_sandal', 't_oil'], 1, 1, { hpMul: 1.2 }), e('Kẻ cầm đầu', 'agi', 8, 'twin3', ['b_linen', 'a_manica', 'l_sandal'], 1, 3, { hpMul: 1.3 })] },
      { name: 'Phalanx Hy Lạp', desc: 'Lính đánh thuê từ Tarentum. Hai khiên đồng phía trước, ba mũi giáo phía sau.',
        hint: 'Đánh trực diện là đánh vào khiên trong khi ba mũi giáo đâm anh. Kẻ vòng sườn và lao là câu trả lời.',
        foes: [e('Hoplite', 'big', 5, 'gladius2', ['s_hoplon', 'b_linen', 'h_legion', 'l_ocrea'], 0, 1, { hpMul: 0.8, dmgMul: 1.15 }), e('Hoplite', 'big', 5, 'gladius2', ['s_hoplon', 'b_linen', 'h_legion', 'l_ocrea'], 0, 3, { hpMul: 0.8, dmgMul: 1.15 }), e('Lính giáo', 'bal', 5, 'hasta3', ['b_linen', 'h_cap'], 1, 1, { hpMul: 0.85 }), e('Lính giáo', 'bal', 5, 'hasta2', ['b_linen', 'h_cap'], 1, 2, { hpMul: 0.85 }), e('Lính giáo', 'bal', 5, 'hasta3', ['b_linen', 'h_cap'], 1, 3, { hpMul: 0.85 })] },
      { name: 'Kỵ binh mất ngựa xứ Numidia', desc: 'Những tay ném lao giỏi nhất thế giới, nay đi bộ. Một gã khổng lồ đứng chắn trước họ.',
        hint: 'Bốn cây lao mỗi hai giây. Khiên lớn đi trước; kẻ nhanh chân vòng qua gã chắn đường để tới chỗ lính lao.',
        foes: [e('Gã chắn đường', 'big', 6, 'mace2', ['s_scutum', 'b_hamata', 'h_legion'], 0, 2), e('Lính lao Numidia', 'agi', 6, 'javelin2', ['l_sandal'], 2, 0, { hpMul: 0.7, dmgMul: 0.8 }), e('Lính lao Numidia', 'agi', 6, 'javelin3', ['l_sandal'], 2, 1, { hpMul: 0.7, dmgMul: 0.8 }), e('Lính lao Numidia', 'agi', 6, 'javelin2', ['l_sandal'], 2, 3, { hpMul: 0.7, dmgMul: 0.8 }), e('Lính lao Numidia', 'agi', 6, 'javelin3', ['l_sandal'], 2, 4, { hpMul: 0.7, dmgMul: 0.8 })] },
      { name: 'Gã khổng lồ và bầy sói', desc: 'Một tù binh Germania cao hơn mọi người một cái đầu, và ba tên lâu la bám quanh hắn.',
        hint: 'Bầy sói chết nhanh nhưng cắn đau. Gã khổng lồ mặc giáp lưới: chùy và giáo xuyên giáp đáng giá hơn kiếm.',
        foes: [e('Gerwulf Khổng Lồ', 'big', 9, 'mace3', ['b_hamata', 'h_legion', 'a_scale', 'l_ocrea'], 0, 2, { hpMul: 2.8, dmgMul: 1.3, scale: 1.1 }), e('Sói', 'agi', 8, 'twin2', [], 0, 0), e('Sói', 'agi', 8, 'sica2', [], 0, 4), e('Sói', 'agi', 8, 'twin2', [], 1, 2)] },
      { name: 'Nhà vô địch Capua', desc: 'Trường giàu nhất Campania gửi bốn người giỏi nhất. Mỗi tên có một bức vẽ trên tường quán rượu.',
        hint: 'Không có mẹo. Bốn người của chúng tốt ngang bốn người của anh — bên nào trang bị và xếp hình khéo hơn sẽ thắng.',
        foes: [e('Murmillo Celadus', 'big', 10, 'gladius3', ['s_scutum', 'h_murmillo', 'b_linen', 'a_manica', 'l_ocrea'], 0, 1), e('Thraex Oceanus', 'bal', 10, 'sica3', ['s_parma', 'h_galea', 'b_linen', 'a_scale', 'l_ocrea'], 0, 3), e('Hoplomachus Rusticus', 'bal', 9, 'hasta3', ['s_parma', 'h_galea', 'b_linen'], 1, 2), e('Retiarius Crescens', 'agi', 9, 'trident3', ['a_galerus', 'l_sandal'], 1, 4)] },
      { name: 'Ferox — Bức Tường Sắt', boss: 1, desc: 'Ba mươi trận, chưa một vết sẹo. Hắn không tấn công: hắn đứng sau tấm scutum bọc sắt và chờ anh mệt.',
        hint: 'Tấm khiên của hắn che cả trước mặt lẫn hai sườn và chặn hơn nửa số đòn; chỉ sau lưng là hở. Giáp nuốt phần còn lại. Chùy bỏ qua giáp, rìu xuyên nửa lực qua khiên, đao cong vòng qua mép khiên; lao nặng ghim được khiên năm giây rồi hắn giật ra. Song đao và nắm đấm gần như vô hại trước lớp sắt ấy; một hàng kiếm khiên đứng trước mặt hắn chỉ tổ mỏi tay. Khi còn hai phần ba và một phần ba máu, hắn gọi hai học trò cầm khiên ra đứng cạnh: khiên kề khiên, chúng che cho nhau.',
        foes: [e('Ferox', 'big', 11, 'gladius3', ['s_tower', 'h_secutor', 'b_segment', 'a_plate', 'l_ocrea2'], 0, 2, { boss: 1, hpMul: 3.2, dmgMul: 2.55, scale: 1.08, spCd: 0.7, capAdd: 90, moveMul: 1.3, wall: 1, summon: { at: [0.66, 0.33], foes: [e('Học trò của Ferox', 'big', 8, 'gladius2', ['s_scutum', 'h_legion', 'b_hamata'], 0, 2, { hpMul: 0.75, dmgMul: 0.85, talent: 'legionary' }), e('Học trò của Ferox', 'big', 8, 'gladius2', ['s_scutum', 'h_legion', 'b_hamata'], 0, 2, { hpMul: 0.75, dmgMul: 0.85, talent: 'legionary' })] } })] }
    ],
    // ================= BIÊN GIỚI — Doanh trại Carnuntum (5 người): kỵ binh, đội hình lê dương, thú dữ
    [
      { name: 'Chó trận của doanh trại', desc: 'Năm con chó Molossus được nuôi để xé xác tù binh Germania, và gã lính già giữ xích chúng.',
        hint: 'Chó chạy nhanh hơn người, vòng ra sau lưng và đớp gân chân. Đứng sát nhau để không ai hở lưng; khiên và giáp chân giữ được bắp chân. Gã dắt chó ném lao từ phía sau.',
        foes: [e('Chó Molossus', 'agi', 8, null, [], 0, 0, { beast: 'dog', hpMul: 0.5 }), e('Chó Molossus', 'agi', 8, null, [], 0, 1, { beast: 'dog', hpMul: 0.5 }), e('Chó Molossus', 'agi', 8, null, [], 0, 2, { beast: 'dog', hpMul: 0.5 }), e('Chó Molossus', 'agi', 8, null, [], 0, 3, { beast: 'dog', hpMul: 0.5 }), e('Chó Molossus', 'agi', 8, null, [], 0, 4, { beast: 'dog', hpMul: 0.5 }), e('Người dắt chó', 'bal', 9, 'javelin3', ['b_linen', 'h_legion', 's_parma'], 2, 2)] },
      { name: 'Đội tuần tra kỵ binh', desc: 'Hai kỵ binh trợ chiến xứ Pannonia với giáo móc, và ba cung thủ Syria nấp sau lưng ngựa.',
        hint: 'Kỵ binh phi vòng quanh sân rồi bất ngờ xông vào móc kẻ đứng lẻ, kéo lê hắn đi. Đừng để ai đứng một mình; giáo và lao đón được ngựa đang lao tới; lưới và đòn choáng làm ngựa khựng lại.',
        foes: [e('Kỵ binh Pannonia', 'bal', 9, 'hasta3', ['b_hamata', 'h_legion'], 1, 0, { mount: 'horse', hpMul: 1.15 }), e('Kỵ binh Pannonia', 'bal', 9, 'hasta3', ['b_hamata', 'h_legion'], 1, 4, { mount: 'horse', hpMul: 1.15 }), e('Cung thủ Syria', 'agi', 8, 'bow3', ['b_linen'], 2, 1, { hpMul: 0.8, dmgMul: 0.7 }), e('Cung thủ Syria', 'agi', 8, 'bow3', ['b_linen'], 2, 2, { hpMul: 0.8, dmgMul: 0.7 }), e('Cung thủ Syria', 'agi', 8, 'bow3', ['b_linen'], 2, 3, { hpMul: 0.8, dmgMul: 0.7 })] },
      { name: 'Người thuần gấu', desc: 'Một con gấu nâu bắt ở rừng Dacia, đói ba ngày, và hai thợ săn thú cầm giáo dồn nó về phía anh.',
        hint: 'Con gấu quật trúng mọi kẻ đứng trước mặt nó và vồ đè người xuống; khiên chỉ đỡ được nửa lực. Đừng dồn cả đội trước mặt nó: một người giữ chân, những người khác đánh từ hai bên và sau lưng. Nó gầm lên là choáng cả những ai đứng sát.',
        foes: [e('Gấu nâu Dacia', 'big', 10, null, [], 0, 2, { beast: 'bear', hpMul: 4.0, dmgMul: 1.3, armor: 3, roar: 1, scale: 2 }), e('Thợ săn thú', 'bal', 9, 'hasta3', ['b_linen', 'a_manica'], 1, 1), e('Thợ săn thú', 'bal', 9, 'hasta3', ['b_linen', 'a_manica'], 1, 3)] },
      { name: 'Một contubernium', desc: 'Tám người ngủ chung một lều, ăn chung một nồi, đánh như một người. Hôm nay năm người và viên đội trưởng của họ ra sân.',
        hint: 'Họ ném một loạt pilum rồi tiến thành hàng: khiên kề khiên, hàng sau đâm qua vai hàng trước, không ai đuổi theo ai. Đánh trực diện là đánh vào tường. Vòng ra hai đầu hàng — hoặc hạ viên đội trưởng phía sau: mất chỉ huy, hàng ngũ tan.',
        foes: [e('Lính lê dương', 'bal', 9, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 1, { formation: 'A', pila: 1, talent: 'legionary', hpMul: 0.74 }), e('Lính lê dương', 'big', 9, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 2, { formation: 'A', pila: 1, talent: 'legionary', hpMul: 0.74 }), e('Lính lê dương', 'bal', 9, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 3, { formation: 'A', pila: 1, talent: 'legionary', hpMul: 0.74 }),
          e('Lính lê dương', 'bal', 8, 'hasta3', ['s_parma', 'h_legion', 'b_hamata'], 1, 1, { formation: 'A', pila: 1, talent: 'legionary', hpMul: 0.72 }), e('Lính lê dương', 'bal', 8, 'hasta3', ['s_parma', 'h_legion', 'b_hamata'], 1, 3, { formation: 'A', pila: 1, talent: 'legionary', hpMul: 0.72 }),
          e('Đội trưởng Sextus', 'big', 10, 'gladius3', ['s_scutum', 'h_murmillo', 'b_squamata', 'a_scale', 'l_ocrea'], 2, 2, { formation: 'A', leader: 1, talent: 'legionary', hpMul: 1.1 })] },
      { name: 'Kỵ binh Sarmatia', desc: 'Những kỵ sĩ thảo nguyên mặc giáp vảy từ đầu đến chân, và hai cung kỵ chưa từng bắn trượt khi ngựa đang phi.',
        hint: 'Cung kỵ vừa phi vòng vừa bắn — người đi bộ không đuổi kịp. Lao, cung và nỏ của anh bắt được chúng; lưới làm ngựa khựng. Hai kỵ sĩ giáp vảy sẽ móc kéo kẻ đứng lẻ: giữ đội hình thật chặt.',
        foes: [e('Kỵ sĩ giáp vảy', 'big', 10, 'hasta4', ['b_squamata', 'h_galea', 'a_scale', 'l_ocrea'], 1, 1, { mount: 'horse', hpMul: 1.3, dmgMul: 1.1 }), e('Kỵ sĩ giáp vảy', 'big', 10, 'hasta4', ['b_squamata', 'h_galea', 'a_scale', 'l_ocrea'], 1, 3, { mount: 'horse', hpMul: 1.3, dmgMul: 1.1 }), e('Cung kỵ Sarmatia', 'agi', 9, 'bow3', ['b_linen', 'h_cap'], 2, 0, { mount: 'horse', hpMul: 0.8, dmgMul: 0.72 }), e('Cung kỵ Sarmatia', 'agi', 9, 'bow3', ['b_linen', 'h_cap'], 2, 4, { mount: 'horse', hpMul: 0.8, dmgMul: 0.72 })] },
      { name: 'Một nửa cohors', desc: 'Viên tribunus muốn cho lính mới xem chiến thuật thật: một hàng lê dương ở giữa, kỵ binh hai cánh, cung thủ phía sau.',
        hint: 'Mọi thứ anh đã gặp ở doanh trại này cùng một lúc. Hàng khiên ghìm anh lại để kỵ binh vòng sau lưng; cung thủ bắn kẻ đứng yên. Chọn: phá hàng bằng cách hạ viên chỉ huy, hay lo kỵ binh trước.',
        foes: [e('Lính lê dương', 'bal', 10, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 1, { formation: 'B', pila: 1, talent: 'legionary', hpMul: 0.66 }), e('Lính lê dương', 'big', 10, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 2, { formation: 'B', pila: 1, talent: 'legionary', hpMul: 0.66 }), e('Lính lê dương', 'bal', 10, 'gladius3', ['s_scutum', 'h_legion', 'b_hamata', 'l_ocrea'], 0, 3, { formation: 'B', pila: 1, talent: 'legionary', hpMul: 0.66 }),
          e('Optio Valens', 'big', 11, 'hasta3', ['s_scutum', 'h_murmillo', 'b_squamata', 'l_ocrea'], 1, 2, { formation: 'B', leader: 1, talent: 'legionary', hpMul: 1.0 }),
          e('Kỵ binh cánh', 'bal', 10, 'hasta3', ['b_hamata', 'h_legion'], 1, 0, { mount: 'horse', hpMul: 0.8 }), e('Kỵ binh cánh', 'bal', 10, 'hasta3', ['b_hamata', 'h_legion'], 1, 4, { mount: 'horse', hpMul: 0.8 }),
          e('Cung thủ', 'agi', 9, 'bow3', ['b_linen'], 2, 2, { hpMul: 0.8, dmgMul: 0.7 })] },
      { name: 'Arctos — Gấu Chúa Pannonia', boss: 1, desc: 'Con gấu đen to nhất từng bị bắt sống ở bờ Danube. Nó đã giết mười một người trong hố của doanh trại, và giờ nó đứng một mình giữa sân, đói.',
        hint: 'Mỗi cú quật của nó trúng tất cả những ai đứng trước mặt, và khiên chỉ đỡ nửa lực. Nó gầm làm choáng mọi kẻ đứng sát, vồ đè một người xuống rồi xé. Khi còn nửa máu nó nổi điên. Kẻ đánh từ sau lưng an toàn hơn; giáo, lao và lưới đánh được nó từ ngoài tầm vuốt. Cứ mười hai giây nó hú một tiếng, mạnh thêm 12% (tối đa năm lần): giết nhanh, đừng để trận kéo dài.',
        foes: [e('Arctos', 'big', 13, null, [], 0, 2, { beast: 'bear', boss: 1, hpMul: 7.0, dmgMul: 1.7, scale: 2.3, armor: 5, roar: 1, enrage: 1, spCd: 0.7, howl: { every: 12, dmg: 0.12, max: 5 } })] }
    ],
    // ================= COLOSSEUM (5 người)
    [
      { name: 'Tù binh xứ Dacia', desc: 'Năm chiến binh của Decebalus với những lưỡi falx từng chẻ đôi mũ lính lê dương.',
        hint: 'Năm cây liềm hai tay, không khiên, không giáp. Ai ra đòn trước thắng: lao, giáo và lưới giữ chúng ở xa.',
        foes: [e('Chiến binh Dacia', 'big', 11, 'axe3', ['h_cap', 'l_wraps'], 0, 0, { hpMul: 1.1 }), e('Chiến binh Dacia', 'big', 11, 'axe3', ['h_cap', 'l_wraps'], 0, 1, { hpMul: 1.1 }), e('Tù trưởng Diurpan', 'big', 12, 'axe3', ['b_leather', 'h_legion', 'l_wraps'], 0, 2, { hpMul: 1.35 }), e('Chiến binh Dacia', 'big', 11, 'axe3', ['h_cap', 'l_wraps'], 0, 3, { hpMul: 1.1 }), e('Chiến binh Dacia', 'big', 11, 'axe3', ['h_cap', 'l_wraps'], 0, 4, { hpMul: 1.1 })] },
      { name: 'Cận vệ thất sủng', desc: 'Bốn lính Praetoriani dính vào một âm mưu. Hoàng đế cho họ chết trong giáp.',
        hint: 'Giáp tấm từ đầu đến chân: song đao và nắm đấm gần như vô hại. Chùy, giáo xuyên giáp, và kiên nhẫn.',
        foes: [e('Cận vệ', 'bal', 12, 'gladius3', ['s_scutum', 'h_legion', 'b_segment', 'a_scale', 'l_ocrea'], 0, 1, { hpMul: 0.88, dmgMul: 1.35 }), e('Cận vệ', 'bal', 12, 'gladius3', ['s_scutum', 'h_legion', 'b_segment', 'a_scale', 'l_ocrea'], 0, 2, { hpMul: 0.88, dmgMul: 1.35 }), e('Cận vệ', 'bal', 12, 'gladius3', ['s_scutum', 'h_legion', 'b_segment', 'a_scale', 'l_ocrea'], 0, 3, { hpMul: 0.88, dmgMul: 1.35 }), e('Bách phu trưởng', 'big', 13, 'hasta4', ['s_scutum', 'h_thraex', 'b_segment', 'a_plate', 'l_ocrea'], 1, 2, { hpMul: 1.3, dmgMul: 1.2 })] },
      { name: 'Lưới và đinh ba', desc: 'Ba retiarius và hai secutor của trường hoàng gia Ludus Magnus diễn bài quen thuộc.',
        hint: 'Ba tấm lưới: ba người của anh sẽ đứng chôn chân. Mũ Secutor trượt lưới; "Cứng đầu" giảm nửa thời gian; giết thợ lưới trước.',
        foes: [e('Secutor', 'big', 12, 'gladius3', ['s_scutum', 'h_secutor', 'a_scale', 'l_ocrea'], 0, 1, { hpMul: 0.9, dmgMul: 1.1 }), e('Secutor', 'big', 12, 'gladius3', ['s_scutum', 'h_secutor', 'a_scale', 'l_ocrea'], 0, 3, { hpMul: 0.9, dmgMul: 1.1 }), e('Retiarius', 'agi', 11, 'trident3', ['a_galerus', 'l_sandal'], 1, 0, { hpMul: 0.9, dmgMul: 1.0 }), e('Retiarius', 'agi', 11, 'trident3', ['a_galerus', 'l_sandal'], 1, 2, { hpMul: 0.9, dmgMul: 1.0 }), e('Retiarius', 'agi', 11, 'trident3', ['a_galerus', 'l_sandal'], 1, 4, { hpMul: 0.9, dmgMul: 1.0 })] },
      { name: 'Sư tử xứ Numidia', desc: 'Hai con sư tử đực bắt ở chân núi Atlas, bỏ đói hai ngày dưới hầm Colosseum, và ba thợ săn thú lùa chúng về phía anh.',
        hint: 'Sư tử chạy nhanh gấp rưỡi người và vồ từ xa sáu mét: kẻ bị vồ ngã ngửa, choáng và chảy máu. Chúng rình kẻ đứng lẻ và kẻ quay lưng. Đứng thành cụm, khiên quay ra ngoài; giáo đón được con thú đang lao tới; lưới giữ chân nó cho cả đội xúm vào.',
        foes: [e('Sư tử Atlas', 'big', 12, null, [], 0, 1, { beast: 'lion', hpMul: 1.6, dmgMul: 1.0, scale: 1.05 }), e('Sư tử Atlas', 'big', 12, null, [], 0, 3, { beast: 'lion', hpMul: 1.6, dmgMul: 1.0, scale: 1.05 }),
          e('Thợ săn thú', 'bal', 11, 'hasta4', ['b_linen', 'a_manica', 'h_galea'], 1, 2), e('Thợ săn thú', 'bal', 11, 'hasta3', ['b_linen', 'a_manica'], 1, 0), e('Thợ ném lao', 'agi', 11, 'javelin4', ['b_linen', 's_parma'], 2, 4)] },
      { name: 'Voi chiến của vua Juba', desc: 'Một con voi châu Phi mang tháp gỗ, người quản tượng cầm giáo dài, và ba kỵ binh Numidia ném lao phi quanh nó.',
        hint: 'Con voi đi tới đâu là giẫm và hất văng mọi người đứng trước mặt nó. Đừng đứng chắn đường nó: tản ra hai bên, đánh vào sườn và sau lưng. Lao, giáo và chùy là thứ làm nó đau; lưới và đòn choáng làm nó khựng lại. Kỵ binh ném lao sẽ vừa phi vừa ném vào kẻ đứng yên. Cứ mười hai giây con voi xung phong: lao thẳng vào một người, hất ngã mọi kẻ chắn đường; còn hai phần ba và một phần ba máu thì có thêm hai cung thủ chạy ra từ cổng.',
        foes: [e('Voi chiến Surus', 'big', 13, 'hasta4', ['b_squamata', 'h_galea'], 1, 2, { mount: 'elephant', hpMul: 1.15, dmgMul: 1.1, charge: { every: 12, mul: 1.8, path: 1, pathMul: 1.2, stun: 1.4 }, summon: { at: [0.66, 0.33], foes: [e('Cung thủ Numidia', 'agi', 11, 'bow3', ['b_linen'], 2, 2, { hpMul: 0.7, dmgMul: 0.75 }), e('Cung thủ Numidia', 'agi', 11, 'bow3', ['b_linen'], 2, 2, { hpMul: 0.7, dmgMul: 0.75 })] } }),
          e('Kỵ binh Numidia', 'agi', 11, 'javelin3', ['b_linen', 's_parma'], 2, 0, { mount: 'horse', hpMul: 0.72, dmgMul: 0.5 }), e('Kỵ binh Numidia', 'agi', 11, 'javelin3', ['b_linen', 's_parma'], 2, 4, { mount: 'horse', hpMul: 0.72, dmgMul: 0.5 }),
          e('Kỵ binh Numidia', 'agi', 11, 'javelin3', ['b_linen', 's_parma'], 2, 3, { mount: 'horse', hpMul: 0.72, dmgMul: 0.5 })] },
      { name: 'Năm cựu vô địch', desc: 'Năm người từng nhận kiếm gỗ tự do và quay lại vì tiền. Mỗi người một thứ vũ khí, không ai dưới trăm trận.',
        hint: 'Trận khó nhất trước trận cuối. Mỗi tên là bậc thầy của một kiểu đánh — và anh đã gặp từng kiểu đó rồi.',
        foes: [e('Triumphus', 'big', 12, 'gladius4', ['s_tower', 'h_murmillo', 'b_segment', 'a_plate', 'l_ocrea2'], 0, 2, { hpMul: 1.06, dmgMul: 1.17 }), e('Carpophorus', 'bal', 12, 'hasta4', ['s_hoplon', 'h_thraex', 'b_muscle', 'l_ocrea'], 1, 1, { hpMul: 1.06, dmgMul: 1.17 }), e('Hermes', 'agi', 12, 'trident4', ['a_galerus', 'l_sandal', 't_oil'], 1, 3, { hpMul: 1.06, dmgMul: 1.17 }), e('Spiculus', 'agi', 12, 'twin4', ['b_linen', 'a_scale', 'l_sandal'], 0, 4, { hpMul: 1.06, dmgMul: 1.17 }), e('Tetraites', 'big', 12, 'mace4', ['s_hoplon', 'h_legion', 'b_hamata', 'a_scale', 'l_ocrea'], 0, 0, { hpMul: 1.06, dmgMul: 1.17 })] },
      { name: 'Maximus Invictus — Kẻ Bất Bại', boss: 1, final: 1, desc: 'Một trăm mười ba trận. Hoàng đế gọi hắn là con trai của thần Mars. Hôm nay hắn đấu một mình với cả trường của anh, và năm vạn người đặt cược vào hắn.',
        hint: 'Hắn nhanh, có khiên, có giáp, và thuộc mọi bài. Đòn của hắn nặng đến mức khiên chỉ đỡ được một nửa — đừng trông vào tường khiên hay hàng giáo. Khi còn nửa máu hắn sẽ nổi điên: đánh nhanh gấp rưỡi. Ném lao thì hắn lao thẳng tới kẻ ném. Anh cần tất cả: lưới để giữ chân, chùy để phá giáp, người vòng sau lưng, và ai đó đủ lì để đứng trước mặt hắn. Hắn kháng 60% thời gian mọi hiệu ứng bất lợi: lưới, choáng, làm chậm, chảy máu, mất thế đỡ đều chỉ còn 40% thời gian thường. Cứ chín giây hắn xoay tròn lưỡi kiếm lao tới kẻ đứng xa nhất, chém mọi người trong tầm 2,4 m trên đường đi: cung thủ và lính lao không còn an toàn ở phía sau, và đừng đứng chụm. Mỗi nhát kiếm của hắn chém lan sang người đứng cạnh; cứ mười giây hắn gầm thét, mạnh thêm 10% (tối đa năm lần); còn nửa máu thì hoàng đế thả hai cận vệ xuống sân giúp hắn.',
        foes: [e('Maximus Invictus', 'bal', 15, 'gladius4', ['s_hoplon', 'h_thraex', 'b_muscle', 'a_plate', 'l_ocrea2'], 0, 2, { boss: 1, hpMul: 7.7, dmgMul: 2.25, scale: 1.1, spCd: 0.5, enrage: 1, capAdd: 90, moveMul: 1.25, crush: 0.5, cleave: 0.5, ccRes: 0.6, charge: { every: 9, far: 1, mul: 1.6, stun: 0.6, whirl: { r: 2.4, mul: 0.8 } }, howl: { every: 10, dmg: 0.1, max: 5 }, summon: { at: [0.5], foes: [e('Cận vệ hoàng đế', 'bal', 13, 'gladius4', ['s_scutum', 'h_legion', 'b_segment', 'l_ocrea'], 0, 2, { hpMul: 0.8, dmgMul: 1.0 }), e('Cận vệ hoàng đế', 'bal', 13, 'hasta4', ['s_scutum', 'h_legion', 'b_segment', 'l_ocrea'], 0, 2, { hpMul: 0.8, dmgMul: 1.0 })] } })] }
    ]
  ];

  // Trận phụ: tên và mô tả ngẫu nhiên
  G.SIDE_NAMES = [
    ['Trận lót đường', 'Mở màn cho đám đông đang đến chỗ.'],
    ['Món nợ của lái buôn', 'Một lái buôn muốn thử hàng trước khi bán.'],
    ['Đám cưới nhà giàu', 'Chú rể muốn có máu trong tiệc cưới.'],
    ['Tang lễ một ông chủ ruộng', 'Người chết cần được tiễn bằng một trận đấu.'],
    ['Cuộc cá cược của hai lái ngựa', 'Hai gã say cãi nhau xem người của ai giỏi hơn.'],
    ['Ngày phiên chợ', 'Dân quê lên chợ, cần gì đó để xem.'],
    ['Tù nhân của quan tòa', 'Quan tòa cho họ một cơ hội — và một cây gậy.'],
    ['Trường đối thủ thách đấu', 'Một lanista hạng xoàng muốn nổi danh nhờ anh.']
  ];
  G.FOE_NAMES = ['Tù binh', 'Nô lệ nổi loạn', 'Đấu sĩ hạng xoàng', 'Kẻ cướp đường', 'Lính đào ngũ', 'Thợ săn', 'Phu thuyền', 'Kẻ mắc nợ'];

})(typeof window !== 'undefined' ? (window.G = window.G || {}) : (globalThis.G = globalThis.G || {}));

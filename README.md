# LANISTA — Cát & Máu

Game quản lý trường đấu sĩ La Mã kết hợp auto-battler, chạy trong trình duyệt máy tính, chơi bằng chuột.
Toàn bộ hình ảnh, chuyển động, giao diện và âm thanh được sinh bằng mã lúc chạy — không có tệp mô hình, ảnh, âm thanh, phông chữ hay hoạt ảnh nào.

**Chơi trực tuyến:** <https://tj35ma.github.io/lanista/> (máy tính, có chuột; cửa sổ từ 1100×650 trở lên).

## Chạy game

Cách 1 — mở thẳng: bấm đúp `index.html` (Chrome / Edge / Firefox bản mới). Game là trang tĩnh, dùng script thường nên chạy được từ `file://`.

Cách 2 — qua máy chủ tĩnh bất kỳ:

```bash
python -m http.server 8765
```

rồi mở <http://localhost:8765/>.

Cửa sổ nên rộng từ 1100×650 trở lên. Mỗi lần mở link (hoặc mở tệp) là một ván mới: không ai thấy nút "Tiếp tục" của ván người khác. Ván đang chơi tự lưu vào `sessionStorage` của riêng tab đó (khóa `lanista_save_v1`), nên lỡ tải lại trang (F5) vẫn chơi tiếp được; đóng tab hoặc mở lại link là bắt đầu lại từ đầu, và trình duyệt sẽ hỏi lại trước khi rời trang lúc đang chơi dở.

## Cách chơi (tóm tắt)

- Mỗi ngày: ghé **Chợ nô lệ** mua người, **Lò rèn** mua vũ khí/giáp/vật của lanista, vào **Phòng chờ** trang bị và xếp đội hình trên lưới 3×5, chọn trận (trận chính hoặc hai trận phụ), bấm **Ra đấu trường**.
- Trận đấu tự diễn ra; nút duy nhất là **Xin thua**. Sau trận có bảng "Vì sao" giải thích kết quả.
- Mỗi ngày tối đa một trận; **Qua ngày** trả phí nuôi, chữa thương, đổi hàng ở chợ.
- Bốn hạng đấu trường (Chợ → Làng → Thành phố → Colosseum), mỗi hạng 7 trận chính, trận thứ 7 là một nhà vô địch đấu một mình với cả đội.
- Trận phụ đấu lại bao nhiêu lần cũng được, nhưng khán giả chán dần: mỗi trận phụ kể từ lần thắng trận chính gần nhất làm túi thưởng vơi 5% (thấp nhất còn một nửa).
- **Chuỗi thắng:** thắng liền nhau (trận chính hay trận phụ đều tính) thì từ trận thắng thứ hai, mỗi trận thắng trước đó cộng thêm 20% túi thưởng: thắng liền 2 trận +20%, 3 trận +40%… tối đa +100%. Thua một trận (kể cả xin thua) là mất cả chuỗi; nghỉ ngày không mất. Chuỗi đang có hiện cạnh nút **Ra đấu trường**. Túi thưởng (`Game.PURSE_MUL` trong `js/core/game.js`) gấp đôi mức gốc của hạng; thua chỉ nhận tiền xuất trận bằng 7,5% túi thưởng.
- Người bị thương tạm thời có thể chữa ngay bằng nút **Gọi thầy thuốc** trong Phòng chờ, nếu anh chịu trả tiền.
- Ở Chợ nô lệ, bên trái mỗi người trên bục luôn có một cột sáu chỉ số kèm icon: Sức mạnh, Nhanh nhẹn, Thể chất, Máu, Tốc chạy, Tốc đánh — rê chuột lên từng dòng để xem chỉ số đó làm gì.
- Ở Chợ nô lệ và Lò rèn, nút mua nằm ngay dưới chân từng nô lệ và dưới từng món hàng trong cảnh 3D (danh sách bên trái vẫn dùng được).
- Trong Phòng chờ, bấm vào một đấu sĩ để mở **bảng trang bị**: kho đồ là lưới icon, kéo một món thả vào người (hoặc vào ô của nó) để mang, kéo từ ô ra kho để tháo; trong lúc kéo, bảng hiện luôn chỉ số sẽ đổi ra sao. Bấm một lần vào icon cũng mang/tháo được.
- **Sức mang** = 2 + Sức mạnh × 2,5 + Thể chất × 2 (cộng trừ theo thể hình, thẻ, thắt lưng). Giáp nặng (lưới, vảy, tấm, mũ kín, khiên lớn) cho nhiều giáp nhưng rất nặng: chỉ người khỏe và dai sức mới gánh nổi cả bộ. Giáp nhẹ (da, lanh, mũ hở, giày nhẹ, khiên nhỏ) cho ít giáp hơn nhưng nhẹ hẳn, hợp với người nhanh nhẹn. Không mặc được món làm tổng cân nặng vượt sức mang; càng gần giới hạn, người càng chậm cả tay lẫn chân.
- Mọi món giáp (mũ, thân, tay, chân) nặng gấp đôi con số ghi trong bảng `S()` của `js/core/data.js` (hệ số `ARMOR_WT`), nên phải chọn mặc giáp ở chỗ nào chứ không mặc kín được cả người.
- Ba vũ khí tầm xa: **lao** (nặng, ném chậm, sát thương to nhất, xuyên 40% giáp, một tay nên vẫn cầm được khiên), **cung** (nhẹ nhất, bắn nhanh nhất, xa nhất, sát thương thấp và không xuyên giáp), **nỏ** (nhẹ, bắn tốc độ trung bình, xuyên 50% giáp). Người cầm vũ khí tầm xa luôn lùi để giữ kẻ địch gần nhất ở ngoài khoảng 60% tầm bắn; bị dồn sát rào thì hết đường lùi và phải đánh giáp lá cà (rất yếu).
- Trong Phòng chờ, trên đầu mỗi người của anh có một hàng icon: lá cờ tinh thần (vàng = hăng hái, đỏ = bình thường, xám rủ = chán nản, gãy = sắp bỏ trốn), ngôi sao thiên phú, các nét tốt (viền xanh) và xấu (viền đỏ), và từng chấn thương (viền đỏ = đang lành, viền tím = vĩnh viễn). Rê chuột lên từng icon để đọc.
- Xếp đội hình bằng kéo thả: nắm một người (ngay trên sân, trên băng ghế, hoặc tên trong danh sách bên trái) rồi thả vào ô muốn đứng; thả lên ô đang có người thì hai người đổi chỗ (hoặc người mới vào thay); thả ra băng ghế hoặc lên danh sách để rút về. Ô sẽ đỏ lên nếu sân đã đủ người.
- Khi một đấu sĩ lên cấp, bảng chọn thẻ hiện chính mô hình của người đó (đúng đồ đang mang) bên trái và ba thẻ bên phải; mỗi thẻ có icon riêng, cũng là mô hình low-poly dựng bằng mã như icon trang bị.
- Mỗi món đồ có một trong năm độ hiếm: Thường, Tốt, Hiếm, Sử thi, Huyền thoại. Càng hiếm thì mô hình càng nhiều chi tiết (dây quấn, đá quý, nạm vàng, lông mũ, áo choàng), chỉ số gốc càng cao, có thêm 1–3 phụ tố chỉ số; đồ Sử thi và Huyền thoại có thêm một hiệu ứng đặc biệt. Đấu trường càng cao thì đồ hiếm càng hay xuất hiện.
- Mỗi ô giáp có một vai trò riêng, ngoài điểm giáp của vùng nó che: **giáp thân** cộng % máu; **mũ** cộng kháng hiệu ứng (choáng, lưới, chậm, chảy máu ngắn lại theo đúng số % đó); **giáp tay / găng** cộng tốc độ đánh; **giày / giáp chân** cộng tốc độ di chuyển. Đồ từ bậc Tốt trở lên luôn có một phụ tố đúng vai trò của ô (Chắc thịt, Vững trí, Khéo tay, Nhẹ chân), và hiệu ứng đặc biệt của mũ, găng, giày cũng theo vai trò ấy (ví dụ Tỉnh đòn, Dồn dập, Xuất phát). Đồ nặng vẫn làm chậm cả tay lẫn chân, nên giáp chân sắt chỉ đủ bù trọng lượng của chính nó, còn giày nhẹ mới thật sự nhanh.
- Giá giáp tính từ chính chỉ số của món đồ (`S()` trong `js/core/data.js`): điểm = giáp × hệ số ô + các chỉ số phụ − trọng lượng, giá = điểm × vàng-mỗi-điểm của hạng (5 / 6,5 / 8,5 / 11). Trong cùng một hạng, món đắt gấp đôi thì cho gấp đôi chỉ số.
- Ở Lò rèn có hai cái bàn: bàn sát tường bày 5 món giáp (mũ, giáp thân, giáp tay, giáp chân, khiên) trên giá gỗ; bàn phía trước phủ vải chàm bày 5 vũ khí nằm dọc, cán quay ra ngoài — rê chuột lên thì món đó nhấc mũi lên cho dễ nhìn. Món phụ kiện nằm trên chiếc bàn tròn nhỏ bên phải, vật của lanista trên bệ đá bên trái. Cạnh mỗi món luôn có hai ô chỉ số kèm icon: giáp (hoặc tỉ lệ chặn với khiên) và cân nặng cho đồ giáp; sát thương và cân nặng cho vũ khí — đã tính cả độ hiếm và phụ tố của món đó. Nút **Đổi lượt hàng** (5 vàng, bấm bao nhiêu lần cũng được) dọn hết hàng đang bày và bày lượt mới.
- Thanh **Bán đồ trong kho** ở đáy màn hình Lò rèn bày mọi món chưa mặc kèm giá bán (nửa giá): bấm một món là bán ngay; đồ Sử thi và Huyền thoại sẽ hỏi lại; bán nhầm thì bấm **Lấy lại** (trong cùng ngày, khi chưa rời Lò rèn). Đồ đang mặc trên người phải tháo ở Phòng chờ trước.
- Mọi chi tiết (chỉ số, nét tính cách, mô tả vũ khí…) hiện khi rê chuột lên tên, lên icon hoặc lên nhân vật trong cảnh 3D.

## Cấu trúc mã

| Thư mục | Nội dung |
|---|---|
| `js/core/` | Luật chơi thuần logic, chạy được không cần đồ họa: `data.js` (nội dung), `rules.js` (chỉ số), `sim.js` (mô phỏng trận), `game.js` (chiến dịch, lưu game) |
| `js/view/` | Đồ họa three.js: `builder.js`, `gear.js` (trang bị), `figure.js` (thân người, IK, bước chân), `icons.js` / `cardicons.js` (icon trang bị, chân dung, icon thẻ lên cấp), `anim.js` (thế thủ, đòn đánh), `fx.js`, `scenes.js` (bốn không gian), `spaces.js`, `battleview.js` |
| `js/ui/`, `css/` | Giao diện DOM |
| `js/audio.js` | Âm thanh tổng hợp bằng Web Audio |
| `lib/three.min.js` | three.js r160 (MIT) đóng gói thành một tệp mã, không kèm tài nguyên |
| `tools/` | Công cụ dòng lệnh Node: bot tự chơi hết chiến dịch, đo cân bằng |

## Đồ họa

Tất cả dựng bằng mã lúc chạy: thân người là các vỏ đa giác phẳng mặt nối từ những vòng cắt ngang (eo, ngực, bắp tay chân, hàm, gò má); tay chân đặt bằng IK, bàn chân cắm trong không gian thế giới nên không trượt; mỗi họ vũ khí có thế thủ và đòn riêng ngắm vào đúng đối thủ. Hậu kỳ gồm khử răng cưa, bloom nhẹ, tone-map ACES, chỉnh màu ấm, tối góc và hạt phim (tự tắt nếu máy không hỗ trợ bộ đệm HDR). Trong trận có vệt sáng theo mũi vũ khí, dấu chân trên cát, máu loang, bụi, vũ khí rơi khỏi tay kẻ gục và máy quay tự lấy khung.

## Công cụ đo cân bằng (không cần đồ họa)

```bash
node tools/bot.js 40 1
```

chạy 40 chiến dịch bằng bot tự chơi và in số ngày, số lần thử mỗi trận chính, số người chết, thời lượng trận.

```bash
node tools/weapons.js
```

in ma trận thắng–thua giữa các họ vũ khí.

```bash
node tools/bosses.js
```

in tỉ lệ thắng của tám kiểu đội hình mẫu trước từng trùm.

```bash
node tools/gearcheck.js
```

in "trang bị đáng giá bao nhiêu": người đủ đồ đấu người tay không, người chỉ có vũ khí, v.v.

Công cụ soi chuyển động (chỉ dùng khi phát triển): `node tools/serve.js` phục vụ game ở cổng 8765 và nhận ảnh chụp canvas; trong console trình duyệt nạp `tools/dbg.js` để dựng một trận tay đôi bất kỳ, dừng hình và xuất "tấm ảnh nhiều khung" của một đòn đánh.

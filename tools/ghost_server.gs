/**
 * LANISTA — kho đội hình chung (Google Apps Script, gắn với một Google Sheet).
 *
 * Cài đặt:
 *   1. Tạo một Google Sheet mới (tên tuỳ ý, ví dụ "LANISTA - kho đội hình").
 *   2. Menu Extensions → Apps Script. Xoá hết code mẫu, dán toàn bộ file này vào, bấm Save.
 *   3. Deploy → New deployment → chọn loại "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Bấm Deploy, cấp quyền khi được hỏi, rồi chép "Web app URL" (kết thúc bằng /exec).
 *   4. Gửi URL đó cho Claude để gắn vào game (G.Ghosts.url trong js/core/game.js).
 *
 * Sửa code về sau: Deploy → Manage deployments → bút chì → Version: New version → Deploy (URL giữ nguyên).
 *
 * Dữ liệu: mỗi dòng của trang "teams" là một đội hình.
 *   A thời điểm | B khoá (ván:đấu trường:chặng) | C đấu trường | D chặng | E ngày | F sức mạnh | G số người | H JSON đội hình
 * Mỗi ván chỉ giữ đội mới nhất cho mỗi chặng. Quá MAX_ROWS dòng thì xoá các dòng cũ nhất.
 */
var SHEET = 'teams', MAX_ROWS = 4000, MAX_BYTES = 24000, MAX_TEAM = 6;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(['time', 'key', 'tier', 'stage', 'day', 'power', 'n', 'json']); sh.setFrozenRows(1); }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** GET ?n=200  → { ok, teams: [...] } : một mẫu ngẫu nhiên tối đa n đội (mặc định 200, tối đa 400). */
function doGet(e) {
  var n = Math.max(1, Math.min(400, parseInt((e && e.parameter && e.parameter.n) || '200', 10) || 200));
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, teams: [] });
  var rows = sh.getRange(2, 8, last - 1, 1).getValues(), idx = [], i;
  for (i = 0; i < rows.length; i++) idx.push(i);
  for (i = idx.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  var out = [];
  for (i = 0; i < idx.length && out.length < n; i++) { try { out.push(JSON.parse(rows[idx[i]][0])); } catch (err) { } }
  return json_({ ok: true, teams: out });
}

/** POST (thân là JSON của một đội hình) → ghi hoặc thay dòng cùng khoá. */
function doPost(e) {
  var body = e && e.postData && e.postData.contents;
  if (!body || body.length > MAX_BYTES) return json_({ ok: false, err: 'size' });
  var s; try { s = JSON.parse(body); } catch (err) { return json_({ ok: false, err: 'json' }); }
  if (!s || s.v !== 1 || !s.team || !s.team.length || s.team.length > MAX_TEAM) return json_({ ok: false, err: 'shape' });
  var num = function (x, lo, hi) { x = Number(x); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo; };
  var run = Math.floor(num(s.run, 0, 2147483647)), tier = Math.floor(num(s.tier, 0, 9)), stage = Math.floor(num(s.stage, 0, 9));
  var key = run + ':' + tier + ':' + stage;
  var row = [new Date(), key, tier, stage, Math.floor(num(s.day, 1, 9999)), num(s.pw, 0, 100000), s.team.length, JSON.stringify(s)];
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (err) { return json_({ ok: false, err: 'busy' }); }
  try {
    var sh = sheet_(), last = sh.getLastRow(), at = -1;
    if (last >= 2) {
      var hit = sh.getRange(2, 2, last - 1, 1).createTextFinder(key).matchEntireCell(true).findNext();
      if (hit) at = hit.getRow();
    }
    if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]);
    else {
      sh.appendRow(row);
      var extra = sh.getLastRow() - 1 - MAX_ROWS;
      if (extra > 0) sh.deleteRows(2, extra);
    }
  } finally { lock.releaseLock(); }
  return json_({ ok: true });
}

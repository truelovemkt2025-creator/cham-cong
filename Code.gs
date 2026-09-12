/*****************************************************************
 * CHẤM CÔNG TRUE LOVE — BACKEND (Google Apps Script)
 * Gắn với Google Sheet "CHẤM CÔNG TEST"
 * Công ty CP Love Journey · bản pilot v0 · 12/09/2026
 *
 * CÀI ĐẶT:
 *  1. Dán toàn bộ file này vào Apps Script của Sheet
 *  2. Chạy hàm caiDatLanDau() một lần (cấp quyền khi được hỏi)
 *  3. Triển khai > Ứng dụng web
 *     - Chạy với tư cách: Tôi
 *     - Ai có quyền truy cập: Bất kỳ ai
 *  4. Copy URL /exec dán vào index.html
 *
 * QUYỀN: script CHỈ xin quyền với đúng file Sheet này (@OnlyCurrentDoc).
 * Không đụng tới Drive, không đọc file khác, không gửi mail.
 *****************************************************************/

/**
 * @OnlyCurrentDoc
 */

var SHEET_NHANSU   = 'NHANSU';
var SHEET_CHAMCONG = 'CHAMCONG';
var SHEET_CAUHINH  = 'CAUHINH';
var SHEET_ANH      = 'ANH';
var TZ             = 'Asia/Ho_Chi_Minh';

var COT_NHANSU   = ['MaNV','HoTen','Ca','PIN_TAM','PIN_HASH','Email','TrangThai','DeviceId','GhiChu'];
var COT_CHAMCONG = ['Ngay','Thu','MaNV','HoTen','Loai','Gio','Ca','PhutTre','PhutVeSom','ViPham',
                    'LanThu','TienQuy','KhoangCach_m','DoChinhXac_m','ToaDo','AnhURL','DeviceId','GhiChu'];
var COT_CAUHINH  = ['Khoa','GiaTri','MoTa'];

var CAUHINH_MAC_DINH = [
  ['office_lat',        '10.762622', 'Vĩ độ văn phòng (lấy từ Google Maps)'],
  ['office_lng',        '106.660172','Kinh độ văn phòng'],
  ['ban_kinh_m',        '150',       'Bán kính quanh văn phòng (mét). Ngoài vùng chỉ gắn cờ, không chặn'],
  ['gps_sai_so_toi_da', '200',       'GPS sai số lớn hơn mức này thì gắn cờ'],
  ['nguong_tre_phut',   '10',        'Trễ/về sớm từ bao nhiêu phút thì tính vi phạm (nội quy: 10)'],
  ['muc_quy_lan_1_3',   '10000',     'Nộp quỹ lần 1-3 trong tháng'],
  ['muc_quy_tu_lan_4',  '50000',     'Nộp quỹ từ lần thứ 4 trong tháng'],
  ['nguong_bu_phut',    '30',        'Quá mốc này thì ngoài nộp quỹ còn phải làm bù đúng số phút đó'],
  ['ca_sang_vao',       '09:00',     'Giờ vào ca sáng'],
  ['ca_sang_ra',        '18:00',     'Giờ ra ca sáng'],
  ['ca_chieu_vao',      '12:00',     'Giờ vào ca chiều'],
  ['ca_chieu_ra',       '21:00',     'Giờ ra ca chiều'],
  ['muoi_bam_pin',      '',          'Tự sinh khi cài đặt lần đầu — KHÔNG sửa, sửa là mọi PIN hỏng']
];

/*================= MENU TRONG SHEET =================*/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⏰ Chấm công')
    .addItem('1. Cài đặt lần đầu', 'caiDatLanDau')
    .addItem('2. Thêm nhân viên mẫu', 'themNhanVienMau')
    .addItem('3. Xem link ứng dụng web', 'xemLinkWebApp')
    .addSeparator()
    .addItem('Kiểm tra cấu hình', 'kiemTraCauHinh')
    .addToUi();
}

/*================= CÀI ĐẶT =================*/
function caiDatLanDau() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  taoSheet_(ss, SHEET_NHANSU, COT_NHANSU);
  taoSheet_(ss, SHEET_CHAMCONG, COT_CHAMCONG);

  var shCH = taoSheet_(ss, SHEET_CAUHINH, COT_CAUHINH);
  if (shCH.getLastRow() < 2) {
    shCH.getRange(2, 1, CAUHINH_MAC_DINH.length, 3).setValues(CAUHINH_MAC_DINH);
  }
  taoSheet_(ss, SHEET_ANH, ['Ngay_Gio', 'MaNV', 'Loai', 'Anh (ảnh nằm ngay bên phải)']);

  // sinh muối bằm PIN nếu chưa có
  if (!docCauHinh_()['muoi_bam_pin']) {
    ghiCauHinh_('muoi_bam_pin', Utilities.getUuid().replace(/-/g, ''));
  }
  // xoá sheet mặc định trống nếu còn
  var sh1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (sh1 && ss.getSheets().length > 4 && sh1.getLastRow() === 0) ss.deleteSheet(sh1);

  SpreadsheetApp.getUi().alert(
    'Xong!\n\n' +
    '· Đã tạo 4 tab: NHANSU, CHAMCONG, CAUHINH, ANH\n' +
    '· Ảnh chấm công lưu ngay trong tab ANH (script không xin quyền Drive)\n\n' +
    'Bước tiếp: mở tab CAUHINH điền toạ độ văn phòng, rồi thêm nhân viên vào tab NHANSU.'
  );
}

function themNhanVienMau() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh) { SpreadsheetApp.getUi().alert('Chạy "Cài đặt lần đầu" trước đã.'); return; }
  sh.appendRow(['TEST01', 'Nhân viên thử 1', 'sang',  '1234', '', '', 'DANG_LAM', '', 'Nhân viên chạy thử']);
  sh.appendRow(['TEST02', 'Nhân viên thử 2', 'chieu', '1234', '', '', 'DANG_LAM', '', 'Nhân viên chạy thử']);
  sh.appendRow(['TEST03', 'Nhân viên thử 3', 'auto',  '1234', '', '', 'DANG_LAM', '', 'Ca auto: app tự nhận theo giờ chấm']);
  SpreadsheetApp.getUi().alert(
    'Đã thêm 3 nhân viên thử, PIN đều là 1234.\n\n' +
    'Sửa lại tên/mã/ca tuỳ ý. Cột PIN_TAM gõ PIN mới thì app tự mã hoá rồi xoá đi ở lần đăng nhập kế tiếp.'
  );
}

function xemLinkWebApp() {
  SpreadsheetApp.getUi().alert(
    'Lấy link ứng dụng web:\n\n' +
    'Tiện ích mở rộng > Apps Script > nút Triển khai (Deploy) >\n' +
    'Quản lý các bản triển khai — link kết thúc bằng /exec.\n\n' +
    'Dán link đó vào dòng API_URL trong file index.html.'
  );
}

function kiemTraCauHinh() {
  var c = docCauHinh_();
  var thieu = [];
  if (!c.muoi_bam_pin)    thieu.push('muoi_bam_pin (chạy Cài đặt lần đầu)');
  if (!c.office_lat || !c.office_lng) thieu.push('toạ độ văn phòng');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  var soNV = sh ? Math.max(0, sh.getLastRow() - 1) : 0;

  SpreadsheetApp.getUi().alert(
    'CẤU HÌNH HIỆN TẠI\n\n' +
    'Văn phòng: ' + c.office_lat + ', ' + c.office_lng + ' · bán kính ' + c.ban_kinh_m + 'm\n' +
    'Ca sáng: ' + c.ca_sang_vao + '–' + c.ca_sang_ra + ' · Ca chiều: ' + c.ca_chieu_vao + '–' + c.ca_chieu_ra + '\n' +
    'Ngưỡng trễ: ' + c.nguong_tre_phut + ' phút · Quỹ: ' + c.muc_quy_lan_1_3 + 'đ (lần 1-3), ' + c.muc_quy_tu_lan_4 + 'đ (từ lần 4)\n' +
    'Số nhân viên: ' + soNV + '\n\n' +
    (thieu.length ? ('⚠️ CÒN THIẾU:\n· ' + thieu.join('\n· ')) : '✅ Đủ điều kiện chạy.')
  );
}

function taoSheet_(ss, ten, cot) {
  var sh = ss.getSheetByName(ten);
  if (!sh) sh = ss.insertSheet(ten);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cot.length).setValues([cot])
      .setFontWeight('bold').setBackground('#49469D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

/*================= CẤU HÌNH =================*/
function docCauHinh_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CAUHINH);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (v[i][0]) out[String(v[i][0]).trim()] = String(v[i][1]).trim();
  }
  return out;
}

function ghiCauHinh_(khoa, giaTri) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CAUHINH);
  var v = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === khoa) { sh.getRange(i + 2, 2).setValue(giaTri); return; }
  }
  sh.appendRow([khoa, giaTri, '']);
}

/*================= TIỆN ÍCH =================*/
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function phutTuChuoi_(hhmm) {
  var p = String(hhmm || '').split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

function hhmm_(phut) {
  var h = Math.floor(phut / 60), m = phut % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

function bamPin_(pin, muoi) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, muoi + String(pin), Utilities.Charset.UTF_8);
  var s = '';
  for (var i = 0; i < raw.length; i++) s += ('0' + (raw[i] & 0xFF).toString(16)).slice(-2);
  return s;
}

function khoangCachMet_(lat1, lng1, lat2, lng2) {
  var R = 6371000, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

function tenThu_(d) {
  return ['CN','T2','T3','T4','T5','T6','T7'][Number(Utilities.formatDate(d, TZ, 'u')) % 7];
}

function timNhanVien_(maNV) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_NHANSU.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toUpperCase() === String(maNV).trim().toUpperCase()) {
      return {
        dong: i + 2, maNV: String(v[i][0]).trim(), hoTen: String(v[i][1]).trim(),
        ca: String(v[i][2]).trim().toLowerCase() || 'auto',
        pinTam: String(v[i][3]).trim(), pinHash: String(v[i][4]).trim(),
        email: String(v[i][5]).trim(), trangThai: String(v[i][6]).trim() || 'DANG_LAM',
        deviceId: String(v[i][7]).trim(), sheet: sh
      };
    }
  }
  return null;
}

function xacDinhCa_(caNhanSu, phutVao, c) {
  if (caNhanSu === 'sang' || caNhanSu === 'chieu') return caNhanSu;
  var s = phutTuChuoi_(c.ca_sang_vao), ch = phutTuChuoi_(c.ca_chieu_vao);
  return Math.abs(phutVao - s) <= Math.abs(phutVao - ch) ? 'sang' : 'chieu';
}

function docChamCongHomNay_(maNV, ngay) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
  var ra = {vao: null, ra: null};
  if (!sh || sh.getLastRow() < 2) return ra;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_CHAMCONG.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === ngay && String(v[i][2]).toUpperCase() === maNV.toUpperCase()) {
      var ban = {gio: String(v[i][5]), ca: String(v[i][6]), tre: v[i][7], som: v[i][8], quy: v[i][11]};
      if (String(v[i][4]) === 'VAO') ra.vao = ban; else if (String(v[i][4]) === 'RA') ra.ra = ban;
    }
  }
  return ra;
}

function demViPhamThang_(maNV, thangNam) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
  var n = 0, tien = 0;
  if (!sh || sh.getLastRow() < 2) return {soLan: 0, tongQuy: 0};
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_CHAMCONG.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).indexOf(thangNam) === 0 &&
        String(v[i][2]).toUpperCase() === maNV.toUpperCase() &&
        String(v[i][9]) === 'CO') {
      n++; tien += Number(v[i][11]) || 0;
    }
  }
  return {soLan: n, tongQuy: tien};
}

/** Lưu ảnh NGAY TRONG SHEET (tab ANH) — không dùng Drive nên không cần quyền Drive */
function luuAnh_(dataUrl, tenFile, thongTin) {
  if (!dataUrl || dataUrl.indexOf('base64,') < 0) return '';
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_ANH);
    if (!sh) sh = taoSheet_(ss, SHEET_ANH, ['Ngay_Gio', 'MaNV', 'Loai', 'Anh (ảnh nằm ngay bên phải)']);
    var b64 = dataUrl.split('base64,')[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', tenFile + '.jpg');
    var dong = sh.getLastRow() + 1;
    sh.getRange(dong, 1, 1, 3).setValues([[thongTin.gio, thongTin.maNV, thongTin.loai]]);
    sh.setRowHeight(dong, 150);
    sh.insertImage(blob, 4, dong);
    return SHEET_ANH + '!A' + dong;
  } catch (err) {
    return 'LOI_ANH: ' + err;
  }
}

/*================= PHIÊN ĐĂNG NHẬP =================*/
function taoToken_(maNV) {
  var tok = Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + tok, maNV, 21600); // 6 giờ
  return tok;
}

function maNVTuToken_(token) {
  if (!token) return null;
  return CacheService.getScriptCache().get('tok_' + String(token));
}

/*================= ĐIỂM VÀO =================*/
function doGet(e) {
  var act = (e && e.parameter && e.parameter.action) || 'ping';
  if (act === 'ping') return json_(ping_());
  return json_({ok: false, loi: 'Dùng POST cho thao tác này.'});
}

function doPost(e) {
  var kq;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    switch (req.action) {
      case 'ping':      kq = ping_(); break;
      case 'login':     kq = login_(req); break;
      case 'trangthai': kq = trangThai_(req); break;
      case 'cham':      kq = cham_(req); break;
      default:          kq = {ok: false, loi: 'Không rõ action: ' + req.action};
    }
  } catch (err) {
    kq = {ok: false, loi: 'Lỗi máy chủ: ' + err};
  }
  return json_(kq);
}

function ping_() {
  var now = new Date(), c = docCauHinh_();
  return {
    ok: true,
    gioMayChu: Utilities.formatDate(now, TZ, 'HH:mm:ss'),
    ngay: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    moc: now.getTime(),
    caSang: c.ca_sang_vao + '–' + c.ca_sang_ra,
    caChieu: c.ca_chieu_vao + '–' + c.ca_chieu_ra,
    sanSang: !!c.muoi_bam_pin
  };
}

function login_(req) {
  var maNV = String(req.maNV || '').trim();
  var pin  = String(req.pin || '').trim();
  if (!maNV || !pin) return {ok: false, loi: 'Thiếu mã nhân viên hoặc PIN.'};

  var cache = CacheService.getScriptCache();
  var khoaSai = 'sai_' + maNV.toUpperCase();
  var soSai = Number(cache.get(khoaSai) || 0);
  if (soSai >= 5) return {ok: false, ma: 'khoa_tam', loi: 'Sai PIN 5 lần. Thử lại sau 15 phút hoặc nhắn quản lý.'};

  var nv = timNhanVien_(maNV);
  if (!nv) return {ok: false, loi: 'Không tìm thấy mã nhân viên ' + maNV + '.'};
  if (nv.trangThai && nv.trangThai !== 'DANG_LAM') return {ok: false, loi: 'Tài khoản đang khoá. Nhắn quản lý nhé.'};

  var c = docCauHinh_();
  if (!c.muoi_bam_pin) return {ok: false, loi: 'Chưa chạy "Cài đặt lần đầu" trong Sheet.'};

  // PIN mới gõ tay trong cột PIN_TAM -> mã hoá rồi xoá
  if (nv.pinTam) {
    nv.sheet.getRange(nv.dong, 5).setValue(bamPin_(nv.pinTam, c.muoi_bam_pin));
    nv.sheet.getRange(nv.dong, 4).clearContent();
    nv.pinHash = bamPin_(nv.pinTam, c.muoi_bam_pin);
  }
  if (!nv.pinHash) return {ok: false, loi: 'Nhân viên chưa có PIN. Quản lý điền PIN vào cột PIN_TAM.'};

  if (bamPin_(pin, c.muoi_bam_pin) !== nv.pinHash) {
    cache.put(khoaSai, String(soSai + 1), 900);
    return {ok: false, loi: 'Sai PIN. Còn ' + (4 - soSai) + ' lần thử.'};
  }
  cache.remove(khoaSai);

  // ghi nhận máy đang dùng
  if (req.deviceId && nv.deviceId !== req.deviceId) {
    nv.sheet.getRange(nv.dong, 8).setValue(req.deviceId);
  }

  return {
    ok: true,
    token: taoToken_(nv.maNV),
    maNV: nv.maNV, hoTen: nv.hoTen, ca: nv.ca,
    trangThai: trangThaiCuaNV_(nv)
  };
}

function trangThai_(req) {
  var maNV = maNVTuToken_(req.token);
  if (!maNV) return {ok: false, ma: 'het_phien', loi: 'Phiên đã hết hạn, mời đăng nhập lại.'};
  var nv = timNhanVien_(maNV);
  if (!nv) return {ok: false, loi: 'Không tìm thấy nhân viên.'};
  return {ok: true, maNV: nv.maNV, hoTen: nv.hoTen, ca: nv.ca, trangThai: trangThaiCuaNV_(nv)};
}

function trangThaiCuaNV_(nv) {
  var now = new Date(), c = docCauHinh_();
  var ngay = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var homNay = docChamCongHomNay_(nv.maNV, ngay);
  var thang = demViPhamThang_(nv.maNV, Utilities.formatDate(now, TZ, 'yyyy-MM'));
  var ca = xacDinhCa_(nv.ca, phutTuChuoi_(Utilities.formatDate(now, TZ, 'HH:mm')), c);
  return {
    ngay: ngay,
    gioMayChu: Utilities.formatDate(now, TZ, 'HH:mm:ss'),
    daVao: homNay.vao ? homNay.vao.gio : '',
    daRa:  homNay.ra  ? homNay.ra.gio  : '',
    caDuDoan: ca,
    caVao: ca === 'sang' ? c.ca_sang_vao : c.ca_chieu_vao,
    caRa:  ca === 'sang' ? c.ca_sang_ra  : c.ca_chieu_ra,
    soLanTreThang: thang.soLan,
    tongQuyThang: thang.tongQuy
  };
}

/*================= CHẤM CÔNG =================*/
function cham_(req) {
  var maNV = maNVTuToken_(req.token);
  if (!maNV) return {ok: false, ma: 'het_phien', loi: 'Phiên đã hết hạn, mời đăng nhập lại.'};

  var nv = timNhanVien_(maNV);
  if (!nv) return {ok: false, loi: 'Không tìm thấy nhân viên.'};

  var loai = String(req.loai || '').toUpperCase();
  if (loai !== 'VAO' && loai !== 'RA') return {ok: false, loi: 'Loại chấm không hợp lệ.'};
  if (!req.anh) return {ok: false, loi: 'Thiếu ảnh chấm công. Phải chụp trực tiếp trong app.'};

  var c    = docCauHinh_();
  var now  = new Date();                                   // GIỜ MÁY CHỦ — không tin giờ điện thoại
  var ngay = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var gio  = Utilities.formatDate(now, TZ, 'HH:mm:ss');
  var phutHienTai = phutTuChuoi_(Utilities.formatDate(now, TZ, 'HH:mm'));

  var homNay = docChamCongHomNay_(nv.maNV, ngay);
  if (loai === 'VAO' && homNay.vao) return {ok: false, ma: 'da_cham', loi: 'Hôm nay bạn đã chấm vào lúc ' + homNay.vao.gio + ' rồi.'};
  if (loai === 'RA'  && homNay.ra)  return {ok: false, ma: 'da_cham', loi: 'Hôm nay bạn đã chấm ra lúc ' + homNay.ra.gio + ' rồi.'};

  // xác định ca: chấm ra thì theo ca của lượt vào trong ngày
  var ca = (loai === 'RA' && homNay.vao && homNay.vao.ca)
           ? homNay.vao.ca
           : xacDinhCa_(nv.ca, phutHienTai, c);
  var mocVao = phutTuChuoi_(ca === 'sang' ? c.ca_sang_vao : c.ca_chieu_vao);
  var mocRa  = phutTuChuoi_(ca === 'sang' ? c.ca_sang_ra  : c.ca_chieu_ra);

  var nguong   = Number(c.nguong_tre_phut) || 10;
  var nguongBu = Number(c.nguong_bu_phut) || 30;
  var phutTre = 0, phutSom = 0;
  if (loai === 'VAO') phutTre = Math.max(0, phutHienTai - mocVao);
  else                phutSom = Math.max(0, mocRa - phutHienTai);
  var lech = loai === 'VAO' ? phutTre : phutSom;

  // vị trí
  var khoangCach = '', ngoaiVung = false, toaDo = '';
  var sai = Number(req.acc) || 0;
  if (req.lat && req.lng && c.office_lat && c.office_lng) {
    toaDo = Number(req.lat).toFixed(6) + ', ' + Number(req.lng).toFixed(6);
    khoangCach = khoangCachMet_(Number(c.office_lat), Number(c.office_lng), Number(req.lat), Number(req.lng));
    ngoaiVung = khoangCach > (Number(c.ban_kinh_m) || 150) || sai > (Number(c.gps_sai_so_toi_da) || 200);
  } else {
    ngoaiVung = true;
  }

  // vi phạm + quỹ luỹ tiến
  var viPham = lech >= nguong;
  var lanThu = '', tienQuy = 0, ghiChu = [];
  if (viPham) {
    var thang = demViPhamThang_(nv.maNV, Utilities.formatDate(now, TZ, 'yyyy-MM'));
    lanThu  = thang.soLan + 1;
    tienQuy = lanThu <= 3 ? (Number(c.muc_quy_lan_1_3) || 10000) : (Number(c.muc_quy_tu_lan_4) || 50000);
    if (lanThu === 3) ghiChu.push('Lần thứ 3 trong tháng: trưởng bộ phận nhắc nhở trực tiếp.');
    if (lanThu >= 7) ghiChu.push('Quá 6 lần trong tháng: báo sếp xem xét kỷ luật.');
    if (lech > nguongBu) ghiChu.push('Quá ' + nguongBu + ' phút: phải làm bù ' + lech + ' phút, đăng ký ngày bù với trưởng bộ phận.');
  }
  if (ngoaiVung) ghiChu.push('Ngoài vùng văn phòng hoặc GPS sai số lớn — chờ quản lý xác nhận.');
  if (loai === 'RA' && !homNay.vao) ghiChu.push('Chấm ra mà không có lượt chấm vào — cần trưởng bộ phận xác nhận.');

  // lưu ảnh rồi mới khoá ghi (giữ khoá càng ngắn càng tốt)
  var anhUrl = luuAnh_(req.anh,
    ngay + '_' + nv.maNV + '_' + loai + '_' + Utilities.formatDate(now, TZ, 'HHmmss'),
    {gio: ngay + ' ' + gio, maNV: nv.maNV, loai: loai});

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
    sh.appendRow([
      ngay, tenThu_(now), nv.maNV, nv.hoTen, loai, gio, ca,
      phutTre || '', phutSom || '', viPham ? 'CO' : '',
      lanThu, tienQuy || '', khoangCach, sai || '', toaDo, anhUrl,
      req.deviceId || '', ghiChu.join(' · ')
    ]);
    SpreadsheetApp.flush();
  } catch (err) {
    return {ok: false, loi: 'Máy chủ đang bận, bấm gửi lại giúp em: ' + err};
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  return {
    ok: true, loai: loai, gio: Utilities.formatDate(now, TZ, 'HH:mm'), giayPhut: gio,
    ca: ca, mocCa: hhmm_(loai === 'VAO' ? mocVao : mocRa),
    lech: lech, viPham: viPham, lanThu: lanThu, tienQuy: tienQuy,
    nguong: nguong, khoangCach: khoangCach, ngoaiVung: ngoaiVung,
    ghiChu: ghiChu, trangThai: trangThaiCuaNV_(nv)
  };
}

/*****************************************************************
 * CHẤM CÔNG TRUE LOVE — BACKEND (Google Apps Script)
 * Gắn với Google Sheet "CHẤM CÔNG TEST"
 * Công ty CP Love Journey · bản pilot v0 · 12/09/2026
 *
 * CÀI ĐẶT:
 *  1. Dán toàn bộ file này vào Apps Script của Sheet
 *  2. Bật hiện file appsscript.json (⚙️ Cài đặt dự án > tick "Hiện tệp kê khai")
 *     rồi dán đúng nội dung mẫu ở cuối file này vào appsscript.json
 *  3. Chạy hàm caiDatLanDau() một lần (cấp quyền khi được hỏi)
 *  4. Triển khai > Ứng dụng web
 *     - Chạy với tư cách: Tôi
 *     - Ai có quyền truy cập: Bất kỳ ai
 *  5. Copy URL /exec dán vào index.html
 *
 * QUYỀN: script xin quyền với đúng file Sheet này (@OnlyCurrentDoc), quyền
 * "drive.file" — CHỈ đụng tới những file DO CHÍNH APP NÀY TẠO RA (thư mục
 * ảnh chấm công), không đọc/sửa được bất kỳ file nào khác trong Drive của
 * sếp; và quyền "script.scriptapp" để tự đặt hẹn giờ dọn ảnh cũ hằng ngày.
 * Đây đều là quyền hẹp, khác hẳn quyền "toàn bộ Drive" đã gây lỗi
 * access_denied ở bản trước.
 *
 * ẢNH CHẤM CÔNG TỰ ĐỘNG XOÁ SAU 45 NGÀY (đổi số ngày ở tab CAUHINH,
 * khoá "giu_anh_ngay") — bật bằng menu "5. Bật tự động dọn ảnh mỗi ngày".
 *
 * NỢ GIỜ LÀM BÙ (16/09): tính theo TỔNG GIỜ LÀM CẢ NGÀY (chấm vào → chấm ra,
 * trừ giờ nghỉ giữa ca) so với 8 tiếng chuẩn — không cộng riêng "trễ vào" +
 * "sớm ra" như bản đầu. Ai vào trễ nhưng chủ động ở lại bù ngay trong ngày
 * thì không bị ghi nợ; ai làm không đủ giờ thì nợ cộng dồn theo tháng
 * (tab CHAMCONG cột ChenhLechPhut, âm = thiếu). Ca linh hoạt ngày này qua
 * ngày khác — cứ để cột Ca trong NHANSU là "auto", app tự nhận diện.
 *****************************************************************/

/**
 * @OnlyCurrentDoc
 */

var SHEET_NHANSU     = 'NHANSU';
var SHEET_CHAMCONG   = 'CHAMCONG';
var SHEET_CAUHINH    = 'CAUHINH';
var SHEET_DONXINPHEP = 'DONXINPHEP';
var TEN_THU_MUC      = 'CHAM CONG - ANH';
var TZ               = 'Asia/Ho_Chi_Minh';

var COT_NHANSU   = ['MaNV','HoTen','Ca','PIN_TAM','PIN_HASH','Email','TrangThai','DeviceId','GhiChu'];
var COT_CHAMCONG = ['Ngay','Thu','MaNV','HoTen','Loai','Gio','Ca','PhutTre','PhutVeSom','ViPham',
                    'LanThu','TienQuy','KhoangCach_m','DoChinhXac_m','ToaDo','AnhURL','DeviceId','GhiChu',
                    'ChenhLechPhut'];
var COT_CAUHINH  = ['Khoa','GiaTri','MoTa'];
// MaDon(1) NgayGui(2) GioGui(3) MaNV(4) HoTen(5) LoaiDon(6) NgayApDung(7) NgayApDungKetThuc(8)
// ChiTiet(9) LyDo(10) TrangThai(11) NguoiDuyet(12) ThoiGianDuyet(13)
var COT_DONXINPHEP = ['MaDon','NgayGui','GioGui','MaNV','HoTen','LoaiDon','NgayApDung','NgayApDungKetThuc',
                      'ChiTiet','LyDo','TrangThai','NguoiDuyet','ThoiGianDuyet'];

var CAUHINH_MAC_DINH = [
  ['office_lat',        '10.762622', 'Vĩ độ văn phòng (lấy từ Google Maps)'],
  ['office_lng',        '106.660172','Kinh độ văn phòng'],
  ['ban_kinh_m',        '150',       'Bán kính quanh văn phòng (mét). Ngoài vùng chỉ gắn cờ, không chặn'],
  ['gps_sai_so_toi_da', '200',       'GPS sai số lớn hơn mức này thì gắn cờ'],
  ['nguong_tre_phut',   '10',        'Trễ/về sớm từ bao nhiêu phút thì tính vi phạm, nộp quỹ (nội quy: 10)'],
  ['muc_quy_lan_1_3',   '10000',     'Nộp quỹ lần 1-3 trong tháng'],
  ['muc_quy_tu_lan_4',  '50000',     'Nộp quỹ từ lần thứ 4 trong tháng'],
  ['ca_sang_vao',       '09:00',     'Giờ vào ca sáng'],
  ['ca_sang_ra',        '18:00',     'Giờ ra ca sáng'],
  ['ca_sang_nghi_vao',  '12:00',     'Giờ bắt đầu nghỉ trưa ca sáng'],
  ['ca_sang_nghi_ra',   '13:00',     'Giờ hết nghỉ trưa ca sáng'],
  ['ca_chieu_vao',      '12:00',     'Giờ vào ca chiều'],
  ['ca_chieu_ra',       '21:00',     'Giờ ra ca chiều'],
  ['ca_chieu_nghi_vao', '17:00',     'Giờ bắt đầu nghỉ giữa ca chiều'],
  ['ca_chieu_nghi_ra',  '18:00',     'Giờ hết nghỉ giữa ca chiều'],
  ['giu_anh_ngay',      '45',        'Ảnh chấm công cũ hơn số ngày này bị tự động xoá khỏi Drive (đã chốt lương xong)'],
  ['link_app',          'https://truelovemkt2025-creator.github.io/cham-cong/', 'Link app chấm công, dùng trong email nhắc chưa chấm công'],
  ['email_truong_bo_phan', 'ngocdtb@lovejourney.vn', 'Email nhận đơn xin nghỉ/đi trễ/làm bù để duyệt (hiện dùng chung 1 người cho nhóm Telecell — mở rộng công ty sau cần tách theo từng phòng ban)'],
  ['thu_muc_anh_id',    '',          'Tự điền khi cài đặt lần đầu — id thư mục Drive lưu ảnh'],
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
    .addItem('4. Dọn ảnh cũ ngay (thử tay)', 'donDepAnhCuThuCong')
    .addItem('5. Bật tự động dọn ảnh mỗi ngày', 'batTuDongDonAnh')
    .addSeparator()
    .addItem('6. Gửi nhắc chưa chấm công ngay (thử tay)', 'guiNhacThuCong')
    .addItem('7. Bật tự động nhắc chưa chấm công mỗi ngày', 'batTuDongNhacChuaChamCong')
    .addSeparator()
    .addItem('Kiểm tra cấu hình', 'kiemTraCauHinh')
    .addToUi();
}

/*================= CÀI ĐẶT =================*/
function caiDatLanDau() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  taoSheet_(ss, SHEET_NHANSU, COT_NHANSU);
  var shCC = taoSheet_(ss, SHEET_CHAMCONG, COT_CHAMCONG);
  // Ép cột Ngày (A) và Giờ (F) về dạng chữ, nếu không Sheets đổi sang kiểu ngày/giờ
  // làm việc đếm vi phạm trong tháng và kiểm tra "hôm nay đã chấm chưa" bị sai.
  shCC.getRange('A:A').setNumberFormat('@');
  shCC.getRange('F:F').setNumberFormat('@');
  // Nếu Sheet CHAMCONG có từ bản cũ (thiếu cột ChenhLechPhut mới thêm) thì bổ sung
  // đúng ô tiêu đề còn thiếu ở cuối, không đụng gì tới dữ liệu các dòng đã có.
  if (shCC.getLastColumn() < COT_CHAMCONG.length) {
    shCC.getRange(1, COT_CHAMCONG.length).setValue(COT_CHAMCONG[COT_CHAMCONG.length - 1])
      .setFontWeight('bold').setBackground('#49469D').setFontColor('#FFFFFF');
  }

  // Tab đơn xin nghỉ/đi trễ/làm bù — ép cột ngày (G,H) về dạng chữ như cột Ngay của CHAMCONG
  var shDon = taoSheet_(ss, SHEET_DONXINPHEP, COT_DONXINPHEP);
  shDon.getRange('G:H').setNumberFormat('@');

  var shCH = taoSheet_(ss, SHEET_CAUHINH, COT_CAUHINH);
  // Ép cột GiaTri về dạng chữ để Sheets KHÔNG đổi "09:00" thành kiểu giờ
  shCH.getRange('B:B').setNumberFormat('@');
  if (shCH.getLastRow() < 2) {
    shCH.getRange(2, 1, CAUHINH_MAC_DINH.length, 3).setValues(CAUHINH_MAC_DINH);
  }
  // Thêm các khoá cấu hình còn thiếu (khi cập nhật code có thêm cấu hình mới),
  // không đụng tới các khoá đã có sẵn giá trị.
  var hienCo = docCauHinh_();
  CAUHINH_MAC_DINH.forEach(function (row) {
    if (!(row[0] in hienCo)) shCH.appendRow(row);
  });

  // sinh muối bằm PIN nếu chưa có
  if (!docCauHinh_()['muoi_bam_pin']) {
    ghiCauHinh_('muoi_bam_pin', Utilities.getUuid().replace(/-/g, ''));
  }
  // tạo thư mục Drive riêng để lưu ảnh (chỉ app này tạo/đụng tới, nhờ quyền drive.file)
  if (!docCauHinh_()['thu_muc_anh_id']) {
    ghiCauHinh_('thu_muc_anh_id', taoThuMucAnh_());
  }
  // xoá sheet ANH cũ (ảnh nhét thẳng trong Sheet) nếu còn từ bản trước — nặng file, không dùng nữa
  var shAnhCu = ss.getSheetByName('ANH');
  if (shAnhCu) ss.deleteSheet(shAnhCu);
  // xoá sheet mặc định trống nếu còn
  var sh1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (sh1 && ss.getSheets().length > 3 && sh1.getLastRow() === 0) ss.deleteSheet(sh1);

  SpreadsheetApp.getUi().alert(
    'Xong!\n\n' +
    '· Đã tạo 3 tab: NHANSU, CHAMCONG, CAUHINH\n' +
    '· Đã tạo thư mục Drive "' + TEN_THU_MUC + '" (riêng tư, chỉ app này đụng tới) để lưu ảnh —\n' +
    '  Sheet chỉ giữ đường link nên không bị nặng dù chấm công nhiều tháng.\n\n' +
    'Bước tiếp:\n' +
    '1. Mở tab CAUHINH điền toạ độ văn phòng, rồi thêm nhân viên vào tab NHANSU.\n' +
    '2. Vào menu bấm "5. Bật tự động dọn ảnh mỗi ngày" để ảnh chấm công cũ hơn 45 ngày tự xoá sau khi lương tháng đã chốt.'
  );
}

/*================= DỌN ẢNH CŨ =================*/
/**
 * Xoá khỏi Drive những ảnh chấm công cũ hơn số ngày cấu hình ở "giu_anh_ngay"
 * (mặc định 45 ngày — đủ thời gian để chốt lương tháng trước khi ảnh bị xoá).
 * Không đụng gì tới dữ liệu trong Sheet, chỉ xoá file ảnh trong Drive để đỡ tốn dung lượng.
 */
function donDepAnhCu_() {
  var c = docCauHinh_();
  if (!c.thu_muc_anh_id) return {soLuong: 0, dungLuong: 0};
  var soNgay = so_(c.giu_anh_ngay, 45);
  var moc = new Date(Date.now() - soNgay * 24 * 60 * 60 * 1000);
  var soLuong = 0, dungLuong = 0;
  var pageToken = null;
  do {
    var kq = Drive.Files.list({
      q: "'" + c.thu_muc_anh_id + "' in parents and trashed = false",
      fields: 'nextPageToken, files(id, size, createdTime)',
      pageSize: 200,
      pageToken: pageToken || undefined
    });
    (kq.files || []).forEach(function (f) {
      if (new Date(f.createdTime) < moc) {
        dungLuong += Number(f.size) || 0;
        Drive.Files.update({ trashed: true }, f.id);
        soLuong++;
      }
    });
    pageToken = kq.nextPageToken;
  } while (pageToken);
  return {soLuong: soLuong, dungLuong: dungLuong};
}

function donDepAnhCuThuCong() {
  var c = docCauHinh_();
  if (!c.thu_muc_anh_id) { SpreadsheetApp.getUi().alert('Chạy "Cài đặt lần đầu" trước đã.'); return; }
  var kq = donDepAnhCu_();
  SpreadsheetApp.getUi().alert(
    'Đã dọn xong.\n\n' +
    '· Xoá ' + kq.soLuong + ' ảnh cũ hơn ' + (c.giu_anh_ngay || 45) + ' ngày\n' +
    '· Giải phóng khoảng ' + (Math.round(kq.dungLuong / 1024 / 1024 * 10) / 10) + ' MB'
  );
}

/** Hàm này được trigger hằng ngày gọi — chạy nền, không hiện thông báo */
function chayTuDongDonDep() {
  try { donDepAnhCu_(); } catch (err) { /* im lặng, tránh trigger bị Google tự tắt vì lỗi liên tục */ }
}

function batTuDongDonAnh() {
  var trig = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trig.length; i++) {
    if (trig[i].getHandlerFunction() === 'chayTuDongDonDep') ScriptApp.deleteTrigger(trig[i]);
  }
  ScriptApp.newTrigger('chayTuDongDonDep').timeBased().everyDays(1).atHour(2).create();
  SpreadsheetApp.getUi().alert(
    'Đã bật tự động dọn ảnh.\n\n' +
    'Mỗi ngày lúc 2 giờ sáng, app tự xoá ảnh chấm công cũ hơn ' + (docCauHinh_().giu_anh_ngay || 45) + ' ngày trong Drive.\n\n' +
    'Muốn đổi số ngày giữ ảnh thì sửa dòng "giu_anh_ngay" trong tab CAUHINH (không cần bật lại).'
  );
}

/*================= NHẮC CHƯA CHẤM CÔNG =================*/
/**
 * Mỗi ngày (trừ Chủ nhật) lúc 13h, quét toàn bộ nhân viên đang làm (TrangThai=DANG_LAM,
 * có Email), ai CHƯA có dòng "VAO" trong CHAMCONG của NGÀY HÔM NAY thì gửi email nhắc
 * THẲNG cho người đó (không gửi cho sếp). Vì ca linh hoạt nên hệ thống không biết trước
 * hôm nay ai nghỉ — người đang nghỉ phép/nghỉ đột xuất cứ bỏ qua email này, không cần
 * làm gì thêm, không phải báo lại.
 */
function guiNhacChuaChamCong_() {
  var homNay = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (tenThu_(new Date()) === 'CN') return { daGui: 0, boQua: 'Chủ nhật' };

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh || sh.getLastRow() < 2) return { daGui: 0 };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_NHANSU.length).getValues();
  var link = docCauHinh_().link_app || 'https://truelovemkt2025-creator.github.io/cham-cong/';
  var daGui = 0;

  for (var i = 0; i < v.length; i++) {
    var maNV = String(v[i][0]).trim();
    var hoTen = String(v[i][1]).trim();
    var email = String(v[i][5]).trim();
    var trangThai = String(v[i][6]).trim() || 'DANG_LAM';
    if (!maNV || trangThai !== 'DANG_LAM' || !email) continue;
    if (docChamCongHomNay_(maNV, homNay).vao) continue; // đã chấm vào rồi, bỏ qua
    if (timDonDaDuyet_(maNV, homNay, 'NGHI_PHEP')) continue; // đã có đơn nghỉ phép được duyệt hôm nay, khỏi nhắc

    try {
      MailApp.sendEmail({
        to: email,
        subject: '⏰ Nhắc chấm công hôm nay — True Love',
        body:
          'Chào ' + hoTen + ',\n\n' +
          'Hệ thống chưa ghi nhận bạn chấm công VÀO hôm nay (' + homNay + ').\n\n' +
          'Nếu đang trong ca làm, bạn chấm công tại đây:\n' + link + '\n\n' +
          'Nếu hôm nay bạn nghỉ (phép/đột xuất) thì bỏ qua email này, không cần trả lời.\n\n' +
          '— App Chấm Công True Love (email tự động, không trả lời email này)'
      });
      daGui++;
    } catch (err) { /* 1 người gửi lỗi (vd email sai định dạng) không chặn các người còn lại */ }
  }
  return { daGui: daGui };
}

/** Hàm này được trigger hằng ngày gọi — chạy nền, không hiện thông báo */
function chayTuDongNhacChuaChamCong() {
  try { guiNhacChuaChamCong_(); } catch (err) { /* im lặng, tránh trigger bị Google tự tắt vì lỗi liên tục */ }
}

function batTuDongNhacChuaChamCong() {
  var trig = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trig.length; i++) {
    if (trig[i].getHandlerFunction() === 'chayTuDongNhacChuaChamCong') ScriptApp.deleteTrigger(trig[i]);
  }
  ScriptApp.newTrigger('chayTuDongNhacChuaChamCong').timeBased().everyDays(1).atHour(13).create();
  SpreadsheetApp.getUi().alert(
    'Đã bật nhắc chấm công tự động.\n\n' +
    'Mỗi ngày lúc 13h (trừ Chủ nhật), ai chưa chấm VÀO hôm đó sẽ nhận email nhắc thẳng cho mình.\n' +
    'Chỉ gửi được cho người đã có Email trong tab NHANSU — ai chưa có email thì chưa nhắc được, sếp bổ sung dần.'
  );
}

function guiNhacThuCong() {
  var kq = guiNhacChuaChamCong_();
  SpreadsheetApp.getUi().alert(
    kq.boQua ? ('Hôm nay là ' + kq.boQua + ', không gửi nhắc hôm nay.') :
    ('Đã gửi email nhắc cho ' + kq.daGui + ' người chưa chấm công hôm nay.')
  );
}

/*================= ĐƠN XIN NGHỈ / ĐI TRỄ / LÀM BÙ GIỜ =================*/
/**
 * 3 loại đơn (chọn ở app điện thoại, gửi trưởng bộ phận duyệt qua email — bấm nút
 * Duyệt/Từ chối ngay trong email, không cần đăng nhập):
 *  - NGHI_PHEP: xin nghỉ (cả ngày / nửa ngày sáng / nửa ngày chiều), có thể nhiều ngày liền.
 *    Duyệt trước → app tự động KHÔNG gửi email nhắc "chưa chấm công" cho (các) ngày đó.
 *  - DI_TRE: xin đi trễ 1 ngày cụ thể, kèm giờ dự kiến vào.
 *    Duyệt TRƯỚC khi chấm công → hôm đó dù trễ vẫn KHÔNG tính vi phạm/nộp quỹ (nợ giờ làm bù
 *    vẫn tính bình thường theo giờ làm thực tế, vì đó là nợ giờ chứ không phải kỷ luật).
 *  - LAM_BU: báo trước sẽ làm bù giờ vào ngày nào — chỉ mang tính thông báo/ghi nhận cho
 *    trưởng bộ phận nắm, không tự trừ nợ giờ (nợ giờ đã tự tính theo giờ làm thực tế sẵn).
 */
var LOAI_DON_TEXT = { NGHI_PHEP: 'Xin nghỉ phép', DI_TRE: 'Xin đi trễ', LAM_BU: 'Xin làm bù giờ' };
function tenLoaiDon_(loaiDon) { return LOAI_DON_TEXT[loaiDon] || loaiDon; }

function guiDon_(req) {
  var maNV = maNVTuToken_(req.token);
  if (!maNV) return {ok: false, ma: 'het_phien', loi: 'Phiên đã hết hạn, mời đăng nhập lại.'};
  var nv = timNhanVien_(maNV);
  if (!nv) return {ok: false, loi: 'Không tìm thấy nhân viên.'};

  var loaiDon = String(req.loaiDon || '').toUpperCase();
  if (!LOAI_DON_TEXT[loaiDon]) return {ok: false, loi: 'Loại đơn không hợp lệ.'};
  var ngayApDung = ngayChuoi_(req.ngayApDung || '');
  if (!ngayApDung) return {ok: false, loi: 'Chọn ngày áp dụng giúp em.'};
  var ngayKetThuc = req.ngayApDungKetThuc ? ngayChuoi_(req.ngayApDungKetThuc) : ngayApDung;
  var chiTiet = String(req.chiTiet || '').trim();
  var lyDo = String(req.lyDo || '').trim();
  if (!lyDo) return {ok: false, loi: 'Nhập lý do giúp em.'};

  var c = docCauHinh_();
  var maDon = Utilities.getUuid();
  var now = new Date();

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DONXINPHEP);
    sh.appendRow([
      maDon, Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), Utilities.formatDate(now, TZ, 'HH:mm:ss'),
      nv.maNV, nv.hoTen, loaiDon, ngayApDung, ngayKetThuc, chiTiet, lyDo, 'CHO_DUYET', '', ''
    ]);
    SpreadsheetApp.flush();
  } catch (err) {
    return {ok: false, loi: 'Máy chủ đang bận, thử gửi lại giúp em: ' + err};
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  if (c.email_truong_bo_phan) {
    try { guiEmailDuyetDon_(maDon, nv, loaiDon, ngayApDung, ngayKetThuc, chiTiet, lyDo, c.email_truong_bo_phan); }
    catch (err) { /* gửi mail lỗi không chặn việc lưu đơn — sếp vẫn thấy đơn trong Sheet */ }
  }

  return {ok: true, maDon: maDon};
}

function guiEmailDuyetDon_(maDon, nv, loaiDon, ngayApDung, ngayKetThuc, chiTiet, lyDo, emailDuyet) {
  var baseUrl = ScriptApp.getService().getUrl();
  var linkDuyet   = baseUrl + '?action=duyet&maDon=' + encodeURIComponent(maDon) + '&ketQua=duyet';
  var linkTuChoi  = baseUrl + '?action=duyet&maDon=' + encodeURIComponent(maDon) + '&ketQua=tuchoi';
  var ngayDong = ngayApDung === ngayKetThuc ? ngayApDung : (ngayApDung + ' → ' + ngayKetThuc);

  var chiTietDong;
  if (loaiDon === 'DI_TRE') chiTietDong = 'Giờ dự kiến vào: <b>' + (chiTiet || '—') + '</b>';
  else if (loaiDon === 'LAM_BU') chiTietDong = 'Dự kiến làm bù: <b>' + (chiTiet || '—') + '</b>';
  else chiTietDong = 'Loại nghỉ: <b>' + ({ca_ngay:'Cả ngày', nua_ngay_sang:'Nửa ngày sáng', nua_ngay_chieu:'Nửa ngày chiều'}[chiTiet] || chiTiet || 'Cả ngày') + '</b>';

  var html =
    '<div style="font-family:Arial,sans-serif;max-width:480px">' +
    '<h2 style="margin:0 0 12px">' + tenLoaiDon_(loaiDon) + '</h2>' +
    '<p><b>' + nv.hoTen + '</b> (' + nv.maNV + ') gửi đơn:</p>' +
    '<p>Ngày áp dụng: <b>' + ngayDong + '</b><br>' + chiTietDong + '<br>Lý do: ' + lyDo + '</p>' +
    '<table cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:12px"><a href="' + linkDuyet + '" style="display:inline-block;padding:12px 22px;background:#177A4B;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Duyệt</a></td>' +
    '<td><a href="' + linkTuChoi + '" style="display:inline-block;padding:12px 22px;background:#B42F2C;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Từ chối</a></td>' +
    '</tr></table>' +
    '<p style="color:#888;font-size:12px;margin-top:16px">Bấm 1 trong 2 nút trên điện thoại/máy tính là xong, không cần đăng nhập gì thêm.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: emailDuyet,
    subject: tenLoaiDon_(loaiDon) + ' — ' + nv.hoTen + ' (' + ngayDong + ')',
    htmlBody: html,
    body: tenLoaiDon_(loaiDon) + ' - ' + nv.hoTen + ' - ngày ' + ngayDong + ' - Lý do: ' + lyDo + '. Mở email bằng ứng dụng hỗ trợ HTML để bấm nút Duyệt/Từ chối.'
  });
}

/** Trưởng bộ phận bấm nút trong email → gọi vào đây qua doGet (GET, không cần đăng nhập) */
function xuLyDuyetDon_(maDon, ketQua) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DONXINPHEP);
  if (!sh || sh.getLastRow() < 2) return {ok: false, loi: 'Không tìm thấy đơn.'};
  var lock = LockService.getScriptLock();
  var ketQuaTra = null;
  try {
    lock.waitLock(15000);
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_DONXINPHEP.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) === maDon) {
        var trangThaiHienTai = String(v[i][10]);
        if (trangThaiHienTai !== 'CHO_DUYET') {
          ketQuaTra = {ok: false, daXuLy: true, trangThai: trangThaiHienTai, loaiDon: String(v[i][5]), hoTen: String(v[i][4])};
          break;
        }
        var trangThaiMoi = ketQua === 'duyet' ? 'DA_DUYET' : 'TU_CHOI';
        sh.getRange(i + 2, 11).setValue(trangThaiMoi);
        sh.getRange(i + 2, 12).setValue('Trưởng bộ phận');
        sh.getRange(i + 2, 13).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'));
        // ngayChuoi_() vì cột NgayApDung có thể đã bị Sheets tự đổi sang kiểu Date dù đã ép '@' —
        // String() thẳng ra sẽ hiện dạng "Thu Sep 17 2026 00:00:00 GMT+0700" rất khó đọc.
        ketQuaTra = {ok: true, trangThai: trangThaiMoi, loaiDon: String(v[i][5]), hoTen: String(v[i][4]), ngayApDung: ngayChuoi_(v[i][6])};
        break;
      }
    }
    SpreadsheetApp.flush();
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
  return ketQuaTra || {ok: false, loi: 'Không tìm thấy đơn này — có thể link đã cũ.'};
}

/** Trang HTML nhỏ hiện ra khi bấm nút Duyệt/Từ chối trong email */
function trangDuyetDon_(maDon, ketQua) {
  var tieuDe, mauSac, noiDung;
  if (!maDon || (ketQua !== 'duyet' && ketQua !== 'tuchoi')) {
    tieuDe = 'Đường dẫn không hợp lệ'; mauSac = '#B42F2C'; noiDung = 'Link bị thiếu thông tin, thử mở lại từ email.';
  } else {
    var kq = xuLyDuyetDon_(maDon, ketQua);
    if (kq.daXuLy) {
      tieuDe = 'Đơn này đã được xử lý trước đó'; mauSac = '#8E650A';
      noiDung = tenLoaiDon_(kq.loaiDon) + ' của ' + kq.hoTen + ' — trạng thái hiện tại: ' +
        (kq.trangThai === 'DA_DUYET' ? 'Đã duyệt' : 'Đã từ chối') + '.';
    } else if (!kq.ok) {
      tieuDe = 'Không tìm thấy đơn'; mauSac = '#B42F2C'; noiDung = kq.loi;
    } else {
      var xong = kq.trangThai === 'DA_DUYET';
      tieuDe = xong ? 'Đã duyệt' : 'Đã từ chối';
      mauSac = xong ? '#177A4B' : '#B42F2C';
      noiDung = tenLoaiDon_(kq.loaiDon) + ' của <b>' + kq.hoTen + '</b> ngày ' + kq.ngayApDung + ' — ' + (xong ? 'đã duyệt.' : 'đã từ chối.');
    }
  }
  var html = '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + tieuDe + '</title></head>' +
    '<body style="font-family:Arial,sans-serif;background:#F4F3F8;margin:0;padding:40px 20px;text-align:center">' +
    '<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 22px;box-shadow:0 2px 10px rgba(0,0,0,.06)">' +
    '<h2 style="color:' + mauSac + ';margin:0 0 12px">' + tieuDe + '</h2>' +
    '<p style="color:#333;line-height:1.6">' + noiDung + '</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(tieuDe);
}

/** Đơn NGHI_PHEP hoặc DI_TRE đã DA_DUYET áp dụng cho đúng ngày này (nếu có) */
function timDonDaDuyet_(maNV, ngay, loaiDon) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DONXINPHEP);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_DONXINPHEP.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][3]).toUpperCase() === maNV.toUpperCase() &&
        String(v[i][5]) === loaiDon &&
        String(v[i][10]) === 'DA_DUYET' &&
        ngayChuoi_(v[i][6]) <= ngay && ngay <= ngayChuoi_(v[i][7])) {
      return {chiTiet: v[i][8], lyDo: v[i][9]};
    }
  }
  return null;
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
  if (!c.thu_muc_anh_id)  thieu.push('thu_muc_anh_id (chạy Cài đặt lần đầu)');
  if (!c.office_lat || !c.office_lng) thieu.push('toạ độ văn phòng');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  var soNV = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  var coTrigger = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'chayTuDongDonDep'; });
  var coTriggerNhac = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'chayTuDongNhacChuaChamCong'; });
  var shDon = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DONXINPHEP);
  var soDonChoDuyet = 0;
  if (shDon && shDon.getLastRow() >= 2) {
    var vDon = shDon.getRange(2, 11, shDon.getLastRow() - 1, 1).getValues();
    vDon.forEach(function(r){ if (String(r[0]) === 'CHO_DUYET') soDonChoDuyet++; });
  }

  SpreadsheetApp.getUi().alert(
    'CẤU HÌNH HIỆN TẠI\n\n' +
    'Văn phòng: ' + c.office_lat + ', ' + c.office_lng + ' · bán kính ' + c.ban_kinh_m + 'm\n' +
    'Ca sáng: ' + c.ca_sang_vao + '–' + c.ca_sang_ra + ' · Ca chiều: ' + c.ca_chieu_vao + '–' + c.ca_chieu_ra + '\n' +
    'Ngưỡng trễ: ' + c.nguong_tre_phut + ' phút · Quỹ: ' + c.muc_quy_lan_1_3 + 'đ (lần 1-3), ' + c.muc_quy_tu_lan_4 + 'đ (từ lần 4)\n' +
    'Giữ ảnh: ' + (c.giu_anh_ngay || 45) + ' ngày · Tự động dọn ảnh: ' + (coTrigger ? '✅ ĐÃ BẬT' : '⚠️ CHƯA BẬT') + '\n' +
    'Tự động nhắc chưa chấm công (13h, trừ CN): ' + (coTriggerNhac ? '✅ ĐÃ BẬT' : '⚠️ CHƯA BẬT') + '\n' +
    'Email duyệt đơn: ' + (c.email_truong_bo_phan || '(chưa điền)') + ' · Đơn chờ duyệt: ' + soDonChoDuyet + '\n' +
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
/**
 * Đọc cấu hình bằng getDisplayValues() — lấy đúng chữ hiện trong ô.
 * Quan trọng: nếu dùng getValues(), ô giờ "09:00" bị Sheets trả về dạng
 * Date (Sat Dec 30 1899 09:00:00) làm mọi phép tính giờ sai.
 */
function docCauHinh_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CAUHINH);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues();
  for (var i = 0; i < v.length; i++) {
    if (v[i][0]) out[String(v[i][0]).trim()] = String(v[i][1]).trim();
  }
  return out;
}

/** Đổi giá trị cấu hình sang số, bỏ dấu phẩy/khoảng trắng nếu ô bị format */
function so_(v, macDinh) {
  var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? macDinh : n;
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

/** Đọc "09:00", "9:00", "9:00:00 PM", "21:00" -> số phút trong ngày */
function phutTuChuoi_(hhmm) {
  var s = String(hhmm === undefined || hhmm === null ? '' : hhmm).trim();
  var m = s.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!m) return 0;
  var h = parseInt(m[1], 10) || 0, p = parseInt(m[2], 10) || 0;
  if (/pm|ch\b/i.test(s) && h < 12) h += 12;   // 9:00 PM -> 21:00
  if (/am|sa\b/i.test(s) && h === 12) h = 0;   // 12:00 AM -> 00:00
  return h * 60 + p;
}

function hhmm_(phut) {
  var h = Math.floor(phut / 60), m = phut % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

/** Đổi số phút thành chữ "X giờ Y phút" dễ đọc */
function dur_(phut) {
  phut = Math.round(phut);
  var h = Math.floor(phut / 60), m = phut % 60;
  if (h && m) return h + ' giờ ' + m + ' phút';
  if (h) return h + ' giờ';
  return m + ' phút';
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

/**
 * Đưa ô Ngày về chuỗi yyyy-MM-dd dù Sheets lưu dạng chữ hay dạng ngày tháng.
 * Thiếu hàm này thì đếm vi phạm trong tháng luôn ra 0 và không biết hôm nay đã chấm chưa.
 */
function ngayChuoi_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v === undefined || v === null ? '' : v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);   // 12/09/2026
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}

/** Đưa ô Giờ về chuỗi HH:mm dù Sheets lưu dạng chữ hay dạng giờ */
function gioChuoi_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  return hhmm_(phutTuChuoi_(v));
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
    if (ngayChuoi_(v[i][0]) === ngay && String(v[i][2]).toUpperCase() === maNV.toUpperCase()) {
      var ban = {gio: gioChuoi_(v[i][5]), ca: String(v[i][6]), tre: v[i][7], som: v[i][8], quy: v[i][11]};
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
    if (ngayChuoi_(v[i][0]).indexOf(thangNam) === 0 &&
        String(v[i][2]).toUpperCase() === maNV.toUpperCase() &&
        String(v[i][9]) === 'CO') {
      n++; tien += Number(v[i][11]) || 0;
    }
  }
  return {soLan: n, tongQuy: tien};
}

/**
 * Giờ làm thực tế trong ngày (vào→ra, trừ giờ nghỉ giữa ca NẾU khoảng làm việc
 * bao trọn giờ nghỉ đó), trả về CHÊNH LỆCH so với 8 tiếng chuẩn (480 phút):
 * âm = làm THIẾU (nợ giờ, cần làm bù), dương = làm DƯ (trả bớt nợ), 0 = vừa đủ.
 * Nhờ tính theo tổng giờ cả ngày thay vì cộng riêng "trễ vào" + "sớm ra", ai
 * vào trễ nhưng chủ động ở lại bù ngay trong ngày thì không bị ghi nợ nữa.
 */
function tinhChenhLechGio_(vaoPhut, raPhut, ca, c) {
  var nghiVao = phutTuChuoi_(ca === 'sang' ? c.ca_sang_nghi_vao : c.ca_chieu_nghi_vao);
  var nghiRa  = phutTuChuoi_(ca === 'sang' ? c.ca_sang_nghi_ra  : c.ca_chieu_nghi_ra);
  var phutNghi = (vaoPhut <= nghiVao && raPhut >= nghiRa) ? Math.max(0, nghiRa - nghiVao) : 0;
  var gioLamThucTe = Math.max(0, raPhut - vaoPhut) - phutNghi;
  return gioLamThucTe - 480;
}

/** Tổng chênh lệch giờ (phút) cộng dồn trong tháng, từ các lượt CHẤM RA */
function tongChenhLechThang_(maNV, thangNam) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
  if (!sh || sh.getLastRow() < 2) return 0;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, COT_CHAMCONG.length).getValues();
  var tong = 0;
  for (var i = 0; i < v.length; i++) {
    if (ngayChuoi_(v[i][0]).indexOf(thangNam) === 0 &&
        String(v[i][2]).toUpperCase() === maNV.toUpperCase() &&
        String(v[i][4]) === 'RA') {
      tong += Number(v[i][18]) || 0;
    }
  }
  return tong;
}

/**
 * Lưu ảnh vào thư mục Drive riêng của app, qua Drive API v3 (Drive.Files...)
 * — KHÔNG dùng DriveApp, vì DriveApp đòi quyền "toàn bộ Drive" ngay cả khi
 * đã khai quyền hẹp drive.file trong appsscript.json. Gọi qua Drive API v3
 * thì quyền hẹp mới hoạt động đúng như thiết kế: app chỉ đụng được file do
 * chính nó tạo ra, không đọc được các file khác trong Drive của sếp.
 * Sheet chỉ lưu đường link nên KHÔNG bị nặng dù chạy hàng nghìn ảnh mỗi tháng.
 */
function taoThuMucAnh_() {
  var res = Drive.Files.create({ name: TEN_THU_MUC, mimeType: 'application/vnd.google-apps.folder' });
  return res.id;
}

function luuAnh_(dataUrl, tenFile, c) {
  if (!dataUrl || dataUrl.indexOf('base64,') < 0) return '';
  try {
    var b64 = dataUrl.split('base64,')[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', tenFile + '.jpg');
    var thuMucId = c.thu_muc_anh_id;
    if (!thuMucId) { thuMucId = taoThuMucAnh_(); ghiCauHinh_('thu_muc_anh_id', thuMucId); }
    var f = Drive.Files.create({ name: tenFile + '.jpg', parents: [thuMucId] }, blob);
    return 'https://drive.google.com/file/d/' + f.id + '/view';
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
  if (act === 'duyet') return trangDuyetDon_(e.parameter.maDon, e.parameter.ketQua);
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
      case 'guidon':    kq = guiDon_(req); break;
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
    sanSang: !!(c.muoi_bam_pin && c.thu_muc_anh_id)
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
  var thangNam = Utilities.formatDate(now, TZ, 'yyyy-MM');
  var thang = demViPhamThang_(nv.maNV, thangNam);
  var noGioBuThangPhut = Math.max(0, -tongChenhLechThang_(nv.maNV, thangNam));
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
    tongQuyThang: thang.tongQuy,
    noGioBuThangPhut: noGioBuThangPhut
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

  var nguong = so_(c.nguong_tre_phut, 10);
  var phutTre = 0, phutSom = 0;
  if (loai === 'VAO') phutTre = Math.max(0, phutHienTai - mocVao);
  else                phutSom = Math.max(0, mocRa - phutHienTai);
  var lech = loai === 'VAO' ? phutTre : phutSom;

  // vị trí
  var khoangCach = '', ngoaiVung = false, toaDo = '';
  var sai = Number(req.acc) || 0;
  if (req.lat && req.lng && c.office_lat && c.office_lng) {
    toaDo = Number(req.lat).toFixed(6) + ', ' + Number(req.lng).toFixed(6);
    khoangCach = khoangCachMet_(so_(c.office_lat, 0), so_(c.office_lng, 0), Number(req.lat), Number(req.lng));
    ngoaiVung = khoangCach > so_(c.ban_kinh_m, 150) || sai > so_(c.gps_sai_so_toi_da, 200);
  } else {
    ngoaiVung = true;
  }

  // vi phạm + quỹ luỹ tiến (kỷ luật đi trễ/về sớm — tính bất kể có bù giờ hay không),
  // TRỪ KHI có đơn "xin đi trễ" cho đúng ngày này đã được trưởng bộ phận duyệt trước.
  var viPham = lech >= nguong;
  var donDiTreDaDuyet = (loai === 'VAO' && viPham) ? timDonDaDuyet_(nv.maNV, ngay, 'DI_TRE') : null;
  if (donDiTreDaDuyet) viPham = false;
  var lanThu = '', tienQuy = 0, ghiChu = [];
  if (donDiTreDaDuyet) ghiChu.push('Đã có đơn xin đi trễ được duyệt trước, miễn nộp quỹ lần này.');
  if (viPham) {
    var thang = demViPhamThang_(nv.maNV, Utilities.formatDate(now, TZ, 'yyyy-MM'));
    lanThu  = thang.soLan + 1;
    tienQuy = lanThu <= 3 ? so_(c.muc_quy_lan_1_3, 10000) : so_(c.muc_quy_tu_lan_4, 50000);
    if (lanThu === 3) ghiChu.push('Lần thứ 3 trong tháng: trưởng bộ phận nhắc nhở trực tiếp.');
    if (lanThu >= 7) ghiChu.push('Quá 6 lần trong tháng: báo sếp xem xét kỷ luật.');
  }
  if (ngoaiVung) ghiChu.push('Ngoài vùng văn phòng hoặc GPS sai số lớn — chờ quản lý xác nhận.');
  if (loai === 'RA' && !homNay.vao) ghiChu.push('Chấm ra mà không có lượt chấm vào — cần trưởng bộ phận xác nhận.');

  // Nợ giờ làm bù: chỉ tính khi CHẤM RA, theo TỔNG GIỜ LÀM THỰC TẾ cả ngày (vào→ra,
  // trừ giờ nghỉ giữa ca) so với 8 tiếng chuẩn — xem tinhChenhLechGio_() phía trên.
  var chenhLechPhut = '';
  if (loai === 'RA' && homNay.vao) {
    var vaoPhut = phutTuChuoi_(homNay.vao.gio);
    chenhLechPhut = tinhChenhLechGio_(vaoPhut, phutHienTai, ca, c);
    if (chenhLechPhut < 0) {
      ghiChu.push('Hôm nay làm thiếu ' + dur_(-chenhLechPhut) + ' so với 8 tiếng chuẩn, cần làm bù trong tháng.');
    } else if (chenhLechPhut > 0) {
      ghiChu.push('Hôm nay làm dư ' + dur_(chenhLechPhut) + ', đã trừ bớt nợ giờ làm bù nếu có.');
    }
  }

  // lưu ảnh rồi mới khoá ghi (giữ khoá càng ngắn càng tốt)
  var anhUrl = luuAnh_(req.anh,
    ngay + '_' + nv.maNV + '_' + loai + '_' + Utilities.formatDate(now, TZ, 'HHmmss'), c);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
    sh.appendRow([
      ngay, tenThu_(now), nv.maNV, nv.hoTen, loai, gio, ca,
      phutTre || '', phutSom || '', viPham ? 'CO' : '',
      lanThu, tienQuy || '', khoangCach, sai || '', toaDo, anhUrl,
      req.deviceId || '', ghiChu.join(' · '), chenhLechPhut
    ]);
    SpreadsheetApp.flush();
  } catch (err) {
    return {ok: false, loi: 'Máy chủ đang bận, bấm gửi lại giúp em: ' + err};
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  // Chấm công ngoài vùng văn phòng (hoặc GPS sai số lớn) → báo ngay cho chính nhân viên
  // qua email, để họ chủ động nhắn trưởng bộ phận giải trình nếu cần. Gửi lỗi không
  // chặn kết quả chấm công (nhân viên vẫn thấy kết quả bình thường).
  if (ngoaiVung && nv.email) {
    try { guiEmailNgoaiVung_(nv, loai, gio, khoangCach, sai, c); } catch (err) { /* bỏ qua, không chặn */ }
  }

  return {
    ok: true, loai: loai, gio: Utilities.formatDate(now, TZ, 'HH:mm'), giayPhut: gio,
    ca: ca, mocCa: hhmm_(loai === 'VAO' ? mocVao : mocRa),
    lech: lech, viPham: viPham, lanThu: lanThu, tienQuy: tienQuy,
    nguong: nguong, khoangCach: khoangCach, ngoaiVung: ngoaiVung,
    chenhLechPhut: chenhLechPhut,
    ghiChu: ghiChu, trangThai: trangThaiCuaNV_(nv)
  };
}

/** Báo ngay cho nhân viên khi lượt chấm công của họ bị gắn cờ ngoài vùng văn phòng /
 * GPS sai số lớn — chỉ để thông báo, nhân viên tự nhắn trưởng bộ phận giải trình nếu cần
 * (app chưa có luồng "chỉnh lại" vì đây là vị trí thực tế ghi nhận lúc chấm, không sửa ngược được). */
function guiEmailNgoaiVung_(nv, loai, gio, khoangCach, sai, c) {
  var viTriDong = (khoangCach !== '' && khoangCach !== undefined)
    ? ('Cách văn phòng khoảng ' + khoangCach + ' m' + (sai ? (' · GPS sai số ±' + sai + ' m') : ''))
    : 'Điện thoại không lấy được vị trí (GPS tắt hoặc không cấp quyền).';

  MailApp.sendEmail({
    to: nv.email,
    subject: '⚠️ Chấm công ngoài vùng văn phòng — ' + nv.hoTen,
    body:
      'Chào ' + nv.hoTen + ',\n\n' +
      'Lượt chấm ' + (loai === 'VAO' ? 'VÀO' : 'RA') + ' lúc ' + gio + ' hôm nay bị hệ thống ghi nhận NGOÀI VÙNG văn phòng.\n' +
      viTriDong + '\n\n' +
      'Nếu đây là nhầm lẫn (định vị điện thoại không chính xác) hoặc bạn có lý do chính đáng, nhắn trực tiếp cho trưởng bộ phận để được xác nhận nhé. Dữ liệu chấm công vẫn được ghi nhận bình thường, email này chỉ để bạn biết sớm.\n\n' +
      '— App Chấm Công True Love (email tự động, không trả lời email này)'
  });
}

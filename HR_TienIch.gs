/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_TienIch.gs
 * ----------------------------------------------------------------------------
 *  Công cụ quản trị chạy tay. Không có hàm nào ở đây tự động chạy.
 * ============================================================================
 */

/** Liệt kê vai trò hiện tại của cả công ty — để soát lại ai đang có quyền gì */
function xemVaiTroCaCongTy() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh || sh.getLastRow() < 2) return bao_('Tab NHANSU chua co du lieu.');

  var m = mapCot_(sh);
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var nhom = { ADMIN: [], HR: [], TRUONG_BP: [], NV: [] };

  for (var i = 0; i < v.length; i++) {
    var ma = String(v[i][m['MaNV']] || '').trim();
    if (!ma) continue;
    var vt = String(v[i][m['VaiTro']] || '').trim().toUpperCase();
    if (HR_VAI_TRO.indexOf(vt) < 0) vt = 'NV';
    var tt = String(v[i][m['TrangThai']] || 'DANG_LAM').trim();
    nhom[vt].push(ma + ' - ' + String(v[i][m['HoTen']] || '').trim()
                  + (tt !== 'DANG_LAM' ? ' [' + tt + ']' : ''));
  }

  var t = 'VAI TRO TRONG PHAN HE NHAN SU\n';
  for (var k in nhom) {
    t += '\n' + k + ' (' + nhom[k].length + '):\n'
       + (nhom[k].length ? '  ' + nhom[k].join('\n  ') : '  (khong co ai)') + '\n';
  }
  t += '\nLuu y: chi ADMIN moi chot duoc ky luong va mo lai ky da chot.';
  return bao_(t);
}


/*================= ĐẶT VAI TRÒ CHO NHÂN VIÊN =================*/
/**
 * Cách dùng: sửa các dòng ngay dưới đây rồi bấm Run (chọn hàm datVaiTroNhanVien).
 *
 *   ADMIN     — sếp: thấy và sửa mọi thứ, chốt kỳ lương, mở lại kỳ
 *   HR        — nhân sự: sửa hồ sơ/hợp đồng/công/phép, tính lương (không chốt)
 *   TRUONG_BP — trưởng bộ phận: chỉ xem người trong phòng mình, KHÔNG xem lương
 *   NV        — nhân viên: chỉ xem dữ liệu của chính mình (để trống cũng vậy)
 *
 * Cũng có thể điền thẳng vào cột VaiTro của tab NHANSU, kết quả như nhau.
 * Dùng hàm này thì có ghi nhật ký vào tab NHATKY để truy vết về sau.
 */
var DAT_VAI_TRO_MANV   = 'LJN00001';
var DAT_VAI_TRO_VAITRO = 'ADMIN';

// Neu ma nhan vien chua co trong NHANSU thi co tao dong moi khong.
// Dong moi duoc dat PIN tam 1234, nguoi dung doi PIN o lan dang nhap dau tien.
// De Email trong thi he thong nhac-chua-cham-cong se khong gui mail cho nguoi nay.
var DAT_VAI_TRO_TAO_NEU_CHUA_CO = false;
var DAT_VAI_TRO_HO_TEN          = '';
var DAT_VAI_TRO_PHONG_BAN       = '';

function datVaiTroNhanVien() {
  var maNV   = String(DAT_VAI_TRO_MANV   || '').trim().toUpperCase();
  var vaiTro = String(DAT_VAI_TRO_VAITRO || '').trim().toUpperCase();

  if (!maNV)   return bao_('Chua dien DAT_VAI_TRO_MANV.');
  if (HR_VAI_TRO.indexOf(vaiTro) < 0) {
    return bao_('Vai tro khong hop le: "' + vaiTro + '". Chi nhan: ' + HR_VAI_TRO.join(', '));
  }

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh) return bao_('Khong tim thay tab ' + SHEET_NHANSU);

  var m = mapCot_(sh);
  if (m['VaiTro'] === undefined) {
    return bao_('Tab NHANSU chua co cot VaiTro. Chay menu Nhan su > muc 1 truoc.');
  }
  if (sh.getLastRow() < 2) return bao_('Tab NHANSU chua co nhan vien nao.');

  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][m['MaNV']]).trim().toUpperCase() !== maNV) continue;

    var cu  = String(v[i][m['VaiTro']] || '').trim().toUpperCase() || '(de trong)';
    var ten = String(v[i][m['HoTen']] || '').trim();
    sh.getRange(i + 2, m['VaiTro'] + 1).setValue(vaiTro);

    ghiNhatKy_('CHAY_TAY', 'ADMIN', 'DAT_VAI_TRO', maNV, cu + ' -> ' + vaiTro);
    return bao_('Da dat vai tro ' + vaiTro + ' cho ' + maNV + ' (' + ten + ').\n'
              + 'Vai tro cu: ' + cu + '\nDong ' + (i + 2) + ', cot '
              + chuCot_(m['VaiTro'] + 1) + ' cua tab NHANSU.');
  }

  // Khong thay thi liet ke cac ma dang co de doi chieu cho de
  var dsMa = [];
  for (var k = 0; k < v.length; k++) {
    var x = String(v[k][m['MaNV']] || '').trim();
    if (x) dsMa.push(x);
  }

  if (DAT_VAI_TRO_TAO_NEU_CHUA_CO) {
    var tenMoi = String(DAT_VAI_TRO_HO_TEN || '').trim();
    if (!tenMoi) return bao_('Bat tao moi thi phai dien DAT_VAI_TRO_HO_TEN.');
    var dong = [];
    for (var z = 0; z < sh.getLastColumn(); z++) dong.push('');
    dong[m['MaNV']]      = maNV;
    dong[m['HoTen']]     = tenMoi;
    dong[m['Ca']]        = 'auto';
    dong[m['PIN_TAM']]   = '1234';
    dong[m['TrangThai']] = 'DANG_LAM';
    if (m['PhongBan'] !== undefined) dong[m['PhongBan']] = String(DAT_VAI_TRO_PHONG_BAN || '').trim();
    dong[m['VaiTro']]    = vaiTro;
    if (m['GhiChu'] !== undefined) dong[m['GhiChu']] = 'Tao de dang nhap cong nhan su';
    sh.appendRow(dong);
    ghiNhatKy_('CHAY_TAY', 'ADMIN', 'TAO_TAI_KHOAN', maNV, 'vai tro ' + vaiTro + ', PIN tam 1234');
    return bao_('Da TAO MOI dong cho ' + maNV + ' (' + tenMoi + ') o tab NHANSU, dong '
              + sh.getLastRow() + '.\n'
              + 'Vai tro: ' + vaiTro + '\n'
              + 'PIN tam: 1234 — doi PIN ngay o lan dang nhap dau tien.\n'
              + 'Email de trong nen he thong khong gui mail nhac cham cong.');
  }

  return bao_('Khong tim thay nhan vien co ma ' + maNV + ' trong tab NHANSU.\n\n'
            + 'Cac ma dang co (' + dsMa.length + '):\n' + dsMa.join(', ') + '\n\n'
            + 'Muon tao moi thi dat DAT_VAI_TRO_TAO_NEU_CHUA_CO = true va dien ho ten.');
}

/*================= TIỆN ÍCH NHỎ =================*/

/** Hiện thông báo nếu chạy từ Sheet, còn chạy từ trình soạn thảo thì ghi log */
function bao_(t) {
  try { SpreadsheetApp.getUi().alert(t); } catch (e) { }
  Logger.log(t);
  return t;
}

/** Số cột -> chữ cột (1 -> A, 11 -> K) */
function chuCot_(n) {
  var s = '';
  while (n > 0) {
    var d = (n - 1) % 26;
    s = String.fromCharCode(65 + d) + s;
    n = Math.floor((n - d - 1) / 26);
  }
  return s;
}

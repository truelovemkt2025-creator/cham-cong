/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_Core.gs
 * ----------------------------------------------------------------------------
 *  Nền tảng dùng chung: đọc cấu hình, tiện ích ngày/số, phân quyền, nhật ký
 *  thao tác, truy vấn bảng, và bộ định tuyến API cho cổng nhân sự.
 *
 *  Phân quyền (cột VaiTro trong tab NHANSU):
 *     ADMIN     — sếp: thấy và sửa mọi thứ, chốt kỳ lương
 *     HR        — nhân sự: sửa hồ sơ/hợp đồng/phép, tính lương (không chốt)
 *     TRUONG_BP — trưởng bộ phận: chỉ xem người trong phòng mình, không xem lương
 *     (để trống) — nhân viên: chỉ xem dữ liệu của chính mình
 * ============================================================================
 */

var HR_VAI_TRO = ['ADMIN', 'HR', 'TRUONG_BP', 'NV'];

/*================= CẤU HÌNH HR =================*/

/** Đọc toàn bộ tham số HR. Dùng getDisplayValues để ô giờ/ngày không bị hoá Date. */
function docCauHinhHR_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CAUHINHHR);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues();
  for (var i = 0; i < v.length; i++) {
    if (v[i][0]) out[String(v[i][0]).trim()] = String(v[i][1]).trim();
  }
  return out;
}

/** Lấy 1 tham số HR dạng số */
function chsSo_(c, khoa, macDinh) {
  return so_(c[khoa], macDinh);
}

/** Lấy 1 tham số HR dạng chữ */
function chsChu_(c, khoa, macDinh) {
  var v = c[khoa];
  return (v === undefined || v === null || v === '') ? macDinh : String(v).trim();
}

/** Tham số dạng CO/KHONG -> boolean */
function chsBat_(c, khoa, macDinh) {
  var v = chsChu_(c, khoa, macDinh ? 'CO' : 'KHONG').toUpperCase();
  return v === 'CO' || v === 'CÓ' || v === 'TRUE' || v === '1';
}

/**
 * Tham số CÓ HIỆU LỰC THEO KỲ — bài học quan trọng nhất khi làm phần mềm lương.
 *
 * Năm 2026 luật đổi hai lần: mức tham chiếu BHXH 2.340.000 -> 2.530.000 (01/07/2026),
 * lương tối thiểu vùng I 4.960.000 -> 5.310.000 (01/01/2026), ngưỡng khấu trừ 10%
 * 2.000.000 -> 5.000.000 (01/07/2026). Nếu để số cứng thì tính lại lương tháng 3/2026
 * hôm nay sẽ ra sai con số của tháng 3.
 *
 * Cách khai trên Sheet: ngoài khoá gốc, thêm các khoá "<khoa>@<YYYY-MM>".
 * Hàm này chọn mốc hiệu lực LỚN NHẤT mà vẫn <= kỳ đang tính; không có mốc nào
 * phù hợp thì dùng khoá gốc.
 *
 *   muc_tham_chieu_bhxh@2024-07 = 2340000
 *   muc_tham_chieu_bhxh@2026-07 = 2530000
 *   -> tính lương kỳ 2026-03 dùng 2.340.000; kỳ 2026-09 dùng 2.530.000
 */
function chsSoKy_(c, khoa, ky, macDinh) {
  var tien = khoa + '@';
  var mocTot = '', giaTri = null;
  for (var k in c) {
    if (k.indexOf(tien) !== 0) continue;
    var moc = kyChuoi_(k.slice(tien.length));
    if (!moc || moc > ky) continue;             // mốc chưa tới hiệu lực với kỳ này
    if (moc > mocTot) { mocTot = moc; giaTri = c[k]; }
  }
  if (giaTri !== null && String(giaTri).trim() !== '') return so_(giaTri, macDinh);
  return chsSo_(c, khoa, macDinh);
}

/** Bản chữ của chsSoKy_ */
function chsChuKy_(c, khoa, ky, macDinh) {
  var tien = khoa + '@';
  var mocTot = '', giaTri = null;
  for (var k in c) {
    if (k.indexOf(tien) !== 0) continue;
    var moc = kyChuoi_(k.slice(tien.length));
    if (!moc || moc > ky) continue;
    if (moc > mocTot) { mocTot = moc; giaTri = c[k]; }
  }
  if (giaTri !== null && String(giaTri).trim() !== '') return String(giaTri).trim();
  return chsChu_(c, khoa, macDinh);
}

/*================= TIỆN ÍCH =================*/

function hnayHR_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowHR_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

/** Kỳ của hôm nay, dạng YYYY-MM */
function kyHienTai_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

/** Chuẩn hoá kỳ về YYYY-MM, chấp nhận 2026-09, 09/2026, 9/2026 */
function kyChuoi_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
  m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[2] + '-' + ('0' + m[1]).slice(-2);
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM');
  return s;
}

/** Số ngày trong tháng của kỳ YYYY-MM */
function soNgayTrongKy_(ky) {
  var p = String(ky).split('-');
  return new Date(Number(p[0]), Number(p[1]), 0).getDate();
}

/** Danh sách mọi ngày YYYY-MM-DD trong kỳ */
function cacNgayTrongKy_(ky) {
  var p = String(ky).split('-'), n = soNgayTrongKy_(ky), ra = [];
  for (var d = 1; d <= n; d++) ra.push(p[0] + '-' + p[1] + '-' + ('0' + d).slice(-2));
  return ra;
}

/** Thứ trong tuần của chuỗi YYYY-MM-DD: 0 = Chủ nhật */
function thuCuaNgay_(ngay) {
  var p = String(ngay).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
}

/** Số tháng giữa 2 ngày YYYY-MM-DD (làm tròn xuống, dùng cho thâm niên/phép) */
function soThangGiua_(tu, den) {
  var a = String(tu).split('-'), b = String(den).split('-');
  if (a.length < 3 || b.length < 3) return 0;
  var th = (Number(b[0]) - Number(a[0])) * 12 + (Number(b[1]) - Number(a[1]));
  if (Number(b[2]) < Number(a[2])) th -= 1;
  return th;
}

/** Làm tròn tới đơn vị (mặc định 1.000đ) */
function lamTron_(x, donVi) {
  var d = donVi || 1;
  return Math.round((Number(x) || 0) / d) * d;
}

/**
 * Đọc số tiền an toàn từ ô Sheet.
 *
 * Phải xử lý được cả kiểu Việt Nam ("15.000.000" — dấu chấm là phân cách nghìn)
 * lẫn kiểu Anh ("15,000,000"). Nếu chỉ strip ký tự rồi parseFloat thì
 * "15.000.000" ra 15 — sai 1 triệu lần và không báo lỗi gì. Đây là bẫy thật:
 * chỉ cần một ô lương bị gõ dạng chữ là cả bảng lương sai.
 *
 * Quy tắc phân biệt khi chỉ có MỘT dấu:
 *   - phần nguyên là "0"        -> dấu thập phân  (0.5 công, 0.105 tỷ lệ)
 *   - đúng 3 chữ số phía sau    -> phân cách nghìn (1.500 = 1500)
 *   - còn lại                   -> dấu thập phân  (24.5 công)
 */
function tien_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v instanceof Date) return 0;
  var goc = String(v === undefined || v === null ? '' : v).trim();
  if (!goc) return 0;

  var am = goc.indexOf('-') >= 0 || /^\(.*\)$/.test(goc);
  var s = goc.replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  var viTriCham = s.lastIndexOf('.'), viTriPhay = s.lastIndexOf(',');

  if (viTriCham >= 0 && viTriPhay >= 0) {
    // Có cả hai: dấu xuất hiện sau cùng là dấu thập phân
    if (viTriPhay > viTriCham) s = s.replace(/\./g, '').replace(',', '.');
    else                       s = s.replace(/,/g, '');
  } else if (viTriCham >= 0 || viTriPhay >= 0) {
    var dau = viTriCham >= 0 ? '.' : ',';
    var phan = s.split(dau);
    var laPhanCachNghin;
    if (phan.length > 2) {
      laPhanCachNghin = true;                                  // 15.000.000
    } else {
      var nguyen = phan[0], du = phan[1] || '';
      laPhanCachNghin = (nguyen !== '0' && nguyen !== '' && du.length === 3);
    }
    if (laPhanCachNghin) s = phan.join('');
    else s = phan[0] + '.' + (phan[1] || '0');
  }

  var n = parseFloat(s);
  if (isNaN(n)) return 0;
  return am ? -Math.abs(n) : n;
}

/** Sinh mã có tiền tố + số thứ tự tăng dần theo số dòng hiện có */
function sinhMa_(sh, tienTo) {
  var n = Math.max(0, sh.getLastRow() - 1) + 1;
  return tienTo + ('0000' + n).slice(-4) + '-' + Utilities.formatDate(new Date(), TZ, 'yyMM');
}

/*================= ĐỌC BẢNG =================*/

/**
 * Đọc 1 tab thành mảng object, khoá theo TÊN CỘT thật trên Sheet.
 * Mọi cột tên bắt đầu bằng "Ngay" được bọc ngayChuoi_() để không bị Sheets
 * hoá Date — bẫy đã gặp 2 lần ở app chấm công.
 */
function docBang_(tenTab) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tenTab);
  if (!sh || sh.getLastRow() < 2) return [];
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var ra = [];
  for (var i = 0; i < v.length; i++) {
    var o = { _dong: i + 2 }, rong = true;
    for (var j = 0; j < h.length; j++) {
      var ten = String(h[j]).trim();
      if (!ten) continue;
      var gt = v[i][j];
      if (ten.indexOf('Ngay') === 0 || ten === 'HanSuDungTon') gt = ngayChuoi_(gt);
      else if (ten === 'Ky' || ten === 'TuThang' || ten === 'DenThang') gt = kyChuoi_(gt);
      o[ten] = gt;
      if (gt !== '' && gt !== null) rong = false;
    }
    if (!rong) ra.push(o);
  }
  return ra;
}

/** Ghi 1 object thành dòng mới, map theo tên cột thật */
function themDong_(tenTab, obj) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tenTab);
  if (!sh) throw new Error('Khong tim thay tab ' + tenTab);
  var m = mapCot_(sh), n = sh.getLastColumn(), dong = [];
  for (var i = 0; i < n; i++) dong.push('');
  for (var k in obj) if (m[k] !== undefined) dong[m[k]] = obj[k];
  sh.appendRow(dong);
  return sh.getLastRow();
}

/** Cập nhật các ô của 1 dòng đã có, map theo tên cột thật */
function suaDong_(tenTab, soDong, obj) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tenTab);
  if (!sh) throw new Error('Khong tim thay tab ' + tenTab);
  var m = mapCot_(sh);
  for (var k in obj) {
    if (m[k] === undefined) continue;
    sh.getRange(soDong, m[k] + 1).setValue(obj[k]);
  }
  return true;
}

/** Tìm dòng đầu tiên khớp nhiều điều kiện. dk = {TenCot: giaTri} */
function timDong_(tenTab, dk) {
  var ds = docBang_(tenTab);
  for (var i = 0; i < ds.length; i++) {
    var khop = true;
    for (var k in dk) {
      var a = String(ds[i][k] === undefined ? '' : ds[i][k]).trim().toUpperCase();
      var b = String(dk[k] === undefined ? '' : dk[k]).trim().toUpperCase();
      if (a !== b) { khop = false; break; }
    }
    if (khop) return ds[i];
  }
  return null;
}

/*================= NHẬT KÝ THAO TÁC =================*/

function ghiNhatKy_(nguoi, vaiTro, hanhDong, doiTuong, chiTiet) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_NHATKY);
    if (!sh) return;
    sh.appendRow([nowHR_(), nguoi || '', vaiTro || '', hanhDong || '', doiTuong || '',
                  String(chiTiet === undefined ? '' : chiTiet).slice(0, 2000), '']);
  } catch (e) { Logger.log('Loi ghi nhat ky: ' + e); }
}

/*================= PHÂN QUYỀN =================*/

/** Đọc vai trò của 1 nhân viên từ cột VaiTro của tab NHANSU */
function vaiTroCuaNV_(maNV) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NHANSU);
  if (!sh || sh.getLastRow() < 2) return 'NV';
  var m = mapCot_(sh);
  if (m['VaiTro'] === undefined) return 'NV';
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][m['MaNV']]).trim().toUpperCase() === String(maNV).trim().toUpperCase()) {
      var vt = String(v[i][m['VaiTro']] || '').trim().toUpperCase();
      return HR_VAI_TRO.indexOf(vt) >= 0 ? vt : 'NV';
    }
  }
  return 'NV';
}

/**
 * Xác thực request của cổng nhân sự.
 * Dùng lại hẳn token của app chấm công (login bằng MaNV + PIN) -> không sinh
 * thêm một bộ mật khẩu thứ hai cho nhân viên phải nhớ.
 */
function phienHR_(req) {
  var maNV = maNVTuToken_(req && req.token);
  if (!maNV) return { ok: false, loi: 'Phien dang nhap da het. Vui long dang nhap lai.' };
  var nv = timNhanVien_(maNV);
  if (!nv) return { ok: false, loi: 'Khong tim thay nhan vien.' };
  if (nv.trangThai !== 'DANG_LAM') return { ok: false, loi: 'Tai khoan dang khoa.' };
  return { ok: true, maNV: nv.maNV, hoTen: nv.hoTen, phongBan: nv.phongBan, vaiTro: vaiTroCuaNV_(nv.maNV) };
}

/** Chặn nếu vai trò hiện tại không nằm trong danh sách cho phép */
function doiQuyen_(p, dsVaiTro) {
  if (dsVaiTro.indexOf(p.vaiTro) < 0) {
    return { ok: false, loi: 'Ban khong co quyen thuc hien viec nay (vai tro hien tai: ' + p.vaiTro + ').' };
  }
  return null;
}

/** Vai trò này có được xem lương của người khác không */
function duocXemLuong_(p) {
  var c = docCauHinhHR_();
  var ds = chsChu_(c, 'vai_tro_xem_luong', 'ADMIN,HR').toUpperCase().split(',')
             .map(function (x) { return x.trim(); });
  return ds.indexOf(p.vaiTro) >= 0;
}

/** Lọc danh sách theo quyền: ADMIN/HR thấy hết, TRUONG_BP thấy phòng mình, NV thấy mình */
function locTheoQuyen_(p, ds) {
  if (p.vaiTro === 'ADMIN' || p.vaiTro === 'HR') return ds;
  if (p.vaiTro === 'TRUONG_BP') {
    return ds.filter(function (x) {
      return String(x.PhongBan || '').trim().toUpperCase() === String(p.phongBan || '').trim().toUpperCase();
    });
  }
  return ds.filter(function (x) {
    return String(x.MaNV || '').trim().toUpperCase() === p.maNV.toUpperCase();
  });
}

/*================= HỒ SƠ NHÂN SỰ =================*/

function hrDanhSachNhanSu_(req, p) {
  var ds = docBang_(SH_HOSONV);
  var hd = docBang_(SH_HOPDONG);

  // Gắn hợp đồng đang hiệu lực vào từng hồ sơ
  var hdTheoNV = {};
  for (var i = 0; i < hd.length; i++) {
    if (String(hd[i].TrangThai || '').toUpperCase() !== 'HIEU_LUC') continue;
    hdTheoNV[String(hd[i].MaNV).trim().toUpperCase()] = hd[i];
  }

  var locTT = String(req.trangThai || '').trim().toUpperCase();
  var locPB = String(req.phongBan || '').trim().toUpperCase();
  var tim   = String(req.tim || '').trim().toLowerCase();

  var ra = [];
  for (var j = 0; j < ds.length; j++) {
    var o = ds[j];
    var tt = String(o.TrangThaiLamViec || 'DANG_LAM').toUpperCase();
    if (locTT && tt !== locTT) continue;
    if (locPB && String(o.PhongBan || '').toUpperCase() !== locPB) continue;
    if (tim) {
      var chuoi = (String(o.MaNV) + ' ' + String(o.HoTen) + ' ' + String(o.DienThoai)).toLowerCase();
      if (chuoi.indexOf(tim) < 0) continue;
    }
    var h = hdTheoNV[String(o.MaNV).trim().toUpperCase()] || null;
    ra.push({
      MaNV: o.MaNV, HoTen: o.HoTen, PhongBan: o.PhongBan, ChucDanh: o.ChucDanh,
      DienThoai: o.DienThoai, EmailCongTy: o.EmailCongTy, NgayVaoLam: o.NgayVaoLam,
      TrangThaiLamViec: tt, SoNguoiPhuThuoc: tien_(o.SoNguoiPhuThuoc),
      LoaiHD: h ? h.LoaiHD : '', MaHD: h ? h.MaHD : '',
      NgayHetHan: h ? h.NgayHetHan : '',
      LuongThoaThuan: (h && duocXemLuong_(p)) ? tien_(h.LuongThoaThuan) : null,
      LuongCoBanBHXH: (h && duocXemLuong_(p)) ? tien_(h.LuongCoBanBHXH) : null,
      ThieuHoSo: thieuHoSo_(o)
    });
  }
  ra = locTheoQuyen_(p, ra);
  return { ok: true, danhSach: ra, tong: ra.length, vaiTro: p.vaiTro, xemLuong: duocXemLuong_(p) };
}

/** Những trường bắt buộc còn trống — để cổng nhân sự nhắc điền */
function thieuHoSo_(o) {
  var batBuoc = ['NgaySinh', 'CCCD', 'DienThoai', 'PhongBan', 'ChucDanh', 'NgayVaoLam', 'SoTaiKhoan'];
  var thieu = [];
  for (var i = 0; i < batBuoc.length; i++) {
    if (String(o[batBuoc[i]] === undefined ? '' : o[batBuoc[i]]).trim() === '') thieu.push(batBuoc[i]);
  }
  return thieu;
}

function hrChiTietNhanSu_(req, p) {
  var ma = String(req.maNV || '').trim().toUpperCase();
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  if (p.vaiTro === 'NV' && ma !== p.maNV.toUpperCase()) {
    return { ok: false, loi: 'Ban chi xem duoc ho so cua chinh minh.' };
  }

  var hs = timDong_(SH_HOSONV, { MaNV: ma });
  if (!hs) return { ok: false, loi: 'Khong tim thay ho so ' + ma };
  if (p.vaiTro === 'TRUONG_BP' &&
      String(hs.PhongBan || '').toUpperCase() !== String(p.phongBan || '').toUpperCase()) {
    return { ok: false, loi: 'Nhan vien nay khong thuoc phong ban cua ban.' };
  }

  var hd = docBang_(SH_HOPDONG).filter(function (x) {
    return String(x.MaNV).trim().toUpperCase() === ma;
  });
  var pc = docBang_(SH_PHUCAP).filter(function (x) {
    return String(x.MaNV).trim().toUpperCase() === ma;
  });
  var ls = docBang_(SH_LSLUONG).filter(function (x) {
    return String(x.MaNV).trim().toUpperCase() === ma;
  });
  var ts = docBang_(SH_TAISAN).filter(function (x) {
    return String(x.MaNV).trim().toUpperCase() === ma;
  });
  var kl = docBang_(SH_KYLUAT).filter(function (x) {
    return String(x.MaNV).trim().toUpperCase() === ma;
  });

  if (!duocXemLuong_(p) && ma !== p.maNV.toUpperCase()) {
    hd = hd.map(function (x) {
      var y = {};
      for (var k in x) y[k] = k.indexOf('Luong') === 0 || k === 'PhuCapCoDinh' ? null : x[k];
      return y;
    });
    ls = [];
    pc = [];
  }

  return {
    ok: true, hoSo: hs, hopDong: hd, phuCap: pc, lichSuLuong: ls,
    taiSan: ts, khenThuongKyLuat: kl, thieuHoSo: thieuHoSo_(hs)
  };
}

function hrLuuNhanSu_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var o = req.hoSo || {};
  var ma = String(o.MaNV || '').trim().toUpperCase();
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  if (!String(o.HoTen || '').trim()) return { ok: false, loi: 'Thieu ho ten.' };

  // Chỉ nhận đúng các cột đã khai báo, bỏ mọi trường lạ
  var sach = {};
  for (var i = 0; i < COT_HOSONV.length; i++) {
    var k = COT_HOSONV[i];
    if (o[k] !== undefined) sach[k] = o[k];
  }
  sach.MaNV = ma;
  sach.NgayCapNhat  = hnayHR_();
  sach.NguoiCapNhat = p.maNV;

  var cu = timDong_(SH_HOSONV, { MaNV: ma });
  if (cu) {
    suaDong_(SH_HOSONV, cu._dong, sach);
    ghiNhatKy_(p.maNV, p.vaiTro, 'SUA_HOSO', ma, JSON.stringify(sach).slice(0, 800));
    return { ok: true, thongBao: 'Da cap nhat ho so ' + ma, moi: false };
  }
  themDong_(SH_HOSONV, sach);
  ghiNhatKy_(p.maNV, p.vaiTro, 'THEM_HOSO', ma, JSON.stringify(sach).slice(0, 800));
  return { ok: true, thongBao: 'Da them ho so ' + ma, moi: true };
}

/*================= HỢP ĐỒNG =================*/

function hrLuuHopDong_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var o = req.hopDong || {};
  var ma = String(o.MaNV || '').trim().toUpperCase();
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  var loai = String(o.LoaiHD || '').trim().toUpperCase();
  if (['TV', 'CT', 'CTV'].indexOf(loai) < 0) {
    return { ok: false, loi: 'LoaiHD phai la TV (thu viec), CT (chinh thuc) hoac CTV.' };
  }
  var hs = timDong_(SH_HOSONV, { MaNV: ma });
  if (!hs) return { ok: false, loi: 'Chua co ho so cho ' + ma + '. Tao ho so truoc khi khai hop dong.' };

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_HOPDONG);
  var sach = {};
  for (var i = 0; i < COT_HOPDONG.length; i++) {
    var k = COT_HOPDONG[i];
    if (o[k] !== undefined) sach[k] = o[k];
  }
  sach.MaNV    = ma;
  sach.HoTen   = hs.HoTen;
  sach.LoaiHD  = loai;
  sach.DongBHXH = (loai === 'CT') ? 'CO' : chsChu_({}, '', String(o.DongBHXH || 'KHONG'));
  sach.LuongThoaThuan = tien_(o.LuongThoaThuan);
  sach.LuongCoBanBHXH = tien_(o.LuongCoBanBHXH) || tien_(o.LuongThoaThuan);
  sach.PhuCapCoDinh   = tien_(o.PhuCapCoDinh);

  var cu = o.MaHD ? timDong_(SH_HOPDONG, { MaHD: o.MaHD }) : null;
  if (cu) {
    // Thay đổi mức lương -> bắt buộc ghi lịch sử, không ghi đè im lặng
    if (tien_(cu.LuongThoaThuan) !== sach.LuongThoaThuan ||
        tien_(cu.LuongCoBanBHXH) !== sach.LuongCoBanBHXH) {
      themDong_(SH_LSLUONG, {
        MaLS: sinhMa_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_LSLUONG), 'LS'),
        MaNV: ma, HoTen: hs.HoTen,
        NgayHieuLuc: String(o.NgayHieuLucLuongMoi || hnayHR_()),
        LuongCu: tien_(cu.LuongThoaThuan), LuongMoi: sach.LuongThoaThuan,
        LuongBHXHCu: tien_(cu.LuongCoBanBHXH), LuongBHXHMoi: sach.LuongCoBanBHXH,
        LyDo: String(o.LyDoDoiLuong || 'Dieu chinh hop dong'),
        QuyetDinhSo: String(o.QuyetDinhSo || ''),
        NguoiDuyet: p.maNV, NgayTao: hnayHR_(), NguoiTao: p.maNV, GhiChu: ''
      });
    }
    suaDong_(SH_HOPDONG, cu._dong, sach);
    ghiNhatKy_(p.maNV, p.vaiTro, 'SUA_HOPDONG', cu.MaHD, JSON.stringify(sach).slice(0, 800));
    return { ok: true, thongBao: 'Da cap nhat hop dong ' + cu.MaHD, maHD: cu.MaHD };
  }

  // Hợp đồng mới -> hợp đồng cũ cùng người chuyển sang HET_HAN
  var dsCu = docBang_(SH_HOPDONG);
  for (var j = 0; j < dsCu.length; j++) {
    if (String(dsCu[j].MaNV).trim().toUpperCase() === ma &&
        String(dsCu[j].TrangThai || '').toUpperCase() === 'HIEU_LUC') {
      suaDong_(SH_HOPDONG, dsCu[j]._dong, { TrangThai: 'HET_HAN' });
    }
  }
  sach.MaHD      = sinhMa_(sh, 'HD');
  sach.TrangThai = 'HIEU_LUC';
  sach.NgayTao   = hnayHR_();
  sach.NguoiTao  = p.maNV;
  themDong_(SH_HOPDONG, sach);
  ghiNhatKy_(p.maNV, p.vaiTro, 'THEM_HOPDONG', sach.MaHD, JSON.stringify(sach).slice(0, 800));
  return { ok: true, thongBao: 'Da tao hop dong ' + sach.MaHD, maHD: sach.MaHD };
}

/** Hợp đồng đang hiệu lực của 1 người tại 1 kỳ — nguồn lấy mức lương khi tính lương */
function hopDongHieuLuc_(maNV, ky, dsHopDong) {
  var ds = dsHopDong || docBang_(SH_HOPDONG);
  var cuoiKy = ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2);
  var chon = null;
  for (var i = 0; i < ds.length; i++) {
    var h = ds[i];
    if (String(h.MaNV).trim().toUpperCase() !== String(maNV).trim().toUpperCase()) continue;
    var hl = String(h.NgayHieuLuc || '');
    if (hl && hl > cuoiKy) continue;                       // chưa tới hiệu lực
    if (!chon || String(chon.NgayHieuLuc || '') < hl) chon = h;
  }
  return chon;
}

/*================= CẢNH BÁO NHÂN SỰ =================*/

/** Hợp đồng sắp hết hạn, hồ sơ còn thiếu, nhân viên chưa có hợp đồng */
function hrCanhBao_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var c = docCauHinhHR_();
  var truoc = chsSo_(c, 'canh_bao_het_han_hd', 30);
  var hnay = hnayHR_();
  var moc = Utilities.formatDate(new Date(new Date().getTime() + truoc * 86400000), TZ, 'yyyy-MM-dd');

  var hs = docBang_(SH_HOSONV).filter(function (x) {
    return String(x.TrangThaiLamViec || 'DANG_LAM').toUpperCase() === 'DANG_LAM';
  });
  var hd = docBang_(SH_HOPDONG);

  var sapHetHan = [], chuaCoHD = [], hoSoThieu = [];
  var coHD = {};
  for (var i = 0; i < hd.length; i++) {
    if (String(hd[i].TrangThai || '').toUpperCase() !== 'HIEU_LUC') continue;
    coHD[String(hd[i].MaNV).trim().toUpperCase()] = true;
    var hh = String(hd[i].NgayHetHan || '');
    if (hh && hh >= hnay && hh <= moc) {
      sapHetHan.push({ MaNV: hd[i].MaNV, HoTen: hd[i].HoTen, LoaiHD: hd[i].LoaiHD,
                       NgayHetHan: hh, ConLaiNgay: Math.round((new Date(hh) - new Date(hnay)) / 86400000) });
    }
  }
  for (var j = 0; j < hs.length; j++) {
    var ma = String(hs[j].MaNV).trim().toUpperCase();
    if (!coHD[ma]) chuaCoHD.push({ MaNV: hs[j].MaNV, HoTen: hs[j].HoTen, PhongBan: hs[j].PhongBan });
    var t = thieuHoSo_(hs[j]);
    if (t.length) hoSoThieu.push({ MaNV: hs[j].MaNV, HoTen: hs[j].HoTen, Thieu: t });
  }

  return { ok: true, hopDongSapHetHan: sapHetHan, chuaCoHopDong: chuaCoHD,
           hoSoConThieu: hoSoThieu, nguongNgay: truoc };
}

/*================= ĐỊNH TUYẾN API =================*/

/**
 * Mọi action của cổng nhân sự đều bắt đầu bằng "hr_".
 * Code.gs chỉ cần sửa 1 dòng: ở nhánh default của doPost gọi hrRouter_(req).
 */
function hrRouter_(req) {
  var act = String((req && req.action) || '');
  if (act.indexOf('hr_') !== 0) {
    return { ok: false, loi: 'Khong ro action: ' + act };
  }

  // Ping không cần đăng nhập
  if (act === 'hr_ping') {
    return { ok: true, phienBan: 'HR 1.0', ngay: hnayHR_(), gio: nowHR_() };
  }

  var p = phienHR_(req);
  if (!p.ok) return p;

  try {
    switch (act) {
      // --- Hồ sơ & hợp đồng ---
      case 'hr_toi':            return { ok: true, phien: p };
      case 'hr_dsnhansu':       return hrDanhSachNhanSu_(req, p);
      case 'hr_chitietnhansu':  return hrChiTietNhanSu_(req, p);
      case 'hr_luunhansu':      return hrLuuNhanSu_(req, p);
      case 'hr_luuhopdong':     return hrLuuHopDong_(req, p);
      case 'hr_canhbao':        return hrCanhBao_(req, p);

      // --- Công ---
      case 'hr_bangcong':       return hrBangCong_(req, p);
      case 'hr_congchitiet':    return hrCongChiTiet_(req, p);
      case 'hr_dieuchinhcong':  return hrLuuDieuChinhCong_(req, p);
      case 'hr_chotcong':       return hrChotCong_(req, p);
      case 'hr_kyhieucong':     return { ok: true, kyHieu: KY_HIEU_CONG };

      // --- Phép năm ---
      case 'hr_phepnam':        return hrPhepNam_(req, p);
      case 'hr_taoquyphep':     return hrTaoQuyPhep_(req, p);
      case 'hr_dieuchinhphep':  return hrDieuChinhPhep_(req, p);
      case 'hr_dongbophep':     return hrDongBoPhepTuDon_(req, p);

      // --- KPI ---
      case 'hr_luukpi':         return hrLuuKPI_(req, p);
      case 'hr_dskpi':          return hrDanhSachKPI_(req, p);
      case 'hr_tinhkpi':        return hrTinhKPI_(req, p);

      // --- Khoản khác ---
      case 'hr_luukhoankhac':   return hrLuuKhoanKhac_(req, p);
      case 'hr_dskhoankhac':    return hrDanhSachKhoanKhac_(req, p);

      // --- Lương ---
      case 'hr_tinhluong':      return hrTinhLuong_(req, p);
      case 'hr_bangluong':      return hrBangLuong_(req, p);
      case 'hr_phieuluong':     return hrPhieuLuong_(req, p);
      case 'hr_chotluong':      return hrChotLuong_(req, p);
      case 'hr_morky':          return hrMoLaiKy_(req, p);

      // --- Báo cáo ---
      case 'hr_tongquan':       return hrTongQuan_(req, p);
      case 'hr_chiphinhansu':   return hrChiPhiNhanSu_(req, p);
      case 'hr_thamso':         return hrThamSo_(req, p);

      default: return { ok: false, loi: 'Khong ro action: ' + act };
    }
  } catch (err) {
    ghiNhatKy_(p.maNV, p.vaiTro, 'LOI', act, String(err && err.stack || err));
    return { ok: false, loi: 'Loi may chu: ' + err };
  }
}

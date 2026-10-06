/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_Phep.gs   (Phép năm)
 * ----------------------------------------------------------------------------
 *  Nguyên tắc: tab BIENDONGPHEP là SỔ CÁI duy nhất — mọi ngày phép cộng vào
 *  hay trừ ra đều là một dòng có nguồn gốc, người duyệt, thời gian.
 *  Tab PHEPNAM chỉ là ẢNH CHỤP số dư để xem nhanh, luôn tính lại được từ sổ cái.
 *
 *  Hai chế độ (đổi ở CAUHINH_HR.phep_che_do, không cần sửa code):
 *
 *  THANG (công ty đang dùng — Nội quy Love Journey 01/01/2025)
 *     Mỗi tháng làm việc được 1 ngày phép, cộng dồn liên tục từ ngày vào làm,
 *     bỏ qua 2 tháng thử việc đầu, mỗi tháng chỉ được dùng tối đa 3 ngày.
 *
 *  NAM (theo Bộ luật Lao động 2019)
 *     12 ngày/năm (Điều 113) + 1 ngày cho mỗi 5 năm làm việc (Điều 114),
 *     người làm chưa đủ 12 tháng thì tính theo tỷ lệ tháng làm việc.
 *
 *  LƯU Ý PHÁP LÝ cần sếp quyết: chế độ THANG đang bỏ 2 tháng thử việc, nên
 *  người vào làm tháng 1 chỉ có 10 ngày phép cho cả năm — thấp hơn mức sàn
 *  12 ngày/năm của Điều 113 BLLĐ 2019 (thời gian thử việc vẫn được tính là
 *  thời gian làm việc). Đổi phep_bo_qua_thang_dau = 0 là hết rủi ro này.
 * ============================================================================
 */

/*================= TÍNH QUỸ PHÉP =================*/

/**
 * Số ngày phép một người được hưởng TÍCH LUỸ từ ngày vào làm tới denNgay.
 * Trả về cả diễn giải để cổng nhân sự hiện được "vì sao ra số này".
 */
function tinhPhepTichLuy_(nv, denNgay, c) {
  var vaoLam = ngayChuoi_(nv.NgayVaoLam || '');
  var nghiViec = ngayChuoi_(nv.NgayNghiViec || '');
  var moc = (nghiViec && nghiViec < denNgay) ? nghiViec : denNgay;

  if (!vaoLam) {
    return { duocHuong: 0, thangLamViec: 0, cheDo: '', dienGiai: 'Chua co ngay vao lam trong ho so — khong tinh duoc phep.', thieuDuLieu: true };
  }
  if (vaoLam > moc) {
    return { duocHuong: 0, thangLamViec: 0, cheDo: '', dienGiai: 'Chua den ngay vao lam.', thieuDuLieu: false };
  }

  var cheDo = chsChu_(c, 'phep_che_do', 'THANG').toUpperCase();
  var thangLamViec = soThangGiua_(vaoLam, moc) + 1;   // tháng vào làm tính là 1 tháng
  if (thangLamViec < 0) thangLamViec = 0;

  if (cheDo === 'THANG') {
    var moiThang = chsSo_(c, 'phep_moi_thang', 1);
    var boQua    = chsSo_(c, 'phep_bo_qua_thang_dau', 2);
    var thangTinh = Math.max(0, thangLamViec - boQua);
    var duoc = thangTinh * moiThang;
    return {
      duocHuong: lamTronNuaNgay_(duoc), thangLamViec: thangLamViec, cheDo: 'THANG',
      dienGiai: 'Vao lam ' + vaoLam + ' -> ' + thangLamViec + ' thang lam viec tinh den ' + moc
              + '; bo ' + boQua + ' thang thu viec -> ' + thangTinh + ' thang x ' + moiThang
              + ' ngay = ' + duoc + ' ngay phep (cong don tu ngay vao lam).',
      thieuDuLieu: false
    };
  }

  // Chế độ NAM: cộng entitlement từng năm từ năm vào làm tới năm của moc
  var namVao = Number(vaoLam.slice(0, 4));
  var namMoc = Number(moc.slice(0, 4));
  var chuan   = chsSo_(c, 'phep_chuan_nam', 12);
  var moiNam  = chsSo_(c, 'phep_tham_nien_moi_nam', 5);
  var theoTyLe = chsBat_(c, 'tinh_phep_theo_ty_le', true);
  var tong = 0, moTa = [];

  for (var nam = namVao; nam <= namMoc; nam++) {
    var dauNam  = nam + '-01-01';
    var cuoiNam = nam + '-12-31';
    var tu  = vaoLam > dauNam ? vaoLam : dauNam;
    var den = moc < cuoiNam ? moc : cuoiNam;
    if (tu > den) continue;

    // Thâm niên: số năm tròn đã làm tính tại đầu kỳ của năm đó
    var namLam = Math.floor(soThangGiua_(vaoLam, tu) / 12);
    var themThamNien = moiNam > 0 ? Math.floor(namLam / moiNam) : 0;
    var mucNam = chuan + themThamNien;

    var soThang = soThangGiua_(tu, den) + 1;
    if (soThang > 12) soThang = 12;
    var duocNam = (theoTyLe && soThang < 12) ? (mucNam / 12) * soThang : mucNam;
    duocNam = lamTronNuaNgay_(duocNam);
    tong += duocNam;
    moTa.push(nam + ': ' + duocNam + ' ngay (' + soThang + ' thang'
              + (themThamNien ? ', +' + themThamNien + ' tham nien' : '') + ')');
  }

  return {
    duocHuong: lamTronNuaNgay_(tong), thangLamViec: thangLamViec, cheDo: 'NAM',
    dienGiai: 'Theo Dieu 113-114 BLLD: ' + moTa.join('; ') + '. Tong cong don = ' + tong + ' ngay.',
    thieuDuLieu: false
  };
}

/** Phép làm tròn về bội số 0.5 ngày */
function lamTronNuaNgay_(x) {
  return Math.round((Number(x) || 0) * 2) / 2;
}

/** Tổng phép đã dùng / đã thanh toán / đã điều chỉnh, đọc từ sổ cái */
function phepDaDung_(maNV, dsBienDong) {
  var ds = dsBienDong || docBang_(SH_BIENDONGPHEP);
  var ma = String(maNV).trim().toUpperCase();
  var daNghi = 0, daThanhToan = 0, dieuChinh = 0;
  for (var i = 0; i < ds.length; i++) {
    if (String(ds[i].MaNV || '').trim().toUpperCase() !== ma) continue;
    var sn = tien_(ds[i].SoNgay);
    switch (String(ds[i].Loai || '').toUpperCase()) {
      case 'TRU':        daNghi += sn; break;
      case 'THANH_TOAN': daThanhToan += sn; break;
      case 'CONG':       dieuChinh += sn; break;      // cộng thêm (thưởng phép, bù...)
      case 'DIEU_CHINH': dieuChinh += sn; break;      // số âm = trừ bớt
      default: break;
    }
  }
  return { daNghi: daNghi, daThanhToan: daThanhToan, phepCongThem: dieuChinh };
}

/** Số dư phép của 1 người tại 1 thời điểm */
function soDuPhep_(nv, denNgay, c, dsBienDong) {
  var q = tinhPhepTichLuy_(nv, denNgay, c);
  var d = phepDaDung_(nv.MaNV, dsBienDong);
  var tongDuoc = q.duocHuong + d.phepCongThem;
  return {
    MaNV: nv.MaNV, HoTen: nv.HoTen, PhongBan: nv.PhongBan || '',
    NgayVaoLam: ngayChuoi_(nv.NgayVaoLam || ''),
    ThangLamViec: q.thangLamViec, CheDo: q.cheDo,
    PhepDuocHuong: q.duocHuong, PhepCongThem: d.phepCongThem,
    TongPhepDuoc: tongDuoc,
    DaNghi: d.daNghi, DaThanhToan: d.daThanhToan,
    ConLai: lamTronNuaNgay_(tongDuoc - d.daNghi - d.daThanhToan),
    DienGiai: q.dienGiai, ThieuDuLieu: q.thieuDuLieu
  };
}

/*================= API =================*/

function hrPhepNam_(req, p) {
  var den = ngayChuoi_(req.denNgay || hnayHR_());
  var c = docCauHinhHR_();
  var bd = docBang_(SH_BIENDONGPHEP);
  var ds = docBang_(SH_HOSONV).filter(function (o) {
    if (req.gomNghiViec) return true;
    return String(o.TrangThaiLamViec || 'DANG_LAM').toUpperCase() === 'DANG_LAM';
  });

  var ra = [];
  for (var i = 0; i < ds.length; i++) ra.push(soDuPhep_(ds[i], den, c, bd));
  ra = locTheoQuyen_(p, ra);

  return {
    ok: true, denNgay: den, cheDo: chsChu_(c, 'phep_che_do', 'THANG'),
    tranMoiThang: chsSo_(c, 'phep_toi_da_moi_thang', 0),
    danhSach: ra,
    soNguoiAmPhep: ra.filter(function (x) { return x.ConLai < 0; }).length,
    soNguoiThieuNgayVao: ra.filter(function (x) { return x.ThieuDuLieu; }).length
  };
}

/** Ghi ảnh chụp quỹ phép của 1 năm vào tab PHEPNAM để xem/ in nhanh */
function hrTaoQuyPhep_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var nam = String(req.nam || new Date().getFullYear());
  var den = ngayChuoi_(req.denNgay || (nam + '-12-31'));
  var c = docCauHinhHR_();
  var bd = docBang_(SH_BIENDONGPHEP);
  var ds = docBang_(SH_HOSONV);

  // Xoá ảnh chụp cũ của năm
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PHEPNAM);
  var m = mapCot_(sh);
  if (sh.getLastRow() > 1 && m['Nam'] !== undefined) {
    var v = sh.getRange(2, m['Nam'] + 1, sh.getLastRow() - 1, 1).getValues();
    var xoa = [];
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === nam) xoa.push(i + 2);
    for (var j = xoa.length - 1; j >= 0; j--) sh.deleteRow(xoa[j]);
  }

  var n = sh.getLastColumn(), rows = [];
  for (var k = 0; k < ds.length; k++) {
    var sd = soDuPhep_(ds[k], den, c, bd);
    if (sd.TongPhepDuoc === 0 && sd.DaNghi === 0) continue;
    var dong = [];
    for (var z = 0; z < n; z++) dong.push('');
    var gan = {
      Nam: nam, MaNV: sd.MaNV, HoTen: sd.HoTen, NgayVaoLam: sd.NgayVaoLam,
      PhepChuanNam: sd.PhepDuocHuong, PhepThamNien: 0, PhepCongThem: sd.PhepCongThem,
      PhepTonKyTruoc: 0, TongPhepDuoc: sd.TongPhepDuoc,
      DaNghi: sd.DaNghi, DaThanhToan: sd.DaThanhToan, ConLai: sd.ConLai,
      HanSuDungTon: chsChu_(c, 'han_dung_phep_ton', ''),
      GhiChu: sd.DienGiai.slice(0, 500), NgayCapNhat: hnayHR_()
    };
    for (var key in gan) if (m[key] !== undefined) dong[m[key]] = gan[key];
    rows.push(dong);
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows);

  ghiNhatKy_(p.maNV, p.vaiTro, 'TAO_QUY_PHEP', nam, rows.length + ' nhan vien');
  return { ok: true, nam: nam, soNhanVien: rows.length,
           thongBao: 'Da cap nhat quy phep nam ' + nam + ' cho ' + rows.length + ' nhan vien.' };
}

/** Cộng/trừ phép thủ công (thưởng phép, chốt tồn đầu kỳ, thanh toán phép khi nghỉ việc...) */
function hrDieuChinhPhep_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var o = req.bienDong || {};
  var ma = String(o.MaNV || '').trim().toUpperCase();
  var loai = String(o.Loai || '').trim().toUpperCase();
  var soNgay = tien_(o.SoNgay);
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  if (['CONG', 'TRU', 'THANH_TOAN', 'DIEU_CHINH'].indexOf(loai) < 0) {
    return { ok: false, loi: 'Loai phai la CONG, TRU, THANH_TOAN hoac DIEU_CHINH.' };
  }
  if (!soNgay) return { ok: false, loi: 'So ngay phai khac 0.' };
  if (!String(o.LyDo || '').trim()) return { ok: false, loi: 'Phai ghi ly do dieu chinh phep.' };

  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (!nv) return { ok: false, loi: 'Khong tim thay ho so ' + ma };

  var ngay = ngayChuoi_(o.Ngay || hnayHR_());
  var sach = {
    MaBD: sinhMa_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BIENDONGPHEP), 'BD'),
    Nam: ngay.slice(0, 4), MaNV: ma, HoTen: nv.HoTen, Ngay: ngay,
    SoNgay: soNgay, Loai: loai, NguonGoc: String(o.NguonGoc || 'Nhan su dieu chinh tay'),
    MaDonLienQuan: String(o.MaDonLienQuan || ''), NguoiDuyet: p.maNV,
    GhiChu: String(o.LyDo || ''), NgayTao: nowHR_()
  };
  themDong_(SH_BIENDONGPHEP, sach);

  var sd = soDuPhep_(nv, hnayHR_(), docCauHinhHR_());
  ghiNhatKy_(p.maNV, p.vaiTro, 'DIEUCHINH_PHEP', ma, loai + ' ' + soNgay + ' ngay — ' + sach.GhiChu);
  return { ok: true, thongBao: 'Da ghi ' + loai + ' ' + soNgay + ' ngay phep cho ' + nv.HoTen
             + '. So du con lai: ' + sd.ConLai + ' ngay.', soDu: sd };
}

/**
 * Ghi ngày phép đã dùng trong kỳ vào sổ cái, lấy từ bảng công vừa chốt.
 * Chạy lại nhiều lần an toàn: xoá hết dòng có NguonGoc = "CHOT_CONG:<ky>" rồi ghi lại.
 */
function dongBoPhepTuBangCong_(ky, p) {
  var nguonGoc = 'CHOT_CONG:' + ky;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BIENDONGPHEP);
  var m = mapCot_(sh);

  // Dọn bản cũ của kỳ
  if (sh.getLastRow() > 1 && m['NguonGoc'] !== undefined) {
    var v = sh.getRange(2, m['NguonGoc'] + 1, sh.getLastRow() - 1, 1).getValues();
    var xoa = [];
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === nguonGoc) xoa.push(i + 2);
    for (var j = xoa.length - 1; j >= 0; j--) sh.deleteRow(xoa[j]);
  }

  var bc = docBang_(SH_BANGCONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  var n = sh.getLastColumn(), rows = [], soDong = 0;
  for (var k = 0; k < bc.length; k++) {
    var soPhep = tien_(bc[k].NgayPhep);
    if (!soPhep) continue;
    var dong = [];
    for (var z = 0; z < n; z++) dong.push('');
    var gan = {
      MaBD: 'BD-' + ky + '-' + String(bc[k].MaNV),
      Nam: ky.slice(0, 4), MaNV: bc[k].MaNV, HoTen: bc[k].HoTen,
      Ngay: ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2),
      SoNgay: soPhep, Loai: 'TRU', NguonGoc: nguonGoc, MaDonLienQuan: '',
      NguoiDuyet: p ? p.maNV : 'HE_THONG',
      GhiChu: 'Tu dong tu bang cong ky ' + ky, NgayTao: nowHR_()
    };
    for (var key in gan) if (m[key] !== undefined) dong[m[key]] = gan[key];
    rows.push(dong); soDong++;
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows);
  return { soDongGhi: soDong, nguonGoc: nguonGoc };
}

/** Đồng bộ lại sổ phép từ đơn nghỉ phép đã duyệt (dùng khi chưa chốt công) */
function hrDongBoPhepTuDon_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = tinhCongCaCongTy_(ky);

  var nguonGoc = 'DON_DUYET:' + ky;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BIENDONGPHEP);
  var m = mapCot_(sh);
  if (sh.getLastRow() > 1 && m['NguonGoc'] !== undefined) {
    var v = sh.getRange(2, m['NguonGoc'] + 1, sh.getLastRow() - 1, 1).getValues();
    var xoa = [];
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === nguonGoc) xoa.push(i + 2);
    for (var j = xoa.length - 1; j >= 0; j--) sh.deleteRow(xoa[j]);
  }

  var n = sh.getLastColumn(), rows = [];
  for (var k = 0; k < ds.length; k++) {
    if (!ds[k].NgayPhep) continue;
    var dong = [];
    for (var z = 0; z < n; z++) dong.push('');
    var gan = {
      MaBD: 'BD-TAM-' + ky + '-' + ds[k].MaNV, Nam: ky.slice(0, 4),
      MaNV: ds[k].MaNV, HoTen: ds[k].HoTen,
      Ngay: ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2),
      SoNgay: ds[k].NgayPhep, Loai: 'TRU', NguonGoc: nguonGoc, MaDonLienQuan: '',
      NguoiDuyet: p.maNV, GhiChu: 'Tam tinh tu don da duyet, chua chot cong', NgayTao: nowHR_()
    };
    for (var key in gan) if (m[key] !== undefined) dong[m[key]] = gan[key];
    rows.push(dong);
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows);
  return { ok: true, ky: ky, soDongGhi: rows.length,
           thongBao: 'Da dong bo ' + rows.length + ' dong phep tam tinh cho ky ' + ky + '.' };
}

/**
 * Kiểm tra số dư phép trước khi duyệt đơn — chặn cảnh báo phép âm.
 * Gọi được từ app chấm công khi trưởng bộ phận bấm Duyệt trong email.
 */
function kiemTraDuPhep_(maNV, soNgayXin) {
  var c = docCauHinhHR_();
  if (!chsBat_(c, 'chan_nghi_qua_phep', true)) return { du: true };
  var nv = timDong_(SH_HOSONV, { MaNV: String(maNV).trim().toUpperCase() });
  if (!nv) return { du: true, canhBao: 'Chua co ho so nhan su, khong kiem tra duoc phep.' };
  var sd = soDuPhep_(nv, hnayHR_(), c);
  var con = sd.ConLai - tien_(soNgayXin);
  if (con >= 0) return { du: true, soDuSauKhiDuyet: con, soDuHienTai: sd.ConLai };
  return {
    du: false, soDuHienTai: sd.ConLai, thieu: Math.abs(con),
    canhBao: 'So du phep chi con ' + sd.ConLai + ' ngay, xin ' + soNgayXin
           + ' ngay -> thieu ' + Math.abs(con) + ' ngay. Phan thieu se tinh NGHI KHONG LUONG.'
  };
}

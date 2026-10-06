/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_KPI.gs   (Thưởng KPI & hoa hồng)
 * ----------------------------------------------------------------------------
 *  Cài đúng 2 khung chính sách sếp Liên đã chốt:
 *
 *  A. BẬC THANG DOANH THU (team Telesale/Sale, áp dụng từ T9/2026)
 *     - Bậc hoa hồng cá nhân: 50-60tr -> 2%/LCB 7tr · 60-90tr -> 4%/LCB 8tr
 *       90-130tr -> 6%/LCB 9tr · >130tr -> 8%/LCB 10tr
 *     - He so dat san = MIN(1, doanh thu cong ty thang / 500tr), nhan vao
 *       % HOA HONG (khong nhan vao LCB — LCB la luong cung, luon tra du).
 *     - Thuong lich hen: 15-25 hen -> 50k/hen · tu 25 hen -> 70k/hen
 *     - Doanh so xep bac luon la so thu TRUOC VAT = so thu / 1,08
 *       (sep chot 01/10/2026, moi hinh thuc thanh toan).
 *
 *  B. KHUNG KPI CHUYÊN GIA TÂM LÝ (17/09/2026) — don vi tinh la HO SO
 *     - Ghep doi (dong y gap mat): 100k/ho so, CHI chi khi > 10 ho so/thang
 *     - Dong y tim hieu: 100k/ho so (khong nguong)
 *     - Xac nhan hen ho sau 1 thang: 200k/ho so (khong nguong)
 *     - Tong > 16 ho so/thang: +1.000.000d
 *     - Thuong doanh so: 5% x doanh so duoc chia, KHONG nhan he so san
 *     - Khong di bac thang telesale, khong LCB, khong thuong lich hen
 * ============================================================================
 */

var KPI_VAI_TRO = ['telesale', 'leader', 'tamly', 'khac'];

/** Ghi 1 tham số vào CAUHINH_HR (tạo mới nếu chưa có) */
function ghiCauHinhHR_(khoa, giaTri, moTa) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CAUHINHHR);
  var soDong = Math.max(1, sh.getLastRow() - 1);
  var v = sh.getRange(2, 1, soDong, 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === khoa) {
      sh.getRange(i + 2, 2).setValue(String(giaTri));
      return;
    }
  }
  sh.appendRow([khoa, String(giaTri), moTa || '', 'Ghi tu cong nhan su']);
}

/*================= ĐỌC BẬC =================*/

/** "tuDoanhSo:pct:lcb|..." -> [{tu, pct, lcb}] sắp theo tu tăng dần */
function docBacHoaHong_(c) {
  var s = chsChu_(c, 'bac_hoa_hong', '');
  var ra = [], phan = s.split('|');
  for (var i = 0; i < phan.length; i++) {
    var x = phan[i].split(':');
    if (x.length < 2) continue;
    ra.push({ tu: tien_(x[0]), pct: tien_(x[1]), lcb: tien_(x[2]) });
  }
  ra.sort(function (a, b) { return a.tu - b.tu; });
  return ra;
}

/** "tuSoHen:tienMoiHen|..." -> [{tu, tien}] */
function docBacLichHen_(c) {
  var s = chsChu_(c, 'thuong_lich_hen', '');
  var ra = [], phan = s.split('|');
  for (var i = 0; i < phan.length; i++) {
    var x = phan[i].split(':');
    if (x.length < 2) continue;
    ra.push({ tu: tien_(x[0]), tien: tien_(x[1]) });
  }
  ra.sort(function (a, b) { return a.tu - b.tu; });
  return ra;
}

/** Bậc cao nhất mà giá trị đạt tới */
function bacDatDuoc_(bac, giaTri) {
  var chon = null;
  for (var i = 0; i < bac.length; i++) if (giaTri >= bac[i].tu) chon = bac[i];
  return chon;
}

/*================= TÍNH KPI MỘT NGƯỜI =================*/

/**
 * dl = { MaNV, VaiTroKPI, DoanhSoTruocVAT, SoLichHen,
 *        SoHoSoGhepDoi, SoHoSoTimHieu, SoHoSoHenHo }
 * doanhThuCty = doanh thu toàn công ty của kỳ (trước VAT), để tính hệ số đạt sàn
 */
function tinhKPIMotNguoi_(dl, doanhThuCty, c) {
  var vai = String(dl.VaiTroKPI || 'khac').trim().toLowerCase();
  var doanhSo = tien_(dl.DoanhSoTruocVAT);
  var dienGiai = [];

  var san = chsSo_(c, 'san_doanh_thu_cty', 500000000);
  var heSo = san > 0 ? Math.min(1, tien_(doanhThuCty) / san) : 1;
  heSo = Math.round(heSo * 10000) / 10000;

  var tyLe = 0, hoaHong = 0, lcb = 0, thuongHen = 0;
  var thuongHoSo = 0, thuongVuot = 0, thuongMoc = tien_(dl.ThuongMocDoanhThu);

  if (vai === 'telesale' || vai === 'leader') {
    var bac = bacDatDuoc_(docBacHoaHong_(c), doanhSo);
    if (bac) {
      tyLe = bac.pct;
      lcb  = bac.lcb;
      hoaHong = Math.round(doanhSo * (tyLe / 100) * heSo);
      dienGiai.push('Doanh so truoc VAT ' + dinhDang_(doanhSo) + ' -> bac ' + tyLe
        + '%, LCB ' + dinhDang_(lcb) + '. Hoa hong = ' + dinhDang_(doanhSo) + ' x ' + tyLe
        + '% x he so dat san ' + heSo + ' = ' + dinhDang_(hoaHong) + 'd.');
      dienGiai.push('LCB tra du 100% (' + dinhDang_(lcb) + 'd), KHONG nhan he so dat san.');
    } else {
      dienGiai.push('Doanh so ' + dinhDang_(doanhSo) + ' chua dat bac thap nhat -> khong co hoa hong va LCB theo bac.');
    }

    var bacHen = bacDatDuoc_(docBacLichHen_(c), tien_(dl.SoLichHen));
    if (bacHen) {
      thuongHen = Math.round(tien_(dl.SoLichHen) * bacHen.tien);
      dienGiai.push(tien_(dl.SoLichHen) + ' lich hen x ' + dinhDang_(bacHen.tien)
        + 'd/hen = ' + dinhDang_(thuongHen) + 'd.');
    }
  }
  else if (vai === 'tamly') {
    var pct = chsSo_(c, 'pct_thuong_tamly', 5);
    hoaHong = Math.round(doanhSo * pct / 100);           // KHÔNG nhân hệ số sàn
    tyLe = pct;
    dienGiai.push('Thuong doanh so tam ly: ' + dinhDang_(doanhSo) + ' x ' + pct
      + '% = ' + dinhDang_(hoaHong) + 'd (khong nhan he so dat san, theo chot 18/09/2026).');

    var gd = tien_(dl.SoHoSoGhepDoi), th = tien_(dl.SoHoSoTimHieu), hh = tien_(dl.SoHoSoHenHo);
    var nguongGD = chsSo_(c, 'tamly_nguong_ghepdoi', 10);
    if (gd > nguongGD) {
      var tGD = gd * chsSo_(c, 'tamly_thuong_ghepdoi', 100000);
      thuongHoSo += tGD;
      dienGiai.push(gd + ' ho so ghep doi (> nguong ' + nguongGD + ') -> '
        + dinhDang_(tGD) + 'd.');
    } else if (gd > 0) {
      dienGiai.push(gd + ' ho so ghep doi, chua vuot nguong ' + nguongGD
        + ' -> chua duoc thuong muc nay.');
    }
    if (th > 0) {
      var tTH = th * chsSo_(c, 'tamly_thuong_timhieu', 100000);
      thuongHoSo += tTH;
      dienGiai.push(th + ' ho so dong y tim hieu -> ' + dinhDang_(tTH) + 'd.');
    }
    if (hh > 0) {
      var tHH = hh * chsSo_(c, 'tamly_thuong_henho', 200000);
      thuongHoSo += tHH;
      dienGiai.push(hh + ' ho so xac nhan hen ho -> ' + dinhDang_(tHH) + 'd.');
    }
    var tong = gd + th + hh;
    var nguongVuot = chsSo_(c, 'tamly_nguong_vuot', 16);
    if (tong > nguongVuot) {
      thuongVuot = chsSo_(c, 'tamly_thuong_vuot', 1000000);
      dienGiai.push('Tong ' + tong + ' ho so (> ' + nguongVuot + ') -> thuong vuot chi tieu '
        + dinhDang_(thuongVuot) + 'd.');
    }
  }
  else {
    dienGiai.push('Vai tro KPI "' + vai + '" khong co cong thuc tu dong — nhap tien thuong tay vao cot ThuongKhac.');
  }

  var tongThuong = hoaHong + lcb + thuongHen + thuongHoSo + thuongVuot + thuongMoc;
  return {
    MaNV: dl.MaNV, VaiTroKPI: vai,
    DoanhSoTruocVAT: doanhSo, HeSoDatSan: heSo,
    TyLeHoaHong: tyLe, TienHoaHong: hoaHong, LCBTheoBac: lcb,
    SoLichHen: tien_(dl.SoLichHen), ThuongLichHen: thuongHen,
    SoHoSoGhepDoi: tien_(dl.SoHoSoGhepDoi), SoHoSoTimHieu: tien_(dl.SoHoSoTimHieu),
    SoHoSoHenHo: tien_(dl.SoHoSoHenHo), ThuongHoSo: thuongHoSo,
    ThuongVuotChiTieu: thuongVuot, ThuongMocDoanhThu: thuongMoc,
    TongThuongKPI: tongThuong, DienGiai: dienGiai.join(' ')
  };
}

function dinhDang_(x) {
  return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/*================= API =================*/

/** Nhập/ sửa số liệu KPI thô của 1 người trong kỳ, rồi tính luôn tiền thưởng */
function hrLuuKPI_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var o = req.kpi || {};
  var ky = kyChuoi_(o.Ky || req.ky || kyHienTai_());
  var ma = String(o.MaNV || '').trim().toUpperCase();
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };

  var vai = String(o.VaiTroKPI || 'khac').trim().toLowerCase();
  if (KPI_VAI_TRO.indexOf(vai) < 0) {
    return { ok: false, loi: 'VaiTroKPI phai la: ' + KPI_VAI_TRO.join(', ') };
  }
  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (!nv) return { ok: false, loi: 'Khong tim thay ho so ' + ma };

  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (ky1 && ['DA_CHOT_LUONG', 'DA_CHI'].indexOf(String(ky1.TrangThai || '').toUpperCase()) >= 0) {
    return { ok: false, loi: 'Ky ' + ky + ' da chot luong, khong sua KPI duoc. Mo lai ky truoc.' };
  }

  var c = docCauHinhHR_();

  // Doanh số: nhận số thu gộp (có VAT) hoặc số đã trước VAT
  var doanhSo = tien_(o.DoanhSoTruocVAT);
  if (!doanhSo && tien_(o.SoThuGomVAT)) {
    var hs = chsSo_(c, 'ty_le_vat_quy_doi', 1.08);
    doanhSo = Math.round(tien_(o.SoThuGomVAT) / (hs || 1));
  }

  // Doanh thu công ty của kỳ (để tính hệ số đạt sàn) — lưu lại để tính lại khớp
  var khoaDT = 'doanh_thu_cty_' + ky;
  var doanhThuCty = tien_(req.doanhThuCongTy);
  if (doanhThuCty) {
    ghiCauHinhHR_(khoaDT, doanhThuCty, 'Doanh thu truoc VAT toan cong ty ky ' + ky);
    c[khoaDT] = String(doanhThuCty);
  } else {
    doanhThuCty = chsSo_(c, khoaDT, 0);
  }

  var kq = tinhKPIMotNguoi_({
    MaNV: ma, VaiTroKPI: vai, DoanhSoTruocVAT: doanhSo,
    SoLichHen: o.SoLichHen, SoHoSoGhepDoi: o.SoHoSoGhepDoi,
    SoHoSoTimHieu: o.SoHoSoTimHieu, SoHoSoHenHo: o.SoHoSoHenHo,
    ThuongMocDoanhThu: o.ThuongMocDoanhThu
  }, doanhThuCty, c);

  var sach = {
    Ky: ky, MaNV: ma, HoTen: nv.HoTen, PhongBan: nv.PhongBan || '',
    VaiTroKPI: kq.VaiTroKPI, DoanhSoTruocVAT: kq.DoanhSoTruocVAT, HeSoDatSan: kq.HeSoDatSan,
    TyLeHoaHong: kq.TyLeHoaHong, TienHoaHong: kq.TienHoaHong, LCBTheoBac: kq.LCBTheoBac,
    SoLichHen: kq.SoLichHen, ThuongLichHen: kq.ThuongLichHen,
    SoHoSoGhepDoi: kq.SoHoSoGhepDoi, SoHoSoTimHieu: kq.SoHoSoTimHieu,
    SoHoSoHenHo: kq.SoHoSoHenHo, ThuongHoSo: kq.ThuongHoSo,
    ThuongVuotChiTieu: kq.ThuongVuotChiTieu, ThuongMocDoanhThu: kq.ThuongMocDoanhThu,
    TongThuongKPI: kq.TongThuongKPI, TrangThai: 'TAM_TINH',
    GhiChu: kq.DienGiai.slice(0, 900), NgayTinh: hnayHR_()
  };

  var cu = timDong_(SH_KPI, { Ky: ky, MaNV: ma });
  if (cu) suaDong_(SH_KPI, cu._dong, sach);
  else themDong_(SH_KPI, sach);

  ghiNhatKy_(p.maNV, p.vaiTro, 'LUU_KPI', ky + '/' + ma,
             vai + ' doanh so ' + doanhSo + ' -> thuong ' + kq.TongThuongKPI);
  return { ok: true, ky: ky, kpi: kq, doanhThuCongTy: doanhThuCty,
           thongBao: 'Da luu KPI ' + nv.HoTen + ' ky ' + ky + ': tong thuong '
                   + dinhDang_(kq.TongThuongKPI) + 'd.' };
}

function hrDanhSachKPI_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = docBang_(SH_KPI).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (!duocXemLuong_(p)) {
    ds = ds.filter(function (x) {
      return String(x.MaNV).trim().toUpperCase() === p.maNV.toUpperCase();
    });
  }
  var c = docCauHinhHR_();
  return {
    ok: true, ky: ky, danhSach: ds, tong: ds.length,
    doanhThuCongTy: chsSo_(c, 'doanh_thu_cty_' + ky, 0),
    sanDoanhThu: chsSo_(c, 'san_doanh_thu_cty', 500000000),
    tongThuong: ds.reduce(function (s, x) { return s + tien_(x.TongThuongKPI); }, 0)
  };
}

/** Tính lại toàn bộ KPI của kỳ (vd sau khi cập nhật doanh thu công ty) */
function hrTinhKPI_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var ky = kyChuoi_(req.ky || kyHienTai_());
  var c = docCauHinhHR_();
  var khoaDT = 'doanh_thu_cty_' + ky;
  var doanhThuCty = tien_(req.doanhThuCongTy) || chsSo_(c, khoaDT, 0);
  if (tien_(req.doanhThuCongTy)) {
    ghiCauHinhHR_(khoaDT, doanhThuCty, 'Doanh thu truoc VAT toan cong ty ky ' + ky);
    c[khoaDT] = String(doanhThuCty);
  }

  var ds = docBang_(SH_KPI).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (!ds.length) return { ok: false, loi: 'Chua co du lieu KPI ky ' + ky + '.' };

  var dem = 0;
  for (var i = 0; i < ds.length; i++) {
    var kq = tinhKPIMotNguoi_(ds[i], doanhThuCty, c);
    suaDong_(SH_KPI, ds[i]._dong, {
      HeSoDatSan: kq.HeSoDatSan, TyLeHoaHong: kq.TyLeHoaHong, TienHoaHong: kq.TienHoaHong,
      LCBTheoBac: kq.LCBTheoBac, ThuongLichHen: kq.ThuongLichHen, ThuongHoSo: kq.ThuongHoSo,
      ThuongVuotChiTieu: kq.ThuongVuotChiTieu, TongThuongKPI: kq.TongThuongKPI,
      GhiChu: kq.DienGiai.slice(0, 900), NgayTinh: hnayHR_()
    });
    dem++;
  }
  ghiNhatKy_(p.maNV, p.vaiTro, 'TINH_LAI_KPI', ky, dem + ' nguoi, doanh thu cty ' + doanhThuCty);
  return { ok: true, ky: ky, soNguoi: dem, doanhThuCongTy: doanhThuCty,
           heSoDatSan: chsSo_(c, 'san_doanh_thu_cty', 500000000) > 0
             ? Math.min(1, doanhThuCty / chsSo_(c, 'san_doanh_thu_cty', 500000000)) : 1,
           thongBao: 'Da tinh lai KPI ky ' + ky + ' cho ' + dem + ' nguoi.' };
}

/*================= KHOẢN KHÁC =================*/

var KHOAN_KHAC_LOAI = ['TAM_UNG', 'THU_NHAP_KHAC', 'THUONG_KHAC', 'GIAM_TRU_KHAC',
                       'TRUY_THU', 'TRUY_LINH', 'DA_CHI_GIUA_KY'];

function hrLuuKhoanKhac_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var o = req.khoan || {};
  var ky = kyChuoi_(o.Ky || req.ky || kyHienTai_());
  var ma = String(o.MaNV || '').trim().toUpperCase();
  var loai = String(o.Loai || '').trim().toUpperCase();
  var st = tien_(o.SoTien);

  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  if (KHOAN_KHAC_LOAI.indexOf(loai) < 0) {
    return { ok: false, loi: 'Loai phai la: ' + KHOAN_KHAC_LOAI.join(', ') };
  }
  if (!st) return { ok: false, loi: 'So tien phai khac 0.' };

  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (!nv) return { ok: false, loi: 'Khong tim thay ho so ' + ma };

  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (ky1 && ['DA_CHOT_LUONG', 'DA_CHI'].indexOf(String(ky1.TrangThai || '').toUpperCase()) >= 0) {
    return { ok: false, loi: 'Ky ' + ky + ' da chot luong. Mo lai ky truoc khi them khoan.' };
  }

  var sach = {
    MaKhoan: sinhMa_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KHOANKHAC), 'KK'),
    Ky: ky, MaNV: ma, HoTen: nv.HoTen, Loai: loai,
    TenKhoan: String(o.TenKhoan || loai), SoTien: st,
    ChiuThue: String(o.ChiuThue || 'CO').toUpperCase(),
    TrangThai: 'DA_DUYET', NguoiDuyet: p.maNV,
    GhiChu: String(o.GhiChu || ''), NgayTao: hnayHR_(), NguoiTao: p.maNV
  };

  var cu = o.MaKhoan ? timDong_(SH_KHOANKHAC, { MaKhoan: o.MaKhoan }) : null;
  if (cu) { sach.MaKhoan = cu.MaKhoan; suaDong_(SH_KHOANKHAC, cu._dong, sach); }
  else themDong_(SH_KHOANKHAC, sach);

  ghiNhatKy_(p.maNV, p.vaiTro, 'LUU_KHOAN_KHAC', ky + '/' + ma, loai + ' ' + st);
  return { ok: true, maKhoan: sach.MaKhoan,
           thongBao: 'Da ghi ' + loai + ' ' + dinhDang_(st) + 'd cho ' + nv.HoTen + ' ky ' + ky
                   + '. Chay lai Tinh luong de cap nhat bang luong.' };
}

function hrDanhSachKhoanKhac_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = docBang_(SH_KHOANKHAC).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (!duocXemLuong_(p)) {
    ds = ds.filter(function (x) {
      return String(x.MaNV).trim().toUpperCase() === p.maNV.toUpperCase();
    });
  }
  return { ok: true, ky: ky, danhSach: ds, tong: ds.length, cacLoai: KHOAN_KHAC_LOAI };
}

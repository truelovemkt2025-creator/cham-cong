/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_BaoCao.gs
 * ----------------------------------------------------------------------------
 *  Báo cáo tổng quan, chi phí nhân sự, và menu điều khiển ngay trong Sheet.
 * ============================================================================
 */

/*================= TỔNG QUAN =================*/

function hrTongQuan_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var hs = docBang_(SH_HOSONV);
  var dangLam = hs.filter(function (x) {
    return String(x.TrangThaiLamViec || 'DANG_LAM').toUpperCase() === 'DANG_LAM';
  });

  // Nhân sự theo phòng ban
  var theoPhong = {};
  for (var i = 0; i < dangLam.length; i++) {
    var pb = String(dangLam[i].PhongBan || 'Chua phan phong').trim() || 'Chua phan phong';
    theoPhong[pb] = (theoPhong[pb] || 0) + 1;
  }

  // Nhân sự theo loại hợp đồng
  var hd = docBang_(SH_HOPDONG).filter(function (x) {
    return String(x.TrangThai || '').toUpperCase() === 'HIEU_LUC';
  });
  var theoLoaiHD = {};
  for (var j = 0; j < hd.length; j++) {
    var l = String(hd[j].LoaiHD || 'Chua khai').trim() || 'Chua khai';
    theoLoaiHD[l] = (theoLoaiHD[l] || 0) + 1;
  }

  // Vào / ra trong kỳ
  var dauKy = ky + '-01', cuoiKy = ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2);
  var vaoTrongKy = hs.filter(function (x) {
    var v = ngayChuoi_(x.NgayVaoLam || '');
    return v >= dauKy && v <= cuoiKy;
  });
  var raTrongKy = hs.filter(function (x) {
    var v = ngayChuoi_(x.NgayNghiViec || '');
    return v >= dauKy && v <= cuoiKy;
  });

  var kq = {
    ok: true, ky: ky,
    tongNhanSu: dangLam.length,
    theoPhongBan: theoPhong, theoLoaiHopDong: theoLoaiHD,
    vaoTrongKy: vaoTrongKy.length, nghiTrongKy: raTrongKy.length,
    tyLeNghiViec: dangLam.length
      ? Math.round(raTrongKy.length / dangLam.length * 1000) / 10 : 0
  };

  // Trạng thái kỳ
  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  kq.trangThaiKy = ky1 ? String(ky1.TrangThai || 'MO') : 'CHUA_TAO';

  // Phần số liệu lương chỉ hiện với người có quyền
  if (duocXemLuong_(p)) {
    var bl = docBang_(SH_BANGLUONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
    kq.luong = {
      soNguoiCoLuong: bl.length,
      tongThucNhan: bl.reduce(function (s, x) { return s + tien_(x.ThucNhan); }, 0),
      tongThuNhap:  bl.reduce(function (s, x) { return s + tien_(x.TongThuNhap); }, 0),
      tongBaoHiemNLD: bl.reduce(function (s, x) { return s + tien_(x.TongBaoHiemNLD); }, 0),
      tongBaoHiemCongTy: bl.reduce(function (s, x) { return s + tien_(x.TongBaoHiemCongTy); }, 0),
      tongThueTNCN: bl.reduce(function (s, x) { return s + tien_(x.ThueTNCN); }, 0),
      tongChiPhiNhanSu: bl.reduce(function (s, x) {
        return s + tien_(x.TongThuNhap) + tien_(x.TongBaoHiemCongTy);
      }, 0)
    };
  }

  // Công
  var bc = docBang_(SH_BANGCONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (bc.length) {
    kq.cong = {
      daChot: true,
      tongCong: bc.reduce(function (s, x) { return s + tien_(x.TongCongTinhLuong); }, 0),
      tongNgayPhep: bc.reduce(function (s, x) { return s + tien_(x.NgayPhep); }, 0),
      tongNgayKhongLuong: bc.reduce(function (s, x) { return s + tien_(x.NgayNghiKhongLuong); }, 0),
      tongLanDiTre: bc.reduce(function (s, x) { return s + tien_(x.SoLanDiTreVeSom); }, 0),
      soNguoiDiTre: bc.filter(function (x) { return tien_(x.SoLanDiTreVeSom) > 0; }).length
    };
  } else {
    kq.cong = { daChot: false };
  }

  // Cảnh báo nhân sự (chỉ ADMIN/HR)
  if (p.vaiTro === 'ADMIN' || p.vaiTro === 'HR') {
    var cb = hrCanhBao_({}, p);
    kq.canhBao = {
      hopDongSapHetHan: cb.hopDongSapHetHan ? cb.hopDongSapHetHan.length : 0,
      chuaCoHopDong: cb.chuaCoHopDong ? cb.chuaCoHopDong.length : 0,
      hoSoConThieu: cb.hoSoConThieu ? cb.hoSoConThieu.length : 0,
      chiTiet: cb
    };
    // Người âm phép
    var ph = hrPhepNam_({}, p);
    kq.canhBao.amPhep = ph.soNguoiAmPhep || 0;
    kq.canhBao.thieuNgayVaoLam = ph.soNguoiThieuNgayVao || 0;
  }

  return kq;
}

/*================= CHI PHÍ NHÂN SỰ =================*/

/** Chi phí nhân sự thật của công ty: thu nhập + phần bảo hiểm công ty đóng + KPCĐ */
function hrChiPhiNhanSu_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var soKy = Math.min(24, Math.max(1, tien_(req.soKy) || 6));
  var denKy = kyChuoi_(req.ky || kyHienTai_());
  var bl = docBang_(SH_BANGLUONG);

  // Danh sách kỳ cần lấy, lùi dần từ denKy
  var dsKy = [];
  var nam = Number(denKy.slice(0, 4)), thang = Number(denKy.slice(5, 7));
  for (var i = 0; i < soKy; i++) {
    dsKy.unshift(nam + '-' + ('0' + thang).slice(-2));
    thang--;
    if (thang === 0) { thang = 12; nam--; }
  }

  var theoKy = [], theoPhongTong = {};
  for (var k = 0; k < dsKy.length; k++) {
    var ky = dsKy[k];
    var ds = bl.filter(function (x) { return kyChuoi_(x.Ky) === ky; });
    if (!ds.length) { theoKy.push({ Ky: ky, CoDuLieu: false }); continue; }

    var thuNhap = ds.reduce(function (s, x) { return s + tien_(x.TongThuNhap); }, 0);
    var bhCty   = ds.reduce(function (s, x) { return s + tien_(x.TongBaoHiemCongTy); }, 0);
    var thucNhan = ds.reduce(function (s, x) { return s + tien_(x.ThucNhan); }, 0);

    for (var j = 0; j < ds.length; j++) {
      var pb = String(ds[j].PhongBan || 'Chua phan phong').trim() || 'Chua phan phong';
      if (!theoPhongTong[pb]) theoPhongTong[pb] = { soNguoi: 0, chiPhi: 0 };
      theoPhongTong[pb].chiPhi += tien_(ds[j].TongThuNhap) + tien_(ds[j].TongBaoHiemCongTy);
    }

    theoKy.push({
      Ky: ky, CoDuLieu: true, SoNhanVien: ds.length,
      TongThuNhap: thuNhap, BaoHiemCongTy: bhCty,
      ChiPhiNhanSu: thuNhap + bhCty, TongThucNhan: thucNhan,
      ThueTNCN: ds.reduce(function (s, x) { return s + tien_(x.ThueTNCN); }, 0),
      BaoHiemNLD: ds.reduce(function (s, x) { return s + tien_(x.TongBaoHiemNLD); }, 0),
      ChiPhiBinhQuan: ds.length ? Math.round((thuNhap + bhCty) / ds.length) : 0
    });
  }

  // Phòng ban của kỳ cuối
  var kyCuoi = bl.filter(function (x) { return kyChuoi_(x.Ky) === denKy; });
  var theoPhong = {};
  for (var z = 0; z < kyCuoi.length; z++) {
    var pb2 = String(kyCuoi[z].PhongBan || 'Chua phan phong').trim() || 'Chua phan phong';
    if (!theoPhong[pb2]) theoPhong[pb2] = { soNguoi: 0, chiPhi: 0, thucNhan: 0 };
    theoPhong[pb2].soNguoi++;
    theoPhong[pb2].chiPhi += tien_(kyCuoi[z].TongThuNhap) + tien_(kyCuoi[z].TongBaoHiemCongTy);
    theoPhong[pb2].thucNhan += tien_(kyCuoi[z].ThucNhan);
  }

  return { ok: true, denKy: denKy, soKy: soKy, theoKy: theoKy,
           theoPhongBanKyCuoi: theoPhong };
}

/*================= THAM SỐ ĐANG ÁP DỤNG =================*/

/**
 * Trả về các tham số pháp lý ĐANG ÁP DỤNG CHO KỲ đó — tức là đã qua
 * chsSoKy_, nên nếu xem kỳ 03/2026 sẽ thấy đúng mức tham chiếu cũ 2,34tr.
 */
function hrThamSo_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var ky = kyChuoi_(req.ky || kyHienTai_());
  var c = docCauHinhHR_();

  function mucSo(khoa, ten, theoKy) {
    return { khoa: khoa, ten: ten,
             giaTri: dinhDangTien_(theoKy ? chsSoKy_(c, khoa, ky, 0) : chsSo_(c, khoa, 0)),
             canCu: canCu_(khoa) };
  }
  function mucPct(khoa, ten) {
    return { khoa: khoa, ten: ten, giaTri: chsSo_(c, khoa, 0) + '%', canCu: canCu_(khoa) };
  }
  function mucChu(khoa, ten) {
    return { khoa: khoa, ten: ten, giaTri: chsChu_(c, khoa, '—'), canCu: canCu_(khoa) };
  }

  var tranBH   = chsSoKy_(c, 'he_so_tran_bhxh', ky, 20) * chsSoKy_(c, 'muc_tham_chieu_bhxh', ky, 0);
  var tranBHTN = chsSoKy_(c, 'he_so_tran_bhtn', ky, 20) * chsSoKy_(c, 'luong_toi_thieu_vung', ky, 0);

  var nhom = [
    { ten: 'Ngày công', muc: [
      mucSo('cong_chuan_thang', 'Công chuẩn mỗi tháng'),
      mucSo('tran_cong_thang', 'Trần công + lễ + phép mỗi tháng'),
      mucSo('lam_tron_luong', 'Làm tròn lương tới'),
      mucSo('gio_lam_chuan_ngay', 'Giờ làm chuẩn mỗi ngày')
    ]},
    { ten: 'Mức lương nền', muc: [
      mucSo('luong_toi_thieu_vung', 'Lương tối thiểu vùng I', true),
      mucSo('muc_tham_chieu_bhxh', 'Mức tham chiếu tính BHXH', true),
      { khoa: '(tính ra)', ten: 'Trần đóng BHXH / BHYT', giaTri: dinhDangTien_(tranBH),
        canCu: 'Dieu 31 Luat BHXH 2024' },
      { khoa: '(tính ra)', ten: 'Trần đóng BHTN', giaTri: dinhDangTien_(tranBHTN),
        canCu: 'Luat Viec lam 2025' }
    ]},
    { ten: 'Bảo hiểm người lao động chịu', muc: [
      mucPct('ty_le_bhxh_nld', 'BHXH'), mucPct('ty_le_bhyt_nld', 'BHYT'),
      mucPct('ty_le_bhtn_nld', 'BHTN'),
      { khoa: '(tổng)', ten: 'Tổng trừ vào lương',
        giaTri: (chsSo_(c, 'ty_le_bhxh_nld', 0) + chsSo_(c, 'ty_le_bhyt_nld', 0)
                 + chsSo_(c, 'ty_le_bhtn_nld', 0)) + '%', canCu: '' }
    ]},
    { ten: 'Bảo hiểm công ty đóng', muc: [
      mucPct('ty_le_bhxh_cty', 'BHXH (hưu trí 14% + ốm đau, thai sản 3%)'),
      mucPct('ty_le_bhyt_cty', 'BHYT'), mucPct('ty_le_bhtn_cty', 'BHTN'),
      mucPct('ty_le_bhtnld_cty', 'Tai nạn lao động - bệnh nghề nghiệp'),
      mucPct('ty_le_kpcd_cty', 'Kinh phí công đoàn'),
      { khoa: '(tổng)', ten: 'Tổng công ty chịu thêm',
        giaTri: (chsSo_(c, 'ty_le_bhxh_cty', 0) + chsSo_(c, 'ty_le_bhyt_cty', 0)
                 + chsSo_(c, 'ty_le_bhtn_cty', 0) + chsSo_(c, 'ty_le_bhtnld_cty', 0)
                 + chsSo_(c, 'ty_le_kpcd_cty', 0)) + '%', canCu: '' },
      mucChu('loai_hd_dong_bh', 'Loại hợp đồng phải đóng bảo hiểm'),
      mucSo('mien_dong_bh_tu_ngay_nghi', 'Miễn đóng khi nghỉ không lương từ (ngày)')
    ]},
    { ten: 'Thuế thu nhập cá nhân', muc: [
      mucSo('giam_tru_ban_than', 'Giảm trừ bản thân', true),
      mucSo('giam_tru_phu_thuoc', 'Giảm trừ mỗi người phụ thuộc', true),
      mucChu('bac_thue', 'Biểu thuế lũy tiến (trần bậc : thuế suất)'),
      mucPct('ty_le_khau_tru_tv_ctv', 'Khấu trừ thẳng với thử việc / CTV'),
      mucSo('nguong_khau_tru_tv_ctv', 'Ngưỡng bắt đầu khấu trừ', true),
      mucSo('mien_thue_an_trua', 'Tiền ăn trưa được miễn thuế', true)
    ]},
    { ten: 'Phép năm', muc: [
      mucChu('phep_che_do', 'Chế độ tính phép'),
      mucSo('phep_moi_thang', 'Chế độ THÁNG: ngày phép mỗi tháng'),
      mucSo('phep_bo_qua_thang_dau', 'Chế độ THÁNG: bỏ qua số tháng đầu'),
      mucSo('phep_toi_da_moi_thang', 'Tối đa ngày phép dùng mỗi tháng'),
      mucSo('phep_chuan_nam', 'Chế độ NĂM: ngày phép mỗi năm'),
      mucSo('phep_tham_nien_moi_nam', 'Chế độ NĂM: +1 ngày mỗi số năm'),
      mucChu('chan_nghi_qua_phep', 'Cảnh báo khi nghỉ quá số dư phép'),
      mucChu('thanh_toan_phep_nghi_viec', 'Thanh toán phép chưa nghỉ khi nghỉ việc')
    ]},
    { ten: 'Chuyên cần & chế tài', muc: [
      mucSo('phu_cap_chuyen_can', 'Phụ cấp chuyên cần mỗi tháng'),
      mucSo('chuyen_can_so_lan_tre_toi_da', 'Số lần trễ tối đa vẫn được chuyên cần'),
      mucChu('tru_tien_quy_vao_luong', 'Trừ tiền quỹ vào lương (phải là KHONG)')
    ]},
    { ten: 'Tăng ca', muc: [
      mucPct('ty_le_tang_ca_thuong', 'Làm thêm ngày thường'),
      mucPct('ty_le_tang_ca_cn', 'Làm thêm ngày nghỉ hằng tuần'),
      mucPct('ty_le_tang_ca_le', 'Làm thêm ngày lễ, Tết')
    ]},
    { ten: 'KPI & hoa hồng', muc: [
      mucSo('san_doanh_thu_cty', 'Sàn doanh thu công ty mỗi tháng'),
      mucChu('ty_le_vat_quy_doi', 'Hệ số chia để ra doanh số trước VAT'),
      mucChu('bac_hoa_hong', 'Bậc hoa hồng (từ doanh số : % : lương cứng)'),
      mucChu('thuong_lich_hen', 'Thưởng lịch hẹn (từ số hẹn : tiền mỗi hẹn)'),
      mucPct('pct_thuong_tamly', 'Thưởng doanh số chuyên gia tâm lý'),
      mucSo('tamly_thuong_ghepdoi', 'Thưởng mỗi hồ sơ ghép đôi'),
      mucSo('tamly_nguong_ghepdoi', 'Ngưỡng hồ sơ ghép đôi mới được thưởng'),
      mucSo('tamly_thuong_timhieu', 'Thưởng mỗi hồ sơ đồng ý tìm hiểu'),
      mucSo('tamly_thuong_henho', 'Thưởng mỗi hồ sơ xác nhận hẹn hò'),
      mucSo('tamly_nguong_vuot', 'Ngưỡng tổng hồ sơ để thưởng vượt chỉ tiêu'),
      mucSo('tamly_thuong_vuot', 'Thưởng vượt chỉ tiêu')
    ]}
  ];

  return { ok: true, ky: ky, nhom: nhom };
}

/** Lấy cột NguonCanCu của 1 tham số để hiện ra giao diện */
function canCu_(khoa) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CAUHINHHR);
  if (!sh || sh.getLastRow() < 2) return '';
  if (!canCu_._nho) {
    canCu_._nho = {};
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues();
    for (var i = 0; i < v.length; i++) {
      if (v[i][0]) canCu_._nho[String(v[i][0]).trim()] = String(v[i][3] || '');
    }
  }
  return canCu_._nho[khoa] || '';
}

/*================= MENU TRONG SHEET =================*/

/**
 * Gọi hàm này từ onOpen() của Code.gs để thêm menu nhân sự.
 * Trong Code.gs, thêm 1 dòng vào cuối onOpen():   themMenuHR_();
 */
function themMenuHR_() {
  try {
    SpreadsheetApp.getUi().createMenu('Nhan su')
      .addItem('1. Cai dat / cap nhat phan he nhan su', 'caiDatHR')
      .addSeparator()
      .addItem('2. Tinh cong thang nay (xem thu, khong ghi)', 'menuXemCongThangNay')
      .addItem('3. Chot bang cong thang truoc', 'menuChotCongThangTruoc')
      .addSeparator()
      .addItem('4. Tinh luong thang truoc', 'menuTinhLuongThangTruoc')
      .addItem('5. Cap nhat quy phep nam nay', 'menuCapNhatPhepNam')
      .addSeparator()
      .addItem('6. Kiem tra canh bao nhan su', 'menuKiemTraCanhBao')
      .addItem('7. Kiem tra tham so phap ly', 'menuKiemTraThamSo')
      .addToUi();
  } catch (e) { Logger.log('Khong tao duoc menu HR: ' + e); }
}

/** Phiên giả để chạy từ menu Sheet — người mở Sheet là chủ sở hữu nên coi là ADMIN */
function phienMenu_() {
  return { ok: true, maNV: 'MENU_SHEET', hoTen: 'Chay tu menu Sheet',
           phongBan: '', vaiTro: 'ADMIN' };
}

function kyThangTruoc_() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, TZ, 'yyyy-MM');
}

function menuXemCongThangNay() {
  var ky = kyHienTai_();
  var ds = tinhCongCaCongTy_(ky);
  var dong = ds.map(function (x) {
    return x.MaNV + ' | ' + x.HoTen + ' | cong ' + x.NgayLamThuc + ' + le ' + x.NgayLe
         + ' + phep ' + x.NgayPhep + ' = ' + x.TongCongTinhLuong
         + (x.SoNgayCanXuLy ? '  (!' + x.SoNgayCanXuLy + ' ngay chua ro)' : '');
  });
  var canXuLy = ds.reduce(function (s, x) { return s + x.SoNgayCanXuLy; }, 0);
  SpreadsheetApp.getUi().alert('CONG THANG ' + ky + ' (xem thu, chua ghi vao Sheet)\n\n'
    + dong.join('\n') + '\n\nTong so ngay can xu ly: ' + canXuLy);
}

function menuChotCongThangTruoc() {
  var ky = kyThangTruoc_();
  var ui = SpreadsheetApp.getUi();
  var kq = hrChotCong_({ ky: ky }, phienMenu_());
  if (!kq.ok && kq.canXacNhan) {
    var tl = ui.alert('Chua chot duoc ky ' + ky, kq.loi + '\n\nVan chot va ghi 0 cong cho '
      + 'nhung ngay chua ro?', ui.ButtonSet.YES_NO);
    if (tl !== ui.Button.YES) return;
    kq = hrChotCong_({ ky: ky, boQuaCanhBao: true }, phienMenu_());
  }
  ui.alert(kq.ok ? kq.thongBao : 'Loi: ' + kq.loi);
}

function menuTinhLuongThangTruoc() {
  var ky = kyThangTruoc_();
  var kq = hrTinhLuong_({ ky: ky }, phienMenu_());
  if (!kq.ok) { SpreadsheetApp.getUi().alert('Loi: ' + kq.loi); return; }
  var cb = (kq.canhBao || []).map(function (x) {
    return '- ' + x.HoTen + ': ' + x.CanhBao.join('; ');
  });
  SpreadsheetApp.getUi().alert(kq.thongBao
    + '\n\nTong thuc nhan: ' + dinhDangTien_(kq.tongThucNhan) + 'd'
    + '\nTong chi phi nhan su (gom BH cong ty): ' + dinhDangTien_(kq.tongChiPhiCongTy) + 'd'
    + '\nTong thue TNCN: ' + dinhDangTien_(kq.tongThueTNCN) + 'd'
    + (cb.length ? '\n\nCAN KIEM TRA (' + cb.length + '):\n' + cb.join('\n') : '\n\nKhong co canh bao.'));
}

function menuCapNhatPhepNam() {
  var kq = hrTaoQuyPhep_({ nam: String(new Date().getFullYear()) }, phienMenu_());
  SpreadsheetApp.getUi().alert(kq.ok ? kq.thongBao : 'Loi: ' + kq.loi);
}

function menuKiemTraCanhBao() {
  var kq = hrCanhBao_({}, phienMenu_());
  var t = 'CANH BAO NHAN SU\n\n';
  t += 'Hop dong sap het han (' + kq.hopDongSapHetHan.length + '):\n';
  t += kq.hopDongSapHetHan.map(function (x) {
    return '  - ' + x.HoTen + ' (' + x.LoaiHD + ') het han ' + x.NgayHetHan
         + ', con ' + x.ConLaiNgay + ' ngay';
  }).join('\n') || '  (khong co)';
  t += '\n\nChua co hop dong (' + kq.chuaCoHopDong.length + '):\n';
  t += kq.chuaCoHopDong.map(function (x) {
    return '  - ' + x.HoTen + ' / ' + x.PhongBan;
  }).join('\n') || '  (khong co)';
  t += '\n\nHo so con thieu truong bat buoc (' + kq.hoSoConThieu.length + '):\n';
  t += kq.hoSoConThieu.map(function (x) {
    return '  - ' + x.HoTen + ': ' + x.Thieu.join(', ');
  }).join('\n') || '  (khong co)';
  SpreadsheetApp.getUi().alert(t);
}

function menuKiemTraThamSo() {
  var c = docCauHinhHR_();
  var ky = kyHienTai_();
  var t = 'THAM SO DANG AP DUNG CHO KY ' + ky + '\n\n';
  t += 'Cong chuan: ' + chsSo_(c, 'cong_chuan_thang', 26) + ' ngay\n';
  t += 'Luong toi thieu vung I: ' + dinhDangTien_(chsSoKy_(c, 'luong_toi_thieu_vung', ky, 0)) + 'd\n';
  t += 'Muc tham chieu BHXH: ' + dinhDangTien_(chsSoKy_(c, 'muc_tham_chieu_bhxh', ky, 0)) + 'd\n';
  t += 'Tran dong BHXH/BHYT: ' + dinhDangTien_(
        chsSoKy_(c, 'he_so_tran_bhxh', ky, 20) * chsSoKy_(c, 'muc_tham_chieu_bhxh', ky, 0)) + 'd\n';
  t += 'Tran dong BHTN: ' + dinhDangTien_(
        chsSoKy_(c, 'he_so_tran_bhtn', ky, 20) * chsSoKy_(c, 'luong_toi_thieu_vung', ky, 0)) + 'd\n';
  t += 'BH nguoi lao dong: ' + chsSo_(c, 'ty_le_bhxh_nld', 0) + '% + '
     + chsSo_(c, 'ty_le_bhyt_nld', 0) + '% + ' + chsSo_(c, 'ty_le_bhtn_nld', 0) + '% = '
     + (chsSo_(c, 'ty_le_bhxh_nld', 0) + chsSo_(c, 'ty_le_bhyt_nld', 0)
        + chsSo_(c, 'ty_le_bhtn_nld', 0)) + '%\n';
  t += 'BH cong ty dong: ' + (chsSo_(c, 'ty_le_bhxh_cty', 0) + chsSo_(c, 'ty_le_bhyt_cty', 0)
        + chsSo_(c, 'ty_le_bhtn_cty', 0) + chsSo_(c, 'ty_le_bhtnld_cty', 0)) + '% + KPCD '
     + chsSo_(c, 'ty_le_kpcd_cty', 0) + '%\n';
  t += 'Giam tru ban than: ' + dinhDangTien_(chsSoKy_(c, 'giam_tru_ban_than', ky, 0)) + 'd\n';
  t += 'Giam tru nguoi phu thuoc: ' + dinhDangTien_(chsSoKy_(c, 'giam_tru_phu_thuoc', ky, 0)) + 'd\n';
  t += 'Bieu thue: ' + chsChu_(c, 'bac_thue', '') + '\n';
  t += 'Nguong khau tru 10% (TV/CTV): ' + dinhDangTien_(chsSoKy_(c, 'nguong_khau_tru_tv_ctv', ky, 0)) + 'd\n';
  t += 'Mien thue an trua: ' + dinhDangTien_(chsSoKy_(c, 'mien_thue_an_trua', ky, 0)) + 'd/thang\n\n';
  t += 'PHEP NAM — che do: ' + chsChu_(c, 'phep_che_do', '') + '\n';
  if (chsChu_(c, 'phep_che_do', 'THANG').toUpperCase() === 'THANG') {
    t += '  ' + chsSo_(c, 'phep_moi_thang', 1) + ' ngay/thang, bo qua '
       + chsSo_(c, 'phep_bo_qua_thang_dau', 0) + ' thang dau, toi da '
       + chsSo_(c, 'phep_toi_da_moi_thang', 0) + ' ngay/thang\n';
  } else {
    t += '  ' + chsSo_(c, 'phep_chuan_nam', 12) + ' ngay/nam, +1 ngay moi '
       + chsSo_(c, 'phep_tham_nien_moi_nam', 5) + ' nam\n';
  }
  t += '\nTru tien quy vao luong: ' + chsChu_(c, 'tru_tien_quy_vao_luong', 'KHONG')
     + '  (phai la KHONG — Dieu 127 BLLD 2019)\n';
  t += 'Phu cap chuyen can: ' + dinhDangTien_(chsSo_(c, 'phu_cap_chuyen_can', 0)) + 'd/thang';
  SpreadsheetApp.getUi().alert(t);
}

/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_Luong.gs   (Tính lương, BHXH, thuế TNCN)
 * ----------------------------------------------------------------------------
 *  Công thức bám ĐÚNG bảng lương tháng 08+09/2026 công ty đang dùng, để số
 *  phần mềm ra khớp với số kế toán đang quen, không tự nghĩ cách tính mới:
 *
 *    LuongTheoCong = ROUND(LuongThoaThuan / CongChuan x (Cong + Le + NghiBu), -3)
 *    LuongPhep     = ROUND(LuongThoaThuan / CongChuan x NgayPhep, -3)
 *    TongThuNhap   = LuongTheoCong + LuongPhep + PhuCap + ThuongKPI
 *                    + ThuongDaChiGiuaKy + ThuNhapKhac
 *    BaoHiemNLD    = (chi hop dong CT) LuongCoBanBHXH x 8% / 1.5% / 1%, co tran
 *    ThuNhapTinhThue = MAX(TongThuNhap - BaoHiemNLD - GiamTruGiaCanh, 0)
 *    ThueTNCN      = CT   -> luy tien 5 bac tren ThuNhapTinhThue
 *                    TV/CTV -> 10% x TongThuNhap
 *    ThucNhan      = ROUND(TongThuNhap - BaoHiemNLD - Thue - TamUng - GiamTruKhac, -3)
 *                    - ThuongDaChiGiuaKy + TruyThuTruyLinh
 *
 *  Hai điểm cố tình KHÁC bảng Excel cũ, vì bảng cũ đang sai:
 *   1) Thuế TNCN được tính cho MỌI người đủ điều kiện. Bảng Excel T8/T9 có
 *      11 dòng bị để trống/ghi 0 thủ công (vd 1 nhân sự TV thu nhap 11,9tr
 *      khong bi khau tru 10%) — phan mem se tinh ra so dung.
 *   2) Tiền nộp Quỹ chung KHÔNG trừ vào lương (Điều 127 BLLĐ 2019 cấm dùng
 *      hình thức trừ lương để xử lý vi phạm). Cột TienQuyChung chỉ để theo dõi
 *      và thu riêng bằng tiền mặt/chuyển khoản.
 * ============================================================================
 */

/*================= BẢO HIỂM =================*/

/**
 * Bảo hiểm của 1 người. Chỉ trừ với loại hợp đồng khai trong loai_hd_dong_bh.
 * Có áp trần: BHXH/BHYT trần = 20 x mức tham chiếu; BHTN trần = 20 x LTT vùng.
 */
function tinhBaoHiem_(loaiHD, luongBHXH, c, ky, soNgayKhongLuong) {
  var dsLoai = chsChu_(c, 'loai_hd_dong_bh', 'CT').toUpperCase().split(',')
                 .map(function (x) { return x.trim(); });
  var khong = { nld: { bhxh: 0, bhyt: 0, bhtn: 0, tong: 0 },
                cty: { bhxh: 0, bhyt: 0, bhtn: 0, bhtnld: 0, kpcd: 0, tong: 0 },
                mucDong: 0, mucDongBHTN: 0, dongBH: false, lyDoKhongDong: '', duoiSan: false };
  if (dsLoai.indexOf(String(loaiHD).toUpperCase()) < 0) {
    khong.lyDoKhongDong = 'Loai hop dong ' + loaiHD + ' khong thuoc dien dong bao hiem bat buoc';
    return khong;
  }

  var muc = tien_(luongBHXH);
  if (muc <= 0) {
    khong.lyDoKhongDong = 'Chua khai muc luong dong BHXH tren hop dong';
    return khong;
  }

  // Miễn đóng tháng nếu không làm việc và không hưởng lương từ 14 ngày trở lên
  var nguongMien = chsSo_(c, 'mien_dong_bh_tu_ngay_nghi', 14);
  if (nguongMien > 0 && tien_(soNgayKhongLuong) >= nguongMien) {
    khong.lyDoKhongDong = 'Nghi khong huong luong ' + soNgayKhongLuong + ' ngay (>= '
                        + nguongMien + ') -> mien dong bao hiem thang nay';
    khong.mucDong = muc;
    return khong;
  }

  // Tham số pháp lý lấy theo KỲ, không lấy theo "hôm nay"
  var tranBH   = chsSoKy_(c, 'he_so_tran_bhxh', ky, 20) * chsSoKy_(c, 'muc_tham_chieu_bhxh', ky, 2530000);
  var tranBHTN = chsSoKy_(c, 'he_so_tran_bhtn', ky, 20) * chsSoKy_(c, 'luong_toi_thieu_vung', ky, 5310000);
  var mucBH    = Math.min(muc, tranBH);
  var mucBHTN  = Math.min(muc, tranBHTN);
  var san      = chsSoKy_(c, 'san_dong_bh', ky, 0);

  var nld = {
    bhxh: Math.round(mucBH   * chsSo_(c, 'ty_le_bhxh_nld', 8)   / 100),
    bhyt: Math.round(mucBH   * chsSo_(c, 'ty_le_bhyt_nld', 1.5) / 100),
    bhtn: Math.round(mucBHTN * chsSo_(c, 'ty_le_bhtn_nld', 1)   / 100)
  };
  nld.tong = nld.bhxh + nld.bhyt + nld.bhtn;

  var cty = {
    bhxh:   Math.round(mucBH   * chsSo_(c, 'ty_le_bhxh_cty', 17)    / 100),
    bhyt:   Math.round(mucBH   * chsSo_(c, 'ty_le_bhyt_cty', 3)     / 100),
    bhtn:   Math.round(mucBHTN * chsSo_(c, 'ty_le_bhtn_cty', 1)     / 100),
    bhtnld: Math.round(mucBH   * chsSo_(c, 'ty_le_bhtnld_cty', 0.5) / 100),
    kpcd:   Math.round(mucBH   * chsSo_(c, 'ty_le_kpcd_cty', 2)     / 100)
  };
  cty.tong = cty.bhxh + cty.bhyt + cty.bhtn + cty.bhtnld + cty.kpcd;

  return { nld: nld, cty: cty, mucDong: mucBH, mucDongBHTN: mucBHTN, dongBH: true,
           lyDoKhongDong: '', duoiSan: (san > 0 && muc < san), san: san,
           tranBH: tranBH, tranBHTN: tranBHTN };
}

/*================= THUẾ TNCN =================*/

/** Đọc biểu thuế từ cấu hình: "tranBac:thue%|..." -> [{tran, pct}] */
function docBacThue_(c) {
  var s = chsChu_(c, 'bac_thue', '10000000:5|30000000:10|60000000:20|100000000:30|0:35');
  var ra = [];
  var phan = s.split('|');
  for (var i = 0; i < phan.length; i++) {
    var x = phan[i].split(':');
    if (x.length < 2) continue;
    ra.push({ tran: tien_(x[0]), pct: tien_(x[1]) });
  }
  return ra;
}

/** Thuế luỹ tiến theo từng phần (marginal), không dùng công thức rút gọn */
function thueLuyTien_(tntt, bacThue) {
  var thu = Number(tntt) || 0;
  if (thu <= 0) return 0;
  var thue = 0, truoc = 0;
  for (var i = 0; i < bacThue.length; i++) {
    var tran = bacThue[i].tran, pct = bacThue[i].pct;
    if (tran === 0 || tran === null) {            // bậc cuối, không giới hạn
      if (thu > truoc) thue += (thu - truoc) * pct / 100;
      break;
    }
    var phan = Math.min(thu, tran) - truoc;
    if (phan > 0) thue += phan * pct / 100;
    truoc = tran;
    if (thu <= tran) break;
  }
  return Math.round(thue);
}

/*================= PHỤ CẤP & KHOẢN KHÁC =================*/

/** Tổng phụ cấp định kỳ đang hiệu lực trong kỳ */
function phuCapTrongKy_(maNV, ky, dsPhuCap) {
  var ds = dsPhuCap || docBang_(SH_PHUCAP);
  var ma = String(maNV).trim().toUpperCase();
  var tong = 0, chiuThue = 0, dongBH = 0, chiTiet = [];
  for (var i = 0; i < ds.length; i++) {
    var o = ds[i];
    if (String(o.MaNV || '').trim().toUpperCase() !== ma) continue;
    if (String(o.TrangThai || 'HIEU_LUC').toUpperCase() !== 'HIEU_LUC') continue;
    var tu  = kyChuoi_(o.TuThang || '');
    var den = kyChuoi_(o.DenThang || '');
    if (tu && ky < tu) continue;
    if (den && ky > den) continue;
    var st = tien_(o.SoTien);
    tong += st;
    if (String(o.ChiuThue || 'CO').toUpperCase() !== 'KHONG') chiuThue += st;
    if (String(o.DongBHXH || 'KHONG').toUpperCase() === 'CO') dongBH += st;
    chiTiet.push({ Loai: o.LoaiPhuCap, SoTien: st });
  }
  return { tong: tong, chiuThue: chiuThue, dongBH: dongBH, chiTiet: chiTiet };
}

/** Tạm ứng / thu nhập khác / giảm trừ khác / truy thu trong kỳ */
function khoanKhacTrongKy_(maNV, ky, dsKhoan) {
  var ds = dsKhoan || docBang_(SH_KHOANKHAC);
  var ma = String(maNV).trim().toUpperCase();
  var ra = { tamUng: 0, thuNhapKhac: 0, thuNhapKhacChiuThue: 0, giamTruKhac: 0,
             truyThuTruyLinh: 0, thuongKhac: 0, chiTiet: [] };
  for (var i = 0; i < ds.length; i++) {
    var o = ds[i];
    if (String(o.MaNV || '').trim().toUpperCase() !== ma) continue;
    if (kyChuoi_(o.Ky) !== ky) continue;
    if (String(o.TrangThai || 'DA_DUYET').toUpperCase() === 'HUY') continue;
    var st = tien_(o.SoTien);
    var loai = String(o.Loai || '').trim().toUpperCase();
    switch (loai) {
      case 'TAM_UNG':      ra.tamUng += st; break;
      case 'THU_NHAP_KHAC':
        ra.thuNhapKhac += st;
        if (String(o.ChiuThue || 'CO').toUpperCase() !== 'KHONG') ra.thuNhapKhacChiuThue += st;
        break;
      case 'THUONG_KHAC':  ra.thuongKhac += st; break;
      case 'GIAM_TRU_KHAC':ra.giamTruKhac += st; break;
      case 'TRUY_THU':     ra.truyThuTruyLinh -= Math.abs(st); break;
      case 'TRUY_LINH':    ra.truyThuTruyLinh += Math.abs(st); break;
      default: break;
    }
    ra.chiTiet.push({ Loai: loai, TenKhoan: o.TenKhoan, SoTien: st });
  }
  return ra;
}

/*================= TÍNH LƯƠNG MỘT NGƯỜI =================*/

/**
 * cong = object do tinhCongThang_() tra ve (hoac 1 dong tab BANGCONG da chot)
 * Ưu tiên dùng BẢNG CÔNG ĐÃ CHỐT nếu có, để lương không đổi khi ai đó
 * sửa chấm công sau lúc chốt.
 */
function tinhLuongMotNguoi_(nv, ky, cong, c, nguon) {
  var ma = String(nv.MaNV).trim().toUpperCase();
  var hd = hopDongHieuLuc_(ma, ky, nguon.hopDong);
  var canhBao = [];

  if (!hd) {
    canhBao.push('Khong co hop dong hieu luc -> khong tinh duoc luong.');
  }
  var loaiHD    = hd ? String(hd.LoaiHD || '').toUpperCase() : '';
  var luongTT   = hd ? tien_(hd.LuongThoaThuan) : 0;
  var luongBHXH = hd ? tien_(hd.LuongCoBanBHXH) : 0;

  if (hd && !luongTT) canhBao.push('Hop dong chua khai Tong luong thoa thuan.');
  if (loaiHD === 'CT' && !luongBHXH) {
    canhBao.push('Hop dong CT nhung chua khai Luong co ban/BHXH -> bao hiem va thue se bi tinh thieu.');
  }

  var congChuan = tien_(cong.CongChuan) || chsSo_(c, 'cong_chuan_thang', 26);
  var lamTronDV = chsSo_(c, 'lam_tron_luong', 1000);

  // --- Lương theo công (công làm + lễ + nghỉ bù) và lương phép, tách riêng như bảng cũ ---
  var congVaLe = (cong.CongVaLe !== undefined && cong.CongVaLe !== '')
                   ? tien_(cong.CongVaLe)
                   : tien_(cong.NgayLamThuc) + tien_(cong.NgayLe) + tien_(cong.NgayNghiBu);
  var ngayPhep = tien_(cong.NgayPhep);

  var donGiaNgay   = congChuan > 0 ? luongTT / congChuan : 0;
  var luongTheoCong = lamTron_(donGiaNgay * congVaLe, lamTronDV);
  var luongPhep     = lamTron_(donGiaNgay * ngayPhep, lamTronDV);

  // Tách phần lương của riêng ngày lễ để báo cáo (không cộng thêm, chỉ để xem)
  var luongLe = lamTron_(donGiaNgay * tien_(cong.NgayLe), lamTronDV);

  // --- Tăng ca (hiện công ty quy đổi thành nghỉ bù, nên mặc định 0) ---
  var gioChuan = chsSo_(c, 'gio_lam_chuan_ngay', 8);
  var donGiaGio = gioChuan > 0 ? donGiaNgay / gioChuan : 0;
  var luongTangCa = lamTron_(
      donGiaGio * (tien_(cong.GioTangCaNgayThuong) * chsSo_(c, 'ty_le_tang_ca_thuong', 150) / 100
                 + tien_(cong.GioTangCaChuNhat)   * chsSo_(c, 'ty_le_tang_ca_cn', 200)     / 100
                 + tien_(cong.GioTangCaNgayLe)    * chsSo_(c, 'ty_le_tang_ca_le', 300)     / 100),
      lamTronDV);

  // --- Phụ cấp, KPI, khoản khác ---
  var pc  = phuCapTrongKy_(ma, ky, nguon.phuCap);
  var kk  = khoanKhacTrongKy_(ma, ky, nguon.khoanKhac);
  var kpi = nguon.kpiMap[ma] || null;

  var hoaHong          = kpi ? tien_(kpi.TienHoaHong) : 0;
  var lcbTheoBac       = kpi ? tien_(kpi.LCBTheoBac) : 0;
  var thuongKPI        = kpi ? (tien_(kpi.TongThuongKPI) - hoaHong - lcbTheoBac) : 0;
  var thuongMoc        = kpi ? tien_(kpi.ThuongMocDoanhThu) : 0;
  if (thuongKPI < 0) thuongKPI = 0;

  var daChiGiuaKy = tien_(req_soTienDaChi_(nguon.khoanKhac, ma, ky));

  // --- Phụ cấp chuyên cần: cơ chế HỢP PHÁP thay cho thu tiền quỹ đi trễ ---
  // Dieu 127 khoan 2 BLLD 2019 cam phat tien/cat luong thay xu ly ky luat, nen o day
  // la "khong dat dieu kien thi khong duoc huong thuong", KHONG phai "tru tien".
  var mucChuyenCan = chsSo_(c, 'phu_cap_chuyen_can', 0);
  var phuCapChuyenCan = 0, lyDoChuyenCan = '';
  if (mucChuyenCan > 0) {
    var tranLanTre = chsSo_(c, 'chuyen_can_so_lan_tre_toi_da', 0);
    var soLanTre   = tien_(cong.SoLanDiTreVeSom);
    var matVeNghiKL = chsBat_(c, 'chuyen_can_mat_khi_nghi_kl', true)
                      && tien_(cong.NgayNghiKhongLuong) > 0;
    if (soLanTre > tranLanTre) {
      lyDoChuyenCan = 'Khong huong chuyen can: di tre/ve som ' + soLanTre
                    + ' lan, vuot muc toi da ' + tranLanTre + ' lan/thang.';
    } else if (matVeNghiKL) {
      lyDoChuyenCan = 'Khong huong chuyen can: co ' + cong.NgayNghiKhongLuong
                    + ' ngay nghi khong luong trong thang.';
    } else {
      phuCapChuyenCan = mucChuyenCan;
      lyDoChuyenCan = 'Du dieu kien chuyen can (' + soLanTre + '/' + tranLanTre + ' lan tre).';
    }
  }

  // --- Tổng thu nhập ---
  var tongThuNhap = luongTheoCong + luongPhep + luongTangCa + pc.tong + phuCapChuyenCan
                  + lcbTheoBac + hoaHong + thuongKPI + thuongMoc
                  + kk.thuongKhac + kk.thuNhapKhac;

  // --- Bảo hiểm (tham số lấy theo KỲ, không theo hôm nay) ---
  var bh = tinhBaoHiem_(loaiHD, luongBHXH, c, ky, tien_(cong.NgayNghiKhongLuong));
  if (bh.lyDoKhongDong) canhBao.push(bh.lyDoKhongDong + '.');
  if (bh.duoiSan) {
    canhBao.push('Muc luong dong BH ' + dinhDangTien_(luongBHXH) + 'd thap hon san '
      + dinhDangTien_(bh.san) + 'd (luong toi thieu vung I) — kiem tra lai hop dong.');
  }

  // --- Thuế TNCN ---
  var npt = tien_(nv.SoNguoiPhuThuoc);
  var gtBanThan  = chsSoKy_(c, 'giam_tru_ban_than', ky, 15500000);
  var gtPhuThuoc = chsSoKy_(c, 'giam_tru_phu_thuoc', ky, 6200000) * npt;

  // Khoản được miễn thuế: phần tiền ăn trưa trong mức trần
  var mienAnTrua = 0;
  var tranAnTrua = chsSoKy_(c, 'mien_thue_an_trua', ky, 0);
  if (tranAnTrua > 0) {
    for (var ipc = 0; ipc < pc.chiTiet.length; ipc++) {
      var ten = String(pc.chiTiet[ipc].Loai || '').toUpperCase();
      if (ten.indexOf('AN TRUA') >= 0 || ten.indexOf('ĂN TRƯA') >= 0 ||
          ten.indexOf('AN_TRUA') >= 0 || ten.indexOf('GIUA CA') >= 0) {
        mienAnTrua += Math.min(tien_(pc.chiTiet[ipc].SoTien), tranAnTrua);
      }
    }
  }

  var thuNhapChiuThue = Math.max(tongThuNhap - mienAnTrua, 0);
  var thue = 0, thuNhapTinhThue = 0, cachTinhThue = '';

  if (loaiHD === 'CT') {
    thuNhapTinhThue = Math.max(thuNhapChiuThue - bh.nld.tong - gtBanThan - gtPhuThuoc, 0);
    thue = thueLuyTien_(thuNhapTinhThue, docBacThue_(c));
    cachTinhThue = 'Luy tien 5 bac tren thu nhap tinh thue';
  } else if (loaiHD) {
    var nguong = chsSoKy_(c, 'nguong_khau_tru_tv_ctv', ky, 5000000);
    var tyLe   = chsSoKy_(c, 'ty_le_khau_tru_tv_ctv', ky, 10);
    if (thuNhapChiuThue >= nguong) {
      thue = Math.round(thuNhapChiuThue * tyLe / 100);
      cachTinhThue = 'Khau tru ' + tyLe + '% tren tong thu nhap (hop dong ' + loaiHD + ')';
    } else {
      cachTinhThue = 'Duoi nguong ' + dinhDangTien_(nguong) + 'd -> khong khau tru';
    }
  }

  // --- Thực nhận ---
  // Tiền Quỹ chung KHONG BAO GIO tru vao luong (Dieu 127 khoan 2 BLLD 2019 cam
  // "phat tien, cat luong thay viec xu ly ky luat lao dong"). Cot TienQuyChung chi
  // de theo doi va thu rieng. Neu ai do doi cau hinh tru_tien_quy_vao_luong = CO,
  // phan mem van khong tru va ghi canh bao phap ly.
  if (chsBat_(c, 'tru_tien_quy_vao_luong', false)) {
    canhBao.push('CANH BAO PHAP LY: cau hinh tru_tien_quy_vao_luong dang bat, nhung '
      + 'phan mem KHONG tru tien quy vao luong vi Dieu 127 khoan 2 BLLD 2019 cam. '
      + 'Hay dat lai thanh KHONG va dung co che phu cap chuyen can.');
  }

  // Khấu trừ bồi thường thiệt hại tài sản: Điều 102 BLLĐ giới hạn 30% lương
  // thực trả sau khi trích bảo hiểm và thuế.
  var luongSauBHThue = tongThuNhap - bh.nld.tong - thue;
  var tranKhauTru = Math.max(0, Math.round(luongSauBHThue * 0.3));
  var giamTruKhacApDung = kk.giamTruKhac;
  if (giamTruKhacApDung > tranKhauTru) {
    canhBao.push('Khau tru khac ' + dinhDangTien_(kk.giamTruKhac) + 'd vuot tran 30% luong '
      + 'thuc tra sau bao hiem va thue (' + dinhDangTien_(tranKhauTru) + 'd) theo Dieu 102 '
      + 'BLLD 2019 -> da tu gioi han ve tran, phan con lai chuyen ky sau.');
    giamTruKhacApDung = tranKhauTru;
  }

  var thucNhan = lamTron_(tongThuNhap - bh.nld.tong - thue - kk.tamUng - giamTruKhacApDung, lamTronDV)
               - daChiGiuaKy + kk.truyThuTruyLinh;

  if (cong.SoNgayCanXuLy) {
    canhBao.push('Con ' + cong.SoNgayCanXuLy + ' ngay cong chua ro trong ky.');
  }
  if (thucNhan < 0) canhBao.push('Thuc nhan am — kiem tra lai tam ung / truy thu.');

  return {
    Ky: ky, MaNV: nv.MaNV, HoTen: nv.HoTen, PhongBan: nv.PhongBan || '',
    ChucDanh: nv.ChucDanh || '', LoaiHD: loaiHD,
    LuongThoaThuan: luongTT, LuongCoBanBHXH: luongBHXH,
    CongChuan: congChuan, TongCongTinhLuong: congVaLe + ngayPhep,
    CongVaLe: congVaLe, NgayPhep: ngayPhep, DonGiaNgay: Math.round(donGiaNgay),

    LuongTheoCong: luongTheoCong, LuongPhep: luongPhep, LuongLe: luongLe,
    LuongTangCa: luongTangCa,
    PhuCap: pc.tong + phuCapChuyenCan, PhuCapChiuThue: pc.chiuThue + phuCapChuyenCan,
    PhuCapChuyenCan: phuCapChuyenCan, LyDoChuyenCan: lyDoChuyenCan,
    ChiTietPhuCap: pc.chiTiet, MienThueAnTrua: mienAnTrua,
    LuongCung_LCB: lcbTheoBac, HoaHong: hoaHong,
    ThuongKPI: thuongKPI, ThuongMocDoanhThu: thuongMoc,
    ThuongKhac: kk.thuongKhac, ThuNhapKhac: kk.thuNhapKhac,
    TongThuNhap: tongThuNhap,

    ThuNhapChiuBH: bh.mucDong,
    BH_BHXH: bh.nld.bhxh, BH_BHYT: bh.nld.bhyt, BH_BHTN: bh.nld.bhtn,
    TongBaoHiemNLD: bh.nld.tong,
    CongTy_BHXH: bh.cty.bhxh, CongTy_BHYT: bh.cty.bhyt,
    CongTy_BHTN: bh.cty.bhtn, CongTy_BHTNLD: bh.cty.bhtnld,
    CongTy_KPCD: bh.cty.kpcd, TongBaoHiemCongTy: bh.cty.tong,
    DongBaoHiem: bh.dongBH ? 'CO' : 'KHONG', LyDoKhongDongBH: bh.lyDoKhongDong,

    ThuNhapChiuThue: thuNhapChiuThue,
    GiamTruBanThan: gtBanThan, GiamTruPhuThuoc: gtPhuThuoc, SoNguoiPhuThuoc: npt,
    ThuNhapTinhThue: thuNhapTinhThue, ThueTNCN: thue, CachTinhThue: cachTinhThue,

    TamUng: kk.tamUng, TruyThuTruyLinh: kk.truyThuTruyLinh,
    GiamTruKhac: giamTruKhacApDung, TienQuyChung: tien_(cong.TienQuy),
    SoLanDiTreVeSom: tien_(cong.SoLanDiTreVeSom),
    ThuongDaChiGiuaKy: daChiGiuaKy,
    ThucNhan: thucNhan,
    ChiPhiCongTy: tongThuNhap + bh.cty.tong,

    CanhBao: canhBao, ChiTietKhoanKhac: kk.chiTiet
  };
}

/** Định dạng tiền có dấu phân cách nghìn */
function dinhDangTien_(x) {
  return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Khoản thưởng đã chuyển khoản riêng giữa kỳ (Loai = DA_CHI_GIUA_KY) */
function req_soTienDaChi_(dsKhoan, maNV, ky) {
  var ds = dsKhoan || docBang_(SH_KHOANKHAC);
  var ma = String(maNV).trim().toUpperCase(), tong = 0;
  for (var i = 0; i < ds.length; i++) {
    if (String(ds[i].MaNV || '').trim().toUpperCase() !== ma) continue;
    if (kyChuoi_(ds[i].Ky) !== ky) continue;
    if (String(ds[i].Loai || '').toUpperCase() !== 'DA_CHI_GIUA_KY') continue;
    if (String(ds[i].TrangThai || 'DA_DUYET').toUpperCase() === 'HUY') continue;
    tong += tien_(ds[i].SoTien);
  }
  return tong;
}

/*================= TÍNH LƯƠNG CẢ CÔNG TY =================*/

function nguonLuongKy_(ky) {
  var kpi = docBang_(SH_KPI).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  var kpiMap = {};
  for (var i = 0; i < kpi.length; i++) kpiMap[String(kpi[i].MaNV).trim().toUpperCase()] = kpi[i];
  return {
    hopDong:   docBang_(SH_HOPDONG),
    phuCap:    docBang_(SH_PHUCAP),
    khoanKhac: docBang_(SH_KHOANKHAC),
    kpiMap:    kpiMap
  };
}

/**
 * Bảng công dùng để tính lương: ưu tiên bản ĐÃ CHỐT trong tab BANGCONG,
 * chưa chốt thì tính trực tiếp từ app chấm công (và báo rõ là số tạm).
 */
function congDeTinhLuong_(ky, c) {
  var daChot = docBang_(SH_BANGCONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (daChot.length) {
    var map = {};
    for (var i = 0; i < daChot.length; i++) {
      var o = daChot[i];
      map[String(o.MaNV).trim().toUpperCase()] = {
        CongChuan: tien_(o.CongChuan), NgayLamThuc: tien_(o.NgayLamThuc),
        NgayLe: tien_(o.NgayLe), NgayPhep: tien_(o.NgayPhep),
        NgayNghiBu: tien_(o.NgayNghiBu),
        CongVaLe: tien_(o.NgayLamThuc) + tien_(o.NgayLe) + tien_(o.NgayNghiBu),
        TongCongTinhLuong: tien_(o.TongCongTinhLuong),
        NgayNghiKhongLuong: tien_(o.NgayNghiKhongLuong),
        SoLanDiTreVeSom: tien_(o.SoLanDiTreVeSom),
        TienQuy: tien_(o.TienQuy), SoNgayCanXuLy: 0,
        GioTangCaNgayThuong: tien_(o.GioTangCaNgayThuong),
        GioTangCaChuNhat: tien_(o.GioTangCaChuNhat),
        GioTangCaNgayLe: tien_(o.GioTangCaNgayLe)
      };
    }
    return { nguonCong: 'BANG_CONG_DA_CHOT', map: map };
  }
  var ds = tinhCongCaCongTy_(ky), m2 = {};
  for (var j = 0; j < ds.length; j++) m2[String(ds[j].MaNV).trim().toUpperCase()] = ds[j];
  return { nguonCong: 'TINH_TRUC_TIEP_TU_APP', map: m2 };
}

function tinhLuongCaCongTy_(ky) {
  var c = docCauHinhHR_();
  var nguon = nguonLuongKy_(ky);
  var bc = congDeTinhLuong_(ky, c);
  var ds = nhanSuTrongKy_(ky);
  var ra = [];
  for (var i = 0; i < ds.length; i++) {
    var ma = String(ds[i].MaNV).trim().toUpperCase();
    var cong = bc.map[ma];
    if (!cong) continue;
    ra.push(tinhLuongMotNguoi_(ds[i], ky, cong, c, nguon));
  }
  return { nguonCong: bc.nguonCong, danhSach: ra };
}

/*================= API =================*/

/** Tính (hoặc tính lại) lương kỳ và ghi vào BANGLUONG ở trạng thái TAM_TINH */
function hrTinhLuong_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (ky1 && ['DA_CHOT_LUONG', 'DA_CHI'].indexOf(String(ky1.TrangThai || '').toUpperCase()) >= 0) {
    return { ok: false, loi: 'Ky ' + ky + ' da chot luong. Mo lai ky (hr_morky) truoc khi tinh lai.' };
  }

  var kq = tinhLuongCaCongTy_(ky);
  var ds = kq.danhSach;
  if (!ds.length) {
    return { ok: false, loi: 'Khong co nhan vien nao tinh duoc luong ky ' + ky
                           + '. Kiem tra ho so (ngay vao lam) va bang cong.' };
  }

  xoaDongTheoKy_(SH_BANGLUONG, ky);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BANGLUONG);
  var m = mapCot_(sh), n = sh.getLastColumn(), rows = [];
  for (var i = 0; i < ds.length; i++) {
    var o = ds[i], dong = [];
    for (var z = 0; z < n; z++) dong.push('');
    for (var k in o) {
      if (m[k] === undefined) continue;
      var gt = o[k];
      if (gt && typeof gt === 'object') gt = JSON.stringify(gt).slice(0, 500);
      dong[m[k]] = gt;
    }
    if (m['TrangThai']  !== undefined) dong[m['TrangThai']]  = 'TAM_TINH';
    if (m['GhiChu']     !== undefined) dong[m['GhiChu']]     = o.CanhBao.join(' | ').slice(0, 900);
    if (m['NgayTinh']   !== undefined) dong[m['NgayTinh']]   = hnayHR_();
    if (m['NguoiTinh']  !== undefined) dong[m['NguoiTinh']]  = p.maNV;
    rows.push(dong);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows);

  var tongChi = ds.reduce(function (s, x) { return s + x.ChiPhiCongTy; }, 0);
  var tongThucNhan = ds.reduce(function (s, x) { return s + x.ThucNhan; }, 0);
  var thongTinKy = {
    Ky: ky, TuNgay: ky + '-01', DenNgay: ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2),
    CongChuan: chsSo_(docCauHinhHR_(), 'cong_chuan_thang', 26),
    TrangThai: 'DANG_TINH_LUONG', SoNhanVien: ds.length,
    TongChiPhiLuong: tongChi, NguoiChot: p.maNV
  };
  if (ky1) suaDong_(SH_KYLUONG, ky1._dong, thongTinKy);
  else themDong_(SH_KYLUONG, thongTinKy);

  ghiNhatKy_(p.maNV, p.vaiTro, 'TINH_LUONG', ky,
             ds.length + ' nguoi, nguon cong = ' + kq.nguonCong + ', tong chi phi = ' + tongChi);

  var coCanhBao = ds.filter(function (x) { return x.CanhBao.length; });
  return {
    ok: true, ky: ky, nguonCong: kq.nguonCong, soNhanVien: ds.length,
    tongThucNhan: tongThucNhan, tongChiPhiCongTy: tongChi,
    tongBaoHiemCongTy: ds.reduce(function (s, x) { return s + x.TongBaoHiemCongTy; }, 0),
    tongThueTNCN: ds.reduce(function (s, x) { return s + x.ThueTNCN; }, 0),
    soNguoiCoCanhBao: coCanhBao.length,
    canhBao: coCanhBao.map(function (x) {
      return { MaNV: x.MaNV, HoTen: x.HoTen, CanhBao: x.CanhBao };
    }),
    thongBao: 'Da tinh luong tam ky ' + ky + ' cho ' + ds.length + ' nhan vien'
            + (kq.nguonCong === 'TINH_TRUC_TIEP_TU_APP'
                ? ' (LUU Y: bang cong ky nay CHUA CHOT, so cong con co the doi).' : '.')
  };
}

function hrBangLuong_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = docBang_(SH_BANGLUONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });

  if (!duocXemLuong_(p)) {
    ds = ds.filter(function (x) {
      return String(x.MaNV).trim().toUpperCase() === p.maNV.toUpperCase();
    });
  }
  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  return {
    ok: true, ky: ky, danhSach: ds, tong: ds.length,
    trangThaiKy: ky1 ? String(ky1.TrangThai || 'MO') : 'CHUA_TAO',
    tongThucNhan: ds.reduce(function (s, x) { return s + tien_(x.ThucNhan); }, 0),
    tongChiPhi: ds.reduce(function (s, x) {
      return s + tien_(x.TongThuNhap) + tien_(x.TongBaoHiemCongTy);
    }, 0)
  };
}

/** Phiếu lương 1 người — nhân viên tự xem được phiếu của chính mình */
function hrPhieuLuong_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ma = String(req.maNV || p.maNV).trim().toUpperCase();
  if (ma !== p.maNV.toUpperCase() && !duocXemLuong_(p)) {
    return { ok: false, loi: 'Ban chi xem duoc phieu luong cua chinh minh.' };
  }

  var dong = null;
  var ds = docBang_(SH_BANGLUONG);
  for (var i = 0; i < ds.length; i++) {
    if (kyChuoi_(ds[i].Ky) === ky &&
        String(ds[i].MaNV).trim().toUpperCase() === ma) { dong = ds[i]; break; }
  }
  if (!dong) return { ok: false, loi: 'Chua co bang luong ky ' + ky + ' cho ' + ma };

  var congCT = null;
  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (nv) {
    try { congCT = tinhCongThang_(nv, ky, nguonCongKy_(ky), docCauHinhHR_()).ChiTiet; }
    catch (e) { congCT = null; }
  }
  return { ok: true, ky: ky, phieu: dong, congChiTiet: congCT,
           nguoiNhan: nv ? { HoTen: nv.HoTen, ChucDanh: nv.ChucDanh, PhongBan: nv.PhongBan,
                             SoTaiKhoan: nv.SoTaiKhoan, NganHang: nv.NganHang } : null };
}

/** Chốt lương — sau bước này bảng lương bị khoá, muốn sửa phải mở lại kỳ */
function hrChotLuong_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN']);
  if (chan) return { ok: false, loi: 'Chi ADMIN (sep) duoc chot ky luong.' };

  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = docBang_(SH_BANGLUONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (!ds.length) return { ok: false, loi: 'Chua tinh luong ky ' + ky + '. Chay hr_tinhluong truoc.' };

  var bc = docBang_(SH_BANGCONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  if (!bc.length && !req.boQuaCanhBao) {
    return { ok: false, canXacNhan: true,
             loi: 'Bang cong ky ' + ky + ' chua chot. Nen chot cong truoc khi chot luong, '
                + 'hoac goi lai voi boQuaCanhBao = true.' };
  }

  var thieu = ds.filter(function (x) {
    return !String(x.LoaiHD || '').trim() || !tien_(x.LuongThoaThuan);
  });
  if (thieu.length) {
    return { ok: false, loi: 'Con ' + thieu.length + ' nhan vien chua co loai hop dong hoac muc luong. '
                           + 'Khai bo sung trong tab HOPDONG roi tinh lai luong.',
             danhSach: thieu.map(function (x) { return { MaNV: x.MaNV, HoTen: x.HoTen }; }) };
  }

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BANGLUONG);
  var m = mapCot_(sh);
  for (var i = 0; i < ds.length; i++) {
    sh.getRange(ds[i]._dong, m['TrangThai'] + 1).setValue('DA_CHOT');
  }

  var tongChi = ds.reduce(function (s, x) {
    return s + tien_(x.TongThuNhap) + tien_(x.TongBaoHiemCongTy);
  }, 0);
  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  var tt = { Ky: ky, TrangThai: 'DA_CHOT_LUONG', NgayChotLuong: hnayHR_(),
             SoNhanVien: ds.length, TongChiPhiLuong: tongChi, NguoiChot: p.maNV };
  if (ky1) suaDong_(SH_KYLUONG, ky1._dong, tt); else themDong_(SH_KYLUONG, tt);

  ghiNhatKy_(p.maNV, p.vaiTro, 'CHOT_LUONG', ky, ds.length + ' nguoi, tong chi phi ' + tongChi);
  return { ok: true, ky: ky, soNhanVien: ds.length, tongChiPhi: tongChi,
           thongBao: 'Da CHOT luong ky ' + ky + '. Bang luong bi khoa, muon sua phai mo lai ky.' };
}

/** Mở lại kỳ đã chốt — chỉ ADMIN, bắt buộc ghi lý do, có ghi nhật ký */
function hrMoLaiKy_(req, p) {
  if (p.vaiTro !== 'ADMIN') return { ok: false, loi: 'Chi ADMIN (sep) duoc mo lai ky da chot.' };
  var ky = kyChuoi_(req.ky || '');
  var lyDo = String(req.lyDo || '').trim();
  if (!ky) return { ok: false, loi: 'Thieu ky.' };
  if (!lyDo) return { ok: false, loi: 'Phai ghi ly do mo lai ky da chot (de luu nhat ky).' };

  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (!ky1) return { ok: false, loi: 'Khong tim thay ky ' + ky };

  suaDong_(SH_KYLUONG, ky1._dong, {
    TrangThai: 'MO_LAI',
    GhiChu: 'Mo lai ' + nowHR_() + ' boi ' + p.maNV + ': ' + lyDo
  });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BANGLUONG);
  var m = mapCot_(sh);
  var ds = docBang_(SH_BANGLUONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  for (var i = 0; i < ds.length; i++) {
    sh.getRange(ds[i]._dong, m['TrangThai'] + 1).setValue('TAM_TINH');
  }

  ghiNhatKy_(p.maNV, p.vaiTro, 'MO_LAI_KY', ky, lyDo);
  return { ok: true, ky: ky, thongBao: 'Da mo lai ky ' + ky + '. Ly do da duoc luu vao nhat ky.' };
}

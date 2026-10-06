/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_Cong.gs
 * ----------------------------------------------------------------------------
 *  ĐÂY LÀ CHỖ ĐẤU NỐI VỚI APP CHẤM CÔNG.
 *
 *  Nguồn dữ liệu (đều nằm cùng một Google Sheet, không cần đồng bộ):
 *     CHAMCONG       — lượt chấm vào/ra thật từ app (ảnh + GPS + phút trễ)
 *     DONXINPHEP     — đơn nghỉ phép / đi trễ / làm bù ĐÃ DUYỆT
 *     NGAYLE         — lịch nghỉ lễ hưởng nguyên lương
 *     DIEUCHINHCONG  — giải trình/điều chỉnh từng ngày ĐÃ DUYỆT (ưu tiên cao nhất)
 *     HOSONV         — ngày vào làm / ngày nghỉ việc để chặn ngoài thời gian làm
 *
 *  Thứ tự ưu tiên khi quyết định 1 ngày là ngày gì:
 *     1. Ngoài thời gian làm việc (chưa vào làm / đã nghỉ việc)   -> NV
 *     2. Điều chỉnh công đã duyệt                                 -> theo người duyệt
 *     3. Ngày lễ trong NGAYLE                                     -> L
 *     4. Chủ nhật                                                 -> CN (hoặc công nếu có chấm)
 *     5. Đơn nghỉ phép / nghỉ không lương đã duyệt                 -> P / KL
 *     6. Có chấm cả vào và ra                                     -> X
 *     7. Chỉ chấm một chiều                                       -> THIEU (cần giải trình)
 *     8. Không có gì                                              -> ? (chưa rõ)
 * ============================================================================
 */

/*================= ĐỌC DỮ LIỆU NGUỒN =================*/

/** Gom lượt chấm công trong kỳ thành map: {MaNV: {ngay: {...}}} */
function docChamCongKy_(ky) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHAMCONG);
  var ra = {};
  if (!sh || sh.getLastRow() < 2) return ra;

  var m = mapCot_(sh);
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < v.length; i++) {
    var ngay = ngayChuoi_(v[i][m['Ngay']]);
    if (String(ngay).indexOf(ky) !== 0) continue;
    var ma = String(v[i][m['MaNV']] || '').trim().toUpperCase();
    if (!ma) continue;

    if (!ra[ma]) ra[ma] = {};
    if (!ra[ma][ngay]) {
      ra[ma][ngay] = { vao: null, ra: null, phutTre: 0, phutVeSom: 0,
                       soViPham: 0, tienQuy: 0, chenhLechPhut: 0, ngoaiVung: false };
    }
    var o = ra[ma][ngay];
    var loai = String(v[i][m['Loai']] || '').trim().toUpperCase();
    var gio  = gioChuoi_(v[i][m['Gio']]);
    if (loai === 'VAO') o.vao = gio;
    else if (loai === 'RA') o.ra = gio;

    o.phutTre      += tien_(v[i][m['PhutTre']]);
    o.phutVeSom    += tien_(v[i][m['PhutVeSom']]);
    o.tienQuy      += tien_(v[i][m['TienQuy']]);
    if (m['ChenhLechPhut'] !== undefined) o.chenhLechPhut += tien_(v[i][m['ChenhLechPhut']]);
    if (String(v[i][m['ViPham']] || '').trim()) o.soViPham += 1;
  }
  return ra;
}

/** Map ngày lễ trong kỳ: {ngay: tenNgayLe} */
function docNgayLeKy_(ky) {
  var ds = docBang_(SH_NGAYLE), ra = {};
  for (var i = 0; i < ds.length; i++) {
    var ngay = ngayChuoi_(ds[i].Ngay);
    if (String(ngay).indexOf(ky) !== 0) continue;
    if (String(ds[i].HuongLuong || 'CO').toUpperCase() === 'KHONG') continue;
    ra[ngay] = String(ds[i].TenNgayLe || 'Nghi le');
  }
  return ra;
}

/**
 * Đơn ĐÃ DUYỆT áp dụng trong kỳ, bung ra từng ngày:
 *   {MaNV: {ngay: {loaiDon: 'NGHI_PHEP'|'DI_TRE'|'LAM_BU', maDon: ...}}}
 */
function docDonDuyetKy_(ky) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DONXINPHEP);
  var ra = {};
  if (!sh || sh.getLastRow() < 2) return ra;

  var m = mapCot_(sh);
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var dauKy = ky + '-01', cuoiKy = ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2);

  for (var i = 0; i < v.length; i++) {
    if (String(v[i][m['TrangThai']] || '').trim().toUpperCase() !== 'DA_DUYET') continue;
    var ma  = String(v[i][m['MaNV']] || '').trim().toUpperCase();
    var tu  = ngayChuoi_(v[i][m['NgayApDung']]);
    var den = ngayChuoi_(v[i][m['NgayApDungKetThuc']]) || tu;
    if (!ma || !tu) continue;
    if (den < dauKy || tu > cuoiKy) continue;

    var loai  = String(v[i][m['LoaiDon']] || '').trim().toUpperCase();
    var maDon = String(v[i][m['MaDon']] || '').trim();
    if (!ra[ma]) ra[ma] = {};

    // Bung khoảng ngày, giới hạn trong kỳ
    var d = (tu < dauKy) ? dauKy : tu;
    var hetVong = 0;
    while (d <= den && d <= cuoiKy && hetVong < 400) {
      ra[ma][d] = { loaiDon: loai, maDon: maDon, lyDo: String(v[i][m['LyDo']] || '') };
      d = congNgay_(d, 1);
      hetVong++;
    }
  }
  return ra;
}

/** Cộng n ngày vào chuỗi YYYY-MM-DD */
function congNgay_(ngay, n) {
  var p = String(ngay).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/** Điều chỉnh công ĐÃ DUYỆT trong kỳ: {MaNV: {ngay: {kyHieu, soCong, lyDo, nguoiDuyet}}} */
function docDieuChinhKy_(ky) {
  var ds = docBang_(SH_DIEUCHINHCONG), ra = {};
  for (var i = 0; i < ds.length; i++) {
    if (String(ds[i].TrangThai || '').toUpperCase() !== 'DA_DUYET') continue;
    var ngay = ngayChuoi_(ds[i].Ngay);
    if (String(ngay).indexOf(ky) !== 0) continue;
    var ma = String(ds[i].MaNV || '').trim().toUpperCase();
    if (!ma) continue;
    if (!ra[ma]) ra[ma] = {};
    ra[ma][ngay] = {
      kyHieu: String(ds[i].KyHieuDeXuat || '').trim().toUpperCase(),
      soCong: (String(ds[i].SoCongDeXuat) === '' ? null : tien_(ds[i].SoCongDeXuat)),
      lyDo: String(ds[i].LyDo || ''), nguoiDuyet: String(ds[i].NguoiDuyet || ''),
      maDC: String(ds[i].MaDC || '')
    };
  }
  return ra;
}

/*================= TÍNH CÔNG MỘT NGƯỜI =================*/

/**
 * Trả về bảng công chi tiết từng ngày + số tổng hợp của 1 nhân viên trong 1 kỳ.
 * nguon = {chamCong, ngayLe, don, dieuChinh} (truyền sẵn để không đọc Sheet lặp lại
 * khi tính cho cả công ty — quan trọng với giới hạn 6 phút của Apps Script).
 */
function tinhCongThang_(nv, ky, nguon, c) {
  var ma = String(nv.MaNV).trim().toUpperCase();
  var cc = (nguon.chamCong[ma] || {});
  var dn = (nguon.don[ma] || {});
  var dc = (nguon.dieuChinh[ma] || {});
  var le = nguon.ngayLe;

  var vaoLam  = ngayChuoi_(nv.NgayVaoLam || '');
  var nghiViec = ngayChuoi_(nv.NgayNghiViec || '');
  var tranCong = chsSo_(c, 'tran_cong_thang', 26);
  var phepToiDa = chsSo_(c, 'phep_toi_da_moi_thang', 0);

  var ngays = cacNgayTrongKy_(ky);
  var chiTiet = [];
  var congLam = 0, congLe = 0, congPhep = 0, congBu = 0;
  var soNgayKhongLuong = 0, soNgayVang = 0, soNgayThieu = 0, soNgayNuaCong = 0;
  var soLanViPham = 0, tongPhutTre = 0, tienQuy = 0, chenhLech = 0;
  var canhBao = [];

  for (var i = 0; i < ngays.length; i++) {
    var ngay = ngays[i];
    var thu  = thuCuaNgay_(ngay);
    var ban  = cc[ngay] || null;
    var don  = dn[ngay] || null;
    var dieu = dc[ngay] || null;
    var kyHieu = '', ghi = '', nguonQD = '';

    // 1. Ngoài thời gian làm việc
    if ((vaoLam && ngay < vaoLam) || (nghiViec && ngay > nghiViec)) {
      kyHieu = 'NV'; nguonQD = 'Ngoai thoi gian lam viec';
    }
    // 2. Điều chỉnh đã duyệt — ưu tiên cao nhất
    else if (dieu && dieu.kyHieu) {
      kyHieu = dieu.kyHieu;
      ghi = dieu.lyDo;
      nguonQD = 'Dieu chinh da duyet (' + dieu.nguoiDuyet + ')';
    }
    // 3. Ngày lễ
    else if (le[ngay]) {
      kyHieu = 'L'; ghi = le[ngay]; nguonQD = 'Lich nghi le';
    }
    // 4. Chủ nhật — có chấm công thì tính là làm thêm Chủ nhật, không thì nghỉ tuần
    else if (thu === 0) {
      if (ban && ban.vao) {
        kyHieu = 'X';
        ghi = 'Lam Chu nhat — theo noi quy duoc nghi bu 1 ngay';
        nguonQD = 'App cham cong';
        canhBao.push({ ngay: ngay, muc: 'LUU_Y',
          noiDung: 'Lam Chu nhat ngay ' + ngay + ' — can tao ngay nghi bu, cong nay KHONG tu cong vao 26 cong chuan.' });
      } else {
        kyHieu = 'CN'; nguonQD = 'Ngay nghi hang tuan';
      }
    }
    // 5. Đơn đã duyệt
    else if (don && don.loaiDon === 'NGHI_PHEP') {
      kyHieu = 'P'; ghi = don.lyDo; nguonQD = 'Don nghi phep da duyet ' + don.maDon;
    }
    else if (don && don.loaiDon === 'NGHI_KHONG_LUONG') {
      kyHieu = 'KL'; ghi = don.lyDo; nguonQD = 'Don nghi khong luong da duyet ' + don.maDon;
    }
    // 6-8. Theo dữ liệu chấm công
    else if (ban && ban.vao && ban.ra) {
      kyHieu = 'X'; nguonQD = 'App cham cong';
      if (don && don.loaiDon === 'DI_TRE') ghi = 'Co don xin di tre/ve som da duyet';
      if (don && don.loaiDon === 'LAM_BU')  ghi = 'Co don xin lam bu gio da duyet';
    }
    else if (ban && (ban.vao || ban.ra)) {
      kyHieu = 'THIEU';
      ghi = 'Chi co ' + (ban.vao ? 'gio VAO ' + ban.vao : 'gio RA ' + ban.ra);
      nguonQD = 'App cham cong (thieu mot chieu)';
      canhBao.push({ ngay: ngay, muc: 'CAN_XU_LY',
        noiDung: 'Ngay ' + ngay + ' cham thieu mot chieu — can giai trinh va duyet dieu chinh truoc khi chot cong.' });
    }
    else {
      kyHieu = '?';
      nguonQD = 'Khong co du lieu';
      canhBao.push({ ngay: ngay, muc: 'CAN_XU_LY',
        noiDung: 'Ngay ' + ngay + ' khong co cham cong va khong co don — dang tinh 0 cong. Can xac nhan di lam hay vang.' });
    }

    var dinhNghia = KY_HIEU_CONG[kyHieu] || { cong: 0, nhom: 'CHUA_RO', moTa: kyHieu };
    var soCong = dinhNghia.cong;
    if (dieu && dieu.soCong !== null && dieu.soCong !== undefined) soCong = dieu.soCong;

    // Dồn vào từng nhóm
    switch (dinhNghia.nhom) {
      case 'LAM':         congLam  += soCong; if (soCong === 0.5) soNgayNuaCong++; break;
      case 'LE':          congLe   += soCong; break;
      case 'PHEP':        congPhep += soCong; break;
      case 'BU':          congBu   += soCong; break;
      case 'KHONG_LUONG': soNgayKhongLuong++; if (soCong > 0) congLam += soCong; break;
      case 'CHUA_RO':     if (kyHieu === 'THIEU') soNgayThieu++; else soNgayVang++; break;
      default: break;
    }

    if (ban) {
      soLanViPham += ban.soViPham;
      tongPhutTre += ban.phutTre + ban.phutVeSom;
      tienQuy     += ban.tienQuy;
      chenhLech   += ban.chenhLechPhut;
    }

    chiTiet.push({
      Ngay: ngay, Thu: tenThuVN_(thu), KyHieu: kyHieu, SoCong: soCong,
      MoTa: dinhNghia.moTa, GioVao: ban ? (ban.vao || '') : '', GioRa: ban ? (ban.ra || '') : '',
      PhutTre: ban ? ban.phutTre : 0, PhutVeSom: ban ? ban.phutVeSom : 0,
      TienQuy: ban ? ban.tienQuy : 0, GhiChu: ghi, Nguon: nguonQD
    });
  }

  // Trần phép trong tháng theo nội quy: vượt thì phần vượt tính không lương
  var phepVuot = 0;
  if (phepToiDa > 0 && congPhep > phepToiDa) {
    phepVuot = congPhep - phepToiDa;
    congPhep = phepToiDa;
    soNgayKhongLuong += phepVuot;
    canhBao.push({ ngay: '', muc: 'LUU_Y',
      noiDung: 'Dung ' + (congPhep + phepVuot) + ' ngay phep trong thang, vuot tran ' + phepToiDa
             + ' ngay/thang theo noi quy -> ' + phepVuot + ' ngay chuyen thanh nghi KHONG LUONG.' });
  }

  // Trần tổng công: cắt phần dư từ công làm trước, sau đó mới tới phép
  var congVaLe = congLam + congLe + congBu;
  var tong = congVaLe + congPhep;
  var phepHoanLai = 0, congBiCat = 0;
  if (tranCong > 0 && tong > tranCong) {
    var du = tong - tranCong;
    var catCong = Math.min(du, congLam);
    congLam -= catCong; congBiCat = catCong; du -= catCong;
    if (du > 0) { phepHoanLai = Math.min(du, congPhep); congPhep -= phepHoanLai; }
    congVaLe = congLam + congLe + congBu;
    tong = congVaLe + congPhep;
    canhBao.push({ ngay: '', muc: 'LUU_Y',
      noiDung: 'Tong cong + le + phep vuot tran ' + tranCong + ' -> da cat '
             + congBiCat + ' cong lam'
             + (phepHoanLai ? ' va hoan lai ' + phepHoanLai + ' ngay phep vao quy phep' : '') + '.' });
  }

  return {
    MaNV: nv.MaNV, HoTen: nv.HoTen, PhongBan: nv.PhongBan || '', Ky: ky,
    CongChuan: chsSo_(c, 'cong_chuan_thang', 26),
    NgayLamThuc: congLam, NgayNuaCong: soNgayNuaCong, NgayLe: congLe,
    NgayPhep: congPhep, NgayNghiBu: congBu,
    NgayNghiKhongLuong: soNgayKhongLuong, NgayVang: soNgayVang, NgayThieuCham: soNgayThieu,
    CongVaLe: congVaLe, TongCongTinhLuong: tong,
    PhepVuotTran: phepVuot, PhepHoanLai: phepHoanLai, CongBiCat: congBiCat,
    SoLanDiTreVeSom: soLanViPham, TongPhutTre: tongPhutTre, TienQuy: tienQuy,
    ChenhLechPhut: chenhLech,
    GioTangCaNgayThuong: 0, GioTangCaChuNhat: 0, GioTangCaNgayLe: 0,
    SoNgayCanXuLy: canhBao.filter(function (x) { return x.muc === 'CAN_XU_LY'; }).length,
    CanhBao: canhBao, ChiTiet: chiTiet
  };
}

function tenThuVN_(t) {
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][t] || '';
}

/*================= TÍNH CÔNG CẢ CÔNG TY =================*/

/** Đọc một lần toàn bộ nguồn dữ liệu của kỳ — tránh đọc Sheet lặp lại */
function nguonCongKy_(ky) {
  return {
    chamCong:  docChamCongKy_(ky),
    ngayLe:    docNgayLeKy_(ky),
    don:       docDonDuyetKy_(ky),
    dieuChinh: docDieuChinhKy_(ky)
  };
}

/** Danh sách nhân viên cần tính công trong kỳ (đang làm, hoặc nghỉ việc trong kỳ) */
function nhanSuTrongKy_(ky) {
  var cuoiKy = ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2);
  var dauKy  = ky + '-01';
  return docBang_(SH_HOSONV).filter(function (o) {
    var tt  = String(o.TrangThaiLamViec || 'DANG_LAM').toUpperCase();
    var vao = ngayChuoi_(o.NgayVaoLam || '');
    var ra  = ngayChuoi_(o.NgayNghiViec || '');
    if (vao && vao > cuoiKy) return false;          // chưa vào làm
    if (ra && ra < dauKy) return false;             // nghỉ việc trước kỳ
    if (tt !== 'DANG_LAM' && !ra) return false;     // khoá mà không có ngày nghỉ -> bỏ
    return true;
  });
}

function tinhCongCaCongTy_(ky) {
  var c = docCauHinhHR_();
  var nguon = nguonCongKy_(ky);
  var ds = nhanSuTrongKy_(ky);
  var ra = [];
  for (var i = 0; i < ds.length; i++) ra.push(tinhCongThang_(ds[i], ky, nguon, c));
  return ra;
}

/*================= API =================*/

function hrBangCong_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ds = tinhCongCaCongTy_(ky);

  // Bỏ chi tiết từng ngày cho nhẹ, chỉ giữ số tổng hợp + cảnh báo
  var gon = ds.map(function (o) {
    var y = {};
    for (var k in o) if (k !== 'ChiTiet') y[k] = o[k];
    return y;
  });
  gon = locTheoQuyen_(p, gon);

  // Đối chiếu với bản đã chốt (nếu có) để thấy ngay chỗ lệch
  var daChot = docBang_(SH_BANGCONG).filter(function (x) { return kyChuoi_(x.Ky) === ky; });
  var mapChot = {};
  for (var i = 0; i < daChot.length; i++) {
    mapChot[String(daChot[i].MaNV).trim().toUpperCase()] = daChot[i];
  }
  for (var j = 0; j < gon.length; j++) {
    var ch = mapChot[String(gon[j].MaNV).trim().toUpperCase()];
    gon[j].DaChot = !!ch;
    gon[j].CongDaChot = ch ? tien_(ch.TongCongTinhLuong) : null;
    gon[j].LechVoiBanChot = ch ? (gon[j].TongCongTinhLuong - tien_(ch.TongCongTinhLuong)) : null;
  }

  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  return {
    ok: true, ky: ky, danhSach: gon, tong: gon.length,
    trangThaiKy: ky1 ? String(ky1.TrangThai || 'MO') : 'CHUA_TAO',
    tongCanXuLy: gon.reduce(function (s, x) { return s + (x.SoNgayCanXuLy || 0); }, 0)
  };
}

function hrCongChiTiet_(req, p) {
  var ky = kyChuoi_(req.ky || kyHienTai_());
  var ma = String(req.maNV || '').trim().toUpperCase();
  if (!ma) return { ok: false, loi: 'Thieu ma nhan vien.' };
  if (p.vaiTro === 'NV' && ma !== p.maNV.toUpperCase()) {
    return { ok: false, loi: 'Ban chi xem duoc bang cong cua chinh minh.' };
  }

  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (!nv) return { ok: false, loi: 'Khong tim thay ho so ' + ma };
  if (p.vaiTro === 'TRUONG_BP' &&
      String(nv.PhongBan || '').toUpperCase() !== String(p.phongBan || '').toUpperCase()) {
    return { ok: false, loi: 'Nhan vien nay khong thuoc phong ban cua ban.' };
  }

  var kq = tinhCongThang_(nv, ky, nguonCongKy_(ky), docCauHinhHR_());
  return { ok: true, ky: ky, cong: kq };
}

/** Ghi đề xuất / duyệt điều chỉnh công 1 ngày */
function hrLuuDieuChinhCong_(req, p) {
  var o = req.dieuChinh || {};
  var ma   = String(o.MaNV || '').trim().toUpperCase();
  var ngay = ngayChuoi_(o.Ngay || '');
  var kyHieu = String(o.KyHieuDeXuat || '').trim().toUpperCase();
  if (!ma || !ngay) return { ok: false, loi: 'Thieu ma nhan vien hoac ngay.' };
  if (!KY_HIEU_CONG[kyHieu]) {
    return { ok: false, loi: 'Ky hieu khong hop le: ' + kyHieu
                           + '. Chi nhan: ' + Object.keys(KY_HIEU_CONG).join(', ') };
  }
  // Nhân viên chỉ được tự đề xuất cho chính mình, không được tự duyệt
  if (p.vaiTro === 'NV' && ma !== p.maNV.toUpperCase()) {
    return { ok: false, loi: 'Ban chi de xuat dieu chinh cho chinh minh.' };
  }

  var ky = ngay.slice(0, 7);
  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (ky1 && ['DA_CHOT_LUONG', 'DA_CHI'].indexOf(String(ky1.TrangThai || '').toUpperCase()) >= 0) {
    return { ok: false, loi: 'Ky ' + ky + ' da chot luong. Phai mo lai ky truoc khi sua cong.' };
  }

  var nv = timDong_(SH_HOSONV, { MaNV: ma });
  if (!nv) return { ok: false, loi: 'Khong tim thay ho so ' + ma };

  var tuDuyet = (p.vaiTro === 'ADMIN' || p.vaiTro === 'HR');
  var cu = timDong_(SH_DIEUCHINHCONG, { MaNV: ma, Ngay: ngay });
  var sach = {
    MaNV: ma, HoTen: nv.HoTen, Ngay: ngay,
    KyHieuApTinh: String(o.KyHieuApTinh || ''),
    KyHieuDeXuat: kyHieu,
    SoCongDeXuat: (o.SoCongDeXuat === '' || o.SoCongDeXuat === undefined)
                    ? KY_HIEU_CONG[kyHieu].cong : tien_(o.SoCongDeXuat),
    LyDo: String(o.LyDo || ''), NguonGoc: String(o.NguonGoc || 'Cong nhan su'),
    MaDonLienQuan: String(o.MaDonLienQuan || ''),
    NguoiDeXuat: p.maNV,
    TrangThai: tuDuyet ? 'DA_DUYET' : 'CHO_DUYET',
    NguoiDuyet: tuDuyet ? p.maNV : '',
    ThoiGianDuyet: tuDuyet ? nowHR_() : '',
    GhiChu: String(o.GhiChu || ''), NgayTao: hnayHR_()
  };

  if (cu) {
    sach.MaDC = cu.MaDC;
    suaDong_(SH_DIEUCHINHCONG, cu._dong, sach);
  } else {
    sach.MaDC = sinhMa_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_DIEUCHINHCONG), 'DC');
    themDong_(SH_DIEUCHINHCONG, sach);
  }
  ghiNhatKy_(p.maNV, p.vaiTro, 'DIEUCHINH_CONG', ma + ' ' + ngay,
             kyHieu + ' (' + sach.SoCongDeXuat + ' cong) — ' + sach.LyDo);
  return { ok: true, thongBao: tuDuyet
    ? 'Da ghi va duyet dieu chinh cong ngay ' + ngay + ' cho ' + nv.HoTen
    : 'Da gui de xuat dieu chinh, cho nhan su duyet.', maDC: sach.MaDC, trangThai: sach.TrangThai };
}

/** Chốt bảng công của kỳ — ghi ảnh chụp vào tab BANGCONG để không bị thay đổi sau */
function hrChotCong_(req, p) {
  var chan = doiQuyen_(p, ['ADMIN', 'HR']);
  if (chan) return chan;

  var ky = kyChuoi_(req.ky || kyHienTai_());
  var boQuaCanhBao = !!req.boQuaCanhBao;
  var ds = tinhCongCaCongTy_(ky);

  var canXuLy = ds.filter(function (x) { return x.SoNgayCanXuLy > 0; });
  if (canXuLy.length && !boQuaCanhBao) {
    return {
      ok: false, canXacNhan: true,
      loi: 'Con ' + canXuLy.length + ' nhan vien co ngay cong chua ro (cham thieu chieu / khong co du lieu). '
         + 'Xu ly giai trinh truoc, hoac goi lai voi boQuaCanhBao = true de chot va ghi nhan 0 cong cho nhung ngay do.',
      danhSach: canXuLy.map(function (x) {
        return { MaNV: x.MaNV, HoTen: x.HoTen, SoNgayCanXuLy: x.SoNgayCanXuLy,
                 CanhBao: x.CanhBao.filter(function (y) { return y.muc === 'CAN_XU_LY'; }) };
      })
    };
  }

  var ky1 = timDong_(SH_KYLUONG, { Ky: ky });
  if (ky1 && ['DA_CHOT_LUONG', 'DA_CHI'].indexOf(String(ky1.TrangThai || '').toUpperCase()) >= 0) {
    return { ok: false, loi: 'Ky ' + ky + ' da chot luong, khong chot lai cong duoc. Mo lai ky truoc.' };
  }

  // Xoá bản chốt cũ của kỳ rồi ghi lại
  xoaDongTheoKy_(SH_BANGCONG, ky);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BANGCONG);
  var m = mapCot_(sh), n = sh.getLastColumn(), rows = [];
  for (var i = 0; i < ds.length; i++) {
    var o = ds[i], dong = [];
    for (var z = 0; z < n; z++) dong.push('');
    var gan = {
      Ky: ky, MaNV: o.MaNV, HoTen: o.HoTen, PhongBan: o.PhongBan, CongChuan: o.CongChuan,
      NgayLamThuc: o.NgayLamThuc, NgayNuaCong: o.NgayNuaCong, NgayLe: o.NgayLe,
      NgayPhep: o.NgayPhep, NgayNghiBu: o.NgayNghiBu,
      NgayNghiKhongLuong: o.NgayNghiKhongLuong, NgayVang: o.NgayVang,
      NgayThieuCham: o.NgayThieuCham, TongCongTinhLuong: o.TongCongTinhLuong,
      SoLanDiTreVeSom: o.SoLanDiTreVeSom, TongPhutTre: o.TongPhutTre, TienQuy: o.TienQuy,
      ChenhLechPhut: o.ChenhLechPhut, GioTangCaNgayThuong: o.GioTangCaNgayThuong,
      GioTangCaChuNhat: o.GioTangCaChuNhat, GioTangCaNgayLe: o.GioTangCaNgayLe,
      GhiChu: o.CanhBao.map(function (x) { return x.noiDung; }).join(' | ').slice(0, 1000),
      TrangThai: 'DA_CHOT', NgayChot: hnayHR_(), NguoiChot: p.maNV
    };
    for (var k in gan) if (m[k] !== undefined) dong[m[k]] = gan[k];
    rows.push(dong);
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows);

  // Cập nhật trạng thái kỳ
  var thongTinKy = {
    Ky: ky, TuNgay: ky + '-01',
    DenNgay: ky + '-' + ('0' + soNgayTrongKy_(ky)).slice(-2),
    CongChuan: chsSo_(docCauHinhHR_(), 'cong_chuan_thang', 26),
    TrangThai: 'DA_CHOT_CONG', NgayChotCong: hnayHR_(),
    SoNhanVien: ds.length, NguoiChot: p.maNV
  };
  if (ky1) suaDong_(SH_KYLUONG, ky1._dong, thongTinKy);
  else themDong_(SH_KYLUONG, thongTinKy);

  // Đồng bộ ngày phép đã dùng sang quỹ phép
  var dbPhep = dongBoPhepTuBangCong_(ky, p);

  ghiNhatKy_(p.maNV, p.vaiTro, 'CHOT_CONG', ky,
             ds.length + ' nhan vien, bo qua canh bao = ' + boQuaCanhBao);
  return { ok: true, ky: ky, soNhanVien: ds.length,
           thongBao: 'Da chot bang cong ky ' + ky + ' cho ' + ds.length + ' nhan vien.',
           dongBoPhep: dbPhep,
           canhBaoDaBoQua: boQuaCanhBao ? canXuLy.length : 0 };
}

/** Xoá mọi dòng của 1 kỳ trong 1 tab (xoá từ dưới lên để không lệch chỉ số dòng) */
function xoaDongTheoKy_(tenTab, ky) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tenTab);
  if (!sh || sh.getLastRow() < 2) return 0;
  var m = mapCot_(sh);
  if (m['Ky'] === undefined) return 0;
  var v = sh.getRange(2, m['Ky'] + 1, sh.getLastRow() - 1, 1).getValues();
  var xoa = [];
  for (var i = 0; i < v.length; i++) if (kyChuoi_(v[i][0]) === ky) xoa.push(i + 2);
  for (var j = xoa.length - 1; j >= 0; j--) sh.deleteRow(xoa[j]);
  return xoa.length;
}

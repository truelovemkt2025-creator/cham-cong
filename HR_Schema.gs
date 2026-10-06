/**
 * ============================================================================
 *  PHẦN MỀM NHÂN SỰ TRUE LOVE  —  HR_Schema.gs
 *  Công ty Cổ phần LOVE JOURNEY
 * ----------------------------------------------------------------------------
 *  File này KHAI BÁO toàn bộ bảng dữ liệu của phân hệ nhân sự và chạy
 *  migration tự chữa (tự thêm tab/cột/cấu hình còn thiếu, KHÔNG xoá dữ liệu cũ).
 *
 *  Nằm CHUNG Apps Script project với app chấm công (Code.gs) và CHUNG một
 *  Google Sheet  ->  số công chảy thẳng từ tab CHAMCONG sang bảng lương,
 *  không cần đồng bộ, không cần API trung gian.
 *
 *  Cách dùng lần đầu / sau mỗi lần sửa schema:
 *     Menu Sheet  "Nhân sự"  ->  "1. Cài đặt / cập nhật phân hệ nhân sự"
 * ============================================================================
 */

/*================= TÊN CÁC TAB =================*/
var SH_HOSONV    = 'HOSONV';       // Hồ sơ nhân sự đầy đủ
var SH_HOPDONG   = 'HOPDONG';      // Hợp đồng lao động
var SH_LSLUONG   = 'LICHSULUONG';  // Lịch sử thay đổi lương
var SH_PHUCAP    = 'PHUCAP';       // Phụ cấp / khoản cộng thường xuyên
var SH_PHEPNAM   = 'PHEPNAM';      // Quỹ phép năm theo từng năm
var SH_BIENDONGPHEP = 'BIENDONGPHEP'; // Nhật ký cộng/trừ phép
var SH_NGAYLE    = 'NGAYLE';       // Lịch nghỉ lễ hưởng nguyên lương
var SH_BANGCONG  = 'BANGCONG';     // Bảng công đã chốt theo kỳ
var SH_KYLUONG   = 'KYLUONG';      // Kỳ lương (mở / đã chốt / đã chi)
var SH_BANGLUONG = 'BANGLUONG';    // Bảng lương chi tiết theo kỳ
var SH_KPI       = 'KPI';          // Chỉ tiêu & kết quả KPI, thưởng
var SH_KHOANKHAC = 'KHOANKHAC';    // Tạm ứng / thu nhập khác / giảm trừ khác
var SH_BHXH      = 'BHXH';         // Theo dõi tham gia BHXH
var SH_TAISAN    = 'TAISAN';       // Tài sản cấp phát
var SH_KYLUAT    = 'KHENTHUONGKYLUAT'; // Khen thưởng - kỷ luật
var SH_DIEUCHINHCONG = 'DIEUCHINHCONG'; // Giải trình / điều chỉnh công từng ngày
var SH_GIOBU     = 'GIOBU';        // Sổ cái giờ làm thêm - nghỉ bù
var SH_DONGYDL   = 'DONGYDULIEU';  // Bằng chứng đồng ý thu dữ liệu cá nhân nhạy cảm
var SH_NHATKY    = 'NHATKY';       // Nhật ký thao tác (audit log)
var SH_CAUHINHHR = 'CAUHINH_HR';   // Tham số pháp lý & chính sách

/**
 * Bộ ký hiệu công — bê nguyên từ file "TONG HOP CHAM CONG T8-2026" của công ty
 * để bảng công của phần mềm đọc giống hệt bảng kế toán đang quen dùng.
 *   cong  = số công tính lương của ngày đó
 *   nhom  = LAM | PHEP | KHONG_LUONG | NGHI_TUAN | LE | BU | NGHI_VIEC | CHUA_RO
 */
var KY_HIEU_CONG = {
  'X':     { cong: 1,   nhom: 'LAM',          moTa: 'Di lam - co cham cong' },
  'TC':    { cong: 1,   nhom: 'LAM',          moTa: 'Cham cong thu cong - truong bo phan xac nhan co di lam' },
  'VT':    { cong: 1,   nhom: 'LAM',          moTa: 'Loi van tay / quen check in - truong bo phan xac nhan' },
  'ONL':   { cong: 1,   nhom: 'LAM',          moTa: 'Lam viec online - van tinh cong' },
  '1/2':   { cong: 0.5, nhom: 'LAM',          moTa: 'Chi lam nua ngay (xin off nua ngay co giai trinh)' },
  'P':     { cong: 1,   nhom: 'PHEP',         moTa: 'Nghi phep nam - huong luong, tru vao quy phep' },
  'P/2':   { cong: 0.5, nhom: 'PHEP',         moTa: 'Nghi phep nua ngay' },
  'KL':    { cong: 0,   nhom: 'KHONG_LUONG',  moTa: 'Nghi khong luong' },
  'KL/2':  { cong: 0.5, nhom: 'KHONG_LUONG',  moTa: 'Nua ngay lam + nua ngay khong luong' },
  'BU':    { cong: 1,   nhom: 'BU',           moTa: 'Nghi bu cho ngay da di lam them - tinh du cong, khong tru phep' },
  'BU/2':  { cong: 0.5, nhom: 'BU',           moTa: 'Nghi bu nua ngay' },
  'L':     { cong: 1,   nhom: 'LE',           moTa: 'Nghi le huong nguyen luong' },
  'CN':    { cong: 0,   nhom: 'NGHI_TUAN',    moTa: 'Chu nhat - ngay nghi hang tuan' },
  'NV':    { cong: 0,   nhom: 'NGHI_VIEC',    moTa: 'Da nghi viec' },
  'V':     { cong: 0,   nhom: 'CHUA_RO',      moTa: 'Vang khong phep - khong cham cong, khong giai trinh' },
  '?':     { cong: 0,   nhom: 'CHUA_RO',      moTa: 'Chua ro - thieu du lieu cham cong va thieu giai trinh' },
  'THIEU': { cong: 0,   nhom: 'CHUA_RO',      moTa: 'Cham thieu mot chieu (chi co vao hoac chi co ra)' }
};

/*================= CỘT TỪNG TAB =================*/

/** Hồ sơ nhân sự — khoá chính MaNV, khớp với NHANSU của app chấm công */
var COT_HOSONV = [
  'MaNV','HoTen','NgaySinh','GioiTinh','CCCD','NgayCapCCCD','NoiCapCCCD',
  'DienThoai','EmailCaNhan','EmailCongTy','DiaChiThuongTru','DiaChiHienTai',
  'PhongBan','ChucDanh','CapBac','QuanLyTrucTiep','NgayVaoLam','NgayThuViecTu','NgayThuViecDen',
  'TrangThaiLamViec','NgayNghiViec','LyDoNghiViec','SoTaiKhoan','NganHang','ChuTaiKhoan',
  'MaSoThue','SoBHXH','SoNguoiPhuThuoc','TinhTrangHonNhan','HocVan','ChuyenNganh',
  'LienHeKhanCap','SDTKhanCap','MaVanTay','AnhHoSoURL','GhiChu','NgayCapNhat','NguoiCapNhat'
];
// MaVanTay: 1 nguoi co the co nhieu ma may van tay (vd co Loan: 68 nua dau thang,
// 85 nua sau) -> ghi nhieu ma cach nhau dau phay de gop ve dung 1 nhan su.

/** Hợp đồng lao động. LoaiHD: TV (thử việc) / CT (chính thức, có BHXH) / CTV (cộng tác viên) */
var COT_HOPDONG = [
  'MaHD','MaNV','HoTen','LoaiHD','HinhThuc','NgayKy','NgayHieuLuc','NgayHetHan',
  'ChucDanh','PhongBan','LuongThoaThuan','LuongCoBanBHXH','PhuCapCoDinh',
  'ThoiGianLamViec','DongBHXH','TyLeThuViec','TrangThai','SoLanGiaHan','FileURL','GhiChu',
  'NgayTao','NguoiTao'
];

/** Lịch sử thay đổi lương — bắt buộc có để truy vết, không ghi đè số cũ */
var COT_LSLUONG = [
  'MaLS','MaNV','HoTen','NgayHieuLuc','LuongCu','LuongMoi','LuongBHXHCu','LuongBHXHMoi',
  'LyDo','QuyetDinhSo','NguoiDuyet','NgayTao','NguoiTao','GhiChu'
];

/** Phụ cấp / khoản cộng định kỳ (ăn trưa, điện thoại, xăng xe, trách nhiệm...) */
var COT_PHUCAP = [
  'MaPC','MaNV','HoTen','LoaiPhuCap','SoTien','ChiuThue','DongBHXH',
  'TuThang','DenThang','TrangThai','GhiChu'
];

/** Quỹ phép năm theo năm — 1 dòng / nhân viên / năm */
var COT_PHEPNAM = [
  'Nam','MaNV','HoTen','NgayVaoLam','PhepChuanNam','PhepThamNien','PhepCongThem',
  'PhepTonKyTruoc','TongPhepDuoc','DaNghi','DaThanhToan','ConLai','HanSuDungTon','GhiChu','NgayCapNhat'
];

/** Nhật ký cộng/trừ phép — mỗi lần nghỉ phép / điều chỉnh là 1 dòng */
var COT_BIENDONGPHEP = [
  'MaBD','Nam','MaNV','HoTen','Ngay','SoNgay','Loai','NguonGoc','MaDonLienQuan',
  'NguoiDuyet','GhiChu','NgayTao'
];

/** Lịch nghỉ lễ hưởng nguyên lương (Điều 112 BLLĐ + ngày nghỉ bù do công ty công bố) */
var COT_NGAYLE = ['Ngay','TenNgayLe','HuongLuong','PhamVi','GhiChu'];

/** Bảng công đã chốt theo kỳ — ảnh chụp số công tại thời điểm chốt lương */
var COT_BANGCONG = [
  'Ky','MaNV','HoTen','PhongBan','CongChuan','NgayLamThuc','NgayNuaCong','NgayLe','NgayPhep',
  'NgayNghiBu','NgayNghiKhongLuong','NgayVang','NgayThieuCham','TongCongTinhLuong',
  'SoLanDiTreVeSom','TongPhutTre','TienQuy','ChenhLechPhut','GioTangCaNgayThuong',
  'GioTangCaChuNhat','GioTangCaNgayLe','GhiChu','TrangThai','NgayChot','NguoiChot'
];

/** Kỳ lương */
var COT_KYLUONG = [
  'Ky','TuNgay','DenNgay','CongChuan','TrangThai','NgayChotCong','NgayChotLuong','NgayChi',
  'TongChiPhiLuong','SoNhanVien','NguoiChot','GhiChu'
];

/** Bảng lương chi tiết — 1 dòng / nhân viên / kỳ. Đây là tab kế toán dùng. */
var COT_BANGLUONG = [
  'Ky','MaNV','HoTen','PhongBan','ChucDanh','LoaiHD',
  'LuongThoaThuan','LuongCoBanBHXH','CongChuan','CongVaLe','NgayPhep','TongCongTinhLuong',
  'LuongTheoCong','LuongPhep','LuongLe','LuongTangCa','PhuCap','PhuCapChiuThue',
  'PhuCapChuyenCan','SoLanDiTreVeSom',
  'LuongCung_LCB','HoaHong','ThuongKPI','ThuongMocDoanhThu','ThuongKhac','ThuNhapKhac',
  'TongThuNhap','DongBaoHiem','ThuNhapChiuBH','BH_BHXH','BH_BHYT','BH_BHTN','TongBaoHiemNLD',
  'CongTy_BHXH','CongTy_BHYT','CongTy_BHTN','CongTy_BHTNLD','CongTy_KPCD','TongBaoHiemCongTy',
  'MienThueAnTrua','ThuNhapChiuThue','GiamTruBanThan','GiamTruPhuThuoc','SoNguoiPhuThuoc',
  'ThuNhapTinhThue','ThueTNCN','CachTinhThue',
  'TamUng','TruyThuTruyLinh','GiamTruKhac','TienQuyChung',
  'ThuongDaChiGiuaKy','ThucNhan','ChiPhiCongTy','TrangThai','GhiChu','NgayTinh','NguoiTinh'
];
// ThuongDaChiGiuaKy: khoan thuong doanh so DA chuyen khoan rieng giua thang.
//   -> VAN cong vao TongThuNhap de tinh thue dung,
//   -> nhung TRU ra khoi ThucNhan vi da tra roi.
//   Dung lai dung logic cot AM cua bang luong hien tai: ROUND(AJ-S-X-AK,-3) - AH
// TruyThuTruyLinh: so am = truy thu (vd nghi qua phep thang truoc), so duong = truy linh.

/** KPI & thưởng — mềm theo vai trò (telesale / sale leader / tâm lý / marketing / khác) */
var COT_KPI = [
  'Ky','MaNV','HoTen','PhongBan','VaiTroKPI','DoanhSoTruocVAT','HeSoDatSan',
  'TyLeHoaHong','TienHoaHong','LCBTheoBac','SoLichHen','ThuongLichHen',
  'SoHoSoGhepDoi','SoHoSoTimHieu','SoHoSoHenHo','ThuongHoSo','ThuongVuotChiTieu',
  'ThuongMocDoanhThu','TongThuongKPI','TrangThai','GhiChu','NgayTinh'
];

/** Tạm ứng / thu nhập khác / giảm trừ khác */
var COT_KHOANKHAC = [
  'MaKhoan','Ky','MaNV','HoTen','Loai','TenKhoan','SoTien','ChiuThue',
  'TrangThai','NguoiDuyet','GhiChu','NgayTao','NguoiTao'
];

/** Theo dõi tham gia BHXH */
var COT_BHXH = [
  'MaNV','HoTen','SoBHXH','NgayBatDauDong','NgayNgungDong','MucLuongDong',
  'NoiDangKyKCB','TrangThai','HoSoDaNop','GhiChu','NgayCapNhat'
];

/** Tài sản cấp phát */
var COT_TAISAN = [
  'MaTS','MaNV','HoTen','TenTaiSan','SoLuong','GiaTri','NgayCap','NgayTraDuKien',
  'NgayTraThuc','TinhTrang','TrangThai','GhiChu'
];

/** Khen thưởng - Kỷ luật */
var COT_KYLUAT = [
  'MaQD','MaNV','HoTen','Loai','NoiDung','MucDo','SoTien','NgayApDung',
  'NguoiQuyetDinh','FileURL','GhiChu','NgayTao'
];

/**
 * Điều chỉnh / giải trình công từng ngày — tab QUAN TRỌNG NHẤT về tính đúng công.
 * Thay cho cách cũ: app báo một số, team nhắn Zalo một số khác, kế toán sửa tay
 * trong Excel mà không ai truy được ai chốt. Ở đây mỗi lần sửa 1 ngày công đều
 * phải có người đề xuất + người duyệt + dấu thời gian.
 * KyHieu nhận giá trị trong KY_HIEU_CONG; điều chỉnh ĐÃ DUYỆT sẽ ghi đè số app.
 */
var COT_DIEUCHINHCONG = [
  'MaDC','Ngay','MaNV','HoTen','KyHieuApTinh','KyHieuDeXuat','SoCongDeXuat',
  'LyDo','NguonGoc','MaDonLienQuan','NguoiDeXuat','TrangThai','NguoiDuyet',
  'ThoiGianDuyet','GhiChu','NgayTao'
];

/**
 * Sổ cái giờ làm thêm — nghỉ bù. Nội quy công ty: tăng ca từ 2 tiếng được
 * quy thành nghỉ bù (không trả tiền), nên phải có số dư giờ rõ ràng,
 * không để nằm trong ghi chú như hiện nay.
 */
var COT_GIOBU = [
  'MaGB','MaNV','HoTen','Loai','Ngay','SoGio','LyDo','MaDonLienQuan',
  'NgaySuDung','TrangThai','NguoiDuyet','GhiChu','NgayTao'
];

/**
 * Bằng chứng đồng ý thu dữ liệu cá nhân NHẠY CẢM.
 * Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026) + NĐ 356/2025/NĐ-CP
 * xếp ẢNH KHUÔN MẶT và VỊ TRÍ ĐỊA LÝ CHÍNH XÁC vào dữ liệu nhạy cảm — đúng hai thứ
 * app chấm công đang thu. Phải thông báo mục đích trước khi thu, có đồng ý tự nguyện
 * của từng người, có thời hạn lưu trữ và cơ chế xoá. Mức phạt tối đa 5% doanh thu
 * năm trước hoặc 3 tỷ đồng.
 */
var COT_DONGYDL = [
  'MaDY','MaNV','HoTen','LoaiDuLieu','MucDich','DaDongY','ThoiDiemDongY',
  'PhuongThuc','ThoiHanLuuTruNgay','FileVanBanURL','ThoiDiemRutDongY','GhiChu'
];

/** Nhật ký thao tác — ai sửa gì, lúc nào (bắt buộc với dữ liệu lương) */
var COT_NHATKY = ['ThoiGian','NguoiThucHien','VaiTro','HanhDong','DoiTuong','ChiTiet','IP'];

/** Tham số pháp lý & chính sách — sửa được trên Sheet, không cần sửa code */
var COT_CAUHINHHR = ['Khoa','GiaTri','MoTa','NguonCanCu'];

/*================= THAM SỐ MẶC ĐỊNH =================*/
/**
 * Mọi con số pháp lý đều để ở đây, KHÔNG hardcode trong công thức tính lương.
 * Luật đổi -> sếp chỉ sửa ô GiaTri trên Sheet, không cần sửa code.
 */
var CAUHINH_HR_MAC_DINH = [
  // --- Công & lương cơ sở ---
  ['cong_chuan_thang',      '26',     'So ngay cong chuan 1 thang (lam 6 ngay/tuan, nghi Chu nhat)', 'Chinh sach cong ty, sep Lien chot 11/09/2026'],
  ['tran_cong_thang',       '26',     'Cong + le + phep toi da duoc tinh trong 1 thang', 'Sep Lien chot 11/09/2026'],
  ['lam_tron_luong',        '1000',   'Lam tron cac khoan luong toi don vi nay (dong)', 'Thuc te bang luong dang dung'],
  ['luong_toi_thieu_vung',  '5310000','Luong toi thieu vung I (TP.HCM) — dung lam tran dong BHTN', 'ND 293/2025/ND-CP, hieu luc 01/01/2026'],
  ['muc_tham_chieu_bhxh',   '2530000','Muc tham chieu tinh BHXH — dung lam tran dong BHXH/BHYT', 'ND 161/2026/ND-CP, tu 01/07/2026'],
  // Tham so co hieu luc theo ngay: them khoa dang "<khoa>@<YYYY-MM>" thi ky tu thang do
  // tro di dung gia tri moi, ky cu van dung gia tri cu -> tinh lai luong thang cu khong bi sai.
  ['muc_tham_chieu_bhxh@2024-07', '2340000','Muc tham chieu ap dung cho cac ky 07/2024 - 06/2026', 'ND 73/2024/ND-CP'],
  ['muc_tham_chieu_bhxh@2026-07', '2530000','Muc tham chieu ap dung tu ky 07/2026', 'ND 161/2026/ND-CP'],
  ['luong_toi_thieu_vung@2024-07','4960000','LTT vung I ap dung cac ky 07/2024 - 12/2025', 'ND 74/2024/ND-CP'],
  ['luong_toi_thieu_vung@2026-01','5310000','LTT vung I ap dung tu ky 01/2026', 'ND 293/2025/ND-CP'],

  // --- Bảo hiểm: phần người lao động ---
  ['ty_le_bhxh_nld',        '8',      '% BHXH tru vao luong nguoi lao dong', 'Luat BHXH 2024'],
  ['ty_le_bhyt_nld',        '1.5',    '% BHYT tru vao luong nguoi lao dong', 'Luat BHYT'],
  ['ty_le_bhtn_nld',        '1',      '% BHTN tru vao luong nguoi lao dong', 'Luat Viec lam'],
  // --- Bảo hiểm: phần công ty đóng (không trừ lương, dùng để tính chi phí thật) ---
  ['ty_le_bhxh_cty',        '17',     '% BHXH cong ty dong', 'Luat BHXH 2024'],
  ['ty_le_bhyt_cty',        '3',      '% BHYT cong ty dong', 'Luat BHYT'],
  ['ty_le_bhtn_cty',        '1',      '% BHTN cong ty dong', 'Luat Viec lam'],
  ['ty_le_bhtnld_cty',      '0.5',    '% BH tai nan lao dong - benh nghe nghiep cong ty dong (du thao giam ve 0,3% tu 2027 chua ban hanh)', 'ND 58/2020/ND-CP'],
  ['ty_le_kpcd_cty',        '2',      '% kinh phi cong doan cong ty dong (ngoai bao hiem, tinh vao chi phi nhan su)', 'Luat Cong doan + ND 191/2013/ND-CP'],
  ['he_so_tran_bhxh',       '20',     'Tran dong BHXH/BHYT = so nay x muc tham chieu (hien = 50.600.000d)', 'Dieu 31 Luat BHXH 2024'],
  ['he_so_tran_bhtn',       '20',     'Tran dong BHTN = so nay x luong toi thieu vung (hien = 106.200.000d)', 'Luat Viec lam 2025'],
  ['san_dong_bh',           '5310000','San tien luong dong BH = LTT vung I. Luong dong thap hon muc nay se bi canh bao', 'BLLD 2019 + ND 293/2025'],
  ['loai_hd_dong_bh',       'CT',     'Chi loai hop dong nay bi tru bao hiem (nhieu loai cach nhau dau phay)', 'Thuc te bang luong True Love'],
  ['mien_dong_bh_tu_ngay_nghi','14',  'Khong lam viec va khong huong luong tu bao nhieu ngay trong thang thi mien dong BH thang do', 'Luat BHXH 2024, hieu luc 01/07/2025'],

  // --- Thuế thu nhập cá nhân ---
  ['giam_tru_ban_than',     '15500000','Giam tru gia canh cho ban than nguoi lao dong (dong/thang)', 'Muc dang ap dung tai bang luong True Love 2026'],
  ['giam_tru_phu_thuoc',    '6200000', 'Giam tru cho moi nguoi phu thuoc (dong/thang)', 'Muc dang ap dung tai bang luong True Love 2026'],
  ['bac_thue',              '10000000:5|30000000:10|60000000:20|100000000:30|0:35',
                            'Bieu thue luy tien: "tran bac:thue%" cach nhau dau |, bac cuoi tran 0 = khong gioi han',
                            'Doc nguyen tu cong thuc cot X bang luong T08+T09/2026 cua cong ty'],
  ['ty_le_khau_tru_tv_ctv', '10',     '% khau tru thang voi HD thu viec/CTV duoi 3 thang (khong quyet toan luy tien)', 'ND 253/2026/ND-CP, tu 01/07/2026'],
  ['nguong_khau_tru_tv_ctv','5000000','Thu nhap tu muc nay tro len moi khau tru 10% (nguong cu 2.000.000 da het hieu luc)', 'ND 253/2026/ND-CP, tu 01/07/2026'],
  ['nguong_khau_tru_tv_ctv@2026-07','5000000','Nguong ap dung tu ky 07/2026', 'ND 253/2026/ND-CP'],
  ['ty_le_khau_tru_khong_cu_tru','20','% khau tru voi ca nhan KHONG cu tru, khong duoc giam tru gia canh', 'Luat Thue TNCN'],
  ['mien_thue_an_trua',     '1200000','Tien an trua/giua ca tra bang tien duoc mien thue toi muc nay/thang (muc cu 730.000 da het hieu luc)', 'ND 253/2026/ND-CP, tu 01/07/2026'],
  ['mien_thue_trang_phuc_nam','5000000','Tien trang phuc tra bang tien duoc mien thue toi muc nay/nam', 'ND 253/2026/ND-CP'],

  // --- Phép năm ---
  // Cong ty dang chay che do THANG (Noi quy 01/01/2025: moi thang 1 ngay phep, cong don,
  // bo qua 2 thang thu viec, moi thang dung toi da 3 ngay). Doi sang NAM de chay theo
  // Dieu 113 BLLD (12 ngay/nam + tham nien) ma khong can sua code.
  ['phep_che_do',           'THANG',  'THANG = cong don 1 ngay/thang theo noi quy cong ty; NAM = 12 ngay/nam theo Dieu 113 BLLD', 'Noi quy Love Journey 01/01/2025'],
  ['phep_moi_thang',        '1',      'Che do THANG: so ngay phep duoc cong moi thang lam viec', 'Noi quy Love Journey 01/01/2025'],
  ['phep_bo_qua_thang_dau', '2',      'Che do THANG: bo qua bao nhieu thang dau (thu viec) khi cong phep', 'Noi quy Love Journey 01/01/2025'],
  ['phep_toi_da_moi_thang', '3',      'Toi da so ngay phep duoc dung trong 1 thang, vuot thi tinh khong luong', 'Noi quy Love Journey 01/01/2025'],
  ['phep_chuan_nam',        '12',     'Che do NAM: so ngay phep nam co ban (dieu kien lam viec binh thuong)', 'Dieu 113 BLLD 2019'],
  ['phep_tham_nien_moi_nam','5',      'Che do NAM: cu du bao nhieu nam lam viec thi duoc them 1 ngay phep', 'Dieu 114 BLLD 2019'],
  ['tinh_phep_theo_ty_le',  'CO',     'Che do NAM: nguoi lam chua du 12 thang thi phep tinh theo ty le thang lam viec', 'Dieu 113.2 BLLD 2019'],
  ['phep_cho_phep_ton',     'CO',     'CO = cho chuyen phep ton sang nam sau, KHONG = het nam la mat', 'Chinh sach cong ty'],
  ['han_dung_phep_ton',     '',       'Han cuoi dung phep ton cua nam truoc, dang MM-DD (bo trong = khong gioi han)', 'Chinh sach cong ty'],
  ['chan_nghi_qua_phep',    'CO',     'CO = canh bao/chan khi so du phep khong du luc duyet don (tranh phep am phai truy thu)', 'Chinh sach cong ty'],
  ['thanh_toan_phep_nghi_viec','CO',  'CO = thanh toan 100% tien phep chua nghi khi nghi viec', 'Dieu 113.3 BLLD 2019 + Noi quy'],

  // --- Chuyên cần (cơ chế HỢP PHÁP thay cho thu quỹ đi trễ) ---
  // Dieu 127 khoan 2 BLLD 2019 NGHIEM CAM "phat tien, cat luong thay viec xu ly ky luat
  // lao dong"; Dieu 102 chi cho khau tru luong de boi thuong thiet hai tai san, toi da 30%
  // luong thuc tra. Vi vay phan mem KHONG BAO GIO tru tien di tre vao luong.
  // Cach lam dung cung tac dung: dat phu cap chuyen can, dieu kien huong la khong di tre
  // qua N lan trong thang — khong dat thi KHONG PHAT SINH quyen huong, khong phai "phat".
  ['phu_cap_chuyen_can',    '0',      'Tien phu cap chuyen can/thang (0 = chua ap dung). Dat > 0 de bat co che nay', 'Quy che luong noi bo'],
  ['chuyen_can_so_lan_tre_toi_da','0','Di tre/ve som toi da bao nhieu lan trong thang ma van duoc huong chuyen can', 'Quy che luong noi bo'],
  ['chuyen_can_mat_khi_nghi_kl','CO', 'CO = co ngay nghi khong luong trong thang thi mat phu cap chuyen can', 'Quy che luong noi bo'],
  ['tru_tien_quy_vao_luong','KHONG',  'PHAI de KHONG. Dat CO la vi pham Dieu 127 khoan 2 BLLD 2019', 'Dieu 127 BLLD 2019'],

  // --- Tăng ca ---
  ['ty_le_tang_ca_thuong',  '150',    '% luong gio khi lam them ngay thuong', 'Dieu 98 BLLD 2019'],
  ['ty_le_tang_ca_cn',      '200',    '% luong gio khi lam them ngay nghi hang tuan', 'Dieu 98 BLLD 2019'],
  ['ty_le_tang_ca_le',      '300',    '% luong gio khi lam them ngay le/Tet', 'Dieu 98 BLLD 2019'],
  ['gio_lam_chuan_ngay',    '8',      'So gio lam chuan 1 ngay (de quy doi luong gio)', 'Dieu 105 BLLD 2019'],

  // --- KPI & thưởng (đồng bộ với tài liệu Bậc Thang Doanh Thu) ---
  ['san_doanh_thu_cty',     '500000000','San doanh thu cong ty/thang de tinh he so dat san', 'Bac Thang Doanh Thu, ap dung T9/2026'],
  ['ty_le_vat_quy_doi',     '1.08',   'Chia so thu cho he so nay de ra doanh so truoc VAT tinh KPI', 'Sep Lien chot 01/10/2026'],
  ['bac_hoa_hong',          '50000000:2:7000000|60000000:4:8000000|90000000:6:9000000|130000000:8:10000000',
                            'Bac hoa hong telesale: "tu doanh so : % hoa hong : LCB" cach nhau dau |',
                            'Bac Thang Doanh Thu, ap dung T9/2026'],
  ['thuong_lich_hen',       '15:50000|25:70000', 'Thuong lich hen: "tu so hen : tien moi hen"', 'Bac Thang Doanh Thu'],
  ['pct_thuong_tamly',      '5',      '% thuong doanh so cho chuyen gia tam ly (khong nhan he so san)', 'Sep Lien chot 18/09/2026'],
  ['tamly_thuong_ghepdoi',  '100000', 'Thuong moi ho so ghep doi dong y gap mat', 'Khung KPI tam ly 17/09/2026'],
  ['tamly_nguong_ghepdoi',  '10',     'Chi chi thuong ghep doi khi so ho so vuot muc nay', 'Khung KPI tam ly 17/09/2026'],
  ['tamly_thuong_timhieu',  '100000', 'Thuong moi ho so hai ben ky dong y tim hieu', 'Khung KPI tam ly 17/09/2026'],
  ['tamly_thuong_henho',    '200000', 'Thuong moi ho so xac nhan hen ho sau 1 thang tim hieu', 'Khung KPI tam ly 17/09/2026'],
  ['tamly_nguong_vuot',     '16',     'Tong ho so vuot muc nay duoc thuong vuot chi tieu', 'Khung KPI tam ly 17/09/2026'],
  ['tamly_thuong_vuot',     '1000000','Tien thuong vuot chi tieu/thang', 'Khung KPI tam ly 17/09/2026'],

  // --- Vận hành phần mềm ---
  ['email_hr',              'lienpham@lovejourney.vn', 'Email nhan canh bao nhan su (hop dong het han, thieu cham cong...)', 'Cau hinh'],
  ['canh_bao_het_han_hd',   '30',     'Bao truoc bao nhieu ngay khi hop dong sap het han', 'Cau hinh'],
  ['vai_tro_xem_luong',     'ADMIN,HR','Cac vai tro duoc xem bang luong toan cong ty', 'Phan quyen'],
  ['bat_phieu_luong_email', 'KHONG',  'CO = cho phep gui phieu luong qua email cho tung nguoi', 'Cau hinh']
];

/*================= MIGRATION TỰ CHỮA =================*/
/**
 * Tạo mới hoặc bổ sung tab/cột/cấu hình còn thiếu.
 * An toàn chạy lại nhiều lần: không xoá dòng, không xoá cột, không ghi đè giá trị đã có.
 */
function caiDatHR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bang = [
    [SH_HOSONV, COT_HOSONV], [SH_HOPDONG, COT_HOPDONG], [SH_LSLUONG, COT_LSLUONG],
    [SH_PHUCAP, COT_PHUCAP], [SH_PHEPNAM, COT_PHEPNAM], [SH_BIENDONGPHEP, COT_BIENDONGPHEP],
    [SH_NGAYLE, COT_NGAYLE], [SH_BANGCONG, COT_BANGCONG], [SH_KYLUONG, COT_KYLUONG],
    [SH_BANGLUONG, COT_BANGLUONG], [SH_KPI, COT_KPI], [SH_KHOANKHAC, COT_KHOANKHAC],
    [SH_BHXH, COT_BHXH], [SH_TAISAN, COT_TAISAN], [SH_KYLUAT, COT_KYLUAT],
    [SH_DIEUCHINHCONG, COT_DIEUCHINHCONG], [SH_GIOBU, COT_GIOBU], [SH_DONGYDL, COT_DONGYDL],
    [SH_NHATKY, COT_NHATKY], [SH_CAUHINHHR, COT_CAUHINHHR]
  ];
  var themTab = [], themCot = [];

  for (var i = 0; i < bang.length; i++) {
    var ten = bang[i][0], cot = bang[i][1];
    var moi = !ss.getSheetByName(ten);
    var sh  = taoSheetHR_(ss, ten, cot);
    if (moi) themTab.push(ten);
    var boSung = boSungCot_(sh, cot);
    if (boSung.length) themCot.push(ten + ': ' + boSung.join(', '));
  }

  // Bổ sung cột VaiTro vào NHANSU của app chấm công (thêm ở cuối -> không ảnh hưởng code cũ)
  var shNS = ss.getSheetByName(SHEET_NHANSU);
  if (shNS) {
    var bsNS = boSungCot_(shNS, COT_NHANSU.concat(['VaiTro']));
    if (bsNS.length) themCot.push(SHEET_NHANSU + ': ' + bsNS.join(', '));
  }

  // Tham số mặc định
  var shCH = ss.getSheetByName(SH_CAUHINHHR);
  var daCo = {};
  if (shCH.getLastRow() > 1) {
    var v = shCH.getRange(2, 1, shCH.getLastRow() - 1, 1).getValues();
    for (var k = 0; k < v.length; k++) if (v[k][0]) daCo[String(v[k][0]).trim()] = true;
  }
  var themCH = [];
  for (var j = 0; j < CAUHINH_HR_MAC_DINH.length; j++) {
    var r = CAUHINH_HR_MAC_DINH[j];
    if (!daCo[r[0]]) { shCH.appendRow(r); themCH.push(r[0]); }
  }
  shCH.getRange(1, 1, shCH.getLastRow(), 4).setNumberFormat('@');

  // Lịch nghỉ lễ: nạp sẵn nếu tab còn trống
  var shLe = ss.getSheetByName(SH_NGAYLE);
  if (shLe.getLastRow() < 2) napNgayLeMacDinh_(shLe);

  // Đồng bộ hồ sơ từ NHANSU: ai có trong NHANSU mà chưa có HOSONV thì tạo khung
  var daTao = dongBoHoSoTuNhanSu_();

  var bao = 'Da cai dat phan he nhan su.\n\n'
    + (themTab.length ? '- Tab moi: ' + themTab.join(', ') + '\n' : '- Khong co tab moi.\n')
    + (themCot.length ? '- Bo sung cot: ' + themCot.join(' | ') + '\n' : '- Khong co cot can bo sung.\n')
    + (themCH.length  ? '- Tham so moi: ' + themCH.length + ' muc\n' : '- Tham so da du.\n')
    + (daTao          ? '- Tao khung ho so cho ' + daTao + ' nhan vien tu tab NHANSU.\n' : '- Ho so da khop voi NHANSU.\n')
    + '\nViec can lam tiep: mo tab HOSONV dien thong tin con trong, mo tab HOPDONG khai hop dong + muc luong tung nguoi.';
  try { SpreadsheetApp.getUi().alert(bao); } catch (e) { Logger.log(bao); }
  ghiNhatKy_('HE_THONG', 'ADMIN', 'CAI_DAT_HR', 'schema', themTab.join(',') + ' / ' + themCH.length + ' tham so');
  return bao;
}

/** Tạo tab + header (dùng riêng cho HR để không phụ thuộc thứ tự nạp file) */
function taoSheetHR_(ss, ten, cot) {
  var sh = ss.getSheetByName(ten);
  if (!sh) sh = ss.insertSheet(ten);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cot.length).setValues([cot])
      .setFontWeight('bold').setBackground('#49469D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setFrozenColumns(2);
  }
  return sh;
}

/** Thêm vào cuối header những cột có trong khai báo mà Sheet còn thiếu */
function boSungCot_(sh, cot) {
  var hienCo = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
                 .map(function (x) { return String(x).trim(); });
  var them = [];
  for (var i = 0; i < cot.length; i++) if (hienCo.indexOf(cot[i]) === -1) them.push(cot[i]);
  if (them.length) {
    var batDau = sh.getLastColumn() + 1;
    sh.getRange(1, batDau, 1, them.length).setValues([them])
      .setFontWeight('bold').setBackground('#49469D').setFontColor('#FFFFFF');
  }
  return them;
}

/** Trả về map {tenCot: chỉ số 0-based} đọc từ dòng header thật trên Sheet */
function mapCot_(sh) {
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  var m = {};
  for (var i = 0; i < h.length; i++) {
    var t = String(h[i]).trim();
    if (t) m[t] = i;
  }
  return m;
}

/** Nghỉ lễ mặc định — ngày dương cố định theo Điều 112 BLLĐ 2019. Tết âm lịch phải tự điền. */
function napNgayLeMacDinh_(sh) {
  var ds = [
    ['2026-01-01','Tet Duong lich','CO','Toan cong ty',''],
    ['2026-04-30','Ngay Giai phong mien Nam','CO','Toan cong ty',''],
    ['2026-05-01','Ngay Quoc te Lao dong','CO','Toan cong ty',''],
    ['2026-09-01','Nghi lien ke Quoc khanh','CO','Toan cong ty','Dieu 112: Quoc khanh nghi 2 ngay'],
    ['2026-09-02','Quoc khanh','CO','Toan cong ty',''],
    ['2027-01-01','Tet Duong lich','CO','Toan cong ty','']
  ];
  sh.getRange(2, 1, ds.length, 5).setValues(ds);
  sh.getRange(2, 1, ds.length, 1).setNumberFormat('@');
  sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues([
    ['', 'CON THIEU: Gio To Hung Vuong (10/3 am lich) + Tet Am lich (5 ngay) + cac ngay nghi bu — can dien tay vi phu thuoc lich am', '', '', '']
  ]);
}

/** Ai có trong NHANSU (app chấm công) mà chưa có hồ sơ thì tạo khung sẵn để điền */
function dongBoHoSoTuNhanSu_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shNS = ss.getSheetByName(SHEET_NHANSU);
  var shHS = ss.getSheetByName(SH_HOSONV);
  if (!shNS || shNS.getLastRow() < 2) return 0;

  var daCo = {};
  if (shHS.getLastRow() > 1) {
    var h = shHS.getRange(2, 1, shHS.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < h.length; i++) if (h[i][0]) daCo[String(h[i][0]).trim().toUpperCase()] = true;
  }

  var mNS = mapCot_(shNS);
  var ns = shNS.getRange(2, 1, shNS.getLastRow() - 1, shNS.getLastColumn()).getValues();
  var mHS = mapCot_(shHS);
  var themMoi = [];

  for (var j = 0; j < ns.length; j++) {
    var ma = String(ns[j][mNS['MaNV']] || '').trim();
    if (!ma || daCo[ma.toUpperCase()]) continue;
    var dong = [];
    for (var z = 0; z < COT_HOSONV.length; z++) dong.push('');
    dong[mHS['MaNV']]             = ma;
    dong[mHS['HoTen']]            = String(ns[j][mNS['HoTen']] || '').trim();
    dong[mHS['EmailCongTy']]      = String(ns[j][mNS['Email']] || '').trim();
    dong[mHS['PhongBan']]         = String(ns[j][mNS['PhongBan']] || '').trim();
    var tt = String(ns[j][mNS['TrangThai']] || 'DANG_LAM').trim();
    dong[mHS['TrangThaiLamViec']] = tt || 'DANG_LAM';
    dong[mHS['GhiChu']]           = 'Tao tu dong tu tab NHANSU - can bo sung ho so';
    dong[mHS['NgayCapNhat']]      = hnayHR_();
    dong[mHS['NguoiCapNhat']]     = 'HE_THONG';
    themMoi.push(dong);
  }
  if (themMoi.length) {
    shHS.getRange(shHS.getLastRow() + 1, 1, themMoi.length, COT_HOSONV.length).setValues(themMoi);
  }
  return themMoi.length;
}

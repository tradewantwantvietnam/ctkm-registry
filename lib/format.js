// Danh sách hình thức khuyến mãi giờ được quản lý trong web (lưu ở sheet HinhThuc).
// Giữ biến này để các trang cũ không bị lỗi, bộ lọc ở trang Danh sách sẽ lấy hình thức từ dữ liệu thực tế.
export const HINH_THUC_OPTIONS = [];

export const LOAI_TAM = 'Tạm tính';
export const LOAI_CHOT = 'Chốt';

export function formatVND(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(v));
}

// '2026-11-18' -> '18/11/2026'
export function formatDate(s) {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-');
  if (p.length !== 3) return String(s);
  return p[2] + '/' + p[1] + '/' + p[0];
}

// '2026-11-18 09:30' -> '18/11/2026 09:30'
export function formatDateTime(s) {
  if (!s) return '';
  const str = String(s);
  const time = str.length > 10 ? str.slice(11, 16) : '';
  return formatDate(str) + (time ? ' ' + time : '');
}

export function formatPercent(ratio) {
  const v = (Number(ratio) || 0) * 100;
  return v.toFixed(1).replace('.', ',') + '%';
}

export const CANH_BAO = {
  binh_thuong: { label: 'Bình thường', cls: 'badge-ok' },
  sap_vuot: { label: 'Sắp vượt ngân sách', cls: 'badge-warn' },
  vuot: { label: 'Vượt ngân sách', cls: 'badge-danger' },
};

export const TRANG_THAI_CLS = {
  'Chưa chạy': 'badge-gray',
  'Đang chạy': 'badge-blue',
  'Đã kết thúc': 'badge-gray',
  'Đã quyết toán': 'badge-ok',
};

// '2026-11' từ ngày '2026-11-18'
export function monthOf(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : '';
}

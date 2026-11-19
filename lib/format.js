// Danh sách hình thức KM được quản lý trong web (sheet HinhThuc), biến này giữ để các trang cũ không lỗi.
export const HINH_THUC_OPTIONS = [];

export const LOAI_TAM = 'Tạm tính';
export const LOAI_CHOT = 'Chốt';

// Các loại tài liệu khi tải PDF. Sửa tự do cho đúng thực tế.
export const LOAI_TAI_LIEU = [
  'Thông báo chương trình',
  'Thông báo điều chỉnh / bổ sung',
  'Biên bản nghiệm thu',
  'Bảng kê quyết toán',
  'Chứng từ khác',
];

// Chương trình đã kết thúc quá số ngày này mà chưa chốt chi phí thì bị coi là quá hạn quyết toán
export const TRE_NGAY = 5;

export function formatVND(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(v));
}

export function formatSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  if (b >= 1024) return Math.round(b / 1024) + ' KB';
  return b + ' B';
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

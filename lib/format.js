
// Danh sách hình thức KM được quản lý trong web (sheet HinhThuc), biến này giữ để các trang cũ không lỗi.
export const HINH_THUC_OPTIONS = [];

export const LOAI_TAM = 'Tạm tính';
export const LOAI_CHOT = 'Chốt';
export const KIEU_BS = 'Bổ sung';
export const LY_DO_BS = ['Phát sinh thêm', 'Chạy tiếp', 'Khác'];
export const ALL_REGION = 'Toàn quốc';

// Các loại tài liệu khi tải PDF. Sửa tự do cho đúng thực tế.
export const LOAI_TAI_LIEU = [
  'Thông báo chương trình',
  'Thông báo điều chỉnh / bổ sung',
  'Biên bản nghiệm thu',
  'Bảng kê quyết toán',
  'Chứng từ khác',
];

// Tháng đã kết thúc quá số ngày này mà chưa chốt chi phí thì bị coi là quá hạn quyết toán
export const TRE_NGAY = 5;

// Định dạng tiền: 1777654 -> 1.777.654
export function formatVND(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(v));
}

// Định dạng số lượng/số liệu thông thường: 1000 -> 1,000
export function formatNumber(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US').format(v);
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

// '2026-11' -> 'T11/2026'
export function formatMonth(t) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(t || ''));
  if (!m) return String(t || '');
  return 'T' + Number(m[2]) + '/' + m[1];
}

// Danh sách tháng ('yyyy-mm') từ ngày a đến ngày b (chuỗi 'yyyy-mm-dd')
export function monthsBetween(a, b) {
  const s = String(a || '').slice(0, 7);
  const e = String(b || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(s) || !/^\d{4}-\d{2}$/.test(e) || e < s) return [];
  const ey = Number(e.slice(0, 4));
  const em = Number(e.slice(5, 7));
  let y = Number(s.slice(0, 4));
  let m = Number(s.slice(5, 7));
  const out = [];
  while ((y < ey || (y === ey && m <= em)) && out.length < 36) {
    out.push(y + '-' + String(m).padStart(2, '0'));
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// Ngày hôm nay dạng 'yyyy-mm-dd' theo giờ máy
export function todayYmd() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
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

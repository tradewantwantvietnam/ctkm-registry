import { formatDate } from '@/lib/format';

// Ô chứa văn bản (giữ nguyên số 0 đầu và dấu /)
function textCell(v) {
  return '="' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
}

function csvCell(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function pct(ratio) {
  return ((Number(ratio) || 0) * 100).toFixed(1).replace('.', ',');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// \uFEFF để Excel nhận đúng tiếng Việt
function csvBlob(lines) {
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

// Xuất danh sách chương trình (số liệu cả chương trình)
export function exportProgramsCSV(rows, filename) {
  const header = [
    'Số thông báo',
    'Tên chương trình',
    'Nội dung cơ bản',
    'Hình thức KM',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Ngân sách A&P',
    'Chi phí',
    'Loại chi phí',
    'Tỷ lệ sử dụng (%)',
    'Số tiền vượt',
    'Cảnh báo',
    'Trạng thái',
    'Có PDF',
    'Ghi chú',
  ];

  const lines = ['sep=;', header.map(csvCell).join(';')];

  rows.forEach((r) => {
    const hasCost = !!r.loai_chi_phi;
    const warn =
      r.canh_bao === 'vuot' ? 'Vượt ngân sách' : r.canh_bao === 'sap_vuot' ? 'Sắp vượt' : '';
    lines.push(
      [
        textCell(r.so_thong_bao),
        csvCell(r.ten),
        csvCell(r.noi_dung),
        csvCell(r.hinh_thuc),
        csvCell(formatDate(r.ngay_bd)),
        csvCell(formatDate(r.ngay_kt)),
        Math.round(r.ngan_sach),
        hasCost ? Math.round(r.chi_phi) : '',
        csvCell(r.loai_chi_phi),
        hasCost ? pct(r.ty_le) : '',
        r.so_tien_vuot > 0 ? Math.round(r.so_tien_vuot) : '',
        csvCell(warn),
        csvCell(r.trang_thai),
        r.co_pdf ? 'Có' : 'Không',
        csvCell(r.ghi_chu),
      ].join(';')
    );
  });

  downloadBlob(csvBlob(lines), filename);
}

// Xuất số liệu theo tháng (và theo vùng nếu có).
// Mỗi dòng: { so_thong_bao, ten, hinh_thuc, thang, vung, ngan_sach, chi_phi, co_chi_phi, ty_le,
//             so_tien_vuot, canh_bao, da_chot, so_ngay_tre }
export function exportMonthRowsCSV(rows, filename) {
  const header = [
    'Số thông báo',
    'Tên chương trình',
    'Hình thức KM',
    'Tháng',
    'Vùng',
    'Ngân sách',
    'Chi phí',
    'Tỷ lệ sử dụng (%)',
    'Số tiền vượt',
    'Cảnh báo',
    'Tình trạng chi phí',
    'Số ngày trễ quyết toán',
  ];

  const lines = ['sep=;', header.map(csvCell).join(';')];

  rows.forEach((r) => {
    const warn =
      r.canh_bao === 'vuot' ? 'Vượt ngân sách' : r.canh_bao === 'sap_vuot' ? 'Sắp vượt' : '';
    const tinhTrang = r.da_chot ? 'Đã chốt' : r.co_chi_phi ? 'Tạm tính' : 'Chưa có chi phí';
    lines.push(
      [
        textCell(r.so_thong_bao),
        csvCell(r.ten),
        csvCell(r.hinh_thuc),
        textCell(r.thang),
        csvCell(r.vung || ''),
        Math.round(r.ngan_sach),
        r.co_chi_phi ? Math.round(r.chi_phi) : '',
        r.co_chi_phi ? pct(r.ty_le) : '',
        r.so_tien_vuot > 0 ? Math.round(r.so_tien_vuot) : '',
        csvCell(warn),
        csvCell(tinhTrang),
        r.so_ngay_tre > 0 ? r.so_ngay_tre : '',
      ].join(';')
    );
  });

  downloadBlob(csvBlob(lines), filename);
}

export function todayTag() {
  const d = new Date();
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  );
}

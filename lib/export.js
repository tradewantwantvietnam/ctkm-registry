import { formatDate } from '@/lib/format';

// Ô chứa số thông báo dạng văn bản (giữ nguyên số 0 đầu và dấu /)
function textCell(v) {
  return '="' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
}

function csvCell(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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

// Xuất danh sách chương trình ra file CSV mở được bằng Excel (có tiếng Việt)
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
    const cells = [
      textCell(r.so_thong_bao),
      csvCell(r.ten),
      csvCell(r.noi_dung),
      csvCell(r.hinh_thuc),
      csvCell(formatDate(r.ngay_bd)),
      csvCell(formatDate(r.ngay_kt)),
      Math.round(r.ngan_sach),
      hasCost ? Math.round(r.chi_phi) : '',
      csvCell(r.loai_chi_phi),
      hasCost ? (r.ty_le * 100).toFixed(1).replace('.', ',') : '',
      r.so_tien_vuot > 0 ? Math.round(r.so_tien_vuot) : '',
      csvCell(warn),
      csvCell(r.trang_thai),
      r.co_pdf ? 'Có' : 'Không',
      csvCell(r.ghi_chu),
    ];
    lines.push(cells.join(';'));
  });

  // \uFEFF để Excel nhận đúng tiếng Việt
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  downloadBlob(blob, filename);
}

export function todayTag() {
  const d = new Date();
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  );
}

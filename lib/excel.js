import { downloadBlob } from '@/lib/export';
import { LOAI_TAM, LOAI_CHOT } from '@/lib/format';

const MAX_ROWS = 1000;

const HEADER = [
  'Số thông báo *',
  'Tên chương trình *',
  'Hình thức KM',
  'Ngày bắt đầu * (dd/mm/yyyy)',
  'Ngày kết thúc * (dd/mm/yyyy)',
  'Ngân sách A&P * (đồng)',
  'Nội dung cơ bản',
  'Ghi chú',
  'Chi phí (đồng) - nếu có',
  'Loại chi phí (Tạm tính / Chốt) - bắt buộc nếu có chi phí',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildYmd(y, m, d) {
  y = Number(y);
  m = Number(m);
  d = Number(d);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return y + '-' + pad(m) + '-' + pad(d);
}

// Trả về 'yyyy-mm-dd', '' nếu để trống, hoặc null nếu không hiểu được
function toYmd(v, XLSX) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return buildYmd(d.y, d.m, d.d);
  }
  if (v instanceof Date) {
    return buildYmd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  const s = String(v).trim();
  if (!s) return '';
  let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) return buildYmd(m[3], m[2], m[1]);
  m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(s);
  if (m) return buildYmd(m[1], m[2], m[3]);
  return null;
}

// Trả về số, '' nếu để trống, hoặc NaN nếu không hiểu được
function toMoney(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return '';
  const digits = s.replace(/[^\d]/g, '');
  return digits === '' ? NaN : Number(digits);
}

function normLoai(s) {
  const t = String(s || '').normalize('NFC').trim().toLowerCase();
  if (!t) return '';
  if (t === LOAI_TAM.normalize('NFC').toLowerCase()) return LOAI_TAM;
  if (t === LOAI_CHOT.normalize('NFC').toLowerCase()) return LOAI_CHOT;
  return null;
}

function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/* ============ XUẤT FILE MẪU ============ */
export async function buildTemplate(types) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Sheet 1: chỗ để điền
  const ws1 = XLSX.utils.aoa_to_sheet([HEADER]);
  ws1['!cols'] = [
    { wch: 18 }, { wch: 36 }, { wch: 26 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 44 }, { wch: 30 }, { wch: 24 }, { wch: 34 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Chương trình');

  // Sheet 2: hướng dẫn + ví dụ
  const guide = [
    ['HƯỚNG DẪN NHẬP'],
    ['1. Điền mỗi chương trình một dòng ở sheet "Chương trình", bắt đầu từ dòng 2. Không đổi thứ tự cột, không xóa cột.'],
    ['2. Cột có dấu * là bắt buộc.'],
    ['3. Ngày nhập theo dạng ngày/tháng/năm, ví dụ 18/11/2026.'],
    ['4. Ngân sách và chi phí nhập bằng số, ví dụ 25000000 (có dấu chấm ngăn cách cũng được).'],
    ['5. Hình thức KM nên chọn đúng tên trong sheet "Danh mục". Nếu ghi tên mới, hệ thống tự thêm vào danh mục.'],
    ['6. Nếu nhập chi phí thì bắt buộc ghi Loại chi phí là "Tạm tính" hoặc "Chốt".'],
    ['7. Số thông báo đã có trên hệ thống sẽ bị bỏ qua, không ghi đè lên dữ liệu cũ.'],
    ['8. Nếu số thông báo có số 0 đứng đầu, hãy để ô ở dạng văn bản (Text) để Excel không xóa số 0.'],
    ['9. File PDF không nhập bằng Excel. Nhập xong, vào từng chương trình để tải PDF.'],
    [],
    ['VÍ DỤ MỘT DÒNG (không nhập vào sheet này)'],
    ['Số thông báo', '12/TB-2026'],
    ['Tên chương trình', 'Giảm giá dịp 20/11'],
    ['Hình thức KM', 'Giảm giá trực tiếp'],
    ['Ngày bắt đầu', '01/11/2026'],
    ['Ngày kết thúc', '30/11/2026'],
    ['Ngân sách A&P', 25000000],
    ['Nội dung cơ bản', 'Giảm 10% cho đơn từ 500.000đ'],
    ['Ghi chú', 'Áp dụng toàn hệ thống'],
    ['Chi phí (nếu có)', 18000000],
    ['Loại chi phí', 'Tạm tính'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(guide);
  ws2['!cols'] = [{ wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Hướng dẫn');

  // Sheet 3: danh mục
  const list = types && types.length ? types : [];
  const n = Math.max(list.length, 2);
  const cat = [['Hình thức KM hiện có', '', 'Loại chi phí']];
  const loaiList = [LOAI_TAM, LOAI_CHOT];
  for (let i = 0; i < n; i++) {
    cat.push([list[i] || '', '', loaiList[i] || '']);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(cat);
  ws3['!cols'] = [{ wch: 40 }, { wch: 4 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Danh mục');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'mau_nhap_ctkm.xlsx'
  );
}

/* ============ ĐỌC FILE ĐÃ ĐIỀN ============ */
// Trả về mảng các dòng đã kiểm tra sơ bộ; mỗi dòng có mảng loi (rỗng nếu hợp lệ)
export async function parseImportFile(file) {
  const XLSX = await import('xlsx');

  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch (e) {
    throw new Error('Không đọc được file. Hãy dùng file Excel (.xlsx) theo mẫu.');
  }

  const sheetName =
    wb.SheetNames.find((n) => n.normalize('NFC') === 'Chương trình') || wb.SheetNames[0];
  if (!sheetName) throw new Error('File Excel không có sheet nào');

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: '',
  });
  if (!aoa.length) throw new Error('File trống');

  const h0 = str(aoa[0][0]).normalize('NFC').toLowerCase();
  if (h0.indexOf('số thông báo') < 0) {
    throw new Error('Không đúng file mẫu. Hãy bấm "Xuất file mẫu" rồi điền vào file đó.');
  }

  const out = [];
  const seen = {};

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const empty = r.every((c) => str(c) === '');
    if (empty) continue;
    if (out.length >= MAX_ROWS) {
      throw new Error('File có quá nhiều dòng (tối đa ' + MAX_ROWS + ' dòng mỗi lần nhập)');
    }

    const loi = [];
    const dong = i + 1;

    const so = str(r[0]);
    const ten = str(r[1]);
    const hinh = str(r[2]);
    const bd = toYmd(r[3], XLSX);
    const kt = toYmd(r[4], XLSX);
    const ns = toMoney(r[5]);
    const noiDung = str(r[6]);
    const ghiChu = str(r[7]);
    const cp = toMoney(r[8]);
    const loaiRaw = r[9];
    const loai = normLoai(loaiRaw);

    if (!so) loi.push('Thiếu số thông báo');
    if (!ten) loi.push('Thiếu tên chương trình');

    if (bd === '') loi.push('Thiếu ngày bắt đầu');
    else if (bd === null) loi.push('Ngày bắt đầu không hợp lệ (' + str(r[3]) + ')');

    if (kt === '') loi.push('Thiếu ngày kết thúc');
    else if (kt === null) loi.push('Ngày kết thúc không hợp lệ (' + str(r[4]) + ')');

    if (bd && kt && kt < bd) loi.push('Ngày kết thúc trước ngày bắt đầu');

    if (ns === '') loi.push('Thiếu ngân sách A&P');
    else if (typeof ns !== 'number' || isNaN(ns) || ns < 0) loi.push('Ngân sách không hợp lệ (' + str(r[5]) + ')');

    if (cp !== '') {
      if (typeof cp !== 'number' || isNaN(cp) || cp < 0) {
        loi.push('Chi phí không hợp lệ (' + str(r[8]) + ')');
      } else if (str(loaiRaw) === '') {
        loi.push('Có chi phí nhưng thiếu Loại chi phí (Tạm tính / Chốt)');
      } else if (loai === null) {
        loi.push('Loại chi phí phải là "Tạm tính" hoặc "Chốt" (đang ghi: ' + str(loaiRaw) + ')');
      }
    } else if (str(loaiRaw) !== '' && loai === null) {
      loi.push('Loại chi phí phải là "Tạm tính" hoặc "Chốt" (đang ghi: ' + str(loaiRaw) + ')');
    }

    if (so) {
      const k = so.toLowerCase();
      if (seen[k]) loi.push('Trùng số thông báo với dòng ' + seen[k] + ' trong file');
      else seen[k] = dong;
    }

    out.push({
      dong: dong,
      so_thong_bao: so,
      ten: ten,
      hinh_thuc: hinh,
      ngay_bd: bd || '',
      ngay_kt: kt || '',
      ngan_sach: typeof ns === 'number' && !isNaN(ns) ? ns : '',
      noi_dung: noiDung,
      ghi_chu: ghiChu,
      chi_phi: typeof cp === 'number' && !isNaN(cp) ? cp : '',
      loai_chi_phi: cp !== '' && loai ? loai : '',
      loi: loi,
    });
  }

  if (out.length === 0) {
    throw new Error('File không có dòng dữ liệu nào (dữ liệu bắt đầu từ dòng 2)');
  }
  return out;
}

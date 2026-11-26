// Hàm hỗ trợ đọc file danh mục (NPP, sản phẩm)

const MAX_ROWS = 20000;

// Bỏ dấu tiếng Việt, đưa về chữ thường để so tên cột
export function noAccent(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cellText(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
}

// 0 -> A, 25 -> Z, 26 -> AA
export function colLabel(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Trả về số, '' nếu để trống, NaN nếu không hiểu được
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let text = cellText(v);
  if (!text) return '';
  text = text.replace(/[₫đ\s]/gi, '').replace(/[^\d,.-]/g, '');
  if (!text || !/\d/.test(text)) return NaN;

  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (text.includes(',')) {
    const parts = text.split(',');
    if (parts.length === 2 && parts[1].length <= 2) text = parts[0] + '.' + parts[1];
    else text = text.replace(/,/g, '');
  } else if (text.includes('.')) {
    const parts = text.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      text = text.replace(/\./g, '');
    }
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

// Đọc sheet đầu tiên của file Excel hoặc CSV. Dòng không trống đầu tiên là tiêu đề.
export async function readTable(file) {
  const XLSX = await import('xlsx');
  let wb;
  try {
    if (/\.(csv|txt)$/i.test(file.name)) {
      wb = XLSX.read(await file.text(), { type: 'string' });
    } else {
      wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    }
  } catch (e) {
    throw new Error('Không đọc được file. Hãy dùng file Excel (.xlsx) hoặc CSV.');
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('File không có sheet dữ liệu');

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });

  let h = 0;
  while (h < aoa.length && aoa[h].every((c) => cellText(c) === '')) h++;
  if (h >= aoa.length) throw new Error('File trống');

  const headers = aoa[h].map((c) => cellText(c));
  const rows = [];
  for (let i = h + 1; i < aoa.length; i++) {
    const cells = aoa[i];
    if (cells.every((c) => cellText(c) === '')) continue;
    rows.push({ n: i + 1, cells: cells });
  }

  if (rows.length === 0) throw new Error('File chỉ có dòng tiêu đề, chưa có dữ liệu');
  if (rows.length > MAX_ROWS) {
    throw new Error(
      'File có hơn ' + MAX_ROWS + ' dòng. Hãy dùng danh sách gọn (mỗi mã một dòng), không dùng file giao dịch.'
    );
  }

  return { fileName: file.name, sheetName: sheetName, headers: headers, rows: rows };
}

// Đoán cột theo tên tiêu đề. Trả về { key: chỉ số cột, -1 nếu không thấy }
export function guessColumns(headers, fields) {
  const norm = headers.map(noAccent);
  const used = new Set();
  const out = {};
  fields.forEach((f) => {
    out[f.key] = -1;
  });

  // Lượt 1: trùng khớp hoàn toàn (ưu tiên theo thứ tự tên)
  fields.forEach((f) => {
    for (const name of f.exact) {
      const i = norm.findIndex((h, idx) => !used.has(idx) && h === name);
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
        return;
      }
    }
  });

  // Lượt 2: tên cột có chứa cụm từ
  fields.forEach((f) => {
    if (out[f.key] >= 0) return;
    for (const name of f.has) {
      const i = norm.findIndex((h, idx) => !used.has(idx) && h.includes(name));
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
        return;
      }
    }
  });

  return out;
}

/* ===== Định nghĩa cột ===== */
export const NPP_FIELDS = [
  { key: 'mien', label: 'Miền', required: true, exact: ['ten mien', 'mien'], has: ['ten mien'] },
  { key: 'vung', label: 'Vùng', required: true, exact: ['ten vung', 'vung'], has: ['ten vung'] },
  {
    key: 'ma_npp',
    label: 'Mã NPP',
    required: true,
    exact: ['ma npp', 'ma nha phan phoi'],
    has: ['ma npp'],
  },
  {
    key: 'ten_npp',
    label: 'Tên NPP',
    required: true,
    exact: ['ten npp', 'ten nha phan phoi', 'nha phan phoi'],
    has: ['ten npp'],
  },
];

export const PRODUCT_FIELDS = [
  {
    key: 'ma_sp',
    label: 'Mã SP',
    required: true,
    exact: ['ma san pham', 'ma sp', 'ma hang'],
    has: ['ma san pham', 'ma sp'],
  },
  {
    key: 'ten_sp',
    label: 'Tên SP',
    required: false,
    exact: ['ten san pham', 'ten sp', 'ten hang', 'san pham'],
    has: ['ten san pham', 'ten sp'],
  },
  {
    key: 'quy_cach',
    label: 'Quy cách (ví dụ: 36 hộp, 9 lốc)',
    required: false,
    exact: ['quy cach'],
    has: ['quy cach'],
  },
  {
    key: 'loc_thung',
    label: 'Số lốc / thùng (chỉ chọn nếu file có cột riêng)',
    required: false,
    exact: ['so loc/thung', 'so loc thung', 'loc/thung', 'loc thung', 'so loc'],
    has: ['loc/thung', 'loc thung', 'so loc'],
  },
  {
    key: 'gia_le',
    label: 'Giá lẻ (không bắt buộc)',
    required: false,
    exact: ['gia le', 'don gia le', 'gia ban le', 'don gia', 'gia'],
    has: ['gia le', 'don gia'],
  },
];

/* ===== Đọc quy cách dạng chữ =====
   "36 hộp, 9 lốc"   -> 36 lẻ / thùng, 9 lốc / thùng
   "9 lốc x 4 hộp"   -> 36 lẻ / thùng, 9 lốc / thùng
   "24 gói/thùng"    -> 24 lẻ / thùng
   "36"              -> 36 lẻ / thùng */
const LE_UNITS = ['hop', 'goi', 'tui', 'cay', 'chai', 'lon', 'le', 'chiec', 'cai', 'vi', 'ly'];

export function parseQuyCach(text) {
  const t = noAccent(text);
  const out = { le_thung: '', loc_thung: '' };
  if (!t) return out;

  const mx = /(\d+(?:[.,]\d+)?)\s*loc\s*[x*×]\s*(\d+(?:[.,]\d+)?)/.exec(t);
  if (mx) {
    const a = Number(mx[1].replace(',', '.'));
    const b = Number(mx[2].replace(',', '.'));
    if (a > 0 && b > 0) return { le_thung: a * b, loc_thung: a };
  }

  const re = /(\d+(?:[.,]\d+)?)\s*([a-z]+)?/g;
  const nums = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    nums.push({ n: Number(m[1].replace(',', '.')), unit: m[2] || '' });
  }

  nums.forEach((x) => {
    if (!(x.n > 0)) return;
    if (x.unit.indexOf('loc') === 0) {
      if (out.loc_thung === '') out.loc_thung = x.n;
    } else if (LE_UNITS.includes(x.unit)) {
      if (out.le_thung === '') out.le_thung = x.n;
    }
  });

  if (out.le_thung === '') {
    const first = nums.find((x) => x.n > 0 && x.unit.indexOf('loc') !== 0 && x.unit.indexOf('thung') !== 0);
    if (first) out.le_thung = first.n;
  }
  return out;
}

/* ===== Chuyển các dòng của file thành dữ liệu kiểm tra ===== */
function getter(table, mapping, row) {
  return (k) => (mapping[k] >= 0 ? cellText(row.cells[mapping[k]]) : '');
}

export function convertNpp(table, mapping) {
  const seen = {};
  return table.rows.map((r) => {
    const get = getter(table, mapping, r);
    const item = {
      dong: r.n,
      mien: get('mien'),
      vung: get('vung'),
      ma_npp: get('ma_npp'),
      ten_npp: get('ten_npp'),
      loi: [],
      canh_bao: [],
    };
    if (!item.ma_npp) item.loi.push('Thiếu mã NPP');
    if (!item.ten_npp) item.loi.push('Thiếu tên NPP');
    if (!item.mien) item.loi.push('Thiếu miền');
    if (!item.vung) item.loi.push('Thiếu vùng');
    if (item.ma_npp) {
      const k = item.ma_npp.toLowerCase();
      if (seen[k]) item.loi.push('Trùng mã NPP với dòng ' + seen[k]);
      else seen[k] = r.n;
    }
    return item;
  });
}

export function convertProducts(table, mapping) {
  const seen = {};
  return table.rows.map((r) => {
    const get = getter(table, mapping, r);
    const item = {
      dong: r.n,
      ma_sp: get('ma_sp'),
      ten_sp: get('ten_sp'),
      quy_cach: get('quy_cach'),
      le_per_thung: '',
      loc_per_thung: '',
      le_per_loc: '',
      gia_le: '',
      loi: [],
      canh_bao: [],
    };

    if (!item.ma_sp) {
      item.loi.push('Thiếu mã SP');
    } else {
      const k = item.ma_sp.toLowerCase();
      if (seen[k]) item.loi.push('Trùng mã SP với dòng ' + seen[k]);
      else seen[k] = r.n;
    }
    if (!item.ten_sp) item.canh_bao.push('Thiếu tên SP');

    // Quy cách dạng chữ
    if (item.quy_cach) {
      const p = parseQuyCach(item.quy_cach);
      if (p.le_thung !== '') item.le_per_thung = p.le_thung;
      else item.canh_bao.push('Không đọc được số lẻ / thùng từ quy cách');
      if (p.loc_thung !== '') item.loc_per_thung = p.loc_thung;
    }

    // Cột riêng số lốc / thùng (nếu có) thì ưu tiên hơn
    if (mapping.loc_thung >= 0) {
      const n = toNumber(r.cells[mapping.loc_thung]);
      if (n === '') {
        // để trống
      } else if (typeof n === 'number' && !Number.isNaN(n) && n > 0) {
        item.loc_per_thung = n;
      } else {
        item.canh_bao.push('Số lốc / thùng không hợp lệ');
      }
    }

    // Số lẻ / lốc = số lẻ / thùng chia số lốc / thùng
    if (item.le_per_thung !== '' && item.loc_per_thung !== '') {
      const v = item.le_per_thung / item.loc_per_thung;
      if (Number.isInteger(v)) {
        item.le_per_loc = v;
      } else {
        item.canh_bao.push(
          item.le_per_thung + ' lẻ / thùng không chia hết cho ' + item.loc_per_thung + ' lốc / thùng'
        );
      }
    } else if (item.loc_per_thung !== '' && item.le_per_thung === '') {
      item.canh_bao.push('Có số lốc / thùng nhưng chưa có số lẻ / thùng');
    }

    // Giá lẻ (không bắt buộc)
    if (mapping.gia_le >= 0) {
      const g = toNumber(r.cells[mapping.gia_le]);
      if (g === '') {
        // để trống: không đụng đến giá đã có
      } else if (typeof g === 'number' && !Number.isNaN(g) && g >= 0) {
        item.gia_le = g;
      } else {
        item.canh_bao.push('Giá lẻ không hợp lệ, sẽ không lưu giá');
      }
    }

    return item;
  });
}

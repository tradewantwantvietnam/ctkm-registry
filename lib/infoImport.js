// Hàm hỗ trợ đọc file danh mục (NPP, sản phẩm, giá)

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
    label: 'Quy cách (số lẻ trong 1 thùng)',
    required: false,
    exact: ['quy cach'],
    has: ['quy cach'],
  },
  {
    key: 'le_loc',
    label: 'Số lẻ trong 1 lốc',
    required: false,
    exact: ['so le/loc', 'so le loc', 'le/loc', 'le loc', 'so le trong loc'],
    has: ['le/loc', 'le loc', 'trong loc'],
  },
];

export const PRICE_FIELDS = [
  {
    key: 'ma_sp',
    label: 'Mã SP',
    required: true,
    exact: ['ma san pham', 'ma sp', 'ma hang'],
    has: ['ma san pham', 'ma sp'],
  },
  {
    key: 'gia_le',
    label: 'Giá lẻ',
    required: true,
    exact: ['gia le', 'don gia le', 'gia ban le', 'don gia', 'gia'],
    has: ['gia le', 'don gia'],
  },
];

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
      le_per_loc: '',
      loi: [],
      canh_bao: [],
    };

    if (!item.ma_sp) item.loi.push('Thiếu mã SP');
    if (item.ma_sp) {
      const k = item.ma_sp.toLowerCase();
      if (seen[k]) item.loi.push('Trùng mã SP với dòng ' + seen[k]);
      else seen[k] = r.n;
    }
    if (!item.ten_sp) item.canh_bao.push('Thiếu tên SP');

    if (item.quy_cach) {
      const m = /(\d+(?:[.,]\d+)?)/.exec(item.quy_cach);
      const n = m ? Number(m[1].replace(',', '.')) : NaN;
      if (Number.isFinite(n) && n > 0) item.le_per_thung = n;
      else item.canh_bao.push('Không đọc được số lẻ / thùng từ quy cách');
    }

    if (mapping.le_loc >= 0) {
      const n = toNumber(r.cells[mapping.le_loc]);
      if (n === '') {
        // để trống
      } else if (typeof n === 'number' && !Number.isNaN(n) && n > 0) {
        item.le_per_loc = n;
      } else {
        item.canh_bao.push('Số lẻ / lốc không hợp lệ');
      }
    }
    return item;
  });
}

// known: { 'mã sp viết thường': true } để kiểm tra mã SP đã có trong danh mục
export function convertPrices(table, mapping, known) {
  const seen = {};
  return table.rows.map((r) => {
    const get = getter(table, mapping, r);
    const price = mapping.gia_le >= 0 ? toNumber(r.cells[mapping.gia_le]) : '';
    const item = {
      dong: r.n,
      ma_sp: get('ma_sp'),
      gia_le: typeof price === 'number' && !Number.isNaN(price) ? price : '',
      loi: [],
      canh_bao: [],
    };

    if (!item.ma_sp) {
      item.loi.push('Thiếu mã SP');
    } else {
      const k = item.ma_sp.toLowerCase();
      if (known && !known[k]) item.loi.push('Mã SP chưa có trong danh mục sản phẩm');
      if (seen[k]) item.loi.push('Trùng mã SP với dòng ' + seen[k]);
      else seen[k] = r.n;
    }

    if (price === '') item.loi.push('Thiếu giá');
    else if (typeof price !== 'number' || Number.isNaN(price) || price < 0) item.loi.push('Giá không hợp lệ');

    return item;
  });
}

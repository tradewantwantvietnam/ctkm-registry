import { downloadBlob } from '@/lib/export';
import { ALL_REGION, KIEU_BS, LOAI_CHOT, LOAI_TAM, LY_DO_BS } from '@/lib/format';

const MAX_PROGRAMS = 500;

const H_PROG = [
  'Số thông báo *',
  'Tên chương trình *',
  'Hình thức KM',
  'Ngày bắt đầu * (dd/mm/yyyy)',
  'Ngày kết thúc * (dd/mm/yyyy)',
  'Nội dung cơ bản',
  'Ghi chú',
];
const H_BUD = ['Số thông báo *', 'Tháng * (mm/yyyy)', 'Vùng * (Toàn quốc hoặc tên vùng)', 'Ngân sách * (đồng)'];
const H_COST = [
  'Số thông báo *',
  'Kiểu * (Tạm tính / Chốt / Bổ sung)',
  'Lý do (bắt buộc nếu Bổ sung)',
  'Từ ngày (dd/mm/yyyy)',
  'Đến ngày (dd/mm/yyyy)',
  'Tháng tính * (mm/yyyy)',
  'Vùng * (Toàn quốc hoặc tên vùng)',
  'Số tiền * (đồng)',
  'Ghi chú',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function nfc(s) {
  return String(s === null || s === undefined ? '' : s).normalize('NFC').trim().toLowerCase();
}

function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
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

function buildYm(y, m) {
  y = Number(y);
  m = Number(m);
  if (y < 2000 || y > 2100 || m < 1 || m > 12) return null;
  return y + '-' + pad(m);
}

// 'yyyy-mm-dd', '' nếu để trống, null nếu không hiểu
function toYmd(v, XLSX) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? buildYmd(d.y, d.m, d.d) : null;
  }
  const s = String(v).trim();
  if (!s) return '';
  let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) return buildYmd(m[3], m[2], m[1]);
  m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(s);
  if (m) return buildYmd(m[1], m[2], m[3]);
  return null;
}

// 'yyyy-mm', '' nếu để trống, null nếu không hiểu
function toYm(v, XLSX) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? buildYm(d.y, d.m) : null;
  }
  const s = String(v).trim().replace(/^T/i, '');
  if (!s) return '';
  let m = /^(\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) return buildYm(m[2], m[1]);
  m = /^(\d{4})[\/\-.](\d{1,2})$/.exec(s);
  if (m) return buildYm(m[1], m[2]);
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m) return buildYm(m[3], m[2]);
  return null;
}

// số, '' nếu để trống, NaN nếu không hiểu
function toMoney(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return '';
  const digits = s.replace(/[^\d]/g, '');
  return digits === '' ? NaN : Number(digits);
}

/* ============ XUẤT FILE MẪU ============ */
export async function buildTemplate(types, regions) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([H_PROG]);
  ws1['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 44 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Chương trình');

  const ws2 = XLSX.utils.aoa_to_sheet([H_BUD]);
  ws2['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Ngân sách');

  const ws3 = XLSX.utils.aoa_to_sheet([H_COST]);
  ws3['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Chi phí');

  const guide = [
    ['HƯỚNG DẪN NHẬP'],
    ['1. Điền 3 sheet: "Chương trình" (mỗi chương trình một dòng), "Ngân sách" (mỗi dòng là một tháng × vùng), "Chi phí" (không bắt buộc, dùng để nhập sẵn chi phí các tháng cũ).'],
    ['2. Số thông báo ở sheet "Ngân sách" và "Chi phí" phải trùng với số thông báo ở sheet "Chương trình". Dữ liệu bắt đầu từ dòng 2, không đổi thứ tự cột.'],
    ['3. Cột có dấu * là bắt buộc. Ngày nhập dạng ngày/tháng/năm (18/11/2026), tháng nhập dạng tháng/năm (11/2026).'],
    ['4. Ngân sách: mỗi chương trình có ít nhất một dòng. Chạy nhiều tháng thì mỗi tháng một dòng (hoặc mỗi tháng × mỗi vùng một dòng). Tháng phải nằm trong thời gian chạy.'],
    ['5. Vùng: ghi "Toàn quốc" nếu ngân sách chung, hoặc tên vùng (xem sheet "Danh mục"). Trong cùng một tháng không trộn "Toàn quốc" với các vùng. Tên vùng mới sẽ được tự thêm vào danh mục.'],
    ['6. Chi phí: kiểu Tạm tính / Chốt là số LŨY KẾ của tháng và vùng đó. Kiểu Bổ sung là số CỘNG THÊM và bắt buộc ghi lý do (xem sheet "Danh mục"). Nhiều dòng cùng kiểu, lý do, ngày và ghi chú sẽ được gom thành một lần nhập.'],
    ['7. Từ ngày / Đến ngày của chi phí: để trống thì lấy theo thời gian chạy của chương trình.'],
    ['8. Số thông báo đã có trên hệ thống sẽ bị bỏ qua, không ghi đè dữ liệu cũ. File PDF không nhập bằng Excel, hãy tải ở trang chi tiết từng chương trình.'],
    [],
    ['VÍ DỤ (không nhập vào các sheet điền dữ liệu)'],
    ['Sheet "Chương trình"', '12/TB-2026', 'Giảm giá dịp cuối năm', 'Giảm giá trực tiếp', '20/11/2026', '10/12/2026', 'Giảm 10% đơn từ 500.000đ', 'Toàn hệ thống'],
    ['Sheet "Ngân sách"', '12/TB-2026', '11/2026', 'Miền Bắc', 5000000],
    ['', '12/TB-2026', '11/2026', 'Miền Nam', 5000000],
    ['', '12/TB-2026', '12/2026', 'Miền Bắc', 2000000],
    ['', '12/TB-2026', '12/2026', 'Miền Nam', 2000000],
    ['Sheet "Chi phí"', '12/TB-2026', 'Tạm tính', '', '20/11/2026', '30/11/2026', '11/2026', 'Miền Bắc', 4000000],
    ['', '12/TB-2026', 'Bổ sung', 'Phát sinh thêm', '01/12/2026', '05/12/2026', '12/2026', 'Miền Nam', 500000],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(guide);
  ws4['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Hướng dẫn');

  const tList = types && types.length ? types : [];
  const rList = [ALL_REGION].concat(regions || []);
  const kList = [LOAI_TAM, LOAI_CHOT, KIEU_BS];
  const n = Math.max(tList.length, rList.length, kList.length, LY_DO_BS.length, 1);
  const cat = [['Hình thức KM hiện có', '', 'Vùng hiện có', '', 'Kiểu chi phí', '', 'Lý do bổ sung']];
  for (let i = 0; i < n; i++) {
    cat.push([tList[i] || '', '', rList[i] || '', '', kList[i] || '', '', LY_DO_BS[i] || '']);
  }
  const ws5 = XLSX.utils.aoa_to_sheet(cat);
  ws5['!cols'] = [{ wch: 36 }, { wch: 3 }, { wch: 26 }, { wch: 3 }, { wch: 18 }, { wch: 3 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Danh mục');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'mau_nhap_ctkm_v2.xlsx'
  );
}

/* ============ ĐỌC FILE ĐÃ ĐIỀN ============ */
// ref = { regions: [...] }. Trả về { programs: [...], orphans: [...] }
export async function parseImportFile(file, ref) {
  const XLSX = await import('xlsx');

  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch (e) {
    throw new Error('Không đọc được file. Hãy dùng file Excel (.xlsx) theo mẫu.');
  }

  const find = (name) => wb.SheetNames.find((n) => nfc(n) === nfc(name));
  const sP = find('Chương trình');
  const sB = find('Ngân sách');
  const sC = find('Chi phí');
  if (!sP || !sB) {
    throw new Error(
      'Không đúng file mẫu mới (thiếu sheet "Chương trình" hoặc "Ngân sách"). Hãy bấm "Xuất file mẫu" rồi điền vào file đó.'
    );
  }

  const rd = (name) =>
    name ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }) : [];
  const aP = rd(sP);
  const aB = rd(sB);
  const aC = rd(sC);

  if (nfc(aP[0] && aP[0][0]).indexOf('số thông báo') < 0) {
    throw new Error('Sheet "Chương trình" không đúng mẫu. Hãy xuất lại file mẫu.');
  }

  const refRegions = (ref && ref.regions) || [];
  const canonRegion = (name, p) => {
    const k = nfc(name);
    if (k === nfc(ALL_REGION)) return ALL_REGION;
    const f = refRegions.find((x) => nfc(x) === k);
    if (f) return f;
    if (!p.newRegions.some((x) => nfc(x) === k)) p.newRegions.push(name);
    return name;
  };

  const isEmptyRow = (r) => r.every((c) => str(c) === '');

  // ----- Sheet Chương trình -----
  const progs = [];
  const byKey = {};
  for (let i = 1; i < aP.length; i++) {
    const r = aP[i] || [];
    if (isEmptyRow(r)) continue;
    if (progs.length >= MAX_PROGRAMS) {
      throw new Error('File có quá nhiều chương trình (tối đa ' + MAX_PROGRAMS + ' mỗi lần nhập)');
    }
    const so = str(r[0]);
    const bd = toYmd(r[3], XLSX);
    const kt = toYmd(r[4], XLSX);
    const p = {
      dong: i + 1,
      so_thong_bao: so,
      ten: str(r[1]),
      hinh_thuc: str(r[2]),
      ngay_bd: bd || '',
      ngay_kt: kt || '',
      noi_dung: str(r[5]),
      ghi_chu: str(r[6]),
      budgets: [],
      costs: [],
      loi: [],
      newRegions: [],
      _ent: {},
    };
    if (!so) p.loi.push('Thiếu số thông báo');
    if (!p.ten) p.loi.push('Thiếu tên chương trình');
    if (bd === '') p.loi.push('Thiếu ngày bắt đầu');
    else if (bd === null) p.loi.push('Ngày bắt đầu không hợp lệ (' + str(r[3]) + ')');
    if (kt === '') p.loi.push('Thiếu ngày kết thúc');
    else if (kt === null) p.loi.push('Ngày kết thúc không hợp lệ (' + str(r[4]) + ')');
    if (bd && kt && kt < bd) p.loi.push('Ngày kết thúc trước ngày bắt đầu');
    if (so) {
      const k = so.toLowerCase();
      if (byKey[k]) p.loi.push('Trùng số thông báo với dòng ' + byKey[k].dong + ' của sheet Chương trình');
      else byKey[k] = p;
    }
    progs.push(p);
  }
  if (progs.length === 0) {
    throw new Error('Sheet "Chương trình" chưa có dòng dữ liệu nào (dữ liệu bắt đầu từ dòng 2)');
  }

  const orphans = [];

  // ----- Sheet Ngân sách -----
  for (let i = 1; i < aB.length; i++) {
    const r = aB[i] || [];
    if (isEmptyRow(r)) continue;
    const so = str(r[0]);
    const where = 'Ngân sách dòng ' + (i + 1);
    const p = so ? byKey[so.toLowerCase()] : null;
    if (!p) {
      orphans.push(where + ': số thông báo "' + so + '" không có ở sheet Chương trình');
      continue;
    }
    const t = toYm(r[1], XLSX);
    const vung = str(r[2]);
    const ns = toMoney(r[3]);
    if (t === '' || t === null) p.loi.push(where + ': tháng không hợp lệ (' + str(r[1]) + ')');
    else if (!vung) p.loi.push(where + ': thiếu vùng');
    else if (ns === '') p.loi.push(where + ': thiếu ngân sách');
    else if (typeof ns !== 'number' || isNaN(ns) || ns < 0) p.loi.push(where + ': ngân sách không hợp lệ (' + str(r[3]) + ')');
    else p.budgets.push({ dong: i + 1, thang: t, vung: canonRegion(vung, p), ngan_sach: ns });
  }

  // ----- Sheet Chi phí -----
  const normKieu = (s) => {
    const k = nfc(s);
    if (k === nfc(LOAI_TAM)) return LOAI_TAM;
    if (k === nfc(LOAI_CHOT)) return LOAI_CHOT;
    if (k === nfc(KIEU_BS)) return KIEU_BS;
    return null;
  };
  const normLyDo = (s) => LY_DO_BS.find((x) => nfc(x) === nfc(s)) || null;

  for (let i = 1; i < aC.length; i++) {
    const r = aC[i] || [];
    if (isEmptyRow(r)) continue;
    const so = str(r[0]);
    const where = 'Chi phí dòng ' + (i + 1);
    const p = so ? byKey[so.toLowerCase()] : null;
    if (!p) {
      orphans.push(where + ': số thông báo "' + so + '" không có ở sheet Chương trình');
      continue;
    }
    const kieu = normKieu(r[1]);
    const lyDoRaw = str(r[2]);
    const lyDo = lyDoRaw ? normLyDo(lyDoRaw) : '';
    const tu = toYmd(r[3], XLSX);
    const den = toYmd(r[4], XLSX);
    const t = toYm(r[5], XLSX);
    const vung = str(r[6]);
    const amount = toMoney(r[7]);
    const ghi = str(r[8]);

    if (!kieu) {
      p.loi.push(where + ': kiểu phải là Tạm tính, Chốt hoặc Bổ sung (đang ghi: ' + str(r[1]) + ')');
      continue;
    }
    if (kieu === KIEU_BS && !lyDo) {
      p.loi.push(where + ': chi phí Bổ sung cần lý do (' + LY_DO_BS.join(' / ') + ')');
      continue;
    }
    if (tu === null || den === null) {
      p.loi.push(where + ': từ ngày hoặc đến ngày không hợp lệ');
      continue;
    }
    if (tu && den && den < tu) {
      p.loi.push(where + ': đến ngày trước từ ngày');
      continue;
    }
    if (t === '' || t === null) {
      p.loi.push(where + ': tháng tính không hợp lệ (' + str(r[5]) + ')');
      continue;
    }
    if (!vung) {
      p.loi.push(where + ': thiếu vùng');
      continue;
    }
    if (amount === '') {
      p.loi.push(where + ': thiếu số tiền');
      continue;
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
      p.loi.push(where + ': số tiền không hợp lệ (' + str(r[7]) + ')');
      continue;
    }

    const ek = [kieu, lyDo || '', tu || '', den || '', ghi].join('|');
    let en = p._ent[ek];
    if (!en) {
      en = { kieu: kieu, ly_do: lyDo || '', tu_ngay: tu || '', den_ngay: den || '', ghi_chu: ghi, items: [] };
      p._ent[ek] = en;
      p.costs.push(en);
    }
    en.items.push({ dong: i + 1, thang: t, vung: canonRegion(vung, p), so_tien: amount });
  }

  // ----- Kiểm tra chéo -----
  progs.forEach((p) => {
    const m1 = p.ngay_bd ? p.ngay_bd.slice(0, 7) : '';
    const m2 = p.ngay_kt ? p.ngay_kt.slice(0, 7) : '';
    const haveRange = !!(m1 && m2);

    if (p.budgets.length === 0) p.loi.push('Chưa có dòng ngân sách nào ở sheet Ngân sách');

    const seen = {};
    const perMonth = {};
    p.budgets.forEach((b) => {
      const where = 'Ngân sách dòng ' + b.dong;
      if (haveRange && (b.thang < m1 || b.thang > m2)) {
        p.loi.push(where + ': tháng ' + b.thang + ' nằm ngoài thời gian chạy của chương trình');
      }
      const k = b.thang + '|' + nfc(b.vung);
      if (seen[k]) p.loi.push(where + ': trùng với dòng ' + seen[k] + ' (cùng tháng và vùng)');
      else seen[k] = b.dong;
      const pm = perMonth[b.thang] || (perMonth[b.thang] = { all: false, reg: false });
      if (b.vung === ALL_REGION) pm.all = true;
      else pm.reg = true;
    });
    Object.keys(perMonth).forEach((t) => {
      if (perMonth[t].all && perMonth[t].reg) {
        p.loi.push('Tháng ' + t + ': không trộn "' + ALL_REGION + '" với các vùng trong cùng một tháng');
      }
    });

    p.costs.forEach((en) => {
      const dup = {};
      en.items.forEach((it) => {
        const where = 'Chi phí dòng ' + it.dong;
        if (haveRange && (it.thang < m1 || it.thang > m2)) {
          p.loi.push(where + ': tháng ' + it.thang + ' nằm ngoài thời gian chạy của chương trình');
        }
        const k = it.thang + '|' + nfc(it.vung);
        if (dup[k]) p.loi.push(where + ': trùng với dòng ' + dup[k] + ' (cùng tháng và vùng trong một nhóm)');
        else dup[k] = it.dong;
      });
    });

    delete p._ent;
  });

  return { programs: progs, orphans: orphans };
}

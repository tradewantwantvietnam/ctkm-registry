'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import ImportWizard from '@/components/info/ImportWizard';
import { PRODUCT_FIELDS, convertProducts } from '@/lib/infoImport';
import { formatMonth, formatVND } from '@/lib/format';

const SHOW_MAX = 300;
const BATCH = 500;
const PRICE_BATCH = 2000;

const COLUMNS = [
  { key: 'dong', label: 'Dòng' },
  { key: 'ma_sp', label: 'Mã SP' },
  { key: 'ten_sp', label: 'Tên SP' },
  { key: 'quy_cach', label: 'Quy cách' },
  { key: 'le_per_thung', label: 'Số lẻ / thùng' },
  { key: 'loc_per_thung', label: 'Số lốc / thùng' },
  { key: 'le_per_loc', label: 'Số lẻ / lốc (tự tính)' },
  { key: 'gia_le', label: 'Giá lẻ' },
];

function curMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function kc(s) {
  return String(s || '').trim().toLowerCase();
}

export default function ProductTab() {
  const [month, setMonth] = useState(curMonth());
  const [rows, setRows] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');

  const monthOk = /^\d{4}-\d{2}$/.test(month);

  async function fetchData(m) {
    const ok = /^\d{4}-\d{2}$/.test(m);
    const [list, pr] = await Promise.all([
      api('listProducts'),
      ok ? api('getPrices', { data: { thang: m } }) : Promise.resolve({ prices: [] }),
    ]);
    const map = {};
    pr.prices.forEach((p) => {
      map[kc(p.ma_sp)] = p.gia_le;
    });
    return { list: list, map: map };
  }

  async function refresh() {
    const d = await fetchData(month);
    setRows(d.list);
    setPrices(d.map);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchData(month)
      .then((d) => {
        if (!alive) return;
        setRows(d.list);
        setPrices(d.map);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [month]);

  const nNoSpec = rows.filter((r) => r.le_per_thung === null).length;
  const nPrice = rows.filter((r) => prices[kc(r.ma_sp)] !== undefined).length;

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'spec' && r.le_per_thung !== null) return false;
      if (filter === 'price' && prices[kc(r.ma_sp)] !== undefined) return false;
      if (!kw) return true;
      return (r.ma_sp + ' ' + r.ten_sp + ' ' + r.quy_cach).toLowerCase().includes(kw);
    });
  }, [rows, prices, q, filter]);

  async function onImport(items, mode, setProgress) {
    const priced = items.filter((x) => x.gia_le !== '');
    if (priced.length > 0 && !monthOk) {
      throw new Error('File có cột giá, hãy chọn tháng áp dụng giá hợp lệ ở phía trên rồi tải lại file.');
    }

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < items.length; i += BATCH) {
      setProgress('Đang nhập sản phẩm ' + Math.min(i + BATCH, items.length) + '/' + items.length + '...');
      const out = await api('importProducts', {
        data: {
          rows: items.slice(i, i + BATCH).map((x) => ({
            dong: x.dong,
            ma_sp: x.ma_sp,
            ten_sp: x.ten_sp,
            quy_cach: x.quy_cach,
            le_per_thung: x.le_per_thung,
            le_per_loc: x.le_per_loc,
          })),
        },
      });
      created += out.created;
      updated += out.updated;
      out.errors.forEach((e) => errors.push(e));
    }

    let savedPrice = 0;
    if (priced.length > 0) {
      try {
        for (let i = 0; i < priced.length; i += PRICE_BATCH) {
          setProgress('Đang lưu giá ' + Math.min(i + PRICE_BATCH, priced.length) + '/' + priced.length + '...');
          const out = await api('savePrices', {
            data: {
              thang: month,
              items: priced.slice(i, i + PRICE_BATCH).map((x) => ({ ma_sp: x.ma_sp, gia_le: x.gia_le })),
            },
          });
          savedPrice += out.saved;
        }
      } catch (e) {
        await refresh();
        throw new Error('Đã nhập sản phẩm nhưng chưa lưu được giá: ' + e.message);
      }
    }

    await refresh();

    let text = 'Đã nhập sản phẩm: thêm mới ' + created + ', cập nhật ' + updated + '.';
    if (priced.length > 0) text += '\nĐã lưu giá ' + formatMonth(month) + ' cho ' + savedPrice + ' sản phẩm.';
    else text += '\nFile không có giá nên chưa lưu giá nào.';
    if (errors.length > 0) text += '\nBị bỏ qua ' + errors.length + ' dòng: ' + errors.slice(0, 5).join('; ');
    return text;
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <label htmlFor="sp_month">Tháng áp dụng giá</label>
            <input id="sp_month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Giá trong file sẽ lưu cho tháng này, và cột "Giá lẻ" ở bảng bên dưới là giá của tháng này. Giá nhập theo{' '}
          <b>đơn vị lẻ</b> (hộp, túi, gói).
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Số sản phẩm</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className={'stat' + (nNoSpec > 0 ? ' warn' : '')}>
          <div className="stat-label">Chưa có quy cách (số lẻ / thùng)</div>
          <div className="stat-value">{nNoSpec}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Đã có giá {monthOk ? formatMonth(month) : ''}</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {nPrice}
          </div>
        </div>
        <div className={'stat' + (rows.length - nPrice > 0 ? ' warn' : '')}>
          <div className="stat-label">Chưa có giá</div>
          <div className="stat-value">{rows.length - nPrice}</div>
        </div>
      </div>

      <ImportWizard
        title="Tải file sản phẩm (Mã SP, Tên SP, Quy cách, Giá lẻ)"
        fields={PRODUCT_FIELDS}
        convert={convertProducts}
        columns={COLUMNS}
        onImport={onImport}
        note={
          'Một file chung cho cả quy cách và giá. Quy cách viết như "36 hộp, 9 lốc" sẽ đọc ra 36 lẻ / thùng, 9 lốc / thùng và tự tính 4 lẻ / lốc. ' +
          'Giá (nếu có) lưu cho ' +
          (monthOk ? formatMonth(month) : 'tháng đang chọn') +
          '. Ô để trống không ghi đè dữ liệu đã có. Hãy xem kỹ các cột đã đọc ở bảng kiểm tra trước khi nhập.'
        }
      />

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="grow">
            <label htmlFor="sp_q">Tìm kiếm</label>
            <input
              id="sp_q"
              type="search"
              placeholder="Mã SP, tên SP, quy cách..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sp_filter">Lọc</label>
            <select id="sp_filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Tất cả sản phẩm</option>
              <option value="spec">Chưa có quy cách</option>
              <option value="price">Chưa có giá tháng này</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã SP</th>
                <th>Tên SP</th>
                <th>Quy cách</th>
                <th className="num">Số lẻ / thùng</th>
                <th className="num">Số lốc / thùng</th>
                <th className="num">Số lẻ / lốc</th>
                <th className="num">Giá lẻ {monthOk ? formatMonth(month) : ''}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {rows.length === 0 ? 'Chưa có sản phẩm nào. Hãy tải file sản phẩm lên.' : 'Không có sản phẩm phù hợp'}
                  </td>
                </tr>
              )}
              {filtered.slice(0, SHOW_MAX).map((r) => {
                const price = prices[kc(r.ma_sp)];
                const locPerThung =
                  r.le_per_thung !== null && r.le_per_loc !== null && Number.isInteger(r.le_per_thung / r.le_per_loc)
                    ? r.le_per_thung / r.le_per_loc
                    : null;
                return (
                  <tr key={r.ma_sp} className={r.le_per_thung === null ? 'row-warn' : ''}>
                    <td>{r.ma_sp}</td>
                    <td>{r.ten_sp}</td>
                    <td>{r.quy_cach}</td>
                    <td className="num">{r.le_per_thung === null ? <span className="muted">-</span> : r.le_per_thung}</td>
                    <td className="num">{locPerThung === null ? <span className="muted">-</span> : locPerThung}</td>
                    <td className="num">{r.le_per_loc === null ? <span className="muted">-</span> : r.le_per_loc}</td>
                    <td className="num">
                      {price === undefined ? <span className="muted">Chưa có</span> : formatVND(price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > SHOW_MAX && (
        <div className="hint" style={{ marginTop: 6 }}>
          Hiển thị {SHOW_MAX} / {filtered.length} sản phẩm. Dùng ô tìm kiếm để lọc.
        </div>
      )}
    </div>
  );
}

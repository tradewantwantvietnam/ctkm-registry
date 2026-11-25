'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import ImportWizard from '@/components/info/ImportWizard';
import { PRODUCT_FIELDS, convertProducts } from '@/lib/infoImport';

const SHOW_MAX = 300;
const BATCH = 500;

const COLUMNS = [
  { key: 'dong', label: 'Dòng' },
  { key: 'ma_sp', label: 'Mã SP' },
  { key: 'ten_sp', label: 'Tên SP' },
  { key: 'quy_cach', label: 'Quy cách' },
  { key: 'le_per_thung', label: 'Số lẻ / thùng (đọc được)' },
  { key: 'le_per_loc', label: 'Số lẻ / lốc' },
];

export default function ProductTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  async function load() {
    const r = await api('listProducts');
    setRows(r);
  }

  useEffect(() => {
    load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const nMissing = rows.filter((r) => r.le_per_thung === null).length;
  const nLoc = rows.filter((r) => r.le_per_loc !== null).length;

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissing && r.le_per_thung !== null) return false;
      if (!kw) return true;
      return (r.ma_sp + ' ' + r.ten_sp + ' ' + r.quy_cach).toLowerCase().includes(kw);
    });
  }, [rows, q, onlyMissing]);

  async function onImport(items, mode, setProgress) {
    let created = 0;
    let updated = 0;
    const errors = [];
    for (let i = 0; i < items.length; i += BATCH) {
      setProgress('Đang nhập ' + Math.min(i + BATCH, items.length) + '/' + items.length + '...');
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
    await load();
    let text = 'Đã nhập sản phẩm: thêm mới ' + created + ', cập nhật ' + updated + '.';
    if (errors.length > 0) text += '\nBị bỏ qua ' + errors.length + ' dòng: ' + errors.slice(0, 5).join('; ');
    return text;
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Số sản phẩm</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className={'stat' + (nMissing > 0 ? ' warn' : '')}>
          <div className="stat-label">Chưa có số lẻ / thùng</div>
          <div className="stat-value">{nMissing}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Có số lẻ / lốc</div>
          <div className="stat-value">{nLoc}</div>
        </div>
      </div>

      <ImportWizard
        title="Tải danh sách sản phẩm (Mã SP, Tên SP, Quy cách)"
        fields={PRODUCT_FIELDS}
        convert={convertProducts}
        columns={COLUMNS}
        onImport={onImport}
        note="Tải lại file sẽ cập nhật sản phẩm theo mã SP. Ô để trống trong file không ghi đè dữ liệu đã có. Số lẻ trong 1 thùng được lấy từ số đầu tiên trong ô quy cách, hãy xem kỹ cột 'đọc được' ở bảng kiểm tra."
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
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 }}>
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              Chỉ SP chưa có số lẻ / thùng
            </label>
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
                <th className="num">Số lẻ / lốc</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {rows.length === 0 ? 'Chưa có sản phẩm nào. Hãy tải file sản phẩm lên.' : 'Không có sản phẩm phù hợp'}
                  </td>
                </tr>
              )}
              {filtered.slice(0, SHOW_MAX).map((r) => (
                <tr key={r.ma_sp} className={r.le_per_thung === null ? 'row-warn' : ''}>
                  <td>{r.ma_sp}</td>
                  <td>{r.ten_sp}</td>
                  <td>{r.quy_cach}</td>
                  <td className="num">{r.le_per_thung === null ? <span className="muted">-</span> : r.le_per_thung}</td>
                  <td className="num">{r.le_per_loc === null ? <span className="muted">-</span> : r.le_per_loc}</td>
                </tr>
              ))}
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

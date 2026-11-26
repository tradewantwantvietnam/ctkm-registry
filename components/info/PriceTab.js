'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { toNumber } from '@/lib/infoImport';
import { formatMonth } from '@/lib/format';

const SHOW_MAX = 500;
const BATCH = 2000;

function curMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function kc(s) {
  return String(s || '').trim().toLowerCase();
}

export default function PriceTab() {
  const [month, setMonth] = useState(curMonth());
  const [products, setProducts] = useState([]);
  const [prices, setPrices] = useState({});
  const [months, setMonths] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');

  async function fetchData(m) {
    const [list, pr] = await Promise.all([api('listProducts'), api('getPrices', { data: { thang: m } })]);
    const map = {};
    pr.prices.forEach((p) => {
      map[kc(p.ma_sp)] = String(p.gia_le);
    });
    return { list: list, map: map, months: pr.months };
  }

  function applyData(d) {
    setProducts(d.list);
    setPrices(d.map);
    setMonths(d.months);
    setEdits({});
  }

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    setMsg('');
    fetchData(month)
      .then((d) => {
        if (!alive) return;
        applyData(d);
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

  function valueOf(p) {
    const k = kc(p.ma_sp);
    if (edits[k] !== undefined) return edits[k];
    return prices[k] !== undefined ? prices[k] : '';
  }

  const dirty = products.filter((p) => {
    const k = kc(p.ma_sp);
    if (edits[k] === undefined) return false;
    return edits[k].trim() !== (prices[k] !== undefined ? prices[k] : '');
  });

  const nWithPrice = products.filter((p) => prices[kc(p.ma_sp)] !== undefined).length;

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyMissing) {
        const k = kc(p.ma_sp);
        const shown = edits[k] !== undefined ? edits[k] : prices[k] !== undefined ? prices[k] : '';
        if (String(shown).trim() !== '') return false;
      }
      if (!kw) return true;
      return (p.ma_sp + ' ' + p.ten_sp).toLowerCase().includes(kw);
    });
  }, [products, q, onlyMissing, edits, prices]);

  async function onSave() {
    setError('');
    setMsg('');
    const items = [];
    for (const p of dirty) {
      const raw = edits[kc(p.ma_sp)].trim();
      if (raw === '') {
        items.push({ ma_sp: p.ma_sp, gia_le: '' });
        continue;
      }
      const n = toNumber(raw);
      if (typeof n !== 'number' || Number.isNaN(n) || n < 0) {
        setError('Giá không hợp lệ ở sản phẩm ' + p.ma_sp + ': "' + raw + '"');
        return;
      }
      items.push({ ma_sp: p.ma_sp, gia_le: n });
    }
    if (items.length === 0) return;

    setSaving(true);
    try {
      let saved = 0;
      let deleted = 0;
      for (let i = 0; i < items.length; i += BATCH) {
        const out = await api('savePrices', { data: { thang: month, items: items.slice(i, i + BATCH) } });
        saved += out.saved;
        deleted += out.deleted;
      }
      applyData(await fetchData(month));
      setMsg('Đã lưu giá ' + formatMonth(month) + ': ' + saved + ' sản phẩm' + (deleted ? ', xóa giá ' + deleted : '') + '.');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const sources = months.filter((t) => t !== month);
  const before = sources.filter((t) => t < month);
  const defaultSource = before.length ? before[before.length - 1] : sources[0] || '';
  const copySource = copyFrom && sources.includes(copyFrom) ? copyFrom : defaultSource;

  async function onCopy() {
    if (!copySource) return;
    const ok = window.confirm(
      'Sao chép giá của ' + formatMonth(copySource) + ' sang ' + formatMonth(month) + ' cho các sản phẩm chưa có giá?'
    );
    if (!ok) return;
    setError('');
    setMsg('');
    setSaving(true);
    try {
      const out = await api('copyPrices', { data: { from: copySource, to: month } });
      applyData(await fetchData(month));
      setMsg(
        'Đã sao chép giá cho ' + out.copied + ' sản phẩm' + (out.skipped ? ' (bỏ qua ' + out.skipped + ' sản phẩm đã có giá)' : '') + '.'
      );
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const monthOk = /^\d{4}-\d{2}$/.test(month);

  return (
    <div>
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <label htmlFor="pr_month">Tháng áp dụng giá</label>
            <input id="pr_month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grow">
            <label>Các tháng đã có giá</label>
            <div className="row" style={{ gap: 6 }}>
              {months.length === 0 && <span className="muted">Chưa có tháng nào</span>}
              {months.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === month ? 'btn btn-small btn-primary' : 'btn btn-small'}
                  onClick={() => setMonth(t)}
                >
                  {formatMonth(t)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Giá thường được tải cùng file quy cách ở tab <b>Sản phẩm</b>. Tab này dùng để xem, sửa tay từng giá và sao chép
          giá giữa các tháng. Giá nhập theo <b>đơn vị lẻ</b> (hộp, túi, gói).
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && (
        <div className="alert alert-ok" style={{ whiteSpace: 'pre-wrap' }}>
          {msg}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Số sản phẩm</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Đã có giá {monthOk ? formatMonth(month) : ''}</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {nWithPrice}
          </div>
        </div>
        <div className={'stat' + (products.length - nWithPrice > 0 ? ' warn' : '')}>
          <div className="stat-label">Chưa có giá</div>
          <div className="stat-value">{products.length - nWithPrice}</div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="grow">
            <label htmlFor="pr_q">Tìm kiếm</label>
            <input
              id="pr_q"
              type="search"
              placeholder="Mã SP hoặc tên SP..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 }}>
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              Chỉ SP chưa có giá
            </label>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <select
              value={copySource}
              onChange={(e) => setCopyFrom(e.target.value)}
              disabled={sources.length === 0 || saving}
              style={{ maxWidth: 130 }}
            >
              {sources.length === 0 && <option value="">Không có</option>}
              {sources.map((t) => (
                <option key={t} value={t}>
                  {formatMonth(t)}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={onCopy} disabled={!copySource || saving || !monthOk}>
              Sao chép giá còn thiếu
            </button>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || dirty.length === 0}>
              {saving ? 'Đang lưu...' : 'Lưu giá (' + dirty.length + ' thay đổi)'}
            </button>
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
                <th>Giá lẻ {monthOk ? formatMonth(month) : ''}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {products.length === 0
                      ? 'Chưa có sản phẩm nào. Hãy tải file sản phẩm ở tab Sản phẩm trước.'
                      : 'Không có sản phẩm phù hợp'}
                  </td>
                </tr>
              )}
              {filtered.slice(0, SHOW_MAX).map((p) => {
                const k = kc(p.ma_sp);
                const changed = edits[k] !== undefined && edits[k].trim() !== (prices[k] !== undefined ? prices[k] : '');
                return (
                  <tr key={p.ma_sp} style={changed ? { background: '#fffbeb' } : undefined}>
                    <td>{p.ma_sp}</td>
                    <td>{p.ten_sp}</td>
                    <td>{p.quy_cach}</td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valueOf(p)}
                        placeholder="Chưa có giá"
                        disabled={saving}
                        onChange={(e) => setEdits((s) => ({ ...s, [k]: e.target.value }))}
                        style={{ width: 150, textAlign: 'right' }}
                      />
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

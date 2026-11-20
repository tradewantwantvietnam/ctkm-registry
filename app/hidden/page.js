'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate } from '@/lib/format';

export default function HiddenPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    const list = await api('listHidden');
    setRows(list);
  }

  useEffect(() => {
    load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => (r.so_thong_bao + ' ' + r.ten).toLowerCase().includes(kw));
  }, [rows, q]);

  async function onRestore(r) {
    const ok = window.confirm('Khôi phục chương trình ' + r.so_thong_bao + ' về danh sách?');
    if (!ok) return;
    setError('');
    setMsg('');
    setBusyId(r.so_thong_bao);
    try {
      await api('restoreProgram', { id: r.so_thong_bao });
      await load();
      setMsg('Đã khôi phục chương trình ' + r.so_thong_bao);
    } catch (e) {
      setError(e.message);
    }
    setBusyId('');
  }

  return (
    <div>
      <h1>Chương trình đã ẩn</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && (
        <div className="alert alert-ok">
          {msg}. <Link href="/">Về danh sách</Link>
        </div>
      )}

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="grow">
            <label htmlFor="q">Tìm kiếm</label>
            <input
              id="q"
              type="search"
              placeholder="Số thông báo hoặc tên..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Chương trình bị ẩn vẫn được giữ nguyên ngân sách, chi phí và PDF. Khôi phục để đưa lại vào danh sách.
        </div>
      </div>

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Số thông báo</th>
                <th>Tên chương trình</th>
                <th>Hình thức</th>
                <th>Thời gian chạy</th>
                <th className="num">Ngân sách</th>
                <th className="num">Chi phí</th>
                <th>PDF</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    Không có chương trình nào bị ẩn
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.so_thong_bao}>
                  <td>{r.so_thong_bao}</td>
                  <td>{r.ten}</td>
                  <td>{r.hinh_thuc}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                  </td>
                  <td className="num">{formatVND(r.ngan_sach)}</td>
                  <td className="num">
                    {r.co_chi_phi ? formatVND(r.chi_phi) : <span className="muted">Chưa có</span>}
                  </td>
                  <td>{r.so_pdf > 0 ? '📄 ' + r.so_pdf : <span className="muted">-</span>}</td>
                  <td>
                    <button
                      className="btn btn-small btn-primary"
                      disabled={busyId === r.so_thong_bao}
                      onClick={() => onRestore(r)}
                    >
                      {busyId === r.so_thong_bao ? 'Đang khôi phục...' : 'Khôi phục'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

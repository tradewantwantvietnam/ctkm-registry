'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import ImportWizard from '@/components/info/ImportWizard';
import { NPP_FIELDS, convertNpp } from '@/lib/infoImport';

const SHOW_MAX = 300;
const BATCH = 500;

const MODES = [
  {
    value: 'merge',
    label: 'Cập nhật theo mã NPP: thêm NPP mới, sửa NPP đã có, giữ nguyên NPP không có trong file',
    confirm: 'Nhập {n} NPP vào danh sách?',
  },
  {
    value: 'replace',
    label: 'Thay toàn bộ danh sách NPP bằng file này',
    confirm: 'THAY TOÀN BỘ danh sách NPP hiện có bằng {n} NPP trong file? NPP không có trong file sẽ bị xóa.',
  },
];

const COLUMNS = [
  { key: 'dong', label: 'Dòng' },
  { key: 'mien', label: 'Miền' },
  { key: 'vung', label: 'Vùng' },
  { key: 'ma_npp', label: 'Mã NPP' },
  { key: 'ten_npp', label: 'Tên NPP' },
];

export default function NppTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [mien, setMien] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');

  async function load() {
    const r = await api('listNpp');
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

  const miens = useMemo(() => {
    const seen = {};
    const out = [];
    rows.forEach((r) => {
      const k = r.mien.toLowerCase();
      if (!seen[k]) {
        seen[k] = true;
        out.push(r.mien);
      }
    });
    return out;
  }, [rows]);

  const nVung = useMemo(() => {
    const s = {};
    rows.forEach((r) => {
      s[r.mien.toLowerCase() + '|' + r.vung.toLowerCase()] = true;
    });
    return Object.keys(s).length;
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (mien && r.mien !== mien) return false;
      if (!kw) return true;
      return (r.ma_npp + ' ' + r.ten_npp + ' ' + r.vung + ' ' + r.mien).toLowerCase().includes(kw);
    });
  }, [rows, q, mien]);

  async function onImport(items, mode, setProgress) {
    let created = 0;
    let updated = 0;
    const errors = [];
    const added = {};
    const removed = {};
    let finalRegions = [];

    for (let i = 0; i < items.length; i += BATCH) {
      setProgress('Đang nhập ' + Math.min(i + BATCH, items.length) + '/' + items.length + '...');
      const out = await api('importNpp', {
        data: {
          clear: mode === 'replace' && i === 0,
          rows: items.slice(i, i + BATCH).map((x) => ({
            dong: x.dong,
            ma_npp: x.ma_npp,
            ten_npp: x.ten_npp,
            mien: x.mien,
            vung: x.vung,
          })),
        },
      });
      created += out.created;
      updated += out.updated;
      out.errors.forEach((e) => errors.push(e));
      (out.regions.added || []).forEach((n) => {
        added[n] = true;
      });
      (out.regions.removed || []).forEach((n) => {
        removed[n] = true;
      });
      finalRegions = out.regions.regions || finalRegions;
    }

    await load();

    let text = 'Đã nhập NPP: thêm mới ' + created + ', cập nhật ' + updated + '.';
    if (errors.length > 0) text += '\nBị bỏ qua ' + errors.length + ' dòng: ' + errors.slice(0, 5).join('; ');
    text += '\nDanh sách Miền dùng cho ngân sách: ' + finalRegions.join(', ') + '.';
    const a = Object.keys(added);
    const r = Object.keys(removed);
    if (a.length) text += '\nMiền mới thêm: ' + a.join(', ') + '.';
    if (r.length) text += '\nMiền đã gỡ (không dùng nữa): ' + r.join(', ') + '.';
    return text;
  }

  async function onRenameMien() {
    setError('');
    setMsg('');
    if (!renameFrom || !renameTo.trim()) {
      setError('Hãy chọn Miền cần đổi và nhập tên mới');
      return;
    }
    const ok = window.confirm(
      'Đổi tên Miền "' + renameFrom + '" thành "' + renameTo.trim() + '"?\n\nTên mới áp dụng cho danh sách NPP, ngân sách và chi phí đã nhập.'
    );
    if (!ok) return;
    try {
      await api('renameMien', { data: { ten_cu: renameFrom, ten_moi: renameTo.trim() } });
      await load();
      setMsg('Đã đổi tên Miền "' + renameFrom + '" thành "' + renameTo.trim() + '"');
      setRenameFrom('');
      setRenameTo('');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Số NPP</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Số Miền</div>
          <div className="stat-value">{miens.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Số Vùng</div>
          <div className="stat-value">{nVung}</div>
        </div>
      </div>

      <ImportWizard
        title="Tải danh sách NPP (Miền, Vùng, Mã NPP, Tên NPP)"
        fields={NPP_FIELDS}
        convert={convertNpp}
        columns={COLUMNS}
        modes={MODES}
        onImport={onImport}
        note="Danh sách Miền trong file sẽ trở thành danh sách Miền dùng để nhập ngân sách A&P."
      />

      <div className="card">
        <h2>Đổi tên Miền</h2>
        <div className="row">
          <select value={renameFrom} onChange={(e) => setRenameFrom(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">-- Chọn Miền --</option>
            {miens.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tên mới"
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button type="button" className="btn" onClick={onRenameMien} disabled={!renameFrom || !renameTo.trim()}>
            Đổi tên
          </button>
        </div>
        <div className="hint">
          Đổi tên Miền ở đây thay vì nút "đổi tên vùng" trong form chương trình, để danh sách NPP và ngân sách luôn khớp.
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="grow">
            <label htmlFor="npp_q">Tìm kiếm</label>
            <input
              id="npp_q"
              type="search"
              placeholder="Mã NPP, tên NPP, vùng, miền..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="npp_mien">Miền</label>
            <select id="npp_mien" value={mien} onChange={(e) => setMien(e.target.value)}>
              <option value="">Tất cả</option>
              {miens.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
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
                <th>Miền</th>
                <th>Vùng</th>
                <th>Mã NPP</th>
                <th>Tên NPP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {rows.length === 0 ? 'Chưa có NPP nào. Hãy tải file danh sách NPP lên.' : 'Không có NPP phù hợp'}
                  </td>
                </tr>
              )}
              {filtered.slice(0, SHOW_MAX).map((r) => (
                <tr key={r.ma_npp}>
                  <td>{r.mien}</td>
                  <td>{r.vung}</td>
                  <td>{r.ma_npp}</td>
                  <td>{r.ten_npp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > SHOW_MAX && (
        <div className="hint" style={{ marginTop: 6 }}>
          Hiển thị {SHOW_MAX} / {filtered.length} NPP. Dùng ô tìm kiếm hoặc chọn Miền để lọc.
        </div>
      )}
    </div>
  );
}

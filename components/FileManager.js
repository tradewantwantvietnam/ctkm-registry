'use client';

import { useEffect, useState } from 'react';
import { api, uploadBigPdf, openPdf, downloadPdf, MAX_BIG_PDF_MB } from '@/lib/api';
import { LOAI_TAI_LIEU, formatSize, formatDateTime } from '@/lib/format';

export default function FileManager({ soThongBao }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [pick, setPick] = useState({ file: null, name: '', loai: LOAI_TAI_LIEU[0] });
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);

  const [busyId, setBusyId] = useState('');
  const [busyPct, setBusyPct] = useState(0);
  const [editing, setEditing] = useState(null); // { file_id, ten_hien_thi, loai_tai_lieu }
  const [saving, setSaving] = useState(false);

  async function load() {
    const list = await api('listFiles', { id: soThongBao });
    setFiles(list);
  }

  useEffect(() => {
    load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [soThongBao]);

  function onPick(e) {
    const f = e.target.files && e.target.files[0];
    setError('');
    setMsg('');
    if (!f) {
      setPick((p) => ({ ...p, file: null }));
      return;
    }
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setError('Chỉ nhận file PDF');
      e.target.value = '';
      setPick((p) => ({ ...p, file: null }));
      return;
    }
    if (f.size === 0) {
      setError('File rỗng');
      e.target.value = '';
      return;
    }
    if (f.size > MAX_BIG_PDF_MB * 1024 * 1024) {
      setError('File quá lớn (tối đa ' + MAX_BIG_PDF_MB + 'MB). Hãy nén PDF rồi chọn lại.');
      e.target.value = '';
      setPick((p) => ({ ...p, file: null }));
      return;
    }
    setPick((p) => ({ ...p, file: f, name: p.name || f.name.replace(/\.pdf$/i, '') }));
  }

  async function onUpload() {
    setError('');
    setMsg('');
    if (!pick.file) return setError('Chưa chọn file PDF');
    if (!pick.name.trim()) return setError('Chưa nhập tên tài liệu');

    setUploading(true);
    setPct(0);
    try {
      await uploadBigPdf(
        pick.file,
        {
          so_thong_bao: soThongBao,
          ten_hien_thi: pick.name.trim(),
          loai_tai_lieu: pick.loai,
        },
        setPct
      );
      await load();
      setMsg('Đã tải lên "' + pick.name.trim() + '"');
      setPick({ file: null, name: '', loai: pick.loai });
      setFileKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  }

  async function onView(f) {
    setError('');
    setBusyId(f.file_id);
    setBusyPct(0);
    try {
      await openPdf(f.file_id, setBusyPct);
    } catch (e) {
      setError(e.message);
    }
    setBusyId('');
  }

  async function onDownload(f) {
    setError('');
    setBusyId(f.file_id);
    setBusyPct(0);
    try {
      await downloadPdf(f.file_id, setBusyPct);
    } catch (e) {
      setError(e.message);
    }
    setBusyId('');
  }

  async function saveEdit() {
    if (!editing) return;
    setError('');
    setMsg('');
    if (!editing.ten_hien_thi.trim()) return setError('Chưa nhập tên tài liệu');
    setSaving(true);
    try {
      await api('updateFile', {
        data: {
          file_id: editing.file_id,
          ten_hien_thi: editing.ten_hien_thi.trim(),
          loai_tai_lieu: editing.loai_tai_lieu,
        },
      });
      await load();
      setEditing(null);
      setMsg('Đã cập nhật tài liệu');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  async function onDelete(f) {
    const ok = window.confirm('Xóa tài liệu "' + f.ten_hien_thi + '"? File sẽ được chuyển vào thùng rác của Google Drive.');
    if (!ok) return;
    setError('');
    setMsg('');
    try {
      await api('deleteFile', { data: { file_id: f.file_id } });
      await load();
      setMsg('Đã xóa tài liệu');
    } catch (e) {
      setError(e.message);
    }
  }

  function loaiOptions(current) {
    return current && !LOAI_TAI_LIEU.includes(current) ? [current, ...LOAI_TAI_LIEU] : LOAI_TAI_LIEU;
  }

  return (
    <div className="card">
      <h2>Tài liệu PDF scan ({files.length})</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {loading ? (
        <div className="muted">Đang tải danh sách...</div>
      ) : files.length === 0 ? (
        <div className="muted" style={{ marginBottom: 12 }}>
          Chưa có tài liệu nào
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Tên tài liệu</th>
                <th>Loại</th>
                <th>File gốc</th>
                <th className="num">Dung lượng</th>
                <th>Ngày tải</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const isEditing = editing && editing.file_id === f.file_id;
                const busy = busyId === f.file_id;
                return (
                  <tr key={f.file_id}>
                    <td style={{ minWidth: 200 }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editing.ten_hien_thi}
                          onChange={(e) => setEditing({ ...editing, ten_hien_thi: e.target.value })}
                        />
                      ) : (
                        f.ten_hien_thi
                      )}
                    </td>
                    <td style={{ minWidth: 180 }}>
                      {isEditing ? (
                        <select
                          value={editing.loai_tai_lieu}
                          onChange={(e) => setEditing({ ...editing, loai_tai_lieu: e.target.value })}
                        >
                          {loaiOptions(editing.loai_tai_lieu).map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        f.loai_tai_lieu
                      )}
                    </td>
                    <td className="muted">{f.ten_file_goc}</td>
                    <td className="num">{formatSize(f.kich_thuoc)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(f.ngay_tai)}</td>
                    <td>
                      {isEditing ? (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-small btn-primary" disabled={saving} onClick={saveEdit}>
                            Lưu
                          </button>
                          <button className="btn btn-small" disabled={saving} onClick={() => setEditing(null)}>
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-small btn-primary" disabled={!!busyId} onClick={() => onView(f)}>
                            {busy ? 'Đang tải ' + busyPct + '%' : 'Xem'}
                          </button>
                          <button className="btn btn-small" disabled={!!busyId} onClick={() => onDownload(f)}>
                            Tải về
                          </button>
                          <button
                            className="btn btn-small"
                            disabled={!!busyId}
                            onClick={() =>
                              setEditing({
                                file_id: f.file_id,
                                ten_hien_thi: f.ten_hien_thi,
                                loai_tai_lieu: f.loai_tai_lieu,
                              })
                            }
                          >
                            Sửa
                          </button>
                          <button className="btn btn-small btn-danger" disabled={!!busyId} onClick={() => onDelete(f)}>
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          border: '1px dashed #9ca3af',
          borderRadius: 8,
          padding: 12,
          background: '#f9fafb',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Tải thêm tài liệu</div>
        <div className="form-grid">
          <div className="full">
            <label htmlFor="fm_file">File PDF (tối đa {MAX_BIG_PDF_MB}MB)</label>
            <input
              key={fileKey}
              id="fm_file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPick}
              disabled={uploading}
            />
          </div>
          <div>
            <label htmlFor="fm_name">Tên tài liệu *</label>
            <input
              id="fm_name"
              type="text"
              placeholder="Ví dụ: Thông báo CTKM tháng 11 - bản ký"
              value={pick.name}
              disabled={uploading}
              onChange={(e) => setPick((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="fm_loai">Loại tài liệu</label>
            <select
              id="fm_loai"
              value={pick.loai}
              disabled={uploading}
              onChange={(e) => setPick((p) => ({ ...p, loai: e.target.value }))}
            >
              {LOAI_TAI_LIEU.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={onUpload} disabled={uploading || !pick.file}>
            {uploading ? 'Đang tải lên ' + pct + '%...' : 'Tải lên'}
          </button>
          {uploading && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="progress">
                <div className="progress-bar" style={{ width: pct + '%' }} />
              </div>
            </div>
          )}
        </div>
        <div className="hint">
          File lớn tải lên theo từng đoạn nên có thể mất vài chục giây, vui lòng không đóng trang.
        </div>
      </div>
    </div>
  );
}

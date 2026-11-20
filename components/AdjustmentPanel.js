'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, uploadBigPdf, openPdf, downloadPdf, MAX_BIG_PDF_MB } from '@/lib/api';
import {
  ALL_REGION,
  formatDate,
  formatDateTime,
  formatMonth,
  formatVND,
  todayYmd,
} from '@/lib/format';
import BudgetEditor, {
  emptyBudgetState,
  budgetStateFrom,
  budgetsFromState,
  renameRegionInState,
} from '@/components/BudgetEditor';

const DOC_TYPE = 'Thông báo điều chỉnh / bổ sung';

function diffBudgets(oldList, newList) {
  const key = (b) => b.thang + '|' + String(b.vung).toLowerCase();
  const o = {};
  const n = {};
  (oldList || []).forEach((b) => {
    o[key(b)] = b;
  });
  (newList || []).forEach((b) => {
    n[key(b)] = b;
  });
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).sort();
  const out = [];
  keys.forEach((k) => {
    const cu = o[k] ? Number(o[k].ngan_sach) : null;
    const moi = n[k] ? Number(n[k].ngan_sach) : null;
    if (cu !== moi) out.push({ thang: (o[k] || n[k]).thang, vung: (o[k] || n[k]).vung, cu: cu, moi: moi });
  });
  return out;
}

function lineOf(d) {
  const name = formatMonth(d.thang) + (d.vung !== ALL_REGION ? ' - ' + d.vung : '');
  const a = d.cu === null || d.cu === undefined ? 'chưa có' : formatVND(d.cu);
  const b = d.moi === null || d.moi === undefined ? 'bỏ' : formatVND(d.moi);
  return name + ': ' + a + ' → ' + b;
}

export default function AdjustmentPanel({ detail, refs, onSaved }) {
  const p = detail.program;

  const [adjs, setAdjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [f, setF] = useState({ so_dc: '', hieu_luc: todayYmd(), ly_do: '', ngay_bd: p.ngay_bd, ngay_kt: p.ngay_kt });
  const [bstate, setBstate] = useState(emptyBudgetState());
  const [regions, setRegions] = useState((refs && refs.regions) || []);
  const [file, setFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const [pct, setPct] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  async function loadAdj() {
    const list = await api('listAdjustments', { id: p.so_thong_bao });
    setAdjs(list);
  }

  useEffect(() => {
    loadAdj()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [p.so_thong_bao]);

  function openForm() {
    setF({ so_dc: '', hieu_luc: todayYmd(), ly_do: '', ngay_bd: p.ngay_bd, ngay_kt: p.ngay_kt });
    setBstate(detail.budgets.length ? budgetStateFrom(detail.budgets) : emptyBudgetState());
    setRegions((refs && refs.regions) || []);
    setFile(null);
    setDocName('');
    setFileKey((k) => k + 1);
    setPct(0);
    setError('');
    setMsg('');
    setOpen(true);
  }

  function setField(name, value) {
    setF((s) => ({ ...s, [name]: value }));
  }

  async function addRegion(name) {
    const list = await api('addRegion', { data: { ten: name } });
    setRegions(list);
    const found = list.find((t) => t.toLowerCase() === name.toLowerCase());
    setBstate((s) =>
      s.scope === 'regions' && found && !s.regions.includes(found)
        ? { ...s, regions: [...s.regions, found] }
        : s
    );
  }

  async function renameRegion(oldName, newName) {
    const list = await api('renameRegion', { data: { ten_cu: oldName, ten_moi: newName } });
    setRegions(list);
    setBstate((s) => renameRegionInState(s, oldName, newName));
  }

  const built = useMemo(
    () => (open ? budgetsFromState(bstate, f.ngay_bd, f.ngay_kt) : null),
    [open, bstate, f.ngay_bd, f.ngay_kt]
  );
  const changes = built && built.budgets ? diffBudgets(detail.budgets, built.budgets) : [];
  const dateChanged = f.ngay_bd !== p.ngay_bd || f.ngay_kt !== p.ngay_kt;
  const oldTotal = detail.budgets.reduce((s, b) => s + Number(b.ngan_sach), 0);
  const newTotal = built && built.budgets ? built.budgets.reduce((s, b) => s + b.ngan_sach, 0) : 0;

  function onPickFile(e) {
    const picked = e.target.files && e.target.files[0];
    setError('');
    if (!picked) {
      setFile(null);
      return;
    }
    const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name);
    if (!isPdf) {
      setError('Chỉ nhận file PDF');
      e.target.value = '';
      setFile(null);
      return;
    }
    if (picked.size === 0 || picked.size > MAX_BIG_PDF_MB * 1024 * 1024) {
      setError('File phải có dung lượng từ 1 byte đến ' + MAX_BIG_PDF_MB + 'MB');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(picked);
    if (!docName) setDocName('Thông báo điều chỉnh ' + (f.so_dc || '').trim());
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setMsg('');

    const soDc = f.so_dc.trim();
    if (!soDc) return setError('Chưa nhập số thông báo điều chỉnh');
    if (!f.hieu_luc) return setError('Chưa chọn ngày hiệu lực');
    if (!f.ly_do.trim()) return setError('Chưa nhập lý do điều chỉnh');
    if (!f.ngay_bd || !f.ngay_kt) return setError('Chưa chọn thời gian chạy');
    if (f.ngay_kt < f.ngay_bd) return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if (file && !docName.trim()) return setError('Chưa nhập tên tài liệu cho file PDF');

    const b = budgetsFromState(bstate, f.ngay_bd, f.ngay_kt);
    if (b.error) return setError(b.error);
    if (!dateChanged && diffBudgets(detail.budgets, b.budgets).length === 0) {
      return setError('Chưa có thay đổi nào so với hiện tại (thời gian chạy và ngân sách đều giữ nguyên)');
    }

    // Cảnh báo nếu bỏ một tháng đã có chi phí
    const newMonths = new Set(b.budgets.map((x) => x.thang));
    const lost = Array.from(new Set(detail.costs.map((c) => c.thang))).filter((t) => !newMonths.has(t));
    if (lost.length > 0) {
      const ok = window.confirm(
        'Các tháng ' + lost.map(formatMonth).join(', ') +
          ' đã có chi phí nhưng sẽ không còn ngân sách sau điều chỉnh. Vẫn lưu?'
      );
      if (!ok) return;
    }

    setSaving(true);
    let warn = '';
    try {
      const adj = await api('addAdjustment', {
        data: {
          so_thong_bao: p.so_thong_bao,
          so_tb_dieu_chinh: soDc,
          ngay_hieu_luc: f.hieu_luc,
          ly_do: f.ly_do.trim(),
          ngay_bd: f.ngay_bd,
          ngay_kt: f.ngay_kt,
          budgets: b.budgets,
        },
      });

      if (file) {
        try {
          const saved = await uploadBigPdf(
            file,
            { so_thong_bao: p.so_thong_bao, ten_hien_thi: docName.trim(), loai_tai_lieu: DOC_TYPE },
            setPct
          );
          await api('attachAdjFile', { data: { adj_id: adj.adj_id, file_id: saved.file_id } });
        } catch (err) {
          warn =
            ' Nhưng chưa tải được file PDF (' + err.message + '). Hãy tải PDF ở mục "Tài liệu PDF scan" bên dưới.';
        }
      }

      await loadAdj();
      if (onSaved) await onSaved();
      setOpen(false);
      setMsg('Đã lưu thông báo điều chỉnh ' + soDc + '.' + warn);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function onView(fileId) {
    setError('');
    setBusyId(fileId);
    try {
      await openPdf(fileId);
    } catch (err) {
      setError(err.message);
    }
    setBusyId('');
  }

  async function onDownload(fileId) {
    setError('');
    setBusyId(fileId);
    try {
      await downloadPdf(fileId);
    } catch (err) {
      setError(err.message);
    }
    setBusyId('');
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Thông báo điều chỉnh</h2>
        {!open && (
          <button className="btn btn-primary" onClick={openForm}>
            Tạo thông báo điều chỉnh
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {loading ? (
        <div className="muted">Đang tải...</div>
      ) : adjs.length === 0 ? (
        <div className="muted">Chưa có thông báo điều chỉnh nào. Chương trình đang theo thông báo gốc {p.so_thong_bao}.</div>
      ) : (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <span className="badge badge-blue">Gốc: {p.so_thong_bao}</span>
            {adjs.map((a, i) => (
              <Fragment key={a.adj_id}>
                <span>→</span>
                <span className="badge badge-warn">
                  Điều chỉnh {i + 1}: {a.so_tb_dieu_chinh}
                </span>
              </Fragment>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lần</th>
                  <th>Số thông báo</th>
                  <th>Hiệu lực</th>
                  <th>Lý do</th>
                  <th>Thay đổi (số cũ → số mới)</th>
                  <th>Tài liệu</th>
                </tr>
              </thead>
              <tbody>
                {adjs.map((a, i) => {
                  const dateChg = a.ngay_bd_cu !== a.ngay_bd_moi || a.ngay_kt_cu !== a.ngay_kt_moi;
                  const files = a.file_ids.map((id) => detail.files.find((x) => x.file_id === id)).filter(Boolean);
                  return (
                    <tr key={a.adj_id}>
                      <td>{i + 1}</td>
                      <td>
                        <b>{a.so_tb_dieu_chinh}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          lập {formatDateTime(a.ngay_tao)}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.ngay_hieu_luc)}</td>
                      <td style={{ minWidth: 160 }}>{a.ly_do}</td>
                      <td style={{ minWidth: 260 }}>
                        {dateChg && (
                          <div>
                            Thời gian: {formatDate(a.ngay_bd_cu)} - {formatDate(a.ngay_kt_cu)} →{' '}
                            <b>
                              {formatDate(a.ngay_bd_moi)} - {formatDate(a.ngay_kt_moi)}
                            </b>
                          </div>
                        )}
                        {a.doi.map((d, j) => (
                          <div key={j} style={{ whiteSpace: 'nowrap' }}>
                            {lineOf(d)}
                          </div>
                        ))}
                        <div style={{ marginTop: 4 }}>
                          Tổng ngân sách: {formatVND(a.tong_cu)} → <b>{formatVND(a.tong_moi)}</b>
                        </div>
                      </td>
                      <td>
                        {files.length === 0 && <span className="muted">-</span>}
                        {files.map((fl) => (
                          <div key={fl.file_id} style={{ marginBottom: 4 }}>
                            <div>{fl.ten_hien_thi}</div>
                            <div className="row" style={{ gap: 4 }}>
                              <button
                                className="btn btn-small btn-primary"
                                disabled={!!busyId}
                                onClick={() => onView(fl.file_id)}
                              >
                                Xem
                              </button>
                              <button className="btn btn-small" disabled={!!busyId} onClick={() => onDownload(fl.file_id)}>
                                Tải về
                              </button>
                            </div>
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && (
        <form onSubmit={onSubmit} style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Tạo thông báo điều chỉnh cho {p.so_thong_bao}</div>

          <div className="form-grid">
            <div>
              <label htmlFor="adj_so">Số thông báo điều chỉnh *</label>
              <input id="adj_so" type="text" value={f.so_dc} onChange={(e) => setField('so_dc', e.target.value)} />
            </div>
            <div>
              <label htmlFor="adj_hl">Ngày hiệu lực *</label>
              <input id="adj_hl" type="date" value={f.hieu_luc} onChange={(e) => setField('hieu_luc', e.target.value)} />
            </div>
            <div className="full">
              <label htmlFor="adj_ld">Lý do điều chỉnh *</label>
              <input id="adj_ld" type="text" value={f.ly_do} onChange={(e) => setField('ly_do', e.target.value)} />
            </div>
            <div>
              <label htmlFor="adj_bd">Ngày bắt đầu (sau điều chỉnh)</label>
              <input id="adj_bd" type="date" value={f.ngay_bd} onChange={(e) => setField('ngay_bd', e.target.value)} />
            </div>
            <div>
              <label htmlFor="adj_kt">Ngày kết thúc (sau điều chỉnh)</label>
              <input id="adj_kt" type="date" value={f.ngay_kt} onChange={(e) => setField('ngay_kt', e.target.value)} />
            </div>

            <div className="full">
              <BudgetEditor
                ngayBd={f.ngay_bd}
                ngayKt={f.ngay_kt}
                state={bstate}
                onChange={setBstate}
                regions={regions}
                onAddRegion={addRegion}
                onRenameRegion={renameRegion}
              />
            </div>

            <div className="full">
              <div className="card" style={{ marginBottom: 0, background: '#f9fafb' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Thay đổi so với hiện tại</div>
                {!dateChanged && changes.length === 0 && <div className="muted">Chưa có thay đổi nào.</div>}
                {dateChanged && (
                  <div>
                    Thời gian: {formatDate(p.ngay_bd)} - {formatDate(p.ngay_kt)} →{' '}
                    <b>
                      {formatDate(f.ngay_bd)} - {formatDate(f.ngay_kt)}
                    </b>
                  </div>
                )}
                {changes.map((d, i) => (
                  <div key={i}>{lineOf(d)}</div>
                ))}
                {built && built.error && <div style={{ color: '#b45309' }}>{built.error}</div>}
                {built && built.budgets && (
                  <div style={{ marginTop: 4 }}>
                    Tổng ngân sách: {formatVND(oldTotal)} → <b>{formatVND(newTotal)}</b>
                  </div>
                )}
              </div>
            </div>

            <div className="full">
              <div style={{ border: '1px dashed #9ca3af', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  File PDF của thông báo điều chỉnh (không bắt buộc, tối đa {MAX_BIG_PDF_MB}MB)
                </div>
                <div className="form-grid">
                  <div className="full">
                    <input key={fileKey} type="file" accept="application/pdf,.pdf" onChange={onPickFile} disabled={saving} />
                  </div>
                  {file && (
                    <div className="full">
                      <label htmlFor="adj_doc">Tên tài liệu *</label>
                      <input
                        id="adj_doc"
                        type="text"
                        value={docName}
                        disabled={saving}
                        onChange={(e) => setDocName(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? (file && pct > 0 ? 'Đang tải PDF ' + pct + '%...' : 'Đang lưu...') : 'Lưu thông báo điều chỉnh'}
            </button>
            <button className="btn" type="button" disabled={saving} onClick={() => setOpen(false)}>
              Hủy
            </button>
          </div>
          <div className="hint">
            Sau khi lưu, ngân sách và thời gian chạy của chương trình được cập nhật theo thông báo điều chỉnh và các cảnh
            báo tính theo số mới. Chi phí đã nhập được giữ nguyên.
          </div>
        </form>
      )}
    </div>
  );
}

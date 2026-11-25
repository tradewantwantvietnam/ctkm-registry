'use client';

import { useMemo, useState } from 'react';
import { readTable, guessColumns, colLabel } from '@/lib/infoImport';

const PREVIEW_MAX = 200;

/*
  Khối tải file dùng chung:
  - fields: định nghĩa cột cần nhận (key, label, required, exact, has)
  - convert(table, mapping, convertArg): chuyển các dòng của file thành dữ liệu kèm lỗi
  - columns: các cột hiện ở bảng kiểm tra
  - modes: các chế độ nhập (không bắt buộc)
  - onImport(validItems, mode, setProgress): gửi dữ liệu, trả về câu kết quả
*/
export default function ImportWizard({
  title,
  fields,
  convert,
  convertArg,
  columns,
  modes,
  onImport,
  disabled,
  note,
}) {
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState(null);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState(modes && modes.length ? modes[0].value : '');
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [onlyErr, setOnlyErr] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const items = useMemo(
    () => (table ? convert(table, mapping, convertArg) : []),
    [table, mapping, convert, convertArg]
  );

  const missing = fields.filter((f) => f.required && !(mapping[f.key] >= 0));
  const valid = items.filter((i) => i.loi.length === 0);
  const nErr = items.length - valid.length;
  const nWarn = valid.filter((i) => i.canh_bao && i.canh_bao.length > 0).length;

  const shown = (onlyErr ? items.filter((i) => i.loi.length > 0 || (i.canh_bao && i.canh_bao.length)) : items).slice(
    0,
    PREVIEW_MAX
  );

  async function onPick(e) {
    const f = e.target.files && e.target.files[0];
    setError('');
    setResult('');
    if (!f) return;
    setReading(true);
    try {
      const t = await readTable(f);
      setTable(t);
      setMapping(guessColumns(t.headers, fields));
    } catch (err) {
      setTable(null);
      setError(err.message);
    }
    setReading(false);
  }

  function reset() {
    setTable(null);
    setMapping({});
    setFileKey((k) => k + 1);
  }

  async function doImport() {
    if (valid.length === 0 || missing.length > 0) return;
    const m = modes ? modes.find((x) => x.value === mode) : null;
    const msg = (m && m.confirm ? m.confirm : 'Nhập {n} dòng hợp lệ?').replace('{n}', String(valid.length));
    if (!window.confirm(msg)) return;

    setBusy(true);
    setError('');
    setResult('');
    try {
      const text = await onImport(valid, mode, setProgress);
      setResult(text);
      reset();
    } catch (err) {
      setError(err.message);
    }
    setProgress('');
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Thu gọn' : 'Tải file lên'}
        </button>
      </div>

      {result && (
        <div className="alert alert-ok" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          {result}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          {note && <div className="hint" style={{ marginBottom: 8 }}>{note}</div>}
          <div className="hint" style={{ marginBottom: 8 }}>
            Đọc sheet đầu tiên của file Excel (.xlsx) hoặc CSV, dòng đầu là tiêu đề. Cột được nhận tự động theo tên
            tiêu đề, bạn có thể đổi ở bước kiểm tra.
          </div>

          {disabled ? (
            <div className="alert alert-warn">Hãy chọn tháng hợp lệ trước khi tải file.</div>
          ) : (
            <input
              key={fileKey}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={onPick}
              disabled={reading || busy}
            />
          )}
          {reading && <div className="hint">Đang đọc file...</div>}
          {error && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}

          {table && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ marginBottom: 8 }}>
                File: <b>{table.fileName}</b> (sheet "{table.sheetName}"), {table.rows.length} dòng dữ liệu.
              </div>

              <div style={{ fontWeight: 600, marginBottom: 6 }}>Cột trong file ứng với từng thông tin</div>
              <div className="form-grid">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label>
                      {f.label}
                      {f.required ? ' *' : ''}
                    </label>
                    <select
                      value={mapping[f.key] !== undefined ? mapping[f.key] : -1}
                      disabled={busy}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                    >
                      <option value={-1}>(Không có)</option>
                      {table.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {colLabel(i)} - {h || '(trống)'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {missing.length > 0 && (
                <div className="alert alert-warn" style={{ marginTop: 10 }}>
                  Chưa chọn cột cho: {missing.map((f) => f.label).join(', ')}.
                </div>
              )}

              {modes && modes.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <label>Cách nhập</label>
                  {modes.map((m) => (
                    <div key={m.value}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                        <input
                          type="radio"
                          name="import_mode"
                          checked={mode === m.value}
                          onChange={() => setMode(m.value)}
                          disabled={busy}
                        />
                        {m.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <div className="stats" style={{ marginTop: 12 }}>
                <div className="stat">
                  <div className="stat-label">Số dòng trong file</div>
                  <div className="stat-value">{items.length}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Hợp lệ, sẽ nhập</div>
                  <div className="stat-value" style={{ color: '#16a34a' }}>
                    {valid.length}
                  </div>
                </div>
                <div className={'stat' + (nErr > 0 ? ' danger' : '')}>
                  <div className="stat-label">Lỗi, không nhập</div>
                  <div className="stat-value">{nErr}</div>
                </div>
                <div className={'stat' + (nWarn > 0 ? ' warn' : '')}>
                  <div className="stat-label">Hợp lệ nhưng cần xem lại</div>
                  <div className="stat-value">{nWarn}</div>
                </div>
              </div>

              <div className="row" style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || valid.length === 0 || missing.length > 0}
                  onClick={doImport}
                >
                  {busy ? 'Đang nhập...' : 'Nhập ' + valid.length + ' dòng hợp lệ'}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={reset}>
                  Chọn file khác
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 }}>
                  <input type="checkbox" checked={onlyErr} onChange={(e) => setOnlyErr(e.target.checked)} />
                  Chỉ hiện dòng lỗi hoặc cần xem lại
                </label>
                {busy && <span className="muted">{progress}</span>}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                      <th>Kết quả kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 1} className="muted" style={{ textAlign: 'center', padding: 18 }}>
                          Không có dòng nào để hiện
                        </td>
                      </tr>
                    )}
                    {shown.map((it) => (
                      <tr key={it.dong} className={it.loi.length > 0 ? 'row-danger' : ''}>
                        {columns.map((c) => (
                          <td key={c.key}>{it[c.key] === '' || it[c.key] === null ? '' : String(it[c.key])}</td>
                        ))}
                        <td>
                          {it.loi.length > 0 ? (
                            <div style={{ color: '#b91c1c' }}>
                              <span className="badge badge-danger">Lỗi</span> {it.loi.join('; ')}
                            </div>
                          ) : it.canh_bao && it.canh_bao.length > 0 ? (
                            <div style={{ color: '#b45309' }}>
                              <span className="badge badge-warn">Xem lại</span> {it.canh_bao.join('; ')}
                            </div>
                          ) : (
                            <span className="badge badge-ok">Hợp lệ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hint">
                Hiển thị {shown.length} dòng đầu. Thống kê và việc nhập tính trên toàn bộ file.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

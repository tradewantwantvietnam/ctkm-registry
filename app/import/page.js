'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate, formatMonth } from '@/lib/format';
import { buildTemplate, parseImportFile } from '@/lib/excel';

const BATCH = 20;

function key(s) {
  return String(s || '').trim().toLowerCase();
}

function budgetSummary(p) {
  const m = {};
  p.budgets.forEach((b) => {
    m[b.thang] = (m[b.thang] || 0) + b.ngan_sach;
  });
  return Object.keys(m)
    .sort()
    .map((t) => formatMonth(t) + ': ' + formatVND(m[t]))
    .join(' · ');
}

export default function ImportPage() {
  const [types, setTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [existing, setExisting] = useState({});
  const [ready, setReady] = useState(false);

  const [error, setError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);

  async function loadRef() {
    const [r, list] = await Promise.all([api('refs'), api('list')]);
    setTypes(r.types || []);
    setRegions(r.regions || []);
    const m = {};
    list.forEach((x) => {
      m[key(x.so_thong_bao)] = true;
    });
    setExisting(m);
  }

  useEffect(() => {
    loadRef()
      .then(() => setReady(true))
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
  }, []);

  const typeKeys = useMemo(() => {
    const s = {};
    types.forEach((t) => {
      s[key(t)] = true;
    });
    return s;
  }, [types]);

  const rows = useMemo(() => {
    if (!parsed) return [];
    return parsed.programs.map((p) => {
      let status = 'ok';
      if (p.loi.length > 0) status = 'loi';
      else if (existing[key(p.so_thong_bao)]) status = 'bo_qua';
      return { ...p, status: status };
    });
  }, [parsed, existing]);

  const nOk = rows.filter((r) => r.status === 'ok').length;
  const nSkip = rows.filter((r) => r.status === 'bo_qua').length;
  const nErr = rows.filter((r) => r.status === 'loi').length;
  const orphans = parsed ? parsed.orphans : [];

  async function onTemplate() {
    setError('');
    try {
      await buildTemplate(types, regions);
    } catch (e) {
      setError('Không tạo được file mẫu: ' + e.message);
    }
  }

  async function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    setError('');
    setResult(null);
    if (!f) return;

    setReading(true);
    try {
      const out = await parseImportFile(f, { regions: regions });
      setParsed(out);
      setFileName(f.name);
    } catch (err) {
      setParsed(null);
      setFileName('');
      setError(err.message);
    }
    setReading(false);
  }

  function onReset() {
    setParsed(null);
    setFileName('');
    setError('');
    setFileKey((k) => k + 1);
  }

  async function onImport() {
    const okRows = rows.filter((r) => r.status === 'ok');
    if (okRows.length === 0) return;

    const ok = window.confirm(
      'Nhập ' + okRows.length + ' chương trình vào hệ thống?' +
        (nSkip > 0 ? '\n\n' + nSkip + ' chương trình đã tồn tại sẽ được bỏ qua.' : '') +
        (nErr > 0 ? '\n' + nErr + ' chương trình lỗi sẽ không được nhập.' : '')
    );
    if (!ok) return;

    setError('');
    setResult(null);
    setImporting(true);

    let created = 0;
    const skipped = [];
    const errors = [];

    try {
      for (let i = 0; i < okRows.length; i += BATCH) {
        const batch = okRows.slice(i, i + BATCH);
        setProgress('Đang nhập ' + Math.min(i + BATCH, okRows.length) + '/' + okRows.length + '...');
        const out = await api('importV2', {
          data: {
            programs: batch.map((p) => ({
              dong: p.dong,
              so_thong_bao: p.so_thong_bao,
              ten: p.ten,
              hinh_thuc: p.hinh_thuc,
              ngay_bd: p.ngay_bd,
              ngay_kt: p.ngay_kt,
              noi_dung: p.noi_dung,
              ghi_chu: p.ghi_chu,
              budgets: p.budgets.map((b) => ({ thang: b.thang, vung: b.vung, ngan_sach: b.ngan_sach })),
              costs: p.costs.map((en) => ({
                kieu: en.kieu,
                ly_do: en.ly_do,
                tu_ngay: en.tu_ngay,
                den_ngay: en.den_ngay,
                ghi_chu: en.ghi_chu,
                items: en.items.map((it) => ({ thang: it.thang, vung: it.vung, so_tien: it.so_tien })),
              })),
            })),
          },
        });
        created += out.created;
        out.skipped.forEach((s) => skipped.push(s));
        out.errors.forEach((s) => errors.push(s));
      }
    } catch (e) {
      setError('Dừng giữa chừng: ' + e.message + '. Đã nhập thành công ' + created + ' chương trình trước đó.');
    }

    setResult({ created: created, skipped: skipped, errors: errors });
    setProgress('');
    setImporting(false);
    setParsed(null);
    setFileName('');
    setFileKey((k) => k + 1);
    try {
      await loadRef();
    } catch (e) {}
  }

  return (
    <div>
      <h1>Nhập chương trình từ Excel</h1>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>3 bước nhập hàng loạt</div>
        <ol style={{ margin: '0 0 14px 18px', padding: 0 }}>
          <li>
            Bấm <b>Xuất file mẫu</b> để tải file Excel đã soạn sẵn 3 sheet: Chương trình, Ngân sách, Chi phí (có hướng
            dẫn và ví dụ).
          </li>
          <li>Điền dữ liệu rồi lưu file lại. Sheet Chi phí không bắt buộc.</li>
          <li>
            Bấm <b>Tải file lên</b>, xem bảng kiểm tra, rồi bấm <b>Nhập</b> để ghi một lần.
          </li>
        </ol>

        <div className="row">
          <button className="btn btn-primary" onClick={onTemplate} disabled={!ready || importing}>
            Xuất file mẫu (Excel)
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="xl">Tải file đã điền lên (.xlsx)</label>
          <input
            key={fileKey}
            id="xl"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPickFile}
            disabled={!ready || reading || importing}
          />
          {reading && <div className="hint">Đang đọc file...</div>}
          <div className="hint">File điền theo mẫu cũ không dùng được, hãy xuất lại file mẫu mới.</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card">
          <h2>Kết quả nhập</h2>
          <div className={result.created > 0 ? 'alert alert-ok' : 'alert alert-warn'}>
            Đã nhập thành công <b>{result.created}</b> chương trình.
          </div>
          {result.skipped.length > 0 && (
            <div className="alert alert-warn">
              Bỏ qua {result.skipped.length}: {result.skipped.join('; ')}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="alert alert-error">
              Lỗi {result.errors.length}: {result.errors.join(' | ')}
            </div>
          )}
          <Link className="btn btn-primary" href="/">
            Xem danh sách chương trình
          </Link>
        </div>
      )}

      {parsed && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">File</div>
              <div className="stat-value" style={{ fontSize: 14, wordBreak: 'break-all' }}>
                {fileName}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Số chương trình trong file</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Hợp lệ, sẽ nhập</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>
                {nOk}
              </div>
            </div>
            <div className={'stat' + (nSkip > 0 ? ' warn' : '')}>
              <div className="stat-label">Bỏ qua (đã có trên hệ thống)</div>
              <div className="stat-value">{nSkip}</div>
            </div>
            <div className={'stat' + (nErr > 0 ? ' danger' : '')}>
              <div className="stat-label">Lỗi, không nhập</div>
              <div className="stat-value">{nErr}</div>
            </div>
          </div>

          {orphans.length > 0 && (
            <div className="alert alert-error">
              <b>Dòng không gắn được với chương trình nào ({orphans.length}):</b>
              <div>{orphans.slice(0, 20).join(' | ')}{orphans.length > 20 ? ' ...' : ''}</div>
            </div>
          )}

          <div className="row" style={{ marginBottom: 14 }}>
            <button className="btn btn-primary" onClick={onImport} disabled={importing || nOk === 0}>
              {importing ? 'Đang nhập...' : 'Nhập ' + nOk + ' chương trình hợp lệ'}
            </button>
            <button className="btn" onClick={onReset} disabled={importing}>
              Chọn file khác
            </button>
            {importing && <span className="muted">{progress}</span>}
          </div>

          {nErr > 0 && (
            <div className="alert alert-warn">
              Có {nErr} chương trình lỗi. Bạn có thể nhập trước các chương trình hợp lệ, rồi sửa phần lỗi trong Excel và
              tải lên lại. Hệ thống bỏ qua số thông báo đã có nên không bị nhập trùng.
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Hình thức</th>
                  <th>Thời gian chạy</th>
                  <th>Ngân sách theo tháng</th>
                  <th className="num">Khoản chi phí</th>
                  <th>Kết quả kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const newType = r.hinh_thuc && !typeKeys[key(r.hinh_thuc)];
                  const nItems = r.costs.reduce((s, en) => s + en.items.length, 0);
                  return (
                    <tr key={r.dong} className={r.status === 'loi' ? 'row-danger' : ''}>
                      <td>{r.dong}</td>
                      <td>{r.so_thong_bao}</td>
                      <td>{r.ten}</td>
                      <td>
                        {r.hinh_thuc}
                        {newType && (
                          <div>
                            <span className="badge badge-blue">Hình thức mới</span>
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.ngay_bd ? formatDate(r.ngay_bd) : '?'} - {r.ngay_kt ? formatDate(r.ngay_kt) : '?'}
                      </td>
                      <td style={{ minWidth: 200 }}>
                        {r.budgets.length === 0 ? <span className="muted">-</span> : budgetSummary(r)}
                        {r.newRegions.length > 0 && (
                          <div>
                            <span className="badge badge-blue">Vùng mới: {r.newRegions.join(', ')}</span>
                          </div>
                        )}
                      </td>
                      <td className="num">{nItems > 0 ? nItems : <span className="muted">-</span>}</td>
                      <td>
                        {r.status === 'ok' && <span className="badge badge-ok">Sẽ nhập</span>}
                        {r.status === 'bo_qua' && <span className="badge badge-gray">Bỏ qua (đã có)</span>}
                        {r.status === 'loi' && (
                          <div style={{ color: '#b91c1c' }}>
                            <span className="badge badge-danger">Lỗi</span>
                            {r.loi.map((l, i) => (
                              <div key={i} style={{ fontSize: 13 }}>
                                {l}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

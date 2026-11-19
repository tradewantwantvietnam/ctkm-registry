'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, getPdfBlob } from '@/lib/api';
import { formatVND, formatDate, formatSize, monthOf } from '@/lib/format';
import { StatusBadge, WarnBadge } from '@/components/Badges';
import { exportProgramsCSV, downloadBlob, todayTag } from '@/lib/export';

const STATUS_OPTIONS = ['Chưa chạy', 'Đang chạy', 'Đã kết thúc', 'Đã quyết toán'];

function safe(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'khong-ten';
}

export default function ExportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [hinh, setHinh] = useState('');
  const [onlyPdf, setOnlyPdf] = useState(false);

  const [zipping, setZipping] = useState(false);
  const [progress, setProgress] = useState('');
  const cancelRef = useRef(false);

  useEffect(() => {
    api('list')
      .then((r) => {
        setRows(r);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const hinhOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.hinh_thuc) set.add(r.hinh_thuc);
    });
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kw) {
        const s = (r.so_thong_bao + ' ' + r.ten + ' ' + r.noi_dung).toLowerCase();
        if (!s.includes(kw)) return false;
      }
      if (month) {
        if (!(monthOf(r.ngay_bd) <= month && monthOf(r.ngay_kt) >= month)) return false;
      }
      if (status && r.trang_thai !== status) return false;
      if (hinh && r.hinh_thuc !== hinh) return false;
      if (onlyPdf && !r.co_pdf) return false;
      return true;
    });
  }, [rows, q, month, status, hinh, onlyPdf]);

  const withPdf = filtered.filter((r) => r.co_pdf);
  const totalFiles = filtered.reduce((s, r) => s + (r.so_pdf || 0), 0);
  const totalNS = filtered.reduce((s, r) => s + r.ngan_sach, 0);
  const totalCP = filtered.reduce((s, r) => s + r.chi_phi, 0);

  function resetFilters() {
    setQ('');
    setMonth('');
    setStatus('');
    setHinh('');
    setOnlyPdf(false);
  }

  function onExportCSV() {
    setError('');
    setMsg('');
    const tag = month ? month.replace('-', '') : todayTag();
    exportProgramsCSV(filtered, 'trich_luc_ctkm_' + tag + '.csv');
    setMsg('Đã xuất ' + filtered.length + ' chương trình. Mở bằng Excel.');
  }

  async function onZip() {
    setError('');
    setMsg('');
    if (withPdf.length === 0) {
      setError('Không có chương trình nào có file PDF trong kết quả đang lọc');
      return;
    }

    cancelRef.current = false;
    setZipping(true);
    const failed = [];
    let added = 0;

    try {
      setProgress('Đang lấy danh sách file...');
      const all = await api('listAllFiles');
      const byProg = {};
      all.forEach((f) => {
        const k = String(f.so_thong_bao).trim().toLowerCase();
        (byProg[k] = byProg[k] || []).push(f);
      });

      const jobs = [];
      withPdf.forEach((p) => {
        (byProg[String(p.so_thong_bao).trim().toLowerCase()] || []).forEach((f) => {
          jobs.push({ p: p, f: f });
        });
      });

      if (jobs.length === 0) {
        setError('Không tìm thấy file PDF nào để tải');
        return;
      }

      const totalBytes = jobs.reduce((s, j) => s + j.f.kich_thuoc, 0);
      if (totalBytes > 100 * 1024 * 1024) {
        const ok = window.confirm(
          'Tổng dung lượng khoảng ' + formatSize(totalBytes) + ' (' + jobs.length + ' file), có thể mất vài phút và tốn bộ nhớ. Tiếp tục?'
        );
        if (!ok) return;
      }

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = {};

      for (let i = 0; i < jobs.length; i++) {
        if (cancelRef.current) break;
        const job = jobs[i];
        const label = job.p.so_thong_bao + ' - ' + job.f.ten_hien_thi;
        setProgress('Đang tải file ' + (i + 1) + '/' + jobs.length + ': ' + label);
        try {
          const got = await getPdfBlob(job.f.file_id, (pc) =>
            setProgress('Đang tải file ' + (i + 1) + '/' + jobs.length + ' (' + pc + '%): ' + label)
          );
          const folder = safe(job.p.so_thong_bao);
          const name = safe(job.f.loai_tai_lieu) + ' - ' + safe(job.f.ten_hien_thi) + '.pdf';
          let path = folder + '/' + name;
          if (used[path]) path = folder + '/' + (i + 1) + '_' + name;
          used[path] = true;
          zip.file(path, got.blob);
          added++;
        } catch (e) {
          failed.push(label);
        }
      }

      if (cancelRef.current) {
        setMsg('Đã hủy tải gói PDF');
      } else if (added === 0) {
        setError('Không tải được file PDF nào');
      } else {
        setProgress('Đang nén file...');
        const blob = await zip.generateAsync({ type: 'blob' });
        const tag = month ? month.replace('-', '') : todayTag();
        downloadBlob(blob, 'pdf_ctkm_' + tag + '.zip');
        setMsg(
          'Đã tải gói ' + added + ' file PDF' +
            (failed.length > 0 ? '. Không tải được: ' + failed.join('; ') : '')
        );
      }
    } catch (e) {
      setError('Lỗi khi tạo gói PDF: ' + e.message);
    } finally {
      setProgress('');
      setZipping(false);
    }
  }

  return (
    <div>
      <h1>Trích lục chương trình khuyến mãi</h1>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="grow">
            <label htmlFor="q">Tìm kiếm</label>
            <input
              id="q"
              type="search"
              placeholder="Số thông báo, tên, nội dung..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="month">Tháng chạy</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label htmlFor="status">Trạng thái</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hinh">Hình thức KM</label>
            <select id="hinh" value={hinh} onChange={(e) => setHinh(e.target.value)}>
              <option value="">Tất cả</option>
              {hinhOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>
              <input type="checkbox" checked={onlyPdf} onChange={(e) => setOnlyPdf(e.target.checked)} /> Chỉ chương
              trình có PDF
            </label>
          </div>
          <div>
            <button className="btn" onClick={resetFilters}>
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Kết quả trích lục</div>
          <div className="stat-value">{filtered.length} chương trình</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tổng số file PDF</div>
          <div className="stat-value">{totalFiles}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tổng ngân sách A&P</div>
          <div className="stat-value">{formatVND(totalNS)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tổng chi phí đã nhập</div>
          <div className="stat-value">{formatVND(totalCP)}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={onExportCSV} disabled={filtered.length === 0 || zipping}>
          Xuất danh sách ra Excel
        </button>
        <button className="btn btn-primary" onClick={onZip} disabled={withPdf.length === 0 || zipping}>
          Tải gói PDF scan (ZIP, {totalFiles} file)
        </button>
        {zipping && (
          <>
            <span className="muted">{progress}</span>
            <button className="btn btn-small btn-danger" onClick={() => (cancelRef.current = true)}>
              Hủy
            </button>
          </>
        )}
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
                <th className="num">Ngân sách A&P</th>
                <th className="num">Chi phí</th>
                <th>Trạng thái</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    Không có chương trình nào
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.so_thong_bao}>
                  <td>
                    <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>{r.so_thong_bao}</Link>
                  </td>
                  <td>{r.ten}</td>
                  <td>{r.hinh_thuc}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                  </td>
                  <td className="num">{formatVND(r.ngan_sach)}</td>
                  <td className="num">
                    {r.loai_chi_phi ? (
                      <div>
                        <div>{formatVND(r.chi_phi)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.loai_chi_phi}
                        </div>
                      </div>
                    ) : (
                      <span className="muted">Chưa có</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <StatusBadge status={r.trang_thai} />
                      {r.canh_bao !== 'binh_thuong' && <WarnBadge level={r.canh_bao} />}
                    </div>
                  </td>
                  <td>{r.so_pdf > 0 ? '📄 ' + r.so_pdf : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

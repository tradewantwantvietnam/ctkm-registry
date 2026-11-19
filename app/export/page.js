'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate, monthOf } from '@/lib/format';
import { StatusBadge, WarnBadge } from '@/components/Badges';
import { exportProgramsCSV, downloadBlob, todayTag } from '@/lib/export';

const STATUS_OPTIONS = ['Chưa chạy', 'Đang chạy', 'Đã kết thúc', 'Đã quyết toán'];

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
    if (withPdf.length > 30) {
      const ok = window.confirm(
        'Có ' + withPdf.length + ' file PDF, việc tải có thể mất vài phút. Tiếp tục?'
      );
      if (!ok) return;
    }

    cancelRef.current = false;
    setZipping(true);
    const failed = [];
    let added = 0;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = {};

      for (let i = 0; i < withPdf.length; i++) {
        if (cancelRef.current) break;
        const r = withPdf[i];
        setProgress('Đang tải ' + (i + 1) + '/' + withPdf.length + ': ' + r.so_thong_bao);
        try {
          const d = await api('getPdf', { id: r.so_thong_bao });
          let name = d.file_name || r.so_thong_bao + '.pdf';
          if (used[name]) name = (i + 1) + '_' + name;
          used[name] = true;
          zip.file(name, d.base64, { base64: true });
          added++;
        } catch (e) {
          failed.push(r.so_thong_bao);
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
            (failed.length > 0 ? '. Không tải được: ' + failed.join(', ') : '')
        );
      }
    } catch (e) {
      setError('Lỗi khi tạo gói PDF: ' + e.message);
    }

    setProgress('');
    setZipping(false);
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
            <input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
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
              <input
                type="checkbox"
                checked={onlyPdf}
                onChange={(e) => setOnlyPdf(e.target.checked)}
              />{' '}
              Chỉ chương trình có PDF
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
          <div className="stat-label">Có file PDF</div>
          <div className="stat-value">{withPdf.length}</div>
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
        <button
          className="btn btn-primary"
          onClick={onExportCSV}
          disabled={filtered.length === 0 || zipping}
        >
          Xuất danh sách ra Excel
        </button>
        <button
          className="btn btn-primary"
          onClick={onZip}
          disabled={withPdf.length === 0 || zipping}
        >
          Tải gói PDF scan (ZIP, {withPdf.length} file)
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
                    <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>
                      {r.so_thong_bao}
                    </Link>
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
                  <td>{r.co_pdf ? '📄' : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

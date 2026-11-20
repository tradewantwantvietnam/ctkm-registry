'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate, formatMonth, monthOf, TRE_NGAY } from '@/lib/format';
import { WarnBadge, StatusBadge, Progress } from '@/components/Badges';

const STATUS_OPTIONS = ['Chưa chạy', 'Đang chạy', 'Đã kết thúc', 'Đã quyết toán'];

// Số liệu hiệu lực của một chương trình: theo tháng đang lọc, hoặc cả chương trình nếu không lọc tháng
function eff(r, month) {
  if (month) {
    const m = (r.thang_ds || []).find((x) => x.thang === month);
    if (m) {
      return {
        ngan_sach: m.ngan_sach,
        chi_phi: m.chi_phi,
        ty_le: m.ty_le,
        canh_bao: m.canh_bao,
        so_ngay_tre: m.so_ngay_tre,
        co_chi_phi: m.co_chi_phi,
        loai: m.da_chot ? 'Chốt' : m.co_chi_phi ? 'Tạm tính' : '',
      };
    }
  }
  return {
    ngan_sach: r.ngan_sach,
    chi_phi: r.chi_phi,
    ty_le: r.ty_le,
    canh_bao: r.canh_bao,
    so_ngay_tre: r.so_ngay_tre,
    co_chi_phi: r.co_chi_phi,
    loai: r.loai_chi_phi,
  };
}

function inMonth(r, month) {
  if (!month) return true;
  if (r.thang_ds && r.thang_ds.length) return r.thang_ds.some((m) => m.thang === month);
  return monthOf(r.ngay_bd) <= month && monthOf(r.ngay_kt) >= month;
}

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [hinh, setHinh] = useState('');
  const [warn, setWarn] = useState('');

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

  // Lọc theo các điều kiện (chưa tính lọc cảnh báo, để đếm số liệu cho các ô cảnh báo)
  const base = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (kw) {
          const s = (r.so_thong_bao + ' ' + r.ten + ' ' + r.noi_dung).toLowerCase();
          if (!s.includes(kw)) return false;
        }
        if (!inMonth(r, month)) return false;
        if (status && r.trang_thai !== status) return false;
        if (hinh && r.hinh_thuc !== hinh) return false;
        return true;
      })
      .map((r) => ({ r: r, e: eff(r, month) }));
  }, [rows, q, month, status, hinh]);

  const filtered = useMemo(() => {
    if (!warn) return base;
    if (warn === 'tre') return base.filter((x) => x.e.so_ngay_tre >= TRE_NGAY);
    return base.filter((x) => x.e.canh_bao === warn);
  }, [base, warn]);

  const totalNS = filtered.reduce((s, x) => s + x.e.ngan_sach, 0);
  const totalCP = filtered.reduce((s, x) => s + x.e.chi_phi, 0);
  const nSap = base.filter((x) => x.e.canh_bao === 'sap_vuot').length;
  const nVuot = base.filter((x) => x.e.canh_bao === 'vuot').length;
  const nTre = base.filter((x) => x.e.so_ngay_tre >= TRE_NGAY).length;

  function toggleWarn(level) {
    setWarn((w) => (w === level ? '' : level));
  }

  function resetFilters() {
    setQ('');
    setMonth('');
    setStatus('');
    setHinh('');
    setWarn('');
  }

  const monthLabel = month ? ' ' + formatMonth(month) : '';

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Danh sách chương trình khuyến mãi</h1>
        <div className="row">
          <Link href="/import" className="btn">
            Nhập từ Excel
          </Link>
          <Link href="/new" className="btn btn-primary">
            + Thêm chương trình
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Số chương trình (đang lọc)</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tổng ngân sách A&P{monthLabel}</div>
          <div className="stat-value">{formatVND(totalNS)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tổng chi phí đã nhập{monthLabel}</div>
          <div className="stat-value">{formatVND(totalCP)}</div>
        </div>
        <div
          className={'stat clickable' + (nSap > 0 ? ' warn' : '')}
          onClick={() => toggleWarn('sap_vuot')}
          title="Bấm để lọc"
        >
          <div className="stat-label">Sắp vượt ngân sách (từ 80%) {warn === 'sap_vuot' ? '- đang lọc' : ''}</div>
          <div className="stat-value">{nSap} chương trình</div>
        </div>
        <div
          className={'stat clickable' + (nVuot > 0 ? ' danger' : '')}
          onClick={() => toggleWarn('vuot')}
          title="Bấm để lọc"
        >
          <div className="stat-label">Vượt ngân sách {warn === 'vuot' ? '- đang lọc' : ''}</div>
          <div className="stat-value">{nVuot} chương trình</div>
        </div>
        <div
          className={'stat clickable' + (nTre > 0 ? ' warn' : '')}
          onClick={() => toggleWarn('tre')}
          title="Bấm để lọc"
        >
          <div className="stat-label">
            Quá hạn quyết toán (hơn {TRE_NGAY} ngày) {warn === 'tre' ? '- đang lọc' : ''}
          </div>
          <div className="stat-value">{nTre} chương trình</div>
        </div>
      </div>

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
            <label htmlFor="month">Tháng (xem số liệu của tháng)</label>
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
            <button className="btn" onClick={resetFilters}>
              Xóa lọc
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
                <th>Số thông báo</th>
                <th>Tên chương trình</th>
                <th>Hình thức</th>
                <th>Thời gian chạy</th>
                <th className="num">Ngân sách{monthLabel || ' A&P'}</th>
                <th className="num">Chi phí{monthLabel}</th>
                <th>Sử dụng</th>
                <th>Trạng thái</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    Không có chương trình nào
                  </td>
                </tr>
              )}
              {filtered.map(({ r, e }) => {
                const hasCost = e.co_chi_phi;
                const rowCls = e.canh_bao === 'vuot' ? 'row-danger' : e.canh_bao === 'sap_vuot' ? 'row-warn' : '';
                const months = month ? (r.thang_ds || []).filter((m) => m.thang === month) : r.thang_ds || [];
                return (
                  <tr key={r.so_thong_bao} className={rowCls}>
                    <td>
                      <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>{r.so_thong_bao}</Link>
                    </td>
                    <td>{r.ten}</td>
                    <td>{r.hinh_thuc}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                    </td>
                    <td className="num">{formatVND(e.ngan_sach)}</td>
                    <td className="num">
                      {hasCost ? (
                        <div>
                          <div>{formatVND(e.chi_phi)}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {e.loai}
                          </div>
                        </div>
                      ) : (
                        <span className="muted">Chưa có</span>
                      )}
                    </td>
                    <td>
                      {hasCost ? <Progress ratio={e.ty_le} level={e.canh_bao} /> : <span className="muted">-</span>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <StatusBadge status={r.trang_thai} />
                        {months.length === 0 && e.canh_bao !== 'binh_thuong' && <WarnBadge level={e.canh_bao} />}
                        {months.map((m) => (
                          <span key={m.thang} style={{ display: 'contents' }}>
                            {m.canh_bao === 'vuot' && (
                              <span className="badge badge-danger">{formatMonth(m.thang)} vượt</span>
                            )}
                            {m.canh_bao === 'sap_vuot' && (
                              <span className="badge badge-warn">{formatMonth(m.thang)} sắp vượt</span>
                            )}
                            {m.so_ngay_tre >= TRE_NGAY && (
                              <span className="badge badge-warn">
                                {formatMonth(m.thang)} quá hạn QT {m.so_ngay_tre} ngày
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{r.so_pdf > 0 ? '📄 ' + r.so_pdf : <span className="muted">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight: 700 }}>
                    Tổng ({filtered.length} chương trình)
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatVND(totalNS)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatVND(totalCP)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

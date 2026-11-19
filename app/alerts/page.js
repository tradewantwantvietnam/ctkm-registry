'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate, formatPercent, TRE_NGAY } from '@/lib/format';
import { StatusBadge, Progress } from '@/components/Badges';
import { exportProgramsCSV, todayTag } from '@/lib/export';

export default function AlertsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const over = useMemo(
    () => rows.filter((r) => r.canh_bao === 'vuot').sort((a, b) => b.so_tien_vuot - a.so_tien_vuot),
    [rows]
  );

  const near = useMemo(
    () => rows.filter((r) => r.canh_bao === 'sap_vuot').sort((a, b) => b.ty_le - a.ty_le),
    [rows]
  );

  const late = useMemo(
    () => rows.filter((r) => r.so_ngay_tre >= TRE_NGAY).sort((a, b) => b.so_ngay_tre - a.so_ngay_tre),
    [rows]
  );

  const totalOver = over.reduce((s, r) => s + r.so_tien_vuot, 0);
  const totalOverBudget = over.reduce((s, r) => s + r.ngan_sach, 0);
  const totalOverCost = over.reduce((s, r) => s + r.chi_phi, 0);

  return (
    <div>
      <h1>Báo động ngân sách và quyết toán</h1>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="stats">
            <div className={'stat' + (over.length > 0 ? ' danger' : '')}>
              <div className="stat-label">Chương trình vượt ngân sách</div>
              <div className="stat-value">{over.length}</div>
            </div>
            <div className={'stat' + (over.length > 0 ? ' danger' : '')}>
              <div className="stat-label">Tổng số tiền vượt</div>
              <div className="stat-value">{formatVND(totalOver)}</div>
            </div>
            <div className={'stat' + (near.length > 0 ? ' warn' : '')}>
              <div className="stat-label">Sắp vượt (từ 80% đến 100%)</div>
              <div className="stat-value">{near.length}</div>
            </div>
            <div className={'stat' + (late.length > 0 ? ' warn' : '')}>
              <div className="stat-label">Quá hạn quyết toán (hơn {TRE_NGAY} ngày)</div>
              <div className="stat-value">{late.length}</div>
            </div>
          </div>

          {/* ===== ĐÃ VƯỢT ===== */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: '#b91c1c' }}>Đã vượt ngân sách</h2>
            <button
              className="btn"
              disabled={over.length === 0}
              onClick={() => exportProgramsCSV(over, 'vuot_ngan_sach_' + todayTag() + '.csv')}
            >
              Xuất Excel danh sách vượt
            </button>
          </div>

          <div className="table-wrap" style={{ marginBottom: 28 }}>
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Thời gian chạy</th>
                  <th className="num">Ngân sách A&P</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Số tiền vượt</th>
                  <th className="num">Tỷ lệ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {over.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào vượt ngân sách
                    </td>
                  </tr>
                )}
                {over.map((r) => (
                  <tr key={r.so_thong_bao} className="row-danger">
                    <td>
                      <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>{r.so_thong_bao}</Link>
                    </td>
                    <td>{r.ten}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                    </td>
                    <td className="num">{formatVND(r.ngan_sach)}</td>
                    <td className="num">
                      {formatVND(r.chi_phi)}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.loai_chi_phi}
                      </div>
                    </td>
                    <td className="num" style={{ color: '#b91c1c', fontWeight: 700 }}>
                      {formatVND(r.so_tien_vuot)}
                    </td>
                    <td className="num" style={{ color: '#b91c1c', fontWeight: 700 }}>
                      {formatPercent(r.ty_le)}
                    </td>
                    <td>
                      <StatusBadge status={r.trang_thai} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {over.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>
                      Tổng ({over.length} chương trình)
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(totalOverBudget)}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(totalOverCost)}
                    </td>
                    <td className="num" style={{ fontWeight: 700, color: '#b91c1c' }}>
                      {formatVND(totalOver)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ===== SẮP VƯỢT ===== */}
          <h2 style={{ color: '#b45309' }}>Sắp vượt ngân sách (từ 80%)</h2>
          <div className="table-wrap" style={{ marginBottom: 28 }}>
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Thời gian chạy</th>
                  <th className="num">Ngân sách A&P</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Còn lại</th>
                  <th>Sử dụng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {near.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào sắp vượt
                    </td>
                  </tr>
                )}
                {near.map((r) => (
                  <tr key={r.so_thong_bao} className="row-warn">
                    <td>
                      <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>{r.so_thong_bao}</Link>
                    </td>
                    <td>{r.ten}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                    </td>
                    <td className="num">{formatVND(r.ngan_sach)}</td>
                    <td className="num">
                      {formatVND(r.chi_phi)}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.loai_chi_phi}
                      </div>
                    </td>
                    <td className="num">{formatVND(r.ngan_sach - r.chi_phi)}</td>
                    <td>
                      <Progress ratio={r.ty_le} level={r.canh_bao} />
                    </td>
                    <td>
                      <StatusBadge status={r.trang_thai} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== QUÁ HẠN QUYẾT TOÁN ===== */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ margin: 0, color: '#b45309' }}>Quá hạn quyết toán</h2>
            <div className="row">
              <Link className="btn btn-primary" href="/settle">
                Đi tới trang Quyết toán
              </Link>
              <button
                className="btn"
                disabled={late.length === 0}
                onClick={() => exportProgramsCSV(late, 'qua_han_quyet_toan_' + todayTag() + '.csv')}
              >
                Xuất Excel
              </button>
            </div>
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Chương trình đã kết thúc quá {TRE_NGAY} ngày mà chưa chốt chi phí (chưa nhập hoặc mới ở mức "Tạm tính").
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Ngày kết thúc</th>
                  <th className="num">Số ngày trễ</th>
                  <th className="num">Ngân sách A&P</th>
                  <th className="num">Chi phí hiện có</th>
                </tr>
              </thead>
              <tbody>
                {late.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào quá hạn quyết toán
                    </td>
                  </tr>
                )}
                {late.map((r) => (
                  <tr key={r.so_thong_bao} className="row-warn">
                    <td>
                      <Link href={'/program?id=' + encodeURIComponent(r.so_thong_bao)}>{r.so_thong_bao}</Link>
                    </td>
                    <td>{r.ten}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.ngay_kt)}</td>
                    <td className="num" style={{ color: '#b45309', fontWeight: 700 }}>
                      {r.so_ngay_tre} ngày
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
                        <span className="muted">Chưa nhập</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

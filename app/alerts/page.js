'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVND, formatDate, formatMonth, formatPercent, TRE_NGAY } from '@/lib/format';
import { Progress } from '@/components/Badges';
import { exportMonthRowsCSV, todayTag } from '@/lib/export';

function toExport(list) {
  return list.map((x) => ({
    so_thong_bao: x.so_thong_bao,
    ten: x.ten,
    hinh_thuc: x.hinh_thuc,
    thang: x.thang,
    vung: 'Tất cả vùng',
    ngan_sach: x.ngan_sach,
    chi_phi: x.chi_phi,
    co_chi_phi: x.co_chi_phi,
    ty_le: x.ty_le,
    so_tien_vuot: x.so_tien_vuot,
    canh_bao: x.canh_bao,
    da_chot: x.da_chot,
    so_ngay_tre: x.so_ngay_tre,
  }));
}

function ProgLink({ x }) {
  return <Link href={'/program?id=' + encodeURIComponent(x.so_thong_bao)}>{x.so_thong_bao}</Link>;
}

function CostCell({ x }) {
  if (!x.co_chi_phi) return <span className="muted">Chưa nhập</span>;
  return (
    <div>
      <div>{formatVND(x.chi_phi)}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {x.da_chot ? 'Đã chốt' : 'Tạm tính'}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');

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

  // Mỗi dòng là một tháng của một chương trình
  const flat = useMemo(() => {
    const out = [];
    rows.forEach((p) =>
      (p.thang_ds || []).forEach((m) =>
        out.push({
          ...m,
          so_thong_bao: p.so_thong_bao,
          ten: p.ten,
          hinh_thuc: p.hinh_thuc,
          ngay_kt: p.ngay_kt,
        })
      )
    );
    return out;
  }, [rows]);

  const monthOptions = useMemo(() => {
    const s = new Set();
    flat.forEach((x) => s.add(x.thang));
    return Array.from(s).sort().reverse();
  }, [flat]);

  const scoped = useMemo(() => (month ? flat.filter((x) => x.thang === month) : flat), [flat, month]);

  const over = useMemo(
    () => scoped.filter((x) => x.canh_bao === 'vuot').sort((a, b) => b.so_tien_vuot - a.so_tien_vuot),
    [scoped]
  );
  const near = useMemo(
    () => scoped.filter((x) => x.canh_bao === 'sap_vuot').sort((a, b) => b.ty_le - a.ty_le),
    [scoped]
  );
  const late = useMemo(
    () => scoped.filter((x) => x.so_ngay_tre >= TRE_NGAY).sort((a, b) => b.so_ngay_tre - a.so_ngay_tre),
    [scoped]
  );

  const totalOver = over.reduce((s, x) => s + x.so_tien_vuot, 0);
  const totalOverBudget = over.reduce((s, x) => s + x.ngan_sach, 0);
  const totalOverCost = over.reduce((s, x) => s + x.chi_phi, 0);
  const tag = (month ? month.replace('-', '') + '_' : '') + todayTag();

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Báo động ngân sách và quyết toán</h1>
        <div>
          <label htmlFor="month">Lọc theo tháng</label>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Tất cả các tháng</option>
            {monthOptions.map((t) => (
              <option key={t} value={t}>
                {formatMonth(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="stats">
            <div className={'stat' + (over.length > 0 ? ' danger' : '')}>
              <div className="stat-label">Tháng vượt ngân sách</div>
              <div className="stat-value">{over.length}</div>
            </div>
            <div className={'stat' + (over.length > 0 ? ' danger' : '')}>
              <div className="stat-label">Tổng số tiền vượt</div>
              <div className="stat-value">{formatVND(totalOver)}</div>
            </div>
            <div className={'stat' + (near.length > 0 ? ' warn' : '')}>
              <div className="stat-label">Tháng sắp vượt (từ 80%)</div>
              <div className="stat-value">{near.length}</div>
            </div>
            <div className={'stat' + (late.length > 0 ? ' warn' : '')}>
              <div className="stat-label">Tháng quá hạn quyết toán (hơn {TRE_NGAY} ngày)</div>
              <div className="stat-value">{late.length}</div>
            </div>
          </div>

          {/* ===== ĐÃ VƯỢT ===== */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: '#b91c1c' }}>Đã vượt ngân sách</h2>
            <button
              className="btn"
              disabled={over.length === 0}
              onClick={() => exportMonthRowsCSV(toExport(over), 'vuot_ngan_sach_' + tag + '.csv')}
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
                  <th>Tháng</th>
                  <th className="num">Ngân sách tháng</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Số tiền vượt</th>
                  <th className="num">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {over.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có tháng nào vượt ngân sách
                    </td>
                  </tr>
                )}
                {over.map((x) => (
                  <tr key={x.so_thong_bao + x.thang} className="row-danger">
                    <td>
                      <ProgLink x={x} />
                    </td>
                    <td>{x.ten}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMonth(x.thang)}</td>
                    <td className="num">{formatVND(x.ngan_sach)}</td>
                    <td className="num">
                      <CostCell x={x} />
                    </td>
                    <td className="num" style={{ color: '#b91c1c', fontWeight: 700 }}>
                      {formatVND(x.so_tien_vuot)}
                    </td>
                    <td className="num" style={{ color: '#b91c1c', fontWeight: 700 }}>
                      {formatPercent(x.ty_le)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {over.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>
                      Tổng ({over.length} tháng)
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
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ===== SẮP VƯỢT ===== */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: '#b45309' }}>Sắp vượt ngân sách (từ 80%)</h2>
            <button
              className="btn"
              disabled={near.length === 0}
              onClick={() => exportMonthRowsCSV(toExport(near), 'sap_vuot_' + tag + '.csv')}
            >
              Xuất Excel
            </button>
          </div>
          <div className="table-wrap" style={{ marginBottom: 28 }}>
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Tháng</th>
                  <th className="num">Ngân sách tháng</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Còn lại</th>
                  <th>Sử dụng</th>
                </tr>
              </thead>
              <tbody>
                {near.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có tháng nào sắp vượt
                    </td>
                  </tr>
                )}
                {near.map((x) => (
                  <tr key={x.so_thong_bao + x.thang} className="row-warn">
                    <td>
                      <ProgLink x={x} />
                    </td>
                    <td>{x.ten}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMonth(x.thang)}</td>
                    <td className="num">{formatVND(x.ngan_sach)}</td>
                    <td className="num">
                      <CostCell x={x} />
                    </td>
                    <td className="num">{formatVND(x.ngan_sach - x.chi_phi)}</td>
                    <td>
                      <Progress ratio={x.ty_le} level={x.canh_bao} />
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
                onClick={() => exportMonthRowsCSV(toExport(late), 'qua_han_quyet_toan_' + tag + '.csv')}
              >
                Xuất Excel
              </button>
            </div>
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Tháng đã kết thúc quá {TRE_NGAY} ngày mà chưa chốt đủ chi phí các vùng (chưa nhập hoặc mới ở mức "Tạm
            tính").
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Tháng</th>
                  <th className="num">Số ngày trễ</th>
                  <th className="num">Ngân sách tháng</th>
                  <th className="num">Chi phí hiện có</th>
                </tr>
              </thead>
              <tbody>
                {late.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có tháng nào quá hạn quyết toán
                    </td>
                  </tr>
                )}
                {late.map((x) => (
                  <tr key={x.so_thong_bao + x.thang} className="row-warn">
                    <td>
                      <ProgLink x={x} />
                    </td>
                    <td>{x.ten}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMonth(x.thang)}</td>
                    <td className="num" style={{ color: '#b45309', fontWeight: 700 }}>
                      {x.so_ngay_tre} ngày
                    </td>
                    <td className="num">{formatVND(x.ngan_sach)}</td>
                    <td className="num">
                      <CostCell x={x} />
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

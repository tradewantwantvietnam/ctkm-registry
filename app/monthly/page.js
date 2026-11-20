'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ALL_REGION, TRE_NGAY, formatMonth, formatVND, formatPercent } from '@/lib/format';
import { WarnBadge, Progress } from '@/components/Badges';
import { exportMonthRowsCSV } from '@/lib/export';

function curMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export default function MonthlyPage() {
  const [month, setMonth] = useState(curMonth());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hinh, setHinh] = useState('');
  const [showRegions, setShowRegions] = useState(false);
  const [onlyWarn, setOnlyWarn] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    let alive = true;
    setLoading(true);
    setError('');
    api('getMonth', { data: { thang: month } })
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [month]);

  const hinhOptions = useMemo(() => {
    const s = new Set();
    rows.forEach((p) => {
      if (p.hinh_thuc) s.add(p.hinh_thuc);
    });
    return Array.from(s);
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((p) => {
        if (hinh && p.hinh_thuc !== hinh) return false;
        if (onlyWarn && p.thang.canh_bao === 'binh_thuong' && p.thang.so_ngay_tre < TRE_NGAY) return false;
        return true;
      }),
    [rows, hinh, onlyWarn]
  );

  const totalNS = filtered.reduce((s, p) => s + p.thang.ngan_sach, 0);
  const totalCP = filtered.reduce((s, p) => s + p.thang.chi_phi, 0);
  const nVuot = filtered.filter((p) => p.thang.canh_bao === 'vuot').length;
  const nSap = filtered.filter((p) => p.thang.canh_bao === 'sap_vuot').length;
  const nChua = filtered.filter((p) => !p.thang.da_chot).length;

  const regionSummary = useMemo(() => {
    const map = {};
    const order = [];
    filtered.forEach((p) =>
      p.thang.vung_ds.forEach((v) => {
        const k = v.vung.toLowerCase();
        if (!map[k]) {
          map[k] = { vung: v.vung, ns: 0, cp: 0, n: 0 };
          order.push(k);
        }
        map[k].ns += v.ngan_sach;
        map[k].cp += v.chi_phi;
        map[k].n++;
      })
    );
    return order.map((k) => map[k]);
  }, [filtered]);

  function onExport() {
    const out = [];
    filtered.forEach((p) => {
      const m = p.thang;
      const base = {
        so_thong_bao: p.so_thong_bao,
        ten: p.ten,
        hinh_thuc: p.hinh_thuc,
        thang: month,
        so_ngay_tre: m.so_ngay_tre,
      };
      if (showRegions) {
        m.vung_ds.forEach((v) =>
          out.push({
            ...base,
            vung: v.vung,
            ngan_sach: v.ngan_sach,
            chi_phi: v.chi_phi,
            co_chi_phi: v.co_chi_phi,
            ty_le: v.ty_le,
            so_tien_vuot: v.chi_phi > v.ngan_sach ? v.chi_phi - v.ngan_sach : 0,
            canh_bao: v.canh_bao,
            da_chot: v.da_chot,
          })
        );
      } else {
        const single = m.vung_ds.length === 1 ? m.vung_ds[0].vung : 'Tất cả vùng';
        out.push({
          ...base,
          vung: single,
          ngan_sach: m.ngan_sach,
          chi_phi: m.chi_phi,
          co_chi_phi: m.co_chi_phi,
          ty_le: m.ty_le,
          so_tien_vuot: m.so_tien_vuot,
          canh_bao: m.canh_bao,
          da_chot: m.da_chot,
        });
      }
    });
    exportMonthRowsCSV(out, 'theo_doi_' + month.replace('-', '') + '.csv');
  }

  const inlineLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 };

  return (
    <div>
      <h1>Theo dõi chi phí theo tháng</h1>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <label htmlFor="month">Tháng</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
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
            <label style={inlineLabel}>
              <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
              Hiện chi tiết theo vùng
            </label>
          </div>
          <div>
            <label style={inlineLabel}>
              <input type="checkbox" checked={onlyWarn} onChange={(e) => setOnlyWarn(e.target.checked)} />
              Chỉ chương trình có cảnh báo
            </label>
          </div>
          <div>
            <button className="btn" onClick={onExport} disabled={filtered.length === 0}>
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Chương trình trong {formatMonth(month)}</div>
              <div className="stat-value">{filtered.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tổng ngân sách tháng</div>
              <div className="stat-value">{formatVND(totalNS)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tổng chi phí tháng</div>
              <div className="stat-value">{formatVND(totalCP)}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {totalNS > 0 ? 'Đã dùng ' + formatPercent(totalCP / totalNS) : ''}
              </div>
            </div>
            <div className={'stat' + (nVuot > 0 ? ' danger' : '')}>
              <div className="stat-label">Vượt ngân sách</div>
              <div className="stat-value">{nVuot}</div>
            </div>
            <div className={'stat' + (nSap > 0 ? ' warn' : '')}>
              <div className="stat-label">Sắp vượt (từ 80%)</div>
              <div className="stat-value">{nSap}</div>
            </div>
            <div className={'stat' + (nChua > 0 ? ' warn' : '')}>
              <div className="stat-label">Chưa chốt</div>
              <div className="stat-value">{nChua}</div>
            </div>
          </div>

          {regionSummary.length > 0 && (
            <div className="card">
              <h2>Tổng theo vùng miền - {formatMonth(month)}</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vùng</th>
                      <th className="num">Số chương trình</th>
                      <th className="num">Ngân sách</th>
                      <th className="num">Chi phí</th>
                      <th className="num">Còn lại</th>
                      <th>Sử dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionSummary.map((r) => {
                      const ratio = r.ns > 0 ? r.cp / r.ns : 0;
                      const lv = r.cp > r.ns && r.cp > 0 ? 'vuot' : ratio >= 0.8 ? 'sap_vuot' : 'binh_thuong';
                      return (
                        <tr key={r.vung}>
                          <td>{r.vung}</td>
                          <td className="num">{r.n}</td>
                          <td className="num">{formatVND(r.ns)}</td>
                          <td className="num">{formatVND(r.cp)}</td>
                          <td className="num" style={{ color: r.ns - r.cp < 0 ? '#b91c1c' : undefined }}>
                            {formatVND(r.ns - r.cp)}
                          </td>
                          <td>
                            <Progress ratio={ratio} level={lv} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="hint">
                Vùng "{ALL_REGION}" là các chương trình nhập ngân sách chung, không chia theo vùng.
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Hình thức</th>
                  <th className="num">Ngân sách</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Còn lại</th>
                  <th>Sử dụng</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào có ngân sách trong {formatMonth(month)}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const m = p.thang;
                  const regional = m.vung_ds.length > 1 || (m.vung_ds[0] && m.vung_ds[0].vung !== ALL_REGION);
                  const rowCls = m.canh_bao === 'vuot' ? 'row-danger' : m.canh_bao === 'sap_vuot' ? 'row-warn' : '';
                  const left = m.ngan_sach - m.chi_phi;
                  return (
                    <Fragment key={p.so_thong_bao}>
                      <tr className={rowCls}>
                        <td>
                          <Link href={'/program?id=' + encodeURIComponent(p.so_thong_bao)}>{p.so_thong_bao}</Link>
                        </td>
                        <td>{p.ten}</td>
                        <td>{p.hinh_thuc}</td>
                        <td className="num">{formatVND(m.ngan_sach)}</td>
                        <td className="num">
                          {m.co_chi_phi ? formatVND(m.chi_phi) : <span className="muted">Chưa có</span>}
                        </td>
                        <td className="num" style={{ color: left < 0 ? '#b91c1c' : undefined }}>
                          {formatVND(left)}
                        </td>
                        <td>
                          {m.co_chi_phi ? (
                            <Progress ratio={m.ty_le} level={m.canh_bao} />
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {m.da_chot ? (
                              <span className="badge badge-ok">Đã chốt</span>
                            ) : m.co_chi_phi ? (
                              <span className="badge badge-gray">Tạm tính</span>
                            ) : (
                              <span className="badge badge-gray">Chưa có chi phí</span>
                            )}
                            {m.canh_bao !== 'binh_thuong' && <WarnBadge level={m.canh_bao} />}
                            {m.so_ngay_tre >= TRE_NGAY && (
                              <span className="badge badge-warn">Trễ QT {m.so_ngay_tre} ngày</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {showRegions &&
                        regional &&
                        m.vung_ds.map((v) => {
                          const vLeft = v.ngan_sach - v.chi_phi;
                          return (
                            <tr key={p.so_thong_bao + '|' + v.vung} style={{ fontSize: 13 }}>
                              <td></td>
                              <td style={{ paddingLeft: 24 }}>{v.vung}</td>
                              <td></td>
                              <td className="num">{formatVND(v.ngan_sach)}</td>
                              <td className="num">
                                {v.co_chi_phi ? formatVND(v.chi_phi) : <span className="muted">-</span>}
                              </td>
                              <td className="num" style={{ color: vLeft < 0 ? '#b91c1c' : undefined }}>
                                {formatVND(vLeft)}
                              </td>
                              <td>
                                {v.co_chi_phi ? (
                                  <Progress ratio={v.ty_le} level={v.canh_bao} />
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </td>
                              <td>
                                {v.da_chot ? (
                                  <span className="badge badge-ok">Đã chốt</span>
                                ) : v.co_chi_phi ? (
                                  <span className="badge badge-gray">Tạm tính</span>
                                ) : (
                                  ''
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>
                      Tổng {formatMonth(month)} ({filtered.length} chương trình)
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(totalNS)}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(totalCP)}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(totalNS - totalCP)}
                    </td>
                    <td colSpan={2}>{totalNS > 0 ? formatPercent(totalCP / totalNS) : ''}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

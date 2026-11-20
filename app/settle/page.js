'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  LOAI_TAM,
  LOAI_CHOT,
  formatMonth,
  formatVND,
  formatPercent,
} from '@/lib/format';
import MoneyInput from '@/components/MoneyInput';

function prevMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function lastDay(month) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
}

function levelOf(cp, ns) {
  if (cp > 0 && cp > ns) return 'vuot';
  if (ns > 0 && cp / ns >= 0.8) return 'sap_vuot';
  return 'binh_thuong';
}

const LV_COLOR = { vuot: '#b91c1c', sap_vuot: '#b45309', binh_thuong: undefined };
const LV_TEXT = { vuot: ' - VƯỢT', sap_vuot: ' - Sắp vượt', binh_thuong: '' };

export default function SettlePage() {
  const [month, setMonth] = useState(prevMonth());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showLocked, setShowLocked] = useState(false);
  const [kieu, setKieu] = useState(LOAI_CHOT);
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState(false);

  async function load(m) {
    const r = await api('getMonth', { data: { thang: m } });
    setRows(r);
    setInputs({});
  }

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    let alive = true;
    setLoading(true);
    setError('');
    setMsg('');
    api('getMonth', { data: { thang: month } })
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setInputs({});
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

  const visible = rows.filter((p) => showLocked || !p.thang.da_chot);

  // Thông tin một ô (chương trình p, vùng r)
  function cell(p, r) {
    const k = p.so_thong_bao + '|' + r.vung;
    const orig = r.co_chi_phi ? String(Math.round(r.chi_phi)) : '';
    const typed = inputs[k] !== undefined ? inputs[k] : orig;
    let sent = '';
    if (!r.da_chot && typed !== '') {
      if (typed !== orig) sent = typed;
      else if (kieu === LOAI_CHOT && orig !== '') sent = typed;
    }
    const value = typed === '' ? (r.da_chot ? r.chi_phi : 0) : Number(typed);
    return { k, orig, typed, sent, locked: r.da_chot, value };
  }

  function setInput(k, v) {
    setInputs((s) => ({ ...s, [k]: v }));
  }

  // Gom các khoản sẽ lưu
  const entries = [];
  let totalItems = 0;
  visible.forEach((p) => {
    const items = [];
    p.thang.vung_ds.forEach((r) => {
      const c = cell(p, r);
      if (c.sent !== '') items.push({ thang: month, vung: r.vung, so_tien: Number(c.sent) });
    });
    if (items.length > 0) {
      const tu = p.ngay_bd > month + '-01' ? p.ngay_bd : month + '-01';
      const den = p.ngay_kt < lastDay(month) ? p.ngay_kt : lastDay(month);
      entries.push({
        so_thong_bao: p.so_thong_bao,
        kieu: kieu,
        tu_ngay: tu,
        den_ngay: den,
        ghi_chu: 'Quyết toán ' + formatMonth(month),
        items: items,
      });
      totalItems += items.length;
    }
  });

  const nChua = rows.filter((p) => !p.thang.da_chot).length;
  const totalNS = visible.reduce((s, p) => s + p.thang.ngan_sach, 0);

  async function saveAll() {
    setError('');
    setMsg('');
    if (entries.length === 0) {
      setError('Chưa có ô nào được nhập hoặc thay đổi');
      return;
    }
    if (kieu === LOAI_CHOT) {
      const ok = window.confirm(
        'CHỐT quyết toán ' + formatMonth(month) + ' cho ' + totalItems + ' khoản của ' + entries.length + ' chương trình?'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api('addCosts', { data: { entries: entries } });
      await load(month);
      setMsg('Đã lưu ' + totalItems + ' khoản của ' + entries.length + ' chương trình');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const inlineLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 };

  return (
    <div>
      <h1>Quyết toán chi phí theo tháng</h1>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <label htmlFor="month">Tháng quyết toán</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label>Kiểu lưu</label>
            <div className="row" style={{ gap: 14 }}>
              {[LOAI_CHOT, LOAI_TAM].map((k) => (
                <label key={k} style={inlineLabel}>
                  <input type="radio" name="kieu" checked={kieu === k} onChange={() => setKieu(k)} />
                  {k}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={inlineLabel}>
              <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
              Hiện cả chương trình đã chốt
            </label>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Nhập số chi phí <b>lũy kế</b> của {formatMonth(month)} cho từng vùng. Kiểu <b>Chốt</b> sẽ chốt luôn các số tạm
          tính đang hiện sẵn trong ô. Ô đã chốt bị khóa, muốn sửa thì vào trang chi tiết chương trình và ghi lý do. Chi
          phí bổ sung (phát sinh thêm, chạy tiếp) nhập ở trang chi tiết.
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Chương trình có ngân sách {formatMonth(month)}</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className={'stat' + (nChua > 0 ? ' warn' : '')}>
              <div className="stat-label">Chưa chốt</div>
              <div className="stat-value">{nChua}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tổng ngân sách (đang hiện)</div>
              <div className="stat-value">{formatVND(totalNS)}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chương trình</th>
                  <th>Vùng</th>
                  <th className="num">Ngân sách tháng</th>
                  <th className="num">Chi phí hiện có</th>
                  <th style={{ minWidth: 190 }}>Chi phí lũy kế (nhập)</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào cần quyết toán trong {formatMonth(month)}
                    </td>
                  </tr>
                )}

                {visible.map((p) => {
                  const vd = p.thang.vung_ds;
                  const single = vd.length === 1;

                  const infos = vd.map((r) => ({ r, c: cell(p, r) }));
                  const sentCount = infos.filter((x) => x.c.sent !== '').length;
                  const missing = infos.filter((x) => !x.r.da_chot && x.c.sent === '').length;
                  const sumNS = p.thang.ngan_sach;
                  const sumNew = infos.reduce((s, x) => s + x.c.value, 0);
                  const pLv = levelOf(sumNew, sumNS);

                  const link = (
                    <div>
                      <Link href={'/program?id=' + encodeURIComponent(p.so_thong_bao)}>{p.so_thong_bao}</Link>
                      <div>{p.ten}</div>
                    </div>
                  );

                  function inputCell(x) {
                    if (x.r.da_chot) {
                      return (
                        <div>
                          <span className="badge badge-ok">Đã chốt</span> {formatVND(x.r.chi_phi)}
                        </div>
                      );
                    }
                    return (
                      <MoneyInput
                        value={x.c.typed}
                        disabled={saving}
                        onChange={(v) => setInput(x.c.k, v)}
                      />
                    );
                  }

                  function ratioCell(x) {
                    if (x.c.typed === '' && !x.r.da_chot) return <span className="muted">-</span>;
                    const ratio = x.r.ngan_sach > 0 ? x.c.value / x.r.ngan_sach : 0;
                    const lv = levelOf(x.c.value, x.r.ngan_sach);
                    return (
                      <span style={{ fontWeight: 600, color: LV_COLOR[lv], whiteSpace: 'nowrap' }}>
                        {formatPercent(ratio)}
                        {LV_TEXT[lv]}
                      </span>
                    );
                  }

                  if (single) {
                    const x = infos[0];
                    const rowCls = pLv === 'vuot' ? 'row-danger' : pLv === 'sap_vuot' ? 'row-warn' : '';
                    return (
                      <tr key={p.so_thong_bao} className={rowCls}>
                        <td>{link}</td>
                        <td>{x.r.vung}</td>
                        <td className="num">{formatVND(x.r.ngan_sach)}</td>
                        <td className="num">
                          {x.r.co_chi_phi ? formatVND(x.r.chi_phi) : <span className="muted">Chưa có</span>}
                        </td>
                        <td>{inputCell(x)}</td>
                        <td>{ratioCell(x)}</td>
                      </tr>
                    );
                  }

                  return [
                    <tr key={p.so_thong_bao} style={{ background: '#f3f4f6' }}>
                      <td>{link}</td>
                      <td className="muted">Tổng các vùng</td>
                      <td className="num">{formatVND(sumNS)}</td>
                      <td className="num">
                        {p.thang.co_chi_phi ? formatVND(p.thang.chi_phi) : <span className="muted">Chưa có</span>}
                      </td>
                      <td>
                        {kieu === LOAI_CHOT && sentCount > 0 && missing > 0 && (
                          <span style={{ color: '#b45309', fontSize: 13 }}>
                            Còn {missing} vùng chưa có số, tháng này chưa được tính là chốt
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: LV_COLOR[pLv], whiteSpace: 'nowrap' }}>
                          {sumNS > 0 ? formatPercent(sumNew / sumNS) : ''}
                          {LV_TEXT[pLv]}
                        </span>
                      </td>
                    </tr>,
                    ...infos.map((x) => {
                      const lv = levelOf(x.c.value, x.r.ngan_sach);
                      const rowCls = lv === 'vuot' ? 'row-danger' : lv === 'sap_vuot' ? 'row-warn' : '';
                      return (
                        <tr key={p.so_thong_bao + '|' + x.r.vung} className={rowCls}>
                          <td></td>
                          <td style={{ paddingLeft: 24 }}>{x.r.vung}</td>
                          <td className="num">{formatVND(x.r.ngan_sach)}</td>
                          <td className="num">
                            {x.r.co_chi_phi ? formatVND(x.r.chi_phi) : <span className="muted">-</span>}
                          </td>
                          <td>{inputCell(x)}</td>
                          <td>{ratioCell(x)}</td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving || entries.length === 0}>
              {saving
                ? 'Đang lưu...'
                : 'Lưu tất cả (' + totalItems + ' khoản, ' + entries.length + ' chương trình)'}
            </button>
            {kieu === LOAI_CHOT && entries.length > 0 && !saving && (
              <span className="muted">Kiểu Chốt: các khoản trên sẽ được chốt quyết toán</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  formatVND,
  formatDate,
  formatPercent,
  monthOf,
  LOAI_TAM,
  LOAI_CHOT,
} from '@/lib/format';
import MoneyInput from '@/components/MoneyInput';

function prevMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function levelOf(cp, ns) {
  if (cp === '' || cp === null || cp === undefined) return 'binh_thuong';
  const v = Number(cp);
  if (v > ns) return 'vuot';
  if (ns > 0 && v / ns >= 0.8) return 'sap_vuot';
  return 'binh_thuong';
}

export default function SettlePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [month, setMonth] = useState(prevMonth());
  const [showLocked, setShowLocked] = useState(false);
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState(false);

  function buildInputs(list) {
    const m = {};
    list.forEach((r) => {
      m[r.so_thong_bao] = {
        cp: r.loai_chi_phi ? String(Math.round(r.chi_phi)) : '',
        loai: LOAI_CHOT,
      };
    });
    return m;
  }

  async function load() {
    const list = await api('list');
    setRows(list);
    setInputs(buildInputs(list));
  }

  useEffect(() => {
    load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Các chương trình có thời gian chạy giao với tháng đã chọn
  const list = useMemo(() => {
    return rows.filter((r) => {
      if (!month) return true;
      if (!(monthOf(r.ngay_bd) <= month && monthOf(r.ngay_kt) >= month)) return false;
      if (!showLocked && r.loai_chi_phi === LOAI_CHOT) return false;
      return true;
    });
  }, [rows, month, showLocked]);

  function setInput(id, patch) {
    setInputs((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  }

  // Các dòng có thay đổi so với dữ liệu đang lưu
  function changedRows() {
    return list.filter((r) => {
      if (r.loai_chi_phi === LOAI_CHOT) return false; // đã chốt: sửa ở trang chi tiết
      const inp = inputs[r.so_thong_bao];
      if (!inp || inp.cp === '') return false;
      const orig = r.loai_chi_phi ? String(Math.round(r.chi_phi)) : '';
      return inp.cp !== orig || (r.loai_chi_phi && r.loai_chi_phi !== inp.loai);
    });
  }

  const changed = changedRows();
  const nChot = changed.filter((r) => inputs[r.so_thong_bao].loai === LOAI_CHOT).length;

  async function saveAll() {
    setError('');
    setMsg('');
    if (changed.length === 0) {
      setError('Chưa có dòng nào được nhập hoặc thay đổi');
      return;
    }
    const ok = window.confirm(
      'Lưu chi phí cho ' + changed.length + ' chương trình?' +
        (nChot > 0 ? '\n\nTrong đó ' + nChot + ' chương trình sẽ được CHỐT quyết toán.' : '')
    );
    if (!ok) return;

    setSaving(true);
    const errors = [];
    let done = 0;
    for (const r of changed) {
      const inp = inputs[r.so_thong_bao];
      try {
        await api('updateCost', {
          data: {
            so_thong_bao: r.so_thong_bao,
            chi_phi: Number(inp.cp),
            loai_chi_phi: inp.loai,
            ghi_chu: '',
          },
        });
        done++;
      } catch (e) {
        errors.push(r.so_thong_bao + ': ' + e.message);
      }
    }

    try {
      await load();
    } catch (e) {
      errors.push('Không tải lại được dữ liệu: ' + e.message);
    }

    if (done > 0) setMsg('Đã lưu ' + done + ' chương trình');
    if (errors.length > 0) setError('Có lỗi ở: ' + errors.join(' | '));
    setSaving(false);
  }

  return (
    <div>
      <h1>Quyết toán chi phí khuyến mãi</h1>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <label htmlFor="month">Tháng quyết toán</label>
            <input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={showLocked}
                onChange={(e) => setShowLocked(e.target.checked)}
              />{' '}
              Hiện cả chương trình đã chốt
            </label>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Hiện các chương trình có thời gian chạy rơi vào tháng đã chọn. Mặc định chọn tháng trước
          để quyết toán đầu tháng. Nhập chi phí từng dòng, chọn "Tạm tính" hoặc "Chốt", rồi bấm
          "Lưu tất cả" một lần.
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {loading ? (
        <div className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số thông báo</th>
                  <th>Tên chương trình</th>
                  <th>Thời gian chạy</th>
                  <th className="num">Ngân sách A&P</th>
                  <th style={{ minWidth: 170 }}>Chi phí thực tế</th>
                  <th style={{ minWidth: 120 }}>Loại</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      Không có chương trình nào cần quyết toán trong tháng này
                    </td>
                  </tr>
                )}
                {list.map((r) => {
                  const id = r.so_thong_bao;
                  const inp = inputs[id] || { cp: '', loai: LOAI_CHOT };
                  const locked = r.loai_chi_phi === LOAI_CHOT;
                  const lv = levelOf(inp.cp, r.ngan_sach);
                  const rowCls = lv === 'vuot' ? 'row-danger' : lv === 'sap_vuot' ? 'row-warn' : '';
                  const ratio = r.ngan_sach > 0 && inp.cp !== '' ? Number(inp.cp) / r.ngan_sach : 0;
                  return (
                    <tr key={id} className={rowCls}>
                      <td>
                        <Link href={'/program?id=' + encodeURIComponent(id)}>{id}</Link>
                      </td>
                      <td>{r.ten}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(r.ngay_bd)} - {formatDate(r.ngay_kt)}
                      </td>
                      <td className="num">{formatVND(r.ngan_sach)}</td>
                      <td>
                        <MoneyInput
                          value={inp.cp}
                          disabled={locked || saving}
                          onChange={(v) => setInput(id, { cp: v })}
                        />
                      </td>
                      <td>
                        {locked ? (
                          <span className="badge badge-ok">Đã chốt</span>
                        ) : (
                          <select
                            value={inp.loai}
                            disabled={saving}
                            onChange={(e) => setInput(id, { loai: e.target.value })}
                          >
                            <option value={LOAI_CHOT}>{LOAI_CHOT}</option>
                            <option value={LOAI_TAM}>{LOAI_TAM}</option>
                          </select>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {inp.cp === '' ? (
                          <span className="muted">-</span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 600,
                              color: lv === 'vuot' ? '#b91c1c' : lv === 'sap_vuot' ? '#b45309' : undefined,
                            }}
                          >
                            {formatPercent(ratio)}
                            {lv === 'vuot' ? ' - VƯỢT' : lv === 'sap_vuot' ? ' - Sắp vượt' : ''}
                          </span>
                        )}
                        {locked && (
                          <div className="hint">
                            Sửa ở{' '}
                            <Link href={'/program?id=' + encodeURIComponent(id)}>trang chi tiết</Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={saveAll}
              disabled={saving || changed.length === 0}
            >
              {saving ? 'Đang lưu...' : 'Lưu tất cả (' + changed.length + ' dòng thay đổi)'}
            </button>
            {nChot > 0 && !saving && (
              <span className="muted">Trong đó {nChot} dòng sẽ chốt quyết toán</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

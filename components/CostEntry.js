'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import MoneyInput from '@/components/MoneyInput';
import {
  ALL_REGION,
  KIEU_BS,
  LOAI_TAM,
  LOAI_CHOT,
  LY_DO_BS,
  formatMonth,
  formatVND,
  formatPercent,
  monthsBetween,
  todayYmd,
} from '@/lib/format';

const KIEU_HELP = {
  [LOAI_TAM]: 'Số lũy kế của tháng tính đến thời điểm nhập, thay cho số tạm tính trước. Dùng để cảnh báo sớm.',
  [LOAI_CHOT]: 'Số quyết toán chính thức của tháng. Tháng được tính là đã chốt khi mọi vùng đều có số chốt.',
  [KIEU_BS]: 'Số tiền CỘNG THÊM vào chi phí hiện có của tháng (phát sinh thêm hoặc chạy tiếp). Không thay số cũ.',
};

function key(s) {
  return String(s || '').trim().toLowerCase();
}

function levelOf(cp, ns) {
  if (cp > 0 && cp > ns) return 'vuot';
  if (ns > 0 && cp / ns >= 0.8) return 'sap_vuot';
  return 'binh_thuong';
}

function defaultDen(p, today) {
  if (today >= p.ngay_bd && today <= p.ngay_kt) return today;
  return p.ngay_kt;
}

export default function CostEntry({ detail, refs, onSaved }) {
  const p = detail.program;
  const regionsRef = (refs && refs.regions) || [];
  const lyDoList = (refs && refs.ly_do) || LY_DO_BS;

  const [kieu, setKieu] = useState(LOAI_TAM);
  const [lyDo, setLyDo] = useState(lyDoList[0]);
  const [tu, setTu] = useState(p.ngay_bd);
  const [den, setDen] = useState(defaultDen(p, todayYmd()));
  const [sel, setSel] = useState([]);
  const [cells, setCells] = useState({}); // chỉ lưu các ô người dùng đã gõ
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Các hàng vùng: gom từ ngân sách và chi phí đã có
  const rowNames = useMemo(() => {
    const seen = {};
    const list = [];
    p.thang_ds.forEach((m) =>
      m.vung_ds.forEach((v) => {
        if (!seen[key(v.vung)]) {
          seen[key(v.vung)] = true;
          list.push(v.vung);
        }
      })
    );
    if (list.length === 0) list.push(ALL_REGION);
    const order = (n) => (n === ALL_REGION ? -1 : regionsRef.indexOf(n) < 0 ? 999 : regionsRef.indexOf(n));
    list.sort((a, b) => order(a) - order(b));
    return list;
  }, [p, regionsRef.join('|')]);

  const candidates = monthsBetween(tu, den);
  const candKey = candidates.join(',');
  const months = candidates.length === 1 ? candidates : sel.filter((m) => candidates.includes(m));

  useEffect(() => {
    if (candidates.length > 1 && months.length === 0) setSel([candidates[0]]);
  }, [candKey]);

  function cur(t, vung) {
    const m = p.thang_ds.find((x) => x.thang === t);
    if (!m) return null;
    return m.vung_ds.find((v) => key(v.vung) === key(vung)) || null;
  }

  function defaultCell(t, r) {
    if (kieu === KIEU_BS) return '';
    const c = cur(t, r);
    return c && c.co_chi_phi ? String(Math.round(c.chi_phi)) : '';
  }

  function getCell(t, r) {
    const k = t + '|' + r;
    return cells[k] !== undefined ? cells[k] : defaultCell(t, r);
  }

  // Ô nào sẽ được gửi đi khi lưu
  function sentValue(t, r) {
    const v = getCell(t, r);
    if (v === '') return '';
    if (cells[t + '|' + r] !== undefined) return v; // người dùng đã gõ
    if (kieu === LOAI_CHOT) {
      const c = cur(t, r);
      return c && c.da_chot ? '' : v; // chốt luôn các số tạm tính đang hiển thị
    }
    return '';
  }

  const items = [];
  months.forEach((t) =>
    rowNames.forEach((r) => {
      const v = sentValue(t, r);
      if (v !== '') items.push({ thang: t, vung: r, so_tien: Number(v) });
    })
  );

  // Dự kiến sau khi lưu
  const preview = months.map((t) => {
    let ns = 0;
    let cp = 0;
    const notChot = [];
    rowNames.forEach((r) => {
      const c = cur(t, r);
      const v = sentValue(t, r);
      if (!c && v === '') return;
      const baseNS = c ? c.ngan_sach : 0;
      const baseCP = c ? c.chi_phi : 0;
      let after = baseCP;
      let chot = c ? c.da_chot : false;
      if (v !== '') {
        if (kieu === KIEU_BS) {
          after = baseCP + Number(v);
        } else {
          after = Number(v);
          chot = kieu === LOAI_CHOT;
        }
      }
      ns += baseNS;
      cp += after;
      if (!chot) notChot.push(r);
    });
    const hasBudget = p.thang_ds.some((m) => m.thang === t && m.ngan_sach > 0);
    return { t, ns, cp, ratio: ns > 0 ? cp / ns : 0, level: levelOf(cp, ns), notChot, hasBudget };
  });

  function toggleMonth(t) {
    setSel(months.includes(t) ? months.filter((m) => m !== t) : [...months, t].sort());
  }

  function changeKieu(k) {
    setKieu(k);
    setCells({});
    setError('');
    setMsg('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!tu || !den) return setError('Chưa nhập thời gian thực hiện chi phí');
    if (den < tu) return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if (months.length === 0) return setError('Chưa chọn tháng tính chi phí');
    if (items.length === 0) return setError('Chưa nhập số tiền nào');
    if (kieu === KIEU_BS && !lyDo) return setError('Chưa chọn lý do bổ sung');

    if (kieu !== KIEU_BS) {
      const locked = items.filter((it) => {
        const c = cur(it.thang, it.vung);
        return c && c.da_chot;
      });
      if (locked.length > 0 && !note.trim()) {
        return setError('Có ' + locked.length + ' ô đã chốt. Muốn sửa phải ghi lý do vào ô ghi chú.');
      }
    }

    if (kieu === LOAI_CHOT) {
      const ok = window.confirm('Chốt quyết toán ' + items.length + ' khoản chi phí của chương trình này?');
      if (!ok) return;
    }

    setSaving(true);
    try {
      await api('addCosts', {
        data: {
          entries: [
            {
              so_thong_bao: p.so_thong_bao,
              kieu: kieu,
              ly_do: kieu === KIEU_BS ? lyDo : '',
              tu_ngay: tu,
              den_ngay: den,
              ghi_chu: note,
              items: items,
            },
          ],
        },
      });
      setCells({});
      setNote('');
      setMsg('Đã lưu chi phí');
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  const lvText = { vuot: 'VƯỢT ngân sách', sap_vuot: 'Sắp vượt', binh_thuong: 'Bình thường' };
  const lvColor = { vuot: '#b91c1c', sap_vuot: '#b45309', binh_thuong: '#16a34a' };
  const inlineLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 };

  return (
    <div className="card">
      <h2>Nhập chi phí</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <form onSubmit={onSubmit}>
        <label>Kiểu nhập</label>
        <div className="row" style={{ gap: 18 }}>
          {[LOAI_TAM, LOAI_CHOT, KIEU_BS].map((k) => (
            <label key={k} style={inlineLabel}>
              <input type="radio" name="kieu" checked={kieu === k} onChange={() => changeKieu(k)} />
              {k}
            </label>
          ))}
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>
          {KIEU_HELP[kieu]}
        </div>

        <div className="form-grid">
          {kieu === KIEU_BS && (
            <div className="full">
              <label htmlFor="ly_do">Lý do bổ sung</label>
              <select id="ly_do" value={lyDo} onChange={(e) => setLyDo(e.target.value)}>
                {lyDoList.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="tu">Thời gian thực hiện chi phí: từ ngày</label>
            <input id="tu" type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
          </div>
          <div>
            <label htmlFor="den">Đến ngày</label>
            <input id="den" type="date" value={den} onChange={(e) => setDen(e.target.value)} />
          </div>

          <div className="full">
            {candidates.length <= 1 ? (
              <div className="muted">
                {candidates.length === 1
                  ? 'Chi phí tính vào ' + formatMonth(candidates[0]) + '.'
                  : 'Hãy chọn thời gian thực hiện hợp lệ.'}
              </div>
            ) : (
              <div>
                <label>Thời gian này chạy qua {candidates.length} tháng. Chi phí tính vào tháng nào?</label>
                <div className="row" style={{ gap: 16 }}>
                  {candidates.map((t) => (
                    <label key={t} style={inlineLabel}>
                      <input type="checkbox" checked={months.includes(t)} onChange={() => toggleMonth(t)} />
                      {formatMonth(t)}
                    </label>
                  ))}
                </div>
                <div className="hint">Tích tháng nào thì có ô nhập số tiền cho tháng đó.</div>
              </div>
            )}
          </div>
        </div>

        {months.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>{rowNames.length === 1 && rowNames[0] === ALL_REGION ? 'Phạm vi' : 'Vùng miền'}</th>
                  {months.map((t) => (
                    <th key={t}>
                      {formatMonth(t)} {kieu === KIEU_BS ? '(số cộng thêm)' : '(số lũy kế)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowNames.map((r) => (
                  <tr key={r}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r}</td>
                    {months.map((t) => {
                      const c = cur(t, r);
                      return (
                        <td key={t} style={{ minWidth: 190 }}>
                          <MoneyInput
                            value={getCell(t, r)}
                            disabled={saving}
                            onChange={(v) => setCells((s) => ({ ...s, [t + '|' + r]: v }))}
                          />
                          <div className="hint">
                            {c
                              ? 'NS ' +
                                formatVND(c.ngan_sach) +
                                ' · hiện có ' +
                                formatVND(c.chi_phi) +
                                (c.da_chot ? ' · đã chốt' : '')
                              : 'Chưa có ngân sách tháng này'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <label htmlFor="gc">Ghi chú / lý do (bắt buộc khi sửa ô đã chốt)</label>
          <input id="gc" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {items.length > 0 && (
          <div className="card" style={{ marginTop: 12, marginBottom: 0, background: '#f9fafb' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Dự kiến sau khi lưu</div>
            {preview.map((pv) => (
              <div key={pv.t} style={{ marginBottom: 6 }}>
                <b>{formatMonth(pv.t)}:</b> chi phí {formatVND(pv.cp)} / ngân sách {formatVND(pv.ns)}
                {pv.hasBudget ? ' = ' + formatPercent(pv.ratio) : ''}{' '}
                <span style={{ color: lvColor[pv.level], fontWeight: 600 }}>
                  {pv.hasBudget || pv.cp > 0 ? lvText[pv.level] : ''}
                </span>
                {!pv.hasBudget && <span className="muted"> (tháng này chưa có ngân sách)</span>}
                {kieu === LOAI_CHOT && pv.notChot.length > 0 && (
                  <div style={{ color: '#b45309', fontSize: 13 }}>
                    Chưa chốt: {pv.notChot.join(', ')}. Tháng chỉ được tính là đã chốt khi mọi vùng đều có số chốt.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit" disabled={saving || items.length === 0}>
            {saving ? 'Đang lưu...' : 'Lưu ' + kieu.toLowerCase() + (items.length ? ' (' + items.length + ' khoản)' : '')}
          </button>
        </div>
      </form>
    </div>
  );
}

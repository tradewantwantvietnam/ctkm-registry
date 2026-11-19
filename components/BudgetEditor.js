'use client';

import { useEffect, useState } from 'react';
import MoneyInput from '@/components/MoneyInput';
import NameListManager from '@/components/NameListManager';
import { ALL_REGION, formatMonth, formatVND, monthsBetween } from '@/lib/format';

/* ===== Hàm dùng chung cho form ===== */
export function emptyBudgetState() {
  return { months: [], scope: 'all', regions: [], cells: {}, mixed: false };
}

// Dựng trạng thái từ ngân sách đã lưu [{ thang, vung, ngan_sach }]
export function budgetStateFrom(budgets) {
  const months = [];
  const regions = [];
  const cells = {};
  let hasAll = false;
  let hasReg = false;
  (budgets || []).forEach((b) => {
    if (!months.includes(b.thang)) months.push(b.thang);
    if (b.vung === ALL_REGION) {
      hasAll = true;
    } else {
      hasReg = true;
      if (!regions.includes(b.vung)) regions.push(b.vung);
    }
    cells[b.thang + '|' + b.vung] = String(Math.round(b.ngan_sach));
  });
  months.sort();
  return {
    months: months,
    scope: hasReg ? 'regions' : 'all',
    regions: regions,
    cells: cells,
    mixed: hasAll && hasReg,
  };
}

export function renameRegionInState(state, oldName, newName) {
  const cells = {};
  Object.keys(state.cells).forEach((k) => {
    const i = k.indexOf('|');
    const t = k.slice(0, i);
    const v = k.slice(i + 1);
    cells[t + '|' + (v === oldName ? newName : v)] = state.cells[k];
  });
  return {
    ...state,
    regions: state.regions.map((r) => (r === oldName ? newName : r)),
    cells: cells,
  };
}

// Chuyển trạng thái thành danh sách ngân sách để gửi lên máy chủ
export function budgetsFromState(state, ngayBd, ngayKt) {
  const avail = monthsBetween(ngayBd, ngayKt);
  const months = avail.length === 1 ? avail : state.months.filter((m) => avail.includes(m));
  if (months.length === 0) return { error: 'Chưa chọn tháng tính ngân sách' };

  const rows = state.scope === 'all' ? [ALL_REGION] : state.regions;
  if (rows.length === 0) return { error: 'Chưa chọn vùng miền nào cho ngân sách' };

  const budgets = [];
  for (let i = 0; i < months.length; i++) {
    for (let j = 0; j < rows.length; j++) {
      const t = months[i];
      const r = rows[j];
      const v = state.cells[t + '|' + r];
      if (v === undefined || v === '') {
        return {
          error: 'Chưa nhập ngân sách ' + formatMonth(t) + (r !== ALL_REGION ? ' - ' + r : ''),
        };
      }
      budgets.push({ thang: t, vung: r, ngan_sach: Number(v) });
    }
  }
  return { budgets: budgets };
}

/* ===== Giao diện ===== */
export default function BudgetEditor({
  ngayBd,
  ngayKt,
  state,
  onChange,
  regions,
  onAddRegion,
  onRenameRegion,
}) {
  const avail = monthsBetween(ngayBd, ngayKt);
  const availKey = avail.join(',');
  const months = avail.length === 1 ? avail : state.months.filter((m) => avail.includes(m));
  const [showMgr, setShowMgr] = useState(false);

  // Khi đổi thời gian chạy mà chưa có tháng nào được chọn thì chọn sẵn tháng đầu
  useEffect(() => {
    if (avail.length > 0 && months.length === 0) {
      onChange({ ...state, months: [avail[0]] });
    }
  }, [availKey]);

  const rowNames =
    state.scope === 'all'
      ? [ALL_REGION]
      : [
          ...regions.filter((r) => state.regions.includes(r)),
          ...state.regions.filter((r) => !regions.includes(r)),
        ];

  function toggleMonth(t) {
    const next = months.includes(t) ? months.filter((m) => m !== t) : [...months, t].sort();
    onChange({ ...state, months: next });
  }

  function setScope(s) {
    if (s === 'regions' && state.regions.length === 0) {
      onChange({ ...state, scope: s, regions: [...regions] });
    } else {
      onChange({ ...state, scope: s });
    }
  }

  function toggleRegion(r) {
    const next = state.regions.includes(r)
      ? state.regions.filter((x) => x !== r)
      : [...state.regions, r];
    onChange({ ...state, regions: next });
  }

  function setCell(t, r, v) {
    onChange({ ...state, cells: { ...state.cells, [t + '|' + r]: v } });
  }

  function cellNum(t, r) {
    return Number(state.cells[t + '|' + r] || 0);
  }

  const rowTotal = (r) => months.reduce((s, t) => s + cellNum(t, r), 0);
  const colTotal = (t) => rowNames.reduce((s, r) => s + cellNum(t, r), 0);
  const grand = months.reduce((s, t) => s + colTotal(t), 0);

  const inlineLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 };

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 12, background: '#fafafa' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Ngân sách dự kiến theo A&P (đồng) *</div>

      {avail.length === 0 && (
        <div className="muted">Hãy chọn ngày bắt đầu và ngày kết thúc để nhập ngân sách.</div>
      )}

      {avail.length > 0 && (
        <>
          {avail.length === 1 ? (
            <div className="muted" style={{ marginBottom: 10 }}>
              Ngân sách tính vào {formatMonth(avail[0])}.
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label>
                Chương trình chạy qua {avail.length} tháng. Ngân sách tính vào tháng nào?
              </label>
              <div className="row" style={{ gap: 16 }}>
                {avail.map((t) => (
                  <label key={t} style={inlineLabel}>
                    <input type="checkbox" checked={months.includes(t)} onChange={() => toggleMonth(t)} />
                    {formatMonth(t)}
                  </label>
                ))}
              </div>
              <div className="hint">
                Tích nhiều tháng thì có ô nhập ngân sách riêng cho từng tháng. Tháng không tích sẽ không có ngân sách.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label>Phạm vi ngân sách</label>
            <div className="row" style={{ gap: 18 }}>
              <label style={inlineLabel}>
                <input type="radio" name="scope" checked={state.scope === 'all'} onChange={() => setScope('all')} />
                {ALL_REGION} (một ngân sách chung)
              </label>
              <label style={inlineLabel}>
                <input
                  type="radio"
                  name="scope"
                  checked={state.scope === 'regions'}
                  onChange={() => setScope('regions')}
                />
                Theo vùng miền
              </label>
            </div>
          </div>

          {state.scope === 'regions' && (
            <div style={{ marginBottom: 12 }}>
              <label>Áp dụng cho vùng nào?</label>
              <div className="row" style={{ gap: 16 }}>
                {regions.map((r) => (
                  <label key={r} style={inlineLabel}>
                    <input type="checkbox" checked={state.regions.includes(r)} onChange={() => toggleRegion(r)} />
                    {r}
                  </label>
                ))}
                <button type="button" className="btn btn-small" onClick={() => setShowMgr((v) => !v)}>
                  {showMgr ? 'Đóng' : 'Thêm / đổi tên vùng'}
                </button>
              </div>
              {showMgr && (
                <NameListManager
                  title="Quản lý vùng miền"
                  items={regions}
                  placeholder="Ví dụ: Miền Tây"
                  onAdd={onAddRegion}
                  onRename={onRenameRegion}
                />
              )}
            </div>
          )}

          {state.mixed && (
            <div className="alert alert-warn">
              Dữ liệu cũ của chương trình này vừa có "{ALL_REGION}" vừa có theo vùng. Khi lưu, ngân sách sẽ được thay
              bằng đúng các số đang hiển thị trong bảng bên dưới.
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{state.scope === 'all' ? 'Phạm vi' : 'Vùng miền'}</th>
                  {months.map((t) => (
                    <th key={t} className="num">
                      {formatMonth(t)}
                    </th>
                  ))}
                  {months.length > 1 && <th className="num">Tổng</th>}
                </tr>
              </thead>
              <tbody>
                {rowNames.length === 0 && (
                  <tr>
                    <td colSpan={months.length + 2} className="muted">
                      Chưa chọn vùng nào
                    </td>
                  </tr>
                )}
                {rowNames.map((r) => (
                  <tr key={r}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r}</td>
                    {months.map((t) => (
                      <td key={t} style={{ minWidth: 150 }}>
                        <MoneyInput
                          value={state.cells[t + '|' + r] || ''}
                          onChange={(v) => setCell(t, r, v)}
                        />
                      </td>
                    ))}
                    {months.length > 1 && <td className="num">{formatVND(rowTotal(r))}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Tổng</td>
                  {months.map((t) => (
                    <td key={t} className="num" style={{ fontWeight: 700 }}>
                      {formatVND(colTotal(t))}
                    </td>
                  ))}
                  {months.length > 1 && (
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatVND(grand)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="hint">Ô nào không có ngân sách thì nhập 0.</div>
        </>
      )}
    </div>
  );
}

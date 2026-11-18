import { CANH_BAO, TRANG_THAI_CLS, formatPercent } from '@/lib/format';

export function WarnBadge({ level }) {
  const c = CANH_BAO[level] || CANH_BAO.binh_thuong;
  return <span className={'badge ' + c.cls}>{c.label}</span>;
}

export function StatusBadge({ status }) {
  return (
    <span className={'badge ' + (TRANG_THAI_CLS[status] || 'badge-gray')}>
      {status}
    </span>
  );
}

export function Progress({ ratio, level }) {
  const pct = Math.min(100, Math.max(0, (Number(ratio) || 0) * 100));
  const cls = level === 'vuot' ? 'danger' : level === 'sap_vuot' ? 'warn' : '';
  return (
    <div>
      <div className="progress">
        <div className={'progress-bar ' + cls} style={{ width: pct + '%' }} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {formatPercent(ratio)}
      </div>
    </div>
  );
}

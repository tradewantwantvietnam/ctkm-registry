'use client';

import { useState } from 'react';
import NppTab from '@/components/info/NppTab';
import ProductTab from '@/components/info/ProductTab';
import PriceTab from '@/components/info/PriceTab';

const TABS = [
  { key: 'npp', label: 'NPP (Miền - Vùng)' },
  { key: 'sp', label: 'Sản phẩm' },
  { key: 'gia', label: 'Giá sản phẩm theo tháng' },
];

export default function InfoPage() {
  const [tab, setTab] = useState('npp');

  return (
    <div>
      <h1>Up thông tin</h1>
      <div className="muted" style={{ marginBottom: 12 }}>
        Dữ liệu nền dùng cho các trang Cài đặt chương trình và Theo dõi tiến độ.
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'npp' && <NppTab />}
      {tab === 'sp' && <ProductTab />}
      {tab === 'gia' && <PriceTab />}
    </div>
  );
}

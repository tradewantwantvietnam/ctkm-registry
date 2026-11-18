'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function HomePage() {
  const [state, setState] = useState({ loading: true, error: '', count: 0 });

  useEffect(() => {
    api('list')
      .then((rows) => setState({ loading: false, error: '', count: rows.length }))
      .catch((e) => setState({ loading: false, error: e.message, count: 0 }));
  }, []);

  return (
    <div>
      <h1>Kiểm tra kết nối</h1>
      {state.loading && <div className="alert alert-warn">Đang kết nối tới Apps Script...</div>}
      {state.error && <div className="alert alert-error">Lỗi: {state.error}</div>}
      {!state.loading && !state.error && (
        <div className="alert alert-ok">
          Kết nối thành công. Hiện có {state.count} chương trình trong sổ.
        </div>
      )}
      <p className="muted">Đây là trang tạm. Phần 3 sẽ thay bằng trang Danh sách chương trình.</p>
    </div>
  );
}

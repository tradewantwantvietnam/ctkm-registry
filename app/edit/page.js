'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import ProgramForm from '@/components/ProgramForm';

function EditInner() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Thiếu số thông báo');
      return;
    }
    api('getDetail', { id })
      .then((d) => setDetail(d))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="alert alert-error">Lỗi: {error}</div>;
  if (!detail) return <div className="muted">Đang tải...</div>;

  return (
    <div>
      <h1>Sửa chương trình {detail.program.so_thong_bao}</h1>
      <ProgramForm initial={detail.program} budgets={detail.budgets} isEdit={true} />
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="muted">Đang tải...</div>}>
      <EditInner />
    </Suspense>
  );
}

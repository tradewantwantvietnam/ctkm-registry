'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import ProgramForm from '@/components/ProgramForm';

function EditInner() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const [program, setProgram] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Thiếu số thông báo');
      return;
    }
    api('get', { id })
      .then((p) => setProgram(p))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="alert alert-error">Lỗi: {error}</div>;
  if (!program) return <div className="muted">Đang tải...</div>;

  return (
    <div>
      <h1>Sửa chương trình {program.so_thong_bao}</h1>
      <ProgramForm initial={program} isEdit={true} />
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

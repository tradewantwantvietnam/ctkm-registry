'use client';

import { useEffect, useRef } from 'react';

// Cửa sổ nhỏ dùng chung. dismissible=false thì chỉ đóng bằng nút ✕ hoặc nút trong form
// (tránh mất dữ liệu đang nhập khi lỡ bấm ra ngoài hoặc nhấn Esc).
export default function Modal({ title, onClose, children, maxWidth = 900, dismissible = true }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function onKey(e) {
      if (dismissible && e.key === 'Escape') closeRef.current();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [dismissible]);

  return (
    <div
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) closeRef.current();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(17, 24, 39, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: maxWidth,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn-small" onClick={() => closeRef.current()} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

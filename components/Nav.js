'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const MAIN = [
  { href: '/', label: 'Danh sách chương trình' },
  { href: '/progress', label: 'Theo dõi tiến độ' },
  { href: '/settings', label: 'Cài đặt chương trình' },
  { href: '/info', label: 'Up thông tin' },
];

const MORE = [
  { href: '/settle', label: 'Quyết toán' },
  { href: '/monthly', label: 'Theo dõi tháng' },
  { href: '/alerts', label: 'Báo động' },
  { href: '/hidden', label: 'Đã ẩn' },
];

function isActive(pathname, href) {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/program') || pathname.startsWith('/edit');
  }
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const boxRef = useRef(null);

  // Đổi trang thì đóng menu Khác
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bấm ra ngoài hoặc nhấn Esc thì đóng menu Khác
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (pathname === '/login') return null;

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const moreActive = MORE.some((l) => isActive(pathname, l.href));

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="nav-brand">Kho CTKM</span>

        <div className="nav-links">
          {MAIN.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(pathname, l.href) ? 'nav-link active' : 'nav-link'}
            >
              {l.label}
            </Link>
          ))}

          <div ref={boxRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              style={{
                border: 0,
                cursor: 'pointer',
                font: 'inherit',
                padding: '6px 12px',
                borderRadius: 6,
                background: moreActive ? 'var(--primary)' : hover ? '#374151' : 'transparent',
                color: moreActive || hover ? '#fff' : '#d1d5db',
              }}
            >
              Khác ▾
            </button>

            {open && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  minWidth: 190,
                  padding: 6,
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: 8,
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {MORE.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={isActive(pathname, l.href) ? 'nav-link active' : 'nav-link'}
                    style={{ display: 'block', whiteSpace: 'nowrap' }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <button className="btn btn-small" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}

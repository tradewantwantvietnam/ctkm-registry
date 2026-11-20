'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Danh sách' },
  { href: '/new', label: 'Thêm chương trình' },
  { href: '/import', label: 'Nhập từ Excel' },
  { href: '/settle', label: 'Quyết toán' },
  { href: '/monthly', label: 'Theo dõi tháng' },
  { href: '/alerts', label: 'Báo động' },
  { href: '/export', label: 'Trích lục' },
  { href: '/hidden', label: 'Đã ẩn' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="nav-brand">Kho CTKM</span>
        <div className="nav-links">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? 'nav-link active' : 'nav-link'}>
                {l.label}
              </Link>
            );
          })}
        </div>
        <button className="btn btn-small" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}

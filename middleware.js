import { NextResponse } from 'next/server';
import { makeToken, COOKIE_NAME } from '@/lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Các đường dẫn không cần đăng nhập
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await makeToken();

  if (token && expected && token === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Chưa đăng nhập' },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextResponse } from 'next/server';
import { makeToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    body = {};
  }

  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    return NextResponse.json(
      { ok: false, error: 'Máy chủ chưa cấu hình APP_PASSWORD' },
      { status: 500 }
    );
  }

  if (!body.password || body.password !== pw) {
    // Chờ một chút để chống dò mật khẩu
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json(
      { ok: false, error: 'Sai mật khẩu' },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return res;
}

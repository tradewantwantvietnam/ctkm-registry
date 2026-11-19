import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { makeToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fail(message, status) {
  return NextResponse.json({ ok: false, error: message }, { status: status });
}

export async function POST(req) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const expected = await makeToken();
  if (!token || !expected || token !== expected) {
    return fail('Chưa đăng nhập', 401);
  }

  const url = process.env.GAS_URL;
  const key = process.env.GAS_API_KEY;
  if (!url || !key) {
    return fail('Máy chủ chưa cấu hình GAS_URL hoặc GAS_API_KEY', 500);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return fail('Dữ liệu gửi lên không hợp lệ', 400);
  }

  if (typeof body.action !== 'string' || !/^[A-Za-z][A-Za-z0-9]{1,40}$/.test(body.action)) {
    return fail('Action không hợp lệ', 400);
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        key: key,
        action: body.action,
        id: body.id,
        data: body.data,
      }),
      cache: 'no-store',
      redirect: 'follow',
    });

    const text = await r.text();
    let out;
    try {
      out = JSON.parse(text);
    } catch (e) {
      return fail(
        'Apps Script trả về dữ liệu lạ. Kiểm tra lại GAS_URL và quyền truy cập "Anyone" khi triển khai.',
        502
      );
    }
    return NextResponse.json(out);
  } catch (e) {
    return fail('Không kết nối được Apps Script: ' + (e && e.message ? e.message : e), 502);
  }
}

export const COOKIE_NAME = 'ctkm_auth';

// Tạo token từ mật khẩu (chạy được cả ở middleware lẫn API route)
export async function makeToken() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return '';
  const data = new TextEncoder().encode('ctkm-registry|' + pw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

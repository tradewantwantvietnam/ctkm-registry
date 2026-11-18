'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });

      let out = null;
      try {
        out = await res.json();
      } catch (err) {
        out = null;
      }

      if (!out) {
        setError('Máy chủ trả về dữ liệu lạ (mã ' + res.status + '). Kiểm tra lại biến môi trường trên Vercel.');
        setLoading(false);
        return;
      }

      if (!out.ok) {
        setError(out.error || 'Đăng nhập thất bại');
        setLoading(false);
        return;
      }

      // Đăng nhập thành công: tải lại hẳn trang chủ
      window.location.href = '/';
    } catch (err) {
      if (err && err.name === 'AbortError') {
        setError('Quá thời gian chờ (20 giây). Thử lại hoặc kiểm tra cấu hình Vercel.');
      } else {
        setError('Lỗi kết nối, thử lại sau');
      }
      setLoading(false);
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <div className="card login-box">
      <h1>Kho chương trình khuyến mãi</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="pw">Mật khẩu</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit" disabled={loading || !password}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  );
}

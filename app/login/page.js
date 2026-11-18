'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const out = await res.json();
      if (!out.ok) {
        setError(out.error || 'Đăng nhập thất bại');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Lỗi kết nối, thử lại sau');
      setLoading(false);
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

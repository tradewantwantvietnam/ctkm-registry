'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  formatVND,
  formatDate,
  formatDateTime,
  formatPercent,
  LOAI_TAM,
  LOAI_CHOT,
} from '@/lib/format';
import { WarnBadge, StatusBadge, Progress } from '@/components/Badges';
import MoneyInput from '@/components/MoneyInput';
import FileManager from '@/components/FileManager';

function Detail() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const notice = sp.get('notice') || '';

  const [p, setP] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [cost, setCost] = useState({ chi_phi: '', loai: LOAI_TAM, ghi_chu: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [prog, lg] = await Promise.all([api('get', { id }), api('costLog', { id })]);
    setP(prog);
    setLog(lg);
    setCost({
      chi_phi: prog.loai_chi_phi ? String(Math.round(prog.chi_phi)) : '',
      loai: prog.loai_chi_phi === LOAI_CHOT ? LOAI_CHOT : LOAI_TAM,
      ghi_chu: '',
    });
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Thiếu số thông báo');
      return;
    }
    load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  async function saveCost(e) {
    e.preventDefault();
    setMsg('');
    setError('');

    if (cost.chi_phi === '') return setError('Chưa nhập chi phí');
    const locked = p.loai_chi_phi === LOAI_CHOT;
    if (locked && !cost.ghi_chu.trim()) {
      return setError('Chương trình đã chốt quyết toán. Muốn sửa phải ghi lý do vào ô ghi chú.');
    }
    if (cost.loai === LOAI_CHOT) {
      const ok = window.confirm(
        'Chốt quyết toán chương trình này với số tiền ' + formatVND(cost.chi_phi) + ' đ?'
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      await api('updateCost', {
        data: {
          so_thong_bao: p.so_thong_bao,
          chi_phi: Number(cost.chi_phi),
          loai_chi_phi: cost.loai,
          ghi_chu: cost.ghi_chu,
        },
      });
      await load();
      setMsg('Đã lưu chi phí');
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function onDelete() {
    const ok = window.confirm(
      'Ẩn chương trình ' + p.so_thong_bao + ' khỏi danh sách? (Dữ liệu vẫn được giữ trong Google Sheet)'
    );
    if (!ok) return;
    try {
      await api('delete', { id: p.so_thong_bao });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="muted">Đang tải...</div>;
  if (!p) {
    return <div className="alert alert-error">Lỗi: {error || 'Không tải được chương trình'}</div>;
  }

  const locked = p.loai_chi_phi === LOAI_CHOT;
  const hasCost = !!p.loai_chi_phi;
  const newCost = Number(cost.chi_phi || 0);
  const newRatio = p.ngan_sach > 0 ? newCost / p.ngan_sach : 0;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>
          {p.so_thong_bao} - {p.ten}
        </h1>
        <div className="row">
          <Link className="btn" href="/">
            Về danh sách
          </Link>
          <Link className="btn" href={'/edit?id=' + encodeURIComponent(p.so_thong_bao)}>
            Sửa thông tin
          </Link>
          <button className="btn btn-danger" onClick={onDelete}>
            Ẩn chương trình
          </button>
        </div>
      </div>

      {notice === 'pdf_fail' && (
        <div className="alert alert-warn">
          Đã lưu chương trình nhưng chưa tải được file PDF. Hãy tải lại ở mục "Tài liệu PDF scan" bên dưới.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {p.canh_bao === 'vuot' && (
        <div className="alert alert-error">
          <b>VƯỢT NGÂN SÁCH:</b> chi phí đã vượt {formatVND(p.so_tien_vuot)} đ ({formatPercent(p.ty_le)} ngân sách).
        </div>
      )}
      {p.canh_bao === 'sap_vuot' && (
        <div className="alert alert-warn">
          <b>SẮP VƯỢT NGÂN SÁCH:</b> chi phí đã dùng {formatPercent(p.ty_le)} ngân sách, còn lại{' '}
          {formatVND(p.ngan_sach - p.chi_phi)} đ.
        </div>
      )}
      {p.so_ngay_tre > 0 && (
        <div className="alert alert-warn">
          <b>CHƯA QUYẾT TOÁN:</b> chương trình đã kết thúc {p.so_ngay_tre} ngày nhưng chưa chốt chi phí.
        </div>
      )}

      <div className="card">
        <h2>Thông tin chương trình</h2>
        <div className="form-grid">
          <div>
            <div className="muted">Số thông báo</div>
            <div>{p.so_thong_bao}</div>
          </div>
          <div>
            <div className="muted">Trạng thái</div>
            <div className="row" style={{ gap: 4 }}>
              <StatusBadge status={p.trang_thai} />
              {p.canh_bao !== 'binh_thuong' && <WarnBadge level={p.canh_bao} />}
            </div>
          </div>
          <div>
            <div className="muted">Hình thức khuyến mãi</div>
            <div>{p.hinh_thuc || '-'}</div>
          </div>
          <div>
            <div className="muted">Thời gian chạy</div>
            <div>
              {formatDate(p.ngay_bd)} - {formatDate(p.ngay_kt)}
            </div>
          </div>
          <div>
            <div className="muted">Ngân sách dự kiến theo A&P</div>
            <div>
              <b>{formatVND(p.ngan_sach)} đ</b>
            </div>
          </div>
          <div>
            <div className="muted">Chi phí hiện tại</div>
            <div>
              {hasCost ? (
                <span>
                  <b>{formatVND(p.chi_phi)} đ</b> ({p.loai_chi_phi}, cập nhật{' '}
                  {formatDateTime(p.ngay_cap_nhat_chi_phi)})
                </span>
              ) : (
                <span className="muted">Chưa có</span>
              )}
            </div>
          </div>
          {hasCost && (
            <div className="full">
              <Progress ratio={p.ty_le} level={p.canh_bao} />
            </div>
          )}
          <div className="full">
            <div className="muted">Nội dung cơ bản</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{p.noi_dung || '-'}</div>
          </div>
          <div className="full">
            <div className="muted">Ghi chú</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{p.ghi_chu || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Cập nhật chi phí</h2>
        {locked && (
          <div className="alert alert-warn">
            Chương trình đã <b>chốt quyết toán</b>. Muốn sửa số liệu, phải ghi lý do vào ô ghi chú.
          </div>
        )}
        <form onSubmit={saveCost}>
          <div className="form-grid">
            <div>
              <label htmlFor="cp">Chi phí thực tế (đồng)</label>
              <MoneyInput
                id="cp"
                value={cost.chi_phi}
                onChange={(v) => setCost((c) => ({ ...c, chi_phi: v }))}
              />
              {cost.chi_phi !== '' && p.ngan_sach > 0 && (
                <div
                  className="hint"
                  style={{
                    color: newCost > p.ngan_sach ? '#b91c1c' : newRatio >= 0.8 ? '#b45309' : undefined,
                  }}
                >
                  {newCost > p.ngan_sach
                    ? 'Sẽ VƯỢT ngân sách ' + formatVND(newCost - p.ngan_sach) + ' đ (' + formatPercent(newRatio) + ')'
                    : newRatio >= 0.8
                    ? 'Sẽ ở mức SẮP VƯỢT (' + formatPercent(newRatio) + ' ngân sách)'
                    : 'Bằng ' + formatPercent(newRatio) + ' ngân sách'}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="loai">Loại số liệu</label>
              <select
                id="loai"
                value={cost.loai}
                onChange={(e) => setCost((c) => ({ ...c, loai: e.target.value }))}
              >
                <option value={LOAI_TAM}>{LOAI_TAM} (giữa kỳ, dùng để cảnh báo sớm)</option>
                <option value={LOAI_CHOT}>{LOAI_CHOT} (quyết toán chính thức)</option>
              </select>
            </div>
            <div className="full">
              <label htmlFor="gc">
                Ghi chú / lý do {locked ? '(bắt buộc khi sửa số đã chốt)' : '(không bắt buộc)'}
              </label>
              <input
                id="gc"
                type="text"
                value={cost.ghi_chu}
                onChange={(e) => setCost((c) => ({ ...c, ghi_chu: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu chi phí'}
            </button>
          </div>
        </form>
      </div>

      <FileManager soThongBao={p.so_thong_bao} />

      <div className="card">
        <h2>Lịch sử nhập chi phí</h2>
        {log.length === 0 ? (
          <div className="muted">Chưa có lần nhập nào</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th className="num">Chi phí</th>
                  <th>Loại</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(l.thoi_gian)}</td>
                    <td className="num">{formatVND(l.chi_phi)}</td>
                    <td>{l.loai_chi_phi}</td>
                    <td>{l.ghi_chu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProgramPage() {
  return (
    <Suspense fallback={<div className="muted">Đang tải...</div>}>
      <Detail />
    </Suspense>
  );
}

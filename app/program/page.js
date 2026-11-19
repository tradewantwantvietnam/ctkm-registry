'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ALL_REGION,
  KIEU_BS,
  formatVND,
  formatDate,
  formatDateTime,
  formatPercent,
  formatMonth,
} from '@/lib/format';
import { WarnBadge, StatusBadge, Progress } from '@/components/Badges';
import CostEntry from '@/components/CostEntry';
import FileManager from '@/components/FileManager';

function Detail() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const notice = sp.get('notice') || '';

  const [detail, setDetail] = useState(null);
  const [refs, setRefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const [d, r] = await Promise.all([api('getDetail', { id }), api('refs')]);
    setDetail(d);
    setRefs(r);
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

  async function onDelete() {
    const p = detail.program;
    const ok = window.confirm(
      'Ẩn chương trình ' + p.so_thong_bao + ' khỏi danh sách? (Dữ liệu vẫn được giữ, có thể khôi phục sau)'
    );
    if (!ok) return;
    try {
      await api('delete', { id: p.so_thong_bao });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDeleteCost(g) {
    const ok = window.confirm('Xóa lần nhập chi phí này (' + g.items.length + ' khoản)? Số liệu sẽ được tính lại.');
    if (!ok) return;
    setError('');
    setMsg('');
    try {
      await api('deleteCost', { data: { lan_nhap: g.lan_nhap } });
      await load();
      setMsg('Đã xóa lần nhập chi phí');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="muted">Đang tải...</div>;
  if (!detail) {
    return <div className="alert alert-error">Lỗi: {error || 'Không tải được chương trình'}</div>;
  }

  const p = detail.program;
  const vuotMonths = p.thang_ds.filter((m) => m.canh_bao === 'vuot');
  const sapMonths = p.thang_ds.filter((m) => m.canh_bao === 'sap_vuot');
  const treMonths = p.thang_ds.filter((m) => m.so_ngay_tre > 0);

  // Gom các dòng chi phí theo lần nhập, mới nhất lên đầu
  const map = {};
  const order = [];
  detail.costs.forEach((c) => {
    if (!map[c.lan_nhap]) {
      map[c.lan_nhap] = { ...c, items: [] };
      order.push(c.lan_nhap);
    }
    map[c.lan_nhap].items.push(c);
  });
  const groups = order.map((k) => map[k]).sort((a, b) => (a.ngay_nhap < b.ngay_nhap ? 1 : -1));

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
            Sửa thông tin và ngân sách
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

      {vuotMonths.length > 0 && (
        <div className="alert alert-error">
          <b>VƯỢT NGÂN SÁCH:</b>{' '}
          {vuotMonths.map((m) => formatMonth(m.thang) + ' vượt ' + formatVND(m.so_tien_vuot) + ' đ').join('; ')}.
        </div>
      )}
      {sapMonths.length > 0 && (
        <div className="alert alert-warn">
          <b>SẮP VƯỢT NGÂN SÁCH:</b>{' '}
          {sapMonths.map((m) => formatMonth(m.thang) + ' đã dùng ' + formatPercent(m.ty_le)).join('; ')}.
        </div>
      )}
      {treMonths.length > 0 && (
        <div className="alert alert-warn">
          <b>CHƯA QUYẾT TOÁN:</b>{' '}
          {treMonths.map((m) => formatMonth(m.thang) + ' trễ ' + m.so_ngay_tre + ' ngày').join('; ')}.
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
            <div className="muted">Tổng ngân sách A&P</div>
            <div>
              <b>{formatVND(p.ngan_sach)} đ</b>
            </div>
          </div>
          <div>
            <div className="muted">Tổng chi phí hiện có</div>
            <div>
              {p.co_chi_phi ? (
                <span>
                  <b>{formatVND(p.chi_phi)} đ</b> (cập nhật {formatDateTime(p.ngay_cap_nhat_chi_phi)})
                </span>
              ) : (
                <span className="muted">Chưa có</span>
              )}
            </div>
          </div>
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
        <h2>Ngân sách và chi phí theo tháng</h2>
        {p.thang_ds.length === 0 ? (
          <div className="muted">Chưa có ngân sách nào. Bấm "Sửa thông tin và ngân sách" để nhập.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Vùng</th>
                  <th className="num">Ngân sách</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Còn lại</th>
                  <th>Sử dụng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {p.thang_ds.map((m) => {
                  const regional =
                    m.vung_ds.length > 1 || (m.vung_ds[0] && m.vung_ds[0].vung !== ALL_REGION);
                  const rowCls =
                    m.canh_bao === 'vuot' ? 'row-danger' : m.canh_bao === 'sap_vuot' ? 'row-warn' : '';
                  const left = m.ngan_sach - m.chi_phi;
                  return (
                    <Fragment key={m.thang}>
                      <tr className={rowCls}>
                        <td style={{ fontWeight: 700 }}>{formatMonth(m.thang)}</td>
                        <td>{regional ? <span className="muted">Tổng tháng</span> : ALL_REGION}</td>
                        <td className="num">{formatVND(m.ngan_sach)}</td>
                        <td className="num">{m.co_chi_phi ? formatVND(m.chi_phi) : <span className="muted">Chưa có</span>}</td>
                        <td className="num" style={{ color: left < 0 ? '#b91c1c' : undefined }}>
                          {formatVND(left)}
                        </td>
                        <td>
                          {m.co_chi_phi ? (
                            <Progress ratio={m.ty_le} level={m.canh_bao} />
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            {m.da_chot ? (
                              <span className="badge badge-ok">Đã chốt</span>
                            ) : m.co_chi_phi ? (
                              <span className="badge badge-gray">Tạm tính</span>
                            ) : (
                              <span className="badge badge-gray">Chưa có chi phí</span>
                            )}
                            {m.canh_bao !== 'binh_thuong' && <WarnBadge level={m.canh_bao} />}
                            {m.so_ngay_tre > 0 && (
                              <span className="badge badge-warn">Trễ QT {m.so_ngay_tre} ngày</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {regional &&
                        m.vung_ds.map((v) => {
                          const vLeft = v.ngan_sach - v.chi_phi;
                          return (
                            <tr key={m.thang + '|' + v.vung} style={{ fontSize: 13 }}>
                              <td></td>
                              <td style={{ paddingLeft: 24 }}>{v.vung}</td>
                              <td className="num">{formatVND(v.ngan_sach)}</td>
                              <td className="num">
                                {v.co_chi_phi ? formatVND(v.chi_phi) : <span className="muted">-</span>}
                              </td>
                              <td className="num" style={{ color: vLeft < 0 ? '#b91c1c' : undefined }}>
                                {formatVND(vLeft)}
                              </td>
                              <td>
                                {v.co_chi_phi ? (
                                  <Progress ratio={v.ty_le} level={v.canh_bao} />
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </td>
                              <td>
                                {v.da_chot ? (
                                  <span className="badge badge-ok">Đã chốt</span>
                                ) : v.co_chi_phi ? (
                                  <span className="badge badge-gray">Tạm tính</span>
                                ) : (
                                  ''
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 700 }}>
                    Tổng chương trình
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatVND(p.ngan_sach)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatVND(p.chi_phi)}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatVND(p.ngan_sach - p.chi_phi)}
                  </td>
                  <td colSpan={2}>{p.co_chi_phi ? formatPercent(p.ty_le) : ''}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <CostEntry detail={detail} refs={refs} onSaved={load} />

      <FileManager soThongBao={p.so_thong_bao} />

      <div className="card">
        <h2>Lịch sử nhập chi phí</h2>
        {groups.length === 0 ? (
          <div className="muted">Chưa có lần nhập nào</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày nhập</th>
                  <th>Kiểu</th>
                  <th>Thời gian thực hiện</th>
                  <th>Chi tiết</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.lan_nhap}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(g.ngay_nhap)}</td>
                    <td>
                      {g.kieu}
                      {g.kieu === KIEU_BS && g.ly_do && <div className="muted" style={{ fontSize: 12 }}>{g.ly_do}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(g.tu_ngay)} - {formatDate(g.den_ngay)}
                    </td>
                    <td>
                      {g.items.map((it, i) => (
                        <div key={i} style={{ whiteSpace: 'nowrap' }}>
                          {formatMonth(it.thang)}
                          {it.vung !== ALL_REGION ? ' - ' + it.vung : ''}:{' '}
                          <b>
                            {g.kieu === KIEU_BS ? '+' : ''}
                            {formatVND(it.so_tien)}
                          </b>
                        </div>
                      ))}
                    </td>
                    <td>{g.ghi_chu}</td>
                    <td>
                      <button className="btn btn-small btn-danger" onClick={() => onDeleteCost(g)}>
                        Xóa
                      </button>
                    </td>
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

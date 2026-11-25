'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, openPdf, downloadPdf } from '@/lib/api';
import { formatSize, formatDateTime } from '@/lib/format';
import Modal from '@/components/Modal';

export default function PdfListModal({ program, onClose }) {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    api('listFiles', { id: program.so_thong_bao })
      .then((list) => {
        if (alive) setFiles(list);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [program.so_thong_bao]);

  async function onView(f) {
    setError('');
    setBusyId(f.file_id);
    setPct(0);
    try {
      await openPdf(f.file_id, setPct);
    } catch (e) {
      setError(e.message);
    }
    setBusyId('');
  }

  async function onDownload(f) {
    setError('');
    setBusyId(f.file_id);
    setPct(0);
    try {
      await downloadPdf(f.file_id, setPct);
    } catch (e) {
      setError(e.message);
    }
    setBusyId('');
  }

  return (
    <Modal title={'Tài liệu PDF - ' + program.so_thong_bao} onClose={onClose} maxWidth={820}>
      <div className="muted" style={{ marginBottom: 10 }}>
        {program.ten}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!files && !error && <div className="muted">Đang tải danh sách...</div>}

      {files && files.length === 0 && <div className="muted">Chương trình này chưa có tài liệu PDF nào.</div>}

      {files && files.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên tài liệu</th>
                <th>Loại</th>
                <th className="num">Dung lượng</th>
                <th>Ngày tải</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const busy = busyId === f.file_id;
                return (
                  <tr key={f.file_id}>
                    <td>{f.ten_hien_thi}</td>
                    <td>{f.loai_tai_lieu}</td>
                    <td className="num">{formatSize(f.kich_thuoc)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(f.ngay_tai)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          disabled={!!busyId}
                          onClick={() => onView(f)}
                        >
                          {busy ? 'Đang tải ' + pct + '%' : 'Xem'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={!!busyId}
                          onClick={() => onDownload(f)}
                        >
                          Tải về
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="hint" style={{ marginTop: 12 }}>
        Muốn tải thêm, sửa tên hoặc xóa tài liệu, mở{' '}
        <Link href={'/program?id=' + encodeURIComponent(program.so_thong_bao)}>trang chi tiết</Link>.
      </div>
    </Modal>
  );
}

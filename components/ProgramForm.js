'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fileToBase64, MAX_PDF_MB } from '@/lib/api';
import MoneyInput from '@/components/MoneyInput';

export default function ProgramForm({ initial, isEdit }) {
  const router = useRouter();

  const [form, setForm] = useState({
    so_thong_bao: initial ? initial.so_thong_bao : '',
    ten: initial ? initial.ten : '',
    hinh_thuc: initial ? initial.hinh_thuc : '',
    ngay_bd: initial ? initial.ngay_bd : '',
    ngay_kt: initial ? initial.ngay_kt : '',
    ngan_sach: initial ? String(Math.round(initial.ngan_sach)) : '',
    noi_dung: initial ? initial.noi_dung : '',
    ghi_chu: initial ? initial.ghi_chu : '',
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Quản lý hình thức khuyến mãi
  const [types, setTypes] = useState([]);
  const [showMgr, setShowMgr] = useState(false);
  const [newType, setNewType] = useState('');
  const [editing, setEditing] = useState(null); // { old: '...', value: '...' }
  const [mgrBusy, setMgrBusy] = useState(false);
  const [mgrMsg, setMgrMsg] = useState('');
  const [mgrErr, setMgrErr] = useState('');

  function set(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  useEffect(() => {
    api('listTypes')
      .then((list) => setTypes(list))
      .catch((e) => setMgrErr('Không tải được danh sách hình thức: ' + e.message));
  }, []);

  const hinhOptions =
    !form.hinh_thuc || types.includes(form.hinh_thuc)
      ? types
      : [form.hinh_thuc, ...types];

  async function addType() {
    setMgrErr('');
    setMgrMsg('');
    const name = newType.trim();
    if (!name) {
      setMgrErr('Chưa nhập tên hình thức');
      return;
    }
    setMgrBusy(true);
    try {
      const list = await api('addType', { data: { ten: name } });
      setTypes(list);
      const found = list.find((t) => t.toLowerCase() === name.toLowerCase());
      set('hinh_thuc', found || name);
      setNewType('');
      setMgrMsg('Đã thêm hình thức "' + name + '" và chọn cho chương trình này');
    } catch (e) {
      setMgrErr(e.message);
    }
    setMgrBusy(false);
  }

  async function saveRename() {
    if (!editing) return;
    setMgrErr('');
    setMgrMsg('');
    const oldName = editing.old;
    const newName = editing.value.trim();
    if (!newName) {
      setMgrErr('Chưa nhập tên mới');
      return;
    }
    if (newName === oldName) {
      setEditing(null);
      return;
    }
    const ok = window.confirm(
      'Đổi tên hình thức "' + oldName + '" thành "' + newName + '"?\n\nTất cả chương trình đang dùng hình thức này sẽ đổi theo.'
    );
    if (!ok) return;

    setMgrBusy(true);
    try {
      const list = await api('renameType', {
        data: { ten_cu: oldName, ten_moi: newName },
      });
      setTypes(list);
      if (form.hinh_thuc === oldName) set('hinh_thuc', newName);
      setEditing(null);
      setMgrMsg('Đã đổi tên thành "' + newName + '"');
    } catch (e) {
      setMgrErr(e.message);
    }
    setMgrBusy(false);
  }

  function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    setError('');
    if (!f) {
      setFile(null);
      return;
    }
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setError('Chỉ nhận file PDF');
      e.target.value = '';
      setFile(null);
      return;
    }
    if (f.size > MAX_PDF_MB * 1024 * 1024) {
      setError('File quá lớn (tối đa ' + MAX_PDF_MB + 'MB). Hãy nén PDF rồi chọn lại.');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    const id = form.so_thong_bao.trim();
    if (!id) return setError('Chưa nhập số thông báo');
    if (!form.ten.trim()) return setError('Chưa nhập tên chương trình');
    if (!form.ngay_bd || !form.ngay_kt) return setError('Chưa chọn thời gian chạy');
    if (form.ngay_kt < form.ngay_bd) {
      return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    }
    if (form.ngan_sach === '') return setError('Chưa nhập ngân sách A&P');

    setSaving(true);
    try {
      await api(isEdit ? 'update' : 'create', {
        data: {
          so_thong_bao: id,
          ten: form.ten.trim(),
          hinh_thuc: form.hinh_thuc,
          ngay_bd: form.ngay_bd,
          ngay_kt: form.ngay_kt,
          ngan_sach: Number(form.ngan_sach),
          noi_dung: form.noi_dung,
          ghi_chu: form.ghi_chu,
        },
      });

      let notice = '';
      if (file) {
        try {
          const b64 = await fileToBase64(file);
          await api('uploadPdf', {
            data: { so_thong_bao: id, file_name: file.name, base64: b64 },
          });
        } catch (err) {
          notice = '&notice=pdf_fail';
        }
      }

      router.push('/program?id=' + encodeURIComponent(id) + notice);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-grid">
        <div>
          <label htmlFor="so_tb">Số thông báo *</label>
          <input
            id="so_tb"
            type="text"
            value={form.so_thong_bao}
            onChange={(e) => set('so_thong_bao', e.target.value)}
            readOnly={!!isEdit}
            style={isEdit ? { background: '#f3f4f6' } : undefined}
          />
          {isEdit && <div className="hint">Số thông báo không sửa được</div>}
        </div>

        <div>
          <label htmlFor="hinh_thuc">Hình thức khuyến mãi</label>
          <select
            id="hinh_thuc"
            value={form.hinh_thuc}
            onChange={(e) => set('hinh_thuc', e.target.value)}
          >
            <option value="">-- Chọn --</option>
            {hinhOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setShowMgr((v) => !v);
                setMgrErr('');
                setMgrMsg('');
                setEditing(null);
              }}
            >
              {showMgr ? 'Đóng quản lý hình thức' : 'Thêm / đổi tên hình thức'}
            </button>
          </div>
        </div>

        {showMgr && (
          <div className="full">
            <div
              style={{
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Quản lý hình thức khuyến mãi</div>

              {mgrErr && <div className="alert alert-error">{mgrErr}</div>}
              {mgrMsg && <div className="alert alert-ok">{mgrMsg}</div>}

              <label htmlFor="new_type">Thêm hình thức mới</label>
              <div className="row" style={{ marginBottom: 14 }}>
                <input
                  id="new_type"
                  type="text"
                  style={{ flex: 1, minWidth: 200 }}
                  placeholder="Ví dụ: Tích điểm đổi quà"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!mgrBusy) addType();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={mgrBusy || !newType.trim()}
                  onClick={addType}
                >
                  Thêm
                </button>
              </div>

              <div style={{ fontWeight: 600, marginBottom: 6 }}>Các hình thức hiện có</div>
              {types.length === 0 && <div className="muted">Chưa có hình thức nào</div>}
              {types.map((t) => (
                <div
                  key={t}
                  className="row"
                  style={{ marginBottom: 6, justifyContent: 'space-between' }}
                >
                  {editing && editing.old === t ? (
                    <>
                      <input
                        type="text"
                        style={{ flex: 1, minWidth: 200 }}
                        value={editing.value}
                        autoFocus
                        onChange={(e) => setEditing({ old: t, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!mgrBusy) saveRename();
                          }
                        }}
                      />
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          disabled={mgrBusy}
                          onClick={saveRename}
                        >
                          Lưu tên mới
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={mgrBusy}
                          onClick={() => setEditing(null)}
                        >
                          Hủy
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{t}</span>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={mgrBusy}
                        onClick={() => {
                          setMgrErr('');
                          setMgrMsg('');
                          setEditing({ old: t, value: t });
                        }}
                      >
                        Đổi tên
                      </button>
                    </>
                  )}
                </div>
              ))}
              <div className="hint">
                Đổi tên sẽ áp dụng cho tất cả chương trình đang dùng hình thức đó.
              </div>
            </div>
          </div>
        )

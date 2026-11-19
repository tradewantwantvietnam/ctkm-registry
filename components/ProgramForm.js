'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, uploadBigPdf, MAX_BIG_PDF_MB } from '@/lib/api';
import { LOAI_TAI_LIEU } from '@/lib/format';
import NameListManager from '@/components/NameListManager';
import BudgetEditor, {
  emptyBudgetState,
  budgetStateFrom,
  budgetsFromState,
  renameRegionInState,
} from '@/components/BudgetEditor';

export default function ProgramForm({ initial, budgets, isEdit }) {
  const router = useRouter();

  const [form, setForm] = useState({
    so_thong_bao: initial ? initial.so_thong_bao : '',
    ten: initial ? initial.ten : '',
    hinh_thuc: initial ? initial.hinh_thuc : '',
    ngay_bd: initial ? initial.ngay_bd : '',
    ngay_kt: initial ? initial.ngay_kt : '',
    noi_dung: initial ? initial.noi_dung : '',
    ghi_chu: initial ? initial.ghi_chu : '',
  });
  const [bstate, setBstate] = useState(() =>
    budgets && budgets.length ? budgetStateFrom(budgets) : emptyBudgetState()
  );

  const [types, setTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [showTypeMgr, setShowTypeMgr] = useState(false);

  const [file, setFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState(LOAI_TAI_LIEU[0]);
  const [pct, setPct] = useState(0);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  useEffect(() => {
    api('refs')
      .then((r) => {
        setTypes(r.types || []);
        setRegions(r.regions || []);
      })
      .catch((e) => setError('Không tải được danh mục: ' + e.message));
  }, []);

  const hinhOptions =
    !form.hinh_thuc || types.includes(form.hinh_thuc) ? types : [form.hinh_thuc, ...types];

  /* ----- Hình thức KM ----- */
  async function addType(name) {
    const list = await api('addType', { data: { ten: name } });
    setTypes(list);
    const found = list.find((t) => t.toLowerCase() === name.toLowerCase());
    set('hinh_thuc', found || name);
  }

  async function renameType(oldName, newName) {
    const list = await api('renameType', { data: { ten_cu: oldName, ten_moi: newName } });
    setTypes(list);
    if (form.hinh_thuc === oldName) set('hinh_thuc', newName);
  }

  /* ----- Vùng miền ----- */
  async function addRegion(name) {
    const list = await api('addRegion', { data: { ten: name } });
    setRegions(list);
    const found = list.find((t) => t.toLowerCase() === name.toLowerCase());
    setBstate((s) =>
      s.scope === 'regions' && found && !s.regions.includes(found)
        ? { ...s, regions: [...s.regions, found] }
        : s
    );
  }

  async function renameRegion(oldName, newName) {
    const list = await api('renameRegion', { data: { ten_cu: oldName, ten_moi: newName } });
    setRegions(list);
    setBstate((s) => renameRegionInState(s, oldName, newName));
  }

  /* ----- File PDF (chỉ khi thêm mới) ----- */
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
    if (f.size === 0 || f.size > MAX_BIG_PDF_MB * 1024 * 1024) {
      setError('File phải có dung lượng từ 1 byte đến ' + MAX_BIG_PDF_MB + 'MB. Hãy nén PDF rồi chọn lại.');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.pdf$/i, ''));
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
    if (file && !docName.trim()) return setError('Chưa nhập tên tài liệu cho file PDF');

    const b = budgetsFromState(bstate, form.ngay_bd, form.ngay_kt);
    if (b.error) return setError(b.error);

    setSaving(true);
    try {
      await api(isEdit ? 'update' : 'create', {
        data: {
          so_thong_bao: id,
          ten: form.ten.trim(),
          hinh_thuc: form.hinh_thuc,
          ngay_bd: form.ngay_bd,
          ngay_kt: form.ngay_kt,
          noi_dung: form.noi_dung,
          ghi_chu: form.ghi_chu,
          budgets: b.budgets,
        },
      });

      let notice = '';
      if (file && !isEdit) {
        try {
          await uploadBigPdf(
            file,
            { so_thong_bao: id, ten_hien_thi: docName.trim(), loai_tai_lieu: docType },
            setPct
          );
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
          <select id="hinh_thuc" value={form.hinh_thuc} onChange={(e) => set('hinh_thuc', e.target.value)}>
            <option value="">-- Chọn --</option>
            {hinhOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 4 }}>
            <button type="button" className="btn btn-small" onClick={() => setShowTypeMgr((v) => !v)}>
              {showTypeMgr ? 'Đóng quản lý hình thức' : 'Thêm / đổi tên hình thức'}
            </button>
          </div>
        </div>

        {showTypeMgr && (
          <div className="full">
            <NameListManager
              title="Quản lý hình thức khuyến mãi"
              items={types}
              placeholder="Ví dụ: Tích điểm đổi quà"
              onAdd={addType}
              onRename={renameType}
            />
          </div>
        )}

        <div className="full">
          <label htmlFor="ten">Tên chương trình *</label>
          <input id="ten" type="text" value={form.ten} onChange={(e) => set('ten', e.target.value)} />
        </div>

        <div>
          <label htmlFor="ngay_bd">Ngày bắt đầu *</label>
          <input id="ngay_bd" type="date" value={form.ngay_bd} onChange={(e) => set('ngay_bd', e.target.value)} />
        </div>

        <div>
          <label htmlFor="ngay_kt">Ngày kết thúc *</label>
          <input id="ngay_kt" type="date" value={form.ngay_kt} onChange={(e) => set('ngay_kt', e.target.value)} />
        </div>

        <div className="full">
          <BudgetEditor
            ngayBd={form.ngay_bd}
            ngayKt={form.ngay_kt}
            state={bstate}
            onChange={setBstate}
            regions={regions}
            onAddRegion={addRegion}
            onRenameRegion={renameRegion}
          />
        </div>

        <div className="full">
          <label htmlFor="noi_dung">Nội dung cơ bản của chương trình</label>
          <textarea id="noi_dung" value={form.noi_dung} onChange={(e) => set('noi_dung', e.target.value)} />
        </div>

        <div className="full">
          <label htmlFor="ghi_chu">Ghi chú</label>
          <input id="ghi_chu" type="text" value={form.ghi_chu} onChange={(e) => set('ghi_chu', e.target.value)} />
        </div>

        {!isEdit && (
          <div className="full">
            <div style={{ border: '1px dashed #9ca3af', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                File PDF scan (không bắt buộc, có thể tải thêm sau ở trang chi tiết)
              </div>
              <div className="form-grid">
                <div className="full">
                  <input type="file" accept="application/pdf,.pdf" onChange={onPickFile} disabled={saving} />
                  <div className="hint">Tối đa {MAX_BIG_PDF_MB}MB.</div>
                </div>
                {file && (
                  <>
                    <div>
                      <label htmlFor="doc_name">Tên tài liệu *</label>
                      <input
                        id="doc_name"
                        type="text"
                        value={docName}
                        disabled={saving}
                        onChange={(e) => setDocName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="doc_type">Loại tài liệu</label>
                      <select
                        id="doc_type"
                        value={docType}
                        disabled={saving}
                        onChange={(e) => setDocType(e.target.value)}
                      >
                        {LOAI_TAI_LIEU.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving
            ? file && pct > 0
              ? 'Đang tải PDF ' + pct + '%...'
              : 'Đang lưu...'
            : isEdit
            ? 'Lưu thay đổi'
            : 'Lưu chương trình'}
        </button>
        <button className="btn" type="button" disabled={saving} onClick={() => router.back()}>
          Hủy
        </button>
      </div>
    </form>
  );
}

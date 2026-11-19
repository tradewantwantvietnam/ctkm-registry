'use client';

import { useState } from 'react';

export default function NameListManager({ title, items, placeholder, onAdd, onRename }) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // { old, value }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function doAdd() {
    const name = newName.trim();
    setErr('');
    setMsg('');
    if (!name) {
      setErr('Chưa nhập tên');
      return;
    }
    setBusy(true);
    try {
      await onAdd(name);
      setNewName('');
      setMsg('Đã thêm "' + name + '"');
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function doRename() {
    if (!editing) return;
    setErr('');
    setMsg('');
    const oldName = editing.old;
    const nn = editing.value.trim();
    if (!nn) {
      setErr('Chưa nhập tên mới');
      return;
    }
    if (nn === oldName) {
      setEditing(null);
      return;
    }
    const ok = window.confirm(
      'Đổi tên "' + oldName + '" thành "' + nn + '"?\n\nMọi nơi đang dùng tên này sẽ đổi theo.'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await onRename(oldName, nn);
      setEditing(null);
      setMsg('Đã đổi tên thành "' + nn + '"');
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          style={{ flex: 1, minWidth: 200 }}
          placeholder={placeholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!busy) doAdd();
            }
          }}
        />
        <button type="button" className="btn btn-primary" disabled={busy || !newName.trim()} onClick={doAdd}>
          Thêm
        </button>
      </div>

      {items.length === 0 && <div className="muted">Chưa có mục nào</div>}
      {items.map((t) => (
        <div key={t} className="row" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
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
                    if (!busy) doRename();
                  }
                }}
              />
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={doRename}>
                  Lưu tên mới
                </button>
                <button type="button" className="btn btn-small" disabled={busy} onClick={() => setEditing(null)}>
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
                disabled={busy}
                onClick={() => {
                  setErr('');
                  setMsg('');
                  setEditing({ old: t, value: t });
                }}
              >
                Đổi tên
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

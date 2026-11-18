// Giới hạn file PDF (MB) - do Vercel giới hạn 4,5MB mỗi lần gửi
export const MAX_PDF_MB = 3;

// Gọi API Apps Script thông qua server Vercel (API key không lộ ra trình duyệt)
export async function api(action, payload = {}) {
  const res = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  let out;
  try {
    out = await res.json();
  } catch (e) {
    throw new Error('Lỗi kết nối máy chủ (có thể file quá lớn hoặc quá thời gian chờ)');
  }

  if (!out.ok) throw new Error(out.error || 'Lỗi không xác định');
  return out.data;
}

// Đọc file thành chuỗi base64 (bỏ phần "data:...;base64,")
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

// Mở PDF scan của chương trình trong tab mới
export async function openPdf(id) {
  const w = window.open('', '_blank');
  try {
    const d = await api('getPdf', { id });
    const url = URL.createObjectURL(base64ToBlob(d.base64));
    if (w) w.location.href = url;
    else window.location.href = url;
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}

// Tải PDF scan về máy
export async function downloadPdf(id) {
  const d = await api('getPdf', { id });
  const url = URL.createObjectURL(base64ToBlob(d.base64));
  const a = document.createElement('a');
  a.href = url;
  a.download = d.file_name || 'scan.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

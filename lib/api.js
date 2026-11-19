// Tải đơn giản (form thêm mới): tối đa 3MB do Vercel giới hạn 4,5MB mỗi lần gửi
export const MAX_PDF_MB = 3;
// Tải theo từng đoạn (trang chi tiết): tối đa 25MB
export const MAX_BIG_PDF_MB = 25;

// Mỗi đoạn 2,25MB (bội số của 256KB theo yêu cầu của Google Drive)
const CHUNK = 9 * 256 * 1024;

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
    throw new Error('Lỗi kết nối máy chủ (có thể dữ liệu quá lớn hoặc quá thời gian chờ)');
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

function bytesToBase64(bytes) {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Tải PDF lớn lên Google Drive theo từng đoạn. meta: { so_thong_bao, ten_hien_thi, loai_tai_lieu }
export async function uploadBigPdf(file, meta, onProgress) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!(head[0] === 37 && head[1] === 80 && head[2] === 68 && head[3] === 70)) {
    throw new Error('File không phải PDF thật');
  }

  const started = await api('uploadStart', {
    data: { so_thong_bao: meta.so_thong_bao, file_name: file.name, size: file.size },
  });

  let offset = 0;
  while (true) {
    const end = Math.min(offset + CHUNK, file.size);
    const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());

    const out = await api('uploadChunk', {
      data: {
        session: started.session,
        start: offset,
        total: file.size,
        base64: bytesToBase64(bytes),
        meta: {
          so_thong_bao: meta.so_thong_bao,
          ten_hien_thi: meta.ten_hien_thi,
          loai_tai_lieu: meta.loai_tai_lieu,
          ten_file_goc: file.name,
        },
      },
    });

    if (out.done) {
      if (onProgress) onProgress(100);
      return out.file;
    }
    offset = out.next > offset ? out.next : end;
    if (onProgress) onProgress(Math.min(99, Math.round((offset * 100) / file.size)));
  }
}

// Tải một file PDF từ Drive về trình duyệt theo từng đoạn
export async function getPdfBlob(fileId, onProgress) {
  const parts = [];
  let offset = 0;
  let total = 0;
  let name = 'tai-lieu.pdf';

  do {
    const d = await api('getFileChunk', {
      data: { file_id: fileId, offset: offset, length: CHUNK },
    });
    total = d.total;
    if (d.file_name) name = d.file_name;
    const bytes = base64ToBytes(d.base64);
    if (bytes.length === 0) break;
    parts.push(bytes);
    offset += bytes.length;
    if (onProgress) onProgress(total ? Math.min(100, Math.round((offset * 100) / total)) : 0);
  } while (offset < total);

  return { blob: new Blob(parts, { type: 'application/pdf' }), name };
}

// Mở PDF trong tab mới
export async function openPdf(fileId, onProgress) {
  const w = window.open('', '_blank');
  try {
    if (w) {
      w.document.write('<p style="font-family:sans-serif;padding:20px">Đang tải file PDF...</p>');
    }
  } catch (e) {}
  try {
    const { blob } = await getPdfBlob(fileId, onProgress);
    const url = URL.createObjectURL(blob);
    if (w) w.location.href = url;
    else window.location.href = url;
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}

// Tải PDF về máy
export async function downloadPdf(fileId, onProgress) {
  const { blob, name } = await getPdfBlob(fileId, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

'use client';

// Ô nhập tiền: tự thêm dấu chấm ngăn cách hàng nghìn.
// value và onChange làm việc với chuỗi chỉ gồm chữ số (ví dụ "1500000").
export default function MoneyInput({ value, onChange, placeholder, disabled, id }) {
  const digits = String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
  const shown = digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={shown}
      placeholder={placeholder || '0'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );
}

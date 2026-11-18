import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'Kho chương trình khuyến mãi',
  description: 'Quản lý chương trình khuyến mãi, ngân sách A&P và quyết toán',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

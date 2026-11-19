import './globals.css';

export const metadata = {
  title: '校园墙 · 说点什么吧',
  description: '校园里的公开小墙，匿名发帖、点赞、评论。'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0b0f',
  colorScheme: 'dark'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

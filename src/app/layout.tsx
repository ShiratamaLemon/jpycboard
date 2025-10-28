import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JPYC Distribution Dashboard',
  description: 'JPYC Token distribution across Ethereum, Polygon, and Avalanche',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}


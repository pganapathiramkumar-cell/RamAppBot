import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ram-vector.vercel.app'),
  title: {
    default: 'RamVector',
    template: '%s | RamVector',
  },
  description: 'RamVector - Intelligent document analysis platform. Upload PDFs and instantly extract summaries, action points, and workflow diagrams powered by AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

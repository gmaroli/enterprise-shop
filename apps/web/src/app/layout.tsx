import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enterprise Shop',
  description: 'Demo storefront',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          Enterprise Shop demo. Payments run in Stripe test mode only.
        </footer>
      </body>
    </html>
  );
}

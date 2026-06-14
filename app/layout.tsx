import type { Metadata } from 'next';
import { Instrument_Serif } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { RfqProvider } from '@/components/RfqProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const display = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://astspares.com'),
  title: {
    default: 'ASTSPARES — Storage-tank spare parts & RFQ',
    template: '%s · ASTSPARES',
  },
  description:
    'Part-number catalog and request-for-quote platform for storage-tank and terminal spares: rim seals, flame arrestors, PV valves, hoses and gaskets.',
  openGraph: {
    title: 'ASTSPARES',
    description: 'Storage-tank spare parts catalog with part-number search and RFQ.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = [{ href: '/products/', label: 'Catalog' }];
  return (
    <html lang="en" className={`${display.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <RfqProvider>
          <Header nav={nav} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
        </RfqProvider>
      </body>
    </html>
  );
}

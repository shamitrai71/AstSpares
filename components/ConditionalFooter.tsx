'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './Footer';

/** Renders the site footer everywhere except the full-screen globe page. */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith('/network')) return null;
  return <Footer />;
}

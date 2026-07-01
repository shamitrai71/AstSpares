'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './Footer';

/** Renders the site footer everywhere except the full-screen globe landing. */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <Footer />;
}

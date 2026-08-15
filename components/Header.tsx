'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useRfq } from './RfqProvider';
import { useAuth } from './AuthProvider';
import { RfqDrawer } from './RfqDrawer';

export interface NavItem {
  href: string;
  label: string;
}

export function Header({ nav = [] }: { nav?: NavItem[] }) {
  const { count, openDrawer } = useRfq();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const router = useRouter();

  const search = () => {
    const term = q.trim();
    if (term) router.push(`/products/?q=${encodeURIComponent(term)}`);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-paper-line bg-paper/85 backdrop-blur">
        <div className="shell flex h-16 items-center gap-2 sm:gap-4">
          <Link href="/home/" className="flex min-w-0 shrink items-center gap-2">
            <img src="/brand-icon.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <span className="truncate font-display text-lg leading-none text-petroleum sm:text-2xl">ASTSPARES</span>
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-eyebrow text-safety sm:inline">
              tank &amp; terminal spares
            </span>
          </Link>

          <Link
            href="/"
            aria-label="View the network globe"
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-petroleum-300 transition-colors hover:text-safety lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18" />
              <path d="M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
            </svg>
          </Link>

          <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-tag px-3 py-2 text-sm text-petroleum-300 transition-colors hover:text-petroleum"
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-2">
            <div className="hidden items-center sm:flex">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Part no. or keyword"
                aria-label="Search parts"
                className="field w-44 rounded-r-none"
              />
              <button onClick={search} className="btn-dark rounded-l-none px-3 py-2" aria-label="Search">
                →
              </button>
            </div>

            <Link
              href="/account/"
              className="whitespace-nowrap rounded-tag px-2 py-2 text-sm text-petroleum-300 transition-colors hover:text-petroleum sm:px-3"
            >
              {user ? 'Account' : 'Sign in'}
            </Link>

            <button onClick={openDrawer} className="btn-primary relative shrink-0 px-3 py-2 sm:px-4 sm:py-2.5">
              RFQ
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paper px-1.5 font-mono text-[11px] text-safety">
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>
      <RfqDrawer />
    </>
  );
}

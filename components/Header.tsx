'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useRfq } from './RfqProvider';
import { RfqDrawer } from './RfqDrawer';

export interface NavItem {
  href: string;
  label: string;
}

export function Header({ nav = [] }: { nav?: NavItem[] }) {
  const { count, openDrawer } = useRfq();
  const [q, setQ] = useState('');
  const router = useRouter();

  const search = () => {
    const term = q.trim();
    if (term) router.push(`/products/?q=${encodeURIComponent(term)}`);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-paper-line bg-paper/85 backdrop-blur">
        <div className="shell flex h-16 items-center gap-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl leading-none text-petroleum">ASTSPARES</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-eyebrow text-safety sm:inline">
              tank &amp; terminal spares
            </span>
          </Link>

          <div className="ml-auto hidden items-center gap-1 lg:flex">
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

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
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

            <button onClick={openDrawer} className="btn-primary relative">
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listRfqs } from '@/lib/db';
import type { RfqDoc, RfqStatus } from '@/lib/types';

const STATUSES: RfqStatus[] = ['Pending', 'Quoted', 'Won', 'Lost'];

export default function AdminDashboard() {
  const [rfqs, setRfqs] = useState<RfqDoc[] | null>(null);

  useEffect(() => {
    listRfqs().then(setRfqs).catch(() => setRfqs([]));
  }, []);

  const counts = (rfqs ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="font-display text-3xl">Pipeline</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s} className="panel p-5">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-petroleum-300">{s}</p>
            <p className="mt-1 font-display text-4xl text-petroleum">
              {rfqs === null ? '–' : counts[s] ?? 0}
            </p>
          </div>
        ))}
      </div>
      <Link href="/admin/rfqs/" className="btn-dark mt-6">Open RFQ queue →</Link>
    </div>
  );
}

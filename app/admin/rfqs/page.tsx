'use client';

import { useEffect, useState } from 'react';
import { listRfqs, setRfqStatus } from '@/lib/db';
import { getPurchaseOrder } from '@/lib/orders';
import { useAuth } from '@/components/AuthProvider';
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { QuoteThread } from '@/components/QuoteThread';
import { OnlinePoForm } from '@/components/OnlinePoForm';
import { PoView } from '@/components/PoView';
import { VendorEnquiries } from '@/components/VendorEnquiries';
import type { PurchaseOrder, RfqDoc, RfqStatus } from '@/lib/types';

const STATUSES: RfqStatus[] = ['Pending', 'Quoted', 'Negotiating', 'Won', 'Lost'];

export default function AdminRfqs() {
  const { user } = useAuth();
  const adminUid = user?.uid ?? '';
  const [rfqs, setRfqs] = useState<RfqDoc[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const load = () => listRfqs().then(setRfqs).catch(() => setRfqs([]));
  useEffect(() => { load(); }, []);

  const changeStatus = async (rfqNo: string, status: RfqStatus) => {
    await setRfqStatus(rfqNo, status);
    setRfqs((prev) => prev?.map((r) => (r.rfqNo === rfqNo ? { ...r, status } : r)) ?? null);
  };

  if (rfqs === null) return <p className="text-petroleum-300">Loading RFQs…</p>;

  return (
    <div>
      <h1 className="font-display text-3xl">RFQ queue</h1>
      {rfqs.length === 0 ? (
        <p className="mt-6 text-petroleum-300">No RFQs yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rfqs.map((r) => (
            <div key={r.rfqNo} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setOpen(open === r.rfqNo ? null : r.rfqNo)} className="text-left">
                  <span className="part-plate">{r.rfqNo}</span>
                  <p className="mt-1.5 text-sm text-petroleum">
                    {r.contact.company} — {r.contact.name} ·{' '}
                    <span className="text-petroleum-300">{r.items.length} item{r.items.length === 1 ? '' : 's'}</span>
                    {r.channel === 'offline' && <span className="eyebrow ml-2 text-petroleum-300">offline</span>}
                  </p>
                </button>
                <select
                  value={r.status}
                  onChange={(e) => changeStatus(r.rfqNo, e.target.value as RfqStatus)}
                  className="field w-36"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {open === r.rfqNo && (
                <div className="mt-4 border-t border-paper-line pt-4">
                  <p className="text-sm text-petroleum-300">
                    <a href={`mailto:${r.contact.email}`} className="text-safety-600 hover:underline">
                      {r.contact.email}
                    </a>
                    {r.contact.phone ? ` · ${r.contact.dialCode ?? ''} ${r.contact.phone}` : ''}
                    {r.contact.country ? ` · ${r.contact.country}` : ''}
                  </p>
                  {r.message && <p className="mt-2 text-sm text-petroleum-ink/90">“{r.message}”</p>}
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="text-left font-mono text-[11px] uppercase tracking-eyebrow text-petroleum-300">
                        <th className="py-1">Part</th>
                        <th className="py-1">Qty</th>
                        <th className="py-1">Required by</th>
                        <th className="py-1">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((it) => (
                        <tr key={it.partNumber} className="border-t border-paper-line">
                          <td className="py-2 font-mono">{it.partNumber}</td>
                          <td className="py-2">{it.quantity}{it.uom ? ` ${it.uom}` : ''}</td>
                          <td className="py-2">{it.requiredBy ?? '—'}</td>
                          <td className="py-2 text-petroleum-300">{it.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <QuoteBuilder
                    rfq={r}
                    adminUid={adminUid}
                    onPosted={() => { setBump((b) => b + 1); load(); }}
                  />
                  <QuoteThread
                    rfqNo={r.rfqNo}
                    role="admin"
                    uid={adminUid}
                    name="ASTSPARES"
                    rfqStatus={r.status}
                    bump={bump}
                    onChanged={load}
                  />

                  <VendorEnquiries rfqNo={r.rfqNo} />

                  {r.status === 'Won' && (
                    <div className="mt-4 border-t border-paper-line pt-4">
                      <p className="field-label">Purchase order</p>
                      <AdminPoSection rfq={r} adminUid={adminUid} onChanged={load} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPoSection({ rfq, adminUid, onChanged }: { rfq: RfqDoc; adminUid: string; onChanged: () => void }) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(rfq.poNumber));

  useEffect(() => {
    if (rfq.poNumber) {
      setLoading(true);
      getPurchaseOrder(rfq.poNumber).then(setPo).catch(() => setPo(null)).finally(() => setLoading(false));
    } else {
      setPo(null);
    }
  }, [rfq.poNumber]);

  if (rfq.poNumber) {
    if (loading) return <p className="mt-2 text-sm text-petroleum-300">Loading PO…</p>;
    return po ? <div className="mt-2"><PoView po={po} /></div> : <p className="mt-2 text-sm text-petroleum-300">PO {rfq.poNumber}.</p>;
  }
  return <OnlinePoForm rfq={rfq} adminUid={adminUid} onIssued={onChanged} />;
}

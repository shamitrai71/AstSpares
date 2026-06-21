'use client';

import { useEffect, useState } from 'react';
import { listQuotes } from '@/lib/quotes';
import { createOnlinePo } from '@/lib/orders';
import { DEFAULT_CURRENCY } from '@/lib/currencies';
import type { PoStatus, RfqDoc } from '@/lib/types';

type Line = { partNumber: string; description: string; quantity: number; unitPrice: number };
const PO_STATUSES: PoStatus[] = ['issued', 'acknowledged', 'fulfilled', 'closed', 'cancelled'];

export function OnlinePoForm({ rfq, adminUid, onIssued }: { rfq: RfqDoc; adminUid: string; onIssued: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [po, setPo] = useState({ buyerPoNumber: '', orderDate: '', requiredDate: '', deliveryTerms: '', paymentTerms: '', notes: '', status: 'issued' as PoStatus });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Prefill from the accepted (or latest live) quote.
  useEffect(() => {
    listQuotes(rfq.rfqNo)
      .then((quotes) => {
        const q = quotes.find((x) => x.id === rfq.acceptedQuoteId) ?? quotes.find((x) => x.status === 'sent') ?? quotes[0];
        if (q) {
          setCurrency(q.currency);
          setLines(q.lineItems.map((l) => ({ partNumber: l.partNumber ?? '', description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })));
        } else {
          setLines(rfq.items.map((it) => ({ partNumber: it.partNumber === '—' ? '' : it.partNumber, description: it.productName, quantity: it.quantity, unitPrice: 0 })));
        }
      })
      .catch(() => setLines([]))
      .finally(() => setReady(true));
  }, [rfq]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;

  const issue = async () => {
    setBusy(true);
    try {
      await createOnlinePo({
        adminUid,
        rfqNo: rfq.rfqNo,
        buyerUid: rfq.buyerUid ?? null,
        buyerId: rfq.buyerId,
        companyId: rfq.companyId,
        companyName: rfq.contact.company,
        locationId: rfq.locationId,
        contact: rfq.contact,
        currency,
        items: lines.filter((l) => l.description.trim()).map((l) => ({ partNumber: l.partNumber || undefined, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
        buyerPoNumber: po.buyerPoNumber || undefined,
        orderDate: po.orderDate || undefined,
        requiredDate: po.requiredDate || undefined,
        deliveryTerms: po.deliveryTerms || undefined,
        paymentTerms: po.paymentTerms || undefined,
        notes: po.notes || undefined,
        status: po.status,
        documentUrl: rfq.buyerPoDocUrl,
        documentPath: rfq.buyerPoDocPath,
        uploadedBy: rfq.buyerPoDocUrl ? 'buyer' : undefined,
        file,
      });
      onIssued();
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <p className="mt-3 text-sm text-petroleum-300">Loading…</p>;

  return (
    <div className="mt-3 rounded-tag border border-paper-line bg-white p-4">
      <p className="field-label">Issue purchase order</p>
      {rfq.buyerPoDocUrl ? (
        <p className="mt-1 text-xs text-petroleum-300">
          Buyer uploaded a PO document —{' '}
          <a href={rfq.buyerPoDocUrl} target="_blank" rel="noopener noreferrer" className="text-safety-600 underline">view</a>.
          It will be attached unless you upload a replacement below.
        </p>
      ) : (
        <p className="mt-1 text-xs text-petroleum-300">No buyer document yet — you can upload one below.</p>
      )}

      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input value={l.partNumber} onChange={(e) => setLine(i, { partNumber: e.target.value })} placeholder="Part #" className="field col-span-3" />
            <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" className="field col-span-5" />
            <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="field col-span-2" />
            <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} placeholder="Unit" className="field col-span-2" />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="field-label">Buyer’s PO number</span>
          <input value={po.buyerPoNumber} onChange={(e) => setPo({ ...po, buyerPoNumber: e.target.value })} className="field" /></label>
        <label className="block"><span className="field-label">Status</span>
          <select value={po.status} onChange={(e) => setPo({ ...po, status: e.target.value as PoStatus })} className="field">
            {PO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <label className="block"><span className="field-label">Order date</span>
          <input type="date" value={po.orderDate} onChange={(e) => setPo({ ...po, orderDate: e.target.value })} className="field" /></label>
        <label className="block"><span className="field-label">Required by</span>
          <input type="date" value={po.requiredDate} onChange={(e) => setPo({ ...po, requiredDate: e.target.value })} className="field" /></label>
        <label className="block"><span className="field-label">Delivery terms</span>
          <input value={po.deliveryTerms} onChange={(e) => setPo({ ...po, deliveryTerms: e.target.value })} className="field" /></label>
        <label className="block"><span className="field-label">Payment terms</span>
          <input value={po.paymentTerms} onChange={(e) => setPo({ ...po, paymentTerms: e.target.value })} className="field" /></label>
      </div>
      <label className="mt-2 block"><span className="field-label">Notes</span>
        <textarea rows={2} value={po.notes} onChange={(e) => setPo({ ...po, notes: e.target.value })} className="field resize-none" /></label>
      <label className="mt-2 block"><span className="field-label">Replace / attach document (optional)</span>
        <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-petroleum-300" /></label>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-petroleum-300">Total <span className="font-display text-base text-petroleum">{currency} {total.toLocaleString()}</span></span>
        <button onClick={issue} disabled={busy} className="btn-primary">{busy ? 'Issuing…' : 'Issue PO'}</button>
      </div>
    </div>
  );
}

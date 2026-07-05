'use client';

import { useState } from 'react';
import { createQuote } from '@/lib/quotes';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies';
import { DEFAULT_UOM } from '@/lib/uom';
import type { RfqDoc } from '@/lib/types';

type Line = { partNumber: string; description: string; quantity: number; uom: string; unitPrice: number };

export function QuoteBuilder({
  rfq,
  adminUid,
  defaultCurrency,
  onPosted,
}: {
  rfq: RfqDoc;
  adminUid: string;
  defaultCurrency?: string;
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(defaultCurrency || DEFAULT_CURRENCY);
  const [lines, setLines] = useState<Line[]>(
    rfq.items.map((it) => ({
      partNumber: it.partNumber === '—' ? '' : it.partNumber,
      description: it.productName,
      quantity: it.quantity,
      uom: it.uom || DEFAULT_UOM,
      unitPrice: 0,
    })),
  );
  const [leadTime, setLeadTime] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;

  const post = async () => {
    setBusy(true);
    try {
      await createQuote(
        rfq.rfqNo,
        {
          currency,
          items: lines.filter((l) => l.description.trim()).map((l) => ({
            partNumber: l.partNumber || undefined,
            description: l.description,
            quantity: l.quantity,
            uom: l.uom || undefined,
            unitPrice: l.unitPrice,
          })),
          leadTime,
          validUntil,
          terms,
          notes,
        },
        adminUid,
      );
      setOpen(false);
      onPosted();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mt-3">
        {rfq.status === 'Pending' ? 'Post a budgetary quote' : 'Post a revised quote'}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-tag border border-paper-line bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="field-label">New quote</p>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field w-28 py-1">
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input value={l.partNumber} onChange={(e) => setLine(i, { partNumber: e.target.value })} placeholder="Part #" className="field col-span-3" />
            <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" className="field col-span-4" />
            <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="field col-span-2" />
            <input value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value.toUpperCase() })} placeholder="UoM" className="field col-span-1 px-1 text-center text-xs" />
            <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} placeholder="Unit" className="field col-span-2" />
          </div>
        ))}
        <button onClick={() => setLines([...lines, { partNumber: '', description: '', quantity: 1, uom: DEFAULT_UOM, unitPrice: 0 }])} className="text-xs text-safety-600 underline">+ Add line</button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="Lead time (e.g. 6–8 weeks)" className="field" />
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="field" />
        <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms (e.g. EXW, 30% advance)" className="field sm:col-span-2" />
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to the buyer" className="field resize-none sm:col-span-2" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-petroleum-300">Total <span className="font-display text-base text-petroleum">{currency} {total.toLocaleString()}</span></span>
        <div className="flex gap-2">
          <button onClick={post} disabled={busy} className="btn-primary">{busy ? 'Posting…' : 'Post quote'}</button>
          <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

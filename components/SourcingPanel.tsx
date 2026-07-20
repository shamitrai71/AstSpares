'use client';

import { useEffect, useState } from 'react';
import {
  listVendors,
  listOfferings,
  createOffering,
  updateOffering,
  deleteOffering,
  setPreferredOffering,
} from '@/lib/vendors';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies';
import type { Vendor, VendorOffering } from '@/lib/types';

type Form = {
  id?: string;
  vendorId: string;
  vendorPartNo: string;
  hsn: string;
  cost: string;
  currency: string;
  leadTimeDays: string;
  moq: string;
  stockQty: string;
  notes: string;
};

const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));

export function SourcingPanel({ itemPartNumber, defaultHsn }: { itemPartNumber: string; defaultHsn?: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [offerings, setOfferings] = useState<VendorOffering[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => setOfferings(await listOfferings(itemPartNumber));
  useEffect(() => {
    listVendors().then(setVendors).catch(() => setVendors([]));
    reload().catch(() => setOfferings([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemPartNumber]);

  const startAdd = () =>
    setForm({ vendorId: vendors[0]?.id ?? '', vendorPartNo: '', hsn: defaultHsn ?? '', cost: '', currency: DEFAULT_CURRENCY, leadTimeDays: '', moq: '', stockQty: '', notes: '' });
  const startEdit = (o: VendorOffering) =>
    setForm({
      id: o.id,
      vendorId: o.vendorId,
      vendorPartNo: o.vendorPartNo ?? '',
      hsn: o.hsn ?? defaultHsn ?? '',
      cost: String(o.cost),
      currency: o.currency,
      leadTimeDays: o.leadTimeDays != null ? String(o.leadTimeDays) : '',
      moq: o.moq != null ? String(o.moq) : '',
      stockQty: o.stockQty != null ? String(o.stockQty) : '',
      notes: o.notes ?? '',
    });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || !form.vendorId || form.cost.trim() === '') return;
    setBusy(true);
    try {
      const vendorName = vendors.find((v) => v.id === form.vendorId)?.name ?? form.vendorId;
      if (form.id) {
        await updateOffering(form.id, {
          vendorId: form.vendorId,
          vendorName,
          vendorPartNo: form.vendorPartNo.trim() || undefined,
          hsn: form.hsn.trim() || undefined,
          cost: Number(form.cost),
          currency: form.currency,
          leadTimeDays: num(form.leadTimeDays),
          moq: num(form.moq),
          stockQty: num(form.stockQty),
          notes: form.notes.trim() || undefined,
        });
      } else {
        await createOffering({
          itemPartNumber,
          vendorId: form.vendorId,
          vendorName,
          vendorPartNo: form.vendorPartNo,
          hsn: form.hsn,
          cost: Number(form.cost),
          currency: form.currency,
          leadTimeDays: num(form.leadTimeDays),
          moq: num(form.moq),
          stockQty: num(form.stockQty),
          notes: form.notes,
        });
      }
      setForm(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const makePreferred = async (id: string) => { setBusy(true); try { await setPreferredOffering(itemPartNumber, id); await reload(); } finally { setBusy(false); } };
  const remove = async (id: string) => { if (!confirm('Remove this offering?')) return; setBusy(true); try { await deleteOffering(id); await reload(); } finally { setBusy(false); } };

  return (
    <div className="rounded-tag border border-paper-line bg-paper-200/50 p-4">
      <div className="flex items-center justify-between">
        <span className="field-label">Sourcing (vendors) — backend only</span>
        {!form && <button onClick={startAdd} className="btn-ghost px-3 py-1.5 text-sm">+ Add offering</button>}
      </div>

      {vendors.length === 0 && (
        <p className="mt-2 text-xs text-safety-600">No vendors yet — add them under Admin → Vendors first.</p>
      )}

      {/* List */}
      {offerings === null ? (
        <p className="mt-2 text-sm text-petroleum-300">Loading…</p>
      ) : offerings.length === 0 ? (
        <p className="mt-2 text-sm text-petroleum-300">No vendor offerings yet for {itemPartNumber}.</p>
      ) : (
        <ul className="mt-2 divide-y divide-paper-line">
          {offerings.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <button
                  onClick={() => makePreferred(o.id)}
                  title={o.isPreferred ? 'Preferred source' : 'Make preferred'}
                  className={o.isPreferred ? 'text-safety' : 'text-petroleum-300 hover:text-safety'}
                >
                  {o.isPreferred ? '★' : '☆'}
                </button>
                <span className="ml-2 font-medium">{o.vendorName}</span>
                {o.vendorPartNo && <span className="ml-2 font-mono text-xs text-petroleum-300">{o.vendorPartNo}</span>}
                {o.hsn && o.hsn !== defaultHsn && (
                  <span className="ml-2 rounded-full bg-safety-200 px-1.5 py-0.5 font-mono text-[11px] text-safety-600" title="HSN differs from this item's default">
                    HSN {o.hsn}
                  </span>
                )}
                <span className="ml-2 text-petroleum-300">
                  · {o.currency} {o.cost.toLocaleString()}
                  {o.leadTimeDays != null && ` · ${o.leadTimeDays}d`}
                  {o.moq != null && ` · MOQ ${o.moq}`}
                  {o.stockQty != null && ` · stock ${o.stockQty}`}
                </span>
              </span>
              <span className="whitespace-nowrap">
                <button onClick={() => startEdit(o)} className="text-xs text-petroleum-300 underline hover:text-petroleum">Edit</button>
                <button onClick={() => remove(o.id)} className="ml-3 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit form */}
      {form && (
        <div className="mt-3 rounded-tag border border-paper-line bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Vendor</span>
              <select value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)} className="field">
                <option value="">— Select —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Vendor part no.</span>
              <input value={form.vendorPartNo} onChange={(e) => set('vendorPartNo', e.target.value)} className="field font-mono text-xs" />
            </label>
            <label className="block">
              <span className="field-label">HSN {defaultHsn ? '(overrides item default)' : ''}</span>
              <input
                value={form.hsn}
                onChange={(e) => set('hsn', e.target.value)}
                placeholder={defaultHsn || 'e.g. 84818049'}
                className="field font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="field-label">Cost *</span>
              <input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Currency</span>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="field">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Lead time (days)</span>
              <input type="number" min={0} value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">MOQ</span>
              <input type="number" min={0} value={form.moq} onChange={(e) => set('moq', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Stock qty</span>
              <input type="number" min={0} value={form.stockQty} onChange={(e) => set('stockQty', e.target.value)} className="field" />
            </label>
          </div>
          <label className="mt-2 block">
            <span className="field-label">Notes</span>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="field" />
          </label>
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy || !form.vendorId || form.cost.trim() === ''} className="btn-primary px-3 py-1.5 text-sm">
              {busy ? 'Saving…' : form.id ? 'Update offering' : 'Add offering'}
            </button>
            <button onClick={() => setForm(null)} className="btn-ghost px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

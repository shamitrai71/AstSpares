'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { listVendors, createVendor, updateVendor, deleteVendor } from '@/lib/vendors';
import type { Vendor, VendorType } from '@/lib/types';

const TYPES: VendorType[] = ['manufacturer', 'distributor', 'partner', 'other'];

type Draft = {
  id?: string;
  name: string;
  type: VendorType;
  country: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  defaultLeadTimeDays: string;
  notes: string;
  active: boolean;
};

const blank = (): Draft => ({
  name: '',
  type: 'manufacturer',
  country: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  defaultLeadTimeDays: '',
  notes: '',
  active: true,
});

const toDraft = (v: Vendor): Draft => ({
  id: v.id,
  name: v.name,
  type: v.type ?? 'other',
  country: v.country ?? '',
  contactName: v.contactName ?? '',
  contactEmail: v.contactEmail ?? '',
  phone: v.phone ?? '',
  defaultLeadTimeDays: v.defaultLeadTimeDays != null ? String(v.defaultLeadTimeDays) : '',
  notes: v.notes ?? '',
  active: v.active,
});

export default function AdminVendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => listVendors().then(setVendors).catch(() => setVendors([]));
  useEffect(() => { load(); }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Vendor name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      const lead = draft.defaultLeadTimeDays ? Number(draft.defaultLeadTimeDays) : undefined;
      if (draft.id) {
        await updateVendor(draft.id, {
          name: draft.name.trim(),
          type: draft.type,
          country: draft.country.trim() || undefined,
          contactName: draft.contactName.trim() || undefined,
          contactEmail: draft.contactEmail.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          defaultLeadTimeDays: lead,
          notes: draft.notes.trim() || undefined,
          active: draft.active,
        });
      } else {
        await createVendor(
          {
            name: draft.name,
            type: draft.type,
            country: draft.country,
            contactName: draft.contactName,
            contactEmail: draft.contactEmail,
            phone: draft.phone,
            defaultLeadTimeDays: lead,
            notes: draft.notes,
          },
          user?.uid ?? '',
        );
      }
      await load();
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: Vendor) => {
    if (!confirm(`Delete vendor ${v.id} — ${v.name}? (Its offerings on products will be left dangling.)`)) return;
    setBusy(true);
    try {
      await deleteVendor(v.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (vendors === null) return <p className="text-petroleum-300">Loading vendors…</p>;

  if (draft) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">{draft.id ? `Edit ${draft.id}` : 'New vendor'}</h1>
          <button onClick={() => setDraft(null)} className="btn-ghost">Back</button>
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Name *</span>
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Type</span>
              <select value={draft.type} onChange={(e) => set('type', e.target.value as VendorType)} className="field">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Country</span>
              <input value={draft.country} onChange={(e) => set('country', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Default lead time (days)</span>
              <input type="number" min={0} value={draft.defaultLeadTimeDays} onChange={(e) => set('defaultLeadTimeDays', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Contact name</span>
              <input value={draft.contactName} onChange={(e) => set('contactName', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Contact email</span>
              <input value={draft.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Phone</span>
              <input value={draft.phone} onChange={(e) => set('phone', e.target.value)} className="field" />
            </label>
            <label className="flex items-end gap-2 text-sm text-petroleum">
              <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} className="accent-safety" />
              Active
            </label>
          </div>
          <label className="block">
            <span className="field-label">Notes</span>
            <textarea rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} className="field resize-none" />
          </label>
          {error && <p className="text-sm text-safety-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save vendor'}</button>
            <button onClick={() => setDraft(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Vendors</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-petroleum-300">{vendors.length} vendors</p>
          <button onClick={() => { setError(''); setDraft(blank()); }} className="btn-primary">New vendor</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-petroleum-300">Backend only — vendors and costs never appear on the public catalog.</p>

      {vendors.length === 0 ? (
        <p className="mt-6 text-petroleum-300">No vendors yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-eyebrow text-petroleum-300">
                <th className="py-2">ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Country</th>
                <th className="py-2">Active</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-t border-paper-line">
                  <td className="py-2 font-mono">{v.id}</td>
                  <td className="py-2">{v.name}</td>
                  <td className="py-2 text-petroleum-300">{v.type ?? '—'}</td>
                  <td className="py-2 text-petroleum-300">{v.country ?? '—'}</td>
                  <td className="py-2">{v.active ? 'Yes' : 'No'}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => { setError(''); setDraft(toDraft(v)); }} className="text-xs text-petroleum-300 underline hover:text-petroleum">Edit</button>
                    <button onClick={() => remove(v)} className="ml-3 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

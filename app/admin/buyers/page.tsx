'use client';

import { useEffect, useState } from 'react';
import {
  listAllBuyers,
  updateBuyer,
  adminCreateBuyer,
  setBuyerDisabled,
  deleteBuyerAccount,
  listCompanies,
} from '@/lib/buyers';
import type { Buyer, Company } from '@/lib/types';

export default function AdminBuyers() {
  const [buyers, setBuyers] = useState<Buyer[] | null>(null);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => listAllBuyers().then(setBuyers).catch(() => setBuyers([]));
  useEffect(() => { load(); }, []);

  const toggleDisabled = async (b: Buyer) => {
    const next = !b.disabled;
    if (!confirm(`${next ? 'Disable' : 'Enable'} sign-in for ${b.name} (${b.id})?`)) return;
    setBusyId(b.id);
    try { await setBuyerDisabled(b.id, next); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusyId(null); }
  };

  const remove = async (b: Buyer) => {
    if (!confirm(`Delete ${b.name} (${b.id}) and their sign-in account? The buyer number is retired and never reused. Quotes/RFQs that reference this buyer will keep the number but lose the linked record. Consider "Disable" instead.`)) return;
    setBusyId(b.id);
    try { await deleteBuyerAccount(b.id); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Buyers</h1>
        <button onClick={() => { setEditing(null); setCreating(true); }} className="btn-primary">New buyer</button>
      </div>
      <p className="mt-1 text-sm text-petroleum-300">
        Everyone who has registered (online) or been entered by an admin. Create a buyer with an
        email + initial password so they can sign in to see quotations for offline enquiries.
        Disable or delete removes access; the allocated number is never reused.
      </p>

      {creating && (
        <BuyerCreator
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}

      {editing && (
        <BuyerEditor
          buyer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="panel mt-6 divide-y divide-paper-line">
        {!buyers && <p className="p-4 text-sm text-petroleum-300">Loading…</p>}
        {buyers?.length === 0 && <p className="p-4 text-sm text-petroleum-300">No buyers yet.</p>}
        {buyers?.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-petroleum">{b.name}</span>
                <span className={`eyebrow ${b.channel === 'offline' ? 'text-petroleum-300' : 'text-safety-600'}`}>{b.channel}</span>
                {b.disabled && <span className="eyebrow text-safety-600">disabled</span>}
                {!b.verified && <span className="eyebrow text-safety-600">unverified</span>}
                {b.uid ? null : <span className="eyebrow text-petroleum-300">no login</span>}
              </div>
              <p className="mt-0.5 truncate text-xs text-petroleum-300">
                {b.id} · {b.email} · {b.companyName}{b.locationName ? ` / ${b.locationName}` : ''}
                {b.designation ? ` · ${b.designation}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <button onClick={() => { setCreating(false); setEditing(b); }} className="text-safety-600 underline">Edit</button>
              {b.uid && (
                <button onClick={() => toggleDisabled(b)} disabled={busyId === b.id} className="text-petroleum-300 underline hover:text-petroleum">
                  {b.disabled ? 'Enable' : 'Disable'}
                </button>
              )}
              <button onClick={() => remove(b)} disabled={busyId === b.id} className="text-petroleum-300 underline hover:text-safety">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyerCreator({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listCompanies().then(setCompanies).catch(() => setCompanies([])); }, []);

  const save = async () => {
    const company = companies.find((c) => c.id === companyId);
    if (!email.trim() || password.length < 6 || !name.trim() || !company) {
      setError('Email, a 6+ character password, name, and company are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await adminCreateBuyer({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim() || undefined,
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        country: country.trim() || undefined,
        companyId: company.id,
        companyName: company.name,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create buyer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <h2 className="font-display text-2xl">New buyer</h2>
      <p className="mt-1 text-xs text-petroleum-300">
        Creates a sign-in account (email + initial password) and a buyer number. Share the password
        with the buyer; they can change it after signing in.
      </p>

      {companies.length === 0 && (
        <p className="mt-3 text-xs text-safety-600">No companies yet — add one under Companies first.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Email *</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="field" type="email" />
        </label>
        <label className="block">
          <span className="field-label">Initial password * (min 6)</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="field" type="text" />
        </label>
        <label className="block">
          <span className="field-label">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Company *</span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="field">
            <option value="">— Select —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Country</span>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Designation</span>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Department</span>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="field" />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-safety-600">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={busy || companies.length === 0} className="btn-primary">{busy ? 'Creating…' : 'Create buyer'}</button>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function BuyerEditor({ buyer, onClose, onSaved }: { buyer: Buyer; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(buyer.name);
  const [designation, setDesignation] = useState(buyer.designation ?? '');
  const [department, setDepartment] = useState(buyer.department ?? '');
  const [phone, setPhone] = useState(buyer.phone ?? '');
  const [verified, setVerified] = useState(buyer.verified);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateBuyer(buyer.id, {
        name: name.trim(),
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        phone: phone.trim() || undefined,
        verified,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Edit — {buyer.name}</h2>
        <span className="font-mono text-xs text-petroleum-300">{buyer.id}</span>
      </div>
      <p className="mt-1 text-xs text-petroleum-300">
        {buyer.companyName}{buyer.locationName ? ` / ${buyer.locationName}` : ''} · {buyer.country ?? '—'} · {buyer.channel}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Designation</span>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Department</span>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="field" />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        Verified
      </label>

      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BuyerGate } from '@/components/BuyerGate';
import { useAuth } from '@/components/AuthProvider';
import { updateBuyerProfile } from '@/lib/buyers';
import { COUNTRIES } from '@/lib/countries';

export default function AccountPage() {
  return (
    <BuyerGate>
      <AccountHome />
    </BuyerGate>
  );
}

function AccountHome() {
  const { buyer, isAdmin, refreshBuyer } = useAuth();
  const [editing, setEditing] = useState(false);
  if (!buyer) return null;

  const phoneDisplay = buyer.phone ? `${buyer.dialCode ?? ''} ${buyer.phone}`.trim() : '—';

  return (
    <div className="shell py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="mt-2 font-display text-4xl">{buyer.name}</h1>
          <p className="mt-1 text-sm text-petroleum-300">
            {buyer.email}
            {buyer.designation ? ` · ${buyer.designation}` : ''}
            {buyer.department ? ` · ${buyer.department}` : ''}
          </p>
        </div>
        <button onClick={() => signOut(auth)} className="btn-ghost">Sign out</button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="field-label">Buyer ID</p>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-safety-600 underline">
                Edit profile
              </button>
            )}
          </div>
          <p className="part-plate mt-1">{buyer.id}</p>

          {!editing ? (
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Company" value={buyer.companyName} />
              <Row label="Site" value={buyer.locationName ?? '—'} />
              <Row label="Country" value={buyer.country ?? '—'} />
              <Row label="Phone" value={phoneDisplay} />
              <Row label="Designation" value={buyer.designation ?? '—'} />
              <Row label="Department" value={buyer.department ?? '—'} />
            </dl>
          ) : (
            <ProfileEditor onDone={async () => { await refreshBuyer(); setEditing(false); }} />
          )}
        </div>

        <div className="panel p-5">
          <p className="field-label">Your requests & quotes</p>
          <p className="mt-2 text-sm text-petroleum-300">
            Your RFQs and the budgetary quotes our team posts will appear here, where you can accept
            or negotiate. Start by building an RFQ from the catalog.
          </p>
          <Link href="/products/" className="btn-primary mt-4">Browse the catalog</Link>
        </div>
      </div>

      {isAdmin && (
        <p className="mt-6 text-sm text-petroleum-300">
          You’re an admin —{' '}
          <Link href="/admin/" className="text-safety-600 underline">open the admin panel</Link>.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-petroleum-300">{label}</dt>
      <dd className="text-right text-petroleum">{value}</dd>
    </div>
  );
}

function ProfileEditor({ onDone }: { onDone: () => Promise<void> }) {
  const { buyer } = useAuth();
  const [name, setName] = useState(buyer?.name ?? '');
  const [designation, setDesignation] = useState(buyer?.designation ?? '');
  const [department, setDepartment] = useState(buyer?.department ?? '');
  const [countryIso, setCountryIso] = useState(
    COUNTRIES.find((c) => c.name === buyer?.country)?.iso2 ?? '',
  );
  const [phone, setPhone] = useState(buyer?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const country = COUNTRIES.find((c) => c.iso2 === countryIso);

  const save = async () => {
    if (!buyer) return;
    setBusy(true);
    setErr('');
    try {
      await updateBuyerProfile(buyer.id, {
        name: name.trim(),
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        country: country?.name,
        dialCode: country?.dial,
        phone: phone.trim() || undefined,
      });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <label className="block">
        <span className="field-label">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="field-label">Designation</span>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Department</span>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="field" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Country</span>
        <select value={countryIso} onChange={(e) => setCountryIso(e.target.value)} className="field">
          <option value="">Select…</option>
          {COUNTRIES.map((c) => (
            <option key={c.iso2} value={c.iso2}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Phone</span>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-tag border border-r-0 border-paper-line bg-paper-200 px-3 text-sm text-petroleum-300">
            {country?.dial ?? '+—'}
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
            className="field rounded-l-none"
            inputMode="tel"
          />
        </div>
      </label>
      {err && <p className="text-sm text-safety-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary flex-1">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onDone} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

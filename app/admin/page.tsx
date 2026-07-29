'use client';

import { useEffect, useState } from 'react';
import {
  createCompany,
  createLocation,
  deleteCompany,
  deleteLocation,
  listCompanies,
  listLocations,
  migrateCompanyTypes,
  updateCompany,
} from '@/lib/buyers';
import { COUNTRIES } from '@/lib/countries';
import { CURRENCIES } from '@/lib/currencies';
import { useAuth } from '@/components/AuthProvider';
import { COMPANY_TYPE_OPTIONS, DEFAULT_COMPANY_TYPE, companyTypeLabel } from '@/lib/company';
import type { Company, CompanyLocation, CompanyType } from '@/lib/types';

export default function AdminCompanies() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const load = () => listCompanies().then(setCompanies).catch(() => setCompanies([]));
  useEffect(() => { load(); }, []);

  const handleMigrateTypes = async () => {
    if (!window.confirm(
      'Remap legacy company types (refinery, epc, terminal, port, inspection, consultant) ' +
      'to the master category slugs?\n\nSafe to re-run — already-migrated and local (trader/agent/other) records are skipped.'
    )) return;
    setMigrating(true);
    try {
      const { scanned, migrated } = await migrateCompanyTypes();
      load();
      alert(`Scanned ${scanned} companies — migrated ${migrated} to master slugs.`);
    } catch (err) {
      console.error('Company type migration failed:', err);
      alert(`Migration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Companies</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleMigrateTypes} disabled={migrating} className="text-sm text-safety-600 underline disabled:opacity-50">
            {migrating ? 'Migrating…' : 'Migrate types'}
          </button>
          <button onClick={() => { setEditing(null); setCreating(true); }} className="btn-primary">New company</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-petroleum-300">
        The buyer master list. Buyer-added companies arrive <em>unverified</em> — confirm or correct
        them here, set the default currency, and manage each company’s sites.
      </p>

      {creating && (
        <CompanyCreator
          adminUid={user?.uid ?? ''}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}

      {editing && (
        <CompanyEditor
          company={editing}
          adminUid={user?.uid ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="panel mt-6 divide-y divide-paper-line">
        {!companies && <p className="p-4 text-sm text-petroleum-300">Loading…</p>}
        {companies?.length === 0 && <p className="p-4 text-sm text-petroleum-300">No companies yet.</p>}
        {companies?.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-petroleum">{c.name}</span>
                {!c.verified && <span className="eyebrow text-safety-600">unverified</span>}
              </div>
              <p className="mt-0.5 text-xs text-petroleum-300">
                {c.id} · {companyTypeLabel(c.type)} · {c.country ?? '—'} · {c.defaultCurrency ?? 'no currency'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <button onClick={() => setEditing(c)} className="text-safety-600 underline">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyEditor({
  company,
  adminUid,
  onClose,
  onSaved,
}: {
  company: Company;
  adminUid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [type, setType] = useState<CompanyType>(company.type ?? DEFAULT_COMPANY_TYPE);
  const [country, setCountry] = useState(company.country ?? '');
  const [currency, setCurrency] = useState(company.defaultCurrency ?? '');
  const [verified, setVerified] = useState(company.verified);
  const [busy, setBusy] = useState(false);

  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [newLoc, setNewLoc] = useState({ name: '', city: '' });

  const loadLocs = () => listLocations(company.id).then(setLocations).catch(() => setLocations([]));
  useEffect(() => { loadLocs(); }, [company.id]);

  const save = async () => {
    setBusy(true);
    try {
      await updateCompany(company.id, {
        name: name.trim(),
        type,
        country: country.trim() || undefined,
        defaultCurrency: currency || undefined,
        verified,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${company.name} and its sites? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteCompany(company.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const addLoc = async () => {
    if (!newLoc.name.trim()) return;
    await createLocation(company.id, { name: newLoc.name, city: newLoc.city || undefined }, adminUid);
    setNewLoc({ name: '', city: '' });
    loadLocs();
  };

  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Edit — {company.name}</h2>
        <span className="font-mono text-xs text-petroleum-300">{company.id}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className="field">
            {!COMPANY_TYPE_OPTIONS.some((o) => o.code === type) && <option value={type}>{companyTypeLabel(type)}</option>}
            {COMPANY_TYPE_OPTIONS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="field">
            <option value="">—</option>
            {COUNTRIES.map((c) => <option key={c.iso2} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Default currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
            <option value="">—</option>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        Verified
      </label>

      {/* Locations */}
      <div className="mt-5">
        <p className="field-label">Sites</p>
        <div className="mt-1 divide-y divide-paper-line rounded-tag border border-paper-line">
          {locations.length === 0 && <p className="p-3 text-sm text-petroleum-300">No sites.</p>}
          {locations.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-3 text-sm">
              <span>{l.name}{l.city ? ` — ${l.city}` : ''}</span>
              <button
                onClick={async () => { await deleteLocation(company.id, l.id); loadLocs(); }}
                className="text-xs text-petroleum-300 underline hover:text-safety"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} placeholder="Site name" className="field" />
          <input value={newLoc.city} onChange={(e) => setNewLoc({ ...newLoc, city: e.target.value })} placeholder="City" className="field" />
          <button onClick={addLoc} className="btn-ghost shrink-0">Add</button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
        <button onClick={remove} disabled={busy} className="text-sm text-safety-600 underline">Delete company</button>
      </div>
    </div>
  );
}

function CompanyCreator({
  adminUid,
  onClose,
  onSaved,
}: {
  adminUid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CompanyType>(DEFAULT_COMPANY_TYPE);
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('Company name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      await createCompany(
        { name: name.trim(), type, country: country.trim() || undefined, defaultCurrency: currency || undefined },
        adminUid,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create company.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <h2 className="font-display text-2xl">New company</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className="field">
            {!COMPANY_TYPE_OPTIONS.some((o) => o.code === type) && <option value={type}>{companyTypeLabel(type)}</option>}
            {COMPANY_TYPE_OPTIONS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="field">
            <option value="">—</option>
            {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Default currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
            <option value="">—</option>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-safety-600">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create company'}</button>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  createBuyerProfile,
  createCompany,
  createLocation,
  listCompanies,
  listLocations,
} from '@/lib/buyers';
import type { Company, CompanyLocation, CompanyType } from '@/lib/types';

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'operator', label: 'Tank / terminal operator' },
  { value: 'epc', label: 'EPC contractor' },
  { value: 'oem', label: 'OEM / manufacturer' },
  { value: 'inspector', label: 'Inspector / consultant' },
  { value: 'other', label: 'Other' },
];

export function Onboarding() {
  const { user, refreshBuyer } = useAuth();

  const [name, setName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState<{ name: string; type: CompanyType; country: string }>({
    name: '',
    type: 'operator',
    country: '',
  });

  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', city: '', country: '' });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  // Load the chosen company's locations.
  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      setLocationId('');
      return;
    }
    listLocations(companyId).then(setLocations).catch(() => setLocations([]));
  }, [companyId]);

  const filtered = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies.slice(0, 8);
    return companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [companies, companyQuery]);

  const canSubmit =
    name.trim().length > 0 &&
    (addingCompany ? newCompany.name.trim().length > 0 : companyId.length > 0);

  const submit = async () => {
    if (!user) return;
    setErr('');
    setBusy(true);
    try {
      // Resolve company (existing or new).
      let cid = companyId;
      let cname = '';
      if (addingCompany) {
        const c = await createCompany(
          { name: newCompany.name, type: newCompany.type, country: newCompany.country || undefined },
          user.uid,
        );
        cid = c.id;
        cname = c.name;
      } else {
        cname = companies.find((c) => c.id === cid)?.name ?? companyQuery.trim();
      }
      if (!cid) throw new Error('Please choose or add your company.');

      // Resolve location (existing or new). Optional but encouraged.
      let lid = locationId || undefined;
      let lname: string | undefined;
      if (addingLocation && newLocation.name.trim()) {
        const l = await createLocation(
          cid,
          { name: newLocation.name, city: newLocation.city || undefined, country: newLocation.country || undefined },
          user.uid,
        );
        lid = l.id;
        lname = l.name;
      } else if (lid) {
        lname = locations.find((l) => l.id === lid)?.name;
      }

      await createBuyerProfile({
        uid: user.uid,
        email: user.email ?? '',
        name,
        phone: phone || undefined,
        companyId: cid,
        companyName: cname,
        locationId: lid,
        locationName: lname,
      });

      await refreshBuyer();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save your profile.');
      setBusy(false);
    }
  };

  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-lg p-6">
        <p className="eyebrow text-safety-600">One-time setup</p>
        <h1 className="mt-2 font-display text-3xl">Tell us who you are</h1>
        <p className="mt-2 text-sm text-petroleum-300">
          We link every quote and order to your company and site. Signed in as{' '}
          <span className="font-mono text-petroleum">{user?.email}</span>.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Your name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
            </label>
          </div>

          {/* Company */}
          <div>
            <span className="field-label">Company *</span>
            {!addingCompany ? (
              <>
                <input
                  value={companyQuery}
                  onChange={(e) => {
                    setCompanyQuery(e.target.value);
                    setCompanyId('');
                  }}
                  placeholder="Start typing to search…"
                  className="field"
                />
                {companyQuery && (
                  <ul className="mt-1 max-h-44 overflow-y-auto rounded-tag border border-paper-line bg-white">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => {
                            setCompanyId(c.id);
                            setCompanyQuery(c.name);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper-200 ${
                            companyId === c.id ? 'bg-paper-200' : ''
                          }`}
                        >
                          <span>{c.name}</span>
                          {!c.verified && <span className="eyebrow text-petroleum-300">unverified</span>}
                        </button>
                      </li>
                    ))}
                    {filtered.length === 0 && (
                      <li className="px-3 py-2 text-sm text-petroleum-300">No match.</li>
                    )}
                  </ul>
                )}
                <button
                  onClick={() => setAddingCompany(true)}
                  className="mt-1 text-xs text-safety-600 underline"
                >
                  My company isn’t listed — add it
                </button>
              </>
            ) : (
              <div className="space-y-2 rounded-tag border border-paper-line bg-white p-3">
                <input
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  placeholder="Company name"
                  className="field"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newCompany.type}
                    onChange={(e) => setNewCompany({ ...newCompany, type: e.target.value as CompanyType })}
                    className="field"
                  >
                    {COMPANY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                    placeholder="Country"
                    className="field"
                  />
                </div>
                <button onClick={() => setAddingCompany(false)} className="text-xs text-petroleum-300 underline">
                  ← Pick an existing company instead
                </button>
              </div>
            )}
          </div>

          {/* Location — shown once a company is chosen/added */}
          {(companyId || addingCompany) && (
            <div>
              <span className="field-label">Site / location</span>
              {!addingLocation ? (
                <>
                  {locations.length > 0 && !addingCompany ? (
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="field"
                    >
                      <option value="">Select a site…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                          {l.city ? ` — ${l.city}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-petroleum-300">No sites on file yet.</p>
                  )}
                  <button
                    onClick={() => setAddingLocation(true)}
                    className="mt-1 text-xs text-safety-600 underline"
                  >
                    Add a site
                  </button>
                </>
              ) : (
                <div className="space-y-2 rounded-tag border border-paper-line bg-white p-3">
                  <input
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    placeholder="Site / terminal name"
                    className="field"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newLocation.city}
                      onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                      placeholder="City"
                      className="field"
                    />
                    <input
                      value={newLocation.country}
                      onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
                      placeholder="Country"
                      className="field"
                    />
                  </div>
                  <button onClick={() => setAddingLocation(false)} className="text-xs text-petroleum-300 underline">
                    ← Pick an existing site instead
                  </button>
                </div>
              )}
            </div>
          )}

          {err && <p className="text-sm text-safety-600">{err}</p>}

          <button onClick={submit} disabled={!canSubmit || busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

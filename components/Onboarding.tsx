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
import { COUNTRIES } from '@/lib/countries';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies';
import { COMPANY_TYPE_OPTIONS, DEFAULT_COMPANY_TYPE } from '@/lib/company';
import type { Company, CompanyLocation, CompanyType } from '@/lib/types';

export function Onboarding() {
  const { user, refreshBuyer } = useAuth();

  const [name, setName] = useState(user?.displayName ?? '');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');

  // Country drives both the stored country and the phone dial code.
  const [countryIso, setCountryIso] = useState('');
  const country = useMemo(() => COUNTRIES.find((c) => c.iso2 === countryIso), [countryIso]);
  const [phone, setPhone] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState<{ name: string; type: CompanyType; currency: string }>({
    name: '',
    type: DEFAULT_COMPANY_TYPE,
    currency: DEFAULT_CURRENCY,
  });

  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', city: '' });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

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
    countryIso.length > 0 &&
    (addingCompany ? newCompany.name.trim().length > 0 : companyId.length > 0);

  const submit = async () => {
    if (!user || !country) return;
    setErr('');
    setBusy(true);
    try {
      let cid = companyId;
      let cname = '';
      if (addingCompany) {
        const c = await createCompany(
          { name: newCompany.name, type: newCompany.type, country: country.name, defaultCurrency: newCompany.currency },
          user.uid,
        );
        cid = c.id;
        cname = c.name;
      } else {
        cname = companies.find((c) => c.id === cid)?.name ?? companyQuery.trim();
      }
      if (!cid) throw new Error('Please choose or add your company.');

      let lid = locationId || undefined;
      let lname: string | undefined;
      if (addingLocation && newLocation.name.trim()) {
        const l = await createLocation(
          cid,
          { name: newLocation.name, city: newLocation.city || undefined, country: country.name },
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
        designation,
        department,
        phone: phone || undefined,
        dialCode: country.dial,
        country: country.name,
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
              <span className="field-label">Country *</span>
              <select value={countryIso} onChange={(e) => setCountryIso(e.target.value)} className="field">
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Designation</span>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Procurement Manager" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Department</span>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Maintenance" className="field" />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Phone</span>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-tag border border-r-0 border-paper-line bg-paper-200 px-3 text-sm text-petroleum-300">
                {country?.dial ?? '+—'}
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="number"
                className="field rounded-l-none"
                inputMode="tel"
              />
            </div>
          </label>

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
                    {filtered.length === 0 && <li className="px-3 py-2 text-sm text-petroleum-300">No match.</li>}
                  </ul>
                )}
                <button onClick={() => setAddingCompany(true)} className="mt-1 text-xs text-safety-600 underline">
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
                    {COMPANY_TYPE_OPTIONS.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newCompany.currency}
                    onChange={(e) => setNewCompany({ ...newCompany, currency: e.target.value })}
                    className="field"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-petroleum-300">
                  Currency is the default for this company’s quotes and orders.
                </p>
                <button onClick={() => setAddingCompany(false)} className="text-xs text-petroleum-300 underline">
                  ← Pick an existing company instead
                </button>
              </div>
            )}
          </div>

          {/* Location */}
          {(companyId || addingCompany) && (
            <div>
              <span className="field-label">Site / location</span>
              {!addingLocation ? (
                <>
                  {locations.length > 0 && !addingCompany ? (
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="field">
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
                  <button onClick={() => setAddingLocation(true)} className="mt-1 text-xs text-safety-600 underline">
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
                  <input
                    value={newLocation.city}
                    onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                    placeholder="City"
                    className="field"
                  />
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

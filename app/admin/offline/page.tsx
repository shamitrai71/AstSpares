'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createCompany,
  createLocation,
  createOfflineBuyer,
  listAllBuyers,
  listCompanies,
  listLocations,
} from '@/lib/buyers';
import { createOfflineOrder } from '@/lib/orders';
import { COUNTRIES } from '@/lib/countries';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies';
import { DEFAULT_UOM } from '@/lib/uom';
import { useAuth } from '@/components/AuthProvider';
import { COMPANY_TYPE_OPTIONS, DEFAULT_COMPANY_TYPE } from '@/lib/company';
import type { Buyer, Company, CompanyLocation, CompanyType, PoStatus } from '@/lib/types';

type Line = { partNumber: string; description: string; quantity: number; uom: string; unitPrice: number };
const BLANK_LINE: Line = { partNumber: '', description: '', quantity: 1, uom: DEFAULT_UOM, unitPrice: 0 };
const PO_STATUSES: PoStatus[] = ['issued', 'acknowledged', 'fulfilled', 'closed', 'cancelled'];

export default function AdminOffline() {
  const { user } = useAuth();
  const adminUid = user?.uid ?? '';

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    listAllBuyers().then(setBuyers).catch(() => setBuyers([]));
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  // Buyer: existing or new
  const [buyerMode, setBuyerMode] = useState<'existing' | 'new'>('existing');
  const [buyerQuery, setBuyerQuery] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const selectedBuyer = buyers.find((b) => b.id === buyerId);

  // New buyer fields
  const [contact, setContact] = useState({ name: '', email: '', phone: '', countryIso: '', designation: '', department: '' });
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('existing');
  const [companyId, setCompanyId] = useState('');
  const [newCompany, setNewCompany] = useState<{ name: string; type: CompanyType; currency: string }>({ name: '', type: DEFAULT_COMPANY_TYPE, currency: DEFAULT_CURRENCY });
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [newLocation, setNewLocation] = useState({ name: '', city: '' });

  // Order
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }]);
  const [po, setPo] = useState({ buyerPoNumber: '', orderDate: '', requiredDate: '', deliveryTerms: '', paymentTerms: '', notes: '', status: 'issued' as PoStatus });
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ rfqNo: string; poNumber: string } | null>(null);

  useEffect(() => {
    if (companyMode === 'existing' && companyId) {
      listLocations(companyId).then(setLocations).catch(() => setLocations([]));
      const c = companies.find((x) => x.id === companyId);
      if (c?.defaultCurrency) setCurrency(c.defaultCurrency);
    } else {
      setLocations([]);
    }
  }, [companyMode, companyId, companies]);

  // When an existing buyer is chosen, default the currency from their company.
  useEffect(() => {
    if (selectedBuyer) {
      const c = companies.find((x) => x.id === selectedBuyer.companyId);
      if (c?.defaultCurrency) setCurrency(c.defaultCurrency);
    }
  }, [selectedBuyer, companies]);

  const subtotal = useMemo(
    () => Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100,
    [lines],
  );

  const filteredBuyers = useMemo(() => {
    const q = buyerQuery.trim().toLowerCase();
    const base = q
      ? buyers.filter((b) => `${b.name} ${b.email} ${b.companyName}`.toLowerCase().includes(q))
      : buyers;
    return base.slice(0, 8);
  }, [buyers, buyerQuery]);

  const lineValid = lines.some((l) => l.description.trim() && l.quantity > 0);
  const buyerReady =
    buyerMode === 'existing'
      ? Boolean(buyerId)
      : contact.name.trim() &&
        /\S+@\S+\.\S+/.test(contact.email) &&
        (companyMode === 'existing' ? Boolean(companyId) : newCompany.name.trim());
  const canSubmit = Boolean(buyerReady) && lineValid && !busy;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      let bId: string;
      let cId: string;
      let cName: string;
      let lId: string | undefined;
      let ct: { name: string; company: string; email: string; phone?: string; dialCode?: string; country?: string; designation?: string; department?: string };

      if (buyerMode === 'existing') {
        if (!selectedBuyer) throw new Error('Pick a buyer.');
        bId = selectedBuyer.id;
        cId = selectedBuyer.companyId;
        cName = selectedBuyer.companyName;
        lId = selectedBuyer.locationId;
        ct = {
          name: selectedBuyer.name,
          company: selectedBuyer.companyName,
          email: selectedBuyer.email,
          phone: selectedBuyer.phone,
          dialCode: selectedBuyer.dialCode,
          country: selectedBuyer.country,
          designation: selectedBuyer.designation,
          department: selectedBuyer.department,
        };
      } else {
        const country = COUNTRIES.find((c) => c.iso2 === contact.countryIso);
        // company
        if (companyMode === 'new') {
          const c = await createCompany(
            { name: newCompany.name, type: newCompany.type, country: country?.name, defaultCurrency: newCompany.currency },
            adminUid,
          );
          cId = c.id;
          cName = c.name;
        } else {
          cId = companyId;
          cName = companies.find((x) => x.id === companyId)?.name ?? '';
        }
        // location
        let lName: string | undefined;
        if (newLocation.name.trim()) {
          const l = await createLocation(cId, { name: newLocation.name, city: newLocation.city || undefined, country: country?.name }, adminUid);
          lId = l.id;
          lName = l.name;
        } else if (locationId) {
          lId = locationId;
          lName = locations.find((l) => l.id === locationId)?.name;
        }
        // buyer
        const b = await createOfflineBuyer({
          adminUid,
          name: contact.name,
          email: contact.email,
          phone: contact.phone || undefined,
          dialCode: country?.dial,
          country: country?.name,
          designation: contact.designation || undefined,
          department: contact.department || undefined,
          companyId: cId,
          companyName: cName,
          locationId: lId,
          locationName: lName,
        });
        bId = b.id;
        ct = {
          name: b.name, company: cName, email: b.email, phone: b.phone,
          dialCode: b.dialCode, country: b.country, designation: b.designation, department: b.department,
        };
      }

      const res = await createOfflineOrder({
        adminUid,
        buyerId: bId,
        companyId: cId,
        companyName: cName,
        locationId: lId,
        contact: ct,
        currency,
        items: lines.filter((l) => l.description.trim()).map((l) => ({
          partNumber: l.partNumber || undefined,
          description: l.description,
          quantity: l.quantity,
          uom: l.uom || undefined,
          unitPrice: l.unitPrice,
        })),
        buyerPoNumber: po.buyerPoNumber || undefined,
        orderDate: po.orderDate || undefined,
        requiredDate: po.requiredDate || undefined,
        deliveryTerms: po.deliveryTerms || undefined,
        paymentTerms: po.paymentTerms || undefined,
        notes: po.notes || undefined,
        status: po.status,
        file,
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the order.');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div>
        <h1 className="font-display text-3xl">Offline order saved</h1>
        <p className="mt-2 text-sm text-petroleum-300">Recorded with channel <strong>offline</strong> for analytics.</p>
        <div className="panel mt-5 max-w-md space-y-3 p-5">
          <div className="flex justify-between"><span className="text-petroleum-300">PO number</span><span className="part-plate">{result.poNumber}</span></div>
          <div className="flex justify-between"><span className="text-petroleum-300">Linked RFQ</span><span className="font-mono text-sm">{result.rfqNo}</span></div>
        </div>
        <button
          onClick={() => { setResult(null); setLines([{ ...BLANK_LINE }]); setFile(null); setPo({ buyerPoNumber: '', orderDate: '', requiredDate: '', deliveryTerms: '', paymentTerms: '', notes: '', status: 'issued' }); }}
          className="btn-primary mt-5"
        >
          Record another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl">Offline order</h1>
      <p className="mt-1 text-sm text-petroleum-300">
        Record an order received outside the RFQ system. It’s stamped <strong>offline</strong> throughout,
        gets a system PO number, and links to a buyer, company, and location.
      </p>

      {/* Buyer */}
      <section className="panel mt-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Buyer</h2>
          <div className="flex gap-1 text-sm">
            {(['existing', 'new'] as const).map((m) => (
              <button key={m} onClick={() => setBuyerMode(m)} className={`rounded-tag px-3 py-1 ${buyerMode === m ? 'bg-petroleum text-paper' : 'text-petroleum-300'}`}>
                {m === 'existing' ? 'Existing' : 'New'}
              </button>
            ))}
          </div>
        </div>

        {buyerMode === 'existing' ? (
          <div className="mt-3">
            <input value={buyerQuery} onChange={(e) => { setBuyerQuery(e.target.value); setBuyerId(''); }} placeholder="Search by name, email, or company…" className="field" />
            <ul className="mt-1 max-h-44 overflow-y-auto rounded-tag border border-paper-line">
              {filteredBuyers.map((b) => (
                <li key={b.id}>
                  <button onClick={() => { setBuyerId(b.id); setBuyerQuery(`${b.name} — ${b.companyName}`); }} className={`flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-paper-200 ${buyerId === b.id ? 'bg-paper-200' : ''}`}>
                    <span>{b.name} · {b.companyName}</span>
                    <span className="text-petroleum-300">{b.id}</span>
                  </button>
                </li>
              ))}
              {filteredBuyers.length === 0 && <li className="px-3 py-2 text-sm text-petroleum-300">No match.</li>}
            </ul>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Contact name *" className="field" />
              <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email *" className="field" />
              <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Phone" className="field" />
              <select value={contact.countryIso} onChange={(e) => setContact({ ...contact, countryIso: e.target.value })} className="field">
                <option value="">Country…</option>
                {COUNTRIES.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
              </select>
              <input value={contact.designation} onChange={(e) => setContact({ ...contact, designation: e.target.value })} placeholder="Designation" className="field" />
              <input value={contact.department} onChange={(e) => setContact({ ...contact, department: e.target.value })} placeholder="Department" className="field" />
            </div>

            {/* Company for the new buyer */}
            <div className="rounded-tag border border-paper-line p-3">
              <div className="flex items-center justify-between">
                <span className="field-label">Company *</span>
                <div className="flex gap-1 text-xs">
                  {(['existing', 'new'] as const).map((m) => (
                    <button key={m} onClick={() => setCompanyMode(m)} className={`rounded-tag px-2 py-0.5 ${companyMode === m ? 'bg-petroleum text-paper' : 'text-petroleum-300'}`}>{m}</button>
                  ))}
                </div>
              </div>
              {companyMode === 'existing' ? (
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="field mt-2">
                  <option value="">Select a company…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} placeholder="Company name" className="field col-span-2" />
                  <select value={newCompany.type} onChange={(e) => setNewCompany({ ...newCompany, type: e.target.value as CompanyType })} className="field">
                    {COMPANY_TYPE_OPTIONS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </select>
                  <select value={newCompany.currency} onChange={(e) => setNewCompany({ ...newCompany, currency: e.target.value })} className="field">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              )}
              {/* Location */}
              {companyMode === 'existing' && locations.length > 0 && (
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="field mt-2">
                  <option value="">Select a site (optional)…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ''}</option>)}
                </select>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="New site name (optional)" className="field" />
                <input value={newLocation.city} onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })} placeholder="City" className="field" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Line items */}
      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl">Items (matched offline quote)</h2>
        <div className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={l.partNumber} onChange={(e) => setLine(i, { partNumber: e.target.value })} placeholder="Part #" className="field col-span-3" />
              <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description *" className="field col-span-4" />
              <input value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value.toUpperCase() })} placeholder="UoM" className="field col-span-1 px-1 text-center text-xs" />
              <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} placeholder="Qty" className="field col-span-2" />
              <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} placeholder="Unit price" className="field col-span-2" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => setLines([...lines, { ...BLANK_LINE }])} className="text-sm text-safety-600 underline">+ Add line</button>
          <div className="flex items-center gap-3 text-sm">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field py-1">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <span className="text-petroleum-300">Subtotal</span>
            <span className="font-mono text-petroleum">{currency} {subtotal.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* PO details */}
      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl">Purchase order</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <input value={po.deliveryTerms} onChange={(e) => setPo({ ...po, deliveryTerms: e.target.value })} placeholder="e.g. CIF Jebel Ali" className="field" /></label>
          <label className="block"><span className="field-label">Payment terms</span>
            <input value={po.paymentTerms} onChange={(e) => setPo({ ...po, paymentTerms: e.target.value })} placeholder="e.g. 30% advance" className="field" /></label>
        </div>
        <label className="mt-3 block"><span className="field-label">Notes</span>
          <textarea rows={2} value={po.notes} onChange={(e) => setPo({ ...po, notes: e.target.value })} className="field resize-none" /></label>
        <label className="mt-3 block"><span className="field-label">PO document (PDF/image)</span>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-petroleum-300" /></label>
      </section>

      {err && <p className="mt-4 rounded-tag border border-safety/40 bg-safety/10 px-3 py-2 text-sm text-safety-600">{err}</p>}

      <button onClick={submit} disabled={!canSubmit} className="btn-primary mt-5">
        {busy ? 'Saving…' : 'Save offline order'}
      </button>
    </div>
  );
}

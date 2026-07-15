'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { listProducts } from '@/lib/db';
import { listVendors } from '@/lib/vendors';
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  listMovements,
  addMovement,
  listStockItems,
  setReorderPoint,
  computeLevels,
  itemTotals,
} from '@/lib/inventory';
import type {
  ProductDoc,
  Vendor,
  StockLocation,
  StockMovement,
  StockItem,
  LocationType,
  MovementType,
} from '@/lib/types';

const nf = new Intl.NumberFormat('en-IN');

const LOC_TYPES: { code: LocationType; label: string }[] = [
  { code: 'own', label: 'Own warehouse' },
  { code: '3pl', label: '3PL' },
  { code: 'vendor', label: 'At vendor' },
];
const locTypeLabel = (t?: string) => LOC_TYPES.find((x) => x.code === t)?.label ?? (t || '—');

const MOVES: { code: MovementType; label: string; signed?: boolean; transfer?: boolean }[] = [
  { code: 'receipt', label: 'Receipt (goods in)' },
  { code: 'issue', label: 'Issue (goods out)' },
  { code: 'adjust', label: 'Adjustment (± correction)', signed: true },
  { code: 'transfer', label: 'Transfer between locations', transfer: true },
  { code: 'reserve', label: 'Reserve / allocate' },
  { code: 'release', label: 'Release reservation' },
];

export default function AdminInventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const [l, m, s] = await Promise.all([listLocations(), listMovements(), listStockItems()]);
    setLocations(l);
    setMovements(m);
    setStockItems(s);
  };

  useEffect(() => {
    Promise.all([listProducts(), listVendors(), listLocations(), listMovements(), listStockItems()])
      .then(([p, v, l, m, s]) => {
        setProducts(p);
        setVendors(v);
        setLocations(l);
        setMovements(m);
        setStockItems(s);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const levels = useMemo(() => computeLevels(movements), [movements]);
  const nameByPart = useMemo(() => new Map(products.map((p) => [p.partNumber, p.productName])), [products]);
  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const reorderByPart = useMemo(
    () => new Map(stockItems.filter((s) => s.reorderPoint != null).map((s) => [s.partNumber, s.reorderPoint!])),
    [stockItems],
  );

  const lowStock = useMemo(() => {
    const rows: { part: string; available: number; reorder: number }[] = [];
    for (const [part, reorder] of reorderByPart) {
      const { available } = itemTotals(levels.get(part));
      if (available < reorder) rows.push({ part, available, reorder });
    }
    return rows.sort((a, b) => a.available - b.available);
  }, [reorderByPart, levels]);

  if (!loaded) return <p className="text-petroleum-300">Loading inventory…</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-petroleum-300">
          On-hand and reserved are the running sum of an append-only movement ledger. Admin-only —
          not shown to buyers.
        </p>
      </div>

      {/* Low stock */}
      <section>
        <h2 className="font-display text-2xl">Low stock</h2>
        <div className="panel mt-3 p-4">
          {lowStock.length === 0 ? (
            <p className="text-sm text-petroleum-300">Nothing below its reorder point.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {lowStock.map((r) => (
                  <tr key={r.part} className="border-t border-paper-line first:border-0">
                    <td className="py-1.5 font-mono text-xs">{r.part}</td>
                    <td className="py-1.5 text-petroleum-300">{nameByPart.get(r.part) ?? ''}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <span className="text-safety-600">{nf.format(r.available)} avail</span> · reorder at {nf.format(r.reorder)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <LocationSection
        locations={locations}
        vendors={vendors}
        movements={movements}
        adminUid={user?.uid ?? ''}
        onChanged={reload}
      />

      <ItemStock
        products={products}
        locations={locations}
        levels={levels}
        locById={locById}
        reorderByPart={reorderByPart}
        adminUid={user?.uid ?? ''}
        onChanged={reload}
      />
    </div>
  );
}

// ── Locations ──────────────────────────────────────────────────────────────
function LocationSection({
  locations,
  vendors,
  movements,
  adminUid,
  onChanged,
}: {
  locations: StockLocation[];
  vendors: Vendor[];
  movements: StockMovement[];
  adminUid: string;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<StockLocation | 'new' | null>(null);
  const usedLocIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of movements) { s.add(m.locationId); if (m.toLocationId) s.add(m.toLocationId); }
    return s;
  }, [movements]);

  const remove = async (l: StockLocation) => {
    if (usedLocIds.has(l.id)) { alert('This location has stock movements — deactivate it instead of deleting.'); return; }
    if (!confirm(`Delete ${l.id} — ${l.name}?`)) return;
    await deleteLocation(l.id);
    await onChanged();
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Locations</h2>
        <button onClick={() => setEditing('new')} className="btn-ghost px-3 py-1.5 text-sm">New location</button>
      </div>

      {editing && (
        <LocationForm
          location={editing === 'new' ? null : editing}
          vendors={vendors}
          adminUid={adminUid}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onChanged(); }}
        />
      )}

      <div className="panel mt-3 divide-y divide-paper-line">
        {locations.length === 0 && <p className="p-4 text-sm text-petroleum-300">No locations yet — add your own warehouse, a 3PL, or a vendor site.</p>}
        {locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <span className="font-medium text-petroleum">{l.name}</span>
              <span className="ml-2 eyebrow text-petroleum-300">{locTypeLabel(l.type)}</span>
              {!l.active && <span className="ml-2 eyebrow text-safety-600">inactive</span>}
              <p className="truncate text-xs text-petroleum-300">
                {l.id}{l.postalCode ? ` · PIN ${l.postalCode}` : ''}{l.city ? ` · ${l.city}` : ''}{l.region ? `, ${l.region}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              <button onClick={() => setEditing(l)} className="text-petroleum-300 underline hover:text-petroleum">Edit</button>
              <button onClick={() => remove(l)} className="text-petroleum-300 underline hover:text-safety">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LocationForm({
  location,
  vendors,
  adminUid,
  onClose,
  onSaved,
}: {
  location: StockLocation | null;
  vendors: Vendor[];
  adminUid: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(location?.name ?? '');
  const [type, setType] = useState<LocationType>(location?.type ?? 'own');
  const [vendorId, setVendorId] = useState(location?.vendorId ?? '');
  const [city, setCity] = useState(location?.city ?? '');
  const [region, setRegion] = useState(location?.region ?? '');
  const [postalCode, setPostalCode] = useState(location?.postalCode ?? '');
  const [active, setActive] = useState(location?.active ?? true);
  const [busy, setBusy] = useState(false);

  // For 'at vendor', prefill location from the chosen vendor.
  const pickVendor = (id: string) => {
    setVendorId(id);
    const v = vendors.find((x) => x.id === id);
    if (v) {
      if (!name.trim()) setName(v.name);
      setCity(v.city ?? '');
      setRegion(v.region ?? '');
      setPostalCode(v.postalCode ?? '');
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        vendorId: type === 'vendor' ? vendorId || undefined : undefined,
        city, region, postalCode,
      };
      if (location) {
        await updateLocation(location.id, { ...payload, active });
      } else {
        await createLocation(payload, adminUid);
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as LocationType)} className="field">
            {LOC_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </label>
        {type === 'vendor' && (
          <label className="block sm:col-span-2">
            <span className="field-label">Vendor</span>
            <select value={vendorId} onChange={(e) => pickVendor(e.target.value)} className="field">
              <option value="">— Select —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="field-label">PIN / Postal code</span>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Region / State</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="field" />
        </label>
        {location && (
          <label className="flex items-end gap-2 text-sm text-petroleum">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-safety" />
            Active
          </label>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary px-3 py-1.5 text-sm">{busy ? 'Saving…' : 'Save location'}</button>
        <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Item stock ──────────────────────────────────────────────────────────────
function ItemStock({
  products,
  locations,
  levels,
  locById,
  reorderByPart,
  adminUid,
  onChanged,
}: {
  products: ProductDoc[];
  locations: StockLocation[];
  levels: Map<string, Map<string, { onHand: number; reserved: number }>>;
  locById: Map<string, StockLocation>;
  reorderByPart: Map<string, number>;
  adminUid: string;
  onChanged: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [part, setPart] = useState('');

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter((p) => p.partNumber.toLowerCase().includes(t) || p.productName.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, products]);

  const selected = products.find((p) => p.partNumber === part);
  const byLoc = part ? levels.get(part) : undefined;
  const totals = itemTotals(byLoc);
  const activeLocs = locations.filter((l) => l.active);

  return (
    <section>
      <h2 className="font-display text-2xl">Stock by item</h2>
      <div className="panel mt-3 p-4">
        <label className="block">
          <span className="field-label">Find an item (part no. or name)</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="AST-RS-1002 or “compression plate”" className="field" />
        </label>
        {matches.length > 0 && !selected && (
          <div className="mt-2 divide-y divide-paper-line rounded-tag border border-paper-line">
            {matches.map((p) => (
              <button key={p.partNumber} onClick={() => { setPart(p.partNumber); setQ(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-200">
                <span className="font-mono text-xs text-safety-600">{p.partNumber}</span>
                <span className="ml-3 text-petroleum">{p.productName}</span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs text-safety-600">{selected.partNumber}</span>
                <span className="ml-3 font-medium text-petroleum">{selected.productName}</span>
              </div>
              <button onClick={() => setPart('')} className="text-xs text-petroleum-300 underline">Change item</button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Stat label="On hand" value={nf.format(totals.onHand)} />
              <Stat label="Reserved" value={nf.format(totals.reserved)} />
              <Stat label="Available" value={nf.format(totals.available)} tone={reorderByPart.has(part) && totals.available < (reorderByPart.get(part) ?? 0) ? 'low' : undefined} />
              <ReorderField part={part} current={reorderByPart.get(part)} onSaved={onChanged} />
            </div>

            <p className="field-label mt-5 mb-2">By location</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-petroleum-300">
                  <th className="py-1">Location</th>
                  <th className="py-1 text-right">On hand</th>
                  <th className="py-1 text-right">Reserved</th>
                  <th className="py-1 text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {byLoc && byLoc.size > 0 ? (
                  [...byLoc.entries()].map(([locId, lv]) => (
                    <tr key={locId} className="border-t border-paper-line">
                      <td className="py-1.5">{locById.get(locId)?.name ?? locId}</td>
                      <td className="py-1.5 text-right">{nf.format(lv.onHand)}</td>
                      <td className="py-1.5 text-right text-petroleum-300">{nf.format(lv.reserved)}</td>
                      <td className="py-1.5 text-right font-medium">{nf.format(lv.onHand - lv.reserved)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-2 text-petroleum-300">No stock recorded yet.</td></tr>
                )}
              </tbody>
            </table>

            <MovementForm part={part} locations={activeLocs} adminUid={adminUid} onSaved={onChanged} />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'low' }) {
  return (
    <div className="rounded-tag border border-paper-line bg-paper-200/40 p-3">
      <p className="eyebrow text-petroleum-300">{label}</p>
      <p className={`mt-1 font-display text-2xl leading-none ${tone === 'low' ? 'text-safety-600' : 'text-petroleum'}`}>{value}</p>
    </div>
  );
}

function ReorderField({ part, current, onSaved }: { part: string; current?: number; onSaved: () => Promise<void> }) {
  const [val, setVal] = useState(current != null ? String(current) : '');
  useEffect(() => { setVal(current != null ? String(current) : ''); }, [part, current]);
  const save = async () => {
    await setReorderPoint(part, val.trim() === '' ? undefined : Number(val));
    await onSaved();
  };
  return (
    <div className="rounded-tag border border-paper-line bg-paper-200/40 p-3">
      <p className="eyebrow text-petroleum-300">Reorder point</p>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} placeholder="—" className="field w-20 py-1" />
      </div>
    </div>
  );
}

function MovementForm({ part, locations, adminUid, onSaved }: { part: string; locations: StockLocation[]; adminUid: string; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<MovementType>('receipt');
  const [qty, setQty] = useState('');
  const [locationId, setLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const def = MOVES.find((m) => m.code === type)!;

  const submit = async () => {
    setErr('');
    const n = Number(qty);
    if (!locationId) { setErr('Pick a location.'); return; }
    if (!qty.trim() || Number.isNaN(n) || (!def.signed && n <= 0)) { setErr('Enter a valid quantity.'); return; }
    if (def.transfer && (!toLocationId || toLocationId === locationId)) { setErr('Pick a different destination location.'); return; }
    setBusy(true);
    try {
      await addMovement({
        itemPartNumber: part,
        type,
        qty: n,
        locationId,
        toLocationId: def.transfer ? toLocationId : undefined,
        note: note || undefined,
        createdBy: adminUid,
      });
      setQty(''); setNote('');
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not record movement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-tag border border-paper-line bg-white p-3">
      <p className="field-label mb-2">Record movement</p>
      <div className="grid gap-2 sm:grid-cols-12">
        <select value={type} onChange={(e) => setType(e.target.value as MovementType)} className="field sm:col-span-4">
          {MOVES.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
        </select>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="field sm:col-span-4">
          <option value="">{def.transfer ? 'From location' : 'Location'}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {def.transfer ? (
          <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="field sm:col-span-4">
            <option value="">To location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : (
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={def.signed ? 'Qty (±)' : 'Qty'} className="field sm:col-span-4" />
        )}
        {def.transfer && (
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="field sm:col-span-4" />
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note / reference (optional)" className={`field ${def.transfer ? 'sm:col-span-8' : 'sm:col-span-8'}`} />
      </div>
      {err && <p className="mt-2 text-xs text-safety-600">{err}</p>}
      <button onClick={submit} disabled={busy || !locations.length} className="btn-primary mt-3 px-3 py-1.5 text-sm">{busy ? 'Recording…' : 'Record'}</button>
      {!locations.length && <p className="mt-2 text-xs text-safety-600">Add an active location first.</p>}
    </div>
  );
}

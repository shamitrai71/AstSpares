'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { listVendors } from '@/lib/vendors';
import { listProducts } from '@/lib/db';
import { listLocations } from '@/lib/inventory';
import {
  listVendorPos,
  createVendorPo,
  updateVendorPo,
  deleteVendorPo,
  computeTotals,
  lineAmount,
  guessTaxMode,
  VENDOR_PO_DEFAULT_CURRENCY,
  BUYER_STATE,
} from '@/lib/vendorPos';
import type { TaxModeGuess } from '@/lib/vendorPos';
import { CURRENCIES } from '@/lib/currencies';
import type {
  Vendor,
  ProductDoc,
  StockLocation,
  VendorPurchaseOrder,
  VendorPoLineItem,
  VendorPoTaxMode,
  PoStatus,
} from '@/lib/types';

const nf = new Intl.NumberFormat('en-IN');
const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS: PoStatus[] = ['issued', 'acknowledged', 'fulfilled', 'closed', 'cancelled'];
const STATUS_TONE: Record<PoStatus, string> = {
  issued: 'text-safety-600',
  acknowledged: 'text-safety-600',
  fulfilled: 'text-safety',
  closed: 'text-petroleum-300',
  cancelled: 'text-petroleum-300',
};

type LineDraft = { partNumber: string; description: string; hsn: string; quantity: string; uom: string; unitPrice: string };
const blankLine = (): LineDraft => ({ partNumber: '', description: '', hsn: '', quantity: '1', uom: 'EA', unitPrice: '' });

export default function AdminVendorPos() {
  const { user } = useAuth();
  const [pos, setPos] = useState<VendorPurchaseOrder[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [creating, setCreating] = useState(false);
  const [fyFilter, setFyFilter] = useState<string>('');

  const load = () => listVendorPos().then(setPos).catch(() => setPos([]));

  useEffect(() => {
    load();
    listVendors().then(setVendors).catch(() => setVendors([]));
    listProducts().then(setProducts).catch(() => setProducts([]));
    listLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  const fys = useMemo(() => Array.from(new Set((pos ?? []).map((p) => p.financialYear))).sort().reverse(), [pos]);
  const visible = useMemo(
    () => (pos ?? []).filter((p) => !fyFilter || p.financialYear === fyFilter).sort((a, b) => b.poNumber.localeCompare(a.poNumber)),
    [pos, fyFilter],
  );

  const setStatus = async (p: VendorPurchaseOrder, status: PoStatus) => {
    await updateVendorPo(p.id, { status });
    await load();
  };
  const remove = async (p: VendorPurchaseOrder) => {
    if (!confirm(`Delete ${p.poNumber}? The number is retired and will never be reused.`)) return;
    await deleteVendorPo(p.id);
    await load();
  };

  if (pos === null) return <p className="text-petroleum-300">Loading purchase orders…</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Vendor purchase orders</h1>
        <button onClick={() => setCreating(true)} className="btn-primary">New PO</button>
      </div>
      <p className="mt-1 text-sm text-petroleum-300">
        What we issue to a vendor — distinct from buyer-facing RFQ/quote POs. Numbered per financial
        year (PSPL/AST/PO/&lt;FY&gt;/#####); a deleted PO's number is retired, never reused.
      </p>

      {creating && (
        <PoCreator
          vendors={vendors}
          products={products}
          locations={locations}
          adminUid={user?.uid ?? ''}
          onClose={() => setCreating(false)}
          onSaved={async () => { setCreating(false); await load(); }}
        />
      )}

      {fys.length > 0 && (
        <div className="mt-6 flex items-center gap-2 text-sm">
          <span className="field-label">Financial year</span>
          <select value={fyFilter} onChange={(e) => setFyFilter(e.target.value)} className="field w-auto">
            <option value="">All</option>
            {fys.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        </div>
      )}

      <div className="mt-4 panel divide-y divide-paper-line">
        {visible.length === 0 && <p className="p-4 text-sm text-petroleum-300">No vendor purchase orders yet.</p>}
        {visible.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-petroleum">{p.poNumber}</span>
                {p.origin === 'backfilled' && (
                  <span className="eyebrow text-petroleum-300" title={p.legacyPoNumber ? `Originally issued as ${p.legacyPoNumber}` : undefined}>
                    backfilled{p.legacyPoNumber ? ` · was ${p.legacyPoNumber}` : ''}
                  </span>
                )}
                <select
                  value={p.status}
                  onChange={(e) => setStatus(p, e.target.value as PoStatus)}
                  className={`bg-transparent text-xs font-medium underline-offset-2 ${STATUS_TONE[p.status]}`}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="mt-0.5 truncate text-xs text-petroleum-300">
                {p.vendorName} · {p.poDate} · {p.lineItems.length} line{p.lineItems.length === 1 ? '' : 's'} · {p.currency} {nf.format(p.grandTotal)}
              </p>
            </div>
            <button onClick={() => remove(p)} className="shrink-0 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoCreator({
  vendors,
  products,
  locations,
  adminUid,
  onClose,
  onSaved,
}: {
  vendors: Vendor[];
  products: ProductDoc[];
  locations: StockLocation[];
  adminUid: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [backfilled, setBackfilled] = useState(false);
  const [legacyPoNumber, setLegacyPoNumber] = useState('');
  const [poDate, setPoDate] = useState(todayIso());
  const [vendorId, setVendorId] = useState('');
  const [vendorRef, setVendorRef] = useState('');
  const [vendorRefDate, setVendorRefDate] = useState('');
  const [currency, setCurrency] = useState(VENDOR_PO_DEFAULT_CURRENCY);
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [packingPct, setPackingPct] = useState('0');
  const [taxMode, setTaxMode] = useState<VendorPoTaxMode>('igst');
  const [taxGuess, setTaxGuess] = useState<TaxModeGuess | null>(null);
  const [taxPct, setTaxPct] = useState('18');
  const [freightTerms, setFreightTerms] = useState('At actual, to Buyer\u2019s account.');
  const [paymentTerms, setPaymentTerms] = useState('100% against Proforma Invoice, post PO acknowledgement.');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('12 months against manufacturing defects from the date of delivery.');
  const [shipToLocationId, setShipToLocationId] = useState('');
  const [shipToLabel, setShipToLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const vendor = vendors.find((v) => v.id === vendorId);

  const pickVendor = (id: string) => {
    setVendorId(id);
    const v = vendors.find((x) => x.id === id);
    const guess = guessTaxMode(v?.gstin, v?.region);
    setTaxMode(guess.mode);
    setTaxGuess(guess);
    if (v?.defaultLeadTimeDays != null && !deliveryTerms) {
      setDeliveryTerms(`Within ${v.defaultLeadTimeDays} days from release of this PO and its acknowledgement.`);
    }
  };

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickProduct = (i: number, partNumber: string) => {
    const p = products.find((x) => x.partNumber === partNumber);
    if (!p) { setLine(i, { partNumber }); return; }
    setLine(i, { partNumber: p.partNumber, description: p.productName, hsn: p.hsn ?? '', uom: p.uom ?? 'EA' });
  };

  const parsedLines: VendorPoLineItem[] = lines
    .filter((l) => l.description.trim() && l.quantity.trim() && l.unitPrice.trim())
    .map((l) => {
      const qty = Number(l.quantity) || 0;
      const unitPrice = Number(l.unitPrice) || 0;
      return {
        partNumber: l.partNumber.trim() || undefined,
        description: l.description.trim(),
        hsn: l.hsn.trim() || undefined,
        quantity: qty,
        uom: l.uom.trim() || undefined,
        unitPrice,
        amount: lineAmount(qty, unitPrice),
      };
    });

  const totals = computeTotals({
    lineItems: parsedLines,
    packingPct: Number(packingPct) || 0,
    taxMode,
    taxPct: Number(taxPct) || 0,
  });

  const save = async () => {
    setError('');
    if (!vendor) { setError('Select a vendor.'); return; }
    if (parsedLines.length === 0) { setError('Add at least one line with description, quantity and unit price.'); return; }
    if (backfilled && !legacyPoNumber.trim()) { setError('Enter the original PO number being backfilled.'); return; }
    const loc = locations.find((l) => l.id === shipToLocationId);
    setBusy(true);
    try {
      await createVendorPo(
        {
          poDate,
          legacyPoNumber: backfilled ? legacyPoNumber : undefined,
          origin: backfilled ? 'backfilled' : 'app',
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorGstin: vendor.gstin,
          vendorPan: vendor.pan,
          vendorCin: vendor.cin,
          vendorRef,
          vendorRefDate: vendorRefDate || undefined,
          currency,
          lineItems: parsedLines,
          packingPct: Number(packingPct) || 0,
          taxMode,
          taxPct: Number(taxPct) || 0,
          freightTerms,
          paymentTerms,
          deliveryTerms,
          warrantyTerms,
          shipToLocationId: shipToLocationId || undefined,
          shipToLabel: loc ? loc.name : shipToLabel,
          notes,
        },
        adminUid,
      );
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the purchase order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">New vendor purchase order</h2>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-tag border border-paper-line bg-paper-200/40 p-3 text-sm">
        <input type="checkbox" checked={backfilled} onChange={(e) => setBackfilled(e.target.checked)} className="mt-0.5 accent-safety" />
        <span>
          <span className="font-medium text-petroleum">This PO was already issued outside the app.</span>{' '}
          <span className="text-petroleum-300">Creates a clean, correctly-numbered record for a historical PO — it mints the next number for that PO's actual financial year and keeps the original number for reference.</span>
        </span>
      </label>
      {backfilled && (
        <label className="mt-2 block">
          <span className="field-label">Original PO number</span>
          <input value={legacyPoNumber} onChange={(e) => setLegacyPoNumber(e.target.value)} placeholder="e.g. PSPL/AST/FD/PO/01" className="field font-mono" />
        </label>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">PO date</span>
          <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Vendor *</span>
          <select value={vendorId} onChange={(e) => pickVendor(e.target.value)} className="field">
            <option value="">— Select —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {vendor && (
          <p className="text-xs text-petroleum-300 sm:col-span-2">
            {vendor.gstin ? `GSTIN ${vendor.gstin}` : 'No GSTIN on file'}
            {vendor.pan ? ` · PAN ${vendor.pan}` : ''}
            {vendor.region ? ` · ${vendor.region}` : ''}
            {!vendor.bankAccountNumber && ' · no bank details on file'}
          </p>
        )}
        <label className="block">
          <span className="field-label">Vendor ref. (offer/quotation no.)</span>
          <input value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Offer date</span>
          <input type="date" value={vendorRefDate} onChange={(e) => setVendorRefDate(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Ship to</span>
          <select value={shipToLocationId} onChange={(e) => setShipToLocationId(e.target.value)} className="field">
            <option value="">— Custom (type below) —</option>
            {locations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {!shipToLocationId && (
            <input value={shipToLabel} onChange={(e) => setShipToLabel(e.target.value)} placeholder="Ship-to address" className="field mt-2" />
          )}
        </label>
      </div>

      <p className="field-label mb-2 mt-5">Line items</p>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              list="po-product-options"
              value={l.partNumber}
              onChange={(e) => pickProduct(i, e.target.value)}
              placeholder="Part # (optional)"
              className="field col-span-2 font-mono text-xs"
            />
            <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description *" className="field col-span-3" />
            <input value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} placeholder="HSN" className="field col-span-1 font-mono text-xs" />
            <input type="number" min={0} step="0.001" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Qty" className="field col-span-1" />
            <input value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value.toUpperCase() })} placeholder="UoM" className="field col-span-1 px-1 text-center text-xs" />
            <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} placeholder="Unit price *" className="field col-span-2" />
            <span className="col-span-2 flex items-center justify-end pr-1 text-sm text-petroleum-300">
              {nf.format(lineAmount(Number(l.quantity) || 0, Number(l.unitPrice) || 0))}
            </span>
          </div>
        ))}
      </div>
      <datalist id="po-product-options">
        {products.map((p) => <option key={p.partNumber} value={p.partNumber}>{p.productName}</option>)}
      </datalist>
      <button onClick={() => setLines([...lines, blankLine()])} className="mt-2 text-xs text-safety-600 underline">+ Add line</button>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Packing &amp; forwarding %</span>
          <input type="number" min={0} step="0.01" value={packingPct} onChange={(e) => setPackingPct(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Tax</span>
          <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as VendorPoTaxMode)} className="field">
            <option value="igst">IGST (inter-state)</option>
            <option value="cgst_sgst">CGST + SGST (intra-state, {BUYER_STATE})</option>
            <option value="none">None</option>
          </select>
          {taxGuess && taxMode === taxGuess.mode && (
            <span className="mt-1 block text-xs text-petroleum-300">
              {taxGuess.source === 'gstin' && `Auto-detected from GSTIN (${taxGuess.vendorStateName} \u2192 ${BUYER_STATE}).`}
              {taxGuess.source === 'region' && `Based on vendor state on file (${taxGuess.vendorStateName}) \u2014 no GSTIN to confirm against.`}
              {taxGuess.source === 'default' && (
                <span className="text-safety-600">Vendor has no GSTIN or state on file \u2014 defaulting to IGST, please confirm.</span>
              )}
            </span>
          )}
        </label>
        <label className="block">
          <span className="field-label">Tax %</span>
          <input type="number" min={0} step="0.01" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} disabled={taxMode === 'none'} className="field" />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Freight terms</span>
          <input value={freightTerms} onChange={(e) => setFreightTerms(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Payment terms</span>
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Delivery terms</span>
          <input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Warranty / guarantee</span>
          <input value={warrantyTerms} onChange={(e) => setWarrantyTerms(e.target.value)} className="field" />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="field-label">Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="field resize-none" />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-tag border border-paper-line bg-paper-200/40 p-3 text-sm">
        <span className="text-petroleum-300">
          Subtotal {currency} {nf.format(totals.subtotal)}
          {totals.packingAmount > 0 && ` · P&F ${currency} ${nf.format(totals.packingAmount)}`}
          {totals.taxAmount > 0 && ` · Tax ${currency} ${nf.format(totals.taxAmount)}`}
        </span>
        <span className="font-display text-xl text-petroleum">Total {currency} {nf.format(totals.grandTotal)}</span>
      </div>

      {error && <p className="mt-3 text-sm text-safety-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save purchase order'}</button>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

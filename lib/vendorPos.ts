// Vendor purchase orders (admin-only, procurement — what we issue to a
// vendor). Numbering is minted server-side per financial year via
// mintVendorPoNumber; this module handles the surrounding CRUD + line math.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { stateCodeFromGstin, stateCodeFromName, stateNameForCode } from './gst-states';
import type { VendorPoLineItem, VendorPoTaxMode, VendorPurchaseOrder, PoStatus } from './types';

export const VENDOR_PO_DEFAULT_CURRENCY = 'INR';
/** Petrodek's own state — used to default IGST vs CGST+SGST against the
 *  vendor's state. Editable per PO; this is only a starting default. */
export const BUYER_STATE = 'Maharashtra';
export const BUYER_STATE_CODE = '27';

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export function lineAmount(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice * 100) / 100;
}

/** Recomputes subtotal / packing / taxable / tax / grand total from lines.
 *  Pure — callers persist the result alongside the lines. */
export function computeTotals(input: {
  lineItems: VendorPoLineItem[];
  packingPct?: number;
  taxMode: VendorPoTaxMode;
  taxPct?: number;
}): { subtotal: number; packingAmount: number; taxableValue: number; taxAmount: number; grandTotal: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round2(input.lineItems.reduce((s, l) => s + l.amount, 0));
  const packingAmount = round2(subtotal * ((input.packingPct ?? 0) / 100));
  const taxableValue = round2(subtotal + packingAmount);
  const taxAmount = input.taxMode === 'none' ? 0 : round2(taxableValue * ((input.taxPct ?? 0) / 100));
  const grandTotal = round2(taxableValue + taxAmount);
  return { subtotal, packingAmount, taxableValue, taxAmount, grandTotal };
}

export type TaxModeSource = 'gstin' | 'region' | 'default';

export type TaxModeGuess = {
  mode: VendorPoTaxMode;
  source: TaxModeSource;
  vendorStateName?: string;
};

/** Determines IGST vs CGST+SGST. Prefers the vendor's GSTIN state code (the
 *  authoritative source — matches what tax authorities use); falls back to
 *  a free-text region/state-name match when no GSTIN is on file; falls back
 *  to IGST with source 'default' (needs manual confirmation) when neither is
 *  available. Always just a starting default — editable per PO. */
export function guessTaxMode(vendorGstin?: string, vendorRegion?: string): TaxModeGuess {
  const gstinCode = stateCodeFromGstin(vendorGstin);
  if (gstinCode) {
    return {
      mode: gstinCode === BUYER_STATE_CODE ? 'cgst_sgst' : 'igst',
      source: 'gstin',
      vendorStateName: stateNameForCode(gstinCode),
    };
  }
  const regionCode = stateCodeFromName(vendorRegion);
  if (regionCode) {
    return {
      mode: regionCode === BUYER_STATE_CODE ? 'cgst_sgst' : 'igst',
      source: 'region',
      vendorStateName: stateNameForCode(regionCode),
    };
  }
  return { mode: 'igst', source: 'default' };
}

export async function listVendorPos(): Promise<VendorPurchaseOrder[]> {
  const snap = await getDocs(query(collection(db, 'vendorPurchaseOrders'), orderBy('poNumber')));
  return snap.docs.map((d) => d.data() as VendorPurchaseOrder);
}

export async function createVendorPo(
  input: {
    poDate: string;
    legacyPoNumber?: string;
    origin: 'app' | 'backfilled';
    vendorId: string;
    vendorName: string;
    vendorGstin?: string;
    vendorPan?: string;
    vendorCin?: string;
    vendorRef?: string;
    vendorRefDate?: string;
    currency: string;
    lineItems: VendorPoLineItem[];
    packingPct?: number;
    taxMode: VendorPoTaxMode;
    taxPct?: number;
    freightTerms?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    warrantyTerms?: string;
    shipToLocationId?: string;
    shipToLabel?: string;
    notes?: string;
    status?: PoStatus;
    enquiryId?: string;
  },
  uid: string,
): Promise<VendorPurchaseOrder> {
  const mint = httpsCallable<{ poDate?: string }, { id: string; poNumber: string; financialYear: string; seq: number }>(
    functions,
    'mintVendorPoNumber',
  );
  const { data } = await mint({ poDate: input.poDate });

  const totals = computeTotals({
    lineItems: input.lineItems,
    packingPct: input.packingPct,
    taxMode: input.taxMode,
    taxPct: input.taxPct,
  });

  const record = clean({
    id: data.id,
    poNumber: data.poNumber,
    financialYear: data.financialYear,
    seq: data.seq,
    legacyPoNumber: input.legacyPoNumber?.trim() || undefined,
    origin: input.origin,
    poDate: input.poDate,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    vendorGstin: input.vendorGstin || undefined,
    vendorPan: input.vendorPan || undefined,
    vendorCin: input.vendorCin || undefined,
    vendorRef: input.vendorRef?.trim() || undefined,
    vendorRefDate: input.vendorRefDate || undefined,
    currency: input.currency,
    lineItems: input.lineItems,
    subtotal: totals.subtotal,
    packingPct: input.packingPct,
    packingAmount: totals.packingAmount,
    taxableValue: totals.taxableValue,
    taxMode: input.taxMode,
    taxPct: input.taxPct,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    freightTerms: input.freightTerms?.trim() || undefined,
    paymentTerms: input.paymentTerms?.trim() || undefined,
    deliveryTerms: input.deliveryTerms?.trim() || undefined,
    warrantyTerms: input.warrantyTerms?.trim() || undefined,
    shipToLocationId: input.shipToLocationId || undefined,
    shipToLabel: input.shipToLabel?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: input.status ?? 'issued',
    enquiryId: input.enquiryId || undefined,
    createdBy: uid,
    createdAt: Date.now(),
  }) as VendorPurchaseOrder;

  await setDoc(doc(db, 'vendorPurchaseOrders', record.id), record);
  return record;
}

export async function updateVendorPo(id: string, patch: Partial<VendorPurchaseOrder>): Promise<void> {
  await updateDoc(doc(db, 'vendorPurchaseOrders', id), clean({ ...patch, updatedAt: Date.now() }) as Record<string, unknown>);
}

export async function deleteVendorPo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vendorPurchaseOrders', id));
}

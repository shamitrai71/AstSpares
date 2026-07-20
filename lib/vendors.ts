// Backend-only vendor + sourcing operations (admin panel). These collections
// are never read by the public catalog or the static export.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Vendor, VendorType, VendorOffering } from './types';

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

async function mintVendorId(): Promise<string> {
  const fn = httpsCallable<{ name: string }, { id: string; seq: number }>(functions, 'mintSequence');
  return (await fn({ name: 'vendor' })).data.id;
}

// ── Vendors ──────────────────────────────────────────────────────────────────

export async function listVendors(): Promise<Vendor[]> {
  const snap = await getDocs(query(collection(db, 'vendors'), orderBy('name')));
  return snap.docs.map((d) => d.data() as Vendor);
}

export async function createVendor(
  input: {
    name: string;
    type?: VendorType;
    country?: string;
    postalCode?: string;
    city?: string;
    region?: string;
    address?: string;
    gstin?: string;
    pan?: string;
    cin?: string;
    isMsme?: boolean;
    udyamNumber?: string;
    bankAccountHolder?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    bankMicr?: string;
    contactName?: string;
    contactEmail?: string;
    phone?: string;
    defaultLeadTimeDays?: number;
    notes?: string;
  },
  uid: string,
): Promise<Vendor> {
  const id = await mintVendorId();
  const vendor = clean({
    id,
    name: input.name.trim(),
    type: input.type,
    country: input.country?.trim() || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    city: input.city?.trim() || undefined,
    region: input.region?.trim() || undefined,
    address: input.address?.trim() || undefined,
    gstin: input.gstin?.trim().toUpperCase() || undefined,
    pan: input.pan?.trim().toUpperCase() || undefined,
    cin: input.cin?.trim().toUpperCase() || undefined,
    isMsme: input.isMsme,
    udyamNumber: input.isMsme ? input.udyamNumber?.trim().toUpperCase() || undefined : undefined,
    bankAccountHolder: input.bankAccountHolder?.trim() || undefined,
    bankName: input.bankName?.trim() || undefined,
    bankBranch: input.bankBranch?.trim() || undefined,
    bankAccountNumber: input.bankAccountNumber?.trim() || undefined,
    bankIfsc: input.bankIfsc?.trim().toUpperCase() || undefined,
    bankMicr: input.bankMicr?.trim() || undefined,
    contactName: input.contactName?.trim() || undefined,
    contactEmail: input.contactEmail?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    defaultLeadTimeDays: input.defaultLeadTimeDays,
    notes: input.notes?.trim() || undefined,
    active: true,
    createdBy: uid,
    createdAt: Date.now(),
  }) as Vendor;
  await setDoc(doc(db, 'vendors', id), vendor);
  return vendor;
}

export async function updateVendor(id: string, patch: Partial<Vendor>): Promise<void> {
  await updateDoc(doc(db, 'vendors', id), clean({ ...patch, updatedAt: Date.now() }));
}

export async function deleteVendor(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vendors', id));
}

// ── Offerings (one vendor's offer to supply one item) ────────────────────────

/** All offerings across every item — for analytics/insights. */
export async function listAllOfferings(): Promise<VendorOffering[]> {
  const snap = await getDocs(collection(db, 'vendorOfferings'));
  return snap.docs.map((d) => ({ ...(d.data() as VendorOffering), id: d.id }));
}

export async function listOfferings(itemPartNumber: string): Promise<VendorOffering[]> {
  const snap = await getDocs(
    query(collection(db, 'vendorOfferings'), where('itemPartNumber', '==', itemPartNumber)),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as VendorOffering), id: d.id }))
    .sort(
      (a, b) =>
        (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0) ||
        a.vendorName.localeCompare(b.vendorName),
    );
}

export async function createOffering(input: {
  itemPartNumber: string;
  vendorId: string;
  vendorName: string;
  vendorPartNo?: string;
  cost: number;
  currency: string;
  leadTimeDays?: number;
  moq?: number;
  stockQty?: number;
  notes?: string;
  isPreferred?: boolean;
}): Promise<void> {
  await addDoc(
    collection(db, 'vendorOfferings'),
    clean({
      itemPartNumber: input.itemPartNumber,
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      vendorPartNo: input.vendorPartNo?.trim() || undefined,
      cost: input.cost,
      currency: input.currency,
      leadTimeDays: input.leadTimeDays,
      moq: input.moq,
      stockQty: input.stockQty,
      notes: input.notes?.trim() || undefined,
      isPreferred: input.isPreferred ?? false,
      createdAt: Date.now(),
    }),
  );
}

export async function updateOffering(id: string, patch: Partial<VendorOffering>): Promise<void> {
  await updateDoc(doc(db, 'vendorOfferings', id), clean({ ...patch, updatedAt: Date.now() }));
}

export async function deleteOffering(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vendorOfferings', id));
}

/** Flag one offering preferred for an item; clears the flag on all the others. */
export async function setPreferredOffering(itemPartNumber: string, offeringId: string): Promise<void> {
  const all = await listOfferings(itemPartNumber);
  const batch = writeBatch(db);
  for (const o of all) {
    batch.update(doc(db, 'vendorOfferings', o.id), {
      isPreferred: o.id === offeringId,
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

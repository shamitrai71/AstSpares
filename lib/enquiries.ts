// Back-to-back vendor enquiries (admin, backend-only). Generation and sending
// run server-side (Admin SDK + Resend); listing and recording responses are
// admin Firestore reads/writes.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { VendorEnquiry } from './types';

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Generate one draft enquiry per vendor from a buyer RFQ. */
export async function generateVendorEnquiries(
  rfqNo: string,
): Promise<{ created: number; unsourced: string[]; vendors: number }> {
  const fn = httpsCallable<{ rfqNo: string }, { created: number; unsourced: string[]; vendors: number }>(
    functions,
    'generateVendorEnquiries',
  );
  return (await fn({ rfqNo })).data;
}

/** Email a draft enquiry to the vendor (privacy-safe) and mark it sent. */
export async function sendVendorEnquiry(enquiryId: string): Promise<void> {
  const fn = httpsCallable<{ enquiryId: string }, { ok: boolean }>(functions, 'sendVendorEnquiry');
  await fn({ enquiryId });
}

/** All enquiries generated from one buyer RFQ. */
export async function listEnquiriesForRfq(rfqNo: string): Promise<VendorEnquiry[]> {
  const snap = await getDocs(query(collection(db, 'vendorEnquiries'), where('rfqNo', '==', rfqNo)));
  return snap.docs
    .map((d) => d.data() as VendorEnquiry)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function updateEnquiry(id: string, patch: Partial<VendorEnquiry>): Promise<void> {
  await updateDoc(doc(db, 'vendorEnquiries', id), clean({ ...patch, updatedAt: Date.now() }) as Record<string, unknown>);
}

export async function deleteEnquiry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vendorEnquiries', id));
}

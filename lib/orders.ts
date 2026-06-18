// Purchase-order writes + the offline-order orchestration.
// PO records are admin-managed (firestore.rules); PO documents live in private
// Storage under purchaseorders/{rfqNo}/… (storage.rules). Offline orders also
// get an RFQ record so the document path and analytics line up with online ones.
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from './firebase';
import { createOfflineRfq } from './db';
import type { PoLineItem, PoStatus, PurchaseOrder, RfqContact, RfqItem } from './types';

function clean<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

async function mintPoNumber(): Promise<string> {
  const fn = httpsCallable<{ name: string }, { id: string; seq: number }>(functions, 'mintSequence');
  return (await fn({ name: 'po' })).data.id;
}

/** Upload a PO document into the RFQ's private folder; returns its URL + path. */
export async function uploadPoDocument(
  rfqNo: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const path = `purchaseorders/${rfqNo}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  const snap = await uploadBytes(ref(storage, path), file);
  const url = await getDownloadURL(snap.ref);
  return { url, path };
}

export async function createPurchaseOrder(po: PurchaseOrder): Promise<void> {
  await setDoc(doc(db, 'purchaseOrders', po.poNumber), clean(po as unknown as Record<string, unknown>));
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const snap = await getDocs(query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as PurchaseOrder);
}

export interface OfflineOrderInput {
  adminUid: string;
  buyerId: string;
  companyId: string;
  companyName: string;
  locationId?: string;
  contact: RfqContact;
  currency: string;
  items: { partNumber?: string; description: string; quantity: number; unitPrice: number }[];
  buyerPoNumber?: string;
  orderDate?: string;
  requiredDate?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  notes?: string;
  status: PoStatus;
  file?: File | null;
}

/**
 * Record a complete offline order: an offline RFQ, the uploaded PO document,
 * and the structured PO (with a system PO number). Everything stamped offline.
 */
export async function createOfflineOrder(
  input: OfflineOrderInput,
): Promise<{ rfqNo: string; poNumber: string }> {
  const rfqItems: RfqItem[] = input.items.map((i) => ({
    partNumber: i.partNumber?.trim() || '—',
    productName: i.description.trim(),
    quantity: i.quantity,
    requiredBy: null,
  }));

  const rfqNo = await createOfflineRfq({
    contact: input.contact,
    items: rfqItems,
    buyerId: input.buyerId,
    companyId: input.companyId,
    locationId: input.locationId,
    status: 'Won',
  });

  let documentUrl: string | undefined;
  let documentPath: string | undefined;
  if (input.file) {
    const up = await uploadPoDocument(rfqNo, input.file);
    documentUrl = up.url;
    documentPath = up.path;
  }

  const poNumber = await mintPoNumber();

  const lineItems: PoLineItem[] = input.items.map((i) => ({
    ...(i.partNumber?.trim() ? { partNumber: i.partNumber.trim() } : {}),
    description: i.description.trim(),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
  }));
  const subtotal = Math.round(lineItems.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

  const po: PurchaseOrder = {
    poNumber,
    buyerPoNumber: input.buyerPoNumber?.trim() || undefined,
    channel: 'offline',
    rfqNo,
    buyerUid: null,
    buyerId: input.buyerId,
    companyId: input.companyId,
    companyName: input.companyName,
    locationId: input.locationId,
    contact: input.contact,
    currency: input.currency,
    lineItems,
    subtotal,
    total: subtotal,
    orderDate: input.orderDate || undefined,
    requiredDate: input.requiredDate || undefined,
    deliveryTerms: input.deliveryTerms?.trim() || undefined,
    paymentTerms: input.paymentTerms?.trim() || undefined,
    documentUrl,
    documentPath,
    uploadedBy: input.file ? 'admin' : undefined,
    status: input.status,
    notes: input.notes?.trim() || undefined,
    enteredByUid: input.adminUid,
    createdAt: Date.now(),
  };

  await createPurchaseOrder(po);
  return { rfqNo, poNumber };
}

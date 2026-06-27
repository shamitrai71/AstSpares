// Client-side Firestore operations (run in the browser).
// The catalog itself is static; these handle the dynamic parts: submitting an
// RFQ, and the admin panel's reads/writes.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Category, RfqContact, RfqDoc, RfqItem, RfqStatus, ProductDoc, SiteConfig } from './types';

/**
 * Generate a unique RFQ reference the client can show immediately:
 * RFQ-<year>-<6-char base36>. No shared counter — avoids needing public write
 * access to a counter document. If you later want strictly sequential numbers,
 * assign them in the Cloud Function (it runs with admin privileges).
 */
function newRfqNo(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RFQ-${year}-${rand}`;
}

/**
 * Submit an online RFQ for a signed-in buyer. Writes a single document to
 * /rfqs stamped with the buyer/company/location linkage and channel 'online';
 * a Firestore-triggered Cloud Function then emails sales and the buyer.
 * Returns the generated RFQ number.
 */
export async function submitRfq(input: {
  contact: RfqContact;
  items: RfqItem[];
  message?: string;
  buyerUid: string;
  buyerId: string;
  companyId: string;
  locationId?: string;
}): Promise<string> {
  if (input.items.length === 0) {
    throw new Error('Add at least one item to the RFQ before submitting.');
  }
  const rfqNo = newRfqNo();
  // Drop empty/undefined optional contact fields (Firestore rejects undefined).
  const contact = Object.fromEntries(
    Object.entries(input.contact).filter(([, v]) => v !== undefined && v !== ''),
  ) as RfqContact;
  const payload: RfqDoc = {
    rfqNo,
    channel: 'online',
    buyerUid: input.buyerUid,
    buyerId: input.buyerId,
    companyId: input.companyId,
    ...(input.locationId ? { locationId: input.locationId } : {}),
    contact,
    items: input.items,
    ...(input.message?.trim() ? { message: input.message.trim() } : {}),
    status: 'Pending',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'rfqs', rfqNo), {
    ...payload,
    // server timestamp for reliable ordering regardless of client clock
    createdAtServer: serverTimestamp(),
  });
  return rfqNo;
}

/**
 * Admin-only: record an offline order's originating RFQ (channel 'offline',
 * no buyerUid). Returns the generated RFQ number, which the PO then links to.
 */
export async function createOfflineRfq(input: {
  contact: RfqContact;
  items: RfqItem[];
  buyerId: string;
  companyId: string;
  locationId?: string;
  status?: RfqStatus;
  message?: string;
}): Promise<string> {
  const rfqNo = newRfqNo();
  const contact = Object.fromEntries(
    Object.entries(input.contact).filter(([, v]) => v !== undefined && v !== ''),
  ) as RfqContact;
  const payload: RfqDoc = {
    rfqNo,
    channel: 'offline',
    buyerId: input.buyerId,
    companyId: input.companyId,
    ...(input.locationId ? { locationId: input.locationId } : {}),
    contact,
    items: input.items,
    ...(input.message?.trim() ? { message: input.message.trim() } : {}),
    status: input.status ?? 'Won',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'rfqs', rfqNo), { ...payload, createdAtServer: serverTimestamp() });
  return rfqNo;
}

// ── Admin reads/writes ────────────────────────────────────────────────────

export async function listRfqs(status?: RfqStatus): Promise<RfqDoc[]> {
  const base = collection(db, 'rfqs');
  const q = status
    ? query(base, where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RfqDoc);
}

export async function setRfqStatus(rfqNo: string, status: RfqStatus): Promise<void> {
  await updateDoc(doc(db, 'rfqs', rfqNo), { status });
}

export async function listProducts(): Promise<ProductDoc[]> {
  const snap = await getDocs(query(collection(db, 'products'), orderBy('partNumber')));
  return snap.docs.map((d) => d.data() as ProductDoc);
}

export async function getProductDoc(partNumber: string): Promise<ProductDoc | null> {
  const snap = await getDoc(doc(db, 'products', partNumber));
  return snap.exists() ? (snap.data() as ProductDoc) : null;
}

export async function upsertProduct(product: ProductDoc): Promise<void> {
  await setDoc(
    doc(db, 'products', product.partNumber),
    { ...product, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function deleteProduct(partNumber: string): Promise<void> {
  await deleteDoc(doc(db, 'products', partNumber));
}

/** How many products point at a category (used to guard category deletion). */
export async function countProductsInCategory(categoryId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'products'), where('categoryId', '==', categoryId)),
  );
  return snap.size;
}

/** Spares (BOM) belonging to one equipment, oldest number first. */
export async function listSpares(parentEquipmentId: string): Promise<ProductDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'products'), where('parentEquipmentId', '==', parentEquipmentId)),
  );
  return snap.docs
    .map((d) => d.data() as ProductDoc)
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber));
}

/** Mint the next spare number for an equipment, e.g. AST-RS-00001-S003. */
export async function mintSpareNumber(parentEquipmentId: string): Promise<string> {
  const fn = httpsCallable<{ name: string; parent: string }, { id: string; seq: number }>(
    functions,
    'mintSequence',
  );
  const res = await fn({ name: 'spare', parent: parentEquipmentId });
  return res.data.id;
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('order')));
  return snap.docs.map((d) => d.data() as Category);
}

export async function upsertCategory(category: Category): Promise<void> {
  await setDoc(
    doc(db, 'categories', category.id),
    { ...category, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', id));
}

// ── Site content (homepage hero + footer) ───────────────────────────────────

export async function getSiteConfigDoc(): Promise<Partial<SiteConfig> | null> {
  const snap = await getDoc(doc(db, 'site', 'landing'));
  return snap.exists() ? (snap.data() as Partial<SiteConfig>) : null;
}

export async function upsertSiteConfig(config: SiteConfig): Promise<void> {
  await setDoc(doc(db, 'site', 'landing'), { ...config, updatedAt: Date.now() });
}

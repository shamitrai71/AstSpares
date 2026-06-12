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
import { db } from './firebase';
import type { Category, RfqContact, RfqDoc, RfqItem, RfqStatus, ProductDoc } from './types';

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
 * Submit an RFQ. Writes a single document to /rfqs; a Firestore-triggered
 * Cloud Function then emails the sales team and the customer (see functions/).
 * Returns the generated RFQ number.
 */
export async function submitRfq(
  contact: RfqContact,
  items: RfqItem[],
  message?: string,
): Promise<string> {
  if (items.length === 0) throw new Error('Add at least one item to the RFQ before submitting.');
  const rfqNo = newRfqNo();
  const payload: RfqDoc = {
    rfqNo,
    contact,
    items,
    message: message?.trim() || undefined,
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

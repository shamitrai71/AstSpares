// Client-side operations for budgetary quotes and the negotiation thread.
// Quotes live at rfqs/{rfqNo}/quotes; messages at rfqs/{rfqNo}/messages.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { setRfqStatus } from './db';
import type { Quote, QuoteLineItem, RfqDoc, RfqMessage, MessageRole } from './types';

function clean<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ── Quotes ───────────────────────────────────────────────────────────────────

export async function listQuotes(rfqNo: string): Promise<Quote[]> {
  const snap = await getDocs(query(collection(db, 'rfqs', rfqNo, 'quotes'), orderBy('revision', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quote, 'id'>) }));
}

/** Admin: post a new budgetary quote. Supersedes the prior live one, bumps the
 *  revision, and moves the RFQ to 'Quoted'. */
export async function createQuote(
  rfqNo: string,
  input: {
    currency: string;
    items: { partNumber?: string; description: string; quantity: number; unitPrice: number }[];
    leadTime?: string;
    validUntil?: string;
    terms?: string;
    notes?: string;
  },
  adminUid: string,
): Promise<void> {
  const existing = await listQuotes(rfqNo);
  await Promise.all(
    existing
      .filter((q) => q.status === 'sent')
      .map((q) => updateDoc(doc(db, 'rfqs', rfqNo, 'quotes', q.id), { status: 'superseded' })),
  );
  const revision = existing.reduce((m, q) => Math.max(m, q.revision), 0) + 1;
  const lineItems: QuoteLineItem[] = input.items.map((i) =>
    clean({
      partNumber: i.partNumber?.trim() || undefined,
      description: i.description.trim(),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
    }) as QuoteLineItem,
  );
  const subtotal = Math.round(lineItems.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

  await addDoc(collection(db, 'rfqs', rfqNo, 'quotes'), clean({
    rfqNo,
    revision,
    currency: input.currency,
    lineItems,
    subtotal,
    total: subtotal,
    leadTime: input.leadTime?.trim() || undefined,
    validUntil: input.validUntil || undefined,
    terms: input.terms?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: 'sent',
    createdByUid: adminUid,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  }));

  await setRfqStatus(rfqNo, 'Quoted');
}

// ── Negotiation thread ───────────────────────────────────────────────────────

export async function listMessages(rfqNo: string): Promise<RfqMessage[]> {
  const snap = await getDocs(query(collection(db, 'rfqs', rfqNo, 'messages'), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RfqMessage, 'id'>) }));
}

export async function sendMessage(
  rfqNo: string,
  input: { senderUid: string; senderRole: MessageRole; senderName?: string; body: string; kind?: 'message' | 'negotiate' },
): Promise<void> {
  await addDoc(collection(db, 'rfqs', rfqNo, 'messages'), clean({
    rfqNo,
    senderUid: input.senderUid,
    senderRole: input.senderRole,
    senderName: input.senderName || undefined,
    body: input.body.trim(),
    kind: input.kind ?? 'message',
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  }));
}

// ── Buyer actions on their own RFQ ───────────────────────────────────────────

/** Buyer opens a negotiation: posts the required message and flags the RFQ. */
export async function negotiate(
  rfqNo: string,
  input: { senderUid: string; senderName?: string; body: string },
): Promise<void> {
  await sendMessage(rfqNo, { ...input, senderRole: 'buyer', kind: 'negotiate' });
  await updateDoc(doc(db, 'rfqs', rfqNo), { status: 'Negotiating', updatedAt: Date.now() });
}

/** Buyer accepts a quote. */
export async function acceptQuote(rfqNo: string, quoteId: string): Promise<void> {
  await updateDoc(doc(db, 'rfqs', rfqNo), {
    status: 'Won',
    acceptedQuoteId: quoteId,
    acceptedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// ── Buyer's own RFQ list ─────────────────────────────────────────────────────

export async function listMyRfqs(uid: string): Promise<RfqDoc[]> {
  const snap = await getDocs(query(collection(db, 'rfqs'), where('buyerUid', '==', uid)));
  return snap.docs
    .map((d) => d.data() as RfqDoc)
    .sort((a, b) => b.createdAt - a.createdAt);
}

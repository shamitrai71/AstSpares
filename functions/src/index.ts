import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

admin.initializeApp();

// Configure with:  firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Plain env vars (set in functions runtime or .env): where quotes are routed
// and the verified From address on your Resend domain.
const SALES_EMAIL = process.env.SALES_EMAIL || 'sales@astspares.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'ASTSPARES <rfq@astspares.com>';
// Base URL for the deep links in notification emails (no trailing slash).
const APP_URL = process.env.APP_URL || 'https://astspares.web.app';

interface RfqItem {
  partNumber: string;
  productName: string;
  quantity: number;
  requiredBy: string | null;
  note?: string;
}
interface RfqDoc {
  rfqNo: string;
  contact: { name: string; company: string; email: string; phone?: string; country?: string };
  items: RfqItem[];
  message?: string;
  status: string;
  createdAt: number;
}

function itemRows(items: RfqItem[]): string {
  return items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${i.partNumber}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.productName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${i.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.requiredBy || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.note || ''}</td>
      </tr>`,
    )
    .join('');
}

function salesEmail(rfq: RfqDoc): string {
  const c = rfq.contact;
  return `
  <div style="font-family:system-ui,sans-serif;color:#0E1C24">
    <h2 style="margin:0 0 4px">New RFQ — ${rfq.rfqNo}</h2>
    <p style="color:#5C6B73;margin:0 0 16px">${c.company} · ${c.name}</p>
    <p>
      <strong>Email:</strong> <a href="mailto:${c.email}">${c.email}</a><br/>
      ${c.phone ? `<strong>Phone:</strong> ${c.phone}<br/>` : ''}
      ${c.country ? `<strong>Country:</strong> ${c.country}<br/>` : ''}
    </p>
    ${rfq.message ? `<p style="background:#F4EFE6;padding:10px;border-radius:4px">${rfq.message}</p>` : ''}
    <table style="border-collapse:collapse;width:100%;margin-top:8px">
      <thead>
        <tr style="text-align:left;font-size:12px;color:#5C6B73;text-transform:uppercase">
          <th style="padding:6px 10px">Part</th><th style="padding:6px 10px">Name</th>
          <th style="padding:6px 10px;text-align:right">Qty</th>
          <th style="padding:6px 10px">Required by</th><th style="padding:6px 10px">Note</th>
        </tr>
      </thead>
      <tbody>${itemRows(rfq.items)}</tbody>
    </table>
  </div>`;
}

function customerEmail(rfq: RfqDoc): string {
  return `
  <div style="font-family:system-ui,sans-serif;color:#0E1C24">
    <h2 style="margin:0 0 8px">We've received your request</h2>
    <p>Thanks ${rfq.contact.name} — your RFQ reference is
       <strong style="font-family:monospace">${rfq.rfqNo}</strong>.</p>
    <p style="color:#5C6B73">Our team will reply with pricing and confirmed lead times. Your requested items:</p>
    <table style="border-collapse:collapse;width:100%;margin-top:8px">
      <tbody>${itemRows(rfq.items)}</tbody>
    </table>
    <p style="color:#5C6B73;font-size:13px;margin-top:16px">ASTSPARES — storage-tank &amp; terminal spares</p>
  </div>`;
}

export const onRfqCreated = onDocumentCreated(
  { document: 'rfqs/{rfqNo}', secrets: [RESEND_API_KEY], region: 'asia-south1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const rfq = snap.data() as RfqDoc;

    const resend = new Resend(RESEND_API_KEY.value());

    try {
      // 1) Notify sales (reply-to the customer so they can answer directly).
      await resend.emails.send({
        from: FROM_EMAIL,
        to: SALES_EMAIL,
        reply_to: rfq.contact.email,
        subject: `RFQ ${rfq.rfqNo} — ${rfq.contact.company} (${rfq.items.length} items)`,
        html: salesEmail(rfq),
      });

      // 2) Confirm to the customer.
      await resend.emails.send({
        from: FROM_EMAIL,
        to: rfq.contact.email,
        subject: `Your ASTSPARES RFQ ${rfq.rfqNo}`,
        html: customerEmail(rfq),
      });

      await snap.ref.update({ notifiedAt: Date.now() });
      logger.info(`RFQ ${rfq.rfqNo} notified`, { items: rfq.items.length });
    } catch (err) {
      logger.error(`Failed to send RFQ ${rfq.rfqNo} emails`, err);
      // Leave notifiedAt unset so the failure is visible/retryable.
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// mintSequence — atomic, gap-free ID generator.
//
// Counters live at /counters/{name} and are written only here (Admin SDK),
// so clients can never tamper with them. Formats:
//   company  AST-CO-#####
//   buyer    AST-BUY-#####
//   po       AST-PO-<year>-#####   (counter resets per year; admin-only)
// Returns { id, seq }.
// ─────────────────────────────────────────────────────────────────────────
type SeqName = 'company' | 'buyer' | 'po' | 'spare' | 'vendor' | 'location';

function formatSeq(name: SeqName, n: number, year: number): string {
  const pad = (v: number) => String(v).padStart(5, '0');
  if (name === 'company') return `AST-CO-${pad(n)}`;
  if (name === 'buyer') return `AST-BUY-${pad(n)}`;
  if (name === 'vendor') return `AST-V-${pad(n)}`;
  if (name === 'location') return `AST-LOC-${pad(n)}`;
  return `AST-PO-${year}-${pad(n)}`;
}

export const mintSequence = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const name = String(request.data?.name ?? '') as SeqName;
  if (name !== 'company' && name !== 'buyer' && name !== 'po' && name !== 'spare' && name !== 'vendor' && name !== 'location') {
    throw new HttpsError('invalid-argument', `Unknown sequence "${name}".`);
  }

  const db = admin.firestore();

  // PO, spare and vendor numbers are issued only by admins.
  if (name === 'po' || name === 'spare' || name === 'vendor' || name === 'location') {
    const isAdmin = (await db.doc(`admins/${request.auth.uid}`).get()).exists;
    if (!isAdmin) throw new HttpsError('permission-denied', 'Admins only.');
  }

  // Spare numbers are scoped to a parent equipment number, e.g. AST-RS-00001.
  let parent = '';
  if (name === 'spare') {
    parent = String(request.data?.parent ?? '').trim().toUpperCase();
    if (!/^AST-[A-Z0-9]+-\d+$/.test(parent)) {
      throw new HttpsError('invalid-argument', 'A valid parent equipment number is required.');
    }
  }

  const year = new Date().getFullYear();
  // PO resets yearly; spare counts per equipment; others are a single counter.
  const counterId =
    name === 'po' ? `po-${year}` : name === 'spare' ? `spare-${parent}` : name;
  const ref = db.doc(`counters/${counterId}`);

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.seq as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });

  const id =
    name === 'spare' ? `${parent}-S${String(seq).padStart(3, '0')}` : formatSeq(name, seq, year);
  return { id, seq };
});

// ─────────────────────────────────────────────────────────────────────────
// In-app quote/negotiation notifications.
//
// Email is only a ping with a deep link — never the prices or message body.
// The actual quote and conversation live in the app (buyer: /account,
// admin: /admin/rfqs). Both triggers fire only for ONLINE RFQs, since offline
// records have no buyer account to point at.
// ─────────────────────────────────────────────────────────────────────────

interface RfqParent {
  rfqNo: string;
  channel?: string;
  buyerUid?: string | null;
  contact: { name: string; company: string; email: string };
}
interface MessageDoc {
  senderRole: 'buyer' | 'admin';
  senderName?: string;
  body: string;
}

function pingEmail(opts: { heading: string; body: string; cta: string; href: string }): string {
  return `
  <div style="font-family:system-ui,sans-serif;color:#0E1C24;max-width:520px">
    <h2 style="margin:0 0 8px">${opts.heading}</h2>
    <p style="color:#5C6B73;margin:0 0 16px">${opts.body}</p>
    <p style="margin:0 0 20px">
      <a href="${opts.href}" style="display:inline-block;background:#EE6C2B;color:#fff;
         text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${opts.cta}</a>
    </p>
    <p style="color:#5C6B73;font-size:13px">ASTSPARES — storage-tank &amp; terminal spares. No pricing is shared by email.</p>
  </div>`;
}

async function getRfq(rfqNo: string): Promise<RfqParent | null> {
  const snap = await admin.firestore().doc(`rfqs/${rfqNo}`).get();
  if (!snap.exists) return null;
  const data = snap.data() as Omit<RfqParent, 'rfqNo'>;
  return { rfqNo, ...data };
}

// Quote posted → tell the buyer to review it in their account.
export const onQuoteCreated = onDocumentCreated(
  { document: 'rfqs/{rfqNo}/quotes/{quoteId}', secrets: [RESEND_API_KEY], region: 'asia-south1' },
  async (event) => {
    const rfqNo = event.params.rfqNo as string;
    const rfq = await getRfq(rfqNo);
    if (!rfq || rfq.channel !== 'online' || !rfq.contact?.email) return;

    const resend = new Resend(RESEND_API_KEY.value());
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: rfq.contact.email,
        subject: `Your budgetary quote for ${rfqNo} is ready`,
        html: pingEmail({
          heading: 'Your quote is ready',
          body: `We've posted a budgetary quote for <strong>${rfqNo}</strong>. Review the line items and lead time in your account, then accept or negotiate.`,
          cta: 'View your quote',
          href: `${APP_URL}/account/`,
        }),
      });
      logger.info(`Quote notification sent for ${rfqNo}`);
    } catch (err) {
      logger.error(`Failed to send quote notification for ${rfqNo}`, err);
    }
  },
);

// New negotiation message → ping the other party.
export const onMessageCreated = onDocumentCreated(
  { document: 'rfqs/{rfqNo}/messages/{msgId}', secrets: [RESEND_API_KEY], region: 'asia-south1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data() as MessageDoc;
    const rfqNo = event.params.rfqNo as string;
    const rfq = await getRfq(rfqNo);
    if (!rfq || rfq.channel !== 'online' || !rfq.contact?.email) return;

    const resend = new Resend(RESEND_API_KEY.value());
    try {
      if (msg.senderRole === 'buyer') {
        // Buyer wrote → notify sales.
        await resend.emails.send({
          from: FROM_EMAIL,
          to: SALES_EMAIL,
          reply_to: rfq.contact.email,
          subject: `Negotiation on ${rfqNo} — ${rfq.contact.company}`,
          html: pingEmail({
            heading: `New message on ${rfqNo}`,
            body: `${rfq.contact.name} at ${rfq.contact.company} sent a negotiation message. Open the RFQ to reply or post a revised quote.`,
            cta: 'Open RFQ',
            href: `${APP_URL}/admin/rfqs/`,
          }),
        });
      } else {
        // Admin replied → notify the buyer.
        await resend.emails.send({
          from: FROM_EMAIL,
          to: rfq.contact.email,
          subject: `ASTSPARES replied on ${rfqNo}`,
          html: pingEmail({
            heading: 'You have a new message',
            body: `Our team replied on your request <strong>${rfqNo}</strong>. View the conversation and the latest quote in your account.`,
            cta: 'Open in your account',
            href: `${APP_URL}/account/`,
          }),
        });
      }
      logger.info(`Message notification sent for ${rfqNo} (${msg.senderRole})`);
    } catch (err) {
      logger.error(`Failed to send message notification for ${rfqNo}`, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// publishCatalog — one-click rebuild of the static catalog.
//
// The public catalog is a static export built from a Firestore snapshot, so
// content edits in the admin (products, images, categories, landing) only go
// live after a Cloud Build run. This callable (admin-only) kicks off the
// existing build trigger via the Cloud Build REST API, authenticating with the
// function's own service-account token from the metadata server — no key, no
// extra npm dependency.
//
// The runtime service account needs the Cloud Build Editor role
// (roles/cloudbuild.builds.editor).
// ─────────────────────────────────────────────────────────────────────────
const BUILD_TRIGGER = process.env.BUILD_TRIGGER || 'astspares-deploy';
const BUILD_BRANCH = process.env.BUILD_BRANCH || 'main';

export const publishCatalog = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const isAdmin = (await admin.firestore().doc(`admins/${request.auth.uid}`).get()).exists;
  if (!isAdmin) throw new HttpsError('permission-denied', 'Admins only.');

  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'astspares';

  // Access token for the function's own service account.
  let token: string;
  try {
    const r = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } },
    );
    const body = (await r.json()) as { access_token?: string };
    if (!r.ok || !body.access_token) throw new Error(`metadata ${r.status}`);
    token = body.access_token;
  } catch (err) {
    logger.error('publishCatalog: could not obtain access token', err);
    throw new HttpsError('internal', 'Could not authenticate the build request.');
  }

  // Run the existing build trigger on the configured branch.
  const url = `https://cloudbuild.googleapis.com/v1/projects/${project}/triggers/${BUILD_TRIGGER}:run`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName: BUILD_BRANCH }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`publishCatalog: trigger run failed (${res.status})`, text);
    if (res.status === 403) throw new HttpsError('permission-denied', 'The build service account is missing Cloud Build permissions.');
    if (res.status === 404) throw new HttpsError('not-found', `Build trigger "${BUILD_TRIGGER}" not found.`);
    throw new HttpsError('internal', 'Failed to start the build.');
  }

  logger.info(`publishCatalog: build triggered by ${request.auth.uid}`);
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────────────────
// Admin buyer-account management.
// Creating a buyer WITH sign-in credentials, or disabling/deleting one, needs
// the Admin SDK (Firebase Auth), so these run server-side and are admin-only.
// Buyer numbers share the same monotonic counter as mintSequence, so a deleted
// buyer's number is retired, never reused.
// ─────────────────────────────────────────────────────────────────────────
async function requireAdmin(uid: string | undefined): Promise<string> {
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const isAdmin = (await admin.firestore().doc(`admins/${uid}`).get()).exists;
  if (!isAdmin) throw new HttpsError('permission-denied', 'Admins only.');
  return uid;
}

async function nextBuyerId(): Promise<string> {
  const db = admin.firestore();
  const ref = db.doc('counters/buyer');
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.seq as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });
  return `AST-BUY-${String(seq).padStart(5, '0')}`;
}

export const adminCreateBuyer = onCall({ region: 'asia-south1' }, async (request) => {
  const adminUid = await requireAdmin(request.auth?.uid);
  const d = (request.data ?? {}) as Record<string, unknown>;
  const s = (k: string) => String(d[k] ?? '').trim();

  const email = s('email').toLowerCase();
  const password = String(d.password ?? '');
  const name = s('name');
  const companyId = s('companyId');
  const companyName = s('companyName');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpsError('invalid-argument', 'A valid email is required.');
  if (password.length < 6) throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  if (!name) throw new HttpsError('invalid-argument', 'Name is required.');
  if (!companyId || !companyName) throw new HttpsError('invalid-argument', 'A company is required.');

  let user;
  try {
    user = await admin.auth().createUser({ email, password, displayName: name });
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with that email already exists.');
    }
    logger.error('adminCreateBuyer: createUser failed', err);
    throw new HttpsError('internal', 'Could not create the sign-in account.');
  }

  const id = await nextBuyerId();
  const record: Record<string, unknown> = {
    id,
    uid: user.uid,
    name,
    email,
    companyId,
    companyName,
    channel: 'offline',
    verified: true,
    disabled: false,
    createdBy: adminUid,
    createdAt: Date.now(),
  };
  for (const k of ['phone', 'dialCode', 'country', 'designation', 'department']) {
    const v = s(k);
    if (v) record[k] = v;
  }
  await admin.firestore().doc(`buyers/${id}`).set(record);
  return { id, uid: user.uid };
});

export const adminSetBuyerDisabled = onCall({ region: 'asia-south1' }, async (request) => {
  await requireAdmin(request.auth?.uid);
  const buyerId = String(request.data?.buyerId ?? '').trim();
  const disabled = Boolean(request.data?.disabled);
  if (!buyerId) throw new HttpsError('invalid-argument', 'buyerId is required.');

  const ref = admin.firestore().doc(`buyers/${buyerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Buyer not found.');

  const uid = snap.data()?.uid as string | null | undefined;
  if (uid) {
    try {
      await admin.auth().updateUser(uid, { disabled });
    } catch (err) {
      logger.error('adminSetBuyerDisabled: updateUser failed', err);
    }
  }
  await ref.set({ disabled, updatedAt: Date.now() }, { merge: true });
  return { ok: true };
});

export const adminDeleteBuyer = onCall({ region: 'asia-south1' }, async (request) => {
  await requireAdmin(request.auth?.uid);
  const buyerId = String(request.data?.buyerId ?? '').trim();
  if (!buyerId) throw new HttpsError('invalid-argument', 'buyerId is required.');

  const ref = admin.firestore().doc(`buyers/${buyerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Buyer not found.');

  const uid = snap.data()?.uid as string | null | undefined;
  if (uid) {
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      logger.error('adminDeleteBuyer: deleteUser failed (continuing)', err);
    }
  }
  await ref.delete();
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────────────────
// Back-to-back vendor enquiries.
// Generate one draft enquiry per vendor from a buyer RFQ (grouping the items
// each vendor sources), then send a PRIVACY-SAFE email asking the vendor to
// quote cost + lead time. The email never reveals the buyer or the sell price.
// vendorEnquiries share the same monotonic counter discipline (AST-VE-#####).
// ─────────────────────────────────────────────────────────────────────────
function stripUndef<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

async function nextVendorEnquiryId(): Promise<string> {
  const db = admin.firestore();
  const ref = db.doc('counters/ve');
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.seq as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });
  return `AST-VE-${String(seq).padStart(5, '0')}`;
}

export const generateVendorEnquiries = onCall({ region: 'asia-south1' }, async (request) => {
  const adminUid = await requireAdmin(request.auth?.uid);
  const rfqNo = String(request.data?.rfqNo ?? '').trim();
  if (!rfqNo) throw new HttpsError('invalid-argument', 'rfqNo is required.');
  const db = admin.firestore();

  const rfqSnap = await db.doc(`rfqs/${rfqNo}`).get();
  if (!rfqSnap.exists) throw new HttpsError('not-found', 'RFQ not found.');
  const rfq = rfqSnap.data() as {
    items?: { partNumber: string; productName: string; quantity: number; uom?: string }[];
  };
  const items = rfq.items ?? [];

  const [offSnap, venSnap] = await Promise.all([
    db.collection('vendorOfferings').get(),
    db.collection('vendors').get(),
  ]);
  const offerings = offSnap.docs.map(
    (d) => d.data() as { itemPartNumber: string; vendorId: string; cost: number; currency: string; leadTimeDays?: number },
  );
  const vendors = new Map(venSnap.docs.map((d) => [d.id, d.data() as { name: string; contactEmail?: string }]));

  // Group items by vendor. An item offered by N vendors lands in N buckets
  // (multiple vendors per item → competitive enquiries).
  type Item = ReturnType<typeof buildItem>;
  const buildItem = (
    it: { partNumber: string; productName: string; quantity: number; uom?: string },
    o: { cost: number; leadTimeDays?: number },
  ) =>
    stripUndef({
      itemPartNumber: it.partNumber,
      description: it.productName,
      quantity: it.quantity,
      uom: it.uom,
      refCost: o.cost,
      refLeadTimeDays: o.leadTimeDays,
    });

  const buckets = new Map<string, { items: Item[]; currency: string }>();
  const unsourced: string[] = [];
  for (const it of items) {
    const offs = offerings.filter((o) => o.itemPartNumber === it.partNumber);
    if (offs.length === 0) {
      unsourced.push(it.partNumber);
      continue;
    }
    for (const o of offs) {
      const b = buckets.get(o.vendorId) ?? { items: [], currency: o.currency || 'INR' };
      b.items.push(buildItem(it, o));
      buckets.set(o.vendorId, b);
    }
  }

  // Refresh drafts for this RFQ (keep any already sent/responded).
  const existing = await db
    .collection('vendorEnquiries')
    .where('rfqNo', '==', rfqNo)
    .where('status', '==', 'draft')
    .get();
  const delBatch = db.batch();
  existing.docs.forEach((d) => delBatch.delete(d.ref));
  await delBatch.commit();

  let created = 0;
  for (const [vendorId, b] of buckets) {
    const v = vendors.get(vendorId);
    const id = await nextVendorEnquiryId();
    const email = (v?.contactEmail ?? '').trim();
    const rec = stripUndef({
      id,
      rfqNo,
      vendorId,
      vendorName: v?.name ?? vendorId,
      vendorEmail: email || undefined,
      currency: b.currency || 'INR',
      items: b.items,
      status: 'draft',
      createdBy: adminUid,
      createdAt: Date.now(),
    });
    await db.doc(`vendorEnquiries/${id}`).set(rec);
    created += 1;
  }

  return { created, unsourced, vendors: buckets.size };
});

export const sendVendorEnquiry = onCall(
  { region: 'asia-south1', secrets: [RESEND_API_KEY] },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const id = String(request.data?.enquiryId ?? '').trim();
    if (!id) throw new HttpsError('invalid-argument', 'enquiryId is required.');
    const db = admin.firestore();
    const ref = db.doc(`vendorEnquiries/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Enquiry not found.');
    const e = snap.data() as {
      vendorName: string;
      vendorEmail?: string;
      currency: string;
      items: { itemPartNumber: string; description: string; quantity: number; uom?: string }[];
    };
    const email = (e.vendorEmail ?? '').trim();
    if (!email) {
      throw new HttpsError('failed-precondition', 'This vendor has no contact email — add one under Vendors, then regenerate.');
    }

    const rows = e.items
      .map(
        (it) =>
          `<tr><td style="padding:4px 14px 4px 0;font-family:monospace">${it.itemPartNumber}</td>` +
          `<td style="padding:4px 14px 4px 0">${it.description}</td>` +
          `<td style="padding:4px 0;text-align:right">${it.quantity}${it.uom ? ' ' + it.uom : ''}</td></tr>`,
      )
      .join('');
    // Privacy: no buyer identity, no buyer RFQ number, no sell price.
    const html =
      `<p>Dear ${e.vendorName},</p>` +
      `<p>Please send us your best <strong>unit price and lead time</strong> for the items below, quoted in <strong>${e.currency}</strong>. Reply to this email with your quotation. Our reference: <strong>${id}</strong>.</p>` +
      `<table style="border-collapse:collapse;margin:12px 0"><thead><tr>` +
      `<th style="text-align:left;padding:4px 14px 4px 0">Part</th>` +
      `<th style="text-align:left;padding:4px 14px 4px 0">Description</th>` +
      `<th style="text-align:right;padding:4px 0">Qty</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p>Thank you,<br/>ASTSPARES — Procurement</p>`;

    const resend = new Resend(RESEND_API_KEY.value());
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        reply_to: SALES_EMAIL,
        subject: `ASTSPARES — Enquiry ${id}`,
        html,
      });
    } catch (err) {
      logger.error(`Failed to send vendor enquiry ${id}`, err);
      throw new HttpsError('internal', 'Could not send the enquiry email.');
    }
    await ref.set({ status: 'sent', sentAt: Date.now() }, { merge: true });
    return { ok: true };
  },
);

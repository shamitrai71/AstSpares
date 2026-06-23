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
type SeqName = 'company' | 'buyer' | 'po';

function formatSeq(name: SeqName, n: number, year: number): string {
  const pad = (v: number) => String(v).padStart(5, '0');
  if (name === 'company') return `AST-CO-${pad(n)}`;
  if (name === 'buyer') return `AST-BUY-${pad(n)}`;
  return `AST-PO-${year}-${pad(n)}`;
}

export const mintSequence = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const name = String(request.data?.name ?? '') as SeqName;
  if (name !== 'company' && name !== 'buyer' && name !== 'po') {
    throw new HttpsError('invalid-argument', `Unknown sequence "${name}".`);
  }

  const db = admin.firestore();

  // PO numbers are issued only by admins.
  if (name === 'po') {
    const isAdmin = (await db.doc(`admins/${request.auth.uid}`).get()).exists;
    if (!isAdmin) throw new HttpsError('permission-denied', 'Admins only.');
  }

  const year = new Date().getFullYear();
  // PO resets yearly → per-year counter doc; others are a single running counter.
  const counterId = name === 'po' ? `po-${year}` : name;
  const ref = db.doc(`counters/${counterId}`);

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.seq as number) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });

  return { id: formatSeq(name, seq, year), seq };
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

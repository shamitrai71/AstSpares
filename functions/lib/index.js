"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessageCreated = exports.onQuoteCreated = exports.mintSequence = exports.onRfqCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
admin.initializeApp();
// Configure with:  firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
// Plain env vars (set in functions runtime or .env): where quotes are routed
// and the verified From address on your Resend domain.
const SALES_EMAIL = process.env.SALES_EMAIL || 'sales@astspares.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'ASTSPARES <rfq@astspares.com>';
// Base URL for the deep links in notification emails (no trailing slash).
const APP_URL = process.env.APP_URL || 'https://astspares.web.app';
function itemRows(items) {
    return items
        .map((i) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${i.partNumber}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.productName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${i.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.requiredBy || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.note || ''}</td>
      </tr>`)
        .join('');
}
function salesEmail(rfq) {
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
function customerEmail(rfq) {
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
exports.onRfqCreated = (0, firestore_1.onDocumentCreated)({ document: 'rfqs/{rfqNo}', secrets: [RESEND_API_KEY], region: 'asia-south1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const rfq = snap.data();
    const resend = new resend_1.Resend(RESEND_API_KEY.value());
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
        firebase_functions_1.logger.info(`RFQ ${rfq.rfqNo} notified`, { items: rfq.items.length });
    }
    catch (err) {
        firebase_functions_1.logger.error(`Failed to send RFQ ${rfq.rfqNo} emails`, err);
        // Leave notifiedAt unset so the failure is visible/retryable.
    }
});
function formatSeq(name, n, year) {
    const pad = (v) => String(v).padStart(5, '0');
    if (name === 'company')
        return `AST-CO-${pad(n)}`;
    if (name === 'buyer')
        return `AST-BUY-${pad(n)}`;
    return `AST-PO-${year}-${pad(n)}`;
}
exports.mintSequence = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const name = String(request.data?.name ?? '');
    if (name !== 'company' && name !== 'buyer' && name !== 'po') {
        throw new https_1.HttpsError('invalid-argument', `Unknown sequence "${name}".`);
    }
    const db = admin.firestore();
    // PO numbers are issued only by admins.
    if (name === 'po') {
        const isAdmin = (await db.doc(`admins/${request.auth.uid}`).get()).exists;
        if (!isAdmin)
            throw new https_1.HttpsError('permission-denied', 'Admins only.');
    }
    const year = new Date().getFullYear();
    // PO resets yearly → per-year counter doc; others are a single running counter.
    const counterId = name === 'po' ? `po-${year}` : name;
    const ref = db.doc(`counters/${counterId}`);
    const seq = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? (snap.data()?.seq ?? 0) : 0;
        const next = current + 1;
        tx.set(ref, { seq: next, updatedAt: Date.now() }, { merge: true });
        return next;
    });
    return { id: formatSeq(name, seq, year), seq };
});
function pingEmail(opts) {
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
async function getRfq(rfqNo) {
    const snap = await admin.firestore().doc(`rfqs/${rfqNo}`).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return { rfqNo, ...data };
}
// Quote posted → tell the buyer to review it in their account.
exports.onQuoteCreated = (0, firestore_1.onDocumentCreated)({ document: 'rfqs/{rfqNo}/quotes/{quoteId}', secrets: [RESEND_API_KEY], region: 'asia-south1' }, async (event) => {
    const rfqNo = event.params.rfqNo;
    const rfq = await getRfq(rfqNo);
    if (!rfq || rfq.channel !== 'online' || !rfq.contact?.email)
        return;
    const resend = new resend_1.Resend(RESEND_API_KEY.value());
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
        firebase_functions_1.logger.info(`Quote notification sent for ${rfqNo}`);
    }
    catch (err) {
        firebase_functions_1.logger.error(`Failed to send quote notification for ${rfqNo}`, err);
    }
});
// New negotiation message → ping the other party.
exports.onMessageCreated = (0, firestore_1.onDocumentCreated)({ document: 'rfqs/{rfqNo}/messages/{msgId}', secrets: [RESEND_API_KEY], region: 'asia-south1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const msg = snap.data();
    const rfqNo = event.params.rfqNo;
    const rfq = await getRfq(rfqNo);
    if (!rfq || rfq.channel !== 'online' || !rfq.contact?.email)
        return;
    const resend = new resend_1.Resend(RESEND_API_KEY.value());
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
        }
        else {
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
        firebase_functions_1.logger.info(`Message notification sent for ${rfqNo} (${msg.senderRole})`);
    }
    catch (err) {
        firebase_functions_1.logger.error(`Failed to send message notification for ${rfqNo}`, err);
    }
});

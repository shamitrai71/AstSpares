import { onDocumentCreated } from 'firebase-functions/v2/firestore';
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRfq } from '@/components/RfqProvider';
import { submitRfq } from '@/lib/db';
import type { RfqContact } from '@/lib/types';

const EMPTY: RfqContact = { name: '', company: '', email: '', phone: '', country: '' };

export default function RfqPage() {
  const { items, updateItem, removeItem, clear } = useRfq();
  const [contact, setContact] = useState<RfqContact>(EMPTY);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [rfqNo, setRfqNo] = useState('');
  const [error, setError] = useState('');

  const valid = contact.name && contact.company && /\S+@\S+\.\S+/.test(contact.email) && items.length > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setStatus('submitting');
    setError('');
    try {
      const no = await submitRfq(contact, items, message);
      setRfqNo(no);
      setStatus('done');
      clear();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong submitting your RFQ.');
    }
  };

  if (status === 'done') {
    return (
      <div className="shell py-20 text-center">
        <p className="eyebrow text-safety-600">Request received</p>
        <h1 className="mt-3 font-display text-4xl">RFQ submitted</h1>
        <p className="mx-auto mt-3 max-w-md text-petroleum-300">
          Your reference is below. Our team will reply by email with pricing and confirmed lead
          times. A copy has been sent to {contact.email}.
        </p>
        <p className="part-plate mx-auto mt-6 text-lg">{rfqNo}</p>
        <div className="mt-8">
          <Link href="/products/" className="btn-ghost">Continue browsing</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-12">
      <p className="eyebrow">Procurement</p>
      <h1 className="mt-2 font-display text-4xl">Your request for quote</h1>

      {items.length === 0 ? (
        <div className="panel mt-8 p-10 text-center">
          <p className="font-display text-xl">No items yet</p>
          <p className="mt-2 text-sm text-petroleum-300">Add parts from the catalog to build your RFQ.</p>
          <Link href="/products/" className="btn-primary mt-5">Browse the catalog</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* line items */}
          <div>
            <h2 className="mb-3 font-display text-2xl">Items ({items.length})</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.partNumber} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="part-plate">{item.partNumber}</span>
                      <p className="mt-1.5 text-sm text-petroleum">{item.productName}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.partNumber)}
                      className="text-xs text-petroleum-300 underline hover:text-safety"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <label>
                      <span className="field-label">Quantity</span>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.partNumber, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="field"
                      />
                    </label>
                    <label>
                      <span className="field-label">Required by</span>
                      <input
                        type="date"
                        value={item.requiredBy ?? ''}
                        onChange={(e) => updateItem(item.partNumber, { requiredBy: e.target.value || null })}
                        className="field"
                      />
                    </label>
                    <label className="col-span-2 sm:col-span-1">
                      <span className="field-label">Line note</span>
                      <input
                        value={item.note ?? ''}
                        onChange={(e) => updateItem(item.partNumber, { note: e.target.value })}
                        placeholder="e.g. tag, drawing ref"
                        className="field"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* contact + submit */}
          <div className="panel h-fit p-5">
            <h2 className="mb-4 font-display text-2xl">Your details</h2>
            <div className="space-y-3">
              <Field label="Name *" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} />
              <Field label="Company *" value={contact.company} onChange={(v) => setContact({ ...contact, company: v })} />
              <Field label="Work email *" type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={contact.phone ?? ''} onChange={(v) => setContact({ ...contact, phone: v })} />
                <Field label="Country" value={contact.country ?? ''} onChange={(v) => setContact({ ...contact, country: v })} />
              </div>
              <label className="block">
                <span className="field-label">Message</span>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Application, tank details, certifications required…"
                  className="field resize-none"
                />
              </label>
            </div>

            {status === 'error' && (
              <p className="mt-3 rounded-tag border border-safety/40 bg-safety/10 px-3 py-2 text-sm text-safety-600">
                {error}
              </p>
            )}

            <button onClick={handleSubmit} disabled={!valid || status === 'submitting'} className="btn-primary mt-4 w-full">
              {status === 'submitting' ? 'Submitting…' : 'Submit RFQ'}
            </button>
            <p className="mt-2 text-center text-xs text-petroleum-300">
              No pricing is shown online. We respond by email with a quote.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { acceptQuote, listMessages, listQuotes, negotiate, sendMessage } from '@/lib/quotes';
import type { Quote, RfqMessage, RfqStatus } from '@/lib/types';

function money(currency: string, n: number): string {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function QuoteThread({
  rfqNo,
  role,
  uid,
  name,
  rfqStatus,
  bump = 0,
  onChanged,
}: {
  rfqNo: string;
  role: 'admin' | 'buyer';
  uid: string;
  name?: string;
  rfqStatus: RfqStatus;
  bump?: number;
  onChanged?: () => void;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [messages, setMessages] = useState<RfqMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(role === 'admin');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [q, m] = await Promise.all([listQuotes(rfqNo), listMessages(rfqNo)]);
      setQuotes(q);
      setMessages(m);
    } finally {
      setLoading(false);
    }
  }, [rfqNo]);

  useEffect(() => { reload(); }, [reload, bump]);

  const live = quotes.find((q) => q.status === 'sent');
  const accepted = rfqStatus === 'Won';

  const doAccept = async () => {
    if (!live) return;
    setBusy(true);
    try {
      await acceptQuote(rfqNo, live.id);
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      if (role === 'buyer' && rfqStatus !== 'Negotiating') {
        await negotiate(rfqNo, { senderUid: uid, senderName: name, body });
      } else {
        await sendMessage(rfqNo, { senderUid: uid, senderRole: role, senderName: name, body });
      }
      setBody('');
      if (role === 'buyer') setComposing(false);
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="mt-3 text-sm text-petroleum-300">Loading quote…</p>;

  return (
    <div className="mt-4 space-y-4">
      {/* Quotes */}
      {quotes.length === 0 ? (
        <p className="text-sm text-petroleum-300">
          {role === 'admin' ? 'No quote posted yet.' : 'No quote yet — our team is preparing one.'}
        </p>
      ) : (
        quotes.map((q) => (
          <div key={q.id} className={`rounded-tag border p-4 ${q.status === 'sent' ? 'border-safety/50 bg-safety/5' : 'border-paper-line opacity-70'}`}>
            <div className="flex items-center justify-between">
              <span className="eyebrow text-petroleum-300">Quote · rev {q.revision}</span>
              <span className="eyebrow text-petroleum-300">{q.status}</span>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {q.lineItems.map((l, i) => (
                  <tr key={i} className="border-t border-paper-line/60">
                    <td className="py-1.5">
                      {l.partNumber && <span className="font-mono text-xs text-petroleum-300">{l.partNumber} · </span>}
                      {l.description}
                    </td>
                    <td className="py-1.5 text-right text-petroleum-300">{l.quantity}{l.uom ? ` ${l.uom}` : ''} ×</td>
                    <td className="py-1.5 text-right">{money(q.currency, l.unitPrice)}</td>
                    <td className="py-1.5 text-right font-medium">{money(q.currency, l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between border-t border-paper-line pt-2 text-sm">
              <span className="text-petroleum-300">Total</span>
              <span className="font-display text-lg">{money(q.currency, q.total)}</span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-petroleum-300">
              {q.leadTime && <p>Lead time: {q.leadTime}</p>}
              {q.validUntil && <p>Valid until: {q.validUntil}</p>}
              {q.terms && <p>Terms: {q.terms}</p>}
              {q.notes && <p>{q.notes}</p>}
            </div>

            {/* Buyer actions on the live quote */}
            {role === 'buyer' && q.status === 'sent' && !accepted && (
              <div className="mt-3 flex gap-2">
                <button onClick={doAccept} disabled={busy} className="btn-primary">Accept quote</button>
                <button onClick={() => setComposing(true)} className="btn-ghost">Negotiate</button>
              </div>
            )}
            {role === 'buyer' && accepted && q.id === live?.id && (
              <p className="mt-3 text-sm text-safety-600">✓ You accepted this quote.</p>
            )}
          </div>
        ))
      )}

      {/* Thread */}
      {messages.length > 0 && (
        <div className="space-y-2">
          <p className="field-label">Negotiation</p>
          {messages.map((m) => (
            <div key={m.id} className={`rounded-tag border border-paper-line p-3 text-sm ${m.senderRole === 'admin' ? 'bg-paper-200' : 'bg-white'}`}>
              <p className="text-xs text-petroleum-300">
                {m.senderRole === 'admin' ? 'ASTSPARES' : m.senderName ?? 'Buyer'}
              </p>
              <p className="mt-0.5 text-petroleum">{m.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      {composing ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={role === 'admin' ? 'Reply to the buyer…' : 'What would you like to negotiate? (price, terms, lead time…)'}
            className="field resize-none"
          />
          <div className="flex gap-2">
            <button onClick={doSend} disabled={busy || !body.trim()} className="btn-dark">
              {role === 'buyer' && rfqStatus !== 'Negotiating' ? 'Send & negotiate' : 'Send'}
            </button>
            {role === 'buyer' && <button onClick={() => setComposing(false)} className="btn-ghost">Cancel</button>}
          </div>
        </div>
      ) : (
        role === 'buyer' && rfqStatus === 'Negotiating' && (
          <button onClick={() => setComposing(true)} className="btn-ghost">Add a message</button>
        )
      )}
    </div>
  );
}

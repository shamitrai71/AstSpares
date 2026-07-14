'use client';

import { useEffect, useState } from 'react';
import {
  generateVendorEnquiries,
  sendVendorEnquiry,
  listEnquiriesForRfq,
  updateEnquiry,
  deleteEnquiry,
} from '@/lib/enquiries';
import type { VendorEnquiry, VendorEnquiryItem } from '@/lib/types';

const nf = new Intl.NumberFormat('en-IN');

const STATUS_TONE: Record<string, string> = {
  draft: 'text-petroleum-300',
  sent: 'text-safety-600',
  responded: 'text-safety',
  closed: 'text-petroleum-300',
};

export function VendorEnquiries({ rfqNo }: { rfqNo: string }) {
  const [list, setList] = useState<VendorEnquiry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState<string | null>(null);

  const load = () => listEnquiriesForRfq(rfqNo).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rfqNo]);

  const generate = async () => {
    if (list && list.length && !confirm('Regenerate drafts? Existing draft enquiries for this RFQ are rebuilt (sent/responded ones are kept).')) return;
    setBusy('gen');
    setNote('');
    try {
      const r = await generateVendorEnquiries(rfqNo);
      const bits = [`${r.created} draft enquir${r.created === 1 ? 'y' : 'ies'} across ${r.vendors} vendor${r.vendors === 1 ? '' : 's'}`];
      if (r.unsourced.length) bits.push(`${r.unsourced.length} unsourced item(s): ${r.unsourced.join(', ')}`);
      setNote(bits.join(' · '));
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(null);
    }
  };

  const send = async (e: VendorEnquiry) => {
    setBusy(e.id);
    try { await sendVendorEnquiry(e.id); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Send failed.'); }
    finally { setBusy(null); }
  };

  const remove = async (e: VendorEnquiry) => {
    if (!confirm(`Delete enquiry ${e.id}?`)) return;
    setBusy(e.id);
    try { await deleteEnquiry(e.id); await load(); }
    finally { setBusy(null); }
  };

  return (
    <div className="mt-6 border-t border-paper-line pt-5">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg">Vendor enquiries (back-to-back)</h4>
        <button onClick={generate} disabled={busy === 'gen'} className="btn-ghost px-3 py-1.5 text-sm">
          {busy === 'gen' ? 'Generating…' : list && list.length ? 'Regenerate drafts' : 'Generate from sourcing'}
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-petroleum-300">{note}</p>}

      {list === null ? (
        <p className="mt-3 text-sm text-petroleum-300">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-petroleum-300">
          No enquiries yet. “Generate from sourcing” fans this RFQ out to the vendors that offer each item.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {list.map((e) => (
            <div key={e.id} className="rounded-tag border border-paper-line bg-paper-200/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-petroleum-300">{e.id}</span>
                  <span className="font-medium text-petroleum">{e.vendorName}</span>
                  <span className={`eyebrow ${STATUS_TONE[e.status] ?? ''}`}>{e.status}</span>
                  <span className="font-mono text-[11px] text-petroleum-300">{e.currency}</span>
                  {!e.vendorEmail && <span className="eyebrow text-safety-600">no email</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {e.vendorEmail && (e.status === 'draft' || e.status === 'sent') && (
                    <button onClick={() => send(e)} disabled={busy === e.id} className="text-safety-600 underline">
                      {e.status === 'sent' ? 'Resend' : 'Send'}
                    </button>
                  )}
                  <button onClick={() => setRecording(recording === e.id ? null : e.id)} className="text-petroleum-300 underline hover:text-petroleum">
                    {recording === e.id ? 'Close' : 'Record response'}
                  </button>
                  <button onClick={() => remove(e)} disabled={busy === e.id} className="text-petroleum-300 underline hover:text-safety">Delete</button>
                </div>
              </div>

              <table className="mt-2 w-full text-sm">
                <tbody>
                  {e.items.map((it) => (
                    <tr key={it.itemPartNumber} className="border-t border-paper-line">
                      <td className="py-1 font-mono text-xs">{it.itemPartNumber}</td>
                      <td className="py-1 text-petroleum-300">{it.description}</td>
                      <td className="py-1 whitespace-nowrap text-right">{it.quantity}{it.uom ? ` ${it.uom}` : ''}</td>
                      <td className="py-1 whitespace-nowrap text-right text-petroleum-300">
                        {it.quotedCost != null
                          ? `quoted ${e.currency} ${nf.format(it.quotedCost)}${it.quotedLeadTimeDays != null ? ` · ${it.quotedLeadTimeDays}d` : ''}`
                          : it.refCost != null
                            ? `ref ${e.currency} ${nf.format(it.refCost)}`
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recording === e.id && <ResponseForm enquiry={e} onSaved={() => { setRecording(null); load(); }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponseForm({ enquiry, onSaved }: { enquiry: VendorEnquiry; onSaved: () => void }) {
  const [rows, setRows] = useState(
    enquiry.items.map((it) => ({
      itemPartNumber: it.itemPartNumber,
      cost: it.quotedCost != null ? String(it.quotedCost) : '',
      lead: it.quotedLeadTimeDays != null ? String(it.quotedLeadTimeDays) : '',
    })),
  );
  const [notes, setNotes] = useState(enquiry.notes ?? '');
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true);
    try {
      const byPart = new Map(rows.map((r) => [r.itemPartNumber, r]));
      const items: VendorEnquiryItem[] = enquiry.items.map((it) => {
        const r = byPart.get(it.itemPartNumber);
        const cost = r && r.cost.trim() !== '' ? Number(r.cost) : undefined;
        const lead = r && r.lead.trim() !== '' ? Number(r.lead) : undefined;
        return {
          ...it,
          ...(cost != null ? { quotedCost: cost } : {}),
          ...(lead != null ? { quotedLeadTimeDays: lead } : {}),
        };
      });
      await updateEnquiry(enquiry.id, {
        items,
        notes: notes.trim() || undefined,
        status: 'responded',
        respondedAt: Date.now(),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-tag border border-paper-line bg-white p-3">
      <p className="field-label mb-2">Record vendor response ({enquiry.currency})</p>
      <div className="space-y-2">
        {enquiry.items.map((it, i) => (
          <div key={it.itemPartNumber} className="grid grid-cols-12 items-center gap-2">
            <span className="col-span-6 font-mono text-xs text-petroleum-300">{it.itemPartNumber}</span>
            <input value={rows[i].cost} onChange={(e) => setRow(i, { cost: e.target.value })} placeholder="Unit cost" type="number" min={0} step="0.01" className="field col-span-3" />
            <input value={rows[i].lead} onChange={(e) => setRow(i, { lead: e.target.value })} placeholder="Lead (d)" type="number" min={0} className="field col-span-3" />
          </div>
        ))}
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="field mt-2" />
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary px-3 py-1.5 text-sm">{busy ? 'Saving…' : 'Save response'}</button>
      </div>
    </div>
  );
}

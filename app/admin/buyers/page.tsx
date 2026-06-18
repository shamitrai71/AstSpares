'use client';

import { useEffect, useState } from 'react';
import { listAllBuyers, updateBuyer } from '@/lib/buyers';
import type { Buyer } from '@/lib/types';

export default function AdminBuyers() {
  const [buyers, setBuyers] = useState<Buyer[] | null>(null);
  const [editing, setEditing] = useState<Buyer | null>(null);

  const load = () => listAllBuyers().then(setBuyers).catch(() => setBuyers([]));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="font-display text-3xl">Buyers</h1>
      <p className="mt-1 text-sm text-petroleum-300">
        Everyone who has registered (online) or been entered for an offline order. Verify accounts
        and correct contact details here.
      </p>

      {editing && (
        <BuyerEditor
          buyer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="panel mt-6 divide-y divide-paper-line">
        {!buyers && <p className="p-4 text-sm text-petroleum-300">Loading…</p>}
        {buyers?.length === 0 && <p className="p-4 text-sm text-petroleum-300">No buyers yet.</p>}
        {buyers?.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-petroleum">{b.name}</span>
                <span className={`eyebrow ${b.channel === 'offline' ? 'text-petroleum-300' : 'text-safety-600'}`}>
                  {b.channel}
                </span>
                {!b.verified && <span className="eyebrow text-safety-600">unverified</span>}
              </div>
              <p className="mt-0.5 text-xs text-petroleum-300">
                {b.id} · {b.email} · {b.companyName}{b.locationName ? ` / ${b.locationName}` : ''}
                {b.designation ? ` · ${b.designation}` : ''}
              </p>
            </div>
            <button onClick={() => setEditing(b)} className="shrink-0 text-sm text-safety-600 underline">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyerEditor({ buyer, onClose, onSaved }: { buyer: Buyer; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(buyer.name);
  const [designation, setDesignation] = useState(buyer.designation ?? '');
  const [department, setDepartment] = useState(buyer.department ?? '');
  const [phone, setPhone] = useState(buyer.phone ?? '');
  const [verified, setVerified] = useState(buyer.verified);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateBuyer(buyer.id, {
        name: name.trim(),
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        phone: phone.trim() || undefined,
        verified,
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Edit — {buyer.name}</h2>
        <span className="font-mono text-xs text-petroleum-300">{buyer.id}</span>
      </div>
      <p className="mt-1 text-xs text-petroleum-300">
        {buyer.companyName}{buyer.locationName ? ` / ${buyer.locationName}` : ''} · {buyer.country ?? '—'} · {buyer.channel}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Designation</span>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Department</span>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="field" />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        Verified
      </label>

      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

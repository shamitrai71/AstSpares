'use client';

import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BuyerGate } from '@/components/BuyerGate';
import { useAuth } from '@/components/AuthProvider';

export default function AccountPage() {
  return (
    <BuyerGate>
      <AccountHome />
    </BuyerGate>
  );
}

function AccountHome() {
  const { user, buyer, isAdmin } = useAuth();
  if (!buyer) return null;

  return (
    <div className="shell py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="mt-2 font-display text-4xl">{buyer.name}</h1>
          <p className="mt-1 text-sm text-petroleum-300">{buyer.email}</p>
        </div>
        <button onClick={() => signOut(auth)} className="btn-ghost">Sign out</button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <p className="field-label">Buyer ID</p>
          <p className="part-plate mt-1">{buyer.id}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-petroleum-300">Company</dt>
              <dd className="text-right text-petroleum">{buyer.companyName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-petroleum-300">Site</dt>
              <dd className="text-right text-petroleum">{buyer.locationName ?? '—'}</dd>
            </div>
            {buyer.phone && (
              <div className="flex justify-between gap-4">
                <dt className="text-petroleum-300">Phone</dt>
                <dd className="text-right text-petroleum">{buyer.phone}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="panel p-5">
          <p className="field-label">Your requests & quotes</p>
          <p className="mt-2 text-sm text-petroleum-300">
            Your RFQs and the budgetary quotes our team posts will appear here, where you can accept
            or negotiate. Start by building an RFQ from the catalog.
          </p>
          <Link href="/products/" className="btn-primary mt-4">Browse the catalog</Link>
        </div>
      </div>

      {isAdmin && (
        <p className="mt-6 text-sm text-petroleum-300">
          You’re an admin —{' '}
          <Link href="/admin/" className="text-safety-600 underline">open the admin panel</Link>.
        </p>
      )}
    </div>
  );
}

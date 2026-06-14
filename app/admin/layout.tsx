'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAdminAuth } from '@/lib/useAdminAuth';

const TABS = [
  { href: '/admin/', label: 'Dashboard' },
  { href: '/admin/rfqs/', label: 'RFQs' },
  { href: '/admin/categories/', label: 'Categories' },
  { href: '/admin/products/', label: 'Products' },
  { href: '/admin/landing/', label: 'Landing' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAdminAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="shell py-24 text-center text-petroleum-300">Checking access…</div>;
  }

  if (!user || !isAdmin) {
    return <LoginGate signedInNotAdmin={!!user && !isAdmin} />;
  }

  return (
    <div className="shell py-10">
      <div className="flex items-center justify-between border-b border-paper-line pb-4">
        <div className="flex items-center gap-6">
          <span className="font-display text-2xl">Admin</span>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-tag px-3 py-1.5 text-sm ${
                  pathname === t.href ? 'bg-petroleum text-paper' : 'text-petroleum-300 hover:text-petroleum'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-petroleum-300">
          <span className="hidden sm:inline">{user.email}</span>
          <button onClick={() => signOut(auth)} className="btn-ghost px-3 py-1.5">Sign out</button>
        </div>
      </div>
      <div className="pt-8">{children}</div>
    </div>
  );
}

function LoginGate({ signedInNotAdmin }: { signedInNotAdmin: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const withError = (fn: () => Promise<unknown>) => async () => {
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  };

  const emailSignIn = withError(() => signInWithEmailAndPassword(auth, email, password));
  const googleSignIn = withError(() => signInWithPopup(auth, new GoogleAuthProvider()));
  const microsoftSignIn = withError(() => signInWithPopup(auth, new OAuthProvider('microsoft.com')));

  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-sm p-6">
        <p className="eyebrow text-safety-600">ASTSPARES</p>
        <h1 className="mt-2 font-display text-3xl">Admin sign-in</h1>

        {signedInNotAdmin ? (
          <p className="mt-3 rounded-tag border border-safety/40 bg-safety/10 px-3 py-2 text-sm text-safety-600">
            This account isn’t authorised for the admin panel. Ask an existing admin to grant access.
          </p>
        ) : (
          <p className="mt-2 text-sm text-petroleum-300">Sales and catalog management.</p>
        )}

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="field-label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="field" />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="field" />
          </label>
          <button onClick={emailSignIn} className="btn-dark w-full">Sign in</button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-petroleum-300">
          <span className="h-px flex-1 bg-paper-line" /> or <span className="h-px flex-1 bg-paper-line" />
        </div>

        <div className="space-y-2">
          <button onClick={googleSignIn} className="btn-ghost w-full">Continue with Google</button>
          <button onClick={microsoftSignIn} className="btn-ghost w-full">Continue with Microsoft</button>
        </div>

        {err && <p className="mt-3 text-sm text-safety-600">{err}</p>}
      </div>
    </div>
  );
}

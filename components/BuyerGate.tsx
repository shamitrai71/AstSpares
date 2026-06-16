'use client';

import { useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { Onboarding } from './Onboarding';

/**
 * Wrap any page that requires a signed-in, onboarded buyer. Renders the
 * sign-in card, then the onboarding form, then the children once a buyer
 * profile exists.
 */
export function BuyerGate({ children }: { children: React.ReactNode }) {
  const { user, buyer, loading, profileLoading } = useAuth();

  if (loading || (user && profileLoading)) {
    return <div className="shell py-24 text-center text-petroleum-300">Loading…</div>;
  }
  if (!user) return <SignIn />;
  if (!buyer) return <Onboarding />;
  return <>{children}</>;
}

function SignIn() {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<unknown>) => async () => {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  const google = run(() => signInWithPopup(auth, new GoogleAuthProvider()));
  const microsoft = run(() => signInWithPopup(auth, new OAuthProvider('microsoft.com')));
  const apple = run(() => signInWithPopup(auth, new OAuthProvider('apple.com')));
  const emailIn = run(() => signInWithEmailAndPassword(auth, email, password));
  const emailUp = run(async () => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  });

  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-sm p-6">
        <p className="eyebrow text-safety-600">ASTSPARES</p>
        <h1 className="mt-2 font-display text-3xl">
          {mode === 'signin' ? 'Sign in to request a quote' : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-petroleum-300">
          Quotes and orders are tied to your account, so you can track them here — no public pricing.
        </p>

        <div className="mt-5 space-y-2">
          <button onClick={google} disabled={busy} className="btn-ghost w-full">Continue with Google</button>
          <button onClick={microsoft} disabled={busy} className="btn-ghost w-full">Continue with Microsoft</button>
          <button onClick={apple} disabled={busy} className="btn-ghost w-full">Continue with Apple</button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-petroleum-300">
          <span className="h-px flex-1 bg-paper-line" /> or corporate email <span className="h-px flex-1 bg-paper-line" />
        </div>

        <div className="space-y-3">
          {mode === 'create' && (
            <label className="block">
              <span className="field-label">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
            </label>
          )}
          <label className="block">
            <span className="field-label">Work email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="field" />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="field" />
          </label>
          <button
            onClick={mode === 'signin' ? emailIn : emailUp}
            disabled={busy}
            className="btn-dark w-full"
          >
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <button
          onClick={() => {
            setErr('');
            setMode(mode === 'signin' ? 'create' : 'signin');
          }}
          className="mt-3 w-full text-center text-xs text-safety-600 underline"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>

        {err && <p className="mt-3 text-sm text-safety-600">{err}</p>}
      </div>
    </div>
  );
}

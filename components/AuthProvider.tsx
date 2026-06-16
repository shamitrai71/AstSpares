'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getBuyerByUid } from '@/lib/buyers';
import type { Buyer } from '@/lib/types';

interface AuthState {
  /** The Firebase Auth user, or null when signed out. */
  user: User | null;
  /** Whether an /admins/{uid} doc exists for this user. UI gate only. */
  isAdmin: boolean;
  /** The buyer profile for this user, or null if not onboarded yet. */
  buyer: Buyer | null;
  /** Resolving the initial auth state. */
  loading: boolean;
  /** Resolving the admin/buyer profile after the user is known. */
  profileLoading: boolean;
  /** Re-read the buyer doc (call after onboarding). */
  refreshBuyer: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setIsAdmin(false);
      setBuyer(null);
      return;
    }
    setProfileLoading(true);
    try {
      const [adminSnap, b] = await Promise.all([
        getDoc(doc(db, 'admins', u.uid)).catch(() => null),
        getBuyerByUid(u.uid).catch(() => null),
      ]);
      setIsAdmin(Boolean(adminSnap?.exists()));
      setBuyer(b);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      await loadProfile(u);
    });
  }, [loadProfile]);

  const refreshBuyer = useCallback(async () => {
    if (!user) return;
    const b = await getBuyerByUid(user.uid).catch(() => null);
    setBuyer(b);
  }, [user]);

  return (
    <AuthCtx.Provider value={{ user, isAdmin, buyer, loading, profileLoading, refreshBuyer }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

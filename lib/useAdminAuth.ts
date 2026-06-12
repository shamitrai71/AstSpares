'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Tracks the signed-in user and whether they are an admin.
 * Admin status = existence of /admins/{uid}. This is only for UI gating —
 * the authoritative check lives in firestore.rules. Never trust the client.
 */
export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({ user: null, isAdmin: false, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }
      let isAdmin = false;
      try {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        isAdmin = snap.exists();
      } catch {
        isAdmin = false;
      }
      setState({ user, isAdmin, loading: false });
    });
  }, []);

  return state;
}

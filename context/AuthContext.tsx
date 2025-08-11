// =============================
// File: context/AuthContext.tsx (projektets rot/context)
// =============================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../firebase';


export type AuthContextValue = {
  user: User | null;
  loadingAuth: boolean;
  isAnonymous: boolean;
  continueAnonymously: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const continueAnonymously = useCallback(() => setIsAnonymous(true), []);

  const signOut = useCallback(async () => {
    if (user) await fbSignOut(auth);
    setIsAnonymous(false);
  }, [user]);

  const value = useMemo(
    () => ({ user, loadingAuth, isAnonymous, continueAnonymously, signOut }),
    [user, loadingAuth, isAnonymous, continueAnonymously, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

// Client Supabase chargé à la demande (import dynamique) : la bibliothèque (~70 Ko compressés)
// ne bloque plus l'affichage des pages publiques (accueil, recettes), elle arrive juste après.
const client = () => import('@/lib/supabase').then(m => m.createBrowserClient());

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isPro: boolean;
  isFamille: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
  isPro: false, isFamille: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const refreshProfile = useCallback(async () => {
    const supabase = await client();
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
    if (data) setProfile(data as unknown as Profile);
  }, []);

  useEffect(() => {
    let desabonner = () => {};
    let actif = true;
    void client().then(supabase => {
      if (!actif) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setInitialized(true);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
      desabonner = () => subscription.unsubscribe();
    });
    return () => { actif = false; desabonner(); };
  }, []);

  useEffect(() => {
    // Ne pas conclure tant que getSession() n'a pas résolu : sinon on expose
    // un état « non connecté » transitoire et les gardes redirigent vers /login.
    if (!initialized) return;
    let cancelled = false;

    (async () => {
      if (user) {
        // setState après await → différé, pas de rendu en cascade
        const supabase = await client();
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (cancelled) return;
        if (data) setProfile(data as unknown as Profile);
        setLoading(false);
      } else {
        if (cancelled) return;
        setProfile(null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, initialized]);

  const signOut = async () => {
    await (await client()).auth.signOut();
    setUser(null); setProfile(null);
  };

  const isPro = profile?.plan === 'pro';
  const isFamille = profile?.plan === 'famille';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, isPro, isFamille }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
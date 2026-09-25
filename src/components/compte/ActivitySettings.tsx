'use client';

// ============================================================================
// ActivitySettings — activité récente : dernière connexion, expiration de
// session, compte créé (extraite du compte).
// ============================================================================

import { useEffect, useState } from 'react';
import { Activity, CalendarClock, Clock, MonitorSmartphone } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { formatDateHeureParis } from '@/lib/dates';

export function ActivitySettings() {
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    // supabase est un singleton stable → deps complètes sans resubscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fuseau Europe/Paris explicite : sans `timeZone`, `toLocaleString` formate
  // dans le fuseau du runtime (UTC sur Vercel, Paris dans le navigateur), donc
  // deux heures d'écart entre le rendu serveur et le rendu client.
  const fmt = (iso: string | undefined | null) =>
    iso
      ? formatDateHeureParis(iso, {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

  const lastSignIn = user?.last_sign_in_at;
  const createdAt = user?.created_at;
  const expiresAt = session?.expires_at != null ? new Date(session.expires_at * 1000).toISOString() : null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-5">
        <Activity className="w-5 h-5 text-brand-500" /> Activité récente
      </h2>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-40">Dernière connexion</span>
          <span className="text-sm text-gray-900">{fmt(lastSignIn)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-40">Session expire</span>
          <span className="text-sm text-gray-900">{fmt(expiresAt)}</span>
        </div>
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-40">Session actuelle</span>
          <span className="text-sm text-gray-900">
            {session ? 'Active — ce navigateur' : '—'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-40">Compte créé</span>
          <span className="text-sm text-gray-900">{fmt(createdAt)}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Les autres sessions actives (autres navigateurs/appareils) ne sont pas visibles côté client.
        Déconnectez-vous partout via la réinitialisation de mot de passe si nécessaire.
      </p>
    </div>
  );
}

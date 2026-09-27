'use client';

// ============================================================================
// FoyerSettings — foyer partagé (plusieurs comptes) : membres, invitation,
// et le réglage gouverné par le créateur du foyer (« chef du foyer ») :
// au bout de combien de jours une recette déjà aimée redevient proposable.
//
// Toute la logique métier (qui peut inviter, retirer, modifier…) vit dans les
// RPC SECURITY DEFINER de la migration 00021 — ce composant ne fait qu'appeler
// /api/foyer-partage, qui les expose telles quelles.
// ============================================================================

import { useEffect, useState } from 'react';
import { Check, Copy, Crown, Loader2, LogOut, UserMinus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';

interface Membre { user_id: string; role: string; joined_at: string; nom: string }
interface Invitation { id: number; code: string; expires_at: string | null }
interface FoyerState {
  household: { id: number; nom: string; delai_recettes_aimees_jours: number };
  membres: Membre[];
  est_proprietaire: boolean;
  invitation: Invitation | null;
}

async function appelerAction(body: object) {
  const res = await fetch('/api/foyer-partage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

export function FoyerSettings() {
  const [etat, setEtat] = useState<FoyerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [delai, setDelai] = useState('21');
  const [delaiDirty, setDelaiDirty] = useState(false);

  const charger = async () => {
    try {
      const res = await fetch('/api/foyer-partage');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat(json);
      setDelai(String(json.household.delai_recettes_aimees_jours));
      setDelaiDirty(false);
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible de charger le foyer'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/foyer-partage');
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        setEtat(json);
        setDelai(String(json.household.delai_recettes_aimees_jours));
        setDelaiDirty(false);
      } catch (e) {
        if (alive) toast.error(errorMessage(e, 'Impossible de charger le foyer'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const relancer = async (action: () => Promise<unknown>, succes?: string) => {
    setBusy(true);
    try {
      await action();
      if (succes) toast.success(succes);
      await charger();
    } catch (e) {
      toast.error(errorMessage(e, "Une erreur est survenue"));
    } finally {
      setBusy(false);
    }
  };

  const enregistrerDelai = async () => {
    const n = Number(delai);
    if (!Number.isInteger(n) || n < 1 || n > 180) {
      toast.error('Délai invalide (1 à 180 jours)');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/foyer-partage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delai_recettes_aimees_jours: n }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      toast.success('Réglage enregistré');
      setDelaiDirty(false);
      await charger();
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'enregistrer"));
    } finally {
      setBusy(false);
    }
  };

  const copierCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success('Code copié'),
      () => toast.error('Impossible de copier')
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    );
  }
  if (!etat) return null;

  const { household, membres, est_proprietaire, invitation } = etat;
  const estSolo = membres.length === 1;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
      <h2 className="font-semibold font-display text-gray-900 text-lg flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-brand-500" /> Mon foyer
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        {estSolo
          ? "Invitez les personnes avec qui vous partagez vos repas : chacun garde son propre planning, mais le réglage ci-dessous s'applique à tout le foyer."
          : `${household.nom} — ${membres.length} membres.`}
      </p>

      {/* Membres */}
      <ul className="divide-y divide-gray-50 mb-5 rounded-xl border border-gray-50">
        {membres.map(m => (
          <li key={m.user_id} className="px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-800 flex items-center gap-1.5 min-w-0 truncate">
              {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-accent-500 shrink-0" />}
              {m.nom || 'Membre'}
              {m.role === 'owner' && <span className="text-[11px] text-gray-500">(créateur)</span>}
            </span>
            {est_proprietaire && m.role !== 'owner' && (
              <button disabled={busy}
                onClick={() => relancer(() => appelerAction({ action: 'retirer_membre', user_id: m.user_id }), 'Membre retiré')}
                aria-label={`Retirer ${m.nom}`}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Invitation (créateur uniquement) */}
      {est_proprietaire && (
        <div className="mb-5 p-4 bg-gray-50/60 border border-gray-100 rounded-xl">
          {invitation ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 mb-1">Code d&apos;invitation actif</p>
                <p className="text-lg font-mono font-bold tracking-wider text-gray-900">{invitation.code}</p>
                {invitation.expires_at && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Expire le {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copierCode(invitation.code)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-full hover:border-brand-300 transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Copier
                </button>
                <button disabled={busy}
                  onClick={() => relancer(() => appelerAction({ action: 'annuler_invitation', invitation_id: invitation.id }), 'Invitation annulée')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors">
                  <X className="w-3.5 h-3.5" /> Annuler
                </button>
              </div>
            </div>
          ) : (
            <button disabled={busy}
              onClick={() => relancer(() => appelerAction({ action: 'inviter', jours: 7 }), 'Code généré')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Générer un code d&apos;invitation
            </button>
          )}
        </div>
      )}

      {/* Rejoindre un foyer : uniquement tant qu'on n'a encore partagé le sien avec personne */}
      {estSolo && (
        <div className="mb-5 flex items-end gap-2 flex-wrap">
          <label className="flex-1 min-w-[180px] flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rejoindre un foyer (code reçu)</span>
            <input type="text" value={codeSaisi} onChange={e => setCodeSaisi(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX" maxLength={9}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300" />
          </label>
          <button disabled={busy || !codeSaisi.trim()}
            onClick={() => relancer(() => appelerAction({ action: 'rejoindre', code: codeSaisi.trim() }), 'Foyer rejoint').then(() => setCodeSaisi(''))}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
            Rejoindre
          </button>
        </div>
      )}

      {/* Quitter (membres uniquement — le créateur ne peut pas quitter son foyer) */}
      {!est_proprietaire && (
        <button disabled={busy}
          onClick={() => relancer(() => appelerAction({ action: 'quitter' }), 'Vous avez quitté le foyer')}
          className="mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4" /> Quitter ce foyer
        </button>
      )}

      {/* Réglage gouverné par le créateur : délai des recettes aimées */}
      <div className="p-4 bg-sauge-50/60 border border-sauge-100 rounded-xl">
        <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          ⭐ Recettes aimées reproposées après
        </span>
        <span className="text-xs text-gray-500 mt-0.5 block mb-3">
          Une recette que quelqu&apos;un du foyer a likée revient dans les menus au bout de ce délai
          (au lieu du minimum standard de 21 jours). {!est_proprietaire && 'Seul le créateur du foyer peut le modifier.'}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="number" min={1} max={180} value={delai} disabled={!est_proprietaire}
            onChange={e => { setDelai(e.target.value); setDelaiDirty(true); }}
            className="w-24 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300 disabled:bg-gray-100 disabled:text-gray-500" />
          <span className="text-sm text-gray-600">jours (≈ {Math.round(Number(delai) / 7 * 10) / 10} semaines)</span>
          {est_proprietaire && delaiDirty && (
            <button onClick={enregistrerDelai} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

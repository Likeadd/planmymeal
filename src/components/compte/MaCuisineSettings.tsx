'use client';

// ============================================================================
// MaCuisineSettings — équipements, desserts auto, meal prep (extraite du
// compte). Sauvegarde directe dans profiles ; le parent re-monte ce composant
// via `key` quand le profil change → champs resynchronisés sans setState
// dans un effet.
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { Check, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import { EQUIPEMENTS } from '@/types';
import type { RythmeDesserts } from '@/lib/rotation-engine';

/** Les 4 paliers du réglage (axe 3 de l'audit desserts) — libellés bénéfice.
    GOURMAND est réservé Pro/Famille (gate réel décidé avec l'audit : c'est
    le seul gate desserts du produit, vérifié serveur dans /api/compte). */
const RYTHMES: { value: RythmeDesserts; label: string; sous: string; pro?: boolean }[] = [
  { value: 'aucun', label: 'Aucun', sous: 'semaine sans dessert' },
  { value: 'leger', label: 'Léger', sous: '2 soirs + 1 midi' },
  { value: 'equilibre', label: 'Équilibré', sous: '3-4 soirs + 2-3 midis' },
  { value: 'gourmand', label: 'Gourmand', sous: '5-6 soirs + 3 midis', pro: true },
];

export function MaCuisineSettings() {
  const { user, profile, refreshProfile, isPro, isFamille } = useAuth();
  const gateGourmand = !isPro && !isFamille;
  const supabase = createBrowserClient();
  // Initialisé depuis le profil (le parent re-monte ce composant via `key`
  // quand le profil change → pas besoin de setState dans un effet)
  const [equipements, setEquipements] = useState<string[]>(profile?.equipements ?? []);
  const [autoRestes, setAutoRestes] = useState(profile?.auto_restes === true);
  // Rythme desserts : le binaire « actifs/désactivés » est devenu 4 paliers
  // (défaut équilibré = comportement historique, cf. migration 00022).
  const [rythmeDesserts, setRythmeDesserts] = useState<RythmeDesserts>(
    (profile?.rythme_desserts as RythmeDesserts | undefined) ??
      (profile?.desserts_activees === false ? 'aucun' : 'equilibre')
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toggleEquipement = (eq: string) => {
    setDirty(true);
    setEquipements(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ equipements, auto_restes: autoRestes, rythme_desserts: rythmeDesserts })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setDirty(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la sauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <h2 className="font-semibold font-display text-gray-900 text-lg flex items-center gap-2 mb-1">
        🍳 Ma cuisine
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Vos appareils sont pris en compte dans la génération : les recettes compatibles
        sont favorisées, celles qui nécessitent un appareil manquant sont limitées.
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {EQUIPEMENTS.map(eq => {
          const actif = equipements.includes(eq);
          return (
            <button key={eq} onClick={() => toggleEquipement(eq)}
              className={`px-3.5 py-2 text-sm font-medium rounded-full border-2 transition-all ${actif
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'}`}>
              {actif && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
              {eq}
            </button>
          );
        })}
      </div>

      {/* Rythme des desserts (axe 3 de l'audit) : un palier, pas un interrupteur —
          « plus léger » et « tous les soirs » sont des attentes légitimes. */}
      <div className="p-4 bg-accent-50/60 border border-accent-100 rounded-xl">
        <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          🍰 Rythme des desserts
          <span className="text-[11px] bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded-full font-semibold uppercase">midi + soir</span>
        </span>
        <span className="text-xs text-gray-500 mt-0.5 block">
          Le moteur ajoute les desserts aux meilleures semaines : week-end d&apos;abord,
          jamais deux fois le même, ingrédients inclus dans la liste de courses.
          Vous pouvez toujours en ajouter ou retirer sur un jour précis depuis le planning.
        </span>
        <div role="radiogroup" aria-label="Rythme des desserts" className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {RYTHMES.map(r => {
            const actif = rythmeDesserts === r.value;
            const verrouille = r.pro === true && gateGourmand;
            return (
              <button key={r.value} type="button" role="radio" aria-checked={actif}
                disabled={verrouille}
                title={verrouille ? 'Rythme Gourmand réservé aux plans Pro et Famille' : undefined}
                onClick={() => { setRythmeDesserts(r.value); setDirty(true); }}
                className={`relative text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                  actif ? 'bg-brand-500 border-brand-500 text-white'
                    : verrouille ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'}`}>
                {verrouille && (
                  <Link href="/compte#tarifs" title="Passer Pro pour débloquer le rythme Gourmand"
                    onClick={e => e.stopPropagation()}
                    className="absolute top-1.5 right-1.5 p-1 text-accent-500 hover:text-accent-600">
                    <Crown className="w-3.5 h-3.5" />
                  </Link>
                )}
                <span className="block text-sm font-semibold flex items-center gap-1">
                  {actif && <Check className="w-3.5 h-3.5" />}{r.label}
                </span>
                <span className={`block text-[11px] mt-0.5 ${actif ? 'text-white/80' : verrouille ? 'text-gray-500' : 'text-gray-500'}`}>{r.sous}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Meal Prep Pro : auto-restes */}
      <label className="flex items-start gap-3 p-4 bg-sable-50/60 border border-sable-100 rounded-xl cursor-pointer">
        <input type="checkbox" checked={autoRestes} onChange={e => { setAutoRestes(e.target.checked); setDirty(true); }}
          className="mt-0.5 w-4 h-4 accent-sable-500" />
        <span>
          <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            🍱 Meal Prep Pro — déjeuners = restes du dîner
            <span className="text-[11px] bg-sable-100 text-sable-700 px-1.5 py-0.5 rounded-full font-semibold uppercase">Auto</span>
          </span>
          <span className="text-xs text-gray-500 mt-0.5 block">
            Après chaque génération, les déjeuners de la semaine deviennent automatiquement
            les restes du dîner de la veille (cuisiner ×2 le soir, lunchbox le lendemain midi).
            Activable/désactivable par repas depuis le planning.
          </span>
        </span>
      </label>

      {dirty && (
        <button onClick={handleSave} disabled={saving}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Enregistrer ma cuisine
        </button>
      )}
    </div>
  );
}

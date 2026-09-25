'use client';

// ============================================================================
// MemoireSettings — « Comment je mange »
//
// Trois réglages qui pilotent réellement la génération :
//   1. temps de cuisine disponible par jour (« mercredi 15 min »)
//   2. intention culinaire du jour (normal / rapide / léger / plaisir)
//   3. curseur Confort ↔ Découverte
// Plus la liste des recettes mémorisées (note, fréquence, jour préféré), que
// l'on peut oublier d'un clic.
//
// Les valeurs sont écrites dans profiles + user_meal_preferences, exactement
// les colonnes que lit le moteur de rotation (lib/memoire.ts).
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Clock, SlidersHorizontal, Baby, Loader2, Trash2, Wand2, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { CONTEXTES_JOUR, type ContexteJour } from '@/types';
import { errorMessage } from '@/lib/utils';
import { JOURS_NOMS } from '@/lib/dates';

interface PreferenceRecette {
  meal_id: number;
  titre: string;
  note: number | null;
  frequence_jours: number | null;
  jour_prefere: number | null;
  repas_prefere: string | null;
  ne_plus_proposer: boolean;
}

interface ReponsePreferences {
  temps_max_par_jour: (number | null)[];
  contexte_jours: (ContexteJour | null)[];
  nouveaute: number;
  preferences: PreferenceRecette[];
}

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const NOUVEAUTES: { value: number; label: string; description: string }[] = [
  { value: 0, label: 'Confort', description: 'Presque que des valeurs sûres de ton historique.' },
  { value: 25, label: 'Prudent', description: 'Surtout tes habitudes, quelques nouveautés.' },
  { value: 50, label: 'Équilibré', description: 'Moitié habitudes, moitié découvertes.' },
  { value: 75, label: 'Curieux', description: 'Tu goûtes souvent à du nouveau.' },
  { value: 100, label: 'Aventurier', description: 'Priorité aux recettes jamais testées.' },
];

export function MemoireSettings() {
  const [data, setData] = useState<ReponsePreferences | null>(null);
  const [temps, setTemps] = useState<(number | null)[]>(Array(7).fill(null));
  const [contextes, setContextes] = useState<(ContexteJour | null)[]>(Array(7).fill(null));
  const [nouveaute, setNouveaute] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/preferences');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (!alive) return;
        const reponse = json as ReponsePreferences;
        setData(reponse);
        setTemps(reponse.temps_max_par_jour ?? Array(7).fill(null));
        setContextes(reponse.contexte_jours ?? Array(7).fill(null));
        setNouveaute(reponse.nouveaute ?? 20);
      } catch (e) {
        if (alive) setError(errorMessage(e, 'Impossible de charger tes préférences'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const enregistrer = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temps_max_par_jour: temps,
          contexte_jours: contextes,
          nouveaute,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      toast.success('Préférences enregistrées');
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'enregistrer"));
    } finally {
      setSaving(false);
    }
  };

  const oublier = async (mealId: number, titre: string) => {
    try {
      const res = await fetch(`/api/preferences?meal_id=${mealId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      setData(d => d ? { ...d, preferences: d.preferences.filter(p => p.meal_id !== mealId) } : d);
      toast.success(`Mémoire effacée pour « ${titre} »`);
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible de supprimer cette préférence'));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    );
  }

  const palier = NOUVEAUTES.reduce((best, n) =>
    Math.abs(n.value - nouveaute) < Math.abs(best.value - nouveaute) ? n : best
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">Comment je mange</h2>
          <p className="text-sm text-gray-500">
            Le moteur s&apos;en sert à chaque génération — configure une fois, il s&apos;occupe du reste.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* ── 1. Temps de cuisine par jour ── */}
      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
          <Clock className="w-4 h-4 text-brand-500" /> Temps de cuisine par jour
          <span className="font-normal text-gray-500">(minutes — vide = valeur par défaut de ton profil)</span>
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-3">
          {JOURS_NOMS.map((jour, i) => (
            <label key={jour} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500" title={jour}>
                {JOURS_COURTS[i]}
              </span>
              <input
                type="number" min={5} max={240} inputMode="numeric"
                value={temps[i] ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  setTemps(prev => prev.map((p, idx) => idx === i ? (v == null || Number.isNaN(v) ? null : v) : p));
                }}
                placeholder="—"
                aria-label={`Temps de cuisine le ${jour}`}
                className="w-full px-2 py-1.5 text-sm text-center bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300 focus:border-brand-300"
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── 2. Contexte culinaire du jour ── */}
      <section className="mt-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          L&apos;intention du jour
        </h3>
        <div className="space-y-2">
          {JOURS_NOMS.map((jour, i) => (
            <div key={jour} className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium text-gray-500 shrink-0">{jour}</span>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXTES_JOUR.map(c => {
                  const actif = contextes[i] === c.value;
                  return (
                    <button key={c.value} type="button"
                      aria-pressed={actif}
                      onClick={() => setContextes(prev => prev.map((p, idx) =>
                        idx === i ? (p === c.value ? null : c.value) : p))}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                        actif
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600'
                      }`}>
                      <span aria-hidden>{c.emoji}</span> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          « Rapide » privilégie les recettes ≤ 25 min, « Léger » les plats peu caloriques,
          « Plaisir » les recettes que tu as aimées.
        </p>
      </section>

      {/* ── 3. Curseur Confort ↔ Découverte ── */}
      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
          <Wand2 className="w-4 h-4 text-accent-500" /> Surprends-moi
        </h3>
        <input
          type="range" min={0} max={100} step={5} value={nouveaute}
          onChange={e => setNouveaute(Number(e.target.value))}
          aria-label="Niveau de nouveauté"
          className="w-full accent-brand-500"
        />
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mt-1">
          <span>🛋️ Confort</span>
          <span className="text-brand-600">{nouveaute} % — {palier.label}</span>
          <span>🎲 Découverte</span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">{palier.description}</p>
      </section>

      <button onClick={enregistrer} disabled={saving}
        className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors shadow-cta">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer mes préférences
      </button>

      {/* ── 4. Recettes mémorisées ── */}
      <section className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-1">
          <Baby className="w-4 h-4 text-sauge-500" /> Ma mémoire alimentaire
          <span className="font-normal text-gray-500">
            ({data?.preferences.length ?? 0} recette{(data?.preferences.length ?? 0) > 1 ? 's' : ''})
          </span>
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Notes, fréquences et jours préférés appris en notant tes repas. « Ne plus proposer » retire
          définitivement la recette de la pioche.
        </p>

        {data && data.preferences.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            Rien de mémorisé pour l&apos;instant — note un repas depuis le planning pour commencer.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data?.preferences.map(p => (
              <li key={p.meal_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {p.ne_plus_proposer && <span title="Ne plus proposer" aria-hidden>🚫 </span>}
                    {p.titre}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {p.note != null && `note ${p.note}/5`}
                    {p.frequence_jours != null && ` · tous les ${p.frequence_jours} j`}
                    {p.jour_prefere != null && ` · ${JOURS_NOMS[p.jour_prefere].toLowerCase()}`}
                  </p>
                </div>
                <button onClick={() => oublier(p.meal_id, p.titre)} aria-label={`Oublier ${p.titre}`}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

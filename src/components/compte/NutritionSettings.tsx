'use client';

// ============================================================================
// NutritionSettings — objectif, besoins caloriques, profil corporel, régimes,
// allergies et aliments détestés (modifiables après l'inscription).
//
// - Calories : proposées d'après l'objectif + le profil (lib/nutrition.ts),
//   modifiables ; « calcul automatique » rétablit la valeur proposée.
// - Allergies / détestés : familles d'aliments (lib/exclusions-alimentaires.ts)
//   résolues en ingrédients du catalogue. Une famille est cochée si TOUS ses
//   ingrédients sont exclus ; l'enregistrement REMPLACE l'ensemble (les
//   anciens choix, dont ceux enregistrés avec les identifiants erronés d'avant,
//   disparaissent).
// ============================================================================

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';
import type { Objectif, Regime } from '@/types';
import { REGIMES_CHOIX } from '@/lib/regimes';
import { caloriesRecommandees, profilEffectif, kcalValide, BORNES, type Sexe } from '@/lib/nutrition';
import {
  GROUPES_ALLERGIES, TOUTES_ALLERGIES, DETESTES, resoudreExclusions, correspond,
  type FamilleAliments,
} from '@/lib/exclusions-alimentaires';

const OBJECTIFS: { value: Objectif; emoji: string; label: string; sous: string }[] = [
  { value: 'sans_regime', emoji: '🍽️', label: 'Sans objectif', sous: 'Bien manger' },
  { value: 'maintien', emoji: '⚖️', label: 'Maintien', sous: 'Garder mon poids' },
  { value: 'perte_poids', emoji: '🎯', label: 'Perte de poids', sous: 'Déficit modéré' },
  { value: 'prise_masse', emoji: '💪', label: 'Prise de masse', sous: 'Plus de protéines' },
];

type Ingredient = { id: number; nom: string };

const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Codes des familles dont TOUS les ingrédients sont dans `ids`. */
function codesCoches(familles: FamilleAliments[], ids: Set<number>, ingredients: Ingredient[]): string[] {
  return familles
    .filter(f => {
      const membres = ingredients.filter(i => correspond(i.nom, f));
      return membres.length > 0 && membres.every(i => ids.has(i.id));
    })
    .map(f => f.code);
}

function Chip({ active, onClick, danger, warning, children }: {
  active: boolean; onClick: () => void; danger?: boolean; warning?: boolean; children: React.ReactNode;
}) {
  const on = danger ? 'border-red-300 bg-red-50 text-red-700'
    : warning ? 'border-sable-300 bg-sable-50 text-sable-700'
      : 'border-brand-300 bg-brand-50 text-brand-700';
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${active ? on : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      {children}
    </button>
  );
}

export function NutritionSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createBrowserClient();

  const [objectif, setObjectif] = useState<Objectif>(profile?.objectif ?? 'maintien');
  const [sexe, setSexe] = useState<Sexe | null>(profile?.sexe ?? null);
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [taille, setTaille] = useState(profile?.taille_cm != null ? String(profile.taille_cm) : '');
  const [poids, setPoids] = useState(profile?.poids_kg != null ? String(profile.poids_kg) : '');
  // null = calcul automatique. Une valeur déjà enregistrée compte comme personnalisée
  // seulement si elle diffère du calcul (sinon on reste en automatique).
  const [kcalManuelles, setKcalManuelles] = useState<number | null>(null);

  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [detestes, setDetestes] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [chargement, setChargement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const corps = { sexe, age: nombre(age), taille_cm: nombre(taille), poids_kg: nombre(poids) };
  const kcalCalculees = caloriesRecommandees(objectif, corps);
  const kcalAffichees = kcalManuelles ?? kcalCalculees;
  const estimation = profilEffectif(corps).estimation;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [ing, al, di, re] = await Promise.all([
        supabase.from('ingredients').select('id, nom'),
        supabase.from('user_allergies').select('ingredient_id').eq('user_id', user.id),
        supabase.from('user_dislikes').select('ingredient_id').eq('user_id', user.id),
        supabase.from('user_diets').select('regime').eq('user_id', user.id),
      ]);
      if (!alive) return;
      const liste = (ing.data ?? []) as Ingredient[];
      setIngredients(liste);
      setAllergies(codesCoches(TOUTES_ALLERGIES, new Set((al.data ?? []).map(r => r.ingredient_id)), liste));
      setDetestes(codesCoches(DETESTES, new Set((di.data ?? []).map(r => r.ingredient_id)), liste));
      setRegimes((re.data ?? []).map(r => r.regime as Regime));
      // Calories enregistrées : personnalisées seulement si ≠ calcul automatique
      const enregistrees = kcalValide(profile?.calories_par_jour);
      if (enregistrees != null && enregistrees !== caloriesRecommandees(profile?.objectif ?? 'maintien', {
        sexe: profile?.sexe, age: profile?.age, taille_cm: profile?.taille_cm, poids_kg: profile?.poids_kg,
      })) {
        setKcalManuelles(enregistrees);
      }
      setChargement(false);
    })();
    return () => { alive = false; };
    // Chargement unique : le parent re-monte le composant (key) si le profil change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggle = <T,>(liste: T[], set: (v: T[]) => void, val: T) => {
    set(liste.includes(val) ? liste.filter(v => v !== val) : [...liste, val]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Objectif + calories (colonnes historiques)
      const { error: profilErr } = await supabase.from('profiles')
        .update({ objectif, calories_par_jour: kcalValide(kcalManuelles) ?? kcalCalculees })
        .eq('id', user.id);
      if (profilErr) throw profilErr;

      // 2. Profil corporel (colonnes 00030) — non bloquant si la migration manque
      const pe = profilEffectif(corps);
      const saisi = (v: number | null, effectif: number) => (v != null && v === effectif ? effectif : null);
      const { error: corpsErr } = await supabase.from('profiles')
        .update({
          sexe,
          age: saisi(corps.age, pe.age),
          taille_cm: saisi(corps.taille_cm, pe.taille_cm),
          poids_kg: saisi(corps.poids_kg, pe.poids_kg),
        })
        .eq('id', user.id);
      if (corpsErr) console.warn('Profil corporel non enregistré :', corpsErr.message);

      // 3. Allergies / détestés / régimes : on remplace l'ensemble.
      const allergieIds = resoudreExclusions(allergies, TOUTES_ALLERGIES, ingredients);
      const detesteIds = resoudreExclusions(detestes, DETESTES, ingredients).filter(id => !allergieIds.includes(id));

      const remplacer = async (table: 'user_allergies' | 'user_dislikes', ids: number[]) => {
        const { error: del } = await supabase.from(table).delete().eq('user_id', user.id);
        if (del) throw del;
        if (ids.length === 0) return;
        const { error: ins } = await supabase.from(table)
          .insert(ids.map(ingredient_id => ({ user_id: user.id, ingredient_id })));
        if (ins) throw ins;
      };
      await remplacer('user_allergies', allergieIds);
      await remplacer('user_dislikes', detesteIds);

      const { error: delDiet } = await supabase.from('user_diets').delete().eq('user_id', user.id);
      if (delDiet) throw delDiet;
      if (regimes.length > 0) {
        const { error: insDiet } = await supabase.from('user_diets')
          .insert(regimes.map(regime => ({ user_id: user.id, regime })));
        if (insDiet) throw insDiet;
      }

      await refreshProfile();
      setDirty(false);
      toast.success('Préférences nutritionnelles enregistrées');
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la sauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  const champs = [
    ['Âge', 'ans', age, setAge, BORNES.age],
    ['Taille', 'cm', taille, setTaille, BORNES.taille_cm],
    ['Poids', 'kg', poids, setPoids, BORNES.poids_kg],
  ] as const;

  return (
    <div id="nutrition" className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs scroll-mt-24">
      <h2 className="font-semibold font-display text-gray-900 text-lg flex items-center gap-2 mb-1">
        🥗 Nutrition &amp; restrictions
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Votre objectif, vos besoins caloriques, vos régimes et vos allergies guident la génération de vos menus.
      </p>

      {chargement ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 text-brand-500 animate-spin" /></div>
      ) : (
        <div className="space-y-7">
          {/* Objectif */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Objectif</h3>
            <div role="radiogroup" aria-label="Objectif" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {OBJECTIFS.map(o => (
                <button key={o.value} type="button" role="radio" aria-checked={objectif === o.value}
                  onClick={() => { setObjectif(o.value); setDirty(true); }}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${objectif === o.value ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <span className="block text-sm font-semibold">{o.emoji} {o.label}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">{o.sous}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Calories + profil corporel */}
          <div className="rounded-2xl bg-brand-50 border border-brand-100 p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-semibold tracking-[0.14em] uppercase text-brand-600">Apport conseillé</span>
              <input type="number" inputMode="numeric" min={BORNES.kcal.min} max={BORNES.kcal.max} step={50}
                value={kcalAffichees} aria-label="Kilocalories par jour"
                onChange={e => { setKcalManuelles(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                className="w-28 text-center text-2xl font-bold font-display text-gray-900 bg-transparent border-b-2 border-brand-200 focus:border-brand-500 outline-hidden" />
              <span className="text-sm text-gray-500">kcal / jour</span>
              {kcalManuelles != null && (
                <button type="button" onClick={() => { setKcalManuelles(null); setDirty(true); }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline">
                  Calcul automatique ({kcalCalculees})
                </button>
              )}
            </div>
            {kcalManuelles != null && kcalValide(kcalManuelles) == null && (
              <p className="text-xs text-red-600 mt-2">Entre {BORNES.kcal.min} et {BORNES.kcal.max} kcal — la valeur calculée ({kcalCalculees}) sera utilisée.</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {kcalManuelles != null ? 'Valeur personnalisée.'
                : estimation ? 'Estimation à partir de valeurs de référence — précisez votre profil pour affiner.'
                  : 'Calculé à partir de votre profil et de votre objectif.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {([['femme', 'Femme'], ['homme', 'Homme'], [null, 'Non précisé']] as [Sexe | null, string][]).map(([val, label]) => (
                <Chip key={label} active={sexe === val} onClick={() => { setSexe(val); setDirty(true); }}>{label}</Chip>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {champs.map(([label, unite, valeur, setValeur, b]) => {
                const n = nombre(valeur);
                const invalide = n != null && (Number.isNaN(n) || n < b.min || n > b.max);
                return (
                  <label key={label} className="block">
                    <span className="text-xs font-medium text-gray-600">{label} <span className="text-gray-400">(facultatif)</span></span>
                    <div className={`mt-1 flex items-center rounded-xl border bg-white px-3 py-2 ${invalide ? 'border-red-300' : 'border-gray-200 focus-within:border-brand-400'}`}>
                      <input type="text" inputMode="decimal" value={valeur} placeholder="—"
                        onChange={e => { setValeur(e.target.value); setDirty(true); }}
                        className="w-full min-w-0 bg-transparent outline-hidden text-gray-900" />
                      <span className="text-xs text-gray-400 ml-1">{unite}</span>
                    </div>
                    {invalide && <span className="text-[11px] text-red-600">{b.min}–{b.max} {unite}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Régimes */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Régime alimentaire</h3>
            <div className="flex flex-wrap gap-2">
              {REGIMES_CHOIX.map(r => (
                <Chip key={r.value} active={regimes.includes(r.value)} onClick={() => toggle(regimes, setRegimes, r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <h3 className="font-semibold text-sm mb-1">⚠️ Allergies &amp; intolérances</h3>
            <p className="text-xs text-gray-500 mb-3">Ces aliments sont <strong>exclus</strong> de vos repas.</p>
            <div className="space-y-4">
              {GROUPES_ALLERGIES.map(g => (
                <div key={g.titre}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-500 mb-2">{g.titre}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.familles.map(a => (
                      <Chip key={a.code} danger active={allergies.includes(a.code)} onClick={() => toggle(allergies, setAllergies, a.code)}>
                        {a.emoji} {a.nom}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Détestés */}
          <div>
            <h3 className="font-semibold text-sm mb-1">🤢 Aliments détestés</h3>
            <p className="text-xs text-gray-500 mb-3">On évitera de vous les proposer.</p>
            <div className="flex flex-wrap gap-2">
              {DETESTES.map(a => (
                <Chip key={a.code} warning active={detestes.includes(a.code)} onClick={() => toggle(detestes, setDetestes, a.code)}>
                  {a.emoji} {a.nom}
                </Chip>
              ))}
            </div>
          </div>

          <button type="button" onClick={handleSave} disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-cta">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : <><Check className="w-4 h-4" /> Enregistrer</>}
          </button>
        </div>
      )}
    </div>
  );
}

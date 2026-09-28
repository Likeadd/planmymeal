'use client';

import { errorMessage } from '@/lib/utils';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Users, Clock, Sparkles, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import type { Objectif, NiveauCuisine, Regime } from '@/types';
import type { RythmeDesserts } from '@/lib/rotation-engine';
import { caloriesRecommandees, profilEffectif, kcalValide, BORNES, type Sexe } from '@/lib/nutrition';
import { REGIMES_CHOIX } from '@/lib/regimes';
import { GROUPES_ALLERGIES, TOUTES_ALLERGIES, DETESTES, resoudreExclusions } from '@/lib/exclusions-alimentaires';

/** Libellés du récapitulatif (étape 9) */
const RYTHME_LABELS: Partial<Record<RythmeDesserts, string>> = {
  aucun: 'Aucun', leger: 'Léger (2 soirs + 1 midi)',
  equilibre: 'Équilibré (3-4 soirs)', gourmand: 'Gourmand — Pro (5-6 soirs)',
};
import { EQUIPEMENTS } from '@/types';

const REGIMES = REGIMES_CHOIX;

const CUISINES = ['Française', 'Italienne', 'Asiatique', 'Indienne', 'Méditerranéenne', 'Orientale', 'Américaine', 'Créole', 'Japonaise', 'Mexicaine'];

interface OnboardingForm {
  nb_personnes: number;
  objectif: Objectif;
  /** Codes de familles (exclusions-alimentaires.ts), résolus en ingrédients à l'enregistrement */
  allergies: string[];
  dislikes: string[];
  sexe: Sexe | null;
  /** Saisies texte : vide = non renseigné (valeur de référence) */
  age: string;
  taille_cm: string;
  poids_kg: string;
  /** Saisie manuelle des kcal ; null = valeur calculée automatiquement */
  calories_manuelles: number | null;
  regimes: Regime[];
  cuisines_preferees: string[];
  temps_max_semaine: number;
  temps_max_weekend: number;
  niveau_cuisine: NiveauCuisine;
  batch_cooking: boolean;
  batch_cooking_jour: number;
  equipements: string[];
  auto_restes: boolean;
  rythme_desserts: RythmeDesserts;
  utiliser_saison: boolean;
}

const STEPS = [
  { title: 'Bienvenue !', subtitle: 'Votre planificateur de repas personnel' },
  { title: 'Votre objectif', subtitle: 'Ce que votre semaine doit optimiser' },
  { title: 'Vos besoins caloriques', subtitle: 'Calculés selon votre objectif — modifiables' },
  { title: 'Allergies & intolérances', subtitle: 'On évitera ces aliments' },
  { title: 'Régime alimentaire', subtitle: 'Un régime particulier ?' },
  { title: 'Vos goûts', subtitle: 'Ce que vous aimez... et détestez' },
  { title: 'En pratique', subtitle: 'Votre quotidien en cuisine' },
  { title: 'Ma cuisine', subtitle: 'Avec quoi cuisinez-vous ?' },
  { title: 'Batch cooking', subtitle: 'Cuisinez une fois, mangez 4 jours' },
  { title: 'Récapitulatif', subtitle: 'Vérifions que tout est bon' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createBrowserClient();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OnboardingForm>({
    nb_personnes: 2, objectif: 'maintien', allergies: [], dislikes: [],
    regimes: [], cuisines_preferees: [], temps_max_semaine: 30, temps_max_weekend: 60, niveau_cuisine: 'intermediaire',
    batch_cooking: false, batch_cooking_jour: 6,
    equipements: [], auto_restes: false, rythme_desserts: 'equilibre', utiliser_saison: true,
    sexe: null, age: '', taille_cm: '', poids_kg: '', calories_manuelles: null,
  });

  // Profil corporel saisi (vide → valeur de référence) et kcal proposées
  const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const profilCorporel = {
    sexe: form.sexe,
    age: nombre(form.age),
    taille_cm: nombre(form.taille_cm),
    poids_kg: nombre(form.poids_kg),
  };
  const kcalCalculees = caloriesRecommandees(form.objectif, profilCorporel);
  const kcalFinales = kcalValide(form.calories_manuelles) ?? kcalCalculees;
  const estimation = profilEffectif(profilCorporel).estimation;

  // Rediriger si pas authentifié (double sécurité avec le middleware)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const progress = ((step + 1) / STEPS.length) * 100;

  type ToggleableField = 'allergies' | 'dislikes' | 'regimes' | 'cuisines_preferees' | 'equipements';
  const toggle = (field: ToggleableField, val: string | number | Regime) => {
    setForm(prev => {
      const list = prev[field] as (string | number)[];
      const updated = list.includes(val as string | number)
        ? list.filter(v => v !== val)
        : [...list, val as string | number];
      return { ...prev, [field]: updated };
    });
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // 1. Mettre à jour le profil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nb_personnes: form.nb_personnes,
          objectif: form.objectif,
          niveau_cuisine: form.niveau_cuisine,
          temps_max_semaine: form.temps_max_semaine,
          temps_max_weekend: form.temps_max_weekend,
          cuisines_preferees: form.cuisines_preferees,
          batch_cooking: form.batch_cooking,
          batch_cooking_jour: form.batch_cooking_jour,
          equipements: form.equipements,
          auto_restes: form.auto_restes,
          rythme_desserts: form.rythme_desserts,
          utiliser_saison: form.utiliser_saison,
          calories_par_jour: kcalFinales,
          onboarding_complete: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Profil corporel (colonnes 00030) : enregistrement séparé et non
      // bloquant — si la migration n'est pas encore appliquée, l'inscription
      // aboutit quand même (les kcal sont déjà enregistrées ci-dessus).
      // Une saisie hors bornes n'est pas enregistrée (null = référence).
      const pe = profilEffectif(profilCorporel);
      const saisi = (v: number | null, effectif: number) => (v != null && v === effectif ? effectif : null);
      const { error: corpsError } = await supabase
        .from('profiles')
        .update({
          sexe: form.sexe,
          age: saisi(profilCorporel.age, pe.age),
          taille_cm: saisi(profilCorporel.taille_cm, pe.taille_cm),
          poids_kg: saisi(profilCorporel.poids_kg, pe.poids_kg),
        })
        .eq('id', user.id);
      if (corpsError) console.warn('Profil corporel non enregistré :', corpsError.message);

      // Allergies et détestés : familles → ingrédients réels du catalogue
      const besoinCatalogue = form.allergies.length > 0 || form.dislikes.length > 0;
      const { data: ingredients } = besoinCatalogue
        ? await supabase.from('ingredients').select('id, nom')
        : { data: [] as { id: number; nom: string }[] };
      const allergieIds = resoudreExclusions(form.allergies, TOUTES_ALLERGIES, ingredients ?? []);
      const dislikeIds = resoudreExclusions(form.dislikes, DETESTES, ingredients ?? [])
        .filter(id => !allergieIds.includes(id));

      // 2. Sauvegarder les allergies
      if (allergieIds.length > 0) {
        const { error: allergiesError } = await supabase.from('user_allergies').upsert(
          allergieIds.map(ingredient_id => ({ user_id: user.id, ingredient_id })),
          { onConflict: 'user_id,ingredient_id' }
        );
        // Une allergie non enregistrée est un risque santé : on bloque.
        if (allergiesError) throw allergiesError;
      }

      // 3. Sauvegarder les dislikes
      if (dislikeIds.length > 0) {
        await supabase.from('user_dislikes').upsert(
          dislikeIds.map(ingredient_id => ({ user_id: user.id, ingredient_id })),
          { onConflict: 'user_id,ingredient_id' }
        );
      }

      // 4. Sauvegarder les régimes
      if (form.regimes.length > 0) {
        await supabase.from('user_diets').upsert(
          form.regimes.map(regime => ({ user_id: user.id, regime })),
          { onConflict: 'user_id,regime' }
        );
      }

      // 5. Email de bienvenue (transactionnel unique, jamais bloquant —
      // fire-and-forget : on ne retarde pas la navigation vers le dashboard)
      fetch('/api/welcome', { method: 'POST' }).catch(() => { /* best-effort */ });

      toast.success('✨ Profil enregistré !');
      router.push('/aujourdhui');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde : ' + errorMessage(err));
      setSaving(false);
    }
  };

  // État de chargement pendant la vérification du middleware
  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-50 border-b border-gray-200">
        <div className="container-app py-4 flex items-center justify-between">
          {/* Identité verrouillée : BrandMark (wordmark gris comme la landing,
              pas le text-brand-500 qui faisait dévier l'orange sur cette page) */}
          <BrandMark href="/" compact />
          <div className="text-sm text-gray-500">Étape {step + 1} sur {STEPS.length}</div>
        </div>
        <div className="h-1 bg-gray-100"><div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      </header>

      <div className="flex-1 container-app py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{STEPS[step].title}</h1>
          <p className="text-gray-500 mb-10">{STEPS[step].subtitle}</p>

          <div className="bg-white rounded-2xl p-8 shadow-xs border border-gray-100">
            {step === 0 && (
              <div className="text-center">
                <div className="text-6xl mb-6">👋</div>
                <h2 className="text-2xl font-bold mb-4">Faisons connaissance !</h2>
                <p className="text-gray-500 mb-8">Pour vous proposer des repas qui vous ressemblent, j&apos;ai besoin d&apos;en savoir un peu plus.</p>
                <div className="flex items-center justify-center gap-4">
                  <Users className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Personnes :</span>
                  <button onClick={() => setForm(f => ({ ...f, nb_personnes: Math.max(1, f.nb_personnes - 1) }))} className="w-10 h-10 rounded-full border hover:bg-gray-50">−</button>
                  <span className="w-8 text-center text-xl font-bold text-brand-500">{form.nb_personnes}</span>
                  <button onClick={() => setForm(f => ({ ...f, nb_personnes: Math.min(20, f.nb_personnes + 1) }))} className="w-10 h-10 rounded-full border hover:bg-gray-50">+</button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {([['sans_regime', '🍽️', 'Sans objectif', 'Je veux juste bien manger'], ['maintien', '⚖️', 'Maintien', 'Garder mon poids'], ['perte_poids', '🎯', 'Perte de poids', 'Repas équilibrés'], ['prise_masse', '💪', 'Prise de masse', 'Plus de protéines']] as [Objectif, string, string, string][]).map(([val, emoji, label, desc]) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, objectif: val }))}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${form.objectif === val ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{emoji}</span>
                      <div><div className="font-semibold">{label}</div><div className="text-sm text-gray-500">{desc}</div></div>
                      {form.objectif === val && <Check className="w-5 h-5 text-brand-500 ml-auto" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-brand-50 border border-brand-100 p-5 text-center">
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase text-brand-600">Apport conseillé</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <input
                      type="number" inputMode="numeric" min={BORNES.kcal.min} max={BORNES.kcal.max} step={50}
                      value={form.calories_manuelles ?? kcalCalculees}
                      onChange={e => setForm(f => ({ ...f, calories_manuelles: e.target.value === '' ? null : Number(e.target.value) }))}
                      aria-label="Kilocalories par jour"
                      className="w-32 text-center text-4xl font-bold font-display text-gray-900 bg-transparent border-b-2 border-brand-200 focus:border-brand-500 outline-hidden"
                    />
                    <span className="text-gray-500 font-medium">kcal / jour</span>
                  </div>
                  {form.calories_manuelles != null && kcalValide(form.calories_manuelles) == null && (
                    <p className="text-xs text-red-600 mt-2">Entre {BORNES.kcal.min} et {BORNES.kcal.max} kcal — la valeur calculée ({kcalCalculees}) sera utilisée.</p>
                  )}
                  {form.calories_manuelles != null ? (
                    <button type="button" onClick={() => setForm(f => ({ ...f, calories_manuelles: null }))}
                      className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 underline">
                      Revenir au calcul automatique ({kcalCalculees} kcal)
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">
                      {estimation
                        ? 'Estimation à partir de valeurs de référence — précisez votre profil ci-dessous pour affiner.'
                        : 'Calculé à partir de votre profil et de votre objectif. Vous pouvez modifier cette valeur.'}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-1">Votre profil <span className="text-gray-400 font-normal text-sm">(facultatif)</span></h3>
                  <p className="text-sm text-gray-500 mb-4">Ces informations servent uniquement à calculer vos besoins.</p>
                  <div className="flex gap-2 mb-4">
                    {([['femme', 'Femme'], ['homme', 'Homme'], [null, 'Non précisé']] as [Sexe | null, string][]).map(([val, label]) => (
                      <Chip key={label} active={form.sexe === val} onClick={() => setForm(f => ({ ...f, sexe: val }))}>{label}</Chip>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {([['age', 'Âge', 'ans', BORNES.age], ['taille_cm', 'Taille', 'cm', BORNES.taille_cm], ['poids_kg', 'Poids', 'kg', BORNES.poids_kg]] as const).map(([champ, label, unite, b]) => {
                      const v = form[champ];
                      const n = nombre(v);
                      const invalide = n != null && (Number.isNaN(n) || n < b.min || n > b.max);
                      return (
                        <label key={champ} className="block">
                          <span className="text-xs font-medium text-gray-600">{label}</span>
                          <div className={`mt-1 flex items-center rounded-xl border bg-white px-3 py-2 ${invalide ? 'border-red-300' : 'border-gray-200 focus-within:border-brand-400'}`}>
                            <input type="text" inputMode="decimal" value={v} placeholder="—"
                              onChange={e => setForm(f => ({ ...f, [champ]: e.target.value }))}
                              className="w-full min-w-0 bg-transparent outline-hidden text-gray-900" />
                            <span className="text-xs text-gray-400 ml-1">{unite}</span>
                          </div>
                          {invalide && <span className="text-[11px] text-red-600">{b.min}–{b.max} {unite}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <h3 className="font-semibold mb-3">⚠️ Allergies & intolérances</h3>
                  <p className="text-sm text-gray-500 mb-4">Ces aliments seront <strong>exclus</strong> de vos repas.</p>
                  <div className="space-y-5">
                    {GROUPES_ALLERGIES.map(g => (
                      <div key={g.titre}>
                        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-500 mb-2">{g.titre}</p>
                        <div className="flex flex-wrap gap-2">
                          {g.familles.map(a => (
                            <Chip key={a.code} active={form.allergies.includes(a.code)} onClick={() => toggle('allergies', a.code)} danger>
                              {a.emoji} {a.nom}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">🤢 Aliments détestés</h3>
                  <p className="text-sm text-gray-500 mb-4">On évitera de vous les proposer.</p>
                  <div className="flex flex-wrap gap-2">
                    {DETESTES.map(a => (
                      <Chip key={a.code} active={form.dislikes.includes(a.code)} onClick={() => toggle('dislikes', a.code)} warning>
                        {a.emoji} {a.nom}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">Sélectionnez votre régime (plusieurs possibles).</p>
                {REGIMES.map(r => (
                  <button key={r.value} onClick={() => toggle('regimes', r.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${form.regimes.includes(r.value) ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{r.label}</span>
                      {form.regimes.includes(r.value) && <Check className="w-5 h-5 text-brand-500 ml-auto" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 5 && (
              <div>
                <p className="text-sm text-gray-500 mb-4">Quelles cuisines aimez-vous ? <strong>Choisissez au moins 3.</strong></p>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map(c => (
                    <Chip key={c} active={form.cuisines_preferees.includes(c)} onClick={() => toggle('cuisines_preferees', c)}>{c}</Chip>
                  ))}
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div>
                  <label className="font-semibold block mb-2"><ChefHat className="w-4 h-4 inline mr-2" />Niveau en cuisine</label>
                  <div className="flex gap-2">
                    {(['debutant', 'intermediaire', 'expert'] as NiveauCuisine[]).map(n => (
                      <button key={n} onClick={() => setForm(f => ({ ...f, niveau_cuisine: n }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${form.niveau_cuisine === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {n === 'debutant' ? '👶 Débutant' : n === 'intermediaire' ? '👨‍🍳 Intermédiaire' : '🧑‍🍳 Expert'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-semibold block mb-2"><Clock className="w-4 h-4 inline mr-2" />Temps de préparation max</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">En semaine</div>
                      <select value={form.temps_max_semaine} onChange={e => setForm(f => ({ ...f, temps_max_semaine: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        {[15, 30, 45, 60, 90].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Week-end</div>
                      <select value={form.temps_max_weekend} onChange={e => setForm(f => ({ ...f, temps_max_weekend: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        {[30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 7 && (
              <div>
                <div className="text-center mb-8">
                  <div className="text-5xl mb-4">🍳</div>
                  <p className="text-gray-500">
                    Cochez vos appareils : l&apos;algorithme mettra en avant les recettes
                    que vous <strong>pouvez</strong> cuisiner (Air fryer, Cookéo, Thermomix…).
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {EQUIPEMENTS.map(eq => {
                    const actif = form.equipements.includes(eq);
                    return (
                      <button key={eq}
                        onClick={() => toggle('equipements', eq)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-full border-2 transition-all ${
                          actif
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                        }`}>
                        {actif && <Check className="w-4 h-4 inline mr-1 -mt-0.5" />}
                        {eq}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">Aucun n&apos;est obligatoire — poêle et four sont considérés présents chez tout le monde.</p>

                <label className="flex items-start gap-3 mt-6 p-4 bg-sable-50/60 border border-sable-100 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={form.auto_restes}
                    onChange={e => setForm(f => ({ ...f, auto_restes: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-sable-500" />
                  <span>
                    <span className="text-sm font-medium text-gray-900">🍱 Meal Prep Pro — les déjeuners = les restes du dîner</span>
                    <span className="text-xs text-gray-500 mt-0.5 block">
                      À chaque optimisation : cuisiner ×2 le soir, lunchbox le lendemain midi
                      (économise facilement 100 €/mois de sandwichs).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 mt-3 p-4 bg-sauge-50/60 border border-sauge-100 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={form.utiliser_saison}
                    onChange={e => setForm(f => ({ ...f, utiliser_saison: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-sauge-600" />
                  <span>
                    <span className="text-sm font-medium text-gray-900">🌱 Se baser sur les fruits & légumes de saison</span>
                    <span className="text-xs text-gray-500 mt-0.5 block">
                      Le moteur favorise les recettes de la saison en cours (un plat d&apos;hiver
                      n&apos;est pas proposé en plein été). Modifiable à tout moment dans les réglages.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {step === 8 && (
              <div>
                <div className="text-center mb-8">
                  <div className="text-5xl mb-4">👨‍🍳</div>
                  <p className="text-gray-500 mb-4">
                    Le <strong>batch cooking</strong> consiste à cuisiner en une seule fois tous les repas de plusieurs jours.
                    L&apos;algorithme favorisera les recettes qui se conservent bien.
                  </p>
                </div>

                <label className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer border-brand-500 bg-brand-50">
                  <input
                    type="checkbox"
                    checked={form.batch_cooking}
                    onChange={e => setForm(f => ({ ...f, batch_cooking: e.target.checked }))}
                    className="w-5 h-5 rounded-sm accent-brand-500"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Activer le batch cooking</div>
                    <div className="text-sm text-gray-500">Je cuisine le week-end pour toute la semaine</div>
                  </div>
                </label>

                {/* Rythme des desserts (axe 3 de l'audit) : la question « l'outil
                    génère-t-il aussi les desserts ? » reçoit sa réponse ICI, au
                    réglage — pas à chaque génération. Gourmand = Pro (le seul
                    gate desserts du produit, mis en avant honnêtement). */}
                <div className="mt-6 p-5 bg-accent-50/60 rounded-xl border border-accent-100">
                  <h3 className="font-semibold text-gray-900 mb-1">🍰 Et les desserts ?</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Le moteur les planifie tout seul — week-end d&apos;abord, jamais deux
                    fois le même, ingrédients ajoutés à la liste de courses. Choisissez le rythme :
                  </p>
                  <div role="radiogroup" aria-label="Rythme des desserts" className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'aucun', label: 'Aucun', sous: 'semaine sans dessert' },
                      { value: 'leger', label: 'Léger', sous: '2 soirs + 1 midi' },
                      { value: 'equilibre', label: 'Équilibré', sous: '3-4 soirs + 2-3 midis' },
                      { value: 'gourmand', label: 'Gourmand', sous: '5-6 soirs + 3 midis · Pro' },
                    ] as { value: RythmeDesserts; label: string; sous: string }[]).map(r => {
                      const actif = form.rythme_desserts === r.value;
                      return (
                        <button key={r.value} type="button" role="radio" aria-checked={actif}
                          onClick={() => setForm(f => ({ ...f, rythme_desserts: r.value }))}
                          className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                            actif ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'}`}>
                          <span className="block text-sm font-semibold flex items-center gap-1">
                            {actif && <Check className="w-3.5 h-3.5" />}{r.label}
                          </span>
                          <span className={`block text-[11px] mt-0.5 ${actif ? 'text-white/80' : 'text-gray-500'}`}>{r.sous}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Honnêteté immédiate : un gratuit qui choisit Gourmand sait
                      AVANT l'enregistrement que la semaine tournera en équilibré
                      (le moteur dégrade, cf. rotation-engine) — pas de surprise,
                      et une porte d'upgrade naturelle. */}
                  {form.rythme_desserts === 'gourmand' && (
                    <p className="mt-2 text-xs text-accent-700 bg-accent-100 border border-accent-200 rounded-lg px-3 py-2">
                      👑 Le rythme Gourmand est inclus dans les plans <strong>Pro</strong> et
                      Famille. Sans abonnement, vos semaines tourneront au rythme Équilibré —
                      modifiable plus tard dans Mon compte.
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-2">
                    Modifiable à tout moment dans Mon compte → Ma cuisine.
                  </p>
                </div>

                {form.batch_cooking && (
                  <div className="mt-6 p-5 bg-brand-50 rounded-xl border border-brand-100">
                    <h3 className="font-semibold text-gray-900 mb-3">🗓️ Quel jour batch cookez-vous ?</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((nom, idx) => (
                        <button
                          key={idx}
                          onClick={() => setForm(f => ({ ...f, batch_cooking_jour: idx }))}
                          className={`py-2 rounded-lg text-xs font-medium transition-all ${
                            form.batch_cooking_jour === idx
                              ? 'bg-brand-500 text-white shadow-md'
                              : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'
                          }`}
                        >
                          {nom}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      {form.batch_cooking_jour === 6
                        ? '🎯 Le dimanche : vous cuisinez ~4 recettes, elles servent pour dimanche, lundi, mardi et mercredi.'
                        : `📅 Le jour choisi + 3 jours suivants seront couverts par vos batchs.`
                      }
                    </p>
                    <div className="mt-4 p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500 font-medium mb-2">Exemples de recettes idéales batch cooking :</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['Gratins', 'Currys', 'Soupes', 'Tajines', 'Lasagnes', 'Dahls', 'Chili', 'Ratatouille'].map(r => (
                          <span key={r} className="px-2 py-0.5 bg-sauge-100 text-sauge-700 text-xs rounded-full">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 9 && (
              <div className="space-y-4">
                {[
                  ['👥 Personnes', `${form.nb_personnes}`],
                  ['🎯 Objectif', form.objectif.replace('_', ' ')],
                  ['🔥 Calories', `${kcalFinales} kcal / jour${kcalValide(form.calories_manuelles) != null ? ' (personnalisé)' : ''}`],
                  ['⚠️ Allergies', form.allergies.length > 0 ? form.allergies.map(code => TOUTES_ALLERGIES.find(a => a.code === code)?.nom).join(', ') : 'Aucune'],
                  ['🤢 Détestés', form.dislikes.length > 0 ? form.dislikes.map(code => DETESTES.find(a => a.code === code)?.nom).join(', ') : 'Aucun'],
                  ['🍽️ Régimes', form.regimes.length > 0 ? form.regimes.map(v => REGIMES.find(x => x.value === v)?.label ?? v).join(', ') : 'Aucun'],
                  ['🌍 Cuisines', form.cuisines_preferees.length > 0 ? form.cuisines_preferees.join(', ') : 'Pas de préférence'],
                  ['⏱️ Temps semaine', `${form.temps_max_semaine} min`],
                  ['👨‍🍳 Niveau', form.niveau_cuisine],
                  ['🍳 Équipements', form.equipements.length > 0 ? form.equipements.join(', ') : 'Les basiques'],
                  ['🍱 Restes du dîner', form.auto_restes ? 'Activé (Meal Prep Pro)' : 'Désactivé'],
                  ['🌱 Recettes de saison', form.utiliser_saison ? 'Favorisées' : 'Désactivé'],
                  ['🍰 Rythme desserts', (RYTHME_LABELS as Record<string, string>)[form.rythme_desserts] ?? 'Équilibré'],
                  ['📦 Batch cooking', form.batch_cooking ? `Activé — le ${['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][form.batch_cooking_jour || 6]}` : 'Désactivé'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">{val || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <button onClick={() => setStep(s => s - 1)} className={`inline-flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 ${step === 0 ? 'invisible' : ''}`}>
              <ArrowLeft className="w-4 h-4" /> Précédent
            </button>
            <button onClick={() => step === STEPS.length - 1 ? handleComplete() : setStep(s => s + 1)} disabled={saving} className="inline-flex items-center gap-2 px-8 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-cta">
              {/* Le dernier bouton N'A JAMAIS généré de semaine : handleComplete
                  enregistre le profil puis redirige vers /aujourdhui — le libellé
                  « Générer ma première semaine » mentait. Il dit maintenant ce
                  qui se passe vraiment, dans le vocabulaire de la promesse. */}
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : step === STEPS.length - 1 ? <><Sparkles className="w-4 h-4" /> Créer mon profil et optimiser</> : <>Continuer <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Chip({ children, active, onClick, danger, warning }: { children: React.ReactNode; active: boolean; onClick: () => void; danger?: boolean; warning?: boolean }) {
  const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer';
  const activeClass = active ? (danger ? 'border-red-300 bg-red-50 text-red-700' : warning ? 'border-sable-300 bg-sable-50 text-sable-700' : 'border-brand-300 bg-brand-50 text-brand-700') : 'border-gray-200 text-gray-600 hover:border-gray-300';
  return <button onClick={onClick} className={`${base} ${activeClass}`}>{children}</button>;
}
// ============================================================================
// Mémoire alimentaire + contraintes de créneau — tests unitaires
//
// Couvre ce que le moteur a appris de nouveau : notation, fréquence souhaitée,
// jour préféré, temps disponible du jour, contexte culinaire, frigo, curseur
// de nouveauté, et l'explication « Pourquoi ce repas ? » (qui ne doit jamais
// affirmer un facteur absent des données).
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { Meal, Profile } from '@/types';
import {
  MEMOIRE_VIDE,
  contexteJour,
  expliquerChoix,
  normaliserPreference,
  parseContexteJours,
  parseTempsMaxParJour,
  statutDepuisNote,
  tempsMaxJour,
  tempsTotal,
  type MemoireAlimentaire,
} from '@/lib/memoire';
import {
  calculateMealScore,
  pickPourSlot,
  scorePourSlot,
  type Candidate,
  type SlotContexte,
} from '@/lib/rotation-engine';

// ─── Fabriques de test ──────────────────────────────────────────────────────

function meal(over: Partial<Meal> = {}): Meal {
  return {
    id: 1,
    titre: 'Poulet curry',
    description: null,
    type_repas: 'plat',
    temps_preparation: 20,
    temps_cuisson: 5,
    difficulte: 'facile',
    saison: 'toutes',
    cuisine: 'indienne',
    calories_par_portion: 600,
    proteines: null,
    glucides: null,
    lipides: null,
    macros_verifiables: true,
    fibres: null,
    conservation_jours: 3,
    ustensiles: [],
    instructions: [],
    image_url: null,
    portions_par_defaut: 2,
    created_by: null,
    is_public: true,
    ingredients: [],
    ...over,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    sexe: null, age: null, taille_cm: null, poids_kg: null,
    email: 'test@example.com',
    full_name: 'Test',
    nb_personnes: 2,
    budget_hebdo: null,
    objectif: 'maintien',
    calories_par_jour: null,
    niveau_cuisine: 'intermediaire',
    temps_max_semaine: 30,
    temps_max_weekend: 60,
    cuisines_preferees: [],
    plan: 'gratuit',
    onboarding_complete: true,
    batch_cooking: false,
    batch_cooking_jour: 6,
    prix_max_portion: null,
    equipements: [],
    auto_restes: false,
    desserts_activees: true,
    rythme_desserts: 'equilibre',
    temps_max_par_jour: Array(7).fill(null),
    contexte_jours: Array(7).fill(null),
    nouveaute: 50,
    utiliser_saison: true,
    poids_famille: 70,
    depense_reference_hebdo: null,
    depense_reference_saisie_le: null,
    emails_transactionnels: true,
    welcome_email_envoye_le: null,
    digest_envoye_le: null,
    ...over,
  };
}

function memoire(over: Partial<MemoireAlimentaire> = {}): MemoireAlimentaire {
  return { ...MEMOIRE_VIDE, preferences: new Map(), ...over };
}

function slot(over: Partial<SlotContexte> = {}): SlotContexte {
  return {
    jourIndex: 0,
    repasType: 'diner',
    tempsMax: null,
    contexte: 'normal',
    nouveaute: 50,
    ...over,
  };
}

/** Input de score « neutre » : ≥ 30 j, aucun like/dislike, peu d'apparitions */
function scoreBase(over: Partial<Parameters<typeof calculateMealScore>[0]> = {}) {
  return calculateMealScore({
    meal: meal(),
    profile: profile(),
    joursDepuisDerniere: 40,
    nbLikes: 0,
    nbDislikes: 0,
    nbApparitions: 1,
    saisonActuelle: 'toutes',
    nouveaute: 50,
    ...over,
  });
}

// ─── Normalisation des colonnes jsonb ───────────────────────────────────────

describe('normalisation de la mémoire', () => {
  it('parseTempsMaxParJour garde 7 entrées et rejette les valeurs invalides', () => {
    expect(parseTempsMaxParJour([null, 20, 'x', 0, 45, undefined, 120]))
      .toEqual([null, 20, null, null, 45, null, 120]);
  });

  it('parseTempsMaxParJour tolère une entrée absente ou non-tableau', () => {
    expect(parseTempsMaxParJour(null)).toEqual(Array(7).fill(null));
    expect(parseTempsMaxParJour({})).toEqual(Array(7).fill(null));
  });

  it('parseContexteJours ne retient que les valeurs connues', () => {
    expect(parseContexteJours(['rapide', 'bidon', null, 'plaisir', 'leger', 'normal', 42]))
      .toEqual(['rapide', null, null, 'plaisir', 'leger', 'normal', null]);
  });

  it('tempsMaxJour retombe sur semaine/weekend quand le jour est vide', () => {
    const p = profile({ temps_max_semaine: 30, temps_max_weekend: 90 });
    expect(tempsMaxJour(memoire(), 2, p)).toBe(30);
    expect(tempsMaxJour(memoire(), 6, p)).toBe(90);
  });

  it('tempsMaxJour priorise la valeur du jour quand elle est définie', () => {
    const t = Array(7).fill(null) as (number | null)[];
    t[2] = 15;
    expect(tempsMaxJour(memoire({ tempsMaxParJour: t }), 2, profile())).toBe(15);
  });

  it('contexteJour vaut « normal » par défaut', () => {
    expect(contexteJour(memoire(), 3)).toBe('normal');
  });

  it('tempsTotal additionne préparation et cuisson (cuisson absente = 0)', () => {
    expect(tempsTotal(meal({ temps_preparation: 10, temps_cuisson: null }))).toBe(10);
    expect(tempsTotal(meal({ temps_preparation: 10, temps_cuisson: 15 }))).toBe(25);
  });
});

// ─── Préférences : patch partiel ────────────────────────────────────────────

describe('normaliserPreference', () => {
  it('ne renvoie que les clés fournies (un patch ne doit rien effacer)', () => {
    expect(normaliserPreference({ jour_prefere: 6 })).toEqual({ jour_prefere: 6 });
  });

  it('borne la note entre 1 et 5', () => {
    expect(normaliserPreference({ note: 9 }).note).toBe(5);
    expect(normaliserPreference({ note: -3 }).note).toBe(1);
  });

  it('accepte null pour effacer une préférence', () => {
    expect(normaliserPreference({ frequence_jours: null })).toEqual({ frequence_jours: null });
  });

  it('rejette un créneau inconnu', () => {
    expect(normaliserPreference({ repas_prefere: 'gouter' as never }).repas_prefere).toBeNull();
    expect(normaliserPreference({ repas_prefere: 'dessert_midi' }).repas_prefere).toBe('dessert_midi');
  });

  it('statutDepuisNote reste compatible avec les statuts déjà comptés par le moteur', () => {
    expect(statutDepuisNote(5)).toBe('liked');
    expect(statutDepuisNote(4)).toBe('liked');
    expect(statutDepuisNote(3)).toBe('cooked');
    expect(statutDepuisNote(2)).toBe('disliked');
    expect(statutDepuisNote(1)).toBe('disliked');
  });
});

// ─── Facteurs de score ──────────────────────────────────────────────────────

describe('calculateMealScore — mémoire alimentaire', () => {
  it('une note 5/5 booste le score, une note 1/5 l\'écrase', () => {
    const base = scoreBase();
    const adore = scoreBase({ preference: { meal_id: 1, note: 5, frequence_jours: null, jour_prefere: null, repas_prefere: null, ne_plus_proposer: false } });
    const rejete = scoreBase({ preference: { meal_id: 1, note: 1, frequence_jours: null, jour_prefere: null, repas_prefere: null, ne_plus_proposer: false } });

    expect(adore).toBeGreaterThan(base);
    expect(rejete).toBeLessThan(base * 0.3);
  });

  it('la fréquence souhaitée pénalise une recette servie trop tôt', () => {
    const pref = { meal_id: 1, note: null, frequence_jours: 20, jour_prefere: null, repas_prefere: null, ne_plus_proposer: false };
    const trop = scoreBase({ joursDepuisDerniere: 5, preference: pref });
    const bon = scoreBase({ joursDepuisDerniere: 25, preference: pref });
    expect(bon).toBeGreaterThan(trop);
  });

  it('en mode découverte, une recette jamais servie est avantagée ; l\'inverse en confort', () => {
    const decouverte = scoreBase({ nouveaute: 100, nbApparitions: 0 });
    const confort = scoreBase({ nouveaute: 0, nbApparitions: 0 });
    expect(decouverte).toBeGreaterThan(confort);
  });

  it('le frigo applique un boost plafonné à +35 %', () => {
    const base = scoreBase({ partFrigo: 0 });
    const plein = scoreBase({ partFrigo: 1 });
    expect(plein / base).toBeCloseTo(1.35, 5);
    // Plafond : la part est bornée, une valeur aberrante ne dérape pas
    expect(scoreBase({ partFrigo: 5 }) / base).toBeCloseTo(1.35, 5);
  });
});

describe('scorePourSlot — contraintes du jour', () => {
  it('avantage fortement le jour préféré de la recette', () => {
    const c: Candidate = {
      meal: meal(),
      score: 1,
      preference: { meal_id: 1, note: null, frequence_jours: null, jour_prefere: 6, repas_prefere: null, ne_plus_proposer: false },
    };
    expect(scorePourSlot(c, slot({ jourIndex: 6 }))).toBeCloseTo(1.6, 5);
    expect(scorePourSlot(c, slot({ jourIndex: 1 }))).toBeCloseTo(1, 5);
  });

  it('« rapide » avantage une recette courte et pénalise une longue', () => {
    const court: Candidate = { meal: meal({ temps_preparation: 15, temps_cuisson: 0 }), score: 1 };
    const long: Candidate = { meal: meal({ temps_preparation: 50, temps_cuisson: 20 }), score: 1 };
    const s = slot({ contexte: 'rapide' });
    expect(scorePourSlot(court, s)).toBeGreaterThan(1);
    expect(scorePourSlot(long, s)).toBeLessThan(1);
  });

  it('« léger » pénalise un plat très calorique', () => {
    const leger: Candidate = { meal: meal({ calories_par_portion: 400 }), score: 1 };
    const lourd: Candidate = { meal: meal({ calories_par_portion: 900 }), score: 1 };
    const s = slot({ contexte: 'leger' });
    expect(scorePourSlot(leger, s)).toBeGreaterThan(scorePourSlot(lourd, s));
  });
});

// ─── Sélection par créneau ──────────────────────────────────────────────────

describe('pickPourSlot', () => {
  const court: Candidate = { meal: meal({ id: 10, temps_preparation: 15, temps_cuisson: 0 }), score: 1 };
  const long: Candidate = { meal: meal({ id: 11, temps_preparation: 60, temps_cuisson: 0 }), score: 1 };

  it('ne propose pas de recette dépassant le temps disponible du jour', () => {
    const choisi = pickPourSlot([court, long], new Set(), slot({ tempsMax: 20 }), () => 0);
    expect(choisi?.meal.id).toBe(10);
  });

  it('relâche la contrainte plutôt que de laisser un créneau vide', () => {
    const choisi = pickPourSlot([court, long], new Set([10]), slot({ tempsMax: 20 }), () => 0);
    expect(choisi?.meal.id).toBe(11);
  });

  it('n\'exclut jamais un créneau dessert des plats, ni l\'inverse', () => {
    const dessert: Candidate = { meal: meal({ id: 20, type_repas: 'dessert', temps_preparation: 5, temps_cuisson: 0 }), score: 1 };
    expect(pickPourSlot([court, dessert], new Set(), slot({ repasType: 'dessert' }), () => 0)?.meal.id).toBe(20);
    expect(pickPourSlot([court, dessert], new Set(), slot({ repasType: 'diner' }), () => 0)?.meal.id).toBe(10);
  });

  it('est déterministe avec une source aléatoire injectée', () => {
    const pool = [
      { meal: meal({ id: 1 }), score: 1 },
      { meal: meal({ id: 2 }), score: 1 },
      { meal: meal({ id: 3 }), score: 1 },
    ];
    const a = pickPourSlot(pool, new Set(), slot(), () => 0.99);
    const b = pickPourSlot(pool, new Set(), slot(), () => 0.99);
    expect(a?.meal.id).toBe(b?.meal.id);
  });

  it('renvoie null quand le pool est épuisé', () => {
    expect(pickPourSlot([court], new Set([10]), slot(), () => 0)).toBeNull();
    expect(pickPourSlot([], new Set(), slot(), () => 0)).toBeNull();
  });
});

// ─── « Pourquoi ce repas ? » ────────────────────────────────────────────────

describe('expliquerChoix', () => {
  const base = {
    jourIndex: 0,
    repasType: 'diner' as const,
    profile: profile({ temps_max_semaine: 30, budget_hebdo: 70 }),
    memoire: memoire(),
    historique: { joursDepuisDerniere: 40, likes: 0, dislikes: 0, total: 1 },
    frigoIngredientIds: new Set<number>(),
    budgetHebdo: 70,
    prixPortion: null,
    saisonActuelle: 'toutes',
  };

  it('cite la note réelle de l\'utilisateur', () => {
    const r = expliquerChoix(meal(), {
      ...base,
      memoire: memoire({
        preferences: new Map([[1, { meal_id: 1, note: 5, frequence_jours: null, jour_prefere: null, repas_prefere: null, ne_plus_proposer: false }]]),
      }),
    });
    expect(r.lignes.some(l => l.texte.includes('5/5'))).toBe(true);
  });

  it('cite la fréquence souhaitée et l\'ancienneté', () => {
    const r = expliquerChoix(meal(), {
      ...base,
      memoire: memoire({
        preferences: new Map([[1, { meal_id: 1, note: null, frequence_jours: 20, jour_prefere: null, repas_prefere: null, ne_plus_proposer: false }]]),
      }),
    });
    expect(r.lignes.some(l => l.texte.includes('20 jours'))).toBe(true);
    expect(r.lignes.some(l => l.texte.includes('40 jours'))).toBe(true);
  });

  it('compte les ingrédients réellement présents au frigo', () => {
    const avec = meal({
      ingredients: [
        { ingredient: { id: 7, nom: 'Carotte', rayon: 'fruits_legumes', saison: 'toutes', prix_unitaire: null, unite_prix: null, poids_unites: null }, quantite: 3, unite: 'pcs', est_optionnel: false },
      ],
    });
    const r = expliquerChoix(avec, { ...base, frigoIngredientIds: new Set([7]) });
    expect(r.ingredientsFrigo).toBe(1);
    expect(r.lignes.some(l => l.texte.includes('1 ingrédient déjà dans ton frigo'))).toBe(true);
  });

  it('avertit quand la recette dépasse le temps disponible du jour', () => {
    const t = Array(7).fill(null) as (number | null)[];
    t[0] = 15;
    const r = expliquerChoix(meal({ temps_preparation: 40, temps_cuisson: 0 }), {
      ...base,
      memoire: memoire({ tempsMaxParJour: t }),
    });
    expect(r.lignes.some(l => l.emoji === '⚠️')).toBe(true);
  });

  it('n\'invente aucune raison : sans donnée, une seule ligne honnête', () => {
    const r = expliquerChoix(meal({ cuisine: null, calories_par_portion: null, conservation_jours: null, saison: 'toutes' }), {
      ...base,
      profile: profile({ temps_max_semaine: 0, temps_max_weekend: 0, budget_hebdo: null }),
      memoire: memoire({ nouveaute: 50 }),
      historique: { joursDepuisDerniere: null, likes: 0, dislikes: 0, total: 0 },
      budgetHebdo: null,
    });
    // temps max à 0 = contrainte non renseignée → aucune ligne de temps ;
    // jamais mangée → la seule ligne factuelle restante est l'ancienneté.
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].emoji).toBe('✨');
  });
});

// ============================================================================
// Tests — profil famille et compromis
//
// Ce qui est vérifié ici n'est pas « le code s'exécute », mais les RÈGLES :
// un veto majoritaire bloque, un veto minoritaire ne bloque pas, et un membre
// mécontent fait chuter le compromis d'une recette même si les autres l'adorent.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { Meal, MembreFamilleComplet, Profile, RelationIngredient } from '@/types';
import {
  FAMILLE_VIDE,
  SATISFACTION_MAX,
  SATISFACTION_MIN,
  alimentsInterdits,
  bornerPoids,
  bornerPoidsFamille,
  compromisFamille,
  estRelationIngredient,
  facteurFamille,
  humeurMembre,
  indexerFamille,
  raisonMembre,
  recettesVetees,
  satisfactionMembre,
  type Famille,
} from '@/lib/famille';
import { MEMOIRE_VIDE, expliquerChoix } from '@/lib/memoire';
import { calculateMealScore, raisonExclusion, type FiltresDurs } from '@/lib/rotation-engine';

// ─── Fabriques de test ──────────────────────────────────────────────────────

function membre(over: Partial<MembreFamilleComplet> = {}): MembreFamilleComplet {
  return {
    id: 1, nom: 'Léa', emoji: '👧', poids: 3, age: null,
    aliments: [],
    recettes: [],
    ...over,
  };
}

function famille(membres: MembreFamilleComplet[], poidsFamille = 100): Famille {
  return indexerFamille(membres, poidsFamille);
}

/** Membre qui a noté une recette */
function avecNote(note: number, veto = false, over: Partial<MembreFamilleComplet> = {}): MembreFamilleComplet {
  return membre({ recettes: [{ meal_id: 1, note, ne_plus_proposer: veto }], ...over });
}

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
    id: 'u1', email: 'test@example.com', full_name: 'Test', nb_personnes: 2,
    budget_hebdo: null, objectif: 'maintien', calories_par_jour: null,
    niveau_cuisine: 'intermediaire', temps_max_semaine: 30, temps_max_weekend: 60,
    cuisines_preferees: [], plan: 'gratuit', onboarding_complete: true,
    batch_cooking: false, batch_cooking_jour: 6, prix_max_portion: null,
    equipements: [], auto_restes: false, desserts_activees: true, rythme_desserts: 'equilibre',
    temps_max_par_jour: Array(7).fill(null), contexte_jours: Array(7).fill(null),
    nouveaute: 50, utiliser_saison: true, poids_famille: 70, depense_reference_hebdo: null,
    depense_reference_saisie_le: null, emails_transactionnels: true,
    welcome_email_envoye_le: null, digest_envoye_le: null,
    ...over,
  };
}

function filtres(over: Partial<FiltresDurs> = {}): FiltresDurs {
  return {
    allergiesIds: new Set(), dislikesIds: new Set(), regimes: [], prixMax: null,
    alimentsInterditsFamille: new Set(), recettesVeteesFamille: new Set(), bannies: new Set(),
    ...over,
  };
}

// ─── Normalisation ──────────────────────────────────────────────────────────

describe('normalisation de la famille', () => {
  it('borne la pondération d\'un membre entre 1 et 5', () => {
    expect(bornerPoids(0)).toBe(1);
    expect(bornerPoids(9)).toBe(5);
    expect(bornerPoids(2.6)).toBe(3);
    expect(bornerPoids('n\'importe quoi')).toBe(3);
    expect(bornerPoids(null)).toBe(3);
  });

  it('borne le poids global du compromis entre 0 et 100', () => {
    expect(bornerPoidsFamille(-5)).toBe(0);
    expect(bornerPoidsFamille(150)).toBe(100);
    expect(bornerPoidsFamille(null)).toBe(70);
  });

  it('ne retient que les relations connues', () => {
    expect(estRelationIngredient('aime')).toBe(true);
    expect(estRelationIngredient('interdit')).toBe(true);
    expect(estRelationIngredient('deteste')).toBe(false);

    const f = indexerFamille([membre({
      aliments: [
        { ingredient_id: 1, relation: 'aime' },
        // Valeur inattendue en base (contrainte SQL contournée) : ignorée au
        // lieu de faire planter toute la génération.
        { ingredient_id: 2, relation: 'inconnue' as RelationIngredient },
      ],
    })], 70);
    expect(f.membres[0].aliments.get(1)).toBe('aime');
    expect(f.membres[0].aliments.has(2)).toBe(false);
  });

  it('une famille vide ne contient aucun membre', () => {
    expect(FAMILLE_VIDE.membres).toHaveLength(0);
    expect(indexerFamille([], 0).membres).toHaveLength(0);
  });
});

// ─── Filtres durs ───────────────────────────────────────────────────────────

describe('alimentsInterdits', () => {
  it('réunit les interdits de tous les membres, et eux seuls', () => {
    const f = famille([
      membre({ id: 1, aliments: [{ ingredient_id: 10, relation: 'interdit' }, { ingredient_id: 11, relation: 'aime' }] }),
      membre({ id: 2, aliments: [{ ingredient_id: 12, relation: 'interdit' }, { ingredient_id: 10, relation: 'n_aime_pas' }] }),
    ]);
    const interdits = alimentsInterdits(f);
    expect([...interdits].sort((a, b) => a - b)).toEqual([10, 12]);
  });
});

describe('recettesVetees — le veto est pondéré', () => {
  it('un membre seul qui refuse bloque la recette', () => {
    expect(recettesVetees(famille([avecNote(1, true)])).has(1)).toBe(true);
  });

  it('un refus minoritaire NE bloque PAS (1 membre sur 3)', () => {
    const f = famille([
      avecNote(1, true, { id: 1, poids: 3 }),
      membre({ id: 2, poids: 3 }),
      membre({ id: 3, poids: 3 }),
    ]);
    expect(recettesVetees(f).has(1)).toBe(false);
  });

  it('un refus majoritaire bloque (2 membres sur 3)', () => {
    const f = famille([
      avecNote(1, true, { id: 1, poids: 3 }),
      avecNote(1, true, { id: 2, poids: 3 }),
      membre({ id: 3, poids: 3 }),
    ]);
    expect(recettesVetees(f).has(1)).toBe(true);
  });

  it('un membre « prioritaire » (poids 5) l\'emporte sur deux membres « souples »', () => {
    const f = famille([
      avecNote(1, true, { id: 1, poids: 5 }),
      membre({ id: 2, poids: 1 }),
      membre({ id: 3, poids: 1 }),
    ]);
    // 5 / 7 ≈ 0.71 ≥ 0.5
    expect(recettesVetees(f).has(1)).toBe(true);
  });

  it('un membre « souple » (poids 1) ne l\'emporte pas sur un « prioritaire »', () => {
    const f = famille([
      avecNote(1, true, { id: 1, poids: 1 }),
      membre({ id: 2, poids: 5 }),
    ]);
    // 1 / 6 ≈ 0.17 < 0.5
    expect(recettesVetees(f).has(1)).toBe(false);
  });

  it('une note sans refus ne bloque jamais la recette', () => {
    expect(recettesVetees(famille([avecNote(1, false)])).has(1)).toBe(false);
  });
});

// ─── Satisfaction ───────────────────────────────────────────────────────────

describe('satisfactionMembre', () => {
  const neutre = famille([membre()]).membres[0];

  it('un membre sans avis est exactement neutre', () => {
    expect(satisfactionMembre(neutre, 1, [1, 2, 3])).toBe(1);
  });

  it('une note de 5/5 récompense', () => {
    const m = famille([avecNote(5)]).membres[0];
    expect(satisfactionMembre(m, 1, [])).toBeCloseTo(1.25, 5);
  });

  it('une note de 2/5 pénalise', () => {
    const m = famille([avecNote(2)]).membres[0];
    expect(satisfactionMembre(m, 1, [])).toBeCloseTo(0.55, 5);
  });

  it('une note de 1/5 sans refus reste au-dessus du plancher', () => {
    const m = famille([avecNote(1)]).membres[0];
    expect(satisfactionMembre(m, 1, [])).toBeCloseTo(0.3, 5);
  });

  it('note 1 + refus tombe au plancher', () => {
    const m = famille([avecNote(1, true)]).membres[0];
    expect(satisfactionMembre(m, 1, [])).toBe(SATISFACTION_MIN);
  });

  it('les aliments aimés sont plafonnés', () => {
    const m = famille([membre({
      aliments: [
        { ingredient_id: 1, relation: 'aime' },
        { ingredient_id: 2, relation: 'aime' },
        { ingredient_id: 3, relation: 'aime' },
      ],
    })]).membres[0];
    expect(satisfactionMembre(m, 1, [1, 2, 3])).toBe(SATISFACTION_MAX);
  });

  it('deux aliments « je n\'aime pas » pèsent sans exclure', () => {
    const m = famille([membre({
      aliments: [
        { ingredient_id: 1, relation: 'n_aime_pas' },
        { ingredient_id: 2, relation: 'n_aime_pas' },
      ],
    })]).membres[0];
    expect(satisfactionMembre(m, 1, [1, 2])).toBeCloseTo(0.64, 5);
  });
});

// ─── Compromis ──────────────────────────────────────────────────────────────

describe('compromisFamille — le compromis, pas la moyenne', () => {
  it('un foyer vide est neutre', () => {
    expect(compromisFamille(FAMILLE_VIDE, 1, []).compromis).toBe(1);
  });

  it('une recette adorée par tous est valorisée', () => {
    const f = famille([avecNote(5, false, { id: 1 }), avecNote(5, false, { id: 2 })]);
    expect(compromisFamille(f, 1, []).compromis).toBeCloseTo(1.25, 5);
  });

  it('un membre mécontent fait chuter le compromis SOUS la moyenne arithmétique', () => {
    const f = famille([
      avecNote(5, false, { id: 1 }),
      avecNote(5, false, { id: 2 }),
      avecNote(1, false, { id: 3 }),
    ]);
    const { compromis } = compromisFamille(f, 1, []);
    const moyenne = (1.25 + 1.25 + 0.3) / 3;

    // C'est tout l'intérêt du produit : deux « j'adore » ne rachètent pas un
    // « je n'aime pas ». La recette ne doit donc pas sortir en tête.
    expect(compromis).toBeLessThan(moyenne);
    expect(compromis).toBeLessThan(1);
  });

  it('relever le poids du mécontent abaisse le compromis', () => {
    const leger = famille([
      avecNote(1, false, { id: 1, poids: 1 }),
      avecNote(5, false, { id: 2, poids: 3 }),
    ]);
    const lourd = famille([
      avecNote(1, false, { id: 1, poids: 5 }),
      avecNote(5, false, { id: 2, poids: 3 }),
    ]);
    expect(compromisFamille(lourd, 1, []).compromis)
      .toBeLessThan(compromisFamille(leger, 1, []).compromis);
  });

  it('l\'ordre des membres ne change pas le résultat', () => {
    const a = avecNote(5, false, { id: 1, poids: 4 });
    const b = avecNote(2, false, { id: 2, poids: 2 });
    expect(compromisFamille(famille([a, b]), 1, []).compromis)
      .toBeCloseTo(compromisFamille(famille([b, a]), 1, []).compromis, 10);
  });

  it('détaille la satisfaction de chaque membre', () => {
    const f = famille([avecNote(5, false, { id: 1 }), avecNote(2, false, { id: 2 })]);
    const { detail } = compromisFamille(f, 1, []);
    expect(detail).toHaveLength(2);
    expect(detail[0].membre.id).toBe(1);
    expect(detail[1].satisfaction).toBeCloseTo(0.55, 5);
  });
});

describe('facteurFamille', () => {
  it('sans membre, le facteur est neutre', () => {
    expect(facteurFamille(FAMILLE_VIDE, 0.5)).toBe(1);
  });

  it('à 0 %, le compromis n\'influence plus rien', () => {
    const f = famille([avecNote(1, false)], 0);
    expect(facteurFamille(f, 0.3)).toBe(1);
  });

  it('à 100 %, le score du foyer EST le compromis', () => {
    const f = famille([avecNote(1, false)], 100);
    expect(facteurFamille(f, 0.3)).toBeCloseTo(0.3, 10);
  });

  it('à 50 %, le facteur est à mi-chemin entre neutre et compromis', () => {
    const f = famille([avecNote(1, false)], 50);
    expect(facteurFamille(f, 0.4)).toBeCloseTo(0.7, 10);
  });
});

// ─── Filtre dur partagé ─────────────────────────────────────────────────────

describe('raisonExclusion', () => {
  const poulet = meal({ id: 1, ingredients: [] });

  it('écarte une recette contenant un aliment interdit par un membre', () => {
    expect(raisonExclusion(poulet, [10, 11], [], filtres({ alimentsInterditsFamille: new Set([11]) })))
      .toBe('interdit_famille');
  });

  it('écarte une recette bloquée par le veto majoritaire du foyer', () => {
    expect(raisonExclusion(poulet, [10], [], filtres({ recettesVeteesFamille: new Set([1]) })))
      .toBe('veto_famille');
  });

  it('le bannissement du compte prime sur tout le reste', () => {
    expect(raisonExclusion(poulet, [10], [], filtres({
      bannies: new Set([1]), allergiesIds: new Set([10]), recettesVeteesFamille: new Set([1]),
    }))).toBe('bannie');
  });

  it('une allergie prime sur un interdit familial', () => {
    expect(raisonExclusion(poulet, [10], [], filtres({
      allergiesIds: new Set([10]), alimentsInterditsFamille: new Set([10]),
    }))).toBe('allergie');
  });

  it('le cap prix reste actif (promesse budget)', () => {
    // Un poulet à 30 €/kg sur une portion → bien au-dessus d'un cap à 1 €
    const cher = meal({
      ingredients: [{
        ingredient: {
          id: 1, nom: 'Poulet', rayon: 'viande_poisson', saison: 'toutes',
          prix_unitaire: 30, unite_prix: 'kg', poids_unites: null,
        },
        quantite: 1000, unite: 'g', est_optionnel: false,
      }],
    });
    expect(raisonExclusion(cher, [1], [], filtres({ prixMax: 1 }))).toBe('prix');
  });

  it('ne bloque pas sur le prix une recette dont le prix n\'est pas chiffrable', () => {
    // prixParPortion renvoie null sans ingrédient chiffrable → on ne devine pas
    expect(raisonExclusion(meal({ id: 1 }), [], [], filtres({ prixMax: 0.01 }))).toBeNull();
  });

  it('laisse passer une recette sans aucune contrainte', () => {
    expect(raisonExclusion(poulet, [10], [], filtres())).toBeNull();
  });
});

describe('calculateMealScore × compromis familial', () => {
  const base = {
    meal: meal(), profile: profile(), joursDepuisDerniere: 40,
    nbLikes: 0, nbDislikes: 0, nbApparitions: 1, saisonActuelle: 'toutes',
  };

  it('sans facteur fourni, le score est inchangé', () => {
    expect(calculateMealScore(base)).toBe(calculateMealScore({ ...base, facteurCompromis: 1 }));
  });

  it('le facteur multiplie le score', () => {
    expect(calculateMealScore({ ...base, facteurCompromis: 0.5 }))
      .toBeCloseTo(calculateMealScore(base) * 0.5, 10);
  });
});

// ─── Pastilles du dashboard ─────────────────────────────────────────────────

describe('humeurMembre — la couleur de la pastille', () => {
  it('salue un membre content', () => {
    expect(humeurMembre(1.25)).toBe('aime');
    expect(humeurMembre(1.05)).toBe('aime');
  });

  it('reste neutre sans avis', () => {
    expect(humeurMembre(1)).toBe('neutre');
    expect(humeurMembre(0.9)).toBe('neutre');
  });

  it('signale un membre mécontent', () => {
    // 0.8 = un seul aliment « je n'aime pas »
    expect(humeurMembre(0.8)).toBe('peu');
    expect(humeurMembre(0.3)).toBe('peu');
  });
});

describe('raisonMembre — l\'infobulle dit le vrai motif', () => {
  const noms = new Map([[7, 'Champignons'], [9, 'Carottes']]);

  it('cite la note du membre', () => {
    const m = famille([avecNote(5)]).membres[0];
    expect(raisonMembre(m, 1, [], noms)).toBe('Léa l\'adore (5/5)');
  });

  it('cite le refus explicite', () => {
    const m = famille([avecNote(1, true)]).membres[0];
    expect(raisonMembre(m, 1, [], noms)).toBe('Léa ne veut plus de cette recette');
  });

  it('nomme l\'aliment qui déplaît', () => {
    const m = famille([membre({ aliments: [{ ingredient_id: 7, relation: 'n_aime_pas' }] })]).membres[0];
    expect(raisonMembre(m, 1, [7], noms)).toBe('Léa n\'aime pas Champignons');
  });

  it('cite l\'aliment aimé quand tout va bien', () => {
    const m = famille([membre({ aliments: [{ ingredient_id: 9, relation: 'aime' }] })]).membres[0];
    expect(raisonMembre(m, 1, [9], noms)).toBe('Léa aime Carottes');
  });

  it('reste honnête sans aucune donnée', () => {
    const m = famille([membre()]).membres[0];
    expect(raisonMembre(m, 1, [7], noms)).toBe('Léa : aucun avis enregistré');
  });

  it('se rabat sur l\'identifiant si le nom de l\'ingrédient manque', () => {
    const m = famille([membre({ aliments: [{ ingredient_id: 42, relation: 'n_aime_pas' }] })]).membres[0];
    expect(raisonMembre(m, 1, [42], new Map())).toContain('#42');
  });
});

// ─── Explication « Pourquoi ce repas ? » ────────────────────────────────────

describe('expliquerChoix — le foyer', () => {
  const base = {
    jourIndex: 0,
    repasType: 'diner' as const,
    profile: profile({ temps_max_semaine: 0, temps_max_weekend: 0, budget_hebdo: null }),
    memoire: MEMOIRE_VIDE,
    historique: { joursDepuisDerniere: 40, likes: 0, dislikes: 0, total: 1 },
    frigoIngredientIds: new Set<number>(),
    budgetHebdo: null,
    prixPortion: null,
    saisonActuelle: 'toutes',
  };

  it('cite le membre qui adore la recette', () => {
    const r = expliquerChoix(meal(), { ...base, famille: famille([avecNote(5)]) });
    expect(r.lignes.some(l => l.texte.includes('Léa') && l.texte.includes('5/5'))).toBe(true);
  });

  it('dit honnêtement quel membre n\'aime pas quel aliment', () => {
    const recette = meal({
      ingredients: [{
        ingredient: {
          id: 7, nom: 'Champignons', rayon: 'fruits_legumes', saison: 'toutes',
          prix_unitaire: null, unite_prix: null, poids_unites: null,
        },
        quantite: 200, unite: 'g', est_optionnel: false,
      }],
    });
    const f = famille([
      membre({ id: 1, nom: 'Léa', aliments: [{ ingredient_id: 7, relation: 'n_aime_pas' }] }),
      avecNote(5, false, { id: 2, nom: 'Marc' }),
    ]);
    const r = expliquerChoix(recette, { ...base, famille: f });
    const ligne = r.lignes.find(l => l.emoji === '⚖️');
    expect(ligne).toBeDefined();
    expect(ligne?.texte).toContain('Léa');
    expect(ligne?.texte).toContain('champignons');
  });

  it('ne dit rien du foyer quand la famille est vide', () => {
    const sans = expliquerChoix(meal(), base);
    const avecVide = expliquerChoix(meal(), { ...base, famille: FAMILLE_VIDE });
    expect(avecVide.lignes).toHaveLength(sans.lignes.length);
  });

  it('n\'invente aucune ligne quand un membre n\'a donné aucun avis', () => {
    const r = expliquerChoix(meal(), { ...base, famille: famille([membre()]) });
    expect(r.lignes.some(l => l.texte.includes('Léa'))).toBe(false);
  });

  it('signale une recette qui convient à tous (2 membres et plus)', () => {
    const r = expliquerChoix(meal(), {
      ...base,
      famille: famille([avecNote(5, false, { id: 1 }), avecNote(4, false, { id: 2 })]),
    });
    expect(r.lignes.some(l => l.emoji === '👨‍👩‍👧')).toBe(true);
  });
});

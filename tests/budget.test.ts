import { describe, it, expect } from 'vitest';
import {
  quantiteAchetee,
  quantiteAchatListe,
  prixLigne,
  prixRecette,
  prixParPortion,
  formatPrix,
  facteurBudget,
  prixMoyenPortions,
  calculerEconomies,
  calculerEconomieReference,
  budgetEffectif,
} from '@/lib/budget';
import type { Ingredient, Meal } from '@/types';

const ingredient = (overrides: Partial<Ingredient>): Ingredient => ({
  id: 1,
  nom: 'Test',
  rayon: 'epicerie_salee',
  saison: 'toutes',
  poids_unites: null,
  prix_unitaire: 2,
  unite_prix: 'kg',
  ...overrides,
});

const mealBase = (overrides: Partial<Meal>): Meal => ({
  id: 1,
  titre: 'Test',
  description: null,
  type_repas: 'plat',
  temps_preparation: 20,
  temps_cuisson: 10,
  difficulte: 'facile',
  saison: 'toutes',
  cuisine: null,
  calories_par_portion: 500,
  proteines: 20,
  glucides: 50,
  lipides: 15,
  macros_verifiables: true,
  fibres: 5,
  conservation_jours: 2,
  ustensiles: [],
  instructions: [],
  image_url: null,
  portions_par_defaut: 2,
  created_by: null,
  is_public: true,
  ...overrides,
});

describe('quantiteAchetee', () => {
  it('convertit g → kg', () => {
    expect(quantiteAchetee(500, 'g', 'kg')).toBe(0.5);
  });

  it('convertit ml → L', () => {
    expect(quantiteAchetee(250, 'ml', 'L')).toBe(0.25);
  });

  it('pièces : arrondit au supérieur, min 1', () => {
    expect(quantiteAchetee(3, 'pcs', 'pcs')).toBe(3);
    expect(quantiteAchetee(0.3, 'pcs', 'pcs')).toBe(1);
  });

  it('retourne null si conversion impossible (pcs → kg) SANS poids unitaire', () => {
    expect(quantiteAchetee(2, 'pcs', 'kg')).toBeNull();
    expect(quantiteAchetee(2, 'pcs', 'kg', null)).toBeNull();
    // Un barème qui ne connaît pas cette unité ne vaut pas mieux que rien.
    expect(quantiteAchetee(2, 'pcs', 'kg', { cas: 10 })).toBeNull();
  });

  it('retourne null sans unité de prix', () => {
    expect(quantiteAchetee(100, 'g', null)).toBeNull();
  });

  // ── Ce que les poids unitaires débloquent ──
  // 381 liens du catalogue étaient non chiffrables pour cette seule raison.
  it('convertit pcs → kg avec le poids de la pièce', () => {
    // 4 oranges à 2,50 €/kg : 0,72 kg, pas « non chiffrable »
    expect(quantiteAchetee(4, 'pcs', 'kg', { pcs: 180 })).toBeCloseTo(0.72, 10);
  });

  it('convertit pcs → L (1 L ≈ 1 kg)', () => {
    expect(quantiteAchetee(1, 'pcs', 'L', { pcs: 400 })).toBeCloseTo(0.4, 10);
  });

  it('convertit une cuillère en poids', () => {
    expect(quantiteAchetee(2, 'cas', 'kg', { cas: 13 })).toBeCloseTo(0.026, 10);
  });

  it('convertit une masse en pièces quand c’est vendu à la pièce', () => {
    // 60 g de pain vendu à la tranche (30 g) → 2 tranches
    expect(quantiteAchetee(60, 'g', 'tranche', { tranche: 30 })).toBe(2);
    expect(quantiteAchetee(45, 'g', 'tranche', { tranche: 30 })).toBe(2);
  });

  it('n’invente pas une pièce sans poids de l’unité vendue', () => {
    expect(quantiteAchetee(60, 'g', 'tranche', { pcs: 180 })).toBeNull();
  });
});

describe('quantiteAchatListe', () => {
  it('agrège au kg avec arrondi 0.1', () => {
    expect(quantiteAchatListe(1730, 'g', 'kg')).toBe(1.8);
  });

  it('tranches → pcs (paquet de 2)', () => {
    expect(quantiteAchatListe(6, 'tranche', 'pcs')).toBe(3);
  });
});

describe('prixLigne / prixRecette / prixParPortion', () => {
  it('calcule le prix d\u2019une ligne', () => {
    const p = prixLigne({
      quantite: 500,
      unite: 'g',
      ingredient: ingredient({ prix_unitaire: 4, unite_prix: 'kg' }),
    });
    expect(p).toBe(2); // 4 €/kg × 0.5 kg
  });

  it('utilise la surcharge utilisateur si présente', () => {
    const overrides = new Map([[1, 6]]);
    const p = prixLigne(
      { quantite: 500, unite: 'g', ingredient: ingredient({ id: 1, prix_unitaire: 4, unite_prix: 'kg' }) },
      overrides
    );
    expect(p).toBe(3); // 6 €/kg × 0.5
  });

  it('prixRecette ignore les ingrédients optionnels et non chiffrables', () => {
    const meal = mealBase({
      portions_par_defaut: 2,
      ingredients: [
        { ingredient: ingredient({ id: 1, prix_unitaire: 4, unite_prix: 'kg' }), quantite: 500, unite: 'g', est_optionnel: false },
        { ingredient: ingredient({ id: 2, nom: 'Sel', prix_unitaire: null, unite_prix: null }), quantite: 1, unite: 'pincee', est_optionnel: false },
        { ingredient: ingredient({ id: 3, nom: 'Persil', prix_unitaire: 3, unite_prix: 'botte' }), quantite: 1, unite: 'botte', est_optionnel: true },
      ],
    } as Partial<Meal>);
    const { total, chiffres, nonChiffrables } = prixRecette(meal);
    expect(total).toBe(2);
    expect(chiffres).toBe(1);
    expect(nonChiffrables).toBe(1);
  });

  it('prixParPortion divise par les portions', () => {
    const meal = mealBase({
      portions_par_defaut: 4,
      ingredients: [
        { ingredient: ingredient({ prix_unitaire: 8, unite_prix: 'kg' }), quantite: 1000, unite: 'g', est_optionnel: false },
      ],
    } as Partial<Meal>);
    expect(prixParPortion(meal)).toBe(2);
  });

  it('prixParPortion null si rien n\u2019est chiffrable', () => {
    const meal = mealBase({ ingredients: [] } as Partial<Meal>);
    expect(prixParPortion(meal)).toBeNull();
  });
});

describe('facteurBudget', () => {
  const budget = 50;
  const nbPersonnes = 2;

  it('neutre sans budget', () => {
    expect(facteurBudget(5, null, nbPersonnes, 3)).toBe(1);
  });

  it('neutre si recette ≤ 1.3× le budget par repas', () => {
    // budget/repas = 50 / (14 × 2) = 1.79 € ; seuil 1.3 → 2.32 €
    expect(facteurBudget(2.2, budget, nbPersonnes, 3)).toBe(1);
  });

  it('pénalise progressivement au-dessus du seuil (plancher 0.5)', () => {
    const f = facteurBudget(4, budget, nbPersonnes, 3);
    expect(f).toBeLessThan(1);
    expect(f).toBeGreaterThanOrEqual(0.5);
    // Très cher → plancher
    expect(facteurBudget(20, budget, nbPersonnes, 3)).toBe(0.5);
  });

  it('neutre si prix non chiffrable', () => {
    expect(facteurBudget(null, budget, nbPersonnes, 3)).toBe(1);
  });
});

describe('prixMoyenPortions', () => {
  it('moyenne les prix non nuls', () => {
    const meals = [
      { meal: mealBase({ id: 1, portions_par_defaut: 2, ingredients: [{ ingredient: ingredient({ prix_unitaire: 4, unite_prix: 'kg' }), quantite: 1000, unite: 'g', est_optionnel: false }] } as Partial<Meal>) },
      { meal: mealBase({ id: 2, portions_par_defaut: 1, ingredients: [] } as Partial<Meal>) }, // non chiffrable → ignoré
    ];
    expect(prixMoyenPortions(meals)).toBe(2);
  });

  it('0 si aucun prix', () => {
    expect(prixMoyenPortions([{ meal: mealBase({} as Partial<Meal>) }])).toBe(0);
  });
});

describe('calculerEconomies', () => {
  it('calcule économie et pourcentage', () => {
    const r = calculerEconomies(50, 42.3);
    expect(r.economie).toBe(7.7);
    expect(r.depassement).toBe(false);
    expect(r.pourcentage).toBe(85);
  });

  it('détecte le dépassement', () => {
    const r = calculerEconomies(30, 35.5);
    expect(r.economie).toBe(-5.5);
    expect(r.depassement).toBe(true);
  });

  it('gère budget non défini', () => {
    const r = calculerEconomies(null, 20);
    expect(r.economie).toBe(0);
    expect(r.pourcentage).toBe(0);
  });
});

describe('calculerEconomieReference', () => {
  it('calcule l\'économie vs la base déclarée', () => {
    const r = calculerEconomieReference(80, 62.4);
    expect(r).not.toBeNull();
    expect(r!.economie).toBe(17.6);
    expect(r!.depassement).toBe(false);
    expect(r!.pourcentage).toBe(22);
  });

  it('détecte le dépassement de la base', () => {
    const r = calculerEconomieReference(50, 58.2);
    expect(r!.economie).toBe(-8.2);
    expect(r!.depassement).toBe(true);
  });

  it('retourne null si la base n\'est pas saisie (widget masqué, jamais devinée)', () => {
    expect(calculerEconomieReference(null, 40)).toBeNull();
    expect(calculerEconomieReference(undefined, 40)).toBeNull();
    expect(calculerEconomieReference(0, 40)).toBeNull();
  });
});

describe('formatPrix', () => {
  it('formate en euros (fr-FR)', () => {
    expect(formatPrix(2.5)).toContain('2,50');
    expect(formatPrix(2.5)).toContain('€');
  });

  it('tiret si null', () => {
    expect(formatPrix(null)).toBe('—');
    expect(formatPrix(undefined)).toBe('—');
  });
});

describe('budgetEffectif', () => {
  it('garde le budget fixé par l utilisateur et son mode', () => {
    expect(budgetEffectif(50, 2, true)).toEqual({ montant: 50, strict: true, implicite: false });
    expect(budgetEffectif(50, 2, false).strict).toBe(false);
  });

  it('sans budget : budget par défaut selon le foyer, toujours souple', () => {
    expect(budgetEffectif(null, 2, true)).toEqual({ montant: 80, strict: false, implicite: true });
    expect(budgetEffectif(0, 4, null).montant).toBe(160);
    expect(budgetEffectif(undefined, undefined, null).montant).toBe(80);
  });
});

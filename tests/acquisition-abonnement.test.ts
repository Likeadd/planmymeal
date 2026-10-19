import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { ingredientTexte, quantiteLisible } from '../src/lib/quantites';
import { etatDepuisStripe } from '../src/lib/abonnement';

// ============================================================================
// Quantités lisibles (fiche + schema.org), source d'acquisition (?ref=) et état
// d'abonnement (résiliation / délai de rétractation de 14 jours).
// ============================================================================

describe('quantiteLisible / ingredientTexte', () => {
  it('écrit les unités en français', () => {
    expect(quantiteLisible(2, 'pcs')).toBe('2 pièces');
    expect(quantiteLisible(1, 'cac')).toBe('1 c. à café');
    expect(quantiteLisible(1.5, 'cas')).toBe('1,5 c. à soupe');
  });

  it('compte l’ail en gousses', () => {
    expect(quantiteLisible(1, 'pcs', 'Ail')).toBe('1 gousse');
    expect(quantiteLisible(3, 'pcs', 'Ail')).toBe('3 gousses');
    expect(ingredientTexte(2, 'pcs', 'Ail')).toBe('2 gousses d’ail');
  });

  it('forme des lignes d’ingrédient naturelles (élision, pluriel)', () => {
    expect(ingredientTexte(120, 'g', 'Yaourt grec')).toBe('120 g de yaourt grec');
    expect(ingredientTexte(10, 'ml', 'Huile d’olive')).toBe('10 ml d’huile d’olive');
    expect(ingredientTexte(250, 'g', 'Haricots verts')).toBe('250 g de haricots verts');
    expect(ingredientTexte(2, 'g', 'Épinards frais')).toBe('2 g d’épinards frais');
    expect(ingredientTexte(3, 'pcs', 'Tomate')).toBe('3 tomates');
    expect(ingredientTexte(1, 'pcs', 'Oignon')).toBe('1 oignon');
  });
});

describe('etatDepuisStripe', () => {
  const JOUR = 86_400;
  const abonnement = (o: Partial<{ status: string; debut: number; annuel: boolean; resilie: boolean }>) => ({
    status: o.status ?? 'active',
    start_date: o.debut ?? 0,
    cancel_at_period_end: o.resilie ?? false,
    items: { data: [{ current_period_end: (o.debut ?? 0) + 30 * JOUR, price: { recurring: { interval: o.annuel ? 'year' : 'month' } } }] },
  }) as unknown as Stripe.Subscription;

  it('autorise la rétractation pendant 14 jours', () => {
    const debut = 1_000_000;
    const dansLeDelai = etatDepuisStripe(abonnement({ debut }), (debut + 13 * JOUR) * 1000);
    expect(dansLeDelai.actif).toBe(true);
    expect(dansLeDelai.retractationJusquau).not.toBeNull();
    expect(etatDepuisStripe(abonnement({ debut }), (debut + 15 * JOUR) * 1000).retractationJusquau).toBeNull();
  });

  it('lit la périodicité et la résiliation programmée', () => {
    expect(etatDepuisStripe(abonnement({ annuel: true })).periode).toBe('annuel');
    expect(etatDepuisStripe(abonnement({})).periode).toBe('mensuel');
    expect(etatDepuisStripe(abonnement({ resilie: true })).resiliationProgrammee).toBe(true);
  });

  it('un abonnement terminé n’est plus actif', () => {
    expect(etatDepuisStripe(abonnement({ status: 'canceled' })).actif).toBe(false);
  });
});

// ─── Liste de courses partageable ───────────────────────────────────────────
import { quantiteCourses, listeEnTexte, rangMagasin } from '../src/lib/liste-courses';

describe('liste de courses partageable', () => {
  it('convertit en kg / L et arrondit les unités entières', () => {
    expect(quantiteCourses(1200, 'g')).toBe('1,2 kg');
    expect(quantiteCourses(450, 'g')).toBe('450 g');
    expect(quantiteCourses(1500, 'ml')).toBe('1,5 L');
    expect(quantiteCourses(19.5, 'pcs', 'Œuf')).toBe('20 pièces');
    expect(quantiteCourses(0.5, 'pcs', 'Citron')).toBe('1 pièce');
    expect(quantiteCourses(4.5, 'pcs', 'Ail')).toBe('5 gousses');
  });

  it('range les rayons dans l’ordre du magasin (frais d’abord, boissons à la fin)', () => {
    expect(rangMagasin('fruits_legumes')).toBeLessThan(rangMagasin('epicerie_salee'));
    expect(rangMagasin('epicerie_salee')).toBeLessThan(rangMagasin('boissons'));
    expect(rangMagasin('inconnu')).toBeGreaterThan(rangMagasin('boissons'));
  });

  it('produit un texte prêt à coller', () => {
    const texte = listeEnTexte('Liste de courses', [
      { label: '🥬 Fruits & Légumes', items: [{ nom: 'Carotte', quantite: '500 g' }] },
      { label: '🧀 Frais', items: [] },
    ], 'https://exemple.fr/liste/abc');
    expect(texte).toContain('🛒 Liste de courses');
    expect(texte).toContain('☐ Carotte — 500 g');
    expect(texte).not.toContain('🧀 Frais');
    expect(texte).toContain('https://exemple.fr/liste/abc');
  });
});

import { montantRemboursement } from '../src/lib/abonnement';

describe('montantRemboursement (VULN-003)', () => {
  const debut = 1_000_000, fin = debut + 30 * 86_400; // période de 30 jours
  it('première rétractation : 100 %, même après usage', () => {
    expect(montantRemboursement(599, debut, fin, (debut + 13 * 86_400) * 1000, false)).toBe(599);
  });
  it('rétractation suivante : au prorata de la période non utilisée', () => {
    expect(montantRemboursement(600, debut, fin, (debut + 10 * 86_400) * 1000, true)).toBe(400);
    expect(montantRemboursement(600, debut, fin, (fin + 1) * 1000, true)).toBe(0);
    expect(montantRemboursement(600, debut, fin, (debut - 50) * 1000, true)).toBe(600);
  });
});

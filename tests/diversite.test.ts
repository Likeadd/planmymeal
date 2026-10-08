import { describe, it, expect } from 'vitest';
import { profilPlat, penaliteDiversite, facteurDiversite, rythmeBudget, RYTHME_STANDARD } from '@/lib/diversite';
import type { RecetteMoteur } from '@/types';

let n = 0;
const plat = (titre: string, ingredients: string[] = [], temps = 30): RecetteMoteur => ({
  id: ++n, titre, temps_preparation: temps, temps_cuisson: 0,
  ingredients: ingredients.map(nom => ({ quantite: 100, unite: 'g', est_optionnel: false, ingredient: { id: 1, nom } })),
} as unknown as RecetteMoteur);

describe('profilPlat', () => {
  it('classe par protéine et féculent d\'après le titre', () => {
    expect(profilPlat(plat('Pâtes spaghetti au saumon fumé'))).toEqual({ proteine: 'poisson', feculent: 'pates' });
    expect(profilPlat(plat('Wrap de dinde, crudités'))).toEqual({ proteine: 'dinde', feculent: 'wrap' });
    expect(profilPlat(plat('Haché de dinde et riz'))).toEqual({ proteine: 'dinde', feculent: 'riz' });
    expect(profilPlat(plat('Omelette aux herbes')).proteine).toBe('oeuf');
    expect(profilPlat(plat('Poêlée de pois chiches et semoule')).proteine).toBe('vegetal');
  });

  it('se rabat sur les ingrédients quand le titre ne dit rien', () => {
    expect(profilPlat(plat('Poêlée du chef', ['Pavé de saumon', 'Courgette'])).proteine).toBe('poisson');
    expect(profilPlat(plat('Gratin du chef', ['Boeuf haché', 'Pommes de terre'])).proteine).toBe('boeuf');
  });
});

describe('penaliteDiversite', () => {
  const semaineVariee = [
    plat('Poulet rôti et riz'), plat('Saumon, légumes'), plat('Bœuf sauté, nouilles'), plat('Omelette, salade'),
    plat('Dinde, purée'), plat('Cabillaud, quinoa'), plat('Tofu sauté'), plat('Steak, haricots verts'),
    plat('Salade de pois chiches'), plat('Frittata'), plat('Poulet au curry'), plat('Lentilles'), plat('Porc, lentilles'), plat('Crevettes, riz'),
  ];

  it('une semaine variée n\'a aucune pénalité', () => {
    // temps variés : 5 plats rapides, 4 moyens, 5 élaborés
    const avecTemps = semaineVariee.map((m, i) => ({ ...m, temps_preparation: i < 5 ? 15 : i < 9 ? 30 : 60 }));
    expect(penaliteDiversite(avecTemps)).toBe(0);
  });

  it('4 plats de pâtes et aucun poisson sont pénalisés', () => {
    const pates = [plat('Pâtes au poulet'), plat('Spaghetti bolognaise'), plat('Penne aux légumes'), plat('Tagliatelles au pesto')];
    const sem = [...pates, ...semaineVariee.slice(4).filter(m => profilPlat(m).proteine !== 'poisson')].slice(0, 14);
    expect(penaliteDiversite(sem)).toBeGreaterThan(0);
  });

  it('ne juge pas une liste trop courte', () => {
    expect(penaliteDiversite([plat('Pâtes'), plat('Pâtes bis')])).toBe(0);
  });
});

describe('facteurDiversite', () => {
  it('décourage un groupe déjà servi et favorise un groupe absent', () => {
    const deja = [plat('Pâtes au poulet'), plat('Poulet rôti'), plat('Spaghetti au poulet')];
    expect(facteurDiversite(plat('Poulet curry'), deja)).toBeLessThan(0.3);
    expect(facteurDiversite(plat('Saumon, riz'), deja)).toBeGreaterThan(1);
  });
});

describe('rythme simple / élaboré', () => {
  const noms = ['Poulet rôti', 'Saumon grillé', 'Bœuf sauté', 'Omelette', 'Dinde crème', 'Cabillaud', 'Tofu sauté', 'Steak', 'Crevettes', 'Frittata', 'Poulet curry', 'Lentilles', 'Porc caramel', 'Quinoa bowl'];

  it('une semaine 100 % express est pénalisée, un mélange simple et élaboré ne l est pas', () => {
    const express = noms.map(t => plat(t, [], 15));
    const mixte = noms.map((t, i) => plat(t, [], i < 5 ? 15 : i < 9 ? 30 : 60));
    expect(penaliteDiversite(express)).toBeGreaterThan(penaliteDiversite(mixte));
    expect(penaliteDiversite(mixte)).toBe(0);
  });
});

describe('rythmeBudget', () => {
  it('budget serré : surtout simple ; confortable : plus d élaboré', () => {
    const serre = rythmeBudget(50, 2);      // 25 € par personne
    const standard = rythmeBudget(80, 2);   // 40 € par personne
    const confort = rythmeBudget(140, 2);   // 70 € par personne
    expect(serre.simples).toBeGreaterThan(standard.simples);
    expect(serre.elabores).toBeLessThan(standard.elabores);
    expect(confort.elabores).toBeGreaterThan(standard.elabores);
    expect(standard).toEqual(RYTHME_STANDARD);
  });

  it('la même semaine est jugée selon le rythme du budget', () => {
    const noms = ['Poulet rôti', 'Saumon grillé', 'Bœuf sauté', 'Omelette', 'Dinde crème', 'Cabillaud', 'Tofu sauté', 'Steak', 'Crevettes', 'Frittata', 'Poulet curry', 'Lentilles', 'Porc caramel', 'Quinoa bowl'];
    const surtoutRapide = noms.map((t, i) => plat(t, [], i < 11 ? 15 : 30));
    expect(penaliteDiversite(surtoutRapide, rythmeBudget(50, 2))).toBeLessThan(penaliteDiversite(surtoutRapide, rythmeBudget(140, 2)));
  });
});

import { describe, it, expect } from 'vitest';
import {
  nettoyerTitre, nettoyerEtape, nettoyerInstructions, deduireSaison, recategoriserCuisine, genererDescription,
} from '@/lib/nettoyage-recettes';

describe('nettoyerTitre', () => {
  it('accorde « au » au pluriel, au féminin et devant voyelle', () => {
    expect(nettoyerTitre('Pâtes penne au crevettes, pesto maison')).toBe('Pâtes penne aux crevettes, pesto maison');
    expect(nettoyerTitre('Pâtes penne au pois chiches rôtis')).toBe('Pâtes penne aux pois chiches rôtis');
    expect(nettoyerTitre('quinoa salade tiède au citron au feta')).toBe('Quinoa salade tiède au citron à la feta');
    expect(nettoyerTitre('Tartine au avocat')).toBe('Tartine à l’avocat');
    expect(nettoyerTitre('Poulet au jus')).toBe('Poulet au jus');
    expect(nettoyerTitre('Riz au lait')).toBe('Riz au lait');
  });
  it('élide « de » devant voyelle sans toucher aux mots étrangers', () => {
    expect(nettoyerTitre('Tajine de agneau pruneaux')).toBe('Tajine d’agneau pruneaux');
    expect(nettoyerTitre('Bolinho de arroz, farofa légère')).toBe('Bolinho de arroz, farofa légère');
    expect(nettoyerTitre('Soupe de haricots')).toBe('Soupe de haricots');
  });
  it('corrige les tournures générées (accords, soupes, rôtis, bibimbap)', () => {
    expect(nettoyerTitre('Crêpes à la sucre & citron')).toBe('Crêpes au sucre & citron');
    expect(nettoyerTitre('Mousse à la chocolat noir')).toBe('Mousse au chocolat noir');
    expect(nettoyerTitre('Crêpes à la fruits rouges & miel')).toBe('Crêpes aux fruits rouges & miel');
    expect(nettoyerTitre('Soupe de carottes potage rustique')).toBe('Potage rustique de carottes');
    expect(nettoyerTitre('Soupe froide de tomates soupe froide d’été')).toBe('Soupe froide de tomates');
    expect(nettoyerTitre('Aubergine rôtis au four, tempeh, sumac-oignon')).toBe('Aubergines rôties au four, tempeh, sumac-oignon');
    expect(nettoyerTitre('Bibimbap œufs (bibimbap), kimchi poêlé')).toBe('Bibimbap aux œufs, kimchi poêlé');
    expect(nettoyerTitre('Dhal de pois chiches (bte) curry Madras doux')).toBe('Dhal de pois chiches curry Madras doux');
  });
  it('retire les mots répétés, met la majuscule, reformule les « & » en série', () => {
    expect(nettoyerTitre('Cake cake à la banane & noix')).toBe('Cake à la banane & noix');
    expect(nettoyerTitre('riz basmati sauté')).toBe('Riz basmati sauté');
    expect(nettoyerTitre('Filets de poulet rôti herbes & citron & carottes & pommes de terre'))
      .toBe('Filets de poulet rôti herbes & citron, carottes et pommes de terre');
  });
});

describe('nettoyerEtape / nettoyerInstructions', () => {
  it('n’épluche plus le basilic et n’égoutte plus la tomate concassée', () => {
    expect(nettoyerEtape('Préparation — Lavez puis épluchez ail et basilic et réservez-les coupés dans un saladier.'))
      .toBe('Préparation — Épluchez ail ; rincez et ciselez basilic, puis réservez dans un saladier.');
    expect(nettoyerEtape('Ouvrez et égouttez tomate concassée (bte) dans une passoire.')).toBe('');
  });
  it('corrige « jour(s) » et le pesto cuit', () => {
    expect(nettoyerEtape('Astuce — Se garde 2 jour(s) au réfrigérateur.')).toBe('Astuce — Se garde 2 jours au réfrigérateur.');
    expect(nettoyerEtape('Faites chauffer 2 cas d’huile d’olive dans une grande poêle, ajoutez les éléments de la sauce (pesto maison) et laissez mijoter 8-10 min.'))
      .toMatch(/^Préparez le pesto/);
  });
  it('remet l’ordre des étapes du modèle pâtes', () => {
    const r = nettoyerInstructions([
      'Portez un grand volume d’eau salée à ébullition.',
      'Décortiquez les crevettes. Ajoutez-les 3 min en fin de cuisson de la sauce.',
      'Émincez l’ail (et les oignons/légumes de la sauce) finement.',
      'Faites chauffer 2 cas d’huile d’olive dans une grande poêle, ajoutez les éléments de la sauce (crème & champignons) et laissez mijoter.',
      'Cuisez les penne.',
    ]);
    expect(r[1]).toMatch(/^Émincez/);
    expect(r[2]).toMatch(/^Faites chauffer/);
    expect(r[3]).toMatch(/^Décortiquez/);
  });
});

describe('saison, cuisine, description', () => {
  it('déduit une saison seulement si le signal est clair', () => {
    expect(deduireSaison('Velouté de potimarron', ['Potimarron', 'Oignon'])).toBe('automne');
    expect(deduireSaison('Ratatouille', ['Courgette', 'Aubergine', 'Poivron'])).toBe('ete');
    expect(deduireSaison('Pâtes à la tomate', ['Tomate concassée (bte)'])).toBe('toutes');
  });
  it('recatégorise le fourre-tout « World healthy »', () => {
    expect(recategoriserCuisine('Bowl quinoa au poulet')).toBe('Bowls');
    expect(recategoriserCuisine('Salade de lentilles')).toBe('Salades composées');
  });
  it('génère une description factuelle', () => {
    expect(genererDescription({ titre: 'x', type_repas: 'plat', cuisine: 'Italienne', temps: 30, kcal: 572, ingredients: ['Sel', 'Penne', 'Crevettes', 'Basilic'] }))
      .toBe('Un plat d’inspiration italienne à base de penne, crevettes et basilic, prêt en 30 min, environ 572 kcal par portion.');
  });
});

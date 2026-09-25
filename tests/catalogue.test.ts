import { describe, it, expect } from 'vitest';
import { echantillonAleatoire } from '@/lib/catalogue';

// ============================================================================
// Tirage des suggestions de remplacement
//
// Régression : `.limit(30)` sans `order` renvoyait toujours les 30 mêmes
// recettes, donc 1108 recettes du catalogue ne pouvaient JAMAIS être proposées.
//
// Le générateur est injecté (mulberry32 à graine fixe) : les assertions sur
// l'uniformité ne dépendent donc pas du hasard de l'exécution. Un test qui
// « passe presque toujours » ne protège de rien.
// ============================================================================

function mulberry32(graine: number) {
  return function () {
    graine |= 0;
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('echantillonAleatoire — mécanique du tirage', () => {
  it('tire exactement n éléments', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(echantillonAleatoire(ids, 3)).toHaveLength(3);
  });

  it('ne propose jamais deux fois la même recette', () => {
    const ids = Array.from({ length: 500 }, (_, i) => i + 1);
    const tirage = echantillonAleatoire(ids, 30, mulberry32(1));
    expect(new Set(tirage).size).toBe(30);
  });

  it('rend tous les éléments quand n dépasse le vivier', () => {
    const ids = [10, 20, 30];
    const tirage = echantillonAleatoire(ids, 10, mulberry32(2));
    expect(tirage).toHaveLength(3);
    expect([...tirage].sort((a, b) => a - b)).toEqual(ids);
  });

  it('rend un tableau vide pour n = 0 ou un vivier vide', () => {
    expect(echantillonAleatoire([1, 2, 3], 0)).toEqual([]);
    expect(echantillonAleatoire([], 5)).toEqual([]);
  });

  it('ne modifie pas le tableau source', () => {
    const ids = [5, 4, 3, 2, 1];
    echantillonAleatoire(ids, 3, mulberry32(3));
    expect(ids).toEqual([5, 4, 3, 2, 1]);
  });

  it('accepte un n négatif sans planter', () => {
    expect(echantillonAleatoire([1, 2, 3], -5)).toEqual([]);
  });
});

describe('echantillonAleatoire — uniformité', () => {
  it("n'avantage pas les premières recettes du catalogue", () => {
    // Le bug d'origine : seules les 30 premières recettes sortaient, les 70
    // suivantes avaient une fréquence exactement nulle.
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    const rng = mulberry32(42);
    const comptes = new Map<number, number>();
    const TIRAGES = 20_000;

    for (let i = 0; i < TIRAGES; i++) {
      const [id] = echantillonAleatoire(ids, 1, rng);
      comptes.set(id, (comptes.get(id) ?? 0) + 1);
    }

    const attendu = TIRAGES / ids.length;
    expect(comptes.size).toBe(ids.length);

    // Aucune recette oubliée : le bug d'origine laissait 70 des 100 compteurs à 0.
    const oubliees = ids.filter(id => (comptes.get(id) ?? 0) === 0);
    expect(oubliees).toEqual([]);

    // Tolérance statistique : σ = √(20000 × 0,01 × 0,99) ≈ 14,1, soit 7 % de
    // l'espérance (200). Un écart de 35 % vaut donc ≈ 5 σ — au-delà du hasard,
    // et très loin du 100 % produit par un ordre figé.
    for (const id of ids) {
      const ecart = Math.abs((comptes.get(id) ?? 0) - attendu) / attendu;
      expect(ecart, `recette ${id} tirée ${comptes.get(id)} fois`).toBeLessThan(0.35);
    }
  });

  it('donne la même chance à la première et à la dernière recette', () => {
    const ids = Array.from({ length: 50 }, (_, i) => i + 1);
    const rng = mulberry32(7);
    let premiere = 0;
    let derniere = 0;
    const TIRAGES = 20_000;

    for (let i = 0; i < TIRAGES; i++) {
      const [id] = echantillonAleatoire(ids, 1, rng);
      if (id === 1) premiere++;
      if (id === 50) derniere++;
    }

    const rapport = Math.max(premiere, derniere) / Math.max(1, Math.min(premiere, derniere));
    expect(rapport).toBeLessThan(1.25);
  });
});

describe('echantillonAleatoire — le catalogue entier est atteignable', () => {
  it('finit par proposer le fond du catalogue, pas seulement la tête', () => {
    // Vivier réel : 1138 recettes publiées, identifiants de 1 à 2958 (non contigus).
    const ids = Array.from({ length: 1138 }, (_, i) => i + 1);
    const rng = mulberry32(2026);
    const vus = new Set<number>();

    // 200 ouvertures de la modale × 30 candidats = 6 000 tirages.
    for (let i = 0; i < 200; i++) {
      for (const id of echantillonAleatoire(ids, 30, rng)) vus.add(id);
    }

    // Sous l'ancien code : au plus 30 recettes distinctes, jamais une de plus.
    expect(vus.size).toBeGreaterThan(1000);
    expect(vus.has(1138), 'la toute dernière recette doit pouvoir sortir').toBe(true);
    expect(vus.has(1000), 'la millième aussi').toBe(true);
  });

  it("atteint le fond dès qu'on exclut la tête du catalogue", () => {
    // Cas réel : les 30 premières recettes sont déjà au planning de la semaine.
    // L'ancien code renvoyait alors une liste vide ; le tirage, lui, continue.
    const ids = Array.from({ length: 1138 }, (_, i) => i + 1);
    const exclus = new Set(ids.slice(0, 30));
    const restants = ids.filter(id => !exclus.has(id));
    const rng = mulberry32(11);
    const vus = new Set<number>();

    for (let i = 0; i < 50; i++) {
      const tirage = echantillonAleatoire(restants, 30, rng);
      expect(tirage).toHaveLength(30);
      for (const id of tirage) vus.add(id);
    }

    // 50 × 30 = 1500 tirages sur 1108 recettes restantes → ≈ 822 distinctes
    // attendues. L'ancien code, lui, ne pouvait en proposer que 30 au total.
    expect(vus.size).toBeGreaterThan(700);
    for (const id of vus) expect(exclus.has(id)).toBe(false);
  });
});

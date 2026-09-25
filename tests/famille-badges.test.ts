// ============================================================================
// Tests — pastilles du foyer sur le dashboard
//
// Le composant est rendu pour de vrai (`react-dom/server`), sans ajouter de
// dépendance de test : FamilleBadges n'importe ni Next ni framer-motion, il se
// contente de JSX et des fonctions pures de lib/famille. Seul le hook de
// chargement est remplacé — c'est le seul point qui parle au réseau.
//
// Ce que ces tests protègent : le dashboard d'un foyer SANS membre doit rester
// strictement celui d'avant (rendu vide), et un membre mécontent doit se voir.
// ============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { Famille } from '@/lib/famille';
import type { Meal, MembreFamilleComplet } from '@/types';

// `vi.hoisted` : l'état est créé avant l'évaluation des imports, sinon la
// fabrique du mock s'exécuterait avant que le module famille ne soit chargé.
const etat = vi.hoisted(() => ({
  famille: { membres: [], poidsFamille: 70 } as unknown,
}));

vi.mock('@/lib/useFamille', () => ({
  useFamille: () => etat.famille,
}));

import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { FamilleLegende } from '@/components/dashboard/FamilleLegende';
import { indexerFamille } from '@/lib/famille';

// ─── Fabriques ──────────────────────────────────────────────────────────────

function membre(over: Partial<MembreFamilleComplet> = {}): MembreFamilleComplet {
  return { id: 1, nom: 'Léa', emoji: '👧', poids: 3, age: null, aliments: [], recettes: [], ...over };
}

function famille(membres: MembreFamilleComplet[]): Famille {
  return indexerFamille(membres, 70);
}

/** Recette avec deux ingrédients : Champignons (7) et Carottes (9) */
function meal(): Meal {
  return {
    id: 1, titre: 'Poulet curry', description: null, type_repas: 'plat',
    temps_preparation: 20, temps_cuisson: 5, difficulte: 'facile', saison: 'toutes',
    cuisine: null, calories_par_portion: null, proteines: null, glucides: null,
    lipides: null, macros_verifiables: true, fibres: null, conservation_jours: null, ustensiles: [],
    instructions: [], image_url: null, portions_par_defaut: 2, created_by: null,
    is_public: true,
    ingredients: [
      {
        ingredient: {
          id: 7, nom: 'Champignons', rayon: 'fruits_legumes', saison: 'toutes',
          prix_estime: null, prix_unitaire: null, unite_prix: null, poids_unites: null,
        },
        quantite: 200, unite: 'g', est_optionnel: false,
      },
      {
        ingredient: {
          id: 9, nom: 'Carottes', rayon: 'fruits_legumes', saison: 'toutes',
          prix_estime: null, prix_unitaire: null, unite_prix: null, poids_unites: null,
        },
        quantite: 3, unite: 'pcs', est_optionnel: false,
      },
    ],
  };
}

function rendre(compacte = false, libelle?: string): string {
  return renderToString(createElement(FamilleBadges, { meal: meal(), compacte, libelle }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('FamilleBadges', () => {
  it('n\'affiche RIEN quand le foyer n\'a pas de membre', () => {
    etat.famille = { membres: [], poidsFamille: 70 };
    // Le dashboard d'un utilisateur seul doit être identique à avant la
    // fonctionnalité : pas de pastille, pas de marge, pas de ⚖️ orphelin.
    expect(rendre()).toBe('');
  });

  it('affiche une pastille contente quand un membre adore la recette', () => {
    etat.famille = famille([membre({ recettes: [{ meal_id: 1, note: 5, ne_plus_proposer: false }] })]);
    const html = rendre();
    expect(html).toContain('data-humeur="aime"');
    expect(html).toContain('👧');
    expect(html).toContain('5/5');
  });

  it('signale un membre mécontent, en nommant l\'aliment en cause', () => {
    etat.famille = famille([membre({ aliments: [{ ingredient_id: 7, relation: 'n_aime_pas' }] })]);
    const html = rendre();
    expect(html).toContain('data-humeur="peu"');
    expect(html).toContain('Champignons');
    expect(html).toContain('sable'); // teinte d'alerte de la charte
  });

  it('reste neutre quand le membre n\'a donné aucun avis', () => {
    etat.famille = famille([membre()]);
    const html = rendre();
    expect(html).toContain('data-humeur="neutre"');
    expect(html).toContain('aucun avis enregistr');
  });

  it('affiche une pastille par membre, avec le libellé du foyer', () => {
    etat.famille = famille([
      membre({ id: 1, nom: 'Léa', emoji: '👧' }),
      membre({ id: 2, nom: 'Marc', emoji: '👨' }),
    ]);
    const html = rendre();
    expect(html.match(/data-humeur=/g)).toHaveLength(2);
    expect(html).toContain('👧');
    expect(html).toContain('👨');
    expect(html).toContain('2 membres');
  });

  it('garde les membres les plus importants si la carte n\'a pas la place', () => {
    const six = [1, 2, 3, 4, 5, 6].map(i => membre({
      id: i, nom: `Membre ${i}`, emoji: ['🅰️', '🅱️', '🅾️', '🆎', '🇦', '🇧'][i - 1],
      poids: i === 6 ? 5 : 1,
    }));
    etat.famille = famille(six);
    const html = rendre();

    // 4 pastilles maximum, les autres sont comptées
    expect(html.match(/data-humeur=/g)).toHaveLength(4);
    expect(html).toContain('+2');
    // La puce desktop, plus étroite, en garde une de moins
    expect(rendre(true).match(/data-humeur=/g)).toHaveLength(3);
    expect(rendre(true)).toContain('+3');
    // Le membre « prioritaire » (poids 5) doit faire partie des visibles,
    // même s'il est le dernier enregistré.
    expect(html).toContain('🇧');
  });

  it('expose le détail en texte pour les lecteurs d\'écran', () => {
    etat.famille = famille([membre({ nom: 'Léa' })]);
    expect(rendre()).toContain('sr-only');
  });

  it('affiche le libellé demandé par la page (catalogue, favoris, recette)', () => {
    etat.famille = famille([membre()]);
    expect(rendre(false, 'Foyer')).toContain('Foyer');
    expect(rendre(false, 'Ce que le foyer en pense')).toContain('Ce que le foyer en pense');
  });

  it('n\'affiche pas non plus le libellé quand le foyer est vide', () => {
    etat.famille = { membres: [], poidsFamille: 70 };
    // Sinon la page recette afficherait « Ce que le foyer en pense » suivi de rien.
    expect(rendre(false, 'Ce que le foyer en pense')).toBe('');
  });
});

// ─── Légende du foyer (dashboard) ───────────────────────────────────────────

function rendreLegende(): string {
  return renderToString(createElement(FamilleLegende, {}));
}

/** Classe de la pastille portant cette humeur, dans un HTML rendu */
function classePastilleHtml(html: string, humeur: string): string | null {
  const balise = html.match(new RegExp(`<span[^>]*data-humeur="${humeur}"[^>]*>`))?.[0];
  return balise?.match(/class="([^"]*)"/)?.[1] ?? null;
}

describe('FamilleLegende', () => {
  it('n\'affiche RIEN tant que le foyer n\'a pas de membre', () => {
    etat.famille = { membres: [], poidsFamille: 70 };
    expect(rendreLegende()).toBe('');
  });

  it('explique les trois teintes et renvoie vers les réglages', () => {
    etat.famille = famille([membre({ id: 1, nom: 'Léa', emoji: '👧' })]);
    const html = rendreLegende();
    expect(html).toContain('Avis du foyer');
    expect(html).toContain('il aime');
    expect(html).toContain('aucun avis');
    expect(html).toContain('il n&#x27;aime pas');
    expect(html).toContain('href="/compte"');
    expect(html).toContain('Régler mes convives');
    // Les trois teintes documentées doivent être présentes
    for (const humeur of ['aime', 'neutre', 'peu']) {
      expect(html).toContain(`data-humeur="${humeur}"`);
    }
  });

  it('montre les convives pris en compte, plafonnés à quatre', () => {
    const cinq = [1, 2, 3, 4, 5].map(i => membre({ id: i, nom: `M${i}`, emoji: ['🅰️', '🅱️', '🅾️', '🆎', '🇦'][i - 1], poids: i }));
    etat.famille = famille(cinq);
    const html = rendreLegende();
    expect(html).toContain('5 membres');
    expect(html).toContain('+1');
    expect(html).toContain('🇦'); // le membre au poids le plus élevé reste visible
  });

  it('utilise EXACTEMENT les teintes des pastilles de carte', () => {
    // Anti-divergence : si quelqu'un change une couleur d'un côté seulement,
    // la légende se mettrait à mentir sur ce que veulent dire les cartes.
    etat.famille = famille([membre({ recettes: [{ meal_id: 1, note: 5, ne_plus_proposer: false }] })]);
    const carte = classePastilleHtml(rendre(true), 'aime');
    const legende = classePastilleHtml(rendreLegende(), 'aime');
    expect(carte).not.toBeNull();
    expect(legende).toBe(carte);
  });
});

import { describe, expect, it } from 'vitest';
import { weeklyDigestEmailHtml, weeklyDigestSubject, welcomeEmailHtml } from '../src/lib/email-templates';

// ============================================================================
// Templates email — l'aperçu « Au menu cette semaine » applique la même casse
// que l'app (titreMajuscules) ; welcome inchangé ; sujets sans titre de plat.
// ============================================================================

const BASE = 'https://planmymeal.app';

describe('weeklyDigestEmailHtml — aperçu Au menu', () => {
  it('liste les plats avec majuscules à chaque mot significatif', () => {
    const html = weeklyDigestEmailHtml(
      { prenom: 'Camille', nbRepas: 12, semaineLabel: 'du 21 au 27 septembre', economie: null, economieReference: null, plats: ['curry de poulet au coco', 'salade de tomates'] },
      BASE
    );
    expect(html).toContain('Au menu cette semaine');
    expect(html).toContain('Curry de Poulet au Coco');
    expect(html).toContain('Salade de Tomates');
    expect(html).not.toContain('curry de poulet au coco'); // plus de titre brut
  });

  it('tronque à 5 plats avec le compteur « autres »', () => {
    const plats = ['plat un', 'plat deux', 'plat trois', 'plat quatre', 'plat cinq', 'plat six', 'plat sept'];
    const html = weeklyDigestEmailHtml(
      { prenom: '', nbRepas: 14, semaineLabel: 'x', economie: null, economieReference: null, plats },
      BASE
    );
    expect(html).toContain('Plat Un');
    expect((html.match(/<li /g) || []).length).toBe(5);
    expect(html).toContain('… et 2 autres plats');
  });

  it('n\u2019affiche aucune section si la liste est vide (rétro-compat)', () => {
    const html = weeklyDigestEmailHtml(
      { prenom: '', nbRepas: 0, semaineLabel: 'x', economie: null, economieReference: null },
      BASE
    );
    expect(html).not.toContain('Au menu cette semaine');
    expect(html).toContain('Ta semaine est prête');
  });

  it('ajoute un lien direct vers la liste de courses quand semaineDebut est fourni', () => {
    const html = weeklyDigestEmailHtml(
      { prenom: '', nbRepas: 14, semaineLabel: 'x', economie: null, economieReference: null, semaineDebut: '2026-10-05' },
      BASE
    );
    expect(html).toContain('/dashboard?semaine=2026-10-05&tab=courses');
    expect(html).toContain('Liste de courses');
  });

  it('n’ajoute pas de lien liste de courses sans semaineDebut (rétro-compat)', () => {
    const html = weeklyDigestEmailHtml(
      { prenom: '', nbRepas: 14, semaineLabel: 'x', economie: null, economieReference: null },
      BASE
    );
    expect(html).not.toContain('tab=courses');
  });

  it('échappe les titres contenant du HTML', () => {
    const html = weeklyDigestEmailHtml(
      { prenom: '', nbRepas: 1, semaineLabel: 'x', economie: null, economieReference: null, plats: ['<b>attention</b> & fils'] },
      BASE
    );
    // HTML échappé (jamais interprété) + casse appliquée aux mots textuels
    expect(html).toContain('&lt;b&gt;attention&lt;/b&gt; &amp; Fils');
    expect(html).not.toContain('<b>');
  });
});

describe('welcomeEmailHtml', () => {
  it('ne contient aucun titre de recette', () => {
    const html = welcomeEmailHtml({ prenom: 'Maxime' }, BASE);
    expect(html).toContain('Bienvenue Maxime !');
    expect(html).not.toContain('Au menu');
  });
});

describe('weeklyDigestSubject', () => {
  it('objet inchangé, sans titre de plat', () => {
    expect(weeklyDigestSubject({ prenom: '', nbRepas: 10, semaineLabel: 'x', economie: 3.5, economieReference: null }))
      .toBe('🍽️ Ta semaine est prête — 3,50 € économisés !');
    expect(weeklyDigestSubject({ prenom: '', nbRepas: 10, semaineLabel: 'x', economie: null, economieReference: null }))
      .toBe('🍽️ Ta semaine de repas est prête');
  });
});

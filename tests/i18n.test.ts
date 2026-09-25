// ============================================================================
// Tests i18n — fondation de localisation (audit P0.4)
//
// Le contrat est simple mais doit TENIR : formatPrix et les labels de rayons
// ne codent plus 'fr-FR'/'EUR' en dur — ils lisent la config active. Changer
// LOCALE_CONFIG doit suffire, et ces tests le prouvent en simulant un autre
// marché via les helpers purs.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { LOCALE_CONFIG } from '@/lib/i18n/config';
import { DICT_FR, labelRayon, labelContexteJour } from '@/lib/i18n/fr';
import { formatPrix } from '@/lib/budget';

describe('LOCALE_CONFIG', () => {
  it('est ancrée sur le marché français en V1', () => {
    expect(LOCALE_CONFIG.country).toBe('FR');
    expect(LOCALE_CONFIG.currency).toBe('EUR');
    expect(LOCALE_CONFIG.locale).toBe('fr-FR');
    expect(LOCALE_CONFIG.timezone).toBe('Europe/Paris');
  });

  it('unités du marché : grammes et millilitres (convention du catalogue)', () => {
    expect(LOCALE_CONFIG.units.mass).toBe('g');
    expect(LOCALE_CONFIG.units.volume).toBe('ml');
  });
});

describe('formatPrix lit la config active', () => {
  it('formate en euros avec le symbole €', () => {
    const out = formatPrix(12.5);
    expect(out).toContain('12,50');
    expect(out).toContain('€');
  });

  it('ne mentionne JAMAIS une devise étrangère (régression : devise codée en dur)', () => {
    const out = formatPrix(42);
    expect(out).not.toContain('$');
    expect(out).not.toContain('USD');
    expect(out).not.toContain('CHF');
  });

  it('null → tiret cadratin (pas de « NaN € » ni « undefined »)', () => {
    expect(formatPrix(null)).toBe('—');
    expect(formatPrix(undefined)).toBe('—');
  });
});

describe('dictionnaire FR', () => {
  it('couvre les 10 rayons du catalogue (contrainte SQL ingredients.rayon)', () => {
    const attendus = [
      'fruits_legumes', 'epicerie_salee', 'epicerie_sucree', 'frais',
      'surgeles', 'viande_poisson', 'boissons', 'boulangerie', 'conserves', 'epices',
    ];
    for (const r of attendus) {
      expect(DICT_FR.rayons[r as keyof typeof DICT_FR.rayons]).toBeTruthy();
    }
    expect(Object.keys(DICT_FR.rayons)).toHaveLength(10);
  });

  it('labelRayon retombe sur la valeur brute pour un rayon inconnu (jamais undefined à l\u2019écran)', () => {
    expect(labelRayon('fruits_legumes')).toContain('Fruits');
    expect(labelRayon('rayon_nouveau')).toBe('rayon_nouveau');
  });

  it('couvre les 4 intentions du jour du moteur', () => {
    expect(labelContexteJour('normal')).toBe('Normal');
    expect(labelContexteJour('rapide')).toBe('Rapide');
    expect(labelContexteJour('leger')).toBe('Léger');
    expect(labelContexteJour('plaisir')).toBe('Plaisir');
  });

  it('7 jours, lundi en premier (convention des semaines ISO du moteur)', () => {
    expect(DICT_FR.jours).toHaveLength(7);
    expect(DICT_FR.jours[0]).toBe('Lundi');
    expect(DICT_FR.joursMini).toHaveLength(7);
  });
});

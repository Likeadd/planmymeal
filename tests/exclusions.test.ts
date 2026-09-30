import { describe, it, expect } from 'vitest';
import { TOUTES_ALLERGIES, DETESTES, correspond, resoudreExclusions } from '@/lib/exclusions-alimentaires';
import { rateLimitMemoire } from '@/lib/rate-limit';

const famille = (code: string) => [...TOUTES_ALLERGIES, ...DETESTES].find(f => f.code === code)!;

describe('familles d’aliments (allergies / détestés)', () => {
  it('reconnaît les ingrédients de la famille', () => {
    expect(correspond('Beurre de cacahuète', famille('arachides'))).toBe(true);
    expect(correspond('Crème fraîche épaisse', famille('lait'))).toBe(true);
    expect(correspond('Pains burger', famille('gluten'))).toBe(true);
    expect(correspond('Moules', famille('mollusques'))).toBe(true);
  });

  it('évite les faux positifs connus', () => {
    expect(correspond('Champignons de Paris', famille('fruits_coque'))).toBe(false); // « pignon »
    expect(correspond('Semoule fine', famille('mollusques'))).toBe(false);         // « moule »
    expect(correspond('Poireau', famille('fruits_noyau'))).toBe(false);            // « poire »
    expect(correspond('Lait de coco', famille('lait'))).toBe(false);
    expect(correspond('Farine de pois chiches', famille('gluten'))).toBe(false);
    expect(correspond('Ailes de poulet', famille('ail_oignon'))).toBe(false);      // « ail »
    expect(correspond('Vinaigre de cidre', famille('alcool'))).toBe(false);
  });

  it('résout des codes en identifiants d’ingrédients', () => {
    const catalogue = [{ id: 1, nom: 'Cacahuètes' }, { id: 2, nom: 'Poulet entier' }, { id: 3, nom: 'Œuf' }];
    expect(resoudreExclusions(['arachides', 'oeufs'], TOUTES_ALLERGIES, catalogue).sort()).toEqual([1, 3]);
    expect(resoudreExclusions([], TOUTES_ALLERGIES, catalogue)).toEqual([]);
  });
});

describe('limite de débit (repli en mémoire)', () => {
  it('bloque au-delà de la limite puis indique le délai', () => {
    const cle = `test:${Math.random()}`;
    expect(rateLimitMemoire(cle, 2, 60_000).ok).toBe(true);
    expect(rateLimitMemoire(cle, 2, 60_000).ok).toBe(true);
    const r = rateLimitMemoire(cle, 2, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });
});

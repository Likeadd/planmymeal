import { describe, it, expect } from 'vitest';
import { enregistrerPreference } from '../src/lib/memoire';

// ============================================================================
// Audit VULN-002 : une préférence ne peut viser qu'une recette publique ou la sienne.
// Faux client Supabase : enregistre les filtres appliqués et les écritures.
// ============================================================================

function fauxClient(recetteVisible: boolean) {
  const appels: { table: string; or?: string; upsert?: unknown }[] = [];
  const client = {
    from(table: string) {
      const appel: { table: string; or?: string; upsert?: unknown } = { table };
      appels.push(appel);
      const q = {
        select: () => q,
        eq: () => q,
        or: (f: string) => { appel.or = f; return q; },
        maybeSingle: async () => ({ data: recetteVisible ? { id: 1 } : null, error: null }),
        upsert: async (v: unknown) => { appel.upsert = v; return { error: null }; },
      };
      return q;
    },
  };
  return { client, appels };
}

describe('enregistrerPreference (VULN-002)', () => {
  it('refuse une recette privée d’un autre compte, sans rien écrire', async () => {
    const { client, appels } = fauxClient(false);
    await expect(enregistrerPreference('user-b', 42, { note: 5 }, client as never)).rejects.toThrow('Recette introuvable');
    expect(appels.some(a => a.upsert)).toBe(false);
  });
  it('filtre sur « publique OU créée par l’utilisateur »', async () => {
    const { client, appels } = fauxClient(true);
    await enregistrerPreference('user-b', 42, { note: 5 }, client as never);
    expect(appels[0]).toMatchObject({ table: 'meals', or: 'is_public.eq.true,created_by.eq.user-b' });
    expect(appels.some(a => a.table === 'user_meal_preferences' && a.upsert)).toBe(true);
  });
});

import { sansEmailEnClair } from '../src/lib/security-log';

describe('journal de sécurité sans email en clair (VULN-011)', () => {
  it('remplace l’email par une empreinte stable', () => {
    const a = sansEmailEnClair({ email: 'Marie@Exemple.fr', action: 'x' });
    expect(a).not.toHaveProperty('email');
    expect(a).toMatchObject({ action: 'x' });
    expect(String(a?.email_hash)).toMatch(/^[0-9a-f]{16}$/);
    expect(sansEmailEnClair({ email: 'marie@exemple.fr' })?.email_hash).toBe(a?.email_hash);
    expect(JSON.stringify(a)).not.toContain('exemple');
  });
});

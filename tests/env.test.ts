import { describe, it, expect, vi } from 'vitest';
import { ENV_SPECS, missingEnvVars, validateEnv } from '../src/lib/env';

// Variables critiques requises pour un env « complet »
const CRITICAL_KEYS = ENV_SPECS.filter(s => s.severity === 'critical').map(s => s.key);

function envWith(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map(k => [k, `test-${k}`]));
}

describe('missingEnvVars', () => {
  it('retourne aucune variable manquante pour un env complet', () => {
    const env = envWith(ENV_SPECS.map(s => s.key));
    expect(missingEnvVars(env)).toEqual([]);
  });

  it('détecte toutes les variables absentes', () => {
    expect(missingEnvVars({})).toHaveLength(ENV_SPECS.length);
  });

  it('traite une chaîne vide comme manquante', () => {
    const env = envWith(CRITICAL_KEYS);
    env.NEXT_PUBLIC_SUPABASE_URL = '   ';
    const missing = missingEnvVars(env);
    expect(missing.map(s => s.key)).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('ne liste que les variables réellement absentes', () => {
    const env = envWith(CRITICAL_KEYS); // recommandées absentes
    const missing = missingEnvVars(env);
    expect(missing.every(s => s.severity === 'recommended')).toBe(true);
  });
});

describe('validateEnv', () => {
  it('ne lève pas et reste silencieux quand tout est défini', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    validateEnv({ env: envWith(ENV_SPECS.map(s => s.key)), failOnCritical: true, quiet: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('lève une erreur listant précisément les critiques manquantes en build', () => {
    expect(() =>
      validateEnv({ env: {}, failOnCritical: true })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() =>
      validateEnv({ env: {}, failOnCritical: true })
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('ne lève pas en dev (failOnCritical false) mais logge un diagnostic', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ env: {}, failOnCritical: false })).not.toThrow();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('CRITIQUES'));
    spy.mockRestore();
  });

  it('signale les recommandées manquantes sans jamais bloquer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateEnv({ env: envWith(CRITICAL_KEYS), failOnCritical: true });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('recommandées manquantes')
    );
    warn.mockRestore();
  });
});

describe('audit VULN-001 : URL du site obligatoire en production', () => {
  it('NEXT_PUBLIC_SITE_URL est critique (le build de production échoue sans elle)', () => {
    expect(CRITICAL_KEYS).toContain('NEXT_PUBLIC_SITE_URL');
  });
});

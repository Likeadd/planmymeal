import { describe, it, expect } from 'vitest';
import { ipNonPublique, lookupPublic, telechargerPage, urlPubliqueAutorisee } from '../src/lib/ssrf';

// ============================================================================
// Audit VULN-007 : filtre SSRF de l'import de recettes par URL.
// ============================================================================

describe('urlPubliqueAutorisee', () => {
  it('refuse toutes les adresses internes, y compris encapsulées en IPv6', () => {
    for (const u of [
      'https://127.0.0.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[::ffff:7f00:1]/',
      'https://[::ffff:a9fe:a9fe]/', 'https://[64:ff9b::7f00:1]/', 'https://[64:ff9b::a9fe:a9fe]/', 'https://[2002:7f00:1::]/',
      'https://169.254.169.254/', 'https://10.0.0.1/', 'https://192.168.1.1/', 'https://172.16.0.1/', 'https://100.64.0.1/',
      'https://192.0.0.1/', 'https://198.51.100.7/', 'https://203.0.113.9/', 'https://[fe80::1]/', 'https://[fd00::1]/',
      'https://localhost/', 'https://x.localhost/', 'https://db.internal/', 'https://2130706433/', 'https://0x7f.1/',
      'http://example.com/', 'https://example.com:8443/', 'https://user:pass@example.com/', 'file:///etc/passwd', 'pas une url',
    ]) expect(urlPubliqueAutorisee(u), u).toBeNull();
  });
  it('accepte une URL publique https', () => {
    expect(urlPubliqueAutorisee('https://www.marmiton.org/recettes/x.aspx')?.hostname).toBe('www.marmiton.org');
    expect(urlPubliqueAutorisee('https://93.184.216.34/')).not.toBeNull();
  });
});

describe('ipNonPublique', () => {
  it('classe correctement les adresses', () => {
    expect(ipNonPublique('8.8.8.8')).toBe(false);
    expect(ipNonPublique('2606:4700:4700::1111')).toBe(false);
    expect(ipNonPublique('::ffff:8.8.8.8')).toBe(false);
    expect(ipNonPublique('::ffff:808:808')).toBe(false);
    expect(ipNonPublique('::ffff:7f00:1')).toBe(true);
    expect(ipNonPublique('pas-une-ip')).toBe(true);
  });
});

describe('résolution figée (anti-rebinding)', () => {
  it('le résolveur de connexion refuse un nom qui pointe vers une adresse interne', async () => {
    const erreur = await new Promise<Error | null>(ok => lookupPublic('localhost', {}, e => ok(e)));
    expect(erreur?.message).toBe('IP interdite');
  });
  it('le téléchargement refuse une IP littérale interne sans se connecter', async () => {
    await expect(telechargerPage(new URL('https://[::ffff:7f00:1]/'))).rejects.toThrow('n’est pas autorisée');
  });
});

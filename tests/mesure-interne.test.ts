import { describe, it, expect } from 'vitest';
import { analyserAgent, hashVisiteur, nettoyerMesure } from '../src/lib/mesure-interne';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

describe('analyserAgent', () => {
  it('reconnaît appareil, navigateur et système', () => {
    expect(analyserAgent(IPHONE)).toMatchObject({ appareil: 'mobile', navigateur: 'Safari', systeme: 'iOS', robot: false });
    expect(analyserAgent(CHROME_WIN)).toMatchObject({ appareil: 'ordinateur', navigateur: 'Chrome', systeme: 'Windows', robot: false });
    expect(analyserAgent(ANDROID)).toMatchObject({ appareil: 'mobile', navigateur: 'Chrome', systeme: 'Android' });
    expect(analyserAgent('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1').appareil).toBe('tablette');
  });
  it('écarte les robots', () => {
    for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', 'HeadlessChrome/124', 'python-requests/2.31', '']) expect(analyserAgent(ua).robot).toBe(true);
  });
});

describe('hashVisiteur', () => {
  it('est stable dans la journée mais change chaque jour, sans contenir l’adresse IP', () => {
    const a = hashVisiteur('203.0.113.9', CHROME_WIN, '2026-10-18', 'secret');
    expect(hashVisiteur('203.0.113.9', CHROME_WIN, '2026-10-18', 'secret')).toBe(a);
    expect(hashVisiteur('203.0.113.9', CHROME_WIN, '2026-10-19', 'secret')).not.toBe(a);
    expect(hashVisiteur('203.0.113.10', CHROME_WIN, '2026-10-18', 'secret')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain('203');
  });
});

describe('nettoyerMesure', () => {
  const H = 'getplanmymeal.com';
  it('page publique : adresse anonymisée, sans paramètres', () => {
    expect(nettoyerMesure({ t: 'p', c: '/recette/2485-poele-de-poulet?ref=x', r: '', s: '' }, H)).toMatchObject({ type: 'page', chemin: '/recette/[id]', source: null });
    expect(nettoyerMesure({ t: 'p', c: '/menu/0b9f2c1e-1111-2222-3333-444455556666' }, H)?.chemin).toBe('/menu/[jeton]');
  });
  it('source : paramètre ref/utm propre, sinon référent externe, jamais le site lui-même', () => {
    expect(nettoyerMesure({ t: 'p', c: '/', s: 'TikTok' }, H)?.source).toBe('tiktok');
    expect(nettoyerMesure({ t: 'p', c: '/', r: 'https://www.google.com/search?q=x' }, H)?.source).toBe('google.com');
    expect(nettoyerMesure({ t: 'p', c: '/', r: 'https://getplanmymeal.com/faq' }, H)?.source).toBeNull();
    expect(nettoyerMesure({ t: 'p', c: '/', s: '<script>' }, H)?.source).toBeNull();
  });
  it('ignore l’espace connecté, /admin et les charges invalides', () => {
    for (const c of ['/dashboard', '/aujourdhui', '/compte', '/admin', '/api/x']) expect(nettoyerMesure({ t: 'p', c }, H)).toBeNull();
    for (const x of [null, 'texte', 42, {}, { t: 'x' }, { t: 'p', c: 'pas-un-chemin' }, { t: 'p', c: '/' + 'a'.repeat(300) }]) expect(nettoyerMesure(x, H)).toBeNull();
  });
  it('événement : nom borné, propriétés primitives et courtes', () => {
    expect(nettoyerMesure({ t: 'e', n: 'Onboarding terminé', d: { page: 'accueil', n: 3, ok: true, obj: { a: 1 }, 'mauvais clé!': 1 } }, H))
      .toMatchObject({ type: 'evenement', nom: 'Onboarding terminé', props: { page: 'accueil', n: 3, ok: true } });
    expect(nettoyerMesure({ t: 'e', n: '<img onerror=x>' }, H)).toBeNull();
    expect(nettoyerMesure({ t: 'e', n: 'x'.repeat(41) }, H)).toBeNull();
    expect(nettoyerMesure({ t: 'e', n: 'Clic', d: { cible: 'y'.repeat(100) } }, H)?.props?.cible).toHaveLength(60);
  });
});

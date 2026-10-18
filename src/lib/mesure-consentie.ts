// ============================================================================
// Outils d'analyse soumis à CONSENTEMENT : Google Analytics 4 (audience, conversions) et Amplitude
// (rétention, parcours). Rien n'est chargé ni envoyé avant `activer()`, appelé uniquement après un
// « Accepter » explicite (voir consentement.ts / ConsentementCookies.tsx).
//
// Minimisation : aucune donnée de compte (email, nom) n'est envoyée ; les adresses de page sont
// ANONYMISÉES (pas d'identifiant de recette, de jeton de partage ni de paramètres d'URL) ;
// pas de signaux publicitaires Google ; Amplitude en région UE, sans suivi automatique des clics,
// formulaires ni téléchargements.
// ============================================================================

import { AMPLITUDE_KEY, GA_ID, nomEvenementGa } from '@/lib/consentement';
import { cheminAnonyme } from '@/lib/chemins';

type Props = Record<string, string | number | boolean>;
type Amplitude = typeof import('@amplitude/analytics-browser');
interface FenetreMesure extends Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [cle: string]: unknown }

let actif = false;
let gaCharge = false;
let amplitude: Amplitude | null = null;
let chargementAmplitude: Promise<void> | null = null;

const fenetre = () => window as unknown as FenetreMesure;

function chargerGa(): void {
  if (!GA_ID) return;
  const w = fenetre();
  w[`ga-disable-${GA_ID}`] = false;
  if (gaCharge) return;
  gaCharge = true;
  w.dataLayer = w.dataLayer || [];
  // gtag exige l'objet `arguments` (et non un tableau) dans le dataLayer
  w.gtag = function gtag() { // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  w.gtag('js', new Date());
  w.gtag('config', GA_ID, {
    send_page_view: false,            // les pages vues sont envoyées par pageVue() avec une URL anonymisée
    allow_google_signals: false,      // pas de données publicitaires ni de recoupement inter-appareils Google
    allow_ad_personalization_signals: false,
    cookie_expires: 34_128_000,       // 395 jours (13 mois) : durée maximale recommandée par la CNIL
    cookie_flags: 'SameSite=Lax;Secure',
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

function chargerAmplitude(): Promise<void> {
  if (!AMPLITUDE_KEY) return Promise.resolve();
  if (amplitude) { amplitude.setOptOut(false); return Promise.resolve(); }
  chargementAmplitude ??= import('@amplitude/analytics-browser').then(mod => {
    mod.init(AMPLITUDE_KEY, undefined, {
      serverZone: 'EU',
      defaultTracking: false,
      autocapture: { sessions: true, pageUrlEnrichment: false, pageViews: false, formInteractions: false, fileDownloads: false, elementInteractions: false, networkTracking: false, webVitals: false, frustrationInteractions: false },
      remoteConfig: { fetchRemoteConfig: false }, // pas d'appel de configuration à distance : seulement nos envois d'événements
      cookieOptions: { expiration: 365 },
      trackingOptions: { ipAddress: false },
    });
    amplitude = mod;
  }).catch(() => { chargementAmplitude = null; });
  return chargementAmplitude;
}

/** Charge les outils (consentement donné). Idempotent. */
export function activer(): Promise<void> {
  actif = true;
  chargerGa();
  return chargerAmplitude();
}

function supprimerCookies(motif: RegExp): void {
  const hotes = [location.hostname, `.${location.hostname}`, `.${location.hostname.split('.').slice(-2).join('.')}`];
  for (const brut of document.cookie.split(';')) {
    const nom = brut.split('=')[0].trim();
    if (!motif.test(nom)) continue;
    for (const h of hotes) document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${h}`;
    document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/** Arrête les envois et efface les cookies posés (consentement refusé ou retiré). */
export function desactiver(): void {
  actif = false;
  if (GA_ID) fenetre()[`ga-disable-${GA_ID}`] = true;
  if (amplitude) { amplitude.setOptOut(true); amplitude.reset(); }
  supprimerCookies(/^(_ga|_gid|_gat|AMP_)/);
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('AMP_')) localStorage.removeItem(k); } catch { /* stockage indisponible */ }
}

export const estActif = () => actif;

function apresAmplitude(action: (a: Amplitude) => void): void {
  if (!AMPLITUDE_KEY) return;
  if (amplitude) action(amplitude);
  else void chargementAmplitude?.then(() => { if (amplitude && actif) action(amplitude); });
}

/** Événement métier (même nom que Plausible) — uniquement si le consentement est actif. */
export function envoyerEvenement(nom: string, props?: Props): void {
  if (!actif) return;
  if (GA_ID && fenetre().gtag) fenetre().gtag!('event', nomEvenementGa(nom), props ?? {});
  apresAmplitude(a => { a.track(nom, props); });
}

/** Page vue avec URL anonymisée (sans identifiant de recette, jeton de partage ni paramètres). */
export function pageVue(pathname: string): void {
  if (!actif) return;
  const chemin = cheminAnonyme(pathname);
  if (GA_ID && fenetre().gtag) {
    fenetre().gtag!('set', { page_location: `${location.origin}${chemin}`, page_path: chemin, page_title: document.title });
    fenetre().gtag!('event', 'page_view');
  }
  apresAmplitude(a => { a.track('Page vue', { page: chemin }); });
}

/** Identifiant PSEUDONYME du compte (UUID, jamais l'email ni le nom) pour la rétention ; null à la déconnexion. */
export function identifier(userId: string | null, plan?: string): void {
  if (!actif) return;
  apresAmplitude(a => {
    if (userId) {
      a.setUserId(userId);
      if (plan) a.identify(new a.Identify().set('plan', plan));
    } else if (a.getUserId()) {
      a.reset();
    }
  });
}

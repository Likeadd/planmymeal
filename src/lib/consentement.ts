// ============================================================================
// Consentement aux outils d'analyse (Google Analytics 4, Amplitude) — RGPD / CNIL.
//
//  - Les outils ne sont chargés QU'APRÈS un « Accepter » explicite ; « Refuser » est aussi simple.
//  - Le choix est mémorisé 6 mois (durée recommandée par la CNIL), puis redemandé ; il peut être
//    modifié à tout moment (« Gérer mes cookies »).
//  - Si aucun identifiant n'est configuré (NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_AMPLITUDE_API_KEY),
//    il n'y a aucune bannière de consentement : seule la mesure anonyme sans cookie (Plausible) tourne.
// ============================================================================

const GA_BRUT = (process.env.NEXT_PUBLIC_GA_ID ?? '').trim();
const AMP_BRUT = (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? '').trim();

/** Identifiant de mesure GA4 (« G-XXXXXXXXXX ») ; vide si absent ou invalide */
export const GA_ID = /^G-[A-Z0-9]{6,14}$/.test(GA_BRUT) ? GA_BRUT : '';
/** Clé API Amplitude (32 caractères hexadécimaux) ; vide si absente ou invalide */
export const AMPLITUDE_KEY = /^[a-f0-9]{32}$/i.test(AMP_BRUT) ? AMP_BRUT : '';
/** Vrai si au moins un outil soumis à consentement est configuré */
export const MESURE_AVEC_CONSENTEMENT = GA_ID !== '' || AMPLITUDE_KEY !== '';

export type Choix = 'accepte' | 'refuse';

const CLE = 'pmm_consentement';
/** Validité du choix : 6 mois */
export const DUREE_CHOIX_MS = 182 * 86_400_000;
export const EVENEMENT_CHOIX = 'pmm:consentement';
export const EVENEMENT_OUVRIR = 'pmm:cookies';

interface Stockage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

/** Choix mémorisé et encore valide, sinon null (→ redemander) */
export function lireChoix(stockage?: Stockage, maintenant = Date.now()): Choix | null {
  try {
    const s = stockage ?? localStorage;
    const brut = s.getItem(CLE);
    if (!brut) return null;
    const { choix, le } = JSON.parse(brut) as { choix?: string; le?: number };
    if ((choix !== 'accepte' && choix !== 'refuse') || typeof le !== 'number') return null;
    return maintenant - le < DUREE_CHOIX_MS && maintenant >= le ? choix : null;
  } catch {
    return null;
  }
}

export function enregistrerChoix(choix: Choix, stockage?: Stockage, maintenant = Date.now()): void {
  try { (stockage ?? localStorage).setItem(CLE, JSON.stringify({ choix, le: maintenant })); } catch { /* stockage indisponible : le choix vaut pour la page */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENEMENT_CHOIX, { detail: choix }));
}

/** Nom d'événement GA4 : ASCII, minuscules, mots séparés par « _ » (« Onboarding terminé » → « onboarding_termine ») */
export function nomEvenementGa(nom: string): string {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (/^[a-z]/.test(n) ? n : `e_${n}`).slice(0, 40);
}

// ============================================================================
// Mesure d'audience INTERNE (serveur) : alternative à Google Analytics / Amplitude affichée dans
// /admin. Anonyme et sans cookie :
//   - aucune adresse IP n'est stockée : `visiteur` = HMAC(jour | IP | navigateur), qui change
//     chaque jour et ne peut pas être inversé → pas de suivi d'une personne d'un jour à l'autre ;
//   - pays seulement (en-tête de la plateforme), type d'appareil / navigateur / système ;
//   - pages publiques uniquement (jamais l'espace connecté), adresses sans identifiant ;
//   - respect de « Do Not Track » et « Global Privacy Control ».
// ============================================================================

import { createHmac } from 'node:crypto';
import { cheminAnonyme, pagePublique } from '@/lib/chemins';

export interface Mesure {
  type: 'page' | 'evenement';
  chemin: string | null;
  nom: string | null;
  source: string | null;
  props: Record<string, string | number | boolean> | null;
}

export interface Agent { appareil: 'mobile' | 'tablette' | 'ordinateur'; navigateur: string; systeme: string; robot: boolean }

const ROBOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|curl|wget|python|java\/|go-http|node-fetch|axios|okhttp|scrapy|httpclient/i;

export function analyserAgent(ua: string): Agent {
  const u = ua || '';
  const tablette = /iPad|Tablet|PlayBook|Silk/i.test(u) || (/Android/i.test(u) && !/Mobile/i.test(u));
  const mobile = !tablette && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(u);
  const navigateur = /Edg(e|A|iOS)?\//.test(u) ? 'Edge'
    : /OPR\/|Opera/.test(u) ? 'Opera'
    : /SamsungBrowser/.test(u) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(u) ? 'Firefox'
    : /Chrome|CriOS/.test(u) ? 'Chrome'
    : /Safari/.test(u) ? 'Safari' : 'Autre';
  const systeme = /Windows/.test(u) ? 'Windows'
    : /Android/.test(u) ? 'Android'
    : /iPhone|iPad|iPod/.test(u) ? 'iOS'
    : /Mac OS X|Macintosh/.test(u) ? 'macOS'
    : /Linux|X11|CrOS/.test(u) ? 'Linux' : 'Autre';
  return { appareil: tablette ? 'tablette' : mobile ? 'mobile' : 'ordinateur', navigateur, systeme, robot: u.length < 10 || ROBOT_RE.test(u) };
}

/** Identifiant de visiteur ANONYME et journalier (non réversible, différent chaque jour) */
export function hashVisiteur(ip: string, ua: string, jour: string, secret: string): string {
  return createHmac('sha256', secret).update(`${jour}|${ip}|${ua}`).digest('hex').slice(0, 32);
}

const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const NOM_RE = /^[\p{L}\p{N} '’._-]{1,40}$/u;

/** Valide et nettoie la charge reçue du navigateur ; null = à ignorer. `hote` = domaine du site (referrer interne ignoré). */
export function nettoyerMesure(corps: unknown, hote: string): Mesure | null {
  if (!corps || typeof corps !== 'object') return null;
  const b = corps as Record<string, unknown>;

  if (b.t === 'e') {
    const nom = typeof b.n === 'string' ? b.n.trim() : '';
    if (!NOM_RE.test(nom)) return null;
    let props: Mesure['props'] = null;
    if (b.d && typeof b.d === 'object' && !Array.isArray(b.d)) {
      const sortie: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(b.d as Record<string, unknown>).slice(0, 6)) {
        if (!/^[a-z_]{1,20}$/i.test(k)) continue;
        if (typeof v === 'number' || typeof v === 'boolean') sortie[k] = v;
        else if (typeof v === 'string') sortie[k] = v.slice(0, 60);
      }
      props = Object.keys(sortie).length ? sortie : null;
    }
    return { type: 'evenement', chemin: null, nom, source: null, props };
  }

  if (b.t === 'p') {
    const brut = typeof b.c === 'string' ? b.c : '';
    if (!brut.startsWith('/') || brut.length > 200) return null;
    const chemin = cheminAnonyme(brut.split(/[?#]/)[0]);
    if (!pagePublique(chemin) || chemin.startsWith('/admin')) return null; // jamais l'espace connecté

    let source: string | null = null;
    const param = typeof b.s === 'string' ? b.s.trim().toLowerCase() : '';
    if (SOURCE_RE.test(param)) source = param;
    else if (typeof b.r === 'string' && b.r) {
      try {
        const h = new URL(b.r).hostname.replace(/^www\./, '').toLowerCase();
        if (h && h !== hote.replace(/^www\./, '') && SOURCE_RE.test(h)) source = h;
      } catch { /* référent illisible → direct */ }
    }
    return { type: 'page', chemin, nom: null, source, props: null };
  }
  return null;
}

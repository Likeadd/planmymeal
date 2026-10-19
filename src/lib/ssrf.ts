// ============================================================================
// Téléchargement d'une page web fournie par un utilisateur, protégé contre la SSRF (audit VULN-007) :
//   - https uniquement, port 443, pas d'identifiants dans l'URL ;
//   - aucune adresse interne : privées, loopback, link-local (métadonnées cloud), CGNAT, documentation,
//     multicast, IPv6 locales et adresses IPv4 encapsulées dans de l'IPv6 (::ffff:7f00:1, NAT64, 6to4) ;
//   - résolution DNS FIGÉE : l'adresse vérifiée est celle utilisée pour la connexion (pas de rebinding DNS) ;
//   - aucune redirection suivie, taille et durée plafonnées.
// ============================================================================

import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { lookup } from 'node:dns/promises';
import { UserError } from '@/lib/utils';

const TAILLE_HTML_MAX = 2_000_000; // 2 Mo
const TIMEOUT_MS = 10_000;

function ipv4NonPublique(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||        // CGNAT
    (a === 169 && b === 254) ||                  // link-local / métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF / TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) ||     // benchmark
    (a === 198 && b === 51 && c === 100) ||      // TEST-NET-2
    (a === 203 && b === 0 && c === 113);         // TEST-NET-3
}

/** IPv4 encapsulée dans une IPv6 (forme pointée ou hexadécimale), sinon null */
function ipv4Encapsulee(x: string): string | null {
  const pointee = x.match(/^(?:::ffff:|::ffff:0:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (pointee) return pointee[1];
  const hexa = x.match(/^(?:::ffff:|::ffff:0:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexa) {
    const h = parseInt(hexa[1], 16), l = parseInt(hexa[2], 16);
    return `${h >> 8}.${h & 255}.${l >> 8}.${l & 255}`;
  }
  return null;
}

/** true si l'adresse IP (v4 ou v6) n'est pas routable publiquement */
export function ipNonPublique(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4NonPublique(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    const v4 = ipv4Encapsulee(x);
    if (v4) return ipv4NonPublique(v4);
    return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff') ||
      x.startsWith('64:ff9b:') ||   // NAT64 (encapsulation vers de l'IPv4 arbitraire)
      x.startsWith('2002:') ||      // 6to4
      x.startsWith('2001:db8:') || x.startsWith('2001:0db8:'); // documentation
  }
  return true;
}

/** URL publique https uniquement — rejette localhost, IP internes, autres protocoles et ports */
export function urlPubliqueAutorisee(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;

  const hote = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hote === 'localhost' || hote.endsWith('.localhost') || hote.endsWith('.local')) return null;
  if (hote.endsWith('.internal') || hote.endsWith('.localdomain')) return null;
  if (isIP(hote) && ipNonPublique(hote)) return null;
  return url;
}

/**
 * Résolveur utilisé PAR LA CONNEXION elle-même : refuse si une seule des adresses est interne. C'est
 * l'adresse vérifiée ici qui est utilisée pour se connecter (pas de seconde résolution exploitable).
 */
export const lookupPublic: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true })
    .then(adresses => {
      if (adresses.length === 0 || adresses.some(a => ipNonPublique(a.address))) {
        callback(new Error('IP interdite'), '', 0);
        return;
      }
      if ((options as { all?: boolean }).all) {
        (callback as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, adresses);
      } else {
        callback(null, adresses[0].address, adresses[0].family);
      }
    })
    .catch(e => callback(e as NodeJS.ErrnoException, '', 0));
};

/** Télécharge la page (texte), sans suivre les redirections, taille et durée plafonnées. */
export function telechargerPage(url: URL): Promise<string> {
  return new Promise((resolve, reject) => {
    const hote = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hote) && ipNonPublique(hote)) {
      reject(new UserError('Cette adresse n’est pas autorisée.'));
      return;
    }
    const req = https.get(url, {
      lookup: lookupPublic,
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PlanMyMealBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, res => {
      const statut = res.statusCode ?? 0;
      const echec = (message: string) => { res.resume(); reject(new UserError(message)); };
      if (statut >= 300 && statut < 400) return echec('Cette URL redirige — ouvrez directement l’URL finale.');
      if (statut < 200 || statut >= 300) return echec(`Page inaccessible (HTTP ${statut})`);
      const type = String(res.headers['content-type'] ?? '');
      if (!type.includes('text/html') && !type.includes('text/plain') && !type.includes('xml')) {
        return echec('La page n’est pas un document HTML.');
      }
      const morceaux: Buffer[] = [];
      let total = 0;
      res.on('data', (morceau: Buffer) => {
        total += morceau.length;
        if (total > TAILLE_HTML_MAX) {
          req.destroy();
          reject(new UserError('Page trop volumineuse (max 2 Mo).'));
          return;
        }
        morceaux.push(morceau);
      });
      res.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')));
      res.on('error', () => reject(new UserError('Page inaccessible.')));
    });
    req.on('timeout', () => req.destroy(new Error('délai dépassé')));
    req.on('error', e => {
      reject(e instanceof UserError ? e
        : /IP interdite/.test(e.message) ? new UserError('Cette adresse n’est pas autorisée.')
        : new UserError('Page inaccessible.'));
    });
  });
}

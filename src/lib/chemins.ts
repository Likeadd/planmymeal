// Chemins d'URL pour la mesure d'audience : espace privé exclu, identifiants retirés.

/** Espace connecté : aucun suivi de clics ni de défilement (seules les pages publiques sont mesurées). */
const PREFIXES_PRIVES = ['/aujourdhui', '/dashboard', '/onboarding', '/compte', '/planning', '/favoris', '/frigo', '/budget', '/admin', '/auth', '/api'];
export const pagePublique = (pathname: string): boolean => !PREFIXES_PRIVES.some(p => pathname === p || pathname.startsWith(p + '/'));

/** Chemin SANS identifiant (recette, jeton de partage) : « /recette/[id] » — jamais de donnée propre à une personne. */
export function cheminAnonyme(pathname: string): string {
  return pathname
    .replace(/^\/recette\/[^/]+/, '/recette/[id]')
    .replace(/^\/(menu|liste)\/[^/]+/, '/$1/[jeton]')
    .replace(/^\/recettes\/categorie\/[^/]+/, '/recettes/categorie/[slug]')
    .replace(/^\/menu-semaine\/[^/]+/, '/menu-semaine/[slug]') || '/';
}

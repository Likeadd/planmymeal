export function formatRayon(rayon: string): string {
  const labels: Record<string, string> = {
    fruits_legumes: '🥬 Fruits & Légumes',
    epicerie_salee: '🧂 Épicerie salée',
    epicerie_sucree: '🍫 Épicerie sucrée',
    frais: '🧀 Frais',
    surgeles: '❄️ Surgelés',
    viande_poisson: '🥩 Viande & Poisson',
    boissons: '🥤 Boissons',
    boulangerie: '🍞 Boulangerie',
    conserves: '🥫 Conserves',
    epices: '🌿 Épices',
  };
  return labels[rayon] || rayon;
}

/** Libellé lisible d'un type de repas (plat, dessert, entrée...) */
export function formatTypeRepas(type: string): string {
  const labels: Record<string, string> = {
    entree: 'Entrée',
    plat: 'Plat',
    dessert: 'Dessert',
    petit_dejeuner: 'Petit-déjeuner',
    snack: 'Snack',
  };
  return labels[type] || type;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

/**
 * Famille de dessert (titre + ingrédients) : emoji représentatif + libellé.
 * Sert à afficher chaque dessert avec son type (yaourt, compote, pâtisserie...)
 * sur les cartes du planning et dans les suggestions de la modal de swap.
 */
export function familleDessert(meal: {
  titre: string;
  temps_preparation: number;
  temps_cuisson?: number | null;
  ingredients?: { ingredient: { nom: string } }[];
}): { emoji: string; label: string } {
  const texte = meal.titre.toLowerCase()
    + ' ' + (meal.ingredients || []).map(i => i.ingredient.nom.toLowerCase()).join(' ');
  const a = (mots: string[]) => mots.some(m => texte.includes(m));

  if (a(['mug cake'])) return { emoji: '☕', label: 'Mug cake' };
  if (a(['compote', 'pomme au four', 'poire fondante'])) return { emoji: '🍎', label: 'Compote / fruit cuit' };
  if (a(['yaourt', 'fromage blanc', 'skyr'])) return { emoji: '🥛', label: 'Yaourt / fromage blanc' };
  if (a(['glace', 'sorbet', 'vacherin', 'banane split'])) return { emoji: '🍨', label: 'Glace / sorbet' };
  if (a(['mousse', 'panna cotta', 'crème brûlée', 'riz au lait', 'crème', 'tiramisu'])) return { emoji: '🍮', label: 'Crème / entremets' };
  if (a(['tarte', 'clafoutis', 'crumble', 'fondant', 'brownie', 'cookie', 'gâteau', 'moelleux', 'cake'])) return { emoji: '🥧', label: 'Pâtisserie' };
  if (a(['crêpe', 'gaufre'])) return { emoji: '🥞', label: 'Crêperie' };
  if (a(['fruit', 'pomme', 'poire', 'banane', 'fraise', 'framboise', 'myrtille', 'cerise', 'pêche', 'abricot',
    'melon', 'pastèque', 'ananas', 'mangue', 'orange', 'clémentine', 'raisin', 'salade de'])) return { emoji: '🍓', label: 'Fruits' };

  // Express (≤ 10 min) sans mot-clé → dessert léger générique
  if (meal.temps_preparation + (meal.temps_cuisson || 0) <= 10) return { emoji: '🍒', label: 'Dessert léger' };
  return { emoji: '🍰', label: 'Dessert' };
}

export function formatCalories(cal: number | null): string {
  if (!cal) return '—';
  return `${cal} kcal`;
}

/**
 * Extrait le message d'une erreur inconnue (catch sans `any`). Gère les
 * Error classiques ET les erreurs PostgREST (objets { message }, pas des Error).
 */
export function errorMessage(e: unknown, fallback = 'Erreur inconnue'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e
    && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}

/**
 * Erreur métier dont le message est DESTINÉ à l'utilisateur (limite d'offre,
 * créneau invalide…). Toute autre erreur (base, réseau, Stripe…) est masquée
 * par publicErrorMessage pour ne jamais exposer de détail technique.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** Message renvoyé au client par les routes API : jamais de détail technique. */
export function publicErrorMessage(
  e: unknown,
  fallback = 'Une erreur est survenue. Réessayez dans un instant.'
): string {
  return e instanceof UserError ? e.message : fallback;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Majuscule initiale à chaque mot d'un titre de recette (« curry de poulet »
 * → « Curry de Poulet »). Conventions : articles et prépositions françaises
 * courtes restent en minuscule EN MILIEU de titre (mais prennent la majuscule
 * en tête), sigles courts (BBQ) préservés, tirets gérés (grand-mère).
 */
/** Sigle court tout-caps (BBQ, USA) : préservé tel quel par titreMajuscules */
function estSigle(mot: string): boolean {
  const noyau = mot.replace(/[’'’-]/g, '');
  return noyau.length > 0 && noyau.length <= 4 && noyau === noyau.toUpperCase() && /\p{L}/u.test(noyau);
}

export function titreMajuscules(titre: string): string {
  if (!titre) return titre;
  const mots = titre.split(/(\s+|-)/); // garde les espaces et tirets comme séparateurs
  let premiere = true;
  return mots
    .map((mot) => {
      if (!mot || /^[\s-]+$/.test(mot)) return mot; // séparateur inchangé
      // Sigle court → intact ; sinon : 1re lettre en majuscule, reste en
      // minuscules (normalise aussi un titre tapé EN MAJUSCULES).
      const base = estSigle(mot)
        ? mot
        : premiere
          ? mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase()
          : mot.toLowerCase();
      const maj = base.charAt(0).toUpperCase() + base.slice(1);
      premiere = false;
      return maj;
    })
    .join('')
    // Deuxième passe : articles courts re-basculés en minuscule EN MILIEU de titre
    .replace(/(?<=\S)\s+(À|Au|Aux|Avec|Chez|Dans|De|Des|Du|En|Et|La|Le|Les|Par|Pour|Sans|Sur|Un|Une)(?=\s)/g,
      (_m, art: string) => ' ' + art.toLowerCase());
}

/**
 * Copie du texte dans le presse-papiers : API async si dispo, fallback
 * execCommand pour les navigateurs anciens / contextes non sécurisés.
 * Retourne true si la copie a réussi.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* contexte non sécurisé / permission refusée → fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
// ============================================================================
// Helpers de dates partagés — semaine ISO (lundi → dimanche)
//
// ⚠️ FUSEAU DE RÉFÉRENCE : toutes les notions « aujourd'hui / cette semaine »
// sont calculées dans le fuseau de l'APPLICATION (Europe/Paris), jamais dans
// celui du runtime. Sinon le serveur (Vercel = UTC) et le navigateur (Paris)
// divergent entre 23 h et minuit UTC : la « semaine courante » change d'un côté
// et pas de l'autre → semaine affichée fausse ET hydration mismatch (le HTML
// serveur ne correspond plus au premier rendu client).
// ============================================================================

/** Fuseau de référence de l'application (produit français) */
export const TZ_APP = 'Europe/Paris';

const fmtDateParis = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_APP, year: 'numeric', month: '2-digit', day: '2-digit',
});

const fmtJourSemaineParis = new Intl.DateTimeFormat('en-US', { timeZone: TZ_APP, weekday: 'short' });

/** Index du jour de la semaine à Paris : 0 = lundi … 6 = dimanche */
export function jourSemaineParis(date: Date = new Date()): number {
  const index: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return index[fmtJourSemaineParis.format(date).slice(0, 3)] ?? 0;
}

/** Date du jour à Paris au format YYYY-MM-DD */
export function dateParis(date: Date = new Date()): string {
  return fmtDateParis.format(date); // en-CA → YYYY-MM-DD
}

/** Année civile à Paris (pied de page : pas de « 2027 » affiché avant l'heure) */
export function anneeParis(date: Date = new Date()): number {
  return Number(dateParis(date).slice(0, 4));
}

/** Retourne le lundi de la semaine courante (YYYY-MM-DD), fuseau Europe/Paris */
export function getMondayParis(date: Date = new Date()): string {
  const base = new Date(`${dateParis(date)}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - jourSemaineParis(date));
  return base.toISOString().split('T')[0];
}

/** Retourne le lundi de la semaine courante (YYYY-MM-DD) */
export function getMonday(): string {
  return getMondayParis();
}

/**
 * Horodatage lisible, fuseau Europe/Paris. À utiliser pour TOUT timestamp
 * (generated_at, created_at…) : `toLocaleString()` sans timeZone formate dans
 * le fuseau du runtime, donc « 15:04 » côté serveur et « 16:04 » côté client.
 */
export function formatDateHeureParis(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ_APP, ...options }).format(new Date(iso));
}

/** Vrai si l'horodatage tombe le jour courant à Paris */
export function estAujourdhuiParis(iso: string, date: Date = new Date()): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && dateParis(d) === dateParis(date);
}

/**
 * Date française d'un YYYY-MM-DD. Ancrage à midi : `new Date('2026-03-16')`
 * est interprété en UTC minuit, donc formaté la veille dans tout fuseau négatif.
 */
export function formatDateLongueFr(ymd: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('fr-FR', options);
}

/**
 * Saison courante (décalage d'un mois sur l'astronomique — correspond aux
 * arrivages réels des marchés). Vit ici, dans un module neutre, pour que la
 * mémoire alimentaire puisse l'utiliser sans dépendre du moteur.
 */
export function getSaisonActuelle(): string {
  const mois = new Date().getMonth();
  if (mois >= 11 || mois <= 1) return 'hiver';
  if (mois >= 2 && mois <= 4) return 'printemps';
  if (mois >= 5 && mois <= 7) return 'ete';
  return 'automne';
}

/** Noms des jours, index 0 = lundi */
export const JOURS_NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Retourne le lundi de la semaine courante décalée de `offsetWeeks` semaines (YYYY-MM-DD) */
export function getMondayWithOffset(offsetWeeks = 0): string {
  // Ancrage à midi UTC → le jour ne bascule dans aucun fuseau (−11 h à +12 h)
  const d = new Date(`${getMondayParis()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}

/** Nombre de millisecondes dans une semaine (7 × 24 h) */
export const SEMAINE_MS = 7 * 24 * 3600 * 1000;

/** Offset en semaines d'un lundi ISO par rapport à la semaine courante (0 = courante) */
export function offsetOfSemaine(semaineDebut: string): number {
  const current = new Date(`${getMondayParis()}T12:00:00Z`).getTime();
  const target = new Date(`${semaineDebut}T12:00:00Z`).getTime();
  return Math.round((target - current) / SEMAINE_MS);
}

/**
 * Valide un paramètre d'URL ?semaine=YYYY-MM-DD et le normalise vers le lundi
 * de sa semaine (un lien copié contient déjà un lundi, mais une date tapée à
 * la main en milieu de semaine est acceptée et arrondie). null si invalide.
 */
export function parseSemaineParam(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  if (Number.isNaN(new Date(`${raw}T12:00:00`).getTime())) return null;
  return getMondayWithOffset(offsetOfSemaine(raw));
}

/** "12 – 18 mai" (même mois) ou "28 sept – 4 oct" — range lisible d'une semaine */
export function formatWeekRange(lundiIso: string): string {
  const start = new Date(`${lundiIso}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${fmt(end)}`
    : `${fmt(start)} – ${fmt(end)}`;
}

/** Entrée client `semaine_debut` : date ISO valide telle quelle, sinon lundi courant. */
export function semaineOuLundi(v: unknown): string {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T12:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)) return v;
  }
  return getMondayParis();
}

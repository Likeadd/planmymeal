// ============================================================================
// Configuration de localisation — PlanMyMeal
//
// Fondation i18n (audit P0.4) : le produit est français aujourd'hui, mais
// AUCUNE règle de formatage (devise, date, libellé) ne doit rester codée en
// dur dispersée dans le code. Tout passe par cette config :
//
//   - `formatPrix` (lib/budget.ts) lit CURRENCY ici — changer de devise
//     demain = changer une ligne, pas 40 occurrences de 'fr-FR'/'EUR' ;
//   - les libellés des rayons (useWeeklyPlan), des jours (moteur, composants)
//     et des intentions du jour viennent des dictionnaires FR du même dossier ;
//   - `TZ_APP` (lib/dates.ts) reste LA référence du fuseau de calcul — cette
//     config porte la locale d'AFFICHAGE, pas la sémantique de la semaine.
//
// Délibérément minimaliste : pas de framework i18n (0 dépendance, 0 impact
// bundle). Le jour où l'UI doit changer de langue au runtime, on branchera
// next-intl ou i18next sur ces mêmes dictionnaires.
// ============================================================================

/** Marchés prévus par la roadmap (§33) — la V1 n'en sert qu'un. */
export type CountryCode = 'FR' | 'BE' | 'CH' | 'ES' | 'IT' | 'DE' | 'GB' | 'US' | 'CA';

export interface LocaleConfig {
  /** Code pays du marché (pas celui du navigateur) */
  country: CountryCode;
  /** Locale BCP 47 pour Intl (devise, dates, nombre) */
  locale: string;
  /** Devise ISO 4217 */
  currency: string;
  /** Nom de la devise pour l'affichage textuel (« € », « $ »…) */
  currencySymbol: string;
  /** Fuseau de référence des semaines — délégué à lib/dates.ts (TZ_APP) */
  timezone: string;
  /** Unités légales principales du marché */
  units: {
    /** Poids (recettes + catalogue) */
    mass: 'g';
    /** Volume (recettes + catalogue) */
    volume: 'ml';
  };
}

/**
 * Config active — FR aujourd'hui. Une seule ligne à changer (ou une table
 * par pays plus tard) pour ouvrir un nouveau marché : le reste du code ne
 * connaît QUE cette constante.
 */
export const LOCALE_CONFIG: LocaleConfig = {
  country: 'FR',
  locale: 'fr-FR',
  currency: 'EUR',
  currencySymbol: '€',
  timezone: 'Europe/Paris',
  units: { mass: 'g', volume: 'ml' },
};

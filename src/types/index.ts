// ============================================================================
// Types partagés pour PlanMyMeal
// ============================================================================

export type Objectif = 'perte_poids' | 'maintien' | 'prise_masse' | 'sans_regime';
export type NiveauCuisine = 'debutant' | 'intermediaire' | 'expert';
export type PlanAbonnement = 'gratuit' | 'pro' | 'famille';

/**
 * Intention culinaire d'un jour : pilote le type de recette attendu.
 * - normal  : équilibré, aucune contrainte supplémentaire
 * - rapide  : recette express (≤ 25 min)
 * - leger   : repas léger (peu calorique)
 * - plaisir : on se fait plaisir (recettes aimées, plus généreuses)
 */
export type ContexteJour = 'normal' | 'rapide' | 'leger' | 'plaisir';
export const CONTEXTES_JOUR: { value: ContexteJour; label: string; emoji: string }[] = [
  { value: 'normal', label: 'Normal', emoji: '🍽️' },
  { value: 'rapide', label: 'Rapide', emoji: '⚡' },
  { value: 'leger', label: 'Léger', emoji: '🥗' },
  { value: 'plaisir', label: 'Plaisir', emoji: '🎉' },
];

/** Raisons proposées sous une note négative (« pourquoi ? ») */
export type RaisonNote =
  | 'trop_long' | 'trop_cher' | 'trop_complique' | 'pas_assez_bon'
  | 'trop_epice' | 'ingredients_introuvables' | 'famille' | 'autre';

export const RAISONS_NOTE: { value: RaisonNote; label: string }[] = [
  { value: 'trop_long', label: 'Trop long à cuisiner' },
  { value: 'trop_cher', label: 'Trop cher' },
  { value: 'trop_complique', label: 'Trop compliqué' },
  { value: 'pas_assez_bon', label: "Pas assez bon" },
  { value: 'trop_epice', label: 'Trop épicé' },
  { value: 'ingredients_introuvables', label: 'Ingrédients difficiles à trouver' },
  { value: 'famille', label: "La famille n'a pas aimé" },
  { value: 'autre', label: 'Autre' },
];

/**
 * Mémoire alimentaire d'une recette (table user_meal_preferences).
 * C'est ce que le moteur consulte AVANT de proposer une recette.
 */
export interface MealPreference {
  meal_id: number;
  /** 1 = ne plus jamais proposer … 5 = j'adore */
  note: number | null;
  /** Rotation souhaitée en jours (« environ tous les 20 jours ») */
  frequence_jours: number | null;
  /** Jour préféré 0=lundi..6=dimanche */
  jour_prefere: number | null;
  /** Créneau préféré */
  repas_prefere: RepasSlot | null;
  /** Bannissement définitif de la pioche */
  ne_plus_proposer: boolean;
}

/**
 * Relation d'un membre du foyer à un aliment.
 * 'interdit' = allergie, intolérance ou choix éthique → EXCLUSION DURE, jamais
 * négociée, exactement comme une allergie déclarée au niveau du compte.
 */
export type RelationIngredient = 'aime' | 'n_aime_pas' | 'interdit';

export const RELATIONS_INGREDIENT: { value: RelationIngredient; emoji: string; label: string }[] = [
  { value: 'aime', emoji: '❤️', label: "J'aime" },
  { value: 'n_aime_pas', emoji: '👎', label: "Je n'aime pas" },
  { value: 'interdit', emoji: '🚫', label: 'Interdit (allergie…)' },
];

/** Personne pour qui le foyer cuisine (table family_members) */
export interface MembreFamille {
  id: number;
  nom: string;
  emoji: string;
  /** Poids de ses goûts dans le compromis : 1 = souple … 5 = prioritaire */
  poids: number;
  age: number | null;
}

/** Mémoire d'un membre sur une recette */
export interface PreferenceMembre {
  meal_id: number;
  note: number | null;
  ne_plus_proposer: boolean;
}

/** Membre + ses relations (ce que renvoie /api/famille et ce que lit le moteur) */
export interface MembreFamilleComplet extends MembreFamille {
  aliments: { ingredient_id: number; relation: RelationIngredient; nom?: string }[];
  recettes: (PreferenceMembre & { titre?: string })[];
}

/** Niveaux de pondération d'un membre, avec leur effet concret */
export const POIDS_MEMBRE: { value: number; label: string; description: string }[] = [
  { value: 1, label: 'Souple', description: 'Ses goûts comptent peu dans le compromis.' },
  { value: 2, label: 'Modéré', description: 'Ses goûts pèsent, sans plus.' },
  { value: 3, label: 'Normal', description: 'Un membre comme un autre.' },
  { value: 4, label: 'Important', description: 'On cherche à lui faire plaisir.' },
  { value: 5, label: 'Prioritaire', description: 'Ses goûts passent en premier.' },
];

/** Emojis proposés pour représenter un membre */
export const EMOJIS_MEMBRE = ['👤', '🧑', '👨', '👩', '👦', '👧', '👶', '🧓', '🧔'] as const;

/** Ligne du garde-manger (table fridge_items) */
export interface FridgeItem {
  id: number;
  ingredient_id: number;
  ingredient?: { id: number; nom: string; rayon: string } | null;
  quantite: number;
  unite: string;
  expiration: string | null;
  updated_at: string;
}

/** Une ligne de l'explication « Pourquoi ce repas ? » */
export interface ExplicationLigne {
  emoji: string;
  texte: string;
}

export interface Explication {
  lignes: ExplicationLigne[];
  /** Nombre d'ingrédients de la recette déjà au frigo */
  ingredientsFrigo: number;
}

/** Appareils de cuisine pour le filtre équipement (moteur + catalogue) */
export const EQUIPEMENTS = [
  'Air fryer', 'Cookéo', 'Thermomix', 'Wok', 'Cocotte', 'Four',
  'Mixeur', 'Crêpière', 'Mandoline', 'Grille-pain', 'Micro-ondes', 'Cuit-vapeur',
] as const;
export type Equipement = (typeof EQUIPEMENTS)[number];
export type Regime =
  | 'vegan' | 'vegetarien' | 'pesco_vegetarien'
  | 'keto' | 'sans_gluten' | 'sans_lactose'
  | 'halal' | 'cacher' | 'sans_porc' | 'sans_alcool';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  nb_personnes: number;
  /** Budget hebdomadaire souhaité en € (nullable = non défini) */
  budget_hebdo: number | null;
  objectif: Objectif;
  calories_par_jour: number | null;
  niveau_cuisine: NiveauCuisine;
  temps_max_semaine: number;
  temps_max_weekend: number;
  cuisines_preferees: string[];
  plan: PlanAbonnement;
  onboarding_complete: boolean;
  batch_cooking: boolean;
  batch_cooking_jour: number; // 0=lundi..6=dimanche
  /** Cap strict (Pro) : l'algo ne sélectionne que des recettes ≤ ce prix/portion */
  prix_max_portion: number | null;
  /** Appareils possédés → boost des recettes compatibles, pénalité sinon */
  equipements: string[];
  /** Meal Prep Pro : déjeuners = restes du dîner de la veille après génération */
  auto_restes: boolean;
  /** Desserts ajoutés automatiquement aux semaines générées (3-4/semaine) */
  desserts_activees: boolean;
  /** Rythme des desserts (migration 00022) : aucun | leger | equilibre | gourmand */
  rythme_desserts: 'aucun' | 'leger' | 'equilibre' | 'gourmand';
  /** Temps de préparation max par jour (7 entrées, index 0=lundi) ; null = repli semaine/weekend */
  temps_max_par_jour: (number | null)[];
  /** Intention culinaire par jour (7 entrées) ; null = 'normal' */
  contexte_jours: (ContexteJour | null)[];
  /** Curseur Confort (0) ↔ Découverte (100) */
  nouveaute: number;
  /** Part du compromis familial dans le score (0 = mes goûts seuls, 100 = compromis maximal) */
  poids_famille: number;
  /** Dépense hebdomadaire DÉCLARÉE par l'utilisateur avant PlanMyMeal (€).
   *  Base du calcul des économies — nullable : le widget économies reste
   *  masqué tant que la base n'est pas saisie (jamais devinée). */
  depense_reference_hebdo: number | null;
  /** Date de la dernière saisie de la base (détection de péremption) */
  depense_reference_saisie_le: string | null;
  /** false = l'utilisateur a désactivé les emails transactionnels */
  emails_transactionnels: boolean;
  /** Timestamp d'envoi de l'email de bienvenue (anti-doublon) */
  welcome_email_envoye_le: string | null;
  /** semaine_debut du dernier digest hebdo envoyé (anti-doublon cron) */
  digest_envoye_le: string | null;
}

export type Rayon =
  | 'fruits_legumes' | 'epicerie_salee' | 'epicerie_sucree'
  | 'frais' | 'surgeles' | 'viande_poisson' | 'boissons'
  | 'boulangerie' | 'conserves' | 'epices';

export type Saison = 'ete' | 'hiver' | 'printemps' | 'automne' | 'toutes';
export type TypeRepas = 'entree' | 'plat' | 'dessert' | 'petit_dejeuner' | 'snack';
export type Difficulte = 'facile' | 'moyen' | 'difficile';
export type Unite = 'g' | 'ml' | 'pcs' | 'cac' | 'cas' | 'pincee' | 'sachet' | 'boite' | 'botte' | 'tranche';
export type MealStatus = 'planned' | 'cooked' | 'skipped' | 'liked' | 'disliked';

export interface Ingredient {
  id: number;
  nom: string;
  rayon: Rayon;
  saison: Saison;
  prix_estime: number | null;
  /** Prix de référence en € pour l'unité unite_prix (ex : 2.4 €/kg) */
  prix_unitaire: number | null;
  /** Unité de référence du prix : 'kg' | 'L' | 'pcs' | 'botte' | 'boite' | 'sachet' */
  unite_prix: string | null;
  /**
   * Poids en grammes d'UNE unité non massique, par unité (voir `lib/unites.ts`) :
   * `{ pcs: 180, cas: 10 }`. NULL = aucune conversion possible.
   */
  poids_unites: Record<string, number> | null;
}

export interface IngredientQuantity {
  ingredient: Ingredient;
  quantite: number;
  unite: Unite;
  est_optionnel: boolean;
}

export interface Meal {
  id: number;
  titre: string;
  description: string | null;
  type_repas: TypeRepas;
  temps_preparation: number;
  temps_cuisson: number | null;
  difficulte: Difficulte;
  saison: Saison;
  cuisine: string | null;
  calories_par_portion: number | null;
  proteines: number | null;
  glucides: number | null;
  lipides: number | null;
  /**
   * Macros calculées depuis la composition ET croyables (voir
   * `meals.macros_verifiables` et `RecetteMoteur`). Reproduit la colonne pour
   * que `Meal` reste un sur-ensemble de `RecetteMoteur`.
   */
  macros_verifiables: boolean;
  fibres: number | null;
  conservation_jours: number | null;
  /** Ustensiles nécessaires (poêle, fouet, air fryer, four...) */
  ustensiles: string[];
  instructions: string[];
  image_url: string | null;
  portions_par_defaut: number;
  created_by: string | null;
  is_public: boolean;
  ingredients?: IngredientQuantity[];
}

/**
 * Forme minimale d'un ingrédient pour le chiffrage : ce dont `prixEffectif` et
 * `quantiteAchetee` ont réellement besoin. Permet de chiffrer une recette
 * partielle (sans `rayon`, `saison`, `prix_estime`) sans exiger un `Ingredient`
 * complet — c'est le cas d'une ligne de catalogue.
 */
export type IngredientChiffrable = Pick<Ingredient, 'id' | 'prix_unitaire' | 'unite_prix'> & {
  /**
   * Optionnel : un embed qui ne le demande pas reste valide, mais la ligne
   * devient non chiffrable dès qu'une conversion d'unité serait nécessaire.
   * C'est ce qui permet aux requêtes de s'alléger sans casser le chiffrage —
   * et le compilateur ne peut pas l'exiger, donc `verifier-colonnes.ts`
   * vérifie la colonne. Voir `COLONNES_INGREDIENTS`.
   */
  poids_unites?: Record<string, number> | null;
};

/**
 * Forme minimale d'une recette pour le chiffrage (`prixRecette`,
 * `prixParPortion`). `ingredients` reste optionnel : un embed rompu ne doit pas
 * faire échouer le chiffrage, il le rend simplement incomplet.
 */
export interface RecetteChiffrable {
  portions_par_defaut: number;
  ingredients?: {
    quantite: number;
    unite: string;
    est_optionnel: boolean;
    ingredient: IngredientChiffrable;
  }[];
}

/**
 * Ingrédient tel que renvoyé par l'embed du catalogue : les colonnes utiles au
 * chiffrage plus le nom (pour les pastilles du foyer), rien d'autre.
 */
export type IngredientCarte = IngredientChiffrable & { nom: string };

/**
 * Une ligne d'ingrédient embarquée avec `nom` : forme partagée par le catalogue
 * et le vivier de suggestions.
 */
export interface LigneIngredient {
  quantite: number;
  unite: string;
  est_optionnel: boolean;
  ingredient: IngredientCarte;
}

/**
 * Forme minimale d'une recette pour les pastilles du foyer : son identifiant et
 * ses ingrédients (id + nom). Un `Meal` complet y est assignable, et une ligne
 * de catalogue partielle aussi — c'est ce qui permet d'afficher les mêmes
 * pastilles sur le planning, le catalogue et les favoris.
 */
export interface RecetteFoyer {
  id: number;
  ingredients?: { ingredient: { id: number; nom: string } }[];
}

/**
 * Colonnes nécessaires à la modale de remplacement d'un repas : le titre, les
 * temps, les calories et les ingrédients (le nom alimente les filtres express
 * dessert, le prix le tri affiché). Ni `instructions`, ni `image_url`, ni les
 * macros : la modale ne les affiche jamais.
 */
/**
 * Base de toute recette affichée dans une LISTE (planning, favoris).
 *
 * Volontairement dépourvue de `instructions`, `image_url`, `description`, des
 * macros détaillées, `saison`, `created_by` et `is_public` : ce sont les postes
 * les plus lourds du catalogue (1 Mo d'`instructions` à lui seul) et aucune
 * carte ne les affiche. La fiche recette `/recette/[id]` a sa propre requête.
 *
 * Chaque champ ci-dessous est lu par au moins une carte :
 *   • id, titre, temps_preparation, temps_cuisson, calories_par_portion, difficulte
 *     → affichés par `MealCard` (mobile), `WeekColumns` (desktop) et la carte
 *       des favoris ; les temps aussi additionnés par `SummaryBar` ;
 *   • ingredients → `prixParPortion` (prix affiché) et `FamilleBadges` (avis du foyer).
 */
export interface RecetteCarte {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  difficulte: Difficulte;
  ingredients?: LigneIngredient[];
}

/**
 * Recette telle que chargée pour le planning hebdomadaire.
 *
 * En plus de la base :
 *   • ustensiles → `MealCard` liste les ustensiles non basiques ;
 *   • portions_par_defaut → `prixParPortion` (prix par portion affiché).
 *
 * `type_repas` n'y figure PAS : le créneau (déjeuner, dîner, dessert) vient de
 * `plan_meals.repas_type`, donc les cartes n'ont pas besoin de le relire.
 */
export interface RecettePlanning extends RecetteCarte {
  ustensiles: string[];
  portions_par_defaut: number;
}

/**
 * Recette telle que chargée pour la page Favoris.
 *
 * En plus de la base :
 *   • type_repas → filtre « déjeuner / dîner / dessert » de la page ;
 *   • cuisine → badge de cuisine ;
 *   • conservation_jours → badge « se conserve Nj ».
 *
 * `ustensiles` et `portions_par_defaut` n'y figurent PAS : la carte des favoris
 * ne les affiche pas et ne calcule pas de prix.
 */
export interface RecetteFavori extends RecetteCarte {
  type_repas: TypeRepas;
  cuisine: string | null;
  conservation_jours: number | null;
}

/**
 * Recette telle que chargée pour l'historique de la page Planning — le plus
 * étroit des types de recette.
 *
 * La vue n'affiche qu'une ligne par repas : titre cliquable, temps, calories
 * (`MealMini`). Ni ingrédients, ni ustensiles, ni prix. Ce n'est pas de
 * l'optimisation de confort : cette requête charge **toutes les semaines**
 * enregistrées d'un coup, donc les ingrédients y pèsent leur poids multiplié
 * par le nombre de semaines.
 */
export interface RecetteResume {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
}

export interface RecetteSwap extends RecetteChiffrable {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  ingredients: LigneIngredient[];
}

/**
 * Recette telle que chargée par le MOTEUR de rotation — le superset des types
 * de carte, parce qu'un moteur a besoin de tout ce qui alimente une DÉCISION,
 * et pas seulement de ce qui s'affiche :
 *
 *   • type_repas → `isDessert` (un dessert ne remplit jamais un créneau principal) ;
 *   • saison → facteur saison de `calculateMealScore` ;
 *   • cuisine → cuisine préférée ×1.2 et diversité culinaire en fallback ;
 *   • conservation_jours → facteur batch cooking.
 *
 * `expliquerChoix` prend le MÊME type, et c'est volontaire : « Pourquoi ce
 * repas ? » ne peut alors pas s'appuyer sur une donnée que le moteur n'a pas
 * utilisée — la cohérence entre la décision et son explication n'est pas une
 * discipline de relecture, c'est le compilateur.
 *
 * Un `Meal` complet reste assignable : le moteur ne l'exige plus, les appelants
 * existants (tests, scripts) n'ont pas à changer.
 */
export interface RecetteMoteur extends RecettePlanning {
  type_repas: TypeRepas;
  saison: Saison;
  cuisine: string | null;
  conservation_jours: number | null;
  /**
   * Les calories ont-elles été CALCULÉES depuis la composition et jugées
   * croyables ? `false` = valeur d'auteur, ou recalcul refusé (composition
   * inconvertible, total invraisemblable, ingrédient sans coefficients).
   *
   * Présent ici et pas ailleurs pour la même raison que `type_repas` : le score
   * de légèreté lit les calories, donc une recette dont les calories ne sont pas
   * fiables ne peut pas être jugée légère — sans ce champ, le moteur noterait au
   * hasard un plat sur une donnée qu'il ne peut pas vérifier.
   */
  macros_verifiables: boolean;
}

/**
 * Recette telle que chargée par `/api/vider-le-frigo`.
 *
 * La route ne classe que des recettes rapides et n'a aucune idée du repas de
 * la journée : `type_repas`, `saison`, `conservation_jours` et les calories lui
 * sont inutiles (le classement se fait sur la couverture du frigo et le prix).
 * En plus de `RecettePlanning` : `cuisine` (affichée sur la carte) et
 * `image_url`.
 */
export interface RecetteFrigo extends RecettePlanning {
  cuisine: string | null;
  image_url: string | null;
}

/** Créneaux du planning : 2 repas principaux + desserts optionnels (soir + midi) */
export type RepasSlot = 'dejeuner' | 'diner' | 'dessert' | 'dessert_midi';

export interface DayPlan {
  jour: string;
  jourIndex: number;
  /**
   * Recettes du créneau, telles que chargées par `useWeeklyPlan`.
   * `RecettePlanning` et non `Meal` : le planning ne charge que les colonnes
   * affichées (voir `RecettePlanning`), et ce type empêche une carte de lire un
   * champ qui n'est plus chargé — une lecture manquante ne planterait pas, elle
   * afficherait `undefined`.
   */
  dejeuner: RecettePlanning | null;
  diner: RecettePlanning | null;
  /** Dessert optionnel du dîner (ajouté par le moteur, retirable via swap) */
  dessert: RecettePlanning | null;
  /** Dessert optionnel du déjeuner (yaourt, fruits... — ajouté par le moteur, retirable via swap) */
  dessertMidi: RecettePlanning | null;
  /** Restes : si le déjeuner est le reste du dîner de la veille → meal_id du dîner source */
  restesDe?: number | null;
}

/**
 * Même forme que `DayPlan`, avec des recettes réduites à une ligne de résumé
 * (voir `RecetteResume`). Utilisé par l'historique de la page Planning.
 */
export interface DayPlanResume extends Omit<DayPlan, 'dejeuner' | 'diner' | 'dessert' | 'dessertMidi'> {
  dejeuner: RecetteResume | null;
  diner: RecetteResume | null;
  dessert: RecetteResume | null;
  dessertMidi: RecetteResume | null;
}
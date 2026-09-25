// ============================================================================
// Abstraction AIProvider — PlanMyMeal
//
// Règle 34 du produit : le code métier ne doit JAMAIS dépendre directement
// d'un fournisseur LLM. Tout passe par cette interface :
//
//   métier → AIProvider (cette interface) → adapter (Anthropic aujourd'hui,
//   OpenAI / DeepSeek / modèle local demain)
//
// Deux primitives suffisent pour tous les cas d'usage prévus (import de
// recette, assistant, photo du frigo, ticket de caisse) :
//
//   - `generateText`  : texte libre (résumés, reformulations, assistant) ;
//   - `generateJson`  : SORTIE STRUCTURÉE validée par un vérificateur passé
//     en argument — la porte d'entrée obligatoire de toute donnée métier
//     produite par un LLM (règle 35 : jamais d'écriture aveugle en base).
//
// La validation est la responsabilité de l'APPELANT (schéma par cas d'usage),
// pas du provider : un provider ne peut pas savoir ce qu'est « une recette ».
// ============================================================================

/**
 * Vérifie qu'une valeur unknown a la forme attendue et la transforme.
 * Retourne null (jamais de throw) : le provider peut alors retenter ou
 * renvoyer une erreur métier propre, sans stack trace de validation.
 */
export type Validateur<T> = (valeur: unknown) => T | null;

export interface GenerateTextOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateJsonOptions<T> extends GenerateTextOptions {
  /**
   * Nombre de tentatives quand la sortie n'est pas valide (le JSON est
   * tronqué, le modèle ignore le format…). Défaut 1.
   */
  retries?: number;
  /** Vérificateur de forme — obligatoire pour toute donnée métier. */
  validate: Validateur<T>;
}

export interface AIProvider {
  /** Nom court du fournisseur (logs, observabilité, routage) */
  readonly nom: string;

  /** Texte libre. Jette une AIError en cas d'échec transport/quotas. */
  generateText(prompt: string, options?: GenerateTextOptions): Promise<string>;

  /**
   * Sortie JSON validée. Retourne null si, après `retries` tentatives, le
   * modèle n'a produit aucune réponse passant `validate` — l'appelant décide
   * alors du comportement métier (repli, message utilisateur…).
   */
  generateJson<T>(prompt: string, options: GenerateJsonOptions<T>): Promise<T | null>;
}

/** Erreur transport/quotas — DISTINCTE d'une sortie non valide (null). */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/** Résout le provider actif (env) — import paresseux pour ne rien payer côté client. */
export async function getAIProvider(): Promise<AIProvider> {
  const { getAnthropicProvider } = await import('./anthropic');
  return getAnthropicProvider();
}

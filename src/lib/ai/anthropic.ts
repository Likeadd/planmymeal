// ============================================================================
// Adaptateur Anthropic — implémentation AIProvider
//
// Seul endroit du codebase qui connaît Anthropic. Le jour où un second
// fournisseur arrive (OpenAI, DeepSeek, modèle local), on écrit son adaptateur
// à côté et le routage se fait dans getAIProvider() — le code métier, lui,
// ne change JAMAIS.
//
// Extractibilité du JSON : le modèle renvoie le contenu dans un bloc texte.
// On tolère un bloc ```json … ``` et les ornementations de prose autour, puis
// on isole le premier objet/tableau équilibré — robuste sans parser HTML ni
// dépendre d'une fonctionnalité beta du SDK.
// ============================================================================

import {
  AIError,
  type AIProvider,
  type GenerateJsonOptions,
  type GenerateTextOptions,
  type Validateur,
} from './provider';

// Sonnet actuel : même gamme que le modèle d'origine (claude-sonnet-4-5), moins
// cher ($2/$10 au lieu de $3/$15 par million de tokens). Changements d'API
// pris en compte ci-dessous : réflexion adaptative toujours active (on règle
// l'effort, pas la réflexion), `temperature` non par défaut refusée (400),
// arrêt `refusal` possible.
const MODELE = 'claude-sonnet-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
// La réflexion compte dans max_tokens : marge large (requête non streamée).
const MAX_SORTIE = 16000;

interface ReponseMessages {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
}

/** Extrait le premier bloc JSON équilibré d'un texte (objet ou tableau). */
export function extraireJson(texte: string): string | null {
  // Retirer un éventuel ```json … ``` (le contenu peut lui-même contenir ```)
  const bloc = /```(?:json)?\s*([\s\S]*?)```/.exec(texte);
  const candidat = (bloc ? bloc[1] : texte).trim();

  const debut = candidat.search(/[{[]/);
  if (debut === -1) return null;

  const ouvrant = candidat[debut];
  const fermant = ouvrant === '{' ? '}' : ']';
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;

  for (let i = debut; i < candidat.length; i++) {
    const c = candidat[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === '\\') echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === ouvrant) profondeur++;
    else if (c === fermant) {
      profondeur--;
      if (profondeur === 0) return candidat.slice(debut, i + 1);
    }
  }
  return null; // JSON tronqué ou déséquilibré
}

/** Appelle l'API Messages et renvoie le texte concaténé. */
async function appeler(
  apiKey: string,
  prompt: string,
  options: GenerateTextOptions
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // Repli côté serveur si le modèle décline la requête (catégorie de refus
      // gérée par l'API, aucune liste de modèles à maintenir).
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: options.maxTokens ?? MAX_SORTIE,
      // `temperature` n'est plus envoyée : une valeur non par défaut renvoie
      // une erreur 400 sur ce modèle (options.temperature reste ignorée).
      // Extraction structurée simple → effort bas : moins de tokens, plus rapide.
      output_config: { effort: 'low' },
      fallbacks: 'default',
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const corps = await res.text().catch(() => '');
    throw new AIError(
      `Anthropic ${res.status} : ${corps.slice(0, 300)}`,
      res.status
    );
  }

  const data = (await res.json()) as ReponseMessages;
  // Requête déclinée (et repli déclinant aussi) : aucune recette à extraire.
  if (data.stop_reason === 'refusal') return '';
  return (data.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');
}

class AnthropicProvider implements AIProvider {
  readonly nom = 'anthropic';

  constructor(private readonly apiKey: string) {}

  async generateText(prompt: string, options: GenerateTextOptions = {}): Promise<string> {
    return appeler(this.apiKey, prompt, options);
  }

  async generateJson<T>(prompt: string, options: GenerateJsonOptions<T>): Promise<T | null> {
    const retries = options.retries ?? 1;
    const validate: Validateur<T> = options.validate;
    let derniereErreur: AIError | null = null;

    for (let tentative = 0; tentative <= retries; tentative++) {
      let texte: string;
      try {
        texte = await appeler(this.apiKey, prompt, options);
      } catch (e) {
        // Erreur transport : on ne rejoue pas un 401/400 (idempotence inutile),
        // on remonte immédiatement.
        if (e instanceof AIError && e.status != null && e.status < 500) throw e;
        derniereErreur = e instanceof AIError ? e : new AIError(String(e));
        continue;
      }

      const json = extraireJson(texte);
      if (json == null) continue;

      let parse: unknown;
      try {
        parse = JSON.parse(json);
      } catch {
        continue;
      }

      const valide = validate(parse);
      if (valide !== null) return valide;
      // Sortie valide en JSON mais pas en forme → nouvelle tentative
    }

    if (derniereErreur) throw derniereErreur;
    return null;
  }
}

/** Provider Anthropic, ou null si la clé n'est pas configurée. */
export function getAnthropicProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIError(
      'ANTHROPIC_API_KEY manquante — configurez-la pour activer les fonctions IA.'
    );
  }
  return new AnthropicProvider(apiKey);
}

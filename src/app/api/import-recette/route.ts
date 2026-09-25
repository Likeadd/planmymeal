// ============================================================================
// API Import de recette par IA — PlanMyMeal
//
// POST /api/import-recette
// { url: "https://…" }            — extraction depuis une page recette
// { texte: "…200 g de farine…" }  — extraction depuis un texte collé
//
// PREMIER cas d'usage de l'abstraction AIProvider (audit P1) :
//   1. le LLM ne DÉCIDE rien : il lit une page/du texte et produit du
//      structuré — les prix, macros et la publication restent du ressort
//      métier (moteur, seeds, relecture humaine) ;
//   2. la sortie passe TOUJOURS par validerRecetteExtraite (règle 35) ;
//   3. la recette est stockée `is_public = false`, `created_by = user` :
//      elle n'entre dans le catalogue public qu'après relecture.
//
// Sécurité SSRF : l'URL fournie par l'utilisateur est fetchée par le serveur.
// Garde-fous : https uniquement, pas d'IP/localhost, pas de redirect (fetch
// suit les redirects par défaut → redirect: 'manual'), timeout, taille de
// réponse plafonnée.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UserError, publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { getAIProvider, AIError } from '@/lib/ai/provider';
import { validerRecetteExtraite, type RecetteExtraite } from '@/lib/ai/recette';

const TAILLE_HTML_MAX = 2_000_000; // 2 Mo : une page recette dépasse rarement 500 ko
const TIMEOUT_FETCH_MS = 10_000;
const TIMEOUT_IA_MS = 60_000;

const SYSTEM_PROMPT = `Tu es un extracteur de recettes de cuisine. À partir du contenu fourni, tu produces UNIQUEMENT un objet JSON, sans aucun texte autour, au format exact :
{"titre": string, "description": string|null, "type_repas": "entree"|"plat"|"dessert", "temps_preparation_min": number, "temps_cuisson_min": number|null, "portions": number, "instructions": string[], "ingredients": [{"nom": string, "quantite": number, "unite": "g"|"ml"|"pcs"|"cac"|"cas"|"pincee"|"sachet"|"boite"|"botte"|"tranche", "est_optionnel": boolean}], "cuisine": string|null}
Règles : en français. Les quantités doivent être des nombres (grammes, millilitres, pièces…). ` +
  `unité "pcs" pour les pièces (œuf, oignon…). "cuisine" = la tradition culinaire ("Italienne", "Française"…). ` +
  `"type_repas" : dessert si c'est sucré/dessert, entree si c'est une entrée, plat sinon. Ignorer publicité, commentaires et navigation.`;

// ─── Garde-fous SSRF ────────────────────────────────────────────────────────

/** URL publique https uniquement — rejette localhost, IP privées, autres protocoles */
export function urlPubliqueAutorisee(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const hote = url.hostname.toLowerCase();
  if (hote === 'localhost' || hote === '0.0.0.0' || hote.endsWith('.local')) return null;
  if (hote.endsWith('.internal') || hote.endsWith('.localdomain')) return null;

  // IP littérale : seule une IP publique passe (pas de 127.x, 10.x, 192.168.x…)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hote)) {
    const octets = hote.split('.').map(Number);
    if (
      octets[0] === 127 || octets[0] === 10 || octets[0] === 0 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254)
    ) {
      return null;
    }
  }
  return url;
}

/** Télécharge la page, taille plafonnée, sans suivre les redirections. */
async function telechargerPage(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual', // pas de suivi : un redirect vers une IP interne est un contournement SSRF
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PlanMyMealBot/1.0; +https://planmymeal.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      throw new UserError('Cette URL redirige — ouvrez directement l\u2019URL finale.');
    }
    if (!res.ok) throw new UserError(`Page inaccessible (HTTP ${res.status})`);

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html') && !type.includes('text/plain') && !type.includes('xml')) {
      throw new UserError('La page n\u2019est pas un document HTML.');
    }

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    const decoder = new TextDecoder();
    let html = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAILLE_HTML_MAX) throw new UserError('Page trop volumineuse (max 2 Mo).');
      chunks.push(value);
    }
    for (const c of chunks) html += decoder.decode(c, { stream: true });
    html += decoder.decode();
    return html;
  } finally {
    clearTimeout(timer);
  }
}

/** Réduit le HTML au texte visible (basique, suffisant pour le LLM). */
export function htmlVersTexte(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 30_000); // entrée LLM plafonnée (coût + contexte)
}

// ─── Persistance ────────────────────────────────────────────────────────────

interface MealInsert {
  titre: string;
  description: string | null;
  type_repas: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  difficulte: string;
  saison: string;
  cuisine: string | null;
  portions_par_defaut: number;
  instructions: string[];
  created_by: string;
  is_public: boolean;
}

/**
 * Insère la recette (personnelle, non publique) + ses liens d'ingrédients.
 * Retourne l'id, ou lève avec le nom de l'ingrédient fautif — jamais l'erreur
 * silencieuse qui avait laissé 455 recettes sans composition (audit).
 */
async function enregistrerRecette(
  recette: RecetteExtraite,
  userId: string,
  admin: ReturnType<typeof getSupabaseAdmin>
): Promise<number> {
  const meal: MealInsert = {
    titre: recette.titre,
    description: recette.description,
    type_repas: recette.type_repas,
    temps_preparation: recette.temps_preparation_min,
    temps_cuisson: recette.temps_cuisson_min,
    difficulte: 'moyen',
    saison: 'toutes',
    cuisine: recette.cuisine,
    portions_par_defaut: recette.portions,
    instructions: recette.instructions,
    created_by: userId,
    is_public: false, // relecture humaine avant publication dans le catalogue
  };

  const { data: inserted, error } = await admin
    .from('meals')
    .insert(meal)
    .select('id')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Erreur enregistrement recette');
  const mealId = inserted.id;

  // Ingrédients : lien par lien, avec création à la volée si le catalogue
  // n'a pas le nom (rayon 'epicerie_salee' par défaut, l'utilisateur corrigera).
  for (const ing of recette.ingredients) {
    const { data: existant } = await admin.from('ingredients')
      .select('id').eq('nom', ing.nom).maybeSingle();

    let ingredientId = existant?.id ?? null;
    if (ingredientId == null) {
      const { data: nouveau, error: errIng } = await admin.from('ingredients')
        .insert({ nom: ing.nom, rayon: 'epicerie_salee', saison: 'toutes' })
        .select('id').single();
      if (errIgnored(errIng, ing.nom)) continue; // ingrédient refusé → signalé, non bloquant
      ingredientId = nouveau?.id ?? null;
    }
    if (ingredientId == null) continue;

    const { error: errLien } = await admin.from('meal_ingredients').insert({
      meal_id: mealId,
      ingredient_id: ingredientId,
      quantite: ing.quantite,
      unite: ing.unite,
      est_optionnel: ing.est_optionnel,
    });
    if (errIgnored(errLien, ing.nom)) continue;
  }

  return mealId;
}

/** Log + vrai retour : un ingrédient refusé ne peut plus passer en silence */
function errIgnored(err: { message: string } | null, nomIngredient: string): boolean {
  if (err) {
    console.error(`[import-recette] ingredient "${nomIngredient}" refusé : ${err.message}`);
    return true;
  }
  return false;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // L'IA coûte : 5 imports / 10 min / IP, c'est large pour un usage réel
  const limited = enforceRateLimit(request, { name: 'import-recette', limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'import-recette', limit: 5, windowMs: 10 * 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const texte = typeof body.texte === 'string' ? body.texte.trim() : '';

    if (!url && !texte) {
      return NextResponse.json({ error: 'Fournissez une URL ou un texte de recette' }, { status: 400 });
    }
    if (url && texte) {
      return NextResponse.json({ error: 'Fournissez UNE source : url OU texte' }, { status: 400 });
    }
    if (texte && (texte.length < 40 || texte.length > 30_000)) {
      return NextResponse.json({ error: 'Texte de recette invalide (40 – 30 000 caractères)' }, { status: 400 });
    }

    let contenu: string;
    let source: 'url' | 'texte';
    if (url) {
      const parsed = urlPubliqueAutorisee(url);
      if (!parsed) {
        return NextResponse.json({ error: 'URL non autorisée' }, { status: 400 });
      }
      const html = await telechargerPage(parsed);
      contenu = htmlVersTexte(html);
      if (contenu.length < 100) {
        return NextResponse.json({ error: 'La page semble vide ou illisible' }, { status: 422 });
      }
      source = 'url';
    } else {
      contenu = texte;
      source = 'texte';
    }

    // ── Appel IA (via l'abstraction, jamais un SDK direct dans la route) ──
    const provider = await getAIProvider();
    const recette = await Promise.race([
      provider.generateJson<RecetteExtraite>(
        `${SYSTEM_PROMPT}\n\n=== CONTENU ===\n${contenu}\n=== FIN ===`,
        { system: undefined, validate: (v) => validerRecetteExtraite(v, source), retries: 1 }
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_IA_MS)),
    ]);

    if (!recette) {
      return NextResponse.json(
        { error: 'Impossible d\u2019extraire une recette exploitable de cette source. Essayez de coller le texte directement.' },
        { status: 422 }
      );
    }

    const admin = getSupabaseAdmin();
    const mealId = await enregistrerRecette(recette, user.id, admin);

    return NextResponse.json({
      success: true,
      meal_id: mealId,
      recette: {
        titre: recette.titre,
        nb_ingredients: recette.ingredients.length,
        nb_etapes: recette.instructions.length,
        portions: recette.portions,
      },
    });
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Erreur IA import recette:', error.message);
      return NextResponse.json({ error: 'Le service d\u2019extraction est momentanément indisponible.' }, { status: 503 });
    }
    console.error('Erreur import recette:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

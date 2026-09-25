// ============================================================================
// GÉNÉRATION D'IMAGES POUR LES RECETTES — Pollinations.ai (gratuit, sans clé)
// Usage : npm run images                          (toutes les recettes sans image)
//         npm run images -- --limit=5             (test sur 5 recettes)
//         npm run images -- --id=12               (une seule recette)
//         npm run images -- --force               (régénère même si image_url existe)
//         npm run images -- --dry-run             (affiche les prompts sans générer)
//
// Aucune clé API requise : Pollinations génère l'image directement via l'URL.
// Modèle par défaut : flux (photoréalisme). Fallback automatique si un modèle
// échoue. Voir https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' }); // Priorité : les clés locales du projet
config(); // Secours : .env

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const BUCKET = 'meal-images';
const IMAGE_W = 1024;
const IMAGE_H = 768; // ratio 4:3, comme avant avec Gemini

// ── Args CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const match = args.find(a => a.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : undefined;
};
const LIMIT = getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined;
const ONLY_ID = getArg('id') ? parseInt(getArg('id')!, 10) : undefined;
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');

// ── Style commun + variations déterministes (cohérence ET variété) ─────────
// Une base commune garantit un rendu "catalogue" cohérent ; les variations
// (angle, surface, lumière, vaisselle, garniture) sont tirées de façon
// DÉTERMINISTE via l'ID de la recette → deux recettes voisines n'auront
// jamais le même combo, et une régénération redonne le même style.

const BASE_STYLE = `Professional food photography, shot on a full-frame camera with an 85mm lens, shallow depth of field, appetizing and realistic, soft shadows, high-end cookbook quality.`;

const ANGLES = [
  'three-quarter hero shot at table level',
  '45-degree angle close-up',
  'overhead flat lay composition',
  'low side angle highlighting the food textures',
  'slightly elevated 30-degree angle',
];

const SURFACES = [
  'a light wooden table',
  'a dark walnut wood table',
  'a white marble countertop',
  'a rustic slate surface',
  'a beige linen tablecloth',
  'a pale concrete surface',
];

const LIGHTS = [
  'bright airy natural window light',
  'warm golden hour side light',
  'soft diffused light with gentle shadows',
  'backlit with a subtle rim light and light steam rising from the dish',
];

const PLATES = [
  'a rustic ceramic plate',
  'a white porcelain plate',
  'a matte stoneware plate',
  'a shallow ceramic bowl',
  'a cast iron skillet',
  'an enamel plate',
];

const GARNISH_STYLES = [
  'a few raw ingredients from the recipe artfully placed around the plate as props',
  'a small linen napkin and a fork beside the plate',
  'fresh herbs sprinkled as garnish, a glass of water slightly out of focus in the background',
  'the sauce drizzled artistically on top, a pinch of cracked pepper',
  'extra ingredients in a small bowl in the background, slightly out of focus',
];

// Props spécifiques par cuisine → ancre visuelle culturelle
const CUISINE_PROPS: Record<string, string> = {
  'Française': 'props: a piece of baguette, fresh herbs, a small jar of mustard',
  'Italienne': 'props: basil leaves, an olive oil bottle, cherry tomatoes, grated parmesan',
  'Japonaise': 'props: wooden chopsticks, a small soy sauce dish, sesame seeds, minimalist styling',
  'Indienne': 'props: small copper bowls of spices, fresh coriander, naan bread',
  'Asiatique': 'props: a bamboo mat, chopsticks, spring onions, a small bowl of soy sauce',
  'Mexicaine': 'props: terracotta dishes, lime wedges, a bowl of fresh salsa, cilantro',
  'Méditerranéenne': 'props: an olive branch, lemon halves, olive oil',
  'Orientale': 'props: brass details, mint leaves, cinnamon sticks and cumin',
  'Américaine': 'props: a checkered cloth, pickles, a glass of iced drink',
  'Britannique': 'props: malt vinegar, a few peas, a folded newspaper detail',
};

// Présentation adaptée au type de repas
const TYPE_STYLING: Record<string, string> = {
  plat: 'generous main course presentation',
  entree: 'small refined appetizer presentation',
  dessert: 'elegant dessert presentation on a small plate',
  petit_dejeuner: 'breakfast setting with a morning mood',
  snack: 'casual finger food presentation',
};

interface MealForPrompt {
  id: number;
  titre: string;
  cuisine: string | null;
  type_repas?: string | null;
}

function buildPrompt(meal: MealForPrompt): string {
  const { id, titre, cuisine, type_repas } = meal;
  // Décalages différents par tableau pour que deux recettes voisines
  // ne retombent jamais sur le même combo complet.
  const pick = <T,>(arr: T[], offset: number): T => arr[(id + offset) % arr.length];
  const plat = cuisine ? `${titre} (${cuisine} cuisine)` : titre;

  const styleParts = [
    BASE_STYLE,
    `${pick(ANGLES, 0)}, plated on ${pick(PLATES, 3)} on ${pick(SURFACES, 1)}`,
    pick(LIGHTS, 2),
    pick(GARNISH_STYLES, 4),
    cuisine ? CUISINE_PROPS[cuisine] : undefined,
    type_repas ? TYPE_STYLING[type_repas] : undefined,
  ].filter(Boolean).join(', ');

  return `Photorealistic photograph of a finished dish: ${plat}. ${styleParts}. The food must look real and freshly cooked, no text, no watermarks, no people, no hands.`;
}

// ── Appel Pollinations (GET, image directement dans la réponse) ────────────
// L'API accepte aussi POST avec { prompt } — on utilise GET avec les params
// query pour rester simple et sans authentification.
function pollinationsUrl(prompt: string, seed: number): string {
  const params = new URLSearchParams({
    width: String(IMAGE_W),
    height: String(IMAGE_H),
    seed: String(seed),
    nologo: 'true',
    model: 'flux',
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

async function generateImage(prompt: string, baseSeed: number): Promise<{ buffer: Buffer; mime: string }> {
  // Seed déterministe par recette → régénérations cohérentes, mais on varie
  // le seed à chaque essai en cas d'échec pour éviter de retomber sur la
  // même instance surchargée.
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const url = pollinationsUrl(prompt, baseSeed + attempt * 17);
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        // Pollinations renvoie parfois du JSON d'erreur en 200 — on vérifie
        const text = await res.text();
        throw new Error(`Réponse non-image (${contentType}): ${text.slice(0, 200)}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5_000) {
        throw new Error(`Image suspecte (${buffer.length} octets), probablement une erreur`);
      }
      return { buffer, mime: contentType.split(';')[0] };
    }

    lastError = new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 5_000));
  }
  throw lastError ?? new Error('Échec après 3 tentatives');
}

// ── Supabase Storage ───────────────────────────────────────────────────────
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.id === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Création bucket: ${error.message}`);
    console.log(`🪣 Bucket "${BUCKET}" créé (public)`);
  }
}

async function uploadImage(mealId: number, buffer: Buffer, mime: string): Promise<string> {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const path = `meals/${mealId}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN — aucun appel API, aucun upload\n');
  }

  // Récupérer les recettes
  let query = supabase.from('meals').select('id, titre, cuisine, type_repas, image_url').order('id');
  if (ONLY_ID) query = query.eq('id', ONLY_ID);
  if (!FORCE && !ONLY_ID) query = query.is('image_url', null);

  const { data: meals, error } = await query;
  if (error) { console.error('❌ Supabase:', error.message); process.exit(1); }
  if (!meals || meals.length === 0) {
    console.log('✅ Toutes les recettes ont déjà une image (utilise --force pour régénérer).');
    return;
  }

  const selected = LIMIT ? meals.slice(0, LIMIT) : meals;
  console.log(`📸 ${selected.length} recette(s) à traiter\n`);

  if (!DRY_RUN) await ensureBucket();

  let ok = 0, fail = 0;
  for (const meal of selected) {
    const prompt = buildPrompt(meal);
    const baseSeed = meal.id * 7 + 1;
    console.log(`──────────────────────────────────────────`);
    console.log(`🍽  [${meal.id}] ${meal.titre}`);
    if (DRY_RUN) {
      console.log(`   seed: ${baseSeed}`);
      console.log(`   prompt: ${prompt.slice(0, 160)}...`);
      continue;
    }

    try {
      const { buffer, mime } = await generateImage(prompt, baseSeed);
      const url = await uploadImage(meal.id, buffer, mime);
      const { error: updateError } = await supabase.from('meals').update({ image_url: url }).eq('id', meal.id);
      if (updateError) throw new Error(`DB update: ${updateError.message}`);
      console.log(`   ✅ ${(buffer.length / 1024).toFixed(0)} Ko → ${url}`);
      ok++;
    } catch (err: any) {
      console.error(`   ❌ ${err.message}`);
      fail++;
    }

    // Pause anti rate-limit (Pollinations : ~1 req/s en anonyme)
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`📊 Terminé : ${ok} OK, ${fail} échec(s)`);
  if (fail > 0) console.log('   💡 Relance la commande : les recettes déjà traitées sont ignorées.');
  if (DRY_RUN) console.log('   (dry run — rien n\'a été généré)');
}

main().catch(err => { console.error('❌', err); process.exit(1); });

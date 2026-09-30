// ============================================================================
// Applique les photos VALIDÉES (scripts/photos-selection.json) aux recettes.
//
//   npm run photos:appliquer -- --dry-run     (ne modifie rien, vérifie tout)
//   npm run photos:appliquer                  (télécharge, envoie, écrit en base)
//   npm run photos:appliquer -- --ids=34,40   (une partie de la sélection)
//
// Pré-requis : migration 00032 appliquée (colonnes de crédit) et
// PIXABAY_API_KEY dans .env.local.
//
// Pixabay interdit les liens permanents vers ses URL : chaque image est donc
// téléchargée (version ≤ 1280 px fournie par l'API), redimensionnée puis
// hébergée dans notre bucket `meal-images`. L'attribution est stockée avec la
// recette et affichée sous la photo.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const IDS = args.find(a => a.startsWith('--ids='))?.slice(6).split(',').map(Number);

interface Selection {
  meal_id: number; titre: string; source: 'pixabay'; photo_id: string;
  auteur: string; auteur_url: string; page_url: string;
}

const BUCKET = 'meal-images';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

async function urlPixabay(photoId: string): Promise<string> {
  const cle = process.env.PIXABAY_API_KEY;
  if (!cle) throw new Error('PIXABAY_API_KEY manquante');
  const res = await fetch(`https://pixabay.com/api/?${new URLSearchParams({ key: cle, id: photoId })}`);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const json = (await res.json()) as { hits: { largeImageURL: string }[] };
  if (!json.hits[0]) throw new Error(`photo ${photoId} introuvable (supprimée ?)`);
  return json.hits[0].largeImageURL;
}

async function telecharger(url: string): Promise<Buffer> {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PlanMyMeal/1.0' } });
      if (res.ok) { const b = Buffer.from(await res.arrayBuffer()); await sharp(b).metadata(); return b; }
    } catch { /* nouvel essai */ }
    await pause(1500 * (i + 1));
  }
  throw new Error('téléchargement impossible');
}

(async () => {
  const selection = (JSON.parse(readFileSync('scripts/photos-selection.json', 'utf-8')) as Selection[])
    .filter(s => !IDS || IDS.includes(s.meal_id));

  // Migration 00032 appliquée ?
  const { error: erreurColonnes } = await supabase.from('meals').select('image_source, image_auteur').limit(0);
  if (erreurColonnes) {
    console.error('❌ Migration 00032 non appliquée :', erreurColonnes.message);
    console.error('   Exécutez supabase/migrations/00032_photos_recettes_credits.sql dans le SQL Editor.');
    process.exit(1);
  }

  let ok = 0;
  for (const s of selection) {
    try {
      const lien = await urlPixabay(s.photo_id);
      const brut = await telecharger(lien);
      const jpeg = await sharp(brut).resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      const chemin = `libres/${s.meal_id}-pixabay-${s.photo_id}.jpg`;
      console.log(`#${s.meal_id} ${s.titre} — ${(jpeg.length / 1024).toFixed(0)} ko — ${s.auteur}`);
      if (DRY_RUN) { ok++; await pause(400); continue; }

      const { error: erreurEnvoi } = await supabase.storage.from(BUCKET)
        .upload(chemin, jpeg, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (erreurEnvoi) throw erreurEnvoi;
      const { data: publique } = supabase.storage.from(BUCKET).getPublicUrl(chemin);

      const { error: erreurBase } = await supabase.from('meals').update({
        image_url: publique.publicUrl,
        image_source: s.source,
        image_auteur: s.auteur,
        image_auteur_url: s.auteur_url,
        image_page_url: s.page_url,
        image_licence: 'Pixabay Content License',
      }).eq('id', s.meal_id);
      if (erreurBase) throw erreurBase;
      ok++;
      await pause(600);
    } catch (e) {
      console.error(`  ❌ #${s.meal_id} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n${ok}/${selection.length} ${DRY_RUN ? 'vérifiées (dry-run)' : 'appliquées'}`);
})();

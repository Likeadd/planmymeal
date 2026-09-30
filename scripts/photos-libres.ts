// ============================================================================
// Photos libres de droits pour les recettes — API OFFICIELLES uniquement
// (aucun scraping : il violerait les conditions et ferait bloquer la clé).
//
// Phase 1 — chercher : interroge Pixabay (et Pexels / Unsplash si leurs clés
//   existent), écrit les candidats + une planche contact par recette dans un
//   dossier. NE TOUCHE NI LA BASE NI LE STOCKAGE.
//     npm run photos:chercher -- --ids=34,67,40 --dossier=./photos-test
//     npm run photos:chercher -- --limit=10
//
// Règles des API respectées :
//   • Pixabay : requêtes espacées (≤ 100/min), pas de téléchargement massif
//     systématique, pas de lien permanent vers leurs URL (à télécharger chez
//     nous à l'application), attribution.
//   • Requêtes dédupliquées par « plat de base » (les variantes partagent la
//     recherche) et espacées d'au moins 700 ms.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp, { type OverlayOptions } from 'sharp';

const args = process.argv.slice(2);
const arg = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const IDS = arg('ids')?.split(',').map(Number).filter(Boolean);
const LIMIT = arg('limit') ? Number(arg('limit')) : 10;
const DOSSIER = arg('dossier') ?? './photos-test';
// Mode lot : --lot=scripts/photos-lot2.json  (liste [[id, requête], …])
// produit des FEUILLES de PAR_FEUILLE plats (une ligne par plat) plus rapides à trier.
const LOT = arg('lot');
const MAX_PLATS = arg('max') ? Number(arg('max')) : Infinity;
const PAR_FEUILLE = 4;
// Mode familles : --familles=scripts/photos-familles.json  (liste [[nom, [requêtes]], …])
// Une planche par famille de plats : 10 candidats INÉDITS (photos déjà retenues exclues),
// pour attribuer des photos authentiques de la même famille aux recettes sans photo fidèle.
const FAMILLES = arg('familles');
const NB_CANDIDATS = arg('nb') ? Number(arg('nb')) : (arg('lot') ? 4 : 5);
const DEBUT = arg('debut') ? Number(arg('debut')) : 0; // saute les N premiers résultats
// Requêtes forcées : --q="22:tarte aux pommes|67:veal stew cream sauce"
const REQUETES_FORCEES = new Map(
  (arg('q') ?? '').split('|').filter(Boolean).map(p => [Number(p.split(':')[0]), p.split(':').slice(1).join(':')] as const)
);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface Candidat {
  source: 'pixabay' | 'pexels' | 'unsplash';
  id: string;
  apercu: string;       // miniature (planche contact)
  image: string;        // image utilisable (≥ 1000 px de large)
  pageUrl: string;      // page de la photo (attribution)
  auteur: string;
  auteurUrl: string;
  largeur: number;
  hauteur: number;
  tags: string;
}

/** Requête de recherche : le plat, sans variante ni accompagnement. */
export function requeteDepuisTitre(titre: string): string {
  return titre
    .split(/[,&(]/)[0]
    .replace(/\b(maison|express|légère?|facile|aux?|à la|au four)\b.*$/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
}

async function pixabay(q: string, choixEditeurs = false): Promise<Candidat[]> {
  const cle = process.env.PIXABAY_API_KEY;
  if (!cle) return [];
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({
    key: cle, q, lang: 'fr', image_type: 'photo', category: 'food', safesearch: 'true',
    orientation: 'horizontal', min_width: '1200', order: 'popular', per_page: '12',
    ...(choixEditeurs ? { editors_choice: 'true' } : {}),
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const json = (await res.json()) as { hits: Record<string, unknown>[] };
  return json.hits.map(h => ({
    source: 'pixabay' as const,
    id: String(h.id),
    apercu: String(h.webformatURL),
    image: String(h.largeImageURL),
    pageUrl: String(h.pageURL),
    auteur: String(h.user),
    auteurUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
    largeur: Number(h.imageWidth),
    hauteur: Number(h.imageHeight),
    tags: String(h.tags),
  }));
}

async function pexels(q: string): Promise<Candidat[]> {
  const cle = process.env.PEXELS_API_KEY;
  if (!cle) return [];
  const res = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query: q, locale: 'fr-FR', orientation: 'landscape', per_page: '12' })}`, { headers: { Authorization: cle } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const json = (await res.json()) as { photos: { id: number; url: string; photographer: string; photographer_url: string; width: number; height: number; alt: string; src: { medium: string; large2x: string } }[] };
  return json.photos.map(p => ({
    source: 'pexels' as const, id: String(p.id), apercu: p.src.medium, image: p.src.large2x, pageUrl: p.url,
    auteur: p.photographer, auteurUrl: p.photographer_url, largeur: p.width, hauteur: p.height, tags: p.alt ?? '',
  }));
}

async function unsplash(q: string): Promise<Candidat[]> {
  const cle = process.env.UNSPLASH_ACCESS_KEY;
  if (!cle) return [];
  const res = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query: q, orientation: 'landscape', per_page: '12' })}`, { headers: { Authorization: `Client-ID ${cle}` } });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const json = (await res.json()) as { results: { id: string; alt_description: string | null; width: number; height: number; urls: { small: string; regular: string }; links: { html: string }; user: { name: string; links: { html: string } } }[] };
  return json.results.map(p => ({
    source: 'unsplash' as const, id: p.id, apercu: p.urls.small, image: p.urls.regular, pageUrl: p.links.html,
    auteur: p.user.name, auteurUrl: p.user.links.html, largeur: p.width, hauteur: p.height, tags: p.alt_description ?? '',
  }));
}

/** Télécharge une miniature (séquentiel + reprise) ; null si elle reste illisible. */
async function telecharger(url: string): Promise<Buffer | null> {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PlanMyMeal/1.0 (selection de photos)' } });
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).metadata(); // valide que l'image est lisible
        return buf;
      }
    } catch { /* nouvel essai */ }
    await attendre(600 * (essai + 1));
  }
  return null;
}

/** Planche contact : les candidats lisibles côte à côte, numérotés. Renvoie ceux affichés. */
async function planche(candidats: Candidat[], fichier: string): Promise<Candidat[]> {
  const L = 360, H = 270;
  const gardes: { c: Candidat; img: Buffer }[] = [];
  for (const c of candidats) {
    const buf = await telecharger(c.apercu);
    if (buf) gardes.push({ c, img: await sharp(buf).resize(L, H, { fit: 'cover' }).toBuffer() });
    await attendre(150);
  }
  if (gardes.length === 0) return [];
  const cases = await Promise.all(gardes.map(async ({ img }, i) => {
    const etiquette = Buffer.from(`<svg width="${L}" height="${H}"><rect x="10" y="10" width="44" height="44" rx="10" fill="#C4552C"/><text x="32" y="42" font-size="28" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text></svg>`);
    return { input: await sharp(img).composite([{ input: etiquette }]).toBuffer(), left: i * (L + 8), top: 0 };
  }));
  await sharp({ create: { width: gardes.length * (L + 8) - 8, height: H, channels: 3, background: '#FBF8F1' } })
    .composite(cases).jpeg({ quality: 82 }).toFile(fichier);
  return gardes.map(g => g.c);
}

/** Feuille : PAR_FEUILLE plats, une ligne chacun (étiquette + candidats numérotés). */
async function feuille(lignes: { r: { id: number; titre: string }; requete: string; candidats: Candidat[] }[], fichier: string) {
  const L = 300, H = 225, BAND = 26, GAP = 6, LEFT = 0;
  const ligneH = H + BAND;
  const cases: OverlayOptions[] = [];
  let largeur = 0;
  for (const [li, l] of lignes.entries()) {
    const top = li * (ligneH + GAP);
    const etiq = `#${l.r.id} ${l.r.titre}  →  ${l.requete}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 95);
    cases.push({ input: Buffer.from(`<svg width="1300" height="${BAND}"><rect width="1300" height="${BAND}" fill="#332A1E"/><text x="8" y="18" font-size="15" font-family="Arial" font-weight="700" fill="#FBF8F1">${etiq}</text></svg>`), left: LEFT, top });
    let col = 0;
    const affiches: Candidat[] = [];
    for (const c of l.candidats) {
      const buf = await telecharger(c.apercu);
      await attendre(200);
      if (!buf) continue;
      affiches.push(c);
      const img = await sharp(buf).resize(L, H, { fit: 'cover' }).toBuffer();
      const badge = Buffer.from(`<svg width="${L}" height="${H}"><rect x="6" y="6" width="34" height="34" rx="8" fill="#C4552C"/><text x="23" y="30" font-size="22" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">${col + 1}</text></svg>`);
      cases.push({ input: await sharp(img).composite([{ input: badge }]).toBuffer(), left: LEFT + col * (L + GAP), top: top + BAND });
      largeur = Math.max(largeur, LEFT + (col + 1) * (L + GAP));
      col++;
    }
    // Les candidats gardés sont EXACTEMENT ceux affichés, dans l'ordre : le numéro
    // de la planche = position dans candidats.json (avant, une miniature échouée
    // décalait la correspondance).
    l.candidats = affiches;
  }
  await sharp({ create: { width: Math.max(largeur, 1300), height: lignes.length * (ligneH + GAP), channels: 3, background: '#FBF8F1' } })
    .composite(cases).jpeg({ quality: 80 }).toFile(fichier);
}

async function modeLot() {
  await mkdir(DOSSIER, { recursive: true });
  const brut = JSON.parse(await readFile(LOT!, 'utf-8')) as [number, string][];
  const dejaChoisis = new Set(JSON.parse(await readFile('scripts/photos-selection.json', 'utf-8').catch(() => '[]')).map((s: { meal_id: number }) => s.meal_id));
  const lot = brut.filter(([id]) => !dejaChoisis.has(id)).slice(0, MAX_PLATS);
  const { data: titres } = await supabase.from('meals').select('id, titre').in('id', lot.map(l => l[0]));
  const titreDe = new Map((titres ?? []).map(t => [t.id, t.titre]));

  const resultats: { id: number; titre: string; requete: string; feuille: string; candidats: Candidat[] }[] = [];
  let lignes: { r: { id: number; titre: string }; requete: string; candidats: Candidat[] }[] = [];
  let n = 0;
  const vider = async () => {
    if (lignes.length === 0) return;
    const nom = `feuille-${String(++n).padStart(2, '0')}.jpg`;
    await feuille(lignes, join(DOSSIER, nom));
    for (const l of lignes) resultats.push({ id: l.r.id, titre: l.r.titre, requete: l.requete, feuille: nom, candidats: l.candidats });
    lignes = [];
    console.log(`  → ${nom}`);
  };

  for (const [id, requete] of lot) {
    const titre = titreDe.get(id);
    if (!titre) continue;
    // Choix de la rédaction d'abord (photos les mieux sélectionnées), puis populaires.
    let candidats = await pixabay(requete, true).catch(() => []);
    await attendre(700);
    if (candidats.length < NB_CANDIDATS) {
      const plus = await pixabay(requete).catch(() => []);
      const vus = new Set(candidats.map(c => c.id));
      candidats = [...candidats, ...plus.filter(c => !vus.has(c.id))];
      await attendre(700);
    }
    const retenus = candidats.slice(0, NB_CANDIDATS);
    console.log(`#${id} ${titre} → « ${requete} » : ${retenus.length} candidats`);
    if (retenus.length === 0) { resultats.push({ id, titre, requete, feuille: '', candidats: [] }); continue; }
    lignes.push({ r: { id, titre }, requete, candidats: retenus });
    if (lignes.length === PAR_FEUILLE) await vider();
  }
  await vider();
  await writeFile(join(DOSSIER, 'candidats.json'), JSON.stringify(resultats, null, 2));
  console.log(`
${resultats.length} plats traités — feuilles et candidats dans ${DOSSIER}`);
}

/** Planche d'une famille : jusqu'à 10 candidats en 2 rangées de 5, numérotés. */
async function planeFamille(candidats: Candidat[], fichier: string): Promise<Candidat[]> {
  const L = 300, H = 225, GAP = 6, COLS = 5;
  const affiches: Candidat[] = [];
  const cases: OverlayOptions[] = [];
  for (const c of candidats) {
    const buf = await telecharger(c.apercu);
    await attendre(200);
    if (!buf) continue;
    const i = affiches.length;
    affiches.push(c);
    const img = await sharp(buf).resize(L, H, { fit: 'cover' }).toBuffer();
    const badge = Buffer.from(`<svg width="${L}" height="${H}"><rect x="6" y="6" width="38" height="38" rx="8" fill="#C4552C"/><text x="25" y="33" font-size="24" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text></svg>`);
    cases.push({ input: await sharp(img).composite([{ input: badge }]).toBuffer(), left: (i % COLS) * (L + GAP), top: Math.floor(i / COLS) * (H + GAP) });
  }
  if (affiches.length === 0) return [];
  const rows = Math.ceil(affiches.length / COLS);
  await sharp({ create: { width: COLS * (L + GAP) - GAP, height: rows * (H + GAP) - GAP, channels: 3, background: '#FBF8F1' } })
    .composite(cases).jpeg({ quality: 80 }).toFile(fichier);
  return affiches;
}

async function modeFamilles() {
  await mkdir(DOSSIER, { recursive: true });
  const familles = JSON.parse(await readFile(FAMILLES!, 'utf-8')) as [string, string[]][];
  // Photos déjà retenues (sélections précédentes) : jamais reproposées.
  const dejaUtilisees = new Set<string>();
  for (const f of ['scripts/photos-selection.json', 'scripts/photos-selection-lot2.json']) {
    try {
      const j = JSON.parse(await readFile(f, 'utf-8')) as { photo_id?: string }[] | { solides: { photo_id: string }[]; douteuses: { photo_id: string }[] };
      const liste = Array.isArray(j) ? j : [...j.solides, ...j.douteuses];
      liste.forEach(s => s.photo_id && dejaUtilisees.add(String(s.photo_id)));
    } catch { /* fichier absent */ }
  }
  const resultats: { famille: string; feuille: string; candidats: Candidat[] }[] = [];
  for (const [nom, requetes] of familles) {
    const vus = new Set<string>(dejaUtilisees);
    const pool: Candidat[] = [];
    for (const q of requetes) {
      for (const choix of [true, false]) {
        const hits = await pixabay(q, choix).catch(() => []);
        await attendre(700);
        for (const h of hits) if (!vus.has(h.id)) { vus.add(h.id); pool.push(h); }
      }
    }
    const fichier = join(DOSSIER, `famille-${nom}.jpg`);
    const affiches = await planeFamille(pool.slice(0, 10), fichier);
    console.log(`${nom} : ${pool.length} nouveaux, ${affiches.length} affichés`);
    resultats.push({ famille: nom, feuille: affiches.length ? `famille-${nom}.jpg` : '', candidats: affiches });
  }
  await writeFile(join(DOSSIER, 'familles.json'), JSON.stringify(resultats, null, 2));
}

if (FAMILLES) { modeFamilles().catch(e => { console.error(e); process.exit(1); }); } else if (LOT) { modeLot().catch(e => { console.error(e); process.exit(1); }); } else
(async () => {
  await mkdir(DOSSIER, { recursive: true });
  let q = supabase.from('meals').select('id, titre, type_repas').eq('is_public', true);
  q = IDS?.length ? q.in('id', IDS) : q.order('id').limit(LIMIT);
  const { data: recettes, error } = await q;
  if (error || !recettes) throw error ?? new Error('Aucune recette');

  const cacheRecherches = new Map<string, Candidat[]>();
  const resultats: { id: number; titre: string; requete: string; candidats: Candidat[]; planche: string | null }[] = [];

  for (const r of recettes) {
    const requete = REQUETES_FORCEES.get(r.id) ?? requeteDepuisTitre(r.titre);
    let candidats = cacheRecherches.get(requete);
    if (!candidats) {
      candidats = [];
      for (const source of [pixabay, pexels, unsplash]) {
        try { candidats.push(...(await source(requete))); } catch (e) { console.warn(`  ⚠ ${(e as Error).message}`); }
        await attendre(700);
      }
      cacheRecherches.set(requete, candidats);
    }
    let retenus = candidats.slice(DEBUT, DEBUT + NB_CANDIDATS);
    let fichier: string | null = null;
    if (retenus.length > 0) {
      fichier = join(DOSSIER, `${r.id}.jpg`);
      retenus = await planche(retenus, fichier);
      if (retenus.length === 0) fichier = null;
    }
    console.log(`#${r.id} ${r.titre} → « ${requete} » : ${candidats.length} résultats, ${retenus.length} retenus`);
    resultats.push({ id: r.id, titre: r.titre, requete, candidats: retenus, planche: fichier });
  }

  await writeFile(join(DOSSIER, 'candidats.json'), JSON.stringify(resultats, null, 2));
  console.log(`\nPlanches et candidats écrits dans ${DOSSIER}`);
})();

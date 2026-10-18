// ============================================================================
// Ouverture PROGRESSIVE de l'indexation (voir definir-indexation.ts : seules les
// recettes rédigées à la main sont indexables au départ). Chaque exécution passe
// en `indexable = true` un nouveau lot de recettes, choisies pour limiter le
// risque de « contenu massif quasi identique » aux yeux de Google :
//   - plats, entrées et desserts d'au moins 7 étapes (hors petits-déjeuners/snacks) ;
//   - UNE recette par plat de base (titre avant la 1re virgule) et jamais un plat
//     de base déjà indexable ;
//   - lot réparti à tour de rôle entre les cuisines (diversité du sitemap).
//
//   npx tsx scripts/ouvrir-indexation.ts --lot 1000             (aperçu, ne modifie rien)
//   npx tsx scripts/ouvrir-indexation.ts --lot 1000 --appliquer
//
// Ouvrir un lot, attendre 3 à 4 semaines, vérifier dans Google Search Console que
// les pages sont indexées (« Indexation des pages ») avant de relancer. Annuler un
// lot : update meals set indexable = false where id in (<ids de backups/…/indexation-lot-….json>).
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const APPLIQUER = process.argv.includes('--appliquer');
const i = process.argv.indexOf('--lot');
const LOT = i >= 0 ? Number(process.argv[i + 1]) : 1000;
if (!Number.isInteger(LOT) || LOT < 1 || LOT > 3000) throw new Error('--lot doit être compris entre 1 et 3000');

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const base = (titre: string) => titre.split(',')[0].trim().toLowerCase();

interface Ligne { id: number; titre: string; cuisine: string | null; type_repas: string; indexable: boolean; nb: number }

(async () => {
  // Lecture par fenêtres d'id (PostgREST plafonne à 1000 lignes par requête)
  const { data: dernier } = await s.from('meals').select('id').order('id', { ascending: false }).limit(1);
  const lignes: Ligne[] = [];
  for (let d = 0; d <= (dernier?.[0]?.id ?? 0); d += 1000) {
    const { data, error } = await s.from('meals')
      .select('id, titre, cuisine, type_repas, indexable, instructions')
      .eq('is_public', true).gte('id', d).lt('id', d + 1000);
    if (error) throw error;
    for (const m of data ?? []) lignes.push({ id: m.id, titre: m.titre, cuisine: m.cuisine, type_repas: m.type_repas, indexable: !!m.indexable, nb: m.instructions?.length ?? 0 });
  }

  const basesIndexees = new Set(lignes.filter(l => l.indexable).map(l => base(l.titre)));
  const parCuisine = new Map<string, Ligne[]>();
  const vues = new Set<string>();
  for (const l of lignes.sort((a, b) => a.id - b.id)) {
    if (l.indexable || !['plat', 'entree', 'dessert'].includes(l.type_repas) || l.nb < 7) continue;
    const b = base(l.titre);
    if (basesIndexees.has(b) || vues.has(b)) continue;
    vues.add(b);
    const c = l.cuisine ?? 'Autre';
    (parCuisine.get(c) ?? parCuisine.set(c, []).get(c)!).push(l);
  }

  // Tour de rôle entre les cuisines jusqu'à atteindre le lot
  const choisis: Ligne[] = [];
  const files = [...parCuisine.entries()].sort((a, b) => b[1].length - a[1].length).map(([, v]) => v);
  for (let tour = 0; choisis.length < LOT && files.some(f => f.length > tour); tour++) {
    for (const f of files) if (f[tour] && choisis.length < LOT) choisis.push(f[tour]);
  }

  const repartition = new Map<string, number>();
  for (const l of choisis) repartition.set(l.cuisine ?? 'Autre', (repartition.get(l.cuisine ?? 'Autre') ?? 0) + 1);
  console.log(`Déjà indexables : ${lignes.filter(l => l.indexable).length} — candidats distincts : ${vues.size} — lot : ${choisis.length}`);
  console.log([...repartition.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => `${c}:${n}`).join(', '));
  console.log('Exemples :', choisis.slice(0, 5).map(l => `#${l.id} ${l.titre}`).join(' | '));

  if (!APPLIQUER) { console.log('\nAperçu seulement (ajoutez --appliquer).'); return; }

  const dossier = `backups/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dossier, { recursive: true });
  const fichier = `${dossier}/indexation-lot-${Date.now()}.json`;
  writeFileSync(fichier, JSON.stringify({ ids: choisis.map(l => l.id) }));
  for (let d = 0; d < choisis.length; d += 200) {
    const ids = choisis.slice(d, d + 200).map(l => l.id);
    const { error } = await s.from('meals').update({ indexable: true }).in('id', ids).eq('is_public', true);
    if (error) throw error;
  }
  console.log(`\n${choisis.length} recettes passées en indexable. ids sauvegardés dans ${fichier}`);
})();

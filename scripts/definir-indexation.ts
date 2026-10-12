// ============================================================================
// Indexation prudente (Google déclasse les sites qui publient en masse des
// pages très semblables) : seules les recettes RÉDIGÉES À LA MAIN sont marquées
// `indexable = true` (sitemap + robots index). Les variantes assemblées
// automatiquement restent consultables et utilisables dans les menus, mais
// en `noindex` tant qu'elles n'ont pas été enrichies (photo, texte propre).
//
//   npx tsx scripts/definir-indexation.ts            (aperçu)
//   npx tsx scripts/definir-indexation.ts --appliquer
// Pour élargir plus tard : update meals set indexable = true where id in (…)
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { RECETTES_FRANCAISES } from './data/recettes-francaises';
import { RECETTES_FRANCAISES_LISTE } from './data/recettes-francaises-liste';
import { RECETTES_RAPIDES } from './data/recettes-rapides';
import { RECETTES_CLASSIQUES_ACCESSIBLES } from './data/recettes-classiques-accessibles';
import { RECETTES_EQUILIBREES } from './data/recettes-equilibrees';
import { RECETTES_PROTEINEES } from './data/recettes-proteinees';
import { RECETTES_ENTREES } from './data/recettes-entrees';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const redigees = new Set([
  ...RECETTES_FRANCAISES, ...RECETTES_FRANCAISES_LISTE, ...RECETTES_RAPIDES, ...RECETTES_CLASSIQUES_ACCESSIBLES,
  ...RECETTES_EQUILIBREES, ...RECETTES_PROTEINEES, ...RECETTES_ENTREES,
].map(r => r.titre.toLowerCase()));

(async () => {
  const ids: number[] = [];
  const { data: dernier } = await s.from('meals').select('id').order('id', { ascending: false }).limit(1);
  for (let d = 0; d <= (dernier?.[0]?.id ?? 0); d += 1000) {
    const { data } = await s.from('meals').select('id, titre').eq('is_public', true).gte('id', d).lt('id', d + 1000);
    for (const m of data ?? []) {
      // Les 60 premières recettes (seed-meals) sont aussi rédigées à la main
      if (redigees.has(m.titre.toLowerCase()) || m.id <= 62) ids.push(m.id);
    }
  }
  console.log(`${ids.length} recettes rédigées à la main à indexer`);
  if (!APPLIQUER) return;
  await s.from('meals').update({ indexable: false }).eq('is_public', true);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await s.from('meals').update({ indexable: true }).in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
  console.log('Indexation définie.');
})();

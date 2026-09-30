// ============================================================================
// Vérifie que la base Supabase est à jour par rapport aux migrations du code.
// Usage : npm run db:verifier   (lit .env.local, lecture seule)
//
// Pourquoi : les migrations sont appliquées à la main dans le SQL Editor. Une
// migration oubliée ne se voit qu'en production (« Could not find the
// 'rythme_desserts' column … in the schema cache »). Ce script teste chaque
// colonne / table / fonction ajoutée par une migration récente et dit
// laquelle appliquer.
// ============================================================================

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)');
  process.exit(1);
}
const supabase = createClient(url, cle, { auth: { persistSession: false } });

/** migration → colonnes à tester (table: colonnes séparées par des virgules) */
const ATTENDU: { migration: string; table: string; colonnes: string }[] = [
  { migration: '00022_rythme_desserts', table: 'profiles', colonnes: 'rythme_desserts' },
  { migration: '00027_foyer_gouvernance', table: 'profiles', colonnes: 'utiliser_saison' },
  { migration: '00027_foyer_gouvernance', table: 'households', colonnes: 'delai_recettes_aimees_jours' },
  { migration: '00028_newsletter_subscribers', table: 'newsletter_subscribers', colonnes: 'id, email, token, unsubscribed_at' },
  { migration: '00029_partage_public_menu', table: 'weekly_plans', colonnes: 'share_token' },
  { migration: '00030_profil_corporel_regimes', table: 'profiles', colonnes: 'sexe, age, taille_cm, poids_kg' },
  { migration: '00031_securite_audit', table: 'newsletter_subscribers', colonnes: 'confirmed_at' },
  { migration: '00031_securite_audit', table: 'user_allergy_families', colonnes: 'user_id, code' },
  { migration: '00031_securite_audit', table: 'user_dislike_families', colonnes: 'user_id, code' },
  { migration: '00031_securite_audit', table: 'rate_limits', colonnes: 'cle, fenetre_debut, compteur' },
];

(async () => {
  const manquantes = new Set<string>();
  for (const { migration, table, colonnes } of ATTENDU) {
    const { error } = await supabase.from(table).select(colonnes).limit(0);
    const ok = !error;
    console.log(`${ok ? '✅' : '❌'} ${migration.padEnd(32)} ${table}(${colonnes})${ok ? '' : ` — ${error.message}`}`);
    if (!ok) manquantes.add(migration);
  }

  // Fonction de limite de débit (00031)
  const { error: rpcErr } = await supabase.rpc('rate_limit_hit', { p_cle: 'verifier-schema', p_limite: 1000, p_fenetre_ms: 1000 });
  console.log(`${rpcErr ? '❌' : '✅'} ${'00031_securite_audit'.padEnd(32)} fonction rate_limit_hit${rpcErr ? ` — ${rpcErr.message}` : ''}`);
  if (rpcErr) manquantes.add('00031_securite_audit');

  if (manquantes.size === 0) {
    console.log('\nBase à jour.');
  } else {
    console.log(`\nMigrations à appliquer (SQL Editor, dans l'ordre) :\n${[...manquantes].sort().map(m => `  supabase/migrations/${m}.sql`).join('\n')}`);
    process.exit(1);
  }
})();

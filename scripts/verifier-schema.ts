// ============================================================================
// Vérification du schéma distant — PlanMyMeal
// Usage : npx tsx scripts/verifier-schema.ts
//
// 100 % LECTURE SEULE : on interroge la spec OpenAPI exposée par PostgREST
// (`GET /rest/v1/`), qui liste les tables exposées, leurs colonnes et les
// fonctions RPC. Aucune requête n'écrit ni ne lit la moindre donnée métier.
////       Sert à répondre à « les migrations 00016 et 00017 sont-elles appliquées ? »
// sans accès au SQL Editor ni au mot de passe Postgres.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });

interface Check {
  nom: string;
  ok: boolean;
  detail?: string;
}

async function main(): Promise<number> {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local');
  return 1;
}

console.log(`🔎 Projet : ${url.replace(/^https:\/\//, '').split('.')[0]}`);

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});

if (!res.ok) {
  console.error(`❌ Spec OpenAPI illisible : HTTP ${res.status} ${res.statusText}`);
  return 1;
}

const spec = (await res.json()) as {
  paths?: Record<string, unknown>;
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
};

const paths = Object.keys(spec.paths ?? {});
const schemas = spec.definitions ?? spec.components?.schemas ?? {};

const aTable = (t: string) => paths.includes(`/${t}`);
const aColonne = (t: string, c: string) => Boolean(schemas[t]?.properties?.[c]);

const checks: Check[] = [
  // ── Socle historique (doit déjà être là) ──
  { nom: 'Table profiles', ok: aTable('profiles') },
  { nom: 'Table meal_history', ok: aTable('meal_history') },
  { nom: 'RPC save_weekly_plan', ok: paths.includes('/rpc/save_weekly_plan') },
  { nom: 'RPC recompute_shopping_list', ok: paths.includes('/rpc/recompute_shopping_list') },

  // ── Migration 00016 : mémoire alimentaire ──
  { nom: 'Table user_meal_preferences', ok: aTable('user_meal_preferences') },
  { nom: 'Colonne profiles.temps_max_par_jour', ok: aColonne('profiles', 'temps_max_par_jour') },
  { nom: 'Colonne profiles.contexte_jours', ok: aColonne('profiles', 'contexte_jours') },
  { nom: 'Colonne profiles.nouveaute', ok: aColonne('profiles', 'nouveaute') },
  { nom: 'Colonne meal_history.raison', ok: aColonne('meal_history', 'raison') },

  // ── Migration 00016 : frigo ──
  { nom: 'Table fridge_items', ok: aTable('fridge_items') },
  { nom: 'Colonne fridge_items.expiration', ok: aColonne('fridge_items', 'expiration') },
  { nom: 'RPC recompute_shopping_list_frigo', ok: paths.includes('/rpc/recompute_shopping_list_frigo') },

  // ── Migration 00017 : profils famille ──
  { nom: 'Table family_members', ok: aTable('family_members') },
  { nom: 'Table family_member_ingredients', ok: aTable('family_member_ingredients') },
  { nom: 'Table family_member_meal_preferences', ok: aTable('family_member_meal_preferences') },
  { nom: 'Colonne family_members.poids', ok: aColonne('family_members', 'poids') },
  { nom: 'Colonne profiles.poids_famille', ok: aColonne('profiles', 'poids_famille') },
  { nom: 'RPC save_family_member', ok: paths.includes('/rpc/save_family_member') },
];

const largeur = Math.max(...checks.map(c => c.nom.length));
console.log('');
for (const c of checks) {
  console.log(`  ${c.ok ? '✅' : '❌'}  ${c.nom.padEnd(largeur)}${c.detail ? `  ${c.detail}` : ''}`);
}

const manquants = checks.filter(c => !c.ok);

console.log('');
if (manquants.length === 0) {
  console.log('🎉 Schéma complet — migrations 00016 et 00017 appliquées.');
  return 0;
}

console.log(`⚠️  ${manquants.length} objet(s) manquant(s) : ${manquants.map(c => c.nom).join(', ')}`);
console.log('   → Applique le fichier de migration correspondant (idempotent, relançable) :');
console.log('       supabase db query --linked -f supabase/migrations/00016_memoire_alimentaire.sql');
console.log('       supabase db query --linked -f supabase/migrations/00017_profils_famille.sql');
return 1;
}

main().then(code => process.exit(code));

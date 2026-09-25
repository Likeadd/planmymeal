// ============================================================================
// Sauvegarde des données Supabase — PlanMyMeal
// Usage : npm run backup            (→ backups/AAAA-MM-JJ_HHMM/*.json)
// Exporte chaque table (paginé) + les comptes auth, puis ne garde que les
// BACKUP_KEEP dernières sauvegardes (14 par défaut). Le schéma, lui, est
// versionné dans supabase/migrations.
// Planification : tâche planifiée Windows / cron quotidien sur cette commande.
// ⚠️ backups/ contient des données personnelles : jamais commité (.gitignore).
// ============================================================================

import 'dotenv/config';
import { config } from 'dotenv';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const TABLES = [
  'profiles', 'ingredients', 'meals', 'meal_ingredients',
  'user_allergies', 'user_dislikes', 'user_diets', 'meal_history',
  'weekly_plans', 'plan_meals', 'shopping_lists', 'shopping_list_items',
  'user_prix_ingredients', 'weekly_budget_snapshots', 'user_meal_preferences',
  'fridge_items', 'family_members', 'family_member_ingredients',
  'family_member_meal_preferences', 'households', 'household_members',
  'household_invitations', 'security_events',
];
const PAGE = 1000;
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const root = join(process.cwd(), 'backups');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  const dir = join(root, stamp);
  mkdirSync(dir, { recursive: true });

  const bilan: Record<string, number | string> = {};
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1);
      if (error) { bilan[table] = `ERREUR: ${error.message}`; break; }
      rows.push(...data);
      if (data.length < PAGE) { bilan[table] = rows.length; break; }
    }
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows));
  }

  // Comptes auth (sans mot de passe : Supabase ne renvoie jamais les hash)
  const users: unknown[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) { bilan['auth.users'] = `ERREUR: ${error.message}`; break; }
    users.push(...data.users);
    if (data.users.length < PAGE) { bilan['auth.users'] = users.length; break; }
  }
  writeFileSync(join(dir, 'auth_users.json'), JSON.stringify(users));
  writeFileSync(join(dir, '_bilan.json'), JSON.stringify({ date: new Date().toISOString(), bilan }, null, 2));

  // Rotation : ne garder que les KEEP plus récentes
  const anciennes = readdirSync(root).filter(d => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(d)).sort().reverse().slice(KEEP);
  anciennes.forEach(d => rmSync(join(root, d), { recursive: true, force: true }));

  const erreurs = Object.values(bilan).filter(v => typeof v === 'string');
  console.log(`Sauvegarde ${stamp} : ${TABLES.length + 1} exports, ${erreurs.length} erreur(s), ${anciennes.length} ancienne(s) supprimée(s).`);
  if (erreurs.length) { console.error(bilan); process.exitCode = 1; }
}

main().catch(e => { console.error('Sauvegarde échouée :', e instanceof Error ? e.message : e); process.exit(1); });

// ============================================================================
// ADMIN : purge des marqueurs 'planned' de test — PlanMyMeal
// Usage :
//   npm run cleanup:planned                 → DRY RUN (aperçu, rien supprimé)
//   npm run cleanup:planned -- --yes        → purge réelle
//   npm run cleanup:planned -- --yes --user=<uuid>
//   npm run cleanup:planned -- --yes --email=xxx@example.com
//   npm run cleanup:planned -- --yes --before=2026-09-01
//
// Pourquoi : les régénérations de test remplissent meal_history de marqueurs
// 'planned' récents, ce qui bloque la rotation (cooldown 21 jours).
// Ce script purge UNIQUEMENT les marqueurs 'planned' — les retours réels
// des utilisateurs (cooked / liked / disliked) ne sont jamais touchés.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── Arguments CLI ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const yes = args.includes('--yes');
const userArg = args.find(a => a.startsWith('--user='))?.split('=')[1];
const emailArg = args.find(a => a.startsWith('--email='))?.split('=')[1];
const beforeArg = args.find(a => a.startsWith('--before='))?.split('=')[1];

if (!yes) {
  console.log('🔍 DRY RUN — aucun contenu ne sera supprimé. Ajoutez --yes pour purger.\n');
}

// ─── Résoudre les cibles ────────────────────────────────────────────────────
interface Cible { user_id: string; email: string | null }

async function resoudreCibles(): Promise<Cible[]> {
  // Filtre par uuid directement
  if (userArg) {
    return [{ user_id: userArg, email: null }];
  }

  // Filtre par email (éventuellement avec wildcard %)
  if (emailArg) {
    const { data, error } = await (supabase as any)
      .from('profiles').select('id, email').like('email', emailArg);
    if (error) throw error;
    return (data || []).map((p: any) => ({ user_id: p.id, email: p.email }));
  }

  // Sans filtre : tous les profils
  const { data, error } = await (supabase as any)
    .from('profiles').select('id, email');
  if (error) throw error;
  return (data || []).map((p: any) => ({ user_id: p.id, email: p.email }));
}

async function main() {
  console.log('🧹 Purge des marqueurs \'planned\' (rotation memory)\n');

  if (beforeArg && !/^\d{4}-\d{2}-\d{2}$/.test(beforeArg)) {
    console.error('❌ --before doit être au format YYYY-MM-DD');
    process.exit(1);
  }

  const cibles = await resoudreCibles();
  if (cibles.length === 0) {
    console.log('Aucun profil correspondant. Rien à faire.');
    return;
  }
  console.log(`👤 Cibles : ${cibles.length} profil(s)${cibles.length <= 5 ? '' : ' (aperçu : ' + cibles.slice(0, 5).map(c => c.email || c.user_id.slice(0, 8)).join(', ') + '…)'}`);
  console.log(`📅 Filtre date : ${beforeArg ?? "aucun (tout l'historique planned)"}\n`);

  let totalPurged = 0;

  for (const cible of cibles) {
    // Aperçu de ce qui serait supprimé
    let query = (supabase as any)
      .from('meal_history')
      .select('id, meal_id, planned_date', { count: 'exact' })
      .eq('user_id', cible.user_id)
      .eq('status', 'planned');
    if (beforeArg) query = query.lt('planned_date', beforeArg);

    const { data: rows, count } = await query;
    const nb = count ?? rows?.length ?? 0;

    if (nb === 0) continue;

    if (!yes) {
      const dates = (rows || []).map((r: any) => r.planned_date);
      const min = dates.length ? dates.reduce((a: string, b: string) => (a < b ? a : b)) : '-';
      const max = dates.length ? dates.reduce((a: string, b: string) => (a > b ? a : b)) : '-';
      console.log(`  👤 ${cible.email || cible.user_id} → ${nb} marqueur(s) 'planned' (${min} → ${max})`);
      totalPurged += nb;
      continue;
    }

    // Purge réelle
    let del = (supabase as any)
      .from('meal_history')
      .delete()
      .eq('user_id', cible.user_id)
      .eq('status', 'planned');
    if (beforeArg) del = del.lt('planned_date', beforeArg);

    const { error } = await del;
    if (error) {
      console.error(`  ❌ ${cible.email || cible.user_id} : ${error.message}`);
      continue;
    }
    console.log(`  ✅ ${cible.email || cible.user_id} → ${nb} marqueur(s) supprimé(s)`);
    totalPurged += nb;
  }

  if (totalPurged === 0) {
    console.log('✨ Rien à purger — historique déjà propre.');
    return;
  }

  if (!yes) {
    console.log(`\n📊 Total en dry run : ${totalPurged} marqueur(s) 'planned' seraient supprimés.`);
    console.log('   Relancez avec --yes pour confirmer :');
    console.log('   npm run cleanup:planned -- --yes' + (userArg ? ` --user=${userArg}` : '') + (emailArg ? ` --email="${emailArg}"` : '') + (beforeArg ? ` --before=${beforeArg}` : ''));
  } else {
    console.log(`\n🎉 Purge terminée : ${totalPurged} marqueur(s) 'planned' supprimé(s).`);
    console.log('   Les retours cooked/liked/disliked sont conservés.');
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

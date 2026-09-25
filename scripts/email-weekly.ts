// ============================================================================
// EMAIL DE RELANCE HEBDOMADAIRE — PlanMyMeal (CLI)
// Le cœur (collecte, opt-out, anti-doublon, templates) vit dans
// src/lib/email-service.ts — partagé avec la route cron Vercel
// /api/cron/email-weekly. Ce script n'est qu'un wrapper CLI (dry run par
// défaut) utile pour prévisualiser avant de brancher le cron.
//
// Usage :
//   npm run email:weekly                → DRY RUN (aperçu, rien n'est envoyé)
//   npm run email:weekly -- --send      → envoi réel (RESEND_API_KEY requis)
//   npm run email:weekly -- --email=xxx@example.com   (filtre un destinataire)
//
// Config (.env.local) :
//   RESEND_API_KEY=re_xxx
//   EMAIL_FROM="PlanMyMeal <bonjour@ton-domaine.fr>"
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getSupabaseAdmin } from '../src/lib/supabase';
import { envoyerDigestsHebdomadaires } from '../src/lib/email-service';

async function main() {
  const SEND = process.argv.includes('--send');
  const EMAIL_FILTER = process.argv.find(a => a.startsWith('--email='))?.split('=')[1] || null;

  console.log(`\n📧 Email hebdo — mode : ${SEND ? '🚨 ENVOI RÉEL' : 'DRY RUN (aperçu)'}\n`);

  const result = await envoyerDigestsHebdomadaires(getSupabaseAdmin(), {
    send: SEND,
    emailFilter: EMAIL_FILTER,
  });

  for (const c of result.cibles) {
    const eco = c.economieReference ?? c.economie;
    const apercu = `${c.email} | ${c.nbRepas} repas | économie ${eco != null ? eco.toFixed(2) + ' €' : '—'}`;
    if (!SEND) console.log(`[APERÇU] ${apercu}`);
    else console.log(`✅ ${c.email}`);
  }
  for (const i of result.ignores) {
    console.log(`⏭️  ignoré (${i.reason}) : user ${i.userId.slice(0, 8)}…`);
  }

  console.log(`\n📊 ${SEND ? `envoyés: ${result.envoyes} | échecs: ${result.echecs}` : `${result.cibles.length} email(s) en aperçu — relancez avec --send pour envoyer`}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });

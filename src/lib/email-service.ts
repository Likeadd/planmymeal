// ============================================================================
// Service emails PlanMyMeal — cœur partagé (route cron + script CLI)
// 1. Email de bienvenue : transactionnel, envoyé UNE FOIS (garde
//    welcome_email_envoye_le), jamais bloquant.
// 2. Digest hebdomadaire : « ta semaine est prête + tu as économisé X € »,
//    envoyé aux foyers ayant un planning actif sur la semaine courante.
//    - Opt-out respecté (profiles.emails_transactionnels)
//    - Anti-doublon par semaine (profiles.digest_envoye_le)
//    - Économies ancrées sur la base DÉCLARÉE (depense_reference_hebdo),
//      repli sur l'économie vs budget hebdo si la base n'est pas saisie.
// ============================================================================

import type { Db } from '@/lib/rotation-engine';
import { sendEmail } from '@/lib/email';
import { welcomeEmailHtml, weeklyDigestEmailHtml, weeklyDigestSubject } from '@/lib/email-templates';
import { formatWeekRange, getMondayWithOffset } from '@/lib/dates';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

// ─── Bienvenue (idempotent) ─────────────────────────────────────────────────

/** Envoie l'email de bienvenue une seule fois. Ne jette jamais. */
export async function envoyerEmailBienvenue(userId: string, supabase: Db): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, full_name, welcome_email_envoye_le, emails_transactionnels')
      .eq('id', userId)
      .single();
    if (!prof) return { sent: false, reason: 'profil introuvable' };
    if (prof.welcome_email_envoye_le) return { sent: false, reason: 'déjà envoyé' };
    if (prof.emails_transactionnels === false) return { sent: false, reason: 'opt-out' };

    const prenom = (prof.full_name || '').split(' ')[0] || '';
    const r = await sendEmail({
      to: prof.email,
      subject: 'Bienvenue sur PlanMyMeal 🍽️',
      html: welcomeEmailHtml({ prenom }, BASE_URL),
    });
    if (!r.ok) return { sent: false, reason: r.error };

    await supabase
      .from('profiles')
      .update({ welcome_email_envoye_le: new Date().toISOString() })
      .eq('id', userId);
    return { sent: true };
  } catch (e) {
    console.error('envoyerEmailBienvenue (non bloquant):', e);
    return { sent: false, reason: 'erreur' };
  }
}

// ─── Digest hebdomadaire ────────────────────────────────────────────────────

export interface DigestOptions {
  /** false = dry run : on calcule les destinataires sans rien envoyer */
  send?: boolean;
  /** filtre debug : n'envoie qu'aux emails contenant cette sous-chaîne */
  emailFilter?: string | null;
}

export interface DigestCible {
  userId: string;
  email: string;
  nbRepas: number;
  semaineDebut: string;
  economie: number | null;
  economieReference: number | null;
  /** Titres bruts (DB) des plats de la semaine, uniques, ordre planning */
  plats?: string[];
}

export interface DigestResult {
  /** destinataires calculés (dry run : ce qui SERAIT envoyé) */
  cibles: DigestCible[];
  envoyes: number;
  echecs: number;
  ignores: { userId: string; reason: string }[];
}

export async function envoyerDigestsHebdomadaires(
  supabase: Db,
  { send = false, emailFilter = null }: DigestOptions = {}
): Promise<DigestResult> {
  // La semaine QUI ARRIVE (lundi prochain), pas la semaine courante : le
  // digest part le vendredi pour que le foyer fasse les courses du week-end
  // avec le planning et la liste de la semaine suivante déjà prêts — le cron
  // auto-generate-week (dimanche, 4 semaines glissantes) l'a déjà générée.
  const semaineDebut = getMondayWithOffset(1);
  const result: DigestResult = { cibles: [], envoyes: 0, echecs: 0, ignores: [] };

  // 1. Foyers avec un planning actif sur la semaine qui arrive (généré par le
  // cron du dimanche ou manuellement)
  const { data: plans, error: plansError } = await supabase
    .from('weekly_plans')
    .select('user_id, id')
    .eq('semaine_debut', semaineDebut)
    .eq('is_active', true);
  if (plansError) throw new Error(plansError.message);
  if (!plans || plans.length === 0) return result;

  for (const plan of plans) {
    try {
      // weekly_plans.user_id est nullable dans les types générés → garde explicite
      const userId = plan.user_id;
      if (userId == null) { result.ignores.push({ userId: '', reason: 'plan sans utilisateur' }); continue; }

      // Profil + préférences email
      const { data: prof } = await supabase
        .from('profiles')
        .select('email, full_name, budget_hebdo, depense_reference_hebdo, emails_transactionnels, digest_envoye_le')
        .eq('id', userId)
        .single();

      if (!prof?.email) { result.ignores.push({ userId, reason: 'email manquant' }); continue; }
      const email = prof.email;
      if (prof.emails_transactionnels === false) { result.ignores.push({ userId, reason: 'opt-out' }); continue; }
      if (prof.digest_envoye_le === semaineDebut) { result.ignores.push({ userId, reason: 'déjà envoyé cette semaine' }); continue; }
      if (emailFilter && !email.includes(emailFilter)) { result.ignores.push({ userId, reason: 'filtre' }); continue; }

      // Nombre de repas du planning
      const { count: nbRepas } = await supabase
        .from('plan_meals')
        .select('meal_id', { count: 'exact', head: true })
        .eq('plan_id', plan.id);

      // Aperçu « Au menu » : les repas de la semaine dans l'ordre (jour puis
      // créneau), titres uniques — meals titre brut, la casse est appliquée
      // au rendu du template (même convention que l'app).
      const plats: string[] = [];
      const { data: rowsPlats } = await supabase
        .from('plan_meals')
        .select('jour_semaine, ordre, meals(titre)')
        .eq('plan_id', plan.id)
        .order('jour_semaine', { ascending: true })
        .order('ordre', { ascending: true });
      if (rowsPlats) {
        const vus = new Set<string>();
        for (const row of rowsPlats as unknown as Array<{ meals: { titre: string } | null }>) {
          const t = row.meals?.titre;
          if (t && !vus.has(t)) { vus.add(t); plats.push(t); }
          if (plats.length >= 8) break;
        }
      }

      // Snapshot budget de la semaine
      const { data: snap } = await supabase
        .from('weekly_budget_snapshots')
        .select('depense, economie, depense_reelle')
        .eq('user_id', userId)
        .eq('semaine_debut', semaineDebut)
        .maybeSingle();

      // Économies : base déclarée d'abord (dépense réelle si saisie, sinon prévue)
      let economieReference: number | null = null;
      const ref = prof.depense_reference_hebdo ?? null;
      if (ref != null && snap) {
        const depense = snap.depense_reelle ?? snap.depense;
        economieReference = Math.round((ref - depense) * 100) / 100;
      }
      const economie = snap?.economie ?? null;

      const cible: DigestCible = {
        userId,
        email,
        nbRepas: nbRepas ?? 0,
        semaineDebut,
        economie,
        economieReference,
        plats,
      };
      result.cibles.push(cible);

      if (!send) continue; // dry run

      const prenom = (prof.full_name || '').split(' ')[0] || '';
      const data = {
        prenom,
        nbRepas: cible.nbRepas,
        semaineLabel: `du ${formatWeekRange(semaineDebut)}`,
        economie: economie != null && prof.budget_hebdo != null ? economie : null,
        economieReference,
        plats: cible.plats ?? [],
        semaineDebut: cible.semaineDebut,
      };
      const r = await sendEmail({
        to: email,
        subject: weeklyDigestSubject(data),
        html: weeklyDigestEmailHtml(data, BASE_URL),
      });

      if (r.ok) {
        result.envoyes++;
        // Garde anti-doublon : marquer la semaine comme envoyée
        await supabase
          .from('profiles')
          .update({ digest_envoye_le: semaineDebut })
          .eq('id', userId);
      } else {
        result.echecs++;
        console.error(`Digest ❌ ${prof.email} : ${r.error}`);
      }
    } catch (e) {
      result.echecs++;
      console.error(`Digest erreur user ${plan.user_id}:`, e);
    }
  }

  return result;
}

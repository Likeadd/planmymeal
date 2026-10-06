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
import { sendEmail, sendEmailsBatch, type SendEmailInput } from '@/lib/email';
import { welcomeEmailHtml, weeklyDigestEmailHtml, weeklyDigestSubject } from '@/lib/email-templates';
import { formatWeekRange, getMondayWithOffset } from '@/lib/dates';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://getplanmymeal.com').replace(/\/$/, '');

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

  // 2. Lectures GROUPÉES (4 requêtes au total, au lieu de 4 par foyer) :
  // profils, repas des plans et snapshots budget de tous les foyers d'un coup.
  const plansValides = plans.filter((p): p is { user_id: string; id: number } => p.user_id != null);
  for (const p of plans) if (p.user_id == null) result.ignores.push({ userId: '', reason: 'plan sans utilisateur' });
  const userIds = plansValides.map(p => p.user_id);
  const planIds = plansValides.map(p => p.id);

  const TRANCHE = 200; // taille raisonnable pour un filtre .in()
  const parTranches = async <T,>(ids: (string | number)[], lire: (tranche: never[]) => PromiseLike<{ data: T[] | null }>) => {
    const lignes: T[] = [];
    for (let i = 0; i < ids.length; i += TRANCHE) {
      const { data } = await lire(ids.slice(i, i + TRANCHE) as never[]);
      lignes.push(...(data ?? []));
    }
    return lignes;
  };

  const [profils, repas, snapshots] = await Promise.all([
    parTranches(userIds, t => supabase.from('profiles')
      .select('id, email, full_name, budget_hebdo, depense_reference_hebdo, emails_transactionnels, digest_envoye_le')
      .in('id', t)),
    // Pas de colonne « ordre » sur plan_meals : on trie par jour puis créneau
    // (déjeuner avant dîner). L'ancien tri sur « ordre » faisait échouer la
    // requête → l'aperçu « Au menu » de l'email était toujours vide.
    parTranches(planIds, t => supabase.from('plan_meals')
      .select('plan_id, jour_semaine, repas_type, texte_libre, meals!plan_meals_meal_id_fkey(titre)')
      .in('plan_id', t)
      .in('repas_type', ['dejeuner', 'diner'])
      .order('jour_semaine', { ascending: true })
      .order('repas_type', { ascending: true })),
    parTranches(userIds, t => supabase.from('weekly_budget_snapshots')
      .select('user_id, depense, economie, depense_reelle')
      .eq('semaine_debut', semaineDebut)
      .in('user_id', t)),
  ]);

  const profilPar = new Map(profils.map(p => [p.id, p]));
  const snapPar = new Map(snapshots.map(s => [s.user_id, s]));
  const repasPar = new Map<number, { titre: string | null }[]>();
  for (const r of repas as unknown as { plan_id: number; texte_libre: string | null; meals: { titre: string } | null }[]) {
    const liste = repasPar.get(r.plan_id) ?? [];
    liste.push({ titre: r.meals?.titre ?? r.texte_libre ?? null });
    repasPar.set(r.plan_id, liste);
  }

  const aEnvoyer: { userId: string; email: SendEmailInput }[] = [];
  for (const plan of plansValides) {
    const userId = plan.user_id;
    const prof = profilPar.get(userId);
    if (!prof?.email) { result.ignores.push({ userId, reason: 'email manquant' }); continue; }
    const email = prof.email;
    if (prof.emails_transactionnels === false) { result.ignores.push({ userId, reason: 'opt-out' }); continue; }
    if (prof.digest_envoye_le === semaineDebut) { result.ignores.push({ userId, reason: 'déjà envoyé cette semaine' }); continue; }
    if (emailFilter && !email.includes(emailFilter)) { result.ignores.push({ userId, reason: 'filtre' }); continue; }

    const lignesRepas = repasPar.get(plan.id) ?? [];
    // Aperçu « Au menu » : titres uniques dans l'ordre du planning (max 8)
    const plats: string[] = [];
    const vus = new Set<string>();
    for (const { titre } of lignesRepas) {
      if (titre && !vus.has(titre)) { vus.add(titre); plats.push(titre); }
      if (plats.length >= 8) break;
    }

    // Économies : base déclarée d'abord (dépense réelle si saisie, sinon prévue)
    const snap = snapPar.get(userId);
    let economieReference: number | null = null;
    const ref = prof.depense_reference_hebdo ?? null;
    if (ref != null && snap) {
      const depense = snap.depense_reelle ?? snap.depense;
      economieReference = Math.round((ref - depense) * 100) / 100;
    }
    const economie = snap?.economie ?? null;

    const cible: DigestCible = {
      userId, email, nbRepas: lignesRepas.length, semaineDebut, economie, economieReference, plats,
    };
    result.cibles.push(cible);
    if (!send) continue; // dry run

    const data = {
      prenom: (prof.full_name || '').split(' ')[0] || '',
      nbRepas: cible.nbRepas,
      semaineLabel: `du ${formatWeekRange(semaineDebut)}`,
      economie: economie != null && prof.budget_hebdo != null ? economie : null,
      economieReference,
      plats,
      semaineDebut,
    };
    aEnvoyer.push({ userId, email: { to: email, subject: weeklyDigestSubject(data), html: weeklyDigestEmailHtml(data, BASE_URL) } });
  }

  if (!send || aEnvoyer.length === 0) return result;

  // 3. Envoi par lots de 100 (un appel HTTP par lot), puis garde anti-doublon
  // posée en UNE requête pour tous les envois réussis.
  const envois = await sendEmailsBatch(aEnvoyer.map(a => a.email));
  const reussis: string[] = [];
  envois.forEach((r, k) => {
    if (r.ok) { result.envoyes++; reussis.push(aEnvoyer[k].userId); }
    else { result.echecs++; console.error(`Digest ❌ ${aEnvoyer[k].email.to} : ${r.error}`); }
  });
  for (let i = 0; i < reussis.length; i += TRANCHE) {
    await supabase.from('profiles')
      .update({ digest_envoye_le: semaineDebut })
      .in('id', reussis.slice(i, i + TRANCHE));
  }

  return result;
}

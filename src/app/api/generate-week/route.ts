import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { generateWeeklyPlan, regeneratePlanSlots, saveWeeklyPlan, toggleRestes, validerIntention, type PlanSlot, type Db } from '@/lib/rotation-engine';
import { getSupabaseAdmin } from '@/lib/supabase';
import { semaineOuLundi } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit, rateLimit } from '@/lib/rate-limit';
import { estPayant, OPTIMISATIONS_GRATUITES_PAR_SEMAINE, REMPLACEMENTS_GRATUITS_PAR_SEMAINE } from '@/lib/limites';
import { reponsePaywall } from '@/lib/paywall-serveur';

/**
 * Limites d'offre côté serveur (plan gratuit — voir lib/limites.ts) :
 *   • OPTIMISATIONS_GRATUITES_PAR_SEMAINE optimisation complète / 7 jours ;
 *   • REMPLACEMENTS_GRATUITS_PAR_SEMAINE remplacements automatiques / 7 jours ;
 *   • optimisation « Équilibrée » uniquement (intentions réservées au payant).
 * Pro/Famille : illimité. Dépassement → 402 + paywall côté client.
 */
async function planUtilisateur(userId: string, admin: Db): Promise<string | null> {
  const { data } = await admin.from('profiles').select('plan').eq('id', userId).single();
  return data?.plan ?? null;
}

async function optimisationsRecentes(userId: string, admin: Db): Promise<number> {
  const ilYa7Jours = new Date();
  ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);
  const { count } = await admin
    .from('weekly_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('generated_at', ilYa7Jours.toISOString());
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  // Anti-abus : borne le débit brut par IP (le compute de génération est
  // cher) — la limite d'offre métier (4/sem sur gratuit) est vérifiée plus bas.
  const limited = await enforceRateLimit(request, { name: 'generate-week', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'generate-week', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    const semaine_debut = semaineOuLundi(body.semaine_debut);
    // Intention d'optimisation du clic (« budget », « temps », « gaspillage ») :
    // validée côté serveur — toute valeur inconnue retombe sur « équilibré »
    // plutôt que de rejeter la requête (le défaut est toujours sûr).
    const intention = validerIntention(body.intention);
    const admin = getSupabaseAdmin();

    // ── Toggle restes : "cuisiné le soir, mangé le lendemain midi" ──
    if (body.toggle_restes === true) {
      const jour = Number(body.jour_diner);
      if (!Number.isInteger(jour)) {
        return NextResponse.json({ error: 'jour_diner invalide' }, { status: 400 });
      }
      const { resteActif } = await toggleRestes(user.id, semaine_debut, jour, admin);
      return NextResponse.json({ success: true, reste_actif: resteActif, semaine_debut });
    }

    // ── Limites d'offre (plan gratuit) : contrôle serveur, impossible à contourner ──
    const payant = estPayant(await planUtilisateur(user.id, admin));
    if (!payant && intention !== undefined) {
      return reponsePaywall('intentions', 'Les optimisations Budget, Gain de temps et Anti-gaspi sont incluses dans les plans Pro et Famille.');
    }

    // ── Régénération partielle : uniquement les repas passés dans `slots` ──
    if (Array.isArray(body.slots) && body.slots.length > 0) {
      const slots: PlanSlot[] = (body.slots as unknown[])
        .filter((s): s is { jour_semaine: number; repas_type: PlanSlot['repas_type'] } =>
          typeof s === 'object' && s !== null
          && Number.isInteger((s as { jour_semaine?: unknown }).jour_semaine)
          && ['dejeuner', 'diner', 'dessert', 'dessert_midi'].includes((s as { repas_type?: unknown }).repas_type as string))
        .map(s => ({ jour_semaine: s.jour_semaine, repas_type: s.repas_type }));

      if (slots.length === 0) {
        return NextResponse.json({ error: 'Créneaux invalides' }, { status: 400 });
      }

      if (!payant && !(await rateLimit(`remplacements:${user.id}`, REMPLACEMENTS_GRATUITS_PAR_SEMAINE, 7 * 24 * 3600 * 1000)).ok) {
        return reponsePaywall('remplacements', `Plan gratuit : ${REMPLACEMENTS_GRATUITS_PAR_SEMAINE} remplacements automatiques par semaine. Passez à Pro pour changer vos repas sans limite.`);
      }
      const result = await regeneratePlanSlots(user.id, semaine_debut, slots, admin, Math.random, intention);
      return NextResponse.json({ success: true, partial: true, semaine_debut, ...result });
    }

    // ── Génération complète de la semaine ──
    // `days` sert à PERSISTER la semaine (`saveWeeklyPlan`), pas à la renvoyer :
    // le client recharge le planning depuis la base (`useWeeklyPlan`) et ne lit
    // que `error` dans cette réponse. Le sérialiser ici téléchargeait donc deux
    // fois la même semaine — et la copie de la réponse n'était jamais affichée.
    if (!payant && (await optimisationsRecentes(user.id, admin)) >= OPTIMISATIONS_GRATUITES_PAR_SEMAINE) {
      return reponsePaywall('optimisations', `Plan gratuit : ${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} optimisation de semaine tous les 7 jours. Passez à Pro pour optimiser sans limite.`);
    }
    const { days, fallbackUtilise, cuisinesDiversifiees } = await generateWeeklyPlan(user.id, semaine_debut, admin, Math.random, intention);
    const result = await saveWeeklyPlan(user.id, semaine_debut, days, admin, fallbackUtilise, cuisinesDiversifiees);

    return NextResponse.json({
      success: true,
      plan_id: result.planId,
      shopping_list_id: result.shoppingListId,
      semaine_debut,
      /** true = le cooldown de rotation a été levé (recettes récentes réutilisées) */
      fallback_utilise: fallbackUtilise,
      /** En fallback : cuisines peu servies récemment, mises en avant cette semaine (persisté sur le plan) */
      cuisines_diversifiees: cuisinesDiversifiees,
    });
  } catch (error) {
    console.error('Erreur génération:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

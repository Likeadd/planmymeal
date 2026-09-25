import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { generateWeeklyPlan, regeneratePlanSlots, saveWeeklyPlan, toggleRestes, validerIntention, type PlanSlot, type Db } from '@/lib/rotation-engine';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getMonday } from '@/lib/dates';
import { UserError, publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

/**
 * Limite d'offre côté serveur : le plan gratuit a droit à 4 générations par
 * semaine glissante (7 jours) — de quoi régénérer, sans abuser du compute.
 * Pro/Famille : illimité.
 */
const GENERATIONS_GRATUIT_PAR_SEMAINE = 4;

async function verifierLimitePlan(userId: string, admin: Db): Promise<void> {
  const { data: profile } = await admin
    .from('profiles').select('plan').eq('id', userId).single();
  if (!profile || profile.plan !== 'gratuit') return; // pro/famille → illimité

  const ilYa7Jours = new Date();
  ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);
  const { count } = await admin
    .from('weekly_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('generated_at', ilYa7Jours.toISOString());

  if ((count ?? 0) >= GENERATIONS_GRATUIT_PAR_SEMAINE) {
    throw new UserError(
      'Limite du plan gratuit atteinte (4 générations / 7 jours). Passez à Pro pour des générations illimitées.'
    );
  }
}

export async function POST(request: NextRequest) {
  // Anti-abus : borne le débit brut par IP (le compute de génération est
  // cher) — la limite d'offre métier (4/sem sur gratuit) est vérifiée plus bas.
  const limited = enforceRateLimit(request, { name: 'generate-week', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'generate-week', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json();
    const semaine_debut = body.semaine_debut || getMonday();
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

    // ── Limite d'offre (plan gratuit) : comptage serveur, impossible à contourner ──
    await verifierLimitePlan(user.id, admin);

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

      const result = await regeneratePlanSlots(user.id, semaine_debut, slots, admin, Math.random, intention);
      return NextResponse.json({ success: true, partial: true, semaine_debut, ...result });
    }

    // ── Génération complète de la semaine ──
    // `days` sert à PERSISTER la semaine (`saveWeeklyPlan`), pas à la renvoyer :
    // le client recharge le planning depuis la base (`useWeeklyPlan`) et ne lit
    // que `error` dans cette réponse. Le sérialiser ici téléchargeait donc deux
    // fois la même semaine — et la copie de la réponse n'était jamais affichée.
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
    // Limite d'offre → 429 (Too Many Requests), pas une erreur serveur
    const message = publicErrorMessage(error);
    const status = message.includes('Limite du plan gratuit') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

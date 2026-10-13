// ============================================================================
// API Suppression de compte (RGPD / art. 17 — droit à l'effacement)
// POST { confirmation: "SUPPRIMER" } → déconnecte puis supprime le compte
// Supabase Auth de l'utilisateur. Toutes les données applicatives (profiles,
// plans, historique, listes de courses, favoris…) sont supprimées en cascade
// via les FK "on delete cascade".
// Garde-fou : le mot exact "SUPPRIMER" est requis (pas de suppression accidentelle).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe-serveur';

export async function POST(request: NextRequest) {
  // Anti-abus : route irréversible (RGPD) — débit très serré.
  const limited = await enforceRateLimit(request, { name: 'compte-supprimer', limit: 5, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() { /* lecture seule */ },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'compte-supprimer', limit: 5, windowMs: 5 * 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== 'SUPPRIMER') {
      return NextResponse.json(
        { error: 'Confirmation invalide — tapez SUPPRIMER pour confirmer' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // 0. Résilier l'abonnement Stripe AVANT la suppression : sans cela, le
    //    webhook « customer.subscription.deleted » chercherait un profil déjà
    //    effacé, et surtout Stripe continuerait de prélever un compte supprimé.
    //    Best-effort : un compte gratuit (ou Stripe mal configuré) ne doit pas
    //    empêcher l'exercice du droit à l'effacement.
    try {
      const { data: prof } = await admin.from('profiles')
        .select('stripe_customer_id, stripe_subscription_id').eq('id', user.id).maybeSingle();
      if (prof?.stripe_customer_id) {
        const stripe = await getStripeClient();
        if (stripe && prof.stripe_subscription_id) {
          await stripe.subscriptions.cancel(prof.stripe_subscription_id);
        }
      }
    } catch (e) {
      console.error('Résiliation Stripe (non bloquant):', e);
    }

    // 1. Purge applicative explicite — ordre : les enfants avant les parents.
    //    (Les FK cascade couvrent déjà l'essentiel, on force aussi les tables
    //    sans cascade pour être exhaustif.)
    //    Migrations 00016/00017 incluses : mémoire alimentaire, frigo et
    //    profils famille (les tables family_member_* sont en cascade sur
    //    family_members).
    //
    //    Foyer partagé (migration 00021) : `households.created_by` référence
    //    profiles SANS cascade — sans cette purge, supprimer le compte d'un
    //    créateur de foyer plantait la suppression (violation de clé étrangère).
    const { data: foyersPossedes } = await admin
      .from('households').select('id').eq('created_by', user.id);
    for (const foyer of foyersPossedes ?? []) {
      await admin.from('household_invitations').delete().eq('household_id', foyer.id);
      await admin.from('household_members').delete().eq('household_id', foyer.id);
      await admin.from('households').delete().eq('id', foyer.id);
    }
    await admin.from('household_members').delete().eq('user_id', user.id);

    await admin.from('user_prix_ingredients').delete().eq('user_id', user.id);
    await admin.from('weekly_budget_snapshots').delete().eq('user_id', user.id);
    await admin.from('user_allergies').delete().eq('user_id', user.id);
    await admin.from('user_dislikes').delete().eq('user_id', user.id);
    await admin.from('user_diets').delete().eq('user_id', user.id);
    await admin.from('meal_history').delete().eq('user_id', user.id);
    await admin.from('user_meal_preferences').delete().eq('user_id', user.id);
    await admin.from('fridge_items').delete().eq('user_id', user.id);
    await admin.from('family_members').delete().eq('user_id', user.id);
    await admin.from('shopping_lists').delete().eq('user_id', user.id);
    await admin.from('weekly_plans').delete().eq('user_id', user.id);
    // Recettes créées ou importées par l'utilisateur : `meals.created_by` référence profiles SANS cascade —
    // sans cette purge, le compte d'un utilisateur ayant importé une recette ne pouvait pas être supprimé.
    await admin.from('meals').delete().eq('created_by', user.id);
    const { error: erreurProfil } = await admin.from('profiles').delete().eq('id', user.id);
    if (erreurProfil) {
      console.error('Suppression du profil impossible:', erreurProfil.message);
      return NextResponse.json(
        { error: 'La suppression du compte a échoué. Réessayez, ou contactez le support : nous la traiterons sous 48 h.' },
        { status: 500 }
      );
    }

    // 2. Suppression du compte auth (service role requis)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('Erreur suppression auth user:', deleteError.message);
      return NextResponse.json(
        { error: 'Les données ont été supprimées mais la suppression du compte a échoué. Contactez le support.' },
        { status: 500 }
      );
    }

    // 3. Déconnexion locale (purge des cookies de session)
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression compte:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

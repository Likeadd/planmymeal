import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { snapshotBudget, calculerDepenseSemaine } from '@/lib/rotation-engine';
import { calculerEconomieReference } from '@/lib/budget';
import { semaineOuLundi } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'budget-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const semaine_debut = semaineOuLundi(request.nextUrl.searchParams.get('semaine_debut'));

    // Profil (budget défini ? base de dépense déclarée ?)
    const { data: profile } = await admin
      .from('profiles').select('budget_hebdo, nb_personnes, prix_max_portion, depense_reference_hebdo, depense_reference_saisie_le').eq('id', user.id).single();

    // Mode du budget : requête à part (colonne ajoutée par la migration 00036 ; strict par défaut)
    const { data: modeRow } = await admin.from('profiles').select('budget_strict').eq('id', user.id).single();

    // Plan de la semaine + snapshot existant
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();

    const { data: snapshot } = await admin.from('weekly_budget_snapshots')
      .select('*').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();

    // Dépense recalculée en direct (les prix peuvent avoir changé)
    let depense = snapshot?.depense ?? 0;
    if (plan) depense = await calculerDepenseSemaine(user.id, plan.id, admin);

    // Historique des snapshots (économies semaine par semaine)
    const { data: history } = await admin.from('weekly_budget_snapshots')
      .select('semaine_debut, budget, depense, economie, depense_reelle, nb_personnes')
      .eq('user_id', user.id)
      .order('semaine_debut', { ascending: false })
      .limit(12);

    // Prix personnalisés de l'utilisateur
    const { data: overrides } = await admin.from('user_prix_ingredients')
      .select('ingredient_id, prix_unitaire').eq('user_id', user.id);

    // Économie vs la base DÉCLARÉE par l'utilisateur (null si base non saisie)
    const depenseReference = profile?.depense_reference_hebdo ?? null;
    const economieReference = calculerEconomieReference(depenseReference, depense);

    return NextResponse.json({
      budget: profile?.budget_hebdo ?? null,
      budget_strict: modeRow?.budget_strict !== false,
      nb_personnes: profile?.nb_personnes ?? 2,
      prix_max_portion: profile?.prix_max_portion ?? null,
      depense,
      economie: profile?.budget_hebdo != null ? Math.round((profile.budget_hebdo - depense) * 100) / 100 : 0,
      depense_reference_hebdo: depenseReference,
      depense_reference_saisie_le: profile?.depense_reference_saisie_le ?? null,
      economie_reference: economieReference,
      snapshot: snapshot ?? null,
      // economie_reelle calculée avec la base ACTUELLE (la base n'est pas
      // historisée par semaine — approximation assumée)
      history: (history || []).map(h => ({
        ...h,
        economie_reelle: depenseReference != null && h.depense_reelle != null
          ? Math.round((depenseReference - h.depense_reelle) * 100) / 100
          : null,
      })),
      overrides: overrides || [],
    });
  } catch (error) {
    console.error('Erreur GET /api/budget:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Anti-abus : écriture budget/base/dépense + recalcul snapshot
  const limited = await enforceRateLimit(request, { name: 'budget', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'budget', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const admin = getSupabaseAdmin();

    // ── Mise à jour du budget hebdomadaire ──
    if (body.budget_hebdo !== undefined) {
      const budget = body.budget_hebdo === null ? null : Number(body.budget_hebdo);
      if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 10000)) {
        return NextResponse.json({ error: 'Budget invalide (0 – 10000 €)' }, { status: 400 });
      }
      const { error: updateError } = await admin.from('profiles')
        .update({ budget_hebdo: budget }).eq('id', user.id);
      if (updateError) throw new Error(updateError.message);

      // Rafraîchir le snapshot de la semaine courante avec le nouveau budget
      const semaine_debut = semaineOuLundi(body.semaine_debut);
      const { data: plan } = await admin.from('weekly_plans')
        .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
      if (plan) await snapshotBudget(user.id, semaine_debut, plan.id, admin);

      return NextResponse.json({ success: true, budget_hebdo: budget });
    }

    // ── Mode du budget : strict / souple ──
    if (body.budget_strict !== undefined) {
      if (typeof body.budget_strict !== 'boolean') return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
      const { error: updateError } = await admin.from('profiles')
        .update({ budget_strict: body.budget_strict }).eq('id', user.id);
      if (updateError) return NextResponse.json({ error: 'Mode du budget indisponible pour le moment' }, { status: 503 });
      return NextResponse.json({ success: true, budget_strict: body.budget_strict });
    }

    // ── Prix max par portion (Pro) : cap strict sur la sélection ──
    if (body.prix_max_portion !== undefined) {
      const { data: prof } = await admin.from('profiles').select('plan').eq('id', user.id).single();
      if (!prof || prof.plan === 'gratuit') {
        return NextResponse.json({ error: "Fonctionnalité Pro — mettez à niveau votre compte" }, { status: 403 });
      }
      const prixMax = body.prix_max_portion === null ? null : Number(body.prix_max_portion);
      if (prixMax !== null && (!Number.isFinite(prixMax) || prixMax <= 0 || prixMax > 100)) {
        return NextResponse.json({ error: 'Prix max invalide (0,50 – 100 €)' }, { status: 400 });
      }
      const { error: updateError } = await admin.from('profiles')
        .update({ prix_max_portion: prixMax }).eq('id', user.id);
      if (updateError) throw new Error(updateError.message);
      return NextResponse.json({ success: true, prix_max_portion: prixMax });
    }

    // ── Prix personnalisé d'un ingrédient ──
    if (body.ingredient_id !== undefined && body.prix_unitaire !== undefined) {
      const prix = Number(body.prix_unitaire);
      const ingredientId = Number(body.ingredient_id);
      if (!Number.isFinite(prix) || prix < 0 || !Number.isInteger(ingredientId)) {
        return NextResponse.json({ error: 'Prix invalide' }, { status: 400 });
      }
      const { error: upsertError } = await admin.from('user_prix_ingredients').upsert(
        { user_id: user.id, ingredient_id: ingredientId, prix_unitaire: prix, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,ingredient_id' }
      );
      if (upsertError) throw new Error(upsertError.message);

      // Le changement de prix affecte la dépense de la semaine → snapshot
      const semaine_debut = semaineOuLundi(body.semaine_debut);
      const { data: plan } = await admin.from('weekly_plans')
        .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
      if (plan) await snapshotBudget(user.id, semaine_debut, plan.id, admin);

      return NextResponse.json({ success: true });
    }

    // ── Base de dépense déclarée (économies ancrées utilisateur) ──
    if (body.depense_reference_hebdo !== undefined) {
      const ref = body.depense_reference_hebdo === null ? null : Number(body.depense_reference_hebdo);
      if (ref !== null && (!Number.isFinite(ref) || ref <= 0 || ref > 10000)) {
        return NextResponse.json({ error: 'Base de dépense invalide (1 – 10000 €)' }, { status: 400 });
      }
      const { error: updateError } = await admin.from('profiles').update({
        depense_reference_hebdo: ref,
        depense_reference_saisie_le: ref != null ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', user.id);
      if (updateError) throw new Error(updateError.message);
      return NextResponse.json({ success: true, depense_reference_hebdo: ref });
    }

    // ── Dépense réelle saisie après les courses (vérité terrain) ──
    if (body.depense_reelle !== undefined) {
      const depenseReelle = body.depense_reelle === null ? null : Number(body.depense_reelle);
      if (depenseReelle !== null && (!Number.isFinite(depenseReelle) || depenseReelle < 0 || depenseReelle > 10000)) {
        return NextResponse.json({ error: 'Dépense réelle invalide (0 – 10000 €)' }, { status: 400 });
      }
      const semaine = semaineOuLundi(body.semaine_debut);

      const { data: snap } = await admin.from('weekly_budget_snapshots')
        .select('id').eq('user_id', user.id).eq('semaine_debut', semaine).maybeSingle();

      if (snap) {
        const { error: updateError } = await admin.from('weekly_budget_snapshots')
          .update({ depense_reelle: depenseReelle, updated_at: new Date().toISOString() })
          .eq('id', snap.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        // Pas encore de snapshot cette semaine → on crée la base avant d'y
        // écrire la dépense réelle (une ligne snapshot par semaine est requise
        // par la contrainte unique user_id + semaine_debut).
        const { data: prof } = await admin.from('profiles')
          .select('nb_personnes, budget_hebdo').eq('id', user.id).single();
        const { data: plan } = await admin.from('weekly_plans')
          .select('id').eq('user_id', user.id).eq('semaine_debut', semaine).maybeSingle();
        let depense = 0;
        if (plan) {
          await snapshotBudget(user.id, semaine, plan.id, admin);
          const { data: fresh } = await admin.from('weekly_budget_snapshots')
            .select('depense').eq('user_id', user.id).eq('semaine_debut', semaine).maybeSingle();
          depense = fresh?.depense ?? 0;
        }
        const budget = prof?.budget_hebdo ?? 0;
        const { error: insertError } = await admin.from('weekly_budget_snapshots').insert({
          user_id: user.id,
          semaine_debut: semaine,
          budget,
          depense,
          economie: Math.round((budget - depense) * 100) / 100,
          nb_personnes: prof?.nb_personnes ?? 2,
          depense_reelle: depenseReelle,
        });
        if (insertError) throw new Error(insertError.message);
      }
      return NextResponse.json({ success: true, depense_reelle: depenseReelle });
    }

    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  } catch (error) {
    console.error('Erreur PUT /api/budget:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

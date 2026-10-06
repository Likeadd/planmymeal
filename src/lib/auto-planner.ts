// ============================================================================
// Auto-planner — orchestration du cron « auto-generate-week »
//
// Remplace le fork Edge Function (supabase/functions/auto-generate-week) qui
// copiait une VIEILLE version du moteur : sans mémoire alimentaire, frigo,
// profils famille, budget, équipement ni desserts — et surtout avec des
// écritures non transactionnelles. Chaque dimanche, il écrasait les plannings
// avec cette logique obsolète, invisible pour l'utilisateur (aucune erreur
// remontée, juste un planning « qui oublie tout ce que le foyer a appris »).
//
// Désormais : UNE SEULE source de vérité — le moteur `rotation-engine.ts`,
// exactement celui qu'appelle le bouton « Générer ma semaine » de l'app.
// Ce module n'implémente AUCUNE règle métier : il itère les utilisateurs,
// délègue à `generateWeeklyPlan` + `saveWeeklyPlan` et protège le planning
// existant (jamais écraser une semaine déjà planifiée).
//
// Pur et testable : aucune dépendance à fetch/Next/Deno — le client Supabase
// (admin) et l'horloge sont injectés.
// ============================================================================

import type { Db } from '@/lib/rotation-engine';
import { generateWeeklyPlan, saveWeeklyPlan } from '@/lib/rotation-engine';
import { getMondayWithOffset } from '@/lib/dates';

export const TAILLE_PAGE = 100;

/**
 * Fenêtre glissante : le cron du dimanche maintient toujours les
 * `NB_SEMAINES_GLISSANTES` semaines à venir déjà planifiées (pas seulement la
 * suivante), pour que le digest du vendredi ait toujours une semaine prête à
 * annoncer et que la navigation dashboard (WEEK_OFFSET_MAX dans
 * useWeeklyPlan.ts, qui autorise déjà 4 semaines en avant) trouve un planning
 * à chaque fois plutôt qu'un état vide.
 */
export const NB_SEMAINES_GLISSANTES = 4;

/** Générations menées en parallèle (le moteur est surtout en attente réseau). */
export const CONCURRENCE = 5;

/**
 * Sobriété : on ne prépare pas des semaines que personne ne regardera.
 * - semaine suivante (offset 1) : comptes connectés dans les 90 derniers jours ;
 * - semaines 2 à 4 : comptes connectés dans les 30 derniers jours.
 * Un compte absent de la carte d'activité est traité comme actif (prudence).
 */
export const ACTIF_SEMAINE_SUIVANTE_JOURS = 90;
export const ACTIF_FENETRE_JOURS = 30;

export type StatutUtilisateur = 'genere' | 'existant' | 'erreur';

export interface ResultatUtilisateur {
  userId: string;
  status: StatutUtilisateur;
  message: string;
}

export interface ResultatAutoPlan {
  semaineDebut: string;
  total: number;
  generes: number;
  conserves: number;
  erreurs: number;
  results: ResultatUtilisateur[];
}

/** Profil minimal requis pour décider de générer et quoi générer */
interface ProfilCron {
  id: string;
  email: string | null;
  plan: string | null;
  auto_generate: boolean | null;
}

/**
 * Client Supabase minimal — implémenté par le client admin réel (route cron)
 * et par le mock de test. Chaînage PostgREST utilisé ici :
 *   from(t).select(cols).eq(col, val)…[.range(from, to)] → { data, error }
 * (`eq` se chaîne arbitrairement : la garde anti-écrasement filtre sur
 * user_id PUIS semaine_debut ; sans range, l'await exécute la requête.)
 */
export interface AutoPlanReponse {
  data: unknown;
  error: { message: string } | null;
}

export type AutoPlanRequete = {
  eq(column: string, value: unknown): AutoPlanRequete;
  range(from: number, to: number): PromiseLike<AutoPlanReponse>;
} & PromiseLike<AutoPlanReponse>;

export type AutoPlanDb = {
  from(table: string): {
    select(columns: string): AutoPlanRequete;
  };
};

/** Génère le planning d'un utilisateur via le VRAI moteur. */
export async function genererSemaineUtilisateur(
  userId: string,
  semaineDebut: string,
  supabase: Db
): Promise<{ planId: number; shoppingListId: number }> {
  const { days, fallbackUtilise, cuisinesDiversifiees } = await generateWeeklyPlan(userId, semaineDebut, supabase);
  return saveWeeklyPlan(userId, semaineDebut, days, supabase, fallbackUtilise, cuisinesDiversifiees);
}

/**
 * Orchestration complète du cron. Idempotent : un planning déjà construit pour
 * la semaine cible (manuel ou d'un run précédent) n'est JAMAIS écrasé.
 * @param offsetWeeks 1 = semaine qui arrive (DÉFAUT, sémantique cron) —
 *                     0 = semaine courante. Le défaut est volontairement 1 :
 *                     un appelant qui oublie le paramètre prépare la bonne
 *                     semaine au lieu de reproduire silencieusement le bug du
 *                     fork (écraser le planning en cours le dimanche soir).
 * @param maintenant  horloge injectée (tests)
 * @param limit       borne le nombre de générations effectives (rayon de sécurité)
 * @param cursor      reprend après ce user_id (continuation si limite atteinte)
 */
export async function orchestrerAutoPlan(
  supabase: AutoPlanDb,
  options: {
    offsetWeeks?: number;
    dryRun?: boolean;
    limit?: number;
    cursor?: string | null;
    logger?: (message: string) => void;
    /** Injection (tests) : remplace l'appel au vrai moteur */
    generer?: typeof genererSemaineUtilisateur;
    /** Filtre d'éligibilité supplémentaire (ex. activité récente) */
    eligible?: (userId: string) => boolean;
  } = {}
): Promise<ResultatAutoPlan> {
  const {
    offsetWeeks = 1, // défaut cron : la semaine qui arrive (voir doc au-dessus)
    dryRun = false,
    limit = Infinity,
    cursor = null,
    logger = () => {},
    generer = genererSemaineUtilisateur,
    eligible = () => true,
  } = options;

  // Le cron tourne le dimanche 19h UTC (20h/21h Paris selon la saison) → il
  // prépare la SEMAINE
  // QUI ARRIVE, pas la semaine courante. Le fork calculait `getMonday()`,
  // c'est-à-dire le lundi de la semaine qui se termine : il écrasait le
  // planning EN COURS au lieu de préparer le suivant.
  const semaineDebut = getMondayWithOffset(offsetWeeks);
  const result: ResultatAutoPlan = {
    semaineDebut, total: 0, generes: 0, conserves: 0, erreurs: 0, results: [],
  };

  // 1. Profils éligibles : onboarding terminé + opt-in non désactivé.
  //    Page 1 contient déjà les comptes récents ; les pages suivantes ne
  //    servent qu'aux très gros volumes (pagination PostgREST 1000).
  const profils: ProfilCron[] = [];
  for (let page = 0; ; page++) {
    const from = page * TAILLE_PAGE;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, plan, auto_generate')
      .eq('onboarding_complete', true)
      .range(from, from + TAILLE_PAGE - 1);

    if (error) throw new Error(`Erreur chargement profils: ${error.message}`);
    const lignes = (data ?? []) as ProfilCron[];
    profils.push(...lignes);
    if (lignes.length < TAILLE_PAGE) break;
  }

  logger(`${profils.length} profil(s) éligible(s) pour la semaine ${semaineDebut}`);

  // Résultats rangés dans l'ordre des profils, quel que soit l'ordre de fin
  // des traitements parallèles.
  const parProfil = new Map<string, ResultatUtilisateur>();
  const aTraiter: ProfilCron[] = [];
  let curseurAtteint = !cursor;

  for (const profil of profils) {
    // Continuation : sauter jusqu'au curseur inclus
    if (!curseurAtteint) {
      if (profil.id !== cursor) continue;
      curseurAtteint = true;
    }

    // Opt-out explicite (colonne auto_generate, défaut true)
    if (profil.auto_generate === false) {
      parProfil.set(profil.id, { userId: profil.id, status: 'existant', message: 'auto-génération désactivée' });
      continue;
    }
    // Planification automatique des semaines : avantage des plans payants
    if (profil.plan !== 'pro' && profil.plan !== 'famille') {
      parProfil.set(profil.id, { userId: profil.id, status: 'existant', message: 'plan gratuit — pas de planification automatique' });
      continue;
    }
    if (!eligible(profil.id)) {
      parProfil.set(profil.id, { userId: profil.id, status: 'existant', message: 'compte inactif — non planifié' });
      continue;
    }
    aTraiter.push(profil);
  }

  // Par lots de CONCURRENCE : vérification anti-écrasement en parallèle, puis
  // décision (limite du run) dans l'ordre, puis générations en parallèle.
  for (let i = 0; i < aTraiter.length; i += CONCURRENCE) {
    const lot = aTraiter.slice(i, i + CONCURRENCE);

    // 2. Anti-écrasement : une semaine déjà planifiée (manuellement ou par un
    //    run précédent) n'est jamais régénérée par le cron.
    const dejaPlanifies = await Promise.all(lot.map(async profil => {
      const { data: existant } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('user_id', profil.id)
        .eq('semaine_debut', semaineDebut);
      return !!(existant as { id: number }[] | null)?.length;
    }));

    const aGenerer: ProfilCron[] = [];
    lot.forEach((profil, k) => {
      if (dejaPlanifies[k]) {
        result.conserves++;
        parProfil.set(profil.id, { userId: profil.id, status: 'existant', message: 'planning déjà présent' });
        logger(`⏭ ${profil.email ?? profil.id} — déjà planifié`);
      } else if (dryRun) {
        result.generes++; // décompte prospectif (aucune écriture)
        parProfil.set(profil.id, { userId: profil.id, status: 'genere', message: 'dry run' });
      } else if (result.generes + aGenerer.length >= limit) {
        parProfil.set(profil.id, { userId: profil.id, status: 'erreur', message: 'limite du run atteinte (reprendre avec cursor)' });
      } else {
        aGenerer.push(profil);
      }
    });

    // 3. Délégation au vrai moteur — même chemin que POST /api/generate-week
    //    (scoring, mémoire, frigo, famille, budget, équipement, restes,
    //    desserts, RPC transactionnel, snapshot budget).
    await Promise.all(aGenerer.map(async profil => {
      try {
        logger(`▶ ${profil.email ?? profil.id}`);
        await generer(profil.id, semaineDebut, supabase as unknown as Db);
        result.generes++;
        parProfil.set(profil.id, { userId: profil.id, status: 'genere', message: 'planning généré' });
      } catch (err) {
        result.erreurs++;
        const message = err instanceof Error ? err.message : String(err);
        parProfil.set(profil.id, { userId: profil.id, status: 'erreur', message });
        logger(`❌ ${profil.email ?? profil.id} — ${message}`);
      }
    }));
  }

  for (const profil of profils) {
    const r = parProfil.get(profil.id);
    if (r) result.results.push(r);
  }

  result.total = profils.length;
  return result;
}

/**
 * Fenêtre glissante : répète `orchestrerAutoPlan` pour chacune des
 * `NB_SEMAINES_GLISSANTES` semaines à venir (1 = la suivante). Chaque semaine
 * reste protégée par la même garde anti-écrasement — rejouer ce cron un jour
 * sans nouvel utilisateur ne génère donc rien de plus.
 * `limit`/`cursor` ne s'appliquent qu'à la PREMIÈRE semaine (offset 1, la
 * plus urgente) : au-delà, une reprise se refait via un nouvel appel plutôt
 * que de complexifier un curseur à deux dimensions (semaine × utilisateur).
 */
export async function orchestrerAutoPlanGlissant(
  supabase: AutoPlanDb,
  options: {
    dryRun?: boolean;
    limit?: number;
    cursor?: string | null;
    logger?: (message: string) => void;
    generer?: typeof genererSemaineUtilisateur;
    nbSemaines?: number;
    /** userId → dernière connexion (ms). Absent = aucun filtre d'activité. */
    activite?: Map<string, number> | null;
    /** Horloge injectée (tests) */
    maintenant?: number;
  } = {}
): Promise<ResultatAutoPlan[]> {
  const { nbSemaines = NB_SEMAINES_GLISSANTES, activite = null, maintenant = Date.now(), ...rest } = options;
  const actifDepuis = (jours: number) => (userId: string) => {
    const derniere = activite?.get(userId);
    return derniere == null || maintenant - derniere <= jours * 86_400_000;
  };
  const resultats: ResultatAutoPlan[] = [];
  for (let offsetWeeks = 1; offsetWeeks <= nbSemaines; offsetWeeks++) {
    resultats.push(await orchestrerAutoPlan(supabase, {
      ...rest,
      offsetWeeks,
      // Le curseur de reprise ne s'applique qu'à la semaine la plus urgente.
      cursor: offsetWeeks === 1 ? rest.cursor : null,
      eligible: actifDepuis(offsetWeeks === 1 ? ACTIF_SEMAINE_SUIVANTE_JOURS : ACTIF_FENETRE_JOURS),
    }));
  }
  return resultats;
}

// ============================================================================
// POST /api/mesure — collecte de la mesure d'audience INTERNE (anonyme, sans cookie).
// Voir lib/mesure-interne.ts. Répond toujours 204 : le navigateur n'a rien à savoir de plus.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clientIp, rateLimitMemoire } from '@/lib/rate-limit';
import { dateParis } from '@/lib/dates';
import { analyserAgent, hashVisiteur, nettoyerMesure } from '@/lib/mesure-interne';

const vide = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  try {
    // Do Not Track / Global Privacy Control : aucune mesure
    if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return vide();

    const ua = request.headers.get('user-agent') ?? '';
    const agent = analyserAgent(ua);
    if (agent.robot) return vide();

    const ip = clientIp(request);
    // Limite en mémoire (pas d'aller-retour base par page vue) : 120 mesures / minute / adresse
    if (!rateLimitMemoire(`mesure:${ip}`, 120, 60_000).ok) return vide();

    const texte = await request.text();
    if (texte.length > 2000) return vide();
    let corps: unknown;
    try { corps = JSON.parse(texte); } catch { return vide(); }

    const mesure = nettoyerMesure(corps, request.nextUrl.hostname);
    if (!mesure) return vide();

    const jour = dateParis();
    const secret = process.env.ANALYTICS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!secret) return vide();
    const pays = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase();

    // Table hors des types générés : client non typé pour cette écriture
    await (getSupabaseAdmin() as unknown as SupabaseClient).from('mesure_evenements').insert({
      jour,
      visiteur: hashVisiteur(ip, ua, jour, secret),
      type: mesure.type,
      chemin: mesure.chemin,
      nom: mesure.nom,
      source: mesure.source,
      pays: /^[A-Z]{2}$/.test(pays) ? pays : null,
      appareil: agent.appareil,
      navigateur: agent.navigateur,
      systeme: agent.systeme,
      props: mesure.props,
    });
  } catch (e) {
    console.error('Erreur POST /api/mesure:', e instanceof Error ? e.message : e);
  }
  return vide();
}

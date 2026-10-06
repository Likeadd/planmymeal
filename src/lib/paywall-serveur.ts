// Réponse standard d'une fonction réservée aux plans payants (voir lib/paywall.ts).
import { NextResponse } from 'next/server';
import type { RaisonPaywall } from '@/lib/limites';

/** 402 Payment Required : le client ouvre le paywall au lieu d'une erreur. */
export function reponsePaywall(raison: RaisonPaywall, message: string) {
  return NextResponse.json({ error: message, paywall: raison }, { status: 402 });
}

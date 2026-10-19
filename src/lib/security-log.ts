// ============================================================================
// Journal de sécurité — PlanMyMeal (serveur uniquement)
//
// Trace les signaux d'attaque (rate-limit dépassé, honeypot déclenché, secret
// cron invalide, callback auth suspect…) :
//   1. log structuré JSON (visible dans les logs Vercel, filtrable « [security] ») ;
//   2. insertion best-effort dans public.security_events (service_role only).
// Ne fait jamais échouer la requête appelante.
// ============================================================================

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clientIp } from '@/lib/rate-limit';

export type SecurityEventType =
  | 'rate_limit'
  | 'honeypot'
  | 'cron_secret'
  | 'auth_callback'
  | 'signup_abuse'
  | 'otp_abuse'
  | 'login_abuse'
  | 'csrf'
  | 'payload_too_large';

export interface SecurityEvent {
  type: SecurityEventType;
  ip?: string;
  userId?: string | null;
  route?: string;
  details?: Record<string, unknown>;
}

/**
 * Minimisation (audit VULN-011) : une adresse email n'est jamais journalisée en clair, seulement une
 * empreinte (permet de corréler les tentatives sur un même compte sans stocker l'adresse).
 */
export function sansEmailEnClair(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details || typeof details.email !== 'string') return details;
  const { email, ...reste } = details;
  const sel = process.env.ANALYTICS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { ...reste, email_hash: createHash('sha256').update(`${sel}|${email.toLowerCase()}`).digest('hex').slice(0, 16) };
}

export function logSecurityEvent(event: SecurityEvent): void {
  event = { ...event, details: sansEmailEnClair(event.details) };
  console.warn('[security]', JSON.stringify({ at: new Date().toISOString(), ...event }));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    // Table hors des types générés → client non typé pour cette écriture.
    const admin = getSupabaseAdmin() as unknown as SupabaseClient;
    void admin
      .from('security_events')
      .insert({
        type: event.type,
        ip: event.ip ?? null,
        user_id: event.userId ?? null,
        route: event.route ?? null,
        details: event.details ?? {},
      })
      .then(({ error }) => {
        if (error) console.error('[security] insertion journal impossible:', error.message);
      });
  } catch (e) {
    console.error('[security] journal indisponible:', e);
  }
}

/** Raccourci : événement lié à une requête HTTP (IP + route renseignées). */
export function logRequestSecurityEvent(
  request: NextRequest,
  type: SecurityEventType,
  details?: Record<string, unknown>,
  userId?: string | null
): void {
  logSecurityEvent({
    type,
    ip: clientIp(request),
    route: request.nextUrl.pathname,
    userId: userId ?? null,
    details,
  });
}

// ============================================================================
// Rate-limiting en mémoire — PlanMyMeal
//
// Fenêtre glissante par IP+route, stockée en mémoire du process serveur.
// Objectif : casser les abus simples sur les routes d'écriture (spam, script
// enfant, retry storms) en complément des limites métier (4 générations/semaine
// sur le plan gratuit) et des limites Supabase (signup/login).
//
// NB mono-instance : sur Vercel, chaque lambda a sa mémoire — la limite est
// donc « par instance ». Suffisant contre les abus ; si le trafic le justifie,
// migrer vers Upstash Redis (@upstash/ratelimit) sans changer l'API ci-dessous.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { logSecurityEvent } from '@/lib/security-log';

const buckets = new Map<string, number[]>();

// Nettoyage périodique : une entrée par IP+route sinon fuite mémoire à vie
// du process. Balayage toutes les 5 minutes, entrées > 1 h supprimées.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const MAX_ENTRY_AGE_MS = 60 * 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const alive = hits.filter(t => now - t < MAX_ENTRY_AGE_MS);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Secondes à attendre avant un nouvel essai (0 si ok) */
  retryAfterSec: number;
}

/** Fenêtre glissante : true si l'appel reste sous `limit` appels / `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    const oldest = hits[0];
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

/** IP client derrière le proxy (Vercel fournit x-forwarded-for / x-real-ip). */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'inconnue';
}

export interface RateLimitOptions {
  /** Identifiant de la route (namespacing du bucket) */
  name: string;
  /** Nombre max d'appels par fenêtre */
  limit: number;
  /** Fenêtre en ms (60_000 = par minute) */
  windowMs: number;
}

/**
 * À appeler en tête de chaque handler de route d'écriture :
 *   const limited = enforceRateLimit(request, { name: 'generate-week', limit: 20, windowMs: 60_000 });
 *   if (limited) return limited;
 * Retourne null si l'appel est autorisé, sinon une réponse 429 prête à renvoyer.
 */
export function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  const { ok, retryAfterSec } = rateLimit(
    `${options.name}:${clientIp(request)}`,
    options.limit,
    options.windowMs
  );
  if (ok) return null;

  logSecurityEvent({
    type: 'rate_limit',
    ip: clientIp(request),
    route: request.nextUrl.pathname,
    details: { bucket: options.name, scope: 'ip', retryAfterSec },
  });
  return tooManyRequests(retryAfterSec);
}

/**
 * Limite PAR UTILISATEUR (en plus de la limite par IP) — à appeler juste
 * après l'authentification : un compte ne peut pas contourner la limite en
 * changeant d'IP.
 *   const userLimited = enforceUserRateLimit(request, user.id, { name: 'frigo', limit: 60, windowMs: 60_000 });
 *   if (userLimited) return userLimited;
 */
export function enforceUserRateLimit(
  request: NextRequest,
  userId: string,
  options: RateLimitOptions
): NextResponse | null {
  const { ok, retryAfterSec } = rateLimit(
    `user:${options.name}:${userId}`,
    options.limit,
    options.windowMs
  );
  if (ok) return null;

  logSecurityEvent({
    type: 'rate_limit',
    ip: clientIp(request),
    userId,
    route: request.nextUrl.pathname,
    details: { bucket: options.name, scope: 'user', retryAfterSec },
  });
  return tooManyRequests(retryAfterSec);
}

function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Trop de requêtes — réessayez dans un instant.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

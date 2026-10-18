// ============================================================================
// Helpers auth côté serveur — inscription (Magic Link + OTP)
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

/** Client Supabase qui POSE les cookies de session / PKCE sur `response`. */
export function supabaseForResponse(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
}

/** URL de retour du lien magique (validée par la liste blanche Supabase). */
export function magicLinkRedirect(request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  return `${base.replace(/\/$/, '')}/auth/callback?next=/onboarding`;
}

const EMAIL_RE = /^[^\s@<>"'`,;()\\]+@[^\s@<>"'`,;()\\]+\.[^\s@<>"'`,;()\\]{2,}$/;

export function normaliserEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const email = v.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** Prénom : texte court, sans balises ni caractères de contrôle. */
export function normaliserPrenom(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const nom = v.replace(/[<>\u0000-\u001F\u007F]/g, '').trim();
  return nom.length >= 1 && nom.length <= 60 ? nom : null;
}

export function motDePasseValide(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 8 && v.length <= 72
    && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
}

/** Durée minimale (ms) de remplissage du formulaire : en dessous → robot. */
export const DUREE_MIN_FORMULAIRE_MS = 2500;

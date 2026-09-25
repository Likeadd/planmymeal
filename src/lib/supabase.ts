// ============================================================================
// Client Supabase — Navigateur + Admin (utilisable partout)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';
import type { Database } from '@/../supabase/database.types';

// Client public (composants React) — instance unique partagée.
// On utilise createBrowserClient de @supabase/ssr (cookies) pour que la
// session soit visible par le proxy (src/proxy.ts), qui protège les routes
// côté serveur via createServerClient. Un client localStorage seul rendrait
// les pages protégées inaccessibles (redirection systématique vers /login).
let _browserClient: ReturnType<typeof createSsrBrowserClient<Database>> | null = null;
export function createBrowserClient() {
  if (!_browserClient) {
    _browserClient = createSsrBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browserClient;
}

// Client admin (serveur / API — JAMAIS exposé côté client)
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabaseAdmin;
}

// ============================================================================
// API Bienvenue — déclenche l'email de bienvenue (transactionnel, unique)
// Appelé par la page onboarding quand le profil est complété. La garde
// d'idempotence côté service (welcome_email_envoye_le) garantit qu'un
// rechargement / un double appel ne renvoie jamais le email.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { envoyerEmailBienvenue } from '@/lib/email-service';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Anti-abus : l'email de bienvenue est idempotent côté service, mais on
  // borne le débit pour ne pas servir de déclencheur à du spam.
  const limited = await enforceRateLimit(request, { name: 'welcome', limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'welcome', limit: 5, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const result = await envoyerEmailBienvenue(user.id, getSupabaseAdmin());
    return NextResponse.json({ success: true, sent: result.sent, reason: result.reason ?? null });
  } catch (error) {
    console.error('Erreur POST /api/welcome:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

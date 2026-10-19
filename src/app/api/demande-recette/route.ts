// ============================================================================
// API Demandes de recettes — POST /api/demande-recette { titre, details? }
// Un utilisateur connecté propose un plat à ajouter au catalogue. La demande
// est enregistrée (table recipe_requests, migration 00034) et l'équipe en est
// prévenue par email quand l'envoi est configuré.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';

const DESTINATAIRE = process.env.CONTACT_EMAIL || 'contact@getplanmymeal.com';
const echapper = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'demande-recette', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Connectez-vous pour demander une recette.' }, { status: 401 });
  // 5 demandes par jour et par compte : de quoi proposer, pas de quoi inonder.
  const parJour = await enforceUserRateLimit(request, user.id, { name: 'demande-recette-jour', limit: 5, windowMs: 24 * 60 * 60_000 });
  if (parJour) return parJour;

  const body = await request.json().catch(() => ({}));
  // Caractères de contrôle retirés (audit VULN-014) : le titre part dans l'objet de l'email (en-tête)
  const titre = typeof body?.titre === 'string' ? body.titre.replace(/[\u0000-\u001F\u007F]/g, ' ').trim() : '';
  const details = typeof body?.details === 'string' ? body.details.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim() : '';
  if (titre.length < 3 || titre.length > 120) return NextResponse.json({ error: 'Le nom du plat doit contenir entre 3 et 120 caractères.' }, { status: 400 });
  if (details.length > 600) return NextResponse.json({ error: 'Les précisions sont limitées à 600 caractères.' }, { status: 400 });

  const { error } = await getSupabaseAdmin().from('recipe_requests' as never)
    .insert({ user_id: user.id, titre, details: details || null } as never);
  // Table absente (migration pas encore appliquée) : l'email suffit à ne rien perdre.
  const enregistre = !error;

  const mail = await sendEmail({
    to: DESTINATAIRE,
    subject: `[PlanMyMeal] Demande de recette : ${titre.slice(0, 80)}`,
    replyTo: user.email ?? undefined,
    html: `<p><strong>${echapper(titre)}</strong></p><p>${echapper(details || '(pas de précision)').replace(/\n/g, '<br>')}</p><p>De : ${echapper(user.email ?? user.id)}</p>`,
  });

  if (!enregistre && !mail.ok) return NextResponse.json({ error: 'Envoi impossible pour le moment. Réessayez plus tard.' }, { status: 503 });
  return NextResponse.json({ success: true });
}

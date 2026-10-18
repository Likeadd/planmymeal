// ============================================================================
// API Contact — envoie le message du formulaire /contact par email (Resend).
// Public : limité en débit, champ piège anti-robot, tout est échappé.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@<>"'`,;()\\]+@[^\s@<>"'`,;()\\]+\.[^\s@<>"'`,;()\\]{2,}$/;
const DESTINATAIRE = process.env.CONTACT_EMAIL || 'contact@getplanmymeal.com';
const SUJETS = ['Question générale', 'Mon abonnement', 'Un problème technique', 'Données personnelles', 'Partenariat'];

const echapper = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'contact', limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  // Champ piège : invisible pour un humain, rempli par les robots.
  if (typeof body?.site === 'string' && body.site) return NextResponse.json({ success: true });

  const nom = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const sujet = SUJETS.includes(body?.subject) ? body.subject : SUJETS[0];

  if (!nom || nom.length > 100) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 });
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
  if (message.length < 10 || message.length > 5000) return NextResponse.json({ error: 'Le message doit contenir entre 10 et 5 000 caractères' }, { status: 400 });

  const res = await sendEmail({
    to: DESTINATAIRE,
    subject: `[PlanMyMeal] ${sujet}`,
    replyTo: email,
    html: `<p><strong>${echapper(nom)}</strong> &lt;${echapper(email)}&gt;</p><p>${echapper(message).replace(/\n/g, '<br>')}</p>`,
  });
  if (!res.ok) return NextResponse.json({ error: 'Envoi impossible pour le moment' }, { status: 503 });
  return NextResponse.json({ success: true });
}

// ============================================================================
// Envoi d'emails transactionnels via Resend (REST pur, zéro dépendance)
// Config :
//   RESEND_API_KEY=re_xxx   (https://resend.com/api-keys)
//   EMAIL_FROM="PlanMyMeal <bonjour@ton-domaine.fr>"  (domaine vérifié Resend)
// Sans RESEND_API_KEY : aucun envoi, les fonctions retournent ok:false et
// l'application continue (les emails ne doivent jamais faire échouer une
// inscription ou un cron).
// ============================================================================

export const EMAIL_FROM
  = process.env.EMAIL_FROM
  || process.env.RESEND_EMAIL_FROM
  || 'PlanMyMeal <onboarding@resend.dev>';

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Adresse reply-to optionnelle (ex : support) */
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY manquant' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, id: json.id } : { ok: false, error: json.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau Resend' };
  }
}

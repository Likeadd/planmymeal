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
  /** En-têtes SMTP additionnels (ex : List-Unsubscribe) */
  headers?: Record<string, string>;
}

export async function sendEmail({ to, subject, html, replyTo, headers }: SendEmailInput): Promise<SendEmailResult> {
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
        ...(headers ? { headers } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, id: json.id } : { ok: false, error: json.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau Resend' };
  }
}

/** Taille maximale d'un envoi groupé Resend (API /emails/batch). */
export const TAILLE_LOT_EMAILS = 100;

/**
 * Envoi groupé : un appel HTTP pour jusqu'à 100 emails (au lieu d'un par
 * destinataire). Renvoie un résultat par email, dans l'ordre. Un lot refusé
 * marque tous ses emails en échec (l'API Resend valide le lot en bloc).
 */
export async function sendEmailsBatch(emails: SendEmailInput[]): Promise<SendEmailResult[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return emails.map(() => ({ ok: false, error: 'RESEND_API_KEY manquant' }));

  const resultats: SendEmailResult[] = [];
  for (let i = 0; i < emails.length; i += TAILLE_LOT_EMAILS) {
    const lot = emails.slice(i, i + TAILLE_LOT_EMAILS);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(lot.map(({ to, subject, html, replyTo, headers }) => ({
          from: EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}),
          ...(headers ? { headers } : {}),
        }))),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string }[]; message?: string };
      if (res.ok) {
        lot.forEach((_, k) => resultats.push({ ok: true, id: json.data?.[k]?.id }));
      } else {
        const error = json.message || `HTTP ${res.status}`;
        lot.forEach(() => resultats.push({ ok: false, error }));
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Erreur réseau Resend';
      lot.forEach(() => resultats.push({ ok: false, error }));
    }
  }
  return resultats;
}

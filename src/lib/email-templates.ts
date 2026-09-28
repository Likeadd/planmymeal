// ============================================================================
// Templates email PlanMyMeal — HTML inline (compatibilité clients mail maximale)
// ============================================================================

import { titreMajuscules } from '@/lib/utils';

export interface DigestData {
  prenom: string;
  nbRepas: number;
  semaineLabel: string;
  /** Économie prévue vs budget hebdo (si défini) */
  economie: number | null;
  /** Économie vs la base DÉCLARÉE par l'utilisateur (si saisie) */
  economieReference: number | null;
  /** Titres (bruts, DB) des principaux plats de la semaine — l'aperçu "Au menu"
      applique la même casse que l'app (titreMajuscules). Vide = section absente. */
  plats?: string[];
  /** YYYY-MM-DD — construit le lien direct vers la liste de courses de cette
      semaine. Absent (rétro-compat) = pas de bouton liste de courses. */
  semaineDebut?: string;
}

export interface WelcomeData {
  prenom: string;
}

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** Échappe le HTML d'un titre inséré dans un email (les titres utilisateur
    peuvent contenir <, &, … — jamais rendus comme du HTML). */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wrap = (content: string, baseUrl: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FBF8F1;">
  <div style="background:#C2532A;border-radius:16px 16px 0 0;padding:18px 24px;">
    <img src="${baseUrl}/brand/planmymeal-blanc.png" width="157" height="36" alt="PlanMyMeal"
      style="display:block;border:0;color:#FBF6EE;font-family:Georgia,serif;font-size:20px;font-weight:700;" />
  </div>
  <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 16px 16px;">
    ${content}
  </div>
  <p style="color:#7A6850;font-size:12px;margin-top:20px;text-align:center;">
    Tu reçois cet email car tu as un compte PlanMyMeal.
    <a href="${baseUrl}/compte" style="color:#7A6850;">Gérer mes préférences</a>
  </p>
</div>`;

/** Email de bienvenue (transactionnel, envoyé une seule fois à l'onboarding) */
export function welcomeEmailHtml({ prenom }: WelcomeData, baseUrl: string): string {
  return wrap(
    `
    <h1 style="color:#332A1E;font-size:22px;margin:0 0 8px;">Bienvenue ${prenom ? esc(prenom) + ' !' : 'à bord !'}</h1>
    <p style="color:#605242;margin:0 0 16px;line-height:1.5;">
      Ta première semaine va être optimisée — budget, goûts, temps, stock, restes,
      nutrition et gaspillage arbités en même temps — avec la liste de courses
      qui va avec, et le suivi de ton budget.
    </p>
    <p style="color:#605242;margin:0 0 16px;line-height:1.5;">
      💡 <strong>Astuce :</strong> indique ce que tu dépensais par semaine avant
      PlanMyMeal — tes économies seront calculées contre <em>ta</em> base, pas une moyenne.
    </p>
    <a href="${baseUrl}/dashboard"
       style="display:inline-block;margin-top:8px;background:#C4552C;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:12px;font-weight:600;">
      Optimiser ma première semaine →
    </a>`,
    baseUrl
  );
}

/** Digest hebdomadaire : « ta semaine est prête + tu as économisé X € » */
export function weeklyDigestEmailHtml(d: DigestData, baseUrl: string): string {
  const lignes: string[] = [];

  // Aperçu « Au menu cette semaine » : jusqu'à 5 plats, même casse que l'app,
  // puis lien « voir toute la semaine » si la liste est tronquée.
  const plats = (d.plats ?? []).filter(Boolean);
  const apercuPlats: string[] = [];
  if (plats.length > 0) {
    apercuPlats.push('<p style="margin:16px 0 6px;color:#332A1E;font-weight:700;font-size:14px;">Au menu cette semaine :</p>');
    apercuPlats.push('<ul style="margin:0;padding-left:18px;">');
    for (const t of plats.slice(0, 5)) {
      apercuPlats.push(
        `<li style="color:#605242;font-size:13px;line-height:1.7;">${esc(titreMajuscules(t))}</li>`
      );
    }
    apercuPlats.push('</ul>');
    if (plats.length > 5) {
      apercuPlats.push(
        `<p style="margin:4px 0 0;color:#7A6850;font-size:12px;">… et ${plats.length - 5} autres plats à découvrir</p>`
      );
    }
    apercuPlats.push('');
  }
  const blocPlats = plats.length > 0 ? apercuPlats.join('\n    ') + '\n    ' : '';

  if (d.economieReference != null) {
    lignes.push(
      d.economieReference > 0
        ? `<p style="margin:8px 0 0;color:#16a34a;font-weight:600;">💰 ${eur(d.economieReference)} économisés par rapport à ta base habituelle !</p>`
        : d.economieReference < 0
          ? `<p style="margin:8px 0 0;color:#dc2626;">⚠️ ${eur(Math.abs(d.economieReference))} au-dessus de ta base — ajuste ton budget ou relance une optimisation.</p>`
          : ''
    );
  } else if (d.economie != null && d.economie > 0) {
    lignes.push(
      `<p style="margin:8px 0 0;color:#16a34a;font-weight:600;">💰 ${eur(d.economie)} sous ton budget de la semaine.</p>`
    );
  }

  return wrap(
    `
    <h1 style="color:#332A1E;font-size:20px;margin:0 0 8px;">Ta semaine est prête !</h1>
    <p style="color:#605242;margin:0;line-height:1.5;">
      ${d.nbRepas} repas planifiés pour la semaine ${d.semaineLabel}.
      ${lignes.join('\n      ')}
    </p>
    ${blocPlats}<a href="${baseUrl}/dashboard${d.semaineDebut ? `?semaine=${d.semaineDebut}` : ''}"
       style="display:inline-block;margin-top:20px;margin-right:10px;background:#C4552C;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:12px;font-weight:600;">
      Voir mon planning →
    </a>${d.semaineDebut ? `<a href="${baseUrl}/dashboard?semaine=${d.semaineDebut}&tab=courses"
       style="display:inline-block;margin-top:20px;background:#fff;color:#C4552C;text-decoration:none;
              border:2px solid #C4552C;padding:10px 22px;border-radius:12px;font-weight:600;">
      Liste de courses →
    </a>` : ''}`,
    baseUrl
  );
}

/** Sujet du digest — le chiffre d'économies dans l'objet augmente l'ouverture */
export function weeklyDigestSubject(d: DigestData): string {
  const eco = d.economieReference ?? d.economie;
  return eco != null && eco > 0
    ? `🍽️ Ta semaine est prête — ${eur(eco)} économisés !`
    : '🍽️ Ta semaine de repas est prête';
}

// ─── Newsletter dominicale (lead magnet, sans compte) ──────────────────────

export interface NewsletterMenuLigne {
  titre: string;
  prix: number | null;
}

export interface NewsletterData {
  semaineLabel: string;
  menu: NewsletterMenuLigne[];
  totalSemaine: number;
  /** Rayon → { nom de l'ingrédient, quantité affichée } */
  courses: { rayon: string; items: string[] }[];
  unsubscribeUrl: string;
}

/** Email hebdomadaire envoyé aux abonnés newsletter (pas de compte) : un
 *  exemple de menu de la semaine + sa liste de courses, pour donner envie de
 *  créer un compte et planifier LE sien. Gabarit indépendant de `wrap()` :
 *  le pied de page (désinscription) diffère de celui des emails transactionnels. */
export function newsletterEmailHtml(d: NewsletterData, baseUrl: string): string {
  const lignesMenu = d.menu
    .map(
      m =>
        `<li style="color:#605242;font-size:13px;line-height:1.9;">${esc(titreMajuscules(m.titre))}${
          m.prix != null ? ` <span style="color:#16a34a;font-weight:600;">— ${eur(m.prix)}/portion</span>` : ''
        }</li>`
    )
    .join('\n          ');

  const blocsCourses = d.courses
    .map(
      section => `
        <p style="margin:14px 0 4px;color:#332A1E;font-weight:700;font-size:13px;">${esc(section.rayon)}</p>
        <p style="margin:0;color:#605242;font-size:13px;line-height:1.7;">${section.items.map(esc).join(' · ')}</p>`
    )
    .join('');

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FBF8F1;">
  <div style="background:#C2532A;border-radius:16px 16px 0 0;padding:18px 24px;">
    <img src="${baseUrl}/brand/planmymeal-blanc.png" width="157" height="36" alt="PlanMyMeal"
      style="display:block;border:0;color:#FBF6EE;font-family:Georgia,serif;font-size:20px;font-weight:700;" />
  </div>
  <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 16px 16px;">
    <h1 style="color:#332A1E;font-size:20px;margin:0 0 8px;">Le menu de la semaine (${esc(d.semaineLabel)})</h1>
    <p style="color:#605242;margin:0 0 12px;line-height:1.5;">
      Un exemple de menu équilibré à ${eur(d.totalSemaine)} la semaine, avec la liste de courses qui va avec.
    </p>
    <ul style="margin:0 0 8px;padding-left:18px;">
          ${lignesMenu}
    </ul>
    <div style="margin-top:8px;padding-top:12px;border-top:1px solid #EFE7D8;">
      <p style="margin:0;color:#332A1E;font-weight:700;font-size:14px;">Liste de courses</p>
      ${blocsCourses}
    </div>
    <a href="${baseUrl}/signup?ref=newsletter"
       style="display:inline-block;margin-top:22px;background:#C4552C;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:12px;font-weight:600;">
      Planifier MON menu personnalisé →
    </a>
  </div>
  <p style="color:#7A6850;font-size:12px;margin-top:20px;text-align:center;">
    Tu reçois cet email car tu t'es inscrit·e à la newsletter PlanMyMeal.
    <a href="${d.unsubscribeUrl}" style="color:#7A6850;">Se désinscrire</a>
  </p>
</div>`;
}

export function newsletterSubject(d: NewsletterData): string {
  return `🥕 Le menu de la semaine (${d.semaineLabel}) — ${eur(d.totalSemaine)}`;
}

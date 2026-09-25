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
    ${blocPlats}<a href="${baseUrl}/dashboard"
       style="display:inline-block;margin-top:20px;background:#C4552C;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:12px;font-weight:600;">
      Voir mon planning →
    </a>`,
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

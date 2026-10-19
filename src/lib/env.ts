// ============================================================================
// Validation des variables d'environnement — PlanMyMeal
//
// Appelée par next.config.ts au BUILD : en production, une variable critique
// manquante fait échouer le build avec la liste précise de ce qui manque (et
// à quoi elle sert) — au lieu d'un crash cryptique `process.env.X!` en prod.
// Un warning clair est émis en dev pour les variables recommandées.
//
// Lancer manuellement : npx tsx -e "import('./src/lib/env').m.validateEnv()"
// ============================================================================

export type EnvSeverity = 'critical' | 'recommended';

export interface EnvSpec {
  key: string;
  /** critical = l'appli est inutilisable sans → build KO en prod ; recommended = feature dégradée */
  severity: EnvSeverity;
  /** Où la variable est consommée (affiché dans le diagnostic) */
  usage: string;
}

export const ENV_SPECS: EnvSpec[] = [
  // ── Critiques : sans elles, rien ne fonctionne ──
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    severity: 'critical',
    usage: 'Client Supabase (browser, routes API, proxy auth)',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    severity: 'critical',
    usage: 'Client Supabase (browser, routes API, proxy auth)',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    severity: 'critical',
    usage: 'Client admin serveur (génération, emails, RGPD, sitemap, OG recettes)',
  },

  // ── Recommandées : une feature se dégrade sans ──
  {
    key: 'STRIPE_SECRET_KEY',
    severity: 'recommended',
    usage: 'Portail client Stripe (/api/billing-portal)',
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PRICE_ID_PRO',
    severity: 'recommended',
    usage: 'Prix du plan Pro (fallback « price_pro » sinon)',
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PRICE_ID_FAMILLE',
    severity: 'recommended',
    usage: 'Prix du plan Famille (fallback « price_famille » sinon)',
  },
  {
    key: 'NEXT_PUBLIC_MEDIATEUR_NOM',
    severity: 'recommended',
    usage: 'Médiateur de la consommation (obligation légale, CGV) — avec NEXT_PUBLIC_MEDIATEUR_URL (https) et NEXT_PUBLIC_MEDIATEUR_ADRESSE',
  },
  {
    key: 'NEXT_PUBLIC_MEDIATEUR_URL',
    severity: 'recommended',
    usage: 'Site du médiateur de la consommation (CGV)',
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    severity: 'recommended',
    usage: 'URL de retour du portail client Stripe (/api/billing-portal) — fallback origin de la requête',
  },
  {
    key: 'CRON_SECRET',
    severity: 'recommended',
    usage: 'Protection des routes cron (email-weekly, auto-generate-week)',
  },
  {
    key: 'RESEND_API_KEY',
    severity: 'recommended',
    usage: 'Envoi des emails (bienvenue, récap hebdo)',
  },
  {
    // Critique (audit VULN-001) : sans elle, liens des emails, sitemap et redirections retombaient sur un
    // domaine codé en dur — dangereux si ce domaine n'est pas (ou plus) le vôtre.
    key: 'NEXT_PUBLIC_SITE_URL',
    severity: 'critical',
    usage: 'URL canonique du site (sitemap, robots, OG, liens des emails, redirections Auth)',
  },
  {
    key: 'CONTACT_EMAIL',
    severity: 'recommended',
    usage: 'Destinataire des formulaires de contact et des demandes de recettes (fallback contact@getplanmymeal.com)',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    severity: 'recommended',
    usage: 'Extraction IA de recettes (/api/import-recette) — fonctions IA dégradées sans',
  },
];

type EnvLike = Record<string, string | undefined>;

/** Variables manquantes, dans l'ordre de déclaration. */
export function missingEnvVars(env: EnvLike = process.env): EnvSpec[] {
  return ENV_SPECS.filter(spec => !env[spec.key] || env[spec.key]!.trim() === '');
}

export interface ValidateEnvOptions {
  /** true → throw si une variable critique manque (build de production) */
  failOnCritical?: boolean;
  /** Injecter un env de test (défaut : process.env) */
  env?: EnvLike;
  /** Silence total si tout va bien (défaut : log symbolique en cas de succès) */
  quiet?: boolean;
}

/**
 * Valide l'environnement et affiche un diagnostic précis.
 * - Variables critiques manquantes + failOnCritical → throw (build KO).
 * - Variables recommandées manquantes → warning groupé (jamais bloquant).
 */
export function validateEnv(options: ValidateEnvOptions = {}): void {
  const { failOnCritical = false, env = process.env, quiet = false } = options;
  const missing = missingEnvVars(env);
  if (missing.length === 0) {
    if (!quiet) console.log('✅ Environnement complet — toutes les variables requises sont définies.');
    return;
  }

  const critical = missing.filter(s => s.severity === 'critical');
  const recommended = missing.filter(s => s.severity === 'recommended');

  const render = (specs: EnvSpec[]) =>
    specs.map(s => `  ✗ ${s.key}\n      ↳ ${s.usage}`).join('\n');

  if (critical.length > 0) {
    const message =
      `Variables d'environnement CRITIQUES manquantes (${critical.length}) :\n${render(critical)}\n` +
      `→ L'application ne peut pas fonctionner sans elles. Définissez-les dans .env.local (dev) ou dans les paramètres du projet (Vercel → Settings → Environment Variables).`;
    if (failOnCritical) {
      throw new Error(message);
    }
    console.error(`⚠️  ${message}`);
  }

  if (recommended.length > 0) {
    console.warn(
      `⚠️  Variables d'environnement recommandées manquantes (${recommended.length}) — features dégradées :\n${render(recommended)}\n` +
      `→ L'application démarre quand même. À définir pour activer les features correspondantes.`
    );
  }
}

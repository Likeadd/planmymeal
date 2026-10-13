# PlanMyMeal

Planificateur de repas : menus de la semaine qui respectent un budget, liste de courses automatique, frigo anti-gaspillage, profils familiaux. Next.js 16 (App Router) · Supabase (Postgres, Auth, RLS) · Stripe · Resend · Plausible.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés (voir « Variables d'environnement »)
npm run dev                  # http://localhost:3000
```

| Commande | Rôle |
|---|---|
| `npm run lint` · `npx tsc --noEmit` · `npm test` | Contrôles (aussi lancés par la CI à chaque push) |
| `npm run build` · `npm start` | Version de production |
| `npm run test:e2e` | Parcours navigateur Playwright (compte de test : `E2E_EMAIL`, `E2E_PASSWORD`) |
| `npm run db:migrate` · `npm run db:types` | Migrations Supabase et types générés |

## Architecture

- `src/app` — pages et routes API (`src/app/api/*`). Les pages publiques (accueil, recettes, FAQ, CGV…) sont rendues sans appel réseau ; l'espace connecté (`dashboard`, `aujourdhui`, `frigo`, `budget`, `compte`…) est protégé par `src/proxy.ts`.
- `src/lib` — logique métier. Le moteur de menus : `rotation-engine.ts` (génération, budget), `moteur-creneaux.ts` (choix par créneau), `diversite.ts` (variété protéines/féculents, rythme simple/élaboré), `budget.ts`, `catalogue-index.ts` (index en mémoire du catalogue pour `/api/recettes`).
- `supabase/migrations` — schéma SQL numéroté (sécurité par ligne activée sur toutes les tables). `supabase/functions` — fonctions Edge Stripe (`create-checkout`, `stripe-webhook`).
- `scripts` — outils d'administration du catalogue (voir ci-dessous). Ils utilisent la clé de service : à lancer en connaissance de cause.
- `tests` — tests unitaires Vitest (moteur, budget, quantités, abonnement…) et E2E Playwright.

## Catalogue de recettes

Plus de 10 000 recettes, toutes originales (aucun texte repris d'un autre site). Chaque recette a une « Mise en place », des étapes précises et ses macros **calculées** depuis les ingrédients.

| Commande | Rôle |
|---|---|
| `npm run catalogue:stats` | Répartition par type, rapidité, cuisines |
| `npm run catalogue:ajouter -- --complementaires --appliquer` | Ajoute les recettes d'une famille (aperçu sans `--appliquer`) |
| `npm run catalogue:dosages` / `catalogue:corriger-dosages` | Audit et correction des quantités par portion (sauvegarde dans `backups/`) |
| `npm run catalogue:macros -- --write` | Recalcule calories et macros |
| `npm run catalogue:indexation -- --appliquer` | Choisit les fiches exposées à Google (colonne `meals.indexable`) |

## Variables d'environnement

Voir `.env.example`. Critiques : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (le build échoue en production si elles manquent). Importantes en production : `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (tâches planifiées Vercel), `RESEND_API_KEY` + `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_ENABLED`, `ANTHROPIC_API_KEY` (import de recettes), `NEXT_PUBLIC_MEDIATEUR_*` (médiateur de la consommation, CGV).

Secrets des fonctions Edge Stripe (`supabase secrets set …`) : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_FAMILLE`, `STRIPE_PRICE_ID_PRO_ANNUEL`, `STRIPE_PRICE_ID_FAMILLE_ANNUEL`, `APP_URL`.

## Mise en production

1. Domaine branché sur Vercel et `NEXT_PUBLIC_SITE_URL` définie (sitemap, URL canoniques, emails).
2. Supabase : migrations appliquées, SMTP (Resend) configuré pour les emails d'inscription, URL de redirection Auth, sauvegardes actives.
3. Stripe : prix mensuels et annuels créés, fonctions Edge déployées, webhook déclaré. Tant que ce n'est pas prêt : `NEXT_PUBLIC_STRIPE_ENABLED=false`.
4. Plausible : domaine ajouté, objectifs créés (événements envoyés par `src/lib/analytics.ts`).
5. Google Search Console : sitemap `/sitemap.xml` soumis.

## Sécurité en bref

Sécurité par ligne (RLS) sur toutes les tables, colonnes sensibles de `profiles` verrouillées par trigger, routes API authentifiées avec limitation de débit partagée en base, garde CSRF et taille de requête dans `src/proxy.ts`, en-têtes HSTS/CSP dans `next.config.ts`, tâches planifiées protégées par `CRON_SECRET`.

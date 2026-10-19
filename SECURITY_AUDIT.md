# Audit de sécurité — PlanMyMeal

| | |
|---|---|
| **Date** | 19 octobre 2026 |
| **Version auditée** | commit `54d8ae6` (branche `main`) |
| **Stack** | Next.js 16.3.8 (App Router, `src/proxy.ts`), React 19, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.2, Stripe 22 (Edge Functions Deno), Resend, LLM (Gemini/Anthropic via `src/lib/ai`) |
| **Base** | Supabase projet `iykikxiwpnrrrwzfpskg` (production, eu-west-1) — **lecture seule** pendant l'audit |
| **Tests live** | version de production **locale** (`next start` sur `localhost:3100`, branchée sur la base réelle, aucune écriture) |
| **Comptes de test** | aucun fourni → scénarios à deux comptes classés « Probable / À vérifier » |

Légende des statuts : **Confirmée** = reproduite par un test exécuté ; **Probable** = démontrée par lecture du code / de la base, PoC dynamique impossible sans compte ; **À vérifier** = dépend d'un réglage externe non lisible (Supabase Auth, Stripe, Vercel).

---

## Statut des correctifs (19 octobre 2026)

**Les 18 constats ont été traités** (branche `securite/correctifs-audit`, un commit par faille, migrations 00047 à 00051 appliquées en base). Restent à votre charge, car hors du code : enregistrer le domaine (VULN-001), activer « Secure password change » dans Supabase Auth (VULN-004), configurer les secrets Stripe/Supabase (`APP_URL`, `STRIPE_PRICE_ID_*`) avant de déployer les Edge Functions, et valider un test complet à deux comptes (VULN-002) ainsi que l'en-tête CORS du site déployé (VULN-018).

---

## 1. Synthèse exécutive

### Note de risque globale : **MOYEN**

1. Aucune faille critique : toutes les routes API vérifient l'authentification côté serveur (56 appels non authentifiés → 401/405), l'identifiant utilisateur vient toujours de la session (`getUser()`), et la RLS bloque tout accès anonyme aux 18 tables sensibles (testé avec la clé `anon`).
2. Le risque le plus élevé n'est pas dans le code : le domaine **`getplanmymeal.com` ne résout pas (NXDOMAIN)** alors qu'il est la valeur par défaut des URLs, de l'adresse de contact RGPD et du retour de paiement Stripe → un tiers qui l'enregistre récupérerait messages, demandes RGPD et trafic (VULN-001).
3. Une fuite d'autorisation de faible portée (IDOR en lecture) permet de lire le **titre** des recettes privées d'autres comptes (VULN-002).
4. Plusieurs faiblesses de **logique métier / paiement** (rétractation rejouable, changements d'offre Stripe non répercutés) et d'**authentification** (changement de mot de passe vérifié seulement côté client, pas de « mot de passe oublié ») sont à traiter avant l'ouverture des paiements.
5. Le socle est solide (CSRF, CORS, en-têtes, rate limiting partagé en base, garde SQL sur `plan`/Stripe, SSRF largement filtré, secrets absents du dépôt et de l'historique) : les correctifs sont majoritairement des **quick wins**.

### Compteurs par sévérité

| Critique | Élevé | Moyen | Faible | Info |
|:-:|:-:|:-:|:-:|:-:|
| 0 | 1 | 6 | 7 | 4 |

### Top 5 des actions immédiates

1. **Enregistrer le domaine `getplanmymeal.com`** (ou remplacer partout la valeur par défaut) et définir `NEXT_PUBLIC_SITE_URL`, `CONTACT_EMAIL` et le secret `APP_URL` de l'Edge Function — VULN-001.
2. **Restreindre les `meal_id` acceptés** dans `/api/preferences` et `/api/famille` aux recettes publiques ou à soi — VULN-002.
3. **Activer « Secure password change »** (réauthentification) dans Supabase Auth et ajouter un parcours « mot de passe oublié » — VULN-004 / VULN-009.
4. **Avant d'ouvrir Stripe** : interdire un 2ᵉ abonnement, limiter la rétractation intégrale à la première souscription, répercuter les changements d'offre dans le webhook — VULN-003 / VULN-005.
5. **Corriger le filtre SSRF** (IPv4-mapped IPv6, NAT64, résolution figée) et **ne plus créer d'ingrédients globaux** depuis l'import IA — VULN-007 / VULN-006.

---

## 2. Tableau récapitulatif

| ID | Titre | Sévérité | CVSS 3.1 | Catégorie OWASP | Statut | Effort |
|---|---|---|---|---|---|---|
| VULN-001 | Domaine de production non résolu mais utilisé comme valeur par défaut (contact, URLs, retour Stripe) | **Élevé** | 8.2 | A05 Security Misconfiguration | Probable | Faible |
| VULN-002 | IDOR en lecture : titres de recettes privées d'autres comptes via préférences / profils famille | Moyen | 4.3 | API1 BOLA / A01 | Probable | Faible |
| VULN-003 | Rétractation intégrale rejouable et absence de garde « déjà abonné » au checkout | Moyen | 4.3 | API6 Business flows / A04 | Probable | Moyen |
| VULN-004 | Changement de mot de passe : ancien mot de passe vérifié côté client uniquement | Moyen | 6.8 | A07 Auth failures | À vérifier | Faible |
| VULN-005 | Changement d'offre via le portail Stripe non répercuté par le webhook | Moyen | 4.3 | API6 / A04 | À vérifier | Moyen |
| VULN-006 | Pollution du référentiel global `ingredients` par l'import IA | Moyen | 5.0 | A04 Insecure design / CWE-20 | Probable | Faible |
| VULN-008 | Coût LLM sans plafond journalier pour les comptes payants (denial of wallet) | Moyen | 4.3 | API4 Unrestricted resource consumption | Probable | Faible |
| VULN-007 | Contournement du filtre SSRF (IPv4-mapped IPv6, NAT64, rebinding DNS) | Faible | 3.5 | A10 SSRF | **Confirmée** (filtre) | Moyen |
| VULN-009 | Pas de « mot de passe oublié » ; email du profil non synchronisé après changement d'email | Faible | 2.6 | A07 / RGPD | Confirmée (code) | Moyen |
| VULN-010 | CSP `script-src 'unsafe-inline'` | Faible | — | A05 | Confirmée | Élevé |
| VULN-011 | Adresses email en clair dans `security_events` et les logs | Faible | — | A09 / RGPD | Confirmée (code) | Faible |
| VULN-012 | `next/image` accepte les images de **n'importe quel** projet `*.supabase.co` | Faible | 3.1 | A05 | Confirmée (config) | Faible |
| VULN-013 | CI GitHub Actions : actions non épinglées, permissions du jeton par défaut | Faible | — | A08 Supply chain | Confirmée | Faible |
| VULN-014 | Newsletter : en-tête objet / Reply-To avec données utilisateur non nettoyées des caractères de contrôle | Faible | 3.1 | CWE-93 | À vérifier | Faible |
| VULN-015 | Bucket `meal-images` public sans limite de taille ni de type MIME | Info | — | A05 | Confirmée | Faible |
| VULN-016 | Rate limiting dépendant de `x-real-ip` (falsifiable hors Vercel) | Info | — | API4 | Confirmée (local) | — |
| VULN-017 | Codes d'invitation de foyer : 32 bits d'entropie (atténué) | Info | — | A07 | Confirmée | Faible |
| VULN-018 | `Access-Control-Allow-Origin: *` observé sur le déploiement Vercel | Info | — | A05 | À vérifier | Faible |

---

## 3. Détail des vulnérabilités

### VULN-001 — Domaine de production non résolu mais câblé comme valeur par défaut

- **Sévérité** : Élevé — CVSS 3.1 `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:H/A:N` = **8.2**. Pas de privilège requis : il suffit d'acheter le domaine ; l'intégrité est forte (pages de phishing et retour de paiement sous le nom officiel), la confidentialité est atteinte (messages de contact, demandes RGPD).
- **Catégorie** : OWASP A05:2021 Security Misconfiguration — CWE-1386 (référence à une ressource non contrôlée) / « domain takeover ».
- **Localisation** :
  - `src/lib/seo.ts:3` — `SITE_URL = … || 'https://getplanmymeal.com'`
  - `src/lib/legal.ts:8` — `EMAIL_CONTACT = 'contact@getplanmymeal.com'` (affiché dans toutes les pages légales comme canal RGPD)
  - `src/app/api/contact/route.ts:11` et `src/app/api/demande-recette/route.ts:14` — `CONTACT_EMAIL || 'contact@getplanmymeal.com'` (variable **absente** de `.env.local`)
  - `supabase/functions/create-checkout/index.ts:22` — `APP_URL ?? 'https://getplanmymeal.com'` (`success_url` / `cancel_url` Stripe)
  - `src/app/layout.tsx:131` (Plausible `data-domain`), `src/app/contact/page.tsx:180`, `src/app/faq/page.tsx:132`
- **Description** : `nslookup getplanmymeal.com`, `_dmarc.getplanmymeal.com` et `resend._domainkey.getplanmymeal.com` renvoient **NXDOMAIN** : le domaine n'existe pas dans le DNS (non enregistré ou sans délégation). Or il sert de repli à toutes les URLs absolues, d'adresse de contact légale et de destinataire des formulaires.
- **Scénario d'attaque** : 1) un tiers enregistre `getplanmymeal.com` et un MX ; 2) il reçoit les messages du formulaire de contact (nom, email, contenu), les demandes de recettes, et les demandes d'exercice des droits RGPD envoyées à `contact@` ; 3) si `APP_URL` n'est pas défini sur l'Edge Function, les clients sont renvoyés **après paiement** vers son site ; 4) il héberge des pages de phishing sous la marque, liées depuis les emails et les sitemaps.
- **Preuve** :
  ```
  > nslookup -type=TXT getplanmymeal.com
  *** can't find getplanmymeal.com: Non-existent domain
  > grep CONTACT_EMAIL .env.local     → (aucune ligne)
  ```
- **Impact** : confidentialité (PII des messages), intégrité (phishing, faux retour de paiement), légal (demandes RGPD détournées, mentions légales pointant vers un tiers), réputation.
- **Correctif** :
  1. Enregistrer **immédiatement** `getplanmymeal.com` (et idéalement `.fr`), configurer MX + SPF/DKIM/DMARC (Resend).
  2. Définir dans Vercel `NEXT_PUBLIC_SITE_URL`, `CONTACT_EMAIL`, et dans les secrets Supabase `APP_URL`.
  3. Faire échouer le build si ces variables manquent en production :
  ```diff
  // src/lib/env.ts — rendre ces variables CRITIQUES en production
  -    usage: 'URL canonique (sitemap, robots, OG — fallback https://getplanmymeal.com)',
  +    usage: 'URL canonique (sitemap, robots, OG, emails) — OBLIGATOIRE en production',
  +    critique: true,
  ```
  ```diff
  // supabase/functions/create-checkout/index.ts
  -const APP_URL = (Deno.env.get('APP_URL') ?? 'https://getplanmymeal.com').replace(/\/$/, '');
  +const APP_URL_BRUT = Deno.env.get('APP_URL');
  +if (!APP_URL_BRUT) throw new Error('APP_URL manquant : configurez le secret avant de déployer');
  +const APP_URL = APP_URL_BRUT.replace(/\/$/, '');
  ```
- **Vérification** : `nslookup getplanmymeal.com` renvoie une IP Vercel ; un build sans `NEXT_PUBLIC_SITE_URL` échoue ; un message de test du formulaire de contact arrive dans votre boîte.
- **Références** : CWE-1386, OWASP « Subdomain/domain takeover », documentation Vercel « Custom Domains ».

---

### VULN-002 — IDOR en lecture : titres de recettes privées d'autres comptes

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N` = **4.3**.
- **Catégorie** : OWASP API1:2023 BOLA / A01:2021 Broken Access Control — CWE-639.
- **Localisation** :
  - `src/app/api/preferences/route.ts:108-111` (PUT) → `src/lib/memoire.ts:452-464` (`enregistrerPreference` : aucun contrôle sur `meal_id`)
  - `src/app/api/preferences/route.ts:36-53` (GET : `select(... meals(titre))` avec la clé **service_role**)
  - `src/app/api/famille/route.ts:164-182` → fonction SQL `save_family_member` (`where exists (select 1 from meals m where m.id = …)` sans filtre `is_public`) ; GET `src/app/api/famille/route.ts:56` (`meals(titre)`)
- **Description** : les routes acceptent n'importe quel `meal_id` existant, y compris une recette **privée** (`is_public = false`) importée par un autre compte. La lecture se fait ensuite avec le client admin (RLS contournée), qui renvoie le titre de cette recette. Les identifiants sont des entiers séquentiels, donc énumérables.
- **Scénario d'attaque** : un compte gratuit envoie `PUT /api/preferences {"preference":{"meal_id":N,"note":5}}` pour N = 1…12 000, puis `GET /api/preferences` : la réponse contient `titre` pour chaque recette privée existante d'autres utilisateurs (titres de recettes importées, potentiellement personnels).
- **Preuve (PoC non exécuté — aucun compte de test)** :
  ```http
  PUT /api/preferences   {"preference":{"meal_id":12345,"note":5}}   → 200 {"success":true}
  GET /api/preferences                                              → {"preferences":[{"meal_id":12345,"titre":"<titre privé>",…}]}
  ```
  Les autres routes qui reçoivent un `meal_id` (`/api/noter`, `/api/meal-status`, `/api/pourquoi`, `/api/swap-meal`, `/api/favori`) appliquent déjà le bon filtre `is_public.eq.true,created_by.eq.<uid>` — ces deux-là ont été oubliées.
- **Impact** : confidentialité limitée (titres seulement, pas les instructions). Pollution possible de la mémoire du moteur avec des recettes non accessibles.
- **Correctif** :
  ```diff
  // src/lib/memoire.ts
   export async function enregistrerPreference(userId: string, mealId: number, input: PreferenceInput, supabase: Db): Promise<void> {
  +  // Clé admin : on n'accepte que les recettes publiques ou celles de l'utilisateur
  +  const { data: meal } = await supabase.from('meals').select('id')
  +    .eq('id', mealId).or(`is_public.eq.true,created_by.eq.${userId}`).maybeSingle();
  +  if (!meal) throw new UserError('Recette introuvable');
     const patch = normaliserPreference(input);
  ```
  ```diff
  -- nouvelle migration : save_family_member n'accepte que les recettes visibles
  -  where exists (select 1 from meals m where m.id = (e ->> 'meal_id')::integer)
  +  where exists (
  +      select 1 from meals m
  +      where m.id = (e ->> 'meal_id')::integer
  +        and (m.is_public or m.created_by = p_user_id))
  ```
- **Vérification** : test d'intégration avec deux comptes : le compte B ne doit obtenir que `404 Recette introuvable` pour une recette privée de A, et aucun `titre` correspondant dans `GET /api/preferences` et `GET /api/famille`.
- **Références** : CWE-639, OWASP API Security Top 10 2023 – API1.

---

### VULN-003 — Rétractation intégrale rejouable / double abonnement

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` = **4.3** (impact financier direct).
- **Catégorie** : OWASP API6:2023 Unrestricted Access to Sensitive Business Flows / A04 Insecure Design — CWE-840.
- **Localisation** : `src/app/api/abonnement/retractation/route.ts:43-64` ; `supabase/functions/create-checkout/index.ts:56-114`.
- **Description** : la rétractation rembourse **100 % même après usage** (politique volontairement plus généreuse que la loi) et rien n'empêche de recommencer : souscrire → utiliser 13 jours → se rétracter → re-souscrire → … Par ailleurs `create-checkout` ne vérifie pas que l'utilisateur n'a pas déjà un abonnement actif (deux abonnements facturés possibles, dont un « orphelin » non suivi par `stripe_subscription_id`).
- **Scénario d'attaque** : un utilisateur obtient le plan Pro gratuitement en boucle (13 jours sur 14, intégralement remboursés) ; ou un utilisateur se fait facturer deux fois par double clic / deux onglets.
- **Preuve** : lecture de code (aucun compteur de rétractations, aucune condition `plan === 'gratuit'` au checkout). Paiements non activés : non testable en live.
- **Impact** : perte de revenus, litiges/chargebacks, frais Stripe non remboursés.
- **Correctif** :
  ```diff
  // supabase/functions/create-checkout/index.ts — refuser un second abonnement
  -      .select('email, plan, stripe_customer_id')
  +      .select('email, plan, stripe_customer_id, stripe_subscription_id')
  ...
  +    if (profile.stripe_subscription_id || profile.plan !== 'gratuit') {
  +      throw new PublicError('Vous avez déjà un abonnement actif : gérez-le depuis votre compte.');
  +    }
  ```
  ```diff
  // src/app/api/abonnement/retractation/route.ts — remboursement intégral réservé à la 1re souscription
  +    // Le droit légal reste ouvert ; le remboursement INTÉGRAL (au-delà de la loi) n'est accordé qu'une fois.
  +    const precedentes = await stripe.subscriptions.list({ customer: customerId, status: 'canceled', limit: 5 });
  +    const dejaRetracte = precedentes.data.some(s => s.metadata?.retractation === 'oui');
  ...
  -    await stripe.subscriptions.cancel(subId);
  +    await stripe.subscriptions.update(subId, { metadata: { retractation: 'oui' } });
  +    await stripe.subscriptions.cancel(subId);
  +    // si dejaRetracte : rembourser au prorata (art. L221-25) au lieu de 100 %, et l'annoncer dans les CGV
  ```
  Côté Stripe, utiliser aussi une **clé d'idempotence** (`idempotencyKey: 'checkout-' + user.id + '-' + jourCourant`) sur `checkout.sessions.create`.
- **Vérification** : deux clics « S'abonner » → un seul abonnement Stripe ; une deuxième rétractation sur le même client → remboursement proratisé (ou intégral si vous maintenez la politique, mais de façon assumée et journalisée).
- **Références** : CWE-840, Stripe « Idempotent requests », Code de la consommation L221-18 / L221-25.

---

### VULN-004 — Changement de mot de passe vérifié côté client uniquement

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N` = **6.8** (prérequis : session volée, d'où `AC:H`).
- **Catégorie** : OWASP A07:2021 Identification and Authentication Failures — CWE-620 (Unverified Password Change).
- **Localisation** : `src/components/compte/PasswordSettings.tsx:5,81` — le mot de passe actuel est vérifié par `signInWithPassword` **dans le navigateur**, puis `supabase.auth.updateUser({ password })` est appelé directement.
- **Description** : l'API Supabase `PUT /auth/v1/user` accepte un nouveau mot de passe avec le seul jeton de session si l'option « Secure password change / Require reauthentication » n'est pas activée. La vérification du mot de passe actuel côté client est contournable.
- **Scénario d'attaque** : un attaquant qui a obtenu un jeton d'accès (cookie de session Supabase non `HttpOnly`, poste partagé, extension malveillante) appelle directement `PUT https://<projet>.supabase.co/auth/v1/user {"password":"…"}` et prend le contrôle durable du compte.
- **Preuve** : lecture de code ; réglage Supabase non lisible avec la clé anon (`/auth/v1/settings` ne l'expose pas) → **À vérifier** dans le tableau de bord.
- **Impact** : prise de contrôle de compte (données personnelles et de santé déclarées, abonnement).
- **Correctif** :
  1. Supabase → Authentication → **Sign In / Providers → Email → « Secure password change »** (exige une réauthentification récente ou un nonce envoyé par email).
  2. Faire le changement côté serveur :
  ```ts
  // src/app/api/compte/mot-de-passe/route.ts (nouvelle route)
  const { user } = await getAuthUser(request);                       // session
  const ok = await supabaseAnon.auth.signInWithPassword({ email: user.email!, password: body.actuel });
  if (ok.error) return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 });
  await getSupabaseAdmin().auth.admin.updateUserById(user.id, { password: body.nouveau }); // + rate limit
  ```
- **Vérification** : `PUT /auth/v1/user {"password":"…"}` avec un simple jeton de session → refus (`reauthentication_needed`).
- **Références** : CWE-620, Supabase docs « Password security / Secure password change ».

---

### VULN-005 — Changement d'offre via le portail Stripe non répercuté

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` = **4.3**.
- **Catégorie** : API6:2023 / A04 — CWE-841.
- **Localisation** : `supabase/functions/stripe-webhook/index.ts` (`customer.subscription.updated`, lignes ~105-121 du fichier) : seul le **statut** est traité ; le `plan` n'est fixé qu'au `checkout.session.completed` à partir des métadonnées.
- **Description** : si le portail client Stripe (`/api/billing-portal`) autorise le changement de formule, un client Famille qui passe à Pro (moins cher) **garde** `plan = 'famille'` en base. Événements `invoice.payment_failed` non gérés non plus (accès conservé pendant les relances).
- **Scénario d'attaque** : souscrire Famille annuel, basculer immédiatement sur Pro mensuel dans le portail → payer Pro, utiliser Famille.
- **Preuve** : lecture de code ; dépend de la configuration du portail Stripe → **À vérifier**.
- **Correctif** :
  ```diff
  case 'customer.subscription.updated': {
    const subscription = event.data.object;
  + const priceId = subscription.items.data[0]?.price.id;
  + const plan = [PRIX_FAMILLE, PRIX_FAMILLE_ANNUEL].includes(priceId) ? 'famille'
  +            : [PRIX_PRO, PRIX_PRO_ANNUEL].includes(priceId) ? 'pro' : null;
    if (status === 'active' || status === 'trialing') {
  +   if (plan) await supabaseAdmin.from('profiles').update({ plan, stripe_subscription_id: subscription.id })
  +     .eq('stripe_customer_id', subscription.customer as string);
  ```
  + désactiver le changement de formule dans le portail tant que ce n'est pas déployé ; traiter `invoice.payment_failed` ; ignorer les événements déjà traités (table `stripe_events(id primary key)` pour l'idempotence).
- **Vérification** : en mode test Stripe, changer de formule dans le portail → `profiles.plan` suit en moins de 10 s.
- **Références** : Stripe docs « Using webhooks with subscriptions », CWE-841.

---

### VULN-006 — Pollution du référentiel global `ingredients` par l'import IA

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:C/C:N/I:L/A:N` = **5.0**.
- **Catégorie** : A04:2021 Insecure Design — CWE-20 / CWE-74 (contenu stocké non fiable).
- **Localisation** : `src/app/api/import-recette/route.ts:221-232` (insertion dans `ingredients` avec le client admin, `nom` venant de la sortie du LLM, elle-même dérivée d'une page web choisie par l'utilisateur) ; affichage à **tous** les utilisateurs : `src/app/frigo/page.tsx:155`, `src/components/compte/FamilleSettings.tsx:105`, `src/components/compte/NutritionSettings.tsx:96`.
- **Description** : la recette importée est privée, mais ses ingrédients inconnus sont créés dans la table **partagée** `ingredients`, lisible par tous et listée dans les sélecteurs (frigo, allergies famille, nutrition). Le texte est échappé par React (pas de XSS), mais il est arbitraire.
- **Scénario d'attaque** : un compte publie une page « recette » dont les ingrédients s'appellent « Contactez le support : arnaque-planmymeal.com », « <insulte> »… puis l'importe : ces entrées apparaissent dans les listes de tous les utilisateurs, et faussent le moteur (rayon `epicerie_salee` par défaut, prix nul).
- **Preuve** : lecture de code (insert ligne 227-229, puis `select('id, nom, rayon')` sans filtre côté client).
- **Impact** : intégrité du catalogue, phishing/réputation, qualité des menus.
- **Correctif** : ne jamais créer d'ingrédient global depuis un utilisateur ; rattacher l'ingrédient inconnu à la recette privée uniquement.
  ```diff
  -    if (ingredientId == null) {
  -      const { data: nouveau, error: errIng } = await admin.from('ingredients')
  -        .insert({ nom: ing.nom, rayon: 'epicerie_salee', saison: 'toutes' })
  -        .select('id').single();
  -      if (errIgnored(errIng, ing.nom)) continue;
  -      ingredientId = nouveau?.id ?? null;
  -    }
  -    if (ingredientId == null) continue;
  +    if (ingredientId == null) {
  +      // Ingrédient inconnu : noté dans les étapes, jamais ajouté au référentiel partagé
  +      ignores.push(ing.nom.slice(0, 60));
  +      continue;
  +    }
  ```
  + nettoyer les ingrédients existants créés par import (`select … from ingredients i where not exists (select 1 from meal_ingredients mi join meals m on m.id=mi.meal_id where mi.ingredient_id=i.id and m.is_public)` puis revue manuelle).
- **Vérification** : importer un texte contenant un ingrédient fictif → `select count(*) from ingredients` inchangé.
- **Références** : CWE-20, OWASP « Content spoofing ».

---

### VULN-008 — Coût LLM sans plafond journalier (denial of wallet)

- **Sévérité** : Moyen — CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` = **4.3**.
- **Catégorie** : OWASP API4:2023 Unrestricted Resource Consumption — CWE-770.
- **Localisation** : `src/app/api/import-recette/route.ts:261-287` : 5 imports / 10 min / compte et par IP, **illimité** pour Pro/Famille (jusqu'à ~720 appels/jour, 30 000 caractères chacun).
- **Scénario** : un abonné à 5,99 € (ou un compte volé) automatise des imports de pages de 2 Mo → facture LLM de plusieurs dizaines d'euros par jour et par compte.
- **Correctif** :
  ```diff
  +    // Plafond de coût, quel que soit le plan
  +    const jour = await enforceUserRateLimit(request, user.id, { name: 'import-recette-jour', limit: 30, windowMs: 24 * 3600_000 });
  +    if (jour) return jour;
  ```
  + alerte budget côté fournisseur LLM (plafond mensuel).
- **Vérification** : 31ᵉ import dans la journée → 429.
- **Références** : CWE-770, OWASP API4:2023.

---

### VULN-007 — Contournement du filtre SSRF de l'import d'URL

- **Sévérité** : Faible — CVSS 3.1 `AV:N/AC:H/PR:L/UI:N/S:C/C:L/I:N/A:N` = **3.5** (le protocole `https` et le port 443 imposés limitent fortement l'exploitation : pas d'accès HTTP aux métadonnées cloud).
- **Catégorie** : A10:2021 SSRF — CWE-918.
- **Localisation** : `src/app/api/import-recette/route.ts:47-97` (`ipNonPublique`, `urlPubliqueAutorisee`, `hoteResoutVersPublic`) et `:107` (`fetch` qui résout à nouveau le nom → TOCTOU).
- **Description** : 1) une IPv4 encapsulée en IPv6 littérale est normalisée par `URL` en hexadécimal (`[::ffff:7f00:1]`), forme que la regex `^::ffff:(\d+\.\d+\.\d+\.\d+)$` ne reconnaît pas ; 2) les préfixes NAT64 (`64:ff9b::/96`) et `192.0.0.0/24` ne sont pas filtrés ; 3) la vérification DNS puis le `fetch` font **deux résolutions** distinctes (rebinding DNS possible).
- **Preuve (exécutée, test unitaire de la fonction exportée)** :
  ```
  AUTORISÉE  https://[::ffff:127.0.0.1]/   → hostname [::ffff:7f00:1]
  AUTORISÉE  https://[::ffff:a9fe:a9fe]/   → (169.254.169.254)
  AUTORISÉE  https://[64:ff9b::7f00:1]/
  AUTORISÉE  https://192.0.0.1/
  refusée    https://127.0.0.1/, https://[::1]/, https://169.254.169.254/, https://0x7f.1/
  ```
  `hoteResoutVersPublic()` laisse aussi passer `::ffff:7f00:1` (même regex).
- **Impact** : requêtes HTTPS internes sur le port 443 de l'environnement d'exécution (aujourd'hui sans service connu sur Vercel) ; risque futur si l'hébergement change.
- **Correctif** :
  ```diff
  +import { Agent } from 'undici';
   function ipNonPublique(ip: string): boolean {
     ...
     if (v === 6) {
       const x = ip.toLowerCase();
  -    const mappe = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  -    if (mappe) return ipNonPublique(mappe[1]);
  +    const dec = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  +    if (dec) return ipNonPublique(dec[1]);
  +    const hex = x.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  +    if (hex) { const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
  +      return ipNonPublique(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
  +    if (x.startsWith('64:ff9b:') || x.startsWith('2002:') || x.startsWith('2001:db8')) return true;
       return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
     }
  ```
  et fixer l'IP résolue pour la connexion (plus de seconde résolution) :
  ```ts
  const agent = new Agent({ connect: { lookup: (host, opts, cb) =>
    lookup(host, { all: false }).then(({ address, family }) =>
      ipNonPublique(address) ? cb(new Error('IP interdite'), '', 0) : cb(null, address, family), cb) } });
  await fetch(url, { dispatcher: agent, redirect: 'manual', ... });
  ```
  (ou ajouter `192.0.0.0/24`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` à la liste IPv4).
- **Vérification** : rejouer le test ci-dessus → toutes les adresses internes « refusée » ; test unitaire à ajouter dans `tests/`.
- **Références** : CWE-918, OWASP SSRF Prevention Cheat Sheet.

---

### VULN-009 — Pas de « mot de passe oublié » ; email du profil désynchronisé

- **Sévérité** : Faible — CVSS 3.1 `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N` = **2.6**.
- **Catégorie** : A07:2021 / RGPD (exactitude des données).
- **Localisation** : aucune occurrence de `resetPasswordForEmail` dans `src/` ; `src/components/compte/ProfileSettings.tsx:50` change l'email Auth, mais `profiles.email` (utilisé par `src/lib/email-service.ts:28,122` et les routes d'abonnement) n'est jamais mis à jour — il est désormais même verrouillé côté client par le trigger `guard_profiles_sensitive_columns` (migration 00042).
- **Description** : 1) un utilisateur qui oublie son mot de passe n'a aucun moyen de récupérer son compte (support manuel) ; 2) après un changement d'email confirmé, les récapitulatifs et confirmations d'abonnement/rétractation partent **vers l'ancienne adresse** (qui peut appartenir à quelqu'un d'autre).
- **Correctif** : page `/mot-de-passe-oublie` (`supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/auth/callback?next=/compte' })`, réponse identique que le compte existe ou non, rate limit par IP et par email) ; trigger de synchronisation :
  ```sql
  create or replace function public.sync_profile_email() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
    return new;
  end $$;
  create trigger on_auth_user_email_change after update of email on auth.users
    for each row execute function public.sync_profile_email();
  ```
- **Vérification** : changer d'email, confirmer → `profiles.email` mis à jour ; parcours de réinitialisation testé de bout en bout.

---

### VULN-010 — CSP `script-src 'unsafe-inline'`

- **Sévérité** : Faible (durcissement, pas de faille exploitable trouvée).
- **Localisation** : `next.config.ts` (`script-src 'self' 'unsafe-inline' https://js.stripe.com https://plausible.io`).
- **Description** : aucune injection n'a été trouvée (React échappe tout, `dangerouslySetInnerHTML` uniquement pour du JSON-LD dont `<` est échappé — `src/lib/seo.ts:7`), mais la CSP n'apporterait pas de seconde barrière en cas de XSS futur. Un essai de CSP stricte avec SRI (`experimental.sri`) a cassé l'hydratation (scripts inline de Next) lors de cette campagne.
- **Correctif** : CSP à nonce générée dans `src/proxy.ts` pour les pages **authentifiées** uniquement (déjà dynamiques), en gardant la CSP actuelle sur les pages publiques statiques ; ou attendre le support SRI des scripts inline. Ajouter `report-to` pour observer les violations.

---

### VULN-011 — Emails en clair dans le journal de sécurité

- **Sévérité** : Faible (minimisation RGPD).
- **Localisation** : `src/app/api/auth/login/route.ts:33`, `src/app/api/auth/signup/route.ts:60`, `src/app/api/auth/resend/route.ts:21`, `src/app/api/auth/verify-otp/route.ts:28` (`logRequestSecurityEvent(…, { email })`) → table `security_events` (90 jours) et logs Vercel.
- **Correctif** : journaliser un hash : `{ email_hash: createHash('sha256').update(email + process.env.ANALYTICS_SECRET).digest('hex').slice(0, 16) }`.

---

### VULN-012 — `next/image` accepte tous les projets `*.supabase.co`

- **Sévérité** : Faible — CVSS `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` (coût) ≈ 3.1 (estimation, A limité à la facturation d'optimisation d'images).
- **Localisation** : `next.config.ts` `images.remotePatterns` → `hostname: '*.supabase.co'`.
- **Description** : `/_next/image?url=https://<n'importe-quel-projet>.supabase.co/storage/v1/object/public/...` est optimisé et servi par votre domaine (consommation de quota, hébergement d'images tierces sous votre domaine).
- **Correctif** :
  ```diff
  -        hostname: '*.supabase.co',
  +        hostname: 'iykikxiwpnrrrwzfpskg.supabase.co',
  ```

---

### VULN-013 — CI GitHub Actions

- **Sévérité** : Faible (chaîne d'approvisionnement).
- **Localisation** : `.github/workflows/ci.yml` — `actions/checkout@v4`, `actions/setup-node@v4` (tags mobiles), pas de bloc `permissions:` (jeton `GITHUB_TOKEN` avec les droits par défaut du dépôt).
- **Correctif** :
  ```diff
   name: CI
  +permissions:
  +  contents: read
  ...
  -      - uses: actions/checkout@v4
  +      - uses: actions/checkout@<SHA complet de la v4>   # v4.x.y
  ```
  + activer Dependabot (npm + github-actions) et le « secret scanning / push protection » GitHub.

---

### VULN-014 — Données utilisateur dans les en-têtes d'email

- **Sévérité** : Faible — À vérifier.
- **Localisation** : `src/app/api/demande-recette/route.ts:40` (`subject` contient `titre` saisi), `src/app/api/contact/route.ts:36` (`replyTo: email`).
- **Description** : le titre n'est pas débarrassé des caractères de contrôle (`\r\n`). L'API Resend (JSON) devrait refuser/neutraliser l'injection d'en-têtes, mais ce n'est pas garanti par le code.
- **Correctif** : `const titre = body.titre.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();` (même traitement pour tout champ placé dans un en-tête).

---

### VULN-015 — Bucket `meal-images` sans limites

- **Sévérité** : Info. Bucket public, `file_size_limit` et `allowed_mime_types` vides ; **aucune policy** sur `storage.objects` (donc aucun envoi possible hors clé de service : correct). Ajouter quand même `file_size_limit = 5 MB` et `allowed_mime_types = {image/jpeg,image/png,image/webp}` en défense en profondeur.

### VULN-016 — Rate limiting dépendant de `x-real-ip`

- **Sévérité** : Info. `src/lib/rate-limit.ts:92-101` fait confiance à `x-real-ip` / dernière entrée de `x-forwarded-for` : correct derrière Vercel (en-têtes réécrits par la plateforme), **falsifiable** si l'application est un jour servie sans ce proxy (démontré en local : 12 tentatives de connexion avec IP falsifiées sans 429 IP — la limite par email reste active). Documenter cette dépendance ; activer en plus le « Firewall / Bot protection » Vercel sur `/api/auth/*`.

### VULN-017 — Codes d'invitation de foyer (32 bits)

- **Sévérité** : Info (atténué). 8 caractères × 16 symboles = 2³². Depuis la migration 00043/00044, l'appel direct par REST est fermé (`household_join` non exécutable par `authenticated`, vérifié) et l'API limite à 8 essais / 10 min / compte. Envisager 12 caractères et une expiration par défaut ≤ 7 jours.

### VULN-018 — `Access-Control-Allow-Origin: *` sur le déploiement Vercel

- **Sévérité** : Info — À vérifier. Une requête `HEAD` unique sur `planmymeal-seven.vercel.app` (voir Limites) a renvoyé `Access-Control-Allow-Origin: *` sur la page d'accueil, alors que la version locale n'en émet aucun. Sans cookie d'authentification sur une page publique, ce n'est pas exploitable, mais vérifier que la version déployée est bien la dernière et qu'aucune route `/api/*` ne l'émet.

---

## 4. Cartographie (Phase 0)

### 4.1 Flux de données et frontières de confiance

```mermaid
flowchart LR
  N[Navigateur] -- "HTTPS + cookie sb-*-auth-token" --> P[proxy.ts\nCSRF / taille / redirections auth]
  P --> R[Route handlers /api/*\ngetUser() + rate limit]
  N -- "clé anon + JWT (RLS)" --> S[(Supabase Postgres\nRLS)]
  R -- "service_role (RLS contournée)" --> S
  R --> ST[Stripe API]
  R --> RS[Resend]
  R --> AI[LLM Gemini/Anthropic]
  R -- "fetch URL utilisateur" --> WEB[Sites tiers]
  N -- "JWT" --> EF[Edge Function create-checkout] --> ST
  ST -- "webhook signé" --> WH[Edge Function stripe-webhook] -- service_role --> S
  CRON[Vercel Cron + CRON_SECRET] --> R
  N -- "beacon anonyme" --> M[/api/mesure] -- service_role --> S
```

Frontières : (1) navigateur ↔ Next (non fiable → tout est validé dans les routes) ; (2) Next ↔ Supabase en `service_role` (**le contrôle d'accès repose sur le code des routes** : chaque requête admin filtre par `user.id`) ; (3) navigateur ↔ Supabase en direct (RLS) ; (4) Stripe → webhook (signature) ; (5) serveur → Internet (SSRF).

### 4.2 Points d'entrée (44 route handlers + 2 Edge Functions)

| Route | Méthodes | Auth | Rôle / plan | Entrées principales | Accès base | Limite de débit |
|---|---|---|---|---|---|---|
| `/api/auth/login` | POST | — | — | email, password | Auth | 10/15 min IP + 5/15 min (email, IP) + 30/h email |
| `/api/auth/signup` | POST | — | — | name, email, password, cgu, honeypot | Auth, profiles | 5/10 min IP + 3/h email |
| `/api/auth/resend` | POST | — | — | email | Auth | 5/10 min IP + 3/10 min email |
| `/api/auth/verify-otp` | POST | — | — | email, code | Auth | 10/15 min IP + 5/15 min email |
| `/auth/callback` | GET | — | — | code / token_hash, next | Auth | — (open redirect filtré) |
| `/api/abonnement` | GET | session | — | — | profiles (admin), Stripe | 30/min |
| `/api/abonnement/resilier` | POST | session | abonné | action | profiles, Stripe, email | 10/min |
| `/api/abonnement/retractation` | POST | session | abonné | — | profiles, Stripe (refund), email | 5/min |
| `/api/billing-portal` | POST | session | client Stripe | — | profiles, Stripe | 10/min |
| `/api/budget` | GET, PUT | session | prix max = payant | budget, prix, dépenses | profiles, snapshots, prix (admin) | 120/min, 60/min |
| `/api/compte/export` | GET | session | — | — | 17 tables (admin, filtre user) | 10/min IP, 5/h compte |
| `/api/compte/supprimer` | POST | session | — | confirmation | toutes tables (admin) + Auth | 5/5 min |
| `/api/contact` | POST | — | — | name, email, subject, message, honeypot | email | 5/10 min |
| `/api/courses/cocher` | POST | session | — | list_id, ingredient_id | shopping_* (admin, propriété vérifiée) | par compte |
| `/api/cron/*` (4) | GET | Bearer `CRON_SECRET` (temps constant) | — | dry_run, limit | toutes (admin) | — |
| `/api/demande-recette` | POST | session | — | titre, details | recipe_requests, email | 10/min IP, 5/j compte |
| `/api/famille` | GET, PUT, DELETE | session | création = Famille | membre, aliments, recettes | family_* via RPC (admin) | 120/40/120 par min |
| `/api/favori` | GET, POST | session (GET public = null) | — | meal_id, avis | meal_history, préférences | 60/min |
| `/api/foyer` | PATCH | session | — | nb_personnes | profiles, liste | 20/min |
| `/api/foyer-partage` | GET, PATCH, POST | session (client lié à la session) | inviter = Famille | action, code, ids | RPC household_* | 30/20/15 par min, rejoindre 8/10 min |
| `/api/frigo` | GET, POST, DELETE | session | — | ingredient_id, quantite, id | fridge_items (admin, filtre user) | 120/60/60 |
| `/api/generate-week` | POST | session | quotas gratuits serveur | semaine, intention, slots | moteur + RPC save_weekly_plan | 20/min |
| `/api/import-recette` | POST | session | 1/mois gratuit | url **ou** texte | meals, ingredients, meal_ingredients (admin), LLM, fetch externe | 5/10 min |
| `/api/meal-status` | POST | session | — | meal_id, status | meal_history | 60/min |
| `/api/mesure` | POST | — | — | t, c, r, s, n, d | mesure_evenements (admin) | 120/min/IP (mémoire) |
| `/api/move-meal` | POST | session | — | from, to, semaine | plan_meals (admin, plan de l'utilisateur) | par compte |
| `/api/newsletter` (+ `confirmer`, `desinscription`) | POST (+GET redirect) | — (jeton UUID) | — | email / token | newsletter_subscribers | 5/min, 2/j/email |
| `/api/noter` | POST | session | — | meal_id, note, raison | meal_history, préférences | 120/min IP, 60/min |
| `/api/planning/partager` | POST, DELETE | session | — | semaine | weekly_plans.share_token | 20/min |
| `/api/pourquoi` | GET | session | — | meal_id, jour, repas | meals (filtre visibilité) | 120/min |
| `/api/preferences` | GET, PUT, DELETE | session | — | patch, preference.meal_id | profiles, user_meal_preferences | 120/60/120 — **VULN-002** |
| `/api/prix` | GET, PUT | session | — | ingredient_id, prix | prix, liste, snapshots | 120/60 |
| `/api/profil` | POST | session | — | liste blanche de champs | profiles, user_diets, exclusions | 30/min |
| `/api/recettes` | GET | — | — | filtres, offset, limite (≤ 48) | index catalogue en mémoire | 120/min |
| `/api/repas-libre` | POST | session | — | créneau, texte ≤ 80 | plan_meals | 40/min |
| `/api/swap-meal` | POST | session | quotas via generate-week | créneau, meal_id public | plan_meals | 40/min |
| `/api/vider-le-frigo` | POST | session | 3/sem gratuit | ingredient_ids ≤ 15 | catalogue | 15/min |
| `/api/welcome` | POST | session | — | — | email (idempotent) | 5/min |
| `/api/admin/stats`, `/api/admin/analytics` | GET | session + `ADMIN_EMAILS` (serveur) | admin | jours | agrégats (admin) | 30/min |
| Edge `create-checkout` | POST | JWT Supabase | — | plan, periode | profiles, Stripe | — (Supabase) — **VULN-003** |
| Edge `stripe-webhook` | POST | signature Stripe | — | événement | profiles (service_role) | — — **VULN-005** |
| Pages serveur `/menu/[token]`, `/liste/[token]` | GET | jeton UUID v4 | — | token | plan + liste (admin) | — |

### 4.3 Modèle de menace (STRIDE, résumé)

| Menace | Actif | Couverture actuelle | Écart |
|---|---|---|---|
| **S**poofing | comptes | getUser() serveur, email confirmé exigé, rate limit login/OTP | VULN-004, VULN-009 |
| **T**ampering | plan / Stripe / plannings | trigger `guard_profiles_sensitive_columns`, RLS en lecture seule sur plannings (00045), webhook signé | VULN-005, VULN-006 |
| **R**epudiation | actions sensibles | `security_events` 90 j, logs Vercel | pas d'alerting (§6) |
| **I**nformation disclosure | données santé, recettes privées | RLS, filtres `user.id`, export restreint | VULN-002, VULN-001 |
| **D**enial of service | API, coûts LLM/emails | rate limit partagé en base, corps ≤ 1 Mo, quotas d'offre | VULN-008, VULN-012 |
| **E**levation of privilege | admin, plan payant | `ADMIN_EMAILS` côté serveur, quotas serveur | VULN-003 |

---

## 5. Ce qui est bien fait (à ne pas casser)

- **Authentification serveur systématique** : `src/lib/api-auth.ts` utilise `supabase.auth.getUser()` (validation du JWT auprès de Supabase), refuse les emails non confirmés ; 56 appels non authentifiés testés → 401/405, aucune fuite.
- **Identifiant toujours issu de la session** : aucune route n'accepte de `user_id` du client (l'ancienne IDOR de `billing-portal` est corrigée et commentée).
- **Liste blanche des champs** (`/api/profil` `patchProfil`) : pas de mass assignment ; le trigger SQL `guard_profiles_sensitive_columns` bloque en plus `plan`, `email`, `stripe_*` pour les rôles clients.
- **RLS** activée sur toutes les tables `public` ; tests avec la clé `anon` : 0 ligne lisible sur 18 tables sensibles, RPC sensibles refusées (401/404), `mesure_evenements` et `mesure_resume` inaccessibles ; plannings/listes en lecture seule pour le client (00045). Aucune vue, aucun table en Realtime, toutes les fonctions `SECURITY DEFINER` ont un `search_path` fixé.
- **CSRF / CORS** (`src/proxy.ts` `gardeApi`) : écriture refusée si `Origin` ≠ site ou `Sec-Fetch-Site: cross-site` (403 testé), aucun en-tête CORS émis par l'API, corps > 1 Mo → 413, `Transfer-Encoding` sans longueur → 411.
- **Proxy / middleware** : pas de contournement par `x-middleware-subrequest` (Next 16.3.8, non concerné par CVE-2025-29927 ; testé), ni par `/_next/data`, slash final ou casse.
- **Open redirect** : `cheminSur()` de `/auth/callback` résiste à 10 variantes (`//`, `/\`, `%09`, `%0a`, `javascript:`…).
- **Rate limiting partagé en base** (`rate_limit_hit`) avec repli mémoire, par IP **et** par compte/email ; anti-verrouillage (couple email+IP).
- **En-têtes** : HSTS 2 ans, `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, pas de `X-Powered-By`, pas de source maps, pas de `unsafe-eval` en production.
- **Secrets** : aucun secret dans le dépôt ni dans les 45 commits de l'historique (recherche `sk_`, `whsec_`, `eyJ…`, `AKIA`, clés privées) ; seules des variables `NEXT_PUBLIC_*` non sensibles ; `.env*` ignorés (sauf `.env.example`, vide).
- **Crons** : secret comparé en temps constant (`bearerValide`), refus si secret absent en production.
- **SSRF** : https seul, pas d'identifiants dans l'URL, redirections non suivies, taille 2 Mo, timeout, résolution DNS contrôlée (à compléter, VULN-007).
- **Emails** : échappement HTML systématique (`echapper`, `esc`), double opt-in newsletter, désinscription RFC 8058, actions POST seulement (les antivirus ne déclenchent rien).
- **RGPD** : export JSON, suppression de compte en cascade (Stripe résilié d'abord), purge automatique (sécurité 90 j, newsletter non confirmée 7 j, comptes inactifs 24 mois, mesure 25 mois), mesure d'audience sans cookie ni IP.
- `npm audit --omit=dev` : **0 vulnérabilité** ; lockfile présent ; CI (lint, types, tests, build) sur chaque push.

---

## 6. Plan de remédiation

| Priorité | Actions | Type |
|---|---|---|
| **P0 (immédiat)** | VULN-001 (domaine + variables), VULN-002 (filtre `meal_id`) | Quick wins |
| **P1 (< 1 semaine, avant d'ouvrir Stripe)** | VULN-004 (réauthentification), VULN-003, VULN-005 (paiements), VULN-006 (ingrédients), VULN-008 (plafond LLM) | Quick wins + 1 chantier (webhook) |
| **P2 (< 1 mois)** | VULN-007 (SSRF), VULN-009 (mot de passe oublié + sync email), VULN-011, VULN-012, VULN-013, VULN-014 | Quick wins |
| **P3 (backlog)** | VULN-010 (CSP à nonce), VULN-015 à VULN-018 | Chantiers structurels / durcissement |

**Recommandations durables**
- **CI sécurité** : ajouter `npm audit --audit-level=high`, Semgrep (règles `p/nextjs`, `p/owasp-top-ten`), gitleaks, Dependabot ; épingler les actions par SHA.
- **Tests d'autorisation automatisés** : un test Playwright à 2 comptes (fixtures `E2E_EMAIL`/`E2E_EMAIL_2`) qui rejoue les IDOR de ce rapport sur chaque PR.
- **Monitoring / alerting** : alerte (Vercel Log Drains ou Sentry) sur rafales de `security_events` (`login_abuse`, `honeypot`, `cron_secret`) et sur les erreurs « remboursement à traiter MANUELLEMENT ».
- **WAF** : activer le Firewall Vercel (bot protection, règles sur `/api/auth/*`, `/api/mesure`).
- **Rotation des secrets** : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`, clés LLM tous les 6-12 mois et à chaque départ d'un intervenant ; Supabase « leaked password protection » à activer (offre Pro).
- **Réponse à incident** : procédure écrite (révocation des sessions via `auth.admin.signOut`, rotation des clés, notification CNIL sous 72 h).

---

## 7. Limites de l'audit

- **Pas de comptes de test** : les scénarios IDOR/escalade à deux comptes (VULN-002 notamment) et le parcours connecté n'ont pas été rejoués dynamiquement ; ils sont démontrés par lecture du code et de la base.
- **Tests live** limités à la version de production **locale** branchée sur la vraie base, sans écriture (rafales ≤ 30 requêtes : 12 tentatives de connexion, 9 contournements de proxy, etc.). **Écart aux règles d'engagement** : une **requête `HEAD` unique** a été envoyée par erreur à `https://planmymeal-seven.vercel.app` avant votre confirmation du périmètre ; aucune autre requête n'a visé le déploiement en ligne.
- **Stripe** non configuré (aucune clé, Edge Functions non déployées) : VULN-003/005 ne sont pas testées en mode test Stripe.
- **Réglages non lisibles** : Supabase Auth (« Secure password change », durée des sessions, MFA, URLs de redirection autorisées), configuration du portail Stripe, Firewall Vercel, en-têtes réellement servis par la version déployée.
- **Non relus intégralement** : les scripts d'administration `scripts/*.ts` (exécutés localement avec la clé de service, hors surface d'attaque web — seul le scan de secrets a été fait), le moteur `src/lib/rotation-engine.ts` (logique métier, appelé uniquement après authentification et avec `user.id` de session), les composants d'interface sans accès réseau sensible.
- **DNS / email** : SPF/DKIM/DMARC non évaluables tant que le domaine n'existe pas (VULN-001) ; TLS du domaine final non testable.
- **Prompt injection** : l'import IA n'a pas d'outils ni d'accès à d'autres données (sortie validée par `validerRecetteExtraite`, recette privée) ; le risque résiduel est la pollution de contenu (VULN-006).
- Les scores CVSS sont des **estimations** de l'auditeur à partir des vecteurs indiqués.

---

*Voulez-vous que j'applique les correctifs P0/P1 (branche dédiée `securite/p0-p1`, un commit par faille, avec un test pour chacune) ?*

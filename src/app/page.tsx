'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BadgeEuro, Brain, Check, ChefHat, Heart, Loader2, Minus,
  Package, Plus, Refrigerator, ShoppingCart, Sparkles, Users, UtensilsCrossed,
  CalendarDays,
} from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { Reveal } from '@/components/Reveal';
import { ChiffresCles } from '@/components/ChiffresCles';
import { useAuth } from '@/components/AuthProvider';
import { redirectToCheckout } from '@/lib/stripe-client';
import { STRIPE_ENABLED, STRIPE_PLANS } from '@/lib/stripe';
import { SITE_URL, serialiserJsonLd } from '@/lib/seo';
import { IMPORTS_GRATUITS_PAR_MOIS } from '@/lib/limites';

// SoftwareApplication schema.org : type d'app, plateforme et offres tarifaires
const jsonLdApp = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PlanMyMeal',
  url: SITE_URL,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: 'fr-FR',
  description: 'Planificateur de repas : menus de la semaine personnalisés, liste de courses automatique, anti-gaspillage et suivi du budget.',
  offers: [
    { '@type': 'Offer', name: 'Gratuit', price: '0', priceCurrency: 'EUR' },
    ...Object.values(STRIPE_PLANS).map(p => ({
      '@type': 'Offer', name: p.name, price: p.price.toFixed(2), priceCurrency: 'EUR',
    })),
  ],
  publisher: { '@id': `${SITE_URL}/#organisation` },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(jsonLdApp) }} />
      <LandingHeader />
      <main>
        <Hero />
        <IconsBanner />
        <ChiffresCles />
        <Features />
        <Collection />
        <NouveautesMonde />
        <Promo />
        <Pricing />
      </main>
      <LandingFooter />
    </div>
  );
}

// ─── Hero scindé avec vague ─────────────────────────────────────────────────

function Hero() {
  const { user, profile, loading } = useAuth();
  const isLoggedIn = !loading && !!user;
  const userName = (profile?.full_name?.trim() || user?.email?.split('@')[0] || '');

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2">
        {/* Côté gauche : texte */}
        <div className="flex items-center px-6 sm:px-12 py-16 lg:py-24">
          {/* Au-dessus de la ligne de flottaison : animation CSS (joue sans
              JavaScript ni IntersectionObserver). Avec Reveal, le titre H1 était
              servi en opacity:0 et restait invisible tant que le JS n'avait pas
              tourné (aperçus de partage, robots, JS lent). */}
          <div className="max-w-xl animate-hero-in">
            {isLoggedIn ? (
              <p className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
                Bonjour {userName} — vous êtes connecté
              </p>
            ) : (
              <span className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
                Planification de repas
              </span>
            )}

            <h1 className="mt-5 font-display text-5xl sm:text-6xl font-bold text-gray-900 leading-[1.06]">
              Mangez mieux.
              <br />
              <Underlined color="#7C5FBF">Planifiez moins.</Underlined>
            </h1>

            <p className="mt-6 text-gray-600 text-lg leading-relaxed">
              Chaque semaine, le moteur arbitre votre budget, vos goûts, votre
              temps et votre frigo pour composer des menus sur mesure — et la
              liste de courses arrive toute prête.
            </p>

            <div className="mt-9">
              <Link href={isLoggedIn ? '/aujourdhui' : '/signup'}
                className="group inline-flex items-center gap-2.5 px-8 py-4 bg-brand-500 text-white font-semibold text-sm tracking-[0.12em] uppercase rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                {isLoggedIn ? 'Retourner à mes repas' : 'Planifier ma semaine'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Preuve immédiate sous le CTA : les 3 promesses concrètes du
                produit. La preuve sociale (« Déjà X foyers accompagnés »)
                prendra cette place le jour où le chiffre est réel — jamais
                inventé. */}
            <ul className="mt-6 space-y-2 text-sm text-gray-700">
              {['Menu personnalisé', 'Liste de courses automatique', 'Adapté à votre budget'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-brand-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Gratuit pour toujours · sans carte bancaire
            </p>
          </div>
        </div>

        {/* Côté droit : terracotta tuilé, lever de soleil en haut à droite */}
        <div className="relative overflow-hidden bg-brand-600">
          {/* Motif tuiles */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.07)_0_2px,transparent_2px_16px)]" aria-hidden />
          {/* Lever de soleil : halo chaud au coin supérieur droit */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(207,112,64,0.55),transparent_55%)]" aria-hidden />
          {/* Vague crème */}
          <svg className="absolute inset-y-0 left-0 h-full w-[70px] sm:w-[110px] text-gray-50" viewBox="0 0 110 800" preserveAspectRatio="none" aria-hidden>
            <path d="M110 0 H0 C25 100 75 160 40 240 C5 320 85 380 55 460 C25 540 85 600 50 680 C25 740 70 780 110 800 Z" fill="currentColor" />
          </svg>

          <div className="relative flex items-center justify-center py-16 lg:py-24 pl-10 sm:pl-16 pr-6 sm:pr-12">
            {/* Pile de menus : deux cartes en arrière-plan */}
            <Reveal className="relative" delay={0.15} y={16}>
              <div className="absolute inset-0 translate-x-3 translate-y-4 -rotate-3 bg-white/85 rounded-4xl shadow-lg" aria-hidden />
              <div className="absolute inset-0 translate-x-1.5 translate-y-2 rotate-1 bg-white/60 rounded-4xl shadow-sm" aria-hidden />
              <HeroMealCard />
            </Reveal>
            {/* Badge circulaire : flotte dans l'espace à droite de la carte,
                qui n'existe qu'à partir de lg (le calage lg:grid-cols-2 passe
                cette colonne en pleine largeur en dessous) — en dessous, la
                carte remplit tout l'espace et le badge se retrouvait à
                cheval dessus, cachant « Optimisé pour vous ». */}
            <div className="hidden lg:flex absolute bottom-10 right-10 w-28 h-28 rounded-full bg-gray-50 border border-gray-200 shadow-lg flex-col items-center justify-center text-center">
              <Heart className="w-5 h-5 text-brand-600" />
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-700 mt-1.5 leading-tight px-2">
                Fait maison avec amour
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMealCard() {
  const meals = [
    { e: '🍗', t: 'Poulet rôti, légumes de saison', meta: '45 min · 620 kcal' },
    { e: '🎃', t: 'Velouté de potimarron', meta: '25 min · 310 kcal' },
    { e: '🥗', t: 'Salade de lentilles, feta', meta: '15 min · 420 kcal' },
  ];

  return (
    <div className="w-[320px] sm:w-[380px] bg-white rounded-4xl shadow-2xl shadow-brand-900/20 p-6 rotate-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-brand-600 font-semibold">Mardi · Déjeuner</div>
          <div className="font-display text-xl font-bold text-gray-900 mt-0.5">Menu du jour</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-2.5">
        {meals.map(m => (
          <div key={m.t} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
            <span className="w-9 h-9 rounded-full bg-white shadow-xs flex items-center justify-center text-lg shrink-0">{m.e}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{m.t}</div>
              <div className="text-[11px] text-gray-500">{m.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Liste de courses prête 🛒</span>
        <span className="text-[11px] font-semibold tracking-wide bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full">
          Optimisé pour vous ✨
        </span>
      </div>
    </div>
  );
}

// ─── Bandeau icônes (lavande) ───────────────────────────────────────────────

// Barre des 4 fonctionnalités : les BÉNÉFICES (ce que ça change pour vous),
// pas les mécanismes. « Génération IA » est devenu un feature banal — on vend
// le résultat : une semaine optimisée sur les 7 dimensions que le moteur
// arbitre réellement (le détail est énuméré dans la section Fonctionnalités).
const ICONS = [
  { icon: <Brain className="w-6 h-6" />, label: 'Mémoire du foyer' },
  { icon: <ShoppingCart className="w-6 h-6" />, label: 'Courses optimisées' },
  { icon: <Package className="w-6 h-6" />, label: 'Anti-gaspillage' },
  { icon: <Sparkles className="w-6 h-6" />, label: 'Semaine optimisée à 7 critères' },
];

function IconsBanner() {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-accent-200 border-y border-accent-200">
      {ICONS.map((item, i) => (
        <Reveal key={item.label} delay={i * 0.08} y={16}
          className="group bg-accent-100 py-8 px-4 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full border border-brand-500/40 flex items-center justify-center text-brand-600 bg-gray-50 group-hover:bg-white group-hover:scale-105 transition-all">
            {item.icon}
          </div>
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-800">
            {item.label}
          </span>
          {/* Trait éditorial : accent → brand au survol */}
          <span className="h-0.5 w-4 rounded-full bg-accent-300 group-hover:bg-brand-500 group-hover:w-8 transition-all" aria-hidden />
        </Reveal>
      ))}
    </section>
  );
}

// ─── Fonctionnalités ────────────────────────────────────────────────────────
// Chaque ligne décrit une capacité réellement présente dans le produit :
// rotation 21 j (MIN_DAYS_BEFORE_REUSE), frigo (lib/frigo.ts), restes,
// budget + macros (lib/budget.ts, lib/macros.ts).

const FEATURES = [
  {
    icon: Sparkles, accent: 'text-brand-600 bg-brand-100',
    title: 'Votre semaine optimisée en un clic',
    desc: 'Budget, goûts, temps, stock, restes, nutrition, gaspillage : un bouton et le moteur arbitre les sept dimensions de votre semaine — déjeuners, dîners et desserts. Adieu la page blanche du dimanche soir.',
  },
  {
    icon: Brain, accent: 'text-accent-600 bg-accent-100',
    title: 'Une mémoire qui cuisine comme vous',
    desc: 'Vos favoris reviennent, vos déceptions disparaissent : aucun plat ne se représente avant 21 jours. Chaque semaine est meilleure que la précédente.',
  },
  {
    icon: Refrigerator, accent: 'text-green-700 bg-green-100',
    title: 'Zéro gaspillage, zéro culpabilité',
    desc: 'Déclarez le contenu de votre frigo : les recettes qui l’utilisent passent en tête et ses ingrédients sortent de votre liste de courses. Votre poubelle vous dira merci.',
  },
  {
    icon: UtensilsCrossed, accent: 'text-orange-700 bg-orange-100',
    title: 'Cuisinez une fois, mangez plusieurs fois',
    desc: 'Une session batch le week-end, des plats qui se conservent, des restes replanifiés le lendemain midi. Moins de vaisselle, plus de plaisir.',
  },
  {
    icon: ShoppingCart, accent: 'text-blue-700 bg-blue-100',
    title: 'Votre liste de courses, toute prête',
    desc: 'Complète, triée par rayon et ajustée au nombre de bouches à nourrir. Cochez en magasin : elle suit vos changements de repas en temps réel.',
  },
  {
    icon: BadgeEuro, accent: 'text-brand-700 bg-brand-100',
    title: 'Le budget sous contrôle, sans y penser',
    desc: 'Prix par portion, cap « prix max » et total de la semaine : vos menus respectent votre portefeuille. Calories, protéines et lipides vérifiés sur chaque fiche.',
  },
  {
    icon: Users, accent: 'text-rose-700 bg-rose-100',
    title: 'Toute la famille à table, vraiment',
    desc: 'Jusqu’à 5 profils, allergies et dégoûts de chacun respectés : le moteur négocie LA semaine qui fera l’unanimité à table.',
  },
];

function Features() {
  return (
    <section id="fonctionnalites" className="py-20 sm:py-28 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">Fonctionnalités</span>
          <h2 className="mt-5 font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Tout pour bien manger,{' '}
            <Underlined color="#7C5FBF">au même endroit.</Underlined>
          </h2>
          <p className="mt-6 text-gray-600 text-lg leading-relaxed">
            Sept dimensions arbitérées en même temps, à chaque optimisation :
            budget, goûts, temps, stock, restes, nutrition, gaspillage. Vous n’avez plus qu’à déguster.
          </p>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.08} y={16}
              className="group bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-brand-200 hover:shadow-pop transition-all">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.accent} group-hover:scale-105 transition-transform`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Collection ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  { e: '🍛', pastel: 'bg-orange-50', title: 'Curry de pois chiches', sub: 'Réconfortant & épicé', meta: '35 min · 480 kcal', prix: '1,85 €/portion', ingrédients: ['Pois chiches', 'Lait de coco'] },
  { e: '🐟', pastel: 'bg-rose-50', title: 'Saumon, riz & brocoli', sub: 'Frais & équilibré', meta: '30 min · 540 kcal', prix: '3,20 €/portion', ingrédients: ['Saumon frais', 'Riz basmati'] },
  { e: '🥧', pastel: 'bg-green-50', title: 'Tarte aux légumes d’été', sub: 'Gourmande & légère', meta: '45 min · 520 kcal', prix: '2,10 €/portion', ingrédients: ['Pâte brisée', 'Courgettes'] },
];

function Collection() {
  return (
    <section id="collection" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
        {/* Texte */}
        <Reveal>
          <span className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
            Notre collection
          </span>
          <h2 className="mt-5 font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Des menus qui{' '}
            <Underlined color="#C4552C">vous ressemblent.</Underlined>
          </h2>
          <p className="mt-6 text-gray-600 text-lg leading-relaxed max-w-md">
            Optimisés pour vos goûts, vos allergies, votre rythme et votre
            budget. Fait pour votre peau… enfin, votre assiette — et la planète.
          </p>
          <a href="#tarifs"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 underline underline-offset-4 decoration-brand-300 hover:text-brand-700 transition-colors">
            Découvrir les menus
            <ArrowRight className="w-4 h-4" />
          </a>
        </Reveal>

        {/* Cartes produits */}
        <div className="grid sm:grid-cols-3 gap-6">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.1} className="bg-white rounded-t-3xl rounded-b-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className={`h-32 flex items-center justify-center text-5xl ${p.pastel}`}>
                {p.e}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-sm">{p.title.toUpperCase()}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{p.sub}</p>
                {/* Lignes d'ingrédients (rappel de la fiche recette) */}
                <ul className="mt-3 space-y-1.5">
                  {p.ingrédients.map(ing => (
                    <li key={ing} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-300 shrink-0" aria-hidden />{ing}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-3.5">
                  <span className="text-[11px] text-gray-600">{p.meta}</span>
                  <Link href="/signup" title="Ajouter à ma semaine"
                    className="w-9 h-9 rounded-full bg-accent-500 text-white flex items-center justify-center hover:bg-accent-600 hover:scale-105 transition-all shadow-card">
                    <Plus className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              {/* Footer budget : la promesse prix, dès la landing */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-green-700">{p.prix}</span>
                <span className="text-[11px] tracking-[0.14em] uppercase text-gray-500">Prix estimé</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Nouveautés du monde ────────────────────────────────────────────────────

// Comptes issus du seed world healthy (scripts/seed-world-healthy.ts) —
// ne pas augmenter sans lancer le seed correspondant.
const NOUVEAUTES = [
  { flag: '🇱🇧', nom: 'Libanaise', n: 48 },
  { flag: '🇬🇷', nom: 'Grecque', n: 48 },
  { flag: '🇻🇳', nom: 'Vietnamienne', n: 30 },
  { flag: '🇪🇸', nom: 'Espagnole', n: 30 },
  { flag: '🇧🇷', nom: 'Brésilienne', n: 30 },
  { flag: '🇰🇷', nom: 'Coréenne', n: 40 },
  { flag: '🇪🇹', nom: 'Éthiopienne', n: 64 },
  { flag: '🇯🇵', nom: 'Japonaise', n: 62 },
];

function NouveautesMonde() {
  return (
    <section id="nouveautes" className="pb-20 sm:pb-28 -mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="text-accent-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
                Nouveautés du monde
              </span>
              <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-gray-900">
                Chaque mois, une nouvelle cuisine s’invite dans votre semaine.
              </h3>
              <p className="mt-2 text-gray-600">
                Mezzés libanais, pho vietnamien, paella légère, feijoada…
                des recettes healthy écrites étape par étape, avec le budget par portion.
              </p>
            </div>
            <Link href="/recettes"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 underline underline-offset-4 decoration-brand-300 hover:text-brand-700 transition-colors whitespace-nowrap">
              Explorer tout le catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {NOUVEAUTES.map((c) => (
              <Link key={c.nom} href={`/recettes?cuisine=${encodeURIComponent(c.nom)}`}
                title={`Voir les recettes ${c.nom.toLowerCase()}s`}
                className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                <span className="text-2xl" aria-hidden>{c.flag}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{c.nom}</span>
                  <span className="block text-[11px] text-gray-500">{c.n} recettes</span>
                </span>
                <ArrowRight className="w-4 h-4 ml-auto text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Bannière promo ─────────────────────────────────────────────────────────

// Témoignage du bloc « Rituels » — remplacez par un VRAI avis client quand
// vous en avez un (citation, auteur, initiale, étoiles) : la variante
// témoignage s'affichera automatiquement à la place des statistiques.
// Tant que `quote` est vide → bandeau de statistiques produit (aucun avis inventé).
const TESTIMONIAL = {
  quote: '', // ex : 'On a arrêté de se demander quoi manger.'
  author: '', // ex : 'Camille, maman de 3'
  detail: '', // ex : 'utilisatrice Pro'
  initials: '', // ex : 'C'
  stars: 5,
};

/**
 * Bandeau stats affiché tant qu'aucun vrai témoignage n'est disponible.
 * Chiffres 100 % vérifiables dans le code :
 *  - 21 jours → MIN_DAYS_BEFORE_REUSE (src/lib/rotation-engine.ts)
 *  - 14 repas → 7 jours × 2 (déjeuner + dîner)
 *  - 1 clic   → bouton « Optimiser ma semaine » du dashboard
 */
const PROMO_STATS = [
  { value: '21 jours', label: 'de mémoire de rotation' },
  { value: '14 repas', label: 'planifiés en un clic' },
  { value: '1 clic', label: 'pour optimiser la semaine' },
];

function Promo() {
  // Un témoignage ne s'affiche que si la citation ET l'auteur sont renseignés
  const hasTestimonial = Boolean(TESTIMONIAL.quote.trim() && TESTIMONIAL.author.trim());
  return (
    <section id="rituels" className="bg-gray-50 pb-20 sm:pb-28">
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 overflow-hidden rounded-3xl shadow-xs">
        {/* Bloc terracotta */}
        <div className="relative bg-brand-600 p-10 sm:p-12">
          <span className="text-white/70 text-[11px] tracking-[0.28em] uppercase">
            Rituels simplifiés
          </span>
          <h3 className="mt-4 font-display text-3xl font-bold text-white leading-snug">
            Chaque semaine est un bon jour pour bien manger.
          </h3>
          <p className="mt-4 text-white/80 leading-relaxed">
            Des rituels qui font du bien et qui font du bien à faire.
          </p>
          <a href="#tarifs"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white transition-colors">
            Découvrir le batch cooking
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Bloc central : la semaine */}
        <div className="bg-gray-100 flex items-center justify-center p-8 bg-[radial-gradient(#DDCFB3_1px,transparent_1px)] bg-size-[18px_18px]">
          <div className="bg-gray-50 rounded-3xl p-6 shadow-xs w-full max-w-sm">
            <div className="grid grid-cols-7 gap-1.5">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-700">{d}</span>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${i === 1 ? 'bg-brand-500' : 'bg-white shadow-xs'}`}>
                    {['🍗', '🎃', '🐟', '🥗', '🍛', '🍕', '🥘'][i]}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] tracking-[0.22em] uppercase text-gray-600 mt-5">
              Une semaine optimisée en un clic
            </p>
          </div>
        </div>

        {/* Bloc lavande : preuve sociale */}
        <div className="bg-accent-100 flex flex-col items-center justify-center p-10 text-center">
          {hasTestimonial ? (
            <>
              {/* Étoiles du témoignage */}
              <div className="flex items-center gap-1" aria-label={`${TESTIMONIAL.stars} étoiles sur 5`}>
                {Array.from({ length: TESTIMONIAL.stars }).map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-5 font-display text-xl font-bold text-gray-900 leading-snug max-w-xs">
                « {TESTIMONIAL.quote} »
              </blockquote>
              <p className="mt-3 text-sm text-gray-600">{TESTIMONIAL.author} — {TESTIMONIAL.detail}</p>
              {/* Avatar pastille */}
              <div className="mt-5 w-12 h-12 rounded-full bg-linear-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center font-bold shadow-xs">{TESTIMONIAL.initials}</div>
            </>
          ) : (
            <>
              {/* Pas encore de vrai avis : statistiques produit à la place */}
              <div className="flex flex-col sm:flex-row gap-8 sm:gap-10">
                {PROMO_STATS.map(s => (
                  <div key={s.label} className="flex flex-col items-center">
                    <span className="font-display text-3xl font-bold text-brand-600">{s.value}</span>
                    <span className="mt-1.5 text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-600 max-w-[110px] leading-relaxed">{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-gray-500">La rotation mémoire et l’optimisation en un clic</p>
            </>
          )}
          <a href="#collection"
            className="mt-6 text-sm font-semibold text-gray-900 underline underline-offset-4 decoration-accent-400 hover:text-brand-600 transition-colors">
            Découvrir les menus
          </a>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Tarifs ─────────────────────────────────────────────────────────────────
// Détail aligné sur STRIPE_PLANS (src/lib/stripe.ts) et les limites réelles du
// code : 4 optimisations / 7 jours en gratuit (limite api/generate-week),
// IMPORTS_GRATUITS_PAR_MOIS imports IA de recettes (api/import-recette), prix
// max par portion (api/budget) et rythme Gourmand réservés Pro. Batch cooking,
// restes et foyer partagé sont inclus pour tous (aucun verrou dans le code).

const PLANS = [
  {
    name: 'Gratuit', price: '0', emoji: '🎁',
    desc: 'Pour découvrir, sans carte bancaire',
    features: [
      '4 optimisations de semaine / 7 jours',
      'Planning déjeuner + dîner complet',
      'Desserts planifiés (rythme équilibré)',
      'Liste de courses automatique, triée par rayon',
      'Budget & dépense de la semaine',
    ],
    cta: 'Commencer gratuitement', highlighted: false,
  },
  {
    name: 'Pro', price: '5,99', emoji: '👨‍🍳',
    desc: 'Pour les foodies exigeants',
    features: [
      'Optimisations illimitées',
      'Rythme desserts Gourmand (5-6 soirs)',
      'Prix max par portion',
      'Imports de recettes illimités',
    ],
    cta: STRIPE_ENABLED ? 'Passer à Pro' : 'Pro bientôt — commencer gratuitement', highlighted: true,
  },
  {
    name: 'Famille', price: '9,99', emoji: '👨‍👩‍👧‍👦',
    desc: 'Pour toute la tribu',
    features: [
      'Tout le plan Pro',
      '5 profils avec allergies & dégoûts',
      'Menus de compromis négociés par le moteur',
    ],
    cta: STRIPE_ENABLED ? 'Passer à Famille' : 'Famille bientôt — commencer gratuitement', highlighted: false,
  },
];

// ─── Comparatif des plans ───────────────────────────────────────────────────
// Chaque ligne reflète une limite VÉRIFIÉE côté code (audit gating 2026-09) :
// optimisations (verifierLimitePlan, api/generate-week), rythme Gourmand
// (dégradation 'equilibre' dans le moteur si plan gratuit), prix max par
// portion (403 si gratuit, api/budget), multi-profils & allergies (famille).
// Desserts équilibrés, batch, tri rayon, macros et recettes personnelles sont
// inclus pour TOUS — ils l'ont toujours été, le comparatif mensonger précédent
// a été corrigé plutôt que d'inventer des gates rétroactifs.

type CelluleComparatif = boolean | string;

const COMPARATIF: { label: string; gratuit: CelluleComparatif; pro: CelluleComparatif; famille: CelluleComparatif }[] = [
  { label: 'Optimisations de semaine', gratuit: '4 / 7 jours', pro: 'Illimitées', famille: 'Illimitées' },
  { label: 'Déjeuners & dîners planifiés', gratuit: true, pro: true, famille: true },
  { label: 'Desserts planifiés (rythme équilibré)', gratuit: true, pro: true, famille: true },
  { label: 'Rythme desserts Gourmand (5-6 soirs)', gratuit: false, pro: true, famille: true },
  { label: 'Batch cooking & restes', gratuit: true, pro: true, famille: true },
  { label: 'Liste de courses automatique', gratuit: true, pro: true, famille: true },
  { label: 'Liste triée par rayon', gratuit: true, pro: true, famille: true },
  { label: 'Budget & dépense de la semaine', gratuit: true, pro: true, famille: true },
  { label: 'Prix max par portion', gratuit: false, pro: true, famille: true },
  { label: 'Macros détaillées (kcal, protéines…)', gratuit: true, pro: true, famille: true },
  { label: 'Imports de recettes (IA)', gratuit: `${IMPORTS_GRATUITS_PAR_MOIS} / mois`, pro: 'Illimités', famille: 'Illimités' },
  { label: 'Frigo anti-gaspi', gratuit: true, pro: true, famille: true },
  { label: 'Profils', gratuit: '1', pro: '1', famille: '5' },
  { label: 'Allergies & dégoûts par membre', gratuit: false, pro: false, famille: true },
  { label: 'Menus de compromis famille', gratuit: false, pro: false, famille: true },
  { label: 'Foyer partagé entre plusieurs comptes', gratuit: true, pro: true, famille: true },
];

function CellulePlan({ value }: { value: CelluleComparatif }) {
  if (value === true)
    return <Check className="w-4 h-4 mx-auto text-brand-500" aria-label="Inclus" />;
  if (value === false)
    return <Minus className="w-4 h-4 mx-auto text-gray-300" aria-label="Non inclus" />;
  return <span className="text-sm font-semibold text-gray-900">{value}</span>;
}

function Comparatif({ onUpgrade, loadingPlan }: { onUpgrade: (plan: 'pro' | 'famille') => void; loadingPlan: 'pro' | 'famille' | null }) {
  const reduceMotion = useReducedMotion();
  const cols: { key: 'gratuit' | 'pro' | 'famille'; name: string; prix: string; cta?: boolean; accent?: boolean }[] = [
    { key: 'gratuit', name: 'Gratuit', prix: '0 €' },
    { key: 'pro', name: 'Pro', prix: '5,99 €/mois', cta: true, accent: true },
    { key: 'famille', name: 'Famille', prix: '9,99 €/mois', cta: true },
  ];

  return (
    <Reveal className="mt-12 max-w-5xl mx-auto">
      <h3 className="font-display text-2xl font-bold text-gray-900 text-center">
        Comparez en un coup d’œil
      </h3>
      <p className="mt-2 text-center text-sm text-gray-500">
        Le détail de chaque plan, ligne par ligne.
      </p>

      {/* Replié par défaut : le tableau (16 lignes) doublait la hauteur de la
          section tarifs, surtout sur mobile. */}
      <details className="group mt-6">
        <summary className="mx-auto w-fit list-none cursor-pointer select-none inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600 transition-colors [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Voir le comparatif détaillé</span>
          <span className="hidden group-open:inline">Masquer le comparatif</span>
          <ArrowRight className="w-4 h-4 rotate-90 group-open:-rotate-90 transition-transform" />
        </summary>
      <div className="mt-6 bg-white rounded-3xl border border-gray-200 shadow-xs overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-5 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
                Fonctionnalité
              </th>
              {cols.map(c => (
                <th key={c.key} className={`px-4 py-4 text-center ${c.accent ? 'bg-brand-50' : ''}`}>
                  <span className="block text-sm font-bold text-gray-900">{c.name}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{c.prix}</span>
                  {/* CTA payant : Famille prend l'accent, Pro le brand (plan mis en avant) */}
                  {/* CTA Famille : fondu APRÈS Pro — l'œil voit d'abord le plan mis en
                      avant, puis l'option montante. whileInView comme Reveal, pour que
                      l'animation joue à l'entrée dans le viewport (et pas avant). */}
                  {c.cta && (
                    <motion.div
                      className="mt-2"
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-80px' }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: c.key === 'famille' ? 0.35 : 0, ease: 'easeOut' }}
                    >
                    {STRIPE_ENABLED ? (
                      <button
                        type="button"
                        onClick={() => onUpgrade(c.key as 'pro' | 'famille')}
                        disabled={loadingPlan !== null}
                        className={`inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-full text-white text-xs font-semibold transition-colors disabled:opacity-60 ${
                          c.accent ? 'bg-brand-500 hover:bg-brand-600' : 'bg-accent-500 hover:bg-accent-600'
                        }`}
                      >
                        {loadingPlan === c.key ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirection…</>
                        ) : (
                          <>Choisir {c.name} <ArrowRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    ) : (
                      // Paiement pas encore ouvert : pas de clic mort, un état honnête.
                      <span className="inline-flex items-center justify-center w-full px-3 py-2 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
                        Bientôt disponible
                      </span>
                    )}
                    </motion.div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARATIF.map(row => (
              <tr key={row.label} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3.5 text-sm text-gray-700">{row.label}</td>
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3.5 text-center ${c.accent ? 'bg-brand-50/50' : ''}`}>
                    <CellulePlan value={row[c.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </details>
    </Reveal>
  );
}

function Pricing() {
  // Colonnes Pro / Famille du comparatif → checkout Stripe direct. Login
  // d'abord si visiteur : le compte doit exister AVANT le paiement pour que
  // le webhook Stripe rattache l'abonnement au bon profil.
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<'pro' | 'famille' | null>(null);

  const handleUpgrade = async (plan: 'pro' | 'famille') => {
    if (!user) {
      router.push('/signup');
      return;
    }
    setLoadingPlan(plan);
    try {
      await redirectToCheckout(plan);
    } catch {
      // Le blocage est louable : on offre une porte de sortie au lieu d'un
      // clic mort.
      toast.error('Paiement momentanément indisponible — réessayez dans un instant.');
      setLoadingPlan(null);
    }
  };

  return (
    <section id="tarifs" className="py-20 sm:py-28 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">Tarifs</span>
          <h2 className="mt-5 font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Simple et{' '}
            <Underlined color="#7C5FBF">transparent.</Underlined>
          </h2>
          <p className="mt-6 text-gray-600 text-lg">
            Commencez gratuitement, évoluez seulement si le produit vous sert au quotidien.
          </p>
        </Reveal>

        {/* Ruban offre : rappel au moment de la décision */}
        <div className="mt-10 flex justify-center">
          <span className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 text-xs font-semibold text-brand-700">
            🎁 Gratuit pour toujours — sans carte bancaire
          </span>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-brand-600 text-white shadow-cta md:-translate-y-2'
                  : 'bg-white border border-gray-200'
              }`}>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-500 text-white text-[11px] font-bold tracking-[0.14em] uppercase px-4 py-1 rounded-full">
                  Le plus populaire
                </div>
              )}

              <div className="text-3xl mb-3">{plan.emoji}</div>
              <h3 className={`font-display text-xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price}€</span>
                <span className={`text-sm ${plan.highlighted ? 'text-white/70' : 'text-gray-500'}`}>/mois</span>
              </div>
              <p className={`text-sm mt-1 ${plan.highlighted ? 'text-white/70' : 'text-gray-500'}`}>{plan.desc}</p>

              <ul className="mt-6 mb-8 space-y-2.5 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2.5 text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-white' : 'text-brand-500'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup"
                className={`block text-center py-3 rounded-full font-semibold text-sm transition-all ${
                  plan.highlighted
                    ? 'bg-white text-brand-700 hover:bg-gray-50'
                    : 'border-2 border-brand-500 text-brand-600 hover:bg-brand-50'
                }`}>
                {plan.cta}
              </Link>
            </Reveal>
          ))}
        </div>

        <Comparatif onUpgrade={handleUpgrade} loadingPlan={loadingPlan} />

        {/* Garanties : résiliation depuis Mon compte, paiement Stripe, FAQ */}
 <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            Sans engagement — annulable à tout moment
          </span>
          <span className="flex items-center gap-2">
            <BadgeEuro className="w-4 h-4 text-brand-500" />
            Paiement sécurisé par Stripe
          </span>
          <span className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-brand-500" />
            FAQ &amp; support à votre écoute
          </span>
        </div>
      </div>
    </section>
  );
}



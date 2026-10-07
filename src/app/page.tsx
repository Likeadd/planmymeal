'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BadgeEuro, Brain, Check, ChefHat, Loader2, Minus,
  Plus, Refrigerator, ShoppingCart, Sparkles, Users, UtensilsCrossed,
  CalendarDays,
} from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { Reveal } from '@/components/Reveal';
import { ChiffresCles } from '@/components/ChiffresCles';
import { ApercuPlanning } from '@/components/ApercuPlanning';
import { FAQ_CATEGORIES } from '@/app/faq/faq-data';
import { useAuth } from '@/components/AuthProvider';
import { redirectToCheckout } from '@/lib/stripe-client';
import { STRIPE_PLANS } from '@/lib/stripe';
import { SITE_URL, serialiserJsonLd } from '@/lib/seo';
import { IMPORTS_GRATUITS_PAR_MOIS, JOURS_VISIBLES_GRATUIT, OPTIMISATIONS_GRATUITES_PAR_SEMAINE, RECHERCHES_FRIGO_GRATUITES_PAR_SEMAINE, REMPLACEMENTS_GRATUITS_PAR_SEMAINE } from '@/lib/limites';

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
        <ChiffresCles />
        <Features />
        <Collection />
        <NouveautesMonde />
        <Promo />
        <Pricing />
        <SectionFinale />
      </main>
      <LandingFooter />
    </div>
  );
}

// ─── Hero scindé avec vague ─────────────────────────────────────────────────

function Hero() {
  const { user, loading } = useAuth();
  const isLoggedIn = !loading && !!user;

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2">
        {/* Côté gauche : texte */}
        <div className="flex items-center px-4 sm:px-12 pt-10 pb-12 sm:py-16 lg:py-24">
          {/* Au-dessus de la ligne de flottaison : animation CSS (joue sans
              JavaScript ni IntersectionObserver). Avec Reveal, le titre H1 était
              servi en opacity:0 et restait invisible tant que le JS n'avait pas
              tourné (aperçus de partage, robots, JS lent). */}
          <div className="max-w-xl animate-hero-in">
            <h1 className="font-display text-[2.35rem] min-[400px]:text-5xl sm:text-6xl font-bold text-gray-900 leading-[1.06]">
              Mangez mieux.
              <br />
              <span className="whitespace-nowrap"><Underlined color="#7C5FBF">Planifiez moins.</Underlined></span>
            </h1>

            <p className="mt-5 sm:mt-6 text-gray-600 text-base sm:text-lg leading-relaxed">
              Chaque semaine, le moteur arbitre votre budget, vos goûts, votre
              temps et votre frigo pour composer des menus sur mesure — et la
              liste de courses arrive toute prête.
            </p>

            <div className="mt-7 sm:mt-9">
              <Link href={isLoggedIn ? '/dashboard' : '/signup'}
                className="group inline-flex items-center gap-2.5 px-8 py-4 bg-brand-500 text-white font-semibold text-sm tracking-[0.12em] uppercase rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                {isLoggedIn ? 'Voir ma semaine' : 'Optimiser ma semaine'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Preuve immédiate sous le CTA : les 3 promesses concrètes du
                produit. La preuve sociale (« Déjà X foyers accompagnés »)
                prendra cette place le jour où le chiffre est réel — jamais
                inventé. */}
            <p className="mt-3 text-xs text-gray-500">
              Inscription gratuite · sans carte bancaire
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              {['Menu personnalisé', 'Liste de courses automatique', 'Adapté à votre budget'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-brand-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
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

          <div className="relative flex items-center justify-center py-10 sm:py-14 lg:py-20 pl-12 sm:pl-20 lg:pl-24 pr-4 sm:pr-10">
            {/* Aperçu de l'écran « Ma semaine » du dashboard */}
            <Reveal className="w-full max-w-[540px]" delay={0.15} y={16}>
              <ApercuPlanning />
            </Reveal>
          </div>
        </div>
      </div>
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
    title: 'Votre semaine en un clic',
    desc: 'Budget, goûts, temps, stock, restes, nutrition, gaspillage : un bouton et le moteur arbitre les sept dimensions de votre semaine — déjeuners, dîners et desserts.',
  },
  {
    icon: Brain, accent: 'text-accent-600 bg-accent-100',
    title: 'Une rotation sur 21 jours',
    desc: 'Vos favoris reviennent, les plats écartés disparaissent, et aucun plat ne se représente avant 21 jours.',
  },
  {
    icon: Refrigerator, accent: 'text-green-700 bg-green-100',
    title: 'Moins de gaspillage',
    desc: 'Déclarez le contenu de votre frigo : les recettes qui l’utilisent passent en tête et ses ingrédients sortent de votre liste de courses.',
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
    title: 'Un budget maîtrisé',
    desc: 'Prix par portion, cap « prix max » et total de la semaine : vos menus respectent votre portefeuille. Calories, protéines et lipides vérifiés sur chaque fiche.',
  },
  {
    icon: Users, accent: 'text-rose-700 bg-rose-100',
    title: 'Toute la famille à table',
    desc: 'Jusqu’à 5 profils, allergies et dégoûts de chacun respectés : le moteur compose une semaine qui convient à tout le monde.',
  },
];

function Features() {
  return (
    <section id="fonctionnalites" className="py-20 sm:py-28 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Tout pour bien manger,{' '}
            <span className="whitespace-nowrap"><Underlined color="#7C5FBF">au même endroit.</Underlined></span>
          </h2>
          <p className="mt-6 text-gray-600 text-lg leading-relaxed">
            Sept critères pris en compte à chaque optimisation :
            budget, goûts, temps, stock, restes, nutrition, gaspillage.
          </p>
        </Reveal>

        {/* Mobile : cartes compactes (icône + titre, description repliée) —
            la grille complète doublait la hauteur de la page sur téléphone. */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 lg:grid-cols-8 gap-3 sm:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.08} y={16}
              className={`group lg:col-span-2 ${i === 4 ? 'lg:col-start-2' : ''} ${i === FEATURES.length - 1 ? 'max-lg:col-span-2' : ''} bg-gray-50 rounded-2xl p-4 sm:p-6 border border-gray-100 hover:border-brand-200 hover:shadow-pop transition-all`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${f.accent} group-hover:scale-105 transition-transform`}>
                <f.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="mt-3 sm:mt-5 font-display text-base sm:text-lg font-bold text-gray-900 leading-snug">{f.title}</h3>
              <p className="hidden sm:block mt-2 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
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
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Des menus qui{' '}
            <Underlined color="#C4552C">vous ressemblent.</Underlined>
          </h2>
          <p className="mt-6 text-gray-600 text-lg leading-relaxed max-w-md">
            Optimisés pour vos goûts, vos allergies, votre rythme et votre
            budget.
          </p>
          <Link href="/recettes"
            className="mt-7 inline-flex items-center min-h-[44px] gap-2 text-sm font-semibold text-brand-600 underline underline-offset-4 decoration-brand-300 hover:text-brand-700 transition-colors">
            Voir les recettes
            <ArrowRight className="w-4 h-4" />
          </Link>
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
                <span className="text-xs font-semibold text-green-700 whitespace-nowrap">{p.prix}</span>
                <span className="text-[11px] tracking-[0.1em] uppercase text-gray-500 whitespace-nowrap">estimé</span>
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
  { flag: 'lb.svg', nom: 'Libanaise', n: 48 },
  { flag: 'gr.svg', nom: 'Grecque', n: 48 },
  { flag: 'vn.svg', nom: 'Vietnamienne', n: 30 },
  { flag: 'es.png', nom: 'Espagnole', n: 30 },
  { flag: 'br.svg', nom: 'Brésilienne', n: 30 },
  { flag: 'kr.svg', nom: 'Coréenne', n: 40 },
  { flag: 'et.svg', nom: 'Éthiopienne', n: 64 },
  { flag: 'jp.svg', nom: 'Japonaise', n: 62 },
];

function NouveautesMonde() {
  return (
    <section id="nouveautes" className="pb-20 sm:pb-28 -mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
                Les cuisines du monde
              </h3>
              <p className="mt-2 text-gray-600">
                Mezzés libanais, pho vietnamien, paella légère, feijoada…
                des recettes healthy écrites étape par étape, avec le budget par portion.
              </p>
            </div>
            <Link href="/recettes"
              className="inline-flex items-center min-h-[44px] gap-2 text-sm font-semibold text-brand-600 underline underline-offset-4 decoration-brand-300 hover:text-brand-700 transition-colors whitespace-nowrap">
              Explorer tout le catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {NOUVEAUTES.map((c) => (
              <Link key={c.nom} href={`/recettes?cuisine=${encodeURIComponent(c.nom)}`}
                title={`Voir les recettes ${c.nom.toLowerCase()}s`}
                className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                <Image src={`/flags/${c.flag}`} alt="" width={28} height={21} unoptimized className="w-7 h-[21px] rounded-[3px] border border-gray-200 object-cover shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{c.nom}</span>
                  <span className="block text-[11px] text-gray-500">{c.n} recettes</span>
                </span>
                <ArrowRight className="hidden sm:block w-4 h-4 ml-auto shrink-0 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
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
  { value: '21 jours', label: 'de rotation' },
  { value: '14 repas', label: 'planifiés' },
  { value: '0 €', label: 'pour commencer' },
];

function Promo() {
  // Un témoignage ne s'affiche que si la citation ET l'auteur sont renseignés
  const hasTestimonial = Boolean(TESTIMONIAL.quote.trim() && TESTIMONIAL.author.trim());
  return (
    <section id="rituels" className="bg-gray-50 pb-14 sm:pb-16">
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 overflow-hidden rounded-3xl shadow-xs">
        {/* Bloc terracotta */}
        <div className="relative bg-brand-600 p-10 sm:p-12">
          <h3 className="font-display text-3xl font-bold text-white leading-snug">
            Cuisinez moins souvent, mangez mieux.
          </h3>
          <Link href="/recettes"
            className="mt-6 inline-flex items-center min-h-[44px] gap-2 text-sm font-semibold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white transition-colors">
            Voir les recettes
            <ArrowRight className="w-4 h-4" />
          </Link>
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
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                {PROMO_STATS.map(s => (
                  <div key={s.label} className="flex flex-col items-center">
                    <span className="font-sans text-2xl font-bold text-brand-600 whitespace-nowrap">{s.value}</span>
                    <span className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-600 leading-snug">{s.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
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
      'Votre semaine composée sur mesure',
      `Aperçu de ${JOURS_VISIBLES_GRATUIT} jours sur 7 et de la liste de courses`,
      `${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} optimisation de semaine / 7 jours`,
      'Catalogue de plus de 6 000 recettes',
      'Inventaire du frigo',
    ],
    cta: 'Commencer gratuitement', highlighted: false,
  },
  {
    name: 'Pro', price: '5,99', emoji: '👨‍🍳',
    desc: 'Votre semaine complète, sans limite',
    features: [...STRIPE_PLANS.pro.features],
    cta: 'Passer à Pro', highlighted: true,
  },
  {
    name: 'Famille', price: '9,99', emoji: '👨‍👩‍👧‍👦',
    desc: 'Pour toute la famille',
    features: [...STRIPE_PLANS.famille.features],
    cta: 'Passer à Famille', highlighted: false,
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
  { label: 'Optimisations de semaine', gratuit: `${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} / 7 jours`, pro: 'Illimitées', famille: 'Illimitées' },
  { label: 'Jours de la semaine accessibles', gratuit: `${JOURS_VISIBLES_GRATUIT} / 7`, pro: '7 / 7', famille: '7 / 7' },
  { label: 'Desserts planifiés (léger à Gourmand)', gratuit: false, pro: true, famille: true },
  { label: 'Changements automatiques de repas', gratuit: `${REMPLACEMENTS_GRATUITS_PAR_SEMAINE} / 7 jours`, pro: 'Illimités', famille: 'Illimités' },
  { label: 'Optimisations Budget, Temps, Anti-gaspi', gratuit: false, pro: true, famille: true },
  { label: 'Semaines planifiées automatiquement', gratuit: false, pro: true, famille: true },
  { label: 'Liste de courses automatique, triée par rayon', gratuit: 'Aperçu', pro: 'Complète', famille: 'Complète' },
  { label: 'Budget & dépense de la semaine', gratuit: true, pro: true, famille: true },
  { label: 'Prix max par portion', gratuit: false, pro: true, famille: true },
  { label: 'Macros détaillées (kcal, protéines…)', gratuit: true, pro: true, famille: true },
  { label: 'Recettes avec mon frigo', gratuit: `${RECHERCHES_FRIGO_GRATUITES_PAR_SEMAINE} / 7 jours`, pro: 'Illimitées', famille: 'Illimitées' },
  { label: 'Imports de recettes (IA)', gratuit: `${IMPORTS_GRATUITS_PAR_MOIS} / mois`, pro: 'Illimités', famille: 'Illimités' },
  { label: 'Profils avec allergies & goûts', gratuit: '1', pro: '1', famille: '5' },
  { label: 'Menus de compromis famille', gratuit: false, pro: false, famille: true },
  { label: 'Foyer partagé entre plusieurs comptes', gratuit: false, pro: false, famille: true },
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
        <summary className="mx-auto w-fit list-none cursor-pointer select-none flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600 transition-colors [&::-webkit-details-marker]:hidden">
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
    <section id="tarifs" className="pt-14 sm:pt-20 pb-20 sm:pb-24 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Simple et{' '}
            <Underlined color="#7C5FBF">transparent.</Underlined>
          </h2>
          <p className="mt-6 text-gray-600 text-lg">
            Commencez gratuitement, passez à un plan payant quand vous le souhaitez.
          </p>
        </Reveal>

        <div className="mt-10 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-brand-600 text-white shadow-cta md:-translate-y-2'
                  : 'bg-white border border-gray-200'
              }`}>
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

              {plan.name === 'Gratuit' ? (
                <Link href="/signup"
                  className="block text-center py-3 rounded-full font-semibold text-sm transition-all border-2 border-brand-500 text-brand-600 hover:bg-brand-50">
                  {plan.cta}
                </Link>
              ) : (
                // Connecté : paiement direct ; visiteur : inscription d'abord (handleUpgrade)
                <button type="button" onClick={() => handleUpgrade(plan.name === 'Pro' ? 'pro' : 'famille')} disabled={loadingPlan !== null}
                  className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-60 ${
                    plan.highlighted
                      ? 'bg-white text-brand-700 hover:bg-gray-50'
                      : 'border-2 border-brand-500 text-brand-600 hover:bg-brand-50'
                  }`}>
                  {loadingPlan === (plan.name === 'Pro' ? 'pro' : 'famille') ? 'Redirection…' : plan.cta}
                </button>
              )}
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

// ─── Section finale : mini-FAQ + dernier appel à l'action ───────────────────
// Questions reprises de la FAQ (une seule source de vérité : faq-data.ts).

const QUESTIONS_FINALES = ['Comment ça marche ?', 'Est-ce vraiment gratuit ?', 'Les recettes sont-elles adaptées à mon régime ?', 'Puis-je annuler à tout moment ?'];
const MINI_FAQ = FAQ_CATEGORIES.flatMap(c => c.items).filter(i => QUESTIONS_FINALES.includes(i.q));

function SectionFinale() {
  const { user, loading } = useAuth();
  const isLoggedIn = !loading && !!user;
  return (
    <section aria-labelledby="finale-titre" className="bg-white border-t border-gray-200 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <Reveal>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">Vos questions</h2>
          <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
            {MINI_FAQ.map(item => (
              <details key={item.q} className="group py-4">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none min-h-[44px] font-semibold text-gray-900">
                  {item.q}
                  <Plus className="w-4 h-4 text-brand-500 shrink-0 transition-transform group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="mt-5 inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-brand-600 hover:text-brand-700">
            Toutes les questions <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </Reveal>

        <Reveal delay={0.1} className="rounded-3xl bg-brand-600 text-white p-8 sm:p-12 text-center lg:sticky lg:top-24">
          <h2 id="finale-titre" className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            Votre semaine de menus, prête en un clic.
          </h2>
          <p className="mt-4 text-white/85 leading-relaxed">
            Répondez à quelques questions : vos menus et votre liste de courses sont composés aussitôt.
          </p>
          <Link href={isLoggedIn ? '/dashboard' : '/signup'}
            className="group mt-8 inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-brand-700 font-semibold text-sm tracking-[0.12em] uppercase rounded-full hover:bg-gray-50 transition-colors">
            {isLoggedIn ? 'Voir ma semaine' : 'Optimiser ma semaine'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
          </Link>
          <p className="mt-4 text-xs text-white/75">Inscription gratuite · sans carte bancaire</p>
        </Reveal>
      </div>
    </section>
  );
}

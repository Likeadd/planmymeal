'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, Plus } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main>
        <FaqHero />
        <FaqContent />
        <FaqCta />
      </main>
      <LandingFooter />
    </div>
  );
}

// ─── Hero FAQ ───────────────────────────────────────────────────────────────

function FaqHero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-200">
      {/* Bulles décoratives */}
      <div className="absolute -top-6 right-10 flex items-center gap-1.5 opacity-60" aria-hidden>
        <span className="w-2 h-2 rounded-full bg-accent-400" />
        <span className="w-3.5 h-3.5 rounded-full bg-accent-300" />
        <span className="w-2 h-2 rounded-full bg-accent-400" />
      </div>
      <div className="absolute bottom-8 left-8 w-24 h-24 rounded-full bg-brand-100/70" aria-hidden />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-600 mb-5">
          Foire aux questions
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
          Des questions ?{' '}
          <Underlined color="#7C5FBF">Des réponses.</Underlined>
        </h1>
        <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Tout ce qu&apos;il faut savoir sur PlanMyMeal : la génération de menus,
          les abonnements, la liste de courses et vos données.
        </p>
      </div>
    </section>
  );
}

// ─── Contenu FAQ (accordéons) ───────────────────────────────────────────────

type FaqItem = { q: string; a: string };
type FaqCategory = { label: string; items: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: 'Prise en main',
    items: [
      {
        q: 'C’est quoi, PlanMyMeal ?',
        a: 'PlanMyMeal est votre assistant de planification de repas : il génère vos menus de la semaine, votre liste de courses et des idées de batch cooking, en s’adaptant à vos goûts, votre régime et votre niveau en cuisine.',
      },
      {
        q: 'Comment ça marche ?',
        a: 'En 3 étapes : 1) vous renseignez vos préférences (goûts, régimes, objectif, niveau de cuisine), 2) l’IA génère votre semaine complète de déjeuners et dîners, 3) vous récupérez la liste de courses triée par rayon et les fiches recettes.',
      },
      {
        q: 'La première semaine est-elle vraiment offerte ?',
        a: 'Oui. Votre première semaine est offerte, sans carte bancaire. Vous pouvez tester la génération, la liste de courses et le batch cooking avant de choisir un plan.',
      },
      {
        q: 'Sur quels appareils puis-je utiliser PlanMyMeal ?',
        a: 'PlanMyMeal est accessible depuis n’importe quel navigateur, sur ordinateur, tablette et mobile. Votre planning et vos favoris se synchronisent automatiquement.',
      },
    ],
  },
  {
    label: 'Génération & contenu',
    items: [
      {
        q: 'Comment l’IA choisit mes repas ?',
        a: 'Elle s’appuie sur votre profil : mémoire des goûts (vos favoris et les plats que vous avez aimés), régime alimentaire, objectif, niveau de cuisine et préférence pour le batch cooking.',
      },
      {
        q: 'Puis-je régénérer ma semaine ?',
        a: 'Oui, autant de fois que vous le souhaitez. Le bouton « Régénérer » propose une nouvelle combinaison de repas qui respecte toujours votre profil.',
      },
      {
        q: 'À quoi servent les favoris ?',
        a: 'Cliquez sur l’étoile d’une carte repas pour l’ajouter à vos favoris : l’IA la réutilisera plus volontiers et vous pourrez la retrouver sur la page Favoris.',
      },
      {
        q: 'C’est quoi le batch cooking ?',
        a: 'Cuisiner en lot : préparer plusieurs repas en une seule session pour gagner du temps. PlanMyMeal propose des journées « batch » qui partagent des ingrédients et des préparations.',
      },
      {
        q: 'Les recettes sont-elles adaptées à mon régime ?',
        a: 'Oui : végétarien, vegan, sans gluten, sans lactose, hyperprotéiné… Indiquez vos régimes pendant l’inscription et l’IA les respectera dans toutes vos semaines.',
      },
    ],
  },
  {
    label: 'Abonnement & tarifs',
    items: [
      {
        q: 'Quels sont les plans disponibles ?',
        a: 'Trois plans : Gratuit (une semaine de menus), Pro (semaines illimitées, IA avancée, mémoire des goûts complète) et Famille (plusieurs profils et menus adaptés à toute la maisonnée).',
      },
      {
        q: 'Puis-je annuler à tout moment ?',
        a: 'Oui, directement depuis la page Compte, en un clic et sans frais. Vous conservez l’accès jusqu’à la fin de votre période déjà payée.',
      },
      {
        q: 'Quels moyens de paiement acceptez-vous ?',
        a: 'Les cartes bancaires via Stripe, notre partenaire de paiement sécurisé. Aucun numéro de carte n’est stocké sur nos serveurs.',
      },
      {
        q: 'Comment passer à un plan supérieur ?',
        a: 'Depuis la page Compte, choisissez le plan Pro ou Famille : la redirection vers le paiement sécurisé se fait automatiquement.',
      },
    ],
  },
  {
    label: 'Compte & données',
    items: [
      {
        q: 'Je n’arrive pas à me connecter.',
        a: 'Vérifiez d’abord que votre adresse email est confirmée (lien reçu à l’inscription). Si vous avez oublié votre mot de passe, utilisez le lien « Mot de passe oublié » sur la page de connexion.',
      },
      {
        q: 'Mes données sont-elles protégées ?',
        a: 'Oui. Vos données sont hébergées sur une infrastructure sécurisée (Supabase), chiffrées en transit, et ne sont jamais revendues à des tiers.',
      },
      {
        q: 'Comment supprimer mon compte et mes données ?',
        a: 'Écrivez-nous depuis la page Compte ou par email : nous supprimons votre compte, vos plannings et vos données personnelles sous 7 jours.',
      },
    ],
  },
];

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`bg-white rounded-2xl border transition-all ${
              isOpen ? 'border-brand-300 shadow-pop' : 'border-gray-200'
            }`}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4">
              <span className="font-medium text-gray-900 text-sm sm:text-base leading-snug">
                {item.q}
              </span>
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isOpen ? 'bg-brand-500 text-white rotate-45' : 'bg-gray-100 text-gray-700'
                }`}>
                <Plus className="w-4 h-4" />
              </span>
            </button>
            {isOpen && (
              <div className="px-5 sm:px-6 pb-5 -mt-1">
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FaqContent() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 space-y-12">
      {FAQ_CATEGORIES.map(cat => (
        <div key={cat.label}>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-2 h-2 rounded-full bg-brand-500" aria-hidden />
            <h2 className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-800">
              {cat.label}
            </h2>
          </div>
          <FaqAccordion items={cat.items} />
        </div>
      ))}
    </section>
  );
}

// ─── CTA final ──────────────────────────────────────────────────────────────

function FaqCta() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20">
      <div className="max-w-3xl mx-auto bg-brand-600 rounded-3xl px-6 sm:px-12 py-12 text-center relative overflow-hidden">
        <div className="absolute -top-8 right-6 flex items-center gap-1.5 opacity-40" aria-hidden>
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="w-3.5 h-3.5 rounded-full bg-white/80" />
          <span className="w-2 h-2 rounded-full bg-white" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white text-balance">
          Vous ne trouvez pas votre réponse ?
        </h2>
        <p className="mt-3 text-white/80 text-sm sm:text-base max-w-md mx-auto">
          Notre équipe répond rapidement, avec plaisir.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="mailto:contact@getplanmymeal.com"
            className="inline-flex items-center gap-2 px-7 py-3 bg-white text-brand-700 font-semibold text-sm rounded-full hover:bg-gray-50 transition-colors shadow-sm">
            <Mail className="w-4 h-4" /> Nous écrire
          </a>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3 border-2 border-white/60 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-colors">
            Essayer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}



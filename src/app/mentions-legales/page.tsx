import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'Éditeur du site',
    body: (
      <>
        <p>
          Le site <strong>getplanmymeal.com</strong> est édité par <strong>PlanMyMeal</strong>,
          exploité à titre individuel (immatriculation en cours) :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Numéro SIRET : en cours d’attribution — publié ici dès son obtention.</li>
          <li>Directeur de la publication : [Nom complet à compléter]</li>
          <li>Contact : <a href="mailto:contact@getplanmymeal.com" className="text-brand-600 underline underline-offset-2 decoration-brand-300 hover:text-brand-700">contact@getplanmymeal.com</a></li>
        </ul>
      </>
    ),
  },
  {
    title: 'Hébergement',
    body: (
      <>
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong> (
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2 decoration-brand-300 hover:text-brand-700">vercel.com</a>
          ).
        </p>
        <p>
          Les données applicatives sont stockées sur une infrastructure sécurisée
          (Supabase), située dans l’Union européenne.
        </p>
      </>
    ),
  },
  {
    title: 'Propriété intellectuelle',
    body: (
      <>
        <p>
          L’ensemble des contenus présents sur le site (textes, logo, marque
          « PlanMyMeal », interface, illustrations) est protégé par le droit de
          la propriété intellectuelle. Toute reproduction, représentation ou
          exploitation, totale ou partielle, sans autorisation écrite préalable
          de l’éditeur est interdite.
        </p>
        <p>
          Les recettes publiées (titres, listes d’ingrédients, étapes,
          descriptions) sont des créations originales de PlanMyMeal, rédigées ou
          composées par l’éditeur : aucun texte n’est repris d’un autre site ni
          d’un ouvrage. Les noms de plats traditionnels sont d’usage courant.
          Toute photographie affichée est libre de droits ou sous licence, avec
          mention de son auteur.
        </p>
      </>
    ),
  },
  {
    title: 'Données personnelles',
    body: (
      <>
        <p>
          Conformément au Règlement Général sur la Protection des Données
          (RGPD), vous disposez d’un droit d’accès, de rectification, de
          portabilité et de suppression de vos données personnelles, ainsi que
          d’un droit d’opposition et de limitation du traitement.
        </p>
        <p>
          Vos données sont utilisées uniquement pour le fonctionnement du
          service : création de compte, génération de menus personnalisés et
          gestion de l’abonnement. Elles ne sont jamais revendues à des tiers.
        </p>
        <p>
          Pour exercer vos droits, écrivez-nous à{' '}
          <a href="mailto:contact@getplanmymeal.com" className="text-brand-600 underline underline-offset-2 decoration-brand-300 hover:text-brand-700">contact@getplanmymeal.com</a>.
        </p>
      </>
    ),
  },
  {
    title: 'Cookies',
    body: (
      <>
        <p>
          Le site utilise uniquement des cookies techniques nécessaires au
          fonctionnement du service (session de connexion, préférences).
        </p>
        <p>
          La mesure d’audience est assurée par <strong>Plausible</strong>, un
          outil respectueux de la vie privée qui ne dépose aucun cookie et ne
          collecte aucune donnée personnelle — aucun consentement n’est donc
          requis pour son utilisation. Aucun cookie publicitaire ou de suivi
          n’est déposé.
        </p>
      </>
    ),
  },
  {
    title: 'Responsabilité',
    body: (
      <>
        <p>
          Les menus composés automatiquement par notre moteur de planification et les recettes sont
          fournis à titre indicatif. Il vous appartient de vérifier la présence
          d’allergènes et de respecter les règles d’hygiène alimentaire. L’éditeur
          ne saurait être tenu responsable d’un usage inapproprié des contenus.
        </p>
      </>
    ),
  },
  {
    title: 'Droit applicable',
    body: (
      <>
        <p>
          Les présentes mentions sont soumises au droit français. En cas de
          litige, et à défaut de résolution amiable, les tribunaux français
          compétents seront saisis.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales de PlanMyMeal : éditeur du site, hébergeur, propriété intellectuelle et contact.',
  alternates: { canonical: '/mentions-legales' },
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-gray-200">
          <div className="absolute -top-6 right-10 flex items-center gap-1.5 opacity-60" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            <span className="w-3.5 h-3.5 rounded-full bg-accent-300" />
            <span className="w-2 h-2 rounded-full bg-accent-400" />
          </div>
          {/* Décorative uniquement : sur un hero mobile court, elle finit
              derrière le texte au lieu de rester dans un coin vide. */}

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
              Mentions{' '}
              <Underlined color="#7C5FBF">légales.</Underlined>
            </h1>
            <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Éditeur, hébergement, données personnelles : tout ce qu’il faut
              savoir en toute transparence.
            </p>
          </div>
        </section>

        {/* Contenu */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="space-y-10">
            {SECTIONS.map(section => (
              <div key={section.title}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2 h-2 rounded-full bg-brand-500" aria-hidden />
                  <h2 className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-800">
                    {section.title}
                  </h2>
                </div>
                <div className="pl-5 space-y-3 text-gray-600 text-sm leading-relaxed">
                  {section.body}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 text-xs text-gray-500">
            {/* Date FIGÉE : une page légale annonce la date de dernière
                modification du texte, pas « aujourd'hui ». `new Date()` au
                rendu affichait la date du build côté serveur et celle de la
                visite côté client → mismatch (et date trompeuse). */}
            Dernière mise à jour : 12 octobre 2026.
          </p>

          <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm">
              Une question sur vos données ? Consultez la{' '}
              <Link href="/faq" className="text-brand-600 font-medium underline underline-offset-2 decoration-brand-300 hover:text-brand-700">
                FAQ
              </Link>{' '}
              ou{' '}
              <Link href="/contact" className="text-brand-600 font-medium underline underline-offset-2 decoration-brand-300 hover:text-brand-700">
                contactez-nous
              </Link>.
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'Objet',
    body: (
      <p>
        Les présentes conditions générales de vente (CGV) régissent l’utilisation
        du service d’abonnement PlanMyMeal accessible sur{' '}
        <strong>getplanmymeal.com</strong> : génération de menus personnalisés,
        liste de courses et fonctionnalités associées. Toute souscription
        implique l’acceptation pleine et entière des présentes conditions.
      </p>
    ),
  },
  {
    title: 'Services proposés',
    body: (
      <>
        <p>Trois formules d’abonnement sont proposées :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Gratuit</strong> : une semaine de menus par mois, accès découverte.</li>
          <li><strong>Pro</strong> : génération illimitée, mémoire des goûts, batch cooking, liste triée par rayon.</li>
          <li><strong>Famille</strong> : toutes les fonctionnalités Pro, jusqu’à 5 profils familiaux et allergies par personne.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Prix',
    body: (
      <>
        <p>Les prix sont indiqués en euros, toutes taxes comprises :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Gratuit</strong> : 0 € / mois</li>
          <li><strong>Pro</strong> : 5,99 € / mois</li>
          <li><strong>Famille</strong> : 9,99 € / mois</li>
        </ul>
        <p>
          La première semaine de génération est offerte, sans carte bancaire,
          afin de tester le service avant de souscrire.
        </p>
      </>
    ),
  },
  {
    title: 'Souscription et renouvellement',
    body: (
      <p>
        L’abonnement est souscrit en ligne, depuis la page Compte. Il est conclu
        pour une durée d’un mois et se renouvelle par tacite reconduction,
        sauf résiliation par le client avant la date d’échéance. Le client peut
        résilier à tout moment, directement depuis son espace, sans frais.
      </p>
    ),
  },
  {
    title: 'Paiement',
    body: (
      <p>
        Le paiement est effectué par carte bancaire via le prestataire de
        paiement sécurisé Stripe. Aucune donnée bancaire n’est stockée sur nos
        serveurs. La facturation est mensuelle et le prélèvement intervient à
        chaque échéance tant que l’abonnement n’est pas résilié.
      </p>
    ),
  },
  {
    title: 'Droit de rétractation',
    body: (
      <p>
        Conformément à l’article L221-28 du Code de la consommation, le droit de
        rétractation de 14 jours ne s’applique pas aux contenus numériques dont
        l’exécution a commencé avec l’accord du consommateur. En souscrivant,
        vous acceptez que le service soit fourni immédiatement.
      </p>
    ),
  },
  {
    title: 'Résiliation',
    body: (
      <p>
        La résiliation est effective à la fin de la période d’abonnement en
        cours, sans frais supplémentaires. En cas de non-paiement, l’accès au
        service peut être suspendu jusqu’à régularisation.
      </p>
    ),
  },
  {
    title: 'Responsabilité',
    body: (
      <p>
        Les menus générés le sont par intelligence artificielle et restent
        fournis à titre indicatif. Il appartient à l’utilisateur de vérifier les
        allergènes et de respecter les règles de sécurité alimentaire. L’éditeur
        ne saurait être tenu responsable d’un dommage résultant d’un usage des
        contenus.
      </p>
    ),
  },
  {
    title: 'Droit applicable et litiges',
    body: (
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige, une
        résolution amiable sera recherchée en priorité. Le consommateur peut
        également recourir à une procédure de médiation conventionnelle.
      </p>
    ),
  },
];

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description: 'Conditions générales de vente et d’abonnement de PlanMyMeal : offres, prix, paiement, rétractation, résiliation et responsabilité.',
  alternates: { canonical: '/cgv' },
};

export default function CgvPage() {
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
          <div className="hidden lg:block absolute bottom-8 left-8 w-24 h-24 rounded-full bg-brand-100/70" aria-hidden />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
              Nos{' '}
              <Underlined color="#C4552C">CGV.</Underlined>
            </h1>
            <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Abonnements, prix, résiliation : les règles du jeu, claires et
              sans jargon.
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
            Dernière mise à jour : 15 septembre 2026.
          </p>

          <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm">
              Une question sur votre abonnement ? Consultez la{' '}
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

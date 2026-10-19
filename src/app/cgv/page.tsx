import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { DELAI_RETRACTATION_JOURS, EDITEUR, EMAIL_CONTACT, MAJ_LEGALE, MEDIATEUR, mediateurConfigure } from '@/lib/legal';

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
        Le vendeur est <strong>{EDITEUR.nom}</strong>, {EDITEUR.adresse}
        {EDITEUR.siret && <> (SIRET {EDITEUR.siret})</>}, joignable à{' '}
        <a href={`mailto:${EMAIL_CONTACT}`} className="text-brand-600 underline underline-offset-2">{EMAIL_CONTACT}</a>.
        L’usage du service est également régi par les{' '}
        <Link href="/cgu" className="text-brand-600 underline underline-offset-2">conditions d’utilisation</Link>.
      </p>
    ),
  },
  {
    title: 'Services proposés',
    body: (
      <>
        <p>Trois formules d’abonnement sont proposées :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Gratuit</strong> : une optimisation de semaine tous les 7 jours, aperçu de 2 jours sur 7.</li>
          <li><strong>Pro</strong> : semaine complète et liste de courses complète, optimisations illimitées, desserts planifiés, changements de repas illimités, optimisations ciblées (budget, gain de temps, anti-gaspi), semaines planifiées automatiquement.</li>
          <li><strong>Famille</strong> : toutes les fonctionnalités Pro, jusqu’à 5 profils avec les allergies et les goûts de chacun, foyer partagé entre plusieurs comptes.</li>
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
          <li><strong>Pro</strong> : 5,99 € / mois ou 49,99 € / an</li>
          <li><strong>Famille</strong> : 9,99 € / mois ou 79,99 € / an</li>
        </ul>
        <p>
          La formule annuelle est facturée en une seule fois pour douze mois
          d’accès, soit une remise d’environ 30 % par rapport au paiement mensuel.
        </p>
        <p>
          Le plan Gratuit s’utilise sans carte bancaire et sans limite de durée,
          afin de découvrir le service avant de souscrire.
        </p>
      </>
    ),
  },
  {
    title: 'Souscription et renouvellement',
    body: (
      <p>
        L’abonnement est souscrit en ligne, depuis la page Compte. Il est conclu
        pour une durée d’un mois (formule mensuelle) ou d’un an (formule annuelle)
        et se renouvelle par tacite reconduction pour une durée identique, sauf
        résiliation par le client avant la date d’échéance. Le client peut
        résilier à tout moment, directement depuis son espace, sans frais ;
        l’accès reste alors ouvert jusqu’à la fin de la période déjà payée.
        Les sommes déjà versées pour la période en cours ne sont pas remboursées,
        sauf obligation légale.
      </p>
    ),
  },
  {
    title: 'Paiement',
    body: (
      <p>
        Le paiement est effectué par carte bancaire via le prestataire de
        paiement sécurisé Stripe. Aucune donnée bancaire n’est stockée sur nos
        serveurs. La facturation est mensuelle ou annuelle selon la formule choisie
        et le prélèvement intervient à chaque échéance tant que l’abonnement
        n’est pas résilié.
      </p>
    ),
  },
  {
    title: 'Droit de rétractation',
    body: (
      <>
        <p>
          Conformément aux articles L221-18 et suivants du Code de la consommation,
          le client consommateur dispose de <strong>{DELAI_RETRACTATION_JOURS} jours</strong> à compter de la
          souscription de l’abonnement pour exercer son droit de rétractation,
          sans avoir à justifier de motif ni à supporter de pénalités.
        </p>
        <p>
          En souscrivant, le client demande que le service commence immédiatement. Lors de sa{' '}
          <strong>première</strong> rétractation, PlanMyMeal le rembourse néanmoins <strong>intégralement</strong>, même
          si le service a été utilisé pendant ce délai. En cas de rétractation sur un abonnement souscrit ensuite, le
          remboursement est calculé au prorata de la période non utilisée (article L221-25 du Code de la consommation).
        </p>
        <p>Pour l’exercer, le client peut au choix :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            cliquer sur « Me rétracter et être remboursé » depuis{' '}
            <Link href="/compte#abonnement" className="text-brand-600 underline underline-offset-2">Compte, rubrique Mon abonnement</Link>{' '}
            (effet immédiat) ;
          </li>
          <li>
            ou adresser une demande dépourvue d’ambiguïté à{' '}
            <a href={`mailto:${EMAIL_CONTACT}`} className="text-brand-600 underline underline-offset-2">{EMAIL_CONTACT}</a>,
            par exemple avec le modèle de formulaire ci-dessous, également disponible sur la page{' '}
            <Link href="/retractation" className="text-brand-600 underline underline-offset-2">Rétractation et remboursement</Link>.
          </li>
        </ul>
        <p>
          L’abonnement prend fin dès l’exercice du droit et le remboursement de la
          totalité des sommes versées intervient au plus tard {DELAI_RETRACTATION_JOURS} jours après la
          rétractation, sur le moyen de paiement utilisé lors de la souscription.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p className="font-semibold mb-1">Modèle de formulaire de rétractation</p>
          <p>
            À l’attention de PlanMyMeal ({EMAIL_CONTACT}) : je vous notifie par la présente ma rétractation
            du contrat portant sur la fourniture de l’abonnement PlanMyMeal souscrit le [date].
            Nom du client : [nom] — Adresse email du compte : [email] — Date : [date].
          </p>
        </div>
      </>
    ),
  },
  {
    title: 'Résiliation',
    body: (
      <>
        <p>
          Le client peut résilier son abonnement <strong>à tout moment, en un clic</strong>, sans motif et sans
          frais, depuis{' '}
          <Link href="/compte#abonnement" className="text-brand-600 underline underline-offset-2">Compte, rubrique Mon abonnement</Link>{' '}
          ou depuis la page{' '}
          <Link href="/resiliation" className="text-brand-600 underline underline-offset-2">Résilier mon abonnement</Link>{' '}
          (lien disponible dans le pied de page de chaque page du site). Une confirmation lui est
          envoyée par email.
        </p>
        <p>
          La résiliation prend effet à la fin de la période d’abonnement en cours (mois ou année
          déjà payé) : le client conserve l’accès au service jusqu’à cette date et aucun nouveau
          prélèvement n’est effectué. Elle peut être annulée avant cette date depuis la même page.
          Hors exercice du droit de rétractation, la période déjà payée n’est pas remboursée.
        </p>
        <p>
          En cas de non-paiement, l’accès au service peut être suspendu jusqu’à régularisation.
        </p>
      </>
    ),
  },
  {
    title: 'Responsabilité',
    body: (
      <p>
        Les menus sont composés automatiquement par notre moteur de planification et restent
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
        Les présentes CGV sont soumises au droit français. En cas de litige, le client est invité
        à adresser d’abord une réclamation écrite à{' '}
        <a href={`mailto:${EMAIL_CONTACT}`} className="text-brand-600 underline underline-offset-2">{EMAIL_CONTACT}</a> :
        une résolution amiable est recherchée en priorité.
      </p>
    ),
  },
  ...(mediateurConfigure ? [{
    title: 'Médiation de la consommation',
    body: (
      <>
        <p>
          Conformément aux articles L611-1 et suivants du Code de la consommation, le client
          consommateur peut recourir gratuitement au médiateur de la consommation dont relève
          PlanMyMeal, après une réclamation écrite restée sans réponse satisfaisante sous un mois :
        </p>
        <p>
          <strong>{MEDIATEUR.nom}</strong>
          {MEDIATEUR.adresse && <> — {MEDIATEUR.adresse}</>}
          {' — '}
          <a href={MEDIATEUR.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2">{MEDIATEUR.url}</a>
        </p>
      </>
    ),
  }] : []),
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
      <main id="contenu">
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
            Dernière mise à jour : {MAJ_LEGALE}.
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

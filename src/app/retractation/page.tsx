import type { Metadata } from 'next';
import Link from 'next/link';
import { PageLegale, lienTexte, type SectionLegale } from '@/components/PageLegale';
import { DELAI_RETRACTATION_JOURS, EDITEUR, EMAIL_CONTACT, MAJ_LEGALE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Rétractation et remboursement',
  description:
    'Vous avez 14 jours pour vous rétracter après avoir souscrit un abonnement PlanMyMeal et être remboursé intégralement. Bouton en un clic, modèle de formulaire et délais de remboursement.',
  alternates: { canonical: '/retractation' },
};

const mail = <a href={`mailto:${EMAIL_CONTACT}`} className={lienTexte}>{EMAIL_CONTACT}</a>;

const CORPS_EMAIL = [
  `À l’attention de ${EDITEUR.nom} (${EMAIL_CONTACT}) :`,
  '',
  'Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services suivante : abonnement PlanMyMeal.',
  '',
  'Souscrit le : [date de souscription]',
  'Nom du consommateur : [votre nom]',
  'Adresse email du compte : [votre adresse email]',
  '',
  'Date : [date du jour]',
].join('\n');
const LIEN_MAILTO = `mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent('Rétractation de mon abonnement PlanMyMeal')}&body=${encodeURIComponent(CORPS_EMAIL)}`;

const SECTIONS: SectionLegale[] = [
  {
    title: 'Votre droit en bref',
    body: (
      <>
        <p>
          Vous avez <strong>{DELAI_RETRACTATION_JOURS} jours</strong> à compter de la souscription d’un abonnement payant pour vous rétracter,
          sans donner de motif et sans pénalité (articles L221-18 et suivants du Code de la consommation).
        </p>
        <p>
          <strong>Chez PlanMyMeal, vous êtes remboursé intégralement</strong>, même si vous avez déjà utilisé le service pendant ce délai. Aucune
          retenue n’est appliquée. Le plan Gratuit n’est pas payant : il n’y a rien à rétracter, vous pouvez simplement supprimer votre compte.
        </p>
      </>
    ),
  },
  {
    title: 'Se rétracter en un clic',
    body: (
      <>
        <p>
          Connectez-vous, puis ouvrez <Link href="/compte#abonnement" className={lienTexte}>Mon compte → Mon abonnement</Link> et cliquez sur{' '}
          <strong>« Me rétracter et être remboursé »</strong>. L’abonnement s’arrête immédiatement et le remboursement est lancé automatiquement.
          Vous recevez une confirmation par email.
        </p>
        <p>
          Vous ne pouvez pas vous connecter ? Utilisez la méthode suivante.
        </p>
      </>
    ),
  },
  {
    title: 'Se rétracter par email : modèle de formulaire',
    body: (
      <>
        <p>
          Envoyez-nous une déclaration dépourvue d’ambiguïté à {mail}. Vous pouvez utiliser le modèle ci-dessous (son usage n’est pas obligatoire) :
        </p>
        <blockquote className="rounded-xl border border-gray-200 bg-white p-4 text-[13px] text-gray-800 whitespace-pre-line">
          {CORPS_EMAIL}
        </blockquote>
        <p>
          <a href={LIEN_MAILTO} className="inline-flex items-center min-h-[44px] px-5 rounded-full bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors">
            Ouvrir ce modèle dans ma messagerie
          </a>
        </p>
        <p>
          Le délai est respecté dès que votre message est envoyé avant la fin des {DELAI_RETRACTATION_JOURS} jours. Nous accusons réception de votre
          rétractation par email.
        </p>
      </>
    ),
  },
  {
    title: 'Remboursement : délais et moyen de paiement',
    body: (
      <ul>
        <li>Remboursement de <strong>la totalité des sommes versées</strong> pour cet abonnement, sans frais.</li>
        <li>Effectué au plus tard <strong>{DELAI_RETRACTATION_JOURS} jours</strong> après réception de votre rétractation, sur le <strong>moyen de paiement utilisé</strong> à la souscription. Selon votre banque, il apparaît sur votre relevé sous quelques jours ouvrés supplémentaires.</li>
        <li>L’accès payant prend fin à la rétractation et aucun nouveau prélèvement n’est effectué.</li>
      </ul>
    ),
  },
  {
    title: 'Après les 14 jours : résiliation et autres remboursements',
    body: (
      <>
        <ul>
          <li>Vous pouvez <Link href="/resiliation" className={lienTexte}>résilier à tout moment, en un clic</Link>. L’accès reste ouvert jusqu’à la fin de la période déjà payée (mois ou année) et il n’y a plus de prélèvement ensuite.</li>
          <li>Hors rétractation, la période en cours n’est pas remboursée, sauf obligation légale. Nous remboursons en revanche tout prélèvement indu ou en double : écrivez-nous à {mail}.</li>
          <li>Vous bénéficiez de la garantie légale de conformité des contenus et services numériques (articles L224-25-1 et suivants du Code de la consommation) : en cas de défaut de conformité du service, contactez-nous.</li>
        </ul>
        <p>
          Un litige ? Voir les <Link href="/cgv" className={lienTexte}>CGV</Link> (réclamation, médiation de la consommation).
        </p>
      </>
    ),
  },
];

export default function RetractationPage() {
  return (
    <PageLegale
      titre="Rétractation et"
      motSouligne="remboursement."
      accroche="14 jours pour changer d’avis, remboursement intégral, en un clic ou par email."
      sections={SECTIONS}
      majLe={MAJ_LEGALE}
    />
  );
}

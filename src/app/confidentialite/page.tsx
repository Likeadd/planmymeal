import type { Metadata } from 'next';
import Link from 'next/link';
import { PageLegale, lienTexte, type SectionLegale } from '@/components/PageLegale';
import { EDITEUR, EMAIL_CONTACT, MAJ_LEGALE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Quelles données PlanMyMeal collecte, pourquoi, combien de temps, avec qui elles sont partagées et comment exercer vos droits RGPD (accès, effacement, portabilité).',
  alternates: { canonical: '/confidentialite' },
};

const mail = <a href={`mailto:${EMAIL_CONTACT}`} className={lienTexte}>{EMAIL_CONTACT}</a>;

const SECTIONS: SectionLegale[] = [
  {
    title: 'Qui est responsable de vos données ?',
    body: (
      <>
        <p>
          Le responsable du traitement est l’éditeur du site <strong>getplanmymeal.com</strong> :{' '}
          <strong>{EDITEUR.nom}</strong>, {EDITEUR.adresse}
          {EDITEUR.siret && <> (SIRET {EDITEUR.siret})</>}. Contact pour toute question sur vos données : {mail}.
        </p>
        <p>
          Cette politique s’applique au site, à l’application web et aux emails PlanMyMeal. Nous appliquons le
          règlement général sur la protection des données (RGPD) et la loi « Informatique et Libertés ».
        </p>
      </>
    ),
  },
  {
    title: 'Quelles données collectons-nous ?',
    body: (
      <>
        <p>Nous ne collectons que ce qui est nécessaire pour composer vos menus et gérer votre compte.</p>
        <ul>
          <li><strong>Compte :</strong> adresse email, prénom, mot de passe (stocké uniquement sous forme chiffrée, jamais lisible par nous), date d’acceptation des conditions d’utilisation. Si vous utilisez « Continuer avec Google » : nom et adresse email transmis par Google.</li>
          <li><strong>Préférences de planification :</strong> nombre de personnes, objectif, budget, temps de cuisine, équipements, cuisines préférées, aliments détestés, régimes.</li>
          <li><strong>Allergies et intolérances</strong> (facultatif) : elles servent uniquement à exclure certains aliments de vos recettes. Ce sont des données de santé au sens du RGPD (voir section 3).</li>
          <li><strong>Âge, sexe, taille et poids</strong> (facultatif) : utilisés uniquement pour estimer vos besoins en calories. Ce sont aussi des données de santé potentielles. Vous pouvez ne rien renseigner : le service fonctionne avec des valeurs de référence.</li>
          <li><strong>Foyer :</strong> prénoms, âges et poids facultatifs des personnes que vous ajoutez (profils famille). Ne les ajoutez qu’avec l’accord des personnes concernées ou, pour un enfant, en tant que parent.</li>
          <li><strong>Usage du service :</strong> plannings, recettes aimées ou écartées, historique de repas, contenu du frigo, listes de courses, prix personnalisés, budgets, recettes que vous importez ou demandez.</li>
          <li><strong>Abonnement :</strong> formule, identifiants client et abonnement Stripe, dates. Votre numéro de carte est saisi chez Stripe : nous ne le voyons jamais.</li>
          <li><strong>Newsletter (sans compte) :</strong> votre adresse email, après confirmation de votre part.</li>
          <li><strong>Messages envoyés via le formulaire de contact :</strong> nom, email et contenu du message.</li>
          <li><strong>Données techniques de sécurité :</strong> adresse IP, type de requête et page concernée, uniquement lors d’événements de sécurité (trop de tentatives, robot détecté). Des compteurs anti-abus associés à l’adresse IP sont effacés sous 24 heures.</li>
          <li><strong>Mesure d’audience :</strong> statistiques anonymes (pages vues, source de la visite, pays) — voir section 7.</li>
        </ul>
        <p>
          <strong>Nous ne faisons pas de publicité ciblée, ne vendons aucune donnée et n’utilisons aucun traceur publicitaire.</strong>{' '}
          Aucune décision produisant des effets juridiques n’est prise de manière automatisée : l’algorithme de menus ne fait que
          proposer des repas que vous restez libre de modifier.
        </p>
      </>
    ),
  },
  {
    title: 'Pourquoi traitons-nous vos données ? (bases légales)',
    body: (
      <>
        <ul>
          <li><strong>Exécution du contrat</strong> (art. 6.1.b RGPD) : créer votre compte, composer vos menus et listes de courses, gérer votre abonnement, vous envoyer les emails liés à votre compte (confirmation, abonnement, résiliation).</li>
          <li><strong>Consentement explicite</strong> (art. 6.1.a et 9.2.a) : pour vos <strong>allergies, intolérances, âge, sexe, taille et poids</strong>, qui peuvent révéler des informations de santé. Vous les saisissez volontairement après une information claire, ils sont facultatifs, et vous pouvez les modifier, les effacer ou retirer votre consentement à tout moment dans <Link href="/compte" className={lienTexte}>Mon compte</Link> sans conséquence sur le reste du service. Le retrait du consentement ne remet pas en cause les traitements passés. C’est aussi le fondement de la <strong>newsletter</strong> (double confirmation par email).</li>
          <li><strong>Intérêt légitime</strong> (art. 6.1.f) : sécurité du service, prévention des abus et de la fraude, récapitulatif hebdomadaire de votre semaine par email (désactivable en un clic dans Mon compte), mesure d’audience anonyme.</li>
          <li><strong>Obligation légale</strong> (art. 6.1.c) : conservation des factures et pièces comptables.</li>
        </ul>
        <p>
          Fournir les données du compte est nécessaire pour utiliser le service. Toutes les autres informations sont facultatives.
        </p>
      </>
    ),
  },
  {
    title: 'Avec qui partageons-nous vos données ?',
    body: (
      <>
        <p>Vos données ne sont jamais vendues. Elles sont confiées uniquement à des prestataires qui nous aident à fournir le service (sous-traitants) :</p>
        <ul>
          <li><strong>Supabase</strong> — base de données et authentification, hébergées dans l’Union européenne (Irlande).</li>
          <li><strong>Vercel Inc.</strong> (États-Unis) — hébergement du site, exécuté dans la région de Dublin (Irlande).</li>
          <li><strong>Stripe</strong> (Stripe Payments Europe Ltd, Irlande) — paiement des abonnements, conforme PCI-DSS. Reçoit votre email et les informations de paiement que vous saisissez chez lui.</li>
          <li><strong>Resend</strong> (États-Unis) — envoi des emails (confirmation de compte, récapitulatif, newsletter, résiliation). Reçoit votre adresse email et le contenu du message.</li>
          <li><strong>Plausible Analytics</strong> (Plausible Insights OÜ, Estonie, hébergement dans l’Union européenne) — mesure d’audience anonyme.</li>
          <li><strong>Anthropic</strong> (États-Unis) — uniquement si vous importez une recette depuis une page web ou un texte : le texte à analyser lui est transmis, jamais vos données de compte.</li>
          <li><strong>Google</strong> — uniquement si vous choisissez « Continuer avec Google » pour vous connecter.</li>
        </ul>
        <p>
          Lorsqu’un prestataire est établi hors de l’Union européenne, le transfert est encadré par des garanties appropriées : décision
          d’adéquation (Data Privacy Framework) ou clauses contractuelles types de la Commission européenne. Vos données peuvent aussi être
          communiquées à une autorité si la loi l’exige.
        </p>
      </>
    ),
  },
  {
    title: 'Combien de temps conservons-nous vos données ?',
    body: (
      <ul>
        <li><strong>Compte et données de planification :</strong> tant que votre compte existe. Elles sont supprimées immédiatement quand vous supprimez votre compte.</li>
        <li><strong>Compte gratuit inactif :</strong> supprimé automatiquement après 24 mois sans connexion.</li>
        <li><strong>Factures et données de paiement associées :</strong> 10 ans (obligation comptable), en archivage restreint.</li>
        <li><strong>Newsletter :</strong> jusqu’à votre désinscription ; une inscription non confirmée est supprimée sous 7 jours. Après désinscription, votre adresse est conservée seule, pour ne plus vous écrire.</li>
        <li><strong>Messages de contact :</strong> le temps de traiter votre demande, puis au plus 12 mois après le dernier échange.</li>
        <li><strong>Journal de sécurité (adresse IP) :</strong> 90 jours. Compteurs anti-abus : 24 heures.</li>
        <li><strong>Mesure d’audience :</strong> statistiques agrégées et anonymes, sans donnée personnelle.</li>
      </ul>
    ),
  },
  {
    title: 'Quels sont vos droits et comment les exercer ?',
    body: (
      <>
        <p>
          Vous disposez des droits d’<strong>accès</strong>, de <strong>rectification</strong>, d’<strong>effacement</strong>, de{' '}
          <strong>limitation</strong>, d’<strong>opposition</strong> et de <strong>portabilité</strong>, du droit de{' '}
          <strong>retirer votre consentement</strong> à tout moment, et du droit de définir des directives sur le sort de vos données après votre décès.
        </p>
        <ul>
          <li><strong>Accès et portabilité :</strong> « Télécharger mes données » dans <Link href="/compte" className={lienTexte}>Mon compte</Link> (fichier JSON).</li>
          <li><strong>Rectification :</strong> directement dans Mon compte.</li>
          <li><strong>Effacement :</strong> « Supprimer mon compte » dans Mon compte — immédiat et définitif.</li>
          <li><strong>Emails :</strong> récapitulatif désactivable dans Mon compte ; lien de désinscription dans chaque newsletter.</li>
          <li><strong>Tout autre droit :</strong> écrivez à {mail}. Nous répondons sous un mois au plus. Nous pouvons vous demander de justifier de votre identité.</li>
        </ul>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL
          (<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className={lienTexte}>cnil.fr/plaintes</a>
          — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).
        </p>
      </>
    ),
  },
  {
    title: 'Cookies et traceurs',
    body: (
      <>
        <p>
          PlanMyMeal n’utilise <strong>aucun cookie ou traceur publicitaire ou de profilage</strong>. Seuls sont utilisés : un cookie de session
          pour rester connecté, quelques données de fonctionnement stockées dans votre navigateur (par exemple votre planning en mode hors
          connexion) et une mesure d’audience anonyme sans cookie. Ces éléments sont exemptés de consentement : aucune bannière à accepter.
        </p>
        <p>
          Le détail (noms, finalités, durées) figure dans la <Link href="/cookies" className={lienTexte}>politique de cookies</Link>.
        </p>
      </>
    ),
  },
  {
    title: 'Comment protégeons-nous vos données ?',
    body: (
      <p>
        Connexions chiffrées (HTTPS), mots de passe chiffrés, accès à la base de données limité ligne par ligne à chaque utilisateur (RLS),
        clés d’administration jamais exposées dans votre navigateur, limitation du nombre de tentatives, journal des événements de sécurité et
        suppression automatique des données devenues inutiles. Aucun système n’est infaillible : en cas de violation de données présentant un
        risque pour vous, nous informerons la CNIL et vous-même dans les conditions prévues par la loi.
      </p>
    ),
  },
  {
    title: 'Mineurs',
    body: (
      <p>
        Le service s’adresse aux personnes d’au moins 16 ans ; la souscription d’un abonnement payant est réservée aux personnes majeures.
        Si vous êtes parent et constatez qu’un mineur a créé un compte sans votre accord, écrivez-nous : nous le supprimerons.
      </p>
    ),
  },
  {
    title: 'Modifications de cette politique',
    body: (
      <p>
        Nous pouvons mettre à jour cette politique, par exemple si nous ajoutons un service ou un prestataire. La date de mise à jour figure
        en bas de page ; en cas de changement important, nous vous en informerons par email ou dans l’application avant son application.
      </p>
    ),
  },
];

export default function ConfidentialitePage() {
  return (
    <PageLegale
      titre="Politique de"
      motSouligne="confidentialité."
      accroche="Quelles données, pourquoi, combien de temps et comment garder la main : en clair, sans jargon inutile."
      sections={SECTIONS}
      majLe={MAJ_LEGALE}
      couleur="#7C5FBF"
    />
  );
}

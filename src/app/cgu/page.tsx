import type { Metadata } from 'next';
import Link from 'next/link';
import { PageLegale, lienTexte, type SectionLegale } from '@/components/PageLegale';
import { EDITEUR, EMAIL_CONTACT, MAJ_LEGALE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description:
    'Conditions générales d’utilisation de PlanMyMeal : accès au service, compte, usage acceptable, contenus, responsabilité (allergies, santé), résiliation et droit applicable.',
  alternates: { canonical: '/cgu' },
};

const mail = <a href={`mailto:${EMAIL_CONTACT}`} className={lienTexte}>{EMAIL_CONTACT}</a>;

const SECTIONS: SectionLegale[] = [
  {
    title: 'Objet et éditeur',
    body: (
      <>
        <p>
          Les présentes conditions générales d’utilisation (CGU) encadrent l’accès et l’usage du site et de l’application{' '}
          <strong>PlanMyMeal</strong> (getplanmymeal.com), service de planification de repas : menus personnalisés, liste de courses,
          suivi du budget et des apports, catalogue de recettes.
        </p>
        <p>
          Éditeur : <strong>{EDITEUR.nom}</strong>, {EDITEUR.adresse}
          {EDITEUR.siret && <> — SIRET {EDITEUR.siret}</>}. Contact : {mail}. Voir aussi les{' '}
          <Link href="/mentions-legales" className={lienTexte}>mentions légales</Link>.
        </p>
        <p>
          Les conditions de vente des abonnements payants figurent dans les{' '}
          <Link href="/cgv" className={lienTexte}>conditions générales de vente</Link> ; en cas de contradiction, les CGV
          s’appliquent à la partie payante.
        </p>
      </>
    ),
  },
  {
    title: 'Accès au service',
    body: (
      <>
        <p>
          La consultation des recettes et des pages d’information est libre. La création d’un compte est nécessaire pour composer vos menus.
          Le service s’adresse aux personnes d’au moins 16 ans ; la souscription d’un abonnement est réservée aux majeurs.
        </p>
        <p>
          Les frais d’accès à Internet et d’équipement sont à votre charge. Nous mettons tout en œuvre pour garantir un accès continu, sans
          obligation de résultat : le service peut être interrompu pour maintenance, mise à jour ou en cas de force majeure.
        </p>
      </>
    ),
  },
  {
    title: 'Votre compte',
    body: (
      <>
        <p>
          Vous vous engagez à fournir des informations exactes, à garder votre mot de passe confidentiel et à nous prévenir sans délai de toute
          utilisation non autorisée de votre compte. Un compte est personnel ; le partage d’un foyer avec d’autres comptes passe par la
          fonctionnalité prévue à cet effet (formule Famille).
        </p>
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis <Link href="/compte" className={lienTexte}>Mon compte</Link>. Un compte gratuit
          inactif depuis 24 mois est supprimé automatiquement.
        </p>
      </>
    ),
  },
  {
    title: 'Usage acceptable',
    body: (
      <>
        <p>Il est interdit de :</p>
        <ul>
          <li>extraire ou copier massivement le catalogue de recettes (robots d’aspiration, « scraping » à grande échelle) ou revendre son contenu ;</li>
          <li>perturber le service, contourner ses limites ou ses protections de sécurité, tenter d’accéder aux données d’autres utilisateurs ;</li>
          <li>utiliser le service de manière illicite, ou y transmettre un contenu illicite, offensant ou portant atteinte aux droits d’autrui ;</li>
          <li>créer des comptes automatisés ou en grand nombre.</li>
        </ul>
        <p>
          En cas de manquement, nous pouvons suspendre ou supprimer le compte concerné, après avoir permis à son titulaire de s’expliquer
          sauf urgence ou atteinte grave à la sécurité du service.
        </p>
      </>
    ),
  },
  {
    title: 'Contenus et propriété intellectuelle',
    body: (
      <>
        <p>
          Le site, la marque, le logiciel, la structure du catalogue et les recettes publiées sont protégés par le droit d’auteur et le droit des
          bases de données. Vous disposez d’un droit personnel, non exclusif et non transmissible de les consulter et de les utiliser pour
          votre usage privé. Vous pouvez partager un lien vers une recette ou un menu ; toute autre reproduction exige notre accord écrit.
        </p>
        <p>
          Les contenus que vous saisissez (recettes importées, notes, listes) restent les vôtres. Vous nous accordez uniquement le droit de les
          stocker et de les afficher pour vous fournir le service. Vous garantissez que vous avez le droit de les utiliser (n’importez que des
          recettes que vous pouvez utiliser librement).
        </p>
      </>
    ),
  },
  {
    title: 'Santé, allergies et régimes : votre vigilance reste nécessaire',
    body: (
      <>
        <p>
          PlanMyMeal propose des idées de menus, des estimations de calories, de macronutriments et de coûts à titre <strong>informatif</strong>.
          Le service <strong>ne remplace pas l’avis d’un médecin, d’un allergologue ou d’un diététicien</strong> et n’est pas un dispositif médical.
        </p>
        <p>
          Le filtre d’allergies exclut les aliments que vous avez déclarés, mais <strong>vérifiez toujours la composition des produits achetés
          et les étiquettes</strong> (traces, contaminations croisées, changements de recette des fabricants). Si vous avez une allergie sévère,
          une pathologie ou un régime médical, demandez conseil à un professionnel de santé avant de suivre un menu. Appliquez les règles
          usuelles d’hygiène et de conservation des aliments.
        </p>
      </>
    ),
  },
  {
    title: 'Responsabilité',
    body: (
      <>
        <p>
          Nous répondons des dommages qui résultent de notre faute dans les conditions prévues par la loi. Nous ne sommes pas responsables des
          dommages indirects, de l’indisponibilité temporaire du service, d’un usage non conforme aux présentes conditions, ni des prix réels en
          magasin, qui varient selon l’enseigne et la région (les prix affichés sont des estimations). Rien dans ces CGU ne limite les droits
          que vous tenez impérativement du droit de la consommation.
        </p>
        <p>
          Les liens vers des sites tiers (partage sur les réseaux sociaux, paiement) sont fournis pour votre commodité ; nous ne contrôlons pas
          leur contenu.
        </p>
      </>
    ),
  },
  {
    title: 'Données personnelles',
    body: (
      <p>
        Le traitement de vos données est décrit dans la <Link href="/confidentialite" className={lienTexte}>politique de confidentialité</Link> et la{' '}
        <Link href="/cookies" className={lienTexte}>politique de cookies</Link>. Vous pouvez exercer vos droits à tout moment depuis Mon compte
        ou par email à {mail}.
      </p>
    ),
  },
  {
    title: 'Modification des conditions',
    body: (
      <p>
        Nous pouvons modifier ces CGU, par exemple pour tenir compte d’une évolution du service ou de la loi. Les utilisateurs sont informés de
        tout changement important avant son entrée en vigueur ; continuer à utiliser le service après cette date vaut acceptation, et vous pouvez
        supprimer votre compte si vous refusez. La version applicable est celle publiée sur cette page à la date de votre utilisation.
      </p>
    ),
  },
  {
    title: 'Litiges et droit applicable',
    body: (
      <>
        <p>
          Les CGU sont soumises au droit français. En cas de difficulté, contactez-nous d’abord à {mail} : nous cherchons une solution amiable.
          Si vous êtes consommateur, vous pouvez recourir gratuitement à un médiateur de la consommation (voir les{' '}
          <Link href="/cgv" className={lienTexte}>CGV</Link>) ou à la plateforme européenne de règlement en ligne des litiges
          (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className={lienTexte}>ec.europa.eu/consumers/odr</a>).
          Vous pouvez saisir le tribunal compétent selon les règles du Code de procédure civile et du Code de la consommation.
        </p>
      </>
    ),
  },
];

export default function CguPage() {
  return (
    <PageLegale
      titre="Conditions"
      motSouligne="d’utilisation."
      accroche="Les règles d’usage de PlanMyMeal : accès, compte, contenus et responsabilités, simplement."
      sections={SECTIONS}
      majLe={MAJ_LEGALE}
    />
  );
}

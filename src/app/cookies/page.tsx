import type { Metadata } from 'next';
import Link from 'next/link';
import { PageLegale, lienTexte, type SectionLegale } from '@/components/PageLegale';
import { MAJ_LEGALE } from '@/lib/legal';
import { OppositionAudience } from '@/components/OppositionAudience';
import { GererCookies } from '@/components/GererCookies';
import { AMPLITUDE_KEY, GA_ID, MESURE_AVEC_CONSENTEMENT } from '@/lib/consentement';

const OUTILS = [GA_ID && 'Google Analytics 4', AMPLITUDE_KEY && 'Amplitude'].filter(Boolean).join(' et ');

export const metadata: Metadata = {
  title: 'Politique de cookies',
  description:
    'Les cookies et données stockées par PlanMyMeal : uniquement ce qui est nécessaire au service, plus une mesure d’audience anonyme sans cookie. Aucune publicité, aucun suivi.',
  alternates: { canonical: '/cookies' },
};

const cellule = 'px-3 py-2 align-top border-b border-gray-100';

function Tableau({ lignes, legende = 'Tableau des éléments stockés' }: { lignes: [string, string, string][]; legende?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white" role="region" aria-label={legende} tabIndex={0}>
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">{legende}</caption>
        <thead className="bg-gray-100 text-gray-800">
          <tr><th scope="col" className={cellule}>Nom</th><th scope="col" className={cellule}>Finalité</th><th scope="col" className={cellule}>Durée</th></tr>
        </thead>
        <tbody>
          {lignes.map(([nom, finalite, duree]) => (
            <tr key={nom}><th scope="row" className={`${cellule} font-mono font-medium text-gray-900`}>{nom}</th><td className={cellule}>{finalite}</td><td className={cellule}>{duree}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS: SectionLegale[] = [
  {
    title: 'En bref',
    body: (
      <>
        <p>
          PlanMyMeal <strong>ne dépose aucun cookie publicitaire, de profilage ni de réseau social</strong>. Nous n’utilisons que des éléments
          strictement nécessaires au service que vous demandez, et une mesure d’audience anonyme qui ne dépose rien dans votre navigateur.
        </p>
        <p>
          Selon la loi (article 82 de la loi Informatique et Libertés) et les lignes directrices de la CNIL, ces éléments sont{' '}
          <strong>exemptés de consentement</strong>.
          {MESURE_AVEC_CONSENTEMENT
            ? <> En revanche, {OUTILS} (mesure d’audience détaillée et rétention) ne sont utilisés <strong>qu’avec votre accord</strong> : sans clic sur
                « Tout accepter », rien n’est déposé ni envoyé. Vous pouvez changer d’avis à tout moment (voir plus bas).</>
            : <> C’est pourquoi nous n’affichons pas de bannière « Tout accepter / Tout refuser » et seulement une simple information.</>}
        </p>
      </>
    ),
  },
  {
    title: 'Ce qui est stocké dans votre navigateur',
    body: (
      <>
        <p>Cookies et stockage local (« localStorage » / « sessionStorage ») de PlanMyMeal :</p>
        <Tableau lignes={[
          ['sb-…-auth-token', 'Cookie de session (Supabase) : vous garde connecté et sécurise votre compte. Indispensable pour utiliser l’espace connecté.', 'Jusqu’à votre déconnexion, 400 jours au maximum'],
          MESURE_AVEC_CONSENTEMENT
            ? ['pmm_consentement', 'Mémorise votre choix (accepter ou refuser) pour ne pas vous le redemander à chaque page.', '6 mois, puis nous vous redemandons']
            : ['pmm_cookies_ack', 'Mémorise que vous avez vu l’information sur les cookies, pour ne pas la réafficher.', 'Jusqu’à effacement des données du site'],
          ['pmm:visite:… / pmm_invitation_partage', 'Mémorisent que la visite guidée ou l’invitation à partager a déjà été affichée.', 'Jusqu’à effacement des données du site'],
          ['Cache du planning hors connexion', 'Copie de votre semaine et de votre liste de courses pour les consulter et les cocher sans réseau (au supermarché, par exemple).', 'Jusqu’à effacement des données du site'],
          ['pmm_optimisation_reussie', 'Indicateur temporaire pour proposer de partager votre menu après une optimisation.', 'Onglet ouvert (sessionStorage)'],
        ]} />
        <p>
          Aucun de ces éléments n’est partagé avec un tiers ni utilisé pour vous suivre. Ils ne contiennent aucun identifiant publicitaire.
        </p>
      </>
    ),
  },
  {
    title: 'Mesure d’audience (Plausible)',
    body: (
      <>
        <p>
          Nous mesurons la fréquentation avec <strong>Plausible Analytics</strong> (société estonienne, hébergement dans l’Union européenne) pour
          savoir quelles pages sont utiles. Plausible <strong>ne dépose aucun cookie, ne stocke rien dans votre navigateur, ne conserve pas votre
          adresse IP</strong> et ne permet pas de vous suivre d’un site à l’autre, ni d’un jour à l’autre. Les statistiques sont agrégées et
          anonymes (pages vues, pays, type d’appareil, site d’origine, liens cliqués, profondeur de défilement, sans identifiant de recette ni de compte). Aucun suivi n’est fait dans votre espace connecté.
        </p>
        <p>
          Cette mesure a pour seule finalité de mesurer l’audience de notre site pour notre propre compte ; elle est exemptée de consentement dans
          les conditions décrites par la CNIL. Vous pouvez néanmoins vous y opposer à tout moment, sans conséquence sur le service :
        </p>
        <OppositionAudience />
      </>
    ),
  },
  {
    title: 'Services tiers',
    body: (
      <ul>
        <li><strong>Paiement (Stripe) :</strong> lorsque vous souscrivez un abonnement, vous êtes redirigé vers la page de paiement sécurisée de Stripe, qui peut déposer ses propres cookies strictement nécessaires à la sécurité et à la prévention de la fraude. Consultez la politique de Stripe sur stripe.com.</li>
        <li><strong>Connexion avec Google :</strong> si vous choisissez ce mode de connexion, Google peut déposer ses cookies sur ses propres pages de connexion.</li>
        <li><strong>Partage sur les réseaux (WhatsApp, Facebook…) :</strong> ce sont de simples liens : aucun script ni cookie de ces réseaux n’est chargé sur PlanMyMeal tant que vous ne cliquez pas.</li>
        <li><strong>Polices de caractères :</strong> hébergées sur notre propre serveur — aucune requête vers Google Fonts.</li>
      </ul>
    ),
  },
  {
    title: 'Gérer ou supprimer ces données',
    body: (
      <>
        <p>
          Vous pouvez à tout moment supprimer les cookies et données du site depuis les réglages de votre navigateur (Chrome, Firefox, Safari,
          Edge : rubrique « Confidentialité » → « Cookies et données de sites »). Vous serez alors déconnecté et le cache hors connexion sera vidé.
          Bloquer le cookie de session vous empêchera de vous connecter.
        </p>
        <p>
          Plus d’informations : <Link href="/confidentialite" className={lienTexte}>politique de confidentialité</Link>, ou{' '}
          <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs" target="_blank" rel="noopener noreferrer" className={lienTexte}>cnil.fr</a>.
        </p>
      </>
    ),
  },
  ...(MESURE_AVEC_CONSENTEMENT ? [{
    title: 'Analyse avec votre accord (' + OUTILS + ')',
    body: (
      <>
        <p>
          Si vous cliquez sur « Tout accepter », nous utilisons {OUTILS} pour mesurer l’audience du site et comprendre comment il est utilisé
          (pages visitées, conversions{AMPLITUDE_KEY ? ', retour des utilisateurs au fil du temps' : ''}) afin de l’améliorer. Si vous cliquez sur
          « Tout refuser » ou ne répondez pas, <strong>aucun de ces outils n’est chargé</strong> : rien n’est déposé ni envoyé.
        </p>
        <Tableau legende="Cookies d’analyse déposés avec votre accord" lignes={[
          ...(GA_ID ? [
            ['_ga', 'Google Analytics : distingue un navigateur d’un autre pour compter les visiteurs.', '13 mois'] as [string, string, string],
            ['_ga_<identifiant>', 'Google Analytics : mémorise l’état de la session de visite.', '13 mois'] as [string, string, string],
          ] : []),
          ...(AMPLITUDE_KEY ? [
            ['AMP_<clé>', 'Amplitude : identifiant du navigateur et de la session, pour mesurer le retour des utilisateurs.', '12 mois'] as [string, string, string],
          ] : []),
        ]} />
        <ul>
          <li><strong>Données envoyées :</strong> pages visitées (adresse <em>anonymisée</em> : sans identifiant de recette, de lien de partage ni paramètres), actions principales (inscription, optimisation d’une semaine, partage…), type d’appareil, pays approximatif. {AMPLITUDE_KEY ? 'Si vous êtes connecté, un identifiant technique de compte (une suite de caractères sans lien visible avec votre identité) et votre formule d’abonnement sont associés à ces événements pour mesurer la rétention. ' : ''}Votre email, votre nom, vos allergies et le contenu de vos plannings ne sont <strong>jamais</strong> envoyés.</li>
          <li><strong>Réglages protecteurs :</strong> pas de données publicitaires ni de personnalisation publicitaire, pas de recoupement entre appareils par Google{AMPLITUDE_KEY ? ', Amplitude en région Union européenne sans conservation de votre adresse IP' : ''}.</li>
          <li><strong>Destinataires :</strong> {GA_ID ? 'Google Ireland Ltd / Google LLC' : ''}{GA_ID && AMPLITUDE_KEY ? ' ; ' : ''}{AMPLITUDE_KEY ? 'Amplitude Inc.' : ''} (États-Unis) : transferts encadrés par le Data Privacy Framework ou les clauses contractuelles types de la Commission européenne.</li>
          <li><strong>Conservation :</strong> {GA_ID ? 'données Google Analytics : 14 mois au plus' : ''}{GA_ID && AMPLITUDE_KEY ? ' ; ' : ''}{AMPLITUDE_KEY ? 'données Amplitude : 25 mois au plus' : ''}.</li>
        </ul>
        <GererCookies />
      </>
    ),
  }] : []),
  {
    title: 'Évolution',
    body: (
      <p>
        {MESURE_AVEC_CONSENTEMENT
          ? 'Si nous ajoutions un autre traceur soumis à consentement (publicité, nouvel outil), nous le ferions uniquement après votre accord explicite, avec un bouton « Refuser » aussi simple que « Accepter », et nous mettrions cette page à jour au préalable.'
          : 'Si nous ajoutions un jour un traceur soumis à consentement (par exemple un outil de statistiques avancé ou de la publicité), nous le ferions uniquement après votre accord explicite, avec un bouton « Refuser » aussi simple que « Accepter », et nous mettrions cette page à jour au préalable.'}
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <PageLegale
      titre="Politique de"
      motSouligne="cookies."
      accroche="Pas de publicité, pas de pistage : seulement ce qui fait fonctionner le service."
      sections={SECTIONS}
      majLe={MAJ_LEGALE}
      couleur="#5E8C61"
    />
  );
}

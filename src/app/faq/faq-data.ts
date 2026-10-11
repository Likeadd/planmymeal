// Contenu de la FAQ — partagé entre la page (client) et les données
// structurées FAQPage du layout (serveur).

export type FaqItem = { q: string; a: string };
export type FaqCategory = { label: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: 'Prise en main',
    items: [
      {
        q: 'C’est quoi, PlanMyMeal ?',
        a: 'PlanMyMeal est votre assistant de planification de repas : il génère vos menus de la semaine, votre liste de courses et des idées de batch cooking, en s’adaptant à vos goûts, votre régime et votre niveau en cuisine.',
      },
      {
        q: 'Comment ça marche ?',
        a: 'En 3 étapes : 1) vous renseignez vos préférences (goûts, régimes, objectif, niveau de cuisine), 2) le moteur génère votre semaine complète de déjeuners et dîners, 3) vous récupérez la liste de courses triée par rayon et les fiches recettes.',
      },
      {
        q: 'Est-ce vraiment gratuit ?',
        a: 'Le plan Gratuit est gratuit pour toujours, sans carte bancaire : votre semaine composée sur mesure avec un aperçu de 2 jours et de la liste de courses, une optimisation tous les 7 jours et tout le catalogue de recettes. Les plans Pro et Famille débloquent la semaine complète et toute la liste de courses, les optimisations illimitées, les desserts, les changements de repas illimités, les optimisations Budget, Temps et Anti-gaspi et, pour Famille, les profils de chaque membre.',
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
        q: 'Comment sont choisis mes repas ?',
        a: 'Le moteur s’appuie sur votre profil : mémoire des goûts (vos favoris et les plats que vous avez aimés), régime alimentaire, objectif, niveau de cuisine et préférence pour le batch cooking.',
      },
      {
        q: 'Puis-je régénérer ma semaine ?',
        a: 'Oui, autant de fois que vous le souhaitez. Le bouton « Régénérer » propose une nouvelle combinaison de repas qui respecte toujours votre profil.',
      },
      {
        q: 'À quoi servent les favoris ?',
        a: 'Cliquez sur l’étoile d’une carte repas pour l’ajouter à vos favoris : elle reviendra plus souvent dans vos semaines et vous pourrez la retrouver sur la page Favoris.',
      },
      {
        q: 'C’est quoi le batch cooking ?',
        a: 'Cuisiner en lot : préparer plusieurs repas en une seule session pour gagner du temps. PlanMyMeal propose des journées « batch » qui partagent des ingrédients et des préparations.',
      },
      {
        q: 'Les recettes sont-elles adaptées à mon régime ?',
        a: 'Oui : végétarien, vegan, sans gluten, sans lactose, hyperprotéiné… Indiquez vos régimes pendant l’inscription : ils sont respectés dans toutes vos semaines.',
      },
    ],
  },
  {
    label: 'Abonnement & tarifs',
    items: [
      {
        q: 'Quels sont les plans disponibles ?',
        a: 'Trois plans : Gratuit (une optimisation de semaine tous les 7 jours, sans desserts), Pro à 5,99 €/mois ou 49,99 €/an (tout illimité, desserts, optimisations ciblées, semaines planifiées automatiquement) et Famille à 9,99 €/mois ou 79,99 €/an (tout Pro, plus 5 profils avec les allergies et les goûts de chacun et le foyer partagé).',
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
        a: 'Depuis la page Compte, vous pouvez supprimer votre compte : vos plannings et vos données personnelles sont effacés. Pour toute question, écrivez-nous via la page Contact.',
      },
    ],
  },
];

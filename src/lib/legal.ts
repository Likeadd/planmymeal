// ============================================================================
// Constantes juridiques partagées (CGV, emails, page Compte)
// ============================================================================

/** Délai légal de rétractation d'un contrat conclu à distance (art. L221-18 du Code de la consommation). */
export const DELAI_RETRACTATION_JOURS = 14;

export const EMAIL_CONTACT = 'contact@getplanmymeal.com';

/**
 * Médiateur de la consommation (art. L612-1) : à désigner parmi les médiateurs
 * référencés par la CECMC (liste : economie.gouv.fr/mediation-conso) puis à
 * renseigner dans les variables d'environnement. Tant qu'il n'est pas configuré,
 * la section reste masquée plutôt que d'afficher une information fausse.
 */
export const MEDIATEUR = {
  nom: (process.env.NEXT_PUBLIC_MEDIATEUR_NOM ?? '').trim(),
  url: (process.env.NEXT_PUBLIC_MEDIATEUR_URL ?? '').trim(),
  adresse: (process.env.NEXT_PUBLIC_MEDIATEUR_ADRESSE ?? '').trim(),
};

export const mediateurConfigure = MEDIATEUR.nom !== '' && /^https:\/\//.test(MEDIATEUR.url);

/**
 * Identité de l'éditeur (LCEN art. 6-III, Code de la consommation L111-1) : à renseigner
 * dans les variables d'environnement Vercel. Tant qu'elles sont vides, un texte entre
 * crochets reste visible pour ne pas oublier de les compléter avant l'ouverture.
 */
export const EDITEUR = {
  nom: (process.env.NEXT_PUBLIC_EDITEUR_NOM ?? '').trim() || '[Nom et prénom de l’éditeur à compléter]',
  adresse: (process.env.NEXT_PUBLIC_EDITEUR_ADRESSE ?? '').trim() || '[Adresse postale à compléter]',
  siret: (process.env.NEXT_PUBLIC_EDITEUR_SIRET ?? '').trim(),
};

/** Date de dernière mise à jour des textes légaux (figée, jamais calculée au rendu) */
export const MAJ_LEGALE = '19 octobre 2026';

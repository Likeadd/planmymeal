'use client';

// ============================================================================
// FamilleBadges — une pastille par membre, sur chaque carte de repas.
//
// Affiche le verdict du foyer sur UNE recette : chaque membre a sa pastille,
// colorée selon sa satisfaction réelle (voir lib/famille.ts), avec l'explication
// en infobulle (« Léa n'aime pas les champignons »). Rien n'est affiché si le
// foyer n'a pas de membre : le dashboard reste exactement celui d'avant.
//
// Aucun élément interactif ici : en vue desktop, ces pastilles sont rendues à
// l'intérieur du <Link> qui mène à la recette, et une pastille cliquable y
// serait un bouton imbriqué dans un lien.
// ============================================================================

import { compromisFamille, humeurMembre, raisonMembre, type HumeurMembre } from '@/lib/famille';
import { useFamille } from '@/lib/useFamille';
import type { RecetteFoyer } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Au-delà, les pastilles déborderaient de la carte. La puce desktop est bien
 * plus étroite que la carte mobile : elle en garde une de moins.
 */
const MAX_PASTILLES = { normale: 4, compacte: 3 } as const;

/**
 * Teintes d'humeur — SOURCE UNIQUE, partagée avec la légende du dashboard : une
 * pastille verte doit vouloir dire la même chose partout, sinon la légende
 * mentirait sur les cartes.
 */
const HUMEUR_PASTILLE: Record<HumeurMembre, string> = {
  aime: 'bg-sauge-100 border-sauge-300',
  neutre: 'bg-gray-50 border-gray-200',
  peu: 'bg-sable-100 border-sable-300',
};

/** Ce que chaque teinte signifie, en clair (légende du dashboard) */
export const HUMEUR_LIBELLE: Record<HumeurMembre, string> = {
  aime: 'il aime',
  neutre: 'aucun avis',
  peu: "il n'aime pas",
};

/**
 * Classes d'une pastille de foyer (partagées avec la légende).
 * `shrink-0` en fait partie : une pastille écrasée dans une ligne serrée
 * deviendrait illisible — c'est la même pastille sur une carte et dans la légende.
 */
export function classePastille(humeur: HumeurMembre, compacte = false): string {
  return cn(
    'inline-flex items-center justify-center rounded-full border leading-none shrink-0',
    compacte ? 'w-[18px] h-[18px] text-[11px]' : 'w-5 h-5 text-[11px]',
    HUMEUR_PASTILLE[humeur],
  );
}

export function FamilleBadges({ meal, compacte = false, className, libelle }: {
  /** Recette minimale : seuls `id` et les ingrédients (id + nom) sont lus */
  meal: RecetteFoyer;
  /** Vue desktop : puces compactes (la carte mobile est plus large) */
  compacte?: boolean;
  /** Espacement à la charge de l'appelant (chaque carte a sa logique de mise en ligne) */
  className?: string;
  /**
   * Libellé devant les pastilles (catalogue, favoris, fiche recette). Le
   * composant reste muet — libellé compris — tant que le foyer n'a pas de
   * membre : les pages n'ont donc aucun cas particulier à gérer.
   */
  libelle?: string;
}) {
  const famille = useFamille();

  // Rien à montrer : foyer sans membre (cas par défaut, aucun changement visuel)
  if (famille.membres.length === 0) return null;

  const ingredientIds = (meal.ingredients ?? []).map(i => i.ingredient.id);
  const nomsIngredient = new Map((meal.ingredients ?? []).map(i => [i.ingredient.id, i.ingredient.nom]));

  // Les membres les plus « importants » d'abord : si la carte n'a la place que
  // pour 4 pastilles, ce sont ceux qui pèsent le plus qui doivent rester visibles.
  const { detail } = compromisFamille(famille, meal.id, ingredientIds);
  const tries = [...detail].sort((a, b) => b.membre.poids - a.membre.poids);
  const visibles = tries.slice(0, compacte ? MAX_PASTILLES.compacte : MAX_PASTILLES.normale);
  const masques = tries.length - visibles.length;

  return (
    <span className={cn('inline-flex items-center gap-0.5 align-middle', className)}>
      {libelle && (
        <span className={cn('font-semibold text-gray-500', 'text-[11px]')}>
          {libelle}
        </span>
      )}
      <span
        className={cn('leading-none select-none', 'text-[11px]')}
        title={`Avis du foyer — ${famille.membres.length} membre${famille.membres.length > 1 ? 's' : ''}. Survole une pastille pour savoir pourquoi.`}
        aria-hidden
      >
        ⚖️
      </span>
      <span className="sr-only">
        Avis du foyer :{' '}
        {visibles.map(({ membre }) =>
          `${membre.nom} — ${raisonMembre(membre, meal.id, ingredientIds, nomsIngredient)}`
        ).join(' ; ')}
      </span>
      {visibles.map(({ membre, satisfaction }) => (
        <span
          key={membre.id}
          data-humeur={humeurMembre(satisfaction)}
          title={raisonMembre(membre, meal.id, ingredientIds, nomsIngredient)}
          className={classePastille(humeurMembre(satisfaction), compacte)}
        >
          <span aria-hidden>{membre.emoji}</span>
        </span>
      ))}
      {masques > 0 && (
        <span
          className={cn('font-semibold text-gray-500', 'text-[11px]')}
          title={`${masques} autre${masques > 1 ? 's' : ''} membre${masques > 1 ? 's' : ''} du foyer`}
        >
          {/* Une seule chaîne : `+{n}` insérerait un commentaire HTML au milieu */}
          {`+${masques}`}
        </span>
      )}
    </span>
  );
}

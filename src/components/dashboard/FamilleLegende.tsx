'use client';

// ============================================================================
// FamilleLegende — la clé de lecture des pastilles, affichée UNE fois.
//
// Les pastilles du planning veulent dire quelque chose de précis, et cette
// signification n'est pas devinable (une pastille orange n'est pas « un
// problème », c'est « ce membre ne mange pas volontiers ce plat »). Sans clé de
// lecture, la couleur devient du bruit — pire, elle peut inquiéter.
//
// Absente tant que le foyer n'a pas de membre : un utilisateur seul ne voit
// aucune trace de la fonctionnalité. Le lien mène directement à l'écran de
// réglages, là où la légende se configure.
// ============================================================================

import Link from 'next/link';
import { Settings2, Users } from 'lucide-react';
import type { HumeurMembre } from '@/lib/famille';
import { useFamille } from '@/lib/useFamille';
import { classePastille, HUMEUR_LIBELLE } from '@/components/dashboard/FamilleBadges';
import { cn } from '@/lib/utils';

/** Ordre de lecture : du plus favorable au moins favorable */
const HUMEURS: HumeurMembre[] = ['aime', 'neutre', 'peu'];

/**
 * Variante INLINE (desktop) : la clé de lecture se fond dans l'en-tête de
 * section du planning — pas de seconde barre bordée empilée sous la légende
 * des couleurs (audit UX : deux légendes rivalisaient avec les cartes).
 */
export function FamilleLegendeInline() {
  const famille = useFamille();
  if (famille.membres.length === 0) return null;
  const apercu = [...famille.membres]
    .sort((a, b) => b.poids - a.poids)
    .slice(0, 4);

  return (
    <Link href="/compte" title="Avis du foyer — cliquer pour régler mes convives"
      className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-accent-700 transition-colors">
      <Users className="w-3.5 h-3.5 text-accent-500" aria-hidden />
      <span aria-hidden>{apercu.map(m => m.emoji).join(' ')}</span>
      <span className="flex items-center gap-1.5 font-normal">
        {HUMEURS.map(humeur => (
          <span key={humeur} className="inline-flex items-center gap-1">
            <span data-humeur={humeur} className={classePastille(humeur, true)} aria-hidden />
            {HUMEUR_LIBELLE[humeur]}
          </span>
        ))}
      </span>
    </Link>
  );
}

export function FamilleLegende({ className }: { className?: string }) {
  const famille = useFamille();
  if (famille.membres.length === 0) return null;

  // Les membres les plus « importants » d'abord, comme sur les cartes
  const apercu = [...famille.membres]
    .sort((a, b) => b.poids - a.poids)
    .slice(0, 4);
  const masques = famille.membres.length - apercu.length;

  return (
    <div className={cn(
      'mb-4 flex items-center gap-x-3 gap-y-2 flex-wrap rounded-2xl border border-accent-100 bg-accent-50/60 px-3.5 py-2.5',
      className,
    )}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <Users className="w-4 h-4 text-accent-500 flex-shrink-0" />
        Avis du foyer
        <span className="font-normal text-gray-500">
          {/* Une seule chaîne : du JSX interpolé insérerait des commentaires HTML
              entre le chiffre et « membres ». */}
          {`· ${famille.membres.length} membre${famille.membres.length > 1 ? 's' : ''}`}
        </span>
      </span>

      {/* Les convives pris en compte : le lien visuel avec les pastilles des cartes */}
      <span className="flex items-center gap-0.5" title="Les membres du foyer, par poids décroissant">
        {apercu.map(m => (
          <span key={m.id} aria-hidden>{m.emoji}</span>
        ))}
        {masques > 0 && <span className="text-[11px] font-semibold text-gray-500">{`+${masques}`}</span>}
      </span>

      {/* Clé de lecture : la pastille ET son sens, côte à côte */}
      <ul className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-gray-600">
        {HUMEURS.map(humeur => (
          <li key={humeur} className="flex items-center gap-1.5">
            {/* data-humeur : les tests vérifient que la légende porte EXACTEMENT
                les teintes des pastilles des cartes. */}
            <span data-humeur={humeur} className={classePastille(humeur, true)} aria-hidden />
            {HUMEUR_LIBELLE[humeur]}
          </li>
        ))}
      </ul>

      <Link href="/compte"
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-accent-700 bg-white rounded-full border border-accent-200 hover:bg-accent-100 transition-colors flex-shrink-0">
        <Settings2 className="w-3.5 h-3.5" /> Régler mes convives
      </Link>
    </div>
  );
}

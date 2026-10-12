'use client';

// ============================================================================
// InvitationPartage — après la PREMIÈRE optimisation réussie d'un utilisateur,
// un message l'invite à partager son menu (lien public, lecture seule). Affiché
// une seule fois par navigateur ; l'utilisateur peut le fermer. Déclenché par
// l'événement « pmm:optimisation-reussie » (voir lib/useWeeklyPlan.ts).
// ============================================================================

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BoutonPartager } from '@/components/BoutonPartager';
import { lienPublicMenu } from '@/lib/partage-menu';
import { formatWeekRange } from '@/lib/dates';
import { track } from '@/lib/analytics';

export const EVENEMENT_OPTIMISATION = 'pmm:optimisation-reussie';
const CLE = 'pmm_invitation_partage';
const MARQUEUR = 'pmm_optimisation_reussie';

export function InvitationPartage({ semaineDebut }: { semaineDebut: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Le marqueur de session couvre le cas où l'optimisation vient d'avoir lieu juste avant
    // l'affichage du composant (le planning vide devient un planning rempli).
    const surOptimisation = () => {
      try {
        if (!sessionStorage.getItem(MARQUEUR)) return;
        sessionStorage.removeItem(MARQUEUR);
        if (localStorage.getItem(CLE)) return;
        localStorage.setItem(CLE, '1');
      } catch { return; }
      setVisible(true);
      track('Invitation partage', { action: 'vue' });
    };
    surOptimisation();
    window.addEventListener(EVENEMENT_OPTIMISATION, surOptimisation);
    return () => window.removeEventListener(EVENEMENT_OPTIMISATION, surOptimisation);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" className="relative mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
      <div className="flex-1 pr-8 sm:pr-0">
        <p className="font-display font-bold text-gray-900">Ton menu est prêt 🎉</p>
        <p className="mt-0.5 text-sm text-gray-600">
          Tu connais quelqu’un qui se demande quoi manger cette semaine ? Partage-lui ton menu : c’est gratuit, sans compte pour le consulter.
        </p>
      </div>
      <BoutonPartager type="menu" titre={`Mon menu de la semaine du ${formatWeekRange(semaineDebut)}`}
        texte="Voici mon menu de la semaine, composé avec PlanMyMeal :" resoudreUrl={() => lienPublicMenu(semaineDebut)} />
      <button type="button" aria-label="Fermer" onClick={() => { setVisible(false); track('Invitation partage', { action: 'fermee' }); }}
        className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-white/70">
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}

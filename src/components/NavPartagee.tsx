'use client';

// ============================================================================
// NavPartagee — les éléments de navigation PARTAGÉS par la landing et le
// dashboard.
//
// Deux en-têtes coexistent (LandingHeader, DashboardShell) et dupliquaient
// leurs pièces : trait de survol des liens, prénom affiché, menu utilisateur
// (avatar + dropdown + déconnexion). Ce module est leur SEULE implémentation —
// même philosophie que FamilleBadges partagé par planning/catalogue/favoris :
// si le trait, l'avatar ou le menu changent, ils changent PARTOUT, sans qu'une
// des deux navigations ne puisse se mettre à mentir.
//
// Les listes de liens restent la propriété de chaque en-tête (elles n'ont pas
// les mêmes destinations) : ce module ne partage que les mécanismes.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, type LucideIcon } from 'lucide-react';

/**
 * Les classes du trait animé (::after) — la BRIQUE de toutes les navigations :
 * barre brand qui grandit de gauche à droite au survol (300 ms).
 */
const TRAIT_NAV =
  'after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:rounded-full after:bg-brand-500'
  + ' after:transition-all after:duration-300';

/**
 * Soulignement animé SEUL, sans typographie ni couleur : à composer sur le
 * libellé d'éléments qui ont déjà leur style (menus déroulants du compte…).
 * Le trait est permanent sur l'élément actif, grandit au survol sinon.
 * Pour prefers-reduced-motion, la transition est neutralisée par globals.css.
 */
function souligneAuSurvol(actif: boolean): string {
  return 'relative ' + TRAIT_NAV + (actif ? ' after:w-full' : ' after:w-0 hover:after:w-full');
}

/**
 * Lien de navigation « petites capitales » + soulignement animé : la brique
 * ci-dessus + la typographie des barres de nav desktop.
 */
export function lienNavSouligne(actif: boolean): string {
  return 'relative text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors'
    + ' ' + TRAIT_NAV
    + (actif
        ? ' after:w-full text-brand-600'
        : ' after:w-0 text-gray-800 hover:text-brand-600 hover:after:w-full');
}

/** Prénom affiché : full_name sinon partie locale de l'email, sinon repli. */
export function nomAffiche(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return 'Mon espace';
}

/** Une entrée du menu utilisateur. */
export interface LienMenuUtilisateur {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Menu utilisateur (avatar terracotta + dropdown) — le même dans les deux
 * en-têtes : bouton avatar + prénom + chevron, panneau (identité, liens avec
 * pastille du trait animé et point actif, déconnexion), fermeture au clic
 * extérieur et sur Échap, bouton déconnexion désactivé pendant l'appel.
 *
 * Différences admises entre les deux en-têtes, via props :
 *   • `liens` — la landing et le dashboard n'ont pas les mêmes destinations ;
 *   • `nomToujoursVisible` — la topbar dashboard masque le prénom sous xl,
 *     la landing l'affiche dès que sa barre apparaît (≥ md) ;
 *   • `surDeconnexion` — chaque appelant enchaîne ce qu'il veut après
 *     (redirection vers / côté dashboard, fermeture du menu mobile côté landing).
 */
export function MenuUtilisateur({
  nom,
  email,
  liens,
  surDeconnexion,
  nomToujoursVisible = false,
}: {
  /** Prénom (ou identifiant) affiché sur l'avatar et en en-tête du panneau */
  nom: string;
  email: string | null | undefined;
  liens: LienMenuUtilisateur[];
  /** Déconnexion (async autorisé) — le bouton se désactive pendant l'appel */
  surDeconnexion: () => void | Promise<void>;
  /** true = prénom toujours visible ; false = caché sous xl (topbar dashboard) */
  nomToujoursVisible?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur ou Échap (même logique dans les deux en-têtes)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initiale = nom.slice(0, 1).toUpperCase();

  const deconnexion = async () => {
    if (deconnexionEnCours) return;
    setDeconnexionEnCours(true);
    try {
      await surDeconnexion();
    } finally {
      setDeconnexionEnCours(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-colors">
        {/* Avatar : initiale du prénom */}
        <span className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold uppercase shrink-0 shadow-xs">
          {initiale}
        </span>
        <span className={`text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-800 ${nomToujoursVisible ? '' : 'hidden xl:inline'}`}>
          {nom}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          {/* En-tête utilisateur */}
          <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50/70">
            <p className="text-sm font-semibold text-gray-900 truncate">{nom}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>

          {/* Liens du compte — soulignement animé sous chaque libellé (même
              trait que les barres de nav), permanent sur la page active */}
          <nav className="py-2">
            {liens.map(({ href, label, icon: Icon }) => {
              const actif = pathname === href;
              return (
                <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)}
                  aria-current={actif ? 'page' : undefined}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    actif
                      ? 'bg-brand-50 text-brand-600 font-semibold'
                      : 'text-gray-700 hover:bg-brand-50 hover:text-brand-600'
                  }`}>
                  <Icon className={`w-4 h-4 ${actif ? 'text-brand-500' : 'text-gray-500'}`} />
                  <span className={souligneAuSurvol(actif)}>{label}</span>
                  {actif && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden />}
                </Link>
              );
            })}
          </nav>

          {/* Déconnexion */}
          <div className="border-t border-gray-100 py-2">
            <button onClick={deconnexion} role="menuitem" disabled={deconnexionEnCours}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
              <LogOut className="w-4 h-4 text-gray-500" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

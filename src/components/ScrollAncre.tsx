'use client';

// ============================================================================
// ScrollAncre — positionne les ancres de navigation au BON endroit.
//
// Le problème : les liens de la landing (« Fonctionnalités », « Tarifs »…)
// pointent vers /#section. Au clic DEPUIS une autre page (FAQ, CGV…), le
// navigateur saute à l'ancre AVANT que les polices (Inter + serif, échangées
// via next/font avec sizeAdjust) et les images n'aient leurs dimensions
// définitives → la page grandit SOUS le saut et la section finit décalée de
// plusieurs dizaines de pixels. Sur la landing elle-même, le natif marchait —
// c'est l'ARRIVÉE qui dérivait.
//
// La solution : repositionner quand la mise en page est stable. Deux passes
// (fonts loaded + repositionnement léger au chargement des images) suffisent :
// au-delà, ce serait un traitement symptomatique d'une vraie instabilité de
// layout (CLS) qu'il faudrait corriger à la racine.
// ============================================================================

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function ScrollAncre() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.slice(1); // sans le '#'
    if (!hash) return;

    const positionner = () => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ block: 'start' });
    };

    // 1. Dès que les polices sont prêtes (le principal saut de layout).
    //    Si déjà chargées (navigation interne, cache), on positionne tout de
    //    suite — sans attendre un microtask inutile.
    let passe2 = false;
    const passer2 = () => {
      if (passe2) return;
      passe2 = true;
      requestAnimationFrame(positionner);
    };
    if (document.fonts?.status === 'loaded') {
      passer2();
    } else {
      document.fonts?.ready.then(passer2);
    }

    // 2. Filet : les <img> sans dimensions finies (hero, captures) peuvent
    //    encore grandir après les fonts — on repositionne une fois apaisé.
    const t = setTimeout(passer2, 350);

    return () => clearTimeout(t);
    // Une seule passe par entrée sur la page (hash inclus dans la clé via
    // searchParams ? Non : le hash ne passe pas par searchParams — on lit
    // window.location.hash à chaque changement de ROUTE, ce qui couvre aussi
    // un clic vers /#autre-section depuis la page courante).
  }, [pathname, searchParams]);

  return null;
}

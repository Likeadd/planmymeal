'use client';

// ============================================================================
// ScrollReveal — animation d'apparition au scroll, pour TOUTE l'app.
// Usage : ajouter `data-reveal` (et `style={{ '--i': rang }}` pour une cascade)
// sur n'importe quel élément. Un IntersectionObserver marque `data-revealed`
// quand l'élément entre dans le viewport ; le CSS (globals.css) joue alors
// l'animation. Les éléments ajoutés plus tard (navigation, « Afficher plus »)
// sont pris en charge par un MutationObserver.
//
// - Attribut de données (pas de classe) : React ne l'écrase jamais lors d'un
//   re-rendu, contrairement à un className recalculé.
// - `reveal-on` n'est posé sur <html> qu'après hydratation : sans JavaScript,
//   le contenu reste visible.
// - prefers-reduced-motion : neutralisé en CSS (contenu visible immédiatement).
// ============================================================================

import { useLayoutEffect } from 'react';

export function ScrollReveal() {
  useLayoutEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const html = document.documentElement;

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-revealed', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
    );

    // Suivi en mémoire (pas d'attribut DOM) : ce composant, monté dans le
    // layout, s'exécute avant l'hydratation des pages streamées — un attribut
    // ajouté ici provoquait un « hydration mismatch » sur ces pages.
    const vus = new WeakSet<Element>();
    const observer = (el: Element) => {
      if (vus.has(el)) return;
      vus.add(el);
      io.observe(el);
    };
    const scan = (root: ParentNode) => root.querySelectorAll('[data-reveal]').forEach(observer);

    scan(document);
    html.classList.add('reveal-on');

    const mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(n => {
          if (!(n instanceof Element)) return;
          if (n.hasAttribute('data-reveal')) observer(n);
          scan(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      html.classList.remove('reveal-on');
    };
  }, []);

  return null;
}

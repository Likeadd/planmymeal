// ============================================================================
// Reveal — scroll-reveal (fade-up à l'entrée dans le viewport) en cascade.
// S'appuie sur ScrollReveal (layout) + le CSS `[data-reveal]` de globals.css :
// plus de framer-motion (≈ 40 Ko de JS en moins), contenu visible sans JS et
// rendu serveur identique au client (aucun risque d'hydration mismatch).
// prefers-reduced-motion : neutralisé en CSS.
// ============================================================================

import type { CSSProperties, ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Délai en secondes (cascade : 0.05, 0.1, 0.15…) */
  delay?: number;
  /** Conservé pour compatibilité : le décalage vertical est fixé par le CSS */
  y?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div data-reveal className={className} style={{ '--i': Math.round(delay / 0.06) } as CSSProperties}>
      {children}
    </div>
  );
}

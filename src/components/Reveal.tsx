'use client';

// ============================================================================
// Reveal — scroll-reveal (fade-up à l'entrée dans le viewport)
// Roadmap animation ROI n°1 de la landing : les sections apparaissent en
// cascade. Respecte prefers-reduced-motion (framer-motion useReducedMotion) :
// le contenu est alors affiché immédiatement, sans aucune animation.
//
// ⚠️ RÈGLE ANTI-HYDRATION-MISMATCH (bug corrigé) : on ne change JAMAIS l'arbre
// rendu en fonction de `useReducedMotion()`. Le serveur ne connaît pas
// `prefers-reduced-motion` — le hook renvoie `null` au SSR — donc l'ancien
//
//     if (reduceMotion) return <div>{children}</div>;
//     return <motion.div initial={{ opacity: 0, y }} … />;
//
// produisait un HTML serveur AVEC `style="opacity:0; transform:translateY(24px)"`
// et un premier rendu client SANS ce style (l'utilisateur avait le mouvement
// réduit activé) → « Hydration failed because the server rendered HTML didn't
// match the client ». On rend donc toujours le même `motion.div` : seule la
// `transition` change, et elle n'apparaît pas dans le DOM.
// ============================================================================

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Délai en secondes (cascade : 0.05, 0.1, 0.15…) */
  delay?: number;
  /** Décalage vertical initial en px */
  y?: number;
  /** Une seule fois (défaut) ou à chaque entrée dans le viewport */
  once?: boolean;
}

export function Reveal({ children, className, delay = 0, y = 24, once = true }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      // Durée nulle = contenu visible immédiatement pour les utilisateurs qui
      // réduisent le mouvement (le CSS global neutralise en plus les transitions).
      transition={reduceMotion ? { duration: 0 } : { duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

'use client';

// ============================================================================
// CountUp — les chiffres « roulent » de 0 à la valeur à l'apparition.
// Utilisé sur /budget (budget, dépense, économie) : la promesse chiffrée
// mérite d'être animée. Respecte prefers-reduced-motion (valeur finale directe).
// Le setState se fait exclusivement dans le callback requestAnimationFrame
// (pattern « subscribe », jamais dans le corps de l'effet).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  /** Valeur finale */
  value: number;
  /** Durée de l'animation en secondes */
  duration?: number;
  /** Formatage de la valeur affichée */
  format?: (v: number) => string;
  className?: string;
}

export function CountUp({ value, duration = 1.1, format = v => String(v), className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / (duration * 1000));
      // easeOutCubic : démarrage rapide, atterrissage doux
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduceMotion]);

  // reduced-motion (ou pas encore visible) → valeur finale / 0 propre
  const displayed = inView && !reduceMotion ? display : value;

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {format(displayed)}
    </span>
  );
}

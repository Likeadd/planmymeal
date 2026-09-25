import type { ReactNode } from 'react';

// ─── Souligné ondulé (signature visuelle) ───────────────────────────────────

const VAGUE = 'M4 9C22 3 38 3 54 9C70 15 86 15 102 9C118 3 134 3 150 9C166 15 182 15 198 9C206 6 213 6 218 9';

/**
 * Texte souligné d'une vague. Rendu en arrière-plan d'un span INLINE avec
 * box-decoration-break: clone → quand le texte passe à la ligne (mobile),
 * chaque ligne a sa propre vague, à la largeur exacte du texte (l'ancien
 * inline-block s'étirait sur toute la largeur de l'écran).
 */
export function Underlined({ color, children }: { color: string; children: ReactNode }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 14' preserveAspectRatio='none'><path d='${VAGUE}' stroke='${color}' stroke-width='5' stroke-linecap='round' fill='none'/></svg>`;
  return (
    <span
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left bottom',
        backgroundSize: '100% 0.22em',
        paddingBottom: '0.2em',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
      }}
    >
      {children}
    </span>
  );
}

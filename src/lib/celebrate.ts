// ============================================================================
// Célébration — petite pluie de confettis aux moments de victoire :
// - semaine générée (dashboard)
// - économie réelle enregistrée (/budget)
//
// canvas-confetti (~3 ko) importé dynamiquement : zéro impact sur le bundle
// initial. Respecte prefers-reduced-motion : pas de célébration imposée.
// ============================================================================

const BRAND_COLORS = ['#C4552C', '#7C5FBF', '#6A823F', '#F6F0E4', '#DDCFB3'];

export function celebrate(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  void import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
        colors: BRAND_COLORS,
        disableForReducedMotion: true,
      });
    })
    .catch(() => {
      /* CDN/bundle indisponible : on n'embête pas l'utilisateur pour ça */
    });
}

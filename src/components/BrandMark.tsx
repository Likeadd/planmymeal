import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  WORDMARK_VIEWBOX, WORDMARK_RATIO, WORDMARK_PLANMY, WORDMARK_MEAL, WORDMARK_LEAF,
  WORDMARK_VEIN, WORDMARK_SWASH, BRAND_TERRACOTTA, BRAND_CREME, BRAND_FEUILLE, BRAND_FEUILLE_CLAIRE,
} from '@/lib/brand';

// ============================================================================
// BrandMark — le logotype « PlanMyMeal » (Fraunces + feuille + trait ondulé),
// en SVG vectoriel : net à toutes les tailles, aucune police à charger. À
// utiliser PARTOUT où la marque apparaît, pour qu'aucune page ne dérive.
//
//   <BrandMark href="/" />                 → landing (hauteur 40px)
//   <BrandMark href="/" compact />         → app / pages simples (30px)
//   <BrandMark height={34} ... />          → cas particuliers
//   <BrandMark tone="blanc" />             → sur fond terracotta
// ============================================================================

export function BrandMark({
  height,
  href = '/',
  title = 'PlanMyMeal — accueil',
  compact = false,
  tone = 'brand',
  className,
}: {
  /** Hauteur du logotype en px (défaut : 40 landing / 30 compact) */
  height?: number;
  /** Lien du bloc (défaut « / ») ; null = pas de lien */
  href?: string | null;
  title?: string;
  compact?: boolean;
  /** brand = terracotta sur fond clair ; blanc = crème sur fond terracotta */
  tone?: 'brand' | 'blanc';
  className?: string;
}) {
  const h = height ?? (compact ? 30 : 40);
  const couleur = tone === 'brand' ? BRAND_TERRACOTTA : BRAND_CREME;
  const svg = (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      height={h}
      width={Math.round(h * WORDMARK_RATIO)}
      role="img"
      aria-label="PlanMyMeal"
      className="block shrink-0"
    >
      <path d={WORDMARK_PLANMY} fill={couleur} />
      <path d={WORDMARK_MEAL} fill={couleur} />
      <path d={WORDMARK_LEAF} fill={tone === 'brand' ? BRAND_FEUILLE : BRAND_FEUILLE_CLAIRE} />
      <path d={WORDMARK_VEIN} stroke={tone === 'brand' ? BRAND_CREME : BRAND_TERRACOTTA} strokeWidth={2.8} strokeLinecap="round" />
      <path d={WORDMARK_SWASH} stroke={couleur} strokeWidth={5.5} fill="none" strokeLinecap="round" />
    </svg>
  );

  if (href === null) {
    return <span className={cn('inline-flex items-center', className)}>{svg}</span>;
  }
  return (
    <Link href={href} title={title} className={cn('flex items-center', className)}>
      {svg}
    </Link>
  );
}

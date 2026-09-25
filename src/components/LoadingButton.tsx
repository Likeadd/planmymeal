'use client';

// ============================================================================
// LoadingButton — bouton dont l'état loading « morphe » : le spinner remplace
// le label (conservé en opacité 0 → la largeur ne saute jamais), au lieu du
// simple disabled:opacity qui rétrécit le bouton.
// ============================================================================

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function LoadingButton({ loading = false, className, children, disabled, type = 'button', ...rest }: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn('relative', className)}
      {...rest}
    >
      {/* Label conservé dans le flux pendant le chargement : largeur stable */}
      <span
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-opacity duration-150',
          loading && 'opacity-0'
        )}
        aria-hidden={loading}
      >
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2 className="w-5 h-5 animate-spin" />
        </span>
      )}
    </button>
  );
}

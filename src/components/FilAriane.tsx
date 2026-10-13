import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MaillonFil } from '@/lib/seo';

/** Fil d'Ariane accessible (liste ordonnée, page courante marquée aria-current). */
export function FilAriane({ maillons, className = '' }: { maillons: MaillonFil[]; className?: string }) {
  return (
    <nav aria-label="Fil d’Ariane" className={`text-sm text-gray-500 ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {maillons.map((m, i) => {
          const dernier = i === maillons.length - 1;
          return (
            <li key={`${m.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {m.href && !dernier ? (
                <Link href={m.href} className="hover:text-brand-600 transition-colors whitespace-nowrap">{m.label}</Link>
              ) : (
                <span aria-current={dernier ? 'page' : undefined} className={dernier ? 'text-gray-700 truncate max-w-[16rem] sm:max-w-md' : ''}>{m.label}</span>
              )}
              {!dernier && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

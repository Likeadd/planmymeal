'use client';

// ============================================================================
// ChiffresCles — preuve par les faits, sous le hero de la landing.
// Les chiffres sont LUS dans le catalogue public (pas de valeurs inventées) :
// recettes publiques et cuisines distinctes. Arrondis
// vers le bas (« 2 500+ ») pour rester vrais même si le catalogue bouge.
// Aucun avis client affiché tant qu'il n'y a pas de vrais témoignages.
// ============================================================================

import { useEffect, useState } from 'react';
import { CountUp } from '@/components/CountUp';

interface Chiffres { recettes: number; cuisines: number }

const arrondi = (n: number, pas: number) => Math.max(pas, Math.floor(n / pas) * pas);

/** Compteurs du catalogue public, partagés par les blocs de la page d'accueil (une seule requête). */
let requete: Promise<{ total: number; parCuisine: Record<string, number> } | null> | null = null;
export function useFacettesCatalogue() {
  const [facettes, setFacettes] = useState<{ total: number; parCuisine: Record<string, number> } | null>(null);
  useEffect(() => {
    let alive = true;
    requete ??= fetch('/api/recettes?limite=1')
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d?.facettes ? { total: d.facettes.total as number, parCuisine: (d.facettes.parCuisine ?? {}) as Record<string, number> } : null))
      .catch(() => null);
    requete.then(f => { if (alive) setFacettes(f); });
    return () => { alive = false; };
  }, []);
  return facettes;
}

export function ChiffresCles() {
  const facettes = useFacettesCatalogue();
  const chiffres: Chiffres | null = facettes
    ? { recettes: facettes.total, cuisines: Object.keys(facettes.parCuisine).length }
    : null;

  if (!chiffres) return null;

  const items = [
    { valeur: arrondi(chiffres.recettes, 100), suffixe: '+', label: 'recettes au catalogue' },
    { valeur: chiffres.cuisines, suffixe: '', label: 'cuisines du monde' },
    { valeur: 7, suffixe: '', label: 'critères arbitrés chaque semaine' },
    { valeur: 1, suffixe: ' clic', label: 'pour vos menus et vos courses' },
  ];

  return (
    <section aria-label="PlanMyMeal en chiffres" className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
        {items.map((it, i) => (
          <div key={it.label} data-reveal style={{ '--i': i } as React.CSSProperties}>
            <p className="font-sans tabular-nums text-3xl sm:text-4xl font-bold text-gray-900">
              <CountUp value={it.valeur} format={v => `${Math.round(v).toLocaleString('fr-FR')}${it.suffixe}`} />
            </p>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

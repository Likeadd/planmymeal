'use client';

// ============================================================================
// ChiffresCles — preuve par les faits, sous le hero de la landing.
// Les chiffres sont LUS dans le catalogue public (pas de valeurs inventées) :
// recettes publiques et cuisines distinctes. Arrondis
// vers le bas (« 2 500+ ») pour rester vrais même si le catalogue bouge.
// Aucun avis client affiché tant qu'il n'y a pas de vrais témoignages.
// ============================================================================

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { CountUp } from '@/components/CountUp';

interface Chiffres { recettes: number; cuisines: number }

const arrondi = (n: number, pas: number) => Math.max(pas, Math.floor(n / pas) * pas);

export function ChiffresCles() {
  const [chiffres, setChiffres] = useState<Chiffres | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = createBrowserClient();
    (async () => {
      const [rec, cui] = await Promise.all([
        supabase.from('meals').select('id', { count: 'exact', head: true }).eq('is_public', true),
        supabase.from('meals').select('cuisine').eq('is_public', true).not('cuisine', 'is', null).limit(5000),
      ]);
      if (!alive || rec.count == null) return;
      setChiffres({
        recettes: rec.count,
        cuisines: new Set((cui.data ?? []).map(r => r.cuisine)).size,
      });
    })().catch(() => { /* bandeau masqué si la base ne répond pas */ });
    return () => { alive = false; };
  }, []);

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

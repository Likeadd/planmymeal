'use client';

import { errorMessage } from '@/lib/utils';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Refrigerator, Loader2, Sparkles, Clock,
  Check, Search, ShoppingCart, RefreshCw,
} from 'lucide-react';
import type { Ingredient } from '@/types';
import { createBrowserClient } from '@/lib/supabase';
import { formatMinutes } from '@/lib/utils';
import { formatPrix } from '@/lib/budget';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

interface RecetteFrigo {
  id: number;
  titre: string;
  image_url: string | null;
  temps_total: number;
  difficulte: string;
  cuisine: string | null;
  prix_portion: number | null;
  couverture: number;
  nb_manquants: number;
  manquants: string[];
  ustensiles: string[];
}

export default function ViderLeFrigoPage() {
  const supabase = createBrowserClient();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resultats, setResultats] = useState<RecetteFrigo[] | null>(null);
  const [error, setError] = useState('');

  // Charger le catalogue d'ingrédients
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('ingredients')
        .select('id, nom, rayon')
        .order('nom');
      if (err) setError(err.message);
      else setIngredients((data || []) as unknown as Ingredient[]);
      setLoading(false);
    })();
  }, [supabase]);

  const ingredientsFiltres = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ingredients.slice(0, 60);
    return ingredients.filter(i => i.nom.toLowerCase().includes(q)).slice(0, 60);
  }, [ingredients, search]);

  const toggle = (id: number) => {
    setResultats(null); // nouvelle sélection → résultats périmés
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 15) next.add(id);
      return next;
    });
  };

  const generer = async () => {
    if (selection.size === 0) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/vider-le-frigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient_ids: Array.from(selection) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setResultats(json.recettes);
      if (!json.recettes?.length) {
        setError('Aucune recette rapide ne correspond à votre sélection — essayez d\u2019ajouter un ingrédient.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de la génération'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardShell>
      <div className="container-app py-8 max-w-4xl">
        {/* Titre */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
            <Refrigerator className="w-8 h-8 text-brand-600" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gray-900">Cuisiner avec mon frigo</h1>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Cochez ce que vous avez déjà chez vous, on vous propose 3 recettes rapides
            pour cuisiner sans rien acheter. Anti-gaspillage 🌱
          </p>
        </div>

        {/* Sélection en cours */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">
              Mon frigo <span className="text-gray-500 font-normal">({selection.size}/15)</span>
            </h2>
            {selection.size > 0 && (
              <button onClick={() => { setSelection(new Set()); setResultats(null); }}
                className="text-xs text-gray-500 hover:text-red-500 transition-colors">
                Tout effacer
              </button>
            )}
          </div>
          {selection.size === 0 ? (
            <p className="text-sm text-gray-500">Ex : œufs, crème, lardons…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selection).map(id => {
                const ing = ingredients.find(i => i.id === id);
                return (
                  <button key={id} onClick={() => toggle(id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-500 text-white text-xs font-medium rounded-full hover:bg-brand-600 transition-colors">
                    {ing?.nom || `#${id}`}
                    <XIcon />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recherche + catalogue */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un ingrédient (œufs, crème, lardons...)"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300 placeholder:text-gray-400"
            />
          </div>
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
              {ingredientsFiltres.map(ing => {
                const actif = selection.has(ing.id);
                return (
                  <button key={ing.id} onClick={() => toggle(ing.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${actif
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'}`}>
                    {actif && <Check className="w-3 h-3 inline mr-1" />}
                    {ing.nom}
                  </button>
                );
              })}
              {ingredientsFiltres.length === 0 && (
                <p className="text-sm text-gray-500 py-4">Aucun ingrédient trouvé.</p>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <button onClick={generer} disabled={generating || selection.size === 0}
          className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-brand-500 text-white font-semibold rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-cta mb-8">
          {generating
            ? <><Loader2 className="w-5 h-5 animate-spin" /> On cherche dans le frigo...</>
            : <><Sparkles className="w-5 h-5" /> Trouver {3} idées de repas</>}
        </button>

        {error && (
          <div className="bg-sable-50 border border-sable-200 rounded-2xl p-4 text-sm text-sable-700 text-center mb-8">
            {error}
          </div>
        )}

        {/* Résultats */}
        {resultats && resultats.length > 0 && (
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">
              ✨ 3 idées avec votre frigo
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {resultats.map((r, idx) => (
                <Link key={r.id} href={`/recette/${r.id}`}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group">
                  <div className="relative bg-brand-50 h-28 flex items-center justify-center overflow-hidden">
                    <span className="text-4xl transition-transform duration-300 group-hover:scale-110" aria-hidden>🧑‍🍳</span>
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 rounded-full text-[11px] font-bold text-brand-600">
                      #{idx + 1} · {r.couverture}%
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                      {r.titre}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatMinutes(r.temps_total)}</span>
                      {r.prix_portion != null && (
                        <span className="font-semibold text-sauge-700 bg-sauge-50 px-1.5 rounded-full">{formatPrix(r.prix_portion)}</span>
                      )}
                    </div>
                    {r.nb_manquants > 0 ? (
                      <p className="text-[11px] text-sable-600 flex items-start gap-1">
                        <ShoppingCart className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Acheter : {r.manquants.join(', ')}{r.nb_manquants > 4 ? '…' : ''}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-sauge-600 font-medium">✅ Tout est déjà dans votre frigo !</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              Une autre idée ? <button onClick={generer} className="text-brand-600 font-medium hover:underline inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Relancer la recherche
              </button>
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-80">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

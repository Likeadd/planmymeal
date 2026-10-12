'use client';

// ============================================================================
// AjouterSemaine — « Ajouter à ma semaine » sur la fiche recette.
//  - visiteur : un bouton vers l'inscription gratuite ;
//  - connecté : choix de la semaine, du jour et du repas, puis ajout au
//    planning via /api/swap-meal (même contrôles que « Changer »).
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarPlus, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { JOURS_NOMS, getMondayWithOffset, formatWeekRange } from '@/lib/dates';

const bouton = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60';

export function AjouterSemaine({ mealId, typeRepas, className }: { mealId: number; typeRepas: string; className?: string }) {
  const { user, loading } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [semaine, setSemaine] = useState(0);
  const [jour, setJour] = useState<number | null>(null);
  const [repas, setRepas] = useState<'dejeuner' | 'diner'>('diner');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  if (loading) return <div className={cn('min-h-[44px]', className)} aria-hidden />;

  if (!user) {
    return (
      <div className={className}>
        <Link href="/signup?ref=recette" className={cn(bouton, 'bg-brand-500 text-white hover:bg-brand-600 shadow-cta')}>
          <CalendarPlus className="w-4 h-4" aria-hidden /> Ajouter à ma semaine
        </Link>
        <p className="mt-1.5 text-xs text-gray-500">Inscription gratuite, sans carte bancaire.</p>
      </div>
    );
  }

  const estDessert = typeRepas === 'dessert';
  const lundi = getMondayWithOffset(semaine);

  const ajouter = async () => {
    if (jour == null) return;
    setEnvoi(true); setErreur('');
    try {
      const res = await fetch('/api/swap-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_id: mealId, jour_semaine: jour, semaine_debut: lundi,
          repas_type: estDessert ? 'dessert' : repas,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Ajout impossible.');
      const quand = `${JOURS_NOMS[jour].toLowerCase()}${estDessert ? '' : repas === 'dejeuner' ? ' midi' : ' soir'}`;
      setFait(quand);
      toast.success(`Ajouté à votre semaine : ${quand}.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Ajout impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  if (fait) {
    return (
      <div className={cn('flex flex-wrap items-center gap-3', className)}>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-sauge-700"><Check className="w-4 h-4" aria-hidden /> Ajouté pour {fait}</span>
        <Link href="/dashboard" className="text-sm text-brand-600 underline underline-offset-2">Voir mon planning</Link>
      </div>
    );
  }

  return (
    <div className={className}>
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)} className={cn(bouton, 'bg-brand-500 text-white hover:bg-brand-600 shadow-cta')}>
          <CalendarPlus className="w-4 h-4" aria-hidden /> Ajouter à ma semaine
        </button>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3" role="group" aria-label="Ajouter à ma semaine">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Semaine">
            {[0, 1].map(o => (
              <button key={o} type="button" role="radio" aria-checked={semaine === o} onClick={() => setSemaine(o)}
                className={cn('min-h-[40px] px-4 rounded-full text-sm border transition-colors',
                  semaine === o ? 'bg-brand-50 border-brand-400 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-brand-300')}>
                {o === 0 ? 'Cette semaine' : 'Semaine prochaine'}
              </button>
            ))}
            <span className="self-center text-xs text-gray-500">{formatWeekRange(lundi)}</span>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jour">
            {JOURS_NOMS.map((nom, i) => (
              <button key={nom} type="button" role="radio" aria-checked={jour === i} onClick={() => setJour(i)}
                className={cn('min-h-[40px] min-w-[52px] px-3 rounded-full text-sm border transition-colors',
                  jour === i ? 'bg-brand-500 border-brand-500 text-white font-semibold' : 'border-gray-200 text-gray-700 hover:border-brand-300')}>
                {nom.slice(0, 3)}
              </button>
            ))}
          </div>
          {!estDessert && (
            <div className="flex gap-2" role="radiogroup" aria-label="Repas">
              {([['dejeuner', 'Déjeuner'], ['diner', 'Dîner']] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={repas === v} onClick={() => setRepas(v)}
                  className={cn('min-h-[40px] px-4 rounded-full text-sm border transition-colors',
                    repas === v ? 'bg-brand-50 border-brand-400 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-brand-300')}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {erreur && (
            <p className="text-sm text-red-700" role="alert">
              {erreur}{' '}
              {/Aucun planning/i.test(erreur) && <Link href="/dashboard" className="underline">Optimiser ma semaine</Link>}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={ajouter} disabled={jour == null || envoi}
              className={cn(bouton, 'bg-brand-500 text-white hover:bg-brand-600')}>
              {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Ajouter
            </button>
            <button type="button" onClick={() => setOuvert(false)} className={cn(bouton, 'border border-gray-300 text-gray-700 hover:bg-gray-50')}>Annuler</button>
          </div>
          <p className="text-xs text-gray-500">Le repas remplace celui du créneau choisi et la liste de courses est recalculée.</p>
        </div>
      )}
    </div>
  );
}

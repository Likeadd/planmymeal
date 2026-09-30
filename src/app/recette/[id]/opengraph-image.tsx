import { ImageResponse } from 'next/og';
import { wordmarkSvg, WORDMARK_RATIO } from '@/lib/brand';
import { parseRecetteId } from '@/lib/seo';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { titreMajuscules } from '@/lib/utils';
import { toMeal } from '@/lib/db-rows';
import { getRecettePublique } from './data';

// ============================================================================
// Image de partage (1200×630) d'une fiche recette — générée à la demande puis
// mise en cache (convention de fichier Next). Sert aussi d'image au JSON-LD
// Recipe (layout.tsx) : Google exige une image pour afficher une recette en
// résultat enrichi, et le catalogue n'a pas de photos.
// ============================================================================

export const alt = 'Recette PlanMyMeal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mealId = parseRecetteId(id);
  const row = mealId ? await getRecettePublique(mealId) : null;

  const titre = row ? titreMajuscules(row.titre) : 'Recette PlanMyMeal';
  const details: string[] = [];
  if (row) {
    details.push(`${(row.temps_preparation || 0) + (row.temps_cuisson || 0)} min`);
    if (row.calories_par_portion) details.push(`${row.calories_par_portion} kcal`);
    const prix = prixParPortion(toMeal(row));
    if (prix != null) details.push(`${formatPrix(prix)} / portion`);
  }
  const taille = titre.length > 60 ? 58 : titre.length > 36 ? 70 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #C4552C 0%, #A84422 60%, #6F2B15 100%)',
          color: '#FBF8F1',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(wordmarkSvg('blanc')).toString('base64')}`}
          width={Math.round(56 * WORDMARK_RATIO)}
          height={56}
          alt="PlanMyMeal"
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.8 }}>
            Recette
          </div>
          <div style={{ display: 'flex', fontSize: taille, fontWeight: 700, lineHeight: 1.08, marginTop: 14 }}>
            {titre}
          </div>
          {details.length > 0 && (
            <div style={{ display: 'flex', fontSize: 34, marginTop: 28, color: '#F6F0E4' }}>
              {details.join('  ·  ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 26, opacity: 0.85 }}>
          Planifiez-la dans votre semaine · liste de courses automatique
        </div>
      </div>
    ),
    { ...size }
  );
}

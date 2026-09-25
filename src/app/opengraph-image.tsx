import { ImageResponse } from 'next/og';
import { wordmarkSvg, WORDMARK_RATIO } from '@/lib/brand';

// ============================================================================
// Image Open Graph (1200×630) générée au build — PlanMyMeal
// Servie sur /opengraph-image.png automatiquement par la convention de fichier
// Next : les partages Facebook/WhatsApp/Slack affichent enfin un aperçu.
// ============================================================================

export const alt = 'PlanMyMeal — Mangez mieux. Planifiez moins.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #C4552C 0%, #A84422 60%, #6F2B15 100%)',
          color: '#FBF8F1',
          position: 'relative',
        }}
      >
        {/* Halo chaud (lever de soleil) */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'rgba(255, 220, 190, 0.18)',
            display: 'flex',
          }}
        />

        {/* Logotype (SVG vectoriel, version crème) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(wordmarkSvg('blanc')).toString('base64')}`}
          width={Math.round(76 * WORDMARK_RATIO)}
          height={76}
          alt="PlanMyMeal"
        />

        {/* Titre principal */}
        <div
          style={{
            display: 'flex',
            fontSize: 92,
            fontWeight: 700,
            marginTop: 28,
            textAlign: 'center',
            lineHeight: 1.08,
          }}
        >
          Mangez mieux.
        </div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1.08 }}>
          Planifiez moins.
        </div>

        {/* Sous-titre */}
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: '#F6F0E4',
            opacity: 0.9,
            marginTop: 34,
          }}
        >
          Menus sur mesure · Liste de courses en un clic · Mémoire de rotation 21 jours
        </div>

        {/* Pastilles repas */}
        <div style={{ display: 'flex', gap: 28, marginTop: 48, fontSize: 44 }}>
          <div style={{ display: 'flex', width: 88, height: 88, borderRadius: 9999, background: 'rgba(251,248,241,0.14)', alignItems: 'center', justifyContent: 'center' }}>🍗</div>
          <div style={{ display: 'flex', width: 88, height: 88, borderRadius: 9999, background: 'rgba(251,248,241,0.14)', alignItems: 'center', justifyContent: 'center' }}>🥗</div>
          <div style={{ display: 'flex', width: 88, height: 88, borderRadius: 9999, background: 'rgba(251,248,241,0.14)', alignItems: 'center', justifyContent: 'center' }}>🍛</div>
          <div style={{ display: 'flex', width: 88, height: 88, borderRadius: 9999, background: 'rgba(251,248,241,0.14)', alignItems: 'center', justifyContent: 'center' }}>🛒</div>
        </div>
      </div>
    ),
    { ...size }
  );
}

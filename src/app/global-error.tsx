'use client';

// ============================================================================
// Global error boundary — PlanMyMeal
// Dernier filet : erreur dans le layout racine lui-même. Doit rendre son
// propre <html>/<body> (le layout racine n'est pas monté).
// ============================================================================

import { useEffect } from 'react';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FBF8F1',
          fontFamily: 'system-ui, sans-serif',
          color: '#332A1E',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍳</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: '#7F6E55', lineHeight: 1.6, margin: '0 0 24px' }}>
            L&apos;application n&apos;a pas pu démarrer correctement. Réessayez —
            vos données sont en sécurité.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              background: '#C4552C',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

// ============================================================================
// Squelettes de chargement — PlanMyMeal
// Utilisés par les loading.tsx par route : mêmes formes que les pages réelles,
// shimmer crème chaud (.animate-shimmer), pendant que le JS de la page charge.
// ============================================================================

function AppHeaderSkeleton() {
  return (
    <header className="bg-gray-50 border-b border-gray-200">
      <div className="container-app py-4 flex items-center justify-between">
        <div className="h-6 w-40 rounded-full animate-shimmer" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 rounded-xl animate-shimmer" />
          <div className="h-9 w-24 rounded-xl animate-shimmer" />
        </div>
      </div>
    </header>
  );
}

/** Variante « semaine » : grille de jours avec créneaux repas */
export function WeekSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeaderSkeleton />
      <div className="container-app py-6">
        <div className="h-9 w-60 rounded-xl animate-shimmer mb-8" />
        <div className="grid gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full animate-shimmer" />
                <div className="h-4 w-24 rounded-full animate-shimmer" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[0, 1, 2].map(j => (
                  <div key={j} className="h-28 rounded-xl animate-shimmer" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Variante « liste » : rangées de cartes (recettes, favoris…) */
export function ListSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeaderSkeleton />
      <div className="container-app py-6">
        {title && <div className="h-9 w-56 rounded-xl animate-shimmer mb-8" />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="h-24 rounded-xl animate-shimmer mb-4" />
              <div className="h-4 w-3/4 rounded-full animate-shimmer mb-2" />
              <div className="h-3 w-1/2 rounded-full animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Variante « page simple » : blocs empilés (budget, compte, onboarding…) */
export function PageSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeaderSkeleton />
      <div className={`container-app py-8 ${wide ? '' : 'max-w-4xl'}`}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl animate-shimmer" />
          <div>
            <div className="h-7 w-48 rounded-full animate-shimmer mb-2" />
            <div className="h-4 w-72 rounded-full animate-shimmer" />
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 p-8 mb-4">
          <div className="h-12 w-40 rounded-xl animate-shimmer mb-6" />
          <div className="h-3 w-full rounded-full animate-shimmer mb-3" />
          <div className="h-3 w-2/3 rounded-full animate-shimmer" />
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 p-8">
          <div className="h-4 w-56 rounded-full animate-shimmer mb-4" />
          <div className="h-20 rounded-xl animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

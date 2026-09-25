export const metadata = {
  title: 'Hors ligne — PlanMyMeal',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8 max-w-sm text-center">
        <div className="text-5xl mb-4">📵</div>
        <h1 className="text-xl font-bold text-gray-900">Vous êtes hors ligne</h1>
        <p className="text-sm text-gray-500 mt-2">
          La liste de courses reste consultable depuis le dashboard si vous l&apos;avez
          déjà ouverte cette semaine. Reconnectez-vous pour synchroniser vos progrès.
        </p>
        <a
          href="/aujourdhui"
          className="inline-block mt-6 px-6 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors"
        >
          Réessayer le dashboard
        </a>
      </div>
    </div>
  );
}

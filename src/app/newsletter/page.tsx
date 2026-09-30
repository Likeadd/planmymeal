// Confirmation / désinscription newsletter : les liens des emails arrivent
// ici (GET sans effet) et l'action n'est faite qu'au clic (POST). Les
// antivirus de messagerie qui « ouvrent » les liens ne peuvent donc plus
// confirmer ni désinscrire à la place de l'abonné.

import Link from 'next/link';

export const metadata = {
  title: 'Newsletter',
  robots: { index: false },
};

const ACTIONS = {
  confirmer: {
    emoji: '💌',
    titre: 'Confirmer votre inscription',
    texte: 'Un clic pour recevoir chaque dimanche le menu de la semaine et sa liste de courses.',
    bouton: 'Je confirme mon inscription',
  },
  desinscription: {
    emoji: '👋',
    titre: 'Se désinscrire de la newsletter',
    texte: 'Vous ne recevrez plus le menu hebdomadaire. Vous pourrez vous réinscrire à tout moment.',
    bouton: 'Me désinscrire',
  },
} as const;

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; token?: string }>;
}) {
  const { action, token } = await searchParams;
  const cfg = action === 'confirmer' || action === 'desinscription' ? ACTIONS[action] : null;
  const tokenValide = !!token && /^[0-9a-f-]{36}$/i.test(token);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8 max-w-sm text-center">
        {cfg && tokenValide ? (
          <>
            <div className="text-5xl mb-4">{cfg.emoji}</div>
            <h1 className="text-xl font-bold text-gray-900">{cfg.titre}</h1>
            <p className="text-sm text-gray-500 mt-2">{cfg.texte}</p>
            <form method="post" action={`/api/newsletter/${action}`} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full min-h-11 px-6 py-3 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors"
              >
                {cfg.bouton}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">🔗</div>
            <h1 className="text-xl font-bold text-gray-900">Lien invalide</h1>
            <p className="text-sm text-gray-500 mt-2">Ce lien est incomplet ou a expiré.</p>
          </>
        )}
        <Link href="/" className="inline-block mt-4 text-sm text-gray-500 underline">Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}

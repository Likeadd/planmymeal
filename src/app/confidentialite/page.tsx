import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';

export const metadata: Metadata = {
  title: 'Confidentialité & RGPD',
  description:
    'Comment PlanMyMeal collecte, utilise et protège vos données personnelles. Vos droits RGPD : accès, rectification, portabilité et effacement.',
  alternates: { canonical: '/confidentialite' },
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-50 border-b border-gray-200">
        <div className="container-app py-4 flex items-center justify-between">
          {/* Identité verrouillée : BrandMark (wordmark gris comme la landing) */}
          <BrandMark href="/" compact />
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Accueil</Link>
        </div>
      </header>

      <div className="container-app py-12">
        <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-xs p-8 sm:p-12 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Confidentialité &amp; RGPD</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Dernière mise à jour : septembre 2026
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">1. Qui traite vos données ?</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              PlanMyMeal est un service de planification de repas. Le responsable de traitement est
              l&apos;exploitant du site (ci-après « PlanMyMeal »). Pour toute question relative à vos
              données : <strong>privacy@planmymeal.app</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">2. Quelles données collectons-nous ?</h2>
            <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1.5 leading-relaxed">
              <li><strong>Compte :</strong> email, nom (facultatif), mot de passe (haché par Supabase Auth, jamais lisible par nous).</li>
              <li><strong>Préférences alimentaires :</strong> nombre de personnes du foyer, allergies, intolérances, régimes (végan, halal…), budget hebdomadaire, appareils de cuisine.</li>
              <li><strong>Usage du service :</strong> plannings générés, recettes likées/dislikées, historique de rotation, listes de courses, prix personnalisés, snapshots budgétaires.</li>
              <li><strong>Paiement :</strong> géré intégralement par Stripe. Nous ne voyons jamais votre carte bancaire ; nous conservons uniquement l&apos;identifiant de votre abonnement.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Nous ne collectons <strong>aucune donnée de santé</strong> au sens strict : les allergies et
              régimes que vous renseignez sont des préférences de consommation, utilisées uniquement pour
              filtrer vos recettes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">3. Pourquoi ? (bases légales)</h2>
            <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1.5 leading-relaxed">
              <li><strong>Exécution du contrat</strong> : générer vos menus, listes de courses et calculs budgétaires.</li>
              <li><strong>Intérêt légitime</strong> : améliorer l&apos;algorithme de rotation, prévenir les abus (limites du plan gratuit).</li>
              <li><strong>Consentement</strong> : communications marketing, si vous y consentez.</li>
              <li><strong>Obligation légale</strong> : facturation et comptabilité.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">4. Sous-traitants (hébergement &amp; outils)</h2>
            <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1.5 leading-relaxed">
              <li><strong>Supabase</strong> (base de données + authentification) — hébergement UE, chiffrement au repos et en transit.</li>
              <li><strong>Vercel / hébergeur de l&apos;application</strong> — hébergement du site.</li>
              <li><strong>Stripe</strong> (paiements) — conforme PCI-DSS.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">5. Combien de temps ?</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vos données sont conservées tant que votre compte est actif. En cas d&apos;inactivité
              prolongée (24 mois sans connexion), le compte et ses données peuvent être supprimés après
              vous avoir prévenu par email. Les factures sont conservées 10 ans (obligation comptable).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">6. Vos droits</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vous disposez des droits d&apos;<strong>accès</strong>, de <strong>rectification</strong>, de{' '}
              <strong>portabilité</strong> et d&apos;<strong>effacement</strong> de vos données, ainsi que du
              droit de vous <strong>opposer</strong> à un traitement ou de le <strong>limiter</strong>.
            </p>
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-brand-800">
              <strong>Suppression immédiate :</strong> rendez-vous sur votre{' '}
              <Link href="/compte" className="underline font-medium">compte</Link> → « Supprimer mon compte ».
              L&apos;effacement est définitif et instantané (compte, plannings, historique, favoris,
              préférences). Aucune question posée.
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              Pour les autres droits : <strong>privacy@planmymeal.app</strong> — réponse sous 30 jours.
              Vous pouvez également saisir la CNIL (cnil.fr).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">7. Cookies</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              PlanMyMeal utilise uniquement des cookies <strong>essentiels</strong> : le cookie de session
              Supabase qui vous permet de rester connecté. Aucun cookie publicitaire ni traceur tiers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900">8. Sécurité</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Données chiffrées en transit (TLS) et au repos, accès base de données restreint par
              politique de sécurité au niveau des lignes (RLS Supabase), clés de service jamais exposées
              côté navigateur, authentification par jetons à expiration courte.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

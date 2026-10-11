'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Crown, Users, Check, Loader2, LogOut, Settings, Compass,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { redirectToCheckout } from '@/lib/stripe-client';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { lancerVisiteGuidee } from '@/components/VisiteGuidee';
import { STRIPE_PLANS, type Periode, type PlanType } from '@/lib/stripe';
import { SelecteurPeriode } from '@/components/SelecteurPeriode';
import { AbonnementSettings } from '@/components/compte/AbonnementSettings';
import { JOURS_VISIBLES_GRATUIT, OPTIMISATIONS_GRATUITES_PAR_SEMAINE } from '@/lib/limites';
import { PlanCard } from '@/components/compte/PlanCard';
import { MaCuisineSettings } from '@/components/compte/MaCuisineSettings';
import { NutritionSettings } from '@/components/compte/NutritionSettings';
import { MemoireSettings } from '@/components/compte/MemoireSettings';
import { FamilleSettings } from '@/components/compte/FamilleSettings';
import { FoyerSettings } from '@/components/compte/FoyerSettings';
import { ProfileSettings } from '@/components/compte/ProfileSettings';
import { PasswordSettings } from '@/components/compte/PasswordSettings';
import { ActivitySettings } from '@/components/compte/ActivitySettings';
import { DangerZone } from '@/components/compte/DangerZone';

// Les sections de réglages vivent dans src/components/compte/ (extraites pour
// testabilité — audit P3) : PlanCard, MaCuisineSettings, ProfileSettings,
// PasswordSettings, ActivitySettings, DangerZone.

export default function AccountPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </main>
    }>
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [upgrading, setUpgrading] = useState<PlanType | null>(null);
  const [periode, setPeriode] = useState<Periode>('annuel');
  const [error, setError] = useState('');

  // Messages de retour Stripe
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  // Re-sync le profil après retour Stripe
  if (success && profile?.plan === 'gratuit') {
    refreshProfile();
  }

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/login');
    }
  }, [loading, user, profile, router]);

  if (loading || !user || !profile) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </main>
    );
  }

  const handleUpgrade = async (plan: PlanType) => {
    if (plan === profile.plan) return;
    setUpgrading(plan);
    setError('');

    try {
      await redirectToCheckout(plan, periode);
    } catch {
      setError('Erreur lors de la redirection vers Stripe. Vérifiez la configuration.');
      toast.error('Impossible d\'accéder au paiement');
      setUpgrading(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // STRIPE_PLANS ne couvre que pro/famille (l'offre gratuite n'a pas de prix
  // Stripe) : un `|| STRIPE_PLANS.pro` ici affichait « Plan Pro » et ses
  // fonctionnalités à un compte gratuit — trompeur, corrigé par ce repli dédié.
  const currentPlan = profile.plan === 'gratuit'
    ? {
        name: 'Gratuit',
        price: 0,
        features: [
          `${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} optimisation de semaine / 7 jours`,
          `Aperçu de ${JOURS_VISIBLES_GRATUIT} jours sur 7 et de la liste de courses`,
          'Catalogue de plus de 10 000 recettes',
          'Inventaire du frigo',
        ],
      }
    : STRIPE_PLANS[profile.plan as PlanType] ?? STRIPE_PLANS.pro;

  return (
    <DashboardShell>
      <div className="container-app py-12">
        <div className="max-w-2xl mx-auto space-y-10">
          {/* Titre — pastille 44px (convention des autres pages : icône 20px,
              titre sur la ligne de base commune). */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
                <Settings className="w-5 h-5 text-brand-500" />
              </span>
              <div>
                <h1 className="text-3xl font-bold font-display text-gray-900">Mon compte</h1>
                <p className="text-gray-500 mt-1">{profile.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>

          {/* Sur mobile, la barre du bas n'a pas Budget, Favoris ni Historique : accès ici (desktop : menu utilisateur) */}
          <nav aria-label="Raccourcis" className="lg:hidden grid grid-cols-3 gap-2 text-center text-sm font-semibold text-gray-700">
            {[['/budget', 'Budget'], ['/favoris', 'Favoris'], ['/planning', 'Historique']].map(([href, label]) => (
              <Link key={href} href={href} className="py-3 bg-white border border-gray-200 rounded-2xl hover:border-brand-300">{label}</Link>
            ))}
          </nav>

          {/* Relance du parcours d'intégration (seul accès sur mobile) */}
          <button onClick={lancerVisiteGuidee}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left bg-white border border-gray-200 rounded-2xl hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
              <Compass className="w-4 h-4 text-brand-500" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">Visite guidée</span>
              <span className="block text-xs text-gray-500">Revoir en une minute les différentes parties de l’application</span>
            </span>
          </button>

          {/* Messages Stripe */}
          {success && (
            <div className="p-5 bg-sauge-50 border border-sauge-200 rounded-2xl text-sauge-700 text-sm">
              🎉 Paiement réussi ! Votre plan a été activé. Profitez de toutes les fonctionnalités.
            </div>
          )}
          {canceled && (
            <div className="p-5 bg-sable-50 border border-sable-200 rounded-2xl text-sable-700 text-sm">
              Paiement annulé. Votre plan n&apos;a pas changé.
            </div>
          )}
          {error && (
            <div className="p-5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Plan actuel */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                profile.plan === 'gratuit' ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-600'
              }`}>
                {profile.plan === 'gratuit' ? (
                  <Users className="w-6 h-6" />
                ) : profile.plan === 'pro' ? (
                  <Crown className="w-6 h-6" />
                ) : (
                  <Users className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">
                  Plan <span className={
                    profile.plan === 'pro' ? 'text-brand-600' :
                    profile.plan === 'famille' ? 'text-accent-600' :
                    'text-gray-600'
                  }>{currentPlan.name}</span>
                </h2>
                <p className="text-sm text-gray-500">
                  {profile.plan === 'gratuit'
                    ? `${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} optimisation de semaine / 7 jours`
                    : 'Abonnement actif'}
                </p>
              </div>
              {profile.plan === 'gratuit' && (
                <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">
                  Gratuit
                </span>
              )}
              {profile.plan === 'pro' && (
                <span className="ml-auto text-xs bg-brand-100 text-brand-700 px-3 py-1 rounded-full font-medium">
                  Pro actif
                </span>
              )}
              {profile.plan === 'famille' && (
                <span className="ml-auto text-xs bg-accent-100 text-accent-700 px-3 py-1 rounded-full font-medium">
                  Famille actif
                </span>
              )}
            </div>

            {/* Features du plan actuel */}
            <ul className="space-y-2">
              {currentPlan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-sauge-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Abonnement payant : résiliation, rétractation, factures */}
          {profile.plan !== 'gratuit' && <AbonnementSettings onChange={refreshProfile} />}

          {/* Plans disponibles */}
          <div>
            <h2 className="text-xl font-bold font-display text-gray-900 mb-6">
              {profile.plan === 'gratuit' ? 'Passer à la version supérieure' : 'Changer de plan'}
            </h2>
            <SelecteurPeriode valeur={periode} onChange={setPeriode} className="mb-6" />

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Plan Pro */}
              {profile.plan !== 'pro' && (
                <PlanCard
                  plan="pro"
                  periode={periode}
                  currentPlan={profile.plan}
                  upgrading={upgrading}
                  onUpgrade={handleUpgrade}
                />
              )}

              {/* Plan Famille */}
              {profile.plan !== 'famille' && (
                <PlanCard
                  plan="famille"
                  periode={periode}
                  currentPlan={profile.plan}
                  upgrading={upgrading}
                  onUpgrade={handleUpgrade}
                />
              )}
            </div>
          </div>

          {/* Lien profil */}
          <div className="pt-4 border-t border-gray-100">
            <Link
              href="#nutrition"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              ⚙️ Modifier mes préférences alimentaires
            </Link>
          </div>

          {/* Paramètres du compte : profil + mot de passe + activité */}
          {/* key = re-montage quand le profil change → champs resynchronisés sans setState dans un effet */}
          <NutritionSettings key={JSON.stringify([profile.objectif, profile.calories_par_jour, profile.sexe, profile.age, profile.taille_cm, profile.poids_kg])} />
          <MaCuisineSettings key={JSON.stringify([profile.equipements, profile.auto_restes, profile.desserts_activees, profile.utiliser_saison])} />
          {/* Mémoire alimentaire : temps par jour, contexte, nouveauté, recettes mémorisées */}
          <MemoireSettings key={JSON.stringify([profile.temps_max_par_jour, profile.contexte_jours, profile.nouveaute])} />
          {/* Profils famille : pour qui je cuisine, goûts et poids de chaque membre */}
          <FamilleSettings key={JSON.stringify([profile.poids_famille, profile.nb_personnes])} />
          <FoyerSettings />
          <ProfileSettings key={JSON.stringify([profile.full_name, profile.email])} />
          <PasswordSettings />
          <ActivitySettings />
          <DangerZone />
        </div>
      </div>
    </DashboardShell>
  );
}

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LoadingButton } from '@/components/LoadingButton';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}

const BENEFITS = [
  'Votre planning de la semaine, toujours à jour',
  'Vos favoris et la mémoire de vos goûts',
  'Votre liste de courses prête en un clic',
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Message dérivé des query params (pas de setState dans un effet)
  const confirmedParam = searchParams.get('confirmed');
  const signedUpParam = searchParams.get('signedup');
  const errorParam = searchParams.get('error');
  const message = confirmedParam === 'true'
    ? '✅ Email confirmé ! Connectez-vous maintenant.'
    : signedUpParam === 'true'
      ? '✅ Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.'
      : errorParam === 'session'
        ? '🔒 Votre session a expiré. Reconnectez-vous.'
        : errorParam === 'confirmation'
          ? '📬 Lien invalide ou email non confirmé. Utilisez le lien ou le code reçu par email.'
          : '';

  // Précharge la destination habituelle pendant que l'utilisateur saisit ses
  // identifiants : la page suivante s'ouvre alors quasi instantanément.
  useEffect(() => { router.prefetch('/aujourdhui'); }, [router]);

  // Rediriger si déjà connecté — même logique stricte que handleLogin :
  // false explicite → /onboarding, toute autre réponse (true ou requête
  // échouée) → /dashboard. Le proxy corrige si nécessaire.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.onboarding_complete !== false) {
              router.replace('/aujourdhui');
            } else {
              router.replace('/onboarding');
            }
          });
      }
    });
    // supabase (singleton) et router (Next) sont stables → deps complètes
  }, [supabase, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Tous les champs sont requis.');
      return;
    }

    setLoading(true);
    setError('');

    // Connexion côté serveur : rate-limit IP + email, message d'erreur unique
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json().catch(() => ({} as { error?: string }));

    if (!res.ok) {
      setError(json.error || 'Connexion impossible pour le moment. Réessayez dans un instant.');
      setLoading(false);
      return;
    }

    // Cookies posés par l'API → le client navigateur relit la session (lecture
    // locale, sans réseau). L'onboarding vient de la réponse : plus de requête
    // profil avant la redirection. false EXPLICITE → onboarding ; null/true
    // → /aujourdhui (le proxy renvoie vers /onboarding si vraiment incomplet).
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const cible = (json as { onboardingComplete?: boolean | null }).onboardingComplete === false
        ? '/onboarding' : '/aujourdhui';
      toast.success('Connexion réussie ! 👋');
      // replace : le retour arrière ne ramène pas sur le formulaire de login.
      router.replace(cible);
      // On garde le bouton en état « chargement » pendant la navigation :
      // pas de flash du formulaire entre le clic et la page suivante.
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-gray-200">
          {/* Bulles décoratives */}
          <div className="absolute -top-6 right-10 flex items-center gap-1.5 opacity-60" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            <span className="w-3.5 h-3.5 rounded-full bg-accent-300" />
            <span className="w-2 h-2 rounded-full bg-accent-400" />
          </div>
          {/* Décorative uniquement, pensée pour l'espace vide du calage 2
              colonnes desktop : en pile mobile, elle atterrissait au hasard
              au niveau de « Retour à l'accueil », en dessous du formulaire. */}
          <div className="hidden lg:block absolute bottom-8 left-8 w-24 h-24 rounded-full bg-brand-100/70" aria-hidden />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid lg:grid-cols-2 gap-14 items-center">
            {/* Texte */}
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-[1.06]">
                Bon{' '}
                <Underlined color="#7C5FBF">retour !</Underlined>
              </h1>
              <p className="mt-6 text-gray-600 text-lg leading-relaxed">
                Connectez-vous pour retrouver vos menus, vos favoris et votre
                liste de courses.
              </p>

              <ul className="mt-8 space-y-3.5">
                {BENEFITS.map(b => (
                  <li key={b} className="flex items-center gap-3 text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-brand-600" />
                    </span>
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Carte formulaire */}
            <div className="w-full max-w-md mx-auto lg:ml-auto">
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-8">
                {/* Message success (confirmation email) */}
                {message && (
                  <div className="mb-6 p-4 bg-sauge-50 border border-sauge-200 rounded-xl text-sm text-sauge-700">
                    {message}
                  </div>
                )}

                {/* Erreur */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                      Adresse email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <label htmlFor="password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <LoadingButton
                    type="submit"
                    loading={loading}
                    className="w-full px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 disabled:cursor-not-allowed transition-colors shadow-cta"
                  >
                    Se connecter
                    <ArrowRight className="w-4 h-4" />
                  </LoadingButton>
                </form>

                {/* Lien signup */}
                <p className="mt-6 text-center text-sm text-gray-500">
                  Pas encore de compte ?{' '}
                  <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
                    Créer un compte gratuit
                  </Link>
                </p>
              </div>

              {/* Lien retour */}
              <p className="mt-6 text-center">
                <Link href="/" className="text-sm text-gray-500 hover:text-gray-600 transition-colors">
                  ← Retour à l&apos;accueil
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

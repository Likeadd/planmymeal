'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/LoadingButton';

const BENEFITS = [
  'Votre première semaine de menus offerte',
  'Sans carte bancaire, annulable à tout moment',
  'Menus adaptés à vos goûts et vos régimes',
];

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Honeypot : champ invisible pour un humain + chrono de remplissage
  const [website, setWebsite] = useState('');
  const [montéLe] = useState(() => Date.now());
  // Étape 2 : lien magique OU code à 6 chiffres reçu par email
  const [etape, setEtape] = useState<'formulaire' | 'code'>('formulaire');
  const [code, setCode] = useState('');
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);

  const postJson = async (url: string, payload: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json: json as { error?: string; session?: boolean } };
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(code.replace(/\s/g, ''))) {
      setError('Saisissez le code reçu par email.');
      return;
    }
    setLoading(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/verify-otp', { email: email.trim(), code });
    if (!ok) {
      setError(json.error || 'Code incorrect ou expiré.');
      setLoading(false);
      return;
    }
    toast.success('🎉 Compte confirmé !');
    // Cookies de session posés par l'API → le proxy les relit à la navigation
    router.push('/onboarding');
  };

  const handleResend = async () => {
    setRenvoiEnCours(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/resend', { email: email.trim() });
    if (ok) toast.success('Nouvel email envoyé.');
    else setError(json.error || 'Envoi impossible pour le moment.');
    setRenvoiEnCours(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name || !email || !password) {
      setError('Tous les champs sont requis.');
      return;
    }
    // Politique de mot de passe : 8 caractères minimum, au moins une lettre
    // et un chiffre (Supabase ne le fait pas côté client pour nous).
    const aUneLettre = /[a-zA-Z]/.test(password);
    const aUnChiffre = /[0-9]/.test(password);
    if (password.length < 8 || !aUneLettre || !aUnChiffre) {
      setError(
        'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.'
      );
      return;
    }

    setLoading(true);
    setError('');

    // Inscription côté serveur : rate-limit, honeypot, envoi lien magique + code
    const { ok, json } = await postJson('/api/auth/signup', {
      name: name.trim(),
      email: email.trim(),
      password,
      website,
      elapsed_ms: Date.now() - montéLe,
    });

    if (!ok) {
      setError(json.error || 'Inscription impossible pour le moment.');
      setLoading(false);
      return;
    }

    if (json.session) {
      // Confirmation email désactivée dans Supabase → directement connecté
      toast.success('🎉 Compte créé !');
      router.push('/onboarding');
    } else {
      setEtape('code');
    }

    setLoading(false);
  };

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: '', width: '0%' };
    const valide = pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
    if (!valide) return { label: 'Trop faible (8 caractères, 1 lettre, 1 chiffre)', color: 'bg-red-400', width: '25%' };
    if (pwd.length < 10) { return { label: 'Moyen', color: 'bg-sable-400', width: '50%' }; }
    if (/(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(pwd)) { return { label: 'Fort', color: 'bg-sauge-500', width: '100%' }; }
    return { label: 'Correct', color: 'bg-brand-400', width: '75%' };
  };

  const strength = getPasswordStrength(password);

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
              en dessous du formulaire. */}
          <div className="hidden lg:block absolute bottom-8 left-8 w-24 h-24 rounded-full bg-brand-100/70" aria-hidden />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid lg:grid-cols-2 gap-14 items-center">
            {/* Texte */}
            <div>
              <span className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
                Rejoignez-nous
              </span>
              <h1 className="mt-5 font-display text-4xl sm:text-5xl font-bold text-gray-900 leading-[1.06]">
                Créez votre{' '}
                <Underlined color="#C4552C">compte.</Underlined>
              </h1>
              <p className="mt-6 text-gray-600 text-lg leading-relaxed">
                Gratuit, sans carte bancaire. Votre première semaine de menus
                est offerte — testez avant de choisir.
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
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                {etape === 'code' ? (
                  <form onSubmit={handleVerifyCode} className="space-y-5">
                    <div className="p-4 bg-sauge-50 border border-sauge-200 rounded-xl text-sm text-sauge-700">
                      📬 Email envoyé à <strong>{email.trim()}</strong>. Cliquez sur le
                      lien magique qu&apos;il contient, ou saisissez le code ci-dessous.
                    </div>
                    <div>
                      <label htmlFor="code" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                        Code de confirmation
                      </label>
                      <input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={10}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="123456"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg tracking-[0.4em] text-gray-900 placeholder-gray-300 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                        autoFocus
                      />
                    </div>
                    <LoadingButton
                      type="submit"
                      loading={loading}
                      className="w-full px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 disabled:cursor-not-allowed transition-colors shadow-cta"
                    >
                      Confirmer mon compte
                      <ArrowRight className="w-4 h-4" />
                    </LoadingButton>
                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => { setEtape('formulaire'); setCode(''); setError(''); }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ← Modifier l&apos;email
                      </button>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={renvoiEnCours}
                        className="text-brand-600 font-medium hover:text-brand-700 disabled:opacity-50"
                      >
                        {renvoiEnCours ? 'Envoi…' : 'Renvoyer l’email'}
                      </button>
                    </div>
                  </form>
                ) : (
                <form onSubmit={handleSignup} className="space-y-5">
                  {/* Honeypot : invisible et inaccessible pour un humain, rempli par les robots */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                    <label htmlFor="website">Site web</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>

                  {/* Nom */}
                  <div>
                    <label htmlFor="name" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                      Votre prénom
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Marie"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                        autoComplete="given-name"
                      />
                    </div>
                  </div>

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
                        placeholder="8 caractères, 1 lettre, 1 chiffre"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                        autoComplete="new-password"
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
                    {/* Barre de force */}
                    {password.length > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                            style={{ width: strength.width }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Submit */}
                  <LoadingButton
                    type="submit"
                    loading={loading}
                    className="w-full px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 disabled:cursor-not-allowed transition-colors shadow-cta"
                  >
                    Créer mon compte gratuit
                    <ArrowRight className="w-4 h-4" />
                  </LoadingButton>
                </form>
                )}

                {/* Lien login */}
                <p className="mt-6 text-center text-sm text-gray-500">
                  Déjà un compte ?{' '}
                  <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
                    Se connecter
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

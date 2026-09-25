'use client';

// ============================================================================
// PasswordSettings — changement de mot de passe (extraite du compte).
// Le mot de passe actuel est vérifié via signInWithPassword avant updateUser.
// ============================================================================

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';

export function PasswordSettings() {
  const { user } = useAuth();
  const supabase = createBrowserClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: '', width: '0%' };
    // Même politique que le signup : 8 caractères, au moins une lettre et un chiffre
    const valide = pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
    if (!valide) return { label: 'Trop faible (8 caractères, 1 lettre, 1 chiffre)', color: 'bg-red-400', width: '25%' };
    if (pwd.length < 10) return { label: 'Moyen', color: 'bg-sable-400', width: '50%' };
    if (/(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(pwd)) return { label: 'Fort', color: 'bg-sauge-500', width: '100%' };
    return { label: 'Correct', color: 'bg-brand-400', width: '75%' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tous les champs sont requis.');
      return;
    }
    // Politique alignée sur le signup : 8 caractères minimum, au moins une
    // lettre et un chiffre — sinon on accepterait côté compte un mot de passe
    // que l'inscription refuserait.
    const aUneLettre = /[a-zA-Z]/.test(newPassword);
    const aUnChiffre = /[0-9]/.test(newPassword);
    if (newPassword.length < 8 || !aUneLettre || !aUnChiffre) {
      setError(
        'Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Le nouveau mot de passe doit être différent de l\'actuel.');
      return;
    }

    setSaving(true);

    try {
      // Vérifier le mot de passe actuel en re-vérifiant la session
      // (signInWithPassword échoue si le mot de passe est incorrect)
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });
      if (verifyError) {
        setError('Le mot de passe actuel est incorrect.');
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      toast.success('Mot de passe mis à jour.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // Pas de message technique Supabase à l'écran
      setError('Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
      <h2 className="font-semibold font-display text-gray-900 text-lg flex items-center gap-2 mb-5">
        <ShieldCheck className="w-5 h-5 text-brand-500" /> Sécurité — Mot de passe
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="current-password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
            Mot de passe actuel
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowCurrent((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600" tabIndex={-1}>
              {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="new-password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600" tabIndex={-1}>
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {/* Barre de force — même échelle que la page de signup */}
          {newPassword.length > 0 && (
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

        <div>
          <label htmlFor="confirm-password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
            Confirmer le nouveau mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="confirm-password"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Mettre à jour le mot de passe
        </button>
      </form>
    </div>
  );
}

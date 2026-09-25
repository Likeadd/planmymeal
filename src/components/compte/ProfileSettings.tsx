'use client';

// ============================================================================
// ProfileSettings — nom + email (extraite du compte). La modification d'email
// passe par supabase.auth.updateUser → email de confirmation envoyé.
// ============================================================================

import { useState } from 'react';
import { Check, Loader2, Mail, Pencil, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils';

export function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createBrowserClient();

  // Initialisé depuis le profil (re-montage via `key` côté parent)
  const [name, setName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    name !== (profile?.full_name ?? '') || email !== (profile?.email ?? '');

  const handleSave = async () => {
    if (!user || !name.trim()) {
      setError('Le nom ne peut pas être vide.');
      return;
    }
    const emailChanged = email.trim().toLowerCase() !== (profile?.email ?? '').toLowerCase();
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Adresse email invalide.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. Mettre à jour le nom dans profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // 2. Mettre à jour l'email auth si modifié
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (emailError) throw emailError;
        toast.success('Nom mis à jour. Un email de confirmation a été envoyé à votre nouvelle adresse.');
      } else {
        toast.success('Profil mis à jour.');
      }

      await refreshProfile();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de la mise à jour du profil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold font-display text-gray-900 text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-brand-500" /> Profil
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {!editing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-500 w-24">Nom</span>
            <span className="text-sm text-gray-900">{profile?.full_name || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-500 w-24">Email</span>
            <span className="text-sm text-gray-900">{profile?.email}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
              Nom complet
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-brand-400 focus:bg-white transition-colors"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-brand-400 focus:bg-white transition-colors"
                autoComplete="email"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Si vous modifiez votre email, un message de confirmation sera envoyé à la nouvelle adresse.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !dirty}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Enregistrer
            </button>
            <button onClick={() => { setEditing(false); setError(''); setName(profile?.full_name ?? ''); setEmail(profile?.email ?? ''); }}
              className="px-5 py-2.5 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

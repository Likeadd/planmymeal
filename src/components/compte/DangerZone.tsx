'use client';

// ============================================================================
// DangerZone — suppression définitive du compte (RGPD art. 17, extraite du
// compte). Garde-fou : le mot exact « SUPPRIMER » est requis.
// ============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';

export function DangerZone() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/compte/supprimer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast.success('Compte supprimé. Vos données ont été effacées.');
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de la suppression'));
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm">
      <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-1">
        <Trash2 className="w-5 h-5 text-red-500" /> Supprimer mon compte
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Conformément au RGPD (droit à l&apos;effacement), toutes vos données seront
        définitivement supprimées : profil, plannings, historique, favoris, listes
        de courses et préférences. Cette action est <strong>irréversible</strong>.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
          Je veux supprimer mon compte
        </button>
      ) : (
        <div className="space-y-3 max-w-md">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}
          <p className="text-sm text-gray-700">
            Tapez <strong>SUPPRIMER</strong> pour confirmer :
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400 focus:bg-white transition-colors"
            autoComplete="off"
          />
          <div className="flex gap-3">
            <button onClick={handleDelete}
              disabled={deleting || confirmText !== 'SUPPRIMER'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer définitivement
            </button>
            <button onClick={() => { setOpen(false); setConfirmText(''); setError(''); }}
              className="px-5 py-2.5 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

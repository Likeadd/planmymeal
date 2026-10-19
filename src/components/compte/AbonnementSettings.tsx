'use client';

// ============================================================================
// AbonnementSettings — « Mon abonnement » : état, résiliation en un clic,
// droit de rétractation de 14 jours, accès au portail de facturation.
// Utilisé par la page Compte et par la page publique /resiliation.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, ReceiptText } from 'lucide-react';
import { dateFr, type EtatAbonnement } from '@/lib/abonnement';
import { DELAI_RETRACTATION_JOURS, EMAIL_CONTACT } from '@/lib/legal';

type Action = 'resilier' | 'reprendre' | 'retractation';

export function AbonnementSettings({ onChange }: { onChange?: () => void }) {
  const [etat, setEtat] = useState<EtatAbonnement | null>(null);
  const [erreur, setErreur] = useState('');
  const [confirmer, setConfirmer] = useState<'resilier' | 'retractation' | null>(null);
  const [enCours, setEnCours] = useState<Action | null>(null);

  useEffect(() => {
    let annule = false;
    fetch('/api/abonnement')
      .then(async res => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (annule) return;
        if (!ok) throw new Error(data.error ?? 'Erreur');
        setEtat(data);
      })
      .catch(e => { if (!annule) setErreur(e instanceof Error ? e.message : 'Impossible de charger votre abonnement.'); });
    return () => { annule = true; };
  }, []);

  const lancer = async (action: Action) => {
    setEnCours(action);
    try {
      const res = await fetch(action === 'retractation' ? '/api/abonnement/retractation' : '/api/abonnement/resilier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Une erreur est survenue.');
      if (action === 'retractation') {
        toast.success(data.rembourse && data.partiel
          ? 'Rétractation enregistrée : vous êtes remboursé au prorata de la période non utilisée.'
          : data.rembourse
          ? 'Rétractation enregistrée : vous êtes remboursé intégralement.'
          : 'Rétractation enregistrée : votre remboursement est en cours de traitement.');
        setEtat({ actif: false });
      } else {
        toast.success(action === 'resilier' ? 'Résiliation enregistrée. Un email de confirmation vous a été envoyé.' : 'Abonnement réactivé.');
        setEtat(data);
      }
      setConfirmer(null);
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setEnCours(null);
    }
  };

  const ouvrirPortail = async () => {
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Portail indisponible.');
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Portail indisponible.');
    }
  };

  if (erreur) {
    return (
      <section id="abonnement" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
        <h2 className="font-bold text-gray-900 mb-2">Mon abonnement</h2>
        <p className="text-sm text-gray-600">{erreur} Pour résilier ou vous rétracter, écrivez-nous à{' '}
          <a href={`mailto:${EMAIL_CONTACT}`} className="text-brand-600 underline">{EMAIL_CONTACT}</a>.</p>
      </section>
    );
  }
  if (!etat) {
    return <section id="abonnement" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex justify-center"><Loader2 className="w-5 h-5 text-brand-500 animate-spin" /></section>;
  }
  if (!etat.actif) {
    return (
      <section id="abonnement" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
        <h2 className="font-bold text-gray-900 mb-2">Mon abonnement</h2>
        <p className="text-sm text-gray-600">Aucun abonnement payant en cours.</p>
      </section>
    );
  }

  const fin = etat.fin ? dateFr(etat.fin) : null;
  const bouton = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60';

  return (
    <section id="abonnement" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
      <div>
        <h2 className="font-bold text-gray-900">Mon abonnement</h2>
        <p className="text-sm text-gray-600 mt-1">
          Formule {etat.periode === 'annuel' ? 'annuelle' : 'mensuelle'}.{' '}
          {etat.resiliationProgrammee
            ? <>Résiliation enregistrée : vous gardez l’accès jusqu’au <strong>{fin}</strong>, sans nouveau prélèvement.</>
            : fin && <>Prochain renouvellement le <strong>{fin}</strong>.</>}
        </p>
      </div>

      {/* Résiliation : un bouton, une confirmation, aucun motif demandé */}
      {etat.resiliationProgrammee ? (
        <button type="button" onClick={() => lancer('reprendre')} disabled={enCours !== null}
          className={`${bouton} bg-brand-500 text-white hover:bg-brand-600`}>
          {enCours === 'reprendre' && <Loader2 className="w-4 h-4 animate-spin" />} Réactiver mon abonnement
        </button>
      ) : confirmer === 'resilier' ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3" role="alertdialog" aria-label="Confirmer la résiliation">
          <p className="text-sm text-gray-700">
            Confirmer la résiliation ? Vous gardez toutes les fonctions jusqu’au <strong>{fin}</strong>, puis votre compte repasse en gratuit.
            Aucun nouveau prélèvement ne sera effectué.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => lancer('resilier')} disabled={enCours !== null}
              className={`${bouton} bg-gray-900 text-white hover:bg-gray-800`}>
              {enCours === 'resilier' && <Loader2 className="w-4 h-4 animate-spin" />} Oui, résilier mon abonnement
            </button>
            <button type="button" onClick={() => setConfirmer(null)} className={`${bouton} border border-gray-300 text-gray-700 hover:bg-white`}>
              Garder mon abonnement
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmer('resilier')}
          className={`${bouton} border border-gray-300 text-gray-800 hover:border-brand-300 hover:text-brand-600`}>
          Résilier mon abonnement
        </button>
      )}

      {/* Droit de rétractation : visible tant que le délai court */}
      {etat.retractationJusquau && (
        <div className="rounded-xl border border-sauge-200 bg-sauge-50 p-4 space-y-3">
          <p className="text-sm text-gray-700">
            <strong>Droit de rétractation.</strong> Vous disposez de {DELAI_RETRACTATION_JOURS} jours après votre souscription
            (jusqu’au {dateFr(etat.retractationJusquau)}) pour changer d’avis, sans motif : l’abonnement s’arrête
            immédiatement et vous êtes <strong>remboursé intégralement</strong> (au prorata si vous vous êtes déjà rétracté une fois).{' '}
            <Link href="/retractation" className="underline underline-offset-2">Détails</Link>
          </p>
          {confirmer === 'retractation' ? (
            <div className="flex flex-wrap gap-2" role="alertdialog" aria-label="Confirmer la rétractation">
              <button type="button" onClick={() => lancer('retractation')} disabled={enCours !== null}
                className={`${bouton} bg-gray-900 text-white hover:bg-gray-800`}>
                {enCours === 'retractation' && <Loader2 className="w-4 h-4 animate-spin" />} Confirmer ma rétractation
              </button>
              <button type="button" onClick={() => setConfirmer(null)} className={`${bouton} border border-gray-300 text-gray-700 hover:bg-white`}>
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmer('retractation')}
              className={`${bouton} border border-sauge-400 text-sauge-700 hover:bg-white`}>
              Me rétracter et être remboursé
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <button type="button" onClick={ouvrirPortail} className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium">
          <ReceiptText className="w-4 h-4" /> Factures et moyen de paiement
        </button>
        <Link href="/cgv" className="text-gray-500 hover:text-brand-600 underline underline-offset-2">Conditions générales de vente</Link>
      </div>
    </section>
  );
}

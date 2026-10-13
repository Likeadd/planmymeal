'use client';

// ============================================================================
// BoutonPartager — partage d'une recette ou d'un menu de la semaine.
//  - téléphone : feuille de partage native (WhatsApp, Messenger, SMS…) ;
//  - ordinateur : menu « Copier le lien · WhatsApp · E-mail · Facebook ».
// Le lien porte ?ref=partage (ou partage-menu) : la source de l'inscrit est
// ainsi connue (voir lib/analytics.ts). Chaque partage envoie l'événement
// Plausible « Partage ».
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Link2, Loader2, Mail, MessageCircle, Share2 } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { track } from '@/lib/analytics';

interface Props {
  type: 'recette' | 'menu' | 'liste';
  titre: string;
  texte: string;
  /** Chemin du site à partager (recette) — l'origine est ajoutée côté navigateur */
  chemin?: string;
  /** URL complète fournie à la demande (menu : lien public créé par l'API) */
  resoudreUrl?: () => Promise<string>;
  /** `bouton` : icône + libellé ; `icone` : icône seule (barres d'outils) */
  variante?: 'bouton' | 'icone';
  className?: string;
}

/** Ajoute ?ref=… sans écraser les paramètres existants */
function avecRef(url: string, ref: string): string {
  const u = new URL(url, window.location.origin);
  u.searchParams.set('ref', ref);
  return u.toString();
}

export function BoutonPartager({ type, titre, texte, chemin, resoudreUrl, variante = 'bouton', className }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [copie, setCopie] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const ref = type === 'recette' ? 'partage' : type === 'menu' ? 'partage-menu' : 'partage-liste';

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => { if (!conteneur.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [ouvert]);

  const obtenirUrl = async (): Promise<string> => {
    if (url) return url;
    const brute = resoudreUrl ? await resoudreUrl() : `${window.location.origin}${chemin ?? window.location.pathname}`;
    const finale = avecRef(brute, ref);
    setUrl(finale);
    return finale;
  };

  const cliquer = async () => {
    if (chargement) return;
    setChargement(true);
    try {
      const lien = await obtenirUrl();
      // Mobile : feuille de partage du téléphone
      const natif = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
      if (natif) {
        try {
          await navigator.share({ title: titre, text: texte, url: lien });
          track('Partage', { type, canal: 'natif' });
        } catch { /* partage annulé par l'utilisateur */ }
        return;
      }
      setOuvert(o => !o);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Partage impossible pour le moment.');
    } finally {
      setChargement(false);
    }
  };

  const copier = async () => {
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) { setCopie(true); toast.success('Lien copié 🔗'); track('Partage', { type, canal: 'copie' }); setTimeout(() => setCopie(false), 2000); }
    else toast.error('Copie impossible dans ce navigateur.');
  };

  const message = `${texte} ${url ?? ''}`.trim();
  const items = url ? [
    { id: 'whatsapp', label: 'WhatsApp', icone: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { id: 'email', label: 'E-mail', icone: Mail, href: `mailto:?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(message)}` },
    { id: 'facebook', label: 'Facebook', icone: Share2, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ] : [];

  const classeItem = 'flex w-full items-center gap-3 px-4 min-h-[44px] text-sm text-gray-700 hover:bg-gray-50 text-left';

  return (
    <div ref={conteneur} className={cn('relative inline-block', className)}>
      <button type="button" onClick={cliquer} aria-haspopup="menu" aria-expanded={ouvert}
        aria-label={variante === 'icone' ? `Partager : ${titre}` : undefined}
        title="Partager"
        className={variante === 'icone'
          ? 'p-2 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center'
          : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-all'}>
        {chargement ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Share2 className="w-5 h-5" aria-hidden />}
        {variante === 'bouton' && 'Partager'}
      </button>

      {ouvert && url && (
        <div role="menu" className={cn('absolute z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-pop', variante === 'icone' ? 'right-0' : 'left-0')}>
          <button type="button" role="menuitem" onClick={copier} className={classeItem}>
            {copie ? <Check className="w-4 h-4 text-sauge-600" aria-hidden /> : <Link2 className="w-4 h-4 text-gray-500" aria-hidden />}
            {copie ? 'Lien copié' : 'Copier le lien'}
          </button>
          {items.map(({ id, label, icone: Icone, href }) => (
            <a key={id} role="menuitem" href={href} target="_blank" rel="noopener noreferrer"
              onClick={() => { track('Partage', { type, canal: id }); setOuvert(false); }}
              className={classeItem}>
              <Icone className="w-4 h-4 text-gray-500" aria-hidden /> {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

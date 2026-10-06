'use client';

// ============================================================================
// Visite guidée — parcours d'intégration après l'inscription.
//
// Un pas à pas qui traverse les écrans de l'app (Aujourd'hui, Planning,
// Frigo, Recettes, Favoris, Budget, compte) : chaque étape met en lumière un élément
// réel de l'interface (attribut `data-tour`) et explique à quoi il sert, avec
// une astuce. Une étape dont l'élément est absent (semaine vide, autre taille
// d'écran) s'affiche au centre, sans casser le parcours.
//
// Déclenchement :
//   • automatique, une seule fois, à la fin de l'onboarding (drapeau
//     « a-faire » posé par la page /onboarding) ;
//   • automatique à la première connexion : compte créé il y a moins de 7
//     jours et visite jamais faite ni écartée sur cet appareil ;
//   • manuel, à tout moment : menu utilisateur → « Visite guidée », ou
//     `lancerVisiteGuidee()`.
//
// Persistance : `localStorage` par utilisateur (fait / à faire) et
// `sessionStorage` pour l'étape en cours — le composant est remonté à chaque
// changement de page, l'étape doit donc survivre à la navigation.
// Tout accès au stockage est protégé : navigation privée = pas de visite
// automatique, l'app reste pleinement utilisable.
// ============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

// ─── API publique ───────────────────────────────────────────────────────────

const EVENEMENT = 'pmm:visite';
const CLE_ETAPE = 'pmm:visite:etape';
const cleUtilisateur = (id: string) => `pmm:visite:${id}`;

/** À appeler à la fin de l'onboarding : la visite démarrera sur la page d'accueil. */
export function programmerVisiteGuidee(userId: string): void {
  try { localStorage.setItem(cleUtilisateur(userId), 'a-faire'); } catch { /* stockage indisponible */ }
}

/** Relance la visite depuis n'importe quelle page (menu utilisateur, compte…). */
export function lancerVisiteGuidee(): void {
  window.dispatchEvent(new Event(EVENEMENT));
}

// ─── Étapes ─────────────────────────────────────────────────────────────────

interface Etape {
  emoji: string;
  titre: string;
  texte: string;
  astuce?: string;
  /** Page où l'étape s'affiche (préfixe) — la visite y navigue si besoin */
  route: string;
  /** Sélecteurs `data-tour`, du plus probable au repli (mobile / bureau) */
  cibles?: string[];
}

const ETAPES: Etape[] = [
  { emoji: '👋', route: '/aujourdhui',
    titre: 'Bienvenue sur PlanMyMeal',
    texte: 'En 3 minutes, on vous montre où tout se trouve et comment obtenir votre première semaine de menus. Vous pouvez quitter la visite à tout moment et la relancer depuis le menu de votre compte.' },
  { emoji: '🏠', route: '/aujourdhui', cibles: ['nav-aujourdhui'],
    titre: 'Aujourd’hui : votre repas du jour',
    texte: 'Cette page est votre point de départ quotidien : le prochain repas à cuisiner, ce qu’il faut sortir du frigo et l’état de votre liste de courses.',
    astuce: 'Ajoutez PlanMyMeal à l’écran d’accueil de votre téléphone : l’app s’ouvre directement ici.' },
  { emoji: '📅', route: '/dashboard', cibles: ['nav-dashboard'],
    titre: 'Planning : votre semaine complète',
    texte: 'Déjeuners, dîners et desserts de la semaine au même endroit. Naviguez d’une semaine à l’autre avec les flèches : les semaines passées restent consultables.' },
  { emoji: '📊', route: '/dashboard', cibles: ['resume'],
    titre: 'Le résumé de votre semaine',
    texte: 'Coût estimé, budget, temps de cuisine et anti-gaspillage : les chiffres clés de la semaine, mis à jour à chaque changement de menu.',
    astuce: 'Fixez un budget par semaine pour voir d’un coup d’œil si vous restez dans les clous.' },
  { emoji: '🍽️', route: '/dashboard', cibles: ['semaine'],
    titre: 'Chaque carte est un repas',
    texte: 'Touchez un repas pour ouvrir sa recette. Sur chaque carte : ♥ pour l’ajouter aux favoris, « Changer » pour le remplacer (automatiquement, ou par votre propre plat en texte) et « Pourquoi ? » pour comprendre le choix du moteur.',
    astuce: 'Sur ordinateur, glissez-déposez un repas sur un autre jour pour le déplacer.' },
  { emoji: '✨', route: '/dashboard', cibles: ['optimiser'],
    titre: 'Optimiser ma semaine',
    texte: 'C’est le bouton principal : le moteur compose vos menus en arbitrant budget, goûts, temps, frigo, restes et nutrition. Relancez-le autant que vous voulez : il ne repropose pas ce que vous avez cuisiné ces dernières semaines.',
    astuce: 'Choisissez une intention : Équilibrée, Penser au budget, Gain de temps ou Anti-gaspi (utilise en priorité votre frigo).' },
  { emoji: '🛒', route: '/dashboard', cibles: ['onglet-courses'],
    titre: 'Votre liste de courses, prête',
    texte: 'Elle se construit toute seule à partir des repas de la semaine : quantités additionnées, triées par rayon et réduites de ce que vous avez déjà au frigo. Cochez au fil des courses.',
    astuce: 'Elle reste consultable sans réseau dans le magasin, une fois ouverte dans la semaine.' },
  { emoji: '🧊', route: '/frigo', cibles: ['nav-frigo'],
    titre: 'Frigo : cuisinez ce qu’il vous reste',
    texte: 'Cette page est l’inventaire de ce que vous avez chez vous. Le moteur privilégie les recettes qui l’utilisent et retire ces produits de votre liste de courses.' },
  { emoji: '➕', route: '/frigo', cibles: ['frigo-ajouter'],
    titre: 'Ajoutez vos produits',
    texte: 'Saisissez un produit, sa quantité et, si vous la connaissez, sa date de péremption. Vous pouvez aussi ajouter d’un coup tous les articles de votre liste de courses une fois les courses faites.',
    astuce: 'Avec les dates de péremption, les produits qui périment bientôt passent en priorité.' },
  { emoji: '🥘', route: '/frigo', cibles: ['frigo-recettes'],
    titre: 'Des recettes avec ce qu’il reste',
    texte: 'Cochez les aliments à écouler, puis touchez « Trouver des recettes » : on vous propose des plats qui utilisent votre sélection. Le bouton apparaît dès que votre frigo contient des produits.' },
  { emoji: '📖', route: '/recettes', cibles: ['nav-recettes'],
    titre: 'Recettes : plus de 6 000 idées',
    texte: 'Le catalogue complet : plats, entrées, desserts, cuisines du monde, recettes protéinées, rapides ou économiques. Touchez une recette pour voir les ingrédients, les étapes, les calories et le coût par portion.' },
  { emoji: '🔎', route: '/recettes', cibles: ['recettes-recherche'],
    titre: 'Cherchez un plat ou un ingrédient',
    texte: 'Tapez « saumon », « curry » ou « courgette » : la recherche porte sur les titres et sur les ingrédients, sans tenir compte des accents.' },
  { emoji: '🎚️', route: '/recettes', cibles: ['recettes-filtres'],
    titre: 'Triez et filtrez',
    texte: 'Triez par prix, temps, calories ou protéines, choisissez une cuisine, puis ouvrez « Plus de filtres » pour le temps de préparation, le budget, la saison, l’appareil de cuisson et vos régimes (végétarien, sans gluten, halal…).',
    astuce: 'Les raccourcis « Riches en protéines », « Recettes rapides » et « Batch cooking » sont en haut de la page.' },
  { emoji: '💡', route: '/recettes', cibles: ['recettes-demande'],
    titre: 'Une recette vous manque ?',
    texte: 'Demandez-la ! Indiquez le nom du plat et quelques précisions : nous étudions chaque demande et ajoutons régulièrement de nouvelles recettes au catalogue.' },
  { emoji: '♥', route: '/favoris',
    titre: 'Vos favoris',
    texte: 'Touchez le cœur d’une recette pour la retrouver ici. Plus vous aimez ou écartez de plats, mieux le moteur connaît vos goûts pour composer les prochaines semaines.' },
  { emoji: '💶', route: '/budget',
    titre: 'Votre budget',
    texte: 'Suivez ce que coûtent vos semaines, fixez un budget cible et ajustez le prix des ingrédients à vos habitudes d’achat pour des estimations au plus près de la réalité.' },
  { emoji: '⚙️', route: '/budget', cibles: ['menu-user', 'nav-compte'],
    titre: 'Votre compte et vos réglages',
    texte: 'Dans ce menu : profil et objectif nutritionnel, régimes, allergies et aliments détestés, foyer et membres de la famille, abonnement, et la relance de cette visite.',
    astuce: 'Changez vos préférences quand vous voulez : la prochaine optimisation en tient compte.' },
  { emoji: '🎉', route: '/aujourdhui',
    titre: 'C’est à vous !',
    texte: 'Lancez « Optimiser ma semaine » depuis le Planning pour générer vos premiers menus. Un menu ne vous plaît pas ? Remplacez-le en un clic. Bon appétit !',
    astuce: 'Relancez cette visite à tout moment depuis le menu de votre compte → « Visite guidée ».' },
];

// ─── Composant ──────────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }

const MARGE = 8;
const LARGEUR_CARTE = 380;

/** Premier élément visible parmi les cibles (la nav desktop et la nav mobile coexistent dans le DOM). */
function trouverCible(cibles: string[] | undefined): HTMLElement | null {
  if (!cibles) return null;
  for (const c of cibles) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${c}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
}

function lireEtape(): number | null {
  try {
    const v = sessionStorage.getItem(CLE_ETAPE);
    if (v == null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n < ETAPES.length ? n : null;
  } catch { return null; }
}

export function VisiteGuidee() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [positionCarte, setPositionCarte] = useState<{ top: number; left: number } | null>(null);
  const carteRef = useRef<HTMLDivElement>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const userId = user?.id;
  const creeLe = user?.created_at;

  const terminer = useCallback(() => {
    try {
      sessionStorage.removeItem(CLE_ETAPE);
      if (userId) localStorage.setItem(cleUtilisateur(userId), 'fait');
    } catch { /* stockage indisponible */ }
    setIndex(null);
    setRect(null);
  }, [userId]);

  const aller = useCallback((n: number) => {
    if (n < 0) return;
    if (n >= ETAPES.length) { terminer(); return; }
    try { sessionStorage.setItem(CLE_ETAPE, String(n)); } catch { /* ignoré */ }
    setRect(null);
    setIndex(n);
    const route = ETAPES[n].route;
    if (!window.location.pathname.startsWith(route)) router.push(route);
  }, [router, terminer]);

  // Démarrage : visite en cours (changement de page), drapeau « à faire »
  // posé par l'onboarding, ou demande manuelle.
  useEffect(() => {
    if (!userId) return;
    const enCours = lireEtape();
    // Lecture du stockage forcément post-montage (absent côté serveur) : un
    // état initial paresseux romprait l'hydratation — même cas que CookieBanner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enCours != null) { setIndex(enCours); return; }
    try {
      const etat = localStorage.getItem(cleUtilisateur(userId));
      const recent = Date.now() - new Date(creeLe ?? 0).getTime() < 7 * 24 * 3600 * 1000;
      if (etat === 'a-faire' || (etat == null && recent)) aller(0);
    } catch { /* stockage indisponible */ }
  }, [userId, creeLe, aller]);

  useEffect(() => {
    const demarrer = () => aller(0);
    window.addEventListener(EVENEMENT, demarrer);
    return () => window.removeEventListener(EVENEMENT, demarrer);
  }, [aller]);

  // Une étape qui vit sur une autre page : on y navigue (rechargement en cours de visite)
  const etape = index != null ? ETAPES[index] : null;
  useEffect(() => {
    if (etape && !pathname.startsWith(etape.route)) router.push(etape.route);
  }, [etape, pathname, router]);

  // Mise en lumière : attend l'apparition de la cible (page qui charge), puis suit sa position
  useEffect(() => {
    if (!etape || !pathname.startsWith(etape.route)) return;
    let vivant = true;
    let essais = 0;
    let cible: HTMLElement | null = null;
    let raf = 0;

    const mesurer = () => {
      if (!vivant || !cible) return;
      const r = cible.getBoundingClientRect();
      // Élément plus haut que la moitié de l'écran (la semaine entière) : on
      // n'éclaire que son début, pour garder de la place à la carte d'explication.
      const hauteur = r.height > window.innerHeight * 0.5 ? window.innerHeight * 0.25 : r.height;
      setRect({ top: r.top - MARGE, left: r.left - MARGE, width: r.width + MARGE * 2, height: hauteur + MARGE * 2 });
    };
    const planifier = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mesurer); };

    const chercher = window.setInterval(() => {
      essais++;
      cible = trouverCible(etape.cibles);
      if (cible) {
        window.clearInterval(chercher);
        const haut = cible.getBoundingClientRect().height > window.innerHeight * 0.5;
        // Grand élément : on l'aligne en haut (sous la barre collante) plutôt qu'au centre
        cible.scrollIntoView({ block: haut ? 'start' : 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        if (haut) window.setTimeout(() => window.scrollBy({ top: -96, behavior: reduceMotion ? 'auto' : 'smooth' }), 50);
        mesurer();
        // la pose finale (défilement doux) met un instant à se stabiliser
        window.setTimeout(mesurer, 700);
      } else if (essais >= 16) {
        window.clearInterval(chercher); // absente : étape centrée
      }
    }, 150);

    window.addEventListener('resize', planifier);
    window.addEventListener('scroll', planifier, true);
    return () => {
      vivant = false;
      window.clearInterval(chercher);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', planifier);
      window.removeEventListener('scroll', planifier, true);
    };
  }, [etape, pathname, reduceMotion]);

  // Placement de la carte : au-dessus ou au-dessous de la cible selon la place
  useLayoutEffect(() => {
    if (!etape) return;
    const carte = carteRef.current;
    if (!carte) return;
    const h = carte.offsetHeight;
    const w = Math.min(LARGEUR_CARTE, window.innerWidth - 24);
    // La position dépend de la hauteur RÉELLE de la carte (mesurée dans le DOM) :
    // elle ne peut pas se dériver au rendu, d'où le setState en layout effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!rect) { setPositionCarte(null); return; }
    const vh = window.innerHeight;
    const dessous = rect.top + rect.height + 16 + h <= vh - 12;
    const top = dessous ? rect.top + rect.height + 16 : Math.max(12, rect.top - 16 - h);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 12);
    setPositionCarte({ top, left });
  }, [etape, rect]);

  // Échap = quitter ; focus sur le bouton principal à chaque étape
  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') terminer(); };
    document.addEventListener('keydown', onKey);
    boutonRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [index, terminer]);

  if (etape == null || index == null || !pathname.startsWith(etape.route)) return null;

  const derniere = index === ETAPES.length - 1;
  const centree = !rect || !positionCarte;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Visite guidée">
      {/* Fond : bloque les clics hors visite ; sans cible, il assombrit tout l'écran */}
      <div className={cn('absolute inset-0', !rect && 'bg-gray-900/55 backdrop-blur-[1px]')} aria-hidden />

      {/* Projecteur : l'élément ciblé reste lumineux, le reste s'assombrit */}
      {rect && (
        <div aria-hidden
          className={cn('absolute rounded-2xl ring-2 ring-brand-400 pointer-events-none', !reduceMotion && 'transition-all duration-300')}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgba(28, 20, 12, 0.6)' }} />
      )}

      <div ref={carteRef} aria-live="polite"
        className={cn(
          'absolute bg-white rounded-3xl shadow-2xl border border-gray-200 p-5 sm:p-6',
          centree && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          !reduceMotion && 'transition-[top,left] duration-300'
        )}
        style={{ width: `min(${LARGEUR_CARTE}px, calc(100vw - 24px))`, ...(centree ? {} : positionCarte ?? {}) }}>

        <button onClick={terminer} aria-label="Quitter la visite guidée"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4" />
        </button>

        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500">
          Étape {index + 1} sur {ETAPES.length}
        </p>
        <h2 className="mt-1.5 pr-8 font-display font-bold text-xl text-gray-900 leading-snug">
          <span aria-hidden>{etape.emoji} </span>{etape.titre}
        </h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{etape.texte}</p>
        {etape.astuce && (
          <p className="mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2 text-[13px] text-brand-800 leading-snug">
            <span className="font-semibold">💡 Astuce · </span>{etape.astuce}
          </p>
        )}

        {/* Progression */}
        <div className="mt-4 flex items-center gap-1" role="presentation">
          {ETAPES.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-brand-500' : i < index ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-gray-200')} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {index === 0 ? (
            <button onClick={terminer} className="min-h-[44px] px-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Passer la visite
            </button>
          ) : (
            <button onClick={() => aller(index - 1)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Précédent
            </button>
          )}
          <button ref={boutonRef} onClick={() => aller(index + 1)}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 shadow-cta transition-colors">
            {derniere ? 'Terminer' : index === 0 ? 'C’est parti' : 'Suivant'}
            {!derniere && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

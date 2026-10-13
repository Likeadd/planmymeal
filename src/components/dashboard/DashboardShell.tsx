'use client';

// ============================================================================
// DashboardShell — coquille de navigation du dashboard (maquette validée).
//
// Desktop (≥ lg) : TOPBAR collante — logo à gauche, nav centrale en liens
//   micro-caps espacés (Planning · Frigo · Recettes — Favoris / Budget / Compte
//   vivent dans le menu utilisateur, dropdown de l'avatar),
//   actions à droite (badge plan, avatar terracotta + menu déroulant, Optimiser).
// Mobile / tablette (< lg) : topbar compacte + bottom-nav 4 onglets.
// Charte LANDING : brand terracotta (actif, CTA), accent lavande (badge
// courses), crème (fonds) — topbar crème + wordmark serif comme la landing,
// pilules et CTA arrondis (rounded-full). Fontes Tailwind existantes.
// Composant présentation : état actif = pathname, props = contenu/actions.
// ============================================================================

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDays, Refrigerator, BookOpen, Star, Wallet,
  Settings, Sparkles, Crown, Users, Home, History, Compass,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/components/AuthProvider';
import { MenuUtilisateur, lienNavSouligne, nomAffiche } from '@/components/NavPartagee';
import { OptimiserButton } from '@/components/dashboard/OptimiserBar';
import { cn } from '@/lib/utils';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { VisiteGuidee, lancerVisiteGuidee } from '@/components/VisiteGuidee';
import { Paywall } from '@/components/Paywall';

export function DashboardShell({
  children,
  onRegenerate,
  regenerating,
  showRegenerate,
  libelleRegenerate,
}: {
  children: React.ReactNode;
  /** CTA « Optimiser ma semaine » de la topbar (semaine affichée), avec l'intention choisie au clic */
  onRegenerate?: (intention?: import('@/lib/rotation-engine').IntentionOptimisation) => void;
  regenerating?: boolean;
  showRegenerate?: boolean;
  /** Libellé du CTA (« Optimiser cette semaine » hors semaine en cours) */
  libelleRegenerate?: string;
}) {
  // Visiteur NON connecté (pages publiques : catalogue, fiches recettes) :
  // en-tête et pied de page du site, pas la navigation de l'application —
  // ses onglets (Planning, Frigo, Compte) ne mènent qu'à la page de connexion.
  const { user, loading } = useAuth();
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LandingHeader />
        {/* Même largeur que l'en-tête du site : logo et titres alignés */}
        <main id="contenu" className="[&_.container-app]:max-w-7xl">{children}</main>
        <LandingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Desktop : topbar ─────────────────────────────────────────── */}
      <Topbar onRegenerate={onRegenerate} regenerating={regenerating} showRegenerate={showRegenerate} libelle={libelleRegenerate} />
      {/* ── Mobile : topbar compacte (lg:hidden) ── */}
      <MobileTopbar />

      <main id="contenu" className="pb-20 lg:pb-0">{children}</main>

      {/* ── Mobile : bottom-nav 4 onglets ────────────────────────────── */}
      <BottomNav />

      {/* Parcours d'intégration : étapes sur tous les écrans de l'app */}
      <VisiteGuidee />
      {/* Offre d'abonnement (limites du plan gratuit, fonctions réservées) */}
      <Paywall />
    </div>
  );
}

// ─── Topbar (desktop ≥ lg) ──────────────────────────────────────────────────

// Nav : « Aujourd'hui » (écran d'accueil quotidien) puis les 3 espaces de
// travail. Favoris / Budget / Compte restent dans le menu utilisateur.
const NAV_ITEMS = [
  { href: '/aujourdhui', label: "Aujourd'hui", icon: Home, match: ['/aujourdhui'] },
  { href: '/dashboard', label: 'Planning', icon: CalendarDays, match: ['/dashboard'] },
  { href: '/frigo', label: 'Frigo', icon: Refrigerator, match: ['/frigo'] },
  { href: '/recettes', label: 'Recettes', icon: BookOpen, match: ['/recettes', '/recette'] },
];

type NavItem = (typeof NAV_ITEMS)[number];

function Topbar({ onRegenerate, regenerating, showRegenerate, libelle }: {
  onRegenerate?: (intention?: import('@/lib/rotation-engine').IntentionOptimisation) => void;
  regenerating?: boolean;
  showRegenerate?: boolean;
  libelle?: string;
}) {
  return (
    <header className="hidden lg:block sticky top-0 z-30 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
      {/* Alignement topbar ↔ contenu : mêmes bornes que .container-app
          (max-w-6xl + px-4/6/8), sinon le logo et la nav ne s'alignent pas
          avec les titres des pages en dessous. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        {/* Logo à gauche — BrandMark (identité unique dérivée de la landing) */}
        <BrandMark href="/" height={34} className="shrink-0" />

        {/* Nav centrale : liens micro-caps espacés comme la landing (gap-6/9) */}
        <nav aria-label="Navigation principale" className="flex-1 flex items-center justify-center gap-6 lg:gap-9 min-w-0">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Actions à droite : plan, avatar terracotta + menu, optimiser */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PlanChip />
          <UserMenu />
          {showRegenerate && (
            <OptimiserButton onOptimiser={intention => onRegenerate?.(intention)} loading={!!regenerating} libelle={libelle} />
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.match.some(m => pathname.startsWith(m));

  // Style identique aux liens de la landing : micro-caps espacées +
  // soulignement animé au survol (`lienNavSouligne`, même helper qu'elle) —
  // actif = terracotta souligné en permanence, survol = le trait grandit.
  return (
    <Link href={item.href} data-tour={`nav-${item.href.slice(1)}`}
      className={cn(lienNavSouligne(active), 'whitespace-nowrap')}>
      {item.label}
    </Link>
  );
}

// ─── Menu utilisateur (avatar terracotta + dropdown, comme la landing) ──────
// Le mécanisme vit dans NavPartagee ; ici seulement les liens propres au
// dashboard et la redirection après déconnexion.

function UserMenu() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  if (!profile) return null;
  return (
    <MenuUtilisateur
      nom={nomAffiche(profile.full_name, profile.email)}
      email={profile.email}
      liens={[
        { href: '/compte', label: 'Mon compte', icon: Settings },
        { href: '/favoris', label: 'Favoris', icon: Star },
        { href: '/planning', label: 'Historique des semaines', icon: History },
        { href: '/budget', label: 'Budget', icon: Wallet },
      ]}
      actions={[{ label: 'Visite guidée', icon: Compass, onClick: lancerVisiteGuidee }]}
      surDeconnexion={async () => {
        await signOut();
        router.push('/');
      }}
    />
  );
}

function PlanChip() {
  const { profile, isPro, isFamille } = useAuth();
  if (!profile) return null;
  if (profile.plan === 'gratuit')
    return (
      <Link href="/compte" title="Passer Pro — desserts, batch cooking, budget…"
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase rounded-full bg-brand-500 text-white shadow-cta hover:bg-brand-600 transition-colors">
        <Sparkles className="w-3 h-3" /> Pro
      </Link>
    );
  if (isPro)
    return (
      <Link href="/compte" title="Plan Pro"
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors">
        <Crown className="w-3 h-3" /> Pro
      </Link>
    );
  if (isFamille)
    return (
      <Link href="/compte" title="Plan Famille"
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase rounded-full bg-accent-100 text-accent-700 hover:bg-accent-200 transition-colors">
        <Users className="w-3 h-3" /> Famille
      </Link>
    );
  return null;
}


// ─── Topbar mobile (< lg) ───────────────────────────────────────────────────

function MobileTopbar() {
  const { profile } = useAuth();
  return (
    <header className="lg:hidden sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <BrandMark href="/aujourdhui" height={30} className="py-2.5 -my-2.5" />
        {profile?.plan && profile.plan !== 'gratuit' && (
          <Link href="/compte" title="Mon abonnement"
            className="flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-bold bg-brand-100 text-brand-700 rounded-full">
            <Crown className="w-3 h-3" />{profile.plan === 'famille' ? 'Famille' : 'Pro'}
          </Link>
        )}
        {/* Pas de bouton Optimiser ici : la fiche fixée (OptimiserBar) est
            l'unique point d'entrée mobile — un seul bouton, jamais deux qui
            rivalisent (audit UX : limiter les actions visibles). */}
      </div>
    </header>
  );
}

// ─── Bottom-nav (mobile < lg) ───────────────────────────────────────────────

function BottomNav() {
  const pathname = usePathname();
  const items: Array<{ href: string; label: string; icon: typeof CalendarDays; match: string[] }> = [
    { href: '/aujourdhui', label: "Aujourd'hui", icon: Home, match: ['/aujourdhui'] },
    { href: '/dashboard', label: 'Planning', icon: CalendarDays, match: ['/dashboard'] },
    { href: '/frigo', label: 'Frigo', icon: Refrigerator, match: ['/frigo'] },
    { href: '/recettes', label: 'Recettes', icon: BookOpen, match: ['/recettes'] },
    { href: '/compte', label: 'Mon compte', icon: Settings, match: ['/compte'] },
  ];

  return (
    <>
      <nav aria-label="Navigation mobile" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-creme-50 border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around px-2 py-1.5">
          {items.map(item => {
            const active = item.match.some(m => pathname.startsWith(m));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} data-tour={`nav-${item.href.slice(1)}`}
                className={cn(
                  // min-w-[44px] : 5 onglets → chaque cible reste tactile (audit)
                  'flex flex-col items-center gap-0.5 min-w-[44px] px-2 py-1 rounded-xl text-[11px] font-bold transition-colors',
                  active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-600'
                )}>
                <span className="relative">
                  <Icon className="w-5 h-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, UserCircle, LogOut, LayoutDashboard,
  Star, BookOpen, Calendar, Settings,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/components/AuthProvider';
import { MenuUtilisateur, lienNavSouligne, nomAffiche } from '@/components/NavPartagee';

/** Lien de nav : voir NavPartagee — l'implémentation unique du trait. */
const lienNav = lienNavSouligne;

// Nav gauche : sections de la landing. // Nav droite : Tarifs + FAQ, de
// l'autre côté du logo (équilibre visuel de la navbar 1fr / auto / 1fr).
const NAV_LINKS = [
  ['Fonctionnalités', '/#fonctionnalites'],
  ['Recettes', '/recettes'],
];

const NAV_LINKS_DROITE = [
  ['Tarifs', '/#tarifs'],
  ['FAQ', '/faq'],
];

const ACCOUNT_LINKS = [
  { href: '/aujourdhui', label: "Aujourd'hui", icon: LayoutDashboard },
  { href: '/favoris', label: 'Favoris', icon: Star },
  { href: '/recettes', label: 'Recettes', icon: BookOpen },
  { href: '/dashboard', label: 'Mon planning', icon: Calendar },
  { href: '/planning', label: 'Historique', icon: Calendar },
  { href: '/compte', label: 'Mon compte', icon: Settings },
];

export default function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const isLoggedIn = !loading && !!user;
  const userName = nomAffiche(profile?.full_name, user?.email);

  return (
    <header className="sticky top-0 z-50 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-20">
          {/* Nav gauche */}
          <div className="flex items-center">
            <button
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-800" /> : <Menu className="w-5 h-5 text-gray-800" />}
            </button>
            {/* gap-4 sur écrans moyens (md→lg), aéré seulement à partir de lg */}
            <nav className="hidden lg:flex items-center gap-4 lg:gap-9">
              {NAV_LINKS.map(([label, href]) => (
                <Link key={href} href={href} className={lienNav(pathname === href)}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Logo centré */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5 text-accent-400" aria-hidden>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-accent-300" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            </div>
            {/* Identité canonique : logotype BrandMark — le même bloc que toutes
                les autres pages via le composant partagé. */}
            <BrandMark href="/" height={34} />
            <span className="text-[11px] tracking-[0.3em] uppercase text-gray-500">
              Planification de repas
            </span>
          </div>

          {/* Actions droite : liens Tarifs/FAQ puis auth */}
          <div className="hidden lg:flex items-center justify-end gap-6">
            <nav className="flex items-center gap-4 lg:gap-9">
              {NAV_LINKS_DROITE.map(([label, href]) => (
                <Link key={href} href={href} className={lienNav(pathname === href)}>
                  {label}
                </Link>
              ))}
            </nav>
            {isLoggedIn ? (
              /* Menu utilisateur partagé (NavPartagee) : avatar, dropdown,
                 trait animé sous les libellés, déconnexion. La landing ferme
                 aussi son menu mobile à la déconnexion. */
              <MenuUtilisateur
                nom={userName}
                email={user?.email}
                liens={ACCOUNT_LINKS}
                nomToujoursVisible
                surDeconnexion={() => { setMobileMenuOpen(false); signOut(); }}
              />
            ) : (
              <>
                <Link href="/login"
                  className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-800 hover:text-brand-600 transition-colors">
                  Connexion
                </Link>
                <Link href="/signup"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-500 text-white text-[11px] font-semibold tracking-[0.14em] uppercase rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                  Optimiser ma semaine
                </Link>
              </>
            )}
          </div>

          {/* Mobile : l'action principale reste visible sans ouvrir le menu */}
          <div className="lg:hidden flex justify-end">
            {!isLoggedIn && (
              <Link href="/signup"
                className="inline-flex items-center px-3.5 py-2 bg-brand-500 text-white text-[10px] font-semibold tracking-[0.12em] uppercase rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                Optimiser
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-gray-50">
          <div className="px-4 py-4 space-y-4">
            {[...NAV_LINKS, ...NAV_LINKS_DROITE].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                className={`block text-[11px] font-semibold tracking-[0.18em] uppercase py-1 ${
                  pathname === href ? 'text-brand-600' : 'text-gray-800'
                }`}>
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-200 flex flex-col gap-2.5">
              {isLoggedIn ? (
                <>
                  <Link href="/aujourdhui" onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 text-sm font-medium text-gray-800 py-2.5 rounded-full border border-gray-300">
                    <UserCircle className="w-5 h-5 text-brand-500" />
                    {userName}
                  </Link>
                  <Link href="/compte" onClick={() => setMobileMenuOpen(false)}
                    className="block text-center text-sm font-medium text-gray-800 py-2.5 rounded-full border border-gray-300">
                    Mon compte
                  </Link>
                  <button onClick={() => { setMobileMenuOpen(false); signOut(); }}
                    className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 py-2.5 rounded-full border border-brand-200">
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}
                    className="block text-center text-sm font-medium text-gray-800 py-2.5 rounded-full border border-gray-300">
                    Connexion
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}
                    className="block text-center text-sm font-semibold text-white bg-brand-500 py-2.5 rounded-full">
                    Optimiser ma semaine
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

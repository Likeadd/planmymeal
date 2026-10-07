import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Taille max d'un corps de requête API (aucun upload de fichier dans l'app). */
const TAILLE_MAX_API = 1_000_000; // 1 Mo
/** Durée de vie absolue d'une session : reconnexion obligatoire au-delà. */
const SESSION_MAX_MS = 30 * 24 * 60 * 60_000; // 30 jours
const METHODES_SURES = ['GET', 'HEAD', 'OPTIONS'];
/** Pages réservées aux connectés, et pages de connexion (redirigées si déjà connecté). */
const PAGES_PROTEGEES = ['/aujourdhui', '/dashboard', '/onboarding', '/compte', '/planning', '/favoris', '/frigo', '/budget'];
const PAGES_AUTH = ['/login', '/signup'];

/**
 * Garde des routes API (sans appel réseau) :
 *  - CORS/CSRF : une requête d'écriture venant d'une autre origine est refusée ;
 *  - taille max du corps de requête.
 * Les en-têtes Access-Control-* ne sont jamais émis → le navigateur bloque
 * toute lecture cross-origin.
 */
function gardeApi(request: NextRequest): NextResponse | null {
  if (METHODES_SURES.includes(request.method)) return null;

  const origin = request.headers.get('origin');
  // Sec-Fetch-Site : envoyé par tous les navigateurs récents, même quand
  // Origin est absent — « cross-site » = requête forgée depuis un autre site.
  const site = request.headers.get('sec-fetch-site');
  if ((origin && origin !== request.nextUrl.origin) || site === 'cross-site') {
    console.warn('[security]', JSON.stringify({ type: 'csrf', origin, site, route: request.nextUrl.pathname }));
    return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
  }

  // Corps sans Content-Length (chunked) : taille invérifiable → refusé.
  if (!request.headers.get('content-length') && request.headers.get('transfer-encoding')) {
    return NextResponse.json({ error: 'Longueur de requête requise' }, { status: 411 });
  }
  const taille = Number(request.headers.get('content-length') ?? 0);
  if (taille > TAILLE_MAX_API) {
    console.warn('[security]', JSON.stringify({ type: 'payload_too_large', taille, route: request.nextUrl.pathname }));
    return NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 });
  }
  return null;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return gardeApi(request) ?? NextResponse.next();
  }

  // Pages publiques (accueil, recettes, FAQ…) : aucune décision d'auth ici et
  // aucune ne lit la session côté serveur → pas d'appel réseau à Supabase Auth
  // (getUser) à chaque navigation ni à chaque préchargement de lien.
  const p = request.nextUrl.pathname;
  if (![...PAGES_PROTEGEES, ...PAGES_AUTH].some(r => p.startsWith(r))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Session expirée (durée absolue) ou email non confirmé → déconnexion
  if (user) {
    const derniereConnexion = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
    const expiree = Date.now() - derniereConnexion > SESSION_MAX_MS;
    if (expiree || !user.email_confirmed_at) {
      await supabase.auth.signOut();
      const redirect = NextResponse.redirect(
        new URL(`/login?error=${expiree ? 'session' : 'confirmation'}`, request.url)
      );
      // Propage l'effacement des cookies de session posé par signOut()
      supabaseResponse.cookies.getAll().forEach(c => redirect.cookies.set(c));
      return redirect;
    }
  }

  // Routes protégées : login requis
  const isProtected = PAGES_PROTEGEES.some(p => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Source de vérité serveur : l'état d'onboarding est relu en base (pas
  // d'état client susceptible d'être périmé). Sans ce garde, une requête
  // « profiles » perdue côté client renvoyait un utilisateur DÉJÀ onboardé
  // vers /onboarding (course observée en E2E). Lu UNIQUEMENT sur les routes
  // qui en dépendent : ailleurs, c'était un aller-retour base inutile à
  // chaque navigation.
  const pathname = request.nextUrl.pathname;
  const dependOnboarding = ['/onboarding', '/dashboard', '/aujourdhui'].some(p => pathname.startsWith(p));
  if (user && dependOnboarding) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();

    const onboardé = profile?.onboarding_complete === true;

    // Déjà onboardé qui retombe sur /onboarding → page d'accueil quotidienne
    // (corrige la mauvaise décision prise côté client pendant la course du login).
    if (onboardé && request.nextUrl.pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/aujourdhui', request.url));
    }
    // Incomplet qui tente le dashboard → onboarding (filet existant, désormais
    // explicite : /dashboard exige un profil complet pour être utile).
    if (!onboardé && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/aujourdhui'))) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  // Routes auth : rediriger si déjà connecté → page d'accueil quotidienne
  const isAuthPage = PAGES_AUTH.some(p => request.nextUrl.pathname.startsWith(p));
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/aujourdhui', request.url));
  }

  return supabaseResponse;
}

// Pages : redirections auth. API : seulement gardeApi (origine + taille) —
// elles gèrent leur propre auth via getUser. On exclut le callback /auth
// (route serveur), le sitemap/robots et tous les assets statiques.
export const config = {
  matcher: [
    '/((?!auth/|_next/static|_next/image|favicon\.ico|sitemap\.xml|robots\.txt|manifest\.webmanifest|sw\.js|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml|js)$).*)',
  ],
};
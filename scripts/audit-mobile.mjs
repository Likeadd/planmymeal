// ============================================================================
// Audit mobile — dashboard, recettes et frigo.
//
// Émulation fidèle (iPhone 13 : 390×844, DPR 3, tactile) + mesures
// géométriques RÉELLES, page par page :
//   - hauteur de page, tout débordement horizontal ;
//   - scan générique des cibles tactiles < 40 px (reco ≥ 44) parmi TOUS les
//     éléments interactifs — pas seulement ceux qu'on pense petits ;
//   - empilement du header de chaque page (distance du 1er contenu réel) ;
//   - /recettes : le panneau « Plus de filtres » est OUVERT avant le scan.
// Usage : node scripts/audit-mobile.mjs   (serveur démarré)
// Sortie : rapport chiffré console + screenshots/audit-mobile-<page>.png
// Session persistée dans .pf-session.json (gitignoré) : une seule connexion.
// ============================================================================

import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const BASE = process.env.PF_URL || 'http://localhost:3000';
mkdirSync('screenshots', { recursive: true });
const SESSION = '.pf-session.json'; // session persistée entre les audits
const LIMITE_LOGIN_MS = 180_000; // 3 min pour se connecter

const dejaConnecte = existsSync(SESSION);
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  ...devices['iPhone 13'], locale: 'fr-FR',
  ...(dejaConnecte ? { storageState: SESSION } : {}),
});
const page = await ctx.newPage();

if (dejaConnecte) {
  console.log('🔑 Session réutilisée (' + SESSION + ') — pas de connexion nécessaire.');
} else {
  console.log('🔐 Fenêtre mobile (iPhone 13 — 390×844) ouverte sur le dashboard.');
  console.log('   → Connecte-toi, l\'audit démarre tout seul (3 min max).');
}

// Destination directe : le dashboard. Si la session réutilisée est valide,
// pas d'écran de login du tout ; sinon la redirection /login déclenche
// l'attente de connexion manuelle ci-dessous.
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
} catch {
  console.log(`⚠ Impossible d'atteindre ${BASE} — le serveur est-il démarré ?`);
  await browser.close();
  process.exit(1);
}

if (new URL(page.url()).pathname.startsWith('/login')) {
  if (dejaConnecte) console.log('🔐 Session expirée — connecte-toi (3 min max).');
  const debut = Date.now();
  let connecte = false;
  while (Date.now() - debut < LIMITE_LOGIN_MS) {
    if (!new URL(page.url()).pathname.startsWith('/login')) { connecte = true; break; }
    await page.waitForTimeout(1000);
  }
  if (!connecte) { console.log('⏱ Temps écoulé — audit annulé.'); await browser.close(); process.exit(1); }

  // Compte incomplet : on laisse finir l'onboarding avant de mesurer
  if (new URL(page.url()).pathname.startsWith('/onboarding')) {
    console.log('⚠ Onboarding incomplet — termine-le (3 min max).');
    const d2 = Date.now();
    while (Date.now() - d2 < LIMITE_LOGIN_MS) {
      if (!new URL(page.url()).pathname.startsWith('/onboarding')) break;
      await page.waitForTimeout(1000);
    }
  }
}
console.log('✅ Connecté →', page.url());
await ctx.storageState({ path: SESSION }).catch(() => {}); // réutilisable au prochain audit

// ── Mesures communes (exécutées dans la page) ────────────────────────────────
const MESURES_COMMUNES = () => {
  const rect = (el) => {
    if (!el) return null; // sélecteur absent sur cette page / état vide
    const b = el.getBoundingClientRect();
    return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) };
  };
  const parTexte = (txt, sel = 'button, a') => {
    const el = [...document.querySelectorAll(sel)].find(e => (e.textContent || '').trim().includes(txt));
    return el ? rect(el) : null;
  };
  // no-op utilisé par les mesures spécifiques via u.rect(querySelector(...)) :
  // les sélecteurs absents renvoient null SANS faire planter l'audit.
  const parPlaceholder = (debut) => {
    const el = [...document.querySelectorAll('input')].find(e => (e.placeholder || '').startsWith(debut));
    return el ? rect(el) : null;
  };
  // Scan générique : tout élément interactif plus petit que 40px de côté
  const petitesCibles = () => {
    const out = [];
    document.querySelectorAll('button, a, select, [role="tab"], [role="button"]').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return; // masqué / sr-only
      const cote = Math.min(b.width, b.height);
      if (cote >= 40) return;
      out.push({
        cote: Math.round(cote), w: Math.round(b.width), h: Math.round(b.height),
        quoi: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 32),
        tag: el.tagName.toLowerCase(),
      });
    });
    out.sort((a, b) => a.cote - b.cote);
    return out.slice(0, 8);
  };
  return {
    page: { hauteurPx: document.documentElement.scrollHeight, largeurPx: document.documentElement.scrollWidth, viewport: innerWidth },
    h1: document.querySelector('h1') ? rect(document.querySelector('h1')) : null,
    petitesCibles: petitesCibles(),
    utiles: { parTexte, parPlaceholder, rect },
  };
};

// Mesures spécifiques par page (réutilisent les helpers communs)
const MESURE_DASHBOARD = (u) => ({
  empilement: {
    statsLigne: u.rect(document.querySelector('main .rounded-3xl')),
    jours: u.rect(document.querySelector('[role="tablist"]')),
    premiereCarte: u.rect(document.querySelector('[role="tabpanel"] > div.grid > div')),
  },
});

const MESURE_RECETTES = (u) => ({
  empilement: {
    soustitre: u.rect(document.querySelector('h1 + p')),
    puceType: u.parTexte('Tous'),
    selectCuisine: u.rect(document.querySelector('select')),
    plusDeFiltres: u.parTexte('Plus de filtres'),
    recherche: u.parPlaceholder('Rechercher un plat'),
    premiereCarte: u.rect(document.querySelector('a[href^="/recette/"]')),
  },
  cartesRendues: document.querySelectorAll('a[href^="/recette/"]').length,
});

const MESURE_FRIGO = (u) => ({
  empilement: {
    ajoutsRapides: u.parTexte('Ajouts rapides'),
    recherche: u.parPlaceholder('Rechercher un ingrédient'),
    premierItem: u.rect(document.querySelector('button[aria-label^="Retirer"]')),
  },
});

// ── Audit d'une page ─────────────────────────────────────────────────────────
async function auditPage({ chemin, nom, avantMesure, mesureSpecifique, attente }) {
  try {
    await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle', timeout: 60_000 });
  } catch { /* la page répond malgré le timeout networkidle — on mesure quand même */ }
  await page.waitForTimeout(1500);
  if (attente) await attente();
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  if (avantMesure) await avantMesure();
  // Mesure déterministe : repli en haut de page (un scroll résiduel fausserait
  // les distances mesurées).
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const m = await page.evaluate(({ communStr, specStr }) => {
    const commun = eval(`(${communStr})`)();
    return { ...commun, spec: eval(`(${specStr})`)(commun.utiles) };
  }, { communStr: MESURES_COMMUNES.toString(), specStr: mesureSpecifique.toString() }).catch(e => ({ erreur: String(e) }));

  // Rapport
  console.log(`\n════════ ${nom.toUpperCase()} (${chemin}) ════════`);
  if (m.erreur) { console.log('  ⚠ mesure impossible :', m.erreur); return; }
  const deborde = m.page.largeurPx > m.page.viewport;
  console.log(`Page : ${m.page.hauteurPx}px de haut` +
    (deborde ? `  ⚠ DÉBORDEMENT horizontal (+${m.page.largeurPx - m.page.viewport}px)` : '  ✓ pas de scroll horizontal'));
  if (m.h1) console.log(`h1 : y=${m.h1.y} h=${m.h1.h}`);

  const e = m.spec?.empilement || {};
  for (const [nomEl, v] of Object.entries(e)) {
    console.log(`  ${nomEl.padEnd(14)} ${v ? `y=${String(v.y).padStart(4)}  h=${String(v.h).padStart(3)}` : 'absent'}`);
  }
  if (m.spec?.cartesRendues != null) console.log(`  cartes rendues : ${m.spec.cartesRendues}`);

  if (m.petitesCibles.length === 0) {
    console.log('  Cibles tactiles : ✓ toutes ≥ 40px');
  } else {
    console.log(`  Cibles tactiles < 40px (${m.petitesCibles.length} pires) :`);
    for (const c of m.petitesCibles) {
      console.log(`    ⚠ ${c.cote}px (${c.w}×${c.h}) <${c.tag}> "${c.quoi}"`);
    }
  }

  await page.screenshot({ path: `screenshots/audit-mobile-${nom}.png` });
  await page.screenshot({ path: `screenshots/audit-mobile-${nom}-entiere.png`, fullPage: true });
  console.log(`  📸 screenshots/audit-mobile-${nom}.png (+ page entière)`);
}

// ── Série d'audits ───────────────────────────────────────────────────────────
await auditPage({
  chemin: '/dashboard', nom: 'dashboard',
  mesureSpecifique: MESURE_DASHBOARD.toString(),
});

await auditPage({
  chemin: '/recettes', nom: 'recettes',
  attente: () => page.waitForSelector('a[href^="/recette/"]', { timeout: 30_000 }).catch(() => {}),
  // Le panneau avancé est OUVERT pendant le scan : ses puces de filtre
  // font partie des cibles tactiles à évaluer.
  avantMesure: async () => {
    const bouton = page.getByRole('button', { name: /Plus de filtres/ });
    if (await bouton.count() > 0) await bouton.first().click().catch(() => {});
    await page.waitForTimeout(500);
  },
  mesureSpecifique: MESURE_RECETTES.toString(),
});

await auditPage({
  chemin: '/frigo', nom: 'frigo',
  mesureSpecifique: MESURE_FRIGO.toString(),
});

await browser.close();
console.log('\nTerminé — rapport ci-dessus + captures dans screenshots/.');

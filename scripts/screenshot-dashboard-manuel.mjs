// ============================================================================
// Capture du dashboard AVEC CONNEXION MANUELLE.
//
// Ouvre une fenêtre Chromium visible sur la page /login : l'utilisateur se
// connecte lui-même (aucun mot de passe partagé), puis les captures partent
// automatiquement dès que l'URL quitte /login.
// Usage : node scripts/screenshot-dashboard-manuel.mjs   (serveur démarré)
// Sortie : screenshots/app-dashboard*.png, screenshots/app-recettes*.png
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.PF_URL || 'http://localhost:3000';
mkdirSync('screenshots', { recursive: true });

const LIMITE_LOGIN_MS = 180_000; // 3 min pour se connecter

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const page = await ctx.newPage();

console.log('🔐 Une fenêtre Chromium vient de s\'ouvrir sur la page de connexion.');
console.log('   → Connecte-toi avec ton compte (déjà onboardé de préférence).');
console.log('   → Les captures partent TOUTE SEULE dès la connexion (3 min max).');

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
} catch {
  console.log(`⚠ Impossible d'atteindre ${BASE} — le serveur est-il démarré ?`);
  await browser.close();
  process.exit(1);
}

// Attente active de la fin du login (poll de l'URL — robuste aux redirections)
const debut = Date.now();
let connecte = false;
while (Date.now() - debut < LIMITE_LOGIN_MS) {
  if (!new URL(page.url()).pathname.startsWith('/login')) { connecte = true; break; }
  await page.waitForTimeout(1000);
}
if (!connecte) {
  console.log('⏱ Temps écoulé sans connexion — capture dashboard annulée.');
  await browser.close();
  process.exit(1);
}
console.log('✅ Connecté →', page.url());

// Compte incomplet : on laisse finir l'onboarding avant de capturer
if (new URL(page.url()).pathname.startsWith('/onboarding')) {
  console.log('⚠ Onboarding incomplet — termine-le dans la fenêtre, capture après (3 min max).');
  const d2 = Date.now();
  while (Date.now() - d2 < LIMITE_LOGIN_MS) {
    if (!new URL(page.url()).pathname.startsWith('/onboarding')) break;
    await page.waitForTimeout(1000);
  }
  console.log('✅ Onboarding terminé →', page.url());
}

// ── Captures desktop ────────────────────────────────────────────────────────
const captures = [
  { path: '/dashboard', file: 'screenshots/app-dashboard' },
  { path: '/recettes', file: 'screenshots/app-recettes' },
];

for (const { path, file } of captures) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60_000 });
  } catch { /* la page répond malgré le timeout networkidle — on capture quand même */ }
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.screenshot({ path: `${file}.png` });
  await page.screenshot({ path: `${file}-full.png`, fullPage: true });
  console.log(`✔ ${file}.png (+ version pleine page)`);
}

// ── Capture mobile (même session : viewport réduit, cookies conservés) ─────
await page.setViewportSize({ width: 390, height: 844 });
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 60_000 });
} catch { /* idem */ }
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/app-dashboard-mobile.png', fullPage: true });
console.log('✔ screenshots/app-dashboard-mobile.png');

await browser.close();
console.log('Terminé — captures dans screenshots/.');

// Captures de la landing — deux variantes :
//  • VISITEUR (défaut)  : CTA « Planifier ma semaine »
//  • CONNECTÉ (--connecte) : session persistée .pf-session.json, CTA
//    « Retourner à mes repas » (le hero change pour un utilisateur logué)
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const BASE = process.env.PF_URL || 'http://localhost:3000';
const CONNECTE = process.argv.includes('--connecte');
const SESSION = '.pf-session.json';
const suffixe = CONNECTE ? '-connecte' : '';
mkdirSync('screenshots', { recursive: true });

if (CONNECTE && !existsSync(SESSION)) {
  console.error(`✗ ${SESSION} introuvable — lance d'abord scripts/audit-mobile.mjs (connexion manuelle une fois).`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  ...(CONNECTE ? { storageState: SESSION } : {}),
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('h1');
await page.evaluate(() => document.fonts.ready);

// Vérifications visuelles programmatiques (palette terracotta / violet)
const checks = await page.evaluate(() => {
  const h1 = document.querySelector('h1');
  const cta = [...document.querySelectorAll('a')].find(a =>
    a.textContent.includes('Planifier ma semaine') || a.textContent.includes('Retourner à mes repas'));
  const accentSpan = h1?.querySelector('span');
  const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  return {
    titreHero: h1?.textContent?.replace(/\s+/g, ' ').trim(),
    cta: cta?.textContent?.replace(/\s+/g, ' ').trim(),
    ctaHref: cta?.getAttribute('href'),
    policeTitre: cs(h1, 'fontFamily'),
    couleurSouligne: cs(accentSpan, 'color'),
    couleurCTA: cs(cta, 'backgroundColor'),
    policeInterChargee: document.fonts.check('16px Inter'),
    nombreSections: document.querySelectorAll('section[id]').length,
  };
});

console.log(`--- Vérifications navigateur (1440x900)${CONNECTE ? ' — CONNECTÉ' : ''} ---`);
console.log(JSON.stringify(checks, null, 2));

// Garde-fou : la variante demandée doit correspondre au CTA rendu
if (CONNECTE && !checks.cta?.includes('Retourner à mes repas')) {
  console.error('✗ Session non reconnue : la page affiche encore le CTA visiteur.');
  await browser.close();
  process.exit(1);
}
if (!CONNECTE && !checks.cta?.includes('Planifier ma semaine')) {
  console.error('✗ Session détectée : passe --connecte pour capturer la variante connectée.');
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: `screenshots/landing-hero${suffixe}.png` });
console.log(`✔ screenshots/landing-hero${suffixe}.png (haut de page)`);

await page.screenshot({ path: `screenshots/landing${suffixe}.png`, fullPage: true });
console.log(`✔ screenshots/landing${suffixe}.png`);

// Version mobile
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  ...(CONNECTE ? { storageState: SESSION } : {}),
});
await mobile.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await mobile.waitForSelector('h1');
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: `screenshots/landing-mobile${suffixe}.png`, fullPage: true });
console.log(`✔ screenshots/landing-mobile${suffixe}.png`);

await browser.close();
console.log('Terminé.');

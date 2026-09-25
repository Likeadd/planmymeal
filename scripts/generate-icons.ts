// ============================================================================
// Génération des icônes et logos — PlanMyMeal
// Source unique : src/lib/brand.ts (tracés vectoriels du logo). Produit :
//   src/app/icon.svg                     favicon SVG (onglet du navigateur)
//   public/icons/icon-192.png, icon-512.png            icônes PWA
//   public/icons/icon-512-maskable.png   icône Android (zone de sécurité 80 %)
//   public/icons/apple-touch-icon.png    icône iOS (fond plein, 180×180)
//   public/brand/planmymeal.png          logotype terracotta (fond transparent)
//   public/brand/planmymeal-blanc.png    logotype crème (en-tête des emails)
// Rendu via Playwright (Edge / Chrome installés, sinon Chromium de Playwright).
//
// Usage : npm run icons
// ============================================================================

import { chromium, type Browser } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_P, ICON_LEAF, BRAND_CREME, BRAND_FEUILLE_CLAIRE, WORDMARK_RATIO, wordmarkSvg } from '../src/lib/brand';

const ROOT = join(__dirname, '..');
const ICONS = join(ROOT, 'public', 'icons');
const BRAND = join(ROOT, 'public', 'brand');

const DEGRADE = '<defs><linearGradient id="pf" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#CF7040"/><stop offset="1" stop-color="#A84422"/></linearGradient></defs>';
const MOTIF = `<path d="${ICON_P}" fill="${BRAND_CREME}"/><path d="${ICON_LEAF}" fill="${BRAND_FEUILLE_CLAIRE}"/>`;

/** Icône standard : carré arrondi (coins transparents) */
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${DEGRADE}<rect x="1" y="1" width="46" height="46" rx="13" fill="url(#pf)"/>${MOTIF}</svg>`;
/** Maskable : fond plein bord à bord, motif réduit dans la zone de sécurité */
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${DEGRADE}<rect width="48" height="48" fill="url(#pf)"/><g transform="translate(24 24) scale(0.78) translate(-24 -24)">${MOTIF}</g></svg>`;

const dataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

async function lancerNavigateur(): Promise<Browser> {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch { /* suivant */ }
  }
  throw new Error('Aucun navigateur disponible (installez Edge/Chrome ou lancez « npx playwright install chromium »)');
}

async function main() {
  mkdirSync(ICONS, { recursive: true });
  mkdirSync(BRAND, { recursive: true });
  writeFileSync(join(ROOT, 'src', 'app', 'icon.svg'), iconSvg);
  console.log('✅ src/app/icon.svg');

  const browser = await lancerNavigateur();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  const rendre = async (svg: string, w: number, h: number, fichier: string, fond?: string) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<body style="margin:0;background:${fond ?? 'transparent'}"><img id="i" src="${dataUrl(svg)}" width="${w}" height="${h}" style="display:block"></body>`,
      { waitUntil: 'load' }
    );
    const buf = await page.locator('#i').screenshot({ omitBackground: !fond });
    writeFileSync(fichier, buf);
    console.log(`✅ ${fichier.replace(ROOT + '\\', '').replace(ROOT + '/', '')} (${w}×${h})`);
  };

  await rendre(iconSvg, 192, 192, join(ICONS, 'icon-192.png'));
  await rendre(iconSvg, 512, 512, join(ICONS, 'icon-512.png'));
  await rendre(maskableSvg, 512, 512, join(ICONS, 'icon-512-maskable.png'), '#A84422');
  // iOS rend les transparences en noir → fond crème plein derrière les coins
  await rendre(iconSvg, 180, 180, join(ICONS, 'apple-touch-icon.png'), '#FBF8F1');

  // Logotypes PNG (2× : affichés à 36 px de haut dans les emails)
  const h = 72, w = Math.round(h * WORDMARK_RATIO);
  await rendre(wordmarkSvg('brand'), w, h, join(BRAND, 'planmymeal.png'));
  await rendre(wordmarkSvg('blanc'), w, h, join(BRAND, 'planmymeal-blanc.png'));

  await browser.close();
}

main().catch(e => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1); });

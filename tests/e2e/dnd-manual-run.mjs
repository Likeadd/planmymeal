// ============================================================================
// Test one-shot — Drag & drop du planning avec un compte connecté.
// Usage : node tests/e2e/dnd-manual-run.mjs   (dev server requis sur :3000)
// Compte : créé via l'API admin Supabase (dnd-test@planmymeal.test).
// Vérifie : 1 seul appel API par drop, permutation/move corrects, toast de
// confirmation, conservation du nombre total de repas, persistance au reload.
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'screenshots/dnd-test';
fs.mkdirSync(OUT, { recursive: true });

const errorsConsole = [];
const apiCalls = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });

page.on('pageerror', (err) => errorsConsole.push('pageerror: ' + err.message));
page.on('console', (msg) => { if (msg.type() === 'error') errorsConsole.push('console: ' + msg.text()); });
page.on('response', (res) => {
  if (res.url().includes('/api/')) apiCalls.push(`${res.request().method()} ${res.url().replace(/https?:\/\/[^/]+/, '')} -> ${res.status()}`);
});

const step = (m) => console.log('▶ ' + m);

// ── 1. Login ────────────────────────────────────────────────────────────────
step('Login…');
await page.goto('http://localhost:3000/login');
await page.getByLabel('Adresse email').fill('dnd-test@planmymeal.test');
await page.getByLabel('Mot de passe').fill('DndTest2026!');
await page.getByRole('button', { name: /Se connecter/i }).click();
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
// Course connue (bug mineur indépendant) : si la requête profiles du login
// renvoie vide une fois, l'utilisateur complet est renvoyé vers /onboarding.
if (!page.url().includes('/dashboard')) {
  await page.goto('http://localhost:3000/dashboard');
}
// Attendre le planning rendu (grille 7 colonnes) AVANT toute action
await page.locator('div.grid-cols-7').waitFor({ state: 'visible', timeout: 120_000 });
console.log('  → dashboard atteint, planning rendu');

const columns = page.locator('div.grid-cols-7 > div');

/** Inventaire complet : pour chaque colonne, la liste des titres (sans emoji).
 * Snapshot atomique (une seule lecture DOM) : insensible aux re-rendus qui
 * faisaient expirer les locators nth() entre le count et la lecture. */
async function inventaireCols() {
  return page.evaluate(() => {
    const grid = document.querySelector('div.grid-cols-7');
    if (!grid) return [];
    const strip = (t) => (t ?? '').replace(/^[^\p{L}]+/u, '').trim();
    return Array.from(grid.children).map((col) =>
      Array.from(col.querySelectorAll('[draggable="true"]')).map((chip) => {
        const a = chip.querySelector('a');
        return a ? strip(a.textContent) : null;
      })
    );
  });
}

/** Attend que l'inventaire se stabilise (fin du rechargement post-drop),
 * en tolérant les squelettes de chargement (grille absente = instable). */
async function attendStabilite() {
  let prev = null;
  for (let i = 0; i < 25; i++) {
    await page.locator('div.grid-cols-7').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_200);
    const cur = JSON.stringify(await inventaireCols());
    if (cur !== '[]' && cur === prev) return JSON.parse(cur);
    prev = cur;
  }
  return JSON.parse(prev ?? '[]');
}

/** Sonde les toasts sonner pendant toute la fenêtre donnée (ms). */
async function toastVu(fenetreMs = 30_000) {
  const fin = Date.now() + fenetreMs;
  while (Date.now() < fin) {
    const el = page.locator('[data-sonner-toast]').first();
    if (await el.isVisible().catch(() => false)) return (await el.textContent() ?? '').trim();
    await page.waitForTimeout(400);
  }
  return null;
}

/**
 * Simule un vrai drag & drop HTML5 : dragstart → dragover → drop.
 * Retourne { toast, moveCalls } : toast affiché + appels move-meal du geste.
 */
async function dragDrop(source, target, label) {
  const apiAvant = apiCalls.filter((c) => c.includes('move-meal')).length;
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await page.screenshot({ path: `${OUT}/${label}-survol.png` });
  await target.dispatchEvent('drop', { dataTransfer });
  const toast = await toastVu();
  const apresStabilite = await attendStabilite();
  const moveCalls = apiCalls.filter((c) => c.includes('move-meal')).slice(apiAvant);
  console.log(`  → toast : ${toast ? JSON.stringify(toast) : 'AUCUN'} | move-meal : ${moveCalls.length} appel(s) [${moveCalls.join(', ') || '-'}]`);
  return { toast, moveCalls, apresStabilite };
}

let ok = 0, fail = 0;
const verdict = (cond, nom, details) => {
  if (cond) { ok++; console.log(`  ✅ ${nom}`); }
  else { fail++; console.log(`  ❌ ${nom}`, details ?? ''); }
};

// ── 2. État propre : régénération (le planning est rendu, le bouton existe) ─
step('Régénération de la semaine (état propre)…');
{
  const regen = page.getByRole('button', { name: /^Régénérer$/i }).first();
  if (await regen.isVisible().catch(() => false)) {
    // Attendre la fin de la génération côté serveur AVANT de continuer,
    // sinon la semaine se recharge en plein milieu du Test A.
    const genPromise = page.waitForResponse((r) => r.url().includes('/api/generate-week'), { timeout: 120_000 });
    await regen.click();
    await genPromise;
    await attendStabilite();
  } else {
    console.log('  (bouton Régénérer absent — semaine vide, génération directe)');
    await page.getByRole('button', { name: /Générer/i }).first().click();
    await page.locator('div.grid-cols-7').waitFor({ state: 'visible', timeout: 120_000 });
    await attendStabilite();
  }
  const etat = await inventaireCols();
  console.log('  → état propre :', etat.flat().length, 'repas planifiés');
  await page.screenshot({ path: `${OUT}/01-etat-propre.png`, fullPage: true });
}

// ── Test A — même jour : 1er repas de Lundi → dernier chip de Lundi ─────────
step('Test A : même jour — Lundi, 1er repas → dernier créneau de Lundi');
{
  const avant = await inventaireCols();
  const totalAvant = avant.flat().length;
  const titreSource = avant[0][0];
  const plusAjouter = columns.nth(0).getByText('Ajouter', { exact: true }).first();
  const vide = (await plusAjouter.count()) > 0;
  const target = vide ? plusAjouter.locator('xpath=..') : columns.nth(0).locator('[draggable="true"]').last();
  console.log(`  → "${titreSource}" → ${vide ? 'créneau vide' : 'dernier chip'}`);
  const { toast, moveCalls, apresStabilite } = await dragDrop(columns.nth(0).locator('[draggable="true"]').first(), target, '02-testA');
  const apres = apresStabilite ?? (await inventaireCols());
  const totalApres = apres.flat().length;
  console.log('  → Lundi avant :', JSON.stringify(avant[0]));
  console.log('  → Lundi après :', JSON.stringify(apres[0]));
  verdict(moveCalls.length === 1 && moveCalls[0].includes('-> 200'), 'A1 : exactement 1 appel API 200');
  verdict(!!toast && /Repas déplacé/i.test(toast), 'A2 : toast de confirmation', { toast });
  verdict(totalApres === totalAvant, 'A3 : nombre total de repas conservé (pas de duplication)', { totalAvant, totalApres });
  verdict(apres[0].includes(titreSource), 'A4 : le repas est toujours sur Lundi (déplacé, pas perdu)');
  await page.screenshot({ path: `${OUT}/03-testA-apres.png`, fullPage: true });
}

// ── Test B —跨 jour avec permutation : 1er repas de Mardi ↔ Jeudi ──────────
step('Test B :跨 jour — 1er repas de Mardi ↔ 1er repas de Jeudi (permutation)');
{
  const avant = await inventaireCols();
  const totalAvant = avant.flat().length;
  const titreSource = avant[1][0];
  const titreCible = avant[3][0];
  console.log(`  → "${titreSource}" (Mardi) ↔ "${titreCible}" (Jeudi)`);
  const { toast, moveCalls, apresStabilite } = await dragDrop(
    columns.nth(1).locator('[draggable="true"]').first(),
    columns.nth(3).locator('[draggable="true"]').first(), '04-testB');
  const apres = apresStabilite ?? (await inventaireCols());
  verdict(moveCalls.length === 1 && moveCalls[0].includes('-> 200'), 'B1 : exactement 1 appel API 200');
  verdict(!!toast && /Repas déplacé/i.test(toast), 'B2 : toast de confirmation', { toast });
  verdict(apres.flat().length === totalAvant, 'B3 : nombre total de repas conservé');
  verdict(!titreCible || titreCible === titreSource || apres[1].includes(titreCible), 'B4 : le repas de Jeudi est passé sur Mardi');
  verdict(apres[3].includes(titreSource), 'B5 : le repas de Mardi est passé sur Jeudi');
  await page.screenshot({ path: `${OUT}/05-testB-apres.png`, fullPage: true });
}

// ── Test C —跨 jour : 1er repas de Vendredi → Samedi ────────────────────────
step('Test C :跨 jour — 1er repas de Vendredi → Samedi');
{
  const avant = await inventaireCols();
  const totalAvant = avant.flat().length;
  const titreSource = avant[4][0];
  const plusAjouter = columns.nth(5).getByText('Ajouter', { exact: true }).first();
  const vide = (await plusAjouter.count()) > 0;
  const target = vide ? plusAjouter.locator('xpath=..') : columns.nth(5).locator('[draggable="true"]').last();
  console.log(`  → "${titreSource}" (Vendredi) → Samedi ${vide ? '(créneau vide)' : '(dernier chip)'}`);
  const { toast, moveCalls, apresStabilite } = await dragDrop(columns.nth(4).locator('[draggable="true"]').first(), target, '06-testC');
  const apres = apresStabilite ?? (await inventaireCols());
  verdict(moveCalls.length === 1 && moveCalls[0].includes('-> 200'), 'C1 : exactement 1 appel API 200');
  verdict(!!toast && /Repas déplacé/i.test(toast), 'C2 : toast de confirmation', { toast });
  verdict(apres.flat().length === totalAvant, 'C3 : nombre total de repas conservé');
  verdict(apres[5].includes(titreSource) && !apres[4].includes(titreSource), 'C4 : le repas a quitté Vendredi pour Samedi');
  await page.screenshot({ path: `${OUT}/07-testC-apres.png`, fullPage: true });
}

// ── Persistance : reload + re-vérification ──────────────────────────────────
step('Persistance : reload de la page');
const avantReload = await inventaireCols();
const titreB = avantReload[3][0];
await page.reload({ waitUntil: 'networkidle' });
await page.locator('div.grid-cols-7').waitFor({ state: 'visible', timeout: 30_000 });
await page.waitForTimeout(1_500);
const apresReload = await inventaireCols();
console.log('  → Jeudi après reload :', JSON.stringify(apresReload[3]));
await page.screenshot({ path: `${OUT}/08-apres-reload.png`, fullPage: true });
verdict(titreB && apresReload[3].includes(titreB), 'P1 : le déplacement a survécu au reload');

// ── Rapport ─────────────────────────────────────────────────────────────────
console.log('\n════════ RAPPORT ════════');
console.log(`Vérifications : ${ok} réussies, ${fail} échouées`);
const moves = apiCalls.filter((c) => c.includes('move-meal'));
console.log(`\nAppels move-meal : ${moves.length} au total — ${moves.filter((c) => c.endsWith('-> 200')).length} OK, ${moves.filter((c) => !c.endsWith('-> 200')).length} en erreur`);
const err401 = apiCalls.filter((c) => c.includes('-> 401'));
if (err401.length) console.log('Appels 401 :', err401.join(' | '));
console.log('\nErreurs console/navigateur :');
console.log(errorsConsole.length ? errorsConsole.slice(0, 15).join('\n') : '  aucune ✓');

await browser.close();
process.exit(fail > 0 ? 1 : 0);

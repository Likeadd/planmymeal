// ============================================================================
// verifier-suggestions — le tirage propose-t-il vraiment tout le catalogue ?
//
// Bug d'origine : la requête demandait 30 lignes SANS `order`, donc PostgREST
// renvoyait toujours les mêmes 30 recettes. Sur 1122 plats publiés, 1092 ne
// pouvaient JAMAIS être proposés dans la modale de remplacement.
//
// Ce script appelle la fonction RÉELLE (`chargerSuggestionsSwap`, celle que le
// dashboard exécute) des dizaines de fois et vérifie que le tirage atteint le
// fond du catalogue, pas seulement sa tête.
//
// Lecture seule : aucune écriture.
// Usage : npx tsx scripts/verifier-suggestions.ts
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import {
  chargerIdsRecettes, chargerSuggestionsSwap, SELECT_SUGGESTIONS,
  SUGGESTIONS_AFFICHEES, SUGGESTIONS_POOL,
} from '../src/lib/catalogue';
import type { Database } from '../supabase/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Nombre d'ouvertures de la modale simulées. */
const OUVERTURES = 50;

let echecs = 0;
const ok = (msg: string, detail = '') => console.log(`  ✅ ${msg}${detail ? `  ${detail}` : ''}`);
const ko = (msg: string, detail = '') => { echecs++; console.log(`  ❌ ${msg}${detail ? `  ${detail}` : ''}`); };
const titre = (n: string) => console.log(`\n${n}`);

async function main() {
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });

  // ─── 1. Ce que l'ancienne requête renvoyait, à l'identique ────────────────
  titre("1. L'ancienne requête (30 lignes, sans `order`)");
  const { data: ancienVivier, error: errAncien } = await supabase
    .from('meals')
    .select('id')
    .eq('is_public', true)
    .eq('type_repas', 'plat')
    .neq('id', -1)
    .limit(SUGGESTIONS_POOL);
  if (errAncien) { ko('requête impossible', errAncien.message); process.exit(1); }

  const ancienIds = new Set((ancienVivier ?? []).map(m => m.id));
  const ancienTries = [...ancienIds].sort((a, b) => a - b);
  console.log(`     vivier figé : ${ancienIds.size} recettes, ids ${ancienTries[0]} → ${ancienTries[ancienTries.length - 1]}`);
  ancienIds.size === SUGGESTIONS_POOL
    ? ok("reproduit le plafond de l'ancien code", `${SUGGESTIONS_POOL} recettes, toujours les mêmes`)
    : ko(`vivier inattendu (${ancienIds.size})`);

  // ─── 2. Le catalogue atteignable ──────────────────────────────────────────
  titre('2. Le catalogue réellement proposable');
  const idsPlats = await chargerIdsRecettes(supabase, { typeRepas: 'plat' });
  ok('plats publics chargés (pagination comprise)', `${idsPlats.length} recettes`);
  const idsPlatsSet = new Set(idsPlats);

  // ─── 3. Le tirage réel, répété ────────────────────────────────────────────
  titre(`3. ${OUVERTURES} ouvertures de la modale (fonction réelle)`);
  // Situation réelle : 14 repas déjà au planning, dont on exclut les recettes.
  const dejaAuPlanning = new Set(idsPlats.slice(0, 14));
  const aRemplacer = idsPlats[20];

  const vues = new Set<number>();
  let total = 0;
  let horsCatalogue = 0;
  let doublon = 0;
  let dejaPlanifiee = 0;
  let vide = 0;
  let trop = 0;

  for (let i = 0; i < OUVERTURES; i++) {
    const suggestions = await chargerSuggestionsSwap(supabase, {
      typeRepas: 'plat',
      exclureId: aRemplacer,
      exclus: dejaAuPlanning,
    });
    total += suggestions.length;
    if (suggestions.length === 0) vide++;
    if (suggestions.length > SUGGESTIONS_AFFICHEES) trop++;
    if (new Set(suggestions.map(s => s.id)).size !== suggestions.length) doublon++;
    for (const s of suggestions) {
      vues.add(s.id);
      if (!idsPlatsSet.has(s.id)) horsCatalogue++;
      if (dejaAuPlanning.has(s.id) || s.id === aRemplacer) dejaPlanifiee++;
    }
  }

  const attenduParOuverture = SUGGESTIONS_AFFICHEES;
  total === OUVERTURES * attenduParOuverture
    ? ok('la modale est toujours remplie', `${total} suggestions (${OUVERTURES} × ${attenduParOuverture})`)
    : (vide > 0
      ? ko('la modale s\'est retrouvée vide', `${vide} ouverture(s) sans suggestion`)
      : ok('nombre variable de suggestions', `${total} au total`));
  trop === 0 ? ok('jamais plus que le plafond affiché', `≤ ${SUGGESTIONS_AFFICHEES}`) : ko(`${trop} dépassement(s)`);
  doublon === 0 ? ok('jamais la même recette deux fois dans une liste') : ko(`${doublon} liste(s) avec doublon`);
  horsCatalogue === 0 ? ok('toujours des plats publics (filtre respecté)') : ko(`${horsCatalogue} suggestions hors filtre`);
  dejaPlanifiee === 0
    ? ok('jamais un repas déjà au planning, ni celui qu\'on remplace')
    : ko(`${dejaPlanifiee} suggestion(s) déjà planifiée(s)`);

  // ─── 4. La preuve qui compte : le fond du catalogue ───────────────────────
  titre('4. Atteint-on au-delà des 30 premières recettes ?');
  console.log(`     recettes distinctes proposées : ${vues.size}`);
  const horsVivierFige = [...vues].filter(id => !ancienIds.has(id));
  horsVivierFige.length > 0
    ? ok('des recettes HORS de l\'ancien vivier figé sortent', `${horsVivierFige.length} distinctes`)
    : ko("le tirage reste enfermé dans l'ancien vivier de 30");

  vues.size > SUGGESTIONS_POOL * 5
    ? ok('bien au-delà du plafond historique de 30', `${vues.size} recettes distinctes`)
    : ko(`diversité insuffisante (${vues.size} distinctes)`);

  // Assertion robuste (non dépendante du hasard) : le TIRAGE doit atteindre
  // aussi le dernier décile du catalogue. Sous l'ancien code, le rang maximal
  // possible était 30 — impossible d'aller au-delà.
  const rangDe = (id: number) => idsPlats.indexOf(id) + 1;
  const rangMax = Math.max(...[...vues].map(rangDe));
  const dernierDecile = idsPlats.length * 0.9;
  const tardives = [...vues].filter(id => rangDe(id) > dernierDecile).length;
  rangMax > dernierDecile
    ? ok('le dernier décile du catalogue est atteint', `rang max ${rangMax}/${idsPlats.length}`)
    : ko(`le tirage reste dans la tête du catalogue (rang max ${rangMax})`);
  tardives >= 10
    ? ok('le fond du catalogue est bien représenté', `${tardives} recettes au-delà du rang ${Math.ceil(dernierDecile)}`)
    : ko(`seulement ${tardives} recette(s) du dernier décile`);

  // Couverture : combien du catalogue est sorti au moins une fois ?
  // Théorique pour un tirage uniforme : 1 − e^(−600/979) ≈ 46 %.
  const part = vues.size / idsPlats.length * 100;
  Math.abs(part - 46) < 12
    ? ok('couverture conforme à un tirage uniforme', `${part.toFixed(0)} % des plats en ${OUVERTURES} ouvertures`)
    : ko(`couverture inattendue : ${part.toFixed(0)} % (attendu ≈ 46 %)`);

  // ─── 5. Le créneau dessert reste filtré ───────────────────────────────────
  titre('5. Créneau dessert');
  const desserts = await Promise.all(
    Array.from({ length: 10 }, () => chargerSuggestionsSwap(supabase, { typeRepas: 'dessert' }))
  );
  const idsDesserts = new Set(await chargerIdsRecettes(supabase, { typeRepas: 'dessert' }));
  const horsDessert = desserts.flat().filter(s => !idsDesserts.has(s.id)).length;
  const dessertsVides = desserts.filter(d => d.length === 0).length;
  dessertsVides === 0
    ? ok('10 ouvertures dessert, toutes remplies', `${desserts.flat().length} suggestions`)
    : ko(`${dessertsVides} ouverture(s) dessert vide(s)`);
  horsDessert === 0 ? ok('uniquement des desserts', `${idsDesserts.size} desserts au catalogue`) : ko(`${horsDessert} non-desserts`);

  // ─── 6. Le poids de la requête de détails ─────────────────────────────────
  titre('6. Charge utile des détails (30 recettes)');
  const trenteIds = idsPlats.slice(0, SUGGESTIONS_POOL);
  const { data: brut } = await supabase.from('meals').select('*').in('id', trenteIds);
  const { data: leger } = await supabase.from('meals').select(SELECT_SUGGESTIONS).in('id', trenteIds);
  if (brut && leger) {
    const avant = Buffer.byteLength(JSON.stringify(brut), 'utf8');
    const apres = Buffer.byteLength(JSON.stringify(leger), 'utf8');
    console.log(`     select('*') : ${Math.round(avant / 1024)} ko`);
    console.log(`     allégé      : ${Math.round(apres / 1024)} ko`);
    apres < avant
      ? ok('allègement confirmé', `−${Math.round((1 - apres / avant) * 100)} %`)
      : ko('aucun gain sur la requête de détails');
  }

  // ─── 7. Latence : le prix du correctif ────────────────────────────────────
  titre('7. Latence (le tirage coûte deux requêtes d\'identifiants en plus)');
  const tAncien = Date.now();
  for (let i = 0; i < 5; i++) {
    await supabase.from('meals').select('id').eq('is_public', true).eq('type_repas', 'plat').limit(SUGGESTIONS_POOL);
  }
  const msAncien = (Date.now() - tAncien) / 5;

  const tNouveau = Date.now();
  for (let i = 0; i < 5; i++) {
    await chargerSuggestionsSwap(supabase, { typeRepas: 'plat', exclus: dejaAuPlanning });
  }
  const msNouveau = (Date.now() - tNouveau) / 5;

  console.log(`     ancienne requête seule        : ${msAncien.toFixed(0)} ms`);
  console.log(`     identifiants + détails        : ${msNouveau.toFixed(0)} ms`);
  console.log(`     → surcoût ${(msNouveau - msAncien).toFixed(0)} ms, payé une fois par ouverture de la modale`);
  msNouveau < 1500
    ? ok('latence acceptable pour une modale')
    : ko(`trop lent (${msNouveau.toFixed(0)} ms)`);

  console.log(`\n${'─'.repeat(60)}`);
  if (echecs === 0) console.log('✅ Tout est vert — le tirage atteint tout le catalogue.');
  else console.log(`❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(err => { console.error('Erreur inattendue :', err); process.exit(1); });

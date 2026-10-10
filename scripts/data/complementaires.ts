// Point d'entrée des recettes complémentaires : assemble toutes les familles et retire les titres en double.
import type { RecetteSaisie } from './recettes-proteinees';
import { platsAuFour, platsOeufs, bowls, pates, plats_pommes_de_terre, poeleesExpress, saladesRepas, sandwichs, shakshukas } from './complementaires-plats';
import { cakesSales, clafoutis, collations, crumbles, entreesFroides, fruitsRotis, gratins, laitages, mijotes, moules, papillotes, petitsDejeuners, quiches, soupesRepas, tartesFines, veloutes, verrines } from './complementaires-autres';

const N = (cle: string, defaut: number) => Number(process.env[`NB_${cle}`] ?? defaut);

export function genererComplementaires(): RecetteSaisie[] {
  const toutes = [
    ...poeleesExpress(N('POELEES', 500)),
    ...bowls(N('BOWLS', 150)),
    ...pates(N('PATES', 240)),
    ...plats_pommes_de_terre(N('PDT', 160)),
    ...sandwichs(N('SANDWICHS', 220)),
    ...platsAuFour(N('FOUR', 180)),
    ...platsOeufs(N('OEUFS', 110)),
    ...shakshukas(),
    ...saladesRepas(N('SALADES', 160)),
    ...gratins(N('GRATINS', 110)), ...quiches(N('QUICHES', 70)), ...tartesFines(N('TARTES', 60)), ...cakesSales(N('CAKES', 50)),
    ...papillotes(N('PAPILLOTES', 90)), ...moules(),
    ...mijotes(N('MIJOTES', 230)),
    ...soupesRepas(N('SOUPES_REPAS', 50)), ...veloutes(N('VELOUTES', 90)), ...entreesFroides(N('ENTREES', 90)),
    ...crumbles(), ...fruitsRotis(), ...verrines(), ...laitages(), ...clafoutis(),
    ...collations(), ...petitsDejeuners(),
  ];
  const vus = new Set<string>();
  return toutes.filter(r => { const k = r.titre.toLowerCase(); if (vus.has(k)) return false; vus.add(k); return true; });
}

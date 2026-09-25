import { describe, it, expect } from 'vitest';
import { toRecetteMoteur, toRecetteFrigo, type RecetteMoteurEmbed, type RecetteFrigoEmbed } from '@/lib/db-rows';

// ============================================================================
// Normalisateurs du moteur et de « vider le frigo »
//
// Le compilateur garantit qu'aucun consommateur ne LIT un champ absent du type
// (il a d'ailleurs signalé chaque composant pendant la migration). Ces tests
// couvrent la direction inverse, que lui ne peut pas voir : ce que le
// normalisateur FABRIQUE à partir d'une ligne réelle. Un normalisateur qui
// inventerait `instructions` ferait croire à un `Meal` complet — exactement le
// mensonge que le `as unknown as Meal` entretenait.
// ============================================================================

const ligneMoteur: RecetteMoteurEmbed = {
  id: 7,
  titre: 'Poulet curry',
  type_repas: 'plat',
  saison: 'toutes',
  cuisine: 'indienne',
  conservation_jours: 3,
  ustensiles: null,
  difficulte: 'facile',
  temps_preparation: 15,
  temps_cuisson: 25,
  calories_par_portion: 620,
  macros_verifiables: true,
  portions_par_defaut: 4,
  meal_ingredients: [
    {
      ingredient_id: 42,
      quantite: 500,
      unite: 'g',
      est_optionnel: null,
      ingredients: { id: 42, nom: 'Poulet', rayon: 'viande_poisson', prix_unitaire: 9.5, unite_prix: 'kg' },
    },
    // Embed rompu : l'ingrédient n'existe plus → la recette reste valide
    { ingredient_id: 99, quantite: 1, unite: 'pot', est_optionnel: true, ingredients: null },
  ],
};

describe('toRecetteMoteur', () => {
  it('expose ce que le moteur lit vraiment', () => {
    const m = toRecetteMoteur(ligneMoteur);
    expect(m).toMatchObject({
      id: 7, titre: 'Poulet curry', type_repas: 'plat', saison: 'toutes',
      cuisine: 'indienne', conservation_jours: 3,
      difficulte: 'facile', temps_preparation: 15, temps_cuisson: 25,
      calories_par_portion: 620, portions_par_defaut: 4,
    });
  });

  it('ne fabrique aucun champ que la requête ne demande pas', () => {
    const m = toRecetteMoteur(ligneMoteur) as unknown as Record<string, unknown>;
    // Le pool du moteur ne sélectionne plus ces colonnes : les promettre ici
    // rouvrirait la porte à une lecture silencieusement `undefined`.
    for (const absent of ['instructions', 'image_url', 'description', 'proteines', 'glucides', 'lipides', 'fibres', 'created_by', 'is_public']) {
      expect(absent in m, `${absent} ne devrait pas exister`).toBe(false);
    }
  });

  it('normalise les ingrédients : `est_optionnel` et embed rompu', () => {
    const m = toRecetteMoteur(ligneMoteur);
    expect(m.ingredients).toHaveLength(1);
    expect(m.ingredients?.[0]).toMatchObject({
      quantite: 500, unite: 'g', est_optionnel: false,
      ingredient: { id: 42, nom: 'Poulet', prix_unitaire: 9.5, unite_prix: 'kg' },
    });
  });

  it('remplace `ustensiles` null par un tableau vide (`.filter` du moteur)', () => {
    expect(toRecetteMoteur(ligneMoteur).ustensiles).toEqual([]);
  });
});

describe('toRecetteFrigo', () => {
  const ligneFrigo: RecetteFrigoEmbed = {
    id: 12, titre: 'Omelette', difficulte: 'facile',
    temps_preparation: 5, temps_cuisson: 10, calories_par_portion: 300,
    ustensiles: ['poele'], portions_par_defaut: 2,
    cuisine: 'francaise', image_url: null,
    meal_ingredients: [{
      ingredient_id: 3, quantite: 6, unite: 'unite', est_optionnel: false,
      ingredients: { id: 3, nom: 'Oeufs', rayon: 'frais', prix_unitaire: 3.2, unite_prix: 'unite' },
    }],
  };

  it('ajoute cuisine et image au socle d’une carte', () => {
    const r = toRecetteFrigo(ligneFrigo);
    expect(r).toMatchObject({ id: 12, titre: 'Omelette', cuisine: 'francaise', image_url: null, ustensiles: ['poele'] });
  });

  it('garde de quoi chiffrer la recette (portions + prix)', () => {
    const r = toRecetteFrigo(ligneFrigo);
    expect(r.portions_par_defaut).toBe(2);
    expect(r.ingredients?.[0].ingredient.prix_unitaire).toBe(3.2);
  });
});

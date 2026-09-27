-- ============================================================================
-- 00024 — Extension du catalogue d'ingrédients
--
-- Objectif : élargir le choix d'aliments disponibles pour le frigo/garde-manger
-- et la composition de recettes (le catalogue de 348 ingrédients manquait
-- plusieurs familles courantes : fromages, poissons, légumes racines, graines,
-- condiments, laits végétaux…).
--
-- `on conflict (nom) do nothing` : rejouable sans risque, aucun doublon si un
-- nom existe déjà (contrainte unique sur `ingredients.nom`).
-- ============================================================================

insert into public.ingredients
  (nom, rayon, saison, calories_pour_100g, proteines_pour_100g, glucides_pour_100g, lipides_pour_100g)
values
  -- Fruits & légumes
  ('Kiwi', 'fruits_legumes', 'toutes', 61, 1.1, 15, 0.5),
  ('Pastèque', 'fruits_legumes', 'ete', 30, 0.6, 8, 0.2),
  ('Nectarine', 'fruits_legumes', 'ete', 44, 1.1, 10, 0.3),
  ('Abricot', 'fruits_legumes', 'ete', 48, 1.4, 11, 0.4),
  ('Figue fraîche', 'fruits_legumes', 'ete', 74, 0.8, 19, 0.3),
  ('Pamplemousse', 'fruits_legumes', 'hiver', 42, 0.8, 11, 0.1),
  ('Fruit de la passion', 'fruits_legumes', 'toutes', 97, 2.2, 23, 0.7),
  ('Coing', 'fruits_legumes', 'automne', 57, 0.4, 15, 0.1),
  ('Rhubarbe', 'fruits_legumes', 'printemps', 21, 0.9, 4.5, 0.2),
  ('Asperge verte', 'fruits_legumes', 'printemps', 20, 2.2, 3.9, 0.1),
  ('Petits pois frais', 'fruits_legumes', 'printemps', 81, 5.4, 14, 0.4),
  ('Panais', 'fruits_legumes', 'hiver', 75, 1.2, 18, 0.3),
  ('Rutabaga', 'fruits_legumes', 'hiver', 37, 1.1, 8, 0.2),
  ('Topinambour', 'fruits_legumes', 'hiver', 73, 2, 17, 0.1),
  ('Cresson', 'fruits_legumes', 'toutes', 11, 2.3, 1.3, 0.1),
  ('Chou de Bruxelles', 'fruits_legumes', 'hiver', 43, 3.4, 9, 0.3),
  ('Poivron jaune', 'fruits_legumes', 'ete', 27, 1, 6, 0.2),
  ('Piment vert', 'fruits_legumes', 'toutes', 40, 2, 9, 0.2),
  ('Gombo', 'fruits_legumes', 'ete', 33, 1.9, 7, 0.2),
  ('Igname', 'fruits_legumes', 'toutes', 118, 1.5, 28, 0.2),
  ('Salsifis', 'fruits_legumes', 'hiver', 82, 3.3, 18, 0.2),
  ('Artichaut frais', 'fruits_legumes', 'printemps', 47, 3.3, 10, 0.2),
  ('Blette', 'fruits_legumes', 'toutes', 19, 1.8, 3.7, 0.2),

  -- Viandes & poissons
  ('Escalope de poulet', 'viande_poisson', 'toutes', 113, 23, 0, 2),
  ('Cuisses de poulet', 'viande_poisson', 'toutes', 177, 18, 0, 11),
  ('Ailes de poulet', 'viande_poisson', 'toutes', 203, 18, 0, 14),
  ('Foie de volaille', 'viande_poisson', 'toutes', 119, 17, 1, 4.8),
  ('Boudin noir', 'viande_poisson', 'toutes', 280, 13, 3, 24),
  ('Jambon cru', 'viande_poisson', 'toutes', 195, 25, 0.5, 10),
  ('Pancetta', 'viande_poisson', 'toutes', 380, 16, 0, 35),
  ('Truite', 'viande_poisson', 'toutes', 119, 20, 0, 4),
  ('Sole', 'viande_poisson', 'toutes', 86, 18, 0, 1.2),
  ('Bar (poisson)', 'viande_poisson', 'toutes', 97, 18, 0, 2.5),
  ('Sardines fraîches', 'viande_poisson', 'ete', 166, 20, 0, 9),
  ('Sardines (bte)', 'conserves', 'toutes', 208, 25, 0, 11),
  ('Anchois (bte)', 'conserves', 'toutes', 210, 29, 0, 10),
  ('Surimi', 'viande_poisson', 'toutes', 95, 12, 10, 0.5),
  ('Poulpe', 'viande_poisson', 'toutes', 82, 15, 2.2, 1),
  ('Calamars', 'viande_poisson', 'toutes', 92, 15, 3.1, 1.4),
  ('Noix de Saint-Jacques', 'viande_poisson', 'hiver', 88, 17, 3, 0.8),
  ('Merlan', 'viande_poisson', 'toutes', 90, 18, 0, 1.3),
  ('Colin', 'viande_poisson', 'toutes', 84, 17, 0, 1.3),

  -- Crèmerie & frais
  ('Camembert', 'frais', 'toutes', 300, 20, 0.5, 24),
  ('Emmental', 'frais', 'toutes', 380, 28, 0, 29),
  ('Brie', 'frais', 'toutes', 330, 20, 0.5, 27),
  ('Fromage râpé', 'frais', 'toutes', 350, 25, 1, 27),
  ('Beurre demi-sel', 'frais', 'toutes', 745, 0.6, 0.6, 82),
  ('Lait d’amande', 'frais', 'toutes', 24, 0.5, 3, 1.1),
  ('Lait d’avoine', 'frais', 'toutes', 46, 1, 7, 1.5),
  ('Lait de soja', 'frais', 'toutes', 33, 3.3, 1, 1.8),
  ('Margarine', 'frais', 'toutes', 720, 0.2, 1, 80),
  ('Crème végétale', 'frais', 'toutes', 220, 1, 3, 22),

  -- Épicerie salée & secs
  ('Pâtes coquillettes', 'epicerie_salee', 'toutes', 350, 12, 71, 1.5),
  ('Pâtes orzo', 'epicerie_salee', 'toutes', 355, 12, 72, 1.5),
  ('Sarrasin', 'epicerie_salee', 'toutes', 343, 13, 71, 3.4),
  ('Millet', 'epicerie_salee', 'toutes', 378, 11, 73, 4.2),
  ('Riz sauvage', 'epicerie_salee', 'toutes', 357, 15, 75, 1.1),
  ('Bicarbonate de soude', 'epicerie_salee', 'toutes', 0, 0, 0, 0),
  ('Vinaigre de cidre', 'epicerie_salee', 'toutes', 21, 0, 0.9, 0),
  ('Sauce Worcestershire', 'epicerie_salee', 'toutes', 78, 0, 19, 0),
  ('Ketchup', 'epicerie_salee', 'toutes', 112, 1.2, 26, 0.2),
  ('Sauce barbecue', 'epicerie_salee', 'toutes', 172, 0.9, 40, 0.6),
  ('Tabasco', 'epicerie_salee', 'toutes', 12, 0.5, 0.8, 0.4),
  ('Graines de tournesol', 'epicerie_salee', 'toutes', 584, 21, 20, 51),
  ('Graines de lin', 'epicerie_salee', 'toutes', 534, 18, 29, 42),
  ('Noix de pécan', 'epicerie_sucree', 'toutes', 691, 9, 14, 72),

  -- Boulangerie
  ('Biscottes', 'boulangerie', 'toutes', 408, 10, 74, 8),

  -- Surgelés
  ('Frites surgelées', 'surgeles', 'toutes', 160, 2.5, 25, 5.5),
  ('Poêlée de légumes surgelée', 'surgeles', 'toutes', 45, 2, 7, 0.5),
  ('Fruits de mer surgelés', 'surgeles', 'toutes', 90, 15, 2, 1.5),
  ('Nuggets de poulet (surg.)', 'surgeles', 'toutes', 280, 14, 18, 17),

  -- Boissons
  ('Thé', 'boissons', 'toutes', 1, 0, 0.3, 0),
  ('Jus d’orange', 'boissons', 'toutes', 45, 0.7, 10, 0.2),
  ('Eau gazeuse', 'boissons', 'toutes', 0, 0, 0, 0),

  -- Épicerie sucrée
  ('Confiture', 'epicerie_sucree', 'toutes', 250, 0.4, 62, 0.1),
  ('Pâte à tartiner', 'epicerie_sucree', 'toutes', 539, 6, 57, 31)
on conflict (nom) do nothing;

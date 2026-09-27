-- ============================================================================
-- 00026 — Nettoyage de la base
--
-- 1. Fusion des ingrédients en double (« Basilic » / « Basilic frais »,
--    « Pain pita » / « Pains pita »…) : les recettes, listes de courses,
--    frigos, allergies et dégoûts sont repointés vers l'ingrédient conservé,
--    puis le doublon est supprimé. Une allergie posée sur « Menthe » couvre
--    désormais aussi les 157 recettes qui utilisaient « Menthe fraîche ».
-- 2. Suppression de ce que rien n'utilise :
--    - vue meal_rotation_score (le moteur calcule son score en TypeScript) ;
--    - colonnes ingredients.est_allergene / allergene_type (toujours false /
--      null, les allergies passent par user_allergies) et prix_estime (toujours
--      null, remplacé par prix_unitaire + unite_prix).
-- 3. Rétention : purge quotidienne des security_events de plus de 90 jours
--    (la table grossissait sans limite).
--
-- La fonctionnalité « foyer partagé » (households…) est CONSERVÉE : non
-- branchée dans l'UI mais prévue au produit.
--
-- Idempotent : relançable sans risque (paires absentes ignorées, drop if exists).
-- ============================================================================

-- ── 1. Fusion des doublons ─────────────────────────────────────────────────
do $$
declare
  paire record;
  v_old int;
  v_keep int;
begin
  for paire in
    select * from (values
      ('Pâtes (penne)',          'Pâtes penne'),
      ('Basilic frais',          'Basilic'),
      ('Persil frais',           'Persil'),
      ('Menthe',                 'Menthe fraîche'),
      ('Gingembre frais',        'Gingembre'),
      ('Salade',                 'Salade verte'),
      ('Blanc de poulet',        'Filet de poulet'),
      ('Wrap / tortilla',        'Tortillas de blé'),
      ('Tortilla de blé',        'Tortillas de blé'),
      ('Pain pita',              'Pains pita'),
      ('Pain burger',            'Pains burger'),
      ('Haricots rouges',        'Haricots rouges (bte)'),
      ('Tomates concassées',     'Tomate concassée (bte)'),
      ('Pois chiches',           'Pois chiches (bte)'),
      ('Maïs',                   'Maïs (bte)'),
      ('Petits pois',            'Petit pois (surg.)'),
      ('Thon en boîte',          'Thon au naturel'),
      ('Biscuits cuillère',      'Biscuits à la cuillère'),
      ('Chia graines',           'Graines de chia'),
      ('Cacao non sucré',        'Cacao en poudre'),
      ('Ras el hanout',          'Ras-el-hanout'),
      ('Laurier',                'Feuille de laurier'),
      ('Cumin en poudre',        'Cumin'),
      ('Garam masala maison',    'Garam masala'),
      ('Pâte de gochujang',      'Gochujang'),
      ('Sauce fish sauce',       'Sauce nuoc mam')
    ) as t(ancien, garde)
  loop
    select id into v_old  from public.ingredients where nom = paire.ancien;
    select id into v_keep from public.ingredients where nom = paire.garde;
    continue when v_old is null or v_keep is null or v_old = v_keep;

    -- Recettes : une recette qui contenait déjà les deux garde sa ligne existante
    update public.meal_ingredients m set ingredient_id = v_keep
      where m.ingredient_id = v_old
        and not exists (select 1 from public.meal_ingredients k
                        where k.meal_id = m.meal_id and k.ingredient_id = v_keep);
    delete from public.meal_ingredients where ingredient_id = v_old;

    -- Listes de courses : quantités cumulées si l'article existe déjà
    update public.shopping_list_items k set quantite_totale = k.quantite_totale + o.quantite_totale
      from public.shopping_list_items o
      where o.ingredient_id = v_old and k.ingredient_id = v_keep
        and k.list_id = o.list_id and k.unite = o.unite;
    update public.shopping_list_items s set ingredient_id = v_keep
      where s.ingredient_id = v_old
        and not exists (select 1 from public.shopping_list_items k
                        where k.list_id = s.list_id and k.ingredient_id = v_keep);
    delete from public.shopping_list_items where ingredient_id = v_old;

    -- Frigo : quantités cumulées à unité égale
    update public.fridge_items k set quantite = k.quantite + o.quantite, updated_at = now()
      from public.fridge_items o
      where o.ingredient_id = v_old and k.ingredient_id = v_keep
        and k.user_id = o.user_id and k.unite = o.unite;
    update public.fridge_items f set ingredient_id = v_keep
      where f.ingredient_id = v_old
        and not exists (select 1 from public.fridge_items k
                        where k.user_id = f.user_id and k.ingredient_id = v_keep and k.unite = f.unite);
    delete from public.fridge_items where ingredient_id = v_old;

    -- Contraintes et préférences par utilisateur / membre
    update public.user_allergies a set ingredient_id = v_keep
      where a.ingredient_id = v_old
        and not exists (select 1 from public.user_allergies k where k.user_id = a.user_id and k.ingredient_id = v_keep);
    delete from public.user_allergies where ingredient_id = v_old;

    update public.user_dislikes d set ingredient_id = v_keep
      where d.ingredient_id = v_old
        and not exists (select 1 from public.user_dislikes k where k.user_id = d.user_id and k.ingredient_id = v_keep);
    delete from public.user_dislikes where ingredient_id = v_old;

    update public.user_prix_ingredients p set ingredient_id = v_keep
      where p.ingredient_id = v_old
        and not exists (select 1 from public.user_prix_ingredients k where k.user_id = p.user_id and k.ingredient_id = v_keep);
    delete from public.user_prix_ingredients where ingredient_id = v_old;

    update public.family_member_ingredients f set ingredient_id = v_keep
      where f.ingredient_id = v_old
        and not exists (select 1 from public.family_member_ingredients k where k.member_id = f.member_id and k.ingredient_id = v_keep);
    delete from public.family_member_ingredients where ingredient_id = v_old;

    delete from public.ingredients where id = v_old;
  end loop;
end $$;

-- ── 2. Objets inutilisés ───────────────────────────────────────────────────
drop view if exists public.meal_rotation_score;

alter table public.ingredients drop column if exists est_allergene;
alter table public.ingredients drop column if exists allergene_type;
alter table public.ingredients drop column if exists prix_estime;

-- ── 3. Rétention des journaux de sécurité ──────────────────────────────────
-- Protégé par un test d'existence : la table security_events (migration 00023)
-- n'est pas forcément appliquée sur toutes les bases.
do $$
begin
  if to_regclass('public.security_events') is not null then
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      if exists (select 1 from cron.job where jobname = 'purge-security-events') then
        perform cron.unschedule('purge-security-events');
      end if;
      perform cron.schedule(
        'purge-security-events',
        '15 3 * * *',
        $cron$delete from public.security_events where created_at < now() - interval '90 days'$cron$
      );
    end if;

    delete from public.security_events where created_at < now() - interval '90 days';
  end if;
end $$;

analyze public.ingredients, public.meal_ingredients;

-- ============================================================================
-- 00022 : Rythme des desserts — remplace le binaire desserts_activees
--
-- L'audit desserts (axe 3) : « actifs / désactivés » ne couvrait pas les
-- attentes intermédiaires (« plus léger », « tous les soirs »). Quatre paliers
-- explicites, un défaut identique pour tous les nouveaux foyers :
--
--   'aucun'     → aucune dessert attribué par le moteur
--   'leger'     → 2 soirs + 1 midi          (plus léger)
--   'equilibre' → 3-4 soirs + 2-3 midis     (défaut, comportement historique)
--   'gourmand'  → 5-6 soirs + 3 midis       (plus généreux)
--
-- desserts_activees est CONSERVÉ (miroir, lu par le code pas encore migré et
-- par d'éventuels anciens clients) : synchronisé par trigger.
-- ============================================================================

alter table public.profiles
  add column if not exists rythme_desserts text not null default 'equilibre';

-- Reprise des choix existants : les foyers qui avaient désactivé les desserts
-- ne doivent pas en retrouver à la prochaine génération.
update public.profiles
  set rythme_desserts = 'aucun'
  where desserts_activees = false;

-- Le miroir booléen reste vrai pour les autres (défaut déjà 'true').

alter table public.profiles
  add constraint rythme_desserts_check
  check (rythme_desserts in ('aucun', 'leger', 'equilibre', 'gourmand'));

-- Synchronisation du miroir : rythme ≠ 'aucun' ⇔ desserts actifs.
create or replace function sync_desserts_activees() returns trigger as $$
begin
  new.desserts_activees := (new.rythme_desserts <> 'aucun');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_desserts_activees on public.profiles;
create trigger trg_sync_desserts_activees
  before update of rythme_desserts on public.profiles
  for each row execute function sync_desserts_activees();

comment on column public.profiles.rythme_desserts is
  'Rythme des desserts attribués par le moteur : aucun | leger | equilibre | gourmand';

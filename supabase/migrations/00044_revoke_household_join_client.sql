-- À appliquer APRÈS le déploiement de l'API qui utilise household_join_as (00043) :
-- ferme l'appel direct à household_join depuis le navigateur.
revoke execute on function public.household_join(text) from authenticated;

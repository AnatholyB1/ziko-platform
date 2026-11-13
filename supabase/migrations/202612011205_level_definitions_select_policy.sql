-- v1.20 UAT run2 (defaut 7) : ziko_level_definitions a la RLS active mais AUCUNE policy SELECT
-- (cf. 202612011203 pour les badges) : le client recevait 0 ligne, l'ecran Recompenses affichait
-- "Niveau maximum atteint" au niveau 3. Catalogue public par nature (level, xp_required, title,
-- reward_coins) : lecture seule pour les utilisateurs authentifies. Idempotente.
do $$
begin
  if to_regclass('public.ziko_level_definitions') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'ziko_level_definitions'
         and policyname = 'ziko_level_definitions_select_authenticated'
     )
  then
    alter table public.ziko_level_definitions enable row level security;
    create policy "ziko_level_definitions_select_authenticated"
      on public.ziko_level_definitions
      for select
      to authenticated
      using (true);
  end if;
end $$;

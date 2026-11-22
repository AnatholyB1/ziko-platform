-- P12 (UAT run 1 R-2): ziko_badge_definitions a la RLS active mais aucune policy SELECT,
-- l'ecran Succes affichait "0 sur 0". Le catalogue (slug, name, description, icon,
-- condition_type, condition_value, tier) est public par nature : lecture seule pour les
-- utilisateurs authentifies. Aucune ecriture ouverte. Idempotente.
do $$
begin
  if to_regclass('public.ziko_badge_definitions') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'ziko_badge_definitions'
         and policyname = 'ziko_badge_definitions_select_authenticated'
     )
  then
    alter table public.ziko_badge_definitions enable row level security;
    create policy "ziko_badge_definitions_select_authenticated"
      on public.ziko_badge_definitions
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Seed UAT v1.20 -- branche Supabase JETABLE uat-v1-20 (ref oloobswzsziidjwycthm) UNIQUEMENT. JAMAIS la prod.
-- Idempotent (ON CONFLICT / WHERE NOT EXISTS). Remplacer __ATHLETE_B_PASSWORD__ avant execution
-- (valeur UAT_ATHLETE_B_PASSWORD de .uat/env, jamais commitee).
-- Comptes existants : athlete a0a0a0a0-0000-4000-8000-0000000000a1, coach c0c0c0c0-0000-4000-8000-0000000000c1.
-- Note P7 : un seul programme actif par athlete (index unique) -> le programme perso 3x8 est ACTIF, le
-- programme coach est insere INACTIF ; pour le flow P7 lancer la requete SWITCH_COACH en bas.

-- ============ Athlete B ============
do $$
declare b uuid := 'b0b0b0b0-0000-4000-8000-0000000000b1';
begin
  if not exists (select 1 from auth.users where id = b) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', b, 'authenticated', 'authenticated', 'uat-athlete-b@uat.ziko.test',
      crypt('__ATHLETE_B_PASSWORD__', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), b, b::text, jsonb_build_object('sub', b::text, 'email', 'uat-athlete-b@uat.ziko.test', 'email_verified', true),
      'email', now(), now(), now());
  end if;
  insert into public.ziko_user_profiles (id, name, role, onboarding_done, handle, is_public)
  values (b, 'Athlete B', 'client', true, 'uat_athlete_b', true)
  on conflict (id) do update set onboarding_done = true, name = coalesce(public.ziko_user_profiles.name, 'Athlete B');
  insert into public.ziko_athlete_state (user_id, status, tier) values (b, 'active', 5)
  on conflict (user_id) do nothing;
end $$;

-- ============ Programme perso actif : 3 seances x 8 exercices ============
insert into public.ziko_workout_programs (id, user_id, name, description, days_per_week, is_active)
values ('d1000000-0000-4000-8000-000000000001', 'a0a0a0a0-0000-4000-8000-0000000000a1', 'UAT Full Body 3x8', 'Seed UAT', 3, false)
on conflict (id) do nothing;

insert into public.ziko_program_workouts (id, program_id, day_of_week, name, order_index)
values
 ('d1000000-0000-4000-8000-0000000000a1','d1000000-0000-4000-8000-000000000001',1,'Seance A',0),
 ('d1000000-0000-4000-8000-0000000000a2','d1000000-0000-4000-8000-000000000001',3,'Seance B',1),
 ('d1000000-0000-4000-8000-0000000000a3','d1000000-0000-4000-8000-000000000001',5,'Seance C',2)
on conflict (id) do nothing;

with ex as (
  select id, row_number() over (order by name, id) - 1 as n from (select id, name from public.ziko_exercises where user_id is null order by name, id limit 24) s
)
insert into public.ziko_program_exercises (id, workout_id, exercise_id, sets, reps, rest_seconds, order_index, weight_kg)
select md5('uat-pe-' || ex.n)::uuid,
       ('d1000000-0000-4000-8000-0000000000a' || (ex.n / 8 + 1))::uuid,
       ex.id, 3, 10, 90, (ex.n % 8), 20
from ex
on conflict (id) do nothing;

-- Seance vide historique (aucun set)
insert into public.ziko_workout_sessions (id, user_id, name, started_at, ended_at, total_sets, total_reps, total_exercises)
values ('d1000000-0000-4000-8000-0000000000e1', 'a0a0a0a0-0000-4000-8000-0000000000a1', 'Seance vide historique',
        now() - interval '3 days', now() - interval '3 days' + interval '2 minutes', 0, 0, 0)
on conflict (id) do nothing;

-- ============ Programme coach (INACTIF par defaut, voir SWITCH_COACH) ============
insert into public.ziko_workout_programs (id, user_id, name, days_per_week, is_active, created_by_coach_id, assigned_to_user_id, weeks_count, current_cycle_week)
values ('d2000000-0000-4000-8000-000000000001', null, 'Force 5x5, bloc 2', 3, false,
        'c0c0c0c0-0000-4000-8000-0000000000c1', 'a0a0a0a0-0000-4000-8000-0000000000a1', 8, 3)
on conflict (id) do nothing;
insert into public.ziko_program_workouts (id, program_id, day_of_week, name, order_index)
values ('d2000000-0000-4000-8000-0000000000a1','d2000000-0000-4000-8000-000000000001',1,'Force jour 1',0)
on conflict (id) do nothing;
-- SWITCH_COACH (P7) :
--   update ziko_workout_programs set is_active=false where id='d1000000-0000-4000-8000-000000000001';
--   update ziko_workout_programs set is_active=true  where id='d2000000-0000-4000-8000-000000000001';

-- ============ Badges + pieces ============
insert into public.ziko_badge_definitions (id, slug, name, description, icon, condition_type, condition_value, tier)
select md5('uat-badge-' || i)::uuid, 'uat-badge-' || i, 'Badge UAT ' || i, 'Description du badge UAT ' || i,
       'trophy-outline', 'sessions', i * 5, 1 + (i % 3)
from generate_series(1, 12) i
on conflict do nothing;
insert into public.ziko_user_badges (id, user_id, badge_slug)
select md5('uat-ub-' || i)::uuid, 'a0a0a0a0-0000-4000-8000-0000000000a1', 'uat-badge-' || i from generate_series(1, 5) i
on conflict do nothing;
insert into public.ziko_coin_transactions (id, user_id, amount, source, description)
values ('d3000000-0000-4000-8000-000000000001','a0a0a0a0-0000-4000-8000-0000000000a1', 500, 'achievement', 'Seed UAT'),
       ('d3000000-0000-4000-8000-000000000002','a0a0a0a0-0000-4000-8000-0000000000a1', -20, 'purchase', 'Seed UAT depense')
on conflict (id) do nothing;
insert into public.ziko_xp_transactions (id, user_id, amount, source, description)
values ('d3000000-0000-4000-8000-000000000003','a0a0a0a0-0000-4000-8000-0000000000a1', 350, 'achievement', 'Seed UAT')
on conflict (id) do nothing;
insert into public.ziko_shop_items (id, name, description, category, price, icon, level_required, is_active)
select md5('uat-shop-' || i)::uuid, 'Article UAT ' || i, 'Article de boutique UAT', 'theme', 50 * i, 'color-palette-outline', 1, true
from generate_series(1, 4) i
on conflict (id) do nothing;

-- ============ Complements : produits + prix ============
insert into public.ziko_supplement_brands (id, name, slug) values
 ('d4000000-0000-4000-8000-000000000001','Marque UAT Alpha','uat-alpha'),
 ('d4000000-0000-4000-8000-000000000002','Marque UAT Beta','uat-beta')
on conflict (id) do nothing;
insert into public.ziko_supplement_categories (id, name, slug, icon, display_order) values
 ('d4100000-0000-4000-8000-000000000001','Proteines UAT','uat-proteines','nutrition-outline',1),
 ('d4100000-0000-4000-8000-000000000002','Creatine UAT','uat-creatine','flash-outline',2)
on conflict (id) do nothing;
insert into public.ziko_supplements (id, brand_id, category_id, name, slug, description, serving_size, servings_per_container)
select md5('uat-sup-' || i)::uuid,
       ('d4000000-0000-4000-8000-00000000000' || (1 + i % 2))::uuid,
       ('d4100000-0000-4000-8000-00000000000' || (1 + i % 2))::uuid,
       'Complement UAT ' || i, 'uat-sup-' || i, 'Produit seed UAT ' || i, '30 g', 30 + i
from generate_series(1, 6) i
on conflict (id) do nothing;
insert into public.ziko_supplement_prices (id, supplement_id, price, currency, source, in_stock, price_per_serving)
select md5('uat-price-' || i || '-' || s.src)::uuid, md5('uat-sup-' || i)::uuid,
       round((19 + i * 4 + s.off)::numeric, 2), 'EUR', s.src, true, round(((19 + i * 4 + s.off) / (30 + i))::numeric, 2)
from generate_series(1, 6) i, (values ('Shop UAT 1', 0), ('Shop UAT 2', 3), ('Shop UAT 3', -2)) as s(src, off)
on conflict (id) do nothing;

-- ============ Garde-manger ============
insert into public.ziko_pantry_items (id, user_id, name, quantity, unit, storage_location, food_category, expiration_date)
values
 ('d5000000-0000-4000-8000-000000000001','a0a0a0a0-0000-4000-8000-0000000000a1','Oeufs',12,'pieces','fridge','eggs', current_date + 10),
 ('d5000000-0000-4000-8000-000000000002','a0a0a0a0-0000-4000-8000-0000000000a1','Riz basmati',1000,'g','pantry','grains_pasta', current_date + 200),
 ('d5000000-0000-4000-8000-000000000003','a0a0a0a0-0000-4000-8000-0000000000a1','Lait demi-ecreme',1,'L','fridge','dairy', current_date + 2),
 ('d5000000-0000-4000-8000-000000000004','a0a0a0a0-0000-4000-8000-0000000000a1','Poulet',500,'g','freezer','meat', current_date + 60),
 ('d5000000-0000-4000-8000-000000000005','a0a0a0a0-0000-4000-8000-0000000000a1','Pommes',6,'pieces','pantry','fruits', current_date + 5),
 ('d5000000-0000-4000-8000-000000000006','a0a0a0a0-0000-4000-8000-0000000000a1','Yaourt grec',4,'pieces','fridge','dairy', current_date - 1)
on conflict (id) do nothing;

-- Etat garanti (rejoue idempotent) : programme perso 3x8 inactif (= P-CREE de P7). Le programme ACTIF seed
-- est le programme IA ci-dessous (base de P6).
update public.ziko_workout_programs set is_active = false where id = 'd1000000-0000-4000-8000-000000000001';

-- ============ Programme IA ACTIF (base P6) : 3 seances x 8 exercices ============
insert into public.ziko_ai_generated_programs (id, user_id, name, goal, split_type, days_per_week, is_active, program_data)
select 'd6000000-0000-4000-8000-000000000001', 'a0a0a0a0-0000-4000-8000-0000000000a1', 'UAT Full Body Power', 'muscle_gain', 'full_body', 3, true,
  jsonb_build_object('weeks', jsonb_build_array(jsonb_build_object('w', 1, 'sessions', (
    select jsonb_agg(jsonb_build_object('name', n.nm, 'exercises', (
      select jsonb_agg(jsonb_build_object('name', e.name, 'sets', 3, 'reps', 10) order by e.rn)
      from (select name, row_number() over (order by name, id) rn from public.ziko_exercises where user_id is null order by name, id limit 24) e
      where (e.rn - 1) / 8 = n.idx))
      order by n.idx)
    from (values (0,'Full Body Power'),(1,'Upper'),(2,'Lower')) as n(idx, nm)))))
where not exists (select 1 from public.ziko_ai_generated_programs where id = 'd6000000-0000-4000-8000-000000000001');

-- Niveau eleve pour debloquer tous les modules (gating par niveau) : athlete A et B
update public.ziko_athlete_state set level = 5, points = 500 where user_id in ('a0a0a0a0-0000-4000-8000-0000000000a1','b0b0b0b0-0000-4000-8000-0000000000b1');
insert into public.ziko_athlete_state (user_id, status, tier, level, points)
values ('a0a0a0a0-0000-4000-8000-0000000000a1', 'active', 5, 5, 500) on conflict (user_id) do update set tier = 5, level = 5;

-- Solde de pieces et XP (la puce "Solde" lit ziko_user_gamification.coins, pas les transactions)
insert into public.ziko_user_gamification (user_id, xp, level, coins, current_streak, longest_streak)
values ('a0a0a0a0-0000-4000-8000-0000000000a1', 350, 3, 480, 5, 7)
on conflict (user_id) do update set xp = 350, level = 3, coins = 480, current_streak = 5, longest_streak = 7;

-- FIXTURE BRANCHE UNIQUEMENT : ziko_badge_definitions a RLS active et AUCUNE policy SELECT dans les migrations
-- du depot (constat UAT P12 : Succes = "0 sur 0"). Verifier la prod avant release ; ne pas porter en migration sans decision.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ziko_badge_definitions') then
    create policy "badge_definitions_read_uat" on public.ziko_badge_definitions for select using (true);
  end if;
end $$;

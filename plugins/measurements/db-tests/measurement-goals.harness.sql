-- Harness local jetable : stubs minimaux (auth, roles, tables) puis les 2 migrations P15, puis assertions.
-- Usage (PostgreSQL local jetable, JAMAIS la base portfolio) :
--   psql -h localhost -p <port> -U postgres -d <base_vide> -q -f plugins/measurements/db-tests/measurement-goals.harness.sql
-- Succes = 21 lignes "PASS", 0 "FAIL"/"ERREUR". Ne prouve pas le comportement sur le schema reel (stubs), voir
-- backend/api/test/rls/measurement-goals.spec.ts pour le test contre une base de test Supabase.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
CREATE FUNCTION public.ziko_handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TABLE public.ziko_athlete_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  goal_text text NOT NULL, target_metric text, target_value numeric, target_date date,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active','achieved','abandoned')),
  created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
CREATE TRIGGER trg_athlete_goals_updated BEFORE UPDATE ON public.ziko_athlete_goals FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_updated_at();
ALTER TABLE public.ziko_athlete_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY g_sel ON public.ziko_athlete_goals FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.ziko_athlete_goals FROM PUBLIC; GRANT SELECT ON public.ziko_athlete_goals TO authenticated;
CREATE TABLE public.ziko_body_measurements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  weight_kg numeric(5,2), body_fat_pct numeric(4,1), waist_cm numeric(5,1), chest_cm numeric(5,1),
  arm_cm numeric(5,1), thigh_cm numeric(5,1), hip_cm numeric(5,1), photo_url text,
  date date DEFAULT CURRENT_DATE NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
ALTER TABLE public.ziko_body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY m_own ON public.ziko_body_measurements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ziko_body_measurements TO authenticated;
-- ligne pre-existante type create_goal (doit rester valide)
INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
INSERT INTO public.ziko_athlete_goals (user_id, goal_text, target_metric, target_value, status)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Lose 5kg', 'weight_kg', 5, 'active');

\ir '../../../supabase/migrations/202612011501_measurement_goals_extend.sql'
\ir '../../../supabase/migrations/202612011502_measurement_goals_achieved_trigger.sql'

-- ===== assertions =====
CREATE FUNCTION public.expect(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT cond THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
GRANT EXECUTE ON FUNCTION public.expect(text, boolean) TO PUBLIC;

SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT public.expect('RPC creation poids 79.4 -> 76', (public.ziko_create_measurement_goal('weight_kg', 79.4, 76))->>'success' = 'true');
SELECT public.expect('ligne en base depart 79.4 / cible 76 / unit kg', (SELECT start_value = 79.4 AND target_value = 76 AND unit = 'kg' AND status = 'active' AND goal_text = 'Poids 79.4 -> 76.0 kg' FROM public.ziko_athlete_goals WHERE measure_key = 'weight_kg'));
SELECT public.expect('2e objectif actif meme mesure refuse', (public.ziko_create_measurement_goal('weight_kg', 79, 75))->>'error' = 'active_goal_exists');
SELECT public.expect('cible = depart refusee', (public.ziko_create_measurement_goal('arm_cm', 37.2, 37.2))->>'error' = 'target_equals_start');
SELECT public.expect('hors plage refuse', (public.ziko_create_measurement_goal('weight_kg', 80, 5))->>'error' = 'out_of_range');
SELECT public.expect('mesure invalide refusee', (public.ziko_create_measurement_goal('foo', 1, 2))->>'error' = 'invalid_measure');
SELECT public.expect('objectif hausse bras cree', (public.ziko_create_measurement_goal('arm_cm', 36, 40))->>'success' = 'true');
-- ME-5 : client ne peut ni UPDATE ni INSERT direct
DO $$ BEGIN BEGIN UPDATE public.ziko_athlete_goals SET target_value = 70 WHERE measure_key = 'weight_kg'; RAISE EXCEPTION 'FAIL: update client accepte'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: UPDATE direct client refuse (privilege)'; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO public.ziko_athlete_goals (user_id, goal_text) VALUES (auth.uid(), 'x'); RAISE EXCEPTION 'FAIL: insert client accepte'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: INSERT direct client refuse (privilege)'; END; END $$;
-- isolation lecture
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT public.expect('autre utilisateur ne voit rien', (SELECT count(*) = 0 FROM public.ziko_athlete_goals));
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT public.expect('anon ne peut pas appeler la RPC (EXECUTE)', NOT has_function_privilege('anon', 'public.ziko_create_measurement_goal(text,numeric,numeric,date)', 'EXECUTE'));
RESET ROLE;

-- verrou trigger, meme si un GRANT UPDATE etait remis par erreur
GRANT UPDATE ON public.ziko_athlete_goals TO authenticated;
CREATE POLICY g_upd ON public.ziko_athlete_goals FOR UPDATE USING (auth.uid() = user_id);
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
DO $$ BEGIN BEGIN UPDATE public.ziko_athlete_goals SET target_value = 70 WHERE measure_key = 'weight_kg'; RAISE EXCEPTION 'FAIL: trigger verrou absent'; EXCEPTION WHEN SQLSTATE 'P0001' THEN RAISE NOTICE 'PASS: trigger refuse la modification de cible (objectif actif)'; END; END $$;
RESET ROLE;
DROP POLICY g_upd ON public.ziko_athlete_goals; REVOKE UPDATE ON public.ziko_athlete_goals FROM authenticated;
-- porte IA (P16) : flag local
BEGIN; SELECT set_config('ziko.allow_goal_edit', 'on', true); UPDATE public.ziko_athlete_goals SET target_value = 75 WHERE measure_key = 'weight_kg';
SELECT public.expect('porte IA allow_goal_edit autorise la modification', (SELECT target_value = 75 FROM public.ziko_athlete_goals WHERE measure_key='weight_kg')); ROLLBACK;

-- atteinte automatique
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.ziko_body_measurements (user_id, weight_kg) VALUES (auth.uid(), 78.0);
SELECT public.expect('mesure intermediaire : objectif reste actif', (SELECT status = 'active' FROM public.ziko_athlete_goals WHERE measure_key='weight_kg'));
INSERT INTO public.ziko_body_measurements (user_id, weight_kg, arm_cm) VALUES (auth.uid(), 75.8, 35);
SELECT public.expect('poids 75.8 <= 76 : atteint (baisse)', (SELECT status = 'achieved' AND achieved_value = 75.8 AND achieved_at IS NOT NULL FROM public.ziko_athlete_goals WHERE measure_key='weight_kg'));
SELECT public.expect('bras 35 < 40 hausse : reste actif', (SELECT status = 'active' FROM public.ziko_athlete_goals WHERE measure_key='arm_cm'));
INSERT INTO public.ziko_body_measurements (user_id, arm_cm) VALUES (auth.uid(), 40.2);
SELECT public.expect('bras 40.2 >= 40 : atteint (hausse)', (SELECT status = 'achieved' FROM public.ziko_athlete_goals WHERE measure_key='arm_cm'));
-- suivant apres atteint (ME-6)
SELECT public.expect('nouvel objectif poids apres atteint', (public.ziko_create_measurement_goal('weight_kg', 75.8, 72))->>'success' = 'true');
SELECT public.expect('ancien conserve en historique', (SELECT count(*) = 2 FROM public.ziko_athlete_goals WHERE measure_key='weight_kg') AND (SELECT count(*) = 1 FROM public.ziko_athlete_goals WHERE measure_key='weight_kg' AND status='achieved'));
-- mesure datee avant la creation de l'objectif : n'atteint pas
INSERT INTO public.ziko_body_measurements (user_id, weight_kg, date) VALUES (auth.uid(), 70, CURRENT_DATE - 30);
SELECT public.expect('mesure anterieure au depart n atteint pas', (SELECT status = 'active' FROM public.ziko_athlete_goals WHERE measure_key='weight_kg' AND status <> 'achieved'));
RESET ROLE;
-- ligne create_goal pre-existante intacte
SELECT public.expect('ligne create_goal pre-existante valide (measure_key NULL)', (SELECT count(*) = 1 FROM public.ziko_athlete_goals WHERE measure_key IS NULL AND goal_text = 'Lose 5kg'));

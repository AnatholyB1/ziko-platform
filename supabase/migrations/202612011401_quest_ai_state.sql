-- v1.20 phase 14 (QUEST-04 / QUEST-05) : etat de generation IA des quetes + creation plafonnee a 3 actives.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011301 / 202612011302 (P13) et ziko_user_gamification.
--
-- Le plafond de 3 quetes actives et le declenchement (passage de niveau / plus aucune quete) vivent ICI,
-- dans la base, sous le meme verrou consultatif que ziko_sync_quests : deux appels concurrents ne peuvent pas
-- depasser 3. Toutes les fonctions sont reservees a service_role (backend).

-- 1. Etat par utilisateur (dernier niveau vu par la generation, quota quotidien des appels automatiques).
CREATE TABLE IF NOT EXISTS public.ziko_quest_ai_state (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_level        integer,
  auto_day          date,
  auto_count        integer NOT NULL DEFAULT 0,
  last_generated_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_quest_ai_state_count_check CHECK (auto_count >= 0)
);
ALTER TABLE public.ziko_quest_ai_state ENABLE ROW LEVEL SECURITY;
-- Aucune policy : ni lecture ni ecriture pour anon / authenticated ; service_role contourne la RLS.
REVOKE ALL ON TABLE public.ziko_quest_ai_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ziko_quest_ai_state TO service_role;

-- 2. Reservation d'une generation : decide si l'IA doit etre appelee, combien de quetes elle peut creer.
--    p_force = true : demande explicite de l'utilisateur (outil du chat, deja debite par creditCheck) :
--    pas de quota quotidien, mais le plafond de 3 s'applique toujours.
--    Raisons : requested | no_quest | level_up (proceed = true) ;
--              full | not_needed | not_initialized | daily_cap (proceed = false).
CREATE OR REPLACE FUNCTION public.ziko_quest_ai_claim(p_user_id uuid, p_daily_cap integer DEFAULT 2, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now     timestamptz := now();
  v_today   date := (v_now AT TIME ZONE 'Europe/Paris')::date;
  v_active  integer;
  v_slots   integer;
  v_level   integer;
  v_st      public.ziko_quest_ai_state%ROWTYPE;
  v_any     boolean;
  v_reason  text;
  v_levelup boolean;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  -- Actives = en cours ET non echues (une quete echue pas encore synchronisee ne bloque pas un slot).
  SELECT COUNT(*) INTO v_active FROM public.ziko_user_quests
   WHERE user_id = p_user_id AND status = 'active' AND expires_at > v_now;
  v_slots := GREATEST(0, 3 - v_active);
  SELECT COALESCE((SELECT level FROM public.ziko_user_gamification WHERE user_id = p_user_id), 1) INTO v_level;
  SELECT EXISTS (SELECT 1 FROM public.ziko_user_quests WHERE user_id = p_user_id) INTO v_any;

  INSERT INTO public.ziko_quest_ai_state (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_st FROM public.ziko_quest_ai_state WHERE user_id = p_user_id FOR UPDATE;
  v_levelup := v_st.last_level IS NOT NULL AND v_level > v_st.last_level;

  IF NOT v_any AND NOT p_force THEN
    -- Aucune quete n'a jamais ete synchronisee : les quetes de depart passent d'abord.
    RETURN jsonb_build_object('proceed', false, 'reason', 'not_initialized', 'slots', v_slots, 'level', v_level, 'active', v_active);
  END IF;

  IF v_slots = 0 THEN
    -- Plafond atteint : le niveau est considere comme vu (le nombre cree complete ce qui reste = 0).
    UPDATE public.ziko_quest_ai_state SET last_level = v_level, updated_at = v_now WHERE user_id = p_user_id;
    RETURN jsonb_build_object('proceed', false, 'reason', 'full', 'slots', 0, 'level', v_level, 'active', v_active);
  END IF;

  IF p_force THEN
    v_reason := 'requested';
  ELSIF v_active = 0 THEN
    v_reason := 'no_quest';
  ELSIF v_levelup THEN
    v_reason := 'level_up';
  ELSE
    IF v_st.last_level IS NULL THEN
      UPDATE public.ziko_quest_ai_state SET last_level = v_level, updated_at = v_now WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object('proceed', false, 'reason', 'not_needed', 'slots', v_slots, 'level', v_level, 'active', v_active);
  END IF;

  IF NOT p_force THEN
    IF v_st.auto_day = v_today AND v_st.auto_count >= p_daily_cap THEN
      -- Quota quotidien des appels automatiques atteint : on ne consomme pas le niveau (reessai demain).
      RETURN jsonb_build_object('proceed', false, 'reason', 'daily_cap', 'slots', v_slots, 'level', v_level, 'active', v_active);
    END IF;
    UPDATE public.ziko_quest_ai_state
       SET auto_count = CASE WHEN auto_day = v_today THEN auto_count + 1 ELSE 1 END,
           auto_day = v_today
     WHERE user_id = p_user_id;
  END IF;
  UPDATE public.ziko_quest_ai_state SET last_level = v_level, last_generated_at = v_now, updated_at = v_now
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object('proceed', true, 'reason', v_reason, 'slots', v_slots, 'level', v_level, 'active', v_active);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_ai_claim(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_quest_ai_claim(uuid, integer, boolean) TO service_role;

-- 3. Creation plafonnee : insere au plus (3 - actives) quetes, les surplus sont ignores et comptes.
--    Valide chaque quete via ziko_create_quests (metrique en liste blanche, cible > 0, pieces 0..500, duree 1..840 h).
CREATE OR REPLACE FUNCTION public.ziko_create_ai_quests(p_user_id uuid, p_quests jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now     timestamptz := now();
  v_active  integer;
  v_slots   integer;
  v_total   integer;
  v_take    jsonb;
  v_res     jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR jsonb_typeof(p_quests) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  SELECT COUNT(*) INTO v_active FROM public.ziko_user_quests
   WHERE user_id = p_user_id AND status = 'active' AND expires_at > v_now;
  v_slots := GREATEST(0, 3 - v_active);
  v_total := jsonb_array_length(p_quests);

  SELECT COALESCE(jsonb_agg(s.e ORDER BY s.n), '[]'::jsonb) INTO v_take
    FROM (SELECT t.e, t.n FROM jsonb_array_elements(p_quests) WITH ORDINALITY AS t(e, n) ORDER BY t.n LIMIT v_slots) s;

  IF jsonb_array_length(v_take) = 0 THEN
    RETURN jsonb_build_object('created', '[]'::jsonb, 'skipped', v_total, 'slots_before', v_slots);
  END IF;

  v_res := public.ziko_create_quests(p_user_id, v_take);
  RETURN jsonb_build_object('created', v_res -> 'created', 'skipped', v_total - jsonb_array_length(v_take), 'slots_before', v_slots);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_create_ai_quests(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_create_ai_quests(uuid, jsonb) TO service_role;

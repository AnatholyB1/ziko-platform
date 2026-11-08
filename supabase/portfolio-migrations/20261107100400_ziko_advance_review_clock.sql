-- v1.18 final fix (UAT low #2): an athlete whose due week already has a
-- weekly_focus decision (`already_recorded`) kept next_review_due_at in the
-- past, so every cron rescanned them (and they could fill the 40-row batch
-- cap). Additive: a new narrow function, no existing function is replaced.
-- It only rolls the review clock forward, and only when a weekly_focus
-- decision really exists for the due week; points/tier/readiness untouched.
CREATE OR REPLACE FUNCTION public.ziko_advance_review_clock(p_user_id uuid, p_week_of date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.ziko_athlete_state s
  SET next_review_due_at = NOW() + INTERVAL '7 days',
      updated_at = NOW()
  WHERE s.user_id = p_user_id
    AND s.next_review_due_at IS NOT NULL
    AND s.next_review_due_at <= NOW()
    AND s.next_review_due_at::date = p_week_of
    AND EXISTS (
      SELECT 1 FROM public.ziko_athlete_decisions d
      WHERE d.user_id = p_user_id
        AND d.decision_type = 'weekly_focus'
        AND d.week_of = p_week_of
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'advanced', v_rows > 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.ziko_advance_review_clock(uuid, date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_advance_review_clock(uuid, date) TO service_role;

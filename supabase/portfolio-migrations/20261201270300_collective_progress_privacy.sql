-- ============================================================
-- v1.20 - Defi collectif : vie privee de l'agregat (audit AUDIT-SECURITY.md constat 8)
-- Fichier seulement. IDEMPOTENT (CREATE OR REPLACE). Depend de 202612012605 (ordre : apres).
--
-- Avant : (a) apres revocation du lien coach, la contribution de l'athlete continuait d'etre agregee pour le coach
-- (la ligne participant restait 'joined') ; (b) avec 1 ou 2 participants, le total revelait la donnee individuelle
-- (1 participant : total = sa donnee ; 2 : total - ma contribution = celle de l'autre).
-- Maintenant :
--   * seuls comptent les participants 'joined' dont le lien avec le coach du defi est ACTIF (non revoque, non expire) ;
--   * le total n'est renvoye que si au moins 3 participants actifs ont rejoint (sinon NULL + total_hidden = true,
--     min_participants = 3). Sa propre contribution reste toujours visible pour l'athlete concerne ;
--   * joined_count compte les participants actifs (liens revoques exclus).
-- Le lien est lu directement dans ziko_coach_client_links (pas via ziko_is_coach_of, qui ne repond plus que pour
-- l'appelant : un athlete ne doit pas etre juge sur le lien d'un autre participant).
-- ============================================================

CREATE OR REPLACE FUNCTION public.ziko_collective_progress(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  c        public.ziko_collective_challenges%ROWTYPE;
  v_mine   text;
  v_total  numeric := 0;
  v_joined integer := 0;
  v_my     numeric;
  v_min    constant integer := 3;
  r        record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO c FROM public.ziko_collective_challenges WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT status INTO v_mine FROM public.ziko_collective_participants WHERE challenge_id = p_id AND user_id = v_uid;
  IF c.coach_id <> v_uid AND v_mine IS NULL THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;

  FOR r IN SELECT p.user_id, GREATEST(c.start_date, (p.responded_at AT TIME ZONE 'Europe/Paris')::date) AS from_day
             FROM public.ziko_collective_participants p
            WHERE p.challenge_id = p_id AND p.status = 'joined' AND p.responded_at IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.ziko_coach_client_links l
                           WHERE l.coach_id = c.coach_id AND l.client_id = p.user_id
                             AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now()))
  LOOP
    v_joined := v_joined + 1;
    v_total := v_total + public.ziko_collective_contribution(r.user_id, c.metric, r.from_day, c.end_date);
    IF r.user_id = v_uid THEN
      v_my := public.ziko_collective_contribution(r.user_id, c.metric, r.from_day, c.end_date);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'id', c.id, 'title', c.title, 'metric', c.metric, 'target_total', c.target_total,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'role', CASE WHEN c.coach_id = v_uid THEN 'coach' ELSE 'athlete' END,
    'my_status', v_mine,
    'joined_count', v_joined,
    'total', CASE WHEN v_joined >= v_min THEN v_total ELSE NULL END,
    'total_hidden', v_joined < v_min,
    'min_participants', v_min,
    'my_contribution', CASE WHEN c.coach_id = v_uid THEN NULL ELSE v_my END
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_collective_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_collective_progress(uuid) TO authenticated;

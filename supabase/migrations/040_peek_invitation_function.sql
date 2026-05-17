-- Migration 040: peek_invitation companion to redeem_invitation_code (Phase 25 D-06, Q2)
-- Constant-time SELECT + CASE chain mirroring migration 035 keystone RPC.
-- Does NOT mutate state — read-only preview of an invitation code.
CREATE OR REPLACE FUNCTION public.peek_invitation(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv       RECORD;
  v_error     TEXT := NULL;
BEGIN
  SELECT
    inv.id            AS id,
    inv.coach_id      AS coach_id,
    inv.expires_at    AS expires_at,
    inv.revoked_at    AS revoked_at,
    inv.use_count     AS use_count,
    inv.max_uses      AS max_uses,
    EXISTS (
      SELECT 1 FROM public.coach_client_links l
      WHERE l.coach_id = inv.coach_id
        AND l.client_id = v_caller_id
        AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )                  AS link_exists,
    cp.display_name   AS display_name,
    cp.bio            AS bio,
    cp.specialties    AS specialties,
    cp.photo_url      AS photo_url,
    cp.kyc_status     AS kyc_status
  INTO v_inv
  FROM public.coach_invitations inv
  LEFT JOIN public.coach_profiles cp ON cp.user_id = inv.coach_id
  WHERE inv.code = code_input
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    v_error := 'INVALID_CODE';
  ELSIF v_inv.coach_id = v_caller_id THEN
    v_error := 'SELF_INVITATION';
  ELSIF v_inv.revoked_at IS NOT NULL THEN
    v_error := 'REVOKED';
  ELSIF v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= now() THEN
    v_error := 'EXPIRED';
  ELSIF v_inv.use_count >= v_inv.max_uses THEN
    v_error := 'ALREADY_USED';
  ELSIF v_inv.link_exists THEN
    v_error := 'LINK_EXISTS';
  END IF;

  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'preview', NULL, 'error_code', v_error);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'error_code', NULL,
    'preview', jsonb_build_object(
      'coach_id', v_inv.coach_id,
      'display_name', v_inv.display_name,
      'bio', v_inv.bio,
      'specialties', v_inv.specialties,
      'photo_url', v_inv.photo_url,
      'kyc_status', v_inv.kyc_status
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peek_invitation(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.peek_invitation(TEXT) TO authenticated;

COMMENT ON FUNCTION public.peek_invitation(TEXT) IS
  'Phase 25 D-06/Q2: read-only constant-time peek companion to redeem_invitation_code. Returns coach preview payload on valid code, or { ok:false, error_code } on any failure. photo_url is bucket path; caller signs before exposing.';

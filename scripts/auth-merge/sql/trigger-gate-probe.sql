-- Phase 3 D-07: trigger gate probe. Always rolls back (ends with RAISE EXCEPTION).
-- Expected message: PROBE unflagged_profiles=0 unflagged_credits=0 unflagged_txns=0
--                         flagged_profiles=1 flagged_credits=1 flagged_txns=1
-- Counts are scoped to the probe's own ids only (never table totals).
DO $probe$
DECLARE
  v_unflagged uuid := gen_random_uuid();
  v_flagged   uuid := gen_random_uuid();
  v_up int; v_uc int; v_ut int;
  v_fp int; v_fc int; v_ft int;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES
  ('00000000-0000-0000-0000-000000000000', v_unflagged, 'authenticated', 'authenticated',
   'probe-unflagged-' || left(v_unflagged::text, 8) || '@example.invalid', '', now(),
   '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_flagged, 'authenticated', 'authenticated',
   'probe-flagged-' || left(v_flagged::text, 8) || '@example.invalid', '', now(),
   '{}'::jsonb, '{"app":"ziko"}'::jsonb, now(), now(), '', '', '', '');

  SELECT count(*) INTO v_up FROM public.ziko_user_profiles WHERE id = v_unflagged;
  SELECT count(*) INTO v_uc FROM public.ziko_user_ai_credits WHERE user_id = v_unflagged;
  SELECT count(*) INTO v_ut FROM public.ziko_ai_credit_transactions WHERE user_id = v_unflagged;
  SELECT count(*) INTO v_fp FROM public.ziko_user_profiles WHERE id = v_flagged;
  SELECT count(*) INTO v_fc FROM public.ziko_user_ai_credits WHERE user_id = v_flagged;
  SELECT count(*) INTO v_ft FROM public.ziko_ai_credit_transactions WHERE user_id = v_flagged;

  RAISE EXCEPTION 'PROBE unflagged_profiles=% unflagged_credits=% unflagged_txns=% flagged_profiles=% flagged_credits=% flagged_txns=%',
    v_up, v_uc, v_ut, v_fp, v_fc, v_ft;
END
$probe$;

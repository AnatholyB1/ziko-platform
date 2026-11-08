-- v1.17 phase 3: application-level email verification (Resend), NO Supabase "Confirm email".
-- NOT applied to any database. Apply only on explicit user approval (see DEPLOY-CHECKLIST-v1.17.md).
-- Additive only.
--
-- Trust model: the backend calls these RPCs with the USER's JWT (publishable key, no service role),
-- so the DB cannot tell backend and user apart. To stop a user from verifying himself directly
-- through PostgREST, every state-changing RPC also requires a backend secret (p_secret) whose
-- SHA-256 is stored in ziko_email_verify_settings. That row is inserted by hand at deploy time
-- (never in a migration). Until it exists every RPC fails closed.

-- 1) profile column + guard -------------------------------------------------------------------
ALTER TABLE public.ziko_user_profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- The existing policy "users_own_profile" lets a user UPDATE his own row (FOR ALL), so the column
-- must be protected: direct writes by the client roles are rejected, SECURITY DEFINER RPCs
-- (current_user = owner) and admin roles are allowed.
CREATE OR REPLACE FUNCTION public.ziko_guard_email_verified_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND NEW.email_verified_at IS NOT NULL THEN
      RAISE EXCEPTION 'email_verified_at is write-protected' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'email_verified_at is write-protected' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ziko_guard_email_verified_at ON public.ziko_user_profiles;
CREATE TRIGGER trg_ziko_guard_email_verified_at
  BEFORE INSERT OR UPDATE ON public.ziko_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ziko_guard_email_verified_at();

-- 2) private tables (RLS on, no policy, no client grant) --------------------------------------
CREATE TABLE IF NOT EXISTS public.ziko_email_verifications (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  salt       text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ziko_email_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ziko_email_verifications FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ziko_email_verify_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.ziko_email_verify_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ziko_email_verify_settings FROM PUBLIC, anon, authenticated;

-- 3) secret gate -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_email_verify_secret_ok(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    (SELECT encode(sha256(convert_to(COALESCE(p_secret, ''), 'UTF8')), 'hex') = s.value
       FROM public.ziko_email_verify_settings s WHERE s.key = 'backend_secret_sha256'),
    false);
$function$;
REVOKE ALL ON FUNCTION public.ziko_email_verify_secret_ok(text) FROM PUBLIC, anon, authenticated;

-- 4) RPCs (identity = auth.uid(), never a parameter) --------------------------------------------
-- create/replace the pending code (10 min), attempts reset
CREATE OR REPLACE FUNCTION public.ziko_email_create_code(p_secret text, p_hash text, p_salt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.ziko_email_verify_secret_ok(p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ziko_email_verifications (user_id, code_hash, salt, expires_at, attempts, created_at)
  VALUES (v_uid, p_hash, p_salt, now() + interval '10 minutes', 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET code_hash = EXCLUDED.code_hash, salt = EXCLUDED.salt,
        expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now();
END;
$function$;

-- one verification attempt: increments attempts atomically (row lock), max 5, checks expiry.
-- status 'pending' => caller may compare; salt/code_hash are returned ONLY in that case.
CREATE OR REPLACE FUNCTION public.ziko_email_verify_attempt(p_secret text)
 RETURNS TABLE(status text, code_hash text, salt text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid(); r public.ziko_email_verifications%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.ziko_email_verify_secret_ok(p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.ziko_email_verifications v WHERE v.user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'none'::text, NULL::text, NULL::text; RETURN;
  END IF;
  IF r.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::text; RETURN;
  END IF;
  IF r.attempts >= 5 THEN
    RETURN QUERY SELECT 'too_many'::text, NULL::text, NULL::text; RETURN;
  END IF;
  UPDATE public.ziko_email_verifications v SET attempts = v.attempts + 1 WHERE v.user_id = v_uid;
  RETURN QUERY SELECT 'pending'::text, r.code_hash, r.salt;
END;
$function$;

-- called by the backend after a constant-time match: marks the profile, consumes the code
CREATE OR REPLACE FUNCTION public.ziko_email_confirm(p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.ziko_email_verify_secret_ok(p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ziko_user_profiles SET email_verified_at = now()
   WHERE id = v_uid AND email_verified_at IS NULL;
  DELETE FROM public.ziko_email_verifications WHERE user_id = v_uid;
END;
$function$;

-- marks the profile without a code: only called by the backend after it checked, with the user's
-- JWT, that a google/apple identity proves the account email (mark-verified-social)
CREATE OR REPLACE FUNCTION public.ziko_email_mark_verified_social(p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.ziko_email_verify_secret_ok(p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ziko_user_profiles SET email_verified_at = now()
   WHERE id = v_uid AND email_verified_at IS NULL;
  DELETE FROM public.ziko_email_verifications WHERE user_id = v_uid;
END;
$function$;

-- cooldown helper for the backend (age in seconds of the last code, NULL if none)
CREATE OR REPLACE FUNCTION public.ziko_email_code_age(p_secret text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid(); v_age integer;
BEGIN
  IF v_uid IS NULL OR NOT public.ziko_email_verify_secret_ok(p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT floor(extract(epoch FROM (now() - v.created_at)))::integer INTO v_age
    FROM public.ziko_email_verifications v WHERE v.user_id = v_uid;
  RETURN v_age;
END;
$function$;

-- Grants: Supabase default privileges give EXECUTE to anon/authenticated/service_role on new
-- functions, so revoke explicitly, then grant only to authenticated (the backend uses the user JWT).
REVOKE ALL ON FUNCTION public.ziko_email_create_code(text, text, text)  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ziko_email_verify_attempt(text)           FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ziko_email_confirm(text)                  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ziko_email_mark_verified_social(text)     FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ziko_email_code_age(text)                 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_email_create_code(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_email_verify_attempt(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_email_confirm(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_email_mark_verified_social(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_email_code_age(text)                TO authenticated;

-- One-off, by the user, at deploy time (value chosen by the user, same value as the Vercel env
-- EMAIL_VERIFY_RPC_SECRET; never commit it):
--   INSERT INTO public.ziko_email_verify_settings (key, value)
--   VALUES ('backend_secret_sha256', encode(sha256(convert_to('<the secret>', 'UTF8')), 'hex'))
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

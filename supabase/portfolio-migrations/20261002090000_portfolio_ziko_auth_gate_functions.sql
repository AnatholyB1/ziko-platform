-- Phase 3 (auth-merge), D-05: gate the Ziko signup triggers on the shared portfolio pool.
-- Both functions return early unless NEW.raw_user_meta_data->>'app' = 'ziko', so rh_/gecko_
-- signups create zero Ziko rows. Bodies are otherwise identical to the Phase 2 definitions;
-- both functions are pinned to search_path = public, pg_temp (hardening).
-- Apply manually: supabase db query --linked --project-ref <ref> -f <this file>. Never `db push`.
-- Idempotent (CREATE OR REPLACE). Triggers are attached by the NEXT file, after the import (D-06).

CREATE OR REPLACE FUNCTION public.ziko_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'app', '') <> 'ziko' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ziko_user_profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ziko_handle_new_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_welcome INTEGER := 5;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'app', '') <> 'ziko' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ziko_user_ai_credits (user_id, balance)
  VALUES (NEW.id, v_welcome)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ziko_ai_credit_transactions (user_id, type, amount, source)
  VALUES (NEW.id, 'welcome', v_welcome, 'signup');

  RETURN NEW;
END;
$function$;

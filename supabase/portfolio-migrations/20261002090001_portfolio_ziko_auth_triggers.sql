-- Phase 3 (auth-merge), D-06: attach the gated Ziko signup triggers to auth.users.
-- MUST run only AFTER the user import, so imported users do not fire welcome-credit logic.
-- Requires 20261002090000_portfolio_ziko_auth_gate_functions.sql to be applied first.
-- Apply manually: supabase db query --linked --project-ref <ref> -f <this file>. Never `db push`.

CREATE OR REPLACE TRIGGER ziko_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_new_user();

CREATE OR REPLACE TRIGGER ziko_on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ziko_handle_new_user_credits();

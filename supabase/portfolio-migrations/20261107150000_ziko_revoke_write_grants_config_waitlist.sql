-- Defense in depth: RLS is on with 0 policies, so these roles can already not write.
-- Remove write-class grants for anon/authenticated on the two sensitive tables. SELECT is kept on purpose.
-- Already applied to portfolio (ubxllsvanurkwkohzxau) on 2026-11-07 via the Supabase MCP.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.ziko_app_config FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.ziko_waitlist_signups FROM anon, authenticated;

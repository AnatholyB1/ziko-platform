-- ============================================================
-- 20260815 — Waitlist retention config seed (Phase 3, v1.16, LEGAL-08/D-05/D-16)
-- Seeds the CNIL NS-048 prospect-data retention ceiling (3 years,
-- measured from last contact, not from signup) into the app_config
-- table Phase 1 already created. No v1 code reads this key back
-- programmatically — it exists as a machine-readable source of truth
-- matching the published CGV/privacy-policy figure, for a future
-- cleanup job and for any auditor. Additive only: no DDL, no GRANT,
-- no policy — app_config's deny-all RLS posture covers this row for
-- free, exactly like waitlist_reveal_threshold before it.
-- ============================================================

INSERT INTO public.app_config (key, value)
VALUES ('waitlist_retention_years', '3')
ON CONFLICT (key) DO NOTHING;

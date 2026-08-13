-- ============================================================
-- 20260812 — Waitlist Founder Offer: capture core (Phase 1, v1.16)
-- Data Foundation: waitlist_signups table, founder-rank sequence,
-- email normalization helper, and the claim RPC.
-- Deny-all RLS + SECURITY DEFINER RPC idiom, per is_coach_of() /
-- redeem_invitation_code() (035) / peek_invitation (040).
-- app_config, get_waitlist_founder_status, anonymize_waitlist_signup,
-- and the sequence-reset admin RPC ship in a later plan (01-02).
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. waitlist_signups (D-01, D-11, D-13, D-14, D-15, D-16)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,             -- as typed, used for delivery (D-11)
  email_normalized  TEXT NOT NULL,             -- sub-address-neutralized identity key (D-10, D-11)
  audience          TEXT NOT NULL CHECK (audience IN ('athlete', 'coach')),
  locale            TEXT CHECK (locale IN ('fr', 'en')),
  utm_source        TEXT,
  utm_campaign      TEXT,
  is_founder        BOOLEAN NOT NULL DEFAULT false,
  founder_rank      INTEGER,
  consent_given_at  TIMESTAMPTZ,               -- D-15, filled by phase 3/5
  consent_version   TEXT,                      -- D-15, filled by phase 3/5
  anonymized_at     TIMESTAMPTZ,               -- D-16, set by anonymize_waitlist_signup() (01-02)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waitlist_signups_email_format_chk
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')  -- D-13 minimal format net
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_normalized
  ON public.waitlist_signups (email_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_founder_rank
  ON public.waitlist_signups (founder_rank) WHERE founder_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_audience_created
  ON public.waitlist_signups (audience, created_at DESC);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements (DATA-05). Deny-all + RPC-door idiom,
-- matching user_ai_credits / coach_client_links. No GRANT to anon or authenticated anywhere below.

-- ───────────────────────────────────────────────────────────
-- 2. Founder-rank sequence (DATA-02) — nextval() is the only
--    source of a founder rank; never derive the cap from a row count.
-- ───────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.waitlist_founder_seq;

-- ───────────────────────────────────────────────────────────
-- 3. normalize_waitlist_email() (D-10, D-12)
--    +suffix stripped for every domain; dots stripped ONLY for
--    gmail.com/googlemail.com — dots stay significant elsewhere.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_waitlist_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_email  TEXT := lower(trim(p_email));
  v_at     INTEGER := position('@' in lower(trim(p_email)));
  v_local  TEXT;
  v_domain TEXT;
BEGIN
  IF v_at = 0 THEN
    RETURN v_email;
  END IF;

  v_local  := substring(v_email from 1 for v_at - 1);
  v_domain := substring(v_email from v_at + 1);

  -- +suffix stripped for ALL domains (D-10)
  v_local := split_part(v_local, '+', 1);

  -- Dots stripped ONLY for Gmail/Googlemail — not universal (D-10, Pitfall 5)
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local := replace(v_local, '.', '');
  END IF;

  RETURN v_local || '@' || v_domain;
END;
$$;

-- REVOKE FROM PUBLIC alone is NOT sufficient on this project: ALTER DEFAULT PRIVILEGES
-- for schema public grants EXECUTE to anon/authenticated/service_role directly at
-- CREATE FUNCTION time (verified live — this also affects is_coach_of() /
-- redeem_invitation_code() / peek_invitation(), a pre-existing gap outside this phase's
-- scope). PUBLIC-only revoke never touches an already-materialized per-role grant, so
-- anon/authenticated must be revoked explicitly, by name, on every new function.
REVOKE EXECUTE ON FUNCTION public.normalize_waitlist_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_waitlist_email(TEXT) TO service_role;

-- ───────────────────────────────────────────────────────────
-- 4. claim_waitlist_signup() RPC (D-01, D-02, D-04, D-12)
--    Server-to-server only (service_role). The RETURNING branch on a
--    duplicate discloses the TRUE stored status to the CALLER — the
--    Server Action, not this RPC, applies the D-03/D-04 non-disclosure
--    filter before anything reaches the visitor (Pitfall 2).
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_waitlist_signup(
  p_email        TEXT,
  p_audience     TEXT,
  p_locale       TEXT DEFAULT NULL,
  p_utm_source   TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL
)
RETURNS TABLE(is_new BOOLEAN, is_founder BOOLEAN, founder_rank INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized TEXT := public.normalize_waitlist_email(p_email);
  v_id         UUID;
  v_rank       INTEGER;
  v_founder    BOOLEAN;
BEGIN
  INSERT INTO public.waitlist_signups
    (email, email_normalized, audience, locale, utm_source, utm_campaign)
  VALUES
    (lower(trim(p_email)), v_normalized, p_audience, p_locale, p_utm_source, p_utm_campaign)
  ON CONFLICT (email_normalized) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Duplicate. Server-to-server only; the Server Action applies D-03/D-04.
    SELECT wl.is_founder, wl.founder_rank INTO v_founder, v_rank
    FROM public.waitlist_signups wl WHERE wl.email_normalized = v_normalized;
    RETURN QUERY SELECT false, COALESCE(v_founder, false), v_rank;
    RETURN;
  END IF;

  -- 200 is a locked business constant (REQUIREMENTS.md "Plafond fondateurs: 200 au total"),
  -- never a configurable value and never derived from a row count — nextval() is the only
  -- source of truth for who is founder #200 vs #201 under concurrency.
  v_rank    := nextval('public.waitlist_founder_seq');
  v_founder := v_rank <= 200;

  UPDATE public.waitlist_signups
  SET founder_rank = v_rank, is_founder = v_founder
  WHERE id = v_id;

  RETURN QUERY SELECT true, v_founder, v_rank;
END;
$$;

-- See the note above normalize_waitlist_email(): PUBLIC-only revoke does not remove the
-- default-privilege grant Supabase materializes to anon/authenticated at creation time.
REVOKE EXECUTE ON FUNCTION public.claim_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

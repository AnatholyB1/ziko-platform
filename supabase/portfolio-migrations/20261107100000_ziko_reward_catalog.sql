-- ============================================================
-- Phase 45 (v1.18) - Non-Punitive Tiered Rewards (REWARD-03, D-04)
-- Adds: public.ziko_reward_catalog - the static, non-monetary catalog of
--       badges / titles / themes an athlete can be granted on a tier-up.
--
-- Non-monetary by design (D-04): no price, no resale value, no chance
-- mechanic. Entirely separate from the gamification coins/shop tables.
-- Written by migrations only: no client role (anon, authenticated,
-- service_role) can INSERT/UPDATE/DELETE. Tier 1 is the starting tier and
-- carries no reward; tier 5 is reserved and has no seed yet.
-- Files-only migration: applied by the orchestrator after user approval.
-- ============================================================

CREATE TABLE public.ziko_reward_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier        INTEGER NOT NULL CHECK (tier >= 2),
  key         TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL CHECK (kind IN ('badge', 'title', 'theme')),
  icon        TEXT NOT NULL,
  label_fr    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.ziko_reward_catalog.icon IS
  'Ionicons glyph name (never an emoji), consumed by the mobile reveal overlay.';
COMMENT ON TABLE public.ziko_reward_catalog IS
  'Phase 45 D-04: non-monetary reward catalog (badges, titles, themes) keyed by tier. Read-only for every client role; seeded and changed only by migrations.';

CREATE INDEX ziko_idx_reward_catalog_tier_sort
  ON public.ziko_reward_catalog (tier, sort_order, key)
  WHERE active;

-- RLS: any signed-in athlete may read the active catalog. No write policy.
ALTER TABLE public.ziko_reward_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_catalog_select_active" ON public.ziko_reward_catalog
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (active);

CREATE POLICY "reward_catalog_service_select" ON public.ziko_reward_catalog
  AS PERMISSIVE FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.ziko_reward_catalog FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ziko_reward_catalog TO authenticated;
GRANT SELECT ON TABLE public.ziko_reward_catalog TO service_role;

-- ── Seed: 5 non-monetary rewards for each of tiers 2, 3 and 4 ───────────
INSERT INTO public.ziko_reward_catalog (tier, key, kind, icon, label_fr, label_en, sort_order) VALUES
  -- Tier 2
  (2, 't2_badge_first_steps',   'badge', 'footsteps-outline',   'Premiers pas',           'First Steps',          10),
  (2, 't2_badge_steady_spark',  'badge', 'flame-outline',       'Etincelle reguliere',    'Steady Spark',         20),
  (2, 't2_title_rising_mover',  'title', 'trending-up-outline', 'Athlete en progression', 'Rising Mover',         30),
  (2, 't2_title_good_habit',    'title', 'repeat-outline',      'Routine installee',      'Habit Builder',        40),
  (2, 't2_theme_dawn',          'theme', 'sunny-outline',       'Theme Aube',             'Dawn Theme',           50),
  -- Tier 3
  (3, 't3_badge_momentum',      'badge', 'speedometer-outline', 'Elan constant',          'Momentum',             10),
  (3, 't3_badge_resilient',     'badge', 'shield-outline',      'Resilience',             'Resilient',            20),
  (3, 't3_title_consistent',    'title', 'ribbon-outline',      'Pilier de regularite',   'Consistency Anchor',   30),
  (3, 't3_title_pace_setter',   'title', 'flag-outline',        'Meneur de rythme',       'Pace Setter',          40),
  (3, 't3_theme_ember',         'theme', 'color-palette-outline', 'Theme Braise',         'Ember Theme',          50),
  -- Tier 4
  (4, 't4_badge_unstoppable',   'badge', 'rocket-outline',      'Inarretable',            'Unstoppable',          10),
  (4, 't4_badge_summit',        'badge', 'trophy-outline',      'Sommet atteint',         'Summit Reached',       20),
  (4, 't4_title_ziko_veteran',  'title', 'medal-outline',       'Veteran Ziko',           'Ziko Veteran',         30),
  (4, 't4_title_long_game',     'title', 'hourglass-outline',   'Maitre du long terme',   'Long Game Master',     40),
  (4, 't4_theme_aurora',        'theme', 'sparkles-outline',    'Theme Aurore',           'Aurora Theme',         50)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

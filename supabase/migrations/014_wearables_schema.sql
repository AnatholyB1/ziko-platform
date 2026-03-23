-- ── Health Sync Tracking ──────────────────────────────────
-- Tracks wearable sync status and cached data per user

CREATE TABLE IF NOT EXISTS public.health_sync_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type     TEXT NOT NULL, -- 'steps', 'heart_rate', 'sleep', 'calories', 'exercises', 'weight'
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_from     DATE NOT NULL,
  date_to       DATE NOT NULL,
  record_count  INTEGER NOT NULL DEFAULT 0,
  platform      TEXT NOT NULL DEFAULT 'unknown', -- 'apple_health', 'health_connect'
  raw_data      JSONB
);

CREATE INDEX IF NOT EXISTS idx_health_sync_log_user_type
  ON public.health_sync_log(user_id, data_type, synced_at DESC);

ALTER TABLE public.health_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_sync_log_own" ON public.health_sync_log
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Wearable Daily Summary ───────────────────────────────
-- Cached daily health summary from wearable sources

CREATE TABLE IF NOT EXISTS public.wearable_daily_summary (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  steps         INTEGER NOT NULL DEFAULT 0,
  calories_active   INTEGER NOT NULL DEFAULT 0,
  calories_total    INTEGER NOT NULL DEFAULT 0,
  heart_rate_avg    INTEGER,
  heart_rate_resting INTEGER,
  heart_rate_min    INTEGER,
  heart_rate_max    INTEGER,
  sleep_hours       NUMERIC(4,1),
  sleep_bedtime     TIME,
  sleep_wake_time   TIME,
  exercises     JSONB DEFAULT '[]'::JSONB,
  platform      TEXT NOT NULL DEFAULT 'unknown',
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_wearable_daily_user_date
  ON public.wearable_daily_summary(user_id, date DESC);

ALTER TABLE public.wearable_daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wearable_daily_summary_own" ON public.wearable_daily_summary
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Register wearables plugin ────────────────────────────
INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES
(
  'wearables',
  '{
    "id": "wearables",
    "name": "Wearables & Santé",
    "version": "1.0.0",
    "description": "Connecte Apple Health (iOS) et Health Connect (Android) pour synchroniser pas, fréquence cardiaque, sommeil, calories et entraînements.",
    "icon": "watch-outline",
    "category": "health",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["wearables"],
    "aiSkills": [
      {"name": "health_sync", "description": "Sync and analyze health data from wearable devices", "triggerKeywords": ["wearable","montre","watch","apple health","health connect","fitbit","garmin","pas","steps","sync","connecter"]},
      {"name": "activity_summary", "description": "Daily activity summary from wearable data", "triggerKeywords": ["résumé activité","activity summary","bilan santé","calories brûlées","pas aujourd''hui","steps today"]}
    ],
    "routes": [
      {"path": "/(plugins)/wearables/dashboard", "title": "Wearables", "icon": "watch-outline", "showInTabBar": true}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest,
      version  = EXCLUDED.version;

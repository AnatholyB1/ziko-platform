-- ============================================================
-- 008 — Plugin Reviews & Ratings
-- Adds user reviews with star ratings for plugins
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plugin_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   TEXT NOT NULL REFERENCES public.plugins_registry(plugin_id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plugin_id)
);

CREATE INDEX idx_plugin_reviews_plugin ON public.plugin_reviews(plugin_id);
CREATE INDEX idx_plugin_reviews_user ON public.plugin_reviews(user_id);

ALTER TABLE public.plugin_reviews ENABLE ROW LEVEL SECURITY;

-- Users can read all reviews
CREATE POLICY "plugin_reviews_read" ON public.plugin_reviews
  FOR SELECT USING (true);

-- Users can insert/update/delete their own reviews
CREATE POLICY "plugin_reviews_own" ON public.plugin_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plugin_reviews_update" ON public.plugin_reviews
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plugin_reviews_delete" ON public.plugin_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plugin_reviews_updated_at
  BEFORE UPDATE ON public.plugin_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

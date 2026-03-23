-- ============================================================
-- 015 — Bug Reports
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('ui', 'crash', 'performance', 'feature', 'data', 'other')),
  screen_name TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  github_issue_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert and read their own reports
CREATE POLICY "bug_reports_insert_own" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bug_reports_select_own" ON public.bug_reports
  FOR SELECT USING (auth.uid() = user_id);

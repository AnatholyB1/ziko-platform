-- ============================================================
-- 055 — Forms Schema (workstream formulaire-condi, Phase 01)
-- Tables added:
--   1. coach_forms       — form definitions owned by a coach
--   2. form_instances    — per-athlete pending/submitted instances
--   3. form_responses    — athlete answer submissions
-- RLS policies added:
--   coach_forms_own                   — coach full access to own forms
--   form_instances_coach              — coach reads instances for own forms / athletes
--   form_instances_athlete            — athlete reads own instances
--   form_instances_insert             — coach inserts instances for own forms
--   form_instances_athlete_update     — athlete updates own instance (submit)
--   form_responses_coach_read         — coach reads responses via is_coach_of()
--   form_responses_athlete            — athlete full access to own responses
-- Indexes added:
--   form_instances_no_dup_pending     — UNIQUE partial index (duplicate guard D-09)
--   idx_form_instances_athlete        — athlete_id lookup for mobile overlay
--   idx_form_instances_form           — form_id lookup for trigger engine
--   idx_form_responses_instance       — instance_id lookup for response viewer
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_forms
--    Stores form definitions created by coaches.
--    questions: array of {id, type, label, options?} per D-02
--    trigger_config: {type, ...} per D-06; default = manual
--    status: lifecycle — draft → active → archived
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_forms (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL CHECK (char_length(title) <= 200),
  questions      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  trigger_config JSONB       NOT NULL DEFAULT '{"type":"manual"}'::jsonb,
  status         TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'active', 'archived')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_forms ENABLE ROW LEVEL SECURITY;

-- Coach has full access to forms they own.
CREATE POLICY "coach_forms_own" ON public.coach_forms
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- ───────────────────────────────────────────────────────────
-- 2. form_instances
--    One row per (form, athlete) assignment.
--    status: pending (not yet submitted) → submitted
--    submitted_at: NULL until athlete submits
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.form_instances (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      UUID        NOT NULL REFERENCES public.coach_forms(id) ON DELETE CASCADE,
  athlete_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'submitted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ NULL
);

ALTER TABLE public.form_instances ENABLE ROW LEVEL SECURITY;

-- Coach reads instances for forms they own OR for athletes they coach.
CREATE POLICY "form_instances_coach" ON public.form_instances
  FOR SELECT
  USING (
    public.is_coach_of(auth.uid(), athlete_id)
    OR EXISTS (
      SELECT 1
      FROM public.coach_forms cf
      WHERE cf.id = form_id
        AND cf.coach_id = auth.uid()
    )
  );

-- Athlete reads their own instances.
CREATE POLICY "form_instances_athlete" ON public.form_instances
  FOR SELECT
  USING (auth.uid() = athlete_id);

-- Coach inserts an instance only for a form they own.
CREATE POLICY "form_instances_insert" ON public.form_instances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.coach_forms cf
      WHERE cf.id = form_id
        AND cf.coach_id = auth.uid()
    )
  );

-- Athlete can update their own instance (e.g. mark submitted).
CREATE POLICY "form_instances_athlete_update" ON public.form_instances
  FOR UPDATE
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

-- ───────────────────────────────────────────────────────────
-- 3. form_responses
--    One row per submission. answers: [{question_id, value}] per D-04.
--    athlete_id duplicated here (denormalised) to support efficient
--    is_coach_of() RLS checks without a join through form_instances.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.form_responses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  UUID        NOT NULL REFERENCES public.form_instances(id) ON DELETE CASCADE,
  athlete_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- Coach reads responses for athletes they coach.
CREATE POLICY "form_responses_coach_read" ON public.form_responses
  FOR SELECT
  USING (public.is_coach_of(auth.uid(), athlete_id));

-- Athlete has full access to their own responses.
CREATE POLICY "form_responses_athlete" ON public.form_responses
  FOR ALL
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

-- ───────────────────────────────────────────────────────────
-- 4. Indexes
-- ───────────────────────────────────────────────────────────

-- Duplicate guard (D-09 / TRIGGER-05): only one pending instance per (form, athlete).
-- A second INSERT with status='pending' for the same pair raises unique_violation (23505).
CREATE UNIQUE INDEX form_instances_no_dup_pending
  ON public.form_instances(form_id, athlete_id)
  WHERE status = 'pending';

-- Athlete lookup — used by mobile overlay GET /athlete/forms/pending.
CREATE INDEX IF NOT EXISTS idx_form_instances_athlete
  ON public.form_instances(athlete_id);

-- Form lookup — used by trigger engine to enumerate instances per form.
CREATE INDEX IF NOT EXISTS idx_form_instances_form
  ON public.form_instances(form_id);

-- Instance lookup — used by response viewer to fetch answers for an instance.
CREATE INDEX IF NOT EXISTS idx_form_responses_instance
  ON public.form_responses(instance_id);

-- End of migration 055.

-- Migration 020: Add exercises to timer_presets + hyrox/functional cardio types

-- 1. Add exercises JSONB column to timer_presets
ALTER TABLE public.timer_presets
  ADD COLUMN IF NOT EXISTS exercises JSONB DEFAULT '[]'::jsonb;

-- 2. Allow hyrox and functional timer types
ALTER TABLE public.timer_presets
  DROP CONSTRAINT IF EXISTS timer_presets_type_check;

ALTER TABLE public.timer_presets
  ADD CONSTRAINT timer_presets_type_check
  CHECK (type IN ('tabata', 'hiit', 'emom', 'rest', 'custom', 'hyrox', 'functional'));

-- 3. Allow hyrox and functional cardio activity types
ALTER TABLE public.cardio_sessions
  DROP CONSTRAINT IF EXISTS cardio_sessions_activity_type_check;

ALTER TABLE public.cardio_sessions
  ADD CONSTRAINT cardio_sessions_activity_type_check
  CHECK (activity_type IN (
    'running', 'cycling', 'swimming', 'hiit',
    'walking', 'elliptical', 'rowing', 'other',
    'hyrox', 'functional'
  ));

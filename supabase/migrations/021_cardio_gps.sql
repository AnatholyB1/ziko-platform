-- Migration 021: Add GPS route data and title to cardio_sessions

ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS route_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS elevation_gain_m NUMERIC,
  ADD COLUMN IF NOT EXISTS max_speed_kmh NUMERIC;

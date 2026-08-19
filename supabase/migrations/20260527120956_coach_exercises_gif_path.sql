-- 056 — Add gif_path to coach_exercises (Phase 43 follow-up)
-- Reconstructed migration: applied directly on remote on 2026-05-27 (history
-- version 20260527120956) without ever being committed as a file. Column
-- confirmed live on prod; this file only restores local/remote parity.

ALTER TABLE public.coach_exercises ADD COLUMN IF NOT EXISTS gif_path TEXT;

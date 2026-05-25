---
phase: 27
plan: 03
status: complete
completed_at: "2026-05-20"
---

# Summary: Plan 27-03 — Seed Program Templates

## What was done

Applied `supabase/migrations/046_coaching_programs_seeds.sql` with 5 seed program templates.

Key change: `ALTER TABLE public.workout_programs ALTER COLUMN user_id DROP NOT NULL` — allows seed rows with `user_id = NULL` (cleaner than sentinel UUID; MCP does not run as superuser so FK constraints apply).

## Artifacts

- `supabase/migrations/046_coaching_programs_seeds.sql` — created and applied via Supabase MCP to project `slkobhavpwsubnsmuhya`
- 5 seed templates inserted with `ON CONFLICT (id) DO NOTHING` (idempotent):
  - `a1000000-...-000000000001` — PPL 6 semaines
  - `a1000000-...-000000000002` — 5/3/1 Wendler 4 semaines
  - `a1000000-...-000000000003` — Hyrox Prep 8 semaines
  - `a1000000-...-000000000004` — Body Recomp 12 semaines
  - `a1000000-...-000000000005` — Débutant Full Body 8 semaines

## Issues

- Initial insert failed: FK constraint on `user_id` — MCP does not bypass RLS/constraints like CLI superuser mode
- Fix: made `user_id` nullable; seed rows use `user_id = NULL`

## Requirements satisfied

- PROG-08: Seed templates visible to all coaches in Bibliothèque Ziko

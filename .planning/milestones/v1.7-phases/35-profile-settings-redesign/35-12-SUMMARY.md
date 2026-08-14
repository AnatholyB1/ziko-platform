---
phase: 35-profile-settings-redesign
plan: 12
subsystem: mobile/profile + supabase/migrations
tags: [migration, schema, profile, bio, handle, badges]
dependency_graph:
  requires: []
  provides: [user_profiles.bio, user_profiles.handle, badge_definitions, user_badges, check_and_award_badges]
  affects: [apps/mobile/app/(app)/profile/edit.tsx, supabase/migrations]
tech_stack:
  added: []
  patterns: [direct-column-upsert, RLS-badge-tables, SECURITY-DEFINER-RPC]
key_files:
  created:
    - supabase/migrations/051_profile_settings_gap.sql
  modified:
    - apps/mobile/app/(app)/profile/edit.tsx
decisions:
  - "bio and handle saved as direct columns on user_profiles, not in settings JSONB"
  - "badge_definitions seeded with 11 badges covering sessions, streak, prs, profile_complete, friends"
  - "check_and_award_badges uses SECURITY DEFINER with explicit p_user_id param"
metrics:
  duration: "~20min"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 35 Plan 12: Migration 051 + edit.tsx bio/handle columns Summary

Migration 051 adds bio/handle/is_public/subscription_tier columns to user_profiles, creates badge infrastructure (11 seeded definitions, user_badges with RLS, check_and_award_badges RPC), and edit.tsx now upserts bio and handle as direct columns instead of settings JSONB.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migration 051_profile_settings_gap.sql | 2b7c594 | supabase/migrations/051_profile_settings_gap.sql |
| 2 | Checkpoint: Apply migration 051 to production | (human verified) | — |
| 3 | Update edit.tsx — bio+handle as direct columns | 0661333 | apps/mobile/app/(app)/profile/edit.tsx |

## What Was Built

### Task 1 — Migration 051

`supabase/migrations/051_profile_settings_gap.sql` adds six sections:

1. **ADD COLUMN** on user_profiles: `bio TEXT`, `handle TEXT UNIQUE`, `is_public BOOLEAN DEFAULT true`, `subscription_tier TEXT DEFAULT 'free' CHECK IN ('free','premium','coach')`
2. **CREATE TABLE badge_definitions** with slug, name, description, icon, condition_type, condition_value, tier
3. **SEED 11 badge_definitions** — first_session, ten_sessions, fifty_sessions, hundred_sessions, streak_7, streak_30, streak_100, first_pr, ten_prs, profile_complete, first_friend
4. **CREATE TABLE user_badges** with RLS policy (auth.uid() = user_id)
5. **check_and_award_badges(p_user_id UUID)** SECURITY DEFINER function — checks sessions, streak, PRs, profile_complete, friends against badge condition values and inserts earned badges
6. **Bucket safeguard** — INSERT ON CONFLICT DO NOTHING for avatars and profile-photos buckets

### Task 3 — edit.tsx

- Added `handle` state (`useState('')`)
- Pre-fills `handle` from `(profile as any).handle ?? ''` in useEffect
- `handleSave` now upserts `{ id, name, goal, bio: bio.trim(), handle: handle.trim() || null }` — no prior `select('settings')` fetch, no `existingSettings` spread
- Added PSEUDO TextInput field in the form card (between Bio and Objectif), same card row style, `autoCapitalize="none"`, `placeholder="@tonpseudo"`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all threat mitigations from the plan's STRIDE register were applied:
- UNIQUE constraint on handle (T-35-12-01)
- CHECK constraint on subscription_tier (T-35-12-02)
- RLS policy on user_badges (T-35-12-03)
- SECURITY DEFINER scoped to p_user_id param (T-35-12-04)

## Self-Check: PASSED

- supabase/migrations/051_profile_settings_gap.sql: committed at 2b7c594
- apps/mobile/app/(app)/profile/edit.tsx: committed at 0661333, `bio: bio.trim()` present (grep count: 1)
- TypeScript errors in edit.tsx: 0 (pre-existing errors in other files unrelated to this plan)

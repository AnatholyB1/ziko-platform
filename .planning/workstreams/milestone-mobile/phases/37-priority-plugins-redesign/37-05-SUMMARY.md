---
plan: 37-05
phase: 37
subsystem: plugins/persona + backend/ai
tags: [coach-ia, persona, settings, backend, migration]
dependency_graph:
  requires: [37-01]
  provides: [user_profiles.settings JSONB, CoachIAPlugin, persona-injection-backend]
  affects: [all-ai-conversations, persona-selection-ui]
tech_stack:
  added: []
  patterns: [TanStack Query useMutation merge-update JSONB, hardcoded server-side persona prompt map]
key_files:
  created:
    - supabase/migrations/20260526_add_user_profiles_settings.sql
    - plugins/persona/src/screens/CoachIAPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/persona/customize.tsx
    - plugins/persona/src/index.ts
    - backend/api/src/context/user.ts
    - backend/api/src/routes/ai.ts
  deleted:
    - plugins/persona/src/screens/PersonaCustomizeScreen.tsx
decisions:
  - Plan spec (2 tabs) overrides UI-SPEC §5 (3 tabs) — coaching settings placed in Personas tab below persona cards per PLAN must_haves
  - Persona ID validated against allowlist ['max','zoe','leo','rio'] on write (T-37-05-01)
  - personaInstruction sourced from server-side hardcoded map; DB value used as key only (T-37-05-02)
  - mutate(undefined) used explicitly for TanStack Query v5 compatibility (no-arg mutate not allowed with typed variables)
metrics:
  duration: 27min
  completed: 2026-05-26
  tasks_completed: 3
  files_created: 2
  files_modified: 4
  files_deleted: 1
---

# Phase 37 Plan 05: Coach IA Plugin + Persona Backend Injection Summary

**One-liner:** 2-tab CoachIAPlugin with ai_conversations list, 4 persona cards + coaching settings saved to user_profiles.settings JSONB; backend buildSystemPrompt unconditionally injects persona instruction from server-side hardcoded map.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Wave 0 — user_profiles.settings JSONB migration | `0903448` | Done |
| 2 | CoachIAPlugin.tsx + backend persona injection | `bd82bf1` | Done |
| 3 | Wire route wrapper + barrel + delete PersonaCustomizeScreen | `ba3219f` | Done |

## What Was Built

### Task 1 — Migration (0903448)
`supabase/migrations/20260526_add_user_profiles_settings.sql` — idempotent `ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'` on `user_profiles`. Safe to apply on live DB where column may already exist.

### Task 2 — CoachIAPlugin.tsx + backend (bd82bf1)

**`plugins/persona/src/screens/CoachIAPlugin.tsx`** — single-entrypoint 2-tab plugin:
- **Discussion tab:** Active persona banner (avatar, name, style, online status, settings gear → setActiveTab('Personas')), horizontal quick prompts ScrollView ("Plan ma séance", "Ai-je récupéré ?", etc.), `ai_conversations` list via useQuery (title, preview from last ai_message, timeAgo), empty state, "Nouvelle conversation" CTA
- **Personas tab:** Intro text, 4 persona cards (max/zoe/leo/rio) with selected border ring (persona.color), "Actif" chip; coaching settings section "Préférences du coach" with 3 rows (Ton du coach → ai_coaching_style, Longueur des réponses → ai_response_length, Langue du coach → ai_language) using showAlert pickers; all save to user_profiles.settings via merge useMutation
- **Header:** credit chip ⚡{balance} from useCreditStore

**`backend/api/src/context/user.ts`** — extended:
- user_profiles select now includes `settings`
- `personaPrompts` hardcoded map (max/zoe/leo/rio → French persona instructions)
- `personaInstruction` added to UserContext interface + return value (defaults to max)
- `ai_persona` added to profile object in UserContext

**`backend/api/src/routes/ai.ts`** — `buildSystemPrompt()` unconditionally pushes `'## Coaching Persona\n' + userCtx.personaInstruction` as first section after BASE_SYSTEM.

### Task 3 — Wiring (ba3219f)
- `customize.tsx`: swapped PersonaCustomizeScreen → CoachIAPlugin
- `index.ts`: export CoachIAPlugin, removed PersonaCustomizeScreen export
- `PersonaCustomizeScreen.tsx`: deleted after verifying zero external import references

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TanStack Query v5 zero-arg mutate**
- **Found during:** Task 2 TypeScript check
- **Issue:** `newConvoMutation.mutate()` with 0 arguments fails TS2554 in TanStack Query v5 when mutation variable is typed `string | undefined`
- **Fix:** Changed to `mutate(undefined)` at both call sites; added explicit generic `<..., string | undefined>` to useMutation
- **Files modified:** `plugins/persona/src/screens/CoachIAPlugin.tsx`
- **Commit:** bd82bf1

**2. [Rule 1 - Bug] creditStore import path**
- **Found during:** Task 2 TypeScript check  
- **Issue:** Import path `'../../../../src/stores/creditStore'` invalid — the correct cross-package path is `'../../../../apps/mobile/src/stores/creditStore'` (verified from LogMealScreen.tsx and GamificationDashboard.tsx patterns)
- **Fix:** Corrected import path
- **Files modified:** `plugins/persona/src/screens/CoachIAPlugin.tsx`
- **Commit:** bd82bf1

## Security Mitigations Applied (Threat Register)

| Threat | Mitigation |
|--------|-----------|
| T-37-05-01 Tampering — persona write | Persona ID validated against `['max','zoe','leo','rio']` allowlist before useMutation |
| T-37-05-02 Spoofing — prompt injection | personaInstruction from server-side hardcoded map; DB value is key only, never interpolated raw |
| T-37-05-04 Info Disclosure — ai_conversations | Query scoped to `.eq('user_id', userId)`; RLS enforced at DB level |

## Known Stubs

None — all data sourced from TanStack Query hooks against real Supabase tables.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond the existing user_profiles table (already in threat model).

## Self-Check: PASSED

- `supabase/migrations/20260526_add_user_profiles_settings.sql` — EXISTS
- `plugins/persona/src/screens/CoachIAPlugin.tsx` — EXISTS
- `backend/api/src/context/user.ts` — modified with personaInstruction
- `backend/api/src/routes/ai.ts` — modified with unconditional persona section
- `plugins/persona/src/screens/PersonaCustomizeScreen.tsx` — DELETED
- Commits 0903448, bd82bf1, ba3219f — all present in git log
- TypeScript errors: 0

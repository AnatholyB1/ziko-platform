---
plan: 40-03
phase: 40
status: complete
completed_at: "2026-05-27"
---

# Summary — Plan 40-03

## What was done

- **calendar.tsx**: removed `buildMockSessions` fixture entirely, replaced data layer with TanStack Query (`useQuery` key `['calendar', userId, year, month]`) fetching `workout_sessions` for the current month. Month navigation uses `setCurrentDate(new Date(year, month ± 1, 1))`. Days with sessions render with `backgroundColor '#FF5C1A'`, today without session gets `borderWidth 1.5 borderColor '#FF5C1A'`. Tapping a day with a session navigates to `/(app)/workout/history`. Month summary count displayed below grid. `paddingBottom: 100`.

- **SearchOverlay.tsx**: debounce 300ms via `useEffect + setTimeout` on `debouncedQuery`. All three `useQuery` calls are `enabled: debouncedQuery.length >= 2`. Section 1 — Exercices: `exercises` table ILIKE query, `barbell-outline` icon. Section 2 — Programmes: `ai_generated_programs` filtered by `user_id` + `goal` ILIKE. Section 3 — Utilisateurs: `user_profiles` ILIKE on `name`, avatar with initials fallback. Each section shows empty-state message when no results. Initial state (< 2 chars) shows prompt text. Loading state shows `ActivityIndicator`.

- **help.tsx**: STGroup/STRow pattern defined locally. Three groups: "Aide & Support" (FAQ, Contacter le support, Signaler un bug), "Questions fréquentes" (FAQ accordion — all 12 items preserved), "Légal" (CGU, Confidentialité, Mentions légales), "App" (version + build). Header uses `chevron-back-outline`. `paddingBottom: 100`.

## Verification results

- `buildMockSessions` count in calendar.tsx: **0** ✅
- `debouncedQuery` occurrences in SearchOverlay.tsx: **11** ✅
- TypeScript errors (calendar|SearchOverlay|help): **0** ✅

## Commit

`34c8550` — feat(40-03): calendar real data + SearchOverlay 3 sections debounced + help STGroup/STRow

## Self-Check: PASSED

- `apps/mobile/app/(app)/calendar.tsx` — exists, no buildMockSessions ✅
- `apps/mobile/src/components/SearchOverlay.tsx` — exists, debouncedQuery present ✅
- `apps/mobile/app/(app)/help.tsx` — exists, STGroup/STRow implemented ✅
- Commit `34c8550` — verified ✅

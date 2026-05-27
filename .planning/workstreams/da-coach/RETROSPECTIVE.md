# Retrospective — DA Coach

## Milestone: v1.12 — DA Coach

**Shipped:** 2026-05-27
**Phases:** 3 | **Plans:** 9 | **Timeline:** 2 days (2026-05-26 → 2026-05-27)

### What Was Built

1. Migration 054: `coach_branding` table + `coach-logos` Storage bucket with full RLS
2. `setCustomTheme` + `clearCoachTheme` in plugin-sdk useThemeStore (auto-derived palette tokens)
3. `PATCH /coach/branding` Pro-gated Hono endpoint + `GET /links/me` augmented to return branding
4. Full `/coach/branding` web editor (Next.js) with ColorPickerInput, LogoUpload, ToneSelector, BrandingPreviewCard, BrandingClient orchestrator + GSAP animations
5. react-native-mmkv synchronous hydration in useThemeStore — cold-start orange flash eliminated
6. `useBrandingBootstrap` hook + CoachScreen wired with branding logo, `theme.primary`, revoke cleanup

### What Worked

- **Wave parallelism within Phase 1:** 01-01 and 01-02 executed in parallel, then 01-03 unblocked. Clean dependency graph.
- **Phases 2 and 3 parallel:** Both could run after Phase 1, independent of each other.
- **Server-side `isPro` gate:** Deriving the boolean in Next.js page.tsx (not client) was the right call — no spoofing possible.
- **TanStack deduplication via shared query key:** `useBrandingBootstrap` and `CoachScreen` sharing `['coach-link', userId]` eliminates redundant network calls automatically.
- **SUMMARYs as atomic acceptance verification:** Each plan's Self-Check: PASSED section made readiness crystal clear.

### What Was Inefficient

- **Traceability table never updated:** REQUIREMENTS.md traceability stayed "pending" throughout execution. SUMMARYs tracked requirement completion instead — added overhead at archive time.
- **GSAP TypeScript issues recurred 3 times** (LogoUpload, BrandingClient, one more) with the `x: number[]` → `keyframes` fix. Should have been documented as a project-wide pattern earlier.

### Patterns Established

- **RLS athlete read: `is_coach_of(coach_id, auth.uid())`** — coach_id first, client second (matches migration 035 function signature)
- **`setCustomTheme` spread: `{ ...DEFAULT_THEME, ...overrides, primaryLight, tabBarActive }`** — derived tokens always win, cannot be overridden by caller
- **MMKV cold-start pattern:** IIFE inside Zustand `create()` block-body reads MMKV synchronously before first render
- **GSAP shake fix:** `gsap.fromTo(target, { x: -4 }, { x: 0, keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 3 }, { x: 0 }] })` — TypeScript-correct alternative to `x: number[]`
- **Pro gate pattern:** Service-key reads `user_profiles.tier` before any write; `user_profiles` PK is `id` (not `user_id`)
- **Public bucket + path storage:** Store bucket path in DB (not full URL) to avoid Supabase project domain coupling

### Key Lessons

- Keep the traceability table updated during execution, not just at archive time — saves rework at close.
- Establish GSAP TypeScript workarounds as a project-level pattern on first occurrence.
- EAS build requirement for native modules (MMKV) should be documented in phase PLAN.md under User Setup Required, not just SUMMARY.

### Cost Observations

- Sessions: ~4 focused sessions
- Phase 1: ~47 min total (01-01: 24min, 01-02: 8min, 01-03: 15min)
- Phase 2: ~20 min total
- Phase 3: ~23 min total
- Total execution time: ~90 minutes across 2 days

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Avg min/plan |
|-----------|--------|-------|------|--------------|
| v1.12 DA Coach | 3 | 9 | 2 | ~10 min |

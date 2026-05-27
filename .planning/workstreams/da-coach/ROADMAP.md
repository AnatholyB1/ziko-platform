# Roadmap: v1.12 DA Coach

## Overview

Three phases build the coach branding feature end-to-end. Phase 1 lays the mandatory foundation (DB schema, backend module, SDK theme actions) that unblocks all UI work. Phases 2 and 3 are parallel-eligible once Phase 1 ships: Phase 2 delivers the web branding editor for coaches, Phase 3 wires the theme injection into the athlete mobile app. The done criterion is: Guillaume changes his DA, Joaquim sees the change in his app on next refresh.

## Phases

- [x] **Phase 1: Foundation** - DB migration, Hono branding module, plugin-sdk theme actions
- [ ] **Phase 2: Web Editor** - Coach branding settings page in Next.js CRM (parallel after Phase 1)
- [ ] **Phase 3: Mobile Injection** - Athlete CoachScreen applies coach theme with MMKV persistence (parallel after Phase 1)

## Phase Details

### Phase 1: Foundation
**Goal**: The branding data layer is complete — the coach can persist DA settings, athletes can read them, and the mobile SDK can apply or clear a custom theme
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. A Supabase migration creates the `coach_branding` table with hex CHECK constraints and a coach-logos public bucket with correct RLS (coach writes own row; linked athletes can read via `is_coach_of()`)
  2. `PATCH /coach/branding` saves primary color, logo path, and tone; the endpoint rejects non-Pro coaches with 403
  3. `GET /coach/clients/links/me` returns a `branding` object (primary_color, logo_url, tone) alongside existing link data; returns `branding: null` when the coach has no branding row
  4. `useThemeStore` exposes `setCustomTheme(overrides)` and `clearCoachTheme()` actions in plugin-sdk and both compile without errors in the monorepo
**Plans**: 3 plans
Plans:
**Wave 1** (parallel)
- [x] 01-01-PLAN.md — DB migration: coach_branding table + coach-logos bucket + RLS + push
- [x] 01-02-PLAN.md — plugin-sdk: setCustomTheme + clearCoachTheme actions in useThemeStore

**Wave 2** *(blocked on 01-01 completion — migration must be pushed first)*
- [x] 01-03-PLAN.md — Hono branding module: PATCH /coach/branding, GET /links/me augmentation, app.ts mount

### Phase 2: Web Editor
**Goal**: A Pro coach can configure their direction artistique (color, logo, tone) from the web CRM and see a live preview before saving
**Depends on**: Phase 1
**Note**: Parallel-eligible with Phase 3 once Phase 1 is complete
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05
**Success Criteria** (what must be TRUE):
  1. Coach opens `/coach/branding`, picks a hex color with the color picker, sees a live swatch and preview card update in real-time without saving
  2. Coach uploads a PNG or SVG logo (max 2 MB) — the file lands in the `coach-logos` Supabase bucket and the preview card shows it immediately
  3. Coach selects one of four tone options (Motivant / Analytique / Bienveillant / Exigeant) and saves — the selection persists on page reload
  4. A non-Pro coach sees the editor with all controls visible and interactive for preview, but the Save button is replaced by a Pro upgrade CTA
  5. Clicking Save triggers `PATCH /coach/branding` and a success toast confirms persistence
**Plans**: TBD
**UI hint**: yes

### Phase 3: Mobile Injection
**Goal**: A linked athlete's app displays the coach brand theme automatically on refresh and survives cold starts without a theme flash; revoking the link restores the Ziko default theme
**Depends on**: Phase 1
**Note**: Parallel-eligible with Phase 2 once Phase 1 is complete
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04
**Success Criteria** (what must be TRUE):
  1. An athlete in State C (linked) opens the app — the primary color and tab bar accent reflect the coach's configured hex color without any manual action
  2. The coach logo appears in the Mon coach card (State B and State C) with correct aspect ratio
  3. After a cold app restart, the coach theme is applied before the first rendered frame — no flash of the default Ziko orange is visible
  4. When the athlete revokes the coach link, the Ziko default theme (orange #FF5C1A) is immediately restored and the MMKV branding cache is cleared
**Plans**: 3 plans
Plans:
**Wave 1** (parallel)
- [ ] 03-01-PLAN.md — Install react-native-mmkv + useThemeStore MMKV synchronous init

**Wave 2** *(blocked on 03-01 — MMKV must be installed first)*
- [ ] 03-02-PLAN.md — useBrandingBootstrap hook in (app)/_layout.tsx
- [ ] 03-03-PLAN.md — CoachScreen: branding logo + theme.primary + revoke cleanup

## Progress

**Execution Order:**
Phase 1 first (strict prerequisite). Phases 2 and 3 parallel after Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | ✅ Complete | 2026-05-26 |
| 2. Web Editor | 0/TBD | Not started | - |
| 3. Mobile Injection | 0/TBD | Not started | - |

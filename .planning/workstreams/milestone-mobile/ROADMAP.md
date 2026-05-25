# Roadmap: v1.7 Mobile UX v2

**Workstream:** milestone-mobile  
**Milestone:** v1.7 Mobile UX v2  
**Branch:** gsd/phase-32-design-system-foundation (per phase)  
**Phase numbering:** continues from v1.6 (31 → 32)

## Overview

10 phases deliver a full visual redesign of the Ziko mobile app to match the 24 mockup files. Design and real data connections are done together per screen. The active workout session (`workout-active.jsx`) is the only exclusion. Each phase is self-contained: it ships both the visual redesign AND real data wiring for its set of screens.

Phase 32 (Design System) is the prerequisite for all others. Phases 33–41 can be executed sequentially or in small parallel waves once DS-32 is complete.

## Phases

- [ ] **Phase 32: Design System Foundation** — Tokens, shared components (FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip, BugFab/BugSheet, PaywallScreen, RechargeSheet, PluginsDrawer), 3-tab nav restructure
- [ ] **Phase 33: Home Screen Realignment** — Full home redesign + real data (FormeDuJour, MissionCard, AICoachInline, QuickLog, SmartActions, WeekStrip, Recent, PluginsDrawer)
- [ ] **Phase 34: Auth + Onboarding Redesign** — AuthWelcome dark, AuthSignin, AuthSignup (4-segment strength), AuthForgot, 7-step onboarding flow
- [x] **Phase 35: Profile + Settings Redesign** — Profile hero/tabs/stats, Settings STGroup/STRow system + 3 sub-screens (Notif/Appearance/Integrations)
- [x] **Phase 36: Workout Stack Redesign** — All workout screens except ActiveSession: Séance tab, ProgramDetail, AIGenerator, ExerciseDetail, ExercisePicker, HistoryDetail, WorkoutSummary, RestTimer
- [ ] **Phase 37: Priority Plugins Redesign** — 6 plugins with SubTabs + AISuggestion + real data: Nutrition, Hydration, Habits, AI Programs, Coach IA (Persona), Community
- [ ] **Phase 38: Remaining Plugins Group 1** — 6 plugins: Stats, Gamification, Stretching, Sleep, Measurements, Timer
- [ ] **Phase 39: Remaining Plugins Group 2** — 6 plugins: Journal, Cardio, Supplements, Wearables, RPE, Pantry
- [ ] **Phase 40: Extra Screens + Cross-cutting** — Notifications, Store, AIChat standalone, Calendar, Search, Help/Legal, EmptyState/ErrorScreen, AvatarUpload, Referral, ProgramBuilder, PostDetail, ChallengeDetail, LiftDetail, GoalEdit
- [ ] **Phase 41: Coach StateC Enhancement + Final Data Audit** — StateC stats row (séances/progression), COACH_DATA fixture replacement, final sweep for remaining hardcoded fixtures (DATA-01/02/03/04)

---

## Phase Details

### Phase 32: Design System Foundation
**Goal:** The design system exists as shared components ready to be consumed by all subsequent phases; the app navigation is restructured to 3 tabs; BugFab is mounted globally.
**Depends on:** Nothing (workstream foundation)
**Requirements:** DS-01 through DS-12
**Success Criteria:**
1. `packages/ui/src/design-system.ts` (or equivalent) exports all design tokens.
2. `FormRing`, `AISuggestion`, `SubTabs`, `PluginHeader`, `WeekStrip`, `BugFab`/`BugSheet`, `PaywallScreen`, `RechargeSheet`, `PluginsDrawer` components exist, are typed, and render correctly in isolation.
3. The app tab bar has exactly 3 tabs (Accueil / Séance / Profil); existing 4-tab structure removed; TypeScript clean compile.
4. `BugFab` appears floating over every screen.

**Plans:**
- 32-01-PLAN.md — Design tokens + component stubs scaffold (FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip)
- 32-02-PLAN.md — BugFab/BugSheet + PaywallScreen + RechargeSheet
- 32-03-PLAN.md — PluginsDrawer + 3-tab nav restructure
- 32-04-PLAN.md — Phase verification: TypeScript compile + snapshot tests

### Phase 33: Home Screen Realignment
**Goal:** The home screen matches the mockup pixel-for-pixel and all section data is real.
**Depends on:** Phase 32
**Requirements:** HOME-01 through HOME-10
**Success Criteria:**
1. FormRing renders with real computed score from 4 live data sources.
2. MissionCard shows active program assignment or empty state.
3. AICoachInline shows rule-based tips with working CTAs.
4. QuickLog buttons successfully log data (water/mood/weight/meal) and show confirmation flash.
5. WeekStrip shows real session completion dots from `workout_sessions`.
6. No `PROFILE`, `STREAK`, `TODAY`, `FORME`, `RECENT`, or `ALL_PLUGINS` fixture objects remain.

**Plans:**
- 33-01-PLAN.md — useHomeData.ts: 8 TanStack Query hooks (profile/streak/sleep/hydration/nutrition/weeklySessions/activeProgram/recent)
- 33-02-PLAN.md — useAITips.ts (rule-based tips engine + appStorage dismiss) + useSmartActions.ts (time-of-day cards)
- 33-03-PLAN.md — Wire MissionCard + HomeWeekStrip + Recent section in index.tsx with real data
- 33-04-PLAN.md — Final assembly: Header + FormRing (@ziko/ui) + AICoachInline + QuickLog fire-and-forget + PluginsDrawer (@ziko/ui) + fixture purge
- 33-05-PLAN.md — Phase verification: automated grep checks + human smoke test

### Phase 34: Auth + Onboarding Redesign
**Goal:** Auth flow and onboarding match the mockups; all transitions and error states are wired.
**Depends on:** Phase 32
**Requirements:** AUTH-01 through AUTH-05, OB-01 through OB-08
**Success Criteria:**
1. AuthWelcome has dark gradient background; Apple/Google/Email buttons render; social proof chip visible.
2. AuthSignup shows 4-segment password strength indicator updating on input.
3. Onboarding has 7 steps with orange progress bar; each step's selections are saved to `user_profiles` on completion.
4. OBReady triggers mandatory plugin auto-install.

**Plans:**
- 34-01-PLAN.md — AuthWelcome + AuthSignin + AuthSignup (password strength) + AuthForgot
- 34-02-PLAN.md — Onboarding steps 1–4 (welcome/goal/level/frequency)
- 34-03-PLAN.md — Onboarding steps 5–7 (equipment/bio/ready + auto-install)
- 34-04-PLAN.md — Phase verification

### Phase 35: Profile + Settings Redesign
**Goal:** Profile and settings screens match mockups with real data connections.
**Depends on:** Phase 32
**Requirements:** PROF-01 through PROF-06, SET-01 through SET-05
**Success Criteria:**
1. Profile shows 160px hero cover, 84px avatar, real stats row (séances/XP/streak), 3 tabs functional.
2. Settings uses STGroup/STRow system throughout.
3. NotifSubScreen toggles save to `user_profiles.settings`.
4. IntegrationsSubScreen reflects real connection state from `health_sync_log`.

**Plans:**
- 35-01-PLAN.md — Profile hero + avatar + stats row + followers row
- 35-02-PLAN.md — Profile Stats/Progression/Badges tabs with real data
- 35-03-PLAN.md — Settings STGroup/STRow system + NotifSubScreen + AppearanceSubScreen
- 35-04-PLAN.md — IntegrationsSubScreen + Mon Coach settings section
- 35-05-PLAN.md — Phase verification

### Phase 36: Workout Stack Redesign
**Goal:** All workout screens (excluding ActiveSession) match mockups with real data.
**Depends on:** Phase 32
**Requirements:** WORK-01 through WORK-10
**Success Criteria:**
1. Séance tab shows active program dark hero with real `ai_generated_programs` data.
2. AIGenerator wizard completes and calls `ai_programs_generate` tool.
3. ExerciseDetail shows real exercise data + session history from `session_sets`.
4. WorkoutSummary saves notes and correctly identifies PRs.
5. RestTimer SVG ring animates and triggers correctly at end of a set.

**Plans:**
- 36-01-PLAN.md — Séance tab + ProgramDetail (hero, weekly schedule, 8-week plan tabs)
- 36-02-PLAN.md — AIGenerator wizard + loading animation
- 36-03-PLAN.md — ExerciseDetail + ExercisePicker
- 36-04-PLAN.md — HistoryDetail + WorkoutSummary (PR detection + HR sparkline + notes)
- 36-05-PLAN.md — RestTimer SVG ring + animation + controls
- 36-06-PLAN.md — Phase verification

### Phase 37: Priority Plugins Redesign
**Goal:** 6 priority plugins match mockups with SubTabs, AISuggestion, and real data.
**Depends on:** Phase 32
**Requirements:** PLUG-N-01–07, PLUG-H-01–05, PLUG-HAB-01–06, PLUG-AI-01–06, PLUG-CIA-01–05, PLUG-COM-01–05
**Success Criteria:**
1. Each plugin renders SubTabs with correct active tab state.
2. Each plugin shows AISuggestion with a relevant non-fixture tip.
3. All fixture objects (`NUTRITION_TODAY`, `WATER`, `HABITS`, `AI_PROGRAMS`, `PERSONAS`, `FEED`) replaced with TanStack Query hooks.
4. Nutrition calorie ring + macro bars reflect real today data.

**Plans:**
- 37-01-PLAN.md — Nutrition plugin: 4 tabs + SVG ring + macro bars + real data
- 37-02-PLAN.md — Hydration plugin: SVG bottle fill + quick log buttons + 7-day chart
- 37-03-PLAN.md — Habits plugin: completion rows + calendar heatmap + template grid
- 37-04-PLAN.md — AI Programs plugin: active hero + generator + library list
- 37-05-PLAN.md — Coach IA plugin: embedded chat + 4-persona selector + settings
- 37-06-PLAN.md — Community plugin: feed + challenges + groups
- 37-07-PLAN.md — Phase verification

### Phase 38: Remaining Plugins Group 1
**Goal:** 6 plugins match mockups with real data.
**Depends on:** Phase 32
**Requirements:** PLUG-STA-01–03, PLUG-GAM-01–04, PLUG-STR-01–04, PLUG-SLP-01–04, PLUG-MSR-01–03, PLUG-TMR-01–04
**Success Criteria:**
1. Stats MiniBars chart reflects real session volume.
2. Gamification level card shows real XP from `user_xp`; badges grid shows locked/unlocked state.
3. Sleep duration display + stage bar show latest `sleep_logs` data.
4. Timer countdown + presets grid functional with `timer_presets`.

**Plans:**
- 38-01-PLAN.md — Stats + Gamification plugins
- 38-02-PLAN.md — Stretching + Sleep plugins
- 38-03-PLAN.md — Measurements + Timer plugins
- 38-04-PLAN.md — Phase verification

### Phase 39: Remaining Plugins Group 2
**Goal:** 6 remaining plugins match mockups with real data.
**Depends on:** Phase 32
**Requirements:** PLUG-JNL-01–03, PLUG-CRD-01–04, PLUG-SUP-01–02, PLUG-WER-01–03, PLUG-RPE-01–03, PLUG-PAN-01–04
**Success Criteria:**
1. Journal mood picker + context tags log to `journal_entries`.
2. Cardio activity grid navigates to GPS session start.
3. RPE calculator computes correct 1RM using `calc1RM` function; last values persisted.
4. Pantry shows real item counts per category.

**Plans:**
- 39-01-PLAN.md — Journal + Cardio plugins
- 39-02-PLAN.md — Supplements + Wearables plugins
- 39-03-PLAN.md — RPE + Pantry plugins
- 39-04-PLAN.md — Phase verification

### Phase 40: Extra Screens
**Goal:** All auxiliary screens match mockups with real data connections.
**Depends on:** Phase 32
**Requirements:** EXTRA-01 through EXTRA-12
**Success Criteria:**
1. NotificationsScreen filter chips work; NFItem rows show real notifications.
2. StoreScreen plugin cards reflect real install state from `user_plugins`.
3. AIChatScreen standalone shows real conversation list from `ai_conversations`.
4. EmptyState and ErrorScreen components render all 4 variants correctly.
5. AvatarUploadScreen uploads to Supabase Storage and updates `user_profiles.avatar_url`.

**Plans:**
- 40-01-PLAN.md — Notifications + Store screens
- 40-02-PLAN.md — AIChatScreen standalone + AvatarUpload
- 40-03-PLAN.md — Calendar + Search + Help/Legal
- 40-04-PLAN.md — ProgramBuilder + PostDetail + ChallengeDetail + LiftDetail + GoalEdit + Referral
- 40-05-PLAN.md — EmptyState/ErrorScreen components + integration across all screens
- 40-06-PLAN.md — Phase verification

### Phase 41: Coach StateC Enhancement + Final Data Audit
**Goal:** Coach plugin StateC shows new stats row; all remaining fixture data is eliminated; full app fixture audit passes.
**Depends on:** Phases 32–40
**Requirements:** COACH-01 through COACH-03, DATA-01 through DATA-04
**Success Criteria:**
1. Coach StateC shows "Séances suivies" count and "Progression %" from real data.
2. `StateC` coach card shows "Lié depuis DD/MM/YYYY" row.
3. A codebase-wide grep for `const [A-Z_]{4,} = {` and `fixture` patterns in production screen files returns zero results.
4. Loading skeletons present on all data-driven screens; ErrorScreen shown on fetch error; EmptyState shown on empty data.

**Plans:**
- 41-01-PLAN.md — Coach StateC stats row + linked-since date row + real data
- 41-02-PLAN.md — Final fixture audit + skeleton/empty/error sweep
- 41-03-PLAN.md — Phase verification

---

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 32. Design System Foundation | 4 plans | Planned | — |
| 33. Home Screen Realignment | 5 plans | Planned | — |
| 34. Auth + Onboarding Redesign | 4 plans | Planned | — |
| 35. Profile + Settings Redesign | 22 plans | Complete | 2026-05-25 |
| 36. Workout Stack Redesign | 6 plans | Planned | — |
| 37. Priority Plugins Redesign | 7 plans | Planned | — |
| 38. Remaining Plugins Group 1 | 4 plans | Planned | — |
| 39. Remaining Plugins Group 2 | 4 plans | Planned | — |
| 40. Extra Screens | 6 plans | Planned | — |
| 41. Coach StateC + Final Audit | 3 plans | Planned | — |

**Total: 48 plans across 10 phases**

---

## Coverage Map

| Req Category | Phase |
|-------------|-------|
| DS-01–12 | Phase 32 |
| HOME-01–10 | Phase 33 |
| AUTH-01–05 | Phase 34 |
| OB-01–08 | Phase 34 |
| PROF-01–06 | Phase 35 |
| SET-01–05 | Phase 35 |
| WORK-01–10 | Phase 36 |
| PLUG-N-01–07 | Phase 37 |
| PLUG-H-01–05 | Phase 37 |
| PLUG-HAB-01–06 | Phase 37 |
| PLUG-AI-01–06 | Phase 37 |
| PLUG-CIA-01–05 | Phase 37 |
| PLUG-COM-01–05 | Phase 37 |
| PLUG-STA-01–03 | Phase 38 |
| PLUG-GAM-01–04 | Phase 38 |
| PLUG-STR-01–04 | Phase 38 |
| PLUG-SLP-01–04 | Phase 38 |
| PLUG-MSR-01–03 | Phase 38 |
| PLUG-TMR-01–04 | Phase 38 |
| PLUG-JNL-01–03 | Phase 39 |
| PLUG-CRD-01–04 | Phase 39 |
| PLUG-SUP-01–02 | Phase 39 |
| PLUG-WER-01–03 | Phase 39 |
| PLUG-RPE-01–03 | Phase 39 |
| PLUG-PAN-01–04 | Phase 39 |
| EXTRA-01–12 | Phase 40 |
| COACH-01–03 | Phase 41 |
| DATA-01–04 | Phase 41 |

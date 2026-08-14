---
phase: 25
plan: 07b
type: execute
wave: 3
title: "Refonte Phase 24 (2/2) — coach dashboard + settings (pixel-perfect to Ziko+Onboarding.html)"
requirements: []
depends_on: [1]
autonomous: true
files_modified:
  - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
  - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
  - apps/web/src/components/coach/WelcomeCard.tsx
  - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
  - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
must_haves:
  truths:
    - "Phase 24 surfaces (coach dashboard, coach settings) visually match the canonical Phase 24 Claude Design mockup (Ziko+Onboarding.html) section-by-section"
    - "Zero behavior regressions: existing Phase 24 acceptance flows (dashboard render, settings render, profile edit save) all still pass"
    - "i18n parity intact: every refactored copy string still resolves through next-intl namespaces; no hardcoded French literals introduced"
    - "Phase 23 D-11 (no direct @supabase/supabase-js in app code) and D-12 (no SERVICE_KEY in web) invariants preserved"
    - "ProfileForm (refactored in Plan 07a Task 3) renders correctly in /coach/settings context (dual-context reuse verified)"
  artifacts:
    - path: "apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx"
      provides: "Coach dashboard refactored against mockup; WelcomeCard composition preserved"
      contains: "WelcomeCard"
    - path: "apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx"
      provides: "Coach settings refactored against mockup; SettingsClient composition preserved"
      contains: "SettingsClient"
    - path: "apps/web/src/components/coach/WelcomeCard.tsx"
      provides: "Refactored welcome card with mockup-aligned composition; same props signature"
  key_links:
    - from: "apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx"
      to: "apps/web/src/components/coach/WelcomeCard.tsx"
      via: "import + render"
      pattern: "WelcomeCard"
    - from: "apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx"
      to: "apps/web/src/components/coach/ProfileForm.tsx (refactored in Plan 07a)"
      via: "import + render"
      pattern: "ProfileForm"
---

<pixel_perfect_rule>
All Tailwind classes, layout structure, copy strings, and component composition in this plan are required to match the canonical Claude Design mockup at `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) section-by-section. Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html. This plan delivers a Phase 24 REFONTE (no behavior changes). If a Phase 24 source-file behavior conflicts with what is needed for the mockup match, the mockup wins on visual concerns AND behavior is preserved on functional concerns — flag the conflict in CHECKPOINT and stop. Executor MUST open the local mockup file before touching any component.
</pixel_perfect_rule>

<coordination_note>
This plan (25-07b) handles the **coach dashboard + settings** half of the Phase 24 refonte. Sibling plan 25-07a handles the **login + 3-step onboarding wizard** half. CoachSidebar refonte (visual styling) is performed in Plan 04 (same wave). All three plans (04, 07a, 07b) touch disjoint file sets and can run in parallel within Wave 3.

Plan 07b touches ONLY: (coach)/coach/layout.tsx + dashboard/page.tsx + WelcomeCard.tsx + settings/page.tsx + SettingsClient.tsx.
Plan 07a touches ONLY: login (LoginForm.tsx + page.tsx) + onboarding (3 steps + WizardProgress + ProfileForm + onboarding/page.tsx + OnboardingWizard.tsx).
Plan 04 touches CoachSidebar.tsx (Invitations NAV_ITEMS INSERT + Phase 24 refonte styling) + Phase 25 invitation surfaces.

**ProfileForm dual-context note:** Plan 07a Task 3 refactors `apps/web/src/components/coach/ProfileForm.tsx`. This plan (07b) MUST regression-test ProfileForm in its /coach/settings context but MUST NOT modify ProfileForm itself. If a styling discrepancy is observed in the settings context, the fix goes back into Plan 07a Task 3 (or a new follow-up task) — not into this plan.
</coordination_note>

<objective>
Refonte the last two Phase 24 already-shipped web surfaces — coach dashboard (`/coach/dashboard`) and coach settings (`/coach/settings`) — to match the canonical Phase 24 Claude Design mockup `Ziko+Onboarding.html` pixel-for-pixel. Also refactor the coach layout shell (`(coach)/coach/layout.tsx`) and WelcomeCard component.

Purpose: Phase 24 originally shipped to ARCH/RLS/auth correctness but the visual layer drifted from the canonical mockup. Per user directive, Phase 25 scope now explicitly folds in a Phase 24 design refonte so the entire coach web surface area lands at parity with the design system at the end of Phase 25. Split across plans 07a (login + onboarding) and 07b (dashboard + settings) to respect the 5-task hard cap per plan.

Output: 2 surfaces refactored visually (dashboard + settings) plus shared coach layout + WelcomeCard, with all behavior preserved. No new routes, no new components, no schema changes, no new dependencies.
</objective>

<scope_clarification>
**This plan modifies existing shipped code. It does NOT:**
- Change the auth flow (login, session refresh, redirect-after-login) — Phase 24 contracts preserved
- Change Supabase factory usage (`createServerSupabase` / `createBrowserSupabase`) — Phase 23 D-11 invariant preserved
- Change ESLint rules or add new lint exceptions
- Change Server Action signatures or exports (profileSaveAction, etc.) — same exports, same return shapes
- Change RLS contracts or call any new RPC
- Modify any Phase 23/24 LOCKED decisions (per ARCH-02, D-11, D-12)
- Modify ProfileForm.tsx (owned by Plan 07a Task 3)
- Modify CoachSidebar.tsx (owned by Plan 04)

**This plan ONLY changes:**
- Tailwind class strings (spacing, typography, color tints, border radii, shadows)
- Copy strings — but only via next-intl namespace updates; no hardcoded French literals
- Layout structure (flex/grid composition, vertical rhythm, spacing scale)
- Component composition within each surface (e.g. reordering subcomponents, swapping wrapper elements)
- Icon usage (react-icons/io5 — may swap one Io* icon for another to match mockup)
</scope_clarification>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/25-invitations-mobile-mon-coach-minimal/25-CONTEXT.md
@.planning/phases/25-invitations-mobile-mon-coach-minimal/25-UI-SPEC.md
@apps/web/src/components/coach/KycStatusChip.tsx
@apps/web/src/app/globals.css
@apps/web/messages/fr.json
@apps/web/messages/en.json

<interfaces>
<!-- Phase 24 surfaces being refactored: -->
<!-- (coach)/coach/layout.tsx: shared layout for authenticated coach surfaces; CoachSidebar + main content -->
<!-- (coach)/coach/dashboard/page.tsx: Server Component; fetches coach profile + KYC; renders WelcomeCard -->
<!-- (coach)/coach/settings/page.tsx + SettingsClient.tsx: Settings surface; ProfileForm reuse -->
<!-- WelcomeCard.tsx: card pattern bg-white rounded-2xl p-6 border border-border shadow-sm; used as design reference for new cards -->
<!-- ProfileForm.tsx: REFACTORED IN PLAN 07a TASK 3 — do NOT modify here; verify dual-context render only -->
<!-- CoachSidebar.tsx: owned by Plan 04 — NOT touched by this plan -->

<!-- Tailwind tokens (apps/web/src/app/globals.css): -->
<!-- --background: #F7F6F3; --surface: #FFFFFF; --border: #E2E0DA; -->
<!-- --primary: #FF5C1A; --text: #1C1A17; --muted: #6B6963; -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refonte coach dashboard (WelcomeCard + (coach)/coach/layout.tsx + dashboard/page.tsx) to mockup</name>
  <files>
    apps/web/src/components/coach/WelcomeCard.tsx,
    apps/web/src/app/[locale]/(coach)/coach/layout.tsx,
    apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
  </files>
  <read_first>
    - apps/web/src/components/coach/WelcomeCard.tsx (FULL — design-system anchor card pattern)
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx (FULL — sidebar + main content composition)
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx (FULL — Server Component fetching coach profile + KYC + rendering WelcomeCard)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (dashboard section + sidebar nav — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/app/globals.css
  </read_first>
  <action>
Open mockup → dashboard section. Note: sidebar width (NOTE: sidebar visual styling is OWNED BY Plan 04 — do not modify CoachSidebar.tsx here), main content max-width, page padding, WelcomeCard composition (greeting + KYC chip + bio preview + edit-link affordance), any secondary cards/sections shown in mockup.

Refactor 3 files:

1. `WelcomeCard.tsx`: preserve props signature; refactor card composition to match mockup
2. `(coach)/coach/layout.tsx`: refactor main content area + page-level shell to match mockup (DO NOT modify CoachSidebar.tsx — owned by Plan 04). Adjust only main-content max-width, padding, vertical rhythm.
3. `dashboard/page.tsx`: preserve Server Component shape + data fetches; refactor only outer wrapper + section composition

Coordination note: This task does NOT touch `CoachSidebar.tsx` — Plan 04 owns the sidebar work end-to-end (both the Invitations NAV_ITEMS INSERT AND the Phase 24 refonte styling). This task can therefore run in parallel with Plan 04 in Wave 3 without file-conflict risk.
  </action>
  <verify>
    <automated>test -f apps/web/src/components/coach/WelcomeCard.tsx</automated>
    <automated>test -f "apps/web/src/app/[locale]/(coach)/coach/layout.tsx" && test -f "apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx"</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" apps/web/src/components/coach/WelcomeCard.tsx "apps/web/src/app/[locale]/(coach)/coach/layout.tsx" "apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx"</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 3 files preserve their exported names / signatures
    - Visual match: dashboard layout (main content area + WelcomeCard composition) matches the dashboard section of `.planning/mockups/Ziko-Onboarding.html`
    - `cd apps/web && npm run lint && npm run type-check` exits 0
    - Behavior preserved: dashboard renders for authenticated coach; logout still works; (sidebar visual confirmation deferred to Plan 04's verification)
  </acceptance_criteria>
  <done>Dashboard + WelcomeCard + layout visually match mockup; auth-gated rendering intact. Sidebar refonte performed in Plan 04.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Refonte coach settings (settings/page.tsx + SettingsClient.tsx) to mockup + verify ProfileForm dual-context render</name>
  <files>
    apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx,
    apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
  </files>
  <read_first>
    - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx (FULL — Server Component)
    - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx (FULL — client wrapper around ProfileForm)
    - apps/web/src/components/coach/ProfileForm.tsx (refactored in Plan 07a Task 3 — verify dual-context render still works; DO NOT MODIFY)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (settings section — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/app/globals.css
  </read_first>
  <action>
Open mockup → settings section. Note: page header (h1 + subtitle), section composition (Profile section / KYC section / Account section dividers if mockup shows them), ProfileForm placement, KYC status display, account-level affordances (sign out button, danger zone if present in mockup).

Refactor `page.tsx` + `SettingsClient.tsx`:
- Preserve Server Component → Client wrapper composition
- Preserve `ProfileForm` reuse from Plan 07a Task 3 (do NOT re-style ProfileForm here; if mockup demands settings-only styling, the FIX goes into Plan 07a Task 3 — coordinate via CHECKPOINT)
- Preserve any data fetches (coach profile, KYC status) on the Server Component
- Refactor only page header, section composition, outer layout

**Regression test (mandatory):** After refactor, manually verify ProfileForm renders correctly at `/fr/coach/settings`:
- All fields display with current values pre-filled
- Save submits to its Server Action and persists changes
- No layout breakage inherited from Plan 07a's onboarding-context styling
If a discrepancy is observed: FLAG in CHECKPOINT, do NOT fix here — request follow-up edit to Plan 07a Task 3.
  </action>
  <verify>
    <automated>test -f "apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx" && test -f "apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx"</automated>
    <automated>grep -q "ProfileForm" "apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx"</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" "apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx" "apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx"</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - Both files preserve their Server Component → Client wrapper shape
    - `SettingsClient.tsx` still composes `ProfileForm` (verified by grep)
    - Visual match: rendered `/fr/coach/settings` matches the settings section of `.planning/mockups/Ziko-Onboarding.html`
    - `cd apps/web && npm run lint && npm run type-check && npm run build` all exit 0
    - Behavior preserved: settings page renders for authenticated coach; ProfileForm save still persists
    - Regression check: ProfileForm refactor from Plan 07a Task 3 renders correctly in the settings context (dual-context reuse intact)
  </acceptance_criteria>
  <done>Settings surface visually matches mockup; ProfileForm dual-context render verified; full web build clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → coach surfaces (dashboard, settings) | cookies session; layout/page Server Components call `auth.getUser()`; redirect to /login when null |
| Server Actions (profile save) → Supabase | session.access_token Bearer; RLS enforces row scope |

## STRIDE Threat Register

Refonte does not introduce new threats. Existing Phase 23/24 threat dispositions are reaffirmed below.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| Phase 23 D-11 | Tampering | All refactored Phase 24 surfaces | mitigate | No file in this plan introduces `import ... from '@supabase/supabase-js'`. ESLint rule enforces; verify block greps for the forbidden import. Use only `createServerSupabase` / `createBrowserSupabase` factories. |
| Phase 23 D-12 | Information Disclosure | apps/web env scope | mitigate | No new env var consumption; no `SUPABASE_SERVICE_KEY` reference introduced; web bundle continues to use publishable key only. |
| Auth gate bypass | Spoofing | refactored Server Components | mitigate | Refonte preserves all `auth.getUser()` + `redirect('/login')` patterns from Phase 24; no auth-gate logic is touched. |
| CSRF on Server Actions | Tampering | profile save action | mitigate | Next.js Server Actions ship CSRF tokens by default; refonte preserves `useActionState` + `<form action={...}>` wiring. |
| XSS via refactored copy | Tampering | next-intl interpolations | mitigate | All user-injected values continue to flow through React auto-escape; next-intl interpolation does not bypass escaping. No `dangerouslySetInnerHTML` introduced. |
| Behavior regression via refactor | Operational | Both tasks | mitigate | Each task acceptance criterion explicitly requires "Behavior preserved" with cite to the corresponding Phase 24 acceptance flow; Plan 06 Wave 4 validation gate runs `npm run build` to catch import-time regressions. |
| Dual-context style bleed | Operational | ProfileForm onboarding↔settings | mitigate | Task 2 includes explicit regression test for ProfileForm in /coach/settings; any drift FLAGs back to Plan 07a Task 3 instead of being patched here (single owner per component). |
</threat_model>

<verification>
After both tasks complete:

```bash
# 1. Lint clean (no new ESLint violations)
cd apps/web && npm run lint

# 2. Type-check clean (no new TS errors)
cd apps/web && npm run type-check

# 3. Build clean (catches import resolution + broken module references)
cd apps/web && npm run build

# 4. Forbidden imports check (Phase 23 D-11)
! grep -rE "from '@supabase/supabase-js'" "apps/web/src/app/[locale]/(coach)/coach" apps/web/src/components/coach/WelcomeCard.tsx
```

**Manual visual diff gate (before /gsd-verify-work):**

Open `.planning/mockups/Ziko-Onboarding.html` side-by-side with the dev server (local file is canonical; live preview at https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html is secondary). For each of the 2 surfaces below, record PASS or FLAG in the plan tail (append a `## Refonte Visual Diff` section to `25-07b-SUMMARY.md`):

1. `/fr/coach/dashboard` (with sidebar visible — sidebar styling owned by Plan 04) vs mockup dashboard section
2. `/fr/coach/settings` vs mockup settings section

Any FLAG must include: surface name, specific drift observation (spacing/typography/color/copy), and remediation plan.

**Behavior preservation checks (cite Phase 24 acceptance flows):**

1. Coach dashboard renders WelcomeCard with correct profile data and KYC chip (Phase 24 acceptance flow #3)
2. Coach settings renders ProfileForm pre-filled with current values and saves edits (Phase 24 acceptance flow #4)
3. ProfileForm dual-context: refactor from Plan 07a Task 3 still renders correctly in settings (regression check)
</verification>

<success_criteria>
- 2 Phase 24 web surfaces (coach dashboard + coach settings) visually match the canonical `.planning/mockups/Ziko-Onboarding.html`
- Phase 24 acceptance behavior flows still pass (dashboard render, settings render, profile edit save)
- Zero new lint / type-check / build errors
- No new `@supabase/supabase-js` direct imports (Phase 23 D-11 invariant preserved)
- No new `SUPABASE_SERVICE_KEY` references in web (Phase 23 D-12 invariant preserved)
- `CoachSidebar.tsx` is owned by Plan 04 (Plan 04 handles both the Invitations NAV_ITEMS INSERT AND the Phase 24 refonte styling)
- `ProfileForm.tsx` works in /coach/settings context (dual-context reuse intact — owned by Plan 07a Task 3)
- Manual visual diff gate records PASS for both surfaces (or FLAG with remediation)
</success_criteria>

<output>
After completion, create `.planning/phases/25-invitations-mobile-mon-coach-minimal/25-07b-SUMMARY.md` recording:
- Files refactored (5 listed)
- Visual diff PASS/FLAG per surface (2 surfaces above)
- Behavior preservation checklist (3 acceptance flows verified, including ProfileForm dual-context)
- Any FLAG items with remediation actions
- Lint / type-check / build results (all 0)
- Any next-intl key renames / additions (track for translation completeness)
- ProfileForm dual-context regression result (PASS / FLAG — if FLAG, link to follow-up edit on Plan 07a Task 3)
</output>

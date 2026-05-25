---
phase: 25
plan: 07a
type: execute
wave: 3
title: "Refonte Phase 24 (1/2) — login + 3-step onboarding wizard (pixel-perfect to Ziko+Onboarding.html)"
requirements: []
depends_on: [1]
autonomous: true
files_modified:
  - apps/web/src/app/[locale]/login/LoginForm.tsx
  - apps/web/src/app/[locale]/login/page.tsx
  - apps/web/src/app/[locale]/coach/onboarding/page.tsx
  - apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx
  - apps/web/src/components/coach/WizardStep1Role.tsx
  - apps/web/src/components/coach/WizardStep2Profile.tsx
  - apps/web/src/components/coach/WizardStep3Kyc.tsx
  - apps/web/src/components/coach/WizardProgress.tsx
  - apps/web/src/components/coach/ProfileForm.tsx
must_haves:
  truths:
    - "Phase 24 surfaces (login, 3-step onboarding wizard) visually match the canonical Phase 24 Claude Design mockup (Ziko+Onboarding.html) section-by-section"
    - "Zero behavior regressions: existing Phase 24 acceptance flows (login, role selection, profile save, KYC upload) all still pass"
    - "i18n parity intact: every refactored copy string still resolves through next-intl namespaces; no hardcoded French literals introduced"
    - "Phase 23 D-11 (no direct @supabase/supabase-js in app code) and D-12 (no SERVICE_KEY in web) invariants preserved"
    - "Server Actions wiring intact: useActionState + <form action={...}> hooks still wire to the same action exports"
  artifacts:
    - path: "apps/web/src/app/[locale]/login/LoginForm.tsx"
      provides: "Refactored login form matching mockup pixel-for-pixel; same exported component name and signature"
      contains: "useActionState"
    - path: "apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx"
      provides: "3-step wizard with refactored layout matching mockup; same step-state machine"
      contains: "WizardStep1Role"
  key_links:
    - from: "apps/web/src/app/[locale]/login/LoginForm.tsx"
      to: "apps/web/src/actions/login.ts (loginAction)"
      via: "<form action={loginAction}>"
      pattern: "loginAction"
    - from: "apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx"
      to: "wizard step components (WizardStep1Role/2Profile/3Kyc)"
      via: "import + conditional render by step state"
      pattern: "WizardStep[123]"
    - from: "apps/web/src/components/coach/ProfileForm.tsx"
      to: "coach profile save Server Action"
      via: "useActionState + <form action={...}>"
      pattern: "useActionState"
---

<pixel_perfect_rule>
All Tailwind classes, layout structure, copy strings, and component composition in this plan are required to match the canonical Claude Design mockup at `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) section-by-section. Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html. This plan delivers a Phase 24 REFONTE (no behavior changes). If a Phase 24 source-file behavior conflicts with what is needed for the mockup match, the mockup wins on visual concerns AND behavior is preserved on functional concerns — flag the conflict in CHECKPOINT and stop. Executor MUST open the local mockup file before touching any component.
</pixel_perfect_rule>

<coordination_note>
This plan (25-07a) handles the **login + 3-step onboarding wizard** half of the Phase 24 refonte. Sibling plan 25-07b handles the **coach dashboard + settings** half. CoachSidebar refonte (visual styling) is performed in Plan 04 (same wave). All three plans (04, 07a, 07b) touch disjoint file sets and can run in parallel within Wave 3.

Plan 07a touches ONLY: login (LoginForm.tsx + page.tsx) + onboarding (3 steps + WizardProgress + ProfileForm + onboarding/page.tsx + OnboardingWizard.tsx).
Plan 07b touches ONLY: (coach)/coach/layout.tsx + dashboard/page.tsx + WelcomeCard + settings/page.tsx + SettingsClient.tsx.
Plan 04 touches CoachSidebar.tsx (Invitations NAV_ITEMS INSERT + Phase 24 refonte styling) + Phase 25 invitation surfaces.
</coordination_note>

<objective>
Refonte the first two Phase 24 already-shipped web surfaces — login (`/login`) and 3-step coach onboarding wizard (`/coach/onboarding`) — to match the canonical Phase 24 Claude Design mockup `Ziko+Onboarding.html` pixel-for-pixel.

Purpose: Phase 24 originally shipped to ARCH/RLS/auth correctness but the visual layer drifted from the canonical mockup. Per user directive, Phase 25 scope now explicitly folds in a Phase 24 design refonte so the entire coach web surface area lands at parity with the design system at the end of Phase 25. Split across plans 07a (login + onboarding) and 07b (dashboard + settings) to respect the 5-task hard cap per plan.

Output: 2 surfaces refactored visually (login + onboarding 3 steps) with all behavior preserved. No new routes, no new components, no schema changes, no new dependencies.
</objective>

<scope_clarification>
**This plan modifies existing shipped code. It does NOT:**
- Change the auth flow (login, session refresh, redirect-after-login) — Phase 24 contracts preserved
- Change Supabase factory usage (`createServerSupabase` / `createBrowserSupabase`) — Phase 23 D-11 invariant preserved
- Change ESLint rules or add new lint exceptions
- Change Server Action signatures or exports (loginAction, profileSaveAction, etc.) — same exports, same return shapes
- Change RLS contracts or call any new RPC
- Change the 3-step wizard state machine (Role → Profile → KYC) — same step order, same gating logic
- Modify any Phase 23/24 LOCKED decisions (per ARCH-02, D-11, D-12)

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
@apps/web/src/components/coach/WelcomeCard.tsx
@apps/web/src/components/coach/KycStatusChip.tsx
@apps/web/src/app/globals.css
@apps/web/messages/fr.json
@apps/web/messages/en.json

<interfaces>
<!-- Phase 24 surfaces being refactored: -->
<!-- LoginForm.tsx: exports default React component; wires to apps/web/src/actions/login.ts loginAction via useActionState -->
<!-- login/page.tsx: Server Component; renders LoginForm; reads next param via searchParams -->
<!-- coach/onboarding/page.tsx: Server Component; auth-gates; renders OnboardingWizard -->
<!-- coach/onboarding/OnboardingWizard.tsx: Client Component; holds step state {1|2|3}; renders WizardProgress + WizardStep{1,2,3} conditionally -->
<!-- WelcomeCard.tsx: card pattern bg-white rounded-2xl p-6 border border-border shadow-sm; used as design reference for new cards -->
<!-- Wizard components (Step1Role/Step2Profile/Step3Kyc/WizardProgress/ProfileForm): preserve all props, exports, validation hooks -->

<!-- Tailwind tokens (apps/web/src/app/globals.css): -->
<!-- --background: #F7F6F3; --surface: #FFFFFF; --border: #E2E0DA; -->
<!-- --primary: #FF5C1A; --text: #1C1A17; --muted: #6B6963; -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refonte /login (LoginForm.tsx + page.tsx) to Ziko+Onboarding.html mockup</name>
  <files>
    apps/web/src/app/[locale]/login/LoginForm.tsx,
    apps/web/src/app/[locale]/login/page.tsx
  </files>
  <read_first>
    - apps/web/src/app/[locale]/login/LoginForm.tsx (FULL — current shape; export shape; useActionState wiring)
    - apps/web/src/app/[locale]/login/page.tsx (FULL — Server Component, searchParams reading)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (login section — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/components/coach/WelcomeCard.tsx (design token reference for cards)
    - apps/web/src/app/globals.css (verify Tailwind tokens --background, --primary, --border, --muted, --text)
    - apps/web/messages/fr.json (existing login copy keys; add/rename to match mockup wording without removing existing keys until verified unused)
  </read_first>
  <action>
**MOCKUP-FIRST RULE:** Open `.planning/mockups/Ziko-Onboarding.html` in the browser before touching this surface. Identify the login section. Note: container width, vertical rhythm, input height, button radius, label weight, copy literals, error-state styling, ZIKO wordmark placement. Then refactor `LoginForm.tsx` to match. Preserve `loginAction` wiring (`useActionState`, `<form action={loginAction}>`) — do NOT change the action signature or imports.

Constraints:
- Same default export name and component signature
- Same i18n namespace (`Login` or whatever Phase 24 used); update copy via translation file edits, NOT inline strings
- `safeNext` import chain unchanged (Plan 05 extends `safeNext` in `apps/web/src/actions/login.ts` separately — do NOT modify that file in this task)
- Tailwind classes copied from the mockup section (use Tailwind v4 tokens — bg-background, bg-white, border-border, text-text, text-muted, text-primary, bg-primary)

For `login/page.tsx`:
- Preserve Server Component shape (`async function` with `params: Promise<{locale}>` + `searchParams`)
- Preserve next param reading + safeNext call
- Refactor only the page-level layout wrapper (centering, container width) to match the mockup
- Do NOT add or remove any data fetch
  </action>
  <verify>
    <automated>test -f "apps/web/src/app/[locale]/login/LoginForm.tsx" && test -f "apps/web/src/app/[locale]/login/page.tsx"</automated>
    <automated>grep -q "useActionState\|&lt;form action=" "apps/web/src/app/[locale]/login/LoginForm.tsx"</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" "apps/web/src/app/[locale]/login/LoginForm.tsx" "apps/web/src/app/[locale]/login/page.tsx"</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `LoginForm.tsx` still exports the same React component name and signature (default export preserved)
    - `grep -q "useActionState\|<form action=" apps/web/src/app/[locale]/login/LoginForm.tsx` → match (Server Action wiring intact)
    - Visual match: rendered `/fr/login` page matches the login section of `.planning/mockups/Ziko-Onboarding.html` (manual visual diff at gate — spacing, typography weight, border radius, shadow, color tint, copy literals, ZIKO wordmark placement all match)
    - `cd apps/web && npm run lint` exits 0 (no new ESLint errors)
    - `cd apps/web && npm run type-check` exits 0 (no new TS errors)
    - Behavior preserved: existing Phase 24 login flow still passes (POST credentials → session created → redirect to safeNext-validated target)
  </acceptance_criteria>
  <done>/login surface visually matches mockup; auth flow + safeNext + Server Action wiring all intact.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Refonte onboarding Step 1 (Role) — WizardStep1Role.tsx to mockup</name>
  <files>
    apps/web/src/components/coach/WizardStep1Role.tsx
  </files>
  <read_first>
    - apps/web/src/components/coach/WizardStep1Role.tsx (FULL — current shape; props; state hooks; Server Action wiring)
    - apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx (consumer — verify props contract before refactoring)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (onboarding Step 1 / Role section — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/components/coach/WelcomeCard.tsx (design token reference for role-selection cards)
    - apps/web/src/app/globals.css
  </read_first>
  <action>
Open mockup → Step 1 Role section. Note: role card composition (icon + label + body + selected-state ring), spacing between cards, card hover behavior, primary CTA position/copy, back-link presence.

Refactor `WizardStep1Role.tsx`:
- Same exported component name and props signature (props consumed by `OnboardingWizard.tsx` must still type-check)
- Same role enum / role state contract — do not change the `'coach' | 'client' | 'both'` shape
- Same onSubmit / onAdvance prop wiring
- Update only Tailwind classes, copy strings (via next-intl), and inner DOM composition
- Icons: may swap react-icons/io5 names to match mockup; keep `react-icons/io5` import path
  </action>
  <verify>
    <automated>test -f apps/web/src/components/coach/WizardStep1Role.tsx</automated>
    <automated>grep -q "export" apps/web/src/components/coach/WizardStep1Role.tsx</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" apps/web/src/components/coach/WizardStep1Role.tsx</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `WizardStep1Role.tsx` still exports the same component name; props signature preserved (verified by OnboardingWizard.tsx import compiling cleanly)
    - Visual match: rendered Step 1 matches the Step 1 / Role section of `.planning/mockups/Ziko-Onboarding.html` (manual visual diff at gate)
    - `cd apps/web && npm run lint && npm run type-check` exits 0
    - Behavior preserved: selecting a role still advances the wizard; back-button behavior unchanged
  </acceptance_criteria>
  <done>Step 1 Role surface visually matches mockup; wizard state contract intact.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Refonte onboarding Step 2 (Profile) — WizardStep2Profile.tsx + WizardProgress.tsx + ProfileForm.tsx to mockup</name>
  <files>
    apps/web/src/components/coach/WizardStep2Profile.tsx,
    apps/web/src/components/coach/WizardProgress.tsx,
    apps/web/src/components/coach/ProfileForm.tsx
  </files>
  <read_first>
    - apps/web/src/components/coach/WizardStep2Profile.tsx (FULL)
    - apps/web/src/components/coach/WizardProgress.tsx (FULL — step indicator pattern)
    - apps/web/src/components/coach/ProfileForm.tsx (FULL — Server Action wiring; useActionState; field validation)
    - apps/web/src/components/coach/SpecialtyTagInput.tsx (consumer — keep contract)
    - apps/web/src/components/coach/PhotoUpload.tsx (consumer — keep contract)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (onboarding Step 2 / Profile + progress bar section — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/app/globals.css
  </read_first>
  <action>
Open mockup → Step 2 Profile section. Note: progress bar visual (line+dot vs pill+filled, active/completed states, label positions), form field stack (label-above vs floating, field height, spacing between fields), specialty chip input visual, photo upload affordance, action row (Back ← left, Continue → right primary).

Refactor 3 components:

1. `WizardProgress.tsx`: pure visual — step state, total steps, current step props preserved
2. `WizardStep2Profile.tsx`: layout wrapper around ProfileForm — preserve onAdvance/onBack props
3. `ProfileForm.tsx`: preserve all field names, Server Action wiring (`useActionState` + `<form action={profileSaveAction}>`), validation hooks; refactor field stacking + label placement + input styling + action row

CRITICAL: `ProfileForm` is shared between onboarding Step 2 AND `/coach/settings` (Plan 07b Task 2). The refactor MUST work for both contexts. If they have different parent layouts, isolate the form's internal layout from its parent's outer padding. Plan 07b's settings task should regression-test ProfileForm's dual-context render after this task completes.
  </action>
  <verify>
    <automated>test -f apps/web/src/components/coach/WizardStep2Profile.tsx && test -f apps/web/src/components/coach/WizardProgress.tsx && test -f apps/web/src/components/coach/ProfileForm.tsx</automated>
    <automated>grep -q "useActionState\|&lt;form action=" apps/web/src/components/coach/ProfileForm.tsx</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" apps/web/src/components/coach/WizardStep2Profile.tsx apps/web/src/components/coach/ProfileForm.tsx</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - All 3 files preserve their exported component names and prop signatures
    - `ProfileForm.tsx` still wires to its Server Action via `useActionState` + `<form action=...>`
    - Visual match: rendered Step 2 (progress bar + profile form) matches the Step 2 / Profile section of `.planning/mockups/Ziko-Onboarding.html`
    - Visual match: progress bar matches mockup in both Step 2 AND Step 3 contexts (current=2 of 3; current=3 of 3)
    - `cd apps/web && npm run lint && npm run type-check` exits 0
    - Behavior preserved: profile form save still persists (existing Phase 24 acceptance flow) AND ProfileForm still renders correctly in `/coach/settings` (Plan 07b regression-tests this)
  </acceptance_criteria>
  <done>Step 2 Profile + WizardProgress + ProfileForm surfaces visually match mockup; save flow + dual-context reuse intact.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Refonte onboarding Step 3 (KYC) — WizardStep3Kyc.tsx to mockup</name>
  <files>
    apps/web/src/components/coach/WizardStep3Kyc.tsx
  </files>
  <read_first>
    - apps/web/src/components/coach/WizardStep3Kyc.tsx (FULL — current shape; KYC upload Server Action wiring; KycDocList/FileUploadRow consumption)
    - apps/web/src/components/coach/KycDocList.tsx (consumer — keep contract)
    - apps/web/src/components/coach/FileUploadRow.tsx (consumer — keep contract)
    - apps/web/src/components/coach/KycStatusChip.tsx (status chip pattern reference)
    - `.planning/mockups/Ziko-Onboarding.html` (local file — canonical visual source) (onboarding Step 3 / KYC section — canonical visual reference, pixel-for-pixel match required). Live preview (secondary): https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html
    - apps/web/src/app/globals.css
  </read_first>
  <action>
Open mockup → Step 3 KYC section. Note: doc-list visual (icon + filename + status chip + delete affordance), upload zone visual (drag-drop area, "Glissez ou cliquez", file-type hint), status legend, finalize CTA copy + state ("Soumettre pour vérification" or whatever mockup says).

Refactor `WizardStep3Kyc.tsx`:
- Preserve props signature (onAdvance/onBack/onFinalize wiring)
- Preserve KYC document upload Server Action wiring; preserve the upload list state contract
- Refactor only Tailwind classes, internal layout, copy strings (via next-intl)
- The submit/finalize button MUST preserve its Server Action wiring and signature
  </action>
  <verify>
    <automated>test -f apps/web/src/components/coach/WizardStep3Kyc.tsx</automated>
    <automated>grep -q "export" apps/web/src/components/coach/WizardStep3Kyc.tsx</automated>
    <automated>! grep -E "from '@supabase/supabase-js'" apps/web/src/components/coach/WizardStep3Kyc.tsx</automated>
    <automated>cd apps/web && npm run lint 2>&1 | tail -10</automated>
    <automated>cd apps/web && npm run type-check 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `WizardStep3Kyc.tsx` preserves its exported component name and props signature
    - Visual match: rendered Step 3 KYC matches the Step 3 / KYC section of `.planning/mockups/Ziko-Onboarding.html`
    - `cd apps/web && npm run lint && npm run type-check` exits 0
    - Behavior preserved: KYC document upload + status display + finalize submission still works (existing Phase 24 acceptance flow)
  </acceptance_criteria>
  <done>Step 3 KYC surface visually matches mockup; KYC upload + finalize wiring intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /login Server Component | cookies session; loginAction validates credentials via Supabase auth |
| browser → /coach/onboarding | cookies session; layout/page Server Components call `auth.getUser()`; redirect to /login when null |
| Server Actions (login, profile, KYC) → Supabase | session.access_token Bearer; RLS enforces row scope |

## STRIDE Threat Register

Refonte does not introduce new threats. Existing Phase 23/24 threat dispositions are reaffirmed below.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-04 | Spoofing | login next param (safeNext) | mitigate | `safeNext` (extended by Plan 05) is consumed by `login/page.tsx`; this plan does NOT modify safeNext; Plan 05 retains exclusive ownership of that function. Refonte preserves the `safeNext(searchParams.get('next'))` call shape. |
| Phase 23 D-11 | Tampering | All refactored Phase 24 surfaces | mitigate | No file in this plan introduces `import ... from '@supabase/supabase-js'`. ESLint rule enforces; verify block greps for the forbidden import. Use only `createServerSupabase` / `createBrowserSupabase` factories. |
| Phase 23 D-12 | Information Disclosure | apps/web env scope | mitigate | No new env var consumption; no `SUPABASE_SERVICE_KEY` reference introduced; web bundle continues to use publishable key only. |
| Auth gate bypass | Spoofing | refactored Server Components | mitigate | Refonte preserves all `auth.getUser()` + `redirect('/login')` patterns from Phase 24; no auth-gate logic is touched. |
| CSRF on Server Actions | Tampering | login + profile + KYC actions | mitigate | Next.js Server Actions ship CSRF tokens by default; refonte preserves `useActionState` + `<form action={...}>` wiring. |
| XSS via refactored copy | Tampering | next-intl interpolations | mitigate | All user-injected values continue to flow through React auto-escape; next-intl interpolation does not bypass escaping. No `dangerouslySetInnerHTML` introduced. |
| Behavior regression via refactor | Operational | All 4 tasks | mitigate | Each task acceptance criterion explicitly requires "Behavior preserved" with cite to the corresponding Phase 24 acceptance flow; Plan 06 Wave 4 validation gate runs `npm run build` to catch import-time regressions. |
</threat_model>

<verification>
After all 4 tasks complete:

```bash
# 1. Lint clean (no new ESLint violations)
cd apps/web && npm run lint

# 2. Type-check clean (no new TS errors)
cd apps/web && npm run type-check

# 3. Build clean (catches import resolution + broken module references)
cd apps/web && npm run build

# 4. Forbidden imports check (Phase 23 D-11)
! grep -rE "from '@supabase/supabase-js'" apps/web/src/app/\[locale\]/login apps/web/src/app/\[locale\]/coach/onboarding apps/web/src/components/coach

# 5. Server Action wiring intact across refactored forms
grep -q "useActionState\|<form action=" apps/web/src/app/\[locale\]/login/LoginForm.tsx
grep -q "useActionState\|<form action=" apps/web/src/components/coach/ProfileForm.tsx
```

**Manual visual diff gate (before /gsd-verify-work):**

Open `.planning/mockups/Ziko-Onboarding.html` side-by-side with the dev server (local file is canonical; live preview at https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772?file=Ziko+Onboarding.html is secondary). For each of the 4 surfaces below, record PASS or FLAG in the plan tail (append a `## Refonte Visual Diff` section to `25-07a-SUMMARY.md`):

1. `/fr/login` — login form vs mockup login section
2. `/fr/coach/onboarding` Step 1 (Role) vs mockup Step 1 section
3. `/fr/coach/onboarding` Step 2 (Profile + progress bar) vs mockup Step 2 section
4. `/fr/coach/onboarding` Step 3 (KYC) vs mockup Step 3 section

Any FLAG must include: surface name, specific drift observation (spacing/typography/color/copy), and remediation plan.

**Behavior preservation checks (cite Phase 24 acceptance flows):**

1. Login with valid credentials → redirect to safeNext-validated target (Phase 24 acceptance flow #1)
2. Coach onboarding wizard: complete all 3 steps end-to-end → role saved, profile saved, KYC docs uploaded, finalize submits (Phase 24 acceptance flow #2)
</verification>

<success_criteria>
- 2 Phase 24 web surfaces (login + 3-step onboarding wizard) visually match the canonical `.planning/mockups/Ziko-Onboarding.html`
- Phase 24 acceptance behavior flows still pass (auth, role selection, profile save, KYC upload + finalize)
- Zero new lint / type-check / build errors
- No new `@supabase/supabase-js` direct imports (Phase 23 D-11 invariant preserved)
- No new `SUPABASE_SERVICE_KEY` references in web (Phase 23 D-12 invariant preserved)
- `ProfileForm.tsx` works in both onboarding Step 2 AND `/coach/settings` contexts (dual-context reuse intact — Plan 07b regression-tests the settings side)
- Manual visual diff gate records PASS for all 4 surfaces (or FLAG with remediation)
</success_criteria>

<output>
After completion, create `.planning/phases/25-invitations-mobile-mon-coach-minimal/25-07a-SUMMARY.md` recording:
- Files refactored (9 listed)
- Visual diff PASS/FLAG per surface (4 surfaces above)
- Behavior preservation checklist (2 Phase 24 acceptance flows verified)
- Any FLAG items with remediation actions
- Lint / type-check / build results (all 0)
- Any next-intl key renames / additions (track for translation completeness)
- ProfileForm dual-context note: handoff to Plan 07b for settings-side regression verification
</output>

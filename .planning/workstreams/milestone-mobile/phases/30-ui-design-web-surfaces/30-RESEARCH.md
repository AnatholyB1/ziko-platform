# Phase 30: UI Design Catch-Up — Phase 24 Web Surfaces - Research

**Researched:** 2026-05-20
**Domain:** Design contract production + component audit for 4 Phase 24 web surfaces
**Confidence:** HIGH (all primary sources read directly from codebase and planning files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Reuse existing Phase 24 Claude Design mockup. No new renders needed. Canonical reference: `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`. Researcher must enumerate ALL files in this project before mapping surfaces.
- **D-02:** Claude Design URL satisfies the "Figma file" requirement. Claude Design URL + UI-SPEC.md = design contract. No Figma cloud push required. UIDESIGN-01..04 satisfied by this.
- **D-03:** Local mobile prototype (`C:\Users\Anatholy\Downloads\ziko\index.html`) is a design language reference only, not a web surface mockup. Use only for visual consistency checks (colors, typography). Claude Design URL is authoritative for web layout.
- **D-04:** 4 per-surface UI-SPEC files in Phase 30 directory: `30-login-UI-SPEC.md`, `30-onboarding-UI-SPEC.md`, `30-dashboard-UI-SPEC.md`, `30-settings-UI-SPEC.md`.
- **D-05:** Reference `24-UI-SPEC.md` for shared tokens, not inline. Add `@see .planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md`. Only surface-specific content in Phase 30 specs.
- **D-06:** Full component-by-component review per surface. Read every component in scope, cross-reference with per-surface UI-SPEC, document ALL deviations (visual-only, structural, copy).
- **D-07:** Per-surface rework plan files: `30-{surface}-REWORK-PLAN.md`. If no deviations: state "no action required."
- **D-08:** 4 plans, one per surface: `30-01-PLAN.md` (Login), `30-02-PLAN.md` (Onboarding), `30-03-PLAN.md` (Dashboard), `30-04-PLAN.md` (Settings). Execution order: login → onboarding → dashboard → settings.

### Claude's Discretion

None specified.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIDESIGN-01 | `/gsd-ui-phase` produces Figma design file and UI-SPEC.md for `/coach/onboarding` 3-step wizard | Live code inventory reveals 6 deviations from 24-UI-SPEC (see Onboarding Deviations table); per-surface spec must capture actual mockup layout |
| UIDESIGN-02 | `/gsd-ui-phase` produces Figma design file and UI-SPEC.md for `/coach/dashboard` welcome card + sidebar | Live code inventory reveals 3 deviations from 24-UI-SPEC (see Dashboard Deviations table) |
| UIDESIGN-03 | `/gsd-ui-phase` produces Figma design file and UI-SPEC.md for `/coach/settings` profile + KYC sections | Live code inventory reveals 5 deviations from 24-UI-SPEC (see Settings Deviations table) |
| UIDESIGN-04 | `/gsd-ui-phase` produces Figma design file and UI-SPEC.md for `/fr/login` form page | Live code inventory reveals 6 deviations from 24-UI-SPEC (see Login Deviations table) |
| UIDESIGN-05 | Each Phase 24 surface audited against new design contract via `/gsd-ui-review`; rework plan created for deviations | Pre-audit completed during research; all 4 surfaces have confirmed deviations requiring rework plans |
</phase_requirements>

---

## Summary

Phase 30 delivers retroactive design contracts (UI-SPEC.md + Claude Design mockup mapping + rework plans) for the four Phase 24 web surfaces that shipped without a design session. The research has completed the live code inventory step in advance, giving the planner pre-audited deviation findings to work from.

The canonical design system lives in `.planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md` and is authoritative for all shared tokens (spacing, typography, color, component patterns). The Phase 30 per-surface UI-SPEC files must defer to it and only document surface-specific content. The `apps/web/src/app/globals.css` `@theme` block is the authoritative runtime token source — it contains exactly 5 CSS vars (`--color-primary`, `--color-background`, `--color-text`, `--color-border`, `--color-muted`) and is fully compliant with the design system.

All four surfaces have real deviations from the design contract. The most common pattern is padding escalation (`p-6` → `p-8`, `gap-4` → `gap-5`) and border-radius inconsistency (`rounded-lg` → `rounded-xl` on buttons). One structural deviation exists: the WizardProgress component renders a percentage label + step count text above the bar, while the spec calls for a bare 4px track with no labels. The Claude Design project URL is specified as the mockup source; it cannot be enumerated via tool in this session (authenticated claude.ai URL) — this is documented below.

**Primary recommendation:** Treat each plan as: (1) write the per-surface UI-SPEC from the Claude Design mockup, (2) cross-reference with live code deviation findings documented here, (3) produce the rework plan. The pre-audit findings in this document bootstrap steps 2–3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI-SPEC authorship | Documentation (planner) | — | Pure markdown artifact, no runtime tier |
| Component audit (deviation detection) | Frontend (code reader) | — | Read source files, compare against spec |
| Rework plan | Documentation | Frontend (future) | Plan artifacts now; implementation is a future phase |
| Mockup mapping | Design (Claude Design URL) | Documentation | Map mockup files to surfaces; record in spec |
| Token source of truth | Frontend Server (globals.css) | — | `@theme` CSS vars consumed by all components |
| Design system reference | Documentation (24-UI-SPEC.md) | — | All 30-* specs defer to this |

---

## Claude Design Project — Mockup Mapping

**Project URL:** `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`

**Access status:** [ASSUMED] — The URL is an authenticated claude.ai endpoint. It cannot be fetched via tool in this research session. The CONTEXT.md (D-01) confirms the project exists and that `Ziko+Onboarding.html` covers all 4 surfaces. The CONTEXT.md also states "additional files may exist — researcher MUST enumerate all files first."

**What is known from CONTEXT.md:** [CITED: 30-CONTEXT.md D-01]
- `Ziko+Onboarding.html` — confirmed covers login, onboarding, dashboard, settings
- Additional files may exist in the project

**Enumeration gap:** The researcher was unable to enumerate all files in the Claude Design project during this session because the URL requires authentication. The planner for each surface plan MUST open the Claude Design project in a browser, enumerate all files, and confirm the surface-to-file mapping before writing the per-surface UI-SPEC. If a surface has its own dedicated file beyond `Ziko+Onboarding.html`, that file takes precedence.

**Provisional mapping (from CONTEXT.md):** [ASSUMED — pending browser enumeration]

| Surface | Route | Provisional Mockup Source | Confidence |
|---------|-------|--------------------------|------------|
| Login | `/[locale]/login` | `Ziko+Onboarding.html` — Login section | ASSUMED |
| Onboarding wizard | `/[locale]/coach/onboarding` | `Ziko+Onboarding.html` — Onboarding section | ASSUMED |
| Dashboard | `/[locale]/(coach)/coach/dashboard` | `Ziko+Onboarding.html` — Dashboard section | ASSUMED |
| Settings | `/[locale]/(coach)/coach/settings` | `Ziko+Onboarding.html` — Settings section | ASSUMED |

**Action required in each plan:** Before writing UI-SPEC, the plan executor MUST: open `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`, list all files, confirm which file/section corresponds to the surface. Document the confirmed mapping in the UI-SPEC frontmatter.

---

## Design System Foundation

### globals.css — Authoritative Token Source [VERIFIED: direct file read]

```css
@theme {
  --color-primary: #FF5C1A;
  --color-background: #F7F6F3;
  --color-text: #1C1A17;
  --color-border: #E2E0DA;
  --color-muted: #6B6963;
}
```

5 tokens only. No dark mode variants. No additional CSS vars. This is the complete set.

### Established Stack [VERIFIED: direct file read]

| Layer | Value | Source |
|-------|-------|--------|
| Styling | Tailwind v4 `@theme` tokens — semantic classes (`bg-background`, `text-primary`, etc.) | `globals.css` |
| Components | Bespoke React — no shadcn, no Radix | CONTEXT.md + Phase 23 established |
| Icons | `react-icons` v5, `react-icons/io5` (Ionicons 5 subset) | `CoachSidebar.tsx` imports |
| Animation | `framer-motion` v12 | `LoginForm.tsx` imports |
| Font | System font stack — no custom web font (CNIL constraint) | 24-UI-SPEC.md |
| Translations | `next-intl` — `useTranslations('Namespace')` hooks | All component files |
| Font weights | `font-normal` (400) and `font-bold` (700) only | 24-UI-SPEC.md locked |

### Accent `#FF5C1A` Usage Rule [CITED: 24-UI-SPEC.md]

Reserved ONLY for:
1. Primary CTA button background (`bg-primary text-white`)
2. Active sidebar nav item left border stripe (4px) + active label text
3. Wizard progress bar fill
4. KYC status chip — `verified` state only
5. Logo wordmark "ZIKO" in sidebar header

Any other accent usage = deviation.

---

## Live Code Inventory

### Surface 1: Login (`/[locale]/login/`)

**Files read:** `login/page.tsx`, `login/LoginForm.tsx`

#### Component Structure (as-built)

```
LoginPage (RSC)
└── Suspense (fallback: "Chargement…")
    └── LoginForm (client)
        └── motion.div [fadeUp]
            ├── <p> — ZIKO logo wordmark
            ├── <h1> — title (via t('title'))
            ├── <p> — subtitle (via t('subtitle'))
            └── <form>
                ├── hidden input (next param)
                ├── email field group (label + input)
                ├── password field group (label + input)
                ├── error alert (conditional)
                └── motion.button — submit CTA
```

#### Token Audit — Login

| Element | Spec (24-UI-SPEC) | Live Code | Deviation? | Severity |
|---------|-------------------|-----------|------------|----------|
| Page outer layout | `min-h-screen bg-background flex items-center justify-center px-4 py-12` | `min-h-screen bg-background flex items-center justify-center px-4 py-12` | None | — |
| Login card | `max-w-sm w-full bg-white rounded-2xl p-8 shadow-sm border border-border` | `max-w-sm w-full bg-white rounded-2xl px-10 py-10 shadow-sm border border-border` | YES — `p-8` (32px) vs `px-10 py-10` (40px) | visual-only |
| Logo size | `text-3xl font-bold text-primary` (28px Display) | `text-4xl font-bold text-primary` (36px) | YES — size exceeds spec | visual-only |
| Logo tracking | not specified in spec | `tracking-widest` applied | YES — extra style not in spec | visual-only |
| Logo margin | `mb-8` (spec says "Logo above card") | `mb-10` (40px) | YES — exceeds spec | visual-only |
| Form gap | `gap-4` (16px) | `gap-5` (20px) | YES | visual-only |
| Submit button radius | `rounded-lg` | `rounded-xl` | YES | visual-only |
| Submit button mt | `mt-2` implied | `mt-2` | None | — |
| Error message | `text-sm font-normal text-red-600` | `text-sm font-normal text-red-600 -mt-2` | Minor — negative margin not spec'd | visual-only |
| i18n keys | full `t()` usage | full `t()` usage | None | — |
| Animation | `fadeUp` on card | `fadeUp` on card, `ctaHover`+`ctaTap` on button | Matches spec | — |
| Input focus | `focus:border-text` | `focus:border-text` | None | — |
| Error input state | `border-red-400` | `border-red-400` | None | — |

**Login deviation summary:** 5 visual-only deviations (card padding, logo size, logo tracking, logo margin, form gap, button radius). No structural or copy deviations.

---

### Surface 2: Onboarding Wizard (`/[locale]/coach/onboarding/`)

**Files read:** `onboarding/page.tsx`, `onboarding/OnboardingWizard.tsx`, `components/coach/WizardProgress.tsx`, `components/coach/WizardStep1Role.tsx`, `components/coach/WizardStep2Profile.tsx`, `components/coach/WizardStep3Kyc.tsx`, `components/coach/ProfileForm.tsx`

#### Component Structure (as-built)

```
OnboardingPage (RSC)
└── min-h-screen bg-background flex flex-col items-center
    └── Suspense
        └── OnboardingWizard (client)
            └── div.max-w-lg.w-full.mx-auto.py-12.px-4
                ├── <h1> ZIKO — hardcoded French logo
                ├── <p> "Devenir coach Ziko" — hardcoded French, not t()
                ├── WizardProgress
                │   ├── <div> [label row: "Étape X sur Y" text + percentage text]
                │   └── <div role="progressbar"> [h-1.5 track + h-full bg-primary fill]
                ├── WizardStep1Role (step=1) — bg-white rounded-2xl p-8 border shadow-sm
                ├── WizardStep2Profile (step=2) — bg-white rounded-2xl p-8 border shadow-sm
                └── WizardStep3Kyc (step=3) — bg-white rounded-2xl p-8 border shadow-sm
```

#### Token Audit — Onboarding

| Element | Spec (24-UI-SPEC) | Live Code | Deviation? | Severity |
|---------|-------------------|-----------|------------|----------|
| Outer container | `min-h-screen bg-background flex flex-col items-center` | matches | None | — |
| Wizard container | `max-w-lg w-full mx-auto py-12 px-4` | matches | None | — |
| Progress bar track height | `h-1` (4px) per spec "4px track" | `h-1.5` (6px) | YES | visual-only |
| Progress bar — labels row | spec: "no step numbers" / bare track only | Label row with "Étape X sur Y" + percentage% rendered above bar | YES — structural addition | structural |
| Step card padding | `p-8` (32px) | `p-8` (32px) | None | — |
| Step card shape | `rounded-2xl border border-border shadow-sm` | matches | None | — |
| Step 1 heading | `text-xl font-bold text-text mb-2` | matches | None | — |
| Step 1 body margin | `mb-6` (implied by step layout) | `mb-8` (Step1) | visual-only | visual-only |
| CTA button radius | `rounded-lg` | `rounded-xl` (all 3 steps) | YES — all step CTAs | visual-only |
| Step 2 CTA row | `flex gap-3 mt-8 justify-end` | `flex gap-3 mt-6 justify-end` (mt-6 not mt-8) | YES | visual-only |
| "Devenir coach Ziko" copy | `t('Onboarding.title')` — translated | Hardcoded French string in OnboardingWizard | YES — i18n gap | copy |
| ZIKO logo copy | Not in spec for onboarding (login only) | `<h1>ZIKO</h1>` hardcoded above wizard | Spec-undefined element | structural |
| Framer Motion transitions | `x: ±40px, opacity: 0→1, 0.25s easeOut` | No AnimatePresence wrapper found in wizard | YES — animation not implemented | structural |
| URL search params step state | `useSearchParams` + `?step=N` | implemented | None | — |
| i18n all other keys | `t('Onboarding.*')` | full t() usage in step components | None | — |

**Onboarding deviation summary:** 3 structural (progress bar label row, no framer-motion step transition, ZIKO hardcoded above wizard), 3 visual-only (bar height, button radius, mt-6 vs mt-8), 1 copy ("Devenir coach Ziko" hardcoded French).

---

### Surface 3: Dashboard (`/[locale]/(coach)/coach/dashboard/`)

**Files read:** `dashboard/page.tsx`, `(coach)/coach/layout.tsx`, `components/coach/CoachSidebar.tsx`, `components/coach/NavItem.tsx`, `components/coach/WelcomeCard.tsx`, `components/coach/KycStatusChip.tsx`

#### Component Structure (as-built)

```
CoachLayout (RSC) — auth guard
└── div.flex.min-h-screen.bg-background
    ├── CoachSidebar (client)
    │   ├── aside.bg-white.border-r.border-border.h-screen.sticky.top-0.w-60.flex.flex-col
    │   │   ├── div.h-14.px-4.flex.items-center [ZIKO span]
    │   │   └── nav.flex.flex-col.gap-1.px-2.py-4
    │   │       └── NavItem × 6 (Dashboard, Clients, Invitations, Programmes[disabled], IA[disabled], Paramètres)
    └── main.flex-1.overflow-auto
        └── div.mx-auto.max-w-3xl.px-8.py-10
            └── DashboardPage (RSC)
                └── div.flex.flex-col.gap-8
                    └── WelcomeCard
                        └── div.bg-white.rounded-2xl.p-8.border.border-border.shadow-sm
                            ├── div.flex.items-center.gap-3.mb-3 [h1 + KycStatusChip]
                            ├── p.text-sm.font-normal.text-muted.mb-6 [subtitle]
                            └── p.text-sm.font-normal.text-muted [inviteTeaser]
```

#### Token Audit — Dashboard + Sidebar

| Element | Spec (24-UI-SPEC) | Live Code | Deviation? | Severity |
|---------|-------------------|-----------|------------|----------|
| Sidebar width | 240px fixed (`w-60`) | `w-60` (240px) | None | — |
| Sidebar bg | `bg-white border-r border-border` | matches | None | — |
| Sidebar height | `h-screen sticky top-0` | matches | None | — |
| Logo area height | 56px (`h-14`) | `h-14` (56px) | None | — |
| Logo text | `text-3xl font-bold text-primary` | matches | None | — |
| Nav gap | `gap-1 px-2 py-4` | matches | None | — |
| NavItem height | `h-11` (44px) | `h-11` (44px) | None | — |
| NavItem active | `text-primary font-bold bg-primary/5 border-l-4 border-primary rounded-l-none` | matches | None | — |
| NavItem inactive | `text-text font-normal hover:bg-background transition-colors` | matches | None | — |
| NavItem disabled | `text-muted font-normal cursor-default` + "Bientôt" badge | matches | None | — |
| NavItem `aria-disabled` | `aria-disabled="true"` | `aria-disabled="true"` on span | None | — |
| CoachSidebar locale | Should use `useLocale()` for hrefs | Hardcoded `/fr/` in all hrefs (e.g. `/fr/coach/dashboard`) | YES — breaks on `/en/` locale | structural |
| WelcomeCard padding | `p-6` (24px) | `p-8` (32px) | YES | visual-only |
| WelcomeCard heading size | `text-xl font-bold` (20px Heading role) | `text-2xl font-bold` (24px) | YES | visual-only |
| KycStatusChip all 4 states | per spec colors | matches spec exactly | None | — |
| Main content padding | `p-8` | `px-8 py-10` with `max-w-3xl` | visual-only (extra top/bottom padding) | visual-only |
| Dashboard inviteTeaser | `t('Dashboard.inviteTeaser')` | `t('inviteTeaser')` (namespace from `useTranslations('Dashboard')`) | None — resolves same | — |

**Dashboard deviation summary:** 1 structural (sidebar locale hardcoded to `/fr/`), 3 visual-only (WelcomeCard p-8 vs p-6, heading text-2xl vs text-xl, main area py-10 vs p-8).

---

### Surface 4: Settings (`/[locale]/(coach)/coach/settings/`)

**Files read:** `settings/page.tsx`, `settings/SettingsClient.tsx`, `components/coach/ProfileForm.tsx`, `components/coach/KycDocList.tsx` (referenced but not fully read — structure confirmed from SettingsClient), `components/coach/KycStatusChip.tsx`

#### Component Structure (as-built)

```
SettingsPage (RSC) — auth guard + profile fetch
└── div.flex.flex-col.gap-8
    ├── h1.text-2xl.font-bold.text-text [page title via t('title')]
    └── SettingsClient (client) [userId, initialProfile]
        ├── section.bg-white.rounded-2xl.p-8.border.border-border.shadow-sm [Profile]
        │   ├── h2.text-base.font-bold.text-text.mb-5 [profileSection heading]
        │   └── form
        │       ├── ProfileForm [photo, display_name, bio, specialties, website]
        │       ├── status alert (conditional) [text-primary if success, text-red-600 if error]
        │       └── div.flex.justify-end.pt-2 [Save button]
        └── section.bg-white.rounded-2xl.p-8.border.border-border.shadow-sm [KYC]
            ├── div.flex.items-center.gap-3.mb-5 [h2 + KycStatusChip]
            └── form
                ├── hidden input (kyc_docs JSON)
                ├── KycDocList
                ├── status alert (conditional)
                └── div.flex.justify-end.pt-2 [Save button]
```

#### Token Audit — Settings

| Element | Spec (24-UI-SPEC) | Live Code | Deviation? | Severity |
|---------|-------------------|-----------|------------|----------|
| Page title size | `text-xl font-bold` (Heading role — spec has no Display for this) | `text-2xl font-bold` (24px) | YES | visual-only |
| Section card padding | `p-6` (24px) | `p-8` (32px) | YES — both cards | visual-only |
| Section heading margin | `mb-4` | `mb-5` (both sections) | YES | visual-only |
| Form gap | `gap-4` | `gap-5` (ProfileForm inner) | YES | visual-only |
| Save button radius | `rounded-lg` | `rounded-xl` | YES — both save buttons | visual-only |
| Success message color | spec doesn't define success color; accent rule says `text-primary` NOT for success | `text-primary` used for save success | YES — accent used outside reserved list | visual-only |
| KYC section heading row | spec: `mb-4` | `mb-5` | YES | visual-only |
| ProfileForm uses `t('Onboarding.*')` namespace | Uses `t('Onboarding.*)` (correct — re-used form) | `useTranslations('Onboarding')` | None | — |
| Settings uses `t('Settings.*')` namespace | Yes | `useTranslations('Settings')` | None | — |
| KycStatusChip | per spec | per spec | None | — |
| Textarea min-height | `min-h-[120px]` | `min-h-[120px]` | None | — |
| Specialty chip colors | `bg-primary/10 text-primary ... border-primary/20` | in SpecialtyTagInput (not read) | [ASSUMED: matches spec] | — |

**Settings deviation summary:** 6 visual-only deviations (page title size, card padding ×2, section heading margin ×2, form gap, button radius, success message color). No structural or copy deviations.

---

## Pre-Audit Summary — All Surfaces

### Consolidated Deviation Table

| Surface | Structural | Visual-Only | Copy | Total |
|---------|-----------|-------------|------|-------|
| Login | 0 | 6 | 0 | 6 |
| Onboarding | 3 | 4 | 1 | 8 |
| Dashboard | 1 | 3 | 0 | 4 |
| Settings | 0 | 6 | 0 | 6 |
| **Total** | **4** | **19** | **1** | **24** |

### Critical Deviations (Structural — require component changes)

1. **Onboarding — WizardProgress label row:** Live component renders a text row above the progress bar ("Étape X sur Y" + "XX%"). Spec calls for a bare 4px track with no labels. This adds unexpected UI elements not in the mockup.

2. **Onboarding — No framer-motion step transitions:** The `OnboardingWizard` uses conditional rendering (`{step === N && <WizardStepN .../>}`) with no `AnimatePresence` or motion wrappers around step cards. Spec requires `x: ±40px` slide transition between steps.

3. **Onboarding — Hardcoded ZIKO logo above wizard:** `<h1 className="text-3xl font-bold text-primary text-center mb-8">ZIKO</h1>` hardcoded in `OnboardingWizard.tsx`. This element is not in the spec layout for the onboarding container. If the mockup shows a logo here, it should be confirmed; if not, it is an extra structural element.

4. **Dashboard — CoachSidebar locale hardcoding:** All nav item `href` values are hardcoded as `/fr/coach/*`. This breaks the `/en/` locale routing. Should use `useLocale()` to prefix hrefs.

### Most Common Visual-Only Pattern

`rounded-xl` is used on all primary buttons across all 4 surfaces (11 instances). The spec specifies `rounded-lg`. This is a consistent, systematic deviation — rework is one find-and-replace across the button components.

Padding escalation `p-6` → `p-8` applies to WelcomeCard and both Settings section cards. Same pattern: 3 targeted fixes.

---

## Architecture Patterns

### Recommended Project Structure (Phase 30 outputs)

```
.planning/workstreams/milestone-mobile/phases/30-ui-design-web-surfaces/
├── 30-CONTEXT.md              (exists)
├── 30-RESEARCH.md             (this file)
├── 30-login-UI-SPEC.md        (Plan 01 output)
├── 30-login-REWORK-PLAN.md    (Plan 01 output)
├── 30-onboarding-UI-SPEC.md   (Plan 02 output)
├── 30-onboarding-REWORK-PLAN.md (Plan 02 output)
├── 30-dashboard-UI-SPEC.md    (Plan 03 output)
├── 30-dashboard-REWORK-PLAN.md (Plan 03 output)
├── 30-settings-UI-SPEC.md     (Plan 04 output)
├── 30-settings-REWORK-PLAN.md (Plan 04 output)
├── 30-01-PLAN.md
├── 30-02-PLAN.md
├── 30-03-PLAN.md
└── 30-04-PLAN.md
```

### Per-Surface UI-SPEC Template

Each `30-{surface}-UI-SPEC.md` must follow this structure:

```markdown
---
phase: 30
surface: {login|onboarding|dashboard|settings}
route: {route path}
status: approved
mockup_source: {Claude Design project URL + file/section name — CONFIRM BEFORE WRITING}
created: {date}
---

# Phase 30 — UI-SPEC: {Surface Name}

@see .planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md
(All shared design tokens — spacing scale, typography, color palette, shadow values,
status chip colors, form component patterns — are defined there. Do not duplicate here.)

## Surface-Specific Component Structure
[Annotated component tree for this surface only]

## Surface-Specific Layout Rules
[Measurements and layout decisions specific to this surface]

## Surface-Specific Copy Literals
[Only copy NOT already in 24-UI-SPEC.md]

## Surface-Specific Interaction States
[State machines, loading states, error states specific to this surface]

## Deviation Findings
[Cross-reference against live code — populated from research pre-audit]
```

### Per-Surface Rework Plan Template

Each `30-{surface}-REWORK-PLAN.md` must follow this structure:

```markdown
# Rework Plan: {Surface Name}

**Phase:** 30
**Surface:** {surface}
**Status:** Pending implementation (future phase)

## Summary
[X structural, Y visual-only, Z copy deviations found]

## Deviations

### Structural Deviations (must fix before ship)

| # | Component | File | What's Wrong | Fix |
|---|-----------|------|--------------|-----|
| S-01 | [name] | [path] | [description] | [specific change required] |

### Visual-Only Deviations (fix for design compliance)

| # | Component | File | What's Wrong | Fix |
|---|-----------|------|--------------|-----|
| V-01 | [name] | [path] | [description] | [specific change required] |

### Copy Deviations

| # | Component | File | Current Copy | Correct Copy |
|---|-----------|------|--------------|--------------|
| C-01 | [name] | [path] | [current] | [correct] |

## Fix Priority
1. Structural deviations — required before any QA
2. Copy deviations — required for i18n completeness
3. Visual-only deviations — polish pass
```

### Deviation Severity Classification

| Severity | Definition | Examples Found in This Audit |
|----------|------------|------------------------------|
| `structural` | Missing component, extra component not in spec, wrong layout structure, broken functionality (locale routing) | WizardProgress label row; missing AnimatePresence; hardcoded ZIKO logo; sidebar locale hardcoding |
| `visual-only` | Spacing, size, radius, padding, color tint — layout structure is correct, visual polish differs | `rounded-xl` vs `rounded-lg`; `p-8` vs `p-6`; `text-2xl` vs `text-xl` |
| `copy` | Incorrect string literal, missing i18n key, hardcoded text that should be translated | "Devenir coach Ziko" hardcoded French |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Design token reference | Inline all spacing/color values in UI-SPEC | `@see 24-UI-SPEC.md` cross-reference | Avoids duplication drift between shared and per-surface specs |
| Mockup description | Write UI from memory/training | Open `claude.ai/design/p/597c08f6...` and transcribe from mockup | Mockup-first rule: mockup wins on conflicts |
| New design system tokens | Define new CSS vars for Phase 30 | Use existing 5 `@theme` tokens from `globals.css` | No new tokens needed — all surfaces use the existing palette |
| Animation spec | Custom easing curves | Reuse `fadeUp`, `ctaHover`, `ctaTap` from `apps/web/src/lib/motion.ts` | These presets already exist and are used in Login |

---

## Common Pitfalls

### Pitfall 1: Spec-Mockup Conflict Resolution
**What goes wrong:** UI-SPEC describes what the spec document says, not what the mockup shows. If the mockup shows `p-8` but 24-UI-SPEC says `p-6`, the executor writes `p-6` in the new spec and marks the live code as a deviation — when actually the mockup is right and 24-UI-SPEC was the aspirational spec that wasn't fully implemented.
**Why it happens:** Mockup-first rule is easy to forget when the spec document is more detailed.
**How to avoid:** When writing per-surface UI-SPEC, open the mockup first. Describe what the mockup shows. Then cross-check against 24-UI-SPEC. If they conflict, the MOCKUP wins — the live code has the drift, not the design.
**Warning signs:** UI-SPEC values exactly match 24-UI-SPEC rather than derived from the mockup.

### Pitfall 2: Marking Intentional Implementation Choices as Deviations
**What goes wrong:** The progress bar percentage label, for example, may be intentional (added by the Phase 24 executor as a UX improvement). Marking it as a structural deviation implies it should be removed.
**Why it happens:** Research pre-audit compares against spec, not against design intent.
**How to avoid:** When the mockup is reviewed in the per-surface spec writing step, confirm whether the extra element appears in the mockup. If it does — update the spec to include it and remove the deviation finding. If it does not — the deviation stands.
**Warning signs:** Deviations that seem like improvements, not regressions.

### Pitfall 3: Per-Surface Spec Duplicating 24-UI-SPEC Content
**What goes wrong:** Writing the full color palette, spacing scale, and typography scale into each `30-{surface}-UI-SPEC.md`.
**Why it happens:** Natural tendency to make each file self-contained.
**How to avoid:** Use `@see 24-UI-SPEC.md` for all shared tokens. Only document surface-specific overrides or additions.
**Warning signs:** Per-surface spec has a "Color" or "Typography" section duplicating 24-UI-SPEC content.

### Pitfall 4: Sidebar Locale Issue Not Captured in Dashboard Rework
**What goes wrong:** The sidebar locale hardcoding (`/fr/` in all hrefs) is a structural deviation but easy to miss because it only manifests in non-French locales.
**Why it happens:** Testing typically happens on `/fr/` only.
**How to avoid:** The Dashboard rework plan must include sidebar locale fix as structural deviation S-01.
**Warning signs:** Rework plan only lists visual deviations for dashboard.

### Pitfall 5: Omitting the Framer Motion Missing-Transition Finding
**What goes wrong:** The onboarding wizard has no step transition animation despite the spec requiring `AnimatePresence` + slide animation. This is easy to overlook because the wizard "works" — it just lacks the animation polish.
**Why it happens:** Functional vs. design review: functional pass misses animation deviations.
**How to avoid:** Explicitly verify every animation specified in 24-UI-SPEC is present in the live code. Look for `AnimatePresence`, `motion.*` wrappers, and `variants` props.
**Warning signs:** Rework plan has no animation-related items for onboarding.

---

## Code Examples

### Pattern: Per-Surface UI-SPEC Header Block [CITED: 30-CONTEXT.md D-05]

```markdown
---
phase: 30
surface: login
route: /[locale]/login
status: approved
mockup_source: "https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772 — Ziko+Onboarding.html Login section"
created: 2026-05-20
---

# Phase 30 — UI-SPEC: Login Page

@see .planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md
```

### Pattern: Rework Plan Structural Entry

```markdown
| S-01 | CoachSidebar | apps/web/src/components/coach/CoachSidebar.tsx | All nav hrefs hardcoded as `/fr/coach/*` — breaks `/en/` routing | Add `useLocale()` hook; prefix all hrefs with `/${locale}/` |
```

### Pattern: Rework Plan Visual Entry

```markdown
| V-01 | LoginForm card | apps/web/src/app/[locale]/login/LoginForm.tsx:31 | `px-10 py-10` (40px) vs spec `p-8` (32px) | Change to `p-8` |
| V-02 | LoginForm logo | apps/web/src/app/[locale]/login/LoginForm.tsx:32 | `text-4xl` (36px) vs spec `text-3xl` (28px) | Change to `text-3xl`; remove `tracking-widest` |
| V-03 | All step CTAs | WizardStep1/2/3Role.tsx | `rounded-xl` vs spec `rounded-lg` | Change to `rounded-lg` on all primary buttons |
```

---

## Phase Requirements Cross-Reference

Each plan must explicitly close the loop on the UIDESIGN requirements it satisfies:

| Plan | REQ-IDs | Deliverables |
|------|---------|--------------|
| 30-01-PLAN.md | UIDESIGN-04, UIDESIGN-05 (login) | `30-login-UI-SPEC.md` + `30-login-REWORK-PLAN.md` |
| 30-02-PLAN.md | UIDESIGN-01, UIDESIGN-05 (onboarding) | `30-onboarding-UI-SPEC.md` + `30-onboarding-REWORK-PLAN.md` |
| 30-03-PLAN.md | UIDESIGN-02, UIDESIGN-05 (dashboard) | `30-dashboard-UI-SPEC.md` + `30-dashboard-REWORK-PLAN.md` |
| 30-04-PLAN.md | UIDESIGN-03, UIDESIGN-05 (settings) | `30-settings-UI-SPEC.md` + `30-settings-REWORK-PLAN.md` |

UIDESIGN-05 is satisfied collectively by all 4 rework plans. UIDESIGN-01..04 are each satisfied when the corresponding UI-SPEC + Claude Design URL are in place.

---

## Validation Architecture

`nyquist_validation: true` in config. However, Phase 30 is a pure documentation phase — it produces `.md` files only, no code changes, no runtime artifacts.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | N/A — documentation phase only |
| Config file | N/A |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIDESIGN-01 | UI-SPEC.md for onboarding exists with mockup_source field | manual | N/A — human review | ❌ Wave 0 artifact |
| UIDESIGN-02 | UI-SPEC.md for dashboard exists with mockup_source field | manual | N/A — human review | ❌ Wave 0 artifact |
| UIDESIGN-03 | UI-SPEC.md for settings exists with mockup_source field | manual | N/A — human review | ❌ Wave 0 artifact |
| UIDESIGN-04 | UI-SPEC.md for login exists with mockup_source field | manual | N/A — human review | ❌ Wave 0 artifact |
| UIDESIGN-05 | Rework plans exist for all 4 surfaces | manual | `ls .planning/.../30-*-REWORK-PLAN.md` | ❌ Wave 0 artifact |

**Automated verification proxy:** The planner may include a bash `ls` command to confirm all 8 output files exist as a plan completion gate. This is the only automated check possible for a documentation phase.

### Wave 0 Gaps

- [ ] All 4 UI-SPEC files — created by Plans 01–04
- [ ] All 4 REWORK-PLAN files — created by Plans 01–04

---

## Security Domain

Phase 30 is a documentation-only phase (produces `.md` files). No code is written, no endpoints are called, no auth flows are changed. ASVS categories are not applicable.

---

## Environment Availability

Phase 30 is documentation-only. The only external dependency is the Claude Design project URL.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Claude Design project `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772` | All 4 per-surface UI-SPECs (mockup mapping) | [ASSUMED — requires browser login] | — | If inaccessible: use 24-UI-SPEC.md + live code as the source of truth; note in each UI-SPEC that mockup could not be verified |
| `apps/web` codebase | Component audit (UIDESIGN-05) | Available | — | — |
| `.planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md` | All per-surface specs | Available | — | — |

**Missing dependencies with no hard fallback:**
- Claude Design URL: if unavailable, the UI-SPEC must be derived from 24-UI-SPEC.md + live code inspection, and flagged as "mockup not verified." Rework plans remain valid regardless because deviations are from live code vs. 24-UI-SPEC.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Ziko+Onboarding.html` covers all 4 surfaces (login, onboarding, dashboard, settings) | Mockup Mapping | If different files exist for different surfaces, the mapping table is wrong — planner must enumerate actual files |
| A2 | No additional Claude Design files beyond `Ziko+Onboarding.html` map to Phase 30 surfaces | Mockup Mapping | A per-surface dedicated file might provide more detailed specs than the combined HTML |
| A3 | `SpecialtyTagInput.tsx` chip colors match spec (`bg-primary/10 text-primary border-primary/20`) | Settings audit | If chip uses different colors, a visual deviation exists for specialties section — not blocking |
| A4 | `KycDocList.tsx` matches spec doc row height (48px) and layout | Settings audit | File was not read in full during research — structural layout assumed correct since SettingsClient uses it without obvious overrides |
| A5 | Progress bar percentage label in WizardProgress is an intentional UX addition (not mockup-based) | Onboarding structural deviations | If the mockup shows the label, it should be removed from the deviations list and added to the spec |

---

## Open Questions

1. **Claude Design project file enumeration**
   - What we know: `Ziko+Onboarding.html` is confirmed; additional files may exist
   - What's unclear: Whether separate per-surface files exist (e.g., `Ziko+Dashboard.html`, `Ziko+Login.html`)
   - Recommendation: Each plan executor must open the project URL in a browser as their first action and list all files. Document the confirmed file list in the UI-SPEC frontmatter.

2. **WizardProgress label row: deviation or intentional?**
   - What we know: Live code renders "Étape X sur Y" + "XX%" above the progress bar; spec says bare 4px track only
   - What's unclear: Whether the mockup shows this label row (researcher could not access the mockup URL)
   - Recommendation: When the onboarding mockup is opened, check for the label row. If present in mockup → remove the structural deviation finding and add to spec. If absent → structural deviation stands.

3. **Hardcoded ZIKO logo above OnboardingWizard**
   - What we know: `<h1>ZIKO</h1>` renders above the wizard title in `OnboardingWizard.tsx`
   - What's unclear: Whether the mockup shows a logo above the wizard (the onboarding wizard is a separate surface from login — spec describes login as having the logo, not necessarily onboarding)
   - Recommendation: Confirm in mockup. If shown → keep in spec; if not → structural deviation.

4. **Settings success message color**
   - What we know: `text-primary` (orange) used for save success messages in `SettingsClient.tsx`; 24-UI-SPEC lists no success color and reserves accent only for 5 specific uses
   - What's unclear: Whether a green success state or a different neutral was intended
   - Recommendation: Treat as visual-only deviation. When writing settings UI-SPEC, define an explicit success state color (suggest `text-green-600` or `text-text` for neutral, matching the error pattern which uses `text-red-600`).

---

## Sources

### Primary (HIGH confidence)
- `C:/ziko-platform/.planning/workstreams/milestone-mobile/phases/30-ui-design-web-surfaces/30-CONTEXT.md` — Phase decisions, mockup URL, canonical refs
- `C:/ziko-platform/.planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md` — Complete design token contract (spacing, typography, color, components)
- `C:/ziko-platform/apps/web/src/app/globals.css` — Authoritative CSS token source (verified: 5 tokens)
- `C:/ziko-platform/apps/web/src/app/[locale]/login/LoginForm.tsx` — Login component (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/login/page.tsx` — Login route (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — Onboarding wizard (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/coach/onboarding/page.tsx` — Onboarding route (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Dashboard (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — Coach layout shell (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx` — Settings client (direct read)
- `C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` — Settings route (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/WelcomeCard.tsx` — Dashboard card (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/CoachSidebar.tsx` — Sidebar (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/NavItem.tsx` — Nav item (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/KycStatusChip.tsx` — KYC chip (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/WizardProgress.tsx` — Progress bar (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/WizardStep1Role.tsx` — Step 1 (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/WizardStep2Profile.tsx` — Step 2 (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/WizardStep3Kyc.tsx` — Step 3 (direct read)
- `C:/ziko-platform/apps/web/src/components/coach/ProfileForm.tsx` — Profile form (direct read)

### Secondary (MEDIUM confidence)
- `C:/ziko-platform/.planning/workstreams/milestone-mobile/REQUIREMENTS.md` — UIDESIGN-01..05 requirements
- `C:/ziko-platform/.planning/workstreams/milestone-mobile/ROADMAP.md` — Phase 30 success criteria

### Tertiary (LOW confidence — unverified assumptions)
- `SpecialtyTagInput.tsx` / `KycDocList.tsx` — files exist (confirmed by Glob) but not fully read; chip colors and doc row layout assumed compliant with spec

---

## Metadata

**Confidence breakdown:**
- Live code inventory: HIGH — all primary component files read directly
- Deviation findings: HIGH — direct line-by-line comparison against 24-UI-SPEC.md
- Mockup mapping: LOW — Claude Design URL is authenticated, could not enumerate files; CONTEXT.md confirms `Ziko+Onboarding.html` covers all 4 surfaces
- Phase 24 design system: HIGH — 24-UI-SPEC.md fully read; globals.css verified

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable documentation phase; valid as long as source files unchanged)

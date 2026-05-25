# Phase 30: UI Design Catch-Up — Phase 24 Web Surfaces - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Workstream:** milestone-mobile
**Milestone:** v1.6 Mobile v2

<domain>
## Phase Boundary

Phase 30 delivers retroactive design contracts for the four Phase 24 web surfaces that shipped WITHOUT a `/gsd-ui-phase` session. For each surface: produce a per-surface UI-SPEC.md + run a full component-by-component audit against the mockup + write a rework plan listing deviations by severity.

**Four surfaces in scope:**
1. `/[locale]/login` — Login page (`apps/web/src/app/[locale]/login/`)
2. `/[locale]/coach/onboarding` — 3-step coach onboarding wizard (`apps/web/src/app/[locale]/coach/onboarding/`)
3. `/[locale]/(coach)/coach/dashboard` — Coach dashboard (`apps/web/src/app/[locale]/(coach)/coach/dashboard/`)
4. `/[locale]/(coach)/coach/settings` — Coach settings + KYC (`apps/web/src/app/[locale]/(coach)/coach/settings/`)

**Phase 30 is NOT about:**
- Mobile screens (mobile mockup in `Downloads/ziko/index.html` is a design reference only, not scope)
- Implementing any rework discovered — rework plans are plans, not code
- Phase 31 AI tools (separate phase)
- New web surfaces beyond the 4 above

**Execution order:** login → onboarding → dashboard → settings (user flow order)

</domain>

<decisions>
## Implementation Decisions

### Mockup Strategy

- **D-01: Reuse existing Phase 24 Claude Design mockup.** No new renders needed. The canonical reference is the Claude Design project at `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`. The researcher MUST enumerate ALL files in this project before mapping surfaces (user confirmed there are more pages than just `Ziko+Onboarding.html`). Map each of the 4 surfaces to the correct file/section within the project before writing any UI-SPEC.

- **D-02: Claude Design URL satisfies the "Figma file" requirement.** Same decision as Phase 28 — the Claude Design URL + UI-SPEC.md = the design contract. No Figma cloud push required. UIDESIGN-01..04 are satisfied by this.

- **D-03: Local mobile prototype is a design language reference only.** `C:\Users\Anatholy\Downloads\ziko\index.html` is the mobile app prototype (~20 Tweaks-navigable screens: Auth, Onboarding, Paramètres, Modules activés, Program builder, etc.). It is NOT the web surface mockup. Use it only to verify visual consistency between mobile and web design language (colors, typography, spacing). The Claude Design URL is authoritative for web surface layout.

### UI-SPEC Structure

- **D-04: 4 per-surface UI-SPEC files in the Phase 30 directory.** Files:
  - `30-login-UI-SPEC.md`
  - `30-onboarding-UI-SPEC.md`
  - `30-dashboard-UI-SPEC.md`
  - `30-settings-UI-SPEC.md`

  Each file documents: surface-specific component structure, layout, spacing, copy literals, interaction states, and deviation findings. Each references `24-UI-SPEC.md` for shared design system tokens (spacing scale, typography, color) rather than duplicating them.

- **D-05: Reference `24-UI-SPEC.md` for shared tokens, not inline.** Add `@see .planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md` for the design system. Only surface-specific content goes in the Phase 30 specs.

### Rework Audit Depth

- **D-06: Full component-by-component review per surface.** For each of the 4 surfaces: read every component file in scope, cross-reference with the new per-surface UI-SPEC, document ALL deviations (visual-only, structural, copy). This is appropriate because Phase 25's refonte may have been incomplete.

- **D-07: Per-surface rework plan files.** Output for each surface:
  - If deviations found: `30-{surface}-REWORK-PLAN.md` listing deviations by severity (visual-only / structural / copy), with fix tasks.
  - If no deviations: rework plan states "no action required."

### Plan Structure

- **D-08: 4 plans, one per surface, spec + audit bundled.** Each plan is self-contained:
  - `30-01-PLAN.md` — Login: write UI-SPEC + full audit + rework plan
  - `30-02-PLAN.md` — Onboarding wizard: write UI-SPEC + full audit + rework plan
  - `30-03-PLAN.md` — Dashboard: write UI-SPEC + full audit + rework plan
  - `30-04-PLAN.md` — Settings: write UI-SPEC + full audit + rework plan

  Execution order follows user flow: login → onboarding → dashboard → settings.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System (shared tokens — DO NOT duplicate in per-surface specs)
- `.planning/phases/24-coach-identity-onboarding/24-UI-SPEC.md` — Phase 24 global design contract. Contains spacing scale, typography scale, color palette, shadow values, status chip colors. All per-surface specs reference this.

### Web App Source Code (surfaces to audit)
- `apps/web/src/app/[locale]/login/LoginForm.tsx` — Login page component
- `apps/web/src/app/[locale]/login/page.tsx` — Login page route
- `apps/web/src/app/[locale]/coach/onboarding/OnboardingWizard.tsx` — Onboarding wizard
- `apps/web/src/app/[locale]/coach/onboarding/page.tsx` — Onboarding route
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Dashboard (imports WelcomeCard)
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — Coach layout shell (sidebar)
- `apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx` — Settings client
- `apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx` — Settings route
- `apps/web/src/app/globals.css` — `@theme` tokens (Tailwind v4 CSS vars — authoritative source for colors)

### Design Mockup (canonical visual reference)
- Claude Design project: `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`
  - `Ziko+Onboarding.html` — Phase 24 web surfaces (confirmed covers login, onboarding, dashboard, settings)
  - Additional files may exist in this project — researcher MUST enumerate all files first
  - Mockup-first rule: when mockup and UI-SPEC conflict, mockup wins

### Mobile Design Reference (consistency check only)
- `C:\Users\Anatholy\Downloads\ziko\index.html` — Mobile prototype (~20 Tweaks-navigable screens). Use only to verify design language consistency (colors, typography). NOT the web surface reference.

### Prior Phase Context
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — Implementation decisions from Phase 24 (auth, routing, role logic)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS.md` §UIDESIGN-01..05 — Requirements this phase must satisfy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WelcomeCard` component imported in `dashboard/page.tsx` — audit target
- `SettingsClient.tsx` — full settings implementation; component-by-component audit target
- `LoginForm.tsx` — login form; audit for typography, spacing, CTA color compliance
- `OnboardingWizard.tsx` — multi-step wizard; audit for progress bar, step layout, button placement

### Established Patterns
- Tailwind v4 `@theme` tokens in `globals.css` — all components use CSS vars via semantic Tailwind classes (`bg-background`, `text-primary`, etc.)
- No shadcn — all components are bespoke Tailwind v4 (Phase 23 established, Phase 24 confirmed)
- react-icons v5 (`react-icons/io5` Ionicons 5 subset) — icon library
- framer-motion v12 — animation library
- System font stack (no custom font load — CNIL constraint)
- Two font weights only: `font-normal` (400) and `font-bold` (700) — Phase 24 locked

### Integration Points
- The `(coach)` layout at `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` wraps dashboard + settings — sidebar chrome lives here; audit must cover the layout shell too
- `apps/web/src/app/globals.css` is the authoritative token source — any deviation from the spec colors must be traced here first

</code_context>

<specifics>
## Specific Requirements

- **Researcher first action:** Before writing any UI-SPEC, enumerate ALL files in the Claude Design project `https://claude.ai/design/p/597c08f6-081b-4578-8c47-abd1ed09f772`. Confirm which file/section maps to each of the 4 surfaces. Document this mapping in the research output.
- **Mockup-first rule enforced:** If mockup and live code disagree, the MOCKUP is what the UI-SPEC should describe (the live code has the drift, not the design).
- **Deviation severity classification** in rework plans: `visual-only` (spacing, color tint, shadow) / `structural` (missing component, wrong layout) / `copy` (incorrect string literal).
- **No dark mode variants** — confirmed from Phase 24; any dark variants found in audit = structural deviation.
- **Accent `#FF5C1A` usage rule** — only reserved for: primary CTA bg, active sidebar stripe + label, wizard progress bar fill, KYC verified chip, logo wordmark. Any other accent usage = deviation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-ui-design-web-surfaces*
*Context gathered: 2026-05-20*

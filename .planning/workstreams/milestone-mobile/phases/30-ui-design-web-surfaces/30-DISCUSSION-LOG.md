# Phase 30: UI Design Catch-Up — Phase 24 Web Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 30-ui-design-web-surfaces
**Areas discussed:** Mockup strategy, UI-SPEC structure, Rework audit depth, Plan structure

---

## Mockup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 24 mockup as-is | The existing Ziko+Onboarding.html is canonical. Phase 30 just formalizes specs and audits against it — no new renders needed. | ✓ |
| Create new per-surface JSX files | Like Phase 28 (coach.jsx), generate 4 separate Claude Design files — one per surface. | |
| Extend the existing mockup | Add missing states to Ziko+Onboarding.html and treat the updated version as canonical. | |

**User's choice:** Reuse Phase 24 mockup as-is

---

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Design URL is sufficient | Same decision as Phase 28 — .jsx + Claude Design URL satisfies the Figma requirement. No Figma cloud push needed. | ✓ |
| Push to Figma cloud | Export each surface to a separate Figma frame. | |

**User's choice:** Claude Design URL is sufficient

**Follow-up clarification:** User pointed out the Claude Design project has ~20 pages (more than just Ziko+Onboarding.html). The researcher must enumerate ALL files in the project before mapping surfaces. User also shared a screenshot showing the local mobile prototype (`index.html`) Tweaks panel — confirmed this is the mobile prototype (~20 navigable screens), NOT the web surface reference. The Claude Design URL is authoritative for web surface layout.

---

## UI-SPEC Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Create 4 per-surface UI-SPECs in Phase 30 dir | 4 new files: 30-login-UI-SPEC.md, 30-onboarding-UI-SPEC.md, 30-dashboard-UI-SPEC.md, 30-settings-UI-SPEC.md. Satisfies UIDESIGN-01..04 cleanly. | ✓ |
| Update 24-UI-SPEC.md in place | Annotate the existing Phase 24 spec per surface. | |
| One new 30-UI-SPEC.md covering all 4 | Single Phase 30 file with per-surface deltas. | |

**User's choice:** Create 4 per-surface UI-SPECs in Phase 30 dir

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reference Phase 24 doc for system tokens | Each per-surface spec starts with @see 24-UI-SPEC.md for design system. Only surface-specific content goes in the spec. DRY. | ✓ |
| Fully self-contained per spec | Each surface spec duplicates shared tokens. | |

**User's choice:** Reference Phase 24 doc for system tokens

---

## Rework Audit Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Focused drift-from-mockup scan | Compare live surface against mockup section by section. Flag deviations. ~30min per surface. | |
| Full component-by-component review | Read every component file and cross-reference with the new UI-SPEC. Appropriate if Phase 25 refonte was incomplete. | ✓ |
| Code-only pass, no visual comparison | Check component structure against spec only. Fast but may miss styling drift. | |

**User's choice:** Full component-by-component review

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rework plan per surface with deviations | For each surface: a REWORK-PLAN.md listing deviations by severity with fix tasks. 'No action required' if clean. | ✓ |
| Single consolidated rework plan | One 30-REWORK-PLAN.md covering all 4 surfaces. | |
| Inline in UI-SPEC | Deviations noted directly in the spec with Current vs Spec comparison. | |

**User's choice:** Rework plan per surface with deviations

---

## Plan Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans: one per surface, spec + audit bundled | 30-01: login, 30-02: onboarding, 30-03: dashboard, 30-04: settings. Each plan writes UI-SPEC + runs audit + writes rework plan. | ✓ |
| 5 plans: 4 specs + 1 audit sweep | 30-01..04 write specs, 30-05 runs all 4 audits. Matches UIDESIGN-01..05 structure. | |
| 2 plans: spec batch + audit batch | 30-01 writes all 4 specs, 30-02 runs all 4 audits. | |

**User's choice:** 4 plans, one per surface, spec + audit bundled

---

| Option | Description | Selected |
|--------|-------------|----------|
| Login → Onboarding → Dashboard → Settings | User flow order: auth entry point first. | ✓ |
| Dashboard → Settings → Onboarding → Login | Most complex surfaces first — sets the pattern. | |
| Parallel (all at once via subagents) | All 4 plans dispatched in parallel. | |

**User's choice:** Login → Onboarding → Dashboard → Settings (user flow order)

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

None — discussion stayed within phase scope.

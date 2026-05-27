# Phase 40: Advanced Dashboard Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 40-Advanced Dashboard Features
**Areas discussed:** Dashboard foundation conflict, Unified page toggle design, Compare mode in widget view, PDF export approach, Phase dependency clarity

---

## Dashboard Foundation Conflict (pre-discussion discovery)

| Option | Description | Selected |
|--------|-------------|----------|
| Sport dashboards (Phase 38/39) | Restore sport-selector-driven page; compare + PDF on sport dashboards only | |
| Custom-widget system (v1.15) | Phase 40 features apply to the AI-customizable widget dashboard | |
| Both (unified page) | Sub-tab strip: Sport view + Personnalisé view coexist on same page | ✓ |

**User's choice:** Both (unified page)
**Notes:** Discovered during codebase scout that `dashboard/page.tsx` was overwritten by the custom-widget workstream Phase 02. Both systems need to coexist on the same route.

---

## Unified Page Toggle Design

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-tab strip | Secondary tab strip below ClientTabStrip: [Sport] [Personnalisé] | ✓ |
| Toggle button in header | Pill toggle in top-right | |
| Sport default + Customize button | Sport is default, custom-widget behind Customize | |

**Toggle mechanism:** Sub-tab strip
**Default tab:** Sport view
**Labels:** "Sport" / "Personnalisé"
**Position:** Top of dashboard content area, above DashboardControlBar

---

## Compare Mode in Widget View

| Option | Description | Selected |
|--------|-------------|----------|
| Sport view only | Compare button only in Sport tab; Personnalisé tab never shows it | ✓ |
| Both tabs get compare mode | Significantly more scope — each widget shows dual datasets | |

**User's choice:** Sport view only
**Notes:** Clean scope boundary — compare mode semantics are well-defined for sport dashboards (same sport, two clients or two periods). Compare mode on generic widgets is ambiguous and would add significant scope.

---

## PDF Export Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side: html2canvas + jsPDF | DOM capture to canvas → PDF. No serverless, zero auth complexity | ✓ |
| Server-side: @react-pdf/renderer | React components rendering to vector PDF. Requires duplicating all widget rendering | |
| Server-side: Puppeteer/Playwright | Headless browser, perfect fidelity. Vercel 10s timeout, cold starts, Chromium binary complexity | |

**User's choice:** Client-side html2canvas + jsPDF (overrides original D-12)
**Notes:** Original D-12 chose Puppeteer. Reconsidered in light of Vercel serverless constraints (10s timeout, 45MB Chromium binary). Client-side avoids all these issues.

**Export scope:** Active tab only (both Sport and Personnalisé tabs have Export button)
**Button placement:** Sport tab → DashboardControlBar right side; Personnalisé tab → top-right of dashboard header (next to existing Éditer button)

---

## Phase Dependency Clarity

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 40 waits: custom-widget Phase 01+02 must be verified first | Personnalisé tab integration gated on custom-widget backend | ✓ |
| Phase 40 independent: sport tab features only | No Personnalisé integration until custom-widget workstream stabilizes | |
| Phase 40 proceeds: assume custom-widget Phase 01 lands before execution | Coordinate workstreams, plan both together | |

**User's choice:** Phase 40 waits — custom-widget Phase 01+02 must be verified first
**Notes:** Custom-widget STATE shows Phase 02 complete but Phase 01 (DB + API) listed as "Not started" in ROADMAP. Backend routes may not exist. Personnalisé tab integration blocked until confirmed.

---

## Claude's Discretion

- Widget types excluded from compare mode (callout, athlete_list, threshold_indicator) — planner determines exact list and fallback (hide vs. placeholder)
- Loading/pending state for compare row before second dataset loads
- Whether sub-tab active state persists in localStorage or resets to Sport on page load
- Exact html2canvas configuration (scale, useCORS, elements to exclude from capture)

## Deferred Ideas

- Custom date picker for period comparison — too much scope for v1.8
- Export all sports in a single PDF — deferred
- Compare mode for Personnalisé tab — explicitly deferred; Sport only in Phase 40
- CSV/Excel export — out of scope per REQUIREMENTS.md

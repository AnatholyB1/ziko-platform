---
phase: 41-ai-context-injection
verified: 2026-05-29T14:00:00Z
status: resolved
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 12/12
  gaps_closed:
    - "ChartCard badge disconnected from crossedThresholds data pipeline — resolved in Phase 41.1"
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "When a threshold is crossed, ChartCard shows an orange or red pill badge in its title bar"
    status: resolved
    resolved_in: "Phase 41.1 — 2026-05-30"
    reason: "crossedThresholds is never passed through the page -> sport dashboard -> ChartCard data chain. The page only sends crossedThresholds to AlertesModal. No sport dashboard declares a crossedThresholds prop, so ChartCard.metricKey and ChartCard.crossedThresholds remain undefined at every chart card instance. The badge code exists in ChartCard.tsx but is permanently disabled by the missing prop threading."
    artifacts:
      - path: "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx"
        issue: "crossedThresholds={insights?.crossedThresholds} is only on AlertesModal (line 357), not on any of the five sport dashboard components"
      - path: "apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx"
        issue: "No crossedThresholds prop in interface; ChartCard rendered via CHART_CARDS map with only title + aiInsight — metricKey missing"
      - path: "apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx"
        issue: "No crossedThresholds prop; inline ChartCard calls include aiInsight but not metricKey or crossedThresholds"
      - path: "apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx"
        issue: "Same as Bodybuilding — aiInsight present, metricKey + crossedThresholds absent"
    missing:
      - "Add crossedThresholds?: ThresholdAlert[] prop to each sport dashboard interface (PowerliftingDashboard, HyroxDashboard, RunningDashboard, BodybuildingDashboard, WeightLossDashboard)"
      - "Pass crossedThresholds={insights?.crossedThresholds} from dashboard/page.tsx to each sport dashboard component alongside the existing chartInsights prop"
      - "In each dashboard, pass metricKey={card.chartKey} and crossedThresholds={crossedThresholds} to each ChartCard instance (CHART_CARDS map + inline calls)"
human_verification:
  - test: "Open coach dashboard, select a sport, configure a threshold in Alertes modal (e.g. RPE > 8.5), save it. Verify that after the gap fix, an orange or red pill badge appears in the ChartCard title bar when the client's data crosses the threshold."
    expected: "Badge appears inline in chart title bar showing metric_key, operator, and threshold_value"
    why_human: "Requires live data exceeding a threshold value and browser rendering to confirm visual badge display"
---

# Phase 41: AI Context Injection — Verification Report (Re-verification)

**Phase Goal:** AI context injection — coaches can chat with the AI from within any sport dashboard, with the active sport and top metrics automatically injected into the system prompt. Insight chips appear on each chart card, a narrative summary appears above the chart grid, and configurable threshold alerts fire when metrics cross limits.
**Verified:** 2026-05-29T14:00:00Z
**Status:** GAPS_FOUND
**Re-verification:** Yes — previous VERIFICATION.md (041-VERIFICATION.md) claimed status: passed, 12/12. This re-verification found 1 critical gap missed by the prior verifier.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Migration 063 creates coach_metric_thresholds table with RLS and partial index | VERIFIED | `063_coach_metric_thresholds.sql` — CREATE TABLE IF NOT EXISTS, CHECK operator IN (>, <), ENABLE ROW LEVEL SECURITY, policy scoped to auth.uid() = coach_id, partial index WHERE is_active = true |
| 2  | DashboardContext, ThresholdAlert, InsightsResponse, CoachMetricThreshold interfaces exported from types.ts | VERIFIED | `backend/api/src/coach/ai/types.ts` lines 36, 45, 55, 64 — all four exported |
| 3  | buildCoachSystemPrompt accepts optional DashboardContext and injects ## Dashboard Context section | VERIFIED | `service.ts` line 71: `function buildCoachSystemPrompt(ctx: CoachContext, dashboardCtx?: DashboardContext): string`; lines 88–93: conditional metricLines build + section push |
| 4  | POST /chat/stream parses dashboard_context from request body and passes it to buildCoachSystemPrompt | VERIFIED | `service.ts` line 454: destructures dashboard_context; line 457: typed as dashboard_context?: DashboardContext; line 492: buildCoachSystemPrompt(coachCtx, dashboard_context) |
| 5  | POST /coach/dashboards/:clientId/insights registered before GET /:clientId; returns chartInsights + narrative + crossedThresholds | VERIFIED | insights POST at line 108, GET /:clientId at line 259; returns `c.json({ ...parsed, crossedThresholds } satisfies InsightsResponse)` at line 172 |
| 6  | Threshold CRUD routes (GET/POST/DELETE /:clientId/thresholds) exist and registered before GET /:clientId | VERIFIED | GET line 180, POST line 207, DELETE line 237, GET /:clientId line 259; POST validates operator; DELETE scopes with coach_id + client_id |
| 7  | useInsights hook fires only when sport and chartData are both non-null | VERIFIED | `useInsights.ts` line 33: `enabled: !!sport && !!chartData`; queryKey: ['dashboard-insights', clientId, sport, dateRange]; POSTs to /api/coach/dashboards/${clientId}/insights |
| 8  | NarrativeSummaryCard renders null when sport is falsy; shows 2-line skeleton while loading; renders narrative paragraph | VERIFIED | line 10: `if (!sport) return null`; animate-pulse skeleton (two divs); max-w-prose paragraph; card anatomy bg-white rounded-2xl border border-border p-6 |
| 9  | DashboardChatDrawer sends dashboard_context from ref at call time; CSS slide (no GSAP); conversation_id persisted | VERIFIED | line 58: `dashboard_context: dashboardContextRef.current`; translate-x-full/translate-x-0; transition-transform duration-200 ease-out; bg-black/20 backdrop; no gsap import; conversationIdRef.current set from meta event |
| 10 | AlertesModal fetches thresholds on mount; allows add/delete; correct copy and accessibility | VERIFIED | useEffect fetch GET (line 49), DELETE (line 67), POST in saveNewForms (line 96); "Aucun seuil configuré", "+ Ajouter un seuil", "Enregistrer les seuils", aria-label="Supprimer ce seuil"; bg-black/40 backdrop; aria-modal="true" |
| 11 | All 5 sport dashboards call onDataReady with compact scalar summary; DashboardControlBar has Alertes + Demander à l'IA buttons; dashboard page fully wired | VERIFIED | All 5 dashboards: onDataReady prop, chartInsights prop, useEffect([data, onDataReady]) calling onDataReady(summary). DashboardControlBar: Bell + MessageCircle imported, onOpenAlerts/onOpenChat optional props, "Alertes" ghost + "Demander à l'IA" primary (bg-[#FF5C1A]). Page: isChatOpen, isAlertesOpen, chartSummary, dashboardContextRef, useInsights call, NarrativeSummaryCard above chart grid, DashboardChatDrawer + AlertesModal mounted |
| 12 | When a threshold is crossed, ChartCard shows an orange or red pill badge in its title bar | FAILED | ChartCard.tsx has the badge code (bg-[#FFF7ED] + bg-red-50 + rounded-full, conditional on metricKey + crossedThresholds props). BUT crossedThresholds is never passed through the chain: page.tsx sends it only to AlertesModal (line 357), not to any sport dashboard. No sport dashboard has a crossedThresholds prop. No ChartCard instance in any dashboard receives metricKey or crossedThresholds. The badge is permanently disabled by the missing prop threading. |

**Score:** 11/12 truths verified

### Deferred Items

None.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/063_coach_metric_thresholds.sql` | Table + RLS + partial index | VERIFIED | All columns present, operator CHECK constraint, policy auth.uid() = coach_id, partial index WHERE is_active=true |
| `backend/api/src/coach/ai/types.ts` | 4 new interfaces | VERIFIED | DashboardContext, ThresholdAlert, InsightsResponse, CoachMetricThreshold all exported |
| `backend/api/src/coach/ai/service.ts` | Extended buildCoachSystemPrompt + /chat/stream parsing | VERIFIED | Optional DashboardContext param; ## Dashboard Context injection; dashboard_context in req.json type + call site |
| `backend/api/src/coach/dashboards/service.ts` | 5 new routes before GET /:clientId | VERIFIED | Insights POST line 108, thresholds GET/POST/DELETE at 180/207/237; GET /:clientId at 259 |
| `apps/web/src/hooks/useInsights.ts` | TanStack Query hook with dual-guard enabled | VERIFIED | enabled: !!sport && !!chartData; staleTime 120_000; POST body { sport, period, chartData } |
| `apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx` | Narrative card with skeleton | VERIFIED | null guard, 2-line animate-pulse, max-w-prose, ChartCard anatomy |
| `apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx` | SSE drawer with context ref | VERIFIED | dashboardContextRef.current read at call time; CSS slide; no GSAP; conversation_id ref |
| `apps/web/src/components/coach/dashboard/AlertesModal.tsx` | Threshold CRUD modal | VERIFIED | useEffect GET, DELETE handler, POST saveNewForms; empty state copy; accessibility; bg-black/40 |
| `apps/web/src/components/coach/dashboard/ChartCard.tsx` | Extended with threshold badge | PARTIAL | Badge code exists (crossedThresholds prop, metricKey prop, orange/red pill variants) but the props are never received — all callers pass only title + aiInsight |
| `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` | Alertes + Demander à l'IA buttons | VERIFIED | Bell + MessageCircle; onOpenAlerts/onOpenChat optional callbacks; button order Alertes then Demander à l'IA then Export PDF |
| All 5 sport dashboards | onDataReady + chartInsights + useEffect | VERIFIED | All 5 have both props + useEffect calling onDataReady(summary) when data loads |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` | Full wiring | PARTIAL | All AI-01/AI-02/AI-03 wiring present. AI-04 badge wiring incomplete: page passes crossedThresholds only to AlertesModal, not to sport dashboards |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| service.ts buildCoachSystemPrompt | DashboardContext | import type from types.ts | WIRED | service.ts:71 uses DashboardContext in signature |
| POST /chat/stream handler | buildCoachSystemPrompt | passes dashboard_context as 2nd arg | WIRED | service.ts:492 |
| POST /:clientId/insights | coach_metric_thresholds table | db.from('coach_metric_thresholds').select('*') | WIRED | dashboards/service.ts lines 127–133 |
| useInsights queryFn | POST /api/coach/dashboards/:clientId/insights | fetch with { sport, period, chartData } | WIRED | useInsights.ts:25–29 |
| DashboardChatDrawer streamChat | POST /api/coach/ai/chat/stream | dashboard_context: dashboardContextRef.current | WIRED | DashboardChatDrawer.tsx:58 |
| AlertesModal | GET/POST/DELETE /api/coach/dashboards/:clientId/thresholds | useEffect + handlers | WIRED | AlertesModal.tsx:49, 67, 96 |
| dashboard/page.tsx insights.crossedThresholds | AlertesModal.crossedThresholds | crossedThresholds={insights?.crossedThresholds} | WIRED | page.tsx:357 — orange dots in threshold list work |
| dashboard/page.tsx insights.crossedThresholds | ChartCard badge (via sport dashboards) | NOT WIRED | NOT_WIRED | page.tsx does not pass crossedThresholds to any sport dashboard. No sport dashboard has crossedThresholds prop. ChartCard receives no crossedThresholds or metricKey from any call site in the 5 dashboards. |
| dashboard/page.tsx | NarrativeSummaryCard | narrative={insights?.narrative} | WIRED | page.tsx:199 |
| dashboard/page.tsx | Sport dashboards | chartInsights={insights?.chartInsights} ×5 | WIRED | page.tsx:212,224,236,248,260 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| NarrativeSummaryCard | narrative | insights.narrative from useInsights → POST /api/coach/dashboards/:clientId/insights → generateText | Yes — generateText with real chartData | FLOWING |
| ChartCard (aiInsight chip) | aiInsight | insights.chartInsights[chartKey] → useInsights → same insights endpoint | Yes — same generateText call | FLOWING |
| ChartCard (alert badge) | crossedThresholds, metricKey | insights.crossedThresholds → page.tsx → sport dashboard → ChartCard | NO — crossedThresholds never reaches ChartCard | DISCONNECTED |
| AlertesModal (orange dots) | crossedThresholds | insights.crossedThresholds → page.tsx → AlertesModal | Yes — page.tsx:357 passes it directly | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires running Next.js dev server; cannot test without starting services.

---

## Probe Execution

Step 7c: No probes defined for this phase.

---

## Requirements Coverage

| REQ-ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| AI-01 | Active sport + key metrics injected into coach chat system prompt | SATISFIED | buildCoachSystemPrompt(coachCtx, dashboard_context); DashboardChatDrawer sends dashboardContextRef.current; all 5 dashboards write to dashboardContextRef via handleDataReady |
| AI-02 | Dashboard displays AI-generated insight chips on each chart | SATISFIED | useInsights returns chartInsights; all 5 sport dashboards thread chartInsights?.[chartKey] as aiInsight to ChartCard; not placeholder text |
| AI-03 | Dashboard shows one-paragraph AI narrative summary card | SATISFIED | NarrativeSummaryCard with narrative={insights?.narrative} above chart grid; skeleton while insightsLoading |
| AI-04 | Coach can set numeric alert thresholds; AI flags when client crosses threshold | PARTIALLY SATISFIED | Migration 063 + threshold CRUD + inline evaluation + AlertesModal CRUD UI are all present. The badge visual on ChartCard is broken — crossedThresholds never reaches ChartCard instances. Threshold crossing is detectable in AlertesModal (orange dots) but not on chart cards. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TBD/FIXME/XXX found in modified files |

No unreferenced debt markers. No hardcoded empty data in rendering paths.

---

## Human Verification Required

### 1. ChartCard Badge After Gap Fix

**Test:** After the gap is closed (crossedThresholds threaded from page → sport dashboards → ChartCard), open a sport dashboard, configure a threshold for a metric that the client's data exceeds, and confirm the orange or red pill badge appears inline in the ChartCard title bar.
**Expected:** Badge displays metric_key + operator + threshold_value as a pill; orange (#FFF7ED / #FF5C1A) for delta ≤ 20%, red (#FEF2F2 / red-500) for delta > 20%.
**Why human:** Requires live Supabase data, a configured threshold, and browser rendering — cannot be verified by static grep.

---

## Gaps Summary

**1 gap blocking AI-04 visual alerting (ChartCard badge — chart title bar pill):**

The `ChartCard` badge feature was built correctly in isolation (`ChartCard.tsx` has `crossedThresholds` and `metricKey` props with orange/red pill rendering). However, the prop-threading chain was never completed:

- `dashboard/page.tsx` sends `insights?.crossedThresholds` only to `AlertesModal`, not to sport dashboards.
- None of the 5 sport dashboards declare a `crossedThresholds` prop.
- No `ChartCard` call site in any dashboard passes `metricKey` or `crossedThresholds`.

Result: The badge condition `metricKey && crossedThresholds?.length` is always falsy at every ChartCard instance. Coaches cannot see which charts are in alert state without opening the AlertesModal.

**Root cause:** Plan 05 Task 2 wired `chartInsights` threading correctly but did not add `crossedThresholds` threading alongside it. Plan 05 Task 3 (page wiring) passed `crossedThresholds` only to `AlertesModal`, not to the sport dashboard layer.

**Fix scope:** 3-file change — add `crossedThresholds?: ThresholdAlert[]` to each sport dashboard's props interface, pass it from page.tsx to each sport dashboard (alongside existing `chartInsights`), and thread `metricKey={card.chartKey}` + `crossedThresholds={crossedThresholds}` to each `ChartCard` in each dashboard. Low risk — all props are optional, no existing behavior changes.

**Note on the previous VERIFICATION.md (041-VERIFICATION.md):** The prior verifier incorrectly reported truth #12 as VERIFIED. The evidence cited ("ChartCard: crossedThresholds + metricKey optional props") verified only the component definition, not the data-flow wiring. The verifier did not trace whether `crossedThresholds` ever reaches a ChartCard at runtime — a Level 4 data-flow check that reveals the disconnection.

---

_Verified: 2026-05-29T14:00:00Z_
_Verifier: Claude (gsd-verifier)_

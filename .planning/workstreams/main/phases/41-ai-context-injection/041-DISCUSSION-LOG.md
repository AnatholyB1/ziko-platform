# Phase 41: AI Context Injection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 41-AI Context Injection
**Areas discussed:** AI-01 Context Bridge, AI-02/03 Insight Generation, AI-04 Alert Thresholds

---

## AI-01: Context Bridge

### Where does the coach send AI messages when viewing a dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Chat panel on dashboard page | Slide-in drawer, dashboard stays visible, no navigation | ✓ |
| Navigate to /coach/ai with context | Query params or localStorage sync, navigate away | |
| Existing /coach/ai with Zustand context | Global store read by chat page | |

**User's choice:** Chat panel on dashboard page

---

### Where does the chat panel appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-in right drawer | Partial overlay, charts remain visible, mirrors EditChatPanel pattern | ✓ |
| Fixed bottom panel | Vertical space cost, always accessible | |
| Floating bubble → modal | Hides dashboard on open | |

**User's choice:** Slide-in right drawer

---

### How does the coach open the chat panel?

| Option | Description | Selected |
|--------|-------------|----------|
| "Demander à l'IA" in DashboardControlBar | Button alongside PDF export, extends Phase 40 ControlBar pattern | ✓ |
| Dedicated "Chat IA" sub-tab | Replaces chart area while chatting | |
| Persistent chat icon in page header | Available on all client tabs, not dashboard-specific | |

**User's choice:** "Demander à l'IA" in DashboardControlBar

---

### What gets injected into the system prompt?

| Option | Description | Selected |
|--------|-------------|----------|
| Active sport + top-3 latest metric values | Concise, fits token budget, covers coach-relevant data | ✓ |
| Full chart dataset for active period | Complete but large token cost | |
| Sport type + narrative summary only | Minimal tokens but loses raw metric values | |

**User's choice:** Active sport + top-3 latest metric values

---

## AI-02/03: Insight Generation

### How should insights and narrative be generated?

| Option | Description | Selected |
|--------|-------------|----------|
| One batch API call for all insights | Single POST /insights, returns chartInsights + narrative | ✓ |
| Separate call per chart + one for narrative | 4-6 concurrent AI calls, expensive and uncoordinated | |
| Reuse coach AI chat endpoint | Conflates chat history with insight generation | |

**User's choice:** One batch API call (new POST /coach/dashboards/:clientId/insights endpoint)

---

### When should insights be generated?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on sport selection + date filter change | Feels integrated, no manual trigger | ✓ |
| On-demand "Générer l'analyse" button | Cheaper but adds friction | |
| Auto on sport selection only (not date filter) | Reduces calls but insights stale vs visible range | |

**User's choice:** Auto on sport selection + date filter change

---

### Where does the narrative summary card appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of Sport tab, above chart grid | Most prominent, sets context before charts | ✓ |
| Below ControlBar, above charts | Same effect, slightly more tucked | |
| Bottom of dashboard, after all charts | Acts as conclusion, not intro | |

**User's choice:** Top of Sport tab, above the 2×2 chart grid

---

## AI-04: Alert Thresholds

### Where does the coach configure threshold alerts?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal panel on dashboard page | "Alertes" button opens modal, in-context config | ✓ |
| Dedicated /coach/clients/[id]/alerts page | Separate navigation, breaks coaching flow | |
| Inline per-chart card menu | Scattered UX across 4 cards | |

**User's choice:** Modal panel on dashboard page

---

### How should thresholds be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| New coach_metric_thresholds table | Clean config/event separation, standard migration | ✓ |
| Extend coach_alerts with thresholds JSONB | Less migration work, blurs config/event boundary | |
| JSONB column on coach_client_links | Zero new table, couples link config and alert config | |

**User's choice:** New coach_metric_thresholds table

---

### When should threshold crossing be detected?

| Option | Description | Selected |
|--------|-------------|----------|
| On dashboard load + visual badge only | Evaluated via insights call, no cron, no push | ✓ |
| Cron + push notification | More powerful, adds backend complexity and notification fatigue | |
| Real-time via Supabase subscription | Fastest, most complex (DB triggers + Realtime) | |

**User's choice:** On dashboard load + visual badge only

---

## Claude's Discretion

- Exact Hono route mounting for `/coach/dashboards/:clientId/insights`
- Prompt engineering for the insights batch call
- Whether threshold evaluation lives inside the insights endpoint or a separate call
- Drawer animation style (GSAP vs CSS transition)

## Deferred Ideas

- Push/email notifications when a threshold is crossed — future phase
- Cron-based threshold evaluation (daily sweep) — on-load is sufficient for v1.8
- Threshold alerts for the Personnalisé tab — Sport tab only in Phase 41
- Streaming insight generation — `generateText` is sufficient for one-liners

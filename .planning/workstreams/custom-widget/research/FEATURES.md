# Feature Landscape: Custom Widget Dashboard for Coach CRM

**Domain:** Per-athlete dashboard builder with chat-driven configuration
**Researched:** 2026-05-25
**Scope:** 7 fixed widget types, 1 dashboard per athlete, chat → Claude tool calling → live preview → save

---

## Table Stakes

Features users expect in any dashboard builder. Missing = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Named widgets with visible title | Coaches scan by label, not shape | Low | Every widget must show its title in header |
| Metric selection per widget | Widgets are meaningless without knowing what they show | Low | Must be set at creation time |
| Persist saved state | Dashboard must survive page refresh / logout | Low | Supabase row per athlete dashboard config |
| Empty state guidance | First-time use is confusing without scaffolding | Low | "Ask me to add a widget" placeholder |
| Visual feedback during edit | Split-screen must show widget appear in real time as Claude responds | Medium | Core to the WOW criterion |
| Layout that works on desktop CRM | Coach uses web, not mobile | Low | Fixed grid, no pixel-perfect drag needed |
| Delete a widget | Mistakes happen; no dead-end state | Low | Single action, immediate effect |
| At least 1 chart type (line or bar) | Coaches expect time-series trend lines | Medium | Most expected visualization in coaching |
| At least 1 KPI tile | Coaches expect a "number at a glance" metric | Low | Simplest widget, highest use frequency |
| Threshold / alert coloring | Coaches need to see when values cross a boundary | Medium | Red/amber/green is a universal coaching signal |

---

## Differentiators

Features that set this implementation apart. Not expected, but produce the WOW reaction.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Chat → live widget preview in <5s | Fulfills the 30-second criterion; no form filling | High | Requires Claude tool schema for each widget type |
| Contextual widget suggestions from Claude | "For sleep tracking, I recommend a threshold indicator for HRV" | Medium | Claude reads athlete's installed plugins before suggesting |
| Coach-language labels ("Recovery this week") not data-key labels | Dashboard reads like a coaching report, not a database query | Low | Widget `title` field is free text, separate from `dataKey` |
| Comparison line on charts | Show target vs. actual visually without separate widget | Medium | Second series with dashed style |
| Callout widget for coach notes | Static text anchors the dashboard as a narrative, not just charts | Low | Unique to coaching context; Grafana/PowerBI don't do this |
| Athlete list widget sorted by threshold breach | Shows at-a-glance who needs attention across team | Medium | Threshold-driven sort, not alphabetical |
| Save confirmation with widget count summary | "Dashboard saved — 4 widgets" closes the loop on the 30s flow | Low | Micro-copy only |
| Dashboard resets to full-screen after save | Split-screen is an editing mode, not a permanent layout | Low | UX state machine: edit mode → view mode |
| One-sentence widget description visible on hover | Reduces cognitive load; coach knows what they're looking at | Low | `description` field in widget config |

---

## Anti-Features

Features that would kill the 30-second criterion or add unjustified complexity.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Drag-and-drop grid editor | Adds 10+ minutes of interaction; conflicts with chat-driven flow | Chat → auto-layout; widgets appear in insertion order |
| Free-form widget extensibility (plugin API) | Infinite widget types → unbounded QA surface; the closed set is a feature | Keep 7 widget types; add new ones per milestone if needed |
| Per-widget data source selection (multiple DBs) | Coach CRM has one data model; multi-source adds zero value now | Single implicit source: the athlete's Ziko data |
| Color picker UI | Breaks the 30s criterion; color should be inferred from metric type | Use a fixed palette of 6 semantic colors; coach can say "blue" in chat |
| Widget resize handles | Removes predictability; coaches want consistent readable layouts | Fixed aspect ratios per widget type in a 2-column grid |
| Undo/redo stack | Over-engineered for a save-explicit flow | Unsaved changes are implicit; Claude can re-add deleted widgets |
| Dashboard versioning / history | No use case for "restore last week's dashboard" in a coaching CRM | Single mutable config per athlete per coach |
| Widget-level refresh rate configuration | Athlete data isn't real-time (it's logged sessions); false complexity | Dashboard refreshes on page load, not configurable |
| Import/export JSON | Power-user feature with zero coaching value at this stage | Not in scope |
| Permission levels per widget | Every coach owns their view; athlete doesn't see the dashboard | Single coach-owned dashboard per athlete, full access |

---

## Widget Config Fields

Each widget persists as a JSON config object in the athlete's dashboard record. Fields below are the schema per type. All widgets share a common base; type-specific fields are additive.

### Common Base Fields (all widget types)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (uuid) | Yes | Stable identifier for the widget instance |
| `type` | enum | Yes | One of: `line_chart`, `bar_chart`, `kpi_tile`, `table`, `athlete_list`, `threshold_indicator`, `callout` |
| `title` | string | Yes | Coach-written label, free text (e.g. "Sleep quality this month") |
| `description` | string | No | One-sentence explanation shown on hover |
| `order` | integer | Yes | Display position in the 2-column grid |
| `dataPlugin` | string | No | Plugin source: `sleep`, `cardio`, `habits`, `nutrition`, `measurements`, `hydration`, `journal`, `wearables` |

---

### `line_chart` — Time-series trend visualization

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataKey` | string | Yes | Metric identifier (e.g. `sleep.duration_hours`, `cardio.distance_km`) |
| `period` | enum | Yes | `7d`, `30d`, `90d` — look-back window |
| `color` | string | Yes | Hex or semantic color token (`primary`, `success`, `warning`, `danger`, `neutral`, `accent`) |
| `showTarget` | boolean | No | Overlay a horizontal dashed target line |
| `targetValue` | number | No | Target value for the dashed line (requires `showTarget: true`) |
| `smoothing` | boolean | No | Apply curve smoothing (default: false) |
| `yAxisLabel` | string | No | Unit label for Y axis (e.g. "hours", "km") |

---

### `bar_chart` — Period comparison (week-by-week, session-by-session)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataKey` | string | Yes | Metric identifier |
| `groupBy` | enum | Yes | `day`, `week`, `month` — aggregation bucket |
| `period` | enum | Yes | `7d`, `30d`, `90d` |
| `color` | string | Yes | Bar fill color (semantic or hex) |
| `aggregation` | enum | Yes | `sum`, `avg`, `max`, `min` |
| `yAxisLabel` | string | No | Unit label |

---

### `kpi_tile` — Single metric at a glance

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataKey` | string | Yes | Metric identifier |
| `period` | enum | Yes | `today`, `7d`, `30d` — time window for the value |
| `aggregation` | enum | Yes | `sum`, `avg`, `last`, `max`, `min` |
| `unit` | string | No | Display unit appended to value (e.g. "kg", "h", "kcal") |
| `comparisonPeriod` | enum | No | `previous_period` — show delta % vs prior window |
| `thresholdWarning` | number | No | Value above (or below) which tile turns amber |
| `thresholdCritical` | number | No | Value above (or below) which tile turns red |
| `thresholdDirection` | enum | No | `above` or `below` — which direction triggers alert |
| `color` | string | No | Tile accent color when within normal range |

---

### `table` — Tabular data with rows and columns

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataPlugin` | string | Yes | Source plugin for rows |
| `columns` | string[] | Yes | Ordered list of column keys to display (e.g. `["date", "duration_hours", "quality"]`) |
| `columnLabels` | Record<string, string> | No | Human-readable overrides for column names |
| `sortBy` | string | No | Column key for default sort |
| `sortOrder` | enum | No | `asc`, `desc` |
| `limit` | integer | No | Max rows shown (default: 10) |
| `period` | enum | No | `7d`, `30d`, `90d` — filter rows to time window |

---

### `athlete_list` — Multi-athlete overview sorted by metric

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataKey` | string | Yes | Metric to rank athletes by |
| `period` | enum | Yes | `today`, `7d`, `30d` |
| `aggregation` | enum | Yes | `sum`, `avg`, `last` |
| `sortOrder` | enum | Yes | `asc`, `desc` |
| `limit` | integer | No | Max athletes shown (default: 10) |
| `thresholdWarning` | number | No | Row turns amber at this value |
| `thresholdCritical` | number | No | Row turns red at this value |
| `thresholdDirection` | enum | No | `above` or `below` |
| `showValue` | boolean | No | Show metric value inline (default: true) |

**Note:** This widget operates at the coach level (across athletes), not per-athlete. On a per-athlete dashboard it shows the athlete's rank within their group/team.

---

### `threshold_indicator` — Status gauge for a single metric vs. a target

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataKey` | string | Yes | Metric to evaluate |
| `period` | enum | Yes | `today`, `7d`, `30d` |
| `aggregation` | enum | Yes | `avg`, `last`, `sum` |
| `targetValue` | number | Yes | The goal value |
| `unit` | string | No | Display unit |
| `thresholdWarning` | number | Yes | Value triggering amber state |
| `thresholdCritical` | number | Yes | Value triggering red state |
| `thresholdDirection` | enum | Yes | `above` or `below` (e.g. sleep < 6h is critical) |
| `style` | enum | No | `gauge`, `progress_bar`, `badge` — visual style (default: `gauge`) |
| `goodColor` | string | No | Color when within target (default: `success`) |
| `warningColor` | string | No | Color at warning threshold (default: `warning`) |
| `criticalColor` | string | No | Color at critical threshold (default: `danger`) |

---

### `callout` — Static coach annotation (text block)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Markdown-supported text content |
| `style` | enum | No | `info`, `warning`, `success`, `neutral` — sets background tint |
| `icon` | string | No | Ionicons name shown left of content (e.g. `"bulb-outline"`) |

---

## UX Patterns for Chat-Driven Dashboard Editing

### Core Interaction Model

The WOW criterion (30-second customization) is achieved by treating the chat as the primary control surface, not a secondary option. The split-screen is active only during editing; it collapses on save.

```
Coach types: "Add a line chart for sleep duration over the last 30 days"
                         ↓
Claude calls tool: add_widget({ type: "line_chart", dataKey: "sleep.duration_hours", period: "30d", ... })
                         ↓
Right panel renders the new widget immediately (optimistic insert)
                         ↓
Coach sees: "Done — I added a Sleep Duration line chart. Want me to add a threshold indicator?"
                         ↓
Coach types: "Yes, warn me when it drops below 6 hours"
                         ↓
Claude calls tool: add_widget({ type: "threshold_indicator", thresholdCritical: 6, thresholdDirection: "below", ... })
                         ↓
Coach clicks Save → split collapses → full-screen dashboard
```

### Pattern 1: Optimistic Preview

Render the widget in the preview panel as soon as Claude's tool call arrives, before the coach confirms. This gives instant visual feedback. Only commit to Supabase on explicit "Save" action.

### Pattern 2: Claude as Layout Advisor

Claude should not ask "where should I put this?" — it should place widgets in insertion order and offer to reorder only when explicitly asked. Coaches should never be asked to manage positions via chat.

### Pattern 3: Semantic Color Resolution

When the coach says "make it green" or "use the brand color," Claude maps natural language to the 6-token palette. Never require a hex code in chat. The color palette:
- `primary` → #FF5C1A (Ziko orange)
- `success` → green (good performance)
- `warning` → amber (approaching threshold)
- `danger` → red (threshold breached)
- `neutral` → gray
- `accent` → blue (secondary series, comparison line)

### Pattern 4: Progressive Disclosure for Widget Details

Show widget title and value in the grid. Show full config (period, aggregation, thresholds) only on hover or in an edit drawer opened via a settings icon. Never show raw JSON to the coach.

### Pattern 5: Edit Mode State Machine

```
View mode (full-screen)
  → Coach clicks "Edit dashboard" button
  → Edit mode (split-screen: chat left, preview right)
  → Coach converses with Claude, widgets appear in preview
  → Coach clicks "Save"
  → Optimistic save animation
  → View mode (full-screen, updated)
```

Cancelling edit mode discards unsaved changes (no warning prompt needed — changes are reversible by re-opening edit mode and asking Claude to restore).

### Pattern 6: Contextual Suggestions from Claude

Before the coach has added any widget, Claude reads the athlete's installed plugins and surfaces suggestions:

> "This athlete uses the sleep, cardio, and habits plugins. I can add a sleep quality gauge, a weekly cardio bar chart, and a habits streak table. Want me to set those up?"

This eliminates the cold-start problem (empty dashboard paralysis) and enables the 30-second criterion from zero.

### Pattern 7: Threshold Direction Clarity

For threshold indicators and KPI tiles, Claude must explicitly ask or infer threshold direction from context. "Below 6h sleep is bad" → `thresholdDirection: "below"`. Claude should state its interpretation back to the coach before committing: "Got it — I'll flag it red when sleep drops below 6 hours."

### Pattern 8: F-Pattern Layout Respect

Per UX research on dashboard scanning, critical KPI tiles and threshold indicators belong in the top row (highest visibility). Claude should default to placing KPI tiles and threshold indicators before line/bar charts when auto-ordering. Coaches can override via "move the chart to the top."

### Pattern 9: Empty Widget Descriptions

Widgets without a `description` field should show a tooltip placeholder: "Click edit to add a note." This avoids naked widgets that confuse coaches returning after weeks.

### Pattern 10: One Confirmation Before Clearing

If the coach says "remove all widgets" or "start over," Claude should confirm once: "That will remove 4 widgets. Confirm?" before calling a batch-delete tool. All other widget operations (add, modify) execute immediately without confirmation.

---

## Data Keys Reference

Mapping between widget `dataKey` values and their source plugins. Claude uses this to validate and suggest correct keys during chat.

| dataKey | Plugin | Description | Typical Unit |
|---------|--------|-------------|-------------|
| `sleep.duration_hours` | sleep | Nightly sleep duration | hours |
| `sleep.quality` | sleep | Sleep quality rating | 1–5 |
| `sleep.recovery_score` | sleep | Composite recovery score | 0–100 |
| `cardio.distance_km` | cardio | Session distance | km |
| `cardio.duration_min` | cardio | Session duration | minutes |
| `cardio.pace_min_km` | cardio | Average pace | min/km |
| `cardio.heart_rate_avg` | cardio | Average heart rate | bpm |
| `nutrition.calories` | nutrition | Daily caloric intake | kcal |
| `nutrition.protein_g` | nutrition | Daily protein | g |
| `nutrition.carbs_g` | nutrition | Daily carbohydrates | g |
| `nutrition.fat_g` | nutrition | Daily fat | g |
| `habits.streak` | habits | Current habit streak | days |
| `habits.completion_rate` | habits | % habits completed today | % |
| `hydration.total_ml` | hydration | Daily water intake | ml |
| `measurements.weight_kg` | measurements | Body weight | kg |
| `measurements.body_fat_pct` | measurements | Body fat percentage | % |
| `journal.mood` | journal | Mood rating | 1–5 |
| `journal.energy` | journal | Energy rating | 1–5 |
| `journal.stress` | journal | Stress rating | 1–5 |
| `wearables.steps` | wearables | Daily step count | steps |
| `wearables.heart_rate_avg` | wearables | Resting heart rate | bpm |

---

## Sources

- [SaaS Dashboard UX Patterns 2026 — GitNexa](https://www.gitnexa.com/blogs/saas-dashboard-ux-patterns)
- [Athlete Dashboards — Output Sports](https://www.outputsports.com/blog/introducing-athlete-dashboards-a-game-changer-for-strength-coaches-physio-practitioners)
- [UX Pattern Analysis: Data Dashboards — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Generate Dashboards from Natural Language — Amazon QuickSight](https://aws.amazon.com/blogs/machine-learning/generate-dashboards-from-natural-language-prompts-in-amazon-quick/)
- [Dashboard Creation from Natural Language — SigNoz](https://signoz.io/docs/ai/use-cases/dashboard-creation-natural-language/)
- [KPI Widgets — Power BI / Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-kpi)
- [Configure KPI Widgets — SolarWinds](https://documentation.solarwinds.com/en/success_center/orionplatform/content/core-fusion-kpi-widgets.htm)
- [Dashboard Design Trends 2026 — FuseLabCreative](https://fuselabcreative.com/top-dashboard-design-trends-2025/)
- [Athlete Management System Research — Vitruve](https://vitruve.fit/blog/athlete-dashboards-for-coaches-track-compare-and-optimize-performance/)
- [Dashboard Design Guide — Improvado](https://improvado.io/blog/dashboard-design-guide)
- [CoachMePlus Athlete Dashboard](https://coachmeplus.com/features/athlete-dashboard/)
- [Grafana Dashboard JSON Model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/)

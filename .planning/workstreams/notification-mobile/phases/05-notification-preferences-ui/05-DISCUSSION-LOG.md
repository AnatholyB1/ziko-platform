# Phase 5: Notification Preferences UI — Discussion Log

**Date:** 2026-05-28
**Duration:** ~10 questions
**Outcome:** All 4 gray areas resolved, CONTEXT.md written

---

## Areas Discussed

### 1. Component Architecture

| Question | Options | Decision |
|----------|---------|----------|
| Where should new implementation live? | In-place in settings.tsx / Separate file | **In-place** — matches AppearanceSubScreen/IntegrationsSubScreen pattern |
| What to do with 9 old toggles? | Clean replace (5 categories) / Keep old + add new | **Clean replace** — old toggles don't map to notification_preferences |
| French UI labels? | Match REQUIREMENTS.md / Use DB column names | **Match REQUIREMENTS.md** — Coach, Workout, Gamification, Santé & Habitudes, App |
| Master switch OFF state? | Disabled/grayed (visible) / Hidden | **Disabled/grayed** — visible but non-interactive, iOS Settings pattern |

### 2. Quiet Hours UI

| Question | Options | Decision |
|----------|---------|----------|
| How to pick start/end hour? | InlinePicker / Stepper buttons / DateTimePicker | **InlinePicker** — reuses existing component, zero new primitives |
| When to show quiet hours section? | Only when push enabled / Always visible | **Only when push_enabled = ON** — reduce cognitive load |

### 3. Timezone Auto-detect

| Question | Options | Decision |
|----------|---------|----------|
| How to capture timezone_offset? | Auto-detect silently / Show timezone picker | **Auto-detect silently** — Math.round(-new Date().getTimezoneOffset() / 60) |

### 4. Row Initialization

| Question | Options | Decision |
|----------|---------|----------|
| No row exists on first load? | UPSERT defaults on load / Lazy create on first toggle | **UPSERT on load** (ignoreDuplicates: true) — guarantees row before toggles |
| Auto-save debounce? | 600ms debounce / Immediate save | **600ms debounce** — matches existing settings pattern |

---

## Deferred Ideas

None.

---

## Claude's Discretion

- Exact `STRow` icon/tint values for each category — planner to pick appropriate Ionicons glyphs and tints matching the sport theme
- Loading state display during initial prefs fetch — ActivityIndicator pattern from existing code is fine

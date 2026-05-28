# Phase 5: Notification Preferences UI - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing `NotifSubScreen` in `apps/mobile/app/(app)/profile/settings.tsx` with a correct implementation that reads/writes from the `notification_preferences` table (not `user_profiles.settings.notif_prefs`). Deliver: master switch, 5 per-category toggles, quiet hours picker, OS Settings escape hatch — all auto-saved to Supabase.

**In scope:** master switch (`push_enabled`), 5 category toggles (Coach / Workout / Gamification / Santé & Habitudes / App), quiet hours UI (start + end hour via InlinePicker), auto-save with 600ms debounce, UPSERT defaults on first load, timezone auto-detect, OS Settings CTA when permission denied.

**Not in scope:** local reminders scheduling (Phase 6), weekly digest toggle (already in cron Phase 4 via `type_prefs`), sound/haptics/social/marketing toggles (removed — out of scope for push preferences), new Expo Router screen file (stays in settings.tsx).

</domain>

<decisions>
## Implementation Decisions

### Component Architecture
- **D-01:** Rewrite `NotifSubScreen` **in-place** inside `apps/mobile/app/(app)/profile/settings.tsx`. Same file, same sub-view pattern as `AppearanceSubScreen` and `IntegrationsSubScreen`. No new file created.
- **D-02:** Remove all 9 old toggles (`sessionsReminder`, `hydration`, `streakAlert`, `coach`, `achievements`, `social`, `marketing`, `sound`, `haptics`). Replace with exactly 5 category toggles + master switch as specified in PREF-02. Old toggles don't map to any `notification_preferences` column and are out of scope.
- **D-03:** UI labels per REQUIREMENTS.md PREF-02: **Coach, Workout, Gamification, Santé & Habitudes, App**. Planner maps to DB columns: `coach_enabled`, `workout_enabled`, `gamification_enabled`, `health_enabled`, `system_enabled`.
- **D-04:** Master switch OFF state: the 5 category toggle rows remain **visible but disabled** (reduced opacity, non-interactive). Quiet hours section **hidden** when `push_enabled = false`. Category toggles still visually present so user can see their config.

### Quiet Hours UI
- **D-05:** Reuse the existing `InlinePicker` component (already defined in `settings.tsx`) for both start and end hour selection. 24 options formatted as `"0h00"` through `"23h00"`. Two separate picker invocations — one for start, one for end.
- **D-06:** Quiet hours section is only rendered when `push_enabled = true`. When master switch is OFF, hide the entire quiet hours group.

### Timezone
- **D-07:** Timezone offset is **auto-detected silently** from the device: `Math.round(-new Date().getTimezoneOffset() / 60)`. Always included in every UPSERT/update — invisible to user. No UI row.

### Row Initialization & Auto-save
- **D-08:** On screen mount, **UPSERT defaults** with `ignoreDuplicates: true` to ensure a row always exists before the first toggle fires:
  ```ts
  supabase.from('notification_preferences').upsert(
    { user_id, push_enabled: true, coach_enabled: true, workout_enabled: true,
      gamification_enabled: true, health_enabled: true, system_enabled: true,
      quiet_hours_start: 22, quiet_hours_end: 7, timezone_offset: detectedOffset },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )
  ```
- **D-09:** Auto-save uses **600ms debounce** (same as existing `AppearanceSubScreen` and old `NotifSubScreen`). `saveRef` pattern with `clearTimeout` + `setTimeout`. On each change: update local state immediately, debounce the Supabase UPSERT.
- **D-10:** Full UPSERT on every save (not partial UPDATE). Always include `timezone_offset` from auto-detect so it stays current.

### Data Loading
- **D-11:** On mount, load existing prefs from `notification_preferences` via **Supabase direct** (no Hono hop — consistent with coach page bypass pattern from STATE.md). Use `supabase.from('notification_preferences').select('*').eq('user_id', userId).single()`.
- **D-12:** If no row exists on load (first time user), show UI defaults immediately while UPSERT runs in background (D-08). No loading spinner required for the prefs row — defaults are sensible.

### OS Settings CTA
- **D-13:** Keep the existing `notifDenied` banner logic (checks `Notifications.getPermissionsAsync()` on mount). The CTA card with `Linking.openSettings()` appears when `status === 'denied' && !canAskAgain`. This was already correct in the old implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/notification-mobile/REQUIREMENTS.md` — Phase 5 requirements: PREF-01, PREF-02, PREF-03, PREF-04
- `.planning/workstreams/notification-mobile/ROADMAP.md` — Phase 5 goal, success criteria, dependency on Phase 3

### Prior Phase Context (locked decisions)
- `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-CONTEXT.md` — D-07: notificationService.ts checks `push_enabled` + category columns + quiet hours. D-09: UTC hour integers + `timezone_offset`.
- `.planning/workstreams/notification-mobile/phases/02-action-triggered-push/02-CONTEXT.md` — category names: `coach`, `workout`, `gamification`, `health`, `system`

### Existing Code to Read Before Implementing
- `apps/mobile/app/(app)/profile/settings.tsx` — **CRITICAL**: Contains the full current `NotifSubScreen` (to replace), `InlinePicker` component (to reuse), `STHeader` component, and the `SubView` state machine. Read entirely before implementing.
- `supabase/migrations/054_notification_schema.sql` — `notification_preferences` table schema: exact column names, defaults, constraints.
- `backend/api/src/services/notificationService.ts` — Shows exactly how `push_enabled`, `{category}_enabled`, `quiet_hours_start/end`, `timezone_offset` are consumed server-side.

### UI Components
- `@ziko/ui` — `STGroup`, `STRow` with `toggleValue`/`onToggle` props used in settings sub-screens. Check existing usage in settings.tsx.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InlinePicker` (settings.tsx, line ~164) — Bottom-sheet modal for selection lists. Already used for language/region. Reuse directly for quiet hours start/end hour selection. Props: `visible`, `items`, `selectedId`, `onSelect`, `onClose`, `theme`.
- `STHeader` (settings.tsx, line ~17) — Back button + title header. Already in the file.
- `STGroup` / `STRow` from `@ziko/ui` — Toggle rows with `toggleValue`/`onToggle`. Used throughout all sub-screens.
- `saveRef` debounce pattern (settings.tsx, line ~49) — `useRef<ReturnType<typeof setTimeout>>`, clearTimeout + setTimeout(600). Copy exactly.
- `notifDenied` OS Settings CTA (settings.tsx, lines ~98-127) — Keep this logic from the existing implementation.

### Established Patterns
- **Supabase direct for mobile reads** — No Hono hop. `supabase.from('notification_preferences')...`.
- **NativeWind / inline styles** — No StyleSheet. `style={{ ... }}` objects only.
- **paddingBottom: 100** — NOT needed here (settings uses `paddingBottom: 40` in sub-screens, no tab bar).
- **`showAlert` from `@ziko/plugin-sdk`** — Use instead of `Alert.alert`.
- **`useThemeStore((s) => s.theme)`** — Theme tokens: `theme.background`, `theme.surface`, `theme.text`, `theme.muted`, `theme.border`.

### Integration Points
- `apps/mobile/app/(app)/profile/settings.tsx` — The only file to modify. Replace `NotifSubScreen` function body entirely. `SubView` type and rendering logic (`sub === 'notifications'`) remain unchanged.
- No backend changes required — `notificationService.ts` already reads from `notification_preferences`.
- No new migrations required — `notification_preferences` table exists (migration 054).
- No new packages required — `expo-notifications` already installed.

</code_context>

<specifics>
## Specific Ideas

- UI structure (confirmed by user during discussion):
  ```
  [ Toutes les notifications ]  ● ON     ← master switch (push_enabled)

  Coach              ● ON
  Workout            ● ON
  Gamification       ● ON
  Santé & Habitudes   ● ON
  App                ● OFF

  ── Heures silencieuses ──           ← only visible when push_enabled = ON
  De     [22h00  ▾]
  À      [ 7h00  ▾]
  ```
- Category toggles grayed/disabled (not hidden) when master switch = OFF
- Quiet hours section hidden when master switch = OFF
- InlinePicker hour format: `"0h00"` to `"23h00"` (24 items)
- Timezone: `Math.round(-new Date().getTimezoneOffset() / 60)` — silent, always in UPSERT

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-notification-preferences-ui*
*Context gathered: 2026-05-28*

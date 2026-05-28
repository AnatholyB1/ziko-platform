# Phase 6: Local Reminders & App Updates - Research

**Researched:** 2026-05-28
**Domain:** expo-notifications local scheduling, expo-updates OTA detection, Supabase schema migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Habit reminder time configured inside the existing `showCreateModal` in `HabitsPlugin.tsx`. No new screens.
- **D-02:** Reuse the existing `InlinePicker` from `settings.tsx`. Hour options `"06h00"` to `"23h00"`. Zero new dependencies.
- **D-03:** Call `scheduleHabitReminder()` on modal save (when `reminder_time` is set) and `schedulAllReminders()` on app start after habits load. Call `cancelHabitReminder()` when `reminder_time` is cleared.
- **D-04:** Workout reminder weekdays: user-chosen explicitly (not derived from `days_per_week`).
- **D-05:** Workout reminder toggle + weekday picker + time picker live in `workout/[id].tsx`.
- **D-06:** Workout reminder prefs stored in `notification_preferences` via two new columns: `workout_reminder_days JSONB DEFAULT '[]'` and `workout_reminder_time TEXT DEFAULT NULL`. New migration required.
- **D-07:** `scheduleHabitReminder()` already calls `cancelHabitReminder()` internally — no extra cancel logic needed for habit time changes.
- **D-08:** When workout reminder days change, cancel all notifications with `data.workoutReminder = true` then reschedule.
- **D-09:** OTA detection client-side via `useUpdates()`. Prepend synthetic card to notifications list. Nothing written to `notification_log`.
- **D-10:** Tapping OTA card calls `Updates.reloadAsync()` immediately. CTA label: `"Mettre à jour"`.
- **D-11:** OTA card uses `"system"` category visual style, injected at top of list above other notifications.

### Claude's Discretion

- None specified.

### Deferred Ideas (OUT OF SCOPE)

- Snooze action on workout reminders (iOS/Android notification action button) — v1.12+
- Per-program reminder config (tied to specific program, not the user) — v1.12+
- Native binary update notification (App Store / Play Store link)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOCAL-01 | User can configure a daily reminder per habit (time chosen in habit interface) — scheduled via `scheduleNotificationAsync` | `scheduleHabitReminder()` already fully implemented in `notifications.ts`. Wire into `showCreateModal` save handler + `InlinePicker` for time selection. |
| LOCAL-02 | User can activate workout-day reminders based on their personal plan schedule | New UI section in `workout/[id].tsx`. WEEKLY trigger per selected weekday. New migration `062_workout_reminder_prefs.sql`. |
| LOCAL-03 | Local reminders auto-cancelled/rescheduled when prefs or program change | Habit: handled internally by `scheduleHabitReminder()`. Workout: cancel by `data.workoutReminder = true` tag, reschedule with new weekday set. |
| APP-01 | OTA update appears in notification center under "App" — no native push | `useUpdates().isUpdateAvailable` → synthetic card prepended via `ListHeaderComponent` in `notifications.tsx`. Tap calls `Updates.reloadAsync()`. |
</phase_requirements>

---

## Summary

Phase 6 is primarily a **wiring and integration** phase, not a greenfield build. The heaviest lifting is already done: `scheduleHabitReminder()`, `cancelHabitReminder()`, and `schedulAllReminders()` are fully implemented in `plugins/habits/src/notifications.ts` and only need to be connected to the UI. The `Habit` interface already has `reminder_time: string | null` in `store.ts`. The `InlinePicker` component in `settings.tsx` is ready to copy/import as-is.

The two genuinely new pieces are: (1) workout-day reminders — a new UI section in `workout/[id].tsx` using `SchedulableTriggerInputTypes.WEEKLY` triggers, backed by two new columns in `notification_preferences`; and (2) the OTA update card in `notifications.tsx` using `expo-updates` `useUpdates()` hook which is already installed at version `~29.0.17`.

A critical numbering issue was discovered: migration `055` already has **two conflicting files** in the repo (`055_coach_exercises_schema.sql` and `055_forms_schema.sql`). The correct next safe migration number is **`062`** (highest existing sequential migration is `061_coach_read_client_program_workouts.sql`).

**Primary recommendation:** Three plans — (1) habit reminder wiring in HabitsPlugin.tsx + app-start schedulAllReminders, (2) workout reminder UI + migration 062 + scheduling logic, (3) OTA card in notifications.tsx.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Habit reminder scheduling | Mobile (local) | — | `scheduleNotificationAsync` runs on-device; no server involvement |
| Habit reminder UI (time picker) | Mobile UI (HabitsPlugin modal) | — | Embedded in existing create modal |
| Workout reminder scheduling | Mobile (local) | — | WEEKLY trigger on-device per selected weekday |
| Workout reminder UI | Mobile UI (workout/[id].tsx) | — | Contextual to the program view per D-05 |
| Workout reminder preferences persistence | Supabase (notification_preferences) | — | Two new columns, Supabase direct write (no Hono) |
| OTA update detection | Mobile (expo-updates) | — | Client-side only — `useUpdates()` hook |
| OTA card display | Mobile UI (notifications.tsx) | — | Synthetic ListHeaderComponent, no DB write |
| App-start reminder recovery | Mobile (useNotificationSetup or _layout.tsx) | — | `schedulAllReminders()` called after habits load |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-notifications | ~0.32.16 | `scheduleNotificationAsync`, `cancelScheduledNotificationAsync`, `getAllScheduledNotificationsAsync` | Already installed in Phase 1; `SchedulableTriggerInputTypes.DAILY` and `WEEKLY` confirmed available |
| expo-updates | ~29.0.17 | `useUpdates()` hook — `isUpdateAvailable`, `Updates.reloadAsync()` | Already installed in app; standard Expo OTA mechanism |
| @tanstack/react-query | v5 | Query/mutation patterns used throughout (habits, notifications screens) | Project standard |
| supabase-js | existing | Direct Supabase UPSERT for notification_preferences new columns | Project standard (no Hono hop for mobile reads/writes) |

### No new packages required for this phase.

**Installation:** None needed.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries used are already present in the project.

| Package | Status |
|---------|--------|
| expo-notifications | Already installed — no audit required |
| expo-updates | Already installed — no audit required |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
App Start
  └─> habits loaded from Supabase
        └─> schedulAllReminders(habits, agentName)  ← calls scheduleHabitReminder() per active habit

User creates/edits habit in showCreateModal
  └─> reminder_time row + InlinePicker (reused from settings.tsx)
        └─> on save: scheduleHabitReminder(habit, agentName)
              └─> cancelHabitReminder(habit.id) [internal]
              └─> scheduleNotificationAsync (DAILY trigger: hour, minute)
        └─> on clear: cancelHabitReminder(habit.id)

User opens workout/[id].tsx
  └─> workout reminder section (new)
        ├─> toggle (workout_reminder_enabled)
        ├─> weekday picker (MTWTFSS chips → workout_reminder_days JSONB)
        └─> time picker (InlinePicker → workout_reminder_time TEXT)
              └─> on change: UPSERT notification_preferences (Supabase direct)
              └─> cancel all notifications with data.workoutReminder=true
              └─> scheduleNotificationAsync (WEEKLY trigger) × selected weekdays

notifications.tsx
  └─> useUpdates() → isUpdateAvailable
        └─> if true: ListHeaderComponent renders OTA card
              └─> tap: Updates.reloadAsync()
```

### Recommended Project Structure

No new files or folders required. All changes are within existing files, plus:

```
supabase/migrations/
  └── 062_workout_reminder_prefs.sql   ← ADD COLUMN workout_reminder_days, workout_reminder_time
```

### Pattern 1: DAILY Trigger (existing — already used in notifications.ts)

```typescript
// Source: expo-notifications official docs, confirmed in plugins/habits/src/notifications.ts
await n.scheduleNotificationAsync({
  content: {
    title: `${habit.emoji} ${habit.name}`,
    body: `${agentName} here — don't forget your ${habit.name.toLowerCase()} today!`,
    data: { habitId: habit.id },
  },
  trigger: {
    type: n.SchedulableTriggerInputTypes.DAILY,
    hour: h,   // 0-23
    minute: m, // 0-59
  } as any,
});
```

**Note:** The `as any` cast is intentional and already in use — the trigger type TS definitions are sometimes behind the runtime API. Do not remove it.

### Pattern 2: WEEKLY Trigger (new — for workout reminders)

**What:** Schedule one notification per selected weekday using `SchedulableTriggerInputTypes.WEEKLY`.
**When to use:** Workout reminders where user has selected specific weekdays (e.g., Mon/Wed/Fri).

```typescript
// Source: expo-notifications official docs (verified via WebFetch)
// Weekday: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
// IMPORTANT: Expo weekday numbering starts at 1=Sunday, unlike JavaScript Date (0=Sunday)

const DAY_TO_EXPO_WEEKDAY: Record<string, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

for (const dayStr of workoutReminderDays) {
  const expoWeekday = DAY_TO_EXPO_WEEKDAY[dayStr];
  await n.scheduleNotificationAsync({
    content: {
      title: 'Séance du jour',
      body: `C'est ton jour d'entraînement — let's go! 💪`,
      data: { workoutReminder: true },  // tag for cancel-by-data
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes.WEEKLY,
      weekday: expoWeekday,
      hour: h,
      minute: m,
    } as any,
  });
}
```

### Pattern 3: Cancel by Data Tag (workout reminders)

```typescript
// Source: pattern from cancelHabitReminder() in plugins/habits/src/notifications.ts
async function cancelWorkoutReminders(): Promise<void> {
  const n = N(); // lazy require guard — same as notifications.ts
  if (!n) return;
  try {
    const all = await n.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (notif.content.data?.workoutReminder === true) {
        await n.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.warn('[Workout] cancelWorkoutReminders failed:', e);
  }
}
```

### Pattern 4: InlinePicker (reuse from settings.tsx)

```typescript
// Source: apps/mobile/app/(app)/profile/settings.tsx lines 299-353
// Props:
function InlinePicker({
  visible,      // boolean
  items,        // { id: string; label: string }[]
  selectedId,   // string
  onSelect,     // (id: string) => void
  onClose,      // () => void
  theme,        // theme object from useThemeStore
}: { ... })
```

**Copy strategy:** `InlinePicker` is a local function in `settings.tsx`, not exported from a shared package. Two options:
1. **Inline copy** into `HabitsPlugin.tsx` (same pattern, isolated) — simplest for a plugin file
2. **Import from settings.tsx** — only works if the function is exported; currently it is not

**Recommendation:** Inline copy into `HabitsPlugin.tsx`. For `workout/[id].tsx`, same — inline copy. The component is small (55 lines) and self-contained.

### Pattern 5: OTA Card via ListHeaderComponent

```typescript
// Source: expo-updates docs, notifications.tsx structure
import * as Updates from 'expo-updates';

// Inside NotificationsScreen component:
const { isUpdateAvailable } = Updates.useUpdates();

// In FlatList:
<FlatList
  data={notifications}
  ListHeaderComponent={
    isUpdateAvailable ? (
      <OTAUpdateCard onPress={async () => { await Updates.reloadAsync(); }} />
    ) : null
  }
  // ... rest unchanged
/>
```

**OTA Card visual:** Use same card structure as `NFItem` — `SURFACE` background, `BORDER`, `SHADOW`, `system` tint (`#6B6963`) icon `"refresh-circle-outline"`. Add a `"Mettre à jour"` `PRIMARY` (#FF5C1A) text CTA.

### Pattern 6: InlinePicker Hour Items for Habit Reminder

```typescript
// Same format as HOUR_ITEMS in settings.tsx (quiet hours)
const HOUR_ITEMS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // 06h00 to 23h00
  return { id: String(hour), label: `${hour}h00` };
});
// Produces 18 items: id='6' label='6h00' ... id='23' label='23h00'
// selectedId is the hour integer as a string: '9' for 09:00
```

**Storage format:** `reminder_time` on the Habit row is `'HH:MM'` (e.g., `'09:00'`). Parse as `parseInt(selectedId)` → hour, minute = 0.

### Pattern 7: Workout Weekday Picker (chip strip)

Use the same chip pattern as the day-of-week selector already in `workout/[id].tsx` (Add Day modal, lines 802-820). Seven chips Mon–Sun. Tapping toggles the day in/out of `workoutReminderDays` array.

**Weekday label mapping for display:**
```typescript
const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
  thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim',
};
```

### Pattern 8: schedulAllReminders app-start wiring

The call should happen in `useNotificationSetup.ts` or the root `_layout.tsx`, after habits are loaded from Supabase. The habits store is a Zustand store (`useHabitsStore`). Best injection point:

```typescript
// In the useEffect that loads habits (HabitsPlugin.tsx or a dedicated hook)
// After setHabits(data):
const agentName = /* from persona store or default 'Ziko' */;
schedulAllReminders(habits, agentName);
```

**Alternative:** Add a `useEffect` in `apps/mobile/app/(app)/_layout.tsx` that watches `useHabitsStore((s) => s.habits)` and calls `schedulAllReminders` when habits change and are non-empty. This avoids coupling the app start to the plugin screen.

### Anti-Patterns to Avoid

- **Using `SchedulableTriggerInputTypes.WEEKLY` with `weekday: 0`** — Expo weekday is 1-based (1=Sunday). Day 0 is invalid and silently fails on iOS.
- **Writing OTA update to `notification_log`** — explicitly out of scope per D-09. No DB write.
- **Using `Alert.alert` in HabitsPlugin.tsx** — use `showAlert` from `@ziko/plugin-sdk` (already imported there).
- **Using migration number 055** — already has two conflicting files in the repo. Use `062`.
- **Calling `schedulAllReminders` before habits are loaded** — results in no-op (empty array). Ensure the call is after the Supabase fetch resolves.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cancelling old habit reminder before rescheduling | Custom cancel logic | `scheduleHabitReminder()` — already calls `cancelHabitReminder()` internally | Already implemented; re-implementing duplicates bugs |
| Daily notification trigger | Custom timer/interval | `SchedulableTriggerInputTypes.DAILY` with `{hour, minute}` | OS handles daylight saving, sleep, exact delivery |
| Weekly notification trigger | Custom cron or interval | `SchedulableTriggerInputTypes.WEEKLY` with `{weekday, hour, minute}` | OS handles this natively on both iOS and Android |
| OTA update polling | Custom fetch loop | `useUpdates()` from `expo-updates` | Hook already handles background check + state management |
| Time picker modal | Custom bottom sheet | `InlinePicker` from `settings.tsx` (copy) | Already styled, tested, matches Phase 5 pattern |

**Key insight:** For both local scheduling problems, the OS scheduler (via expo-notifications) handles all the edge cases (timezone changes, device sleep, OS-cleared notifications on reboot). `schedulAllReminders()` on app start is the recovery mechanism for the reboot case.

---

## Migration: 062_workout_reminder_prefs.sql

**Critical finding:** Migration `055` is already taken by **two** conflicting files:
- `055_coach_exercises_schema.sql`
- `055_forms_schema.sql`

The highest sequential migration is `061_coach_read_client_program_workouts.sql`. **Use `062`.**

```sql
-- 062 — Workout reminder preferences columns
-- Adds workout reminder day/time config to notification_preferences

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS workout_reminder_days JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS workout_reminder_time TEXT DEFAULT NULL;

-- workout_reminder_days: JSON array of lowercase weekday strings
-- e.g. ["monday","wednesday","friday"]
-- workout_reminder_time: "HH:MM" string, e.g. "07:30", NULL = no reminder set
```

**No RLS change needed** — `notification_preferences` already has `notification_preferences_own` policy (auth.uid() = user_id) from migration 054.

---

## Common Pitfalls

### Pitfall 1: Expo WEEKLY Weekday Off-by-One
**What goes wrong:** Workout reminders fire on the wrong day (one day off).
**Why it happens:** Expo's `weekday` field uses 1=Sunday convention. JavaScript developers expect 0=Sunday (Date API). If you map Monday to `1` instead of `2`, reminders fire on Sunday.
**How to avoid:** Use the explicit mapping `{ sunday:1, monday:2, tuesday:3, wednesday:4, thursday:5, friday:6, saturday:7 }`.
**Warning signs:** During testing, reminder fires at correct time but wrong day.

### Pitfall 2: InlinePicker Not Exported
**What goes wrong:** TypeScript error when trying to import `InlinePicker` from `settings.tsx`.
**Why it happens:** `InlinePicker` is a local (unexported) function in `settings.tsx`. It cannot be imported by other files.
**How to avoid:** Copy the component inline into `HabitsPlugin.tsx` and `workout/[id].tsx`. Do not attempt to import it.
**Warning signs:** TS error "Module has no exported member 'InlinePicker'".

### Pitfall 3: HabitsPlugin.tsx Uses Its Own Local `Habit` Interface
**What goes wrong:** The `Habit` type in `HabitsPlugin.tsx` (lines 21-31) does NOT have `reminder_time` field — it is the screen's local abbreviated interface, not the store's full `Habit` type.
**Why it happens:** `HabitsPlugin.tsx` imports from `supabase` directly and has its own local `interface Habit` without `reminder_time`. The store's `Habit` (in `store.ts`) has `reminder_time` but the screen doesn't use it.
**How to avoid:** When adding `reminder_time` to the create modal, also add `reminder_time: string | null` to the local `interface Habit` in `HabitsPlugin.tsx`, AND include `reminder_time` in the Supabase `.select()` query for habits.
**Warning signs:** TypeScript error "Property 'reminder_time' does not exist on type 'Habit'" in HabitsPlugin.tsx.

### Pitfall 4: createHabitMutation Doesn't Save reminder_time
**What goes wrong:** User sets a reminder time but it isn't persisted — reminder never fires.
**Why it happens:** `createHabitMutation.mutationFn` (line 230) inserts `{user_id, name, type, target, color, emoji}` — no `reminder_time` field. Must be extended.
**How to avoid:** Add `reminder_time` to the mutation input type and the `supabase.from('habits').insert({...})` call.
**Warning signs:** `habits` table has `reminder_time` column NULL despite user picking a time.

### Pitfall 5: `schedulAllReminders` Called Before Habits Loaded
**What goes wrong:** App-start recovery does nothing — no reminders are rescheduled after OS clears them.
**Why it happens:** If `schedulAllReminders()` is called before the Supabase habits fetch resolves, it receives an empty array.
**How to avoid:** Call it inside the `.then()` or after the `await` of the habits fetch, not in a parallel `useEffect`.
**Warning signs:** After device reboot, habit reminders don't fire even though `reminder_time` is set.

### Pitfall 6: expo-updates useUpdates() Returns False in Dev
**What goes wrong:** OTA card never appears during development testing.
**Why it happens:** `isUpdateAvailable` is always `false` in development builds because there is no remote update manifest. It only triggers in production or staging.
**How to avoid:** For testing, add a temporary override: `const debugShowOTA = __DEV__ && false; // flip to true for UI test`.
**Warning signs:** OTA card never shows; this is expected in dev — test visually with the debug flag.

### Pitfall 7: Migration Numbering Conflict
**What goes wrong:** Applying the new migration fails or causes ordering issues.
**Why it happens:** `055` already exists twice in the repo. Using `055` again is invalid.
**How to avoid:** Use `062_workout_reminder_prefs.sql` — verified as the next available sequential number.
**Warning signs:** Supabase migration apply error about duplicate or conflicting migration names.

---

## Code Examples

### Extending createHabitMutation to Save reminder_time

```typescript
// Source: derived from HabitsPlugin.tsx lines 229-249 (verified by reading file)
// Add reminder_time to mutation input and insert call:

const [newHabitReminderTime, setNewHabitReminderTime] = useState<string | null>(null);

const createHabitMutation = useMutation({
  mutationFn: async ({
    name, color, emoji, reminder_time,
  }: { name: string; color: string; emoji: string; reminder_time: string | null }) => {
    if (!userId) throw new Error('Not authenticated');
    const { error } = await supabase.from('habits').insert({
      user_id: userId,
      name: name.trim(),
      type: 'boolean',
      target: 1,
      color,
      emoji,
      reminder_time,       // NEW
    });
    if (error) throw error;
  },
  onSuccess: async (_data, vars) => {
    queryClient.invalidateQueries({ queryKey: ['habits', userId] });
    // Schedule the reminder if set
    if (vars.reminder_time) {
      // Need the full habit object — refetch or use the returned row
      // Simplest: call after invalidation resolves, or optimistically schedule
    }
    showAlert('Habitude ajoutée', `"${vars.name}" a été ajoutée à vos habitudes.`);
  },
});
```

### Workout Reminder UPSERT to notification_preferences

```typescript
// Source: pattern from settings.tsx handleChange (lines 110-133), adapted for workout
const saveWorkoutReminderPrefs = async (days: string[], time: string | null) => {
  if (!userId) return;
  await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        workout_reminder_days: days,
        workout_reminder_time: time,
      },
      { onConflict: 'user_id' }
    );
};
```

### OTA Card Component

```typescript
// Source: NFItem structure from notifications.tsx lines 84-139, adapted for OTA
function OTAUpdateCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 8,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        ...SHADOW,
      }}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#6B696324',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons name="refresh-circle-outline" size={20} color="#6B6963" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT, lineHeight: 20 }}>
          Mise à jour disponible
        </Text>
        <Text style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 18 }}>
          Une nouvelle version de l'app est prête.
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY, marginTop: 6 }}>
          Mettre à jour
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

---

## Runtime State Inventory

> This is a wiring/extension phase, not a rename/refactor. No runtime state inventory required.

---

## Codebase State — Verified Facts

The following were confirmed by direct file reads in this session:

### plugins/habits/src/notifications.ts (CRITICAL)
- `scheduleHabitReminder(habit, agentName)` — **fully implemented** (lines 49-74)
  - Calls `cancelHabitReminder(habit.id)` before scheduling (no external cancel needed)
  - Uses `SchedulableTriggerInputTypes.DAILY` with `{hour, minute}` parsed from `reminder_time`
  - Guards with lazy `N()` pattern for Expo Go Android safety
- `cancelHabitReminder(habitId)` — **fully implemented** (lines 76-88)
  - Scans all scheduled notifications, cancels those with `data.habitId === habitId`
- `schedulAllReminders(habits, agentName)` — **fully implemented** (lines 91-100)
  - Iterates habits, calls `scheduleHabitReminder` for each with `reminder_time` and `is_active`

### plugins/habits/src/store.ts
- `Habit` interface has `reminder_time: string | null; // 'HH:MM'` at line 14 — **confirmed**

### plugins/habits/src/screens/HabitsPlugin.tsx
- Has its own **local** `interface Habit` (lines 21-31) WITHOUT `reminder_time` — **must be extended**
- `createHabitMutation` (lines 229-249) inserts WITHOUT `reminder_time` — **must be extended**
- `showCreateModal` state at line 554, modal body starts at line 670
- Modal currently has: habit name input, frequency toggle (daily/weekdays), Create/Cancel buttons
- `newHabitFrequency` state exists but is not actually used in the insert (no frequency column in DB schema) — **Note: this is pre-existing dead state**
- `showAlert` already imported from `@ziko/plugin-sdk`

### apps/mobile/app/(app)/profile/settings.tsx
- `InlinePicker` function at lines 299-353 — **local, NOT exported**
- Props: `{ visible, items, selectedId, onSelect, onClose, theme }`
- `HOUR_ITEMS` format: `Array.from({length: 24}, (_, i) => ({id: String(i), label: `${i}h00`}))` — 0h00 to 23h00

### apps/mobile/app/(app)/workout/[id].tsx
- File is 1286 lines; contains the full program detail screen
- The `ScrollView` content ends at line 698 (Add workout day button)
- **No existing workout reminder section** — entirely new UI to add
- Uses `theme` from `useThemeStore` — consistent with the rest of the screen
- `supabase` is already imported; `showAlert` from `@ziko/plugin-sdk` already imported

### apps/mobile/app/(app)/notifications.tsx
- `NFItem` component at lines 84-139 — the card component to replicate for OTA card
- `FlatList` at line 300 with `ListEmptyComponent` — add `ListHeaderComponent` for OTA card
- Already uses `useRouter`, `useQuery`, `useMutation` — no new hooks needed except `useUpdates`
- Currently queries from `'notifications'` table (not `notification_log`) — this is a Phase 3 concern, not Phase 6

### apps/mobile/src/hooks/useNotificationSetup.ts
- Sets up Android channels, handles token registration, manages permission modal
- Does NOT currently call `schedulAllReminders` — this is the injection point for app-start habit reminders
- The hook is called in `_layout.tsx` with `userId` and `session`

### supabase/migrations/054_notification_schema.sql
- `notification_preferences` columns confirmed: `push_enabled`, `coach_enabled`, `workout_enabled`, `gamification_enabled`, `health_enabled`, `system_enabled`, `type_prefs JSONB`, `quiet_hours_start INTEGER`, `quiet_hours_end INTEGER`, `timezone_offset INTEGER`, `updated_at`
- **Does NOT have** `workout_reminder_days` or `workout_reminder_time` — migration 062 adds them

### expo-updates
- Installed at `~29.0.17` in `apps/mobile/package.json`
- `useUpdates()` hook returns `{ isUpdateAvailable, isUpdatePending, isChecking }` [VERIFIED: expo docs]
- `Updates.reloadAsync()` — async, resolves before reload completes; no logic should follow [VERIFIED: expo docs]
- **Caveat:** `isUpdateAvailable` is always `false` in dev builds — UI test requires `__DEV__` override or staging build

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-notifications | LOCAL-01, LOCAL-02, LOCAL-03 | Yes | ~0.32.16 | — |
| expo-updates | APP-01 | Yes | ~29.0.17 | — |
| Supabase | LOCAL-02 (prefs persistence) | Yes | existing | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, pytest.ini in project) |
| Config file | none |
| Quick run command | manual smoke test on Development Build device |
| Full suite command | manual smoke test on Development Build device |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOCAL-01 | Habit reminder fires at configured time | manual (requires device + wait) | — manual only | N/A |
| LOCAL-01 | Reminder time appears in create modal | smoke UI | — manual on dev build | N/A |
| LOCAL-01 | Creating habit with time → notification scheduled | smoke on device | `Notifications.getAllScheduledNotificationsAsync()` log | N/A |
| LOCAL-02 | Workout reminder section visible in workout/[id].tsx | smoke UI | — manual | N/A |
| LOCAL-02 | Prefs saved to notification_preferences | smoke DB check | Supabase table editor | N/A |
| LOCAL-03 | Changing habit reminder time cancels old, schedules new | smoke on device | getAllScheduledNotificationsAsync log | N/A |
| LOCAL-03 | Changing workout days cancels old workout reminders, schedules new | smoke on device | getAllScheduledNotificationsAsync log | N/A |
| APP-01 | OTA card appears when isUpdateAvailable=true | smoke UI (debug flag) | `__DEV__` override | N/A |
| APP-01 | Tapping OTA card calls reloadAsync | smoke on staging | staging OTA publish | N/A |

### Sampling Rate

- Per task: manual smoke on Development Build device (or simulator for UI-only changes)
- Per wave: manual full-flow test: create habit → verify reminder in getAllScheduledNotificationsAsync output

### Wave 0 Gaps

- No test framework exists in this project — all validation is manual smoke testing on device

---

## Security Domain

No new authentication surfaces, no new API routes, no new user input beyond time/weekday pickers. ASVS V5 (Input Validation) is satisfied by the constrained picker UIs (no free-text for time or day selection). No security concerns specific to this phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxSteps` (AI SDK v3) | `stopWhen: stepCountIs(n)` (AI SDK v6) | v1.11 | No impact on Phase 6 |
| `type_prefs JSONB` for habit_reminder | Still used — `type_prefs.habit_reminder` boolean tracks server-side category | v1.11 Phase 1 | Phase 6 local reminders are separate from server-side type_prefs toggle |

**Deprecated/outdated:**
- `SchedulableTriggerInputTypes.TIME_INTERVAL`: valid but not appropriate for calendar-based daily/weekly reminders — use DAILY and WEEKLY instead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `schedulAllReminders()` should be wired in `useNotificationSetup.ts` or `_layout.tsx` — exact injection point needs implementation decision | Architecture Patterns, Pattern 8 | If injected in wrong place, reminders may schedule before auth is ready or duplicate on re-renders |
| A2 | `workout_reminder_days` stored as JSONB array of lowercase English weekday strings (e.g., `["monday","wednesday","friday"]`) | Migration section | If stored differently (e.g., integers), the scheduling loop and display labels need adjustment |
| A3 | `isUpdateAvailable` from `expo-updates ~29.0.17` behaves identically to SDK 56 docs | Standard Stack | Minor API difference could cause hook to not work — verify on actual device |

---

## Open Questions

1. **schedulAllReminders injection point**
   - What we know: the hook `useNotificationSetup.ts` runs on mount with `userId` and `session`
   - What's unclear: habits are loaded inside `HabitsPlugin.tsx` via its own `useQuery`, not in the hook. Injecting `schedulAllReminders` in `useNotificationSetup` would require fetching habits there or accessing the Zustand store.
   - Recommendation: Add a `useEffect` in `HabitsPlugin.tsx` that watches the `habits` query result and calls `schedulAllReminders` after successful fetch. This is the most localized approach and avoids global coupling.

2. **Persona / agentName source**
   - What we know: `scheduleHabitReminder(habit, agentName)` takes an `agentName` string
   - What's unclear: where does `HabitsPlugin.tsx` get the persona name? The function has a default `'Ziko'`
   - Recommendation: Use the default `'Ziko'` — persona integration can be added later if needed.

---

## Sources

### Primary (HIGH confidence)
- `plugins/habits/src/notifications.ts` — direct file read; full implementation of all three scheduling functions
- `plugins/habits/src/store.ts` — direct file read; `reminder_time` field confirmed
- `plugins/habits/src/screens/HabitsPlugin.tsx` — direct file read; `createHabitMutation`, local `Habit` interface, `showCreateModal` structure
- `apps/mobile/app/(app)/profile/settings.tsx` — direct file read; `InlinePicker` props and implementation
- `apps/mobile/app/(app)/workout/[id].tsx` — direct file read; existing structure, import list
- `apps/mobile/app/(app)/notifications.tsx` — direct file read; `NFItem` structure, `FlatList` setup
- `supabase/migrations/054_notification_schema.sql` — direct file read; `notification_preferences` column list
- `ls supabase/migrations/` — confirmed highest sequential migration is `061`, `055` is duplicated
- `apps/mobile/package.json` — confirmed `expo-notifications ~0.32.16` and `expo-updates ~29.0.17`
- Expo Notifications official docs (WebFetch) — `SchedulableTriggerInputTypes.DAILY` and `WEEKLY` trigger format verified
- Expo Updates official docs (WebFetch) — `useUpdates()` return shape and `reloadAsync()` behavior verified

### Secondary (MEDIUM confidence)
- Expo Updates SDK 56 docs applied to `~29.0.17` — API shape likely identical, but version delta noted

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, no new dependencies
- Architecture: HIGH — all integration points confirmed by direct file reads
- Pitfalls: HIGH — each pitfall discovered from direct code inspection (local Habit interface, unexported InlinePicker, migration numbering)
- Migration number: HIGH — verified by `ls` on migrations directory

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable Expo APIs)

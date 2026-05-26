# Phase 38: Remaining Plugins Group 1 — Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign 6 plugins — **Stats, Gamification, Stretching, Sleep, Measurements, Timer** — to match the `plugins-2.jsx` canonical mockup. Each plugin ships: a new single-entrypoint screen with internal SubTabs, AISuggestion card, and all fixture data replaced by TanStack Query hooks.

**In scope:** StatsDashboard, GamificationDashboard, StretchingDashboard, SleepDashboard, MeasurementsDashboard, TimerDashboard — all replaced with new single-entrypoint files.

**Out of scope:** Active workout session, any new backend routes, community sub-screens, Phase 39 plugins (Journal, Cardio, Supplements, Wearables, RPE).

</domain>

<decisions>
## Implementation Decisions

### Plugin Screen Structure
- **D-01:** Same single-entrypoint + internal SubTabs pattern as Phase 37. Each plugin: `const [activeTab, setActiveTab] = useState<string>('TabName')`.
- **D-02:** `MiniBars` does NOT exist in `@ziko/ui` — build inline using `View` flex bars within each plugin file. No shared MiniBars component needed for Phase 38.
- **D-03:** Old dashboard files deleted after verify-zero-imports per Phase 37 pattern (delete-after-verify).

### Sleep Stage Bar
- **D-04:** `sleep_logs` has NO stage columns (only `duration_hours`, `quality`). Implement heuristic stage bar: Profond 18% / Léger 53% / REM 24% / Éveillé 5% × `duration_hours`. Render as a single `flexDirection: 'row'` View with colored segments.

### Gamification
- **D-05:** Table is `user_gamification` (NOT `user_xp`). Columns: `xp, level, coins, current_streak, longest_streak, equipped_title, equipped_badge`.
- **D-06:** No `quests` table exists. PLUG-GAM-03 quests rendered as static/hardcoded quest cards with progress derived from XP or fixed data. Mark as "À venir" if no backing data — acceptable per CONTEXT.
- **D-07:** Level card uses a radial XP ring (same SVG approach as FormRing from Phase 32, single segment). XP thresholds: level × 500 (e.g., level 5 → next at 2500 XP).

### Timer
- **D-08:** Live countdown uses `useRef` + `setInterval` 1s + `AppState` background correction (existing pattern).
- **D-09:** "Sauvegarder comme séance" inserts into `workout_sessions` with columns `user_id, name, started_at, ended_at, notes` ONLY (duration_minutes/calories_burned do NOT exist in migration 001).
- **D-10:** Timer mockup shows a static screen — integrate real countdown in the main "Minuteur" tab, with presets as a second tab. Full-screen overlay approach from existing TimerDashboard preferred over tab-switching.

### Measurements
- **D-11:** Line chart (weight trend) built with inline `View`s and SVG path — use `react-native-svg` (already installed) for a simple line chart. Alternative: use a simple `View`-based dot-connected chart if SVG complexity is high.

### Stats
- **D-12:** MiniBars for stats = 7 `View` bars with heights proportional to session volume, inline in Stats plugin file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mockup Files
- `C:/Users/Anatholy/Downloads/ziko/plugins-2.jsx` — ALL 6 plugins visual reference (Stats, Gamification, Stretching, Sleep, Measurements, Timer)

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-STA (PLUG-STA-01–03)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-GAM (PLUG-GAM-01–04)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-STR (PLUG-STR-01–04)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-SLP (PLUG-SLP-01–04)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-MSR (PLUG-MSR-01–03)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-TMR (PLUG-TMR-01–04)

### Existing Screens (to replace)
- `plugins/stats/src/screens/StatsDashboard.tsx` — REPLACE
- `plugins/gamification/src/screens/GamificationDashboard.tsx` — REPLACE
- `plugins/stretching/src/screens/StretchingDashboard.tsx` — REPLACE
- `plugins/sleep/src/screens/SleepDashboard.tsx` — REPLACE
- `plugins/measurements/src/screens/MeasurementsDashboard.tsx` — REPLACE
- `plugins/timer/src/screens/TimerDashboard.tsx` — REPLACE

### Route Wrappers (to update)
- `apps/mobile/app/(app)/(plugins)/stats/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/stretching/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/sleep/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/measurements/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/timer/dashboard.tsx`

### Design System (Phase 32)
- `packages/ui/src/components/SubTabs.tsx` — `tabs: string[], active: string, onChange: (tab: string) => void` — ALREADY pill style from Phase 37
- `packages/ui/src/components/AISuggestion.tsx` — already has "COACH IA · SUGGESTION" label from Phase 37
- `packages/ui/src/components/PluginHeader.tsx`
- `packages/ui/src/components/WeekStrip.tsx`

### Database Tables
- `workout_sessions` + `session_sets` — Stats (PLUG-STA-01, STA-02)
- `user_gamification` — Gamification (columns: xp, level, coins, current_streak, longest_streak) — NOT user_xp
- `stretching_routines` + `stretching_logs` — Stretching (PLUG-STR-02, STR-03)
- `sleep_logs` — Sleep (columns: bedtime TEXT, wake_time TEXT, duration_hours NUMERIC, quality INT 1-5) — NO stage columns
- `body_measurements` — Measurements (weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm)
- `timer_presets` — Timer (type, work_sec, rest_sec, rounds, exercises JSONB) — DB uses work_sec/rest_sec

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Pattern (from Phase 37)
```typescript
// Single-entrypoint pattern
export default function XPlugin({ supabase }: { supabase: SupabaseClient }) {
  const [activeTab, setActiveTab] = useState<string>('TabName');
  const { data: session } = useSession(); // from @supabase/auth-helpers-react or equivalent
  const userId = session?.user?.id;
  // ...
  return (
    <>
      <PluginHeader title="Plugin Name" onBack={() => router.back()} />
      <SubTabs tabs={['Tab1', 'Tab2', 'Tab3']} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Tab1' && <Tab1Content />}
      {activeTab === 'Tab2' && <Tab2Content />}
    </>
  );
}
```

### Inline MiniBars pattern (no shared component)
```tsx
// 7-bar chart for sessions/volume/sleep
const bars = last7.map((val, i) => (
  <View key={i} style={{ flex: 1, marginHorizontal: 2, justifyContent: 'flex-end' }}>
    <View style={{
      height: Math.max(4, (val / maxVal) * 80),
      backgroundColor: isToday(i) ? '#FF5C1A' : 'rgba(255,92,26,0.22)',
      borderRadius: 3,
    }} />
  </View>
));
```

### Design tokens
- background: #F7F6F3, surface: #FFFFFF, border: #E2E0DA
- primary: #FF5C1A, text: #1C1A17, muted: #6B6963
- Card shadow: shadowOpacity 0.08, shadowRadius 12, elevation 3
- `paddingBottom: 100` on all ScrollViews

### showAlert (mandatory)
- `showAlert` from `@ziko/plugin-sdk` — required everywhere (NOT Alert.alert)

### Timer countdown
```typescript
const intervalRef = useRef<NodeJS.Timeout | null>(null);
// on start: intervalRef.current = setInterval(() => setSecondsLeft(s => s - 1), 1000)
// AppState change → correct elapsed time using Date.now()
```

### workout_sessions insert (PLUG-TMR-04)
```typescript
// ONLY these columns exist in migration 001:
supabase.from('workout_sessions').insert({
  user_id: userId,
  name: 'Séance Timer',
  started_at: startTime.toISOString(),
  ended_at: new Date().toISOString(),
  notes: '',
})
```

</code_context>

---
*Phase: 38-remaining-plugins-group1*
*Context gathered: 2026-05-26*

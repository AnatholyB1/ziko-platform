# Phase 39: Remaining Plugins Group 2 — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign 6 plugins — **Journal, Cardio, Supplements, Wearables, RPE, Pantry** — to match the `plugins-2.jsx` canonical mockup. Each plugin ships: a new single-entrypoint screen with internal SubTabs, AISuggestion card, and all fixture data replaced by TanStack Query hooks or Zustand-persisted values.

**In scope:** JournalPlugin, CardioPlugin, SupplementsPlugin, WearablesPlugin, RPEPlugin, PantryPlugin — all replaced with new single-entrypoint files.

**Out of scope:** Active cardio GPS tracker (CardioTracker.tsx stays untouched), CardioDetail.tsx, barcode scanner (BarcodeScanner.tsx), PantryItemForm, RecipeDetail, any new backend routes.

</domain>

<decisions>
## Implementation Decisions

### Plugin Screen Structure
- **D-01:** Same single-entrypoint + internal SubTabs pattern as Phase 37/38. Each plugin: `const [activeTab, setActiveTab] = useState<string>('TabName')`.
- **D-02:** Old dashboard files deleted after verify-zero-imports per Phase 37/38 pattern (delete-after-verify).

### Journal
- **D-03:** Mood picker uses 5 emojis (😞😕😐🙂🤩) with violet accent (#7B5BD0). `journal_entries` table has columns: `id, user_id, mood INT 1–5, energy INT 1–5, stress INT 1–5, context TEXT ('pré-séance'|'post-séance'|'matin'|'soir'), notes TEXT, created_at`. Context tags are single-select chips; multiple selection not needed per mockup.
- **D-04:** Tabs: Aujourd'hui / Historique / Tendances. Tendances tab = MiniBars 7 jours mood + AISuggestion based on last 7 avg mood.
- **D-05:** Save button in Aujourd'hui tab inserts into journal_entries with showAlert confirmation.

### Cardio
- **D-06:** Tabs: Activités / Plan / Stats. Activity grid = 6 tiles (Course/Vélo/Rameur/Marche/Hyrox/Functional) with color-coded icons navigating to existing `/(plugins)/cardio/tracker` route with `activity_type` param.
- **D-07:** "Plan" tab = rule-based AI plan card derived from last 7 sleep_logs avg quality + recent cardio_sessions count — purely display, no AI call. If < 2 cardio sessions this week → suggest LISS. If sleep avg < 3 → suggest rest.
- **D-08:** Cardio accent color = `#E94B3C` (from mockup, not primary orange).
- **D-09:** CardioDashboard.tsx deleted; CardioTracker.tsx, CardioDetail.tsx, CardioLog.tsx UNTOUCHED.

### Supplements
- **D-10:** Mockup shows a daily supplement stack tracker (Aujourd'hui / Mon stack / Rappels). PLUG-SUP-01 price comparison is implemented in "Mon stack" tab as a search + RowList from `supplements` + `supplement_prices` JOIN. "Aujourd'hui" tab uses a local daily checklist stored in MMKV (no dedicated DB table for daily logs). "Rappels" tab = static list of reminder CTAs.
- **D-11:** Supplements accent = `#2E9E5B` (green, per mockup's success color for Compléments).
- **D-12:** SupplementsListScreen.tsx is the old entry route — replace import in route wrapper with SupplementsPlugin; keep SupplementDetailScreen.tsx and SupplementCompareScreen.tsx untouched.

### Wearables
- **D-13:** Single meaningful split: Aujourd'hui (health summary) / Connexion (integration status). `wearable_daily_summary` columns: `user_id, date, steps INT, calories_burned INT, active_minutes INT, heart_rate_avg INT, sleep_hours NUMERIC, last_synced_at`.
- **D-14:** Connect/disconnect CTA is display-only (shows platform = 'apple_health' or 'health_connect' from health_sync_log). No actual native Health SDK call in this phase — just show connection status.

### RPE
- **D-15:** The existing RPECalculatorScreen.tsx already has the `calc1RM` logic but has old visual design. Create new `RPEPlugin.tsx` following the dark big-number mockup. Persist last weight/reps/rpe to Zustand store (store.ts already exists in plugins/rpe/src/store.ts or create it).
- **D-16:** RPE Plugin has NO SubTabs — single screen per mockup: dark result card + 3 input rows + zones table. No tab navigation needed.
- **D-17:** `calc1RM`, `rpeToPercent`, `rpeToRIR`, `RPE_VALUES`, `TRAINING_ZONES` imported from `plugins/rpe/src/index.ts` (already exist).

### Pantry
- **D-18:** Tabs: Inventaire / Recettes / Shopping. Inventaire = 3 large category tiles with item counts from `pantry_items` table (or equivalent). If table doesn't exist, show tiles with count = 0 and empty state.
- **D-19:** "Recettes" tab = rule-based match% cards: fetch `pantry_items` + static recipe stubs with ingredient lists; match% = count(pantry_items) matching ingredients / total_ingredients. No AI call needed.
- **D-20:** "Shopping" tab uses `shopping_list` table if it exists; otherwise MMKV-persisted checklist array.
- **D-21:** PantryDashboard.tsx deleted; BarcodeScanner, PantryItemForm, RecipeDetail, PantryRecipes, ShoppingList, RecipeConfirm UNTOUCHED.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mockup Files
- `C:/Users/Anatholy/Downloads/ziko/plugins-2.jsx` lines 474–1014 — ALL 6 Phase 39 plugins (JournalPlugin ~474, CardioPlugin ~558, SupplementsPlugin ~633, WearablesPlugin ~711, RPEPlugin ~780, PantryPlugin ~860)

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-JNL (PLUG-JNL-01–03)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-CRD (PLUG-CRD-01–04)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-SUP (PLUG-SUP-01–02)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-WER (PLUG-WER-01–03)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-RPE (PLUG-RPE-01–03)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-PAN (PLUG-PAN-01–04)

### Existing Screens (to replace)
- `plugins/journal/src/screens/JournalDashboard.tsx` — REPLACE
- `plugins/cardio/src/screens/CardioDashboard.tsx` — REPLACE
- `plugins/supplements/src/screens/SupplementsListScreen.tsx` — REPLACE (as entry point)
- `plugins/wearables/src/screens/WearablesDashboard.tsx` — REPLACE
- `plugins/rpe/src/screens/RPECalculatorScreen.tsx` — REPLACE
- `plugins/pantry/src/screens/PantryDashboard.tsx` — REPLACE

### Untouched Screens (must NOT be modified)
- `plugins/cardio/src/screens/CardioTracker.tsx` — GPS tracker, keep
- `plugins/cardio/src/screens/CardioDetail.tsx` — session detail, keep
- `plugins/cardio/src/screens/CardioLog.tsx` — keep
- `plugins/supplements/src/screens/SupplementDetailScreen.tsx` — keep
- `plugins/supplements/src/screens/SupplementCompareScreen.tsx` — keep
- `plugins/pantry/src/screens/BarcodeScanner.tsx` — keep
- `plugins/pantry/src/screens/PantryItemForm.tsx` — keep
- `plugins/pantry/src/screens/RecipeDetail.tsx` — keep
- `plugins/pantry/src/screens/PantryRecipes.tsx` — keep
- `plugins/pantry/src/screens/ShoppingList.tsx` — keep
- `plugins/pantry/src/screens/RecipeConfirm.tsx` — keep

### Route Wrappers (to update)
- `apps/mobile/app/(app)/(plugins)/journal/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/cardio/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/supplements/list.tsx`
- `apps/mobile/app/(app)/(plugins)/wearables/dashboard.tsx`
- `apps/mobile/app/(app)/(plugins)/rpe/index.tsx`
- `apps/mobile/app/(app)/(plugins)/pantry/dashboard.tsx`

### Design System (Phase 32)
- `packages/ui/src/components/SubTabs.tsx` — `tabs: string[], active: string, onChange: (tab: string) => void` — pill style
- `packages/ui/src/components/AISuggestion.tsx` — `{ text, actionLabel?, onAction?, tintColor? }`
- `packages/ui/src/components/PluginHeader.tsx` — `{ title, onBack, right?, dark? }`

### RPE Logic
- `plugins/rpe/src/index.ts` — `calc1RM(weight, reps, rpe)`, `rpeToPercent(reps, rpe)`, `rpeToRIR(rpe)`, `RPE_VALUES`, `TRAINING_ZONES`

### Database Tables
- `journal_entries` — user_id, mood INT 1–5, energy INT 1–5, stress INT 1–5, context TEXT, notes TEXT, created_at
- `cardio_sessions` — activity_type, duration_min, distance_km, calories, title, route_data JSONB, elevation_gain_m, max_speed_kmh
- `supplements` — id, name TEXT, brand_id UUID, category_id UUID
- `supplement_prices` — supplement_id, source TEXT, price_eur NUMERIC, per_serving_eur NUMERIC
- `wearable_daily_summary` — user_id, date, steps INT, calories_burned INT, active_minutes INT, heart_rate_avg INT, sleep_hours NUMERIC
- `health_sync_log` — user_id, platform TEXT ('apple_health'|'health_connect'), last_sync_at
- RPE: no DB — Zustand store persistence only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Pattern (from Phase 37/38)
```typescript
export default function XPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Nom" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === TABS[0] && <Tab1 />}
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Design Tokens
- background: #F7F6F3, surface: #FFFFFF, border: #E2E0DA
- primary: #FF5C1A, text: #1C1A17, muted: #6B6963
- violet: #7B5BD0 (Journal), cardio: #E94B3C, supplements: #2E9E5B
- Card shadow: shadowColor '#1C1A17', shadowOffset {0,4}, shadowOpacity 0.08, shadowRadius 12, elevation 3
- paddingBottom: 100 on all ScrollViews

### showAlert
- `showAlert` from `@ziko/plugin-sdk` — required everywhere (NOT Alert.alert)

### MMKV persistence
- `import { storage } from '@ziko/plugin-sdk'` or `import { MMKV } from 'react-native-mmkv'`

</code_context>

---
*Phase: 39-remaining-plugins-group2*
*Context gathered: 2026-05-27*

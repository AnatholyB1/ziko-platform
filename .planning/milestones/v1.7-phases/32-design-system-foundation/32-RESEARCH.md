# Phase 32: Design System Foundation — Research

**Researched:** 2026-05-21
**Domain:** React Native shared component library, Expo Router v4 tab navigation, SVG-based UI primitives
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | `packages/ui/src/design-system.ts` codifying all design tokens | Tokens already partially in `components.tsx` (`spacing`, `radius`, `typography`) and fully in `plugin-sdk/src/theme.ts` — new file extracts/consolidates them |
| DS-02 | `FormRing` — 4-segment SVG wellness ring, center score | `react-native-svg` v15.12.1 installed and used in `app/(app)/index.tsx` with identical pattern; local `FormRing` function exists in home screen today — ready to extract |
| DS-03 | `AISuggestion` — inline AI tip card | No shared component; each plugin would inline this — high duplication without it |
| DS-04 | `SubTabs` — segmented horizontal tab bar | Local `activeTab` patterns exist in community plugin; no shared component; each plugin reinvents it |
| DS-05 | `PluginHeader` — back-chevron header with title + optional right | `ScreenHeader` exists in `@ziko/ui` (no back button); need new component with `onBack` prop |
| DS-06 | `WeekStrip` — 7-day date grid with dots | No shared component; used in home screen (`FormeDuJour` section context) — ready to extract |
| DS-07 | `BugFab` + `BugSheet` | `BugReportFAB` + `BugReportModal` exist in `app/(app)/_layout.tsx` and `src/components/BugReportModal.tsx` — refactor into shared component pair matching DS spec |
| DS-08 | `PaywallScreen` | `PaywallScreen` exists at `app/(app)/paywall.tsx` (619 lines) — needs migration to `@ziko/ui` shared component |
| DS-09 | `RechargeSheet` | `RechargeSheet` exported from `app/(app)/paywall.tsx` — needs migration to `@ziko/ui` |
| DS-10 | 3-tab nav restructure (Accueil / Séance / Profil) | Currently 4 tabs (home/workout/store/profile) in `app/(app)/_layout.tsx` — `store` tab removed, `PluginsDrawer` replaces plugin browsing |
| DS-11 | `PluginsDrawer` — 4×grid of 18 plugins | `modules.tsx` exists as a full screen; DS-11 requires a bottom drawer version — different UX |
| DS-12 | `BugFab` mounted at root layout | `BugReportFAB` already at `app/(app)/_layout.tsx` level — needs spec alignment (dark style, right side) |
</phase_requirements>

---

## Summary

Phase 32 establishes the shared component foundation that all subsequent v1.7 phases (33–41) depend on. The primary deliverable is `packages/ui/` augmented with 9 new components plus a consolidated design token file.

The codebase is in good shape for this phase: the key libraries are already installed (`react-native-svg`, `moti`, `react-native-reanimated`, `nativewind`), several of the required components already exist in inline form inside screens, and the design token vocabulary is already codified in `@ziko/plugin-sdk`'s `ThemePalette`. The work is predominantly **extraction + standardization + one structural change** (tab nav from 4 to 3), not greenfield invention.

Two components require careful migration: `PaywallScreen` and `RechargeSheet` currently live in `app/(app)/paywall.tsx` (619 lines) as a screen file. They must be moved to `packages/ui/` without breaking the existing paywall route. Similarly, `BugReportModal` and `BugReportFAB` in `src/components/` must be replaced by the new `BugFab`/`BugSheet` pair per the updated design spec (dark style, right-side position, 42px size).

The 3-tab nav restructure removes the `store` tab entry from `app/(app)/_layout.tsx`. The store screen itself (`app/(app)/store/`) is NOT deleted — it remains navigable from other surfaces. The `modules` screen (`app/(app)/modules.tsx`) will be superseded by the `PluginsDrawer` bottom drawer for in-context plugin browsing.

**Primary recommendation:** Extract and standardize first (tokens, FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip), then migrate existing components (BugFab/BugSheet from BugReportModal, PaywallScreen/RechargeSheet from paywall.tsx), then do the structural nav change last to minimize blast radius.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design tokens | `packages/ui/` | `@ziko/plugin-sdk` (ThemePalette) | Tokens shared by all consumers; runtime theme lives in SDK; static tokens live in UI |
| FormRing (SVG ring) | `packages/ui/` | — | Pure rendering primitive; no business logic; consumed by home + profile |
| AISuggestion card | `packages/ui/` | — | Standardized UI only; tip content provided by caller |
| SubTabs | `packages/ui/` | — | Pure UI primitive; state managed by caller |
| PluginHeader | `packages/ui/` | — | Pure UI primitive wrapping back navigation |
| WeekStrip | `packages/ui/` | — | Pure UI; date logic provided by caller |
| BugFab / BugSheet | `packages/ui/` (components) + `app/` (mounting) | Supabase `bug_reports` table | FAB triggers sheet; sheet submits to DB; global mount at `_layout.tsx` level |
| PaywallScreen | `packages/ui/` (component) + `app/(app)/paywall.tsx` (route) | — | Screen component moves to UI pkg; route file becomes thin wrapper |
| RechargeSheet | `packages/ui/` | — | Bottom sheet modal; caller controls visibility |
| PluginsDrawer | `packages/ui/` (component) + `@ziko/plugin-sdk` (registry) | — | Grid of plugins; reads from `usePluginRegistry`; navigation by caller |
| 3-tab nav restructure | `app/(app)/_layout.tsx` | — | Expo Router Tabs definition; purely structural |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Installed Version | Purpose | Status |
|---------|-------------------|---------|--------|
| `react-native-svg` | `^15.12.1` (latest: 15.15.5) | SVG rendering for FormRing, progress rings, sparklines | [VERIFIED: npm registry] — in `apps/mobile/package.json` |
| `moti` | `^0.29.0` (latest: 0.30.0) | Animation for BugSheet slide-in, ProgressBar, Skeleton | [VERIFIED: npm registry] — used in `packages/ui/src/components.tsx` |
| `react-native-reanimated` | `~4.1.1` (latest: 4.3.1) | Foundation for moti and advanced animations | [VERIFIED: npm registry] — in `apps/mobile/package.json` |
| `expo-linear-gradient` | `~15.0.8` | Gradient backgrounds (PaywallScreen dark radial effect) | [VERIFIED: npm registry] — in `apps/mobile/package.json` |
| `react-native-gesture-handler` | `~2.28.0` | Gesture support (GestureHandlerRootView already in root) | [VERIFIED: npm registry] — in `apps/mobile/package.json` |
| `@expo/vector-icons` | `^15.1.1` | Ionicons for all icon usage | [VERIFIED: npm registry] — in `apps/mobile/package.json` |

### Design Token Authority

| Source | Role | Fields |
|--------|------|--------|
| `packages/plugin-sdk/src/theme.ts` (`DEFAULT_THEME`) | Runtime theme via `useThemeStore` | All 28+ semantic color tokens, font tokens, card style |
| `packages/ui/src/components.tsx` (exported `spacing`, `radius`, `typography`) | Static structural tokens | spacing scale xs–xxl, radius sm–full, typography h1–caption |
| `packages/ui/src/design-system.ts` (NEW) | Consolidated static token file | Shadow spec, semantic color aliases, all tokens in one import |

**No new packages required for Phase 32.** All dependencies are present.

### Alternatives Considered

| Standard Approach | Alternative | Why Standard Wins |
|-------------------|-------------|-------------------|
| Inline style objects (project pattern) | NativeWind `className=` | NativeWind is installed but has ZERO `className` usage in mobile app — project convention is 100% inline styles; do NOT switch |
| Modal-based bottom sheets (moti slide-in) | `@gorhom/bottom-sheet` | `@gorhom/bottom-sheet` NOT installed; existing BugReportModal and CreditExhaustionSheet both use `Modal + MotiView` pattern — match this |
| `react-native-svg` Svg/Circle/Path | Skia, ART | SVG already proven in `index.tsx` and `profile/index.tsx` |

---

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries were pre-installed and are well-established.

| Package | Registry | Age | Status |
|---------|----------|-----|--------|
| `react-native-svg` | npm | 10+ yrs | [OK] — official community package, 3M+ weekly downloads |
| `moti` | npm | 4+ yrs | [OK] — Fernando Rojo's animation library, widely used |
| `react-native-reanimated` | npm | 6+ yrs | [OK] — Software Mansion official, 3M+ weekly downloads |

**Packages removed due to slopcheck:** none  
**New packages flagged:** none (no new installs)

---

## Architecture Patterns

### System Architecture Diagram

```
packages/ui/src/
├── design-system.ts          ← NEW: static tokens (shadow spec, color aliases)
├── components.tsx            ← EXTENDED: add 9 new components
└── index.ts                  ← EXTENDED: export new components

@ziko/plugin-sdk (ThemePalette)
└── useThemeStore()           ← runtime theme; NEW components read this

app/(app)/_layout.tsx         ← MODIFIED: 3 tabs instead of 4; BugFab→new component
app/(app)/paywall.tsx         ← MODIFIED: thin wrapper importing from @ziko/ui

Data flow: screen → useThemeStore → ThemePalette → component inline styles
Data flow: BugFab tap → useBugStore.show() → BugSheet renders → supabase.insert(bug_reports)
Data flow: PluginsDrawer → usePluginRegistry(installedPlugins, manifests) → grid render
```

### Recommended Project Structure for Phase 32

```
packages/ui/src/
├── design-system.ts         # NEW: all static tokens + shadow constants
├── components.tsx           # EXTENDED: existing + 9 new components
└── index.ts                 # EXTENDED: export all new components

apps/mobile/app/(app)/
├── _layout.tsx              # MODIFIED: 3-tab structure, BugFab from @ziko/ui
├── paywall.tsx              # MODIFIED: thin wrapper around @ziko/ui PaywallScreen
└── modules.tsx              # UNCHANGED: kept as full screen (PluginsDrawer is new)
```

### Pattern 1: Inline style objects with `useThemeStore`

Every component in this project uses this pattern. All 9 new components MUST follow it.

```typescript
// Source: packages/ui/src/components.tsx (existing pattern)
import { useThemeStore } from '@ziko/plugin-sdk';

export function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border }}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(tab)}
          style={{ paddingVertical: 12, paddingHorizontal: 16 }}
        >
          <Text style={{ color: active === tab ? theme.primary : theme.muted, fontWeight: active === tab ? '600' : '400' }}>
            {tab}
          </Text>
          {active === tab && (
            <View style={{ height: 2, backgroundColor: theme.primary, borderRadius: 1, marginTop: 6 }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

### Pattern 2: SVG ring with react-native-svg (Svg + Circle)

Established pattern — the home screen already has a `FormRing` inline function using this exact approach. Extract it to `packages/ui/`.

```typescript
// Source: apps/mobile/app/(app)/index.tsx (existing inline FormRing)
import Svg, { Circle } from 'react-native-svg';

// 4-segment ring: each segment is a Circle with strokeDasharray for partial arc
// segments: sleep (violet), water (info/blue), nutrition (primary/orange), load (success/green)
// center score rendered as absolute-positioned Text overlaid on Svg
```

Key SVG parameters (from existing implementation):
- `SIZE = 140`, `STROKE = 11`, `r = (SIZE - STROKE) / 2`
- `C = 2 * Math.PI * r` (circumference)
- Each segment: `portion = value / total * 0.92` (0.92 leaves gap between segments)
- `strokeDashoffset` rotates segment to correct position

### Pattern 3: Modal-based bottom sheet (moti slide-in)

The established bottom sheet pattern — used by `BugReportModal` and `CreditExhaustionSheet`. All new sheets must match:

```typescript
// Source: apps/mobile/src/components/CreditExhaustionSheet.tsx (existing pattern)
<Modal visible={visible} transparent animationType="none" statusBarTranslucent>
  <TouchableOpacity activeOpacity={1} onPress={onClose}
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
    <TouchableOpacity activeOpacity={1} onPress={() => {}}>
      <MotiView
        from={{ translateY: 300 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, ... }}
      >
        {/* content */}
      </MotiView>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

**Important:** The `TouchableOpacity` nesting (outer dismisses, inner absorbs taps) is the established pattern for preventing backdrop-tap propagation. Replicate exactly.

### Pattern 4: Zustand store for FAB/modal visibility

```typescript
// Source: apps/mobile/src/components/BugReportModal.tsx (existing BugReportStore)
export const useBugStore = create<BugState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
export function showBugReport() { useBugStore.getState().show(); }
```

The `BugFab`/`BugSheet` pair should follow this same imperative-trigger pattern. The new `BugFab` component exported from `@ziko/ui` calls the store's `show()` function.

**Critical:** `packages/ui/` cannot import from `apps/mobile/src/stores/` (wrong package direction). The store for BugFab visibility must live either in `@ziko/ui` or remain in the app and be passed as a prop. **Recommended:** Keep the Zustand store co-located with `BugSheet` inside `packages/ui/` since the SDK already depends on Zustand. The `showBugReport()` function is exported alongside the components.

### Anti-Patterns to Avoid

- **NativeWind `className=`**: Installed but unused in mobile. The project is 100% inline styles. Do not introduce `className` in new components.
- **StyleSheet.create()**: CLAUDE.md explicitly prohibits `StyleSheet` — use inline style objects only.
- **`@gorhom/bottom-sheet` import**: Not installed. All sheets use Modal + MotiView pattern.
- **Importing from `apps/mobile/src/` inside `packages/ui/`**: Breaks monorepo dependency direction. UI pkg may only import from `@ziko/plugin-sdk` and React Native.
- **Alert.alert()**: CLAUDE.md requires `showAlert` from `@ziko/plugin-sdk` everywhere in plugins/components.
- **Emoji in Icon fields**: Ionicons string names only (`'bug-outline'`, not `🐛`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG ring segments | Custom trigonometry/canvas | `react-native-svg` `Circle` with `strokeDasharray` | Already proven in home screen; handles all edge cases |
| Animation (slide-in sheets) | `Animated` API | `moti` `MotiView` with `from/animate` | Already used in 5+ components; consistent spring/timing |
| Bottom sheet behavior | Custom pan gesture | `Modal + MotiView` (project pattern) | `@gorhom/bottom-sheet` not installed; Modal pattern is proven |
| Theme colors in components | Hardcoded hex strings | `useThemeStore((s) => s.theme)` then `theme.primary`, `theme.border` etc. | Required for multi-theme support; pattern is universal in codebase |
| Plugin list | Manual PLUGIN_ICONS array | `usePluginRegistry((s) => s.manifests)` + `usePluginRegistry((s) => s.installedPlugins)` | Registry is the source of truth; already used in `modules.tsx` |

---

## Existing Component Inventory (Critical for Plan)

### What already exists and must be MIGRATED (not rebuilt):

| Current Location | Component | New Home | Action |
|-----------------|-----------|----------|--------|
| `apps/mobile/app/(app)/index.tsx` (inline) | `FormRing` function | `packages/ui/src/` | Extract + augment with `score` prop + `size` prop |
| `apps/mobile/app/(app)/index.tsx` (inline) | `FormeDuJour` section structure | — | Reference for WeekStrip data shape |
| `apps/mobile/src/components/BugReportModal.tsx` | `BugReportModal` + `showBugReport` + `useBugReportStore` | `packages/ui/src/` as `BugSheet` + `BugFab` | Migrate + apply DS-07 spec (dark 42px FAB, 5 type chips, simplified UX) |
| `apps/mobile/app/(app)/_layout.tsx` | `BugReportFAB` (inline function) | Replace with import from `@ziko/ui` | Remove inline function; import `BugFab` |
| `apps/mobile/app/(app)/paywall.tsx` | `PaywallScreen` (default export) + `RechargeSheet` (named export) | `packages/ui/src/` | Migrate both; `paywall.tsx` becomes thin wrapper |
| `apps/mobile/app/(app)/modules.tsx` | Plugin grid screen | Stays as screen | `PluginsDrawer` is a NEW bottom drawer — different from the full modules screen |

### What is NEW (no existing code):

- `design-system.ts` — token consolidation file
- `AISuggestion` — no version exists anywhere
- `SubTabs` — local `activeTab` patterns exist in plugins but no shared component
- `PluginHeader` — `ScreenHeader` exists but lacks `onBack`; new component
- `WeekStrip` — no shared version
- `PluginsDrawer` — `modules.tsx` is a full screen; drawer is new UX pattern

### What already partially exists in `packages/ui/src/components.tsx`:

| Existing Export | Relationship to DS-01 |
|----------------|----------------------|
| `spacing` (xs–xxl) | Already covers spacing scale — DS-01 adds shadow spec |
| `radius` (sm–full) | Already covers border-radius — DS-01 consolidates |
| `typography` (h1–caption) | Already covers type scale — DS-01 adds shadow tokens |
| `ScreenHeader` | Similar to PluginHeader but no `onBack`; keep both |

---

## Tab Navigation Restructure (DS-10) — Detailed Analysis

### Current 4-Tab Structure (`app/(app)/_layout.tsx`)

```
Tabs.Screen name="index"    → title: t('tab.home'),    icon: home
Tabs.Screen name="workout"  → title: t('tab.workout'), icon: barbell
Tabs.Screen name="store"    → title: t('tab.store'),   icon: grid     ← REMOVE from tab bar
Tabs.Screen name="profile"  → title: t('tab.profile'), icon: person
```

The `store` tab gets removed from the **tab bar** (set `href: null`), NOT deleted. The store screen continues to exist and is navigable from other places (e.g., profile screen's "Gérer mes modules" row).

### Target 3-Tab Structure

```
Tabs.Screen name="index"    → title: "Accueil",  icon: home
Tabs.Screen name="workout"  → title: "Séance",   icon: barbell
Tabs.Screen name="profile"  → title: "Profil",   icon: person
```

All other screens remain as hidden `Tabs.Screen` entries with `href: null` (unchanged pattern). The `BugReportFAB` inline function is replaced with `<BugFab />` from `@ziko/ui`. The `ChatFAB` (community chat) is evaluated — it may be removed or kept; the mockup spec (DS-10) does not mention it, so the plan should remove it in the nav restructure step.

### Translation key impact

Current: `t('tab.home')`, `t('tab.workout')`, `t('tab.store')`, `t('tab.profile')` — all 4 exist in i18n. Target: same keys for home/workout/profile; `tab.store` key becomes unused. No new keys needed.

---

## Common Pitfalls

### Pitfall 1: Package Direction Violation

**What goes wrong:** `packages/ui/src/` imports from `apps/mobile/src/` — e.g., importing `useCreditStore` for a RechargeSheet button behavior.
**Why it happens:** It's tempting to reach for the nearest store from a component in `@ziko/ui`.
**How to avoid:** `packages/ui/` may only import from `react`, `react-native`, `@ziko/plugin-sdk`, `moti`, `react-native-svg`, `@expo/vector-icons`, and `expo-linear-gradient`. All business logic must be injected via props or callbacks.
**Warning signs:** TypeScript compile error "relative import outside package boundary"; or build succeeds locally but fails in another package.

### Pitfall 2: BugReportModal Migration Breaks Root Layout

**What goes wrong:** After migrating `BugReportModal` to `@ziko/ui` as `BugSheet`, the root `_layout.tsx` still renders the old `<BugReportModal />` — causing two sheets to appear.
**Why it happens:** The root layout imports both the old and new components during migration.
**How to avoid:** In the same commit that adds `<BugFab />` and `<BugSheet />` to the layout, remove the `<BugReportModal />` import and the `BugReportFAB` inline function. Single atomic change.

### Pitfall 3: SVG `strokeDashoffset` Segment Overlap

**What goes wrong:** FormRing segments visually overlap or have gaps that don't match the mockup.
**Why it happens:** The offset calculation must account for the starting rotation (`-C * 0.25` rotates arc start to 12 o'clock) AND each segment's prior portion.
**How to avoid:** Use the exact formula from `apps/mobile/app/(app)/index.tsx`'s `FormRing` function — it is already correct. Do not rewrite; extract.
**Warning signs:** First segment not starting at top of ring; gaps uneven.

### Pitfall 4: PaywallScreen Migration — Route File Must Remain

**What goes wrong:** Moving `PaywallScreen` to `@ziko/ui` and deleting `app/(app)/paywall.tsx` — this removes the Expo Router route, breaking all `router.push('/(app)/paywall')` calls.
**Why it happens:** Confusing the component with the route.
**How to avoid:** Keep `app/(app)/paywall.tsx` as a thin wrapper:
```typescript
import { PaywallScreen } from '@ziko/ui';
export default PaywallScreen; // or a wrapper with router.back()
```
**Warning signs:** TypeScript no-error but runtime 404 on paywall navigation.

### Pitfall 5: NativeWind Class vs Inline Style Inconsistency

**What goes wrong:** A new component uses `className="bg-primary"` because NativeWind is configured and works.
**Why it happens:** Developer sees `tailwind.config.js` and NativeWind in `package.json` and assumes it's the pattern.
**How to avoid:** The codebase has ZERO `className=` usages in mobile app or plugin code. Use inline style objects exclusively.
**Warning signs:** `className` prop in any `.tsx` file under `apps/mobile/` or `plugins/`.

### Pitfall 6: `PluginsDrawer` Using `modules.tsx` Logic Directly

**What goes wrong:** Duplicating the toggle/enable/disable logic from `modules.tsx` into `PluginsDrawer`.
**Why it happens:** `modules.tsx` shows plugins with enable/disable toggles; it's tempting to reuse.
**How to avoid:** `PluginsDrawer` (DS-11) is a **navigation-only** drawer: tap a plugin → navigate to its route. It does NOT enable/disable plugins. The only state it needs is `installedPlugins` + `manifests` from `usePluginRegistry`.
**Warning signs:** `enablePlugin`/`disablePlugin` imports in `PluginsDrawer`.

---

## Code Examples

### FormRing — extracted and augmented from home screen

```typescript
// Source: apps/mobile/app/(app)/index.tsx (existing inline function)
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

interface FormRingProps {
  score: number;                            // 0–100 center display
  parts: { value: number; max: number; color: string }[];  // DS-02 spec
  size?: number;                            // default 140
}

export function FormRing({ score, parts, size = 140 }: FormRingProps) {
  const STROKE = 11;
  const r = (size - STROKE) / 2;
  const C = 2 * Math.PI * r;
  // Normalize: value/max → 0–1, multiply by 0.92 for segment gap
  const total = parts.reduce((s, p) => s + Math.min(p.value / p.max, 1), 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(28,26,23,0.06)" strokeWidth={STROKE} fill="none" />
        {/* Segments */}
        {parts.map((p, i) => {
          const pct = Math.min(p.value / p.max, 1);
          const portion = (pct / parts.length) * 0.92;
          const len = C * portion;
          const dashOffset = -(offset * C) - (C * 0.25);
          offset += (1 / parts.length) * 0.94;
          return (
            <Circle key={i} cx={size/2} cy={size/2} r={r}
              stroke={p.color} strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={[len, C - len]} strokeDashoffset={dashOffset} fill="none" />
          );
        })}
      </Svg>
      {/* Center score */}
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#1C1A17' }}>{score}</Text>
    </View>
  );
}
```

### BugFab — DS-07 spec (dark, right side, 42px)

```typescript
// Source: DS-07 spec interpretation — adapts from BugReportFAB in app/(app)/_layout.tsx
// Key differences from current: dark bg (#1C1A17), right side (right: 20), 42px size
export function BugFab() {
  const { bottom } = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={() => showBugReport()}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: 80 + bottom,   // above tab bar
        right: 20,             // DS-07: bottom-right
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#1C1A17',  // DS-07: dark
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.25,
        shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        elevation: 8, zIndex: 999,
      }}
    >
      <Ionicons name="bug-outline" size={20} color="#FFFAF6" />
    </TouchableOpacity>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 32 |
|--------------|------------------|---------------------|
| Expo Router `<Tabs>` with many tabs | Expo Router `<Tabs>` with 3 tabs + `href: null` for hidden screens | Same API; just remove `store` tab from visible list |
| `@gorhom/bottom-sheet` (common in ecosystem) | `Modal + MotiView` pattern | Already project convention; no library change |
| Global store in `apps/` | Global store in `packages/ui/` | New pattern for `BugSheet` — viable since SDK already uses Zustand |

**Deprecated/outdated patterns in this codebase:**
- `Alert.alert()` — replaced by `showAlert` from `@ziko/plugin-sdk` (CLAUDE.md rule)
- Inline FAB components in `_layout.tsx` — replaced by imported `<BugFab />` from `@ziko/ui`
- 4-tab navigation — replaced by 3-tab structure per v1.7 mockup

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ChatFAB` (community chat floating button) should be removed in the 3-tab restructure | Tab Navigation Analysis | If ChatFAB should remain, plan step keeps it — low risk, easy to keep |
| A2 | `PluginsDrawer` Zustand store (visibility state) can live in `packages/ui/` | Architecture Patterns | If SDK peer dependency chain prevents this, store must be passed as props |
| A3 | `app/(app)/modules.tsx` remains unchanged in Phase 32 | Existing Component Inventory | If modules.tsx is to be removed in Phase 32, additional cleanup work needed |

**Note:** All package version data confirmed via npm registry in this session.

---

## Open Questions

1. **ChatFAB removal**
   - What we know: The v1.7 3-tab mockup shows no floating chat button; DS-10 says PluginsDrawer replaces plugin browsing tab
   - What's unclear: Whether the ChatFAB (community chat quick-launch) is intentionally removed or just not mentioned
   - Recommendation: Remove ChatFAB in the nav restructure plan step; note it as a behavior change the user should confirm

2. **BugSheet UX alignment with DS-07 vs existing BugReportModal**
   - What we know: DS-07 specifies "5 type chips, textarea, screenshot-attach toggle, send button"; existing `BugReportModal` has 3-step flow (title→description→severity)
   - What's unclear: Whether DS-07 replaces the 3-step flow entirely or augments it
   - Recommendation: DS-07 describes a simpler single-sheet UX; plan should implement DS-07 spec (replace the 3-step flow with single-sheet chips + textarea)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-native-svg` | DS-02 FormRing | ✓ | `^15.12.1` in package.json | — |
| `moti` | DS-07 BugSheet animations | ✓ | `^0.29.0` in package.json | — |
| `react-native-reanimated` | moti dependency | ✓ | `~4.1.1` in package.json | — |
| `expo-linear-gradient` | DS-08 PaywallScreen dark glow | ✓ | `~15.0.8` in package.json | — |
| `@expo/vector-icons` (Ionicons) | All icon usage | ✓ | `^15.1.1` in package.json | — |
| TypeScript | Type checking | ✓ | `^5.7.0` in devDeps | — |

**Missing dependencies with no fallback:** None  
**Missing dependencies with fallback:** None

All required libraries are pre-installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compile check (no Jest/Vitest configured) |
| Config file | `tsconfig.json` in each package + root |
| Quick run command | `npm run type-check` from repo root |
| Full suite command | `npm run type-check` (covers all packages via Turborepo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | `design-system.ts` exports all tokens (no TypeScript errors) | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-02 | `FormRing` renders without runtime SVG errors | compile + visual | `npm run type-check` | ❌ Wave 0 — new file |
| DS-03 | `AISuggestion` accepts required props | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-04 | `SubTabs` `onChange` fires with correct tab string | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-05 | `PluginHeader` renders title + calls `onBack` | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-06 | `WeekStrip` renders 7 day cells | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-07 | `BugFab` + `BugSheet` render; sheet submits to Supabase | compile + manual | `npm run type-check` | ❌ Wave 0 — new file |
| DS-08 | `PaywallScreen` renders 3 plan cards + feature table | compile | `npm run type-check` | ✅ exists (migration) |
| DS-09 | `RechargeSheet` renders 3 credit packs | compile | `npm run type-check` | ✅ exists (migration) |
| DS-10 | App has exactly 3 tabs; TypeScript clean | compile | `npm run type-check` | ✅ `_layout.tsx` exists |
| DS-11 | `PluginsDrawer` renders 18 plugin grid | compile | `npm run type-check` | ❌ Wave 0 — new file |
| DS-12 | `BugFab` appears on every screen | manual smoke | `npx expo start` visual check | ✅ (restructured from existing) |

### Sampling Rate

- **Per task commit:** `npm run type-check`
- **Per wave merge:** `npm run type-check` (full suite)
- **Phase gate:** TypeScript clean compile across all packages before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/ui/src/design-system.ts` — must exist before other new components import from it
- [ ] New component types in `packages/ui/src/components.tsx` — all 9 components
- [ ] Updated `packages/ui/src/index.ts` — export all new components

*(No existing test files to update — project uses TypeScript compile as primary correctness gate)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (BugSheet textarea) | Max length enforced; no HTML injection risk in RN |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| BugSheet free-text injection | Tampering | Supabase insert with RLS; `auth.uid() = user_id` policy on `bug_reports` table (migration 015) |
| Paywall plan selection bypass | Elevation of Privilege | Purchase validation happens server-side (Stripe/RevenueCat not yet integrated); DS-08 is UI-only for now |

---

## Sources

### Primary (HIGH confidence)

- `apps/mobile/app/(app)/_layout.tsx` — current 4-tab structure, FAB implementations, root component tree
- `apps/mobile/app/(app)/index.tsx` — existing inline `FormRing` implementation, SVG pattern
- `packages/ui/src/components.tsx` — existing shared components, inline style pattern, `useThemeStore` usage
- `packages/ui/src/index.ts` — current exports
- `packages/plugin-sdk/src/theme.ts` — `ThemePalette` interface, `DEFAULT_THEME`, `useThemeStore`
- `apps/mobile/src/components/BugReportModal.tsx` — existing bug report modal (to be migrated)
- `apps/mobile/app/(app)/paywall.tsx` — existing `PaywallScreen` + `RechargeSheet` (to be migrated)
- `apps/mobile/package.json` — installed dependencies
- `apps/mobile/tailwind.config.js` — NativeWind config (confirmed not used in practice)
- `apps/mobile/babel.config.js` — Babel config; confirms `nativewind` preset present

### Secondary (MEDIUM confidence)

- npm registry versions for `react-native-svg` (15.15.5), `moti` (0.30.0), `react-native-reanimated` (4.3.1) — installed versions are slightly behind latest but compatible

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed installed and in use
- Architecture: HIGH — all patterns derived from existing working code
- Pitfalls: HIGH — all derived from observed code patterns and known project constraints
- Nav restructure: HIGH — Expo Router Tabs API is stable and straightforward

**Research date:** 2026-05-21  
**Valid until:** 2026-06-21 (stable stack; 30-day window)

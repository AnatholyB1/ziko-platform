# Phase 32: Design System Foundation — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 13 (10 new/migrated components + 3 structural modifications)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/ui/src/design-system.ts` | config/tokens | — | `packages/ui/src/components.tsx` (spacing/radius/typography exports) + `packages/plugin-sdk/src/theme.ts` (DEFAULT_THEME) | role-match |
| `packages/ui/src/components/FormRing.tsx` | component | transform | `apps/mobile/app/(app)/index.tsx` inline `FormRing` function (lines 44–77) | exact |
| `packages/ui/src/components/AISuggestion.tsx` | component | request-response | `packages/ui/src/components.tsx` `Card` component (lines 144–183) | role-match |
| `packages/ui/src/components/SubTabs.tsx` | component | event-driven | `plugins/community/src/screens/CommunityDashboard.tsx` inline tabs (lines 95–111) | exact |
| `packages/ui/src/components/PluginHeader.tsx` | component | event-driven | `packages/ui/src/components.tsx` `ScreenHeader` (lines 267–294) + `apps/mobile/app/(app)/modules.tsx` back-chevron header (lines 73–93) | role-match |
| `packages/ui/src/components/WeekStrip.tsx` | component | transform | `apps/mobile/app/(app)/index.tsx` inline `WeekStrip` function (lines 317–373) | exact |
| `packages/ui/src/components/BugFab.tsx` | component | event-driven | `apps/mobile/app/(app)/_layout.tsx` inline `BugReportFAB` function (lines 13–43) | exact |
| `packages/ui/src/components/BugSheet.tsx` | component | request-response | `apps/mobile/src/components/BugReportModal.tsx` (entire file, 412 lines) | exact |
| `packages/ui/src/components/PaywallScreen.tsx` | component | request-response | `apps/mobile/app/(app)/paywall.tsx` default export `PaywallScreen` (lines 322–619) | exact (migrate) |
| `packages/ui/src/components/RechargeSheet.tsx` | component | request-response | `apps/mobile/app/(app)/paywall.tsx` named export `RechargeSheet` (lines 92–320) | exact (migrate) |
| `packages/ui/src/components/PluginsDrawer.tsx` | component | event-driven | `apps/mobile/app/(app)/index.tsx` inline `PluginsDrawer` function (lines 375–429) | exact |
| `apps/mobile/app/(app)/(tabs)/_layout.tsx` | config/nav | — | `apps/mobile/app/(app)/_layout.tsx` current 4-tab Tabs structure (lines 94–166) | exact (modify) |
| `apps/mobile/app/_layout.tsx` | config/layout | — | `apps/mobile/app/_layout.tsx` (entire file — add `<BugFab />` alongside existing `<BugReportModal />`) | exact (modify) |
| `packages/ui/src/index.ts` | config/exports | — | `packages/ui/src/index.ts` current 13-item export list (lines 1–15) | exact (extend) |

---

## Pattern Assignments

### `packages/ui/src/design-system.ts` (config/tokens)

**Analogs:** `packages/ui/src/components.tsx` lines 17–42, `packages/plugin-sdk/src/theme.ts` lines 37–63

**Existing tokens to consolidate** (`packages/ui/src/components.tsx` lines 17–42):
```typescript
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius  = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;
export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
} as const;
```

**New tokens to add** (shadow spec from `components.tsx` `resolveCardStyle`, lines 54–62; colors from `DEFAULT_THEME`):
```typescript
export const shadow = {
  card: {
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Static color aliases (source of truth: DEFAULT_THEME in plugin-sdk/src/theme.ts lines 37–63)
export const colors = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E2E0DA',
  primary: '#FF5C1A',
  text: '#1C1A17',
  muted: '#6B6963',
  cardDark: '#1C1A17',
  cardDarkText: '#FFFAF6',
  success: '#2E9E5B',
  info: '#2E7BF6',
  violet: '#7B5BD0',
  warn: '#E8A33A',
  danger: '#EF4444',
} as const;
```

**Critical:** `design-system.ts` must re-export (not duplicate) `spacing`, `radius`, `typography` from `components.tsx` to avoid two sources of truth, OR move them here and re-export from `components.tsx`.

---

### `packages/ui/src/components/FormRing.tsx` (component, transform)

**Analog:** `apps/mobile/app/(app)/index.tsx` lines 44–77

**Imports pattern** (copy from index.tsx line 6):
```typescript
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
```

**Core SVG ring pattern** (`apps/mobile/app/(app)/index.tsx` lines 44–77 — extract verbatim, augment with props):
```typescript
interface FormRingProps {
  score: number;                                         // 0–100 center display
  parts: { value: number; max: number; color: string }[];  // DS-02: sleep/water/nutrition/load
  size?: number;                                         // default 140
}

export function FormRing({ score, parts, size = 140 }: FormRingProps) {
  const STROKE = 11;
  const r = (size - STROKE) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track circle */}
        <Circle cx={size/2} cy={size/2} r={r}
          stroke="rgba(28,26,23,0.06)" strokeWidth={STROKE} fill="none" />
        {/* Segments — existing formula from index.tsx lines 58–73 */}
        {parts.map((p, i) => {
          const portion = parts.length > 0 ? (Math.min(p.value / p.max, 1) / parts.length) * 0.92 : 0;
          const len = C * portion;
          const dashOffset = -(offset * C) - (C * 0.25);
          offset += portion + 0.02;   // same gap constant as index.tsx line 72
          return (
            <Circle key={i} cx={size/2} cy={size/2} r={r}
              stroke={p.color} strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={[len, C - len]} strokeDashoffset={dashOffset} fill="none" />
          );
        })}
      </Svg>
      {/* Center score — absolute positioned Text over SVG */}
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#1C1A17' }}>{score}</Text>
    </View>
  );
}
```

**Pitfall:** The offset accumulation formula in the live file is `offset += portion + 0.02` (`index.tsx` line 72). Do not recompute — copy exactly. Rewriting the formula causes segment overlap (Pitfall 3 in RESEARCH.md).

---

### `packages/ui/src/components/AISuggestion.tsx` (component, request-response)

**Analog:** `packages/ui/src/components.tsx` `Card` component (lines 144–183) + `Badge` (lines 186–207)

**Imports pattern** (same as all components.tsx imports):
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
```

**Props interface** (derived from DS-03 spec):
```typescript
interface AISuggestionProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tintColor?: string;   // default: theme.primary
}
```

**Core card pattern** (copy `Card`'s shadow style from `components.tsx` lines 54–62, add tint strip):
```typescript
export function AISuggestion({ text, actionLabel, onAction, tintColor }: AISuggestionProps) {
  const theme = useThemeStore((s) => s.theme);
  const tint = tintColor ?? theme.primary;
  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderLeftWidth: 3,
      borderLeftColor: tint,        // DS-03: colored tint strip
      padding: 14,
      shadowColor: theme.cardDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Ionicons name="sparkles" size={16} color={tint} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 18 }}>{text}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tint }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

### `packages/ui/src/components/SubTabs.tsx` (component, event-driven)

**Analog:** `plugins/community/src/screens/CommunityDashboard.tsx` lines 94–111

**The community dashboard uses pill-style tabs (dark bg active); DS-04 spec requires underline-style (orange underline). Use community structure but change active indicator.**

**Imports pattern:**
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
```

**Props interface:**
```typescript
interface SubTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}
```

**Core tab pattern** (community tabs structure `CommunityDashboard.tsx` lines 94–111, adapted to underline spec):
```typescript
export function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border }}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(tab)}
          style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}
        >
          <Text style={{
            fontSize: 13, fontWeight: active === tab ? '700' : '500',
            color: active === tab ? theme.text : theme.muted,
          }}>
            {tab}
          </Text>
          {active === tab && (
            <View style={{
              position: 'absolute', bottom: 0,
              height: 2, width: '100%', backgroundColor: theme.primary, borderRadius: 1,
            }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

### `packages/ui/src/components/PluginHeader.tsx` (component, event-driven)

**Analogs:**
- `packages/ui/src/components.tsx` `ScreenHeader` (lines 267–294) — title + optional right, no back
- `apps/mobile/app/(app)/modules.tsx` back-chevron header (lines 73–93) — back button pattern

**Imports pattern** (modules.tsx line 5 + components.tsx pattern):
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { spacing, typography } from './design-system';  // or from '../components'
```

**Props interface:**
```typescript
interface PluginHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}
```

**Back button pattern** (`apps/mobile/app/(app)/modules.tsx` lines 73–93):
```typescript
// Back button (exact style from modules.tsx lines 76–82)
<TouchableOpacity
  onPress={onBack}
  style={{
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: theme.text + '10',
    alignItems: 'center', justifyContent: 'center',
  }}
>
  <Ionicons name="chevron-back" size={16} color={theme.text} />
</TouchableOpacity>
```

**Full component** (combines modules.tsx back button + ScreenHeader's title/right structure):
```typescript
export function PluginHeader({ title, onBack, right }: PluginHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, paddingTop: 10,
    }}>
      <TouchableOpacity onPress={onBack} style={{
        width: 34, height: 34, borderRadius: 11,
        backgroundColor: theme.text + '10',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4, flex: 1 }}>
        {title}
      </Text>
      {right && <View>{right}</View>}
    </View>
  );
}
```

---

### `packages/ui/src/components/WeekStrip.tsx` (component, transform)

**Analog:** `apps/mobile/app/(app)/index.tsx` lines 317–373

**Imports pattern** (index.tsx lines 13):
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import { useThemeStore } from '@ziko/plugin-sdk';
```

**Props interface** (DS-06 spec — caller controls selection state):
```typescript
interface WeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  dotDates?: Set<string>;  // 'yyyy-MM-dd' strings for dot indicators
}
```

**Core 7-day grid pattern** (`apps/mobile/app/(app)/index.tsx` lines 322–372 — extract with `selectedDate`/`onSelect` replacing the `isToday` highlight logic):
```typescript
// Key logic from index.tsx lines 324–332
const today = startOfDay(new Date());
const jsToday = getDay(today);
const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
const monday = addDays(today, mondayOffset);
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const days = Array.from({ length: 7 }, (_, i) => {
  const date = addDays(monday, i);
  const key = format(date, 'yyyy-MM-dd');
  const isToday = differenceInCalendarDays(date, today) === 0;
  const isSelected = differenceInCalendarDays(date, selectedDate) === 0;
  const hasDot = dotDates?.has(key) ?? false;
  return { label: DAY_LABELS[i], num: format(date, 'd'), date, isToday, isSelected, hasDot };
});
```

**Day cell render pattern** (index.tsx lines 350–369 — adapt active indicator to DS-06 orange pill):
```typescript
// Today highlighted with orange pill (DS-06), dot indicator below number
{days.map((d, i) => (
  <TouchableOpacity key={i} onPress={() => onSelect(d.date)}
    style={{
      flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
      backgroundColor: d.isToday ? theme.primary : 'transparent',
    }}>
    <Text style={{ fontSize: 9, fontWeight: '700', color: d.isToday ? '#fff' : theme.muted }}>
      {d.label}
    </Text>
    <Text style={{ fontSize: 13, fontWeight: '800', color: d.isToday ? '#fff' : theme.text, marginTop: 2 }}>
      {d.num}
    </Text>
    {d.hasDot && (
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.isToday ? '#fff' : theme.primary, marginTop: 3 }} />
    )}
  </TouchableOpacity>
))}
```

---

### `packages/ui/src/components/BugFab.tsx` (component, event-driven)

**Analog:** `apps/mobile/app/(app)/_layout.tsx` inline `BugReportFAB` function (lines 13–43)

**Key changes from analog:** dark bg `#1C1A17` (was `theme.surface`), right side (was `left: 20`), 42px (was 44px), `bug-outline` icon (was `bug`).

**Zustand store pattern** (`apps/mobile/src/components/BugReportModal.tsx` lines 16–32):
```typescript
// Store lives in packages/ui/ — mirrors useBugReportStore from BugReportModal.tsx
import { create } from 'zustand';

interface BugFabState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useBugStore = create<BugFabState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

export function showBugReport() { useBugStore.getState().show(); }
```

**FAB component** (adapted from `_layout.tsx` lines 13–43, DS-07 spec applied):
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BugFab() {
  const { bottom } = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={() => showBugReport()}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: 80 + bottom,   // above tab bar — same offset as _layout.tsx line 22
        right: 20,             // DS-07: bottom-right (was left: 20)
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#1C1A17',   // DS-07: dark (was theme.surface)
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

**Critical:** `packages/ui/` cannot import from `apps/mobile/src/`. The store for BugFab visibility MUST be co-located in `packages/ui/`. Supabase submit logic must be injected via a callback prop or the component accepts a `supabase` prop — same pattern as other plugin screens that accept `supabase` as prop.

---

### `packages/ui/src/components/BugSheet.tsx` (component, request-response)

**Analog:** `apps/mobile/src/components/BugReportModal.tsx` (entire file, 412 lines)

**Imports pattern** (BugReportModal.tsx lines 1–14, adjusted for package boundary):
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
// NOTE: 'zustand', 'expo-constants', 'expo-device', 'expo-router' are available
// NOTE: supabase client MUST be passed as prop — cannot import from apps/mobile/src/
```

**Modal + MotiView bottom sheet pattern** (BugReportModal.tsx lines 158–176 — canonical bottom sheet):
```typescript
<Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <Pressable
      onPress={handleClose}
      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
    >
      <Pressable onPress={() => {}}>
        <MotiView
          from={{ translateY: 500 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '85%',
          }}
        >
          {/* content */}
        </MotiView>
      </Pressable>
    </Pressable>
  </KeyboardAvoidingView>
</Modal>
```

**DS-07 spec difference:** Single-sheet UX (5 type chips + textarea + screenshot toggle + send CTA) replaces the existing 3-step flow. The type chips replace the category chips from BugReportModal.tsx lines 237–256. The send button is disabled until `text.trim().length > 0`.

**Supabase insert pattern** (BugReportModal.tsx lines 98–137 — preserve, but `supabase` must come from prop):
```typescript
// BugSheet accepts: { supabase: SupabaseClient; apiUrl: string }
const { error } = await supabase.from('bug_reports').insert(report);
```

**Device info collection pattern** (BugReportModal.tsx lines 87–96 — reuse verbatim):
```typescript
const collectDeviceInfo = () => ({
  platform: Platform.OS,
  osVersion: Platform.Version,
  deviceName: Device.deviceName ?? 'unknown',
  // ... (copy lines 87–96 exactly)
});
```

---

### `packages/ui/src/components/PaywallScreen.tsx` (component, request-response)

**Source (migrate):** `apps/mobile/app/(app)/paywall.tsx` default export `PaywallScreen` (lines 322–619)

**Imports pattern** (paywall.tsx lines 1–13 — remove `router` import; caller handles navigation):
```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
// Add: onClose prop replaces router.back()
```

**Props interface** (new — paywall.tsx currently uses `router.back()` directly):
```typescript
interface PaywallScreenProps {
  onClose: () => void;
}
```

**Dark glow overlay pattern** (paywall.tsx lines 345–359 — the radial orange glow is a plain View with borderRadius, not LinearGradient):
```typescript
<View style={{
  position: 'absolute', top: -80, left: '50%', marginLeft: -160,
  width: 320, height: 320, borderRadius: 160,
  backgroundColor: theme.primary, opacity: 0.28,
}} />
```

**Feature table PWCell helper** (paywall.tsx lines 62–90 — copy as internal helper):
```typescript
function PWCell({ v, primary, dim }: { v: boolean | string; primary?: boolean; dim?: boolean }) { ... }
```

**Plan cards pattern** (paywall.tsx lines 26–51 — copy PW_PLANS constant and render loop):
```typescript
const PW_PLANS = [
  { id: 'month', label: 'Mensuel', sub: 'Résiliable à tout moment', price: '9,99€', per: '/mois', best: false },
  { id: 'year',  label: 'Annuel',  sub: 'Économisez 40% — soit 5,99€/mois', price: '71,88€', per: '/an', best: true },
  { id: 'lifetime', label: 'À vie', sub: 'Paiement unique, accès permanent', price: '149€', per: 'une fois', best: false },
];
```

**Pitfall:** Keep `app/(app)/paywall.tsx` as a thin wrapper after migration:
```typescript
// app/(app)/paywall.tsx (after migration)
import { router } from 'expo-router';
import { PaywallScreen } from '@ziko/ui';
export default function PaywallRoute() {
  return <PaywallScreen onClose={() => router.back()} />;
}
```

---

### `packages/ui/src/components/RechargeSheet.tsx` (component, request-response)

**Source (migrate):** `apps/mobile/app/(app)/paywall.tsx` named export `RechargeSheet` (lines 92–320)

**Bottom sheet pattern** (paywall.tsx lines 117–130 — uses `Modal + TouchableOpacity` nesting, NOT `MotiView`):
```typescript
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <TouchableOpacity activeOpacity={1} onPress={onClose}
    style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.5)', justifyContent: 'flex-end' }}>
    <TouchableOpacity activeOpacity={1} onPress={() => {}}>
      <View style={{
        backgroundColor: theme.background,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 18,
        paddingBottom: Math.max(insets.bottom, 22),
        maxHeight: '90%',
      }}>
        {/* Handle bar */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,26,23,0.18)',
          alignSelf: 'center', marginTop: 10, marginBottom: 14 }} />
```

**Credit pack card pattern** (paywall.tsx lines 179–248 — copy PW_PACKS constant + render loop):
```typescript
const PW_PACKS = [
  { id: 'p20',  credits: 20,  price: '1,99€',  perUnit: '0,10€', popular: false, save: null },
  { id: 'p50',  credits: 50,  price: '3,99€',  perUnit: '0,08€', popular: true,  save: null },
  { id: 'p150', credits: 150, price: '9,99€',  perUnit: '0,07€', popular: false, save: '-13%' },
  { id: 'p500', credits: 500, price: '24,99€', perUnit: '0,05€', popular: false, save: '-38%' },
];
```

**Active pack selection pattern** (paywall.tsx lines 185–200):
```typescript
// Active state: borderWidth 2 + primary border + primary tinted bg
borderWidth: active ? 2 : 1,
borderColor: active ? theme.primary : theme.border,
backgroundColor: active ? `${theme.primary}0F` : theme.surface,
```

---

### `packages/ui/src/components/PluginsDrawer.tsx` (component, event-driven)

**Analog:** `apps/mobile/app/(app)/index.tsx` inline `PluginsDrawer` function (lines 375–429)

**Critical DS-11 constraint:** Navigation-only drawer. Do NOT copy `enablePlugin`/`disablePlugin` logic from `modules.tsx`. Only `installedPlugins` + `manifests` from `usePluginRegistry` are needed.

**Imports pattern** (index.tsx lines 8–10):
```typescript
import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, usePluginRegistry } from '@ziko/plugin-sdk';
```

**Props interface:**
```typescript
interface PluginsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;  // caller provides navigation function
}
```

**Bottom drawer via Modal pattern** (index.tsx lines 382–427):
```typescript
<Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
  {/* Backdrop */}
  <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
    activeOpacity={1} onPress={onClose} />
  {/* Sheet */}
  <View style={{
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '75%',
  }}>
    {/* Handle */}
    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border,
      alignSelf: 'center', marginBottom: 12 }} />
```

**4-column grid pattern** (index.tsx lines 402–423):
```typescript
// 56px icon cell with tint background + name label below
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
  {installedPlugins.map((pid) => {
    const manifest = manifests[pid];
    const mainRoute = manifest?.routes.find((r) => r.showInTabBar) ?? manifest?.routes[0];
    const destination = mainRoute?.path ?? `/(app)/store/${pid}`;
    const color = PLUGIN_COLORS[pid] ?? theme.primary;
    return (
      <TouchableOpacity key={pid} onPress={() => { onClose(); onNavigate(destination); }}
        activeOpacity={0.75}
        style={{ width: '20%', alignItems: 'center', gap: 6 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
          backgroundColor: color + '18', borderWidth: 1, borderColor: theme.border,
        }}>
          <Ionicons name={(manifest?.icon as any) ?? 'grid'} size={24} color={color} />
        </View>
        <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '600', color: theme.muted, textAlign: 'center' }}>
          {manifest?.name ?? pid}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

**PLUGIN_COLORS map** (copy from `apps/mobile/app/(app)/index.tsx` lines 28–34 — 17 entries):
```typescript
const PLUGIN_COLORS: Record<string, string> = {
  habits: '#FF5C1A', nutrition: '#FF5C1A', persona: '#FF6584', stats: '#E8A33A',
  gamification: '#FF5C1A', community: '#2E7BF6', stretching: '#FF5C1A', sleep: '#7B5BD0',
  measurements: '#2E9E5B', timer: '#FF5C1A', 'ai-programs': '#2E7BF6', journal: '#FF5C1A',
  hydration: '#2E7BF6', cardio: '#E94B3C', supplements: '#2E9E5B', wearables: '#E91E63', rpe: '#7B5BD0',
};
```

---

### `apps/mobile/app/(app)/(tabs)/_layout.tsx` (config/nav, structural modify)

**Analog:** `apps/mobile/app/(app)/_layout.tsx` current 4-tab structure (lines 94–166)

**3-tab target** (research DS-10 analysis):
```typescript
// KEEP these 3 tabs:
<Tabs.Screen name="index"   options={{ title: t('tab.home'),    tabBarIcon: ... }} />
<Tabs.Screen name="workout" options={{ title: t('tab.workout'), tabBarIcon: ... }} />
<Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarIcon: ... }} />

// REMOVE from tab bar (set href: null — screen still exists):
<Tabs.Screen name="store" options={{ href: null }} />

// ADD store to hidden list alongside existing hidden screens (lines 152–161):
<Tabs.Screen name="store" options={{ href: null }} />
```

**ChatFAB removal:** Remove `<ChatFAB />` from the JSX fragment (line 163). The component function itself can be deleted.

**BugFab replacement:**
```typescript
// REMOVE (lines 11–43):
import { showBugReport } from '../../src/components/BugReportModal';
function BugReportFAB() { ... }

// ADD:
import { BugFab } from '@ziko/ui';
// In JSX: <BugFab />
```

**Tab bar screenOptions** (lines 97–114 — copy unchanged):
```typescript
screenOptions={{
  headerShown: false,
  tabBarStyle: {
    backgroundColor: theme.tabBarBg,
    borderTopWidth: 0,
    paddingBottom: 8 + insets.bottom,
    paddingTop: 8,
    height: 70 + insets.bottom,
    elevation: 0, shadowOpacity: 0,
  },
  tabBarActiveTintColor: theme.tabBarActive,
  tabBarInactiveTintColor: theme.tabBarInactive,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
}}
```

---

### `apps/mobile/app/_layout.tsx` (config/layout, structural modify)

**Analog:** `apps/mobile/app/_layout.tsx` (entire file, 132 lines)

**Change:** Replace `<BugReportModal />` (line 121) with `<BugFab />` + `<BugSheet />` from `@ziko/ui`. Do both in one atomic change to avoid duplicate sheets (Pitfall 2 in RESEARCH.md).

```typescript
// REMOVE (lines 15, 121):
import BugReportModal from '../src/components/BugReportModal';
<BugReportModal />

// ADD:
import { BugFab, BugSheet } from '@ziko/ui';
// In JSX (after CustomAlert, alongside CreditEarnToast):
<BugFab />
<BugSheet supabase={supabase} apiUrl={process.env.EXPO_PUBLIC_API_URL ?? ''} />
```

**All other content of `_layout.tsx` stays unchanged** — `QueryClientProvider`, `PluginLoader`, `CustomAlert`, `CreditEarnToast`, `CreditExhaustionSheet` are untouched.

---

### `packages/ui/src/index.ts` (config/exports, extend)

**Analog:** `packages/ui/src/index.ts` current 13-item export (lines 1–15)

**Add these exports** (append to existing file):
```typescript
export { FormRing } from './components/FormRing';
export { AISuggestion } from './components/AISuggestion';
export { SubTabs } from './components/SubTabs';
export { PluginHeader } from './components/PluginHeader';
export { WeekStrip } from './components/WeekStrip';
export { BugFab, BugSheet, useBugStore, showBugReport } from './components/BugFab';
export { PaywallScreen } from './components/PaywallScreen';
export { RechargeSheet } from './components/RechargeSheet';
export { PluginsDrawer } from './components/PluginsDrawer';
export * from './design-system';
```

**Note:** If new components are added to `components.tsx` rather than separate files, the named exports stay in the same `from './components'` line.

---

## Shared Patterns

### Pattern A: `useThemeStore` inline style objects
**Source:** `packages/ui/src/components.tsx` lines 89, 162, 192, 273 (every component)
**Apply to:** All 9 new components
```typescript
// Universal pattern in every component — NO StyleSheet, NO className
const theme = useThemeStore((s) => s.theme);
// Then use theme.primary, theme.surface, theme.border, theme.text, theme.muted inline
```

### Pattern B: Card shadow style
**Source:** `packages/ui/src/components.tsx` `resolveCardStyle` function lines 45–63
```typescript
// Shadow variant (default cardStyle):
{
  shadowColor: theme.cardDark,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
}
```

### Pattern C: Modal + MotiView bottom sheet (slide-in)
**Source:** `apps/mobile/src/components/BugReportModal.tsx` lines 159–176, `apps/mobile/src/components/CreditExhaustionSheet.tsx` lines 44–60
**Apply to:** `BugSheet`, `RechargeSheet`
```typescript
<Modal visible={visible} transparent animationType="none" statusBarTranslucent>
  <TouchableOpacity activeOpacity={1} onPress={onClose}
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
    <TouchableOpacity activeOpacity={1} onPress={() => {}}>
      <MotiView
        from={{ translateY: 300 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      >
        {/* content */}
      </MotiView>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

### Pattern D: Zustand store for modal/sheet visibility
**Source:** `apps/mobile/src/components/BugReportModal.tsx` lines 16–32
**Apply to:** `BugFab`/`BugSheet` (store lives in `packages/ui/`)
```typescript
export const useBugStore = create<BugState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
export function showBugReport() { useBugStore.getState().show(); }
```

### Pattern E: Animated MotiView for ProgressBar
**Source:** `packages/ui/src/components.tsx` `ProgressBar` lines 326–346
**Apply to:** Any fill/progress animations in new components
```typescript
<MotiView
  from={{ width: '0%' }}
  animate={{ width: `${pct * 100}%` as any }}
  transition={{ type: 'timing', duration: 600 }}
  style={{ height: '100%', backgroundColor: c, borderRadius: height / 2 }}
/>
```

### Pattern F: Package boundary rule
**Apply to:** ALL new components in `packages/ui/`
- May import from: `react`, `react-native`, `@ziko/plugin-sdk`, `moti`, `react-native-svg`, `@expo/vector-icons`, `expo-linear-gradient`, `react-native-safe-area-context`, `expo-router` (for types only), `zustand`, `expo-constants`, `expo-device`
- May NOT import from: `apps/mobile/src/` (any path)
- Business logic requiring app-level stores (supabase client, credit store, auth store) must be passed as props or callbacks

---

## No Analog Found

All 13 files in scope have strong analogs. No files require falling back to RESEARCH.md patterns exclusively.

| File | Notes |
|------|-------|
| `AISuggestion` | No existing component but `Card` + `Badge` in `components.tsx` provide all building blocks |
| `design-system.ts` | New file but all values are already present in `components.tsx` and `plugin-sdk/src/theme.ts` — pure consolidation |

---

## Metadata

**Analog search scope:** `apps/mobile/app/(app)/`, `apps/mobile/app/_layout.tsx`, `apps/mobile/src/components/`, `packages/ui/src/`, `packages/plugin-sdk/src/`, `plugins/community/src/screens/`
**Files scanned:** 10 source files read in full or in part
**Pattern extraction date:** 2026-05-21

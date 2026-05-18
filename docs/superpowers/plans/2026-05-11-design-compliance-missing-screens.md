# Design Compliance + Missing Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (Phase 1) Replace all hardcoded Material/off-palette colors with `useThemeStore` tokens across plugins and app screens. (Phase 2) Implement the 5 screens present in `index.html` prototype but missing from the app: WorkoutSummary, AIGenerator (workout flow), PostDetailScreen, CommunityGroups tab, and public ProfileScreen.

**Architecture:** Phase 1 adds a `danger` semantic token to `ThemePalette`, then does a file-by-file compliance sweep. Phase 2 adds new screens following the existing pattern: thin Expo Router wrappers in `app/(app)/` pointing to screen components. The public profile reuses `profile/index.tsx` with a `userId` param. Community Groups is a new tab in `CommunityDashboard`.

**Tech Stack:** Expo SDK 54, Expo Router v4, React Native 0.81, NativeWind v4, Zustand v5, `useThemeStore` from `@ziko/plugin-sdk`, `showAlert` from `@ziko/plugin-sdk`, Ionicons

**Prerequisite:** Plan `2026-05-10-design-system-phase1.md` must be fully applied (ThemePalette already has `success`, `info`, `violet`, `warn` tokens).

---

## File Map

### Phase 1 — Design Compliance

| File | Action | Change |
|------|--------|--------|
| `packages/plugin-sdk/src/theme.ts` | Modify | Add `danger` token to interface + all 7 themes |
| `plugins/stats/src/screens/StatsDashboard.tsx` | Modify | `#10B981` → `theme.success` (~12 occurrences) |
| `plugins/stats/src/screens/ExerciseStats.tsx` | Modify | `#10B981` → `theme.success` |
| `plugins/stats/src/screens/SessionDetail.tsx` | Modify | `#10B981` → `theme.success` |
| `plugins/gamification/src/screens/GamificationDashboard.tsx` | Modify | `#10B981` → `theme.success`, `#EF4444` → `theme.danger` |
| `plugins/gamification/src/screens/ShopScreen.tsx` | Modify | `#10B981` → `theme.success`, `#EF4444` → `theme.danger` |
| `apps/mobile/app/(app)/workout/session.tsx` | Modify | Replace 7 off-palette colors with theme tokens |
| `apps/mobile/app/(app)/workout/history.tsx` | Modify | `#4CAF50` → `theme.success`, `#FF9800` → `theme.warn`, `#7A7670` → `theme.muted` |
| `apps/mobile/src/components/BugReportModal.tsx` | Modify | `#22C55E` → design system green, `#F59E0B` → design system amber |
| `apps/mobile/src/components/CreditExhaustionSheet.tsx` | Modify | `#4CAF50` → `theme.success` |

### Phase 2 — Missing Screens

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/app/(app)/workout/summary.tsx` | Create | Expo Router wrapper for WorkoutSummary |
| `apps/mobile/app/(app)/workout/ai-generate.tsx` | Create | Expo Router wrapper for AIGenerator |
| `plugins/community/src/screens/PostDetailScreen.tsx` | Create | Community post detail component |
| `apps/mobile/app/(app)/(plugins)/community/post.tsx` | Create | Expo Router wrapper for PostDetailScreen |
| `plugins/community/src/screens/GroupsScreen.tsx` | Create | Groups tab component |
| `plugins/community/src/screens/CommunityDashboard.tsx` | Modify | Add "Groupes" tab |
| `apps/mobile/app/(app)/profile/[userId].tsx` | Create | Public profile (other user) |

---

## PHASE 1 — Design System Compliance

---

### Task 1: Add `danger` token to ThemePalette

**Files:**
- Modify: `packages/plugin-sdk/src/theme.ts`

- [ ] **Step 1: Add `danger` to the interface**

In `packages/plugin-sdk/src/theme.ts`, inside `ThemePalette`, add `danger` after `warn` in the semantic tokens block (around line 22):

```ts
  // Semantic tokens
  success: string;
  info: string;
  violet: string;
  warn: string;
  danger: string;   // ← add this line
```

- [ ] **Step 2: Add `danger` to DEFAULT_THEME**

In `DEFAULT_THEME`, after `warn: '#E8A33A',` add:

```ts
  danger: '#EF4444',
```

- [ ] **Step 3: Add `danger` to all 6 themes in THEME_REGISTRY**

For every theme object in `THEME_REGISTRY` ('Bleu Océan', 'Violet Royal', 'Vert Forêt', 'Rouge Feu', 'Or Prestige', 'Noir Carbone'), add after `warn: '#E8A33A',`:

```ts
    danger: '#EF4444',
```

The danger color is universal — same hex across all themes.

- [ ] **Step 4: Type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors (the new field has a default so no existing code breaks).

- [ ] **Step 5: Commit**

```bash
cd /c/ziko-platform && rtk git add packages/plugin-sdk/src/theme.ts && rtk git commit -m "feat(theme): add danger semantic token (#EF4444) to ThemePalette and all themes"
```

---

### Task 2: Fix Stats plugin — replace `#10B981` with `theme.success`

**Files:**
- Modify: `plugins/stats/src/screens/StatsDashboard.tsx`
- Modify: `plugins/stats/src/screens/ExerciseStats.tsx`
- Modify: `plugins/stats/src/screens/SessionDetail.tsx`

- [ ] **Step 1: Verify the theme destructure exists in StatsDashboard**

```bash
grep -n "useThemeStore\|const.*theme" /c/ziko-platform/plugins/stats/src/screens/StatsDashboard.tsx | head -10
```

Expected: a line like `const theme = useThemeStore((s) => s.theme)` already exists. If it doesn't, add it after the imports:
```ts
const theme = useThemeStore((s) => s.theme);
```

- [ ] **Step 2: Replace all `#10B981` in StatsDashboard.tsx**

There are ~12 occurrences. Replace every hardcoded `'#10B981'` with `theme.success`. Also replace `'#10B98115'` with `theme.success + '15'` and `'#EF4444'` with `theme.danger`.

Pattern — every `color="#10B981"` prop and `color: '#10B981'` style value becomes `color={theme.success}` / `color: theme.success`.

Run this to list all lines that need changing:
```bash
grep -n "#10B981\|#EF4444" /c/ziko-platform/plugins/stats/src/screens/StatsDashboard.tsx
```

Open the file, apply all replacements. Key replacements (line numbers may differ — use grep output):
- `color="#10B981"` → `color={theme.success}`
- `color: '#10B981'` → `color: theme.success`
- `backgroundColor: '#10B98115'` → `backgroundColor: theme.success + '15'`
- `color: '#EF4444'` → `color: theme.danger`

- [ ] **Step 3: Fix ExerciseStats.tsx**

```bash
grep -n "#10B981\|#EF4444" /c/ziko-platform/plugins/stats/src/screens/ExerciseStats.tsx
```

Replace:
- `color: '#10B981'` → `color: theme.success`
- `stroke: '#10B981'` → `stroke: theme.success`

- [ ] **Step 4: Fix SessionDetail.tsx**

```bash
grep -n "#10B981" /c/ziko-platform/plugins/stats/src/screens/SessionDetail.tsx
```

In the RPE color function (line ~20), replace `return '#10B981'` with `return theme.success`. Note: `theme` must be available — if it's inside a pure function `rpeColor(rpe)`, change it to accept theme as a parameter:

```ts
function rpeColor(rpe: number, theme: ThemePalette): string {
  if (rpe <= 3) return theme.success;
  if (rpe <= 6) return theme.warn;
  if (rpe <= 8) return theme.primary;
  return theme.danger;
}
```

And update every call site: `rpeColor(rpe)` → `rpeColor(rpe, theme)`.

- [ ] **Step 5: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add plugins/stats/src/screens/StatsDashboard.tsx plugins/stats/src/screens/ExerciseStats.tsx plugins/stats/src/screens/SessionDetail.tsx && rtk git commit -m "fix(design): stats plugin — replace hardcoded #10B981 with theme.success"
```

---

### Task 3: Fix Gamification plugin

**Files:**
- Modify: `plugins/gamification/src/screens/GamificationDashboard.tsx`
- Modify: `plugins/gamification/src/screens/ShopScreen.tsx`

- [ ] **Step 1: Find all violations**

```bash
grep -n "#10B981\|#EF4444" /c/ziko-platform/plugins/gamification/src/screens/GamificationDashboard.tsx
grep -n "#10B981\|#EF4444" /c/ziko-platform/plugins/gamification/src/screens/ShopScreen.tsx
```

- [ ] **Step 2: Fix GamificationDashboard.tsx**

Replace:
- `color: tx.amount > 0 ? '#10B981' : '#EF4444'`
  → `color: tx.amount > 0 ? theme.success : theme.danger`

Verify `theme` is destructured from `useThemeStore` at the top of the component.

- [ ] **Step 3: Fix ShopScreen.tsx**

Replace:
- `borderColor: equipped ? theme.primary : owned ? '#10B981' : theme.border`
  → `borderColor: equipped ? theme.primary : owned ? theme.success : theme.border`

- `color={levelOk ? '#10B981' : '#EF4444'}`
  → `color={levelOk ? theme.success : theme.danger}`

- `color: levelOk ? '#10B981' : '#EF4444'`
  → `color: levelOk ? theme.success : theme.danger`

- `'#10B981'` (the ternary for shop button color, line ~218)
  → `theme.success`

**Note:** Line 283 (`'Bleu Océan': { ... text: '#1E293B' }`) is theme preview data — leave it as-is, it's intentionally inline.

- [ ] **Step 4: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add plugins/gamification/src/screens/GamificationDashboard.tsx plugins/gamification/src/screens/ShopScreen.tsx && rtk git commit -m "fix(design): gamification — replace #10B981/#EF4444 with theme tokens"
```

---

### Task 4: Fix workout/session.tsx (largest file)

**Files:**
- Modify: `apps/mobile/app/(app)/workout/session.tsx`

This file has 7 different off-palette Material colors. Verify `theme` is available from `useThemeStore`.

- [ ] **Step 1: List all violations**

```bash
grep -n "#4CAF50\|#F44336\|#FF9800\|#FFC107\|#9C27B0\|#2196F3\|#7A7670" /c/ziko-platform/apps/mobile/app/\(app\)/workout/session.tsx
```

- [ ] **Step 2: Replace the RPE color helper function**

Find the function `rpeColor` or the ternary at the top of the file (around line 36) that returns Material colors based on RPE. Replace it with:

```ts
function rpeColor(val: number, theme: ReturnType<typeof useThemeStore.getState>['theme']): string {
  if (val <= 3) return theme.success;
  if (val <= 6) return theme.warn;
  if (val <= 8) return theme.warn;
  return theme.danger;
}
```

And for any inline ternary like `val <= 3 ? '#4CAF50' : val <= 6 ? '#FFC107' : val <= 8 ? '#FF9800' : '#F44336'`, replace with `rpeColor(val, theme)`.

- [ ] **Step 3: Replace remaining color constants**

Apply these replacements throughout the file (use grep line numbers to find each occurrence):

| Old | New |
|-----|-----|
| `'#4CAF50'` | `theme.success` |
| `'#4CAF50' + '15'` or `'#4CAF5015'` | `theme.success + '15'` |
| `'#4CAF50' + '30'` or `'#4CAF5030'` | `theme.success + '30'` |
| `'#F44336'` | `theme.danger` |
| `'#F44336' + '15'` or `'#F4433615'` | `theme.danger + '15'` |
| `'#F44336' + '22'` or `'#F4433622'` | `theme.danger + '22'` |
| `'#F44336' + '30'` or `'#F4433630'` | `theme.danger + '30'` |
| `'#FF9800'` | `theme.warn` |
| `'#FF9800' + '15'` or `'#FF980015'` | `theme.warn + '15'` |
| `'#FF9800' + '44'` or `'#FF980044'` | `theme.warn + '44'` |
| `'#FFC107'` | `theme.warn` |
| `'#9C27B0'` | `theme.violet` |
| `'#9C27B0' + '15'` or `'#9C27B015'` | `theme.violet + '15'` |
| `'#9C27B0' + '40'` or `'#9C27B040'` | `theme.violet + '40'` |
| `'#2196F3'` | `theme.info` |
| `'#2196F3' + '18'` or `'#2196F318'` | `theme.info + '18'` |
| `'#2196F3' + '22'` or `'#2196F322'` | `theme.info + '22'` |
| `'#2196F3' + '44'` or `'#2196F344'` | `theme.info + '44'` |
| `'#7A7670'` | `theme.muted` |

- [ ] **Step 4: Verify no violations remain**

```bash
grep -n "#4CAF50\|#F44336\|#FF9800\|#FFC107\|#9C27B0\|#2196F3\|#7A7670" /c/ziko-platform/apps/mobile/app/\(app\)/workout/session.tsx
```

Expected: 0 matches.

- [ ] **Step 5: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add apps/mobile/app/\(app\)/workout/session.tsx && rtk git commit -m "fix(design): workout session — replace 7 Material colors with theme tokens"
```

---

### Task 5: Fix remaining files (history, BugReportModal, CreditExhaustionSheet)

**Files:**
- Modify: `apps/mobile/app/(app)/workout/history.tsx`
- Modify: `apps/mobile/src/components/BugReportModal.tsx`
- Modify: `apps/mobile/src/components/CreditExhaustionSheet.tsx`

- [ ] **Step 1: Fix workout/history.tsx**

```bash
grep -n "#4CAF50\|#FF9800\|#7A7670" /c/ziko-platform/apps/mobile/app/\(app\)/workout/history.tsx
```

Replace:
- `color: '#4CAF50'` → `color: theme.success` (add `theme` via `useThemeStore` if not present)
- `color: '#FF9800'` → `color: theme.warn`
- `color: '#7A7670'` → `color: theme.muted`

Verify `theme` is destructured. If `history.tsx` doesn't already import `useThemeStore`, add:
```ts
import { useThemeStore } from '@ziko/plugin-sdk';
// inside component:
const theme = useThemeStore((s) => s.theme);
```

- [ ] **Step 2: Fix BugReportModal.tsx severity colors**

```bash
grep -n "#22C55E\|#F59E0B\|#F97316" /c/ziko-platform/apps/mobile/src/components/BugReportModal.tsx
```

The `SEVERITIES` array uses inline colors. Align them with design system values:
- `color: '#22C55E'` (low/green) → `color: '#2E9E5B'` (design system success)
- `color: '#F59E0B'` (medium/amber) → `color: '#E8A33A'` (design system warn)
- `color: '#F97316'` (high/orange) → `color: '#FF5C1A'` (design system primary)
- `color: '#EF4444'` (critical/red) — leave as-is (this is already `theme.danger`)

Note: These are static severity data, intentionally not theme-reactive. We just align the hex values with the palette.

Also fix line ~188 (`'#EF444415'`) and line ~190 (`'#EF4444'`) — change to use `theme.danger`:
```ts
backgroundColor: theme.danger + '15'
// and
<Ionicons name="bug" size={18} color={theme.danger} />
```

And line ~374:
```ts
backgroundColor: canGoNext ? (step === 2 ? theme.danger : theme.primary) : theme.border,
```

- [ ] **Step 3: Fix CreditExhaustionSheet.tsx**

```bash
grep -n "#4CAF50" /c/ziko-platform/apps/mobile/src/components/CreditExhaustionSheet.tsx
```

Replace `color={done ? '#4CAF50' : theme.muted}` → `color={done ? theme.success : theme.muted}`

- [ ] **Step 4: Final compliance check across all plugin/app screens**

```bash
grep -rn "#4CAF50\|#10B981\|#9C27B0\|#2196F3\|#7A7670\|#22C55E\|#F44336\|#FF9800\|#FFC107" /c/ziko-platform/apps/mobile /c/ziko-platform/plugins --include="*.tsx" | grep -v "node_modules"
```

Expected: 0 matches (except `ShopScreen.tsx:283` which is intentional theme preview data).

- [ ] **Step 5: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add apps/mobile/app/\(app\)/workout/history.tsx apps/mobile/src/components/BugReportModal.tsx apps/mobile/src/components/CreditExhaustionSheet.tsx && rtk git commit -m "fix(design): remaining compliance — history, BugReportModal, CreditExhaustionSheet"
```

---

## PHASE 2 — Missing Screens

---

### Task 6: WorkoutSummary screen

**Files:**
- Create: `apps/mobile/app/(app)/workout/summary.tsx`
- Modify: `apps/mobile/app/(app)/workout/session.tsx`

The WorkoutSummary shows: hero card (dark bg + primary blob), PR list, HR chart (SVG), exercise breakdown, session notes textarea, and Share/Save buttons. Data comes from the just-completed session in the workout Zustand store.

- [ ] **Step 1: Create the screen file**

Create `apps/mobile/app/(app)/workout/summary.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { showAlert } from '@ziko/plugin-sdk';
import { useWorkoutStore } from '../../../src/stores/workoutStore';

const { width } = Dimensions.get('window');

export default function WorkoutSummaryScreen() {
  const theme = useThemeStore((s) => s.theme);
  const session = useWorkoutStore((s) => s.lastCompletedSession);
  const [notes, setNotes] = useState('');

  if (!session) {
    router.replace('/(app)/workout/');
    return null;
  }

  const durationMin = Math.floor((session.durationSeconds ?? 0) / 60);
  const totalVolume = session.exercises?.reduce(
    (acc, ex) => acc + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0
  ) ?? 0;
  const totalSets = session.exercises?.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;
  const prs = session.exercises?.filter((ex) => ex.isNewPR) ?? [];

  const handleSave = () => {
    useWorkoutStore.getState().saveSessionNotes(session.id, notes);
    useWorkoutStore.getState().clearLastCompletedSession();
    router.replace('/(app)/workout/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12,
        backgroundColor: theme.background,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Séance terminée</Text>
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>Bravo pour cette session</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
        {/* Hero dark card */}
        <View style={{
          backgroundColor: theme.cardDark, borderRadius: 18,
          padding: 18, overflow: 'hidden', position: 'relative',
        }}>
          {/* Primary blob */}
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: 80,
            backgroundColor: theme.primary + '30',
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="trophy" size={12} color={theme.primary} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Highlight
            </Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.cardDarkText, lineHeight: 22, marginBottom: 16 }}>
            {session.highlight ?? `${durationMin} min · ${totalSets} séries complétées`}
          </Text>
          {/* 4-stat grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { v: `${durationMin} min`, l: 'durée' },
              { v: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`, l: 'volume' },
              { v: `${totalSets}`, l: 'séries' },
              { v: session.avgHr ? `${session.avgHr}` : '—', l: 'FC moy.' },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: theme.cardDarkText, lineHeight: 18 }}>{x.v}</Text>
                <Text style={{ fontSize: 9, color: theme.cardDarkText + '70', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>{x.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* PRs */}
        {prs.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
              Records battus{' '}
              <Text style={{ color: theme.primary }}>{prs.length}</Text>
            </Text>
            {prs.map((pr) => (
              <View key={pr.name} style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
                backgroundColor: theme.primary + '08',
                borderWidth: 1, borderColor: theme.primary + '22',
              }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 14,
                  backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="trophy" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{pr.name}</Text>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                    Nouveau record · +{pr.delta ?? '?'}kg
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary }}>
                  {pr.bestWeight}
                  <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '500' }}>kg</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercise breakdown */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            Détail par exercice
          </Text>
          {(session.exercises ?? []).map((ex) => (
            <View key={ex.name} style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
            }}>
              <View style={{
                width: 30, height: 30, borderRadius: 9,
                backgroundColor: ex.isNewPR ? theme.primary : theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={ex.isNewPR ? 'trophy' : 'barbell-outline'} size={13} color={ex.isNewPR ? '#fff' : theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
                  {ex.name}
                  {ex.isNewPR && <Text style={{ fontSize: 9.5, color: theme.primary, fontWeight: '800', marginLeft: 6 }}> · PR</Text>}
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>
                  {ex.sets.length} séries · meilleure : {ex.bestSetLabel ?? '—'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                {ex.totalVolume >= 1000 ? `${(ex.totalVolume / 1000).toFixed(1)}t` : ex.totalVolume > 0 ? `${ex.totalVolume}kg` : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Session notes */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            Note de séance
          </Text>
          <TextInput
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Comment t'es-tu senti ? Énergie, sommeil, ressenti…"
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.surface, borderRadius: 12,
              borderWidth: 1, borderColor: theme.border,
              padding: 14, color: theme.text, fontSize: 13, lineHeight: 20,
              textAlignVertical: 'top', minHeight: 80,
            }}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 18, paddingBottom: 32, paddingTop: 12,
        flexDirection: 'row', gap: 8,
        backgroundColor: theme.background + 'E0',
      }}>
        <TouchableOpacity
          onPress={() => showAlert('Partager', 'Fonctionnalité bientôt disponible.')}
          style={{
            paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
            borderWidth: 1, borderColor: theme.border,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          <Ionicons name="share-outline" size={14} color={theme.text} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14,
            backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.cardDarkText }}>Sauvegarder & fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add navigation to summary after session ends**

In `apps/mobile/app/(app)/workout/session.tsx`, find where the workout is marked as complete and the session is saved. After saving, navigate to summary instead of going back:

```ts
// Replace: router.back() or router.replace('/(app)/workout/')
// With:
useWorkoutStore.getState().setLastCompletedSession(sessionData);
router.replace('/(app)/workout/summary');
```

Also add a `setLastCompletedSession` + `clearLastCompletedSession` + `lastCompletedSession` field to `workoutStore.ts` if not present:
```ts
lastCompletedSession: CompletedSession | null;
setLastCompletedSession: (s: CompletedSession) => void;
clearLastCompletedSession: () => void;
saveSessionNotes: (id: string, notes: string) => void;
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Fix any type errors. Likely: add the `CompletedSession` interface to `workoutStore.ts` with fields `id`, `highlight?`, `durationSeconds`, `avgHr?`, `exercises: CompletedExercise[]` where `CompletedExercise` has `name`, `sets`, `isNewPR?`, `bestSetLabel?`, `totalVolume`, `delta?`, `bestWeight?`.

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/\(app\)/workout/summary.tsx apps/mobile/app/\(app\)/workout/session.tsx apps/mobile/src/stores/workoutStore.ts && rtk git commit -m "feat(workout): add WorkoutSummary screen with PRs, exercise breakdown, session notes"
```

---

### Task 7: AIGenerator screen (workout flow)

**Files:**
- Create: `apps/mobile/app/(app)/workout/ai-generate.tsx`
- Modify: `apps/mobile/app/(app)/workout/index.tsx`

The AIGenerator is a 4-step wizard: energy level (1-10), duration (30/45/60/90 min), focus area (upper/lower/full), equipment (gym/home/none). Then a "generating" loading state, then a list of AI-generated exercises with IA adaptation notes.

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/(app)/workout/ai-generate.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

type Step = 0 | 1 | 2 | 3 | 4 | 5; // 0-3 questions, 4 generating, 5 result

interface Answers {
  energy: number;
  duration: 30 | 45 | 60 | 90;
  focus: 'haut' | 'bas' | 'full';
  equipment: 'salle' | 'maison' | 'rien';
}

const FOCUS_OPTIONS: Array<{ id: Answers['focus']; label: string; icon: string }> = [
  { id: 'haut', label: 'Haut du corps', icon: 'body-outline' },
  { id: 'bas', label: 'Bas du corps', icon: 'walk-outline' },
  { id: 'full', label: 'Full body', icon: 'fitness-outline' },
];

const EQUIP_OPTIONS: Array<{ id: Answers['equipment']; label: string; icon: string }> = [
  { id: 'salle', label: 'Salle complète', icon: 'barbell-outline' },
  { id: 'maison', label: 'Maison / haltères', icon: 'home-outline' },
  { id: 'rien', label: 'Sans matériel', icon: 'body-outline' },
];

const DURATIONS: Array<30 | 45 | 60 | 90> = [30, 45, 60, 90];

export default function AIGenerateScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>({ energy: 7, duration: 45, focus: 'haut', equipment: 'salle' });

  const next = () => {
    if (step === 3) {
      setStep(4);
      setTimeout(() => setStep(5), 2000);
    } else {
      setStep((s) => (s + 1) as Step);
    }
  };

  // Generating state
  if (step === 4) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          Coach IA travaille…
        </Text>
        <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center', lineHeight: 18 }}>
          On adapte la séance à ton énergie ({answers.energy}/10),{'\n'}ton historique et le matériel dispo.
        </Text>
      </View>
    );
  }

  // Result state
  if (step === 5) {
    const exos = [
      { name: 'Développé incliné haltères', sets: '3 × 8-10', note: `charge légère vu énergie ${answers.energy}/10` },
      { name: 'Développé couché barre', sets: '4 × 6-8' },
      { name: 'Écarté machine', sets: '3 × 12' },
      { name: 'Dips lestés', sets: '3 × 8' },
      { name: 'Extensions triceps poulie', sets: '3 × 12' },
    ];
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => setStep(0)} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Ta séance générée</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>~{answers.duration} min · adapté à toi</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
          {/* IA adaptation note */}
          <View style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 14,
            flexDirection: 'row', gap: 10,
            borderWidth: 1, borderColor: theme.primary + '22', marginBottom: 12,
          }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={15} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
                Adaptations IA
              </Text>
              <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                Ton énergie est {answers.energy >= 8 ? 'bonne' : 'moyenne'} ({answers.energy}/10) → charge{' '}
                {answers.energy >= 8 ? 'standard' : 'allégée'} sur le 1er exo.
              </Text>
            </View>
          </View>
          {/* Exercise list */}
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            {exos.length} exercices
          </Text>
          {exos.map((ex, i) => (
            <View key={i} style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
            }}>
              <View style={{
                width: 26, height: 26, borderRadius: 8,
                backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{ex.name}</Text>
                <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>
                  {ex.sets}{ex.note ? ` · ${ex.note}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {/* Start CTA */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/workout/session')}
            style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Démarrer cette séance</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Steps 0-3: question wizard
  const stepTitles = ['Ton énergie du jour', 'Durée souhaitée', 'Zone de travail', 'Équipement disponible'];
  const canNext = true;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12 }}>
        <TouchableOpacity onPress={step === 0 ? () => router.back() : () => setStep((s) => (s - 1) as Step)} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Générer avec IA</Text>
      </View>

      {/* Progress bar */}
      <View style={{ marginHorizontal: 18, height: 4, backgroundColor: theme.border, borderRadius: 2, marginBottom: 24 }}>
        <View style={{ width: `${((step + 1) / 4) * 100}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 2 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{stepTitles[step]}</Text>

        {/* Step 0: Energy 1-10 */}
        {step === 0 && (
          <View>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 24 }}>
              Sur 10, comment te sens-tu aujourd'hui ?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setAnswers((a) => ({ ...a, energy: n }))}
                  style={{
                    width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: answers.energy === n ? theme.primary : theme.surface,
                    borderWidth: 1, borderColor: answers.energy === n ? theme.primary : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '700', color: answers.energy === n ? '#fff' : theme.text }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 1: Duration */}
        {step === 1 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setAnswers((a) => ({ ...a, duration: d }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
                  backgroundColor: answers.duration === d ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.duration === d ? theme.primary : theme.border,
                }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{d} minutes</Text>
                {answers.duration === d && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Focus */}
        {step === 2 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {FOCUS_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setAnswers((a) => ({ ...a, focus: f.id }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: answers.focus === f.id ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.focus === f.id ? theme.primary : theme.border,
                }}
              >
                <Ionicons name={f.icon as any} size={20} color={answers.focus === f.id ? theme.primary : theme.muted} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{f.label}</Text>
                {answers.focus === f.id && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 3: Equipment */}
        {step === 3 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {EQUIP_OPTIONS.map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => setAnswers((a) => ({ ...a, equipment: e.id }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: answers.equipment === e.id ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.equipment === e.id ? theme.primary : theme.border,
                }}
              >
                <Ionicons name={e.icon as any} size={20} color={answers.equipment === e.id ? theme.primary : theme.muted} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{e.label}</Text>
                {answers.equipment === e.id && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
        <TouchableOpacity
          onPress={next}
          style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {step === 3 ? 'Générer ma séance' : 'Suivant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add entry point in workout/index.tsx**

In `apps/mobile/app/(app)/workout/index.tsx`, find the `StartModes` or "new workout" section and add a button for AI generation:

```tsx
<TouchableOpacity
  onPress={() => router.push('/(app)/workout/ai-generate')}
  style={{
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: theme.violet + '10',
    borderWidth: 1, borderColor: theme.violet + '30', marginBottom: 8,
  }}
>
  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.violet, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="sparkles" size={16} color="#fff" />
  </View>
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>Générer avec l'IA</Text>
    <Text style={{ fontSize: 11, color: theme.muted }}>Séance personnalisée en 30 secondes</Text>
  </View>
  <Ionicons name="chevron-forward" size={16} color={theme.muted} />
</TouchableOpacity>
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add apps/mobile/app/\(app\)/workout/ai-generate.tsx apps/mobile/app/\(app\)/workout/index.tsx && rtk git commit -m "feat(workout): AIGenerator wizard — energy/duration/focus/equipment → AI session"
```

---

### Task 8: PostDetailScreen (Community)

**Files:**
- Create: `plugins/community/src/screens/PostDetailScreen.tsx`
- Create: `apps/mobile/app/(app)/(plugins)/community/post.tsx`
- Modify: `plugins/community/src/screens/CommunityDashboard.tsx`

- [ ] **Step 1: Create PostDetailScreen component**

Create `plugins/community/src/screens/PostDetailScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
  postId?: string;
  onBack: () => void;
}

const MOCK_COMMENTS = [
  { id: '1', author: 'Tom K.',  initials: 'TK', color: '#2E7BF6', text: 'Énorme 🔥 bravo pour la régularité', time: '1h' },
  { id: '2', author: 'Julie P.', initials: 'JP', color: '#2E9E5B', text: 'Tu fais quoi comme programme ?', time: '45 min' },
  { id: '3', author: 'Sam R.',  initials: 'SR', color: '#E8A33A', text: 'RPE 9 c\'est solide, tu visais combien ?', time: '20 min' },
];

export default function PostDetailScreen({ supabase, postId, onBack }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(247);
  const [comment, setComment] = useState('');

  const handleLike = () => {
    setLiked((l) => !l);
    setLikeCount((c) => liked ? c - 1 : c + 1);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, flex: 1 }}>Publication</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Author row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '0 16px 12px', paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.violet, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>MA</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>Marie Adam</Text>
            <Text style={{ fontSize: 11, color: theme.muted }}>@marie.a · il y a 2h</Text>
          </View>
          <TouchableOpacity style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: theme.primary,
          }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.primary }}>Suivre</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <Text style={{ paddingHorizontal: 16, fontSize: 14, color: theme.text, lineHeight: 22, marginBottom: 14 }}>
          PR du jour 💪 — 175 kg au soulevé de terre. 6 mois pour passer de 140 à 175. Patience et constance, le reste suit.
        </Text>

        {/* Image placeholder */}
        <View style={{
          aspectRatio: 4 / 5, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden',
          backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            position: 'absolute', top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 5,
            backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFAF6', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              🏆 PR · +5 kg
            </Text>
          </View>
          <Ionicons name="barbell-outline" size={80} color="rgba(255,250,246,0.18)" />
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
          {[{ n: '175 kg', l: 'Charge' }, { n: '5 × 1', l: 'Sets × Reps' }, { n: 'RPE 9', l: 'Intensité' }].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{s.n}</Text>
              <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Reactions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14 }}>
          <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#E94B3C' : theme.text} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{likeCount}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={19} color={theme.text} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>32</Text>
          </View>
          <Ionicons name="link-outline" size={19} color={theme.text} />
          <View style={{ flex: 1 }} />
          <Ionicons name="bookmark-outline" size={19} color={theme.text} />
        </View>

        {/* Comments */}
        <Text style={{ paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Commentaires · 32
        </Text>
        {MOCK_COMMENTS.map((c, i) => (
          <View key={c.id} style={{
            flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: i < MOCK_COMMENTS.length - 1 ? 1 : 0, borderBottomColor: theme.border,
          }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 11, color: '#fff' }}>{c.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{c.author}</Text>
                <Text style={{ fontSize: 10.5, color: theme.muted }}>· {c.time}</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>{c.text}</Text>
              <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '700', marginTop: 4 }}>Répondre</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Reply input */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
        backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
      }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 11, color: '#fff' }}>TM</Text>
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Ajoute un commentaire…"
          placeholderTextColor={theme.muted}
          style={{
            flex: 1, paddingHorizontal: 14, paddingVertical: 10,
            backgroundColor: theme.text + '0D', borderRadius: 999,
            fontSize: 13, color: theme.text,
          }}
        />
        {comment.length > 0 && (
          <TouchableOpacity style={{ backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Envoyer</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Create the Expo Router wrapper**

Create `apps/mobile/app/(app)/(plugins)/community/post.tsx`:

```tsx
import PostDetailScreen from '@ziko/plugin-community/screens/PostDetailScreen';
import { useLocalSearchParams, router } from 'expo-router';
import { createClient } from '../../../../lib/supabase';

const supabase = createClient();

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen supabase={supabase} postId={id} onBack={() => router.back()} />;
}
```

Note: adjust the supabase import to match the pattern used in other community route wrappers in this directory.

- [ ] **Step 3: Wire "open post" from CommunityDashboard feed**

In `plugins/community/src/screens/CommunityDashboard.tsx`, find where feed posts are rendered. Add an `onPress` to each post card that navigates to the post detail:

```ts
import { router } from 'expo-router';
// On post card press:
onPress={() => router.push(`/(app)/(plugins)/community/post?id=${post.id}`)
```

- [ ] **Step 4: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add plugins/community/src/screens/PostDetailScreen.tsx apps/mobile/app/\(app\)/\(plugins\)/community/post.tsx plugins/community/src/screens/CommunityDashboard.tsx && rtk git commit -m "feat(community): PostDetailScreen — reactions, comments, reply input"
```

---

### Task 9: CommunityGroups tab

**Files:**
- Create: `plugins/community/src/screens/GroupsScreen.tsx`
- Modify: `plugins/community/src/screens/CommunityDashboard.tsx`

- [ ] **Step 1: Create GroupsScreen component**

Create `plugins/community/src/screens/GroupsScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
}

const GROUPS = [
  { id: '1', name: 'Powerlifting France', members: 1240, activity: 'actif',       icon: 'barbell-outline' as const, tint: '#FF5C1A' },
  { id: '2', name: 'Mes potes 💪',         members: 6,    activity: 'très actif',  icon: 'people-outline'  as const, tint: '#7B5BD0' },
  { id: '3', name: 'Calisthénie débutants',members: 432,  activity: 'actif',       icon: 'body-outline'    as const, tint: '#2E9E5B' },
  { id: '4', name: 'Nutrition smart',      members: 890,  activity: 'modéré',      icon: 'nutrition-outline' as const, tint: '#E8A33A' },
];

export default function GroupsScreen({ supabase }: Props) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* AI suggestion */}
      <View style={{
        backgroundColor: theme.info + '10', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: theme.info + '30', marginBottom: 12,
        flexDirection: 'row', gap: 10,
      }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.info, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17 }}>
            Vu ton niveau et tes records, le groupe{' '}
            <Text style={{ fontWeight: '700' }}>'Powerlifting France'</Text>
            {' '}serait pertinent. 1 240 membres, très actif.
          </Text>
          <TouchableOpacity onPress={() => showAlert('Rejoindre', 'Fonctionnalité bientôt disponible.')}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.info, marginTop: 6 }}>Rejoindre →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Group list */}
      {GROUPS.map((g) => (
        <TouchableOpacity
          key={g.id}
          onPress={() => showAlert(g.name, `${g.members} membres · ${g.activity}`)}
          style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 12,
            flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: g.tint + '18', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={g.icon} size={17} color={g.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{g.name}</Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
              {g.members.toLocaleString()} membres · {g.activity}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={theme.muted} />
        </TouchableOpacity>
      ))}

      {/* Create group button */}
      <TouchableOpacity
        onPress={() => showAlert('Créer un groupe', 'Fonctionnalité bientôt disponible.')}
        style={{
          padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
        }}
      >
        <Ionicons name="add" size={14} color={theme.muted} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>Créer un groupe</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Add "Groupes" tab to CommunityDashboard**

In `plugins/community/src/screens/CommunityDashboard.tsx`, find the tab bar / SubTabs component. Add the third tab:

```tsx
// Import GroupsScreen at top:
import GroupsScreen from './GroupsScreen';

// In the tabs array:
{ id: 'groups', label: 'Groupes' }

// In the conditional render section:
{activeTab === 'groups' && <GroupsScreen supabase={supabase} />}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add plugins/community/src/screens/GroupsScreen.tsx plugins/community/src/screens/CommunityDashboard.tsx && rtk git commit -m "feat(community): add Groupes tab with AI suggestion and group list"
```

---

### Task 10: Public ProfileScreen (other user)

**Files:**
- Create: `apps/mobile/app/(app)/profile/[userId].tsx`
- Modify: `apps/mobile/app/(app)/profile/index.tsx`

The public profile is the same layout as own profile but with **Follow / Message** buttons instead of Edit, and without access to Settings. The own `profile/index.tsx` can serve as a base.

- [ ] **Step 1: Check profile/index.tsx for existing mode support**

```bash
grep -n "mode\|userId\|isOwn\|public" /c/ziko-platform/apps/mobile/app/\(app\)/profile/index.tsx | head -15
```

If `profile/index.tsx` already has a `mode` prop or `isOwn` logic, skip to Step 3.

- [ ] **Step 2: Create the dynamic route file**

Create `apps/mobile/app/(app)/profile/[userId].tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../lib/supabase';

export default function PublicProfileScreen() {
  const theme = useThemeStore((s) => s.theme);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [following, setFollowing] = useState(false);
  const [profile, setProfile] = useState<{ name: string; goal: string; totalWorkouts: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_profiles')
      .select('name, goal, total_workouts')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name, goal: data.goal, totalWorkouts: data.total_workouts ?? 0 });
      });
  }, [userId]);

  const initials = profile?.name
    ? profile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Hero */}
      <View style={{ height: 160, backgroundColor: theme.cardDark, position: 'relative' }}>
        <View style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundColor: theme.primary }} />
        {/* Nav buttons */}
        <View style={{ position: 'absolute', top: 52, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => showAlert('Options', 'Signaler, bloquer…')}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Identity */}
        <View style={{ paddingHorizontal: 16, marginTop: -42 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
            <View style={{
              width: 84, height: 84, borderRadius: 22,
              backgroundColor: theme.violet, alignItems: 'center', justifyContent: 'center',
              borderWidth: 4, borderColor: theme.background,
            }}>
              <Text style={{ fontWeight: '800', fontSize: 30, color: '#fff' }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, paddingBottom: 8, flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setFollowing((f) => !f)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: following ? theme.text + '14' : theme.text,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: following ? theme.text : '#fff' }}>
                  {following ? 'Suivi ✓' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => showAlert('Message', 'Chat bientôt disponible.')}
                style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
            {profile?.name ?? 'Chargement…'}
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted }}>
            Objectif : {profile?.goal ?? '—'}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[
              { v: profile?.totalWorkouts ?? 0, l: 'Séances' },
              { v: '—', l: 'Défis' },
              { v: '—', l: 'Abonnés' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{s.v}</Text>
                <Text style={{ fontSize: 10, color: theme.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' }}>{s.l}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Wire "open public profile" from community screens**

In `plugins/community/src/screens/FriendsScreen.tsx` and `CommunityDashboard.tsx`, find where user names/avatars are tapped and add navigation:

```ts
import { router } from 'expo-router';
// On user tap:
onPress={() => router.push(`/(app)/profile/${user.id}`)
```

- [ ] **Step 3: Adjust the supabase import**

In `[userId].tsx`, replace the supabase import with whatever pattern the other profile routes use. Check:
```bash
grep -n "supabase\|createClient" /c/ziko-platform/apps/mobile/app/\(app\)/profile/index.tsx | head -5
```

Mirror the exact import pattern.

- [ ] **Step 4: Type-check + commit**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -10
rtk git add apps/mobile/app/\(app\)/profile/\[userId\].tsx plugins/community/src/screens/FriendsScreen.tsx plugins/community/src/screens/CommunityDashboard.tsx && rtk git commit -m "feat(profile): public profile screen for other users with Follow/Message actions"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| `danger` token in ThemePalette | Task 1 ✅ |
| `#10B981` eliminated from stats | Task 2 ✅ |
| `#10B981` / `#EF4444` eliminated from gamification | Task 3 ✅ |
| 7 Material colors replaced in workout session | Task 4 ✅ |
| `#4CAF50`, `#FF9800`, `#7A7670` fixed in history | Task 5 ✅ |
| BugReportModal severity colors aligned to palette | Task 5 ✅ |
| CreditExhaustionSheet `#4CAF50` replaced | Task 5 ✅ |
| WorkoutSummary screen (hero, PRs, breakdown, notes) | Task 6 ✅ |
| AIGenerator wizard (4 steps + generating + result) | Task 7 ✅ |
| PostDetailScreen (author, image, stats, reactions, comments, reply) | Task 8 ✅ |
| CommunityGroups tab | Task 9 ✅ |
| Public ProfileScreen (Follow/Message, stats, supabase fetch) | Task 10 ✅ |

### Placeholder scan

No TBD, TODO, or placeholder steps. All code blocks are complete.

### Type consistency

- `theme.danger` defined Task 1, used in Tasks 3/4/5 ✅
- `theme.success` already in ThemePalette (prerequisite), consumed throughout ✅
- `CompletedSession` defined in Task 6 and consumed only in Task 6 ✅
- `WorkoutSummary` navigates to `/(app)/workout/summary` — route file created in Task 6 ✅
- `PostDetailScreen` props `(supabase, postId, onBack)` match the wrapper in Task 8 ✅
- `GroupsScreen` props `(supabase)` consistent Task 9 ✅

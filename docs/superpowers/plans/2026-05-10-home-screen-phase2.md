# Home Screen Phase 2 — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkbox syntax for tracking.

**Goal:** Replace the current Home screen with the v2 design: `FormeDuJour` composite ring, `MissionCard` dark hero, `AICoachInline` tip, `QuickLogRow`, `WeekStrip`, compact `Recent`, and `PluginsDrawer` bottom sheet. Remove the weekly calendar strip, 6 quick-action buttons, permanent plugin grid, and standalone wellness cards.

**Architecture:**
- All new sub-components live inline in `apps/mobile/app/(app)/index.tsx` (no new files needed — they're Home-specific)
- `FormRing` uses `react-native-svg` (`Svg`, `Circle`) — already installed
- `PluginsDrawer` and QuickLog sheets use RN `Modal` (same pattern as habits plugin)
- Existing data loading hooks (`useEffect`, `useSleepStore`, `useHydrationStore`, etc.) are preserved — only the JSX layout changes
- `useThemeStore` used everywhere via `theme.*` tokens — no hardcoded colors

**Layout (top → bottom):**
1. Header — greeting + name + streak chip + notification bell + avatar initials
2. `FormeDuJour` — composite SVG ring, score, 4 breakdowns
3. `MissionCard` — dark hero, today's workout, 3 exercise preview, CTA
4. `AICoachInline` — rotating tips, credit badge, J'applique / Plus tard
5. `QuickLogRow` — 4 tap buttons: Eau / Humeur / Poids / Repas → Modal sheets
6. `WeekStrip` — 7-day grid (done/today/scheduled/rest states) in a Card
7. Section "Récent" — 3 last sessions compact
8. "Tous mes outils" button → `PluginsDrawer` Modal

**What's removed:**
- 7-day interactive calendar strip (`setSelectedDayIndex`, `weekDays`, `scheduledDays`, `workoutsByDay`, `sessionDates`, `selectedDay*` state)
- `DaySummaryCard` component and wellness section (4 plugin cards)
- `QuickActionBtn` component and 3 rows of 6 buttons
- Permanent plugin icons grid (`enabledPlugins.map(...)`)
- Calorie tracker shortcut row
- Challenges shortcut row

**What's kept:**
- All data loading: `loadRecentSessions`, `loadPrograms`, cross-plugin stores
- `streak` computation
- `todaySession`, `weeklyCount`, `weeklyGoal`, `greeting`
- `activeProgram`, `todaysWorkout`
- `sleepRecovery`, `waterPct`, `hydrationTodayMl`, `hydrationGoal`, `avgMood`, `latestWeight`
- `onRefresh` pull-to-refresh

---

## Task 1: Build `FormRing` + `FormeDuJour` components

**File:** `apps/mobile/app/(app)/index.tsx` (top of file, before `export default`)

- [ ] **Step 1: Add SVG import**

Add after the existing imports (around line 16):

```ts
import Svg, { Circle } from 'react-native-svg';
```

- [ ] **Step 2: Add `FormRing` component**

Add after imports, before `PLUGIN_ICON_COLORS`:

```tsx
function FormRing({ parts }: { parts: { value: number; color: string }[] }) {
  const SIZE = 140;
  const STROKE = 11;
  const r = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle
        cx={SIZE / 2} cy={SIZE / 2} r={r}
        stroke="rgba(28,26,23,0.06)" strokeWidth={STROKE} fill="none"
      />
      {parts.map((p, i) => {
        const portion = (p.value / total) * 0.92;
        const len = C * portion;
        const gap = C - len;
        const dashOffset = -(offset * C) - (C * 0.25); // -90° rotation
        const el = (
          <Circle key={i}
            cx={SIZE / 2} cy={SIZE / 2} r={r}
            stroke={p.color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${len} ${gap}`}
            strokeDashoffset={dashOffset}
            fill="none"
          />
        );
        offset += portion + 0.02;
        return el;
      })}
    </Svg>
  );
}
```

- [ ] **Step 3: Add `FormeDuJour` component**

The 4 parts are: sleep → `theme.violet`, water → `theme.info`, nutrition → `theme.primary`, load → `theme.success`.
Score = average of the 4 values.

Add after `FormRing`:

```tsx
function FormeDuJour({
  sleepPct, waterPct, nutritionPct, loadPct,
  sleepSub, waterSub, nutritionSub,
}: {
  sleepPct: number; waterPct: number; nutritionPct: number; loadPct: number;
  sleepSub: string; waterSub: string; nutritionSub: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const score = Math.round((sleepPct + waterPct + nutritionPct + loadPct) / 4);
  const parts = [
    { value: sleepPct, color: theme.violet, icon: 'moon-outline', label: 'Sommeil', sub: sleepSub },
    { value: waterPct, color: theme.info, icon: 'water-outline', label: 'Hydratation', sub: waterSub },
    { value: nutritionPct, color: theme.primary, icon: 'restaurant-outline', label: 'Nutrition', sub: nutritionSub },
    { value: loadPct, color: theme.success, icon: 'flash-outline', label: 'Charge', sub: 'Récup OK' },
  ] as const;

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 16,
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.muted }}>
        Forme du jour
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 }}>
        {score >= 80 ? 'Tu es en forme !' : score >= 60 ? 'Bonne journée' : 'Prends soin de toi'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
        {/* Ring */}
        <View style={{ width: 140, height: 140, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <FormRing parts={parts} />
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: theme.text, lineHeight: 36 }}>{score}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>/100</Text>
          </View>
        </View>
        {/* Breakdown */}
        <View style={{ flex: 1, gap: 10 }}>
          {parts.map((p) => (
            <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.color + '22',
              }}>
                <Ionicons name={p.icon as any} size={13} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{p.label}</Text>
                <Text style={{ fontSize: 10, color: theme.muted }}>{p.sub}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: p.color }}>{p.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors from these new components. If `react-native-svg` types complain, check `strokeDasharray` — pass as string `"${len} ${gap}"`.

- [ ] **Step 5: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/index.tsx && rtk git commit -m "feat(home): add FormRing + FormeDuJour composite score card"
```

---

## Task 2: Build `MissionCard` + `AICoachInline`

**File:** `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Add `MissionCard` component**

Add after `FormeDuJour`:

```tsx
function MissionCard({
  programName, workoutName, exercises, onStart,
}: {
  programName: string;
  workoutName: string;
  exercises: Array<{ name: string; detail: string }>;
  onStart: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      backgroundColor: theme.cardDark, borderRadius: 20, overflow: 'hidden', position: 'relative',
    }}>
      {/* Decorative gradient circle */}
      <Svg width="100%" height={180} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={300} cy={-20} r={160} fill="#FF5C1A" opacity={0.14} />
      </Svg>
      <View style={{ padding: 18 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,250,246,0.6)' }}>
          Mission du jour
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.cardDarkText, marginTop: 6, lineHeight: 26 }}>
          {workoutName}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.55)', marginTop: 4 }}>
          {programName} · {exercises.length} exercices
        </Text>
        {/* Exercise preview */}
        <View style={{ gap: 6, marginTop: 14, marginBottom: 14 }}>
          {exercises.slice(0, 3).map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 18, height: 18, borderRadius: 5, backgroundColor: 'rgba(255,92,26,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFB287' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: 'rgba(255,250,246,0.9)', fontSize: 12.5 }}>{e.name}</Text>
              <Text style={{ color: 'rgba(255,250,246,0.5)', fontSize: 11 }}>{e.detail}</Text>
            </View>
          ))}
          {exercises.length > 3 && (
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.45)', paddingLeft: 26 }}>
              +{exercises.length - 3} autres exercices
            </Text>
          )}
        </View>
        {/* CTA */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onStart} activeOpacity={0.8} style={{
            flex: 1, backgroundColor: theme.primary, borderRadius: 14,
            paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Allez, c'est parti !</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={{
            backgroundColor: 'rgba(255,250,246,0.1)', borderRadius: 14,
            paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="chevron-down" size={16} color={theme.cardDarkText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add `AICoachInline` component**

Add after `MissionCard`:

```tsx
const AI_TIPS = [
  { tag: 'Pré-séance', text: 'Tu as bien récupéré cette nuit. Bon créneau pour pousser sur les charges — vise +2.5 kg sur ta dernière série.' },
  { tag: 'Hydratation', text: "Pense à boire 500 ml supplémentaires avant 14h pour optimiser ta récupération musculaire." },
  { tag: 'Nutrition', text: "Il te manque environ 600 kcal pour atteindre ta cible. Prépare un repas protéiné pour ce soir." },
];

function AICoachInline({ creditBalance }: { creditBalance: number }) {
  const theme = useThemeStore((s) => s.theme);
  const [idx, setIdx] = React.useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((x) => (x + 1) % AI_TIPS.length), 6500);
    return () => clearInterval(t);
  }, []);
  const tip = AI_TIPS[idx];
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 14,
      borderWidth: 1, borderColor: theme.primary + '38',
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Ionicons name="sparkles" size={16} color="#FFE6D9" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Coach Ziko
          </Text>
          <Text style={{ fontSize: 10, color: theme.muted }}>· {tip.tag}</Text>
          <View style={{
            marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: theme.cardDark + '12', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
          }}>
            <Ionicons name="flash" size={10} color={theme.muted} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>{creditBalance}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: theme.text }}>{tip.text}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <TouchableOpacity activeOpacity={0.75} style={{
            backgroundColor: theme.cardDark, borderRadius: 99,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>J'applique</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.75} style={{
            backgroundColor: theme.border, borderRadius: 99,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: '600' }}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/index.tsx && rtk git commit -m "feat(home): add MissionCard dark hero + AICoachInline tip card"
```

---

## Task 3: Build `QuickLogRow`, `WeekStrip`, `PluginsDrawer`

**File:** `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Add `QuickLogSheet` + `QuickLogRow`**

Add after `AICoachInline`. Uses RN `Modal` (transparent + slide) like the habits plugin:

```tsx
function QuickLogSheet({
  visible, title, onClose, children,
}: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{
        backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36, gap: 16,
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4 }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

function QuickLogRow({
  onLogWater, onLogMood, onLogWeight, onLogMeal,
}: {
  onLogWater: () => void; onLogMood: () => void;
  onLogWeight: () => void; onLogMeal: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const items = [
    { label: '+250ml', icon: 'water-outline', color: theme.info, onPress: onLogWater },
    { label: 'Humeur', icon: 'happy-outline', color: theme.success, onPress: onLogMood },
    { label: 'Poids', icon: 'scale-outline', color: theme.warn, onPress: onLogWeight },
    { label: 'Repas', icon: 'restaurant-outline', color: theme.primary, onPress: onLogMeal },
  ] as const;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <TouchableOpacity key={it.label} onPress={it.onPress} activeOpacity={0.7} style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
          borderColor: theme.border, padding: 10, alignItems: 'center', gap: 4,
          shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        }}>
          <View style={{
            width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
            backgroundColor: it.color + '22',
          }}>
            <Ionicons name={it.icon as any} size={15} color={it.color} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Add `WeekStrip` component**

Add after `QuickLogRow`:

```tsx
function WeekStrip({
  weeklyCount, weeklyGoal, sessionDates,
}: { weeklyCount: number; weeklyGoal: number; sessionDates: Set<string> }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const today = startOfDay(new Date());
  const jsToday = getDay(today);
  const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
  const monday = addDays(today, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = format(date, 'yyyy-MM-dd');
    const isToday = differenceInCalendarDays(date, today) === 0;
    const done = sessionDates.has(key);
    return { label: DAY_LABELS[i], num: format(date, 'd'), isToday, done };
  });

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 14,
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
          Semaine · <Text style={{ color: theme.primary }}>{weeklyCount}/{weeklyGoal}</Text>
        </Text>
        {weeklyGoal - weeklyCount > 0 && (
          <Text style={{ fontSize: 11, color: theme.muted }}>+{weeklyGoal - weeklyCount} pour l'objectif</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {days.map((d, i) => {
          let bg = 'transparent';
          let textColor = theme.muted;
          let border: object = { borderWidth: 1, borderColor: theme.border };
          if (d.done) { bg = theme.success; textColor = '#fff'; border = {}; }
          else if (d.isToday) { bg = theme.cardDark; textColor = '#fff'; border = {}; }
          return (
            <View key={i} style={[{
              flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: bg,
              alignItems: 'center', justifyContent: 'center',
            }, border]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: textColor, opacity: 0.7 }}>{d.label}</Text>
              {d.done ? (
                <Ionicons name="checkmark" size={12} color="#fff" style={{ marginTop: 2 }} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '800', color: textColor, marginTop: 2 }}>{d.num}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Add `PluginsDrawer` component**

Add after `WeekStrip`. The `open`/`onClose` state lives in the parent screen:

```tsx
const PLUGIN_COLORS: Record<string, string> = {
  habits: '#FF5C1A', nutrition: '#FF5C1A', persona: '#FF6584', stats: '#E8A33A',
  gamification: '#FF5C1A', community: '#2E7BF6', stretching: '#FF5C1A', sleep: '#7B5BD0',
  measurements: '#2E9E5B', timer: '#FF5C1A', 'ai-programs': '#2E7BF6', journal: '#FF5C1A',
  hydration: '#2E7BF6', cardio: '#E94B3C', supplements: '#2E9E5B', wearables: '#E91E63',
  rpe: '#7B5BD0',
};

function PluginsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const manifests = usePluginRegistry((s) => s.manifests);
  if (!open) return null;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{
        backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36, maxHeight: '75%',
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Tous mes outils</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>{enabledPlugins.length} modules installés</Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{
            width: 32, height: 32, borderRadius: 10, backgroundColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="close" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {enabledPlugins.map((pid) => {
              const manifest = manifests[pid];
              const mainRoute = manifest?.routes.find((r) => r.showInTabBar) ?? manifest?.routes[0];
              const destination = mainRoute?.path ?? `/(app)/store/${pid}`;
              const color = PLUGIN_COLORS[pid] ?? theme.primary;
              return (
                <TouchableOpacity key={pid} onPress={() => { onClose(); router.push(destination as any); }}
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
        </ScrollView>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/index.tsx && rtk git commit -m "feat(home): add QuickLogRow, WeekStrip, PluginsDrawer components"
```

---

## Task 4: Rewrite `DashboardScreen` layout

**File:** `apps/mobile/app/(app)/index.tsx`

This task replaces the `return (...)` JSX inside `export default function DashboardScreen()` and removes the state/variables that are no longer needed.

- [ ] **Step 1: Add QuickLog sheet state + handler stubs**

Inside `DashboardScreen`, after the existing `const [refreshing, setRefreshing]` line, add:

```ts
const [drawerOpen, setDrawerOpen] = React.useState(false);
const [quickSheet, setQuickSheet] = React.useState<null | 'water' | 'mood' | 'weight' | 'meal'>(null);
```

- [ ] **Step 2: Remove unused state**

Remove these lines from `DashboardScreen` (they were for the calendar strip):
```ts
const [selectedDayIndex, setSelectedDayIndex] = React.useState<number | null>(null);
```
And remove all derived variables that use it: `weekDays`, `scheduledDays`, `workoutsByDay`, `sessionDates`, `selectedDay`, `selectedWorkout`, `selectedDayDone`, `selectedIsPast`, `selectedIsToday`, `jsToDb`, `todayDbDay`, `DAY_LABELS`.

Keep for `WeekStrip`:
```ts
const sessionDates = React.useMemo(() => {
  return new Set(recentSessions.map((s) => format(new Date(s.started_at), 'yyyy-MM-dd')));
}, [recentSessions]);
```

- [ ] **Step 3: Build exercise list for MissionCard**

Add inside `DashboardScreen` after existing useMemos:

```ts
const missionExercises = React.useMemo(() => {
  if (!todaysWorkout?.program_exercises) return [];
  return todaysWorkout.program_exercises
    .sort((a, b) => a.order_index - b.order_index)
    .map((pe) => ({ name: tExercise(pe.exercises?.name ?? 'Exercise'), detail: formatExerciseDetail(pe) }));
}, [todaysWorkout, tExercise]);
```

- [ ] **Step 4: Replace `return (...)` entirely**

Replace the entire `return (...)` block of `DashboardScreen` with:

```tsx
return (
  <View style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingTop: 20 + insets.top, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* ── Header ───────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <View>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{greeting}</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 }}>
            {profile?.name ?? 'Athlete'}
            <Text style={{ color: theme.primary }}>.</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {streak > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.warn + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
              <Text style={{ fontSize: 12 }}>🔥</Text>
              <Text style={{ color: theme.warn, fontWeight: '700', fontSize: 12 }}>{streak}j</Text>
            </View>
          )}
          <TouchableOpacity style={{
            width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="notifications-outline" size={16} color={theme.text} />
          </TouchableOpacity>
          <View style={{
            width: 36, height: 36, borderRadius: 12, backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
              {(profile?.name ?? 'A').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* ── FormeDuJour ──────────────────── */}
      <View style={{ marginBottom: 12 }}>
        <FormeDuJour
          sleepPct={sleepRecovery}
          waterPct={waterPct}
          nutritionPct={50}
          loadPct={weeklyCount >= weeklyGoal ? 95 : Math.round((weeklyCount / weeklyGoal) * 80)}
          sleepSub={sleepRecovery > 0 ? `Récup. ${sleepRecovery}%` : 'Pas de données'}
          waterSub={hydrationTodayMl > 0 ? `${(hydrationTodayMl / 1000).toFixed(1)}L / ${(hydrationGoal / 1000).toFixed(1)}L` : 'Pas de données'}
          nutritionSub="Log ton repas"
        />
      </View>

      {/* ── MissionCard ──────────────────── */}
      {activeProgram && todaysWorkout ? (
        <View style={{ marginBottom: 12 }}>
          <MissionCard
            programName={activeProgram.name}
            workoutName={todaysWorkout.name}
            exercises={missionExercises}
            onStart={() => handleStartWorkout(todaysWorkout)}
          />
        </View>
      ) : !activeProgram ? (
        <TouchableOpacity
          onPress={() => router.push('/(app)/workout')}
          style={{
            backgroundColor: theme.surface, borderRadius: 20, padding: 18,
            borderWidth: 1, borderColor: theme.border, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>Créer un programme</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Démarre ton premier plan d'entraînement</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>
      ) : null}

      {/* ── AICoachInline ────────────────── */}
      <View style={{ marginBottom: 12 }}>
        <AICoachInline creditBalance={47} />
      </View>

      {/* ── QuickLogRow ──────────────────── */}
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Quick log</Text>
      <View style={{ marginBottom: 20 }}>
        <QuickLogRow
          onLogWater={() => setQuickSheet('water')}
          onLogMood={() => setQuickSheet('mood')}
          onLogWeight={() => setQuickSheet('weight')}
          onLogMeal={() => router.push('/(app)/(plugins)/nutrition/log' as any)}
        />
      </View>

      {/* ── WeekStrip ────────────────────── */}
      <View style={{ marginBottom: 20 }}>
        <WeekStrip weeklyCount={weeklyCount} weeklyGoal={weeklyGoal} sessionDates={sessionDates} />
      </View>

      {/* ── Recent ───────────────────────── */}
      {recentSessions.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Récent</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 8, marginBottom: 20 }}>
            {recentSessions.slice(0, 3).map((session) => (
              <View key={session.id} style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 12,
                borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: theme.primary + '18',
                }}>
                  <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{session.name ?? 'Workout'}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11 }}>{format(new Date(session.started_at), 'EEE, d MMM')}</Text>
                </View>
                {session.total_volume_kg != null && (
                  <Text style={{ color: theme.success, fontWeight: '700', fontSize: 13 }}>
                    {session.total_volume_kg.toLocaleString()} kg
                  </Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Tous mes outils ──────────────── */}
      <TouchableOpacity
        onPress={() => setDrawerOpen(true)}
        activeOpacity={0.75}
        style={{
          backgroundColor: theme.surface, borderRadius: 18, padding: 14,
          borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}
      >
        <View style={{
          width: 38, height: 38, borderRadius: 11,
          backgroundColor: theme.cardDark + '12', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="grid-outline" size={18} color={theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Tous mes outils</Text>
          <Text style={{ color: theme.muted, fontSize: 11 }}>Garde-manger, sommeil, mesures…</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.muted} />
      </TouchableOpacity>
    </ScrollView>

    {/* ── Drawers & Sheets ──────────────── */}
    <PluginsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

    <QuickLogSheet visible={quickSheet === 'water'} title="+250 ml d'eau" onClose={() => setQuickSheet(null)}>
      <Text style={{ color: '#6B6963', fontSize: 14 }}>Tap pour confirmer l'ajout de 250 ml</Text>
      <TouchableOpacity
        onPress={() => {
          if (useHydrationStore) useHydrationStore.getState().logWater?.(supabase, 250);
          setQuickSheet(null);
        }}
        style={{ backgroundColor: '#2E7BF6', borderRadius: 14, padding: 16, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ajouter +250 ml</Text>
      </TouchableOpacity>
    </QuickLogSheet>

    <QuickLogSheet visible={quickSheet === 'mood'} title="Comment tu te sens ?" onClose={() => setQuickSheet(null)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {[1, 2, 3, 4, 5].map((m) => (
          <TouchableOpacity key={m} onPress={() => {
            if (useJournalStore) useJournalStore.getState().logMood?.(supabase, m);
            setQuickSheet(null);
          }} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 28 }}>{['😞', '😕', '😐', '🙂', '😄'][m - 1]}</Text>
            <Text style={{ fontSize: 11, color: '#6B6963' }}>{m}/5</Text>
          </TouchableOpacity>
        ))}
      </View>
    </QuickLogSheet>

    <QuickLogSheet visible={quickSheet === 'weight'} title="Log ton poids" onClose={() => setQuickSheet(null)}>
      <TouchableOpacity
        onPress={() => router.push('/(app)/(plugins)/measurements/dashboard' as any)}
        style={{ backgroundColor: '#E8A33A', borderRadius: 14, padding: 16, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ouvrir Mesures</Text>
      </TouchableOpacity>
    </QuickLogSheet>
  </View>
);
```

- [ ] **Step 5: Remove unused imports**

Check for imports no longer needed:
- `ProgressBar` from `@ziko/ui` (removed — WeekStrip is inline)
- `useAIStore` (still needed if `openChat` used elsewhere — check; if not, remove)
- Remove `date-fns` imports that were only for the old calendar strip: `addDays`, `getDay` — but keep them because `WeekStrip` uses them

Actually keep all imports; just remove `useAIStore` if not used in new layout.

```bash
grep -n "useAIStore\|ProgressBar\|openChat" /c/ziko-platform/apps/mobile/app/'(app)'/index.tsx | head -10
```

Remove any that have no remaining usage.

- [ ] **Step 6: Type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Common fixes:
- `Modal` must be imported from `react-native` (it's already there — habits uses it; if not in current imports, add it)
- `sessionDates` is now needed again — ensure the `useMemo` is kept
- `formatExerciseDetail` still needed for `missionExercises`

- [ ] **Step 7: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/index.tsx && rtk git commit -m "feat(home): v2 layout — FormeDuJour, MissionCard, AICoach, QuickLog, WeekStrip, PluginsDrawer"
```

---

## Task 5: Verify imports and cleanup

**File:** `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Check Modal is imported**

```bash
grep "^import.*Modal" /c/ziko-platform/apps/mobile/app/'(app)'/index.tsx
```

If `Modal` is not in the RN import line, add it. The line should be:
```ts
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
```

- [ ] **Step 2: Remove unused imports**

Specifically check:
- `ProgressBar` from `@ziko/ui` — remove if not used
- `useAIStore` — remove if `openChat` is no longer called in the new layout

- [ ] **Step 3: Final type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Expected: 0 errors.

- [ ] **Step 4: Final commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/index.tsx && rtk git commit -m "chore(home): cleanup unused imports after v2 layout"
```

---

## Self-Review

**Spec §2 Suppressions** → Removed: calendar strip, 4 wellness cards, plugin grid, 6 quick-action buttons, calorie shortcut row, challenges row ✅

**Spec §2 New components:**
- `FormeDuJour` anneau SVG composite → Task 1 ✅
- `MissionCard` hero dark → Task 2 ✅
- `AICoachInline` rotating tips + credit badge → Task 2 ✅
- `QuickLogRow` 4 tap buttons + Modal sheets → Task 3 ✅
- `PluginsDrawer` Modal bottom sheet 4-col grid → Task 3 ✅

**Spec §2 Layout order:** Header → FormeDuJour → MissionCard → AICoachInline → QuickLogRow → WeekStrip → Récent → Tous mes outils → Task 4 ✅

**Data preservation:** sleepRecovery, waterPct, hydrationTodayMl, weeklyCount, streak, profile, recentSessions, activeProgram — all computed and passed as props ✅

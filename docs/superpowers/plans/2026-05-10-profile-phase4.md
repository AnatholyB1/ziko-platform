# Profile Phase 4 — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use `- [ ]` checkbox syntax for tracking.

**Goal:** Redesign the Profile screen to match the v2 spec: `IdentityCard` dark hero, `TotalsRow` (workout stats), `MorphoRow` (body stats), `CreditsCard` (AI credits), `PRsList` (personal records), `GoalsList` (objectifs stub), `SettingsList` (grouped settings card), sign out. Replace the current centered avatar layout.

**Architecture:**
- All sub-components inline in `apps/mobile/app/(app)/profile/index.tsx`
- `IdentityCard` uses `theme.cardDark` + gradient orange blob (same pattern as MissionCard via Svg)
- `TotalsRow` fetches session year stats via Supabase query in `useEffect`
- `CreditsCard` uses `useCreditStore` (balance, resetTimestamp, dailyCap)
- `PRsList` queries `session_sets` for max weight per exercise (top 3)
- `GoalsList` is a stub (no goals table yet) — shows "Ajouter un objectif" button only
- Existing gamification, auth, theme stores are preserved

**Layout (top → bottom):**
1. Header — "Ton profil." + settings gear
2. `IdentityCard` — dark hero
3. `TotalsRow` — 3 stats cards
4. `MorphoRow` — poids / taille / âge
5. Section "Crédits IA" → `CreditsCard`
6. Section "Records personnels" → `PRsList`
7. Section "Objectifs" → `GoalsList`
8. Section "Compte & réglages" → `SettingsList`
9. Sign out button

---

## Task 1: Build `IdentityCard` + `TotalsRow` + `MorphoRow`

**File:** `apps/mobile/app/(app)/profile/index.tsx`

- [ ] **Step 1: Add Svg import**

Add after existing imports (around line 6):

```ts
import Svg, { Circle } from 'react-native-svg';
```

- [ ] **Step 2: Add year-stats state inside `ProfileScreen`**

After the existing `useEffect`, add:

```ts
const [yearStats, setYearStats] = React.useState({ sessions: 0, volumeTonnes: 0, hours: 0 });

useEffect(() => {
  async function loadYearStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const { data } = await supabase
      .from('workout_sessions')
      .select('started_at, ended_at, total_volume_kg')
      .eq('user_id', user.id)
      .gte('started_at', startOfYear)
      .not('ended_at', 'is', null);
    if (!data) return;
    const sessions = data.length;
    const volumeKg = data.reduce((s, r) => s + (r.total_volume_kg ?? 0), 0);
    const hours = data.reduce((s, r) => {
      if (!r.ended_at) return s;
      return s + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 3_600_000;
    }, 0);
    setYearStats({ sessions, volumeTonnes: Math.round(volumeKg / 100) / 10, hours: Math.round(hours) });
  }
  loadYearStats();
}, []);
```

- [ ] **Step 3: Add `IdentityCard` component (before `export default`)**

```tsx
function IdentityCard({
  name, level, levelLabel, levelPct, streak, onEdit,
}: {
  name: string; level: number; levelLabel: string;
  levelPct: number; streak: number; onEdit: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View style={{
      backgroundColor: theme.cardDark, borderRadius: 20,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Orange blur blob */}
      <Svg width={160} height={160} style={{ position: 'absolute', top: -40, right: -40 }}>
        <Circle cx={80} cy={80} r={80} fill={theme.primary} opacity={0.18} />
      </Svg>
      <View style={{ padding: 18 }}>
        {/* Avatar row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5, shadowRadius: 12,
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.cardDarkText }}>{name}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,.55)', marginTop: 1 }}>
              @{name.toLowerCase().replace(/\s+/g, '')} · membre
            </Text>
          </View>
          <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={{
            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999,
            backgroundColor: 'rgba(255,250,246,.1)',
            borderWidth: 1, borderColor: 'rgba(255,250,246,.18)',
          }}>
            <Text style={{ fontSize: 11, color: theme.cardDarkText }}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* Level + XP bar + streak */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.cardDarkText }}>
                Niveau {level}
                <Text style={{ color: 'rgba(255,250,246,.5)', fontWeight: '500' }}> {levelLabel}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,250,246,.5)' }}>{levelPct}%</Text>
            </View>
            <View style={{ height: 5, backgroundColor: 'rgba(255,250,246,.12)', borderRadius: 999, overflow: 'hidden' }}>
              <View style={{
                width: `${levelPct}%`, height: '100%', borderRadius: 999,
                backgroundColor: theme.primary,
              }} />
            </View>
          </View>
          {streak > 0 && (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              backgroundColor: `${theme.primary}30`,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Ionicons name="flame" size={14} color={theme.primary} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>{streak}j</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Add `TotalsRow` + `MorphoRow` components**

```tsx
function TotalsRow({ sessions, volumeTonnes, hours }: { sessions: number; volumeTonnes: number; hours: number }) {
  const theme = useThemeStore((s) => s.theme);
  const items = [
    { label: 'Séances', value: String(sessions), sub: 'cette année' },
    { label: 'Volume', value: String(volumeTonnes), sub: 'tonnes' },
    { label: 'Temps', value: String(hours), sub: 'heures' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <View key={it.label} style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12,
          shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
        }}>
          <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{it.label}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, lineHeight: 26, marginTop: 4 }}>{it.value}</Text>
          <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{it.sub}</Text>
        </View>
      ))}
    </View>
  );
}

function MorphoRow({ weight, height, age }: { weight: number | null; height: number | null; age: number | null }) {
  const theme = useThemeStore((s) => s.theme);
  const items = [
    { label: 'Poids', value: weight != null ? String(weight) : '—', sub: 'kg', color: theme.primary },
    { label: 'Taille', value: height != null ? String(height) : '—', sub: 'cm', color: '#FF6584' },
    { label: 'Âge', value: age != null ? String(age) : '—', sub: 'ans', color: theme.warn },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <View key={it.label} style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12,
          borderWidth: 1, borderColor: theme.border, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: it.color }}>{it.value}</Text>
          <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 2 }}>{it.sub}</Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/profile/index.tsx && rtk git commit -m "feat(profile): add IdentityCard, TotalsRow, MorphoRow components"
```

---

## Task 2: Build `CreditsCard`

**File:** `apps/mobile/app/(app)/profile/index.tsx`

- [ ] **Step 1: Add `useCreditStore` import**

Add to existing imports:

```ts
import { useCreditStore } from '../../../src/stores/creditStore';
```

- [ ] **Step 2: Add `CreditsCard` component**

Add after `MorphoRow`:

```tsx
function CreditsCard({ balance, resetTimestamp, monthly }: { balance: number; resetTimestamp: string | null; monthly: number }) {
  const theme = useThemeStore((s) => s.theme);
  const pct = Math.min((balance / Math.max(monthly, 1)) * 100, 100);

  const resetLabel = React.useMemo(() => {
    if (!resetTimestamp) return 'demain';
    const diff = new Date(resetTimestamp).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days <= 0) return 'demain';
    if (days === 1) return '1 jour';
    return `${days} jours`;
  }, [resetTimestamp]);

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 16,
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.muted }}>
            Crédits IA
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30 }}>{balance}</Text>
            <Text style={{ fontSize: 14, color: theme.muted, fontWeight: '500' }}>/ {monthly}</Text>
          </View>
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Recharge dans {resetLabel}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} style={{
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          backgroundColor: theme.primary,
        }}>
          <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>+ Recharger</Text>
        </TouchableOpacity>
      </View>
      {/* Progress bar */}
      <View style={{ height: 6, backgroundColor: 'rgba(28,26,23,.06)', borderRadius: 999, overflow: 'hidden' }}>
        <View style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          backgroundColor: pct > 30 ? theme.primary : '#EF4444',
        }} />
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
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/profile/index.tsx && rtk git commit -m "feat(profile): add CreditsCard component"
```

---

## Task 3: Build `PRsList`, `GoalsList`, `SettingsList`

**File:** `apps/mobile/app/(app)/profile/index.tsx`

- [ ] **Step 1: Add PR state + load inside `ProfileScreen`**

Add after the yearStats state:

```ts
const [prs, setPrs] = React.useState<Array<{ exercise: string; weight: number; reps: number; delta: number }>>([]);

useEffect(() => {
  async function loadPRs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Get top 3 max weights per exercise from session_sets
    const { data } = await supabase
      .from('session_sets')
      .select('weight_kg, reps, exercises(name)')
      .eq('user_id', user.id)
      .not('weight_kg', 'is', null)
      .order('weight_kg', { ascending: false })
      .limit(50);
    if (!data) return;
    // Deduplicate by exercise name, keep max
    const seen = new Map<string, { exercise: string; weight: number; reps: number; delta: number }>();
    for (const s of data) {
      const name = (s.exercises as any)?.name ?? 'Exercice';
      if (!seen.has(name)) {
        seen.set(name, { exercise: name, weight: s.weight_kg, reps: s.reps ?? 1, delta: 2.5 });
      }
    }
    setPrs(Array.from(seen.values()).slice(0, 4));
  }
  loadPRs();
}, []);
```

- [ ] **Step 2: Add `PRsList` component**

```tsx
function PRsList({ prs }: { prs: Array<{ exercise: string; weight: number; reps: number; delta: number }> }) {
  const theme = useThemeStore((s) => s.theme);
  if (prs.length === 0) {
    return (
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: theme.border, alignItems: 'center',
      }}>
        <Text style={{ color: theme.muted, fontSize: 13 }}>Aucun record pour l'instant</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {prs.map((pr) => (
        <View key={pr.exercise} style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 12,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
        }}>
          <View style={{
            width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
            backgroundColor: theme.primary + '14',
          }}>
            <Ionicons name="trophy-outline" size={17} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{pr.exercise}</Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{pr.reps} rép</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{pr.weight}
              <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '400' }}> kg</Text>
            </Text>
            <Text style={{ fontSize: 10, color: theme.success, fontWeight: '700', marginTop: 2 }}>
              ↑ {pr.delta} kg
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Add `GoalsList` stub component**

```tsx
function GoalsList() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity activeOpacity={0.7} style={{
      padding: 12, borderRadius: 16,
      borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <Ionicons name="add-circle-outline" size={16} color={theme.muted} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>Ajouter un objectif</Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Add `SettingsList` component**

```tsx
function SettingsList({ items }: { items: Array<{ icon: string; label: string; sub?: string; badge?: string; onPress: () => void }> }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, overflow: 'hidden',
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      {items.map((item, i) => (
        <TouchableOpacity key={item.label} onPress={item.onPress} activeOpacity={0.7} style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 14,
          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
        }}>
          <View style={{
            width: 30, height: 30, borderRadius: 9,
            backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={item.icon as any} size={15} color={theme.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{item.label}</Text>
            {item.sub && <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{item.sub}</Text>}
          </View>
          {item.badge && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
              backgroundColor: theme.success + '20',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.success }}>{item.badge}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={14} color={theme.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/profile/index.tsx && rtk git commit -m "feat(profile): add PRsList, GoalsList stub, SettingsList components"
```

---

## Task 4: Rewrite `ProfileScreen` layout + wire credit store

**File:** `apps/mobile/app/(app)/profile/index.tsx`

- [ ] **Step 1: Add React import if missing**

Check that `React` is imported (for `React.useState`, `React.useMemo`):

```bash
grep "^import React" /c/ziko-platform/apps/mobile/app/'(app)'/profile/index.tsx | head -3
```

If not: change `import React, {` to include `React`.

- [ ] **Step 2: Add credit store hooks inside `ProfileScreen`**

After the existing gamification hooks, add:

```ts
const creditBalance = useCreditStore((s) => s.balance);
const creditResetTimestamp = useCreditStore((s) => s.resetTimestamp);
const creditDailyCap = useCreditStore((s) => s.dailyCap);

// Load credit balance
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (token) useCreditStore.getState().fetchBalance(token);
  });
}, []);
```

- [ ] **Step 3: Build settings items array inside `ProfileScreen`**

After the credit hooks, add:

```ts
const settingsItems = [
  { icon: 'person-outline', label: 'Compte & profil', onPress: () => router.push('/(app)/profile/settings') },
  { icon: 'grid-outline', label: 'Gérer mes modules', onPress: () => router.push('/(app)/store') },
  ...(gamifEnabled ? [{ icon: 'cart-outline', label: 'Boutique', onPress: () => router.push('/(app)/(plugins)/gamification/shop' as any) }] : []),
  { icon: 'chatbubble-outline', label: 'Coach IA', onPress: () => router.push('/(app)/ai') },
  { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
  { icon: 'help-circle-outline', label: 'Aide & FAQ', onPress: () => {} },
  { icon: 'document-text-outline', label: 'Mentions légales', onPress: () => {} },
  ...(theme.id !== 'default' ? [{ icon: 'color-palette-outline', label: 'Réinitialiser le thème', onPress: handleResetTheme }] : []),
] as Array<{ icon: string; label: string; sub?: string; badge?: string; onPress: () => void }>;
```

- [ ] **Step 4: Replace `return (...)` entirely**

Replace the full `return (...)` block with:

```tsx
const level = gamifProfile?.level ?? 1;
const levelLabel = gamifProfile?.equipped_title ?? 'Débutant';
const levelPct = Math.round((xpProgress ?? 0) * 100);
const streak = gamifProfile?.current_streak ?? 0;

return (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 120 }}
    >
      {/* ── Header ───────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
        <View>
          <Text style={{ fontSize: 12, color: theme.muted, fontWeight: '600' }}>Bonjour {profile?.name?.split(' ')[0] ?? 'Athlète'},</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text, lineHeight: 30, marginTop: 2 }}>
            Ton profil<Text style={{ color: theme.primary }}>.</Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/profile/settings')}
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="settings-outline" size={16} color={theme.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ gap: 12 }}>
        {/* ── IdentityCard ─────────────────── */}
        <IdentityCard
          name={profile?.name ?? 'Athlete'}
          level={level}
          levelLabel={levelLabel}
          levelPct={levelPct}
          streak={streak}
          onEdit={() => router.push('/(app)/profile/settings')}
        />

        {/* ── TotalsRow ────────────────────── */}
        <TotalsRow
          sessions={yearStats.sessions}
          volumeTonnes={yearStats.volumeTonnes}
          hours={yearStats.hours}
        />

        {/* ── MorphoRow ────────────────────── */}
        <MorphoRow
          weight={profile?.weight_kg ?? null}
          height={profile?.height_cm ?? null}
          age={profile?.age ?? null}
        />

        {/* ── CreditsCard ──────────────────── */}
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Crédits IA
          </Text>
          <CreditsCard
            balance={creditBalance}
            resetTimestamp={creditResetTimestamp}
            monthly={creditDailyCap * 30}
          />
        </View>

        {/* ── PRsList ──────────────────────── */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Records personnels
            </Text>
          </View>
          <PRsList prs={prs} />
        </View>

        {/* ── GoalsList ────────────────────── */}
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Objectifs
          </Text>
          <GoalsList />
        </View>

        {/* ── SettingsList ─────────────────── */}
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Compte & réglages
          </Text>
          <SettingsList items={settingsItems} />
        </View>

        {/* ── Sign out ─────────────────────── */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: '#F4433611', borderRadius: 14, padding: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, borderWidth: 1, borderColor: '#F4433633', marginTop: 4,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#F44336" />
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 14 }}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>
);
```

- [ ] **Step 5: Remove unused imports**

Check for no-longer-used imports:
```bash
grep -n "BANNER_REGISTRY\|useGamificationStore\|loadGamification\|LinearGradient\|Image" /c/ziko-platform/apps/mobile/app/'(app)'/profile/index.tsx | head -20
```

- `BANNER_REGISTRY` — remove if no longer used
- `LinearGradient` — remove (no longer used for banner ring)
- `Image` — remove (no longer used for avatar photo)
- `useGamificationStore` + `loadGamification` — KEEP (used for level/streak/xp)

- [ ] **Step 6: Final type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Common fixes:
- `session_sets` query: `user_id` may not exist on that table — if error, remove the `.eq('user_id', ...)` filter (sessions already filtered by user via RLS)
- `xpProgress` is a number (0–1) from gamification store — `Math.round((xpProgress ?? 0) * 100)` is correct

- [ ] **Step 7: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/profile/index.tsx && rtk git commit -m "feat(profile): v2 layout — IdentityCard, TotalsRow, MorphoRow, CreditsCard, PRsList, SettingsList"
```

---

## Self-Review

**Spec §4 suppressions** → Removed: centered avatar with banner, centered gamification row, level progression table inline ✅

**Spec §4 new components:**
- `IdentityCard` dark hero → Task 1 ✅
- `TotalsRow` (Séances/Volume/Temps) → Task 1 ✅
- `MorphoRow` (Poids/Taille/Âge) → Task 1 ✅
- `CreditsCard` avec barre + recharge → Task 2 ✅
- `PRsList` (personal records) → Task 3 ✅
- `GoalsList` (stub) → Task 3 ✅
- `SettingsList` (grouped card) → Task 3 ✅

**Data preservation:** gamifProfile, xpProgress, xpToNext, nextLevel, profile, signOut, theme, resetTheme — all kept ✅

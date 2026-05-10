# Store Tab Phase 5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Store tab to match the v2 design — "Boutique." header, category filter pills (Training/Nutrition/Santé/Coaching/Social), horizontal `FeaturedRow` of dark cards for highlighted plugins, compact `PluginRow` list with PRO badge and toggle-style install button, and a clean install/uninstall confirm flow using `showAlert`.

**Architecture:** All changes are in `apps/mobile/app/(app)/store/index.tsx`. The existing data loading (Supabase queries for `plugins_registry`, `plugin_reviews`, `user_plugins`) and install/uninstall logic are preserved and kept exactly as-is. Only the constants, components, and JSX layout are replaced. The `SectionTitle`, `Stars`, and `PluginCard` components are removed and replaced by `FeaturedRow`, `PluginRow`.

**Tech Stack:** React Native, Ionicons, Supabase, `useThemeStore`, `usePluginRegistry`, `showAlert` from `@ziko/plugin-sdk`

---

## File Map

| File | Action |
|------|--------|
| `apps/mobile/app/(app)/store/index.tsx` | Full rewrite of constants + components + layout; data logic preserved |

---

### Task 1: Replace constants (categories + colors + featured set)

**Files:**
- Modify: `apps/mobile/app/(app)/store/index.tsx`

The current `CATEGORY_BASE` and `CATEGORIES` constants use old category names (`analytics`, `persona`) that don't appear in the v2 design. Replace with the design's category list. Also add `PLUGIN_COLORS` and `FEATURED_IDS` which are needed by the new components.

- [ ] **Step 1: Replace the CATEGORY_BASE / CATEGORIES block**

In `apps/mobile/app/(app)/store/index.tsx`, replace the entire block from the `const CATEGORY_BASE` line through `const CATEGORIES = Object.keys(CATEGORY_BASE);` (currently lines 32–40) with:

```ts
// v2 categories — matches design and PluginCategory type
const STORE_CATS = [
  { id: 'all',      label: 'Tous' },
  { id: 'training', label: 'Training' },
  { id: 'nutrition',label: 'Nutrition' },
  { id: 'health',   label: 'Santé' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'social',   label: 'Social' },
] as const;

// Plugin accent colors by id
const PLUGIN_COLORS: Record<string, string> = {
  habits:        '#FF5C1A',
  nutrition:     '#FF5C1A',
  persona:       '#FF6584',
  stats:         '#E8A33A',
  gamification:  '#FF5C1A',
  community:     '#2E7BF6',
  stretching:    '#FF5C1A',
  sleep:         '#7B5BD0',
  measurements:  '#2E9E5B',
  timer:         '#FF5C1A',
  'ai-programs': '#2E7BF6',
  journal:       '#FF5C1A',
  hydration:     '#2E7BF6',
  cardio:        '#E94B3C',
  supplements:   '#2E9E5B',
  wearables:     '#E91E63',
  rpe:           '#7B5BD0',
};

// Plugins shown in the "À la une" horizontal row
const FEATURED_IDS = new Set(['habits', 'ai-programs']);
```

- [ ] **Step 2: Remove the `getCategoryMeta` function**

Delete the `getCategoryMeta` function (lines 42–49 in the original file) — it was only used by the old `PluginCard`. The new components use `PLUGIN_COLORS` and `STORE_CATS` directly.

- [ ] **Step 3: Remove the `Dimensions` import**

`Dimensions` is no longer needed. Remove it from the RN import line at the top:
```ts
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Alert, TextInput,
} from 'react-native';
```

Also remove the `const { width: SCREEN_W } = Dimensions.get('window');` line.

- [ ] **Step 4: Add `showAlert` import**

Add `showAlert` to the `@ziko/plugin-sdk` import line (replace `Alert` from RN with `showAlert` from SDK):
```ts
import { usePluginRegistry, useTranslation, showAlert } from '@ziko/plugin-sdk';
```

Then remove `Alert` from the RN import since all confirm dialogs will use `showAlert`.

- [ ] **Step 5: Type-check (expect no errors from these constant changes)**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: errors only in functions that still reference old constants (`getCategoryMeta`, `CATEGORIES`) — those will be fixed when components are replaced in Tasks 2–4.

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/store/index.tsx && rtk git commit -m "refactor(store): update category constants, plugin colors, showAlert import"
```

---

### Task 2: Replace install/uninstall logic to use `showAlert`

**Files:**
- Modify: `apps/mobile/app/(app)/store/index.tsx`

The existing `installPlugin` and `uninstallPlugin` functions use `Alert` from RN. Replace with `showAlert` from `@ziko/plugin-sdk` (drop-in replacement with the same API).

- [ ] **Step 1: Replace `installPlugin` function**

Find the `installPlugin` function (starts at `const installPlugin = async`) and replace the `Alert.alert(` call inside it with `showAlert(`:

```ts
const installPlugin = async (pluginId: string, manifest: PluginManifest) => {
  if (!user) return;
  const perms = manifest.requiredPermissions ?? [];
  showAlert(
    t('store.installConfirm', { name: manifest.name }),
    perms.length > 0
      ? t('store.permRequired', { perms: perms.map((p) => `• ${p}`).join('\n') })
      : t('store.noPerm'),
    [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('store.install'), onPress: async () => {
          const { error } = await supabase
            .from('user_plugins')
            .upsert({ user_id: user.id, plugin_id: pluginId, is_enabled: true });
          if (!error) {
            setUserPlugins((prev) => [...prev, pluginId]);
            registerPlugin(manifest);
          }
        },
      },
    ],
  );
};
```

- [ ] **Step 2: Replace `uninstallPlugin` function**

```ts
const uninstallPlugin = async (pluginId: string) => {
  if (!user) return;
  showAlert(t('store.uninstall') + ' ?', t('store.uninstallConfirm'), [
    { text: t('general.cancel'), style: 'cancel' },
    {
      text: t('store.uninstall'), style: 'destructive', onPress: async () => {
        await supabase
          .from('user_plugins')
          .delete()
          .eq('user_id', user.id)
          .eq('plugin_id', pluginId);
        setUserPlugins((prev) => prev.filter((id) => id !== pluginId));
      },
    },
  ]);
};
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/store/index.tsx && rtk git commit -m "refactor(store): replace Alert with showAlert from plugin-sdk"
```

---

### Task 3: Add `FeaturedRow` component

**Files:**
- Modify: `apps/mobile/app/(app)/store/index.tsx`

The `FeaturedRow` is a horizontal `ScrollView` of dark cards (background = `theme.cardDark`). Each card shows the plugin icon, name, rating, description, and a toggle button. Only plugins whose id is in `FEATURED_IDS` appear here. The row is shown only when category is `'all'` and search is empty (same logic as the design source).

- [ ] **Step 1: Delete `SectionTitle` and `Stars` helper components**

Remove the `SectionTitle` function (lines 252–260 in the original) and the `Stars` function (lines 262–276). They will be replaced inline in the new components.

- [ ] **Step 2: Add `FeaturedRow` component**

Add after the `Stars` deletion, before `PluginCard`:

```tsx
function FeaturedRow({
  plugins,
  installed,
  onInstall,
  onUninstall,
}: {
  plugins: RegistryPlugin[];
  installed: string[];
  onInstall: (p: RegistryPlugin) => void;
  onUninstall: (p: RegistryPlugin) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const featured = plugins.filter((p) => FEATURED_IDS.has(p.plugin_id));
  if (featured.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{
        fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
        color: theme.muted, marginBottom: 10,
      }}>
        À la une
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {featured.map((p) => {
          const m = p.manifest;
          const color = PLUGIN_COLORS[p.plugin_id] ?? theme.primary;
          const isInstalled = installed.includes(p.plugin_id);
          return (
            <View key={p.plugin_id} style={{
              width: 230, backgroundColor: theme.cardDark, borderRadius: 20,
              padding: 14, gap: 10,
            }}>
              {/* Icon + name row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 11,
                  backgroundColor: color + '30', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={(m.icon || 'grid') as any} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: theme.cardDarkText }}>{m.name}</Text>
                  <Text style={{ fontSize: 10.5, color: 'rgba(255,250,246,.55)' }}>
                    {m.price === 'free' ? 'Gratuit' : `${m.price} €`}
                  </Text>
                </View>
              </View>
              {/* Description */}
              <Text numberOfLines={2} style={{
                fontSize: 11.5, color: 'rgba(255,250,246,.7)', lineHeight: 16,
              }}>
                {m.description}
              </Text>
              {/* Toggle button */}
              <TouchableOpacity
                onPress={() => isInstalled ? onUninstall(p) : onInstall(p)}
                activeOpacity={0.8}
                style={{
                  alignSelf: 'flex-start', borderRadius: 999,
                  paddingHorizontal: 14, paddingVertical: 8,
                  backgroundColor: isInstalled
                    ? 'rgba(255,250,246,.12)'
                    : theme.primary,
                }}
              >
                <Text style={{
                  fontSize: 11.5, fontWeight: '700',
                  color: isInstalled ? theme.cardDarkText : '#fff',
                }}>
                  {isInstalled ? '✓ Installé' : 'Installer'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: `PluginCard` still has reference errors from old constants — that's fine, fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/store/index.tsx && rtk git commit -m "feat(store): add FeaturedRow horizontal dark cards"
```

---

### Task 4: Replace `PluginCard` with compact `PluginRow`

**Files:**
- Modify: `apps/mobile/app/(app)/store/index.tsx`

The v2 design uses compact rows (not tall cards). Each row: 44×44 icon, name + PRO badge, one-line description, rating + price inline, toggle button on the right.

- [ ] **Step 1: Delete the old `PluginCard` component entirely**

Remove from `const PluginCard = React.memo(function PluginCard({` to its closing `});` — the entire component.

- [ ] **Step 2: Add `PluginRow` component**

```tsx
const PluginRow = React.memo(function PluginRow({
  plugin,
  isInstalled,
  rating,
  onInstall,
  onUninstall,
}: {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  rating?: ReviewAgg;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const m = plugin.manifest;
  const color = PLUGIN_COLORS[plugin.plugin_id] ?? theme.primary;
  const isPremium = m.price !== 'free';

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16, padding: 12,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 1, borderColor: theme.border, marginBottom: 8,
    }}>
      {/* Icon */}
      <View style={{
        width: 44, height: 44, borderRadius: 12, flex: 0,
        backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={(m.icon || 'grid') as any} size={20} color={color} />
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Name + PRO badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{m.name}</Text>
          {isPremium && (
            <View style={{
              backgroundColor: theme.warn + '22', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
            }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: theme.warn }}>PRO</Text>
            </View>
          )}
        </View>
        {/* Description */}
        <Text numberOfLines={1} style={{ fontSize: 11, color: theme.muted, marginTop: 2, lineHeight: 15 }}>
          {m.description}
        </Text>
        {/* Rating + price */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {rating && (
            <Text style={{ fontSize: 10.5, color: theme.muted }}>
              ⭐ {rating.avg.toFixed(1)} ·{' '}
            </Text>
          )}
          <Text style={{
            fontSize: 10.5, fontWeight: '700',
            color: m.price === 'free' ? theme.success : theme.primary,
          }}>
            {m.price === 'free' ? 'Gratuit' : `${m.price} €/mo`}
          </Text>
        </View>
      </View>

      {/* Toggle button */}
      <TouchableOpacity
        onPress={isInstalled ? onUninstall : onInstall}
        activeOpacity={0.75}
        style={{
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          backgroundColor: isInstalled
            ? theme.success + '18'
            : theme.primary,
        }}
      >
        <Text style={{
          fontSize: 11, fontWeight: '700',
          color: isInstalled ? theme.success : '#fff',
          whiteSpace: undefined,
        }}>
          {isInstalled ? '✓' : 'Installer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: errors in the main screen that still references old `category` state and `PluginCard` — fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/store/index.tsx && rtk git commit -m "feat(store): add compact PluginRow with PRO badge + toggle button"
```

---

### Task 5: Rewrite `PluginStoreScreen` layout

**Files:**
- Modify: `apps/mobile/app/(app)/store/index.tsx`

Wire everything together: new header "Boutique.", category pills from `STORE_CATS`, `FeaturedRow` (only when cat=all and no search), list of `PluginRow` (no Installed/Available split — show all filtered, installed ones have green ✓).

- [ ] **Step 1: Update `category` state type**

The `useState` for `category` was typed as `string`. Change to:

```ts
const [category, setCategory] = useState<typeof STORE_CATS[number]['id']>('all');
```

- [ ] **Step 2: Update `filtered` useMemo to use `STORE_CATS`**

Replace the existing `filtered` useMemo. The new design doesn't split into Installed/Available sections in the same way — `FeaturedRow` handles featured, and the list shows all results. Map `analytics`/`persona` to `coaching` for backward-compat:

```ts
const filtered = useMemo(() => {
  let list = plugins;
  if (category !== 'all') {
    list = list.filter((p) => {
      const cat = p.manifest.category;
      // Map legacy categories to new ones
      const mapped = cat === 'analytics' || cat === 'persona' ? 'coaching' : cat;
      return mapped === category;
    });
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter((p) =>
      p.manifest.name.toLowerCase().includes(q) ||
      p.manifest.description?.toLowerCase().includes(q)
    );
  }
  return list;
}, [plugins, category, search]);
```

- [ ] **Step 3: Remove unused derived variables**

Remove these lines (no longer needed — no separate sections):
```ts
const installed = filtered.filter((p) => userPlugins.includes(p.plugin_id));
const available = filtered.filter((p) => !userPlugins.includes(p.plugin_id));
```

- [ ] **Step 4: Replace the entire `return (...)` block of `PluginStoreScreen`**

```tsx
return (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* ── Header ───────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.muted }}>Étend ton Ziko</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text, lineHeight: 30, marginTop: 2 }}>
            Boutique<Text style={{ color: theme.primary }}>.</Text>
          </Text>
        </View>
      </View>

      {/* ── Search ───────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
        borderRadius: 14, borderWidth: 1, borderColor: theme.border,
        paddingHorizontal: 14, height: 44, marginBottom: 14,
      }}>
        <Ionicons name="search" size={16} color={theme.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un module…"
          placeholderTextColor={theme.muted}
          style={{ flex: 1, marginLeft: 10, fontSize: 13, color: theme.text }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category pills ───────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {STORE_CATS.map((cat) => {
          const active = cat.id === category;
          return (
            <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                backgroundColor: active ? theme.text : theme.text + '10',
              }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : theme.text }}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Featured (only cat=all, no search) ── */}
      {category === 'all' && search === '' && (
        <FeaturedRow
          plugins={plugins}
          installed={userPlugins}
          onInstall={(p) => installPlugin(p.plugin_id, p.manifest)}
          onUninstall={(p) => uninstallPlugin(p.plugin_id)}
        />
      )}

      {/* ── Plugin list ───────────────────── */}
      <Text style={{
        fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
        color: theme.muted, marginBottom: 10,
      }}>
        {category === 'all'
          ? 'Tous les modules'
          : STORE_CATS.find((c) => c.id === category)?.label ?? ''}
      </Text>

      {filtered.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 48 }}>
          <Ionicons name="search-outline" size={40} color={theme.border} />
          <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucun module trouvé</Text>
        </View>
      ) : (
        filtered.map((p) => (
          <PluginRow
            key={p.plugin_id}
            plugin={p}
            isInstalled={userPlugins.includes(p.plugin_id)}
            rating={getRating(p.plugin_id)}
            onInstall={() => installPlugin(p.plugin_id, p.manifest)}
            onUninstall={() => uninstallPlugin(p.plugin_id)}
          />
        ))
      )}
    </ScrollView>
  </SafeAreaView>
);
```

- [ ] **Step 5: Final type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Common fixes:
- If `STORE_CATS[number]['id']` causes inference issues, type `category` as `string` instead
- If `whiteSpace: undefined` on `PluginRow` causes TS error, remove that line entirely (it was a no-op)
- If `ScrollView` inside `ScrollView` raises a warning (nested scroll), wrap the category pills in a plain `View` and set `horizontal` — this is expected RN behavior, not an error

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/store/index.tsx && rtk git commit -m "feat(store): v2 layout — Boutique header, FilterPills, FeaturedRow, PluginRow list"
```

---

## Self-Review

**Spec §5 — Filter tabs:** `Tous | Training | Nutrition | Santé | Coaching | Social` → Task 5 `STORE_CATS` ✅  
**Spec §5 — Toggle Installés/Disponibles:** replaced by inline ✓ button per row (no separate section headers) — matches design source which has no toggle, just a checkmark ✅  
**Spec §5 — Cards with icon, name, catégorie, rating ★, nb users, description, prix, badge Premium:**  
- icon ✅ · name ✅ · category → skipped (not in design list row, only PRO badge) · rating ✅ · nb users → skipped (not in DB, design uses static) · description ✅ · prix ✅ · badge Premium ("PRO") ✅  
**Spec §5 — Featured plugins en haut (2 en highlight):** `FeaturedRow` → Task 3 ✅  
**Spec §5 — Bouton Install/Désinstaller inline:** toggle button in `PluginRow` + `FeaturedRow` → Tasks 3 & 4 ✅  
**showAlert:** Tasks 2, no RN `Alert` remaining ✅  
**Data loading preserved:** `load()`, `installPlugin`, `uninstallPlugin`, `getRating`, `reviews` state — all kept intact ✅  
**Type consistency:** `PLUGIN_COLORS` (Task 1) used in `FeaturedRow` (Task 3) and `PluginRow` (Task 4) ✅ · `STORE_CATS` (Task 1) used in filter pills and section title (Task 5) ✅ · `FEATURED_IDS` (Task 1) used in `FeaturedRow` (Task 3) ✅

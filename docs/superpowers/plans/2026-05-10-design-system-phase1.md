# Design System Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the theme system with semantic color tokens, custom fonts, and card styles; update shared UI components to use theme tokens; add a DB migration to auto-unlock the default theme.

**Architecture:** `ThemePalette` in `packages/plugin-sdk/src/theme.ts` gains 9 new fields (`success`, `info`, `violet`, `warn`, `cardDark`, `cardDarkText`, `cardStyle`, `fontDisplay`, `fontBody`). All 7 themes in `THEME_REGISTRY` are updated with coherent values. `packages/ui/src/components.tsx` imports `useThemeStore` from `@ziko/plugin-sdk` and drops all hardcoded color constants. Fonts are loaded in `apps/mobile/app/_layout.tsx` with `useFonts`. A Supabase migration auto-inserts the free default theme into existing and future user inventories.

**Tech Stack:** TypeScript, Zustand, `@expo-google-fonts/manrope`, `@expo-google-fonts/geist` (fallback: `@expo-google-fonts/inter`), Supabase SQL

---

## File Map

| File | Action |
|------|--------|
| `packages/plugin-sdk/src/theme.ts` | Extend `ThemePalette` + update all 7 themes |
| `apps/mobile/app/_layout.tsx` | Add `useFonts` call |
| `apps/mobile/package.json` | Font packages added by `expo install` |
| `packages/ui/package.json` | Add `@ziko/plugin-sdk` peer dep |
| `packages/ui/src/components.tsx` | Full rewrite — theme-aware, no hardcoded colors |
| `supabase/migrations/022_default_theme_unlock.sql` | New migration |

---

### Task 1: Extend ThemePalette interface and update DEFAULT_THEME

**Files:**
- Modify: `packages/plugin-sdk/src/theme.ts`

- [ ] **Step 1: Replace ThemePalette interface**

In `packages/plugin-sdk/src/theme.ts`, replace the `ThemePalette` interface (lines 4–20) with:

```ts
export interface ThemePalette {
  id: string;
  name: string;
  background: string;
  surface: string;
  border: string;
  primary: string;
  primaryLight: string;
  text: string;
  muted: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBarStyle: 'dark' | 'light';
  statusBarBg: string;
  // Semantic tokens
  success: string;
  info: string;
  violet: string;
  warn: string;
  // Dark surface
  cardDark: string;
  cardDarkText: string;
  // Card style
  cardStyle: 'flat' | 'shadow' | 'outlined';
  // Typography
  fontDisplay: string;
  fontBody: string;
}
```

- [ ] **Step 2: Replace DEFAULT_THEME**

Replace the `DEFAULT_THEME` constant (lines 23–39) with:

```ts
export const DEFAULT_THEME: ThemePalette = {
  id: 'default',
  name: 'Sport Orange',
  background: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E2E0DA',
  primary: '#FF5C1A',
  primaryLight: '#FF5C1A15',
  text: '#1C1A17',
  muted: '#6B6963',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E0DA',
  tabBarActive: '#FF5C1A',
  tabBarInactive: '#7A7670',
  statusBarStyle: 'dark',
  statusBarBg: '#F7F6F3',
  success: '#2E9E5B',
  info: '#2E7BF6',
  violet: '#7B5BD0',
  warn: '#E8A33A',
  cardDark: '#1C1A17',
  cardDarkText: '#FFFAF6',
  cardStyle: 'shadow',
  fontDisplay: 'Manrope_800ExtraBold',
  fontBody: 'Geist_400Regular',
};
```

- [ ] **Step 3: Type-check — expect errors on THEME_REGISTRY (fix in Task 2)**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | head -30
```

Expected: TS errors saying themes in `THEME_REGISTRY` are missing the new fields. That's correct — we fix them in Task 2.

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add packages/plugin-sdk/src/theme.ts && rtk git commit -m "feat(theme): extend ThemePalette with semantic tokens, cardStyle, font fields"
```

---

### Task 2: Update all 6 remaining themes in THEME_REGISTRY

**Files:**
- Modify: `packages/plugin-sdk/src/theme.ts`

- [ ] **Step 1: Replace THEME_REGISTRY with all 7 complete themes**

Replace the entire `THEME_REGISTRY` constant (lines 42–86) with:

```ts
export const THEME_REGISTRY: Record<string, ThemePalette> = {
  default: DEFAULT_THEME,
  'Bleu Océan': {
    id: 'Bleu Océan', name: 'Bleu Océan',
    background: '#EFF6FF', surface: '#FFFFFF', border: '#BFDBFE',
    primary: '#2563EB', primaryLight: '#2563EB15', text: '#1E293B', muted: '#64748B',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BFDBFE', tabBarActive: '#2563EB', tabBarInactive: '#94A3B8',
    statusBarStyle: 'dark', statusBarBg: '#EFF6FF',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#0F172A', cardDarkText: '#F0F9FF',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Violet Royal': {
    id: 'Violet Royal', name: 'Violet Royal',
    background: '#F5F3FF', surface: '#FFFFFF', border: '#C4B5FD',
    primary: '#7C3AED', primaryLight: '#7C3AED15', text: '#1E1B4B', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#C4B5FD', tabBarActive: '#7C3AED', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F5F3FF',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#1E1B4B', cardDarkText: '#FAF5FF',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Vert Forêt': {
    id: 'Vert Forêt', name: 'Vert Forêt',
    background: '#F0FDF4', surface: '#FFFFFF', border: '#BBF7D0',
    primary: '#16A34A', primaryLight: '#16A34A15', text: '#14532D', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BBF7D0', tabBarActive: '#16A34A', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F0FDF4',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#14532D', cardDarkText: '#F0FDF4',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Rouge Feu': {
    id: 'Rouge Feu', name: 'Rouge Feu',
    background: '#FEF2F2', surface: '#FFFFFF', border: '#FECACA',
    primary: '#DC2626', primaryLight: '#DC262615', text: '#450A0A', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FECACA', tabBarActive: '#DC2626', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#FEF2F2',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#450A0A', cardDarkText: '#FFF1F2',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Or Prestige': {
    id: 'Or Prestige', name: 'Or Prestige',
    background: '#FFFBEB', surface: '#FFFFFF', border: '#FDE68A',
    primary: '#D97706', primaryLight: '#D9770615', text: '#451A03', muted: '#78716C',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FDE68A', tabBarActive: '#D97706', tabBarInactive: '#A8A29E',
    statusBarStyle: 'dark', statusBarBg: '#FFFBEB',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#451A03', cardDarkText: '#FFFBEB',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Noir Carbone': {
    id: 'Noir Carbone', name: 'Noir Carbone',
    background: '#0F0F0F', surface: '#1A1A1A', border: '#333333',
    primary: '#FF5C1A', primaryLight: '#FF5C1A20', text: '#F5F5F5', muted: '#A3A3A3',
    tabBarBg: '#1A1A1A', tabBarBorder: '#333333', tabBarActive: '#FF5C1A', tabBarInactive: '#737373',
    statusBarStyle: 'light', statusBarBg: '#0F0F0F',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A',
    cardDark: '#0A0A0A', cardDarkText: '#F5F5F5',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
};
```

- [ ] **Step 2: Type-check — must pass clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors. If there are errors in other packages consuming `ThemePalette`, they're likely passing a theme object somewhere — they'll be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
cd /c/ziko-platform && rtk git add packages/plugin-sdk/src/theme.ts && rtk git commit -m "feat(theme): update all 7 themes with semantic tokens and cardStyle"
```

---

### Task 3: Install fonts and wire into app layout

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Auto-modified: `apps/mobile/package.json` (by expo install)

- [ ] **Step 1: Install font packages**

```bash
cd /c/ziko-platform/apps/mobile && npx expo install @expo-google-fonts/manrope @expo-google-fonts/geist
```

If `@expo-google-fonts/geist` returns "package not found", use Inter instead:

```bash
cd /c/ziko-platform/apps/mobile && npx expo install @expo-google-fonts/manrope @expo-google-fonts/inter
```

In that case, substitute `Geist_400Regular` → `Inter_400Regular` and `Geist_500Medium` → `Inter_500Medium` in the steps below, AND update `fontBody: 'Geist_400Regular'` → `fontBody: 'Inter_400Regular'` in `packages/plugin-sdk/src/theme.ts` for all themes.

- [ ] **Step 2: Add font imports to `apps/mobile/app/_layout.tsx`**

Add these two import blocks after the existing imports (after line 18, before `initSentry()`):

```ts
import {
  useFonts,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';
```

- [ ] **Step 3: Add useFonts call inside RootLayout**

Inside `RootLayout`, add after the existing `useThemeStore` hooks (after line 46):

```ts
const [fontsLoaded] = useFonts({
  Manrope_700Bold,
  Manrope_800ExtraBold,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
});
```

- [ ] **Step 4: Guard render until fonts are loaded**

Replace the early-return guard (line 82):

```ts
if (!isInitialized) return null;
```

with:

```ts
if (!isInitialized || !fontsLoaded) return null;
```

- [ ] **Step 5: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/_layout.tsx apps/mobile/package.json && rtk git commit -m "feat(fonts): load Manrope + Geist via expo-google-fonts in app layout"
```

---

### Task 4: Rewrite packages/ui components to use theme tokens

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/src/components.tsx`

- [ ] **Step 1: Add @ziko/plugin-sdk peer dependency**

Replace `packages/ui/package.json` entirely with:

```json
{
  "name": "@ziko/ui",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-native": ">=0.75.0",
    "@ziko/plugin-sdk": "*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Rewrite packages/ui/src/components.tsx**

Replace the entire file with:

```tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInput,
  TextInputProps,
  StyleProp,
} from 'react-native';
import { MotiView } from 'moti';
import { useThemeStore, ThemePalette } from '@ziko/plugin-sdk';

// ── Static tokens (no theme dependency) ─────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
} as const;

// ── Internal helper ──────────────────────────────────────────
function resolveCardStyle(theme: ThemePalette, override?: ThemePalette['cardStyle']): ViewStyle {
  const style = override ?? theme.cardStyle;
  switch (style) {
    case 'flat':
      return { borderWidth: 1, borderColor: theme.border };
    case 'outlined':
      return { borderWidth: 1.5, borderColor: theme.text };
    case 'shadow':
    default:
      return {
        borderWidth: 0,
        shadowColor: theme.cardDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      };
  }
}

// ── Button ───────────────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  leftIcon,
}: ButtonProps) {
  const theme = useThemeStore((s) => s.theme);

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 15, paddingHorizontal: 24 },
    lg: { paddingVertical: 18, paddingHorizontal: 32 },
  };
  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: theme.primary },
    dark: { backgroundColor: theme.cardDark },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.primary },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF4444' },
  };
  const textVariant: Record<string, TextStyle> = {
    primary: { color: '#FFFFFF' },
    dark: { color: theme.cardDarkText },
    outline: { color: theme.primary },
    ghost: { color: theme.muted },
    danger: { color: '#EF4444' },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        {
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        sizeStyles[size],
        variantStyles[variant],
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'dark' ? theme.cardDarkText : '#FFFFFF'}
        />
      ) : (
        <>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text style={[typography.button, textVariant[variant], textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Card ─────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  animate?: boolean;
  delay?: number;
  cardStyle?: 'flat' | 'shadow' | 'outlined';
}

export function Card({
  children,
  style,
  padding = 'md',
  animate = false,
  delay = 0,
  cardStyle,
}: CardProps) {
  const theme = useThemeStore((s) => s.theme);
  const baseStyle: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    padding: spacing[padding],
    ...resolveCardStyle(theme, cardStyle),
  };

  if (animate) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 350, delay }}
        style={[baseStyle, style]}
      >
        {children}
      </MotiView>
    );
  }
  return <View style={[baseStyle, style]}>{children}</View>;
}

// ── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
}

export function Badge({ label, color, textColor }: BadgeProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  const tc = textColor ?? c;
  return (
    <View style={{
      backgroundColor: c + '22',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.full,
      alignSelf: 'flex-start',
    }}>
      <Text style={[typography.caption, { color: tc, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

// ── Tag ──────────────────────────────────────────────────────
export function Tag({ label, color }: { label: string; color?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.warn;
  return (
    <View style={{
      backgroundColor: c + '18',
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && (
        <Text style={[typography.bodySmall, { color: theme.muted, marginBottom: 6 }]}>
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        style={[
          {
            backgroundColor: theme.background,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? '#EF4444' : theme.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 14,
            color: theme.text,
            fontSize: 15,
          },
          style,
        ]}
        placeholderTextColor={theme.muted}
      />
      {error && (
        <Text style={[typography.caption, { color: '#EF4444', marginTop: 4 }]}>{error}</Text>
      )}
    </View>
  );
}

// ── ScreenHeader ─────────────────────────────────────────────
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.h2, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[typography.bodySmall, { color: theme.muted, marginTop: 2 }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View>{right}</View>}
    </View>
  );
}

// ── StatCard ─────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  style?: ViewStyle;
  animate?: boolean;
  delay?: number;
}

export function StatCard({ label, value, unit, color, style, animate, delay }: StatCardProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  return (
    <Card style={[{ alignItems: 'center', flex: 1 }, style]} animate={animate} delay={delay}>
      <Text style={[typography.h2, { color: c }]}>{value}</Text>
      {unit && <Text style={[typography.caption, { color: theme.muted }]}>{unit}</Text>}
      <Text style={[typography.caption, { color: theme.muted, marginTop: 4 }]}>{label}</Text>
    </Card>
  );
}

// ── ProgressBar ──────────────────────────────────────────────
interface ProgressBarProps {
  progress: number; // 0–1
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ progress, color, height = 6, style }: ProgressBarProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  const pct = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[{
      height,
      backgroundColor: theme.border,
      borderRadius: height / 2,
      overflow: 'hidden',
    }, style]}>
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${pct * 100}%` as any }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ height: '100%', backgroundColor: c, borderRadius: height / 2 }}
      />
    </View>
  );
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={[{
      height: 1,
      backgroundColor: theme.border,
      marginVertical: spacing.md,
    }, style]} />
  );
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({
  width,
  height = 16,
  borderRadius = radius.sm,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.7 }}
      transition={{ type: 'timing', duration: 800, loop: true }}
      style={[{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: theme.border,
      }, style]}
    />
  );
}
```

- [ ] **Step 3: Check for existing callers using variant="accent" on Button**

```bash
grep -r 'variant="accent"' /c/ziko-platform/apps /c/ziko-platform/plugins --include="*.tsx" -l
```

For each file returned, open it and replace `variant="accent"` with `variant="primary"`. The `accent` variant was removed (its purpose is now `dark` or `primary`).

- [ ] **Step 4: Type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Expected: 0 errors. Common fix — if any file imports `colors` from `@ziko/ui`, replace that usage with `useThemeStore((s) => s.theme)` and use the relevant `theme.*` field.

- [ ] **Step 5: Commit**

```bash
cd /c/ziko-platform && rtk git add packages/ui/src/components.tsx packages/ui/package.json && rtk git commit -m "feat(ui): theme-aware components — remove hardcoded colors, add cardStyle + dark Button variant"
```

---

### Task 5: DB migration — default theme auto-unlock

**Files:**
- Create: `supabase/migrations/022_default_theme_unlock.sql`

- [ ] **Step 1: Check user_inventory unique constraint**

```bash
grep -n "UNIQUE\|PRIMARY KEY\|user_id.*item_id\|item_id.*user_id" /c/ziko-platform/supabase/migrations/007_gamification_schema.sql
```

Note whether `(user_id, item_id)` has a unique constraint. The migration below uses `ON CONFLICT DO NOTHING` — if there is no UNIQUE constraint on that pair, the `ON CONFLICT` clause will do nothing but is harmless.

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/022_default_theme_unlock.sql`:

```sql
-- ============================================================
-- 022 — Default theme auto-unlock
-- Ensures all users own 'Sport Orange' (default) theme so
-- the shop UI shows it as unlocked from the start.
-- ============================================================

-- 1. Insert 'Sport Orange' as a free shop item (idempotent)
INSERT INTO public.shop_items (name, description, category, price, icon, level_required)
VALUES ('Sport Orange', 'Thème par défaut', 'theme', 0, '🟠', 1)
ON CONFLICT DO NOTHING;

-- 2. Auto-unlock for all existing users who don't already have it
INSERT INTO public.user_inventory (user_id, item_id)
SELECT up.id, si.id
FROM public.user_profiles up
CROSS JOIN public.shop_items si
WHERE si.name = 'Sport Orange'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_inventory ui
    WHERE ui.user_id = up.id AND ui.item_id = si.id
  );

-- 3. Function: auto-unlock default theme on new user creation
CREATE OR REPLACE FUNCTION public.unlock_default_theme()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item_id UUID;
BEGIN
  SELECT id INTO v_item_id
  FROM public.shop_items
  WHERE name = 'Sport Orange'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO public.user_inventory (user_id, item_id)
    VALUES (NEW.id, v_item_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Trigger: fires after a user_profiles row is inserted
DROP TRIGGER IF EXISTS trg_unlock_default_theme ON public.user_profiles;
CREATE TRIGGER trg_unlock_default_theme
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.unlock_default_theme();
```

- [ ] **Step 3: Apply migration**

```bash
cd /c/ziko-platform && npx supabase db push
```

Expected output: `Applying migration 022_default_theme_unlock.sql` (or "Remote database is up to date" if already applied).

If the push fails because `shop_items` doesn't support `ON CONFLICT DO NOTHING` without a constraint, add an explicit conflict target:

```sql
ON CONFLICT (name) DO NOTHING
```

(only if the `name` column has a UNIQUE constraint — check migration 007).

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add supabase/migrations/022_default_theme_unlock.sql && rtk git commit -m "feat(db): auto-unlock default theme for all users on signup and retroactively"
```

---

## Self-Review

**Spec §1.1 ThemePalette tokens** → Tasks 1 & 2: `success`, `info`, `violet`, `warn`, `cardDark`, `cardDarkText` added and all 7 themes updated ✅

**Spec §1.2 Typographie** → Task 3: Manrope + Geist installed and loaded; `fontDisplay`/`fontBody` added to `ThemePalette` ✅

**Spec §1.3 cardStyle** → Task 1: `cardStyle` field in interface; Task 4: `resolveCardStyle()` in components ✅

**Spec §1.4 Composants UI** → Task 4: Card, Button, Badge, Tag, ProgressBar, Input, ScreenHeader, StatCard, Skeleton, Divider all use `useThemeStore` — no hardcoded colors remain ✅

**Spec §1.5 DB default theme** → Task 5: `shop_items` insert + retroactive `user_inventory` fill + new-user trigger ✅

**Type consistency:**
- `ThemePalette.cardStyle` defined Task 1, consumed by `resolveCardStyle` in Task 4 ✅
- `theme.cardDark` / `theme.cardDarkText` defined Task 1, used in `Button` `dark` variant Task 4 ✅
- Font key `'Manrope_800ExtraBold'` matches the `useFonts` map key in Task 3 ✅
- Button `variant="accent"` removed in Task 4; Task 4 Step 3 sweeps all callers ✅

---
phase: 36
slug: workout-stack-redesign
status: approved
created: 2026-05-25
---

# UI-SPEC — Phase 36: Workout Stack Redesign

> **Source of truth:** This document drives all implementation decisions for Phase 36.
> All pixel values, colors, and copy are final. Executor must match these specs exactly.
> Canonical visual reference: mockup files in `C:/Users/Anatholy/Downloads/ziko/`.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Screen 1 — Séance Tab (index.tsx)](#2-screen-1--séance-tab-indextsx)
3. [Screen 2 — AIGenerator (ai-generate.tsx)](#3-screen-2--aigenerator-ai-generatetsx)
4. [Screen 3 — ExerciseDetail](#4-screen-3--exercisedetail)
5. [Screen 4 — ExercisePicker (Modal)](#5-screen-4--exercisepicker-modal)
6. [Screen 5 — HistoryDetail](#6-screen-5--historydetail)
7. [Screen 6 — WorkoutSummary (summary.tsx)](#7-screen-6--workoutsummary-summarytsx)
8. [Screen 7 — RestTimer (Component)](#8-screen-7--resttimer-component)
9. [Screen 8 — WSHeader Component](#9-screen-8--wsheader-component)
10. [Screen 9 — history.tsx List View](#10-screen-9--historytsx-list-view)
11. [Motion Design](#11-motion-design)
12. [Data Contracts](#12-data-contracts)
13. [Integration Points](#13-integration-points)
14. [Copywriting Contract](#14-copywriting-contract)

---

## 1. Design System

### 1.1 Color Tokens

All colors reference `theme` from `useThemeStore((s) => s.theme)`. Do NOT hardcode hex values except for surface-specific dark overrides where noted.

**Distribution: 60% neutral (bg/surface), 30% text hierarchy (text/muted/border), 10% accent (#FF5C1A).**

| Token | Hex | Usage |
|-------|-----|-------|
| `theme.primary` | `#FF5C1A` | CTAs, active states, accent, progress fills, PR badges |
| `theme.background` | `#F7F6F3` | Screen background (light context) |
| `theme.surface` | `#FFFFFF` | Cards, modals, input fields |
| `theme.border` | `#E2E0DA` | Card borders, input borders, dividers |
| `theme.text` | `#1C1A17` | Primary text; also used as dark card background |
| `theme.muted` | `#6B6963` | Secondary text, subtitles, labels, placeholders |
| `#FFFAF6` | static | Text on dark cards (light cream, matches mockup) |
| `#2A211B` | static | Dark hero gradient end stop |
| `#FFB07A` | static | Light orange — gradient end stop on progress bars and loading pulse |

**Dark workout context** (ProgramDetail hero, WorkoutSummary hero, RestTimer):
- Background gradient: `linear-gradient(135deg, #1C1A17 0%, #2A211B 100%)`
- Text: `#FFFAF6`
- Subtext opacity: `rgba(255,250,246,0.55)`
- Muted label opacity: `rgba(255,250,246,0.45)`
- Glassmorphism border on dark: `rgba(255,250,246,0.06)`

**Orange glow orb** (ProgramDetail hero, WorkoutSummary hero):
- Position: `{ position: 'absolute', top: -50, right: -50 }`
- Size: `200 × 200` points, `borderRadius: 100`
- Color: `rgba(255,92,26,0.35)` — blurred using `blurRadius={50}` on a `View` with low opacity, or a static image on iOS. On Android: use a semi-transparent View with large `borderRadius` only (no blur).

**Selected state tint** (option cards, picker rows):
- Background: `rgba(255,92,26,0.06)` (6% primary over white surface)
- Border: `1.5px solid #FF5C1A`

**Accent muted background** (cue numbers, progress dots, step counters):
- `rgba(255,92,26,0.12)` — 12% primary tint on white surface

**Success green**: `theme.success` (existing token, used for done states and trend arrows)

### 1.2 Typography

System font stack — no custom font family. Use React Native's default system font (`fontFamily` omitted or `undefined`).

**4-size declared scale:**

| Role | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| Hero stat | 34 | 700 | 1.0 | 0 | Current week number in ProgramDetail hero |
| Screen title / UI controls | 16 | 700 | 1.1 | 0 | WSHeader title, step headings, section display, HR avg stat |
| Body / label | 12 | 700 or 400 | 1.45 | 0 | Card titles (700), exercise names (700), descriptions (400), cue text (400), note content (400), set chips (400) |
| Caption / badge | 10 | 700 or 700 | 1.3 | 0.6 | Section headers (uppercase, 700), unit labels, metadata, tab labels, filter chips, status badges (uppercase) |

**Weight distinguishes roles within the same size:**
- `12/700`: card titles, exercise names, day session labels, button text
- `12/400`: body descriptions, cue text, note content, secondary copy
- `10/700`: status badges (ACTIF, EN COURS), uppercase section headers, metadata, unit labels, muted labels

**Display exception:** `64pt — AIGenerator energy number only.` This is a single one-off readout on the energy slider screen, not part of the type scale. Style: `{ fontSize: 64, fontWeight: '700', color: '#FF5C1A' }`.

**RestTimer countdown exception:** `76pt — RestTimer countdown digits only.` Full-screen overlay context, not part of the type scale. Style: `{ fontSize: 76, fontWeight: '700', color: '#FFFAF6', fontVariant: ['tabular-nums'] }`.

Uppercase labels always have `letterSpacing: 0.6` (React Native unit).

### 1.3 Spacing

All spacing follows an 8-point base with 4-point subdivisions. All values are multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | 4 | Gap between badge elements |
| `spacing.sm` | 8 | Card grid gap, chip gap, inline gap |
| `spacing.md` | 8 | Section gap, grid gap |
| `spacing.lg` | 12 | Card internal padding (compact), stat tile padding |
| `spacing.xl` | 16 | Screen horizontal padding, card internal padding |
| `spacing.2xl` | 24 | Section vertical spacing, section between major blocks |
| `spacing.3xl` | 24 | RestTimer controls padding |
| `spacing.4xl` | 32 | Hero internal padding |

*Exception: 12 is permitted as a compact 4-point subdivision for card internal padding and tight element spacing within cards. All usage of 12 appears inside card boundaries — not as screen-level layout spacing.*

**Screen horizontal padding:** `16` on all screens.
**Tab bar clearance:** `paddingBottom: 100` on all ScrollViews.

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius.xs` | 6 | Cue number circles in ExerciseDetail |
| `radius.sm` | 8 | Set chips in HistoryDetail/Summary |
| `radius.md` | 10 | Day squares in ProgramDetail schedule, WSHeader back button |
| `radius.lg` | 12 | Input fields, tab container, filter chips |
| `radius.xl` | 14 | CTA buttons throughout |
| `radius.2xl` | 16 | RestTimer controls |
| `radius.card` | 14 | All card containers (note: existing code uses 16–18, reduce to 14 to match mockup) |
| `radius.hero` | 14 | ProgramDetail hero, WorkoutSummary hero |
| `radius.circle` | 999 | Pills, progress bar, energy circle, SVG ring |

### 1.5 Shadows

All cards use the DS-01 shadow contract:

```
shadowColor: theme.text  (#1C1A17)
shadowOffset: { width: 0, height: 2 }
shadowOpacity: 0.08
shadowRadius: 12
elevation: 3
```

PR trophy icon shadow (special — orange glow):
```
shadowColor: '#FF5C1A'
shadowOffset: { width: 0, height: 4 }
shadowOpacity: 0.5
shadowRadius: 14
elevation: 6
```

### 1.6 Animation Library

**MotiView** from `moti` package — already installed. Use for all entrance animations and the AIGenerator loading pulse.

**React Native's built-in `Animated`** or direct `setInterval` for RestTimer countdown (already in mockup pattern).

Do NOT install GSAP, Lottie, or any new animation dep.

**Motion personality:** Snappy + purposeful. Entrances: 200–300ms. Loading pulse: 1.4s ease-in-out infinite. RestTimer ring: 1s linear CSS-like transition (via RN Animated or SVG strokeDashoffset interpolation).

---

## 2. Screen 1 — Séance Tab (index.tsx)

**File:** `apps/mobile/app/(app)/workout/index.tsx`
**Operation:** Full visual redesign. Data wiring stays (workoutStore + Supabase queries).

### 2.1 Layout Overview

```
SafeAreaView (bg: theme.background)
├── ScrollView (paddingBottom: 100)
│   ├── [Conditional] ResumeBar (if currentSession active)
│   ├── [Conditional] ProgramDetail hero (if activeProgram exists)
│   │   ├── Hero card (dark gradient)
│   │   ├── Description text
│   │   ├── SubTabs (Semaine type / N semaines)
│   │   └── Tab content (schedule rows OR weeks list)
│   ├── [Conditional] Empty state (if NO activeProgram)
│   └── [Always] Recent sessions strip (last 3, "Tout voir →")
└── Sticky footer CTA ("Démarrer la séance…")
```

Note: The existing top header (`Au boulot.` + calendar + add buttons) is replaced by `WSHeader` in dark variant when a program is active, or hidden entirely in favor of a simpler title row when no program exists.

### 2.2 WSHeader (Séance tab)

When `activeProgram` exists:
- `WSHeader` variant: **light** (bg: `theme.background`)
- `title`: program name (e.g. "Push / Pull / Legs")
- `sub`: `"${program.author} · ${program.level}"` — use `"Coach Ziko · Intermédiaire"` format
- `right`: `TouchableOpacity` → `showAlert` with program actions ("Activer", "Dupliquer", "Supprimer")
  - Button: `{ width: 32, height: 32, borderRadius: 999, backgroundColor: rgba(28,26,23,0.06) }`
  - Content: text `"•••"` at `fontSize: 12, fontWeight: '700'`

When NO program: omit WSHeader, show simple title `"Au boulot."` at `fontSize: 28, fontWeight: '700'` with same add/calendar buttons as current.

### 2.3 ProgramDetail Hero Card

Container:
```
{
  borderRadius: 14,
  padding: 16,
  background: linear gradient → use:
    colors: ['#1C1A17', '#2A211B']
    start: { x: 0.13, y: 0 }
    end: { x: 1, y: 1 }
  overflow: 'hidden',
  position: 'relative',
}
```

Orange glow orb (absolute, behind content):
```
{
  position: 'absolute', top: -50, right: -50,
  width: 200, height: 200, borderRadius: 100,
  backgroundColor: 'rgba(255,92,26,0.35)',
  opacity: 1,
}
```
On iOS use `blurRadius` on an `Image` or a nested `View` with low opacity. On Android: just the semi-transparent View.

**Status badges row** (`flexDirection: 'row', gap: 8, marginBottom: 12`):
- "Actif" badge: `{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FF5C1A', color: '#fff', fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }`
- Focus badge (e.g. "Hypertrophie · Force"): `{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,250,246,0.1)', color: '#FFFAF6', fontWeight: '700' }`

**Week progress row** (`flexDirection: 'row', alignItems: 'baseline', gap: 16, marginTop: 12`):
- Current week: `fontSize: 34, fontWeight: '700', color: '#FFFAF6', lineHeight: 34`
- Label "semaine": `fontSize: 10, color: 'rgba(255,250,246,0.55)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2`
- Divider "/": `fontSize: 16, color: 'rgba(255,250,246,0.45)', fontWeight: '400'`
- Total weeks: `fontSize: 16, fontWeight: '700', color: 'rgba(255,250,246,0.7)', lineHeight: 16`
- Label "total": `fontSize: 10, color: 'rgba(255,250,246,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2`

**Progress bar** (`marginTop: 16, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,250,246,0.12)', overflow: 'hidden'`):
- Fill: `{ width: \`${(currentWeek / totalWeeks) * 100}%\`, height: '100%' }` using LinearGradient: `colors: ['#FF5C1A', '#FFB07A'], start: {x:0,y:0}, end: {x:1,y:0}`

### 2.4 Description Text

```
{
  fontSize: 12,
  lineHeight: 18,
  color: theme.muted,
  marginTop: 16,
  paddingHorizontal: 4,
}
```

### 2.5 SubTabs

Container: `{ marginTop: 16, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: 'rgba(28,26,23,0.05)' }`

Each tab button:
- Inactive: `{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'transparent', color: theme.muted, fontSize: 12, fontWeight: '700' }`
- Active: `{ backgroundColor: theme.surface, color: theme.text, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 }`

Tab labels: `"Semaine type"` and `"8 semaines"` (replace N with actual `program.weeks` value).

### 2.6 Schedule Rows ("Semaine type" tab)

Container: `{ display: 'grid', gap: 8, marginTop: 16 }` → in RN: `FlatList` or map with `marginBottom: 8`

Each day row card: `{ borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: isRest ? 0.6 : 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

Day badge (36w × 36h):
- Rest day: `{ borderRadius: 10, width: 36, height: 36, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', backgroundColor: 'transparent', color: theme.muted, fontSize: 12, fontWeight: '700', alignItems: 'center', justifyContent: 'center' }`
- Active day: `{ borderRadius: 10, width: 36, height: 36, backgroundColor: 'rgba(255,92,26,0.12)', color: '#FF5C1A', fontSize: 12, fontWeight: '700', alignItems: 'center', justifyContent: 'center' }`

Session name: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
Muscles: `{ fontSize: 10, color: theme.muted, marginTop: 1 }`
Chevron (non-rest): `<Ionicons name="chevron-forward" size={14} color={theme.muted} />`

### 2.7 Weeks Plan Rows ("N semaines" tab)

Each week row card:
- Default: `{ borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, opacity: isDone ? 0.65 : 1 }`
- Current week: `{ backgroundColor: 'rgba(255,92,26,0.06)', borderWidth: 1.5, borderColor: '#FF5C1A' }`

Week badge (36 × 36, borderRadius: 10):
- Done: `{ backgroundColor: 'rgba(34,197,94,0.14)' }` → `<Ionicons name="checkmark" size={14} color={theme.success} strokeWidth={2.6} />`
- Current: `{ backgroundColor: '#FF5C1A' }` → text `S{w.w}` color `#fff`
- Future: `{ backgroundColor: 'rgba(28,26,23,0.05)' }` → text `S{w.w}` color `theme.text`

Week title: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
"EN COURS" tag: `{ fontSize: 10, color: '#FF5C1A', fontWeight: '700', marginLeft: 8 }`
Focus/load: `{ fontSize: 10, color: theme.muted, marginTop: 1 }` — e.g. "Volume · charge Modéré+"

### 2.8 Sticky Footer CTA

```
{
  position: 'absolute', left: 0, right: 0, bottom: 0,
  paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8,
  background: linearGradient top → transparent, bg color at 75%
}
```

CTA button: `{ width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center' }`
Text: `"Démarrer la séance d'aujourd'hui · Push"` — dynamically render today's session name after `·`
Style: `{ color: '#fff', fontSize: 12, fontWeight: '700' }`

### 2.9 Empty State (no activeProgram)

Replace existing dashed card. Design:
```
{
  marginHorizontal: 16, marginTop: 24, marginBottom: 16,
  borderRadius: 14, padding: 24,
  backgroundColor: theme.surface,
  borderWidth: 1.5, borderColor: theme.border, borderStyle: 'dashed',
  alignItems: 'center',
}
```

Content:
- Icon: `<Ionicons name="barbell-outline" size={36} color={theme.muted} />` with `marginBottom: 12`
- Title: `"Aucun programme actif"` — `fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4`
- Subtitle: `"Structure tes entraînements pour progresser"` — `fontSize: 12, color: theme.muted, textAlign: 'center', marginBottom: 16`
- CTA: Full-width `TouchableOpacity` → `router.push('/(app)/workout/ai-generate')`
  - `{ backgroundColor: '#FF5C1A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }`
  - Text: `"Créer un programme"` — `{ color: '#fff', fontWeight: '700', fontSize: 12 }`

### 2.10 States

| State | Behavior |
|-------|----------|
| Loading | `<ActivityIndicator color={theme.primary} />` centered, no skeleton |
| Empty | Empty state component (§2.9) |
| Has active program | ProgramDetail hero + tabs + schedule + footer CTA |
| Session in progress | `ResumeBar` above program content (unchanged from current logic) |

---

## 3. Screen 2 — AIGenerator (ai-generate.tsx)

**File:** `apps/mobile/app/(app)/workout/ai-generate.tsx`
**Operation:** Full redesign. 4-step wizard. Replace current 3-option zone picker with 4 options including "Cardio + core".

### 3.1 Layout

```
View (flex: 1, backgroundColor: theme.background)
├── WSHeader (light variant, title="Coach IA", sub="Étape N/4")
├── ScrollView (flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100)
│   ├── Progress dots row
│   └── Step content (step 0–3 | generating | step 4 generated)
└── Sticky footer (back + next/generate buttons)
```

### 3.2 Progress Dots

`{ flexDirection: 'row', gap: 4, marginBottom: 24 }`

Each dot: `{ flex: 1, height: 3, borderRadius: 999 }`
- Filled (index ≤ step): `backgroundColor: '#FF5C1A'`
- Empty: `backgroundColor: 'rgba(28,26,23,0.08)'`

### 3.3 Step 0 — Énergie (1–10 slider)

Heading: `"Comment tu te sens\naujourd'hui ?"` — `fontSize: 16, fontWeight: '700', lineHeight: 20`
Subheading: `"De 1 (épuisé) à 10 (forme olympique)"` — `fontSize: 12, color: theme.muted, marginTop: 8`

Energy value display (display exception — see §1.2): `{ fontSize: 64, fontWeight: '700', color: '#FF5C1A', textAlign: 'center', marginTop: 32 }`
- Unit "/10": `{ fontSize: 16, color: theme.muted, fontWeight: '400' }` inline

Slider: React Native `Slider` from `@react-native-community/slider` (or `expo-slider`) — `minimumValue={1}, maximumValue={10}, step={1}, minimumTrackTintColor="#FF5C1A", thumbTintColor="#FF5C1A"`

Scale labels row: `{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }`
- Labels: "Épuisé", "Modéré", "Au top" — `fontSize: 10, color: theme.muted, fontWeight: '700'`

### 3.4 Step 1 — Durée (5 options)

Heading: `"Tu as combien\nde temps ?"` — `fontSize: 16, fontWeight: '700'`
Subheading: `"On adapte le nombre d'exos."` — `fontSize: 12, color: theme.muted`

Duration options — vertical list `{ gap: 8, marginTop: 24 }`:

Each option card: `{ borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }`
- Selected: `{ borderWidth: 1.5, borderColor: '#FF5C1A', backgroundColor: 'rgba(255,92,26,0.06)' }`
- Unselected: `{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }`

Content per row:
- `<Ionicons name="timer-outline" size={16} color={selected ? '#FF5C1A' : theme.muted} />`
- Duration label: `{ fontSize: 12, fontWeight: '700', color: theme.text }` — "20 min", "30 min", "45 min", "60 min", "90 min"
- Tag (marginLeft auto): `{ fontSize: 10, color: theme.muted }` — "express" (≤30), "standard" (45), "complète" (60), "long" (90)

### 3.5 Step 2 — Zone (4 options)

Heading: `"Quelle zone\naujourd'hui ?"` — `fontSize: 16, fontWeight: '700'`

4 option cards in vertical list `{ gap: 8, marginTop: 24 }`:

| id | Label | Sub-label | Icon |
|----|-------|-----------|------|
| `haut` | Haut du corps | Pec, dos, épaules, bras | `barbell-outline` |
| `bas` | Bas du corps | Quadri, ischios, mollets | `walk-outline` |
| `full` | Full body | Tout en équilibre | `body-outline` |
| `cardio` | Cardio + core | Léger, récup active | `heart-outline` |

Each card: `{ borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }`
- Same selected/unselected styling as Step 1

Icon badge (36 × 36, borderRadius: 10):
- Selected: `{ backgroundColor: '#FF5C1A' }`, icon color `#fff`
- Unselected: `{ backgroundColor: 'rgba(255,92,26,0.12)' }`, icon color `#FF5C1A`

Label: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
Sub-label: `{ fontSize: 10, color: theme.muted, marginTop: 1 }`

### 3.6 Step 3 — Matériel (4 options, 2×2 grid)

Heading: `"Où tu t'entraînes ?"` — `fontSize: 16, fontWeight: '700'`

2-column grid: `{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 }`
Each cell: `{ width: '48%' }` — or use `FlatList numColumns={2}`

| id | Label | Icon |
|----|-------|------|
| `salle` | Salle complète | `barbell-outline` |
| `maison` | Maison · haltères | `home-outline` |
| `outdoor` | Extérieur · poids du corps | `leaf-outline` |
| `hotel` | Hôtel · minimal | `bed-outline` |

Each option card (column direction): `{ borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, flex: 1 }`
- Selected/unselected border same as above
- Icon: `<Ionicons size={20} color={selected ? '#FF5C1A' : theme.text} />`
- Label: `{ fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 }`

### 3.7 Loading State (MotiView)

WSHeader: `title="Génération…"` with back button.

Center container: `{ paddingVertical: 64, paddingHorizontal: 24, alignItems: 'center' }`

**MotiView sparkle orb:**
```tsx
<MotiView
  from={{ scale: 1, opacity: 1 }}
  animate={{ scale: 1.08, opacity: 0.85 }}
  transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
  style={{
    width: 80, height: 80, borderRadius: 999,
    // Use LinearGradient wrapper from expo-linear-gradient:
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  }}
>
  <LinearGradient
    colors={['#FF5C1A', '#FFB07A']}
    start={{ x: 0.13, y: 0 }} end={{ x: 1, y: 1 }}
    style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}
  >
    <Ionicons name="sparkles" size={36} color="#fff" />
  </LinearGradient>
</MotiView>
```

Title: `"Coach IA travaille…"` — `fontSize: 16, fontWeight: '700', marginTop: 24, textAlign: 'center'`
Subtitle: Dynamic — `"On adapte la séance à ton énergie ({energy}/10),\nton historique et le matériel dispo."` — `fontSize: 12, color: theme.muted, marginTop: 8, lineHeight: 18, textAlign: 'center'`

Simulated delay: 1800ms then render step 4 (generated session).

### 3.8 Step 4 — Generated Session

WSHeader: `title="Ta séance générée"`, `sub="\~{duration} min · adapté à toi"`

**AI adaptation card** (`marginBottom: 16`):
```
{
  borderRadius: 14, padding: 16,
  backgroundColor: 'rgba(255,92,26,0.08)',   // (primary 8% over white)
  borderWidth: 1,
  borderColor: 'rgba(255,92,26,0.22)',
  flexDirection: 'row', gap: 10, alignItems: 'flex-start'
}
```

Left icon badge (32 × 32, borderRadius: 10, backgroundColor: theme.text):
- `<Ionicons name="sparkles" size={15} color="#FFE6D9" />`

Right content:
- Category: `"Adaptations IA"` — `fontSize: 10, fontWeight: '700', color: '#FF5C1A', letterSpacing: 0.8, textTransform: 'uppercase'`
- Explanation text: `fontSize: 12, lineHeight: 17, marginTop: 4, color: theme.text`

**Exercise list** section title: `"5 exercices"` — section-title style (see §14)
Each exercise row card: `{ borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }`

Number badge (26 × 26, borderRadius: 8, backgroundColor: 'rgba(255,92,26,0.12)'):
- `{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }` — index + 1

Name: `{ fontSize: 12, fontWeight: '700' }`
Sets: `{ fontSize: 10, color: theme.muted, marginTop: 1 }` — e.g. "3 × 8-10 · charge légère vu énergie 7/10"

**Regenerate button**: `{ flexDirection: 'row', gap: 8, marginTop: 16 }`
- Ghost button: `{ flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }`
- Text: `"Régénérer"` — `fontSize: 12, color: theme.text, fontWeight: '700'`
- Icon: `<Ionicons name="sparkles" size={13} color={theme.text} />`

Footer CTA: `"Démarrer cette séance"` with `<Ionicons name="play" size={13} color="#fff" />` icon

### 3.9 Wizard Footer

Sticky at bottom: `{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }`

Step > 0: Two buttons side by side `{ flexDirection: 'row', gap: 8 }`:
- Back: ghost button `{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14 }` — text `"Retour"`, fontSize: 12
- Next: primary full-width button

Step 0: Single primary button full-width

Button labels:
- Step 0–2: `"Continuer"`
- Step 3: `"Générer ma séance"`
- Step 4: `"Démarrer cette séance"`

---

## 4. Screen 3 — ExerciseDetail

**File:** `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` (NEW)

### 4.1 Layout

```
View (flex: 1, backgroundColor: theme.background)
├── WSHeader (light, title=exercise.name, sub="${exercise.muscle} · ${exercise.difficulty}")
├── ScrollView (paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28)
│   ├── Video placeholder (16:9)
│   ├── Stats row (3 tiles)
│   ├── SubTabs (Consignes / Muscles / Historique)
│   ├── Tab content
│   └── Action buttons
```

**Error state:** If the exercise query fails, display a centered message: `"Impossible de charger les données. Réessaie."` with a `"Réessayer"` button that calls `refetch()`.

### 4.2 Video Placeholder

```
{
  borderRadius: 14,
  aspectRatio: 16/9,
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: '#1C1A17',  // dark base
}
```

Diagonal stripe overlay (absolute, inset 0):
- Use a pattern via `ImageBackground` with a generated repeating diagonal pattern, or skip the stripe on mobile (just use flat dark background `#1C1A17 → #2A211B` gradient). The pattern in web mockup is `repeating-linear-gradient(45deg, rgba(255,92,26,.04) 0 12px, transparent 12px 24px)` — approximate with a very low opacity orange tint overlay.

Play button (centered, absolute):
- `{ width: 60, height: 60, borderRadius: 999, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' }`
- Shadow: `{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 8 }, elevation: 12 }`
- Icon: `<Ionicons name="play" size={22} color="#1C1A17" />`

Top-left badge: `{ position: 'absolute', top: 12, left: 12 }`:
- `{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(28,26,23,0.7)', color: '#FFFAF6', fontWeight: '700' }`
- Content: `"Démo · 0:42"`

Bottom-right badge: `{ position: 'absolute', bottom: 12, right: 12 }`:
- Same pill style, content: `"HD"`

### 4.3 Stats Row (3 tiles)

`{ flexDirection: 'row', gap: 8, marginTop: 12 }`

Each tile: `{ flex: 1, borderRadius: 14, padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

| Stat | Label | Value example |
|------|-------|---------------|
| Record | `"Record"` | `"102"` + unit "kg" |
| Séances | `"Séances"` | `"5"` |
| Tendance | `"Tendance"` | `"↑ 9%"` in `theme.success` |

Label: `{ fontSize: 10, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }`
Value: `{ fontSize: 16, fontWeight: '700', lineHeight: 16, marginTop: 4, color: theme.text }`
Unit/sub (small): `{ fontSize: 10, color: theme.muted, fontWeight: '400', marginLeft: 1 }`
Sub-label: `{ fontSize: 10, color: theme.muted, marginTop: 2 }` (e.g. "×1 · il y a 4j")

### 4.4 SubTabs

Same spec as §2.5. Labels: `"Consignes"`, `"Muscles"`, `"Historique"`.

### 4.5 "Consignes" Tab

Card: `{ borderRadius: 14, padding: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginTop: 16 }`

Section header: `"Points clés d'exécution"` — `{ fontSize: 10, fontWeight: '700', color: '#FF5C1A', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }`

Each cue row: `{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 }`

Number circle (22 × 22, borderRadius: 999):
- `{ backgroundColor: 'rgba(255,92,26,0.14)', alignItems: 'center', justifyContent: 'center' }`
- `{ fontSize: 10, fontWeight: '700', color: '#FF5C1A' }` — number

Cue text: `{ fontSize: 12, lineHeight: 18, flex: 1 }`

**AISuggestion block** (below cue list, marginTop: 16):
```
{
  borderRadius: 10, padding: 10,
  backgroundColor: 'rgba(255,92,26,0.08)',
  borderWidth: 1, borderColor: 'rgba(255,92,26,0.22)',
  flexDirection: 'row', gap: 10, alignItems: 'flex-start',
}
```
- Icon: `<Ionicons name="sparkles" size={14} color="#FF5C1A" />`
- Text: `{ fontSize: 12, lineHeight: 16, flex: 1 }` — `"Coach IA : sur ta dernière séance tu cassais la cambrure sur les dernières reps. Pense à garder la poitrine sortie."`

### 4.6 "Muscles" Tab

Card: same container spec.

Section header: `"Muscles travaillés"` — muted uppercase style
Muscle chips: `{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }`
- Primary muscle chip: `{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FF5C1A' }` → text `"{muscle} · primaire"` color `#fff`, `fontSize: 12, fontWeight: '700'`
- Secondary chips: `{ backgroundColor: 'rgba(255,92,26,0.12)', color: '#FF5C1A' }` — same size

Equipment section (marginTop: 16):
- Label: "Matériel" — muted uppercase `fontSize: 10`
- Value: `{ fontSize: 12, fontWeight: '700', color: theme.text, marginTop: 8 }`

### 4.7 "Historique" Tab

Card: same container. Section header: "5 dernières séances".

**Mini bar chart** (`{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 70, marginBottom: 10 }`):
- Each bar: `{ flex: 1, alignItems: 'center' }`
- Bar fill: height proportional to volume ratio, `borderRadius: 4`
- Most recent bar: `backgroundColor: '#FF5C1A'`
- Older bars: `backgroundColor: 'rgba(255,92,26,0.30)'`
- Note: render sessions in chronological order (oldest left, newest right)

Session list rows (below chart):
- Each row: `{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }` (first row: no top border)
- Date: `{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }` — e.g. "il y a 4j"
- Best set: `{ fontSize: 10, color: theme.muted }` — "Meilleure : 100 kg × 6"
- Volume: `{ fontSize: 12, fontWeight: '700', color: theme.text }` — "2.52t"

### 4.8 Action Buttons

`{ gap: 8, marginTop: 16 }`

Primary: full-width, `{ backgroundColor: theme.text, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }` → text `"Ajouter à ma séance"`, color `#FFFAF6`, `fontSize: 12, fontWeight: '700'`

Ghost: `{ borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }` → text `"Substituer dans la séance en cours"`, `fontSize: 12, fontWeight: '700', color: theme.text`

---

## 5. Screen 4 — ExercisePicker (Modal)

**File:** `apps/mobile/src/components/ExercisePicker.tsx` (NEW — Modal component)
**Presentation:** React Native `Modal` with `animationType="slide"`, `presentationStyle="pageSheet"`

### 5.1 Layout

```
Modal (slide, pageSheet)
└── View (flex: 1, backgroundColor: theme.background)
    ├── WSHeader (light, title="Ajouter un exercice", sub="${total} exercices · ${selected} sélectionnés")
    ├── View (paddingHorizontal: 16, paddingTop: 12)
    │   ├── Search input
    │   └── Filter chips (horizontal scroll)
    ├── ScrollView (flex: 1, paddingHorizontal: 16, paddingBottom: 100)
    │   └── Exercise list
    └── Sticky footer (Ajouter N exercices button)
```

**Error state:** If the exercise library query fails, display: `"Impossible de charger les données. Réessaie."` with a `"Réessayer"` button that calls `refetch()`.

### 5.2 Search Input

Container: `{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

- Left: `<Ionicons name="search-outline" size={16} color={theme.muted} />`
- `TextInput`: `{ flex: 1, fontSize: 12, color: theme.text, backgroundColor: 'transparent' }`, placeholder: `"Rechercher un exercice…"`, `placeholderTextColor: theme.muted`
- Clear button (visible when query): `<TouchableOpacity>` `<Ionicons name="close-outline" size={14} color={theme.muted} />`

### 5.3 Filter Chips

`ScrollView` horizontal, `showsHorizontalScrollIndicator={false}`, `{ marginTop: 10, paddingBottom: 4 }`

Chips array: `["Favoris", "Pectoraux", "Dos", "Jambes", "Épaules", "Bras", "Abdos"]`

Each chip: `{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginRight: 8 }`
- Active: `{ borderWidth: 1.5, borderColor: '#FF5C1A', backgroundColor: 'rgba(255,92,26,0.10)', color: '#FF5C1A' }`
- Inactive: `{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }`
- Font: `fontSize: 12, fontWeight: '700'`
- "Favoris" chip: prepend `"★ "` to label text

Filter logic:
- "Favoris": show only `exercise.fav === true`
- "Bras": show `exercise.muscle === 'Biceps' || exercise.muscle === 'Triceps'`
- Others: exact `exercise.muscle === filter`
- Search query overrides filter — shows all matching name/muscle

### 5.4 Exercise Rows

`{ gap: 8, marginTop: 12 }`

Each row: `{ borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }`
- Selected: `{ borderWidth: 1.5, borderColor: '#FF5C1A', backgroundColor: 'rgba(255,92,26,0.06)' }`
- Unselected: `{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }`

Checkbox (22 × 22, borderRadius: 6):
- Checked: `{ backgroundColor: '#FF5C1A' }` → `<Ionicons name="checkmark" size={12} color="#fff" />`
- Unchecked: `{ borderWidth: 1.5, borderColor: theme.border, backgroundColor: 'transparent' }`

Name + favorite:
- Name: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
- Fav star: `{ fontSize: 10, color: '#FF5C1A', marginLeft: 8 }` — `"★"`

Sub: `{ fontSize: 10, color: theme.muted, marginTop: 2 }` — `"{muscle} · {equip} · PR {pr}"` (omit PR section if `pr` undefined)

Empty search result: centered `{ padding: 24, color: theme.muted, fontSize: 12, textAlign: 'center' }` — `"Aucun exercice trouvé."`

### 5.5 Sticky Footer

Same gradient fade pattern as other screens.

Button state:
- 0 selected (disabled): `{ backgroundColor: 'rgba(28,26,23,0.18)', paddingVertical: 12, borderRadius: 14 }` — text `"Sélectionne des exercices"`, color `#fff`
- 1+ selected (active): `{ backgroundColor: '#FF5C1A' }` — text `"Ajouter {N} exercice{s}"`, color `#fff`, fontSize: 12, fontWeight: '700'

Calls `onAdd(selectedIds)` prop on tap.

---

## 6. Screen 5 — HistoryDetail

**File:** `apps/mobile/app/(app)/workout/session/[sessionId].tsx` (NEW)

### 6.1 Layout

```
View (flex: 1, backgroundColor: theme.background)
├── WSHeader (light, title=session.name, sub="${session.date}", right="•••" button)
└── ScrollView (paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28)
    ├── Stats card (4-up grid)
    ├── Note card (if session.note exists)
    ├── Exercises section
    └── Action buttons
```

**Error state:** If the session query fails, display: `"Impossible de charger les données. Réessaie."` with a `"Réessayer"` button that calls `refetch()`.

### 6.2 Stats Card (4-up)

Card: `{ borderRadius: 14, padding: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`
Grid: `{ flexDirection: 'row', gap: 10 }` (4 flex-1 columns)

| Stat | Value format | Unit | Label |
|------|-------------|------|-------|
| Durée | `"{duration}"` | `"min"` | `"durée"` |
| Volume | `"{(volume/1000).toFixed(2)}"` | `"t"` | `"volume"` |
| Séries | `"{sets}"` | `""` | `"séries"` |
| FC moy. | `"{avgHr}"` | `"bpm"` | `"FC moy."` |

Value: `{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: theme.text }`
Unit inline: `{ fontSize: 10, color: theme.muted, fontWeight: '400', marginLeft: 1 }`
Label: `{ fontSize: 10, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }`

### 6.3 Note Card

Card: `{ borderRadius: 14, padding: 16, marginTop: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`
Section header: `"Note"` — muted uppercase `fontSize: 10`
Note content: `{ fontSize: 12, lineHeight: 18, color: theme.text }` — wrapped in `"„{note}"`

### 6.4 Exercises Section

Section title: `"Exercices"` — section-title style (see §14)
List: `{ gap: 8 }`

Each exercise card: `{ borderRadius: 14, padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

Header row: `{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }`
- Number badge (24 × 24, borderRadius: 7, `backgroundColor: 'rgba(28,26,23,0.06)'`): `{ fontSize: 10, fontWeight: '700', color: theme.text }`
- Name: `{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }`
- Set count: `{ fontSize: 10, color: theme.muted }` — `"{N} séries"`

Set chips row: `{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }`

Each set chip: `{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(28,26,23,0.05)' }`
- Set label: `<Text style={{ color: theme.muted }}>S{j+1}</Text>`
- Weight × reps: `" {weight}kg × {reps}"` (or `"BW+{weight}"` for bodyweight sets)
- RPE: `<Text style={{ color: '#FF5C1A', fontWeight: '700', marginLeft: 4 }}>· {rpe}</Text>` (if present)
- Full chip font: `fontWeight: '700', color: theme.text`

### 6.5 Action Buttons

`{ gap: 8, marginTop: 16 }`

Primary (dark): `{ backgroundColor: theme.text, borderRadius: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }`
- Icon: `<Ionicons name="play" size={13} color="#FFFAF6" />`
- Text: `"Refaire cette séance"`, color `#FFFAF6`, `fontSize: 12, fontWeight: '700'`

Ghost: `{ borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border }` — `"Comparer avec la précédente"`, `fontSize: 12, fontWeight: '700', color: theme.text`

---

## 7. Screen 6 — WorkoutSummary (summary.tsx)

**File:** `apps/mobile/app/(app)/workout/summary.tsx`
**Operation:** Full visual redesign. Data source `workoutStore.lastCompletedSession` unchanged.

### 7.1 Layout

```
View (flex: 1, backgroundColor: theme.background)
├── WSHeader (light variant)
└── ScrollView (paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120)
    ├── Hero dark card (Highlight)
    ├── PRs section (if prs.length > 0)
    ├── Heart rate chart card
    ├── Per-exercise breakdown
    └── Notes textarea
└── Sticky footer (Partager + Sauvegarder & fermer)
```

### 7.2 WSHeader

- `title`: `"Séance terminée"`
- `sub`: `"Bravo pour cette session"`
- `onBack`: `router.back()`
- Variant: light

### 7.3 Hero Dark Card

```
{
  borderRadius: 14, padding: 16,
  backgroundColor: theme.text,   // #1C1A17
  overflow: 'hidden', position: 'relative',
}
```

Orange glow orb (same spec as §2.3):
- Position absolute: `{ top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,92,26,0.28)' }`

Highlight label row: `{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }`
- `<Ionicons name="trophy" size={14} color="#FF5C1A" />`
- `"Highlight"` — `{ fontSize: 10, fontWeight: '700', color: '#FF5C1A', letterSpacing: 1, textTransform: 'uppercase' }`

Highlight text: `session.highlight ?? \`${durationMin} min · ${totalSets} séries complétées\``
- `{ fontSize: 16, fontWeight: '700', lineHeight: 20, color: '#FFFAF6', marginBottom: 16 }`

4-up stats grid: `{ flexDirection: 'row', gap: 8 }`
- Each: `{ flex: 1 }`
- Value: `{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: '#FFFAF6' }`
- Label: `{ fontSize: 10, color: 'rgba(255,250,246,0.5)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700', marginTop: 3 }`

Stats: durée (e.g. `"52 min"`), volume (e.g. `"5.29t"`), séries (e.g. `"14"`), FC moy. (e.g. `"132"` or `"—"`)

### 7.4 PRs Section

Show only when `prs.length > 0`.

Section title: `"Records battus {N}"` — N in `color: '#FF5C1A'` inline.

Each PR card:
```
{
  borderRadius: 14, padding: 16,
  flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
  // Gradient from left primary 8% tint to white surface:
  // On RN use LinearGradient: colors=['rgba(255,92,26,0.08)', theme.surface]
  // Or simply: backgroundColor: 'rgba(255,92,26,0.05)' + borderWidth:1 + borderColor: 'rgba(255,92,26,0.15)'
}
```

Trophy badge (46 × 46, borderRadius: 14):
- `{ backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center' }`
- Shadow: `{ shadowColor: '#FF5C1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 6 }`
- Icon: `<Ionicons name="trophy" size={20} color="#fff" />`

Content:
- Name: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
- Sub: `"Nouveau record · {delta}"` — `{ fontSize: 12, color: theme.muted, marginTop: 2 }`

Right value: `{ fontSize: 16, fontWeight: '700', color: '#FF5C1A' }`
- Weight + "kg" unit (small muted) + "×{reps}" (small muted, marginLeft: 4)

### 7.5 Heart Rate Card

Section title: `"Fréquence cardiaque"`

Card: `{ borderRadius: 14, padding: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

HR header row: `{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }`
- Avg/max: `{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: theme.text }` + `"moy"` unit small muted + `"· {maxHr} max"` at fontSize: 12 muted
- Zone: `"Zone Z3 (cardio) majoritaire"` — `fontSize: 10, color: theme.muted, marginTop: 3`

**SVG sparkline** (viewBox: `"0 0 280 70"`, width: `100%`, height: `70`):

Gradient definition:
```svg
<defs>
  <linearGradient id="hrFill" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stopColor="#FF5C1A" stopOpacity="0.25"/>
    <stop offset="100%" stopColor="#FF5C1A" stopOpacity="0"/>
  </linearGradient>
</defs>
```

Fill area path (estimated heart rate curve — static, not real data):
```
M0,55 Q15,38 30,40 T60,32 Q75,20 90,28 T120,22 Q135,15 150,25 T180,32 Q200,28 215,20 T245,18 Q260,22 280,30 L280,70 L0,70 Z
```
Fill: `url(#hrFill)`

Stroke line (same path without close, no fill):
- `stroke="#FF5C1A"`, `strokeWidth="1.8"`, `strokeLinecap="round"`, `strokeLinejoin="round"`

Use React Native SVG (`react-native-svg`) — already in codebase via other plugins.

### 7.6 Per-Exercise Breakdown

Section title: `"Détail par exercice"`

Each row: `{ borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }`

Icon badge (30 × 30, borderRadius: 9):
- PR exercise: `{ backgroundColor: '#FF5C1A' }` → `<Ionicons name="trophy" size={13} color="#fff" />`
- Normal: `{ backgroundColor: 'rgba(28,26,23,0.06)' }` → `<Ionicons name="barbell-outline" size={13} color={theme.text} />`

Content:
- Name + optional " · PR" badge: `{ fontSize: 10, color: '#FF5C1A', fontWeight: '700', marginLeft: 8, letterSpacing: 0.6 }`
- Sub: `"{sets} séries · meilleure : {best}{note}"` — `fontSize: 10, color: theme.muted`
  - If skipped note: ` · {note}` in color `#FF5C1A`

Volume right: `{ fontSize: 12, fontWeight: '700', color: theme.text }` — `"{n}t"` or `"—"`

### 7.7 Notes Textarea

Section title: `"Note de séance"`

`TextInput` multiline:
```
{
  borderRadius: 12, borderWidth: 1, borderColor: theme.border,
  backgroundColor: theme.surface,
  paddingHorizontal: 16, paddingVertical: 12,
  fontSize: 12, lineHeight: 18, color: theme.text,
  textAlignVertical: 'top', minHeight: 80,
}
```
Placeholder: `"Comment t'es-tu senti ? Énergie, sommeil, ressenti…"` — color: `theme.muted`

### 7.8 Footer

`{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12, flexDirection: 'row', gap: 8 }`

Background: `LinearGradient colors={[theme.background + 'E0', theme.background]}` top to bottom, or `backgroundColor: theme.background + 'E0'`

**Partager** (ghost, fixed width):
- `{ paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 8 }`
- `<Ionicons name="share-social-outline" size={14} color={theme.text} />`
- Text: `"Partager"`, `fontSize: 12, fontWeight: '700', color: theme.text`
- onPress: `Share.share({ message: \`${session.name}\\n${durationMin} min · ${totalSets} séries · ${(totalVolume/1000).toFixed(1)}t${prs.length ? '\\n' + prs.map(p=>p.name).join(', ') + ' — nouveau record !' : ''}\` })`

**Sauvegarder & fermer** (dark, flex 1):
- `{ flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center' }`
- Text: `"Sauvegarder & fermer"`, `fontSize: 12, fontWeight: '700', color: '#FFFAF6'`

---

## 8. Screen 7 — RestTimer (Component)

**File:** `apps/mobile/src/components/RestTimer.tsx` (NEW)

### 8.1 Component Signature

```tsx
interface RestTimerProps {
  visible: boolean;
  duration: number;          // seconds, e.g. 90
  nextLabel?: string;        // e.g. "95 kg × 7 · Développé couché"
  onSkip: () => void;        // "Reprendre maintenant" tap
  onClose: () => void;       // X button tap
  onAdjust?: (delta: number) => void;  // optional, else adjust locally
}
```

### 8.2 Layout

```
Modal (visible={visible} transparent={true} animationType="fade")
└── View (StyleSheet.absoluteFillObject, zIndex: 80)
    ├── Header row (14px 16px padding)
    │   ├── "Repos" label
    │   └── Close button (accessibilityLabel="Fermer le chrono")
    ├── Center content (flex: 1)
    │   ├── SVG ring + countdown
    │   └── Next series label (optional)
    ├── Controls row (3 buttons)
    └── CTA button ("Reprendre maintenant")
```

### 8.3 Overlay Background

```
{
  ...StyleSheet.absoluteFillObject,
  backgroundColor: '#1C1A17',
  // LinearGradient optional: colors: ['#1C1A17', '#2A211B'], angle: 160deg
  zIndex: 80, flexDirection: 'column',
}
```

Entrance animation (MotiView wrapper):
```tsx
<MotiView
  from={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ type: 'timing', duration: 250 }}
>
```

### 8.4 Header Row

`{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 16 }`

Label: `"Repos"` — `{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,250,246,0.55)' }`

Close button: `{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,250,246,0.08)', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }` with `accessibilityLabel="Fermer le chrono"`
- `<Ionicons name="close" size={16} color="#FFFAF6" />`

### 8.5 SVG Ring

Container: `{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }`

SVG element (260 × 260):
- Outer ring: `cx=130, cy=130, r=110, stroke="rgba(255,250,246,0.08)", strokeWidth=10, fill="none"`
- Progress ring: same cx/cy/r, `stroke` from LinearGradient `#FF5C1A → #FFB07A` (use `<Defs><LinearGradient>` in react-native-svg), `strokeWidth=10`, `fill="none"`, `strokeLinecap="round"`
- `strokeDasharray = 2 * Math.PI * 110 = 691.15`
- `strokeDashoffset = dasharray * (1 - remaining/duration)` — animated via `Animated.Value`
- **Pulse animation when `remaining <= 5`:** use `Animated.loop(Animated.sequence([Animated.timing(opacityAnim, {toValue: 0.55, duration: 400}), Animated.timing(opacityAnim, {toValue: 1, duration: 400})]))` applied to the progress ring opacity.

Rotate SVG by -90° so ring starts at top: `style={{ transform: [{ rotate: '-90deg' }] }}`

**Countdown text** (absolute, centered over SVG — display exception, see §1.2):
- `{ fontSize: 76, fontWeight: '700', color: '#FFFAF6', lineHeight: 76, fontVariant: ['tabular-nums'] }`
- Format: `M:SS` (e.g. `"1:30"`)
- Total duration: `{ fontSize: 12, color: 'rgba(255,250,246,0.5)', fontWeight: '700', marginTop: 8, textAlign: 'center' }` — `"/ {M:SS}"`

### 8.6 Next Series Label

`{ marginTop: 24, alignItems: 'center' }` (below ring, conditional)

Label: `"Prochaine série"` — `{ fontSize: 10, fontWeight: '700', color: 'rgba(255,250,246,0.5)', letterSpacing: 1, textTransform: 'uppercase' }`
Value: `{ fontSize: 16, fontWeight: '700', color: '#FFFAF6', marginTop: 4 }` — e.g. "95 kg × 7"

### 8.7 Controls Row

`{ paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', gap: 8 }`

**−30s** and **+30s** ghost buttons: `{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,250,246,0.14)', backgroundColor: 'rgba(255,250,246,0.06)', alignItems: 'center', justifyContent: 'center' }`
- Text: `"−30s"` / `"+30s"`, `fontSize: 12, fontWeight: '700', color: '#FFFAF6'`

**Pause/Reprendre** center button: `{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,250,246,0.92)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }`
- When running: text `"Pause"`, `fontSize: 12, fontWeight: '700', color: '#1C1A17'`
- When paused: `<Ionicons name="play" size={12} color="#1C1A17" />` + text `"Reprendre"`, same style

Adjust behavior: `remaining = Math.max(0, remaining + delta)` (−30 or +30s)

### 8.8 "Reprendre maintenant" CTA

`{ paddingHorizontal: 24, paddingBottom: 24 }`

Button: `{ width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: '#FF5C1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }`
- `<Ionicons name="play" size={13} color="#fff" />`
- `"Reprendre maintenant"` — `{ fontSize: 12, fontWeight: '700', color: '#fff' }`

onPress: calls `onSkip()` which hides the timer and resumes session.

### 8.9 Countdown Logic

```tsx
useEffect(() => {
  if (paused || !visible) return;
  const t = setInterval(() => {
    setRemaining((r) => {
      if (r <= 1) {
        clearInterval(t);
        // play countdown beep (playSound / playCountdownBeep from apps/mobile/src/lib/sounds)
        setTimeout(() => onClose(), 600);
        return 0;
      }
      if (r <= 5) playCountdownBeep?.();
      return r - 1;
    });
  }, 1000);
  return () => clearInterval(t);
}, [paused, visible]);
```

---

## 9. Screen 8 — WSHeader Component

**File:** `apps/mobile/src/components/WSHeader.tsx` (NEW shared component — also usable from packages/ui if preferred)

### 9.1 Props

```tsx
interface WSHeaderProps {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  dark?: boolean;          // true = dark workout context
}
```

### 9.2 Light Variant (default)

Container:
```
{
  flexDirection: 'row', alignItems: 'center', gap: 10,
  paddingHorizontal: 16, paddingVertical: 12,
  position: 'sticky' / (RN: use with ScrollView stickyHeaderIndices or just fixed header above scroll),
  backgroundColor: theme.background + 'F0',   // ~94% opacity
  borderBottomWidth: 1, borderBottomColor: theme.border,
  zIndex: 10,
}
```

Back button (if `onBack`): `{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(28,26,23,0.06)', alignItems: 'center', justifyContent: 'center' }`
- `<Ionicons name="chevron-back" size={16} color={theme.text} />`

Title: `{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: theme.text }`
Sub (if provided): `{ fontSize: 12, color: theme.muted, marginTop: 1 }`
Right slot: rendered as-is at far right

### 9.3 Dark Variant (`dark={true}`)

Container: same layout but:
- `backgroundColor: 'rgba(28,26,23,0.94)'`
- `borderBottomColor: 'rgba(255,250,246,0.06)'`
- Text colors: `#FFFAF6` for title, `rgba(255,250,246,0.7)` for sub

Back button: `{ backgroundColor: 'rgba(255,250,246,0.08)' }`
- Icon color: `#FFFAF6`

---

## 10. Screen 9 — history.tsx List View

**File:** `apps/mobile/app/(app)/workout/history.tsx`
**Operation:** Redesign list items. Navigation: item tap → `workout/session/[sessionId]`.

### 10.1 Layout

```
SafeAreaView (bg: theme.background)
├── WSHeader (light, title="Historique", onBack)
└── FlatList or ScrollView
    ├── [Date group header]
    ├── Session row
    ├── [Date group header]
    └── ...
```

### 10.2 Date Group Headers

`{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }`
Label: relative date — `"Aujourd'hui"`, `"Hier"`, or `"12 mai"` — `{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6 }`

### 10.3 Session Row

`{ marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }`

Icon badge (38 × 38, borderRadius: 10, `backgroundColor: 'rgba(255,92,26,0.12)'`):
- `<Ionicons name="barbell-outline" size={18} color="#FF5C1A" />`

Content:
- Name: `{ fontSize: 12, fontWeight: '700', color: theme.text }`
- Meta: `"{formattedDate} · {duration}min"` — `{ fontSize: 12, color: theme.muted, marginTop: 2 }`

Right volume badge (conditional): `{ backgroundColor: 'rgba(255,92,26,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }`
- `{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }` — `"{Math.round(volume)}kg"` or `"{(vol/1000).toFixed(1)}t"`

Chevron: `<Ionicons name="chevron-forward" size={14} color={theme.muted} />`

onPress: `router.push(\`/(app)/workout/session/${session.id}\`)`

### 10.4 Empty State

When `recentSessions.length === 0`:
```
{ alignItems: 'center', marginTop: 64, paddingHorizontal: 32 }
```
- Icon: `<Ionicons name="calendar-outline" size={48} color={theme.border} />`
- Title: `"Pas encore de séances"` — `fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 12`
- Sub: `"Tes séances terminées apparaissent ici"` — `fontSize: 12, color: theme.muted, textAlign: 'center', marginTop: 8`

---

## 11. Motion Design

All animations use `moti` (`MotiView`) or React Native's `Animated` API. No GSAP, no Lottie.

### 11.1 Screen Entrance

| Screen | Animation | Config |
|--------|-----------|--------|
| Séance tab | No entrance animation (tab switch) | — |
| AIGenerator | `MotiView from={{ opacity:0, translateY: 12 }} animate={{ opacity:1, translateY: 0 }} transition={{ type: 'timing', duration: 250 }}` | Applied to main content area |
| ExerciseDetail | `MotiView from={{ opacity:0, translateY: 8 }}` duration: 200 | Applied to ScrollView content |
| ExercisePicker | Modal slide — RN built-in `animationType="slide"` | — |
| HistoryDetail | Same as ExerciseDetail | duration: 200 |
| WorkoutSummary | `MotiView from={{ opacity:0, translateY: 16 }}` duration: 280 | Applied to ScrollView content |
| RestTimer | `MotiView from={{ opacity:0 }} animate={{ opacity:1 }}` duration: 250 | Applied to overlay wrapper |
| history.tsx | No entrance — list stagger | — |

### 11.2 List Stagger (history.tsx, ExercisePicker)

```tsx
{items.map((item, index) => (
  <MotiView
    key={item.id}
    from={{ opacity: 0, translateY: 8 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: 180, delay: index * 40 }}
  >
    <SessionRow item={item} />
  </MotiView>
))}
```
Cap stagger at index 8 (max delay: 320ms). Beyond index 8, use `delay: 320`.

### 11.3 CTA Press Feedback

All `TouchableOpacity` CTAs: `activeOpacity={0.82}`. This provides 18% dim on press — enough for snappy feedback without external animation.

For the AIGenerator "Générer" button specifically, add a scale pulse on the loading transition:
```tsx
<MotiView
  animate={{ scale: isGenerating ? [1, 0.97, 1] : 1 }}
  transition={{ type: 'timing', duration: 200 }}
>
```

### 11.4 AIGenerator Loading Orb

```tsx
<MotiView
  from={{ scale: 1, opacity: 1 }}
  animate={{ scale: 1.08, opacity: 0.85 }}
  transition={{
    type: 'timing',
    duration: 700,
    loop: true,
    repeatReverse: true,
  }}
>
  <LinearGradient colors={['#FF5C1A', '#FFB07A']} ...>
    <Ionicons name="sparkles" size={36} color="#fff" />
  </LinearGradient>
</MotiView>
```

### 11.5 RestTimer Ring Progress

Use `Animated.Value` for `strokeDashoffset`:

```tsx
const animOffset = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(animOffset, {
    toValue: CIRC * (1 - remaining / duration),
    duration: 1000,
    useNativeDriver: false,  // SVG props don't support native driver
    easing: Easing.linear,
  }).start();
}, [remaining]);
```

Use `AnimatedCircle` from `react-native-svg/animated`.

### 11.6 RestTimer Pulse (≤5s remaining)

```tsx
const pulseAnim = useRef(new Animated.Value(1)).current;

useEffect(() => {
  if (remaining <= 5 && remaining > 0) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  } else {
    pulseAnim.setValue(1);
  }
}, [remaining <= 5]);
```
Apply `pulseAnim` to the `AnimatedCircle` opacity.

### 11.7 Progress Bar Fill (ProgramDetail)

On mount, animate the progress bar width from 0 to final value:
```tsx
const widthAnim = useRef(new Animated.Value(0)).current;
useEffect(() => {
  Animated.timing(widthAnim, {
    toValue: (currentWeek / totalWeeks) * containerWidth,
    duration: 600,
    delay: 300,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false,
  }).start();
}, []);
```

### 11.8 WorkoutSummary Stats Counter

On screen mount, animate the 4 stat values from 0 to their final values using `Animated.Value` interpolated to string via `animVal.interpolate` — or simply display static values if counter animation adds complexity.

If implementing: duration 1000ms, `Easing.out(Easing.cubic)`, delay 400ms.

---

## 12. Data Contracts

### 12.1 ProgramDetail (inline in index.tsx)

Source: `workoutStore.activeProgram` (type `WorkoutProgram` from `@ziko/plugin-sdk`)

Required fields used in UI:
```ts
{
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  // from program_workouts join:
  program_workouts: Array<{
    id: string;
    day_of_week: number;   // 1=Mon … 7=Sun
    name: string;          // e.g. "Push"
    // exercises omitted for schedule view
  }>;
  // from ai_generated_programs if AI-created:
  program_data?: {
    weeks?: number;          // total weeks (default 8)
    currentWeek?: number;    // e.g. 3
    level?: string;          // "Intermédiaire"
    author?: string;         // "Coach Ziko"
    focus?: string;          // "Hypertrophie · Force"
    weeksPlan?: Array<{
      w: number; focus: string; load: string; done?: boolean; current?: boolean;
    }>;
  };
}
```

Fallbacks: `weeks` → 8, `currentWeek` → 1, `level` → "Intermédiaire", `author` → "Coach Ziko"

### 12.2 AIGenerator

**Inputs (local state):**
```ts
{
  energy: number;      // 1–10
  duration: number;    // 20 | 30 | 45 | 60 | 90
  focus: 'haut' | 'bas' | 'full' | 'cardio';
  equipment: 'salle' | 'maison' | 'outdoor' | 'hotel';
}
```

**API call on generate:**
```ts
POST /ai/tools/execute
Body: {
  tool: 'ai_programs_generate',
  params: {
    goal: answers.focus,
    duration_minutes: answers.duration,
    energy_level: answers.energy,
    equipment: answers.equipment,
    split: 'single_session',
  }
}
```

**Response shape** (from `ai_generated_programs` tool):
```ts
{
  exercises: Array<{
    name: string;
    sets: string;      // "3 × 8-10"
    note?: string;     // AI adaptation note
  }>;
  ai_note?: string;    // overall adaptation explanation
}
```

### 12.3 ExerciseDetail

Route param: `exerciseId: string`

TanStack Query key: `['exercise', exerciseId]`

Supabase query:
```ts
supabase
  .from('exercises')
  .select('*, session_sets(weight_kg, reps, rpe, workout_sessions(started_at))')
  .eq('id', exerciseId)
  .single()
```

Data shape used:
```ts
{
  id: string;
  name: string;
  category: string;         // used as muscle group label
  muscle_groups: string[];  // primary + secondary
  instructions: string;     // split into cues by '. '
  equipment?: string;
  // computed from session_sets join:
  pr: { weight: number; reps: number; date: string };
  sessionCount: number;
  trend: string;            // "↑ 9%" — computed
  history: Array<{ date: string; best: string; volume: number }>;
}
```

### 12.4 ExercisePicker

Props:
```ts
{
  visible: boolean;
  onClose: () => void;
  onAdd: (exerciseIds: string[]) => void;
}
```

TanStack Query key: `['exercises', 'library']`

Supabase query:
```ts
supabase
  .from('exercises')
  .select('id, name, category, muscle_groups, equipment')
  .order('name')
```

Local list shape:
```ts
Array<{
  id: string;
  name: string;
  muscle: string;    // exercises.muscle_groups[0]
  equip: string;     // exercises.equipment
  pr?: string;       // formatted from session_sets max
  fav?: boolean;     // from user favorites (future) — default false
}>
```

### 12.5 HistoryDetail

Route param: `sessionId: string`

TanStack Query key: `['workout_session', sessionId]`

Supabase query:
```ts
supabase
  .from('workout_sessions')
  .select(`
    id, name, started_at, ended_at, total_volume_kg, notes,
    session_sets(
      weight_kg, reps, rpe, set_number,
      exercises(name)
    )
  `)
  .eq('id', sessionId)
  .single()
```

Computed:
- `duration`: `Math.floor((ended_at - started_at) / 60000)` minutes
- `volume`: `total_volume_kg` from DB or sum of `weight_kg * reps`
- `sets`: count of `session_sets`
- `avgHr`: `null` (no real data in Phase 36 — display "—")
- `exercises`: group `session_sets` by `exercises.name`, sorted by first `set_number`

### 12.6 WorkoutSummary

Source: `workoutStore.lastCompletedSession` (in-memory, set when session ends)

Shape (from existing workoutStore — do not change):
```ts
{
  id: string;
  name: string;
  durationSeconds: number;
  highlight?: string;
  avgHr?: number;
  exercises: Array<{
    name: string;
    sets: Array<{ weight: number; reps: number; rpe?: number }>;
    totalVolume: number;
    isNewPR: boolean;
    bestSetLabel?: string;
    bestWeight?: number;
    delta?: number;
  }>;
}
```

HR sparkline: estimated curve from static path string (no real HR data).

### 12.7 RestTimer

Props: see §8.1.
No Supabase queries. State is purely in-component.

---

## 13. Integration Points

### 13.1 Store Hooks

| Screen | Store Hook | Purpose |
|--------|-----------|---------|
| index.tsx | `useWorkoutStore(s => s.activeProgram)` | Determine empty vs program state |
| index.tsx | `useWorkoutStore(s => s.currentSession)` | Show ResumeBar |
| index.tsx | `useWorkoutStore(s => s.recentSessions)` | Recent strip |
| index.tsx | `useWorkoutStore(s => s.loadRecentSessions)` | Load on mount |
| summary.tsx | `useWorkoutStore(s => s.lastCompletedSession)` | Session data |
| summary.tsx | `useWorkoutStore.getState().saveSessionNotes` | Save notes |
| summary.tsx | `useWorkoutStore.getState().clearLastCompletedSession` | After save |
| history.tsx | `useWorkoutStore(s => s.recentSessions)` | Session list |
| All | `useThemeStore(s => s.theme)` | Design tokens |

### 13.2 Navigation Params

| From | To | Method |
|------|----|--------|
| index.tsx (empty state CTA) | `/(app)/workout/ai-generate` | `router.push` |
| index.tsx (day row in schedule) | `/(app)/workout/[id]` (program editor — existing, untouched) | `router.push(\`/(app)/workout/${programId}\`)` |
| history.tsx (session row) | `/(app)/workout/session/${sessionId}` | `router.push` |
| ExerciseDetail (from program schedule row) | `/(app)/workout/exercise/${exerciseId}` | `router.push` |
| session.tsx (adds RestTimer) | RestTimer component | Import + mount conditionally |

### 13.3 TanStack Query Keys

| Key | Screen | Stale Time |
|-----|--------|------------|
| `['exercise', exerciseId]` | ExerciseDetail | 5 minutes |
| `['exercises', 'library']` | ExercisePicker | 10 minutes |
| `['workout_session', sessionId]` | HistoryDetail | 5 minutes |

### 13.4 session.tsx Integration (1 line only)

Add exactly this to session.tsx, in the existing rest phase overlay render position:

```tsx
// Import (top of file):
import RestTimer from '../../../src/components/RestTimer';

// Mount point (where rest overlay currently renders):
<RestTimer
  visible={isResting}
  duration={restDuration}
  nextLabel={nextSetLabel}
  onSkip={() => { setIsResting(false); }}
  onClose={() => { setIsResting(false); }}
/>
```

**Zero logic changes to session.tsx.** `isResting`, `restDuration`, `nextSetLabel` are existing values.

### 13.5 Expo Router File Structure

New files to create (Expo Router auto-discovers):

```
apps/mobile/app/(app)/workout/
├── exercise/
│   └── [exerciseId].tsx       ← ExerciseDetail screen
├── session/
│   └── [sessionId].tsx        ← HistoryDetail screen
apps/mobile/src/components/
├── RestTimer.tsx               ← RestTimer component
├── ExercisePicker.tsx          ← ExercisePicker modal component
└── WSHeader.tsx                ← WSHeader component (if extracted)
```

---

## 14. Copywriting Contract

### 14.1 Section Title Style (reused throughout)

```tsx
<Text style={{
  fontSize: 10,
  fontWeight: '700',
  color: theme.muted,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  marginBottom: 8,
  marginTop: 16,
}}>
  {title}
</Text>
```

### 14.2 French Labels (exact strings)

| Location | String |
|----------|--------|
| Séance tab header | `"Au boulot."` |
| Empty state title | `"Aucun programme actif"` |
| Empty state sub | `"Structure tes entraînements pour progresser"` |
| Empty state CTA | `"Créer un programme"` |
| Active badge | `"Actif"` |
| "EN COURS" tag | `"· EN COURS"` |
| Séance CTA | `"Démarrer la séance d'aujourd'hui · {session_name}"` |
| AIGenerator title | `"Coach IA"` |
| Step counter | `"Étape {N}/4"` |
| Step 0 heading | `"Comment tu te sens\naujourd'hui ?"` |
| Step 0 sub | `"De 1 (épuisé) à 10 (forme olympique)"` |
| Step 0 labels | `"Épuisé"` / `"Modéré"` / `"Au top"` |
| Step 1 heading | `"Tu as combien\nde temps ?"` |
| Step 1 sub | `"On adapte le nombre d'exos."` |
| Step 1 tags | `"express"` (≤30min) / `"standard"` (45) / `"complète"` (60) / `"long"` (90) |
| Step 2 heading | `"Quelle zone\naujourd'hui ?"` |
| Zone options | `"Haut du corps"` / `"Bas du corps"` / `"Full body"` / `"Cardio + core"` |
| Zone subs | `"Pec, dos, épaules, bras"` / `"Quadri, ischios, mollets"` / `"Tout en équilibre"` / `"Léger, récup active"` |
| Step 3 heading | `"Où tu t'entraînes ?"` |
| Equipment options | `"Salle complète"` / `"Maison · haltères"` / `"Extérieur · poids du corps"` / `"Hôtel · minimal"` |
| Wizard back | `"Retour"` |
| Wizard next | `"Continuer"` |
| Wizard final | `"Générer ma séance"` |
| Loading title | `"Coach IA travaille…"` |
| Loading sub | `"On adapte la séance à ton énergie ({N}/10),\nton historique et le matériel dispo."` |
| Generated header | `"Ta séance générée"` |
| Generated sub | `"~{N} min · adapté à toi"` |
| AI adaptation label | `"Adaptations IA"` |
| Regenerate | `"Régénérer"` |
| Start generated | `"Démarrer cette séance"` |
| ExerciseDetail video | `"Démo · 0:42"` |
| Cues header | `"Points clés d'exécution"` |
| AI coach prefix | `"Coach IA :"` |
| Muscles tab | `"Muscles travaillés"` |
| Equipment label | `"Matériel"` |
| History tab | `"5 dernières séances"` |
| ExercisePicker title | `"Ajouter un exercice"` |
| ExercisePicker sub | `"{N} exercices · {M} sélectionnés"` |
| Picker search placeholder | `"Rechercher un exercice…"` |
| Picker empty | `"Aucun exercice trouvé."` |
| Picker footer 0 selected | `"Sélectionne des exercices"` |
| Picker footer N selected | `"Ajouter {N} exercice{s}"` |
| HistoryDetail "Refaire" | `"Refaire cette séance"` |
| HistoryDetail "Comparer" | `"Comparer avec la précédente"` |
| Summary title | `"Séance terminée"` |
| Summary sub | `"Bravo pour cette session"` |
| Summary hero label | `"Highlight"` |
| PRs section title | `"Records battus {N}"` |
| PR card sub | `"Nouveau record · {delta}"` |
| HR section title | `"Fréquence cardiaque"` |
| HR zone | `"Zone Z3 (cardio) majoritaire"` |
| Exercises section title | `"Détail par exercice"` |
| Notes section title | `"Note de séance"` |
| Notes placeholder | `"Comment t'es-tu senti ? Énergie, sommeil, ressenti…"` |
| Footer share | `"Partager"` |
| Footer save | `"Sauvegarder & fermer"` |
| RestTimer label | `"Repos"` |
| RestTimer skip | `"Reprendre maintenant"` |
| RestTimer pause | `"Pause"` |
| RestTimer resume | `"Reprendre"` |
| History screen title | `"Historique"` |
| History empty title | `"Pas encore de séances"` |
| History empty sub | `"Tes séances terminées apparaissent ici"` |
| Error state message | `"Impossible de charger les données. Réessaie."` |
| Error state CTA | `"Réessayer"` |

### 14.3 Destructive Actions

| Action | Trigger | Confirmation |
|--------|---------|-------------|
| Supprimer programme | "•••" menu → Supprimer | `showAlert('Supprimer le programme', 'Cette action supprimera le programme et toutes ses séances.', [{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:...}])` |

No other destructive actions in Phase 36.

### 14.4 Share API (WorkoutSummary)

```tsx
import { Share } from 'react-native';

const handleShare = async () => {
  const lines = [
    `${session.name}`,
    `${durationMin} min · ${totalSets} séries · ${(totalVolume/1000).toFixed(1)}t`,
  ];
  if (prs.length > 0) {
    lines.push(`Record${prs.length > 1 ? 's' : ''} : ${prs.map(p => p.name).join(', ')}`);
  }
  await Share.share({ message: lines.join('\n') });
};
```

---

## Appendix — Component Usage Summary

| Component | From package | Used in screens |
|-----------|-------------|-----------------|
| `useThemeStore` | `@ziko/plugin-sdk` | All screens |
| `showAlert` | `@ziko/plugin-sdk` | index.tsx, summary.tsx, ExercisePicker |
| `MotiView` | `moti` | AIGenerator loading, RestTimer entrance, list stagger |
| `LinearGradient` | `expo-linear-gradient` | Hero cards, progress bar fill, AIGenerator orb |
| `Ionicons` | `@expo/vector-icons` | All screens |
| `Share` | `react-native` (built-in) | WorkoutSummary |
| `react-native-svg` | existing dep | WorkoutSummary HR sparkline, RestTimer SVG ring |
| `router` | `expo-router` | All navigation |
| `useQuery` | `@tanstack/react-query` | ExerciseDetail, HistoryDetail, ExercisePicker |
| `SafeAreaView` | `react-native-safe-area-context` | index.tsx, history.tsx |

No new package installations required. All dependencies are already in the codebase.

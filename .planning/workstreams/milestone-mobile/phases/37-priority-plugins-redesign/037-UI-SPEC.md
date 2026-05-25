---
phase: 37
phase_name: Priority Plugins Redesign
status: draft
created: 2026-05-25
figma_file_url: null
platform: react-native
framework: expo-sdk-54
---

# UI-SPEC — Phase 37: Priority Plugins Redesign

**Visual source of truth:** `C:/Users/Anatholy/Downloads/ziko/plugins.jsx`
**Design system:** Phase 32 tokens — locked, do not change.
**Styling:** NativeWind v4 className strings. No StyleSheet, no inline style objects except dynamic computed values (e.g. SVG coordinates, fill widths derived from ratios).

---

## 0. Global Conventions

### Locked Design Tokens

| Token | Value | Usage |
|---|---|---|
| `background` | `#F7F6F3` | Screen background, ScrollView bg |
| `surface` | `#FFFFFF` | Card background |
| `border` | `#E2E0DA` | Card borders, dividers |
| `primary` | `#FF5C1A` | Nutrition, Habits, Coach IA accent; primary CTAs |
| `text` | `#1C1A17` | All body text, headings |
| `muted` | `#6B6963` | Secondary text, subtitles, icons at rest |
| info (blue) | `#2E7BF6` | Hydration, Community, AI Programs accent |
| success (green) | `#2E9E5B` | Completion chips, streaks, positive states |
| warn (amber) | `#F59E0B` | Lipides macro bar, warnings |
| violet | `#7B5BD0` | Habit color variant, Zoé persona |
| shadow | `opacity: 0.08, radius: 12, elevation: 3` | All card shadows |

### Card Pattern

Every card in the redesign follows this exact shadow + surface pattern:

```
backgroundColor: theme.surface (#FFFFFF)
borderRadius: 16
borderWidth: 1
borderColor: theme.border (#E2E0DA)
shadowColor: '#1C1A17'
shadowOffset: { width: 0, height: 4 }
shadowOpacity: 0.08
shadowRadius: 12
elevation: 3
```

### Screen Layout Pattern

Every plugin screen:
- `PluginHeader` (height 54px) — back chevron + title + optional right element
- `SubTabs` — pill-style segmented bar (see component spec below)
- `ScrollView` — `contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 100 }}`
- Gap between cards: 12px

### SubTabs Actual Rendering (Phase 37 Update)

The existing `SubTabs.tsx` uses an underline indicator style. Phase 37 uses the **pill container style** from the mockup. The component needs to be updated to match:

```
Container: flexDirection row, gap 4, padding 4, backgroundColor rgba(28,26,23,0.05),
borderRadius 12, marginBottom 14
Each tab button: flex 1, paddingVertical 8, paddingHorizontal 10, borderRadius 9,
fontSize 12, fontWeight 700
Active: backgroundColor surface (#FFF), shadowOpacity 0.08, shadowRadius 3, elevation 1
Inactive: backgroundColor transparent, color muted
```

**Note to executor:** Update `packages/ui/src/components/SubTabs.tsx` props to accept `tabs: string[]` (matching current interface). The pill style is a visual update to the component body — no API change.

### PluginHeader Rendering

Current `PluginHeader.tsx` is correct. Verify:
- Back button: 34×34px, borderRadius 11, `rgba(28,26,23,0.06)` bg, `chevron-back` Ionicons
- Title: fontSize 20, fontWeight 800, letterSpacing -0.4
- Right slot: optional `React.ReactNode`

### AISuggestion Rendering

Current `AISuggestion.tsx` is correct. Props:
- `text: string` — tip body
- `actionLabel?: string` — CTA label (renders only if provided)
- `onAction?: () => void` — CTA press handler
- `tintColor?: string` — defaults to `theme.primary (#FF5C1A)`

The card has `borderLeftWidth: 3` tint strip. Sparkles icon top-left. "Coach IA · suggestion" label above tip text (10px, 700, uppercase, letterSpacing 0.06em — add this label to the component if not already present, matching the mockup's visual hierarchy).

---

## 1. Nutrition Plugin

**File:** `plugins/nutrition/src/screens/NutritionPlugin.tsx` (new — replaces NutritionDashboard.tsx)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/nutrition/index.tsx`
**Accent color:** `#FF5C1A` (primary)
**Tabs:** Aujourd'hui / Ajouter / Historique / Réglages

### 1.1 Header

```
<PluginHeader
  title="Nutrition"
  onBack={navigation.goBack}
  right={
    activeTab === 'today' && (
      <TouchableOpacity onPress={() => setActiveTab('add')}
        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
                 backgroundColor: '#FF5C1A' }}>
        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 700 }}>+ Ajouter</Text>
      </TouchableOpacity>
    )
  }
/>
```

The "+ Ajouter" pill CTA is only shown when `activeTab === 'today'`. It switches to the Ajouter tab.

### 1.2 SubTabs

```
tabs={['Aujourd\'hui', 'Ajouter', 'Historique', 'Réglages']}
active={activeTab}
onChange={setActiveTab}
```

### 1.3 Tab: Aujourd'hui

**Data source:** TanStack Query hook → `nutrition_logs` WHERE user_id + date = today. Aggregated: sum of calories, protein_g, carbs_g, fat_g per meal_type.

**Layout (top to bottom):**

#### Calorie Ring Card

```
Card (surface, shadow, borderRadius 16, padding 16)
  Row (alignItems center, gap 14):
    SVG Calorie Ring (92×92px, flex 0)
    Stat column (flex 1)
```

**SVG Calorie Ring spec:**
```
viewBox: 0 0 92 92
Outer circle: cx=46 cy=46 r=38 stroke=rgba(28,26,23,0.07) strokeWidth=8 fill=none
Progress arc: cx=46 cy=46 r=38 stroke=#FF5C1A strokeWidth=8 fill=none
  strokeDasharray: [(consumed/target)*2π*38, 1000]
  strokeLinecap: round
  transform: rotate(-90deg) on the SVG element
Center overlay (absolute, inset 0, centered):
  calories consumed: fontSize 20, fontWeight 800, #1C1A17
  "/ {target}": fontSize 9, color muted, marginTop 2
```

**Stat column (right of ring):**
```
Label: "CALORIES" — fontSize 11, fontWeight 700, color muted, letterSpacing 0.06em, uppercase
Remaining value: "{remaining} kcal restantes"
  — "{remaining}": className h-display fontSize 22
  — "kcal restantes": fontSize 11, color muted, fontWeight 600
Subtitle: e.g. "T'as bien tenu ta journée. Encore un repas pour boucler la cible."
  — fontSize 11.5, color muted, lineHeight 1.4 (marginTop 4)
```

**Macro bars (inside same card, below ring row):**
```
3-column grid (gridTemplateColumns repeat(3, 1fr), gap 8, marginTop 14):
  Each macro:
    Label: "PROTÉINES" / "GLUCIDES" / "LIPIDES"
      — fontSize 10, color muted, fontWeight 700, uppercase, letterSpacing 0.05em
    Value: "{consumed}g/{target}g"
      — consumed: fontSize 13, fontWeight 800
      — "/{target}g": fontSize 10, color muted, fontWeight 500
    Progress bar: height 4, borderRadius 999, backgroundColor rgba(28,26,23,0.06)
      Fill: width={(consumed/target)*100}%, height 100%, borderRadius 999
      Protéines fill color: #FF5C1A
      Glucides fill color: #2E7BF6
      Lipides fill color: #F59E0B
```

#### AISuggestion Card

Rule: if `protein_g < 0.30 * protein_target_g` → show tip.

```
<AISuggestion
  text="Tu es à -{gap}g de protéines pour atteindre ton objectif. Ajoute du skyr ou un steak haché ce soir."
  actionLabel="Suggestions repas"
  onAction={() => setActiveTab('add')}
  tintColor="#FF5C1A"
/>
```

Always show (even without rule trigger) with generic text if protein OK: "Bonne journée nutritionnelle. Continue sur ta lancée pour atteindre ton objectif."

#### Repas du jour section

```
Section title row: "Repas du jour" (left) + "Historique →" link (right)
  — title: fontSize 11, fontWeight 700, color muted, uppercase, letterSpacing 0.06em
  — link: fontSize 11, fontWeight 700, color primary, onPress → setActiveTab('history')
```

**Meal cards** (one per meal_type from DB + placeholder for missing future meals):

```
Card (surface, shadow, borderRadius 14, padding 12):
  Row (alignItems center, gap 12):
    Icon circle (38×38px, borderRadius 11):
      Logged meal: backgroundColor rgba(255,92,26,0.12), Ionicons "restaurant-outline" 16px, color primary
      Placeholder: transparent bg, border 1px dashed border-color, Ionicons "add-outline" 16px, color primary
    Content column (flex 1):
      Title: "{mealType} · {time}" — fontSize 13, fontWeight 700
        mealType values: "Petit-déj", "Déjeuner", "Collation", "Dîner"
        time from nutrition_log.created_at formatted as "7h45"
      Items: comma-joined food names — fontSize 11, color muted, numberOfLines 1, ellipsis
    Calorie badge (right):
      Logged: "{kcal}" fontWeight 800 fontSize 13 + "kcal" fontSize 10 color muted
      Placeholder: Ionicons "add-outline" 16px color primary
```

Placeholder cards:
- `opacity: 0.65`
- `borderStyle: dashed`
- Text: "À planifier — il te reste {remaining} kcal"

Meal type display order: Petit-déj → Déjeuner → Collation → Dîner. Show at least 4 rows (fill remaining as placeholders).

**Interactions:**
- Tap logged meal → navigate to meal edit (existing LogMealScreen pattern)
- Tap placeholder card / `+` → `setActiveTab('add')`

### 1.4 Tab: Ajouter

Per decision D-02: this tab provides shortcuts + navigates to LogMealScreen for full flow.

**Layout:**

#### Search Input

```
Container: position relative
Input: paddingVertical 13, paddingLeft 40, paddingRight 14, borderRadius 14,
       borderWidth 1, borderColor border, backgroundColor surface,
       fontSize 13, shadow (card shadow)
placeholder: "Cherche un aliment ou plat…"
Search icon (absolute, left 12, verticalCenter):
  Ionicons "search-outline" 16px color muted
```

On submit: navigate to `LogMealScreen` with query pre-filled.

#### Quick-Add Shortcuts (3 columns)

```
3-column grid, gap 8:

Scanner card:
  Card (padding 14 8, placeItems center, gap 6):
    Icon circle (32×32px, borderRadius 10, bg rgba(255,92,26,0.14)):
      Ionicons "barcode-outline" 15px color primary
    Label: "Scanner" — fontSize 11, fontWeight 700

Photo IA card:
  Icon circle: bg rgba(46,123,246,0.14)
    Ionicons "camera-outline" 15px color #2E7BF6
  Label: "Photo IA" — fontSize 11, fontWeight 700

Repas vite card:
  Icon circle: bg rgba(245,158,11,0.14)
    Ionicons "flash-outline" 15px color #F59E0B
  Label: "Repas vite" — fontSize 11, fontWeight 700
```

**Interactions:**
- Scanner → navigate to LogMealScreen with scanner mode
- Photo IA → navigate to LogMealScreen with photo mode (or show coming-soon showAlert)
- Repas vite → navigate to LogMealScreen with recent items pre-filtered

#### AISuggestion (tintColor = #2E7BF6)

```
<AISuggestion
  text="Photo ton assiette → l'IA détecte les aliments et estime les macros. Précision ~92%."
  actionLabel="Essayer"
  onAction={navigateToPhotoMode}
  tintColor="#2E7BF6"
/>
```

#### Récents list

```
Section title: "Récents"
Each food item card (padding 10 12, row, gap 10):
  Content column (flex 1):
    Name: fontSize 12.5, fontWeight 700 — e.g. "Skyr nature 0%"
    Sub: fontSize 10.5, color muted — "{brand} · {qty} · P{p} G{c} L{f}"
  Calories: fontWeight 800 fontSize 13 + "kcal" fontSize 9 color muted
  Add button: 28×28px, borderRadius 9, bg rgba(255,92,26,0.14), Ionicons "add-outline" 14px color primary
```

Data source: `nutrition_logs` ordered by created_at DESC, deduplicated by food_name, limit 5.

**CTA:** Each add button calls a quick-log mutation (same as LogMealScreen's save action) with the last known quantity.

### 1.5 Tab: Historique

**Data source:** `nutrition_logs` grouped by date, last 7 days. Aggregate calories per day.

**Layout:**

#### 7-Day Overview Card

```
Card (padding 16):
  Row (justifyContent space-between, alignItems flex-start):
    Left:
      Label: "7 DERNIERS JOURS" — fontSize 10.5, color muted, fontWeight 700, uppercase
      Value: "{avg} kcal/j moyen" — avg: fontSize 22, fontWeight 800; "kcal/j moyen": fontSize 11, color muted
    Right: Chip "cible {target}" — success color (#2E9E5B) bg, green text
  Bar chart (height 110, marginTop 16):
    7 columns, flex layout, alignItems flex-end, gap 8
    Each bar:
      Width: flex 1
      Height: (value/maxValue)*100% where maxValue = 2800 or 1.2*target
      Today bar: backgroundColor primary (#FF5C1A)
      Past bars: backgroundColor rgba(255,92,26,0.22)
      Above-target indicator: dashed top border on bar if value > target
    Day label below each bar: fontSize 10, fontWeight 700
      Today: color primary
      Others: color muted
```

#### AISuggestion

Rule: detect if certain days consistently exceed or fall short of target.

```
<AISuggestion
  text="Tu dépasses la cible le mardi et vendredi (sorties ?). Le weekend tu manges trop peu : risque de fatigue lundi."
  actionLabel="Plan adaptatif"
  onAction={() => {/* future */}}
  tintColor="#FF5C1A"
/>
```

#### Macros moyens 7j Card

```
Card (padding 16):
  Title: "Macros moyens (7j)" — fontSize 13, fontWeight 700, marginBottom 10
  4 macro rows (Protéines, Glucides, Lipides, Fibres):
    Row (justifyContent space-between, marginBottom 10):
      Label: fontSize 11.5, fontWeight 600
      Value+pct: "{Xg} · {pct}% obj."
        — Xg: fontWeight 700 fontSize 11.5
        — "· {pct}% obj.": color muted fontWeight 500
    Progress bar: height 5, borderRadius 999
      Fill colors: Protéines=#FF5C1A, Glucides=#2E7BF6, Lipides=#F59E0B, Fibres=#2E9E5B
```

### 1.6 Tab: Réglages

**Data source:** `user_profiles` for goals; mutations save back to `user_profiles`.

**Layout:**

#### Objectif calorique Card

```
Card (padding 16):
  Label: "OBJECTIF CALORIQUE" — fontSize 11, fontWeight 700, color muted, uppercase
  Value row: "{calorieGoal}" (fontSize 28, fontWeight 800) + "kcal / jour" (fontSize 12, color muted)
  Slider: min=1200, max=4000, step=50, value=calorieGoal
    accentColor: primary (#FF5C1A)
    React Native: use @react-native-community/slider or equivalent
  Scale labels row (justifyContent space-between, fontSize 10, color muted):
    "1200" | "Déficit léger" | "Surplus" | "4000"
```

#### AISuggestion

```
<AISuggestion
  text="Selon ton poids ({weight}kg) et ton activité ({sessions} séances/sem), je recommande {recommended} kcal pour maintenir ta masse."
  actionLabel="Recalculer"
  onAction={recalcTDEE}
  tintColor="#FF5C1A"
/>
```

Recalculate button navigates to `TDEECalculatorScreen`.

#### Settings List Card

```
Card (overflow hidden, borderRadius 16):
  List rows (borderTop between rows, padding 12 14, row, gap 12):
    Each row: Ionicons icon (16px, color muted) | label+sub column | chevron-forward icon
    Rows:
      1. Répartition macros | "40 / 40 / 20" | chevron → macro ratio screen
      2. Fenêtre de repas | "7h00 → 21h00" | chevron → time window picker
      3. Régime alimentaire | "Standard" | chevron → diet type picker
      4. Allergies & exclusions | "Aucune" | chevron → exclusions screen
      5. Synchroniser MyFitnessPal | "Désactivé" | chevron → integration toggle
    Row icons: "nutrition-outline", "time-outline", "leaf-outline", "close-circle-outline", "watch-outline"
```

### 1.7 States

**Loading skeleton (Aujourd'hui):**
```
Calorie ring card: gray shimmer circle (92×92) + 3 shimmer bar rows
AISuggestion: shimmer rect (height 64)
3 meal card skeletons: shimmer (height 56)
```

**Empty state (no logs today):**
```
Calorie ring: ring at 0% fill, "0 / {target} kcal"
Meals section: single placeholder card for Petit-déj with "Commence ta journée — ajoute ton premier repas" text
No AISuggestion shown (replace with generic: "Commence par logger ton petit-déj pour activer le suivi.")
```

**Error state:**
```
Card with Ionicons "warning-outline" 32px color muted, centered
Text: "Impossible de charger tes données nutritionnelles."
Retry button: "Réessayer" — primary color
```

---

## 2. Hydration Plugin

**File:** `plugins/hydration/src/screens/HydrationPlugin.tsx` (new — replaces HydrationDashboard.tsx)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/hydration/index.tsx`
**Accent color:** `#2E7BF6` (info/blue)
**Tabs:** Aujourd'hui / Historique / Réglages

### 2.1 Header

```
<PluginHeader title="Hydratation" onBack={navigation.goBack} />
```

No right element.

### 2.2 SubTabs

```
tabs={['Aujourd\'hui', 'Historique', 'Réglages']}
```

### 2.3 Tab: Aujourd'hui

**Data source:** `hydration_logs` WHERE user_id + date = today → sum amount_ml.

**Layout:**

#### Bottle + Stats Card

```
Card (padding 16, row, gap 18, alignItems center):
  SVG Bottle (80×140px, flex 0)
  Stat column (flex 1)
```

**SVG Bottle Fill Specification:**

```
viewBox: "0 0 80 140"  width=80 height=140

Bottle outline path:
  d="M28 8h24v14l8 14v100a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V36l8-14V8z"
  fill=none stroke=#2E7BF6 strokeWidth=2

ClipPath id="bottle-clip":
  Same path as outline

Fill rect (level indicator):
  x=0 y={140 - (fillRatio * 120)} width=80 height={fillRatio * 120}
  fill=#2E7BF6 opacity=0.25
  clipPath="url(#bottle-clip)"

Surface line (water surface):
  x=0 y={140 - (fillRatio * 120)} width=80 height=3
  fill=#2E7BF6 opacity=0.85
  clipPath="url(#bottle-clip)"

where fillRatio = Math.min(1, today_ml / goal_ml)
```

Center overlay on bottle (absolute, centered):
```
consumed: "{(today_ml/1000).toFixed(1)}L" — fontSize 22, fontWeight 800, color #2E7BF6
target: "/ {(goal_ml/1000).toFixed(1)}L" — fontSize 9, color muted
```

**Stat column:**
```
Label: "HYDRATATION" — fontSize 11, fontWeight 700, color #2E7BF6, uppercase, letterSpacing 0.06em
Remaining: "Encore {remaining}L" — fontSize 19, fontWeight 800 (h-display style)
Subtitle: e.g. "Allez, c'est presque plié. {streak} jours d'affilée à objectif 💪"
  — fontSize 11.5, color muted, lineHeight 1.4, marginTop 4
Streak chip: marginTop 10
  bg: rgba(46,123,246,0.10)
  color: #2E7BF6
  content: Ionicons "flame-outline" 11px + "Streak {streak}j"
```

Streak is computed as consecutive days where sum(amount_ml) >= goal_ml.

#### AISuggestion (tintColor = #2E7BF6)

Rule: if most logs are after 14h00 → show distribution tip.

```
<AISuggestion
  text="Tu bois surtout en fin de journée. Mets une bouteille à ton bureau et bois 250ml toutes les heures."
  actionLabel="Activer rappels"
  onAction={openSettings}
  tintColor="#2E7BF6"
/>
```

#### Logger rapide

```
Section title: "Logger rapide"
4-column grid, gap 8:
  +250ml card: Ionicons "water-outline" 14px, color #2E7BF6
  +500ml card: Ionicons "water-outline" 18px, color #2E7BF6
  +750ml card: Ionicons "water-outline" 22px, color #2E7BF6
  Custom card: Ionicons "add-circle-outline" 18px, color #2E7BF6

Each card: Card style (padding 14 6, placeItems center, gap 4)
Label: fontSize 11, fontWeight 700
```

Interactions:
- +250ml, +500ml, +750ml: call `hydration_log` mutation immediately, show confirmation flash (card bg briefly flashes blue-tint for 300ms)
- Custom: open a BottomSheet with a numeric input (ml) + "Logger" confirm button

#### Aujourd'hui log list

```
Section title: "Aujourd'hui"
Each log entry (from hydration_logs ordered by created_at ASC):
  Card (padding 10 12, row, gap 10):
    Icon circle (32×32px, borderRadius 10, bg rgba(46,123,246,0.12)):
      Ionicons "water-outline" 14px color #2E7BF6
    Content:
      "{amount_ml}ml · {label}" — fontSize 12.5, fontWeight 700
      "{time}" — fontSize 10.5, color muted
```

Label for each entry: derive from time of day (Réveil / Café + eau / Bouteille bureau / Déjeuner / Entraînement / Soir) or leave as "Eau". Time formatted as "7h00".

### 2.4 Tab: Historique

**Data source:** `hydration_logs` grouped by date, last 7 days → sum(amount_ml) per day.

**Layout:**

#### 7-Day Bar Chart Card

```
Card (padding 16):
  Title: "7 derniers jours" — fontSize 13, fontWeight 700, marginBottom 12
  Bar chart (height 110, row, alignItems flex-end, gap 8):
    7 bars (max y-scale = 3L = 3000ml):
      Today bar: bg #2E7BF6
      Reached (>= goal) past bars: bg rgba(46,123,246,0.35)
      Below-goal past bars: bg rgba(46,123,246,0.18)
      minHeight: 6
    Day labels: ["L","M","M","J","V","S","D"] fontSize 9.5, fontWeight 700
      Today: color #2E7BF6; Others: color muted
```

#### Stats 2-Up Row

```
2 cards, side by side (1fr 1fr, gap 8):
  Card 1: "MOYENNE 7J" label + "{avg}L/j" value (color #2E7BF6, fontSize 22)
  Card 2: "STREAK RECORD" label + "{record}j" value (fontSize 22)
Each card: padding 12
```

#### AISuggestion (tintColor = #2E7BF6)

Rule: if workout days have higher intake than rest days:

```
<AISuggestion
  text="Tes journées de séance tu bois +30% : ton corps réclame plus. On adapte la cible les jours d'entraînement ?"
  actionLabel="Adapter"
  onAction={openSettings}
  tintColor="#2E7BF6"
/>
```

### 2.5 Tab: Réglages

**Data source:** `user_profiles` for `hydration_goal_ml`.

**Layout:**

#### Daily Goal Card

```
Card (padding 16):
  Label: "OBJECTIF QUOTIDIEN" — fontSize 11, fontWeight 700, color muted, uppercase
  Value: "{(goal/1000).toFixed(1)}L" — fontSize 28, fontWeight 800, color #2E7BF6, marginTop 6
  Sub: "recommandé selon ton poids et activité" — fontSize 11, color muted
  Note: goal is editable via a TouchableOpacity that opens a numeric input inline or sheet
```

#### Settings List Card

```
Rows (no top border on first):
  1. Rappels intelligents | "Toutes les 90 min, 8h-21h" | Ionicons "notifications-outline" | chevron
  2. Taille de verre par défaut | "250 ml" | Ionicons "water-outline" | chevron
  3. Compter le café/thé | "Oui (à 50%)" | Ionicons "cafe-outline" | toggle (STToggle pattern)
  4. Bonus jour de séance | "+500 ml" | Ionicons "barbell-outline" | chevron
```

### 2.6 States

**Loading:** Shimmer for bottle area (80×140 gray rect) + 4 shimmer button cards.

**Empty (no logs today):** Bottle at 0% fill. Log list shows: "Aucune entrée pour l'instant. Commence par ton verre du matin." Placeholder text centered below empty list.

**Goal reached:** Bottle is full (100%), stat column text changes to "Objectif atteint 🎉 Tu as bu {consumed}L aujourd'hui." Streak chip gains +1 animation.

---

## 3. Habits Plugin

**File:** `plugins/habits/src/screens/HabitsPlugin.tsx` (new — replaces HabitsDashboardScreen.tsx)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/habits/index.tsx`
**Accent color:** `#FF5C1A` (primary)
**Tabs:** Aujourd'hui / Historique / Nouvelle

### 3.1 Header

```
<PluginHeader title="Habits" onBack={navigation.goBack} />
```

### 3.2 SubTabs

```
tabs={['Aujourd\'hui', 'Historique', 'Nouvelle']}
```

### 3.3 Tab: Aujourd'hui

**Data source:** `habits` + `habit_logs` WHERE date = today.

**Layout:**

#### Summary Card

```
Card (padding 16):
  Row (justifyContent space-between, alignItems center):
    Left:
      Label: "AUJOURD'HUI" — fontSize 10.5, color muted, fontWeight 700, uppercase
      Count: "{done}/{total} habitudes" — done: fontSize 22, fontWeight 800; "/total habitudes": fontSize 12, color muted
    Right: dot grid row
      One dot per habit (18×18px, borderRadius 6):
        Done: backgroundColor = habit.color
        Not done: backgroundColor rgba(28,26,23,0.06)
      Gap: 4px
```

#### AISuggestion

Rule: if any habit has been missed > 3 out of last 7 days:

```
<AISuggestion
  text="Tu rates '{habitName}' {N} fois sur 7. On baisse la cible pour ce mois ?"
  actionLabel="Ajuster"
  onAction={() => openHabitEdit(habitId)}
  tintColor="#FF5C1A"
/>
```

Generic version if all habits consistent: "Continue comme ça ! Tu as une série de {streak} jours sur tes habitudes principales."

#### Habit List

Each habit row:
```
Card (padding 12, row, alignItems center, gap 12, cursor pointer):
  Completion button (36×36px, borderRadius 11, flex 0):
    Done state: backgroundColor = habit.color, Ionicons "checkmark" 18px color white, strokeWidth 3
    Undone state: backgroundColor transparent, outline 2px solid habit.color (use borderWidth+borderColor)
      Ionicons matching habit icon 16px color muted

  Content column (flex 1):
    Habit name: fontSize 13, fontWeight 700
      Done: textDecorationLine "line-through", textDecorationColor muted
      Undone: no decoration
    Frequency: "Tous les jours" / "Lun-Ven" — fontSize 11, color muted, marginTop 1

  Streak chip (if streak > 0):
    bg: color-mix(habit.color 14%, transparent) — approximate with rgba
    color: habit.color
    Ionicons "flame-outline" 11px + "{streak}j"
    padding: 3 8, fontSize 11
```

**Habit icon mapping:**
```
leaf → "leaf-outline"
smile → "happy-outline"
moon → "moon-outline"
x → "close-outline"
stretch → "body-outline"
shoe → "footsteps-outline"
barbell → "barbell-outline"
```

**Habit color values:**
```
success: #2E9E5B
violet: #7B5BD0
warn: #F59E0B
primary: #FF5C1A
info: #2E7BF6
```

**Interaction:** Pressing the completion button toggles `habit_logs` entry for today. Optimistic update — button flips immediately, mutation saves in background. On error → revert + showAlert error.

### 3.4 Tab: Historique

**Data source:** `habit_logs` last 30 days, all habits. Compute completion rate per day.

**Layout:**

#### Month Overview Card

```
Card (padding 16):
  Row (justifyContent space-between, alignItems flex-end):
    Left:
      Completion rate: "{rate}%" — fontSize 32, fontWeight 800, color primary
      Sub: "de tes habitudes ce mois" — fontSize 11, color muted
    Right: chip "+{delta}% vs dernier mois" — success chip
  30-day heatmap grid (marginTop 16):
    10 columns × 3 rows (gridTemplateColumns repeat(10, 1fr), gap 4)
    Each cell (aspectRatio 1, borderRadius 6):
      Done day: backgroundColor primary, opacity between 0.5–1.0 proportional to completion rate
      Missed day: backgroundColor rgba(28,26,23,0.05), opacity 1
```

#### Top Streaks section

```
Section title: "Top streaks"
Each habit with streak > 0, sorted by streak DESC:
  Card (padding 12, row, gap 12):
    Icon circle (34×34px, borderRadius 10):
      bg: rgba(habit.color, 0.14) — approximate
      Ionicons icon 15px color habit.color
    Name: fontSize 13, fontWeight 700, flex 1
    Streak: "{streak}j" — h-display style, fontSize 16, color habit.color
      sub "j": fontSize 10, color muted, fontWeight 500
```

### 3.5 Tab: Nouvelle

**Layout:**

#### AISuggestion

```
<AISuggestion
  text="Vu que tu vises 'force' et que tu manques de sommeil, je suggère 'Coucher avant 23h' comme prochaine habitude."
  actionLabel="Créer"
  onAction={() => openHabitForm({ name: 'Coucher avant 23h' })}
  tintColor="#FF5C1A"
/>
```

Rule: analyze user goal from `user_profiles.goal` + last sleep log duration. If sleep < 7h + goal is "force" → suggest sleep habit. Otherwise suggest generic workout consistency habit.

#### Templates grid (2 columns)

```
2-column grid, gap 8:
6 template cards:
  Card (padding 14, row, gap 10):
    Icon circle (36×36px, borderRadius 11, bg rgba(color, 0.14)):
      Ionicons icon 16px color habit.color
    Content:
      Name: fontSize 13, fontWeight 700
      "+ Ajouter": fontSize 10.5, color muted, marginTop 1

Templates:
  "Méditer" — "leaf-outline" — #2E9E5B
  "Lire" — "happy-outline" — #7B5BD0
  "Marcher 10k pas" — "footsteps-outline" — #2E7BF6
  "Pas d'alcool" — "close-outline" — #F59E0B
  "Vitamines" — "medical-outline" — #2E9E5B
  "Étirements" — "body-outline" — #FF5C1A
```

Interaction: tap template → open habit creation form pre-filled with name + icon + color. Form should allow editing name, frequency (daily / weekdays / custom days), and confirm creation.

#### Primary CTA

```
Button (padding 14, width 100%, backgroundColor primary, borderRadius 14, marginTop 4):
  Ionicons "add-outline" 16px color white + "Créer une habitude perso"
  fontSize 14, fontWeight 700, color white
```

onPress: open full habit creation form (blank).

### 3.6 States

**Loading:** 3 habit card skeletons + summary card shimmer.

**Empty (no habits):** Centered empty state: "Aucune habitude pour l'instant. Crée ta première habitude." Primary CTA "Créer" navigates to Nouvelle tab.

---

## 4. AI Programs Plugin

**File:** `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx` (new — replaces AIProgramsDashboard.tsx)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/ai-programs/index.tsx`
**Accent color:** `#2E7BF6` (info/blue)
**Tabs:** Programme / Générer / Bibliothèque

### 4.1 Header

```
<PluginHeader title="Programmes IA" onBack={navigation.goBack} />
```

### 4.2 SubTabs

```
tabs={['Programme', 'Générer', 'Bibliothèque']}
```

Note: mockup uses "Découvrir" / "Générer" / "Mes plans" — per D-10/D-11/D-12, Phase 37 uses "Programme" / "Générer" / "Bibliothèque" labels as specified in PLUG-AI-01.

### 4.3 Tab: Programme

**Data source:** `ai_generated_programs` WHERE user_id AND is_active = true, single row.

**Layout (active program present):**

#### Active Program Hero Card (dark)

```
Card:
  backgroundColor: #1C1A17 (theme.text used as dark surface)
  borderWidth: 0
  padding: 16
  borderRadius: 16
  overflow: hidden
  position: relative

Glow decoration (absolute, top: -30, right: -30):
  Circle 140×140px, borderRadius 70
  backgroundColor: rgba(46,123,246,0.30)
  filter: blur(40px) — use React Native blur or just opacity approximation

Chip (marginBottom 10, relative z:1):
  bg: rgba(46,123,246,0.25), color: #9DC4FF
  Ionicons "sparkles" 11px + "Programme actif"

Program name: fontSize 22, fontWeight 800, color #FFFAF6 (white-warm)
  — h-display style
Progress sub: "Semaine {week}/{totalWeeks} · {sessionsCompleted}/{totalSessions} séances"
  — fontSize 12, color rgba(255,250,246,0.6), marginTop 2

Progress bar (marginTop 14):
  height 6, bg rgba(255,250,246,0.12), borderRadius 999, overflow hidden
  Fill: width = "{progress}%", height 100%,
        gradient: left #FF5C1A → right #FFB07A (LinearGradient or solid primary)
        borderRadius 999

Action row (marginTop 14, gap 8):
  "Prochaine séance" CTA:
    flex 1, padding 10 14, fontSize 12, fontWeight 700
    bg primary (#FF5C1A), color white, borderRadius 12
    Ionicons "play-outline" 13px color white
    onPress: navigate to workout/session.tsx
  "Détails" button:
    padding 10 14, fontSize 12
    bg rgba(255,250,246,0.10), color #FFFAF6, borderRadius 12
```

#### AISuggestion (below hero)

Rule: if sessions completed this week > last week → positive reinforcement. If recovery score low → suggest lighter session.

```
<AISuggestion
  text="Tu as bien récupéré cette semaine. Augmente la charge de 2.5 kg sur tes exercices principaux."
  actionLabel="Voir détails"
  onAction={() => {/* show program detail */}}
  tintColor="#2E7BF6"
/>
```

**Layout (no active program — empty state):**

```
Centered in tab area:
  Ionicons "barbell-outline" 48px color muted
  Title: "Aucun programme actif" — fontSize 18, fontWeight 800, marginTop 12
  Sub: "Génère un programme IA personnalisé pour commencer ta progression."
       — fontSize 12, color muted, textAlign center, marginTop 6
  CTA: "Générer un programme" — primary button, onPress: setActiveTab('generate')
```

### 4.4 Tab: Générer

Per decision D-10: this tab is a **launch card + CTA** that navigates to the existing `ai-generate.tsx`. No wizard duplication.

**Layout:**

#### Last Program Metadata Card (if history exists)

```
Card (padding 16):
  Chip (marginBottom 8, bg rgba(46,123,246,0.08), color #2E7BF6):
    Ionicons "sparkles" 11px + "Génération IA"
  Title: "Crée ton programme sur mesure" — fontSize 17, fontWeight 800
  Sub: "L'IA construit un plan adapté à ton matériel, tes objectifs et ton emploi du temps."
    — fontSize 12, color muted, marginTop 4, lineHeight 1.45
  CTA button (marginTop 12, width 100%, padding 12):
    bg primary, borderRadius 12
    Ionicons "sparkles-outline" 14px color white + "Générer un programme"
    onPress: navigation.navigate('workout/ai-generate')
```

#### AISuggestion

```
<AISuggestion
  text="Avec {sessions} séances/sem et objectif {goal}, je recommande un {recommendation} sur {weeks} semaines avec progression 5%/sem."
  actionLabel="Voir aperçu"
  onAction={() => {/* preview */}}
  tintColor="#2E7BF6"
/>
```

Rule: derive from `user_profiles.goal` + `user_profiles.workout_days_per_week`. Recommendation logic:
- hypertrophie + 4j → "Push/Pull/Legs sur 8 semaines"
- force + 3-4j → "5×5 sur 12 semaines"
- cardio + any → "Endurance progressive sur 6 semaines"

### 4.5 Tab: Bibliothèque

**Data source:** `ai_generated_programs` WHERE user_id, all rows ordered by created_at DESC.

**Layout:**

#### AISuggestion

```
<AISuggestion
  text="Tu as terminé {N} programmes cette année. Continue sur la lancée — un nouveau cycle 'force pure' serait pertinent."
  actionLabel="Générer"
  onAction={() => setActiveTab('generate')}
/>
```

#### Program List

Each program card:
```
Card (padding 14):
  Program name: h-display fontSize 15
  Sub row: "{status} · {progress}% · {weeks} sem"
    status: "En cours" (color primary) or "Terminé" (color success)
    — fontSize 11, color muted, marginTop 2
  Progress bar (marginTop 9, height 5):
    Active: fill color primary
    Completed: fill color success (#2E9E5B)
    Width: "{progress}%"
  "Réactiver" button (if not active, below bar, marginTop 8):
    ghost style: border 1px border-color, bg surface
    fontSize 12, padding 8 12
    onPress: mutation → SET is_active=true WHERE id=this.id, SET is_active=false WHERE id!=this.id AND user_id=user_id
```

**Interaction detail for Réactiver (D-11):**
```
mutation:
  await supabase.from('ai_generated_programs')
    .update({ is_active: false })
    .eq('user_id', userId)
  await supabase.from('ai_generated_programs')
    .update({ is_active: true })
    .eq('id', programId)
optimistic: update local cache immediately
on success: switch to 'programme' tab
```

### 4.6 States

**Loading Programme tab:** Shimmer dark card (height 200) + shimmer AISuggestion.

**Loading Bibliothèque:** 3 shimmer program cards.

**Error:** "Impossible de charger tes programmes." + Réessayer button.

---

## 5. Coach IA Plugin

**File:** `plugins/persona/src/screens/CoachIAPlugin.tsx` (new — replaces PersonaCustomizeScreen.tsx)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/persona/index.tsx`
**Accent color:** `#FF5C1A` (primary) — varies per persona
**Tabs:** Discussion / Personas / Réglages

Note: mockup uses 3 tabs (Discussion / Personas / Réglages). REQUIREMENTS PLUG-CIA-01 says 2 tabs (Chat / Persona). Decision D-07 confirms Chat tab. Phase 37 implements **3 tabs** matching the mockup: Discussion / Personas / Réglages. The REQUIREMENTS item PLUG-CIA-04 ("settings rows below persona cards") maps to the Réglages tab.

### 5.1 Header

```
<PluginHeader
  title="Coach IA"
  onBack={navigation.goBack}
  right={
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10,
                   paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,92,26,0.10)' }}>
      <Ionicons name="flash-outline" size={12} color="#FF5C1A" />
      <Text style={{ fontSize: 12, fontWeight: 700, color: '#FF5C1A' }}>{credits}</Text>
    </View>
  }
/>
```

Credit count sourced from user balance (existing credit system from Phase 28+).

### 5.2 SubTabs

```
tabs={['Discussion', 'Personas', 'Réglages']}
```

### 5.3 Tab: Discussion

Per D-07: shows `ai_conversations` list. Tapping opens `AIChatDetailScreen`.

**Layout:**

#### Active Persona Banner Card

```
Card (padding 14, row, gap 12, alignItems center):
  Persona avatar circle (42×42px, borderRadius 21):
    LinearGradient: from persona.color to lighter variant
    Emoji centered (fontSize 22)
  Content (flex 1):
    Name + style: h-display fontSize 14 + " · {style}" color muted fontSize 11
    Status: "● En ligne · répond en moins de 2s"
      — fontSize 11, color #2E9E5B, marginTop 2
  Settings button (32×32px, borderRadius 10, border 1px border-color):
    Ionicons "settings-outline" 14px color muted
    onPress: setActiveTab('reglages')
```

Persona data sourced from `user_profiles.settings.ai_persona`. Fallback to "Max" if not set.

#### Conversation List

Data: `ai_conversations` WHERE user_id, ordered by updated_at DESC, limit 20.

```
Section title: "Conversations"
Each conversation row:
  Card (padding 12 14, row, gap 12):
    Persona avatar circle (36×36px) — small version
    Content (flex 1):
      Title: conversation.title or "Nouvelle conversation" — fontSize 13, fontWeight 700
      Preview: last message preview — fontSize 11.5, color muted, numberOfLines 1
      Time: ago label — fontSize 10.5, color muted
    Unread dot (if last message role='assistant' and not yet read):
      8×8px circle, bg primary, borderRadius 4
```

**New conversation CTA:**

```
Button (below list, marginTop 8, padding 14, width 100%, bg primary, borderRadius 14):
  Ionicons "chatbubble-outline" 16px color white + "Nouvelle conversation"
  onPress: create new ai_conversation → navigate to AIChatDetailScreen with new conversationId
```

#### Quick Prompts row

```
Horizontal ScrollView (showsHorizontalScrollIndicator false, gap 6):
  Prompt chips (each: chip ghost style, paddingHorizontal 12, paddingVertical 8):
    "Plan ma séance"
    "Ai-je récupéré ?"
    "Mes macros du soir ?"
    "Motivation 💪"
  onPress: create/open conversation with pre-filled message
```

### 5.4 Tab: Personas

**Data source:** `user_profiles.settings.ai_persona` — active persona ID.

**Layout:**

Intro text:
```
"Choisis le coach qui te parle le mieux. Tu peux changer à tout moment."
— fontSize 12, color muted, lineHeight 1.45, marginBottom 12
```

#### Persona Cards (4 cards, vertical list)

```
Each persona card (padding 14, row, alignItems center, gap 14):
  Selected state: borderWidth 1.5, borderColor = persona.color
  Unselected state: standard card border (border-color)

  Avatar circle (56×56px, borderRadius 28):
    LinearGradient from persona.color to lighter
    Emoji centered, fontSize 28

  Content (flex 1):
    Name row: h-display fontSize 16 + "Actif" chip (if selected)
      "Actif" chip: success chip style, padding 2 7, fontSize 9.5
    Style label: fontSize 11, color persona.color, fontWeight 700, marginTop 1
    Description: fontSize 11.5, color muted, lineHeight 1.4, marginTop 4

  Interaction: onPress → update user_profiles.settings.ai_persona = persona.id
               + mutation to save, optimistic update
```

**Persona definitions:**

| ID | Name | Style | Description | Color | Emoji |
|---|---|---|---|---|---|
| max | Max | Sergent motivant | Te pousse, sans pitié, dans l'effort. | #FF5C1A | 💪 |
| zoe | Zoé | Bienveillante | Encourage, rassure, valorise tes progrès. | #7B5BD0 | 🌿 |
| leo | Léo | Tactique pragmatique | Données, optimisation, performance. | #2E7BF6 | 📊 |
| rio | Rio | Cool & relax | Le pote qui dédramatise et rend ça fun. | #2E9E5B | 🏖️ |

### 5.5 Tab: Réglages

**Data source:** `user_profiles.settings` JSONB keys: `ai_language`, `ai_coaching_style`, `ai_response_length`.

**Layout:**

#### AISuggestion

```
<AISuggestion
  text="Active 'Notif quotidiennes du coach' pour recevoir un check-in matinal personnalisé."
  actionLabel="Activer"
  onAction={() => {/* toggle daily notif */}}
  tintColor="#FF5C1A"
/>
```

#### Settings List Card

```
Card (overflow hidden):
  Rows (STRow pattern — same as Settings screens):
    1. Notifications quotidiennes | "Tous les jours à 7h30" | Ionicons "notifications-outline" | chevron
       → sub-screen or inline toggle
    2. Ton du coach | "Tutoiement, motivant" | Ionicons "happy-outline" | chevron
       → picker: Tutoiement motivant / Vouvoiement formel / Amical détendu
    3. Fréquence des suggestions | "À chaque écran clé" | Ionicons "sparkles-outline" | chevron
       → picker: Toujours / Parfois / Rarement
    4. Données partagées | "Activité, sommeil, nutrition" | Ionicons "watch-outline" | chevron
       → multi-toggle (activity / sleep / nutrition / measurements)
    5. Effacer l'historique | "{N} conversations" | Ionicons "close-outline" | chevron
       → showAlert destructive confirm before delete
```

Settings saved via mutation: `supabase.from('user_profiles').update({ settings: { ...existing, ai_language, ai_coaching_style, ai_response_length } })`.

**Keys for settings JSONB:**
```
ai_language: 'fr' | 'en'
ai_coaching_style: 'direct' | 'encouraging' | 'technical'
ai_response_length: 'short' | 'medium' | 'detailed'
ai_persona: 'max' | 'zoe' | 'leo' | 'rio'
```

### 5.6 Backend Change (D-09)

`backend/api/src/context/user.ts` `fetchUserContext()` must be updated to inject persona into system prompt:

```ts
// Read from user_profiles.settings
const persona = profile.settings?.ai_persona ?? 'max'
const personaPrompts = {
  max: 'Tu t\'appelles Max, tu es un coach sport motivant et exigeant, style sergent d\'élite.',
  zoe: 'Tu t\'appelles Zoé, tu es une coach bienveillante qui encourage et valorise les progrès.',
  leo: 'Tu t\'appelles Léo, tu es un coach analytique qui optimise les performances avec les données.',
  rio: 'Tu t\'appelles Rio, tu es un coach détendu et fun qui rend le sport accessible et sympa.',
}
const personaInstruction = personaPrompts[persona as keyof typeof personaPrompts] ?? personaPrompts.max
// Inject into system prompt (before or after existing context)
```

### 5.7 States

**Loading Discussion tab:** Persona banner shimmer + 3 conversation row skeletons.

**Empty conversations:** "Aucune conversation pour l'instant. Lance une discussion avec ton coach !" CTA "Commencer".

---

## 6. Community Plugin

**File:** `plugins/community/src/screens/CommunityDashboard.tsx` (replace in-place — same filename per D-04)
**Route wrapper:** `apps/mobile/app/(app)/(plugins)/community/index.tsx`
**Accent color:** `#2E7BF6` (info/blue)
**Tabs:** Fil / Défis / Groupes

### 6.1 Header

```
<PluginHeader title="Communauté" onBack={navigation.goBack} />
```

### 6.2 SubTabs

```
tabs={['Fil', 'Défis', 'Groupes']}
```

### 6.3 Tab: Fil

**Data source:** `workout_sessions` JOIN `friendships` WHERE friendships.user_id = current_user OR friendships.friend_id = current_user. Get friend's sessions ordered by created_at DESC, limit 20.

Per D-05: each card represents a friend's completed workout session.

**Layout:**

#### AISuggestion (tintColor = #2E7BF6)

Rule: if any friend has a higher PR than current user on same exercise this week:

```
<AISuggestion
  text="{N} amis ont fait un PR cette semaine. {friendName} t'a dépassé au squat (+{delta}kg) — la revanche ?"
  actionLabel="Lancer un défi"
  onAction={() => navigation.navigate('challenges')}
  tintColor="#2E7BF6"
/>
```

Generic: "Tes amis restent actifs. Consulte le fil pour rester motivé !"

#### Activity Feed Cards

```
Each workout session card (padding 14):
  Header row (gap 10):
    Friend avatar circle (36×36px, borderRadius 18):
      Gradient from friend.color (generate from name hash) to lighter
      Initials: first char of display_name, fontSize 14, fontWeight 800, color white
    Content (flex 1):
      "{friendName} a terminé une séance {programName}" — fontSize 12.5
        — name: fontWeight 700
        — action: color muted
      Time: "{ago}" — fontSize 10.5, color muted, marginTop 1

  Session value card (marginTop 10, padding 10, borderRadius 11):
    bg: rgba(255,92,26,0.08) (primary tint)
    "{duration} min · {sessionName}" — fontSize 13, fontWeight 700, color primary

  Action row (marginTop 10, gap 14):
    Like button: Ionicons "heart-outline" 13px + "{likes}" — fontSize 11.5, color muted
    Comment button: Ionicons "chatbubble-outline" 13px + "{comments}" — fontSize 11.5, color muted
```

**Friend color generation:** hash of friend's display_name to pick from a set of 6 colors:
```
['#E94B3C', '#2E7BF6', '#7B5BD0', '#2E9E5B', '#F59E0B', '#FF5C1A']
```

**Interaction:** Tap card → navigate to workout session detail (read-only view of friend's session).

### 6.4 Tab: Défis

**Data source:** `challenges` table (migration 009). Query: active challenges (end_date > now()) + user's enrollment status from `challenge_participants`.

Per D-06 context: researcher must confirm challenges table schema. Expected columns: id, name, description, start_date, end_date, participant_count, challenge_type, target_value, target_unit.

**Layout:**

Each challenge card:
```
Card (padding 14):
  Row (justifyContent space-between, gap 10):
    Left (flex 1):
      Name: h-display fontSize 15
      Desc: fontSize 11.5, color muted, marginTop 2
    Right: "Inscrit" chip (success) if user is enrolled

  Stats row (marginTop 10, gap 10, fontSize 11, color muted):
    Ionicons "people-outline" 11px + "{participant_count}"
    Ionicons "timer-outline" 11px + "{daysLeft}j restants"
    Leader badge if relevant: "👑 {leader_name}"

  Progress bar (if enrolled, marginTop 8):
    height 4, borderRadius 999, bg rgba(28,26,23,0.06)
    Fill: user's progress / target × 100%, bg primary

  CTA button (marginTop 10, width 100%, padding 8 12, fontSize 12):
    Enrolled: bg rgba(28,26,23,0.06), color text → "Voir le classement"
    Not enrolled: bg primary, color white → "Rejoindre"
    onPress enrolled: navigate to ChallengeDetailScreen (existing, untouched per D-04)
    onPress not enrolled: mutation → insert into challenge_participants
```

**Empty state (no challenges):**
```
Centered: Ionicons "trophy-outline" 32px color muted
"Aucun défi actif pour l'instant."
Sub: "Reviens plus tard pour rejoindre des défis communautaires."
```

### 6.5 Tab: Groupes

Per D-06: real data if groups table exists, otherwise clean empty state.

**If groups table present:** Query user's groups + public groups from migration 009.

**Layout (groups present):**

#### AISuggestion (tintColor = #2E7BF6)

```
<AISuggestion
  text="Vu ton niveau et tes records, le groupe 'Powerlifting France' serait pertinent. {memberCount} membres, très actif."
  actionLabel="Rejoindre"
  onAction={() => {/* join group */}}
  tintColor="#2E7BF6"
/>
```

Each group card:
```
Card (padding 12, row, gap 12):
  Icon circle (40×40px, borderRadius 12, bg rgba(255,92,26,0.12)):
    Ionicons from group.category: barbell/people/body/nutrition → matching icon, 17px, color primary
  Content (flex 1):
    Name: fontSize 13, fontWeight 700
    Sub: "{memberCount} membres · {activity}" — fontSize 11, color muted, marginTop 1
  Ionicons "chevron-forward" 14px color muted
```

Interaction: tap → navigate to GroupsScreen (existing, untouched per D-04).

Ghost CTA at bottom:
```
Button (padding 12, width 100%, border 1px border-color, borderRadius 14, bg transparent, marginTop 4):
  Ionicons "add-outline" 14px + "Créer un groupe"
  color text, fontSize 13, fontWeight 600
```

**Empty state (no groups table or no groups):**
```
Centered card (padding 32 16, alignItems center):
  Ionicons "people-outline" 48px color muted, marginBottom 12
  Title: "Groupes bientôt disponibles" — fontSize 16, fontWeight 700
  Sub: "Les groupes sont en cours de développement. Reviens bientôt !" — fontSize 12, color muted, textAlign center, marginTop 6
```

### 6.6 States

**Loading Fil tab:** 3 activity card skeletons (shimmer).

**Empty Fil (no friends or no sessions):**
```
Centered:
  Ionicons "people-outline" 48px color muted
  "Ton fil est vide pour l'instant."
  Sub: "Ajoute des amis pour voir leur activité ici."
  CTA: "Trouver des amis" → navigate to FriendsScreen
```

**Error:** "Impossible de charger le fil d'activité." + Réessayer.

---

## 7. Navigation Flows

### Nutrition Plugin

| Action | Destination |
|---|---|
| "+ Ajouter" header button | setActiveTab('add') |
| "Historique →" link on Aujourd'hui | setActiveTab('history') |
| Tap meal log row | LogMealScreen (existing) |
| Tap placeholder meal row | setActiveTab('add') |
| Scanner shortcut | LogMealScreen with scanner param |
| Photo IA shortcut | LogMealScreen with photo param (or showAlert "Bientôt disponible") |
| Repas vite shortcut | LogMealScreen with recent param |
| Recalculer in Réglages | TDEECalculatorScreen (existing) |

### Hydration Plugin

| Action | Destination |
|---|---|
| +250/500/750ml buttons | hydration_log mutation (no navigation) |
| Custom button | Inline BottomSheet (not a screen) |
| "Activer rappels" AISuggestion | setActiveTab('reglages') |

### Habits Plugin

| Action | Destination |
|---|---|
| Completion button | habit_logs toggle mutation (no navigation) |
| Template card | Habit creation form (inline sheet or new screen) |
| "Créer une habitude perso" CTA | Habit creation form (full) |
| "Ajuster" AISuggestion | Habit edit screen / inline |

### AI Programs Plugin

| Action | Destination |
|---|---|
| "Prochaine séance" CTA | workout/session.tsx |
| "Détails" button | Program detail view (existing or inline expansion) |
| "Générer un programme" CTA | workout/ai-generate.tsx |
| "Réactiver" | mutation (no navigation, then switch to Programme tab) |

### Coach IA Plugin

| Action | Destination |
|---|---|
| Conversation row tap | AIChatDetailScreen (existing AIBridge SSE flow) |
| "Nouvelle conversation" CTA | AIChatDetailScreen (new conversationId) |
| Quick prompt chip | AIChatDetailScreen with pre-filled message |
| Settings gear in persona banner | setActiveTab('reglages') |
| Persona card tap | mutation save (no navigation) |
| "Effacer l'historique" | showAlert destructive confirm → delete all ai_conversations for user |

### Community Plugin

| Action | Destination |
|---|---|
| Activity card tap | Friend's workout detail (read-only) |
| "Lancer un défi" AISuggestion | ChallengesScreen (existing, untouched) |
| "Voir le classement" button | ChallengeDetailScreen (existing, untouched) |
| "Rejoindre" button | challenge_participants mutation (no navigation) |
| Group card tap | GroupsScreen (existing, untouched) |
| "Trouver des amis" CTA | FriendsScreen (existing, untouched) |

---

## 8. Copy / Strings (French)

### Nutrition

| Element | String |
|---|---|
| Header title | "Nutrition" |
| Tab 1 | "Aujourd'hui" |
| Tab 2 | "Ajouter" |
| Tab 3 | "Historique" |
| Tab 4 | "Réglages" |
| Calorie label | "CALORIES" |
| Remaining kcal | "{N} kcal restantes" |
| Macro label P | "PROTÉINES" |
| Macro label G | "GLUCIDES" |
| Macro label L | "LIPIDES" |
| Section title meals | "Repas du jour" |
| Historique link | "Historique" |
| Petit-déjeuner | "Petit-déj" |
| Lunch | "Déjeuner" |
| Snack | "Collation" |
| Dinner | "Dîner" |
| Placeholder meal | "À planifier — il te reste {N} kcal" |
| Search placeholder | "Cherche un aliment ou plat…" |
| Scanner shortcut | "Scanner" |
| Photo AI shortcut | "Photo IA" |
| Quick meal shortcut | "Repas vite" |
| Recents section | "Récents" |
| 7 day label | "7 DERNIERS JOURS" |
| Average | "{N} kcal/j moyen" |
| Macro 7d card | "Macros moyens (7j)" |
| Settings calorie goal | "OBJECTIF CALORIQUE" |
| Settings unit | "kcal / jour" |
| AI suggestion body (protein deficit) | "Tu es à -{N}g de protéines pour atteindre ton objectif. Ajoute du skyr ou un steak haché ce soir." |
| AI suggestion action (protein) | "Suggestions repas" |
| AI suggestion body (history) | "Tu dépasses la cible le mardi et vendredi (sorties ?). Le weekend tu manges trop peu : risque de fatigue lundi." |
| AI suggestion action (history) | "Plan adaptatif" |
| AI suggestion body (settings) | "Selon ton poids ({N}kg) et ton activité ({N} séances/sem), je recommande {N} kcal pour maintenir ta masse." |
| AI suggestion action (settings) | "Recalculer" |
| AI suggestion body (photo IA) | "Photo ton assiette → l'IA détecte les aliments et estime les macros. Précision ~92%." |
| AI suggestion action (photo IA) | "Essayer" |
| Empty state | "Commence ta journée — ajoute ton premier repas" |
| Error | "Impossible de charger tes données nutritionnelles." |
| Retry | "Réessayer" |

### Hydration

| Element | String |
|---|---|
| Header title | "Hydratation" |
| Tab 1 | "Aujourd'hui" |
| Tab 2 | "Historique" |
| Tab 3 | "Réglages" |
| Hydration label | "HYDRATATION" |
| Remaining | "Encore {N}L" |
| Streak chip | "Streak {N}j" |
| AI suggestion body | "Tu bois surtout en fin de journée. Mets une bouteille à ton bureau et bois 250ml toutes les heures." |
| AI suggestion action | "Activer rappels" |
| Quick log section | "Logger rapide" |
| Today section | "Aujourd'hui" |
| Goal reached | "Objectif atteint 🎉 Tu as bu {N}L aujourd'hui." |
| Avg 7d label | "MOYENNE 7J" |
| Record label | "STREAK RECORD" |
| AI history body | "Tes journées de séance tu bois +30% : ton corps réclame plus. On adapte la cible les jours d'entraînement ?" |
| AI history action | "Adapter" |
| Settings goal label | "OBJECTIF QUOTIDIEN" |
| Settings goal sub | "recommandé selon ton poids et activité" |
| Reminders row | "Rappels intelligents" |
| Reminders sub | "Toutes les 90 min, 8h-21h" |
| Default glass row | "Taille de verre par défaut" |
| Default glass sub | "250 ml" |
| Coffee row | "Compter le café/thé" |
| Coffee sub | "Oui (à 50%)" |
| Workout bonus row | "Bonus jour de séance" |
| Workout bonus sub | "+500 ml" |
| Empty logs | "Aucune entrée pour l'instant. Commence par ton verre du matin." |

### Habits

| Element | String |
|---|---|
| Header title | "Habits" |
| Tab 1 | "Aujourd'hui" |
| Tab 2 | "Historique" |
| Tab 3 | "Nouvelle" |
| Today label | "AUJOURD'HUI" |
| Count | "{N}/{N} habitudes" |
| AI body (miss) | "Tu rates '{name}' {N} fois sur 7. On baisse la cible pour ce mois ?" |
| AI action (miss) | "Ajuster" |
| AI body (good) | "Continue comme ça ! Tu as une série de {N} jours sur tes habitudes principales." |
| Heatmap rate | "{N}%" |
| Heatmap sub | "de tes habitudes ce mois" |
| Streak comparison | "+{N}% vs dernier mois" |
| Top streaks section | "Top streaks" |
| AI body (new habit) | "Vu que tu vises 'force' et que tu manques de sommeil, je suggère 'Coucher avant 23h' comme prochaine habitude." |
| AI action (new habit) | "Créer" |
| Templates section | "Templates" |
| Template add sub | "+ Ajouter" |
| Custom CTA | "Créer une habitude perso" |
| Empty state | "Aucune habitude pour l'instant. Crée ta première habitude." |

### AI Programs

| Element | String |
|---|---|
| Header title | "Programmes IA" |
| Tab 1 | "Programme" |
| Tab 2 | "Générer" |
| Tab 3 | "Bibliothèque" |
| Active chip | "Programme actif" |
| Progress sub | "Semaine {N}/{N} · {N}/{N} séances" |
| Continue CTA | "Prochaine séance" |
| Details button | "Détails" |
| Empty programme | "Aucun programme actif" |
| Empty sub | "Génère un programme IA personnalisé pour commencer ta progression." |
| Empty CTA | "Générer un programme" |
| Generate chip | "Génération IA" |
| Generate title | "Crée ton programme sur mesure" |
| Generate sub | "L'IA construit un plan adapté à ton matériel, tes objectifs et ton emploi du temps." |
| Generate CTA | "Générer un programme" |
| AI suggestion body (generate) | "Avec {N} séances/sem et objectif {goal}, je recommande un {type} sur {N} semaines avec progression 5%/sem." |
| AI suggestion action (generate) | "Voir aperçu" |
| Library AI body | "Tu as terminé {N} programmes cette année. Continue sur la lancée — un nouveau cycle 'force pure' serait pertinent." |
| Library AI action | "Générer" |
| Status active | "En cours" |
| Status done | "Terminé" |
| Reactivate button | "Réactiver" |

### Coach IA

| Element | String |
|---|---|
| Header title | "Coach IA" |
| Tab 1 | "Discussion" |
| Tab 2 | "Personas" |
| Tab 3 | "Réglages" |
| Online status | "● En ligne · répond en moins de 2s" |
| Conversations section | "Conversations" |
| New conversation CTA | "Nouvelle conversation" |
| Quick prompts | "Plan ma séance" / "Ai-je récupéré ?" / "Mes macros du soir ?" / "Motivation 💪" |
| Persona intro | "Choisis le coach qui te parle le mieux. Tu peux changer à tout moment." |
| Selected chip | "Actif" |
| AI suggestion body (settings) | "Active 'Notif quotidiennes du coach' pour recevoir un check-in matinal personnalisé." |
| AI suggestion action | "Activer" |
| Notif row | "Notifications quotidiennes" |
| Notif sub | "Tous les jours à 7h30" |
| Tone row | "Ton du coach" |
| Tone sub | "Tutoiement, motivant" |
| Suggestion freq row | "Fréquence des suggestions" |
| Suggestion freq sub | "À chaque écran clé" |
| Data shared row | "Données partagées" |
| Data shared sub | "Activité, sommeil, nutrition" |
| Clear history row | "Effacer l'historique" |
| Clear history sub | "{N} conversations" |
| Empty conversations | "Aucune conversation pour l'instant. Lance une discussion avec ton coach !" |
| Empty CTA | "Commencer" |

### Community

| Element | String |
|---|---|
| Header title | "Communauté" |
| Tab 1 | "Fil" |
| Tab 2 | "Défis" |
| Tab 3 | "Groupes" |
| AI body (feed) | "{N} amis ont fait un PR cette semaine. {name} t'a dépassé au squat (+{N}kg) — la revanche ?" |
| AI action (feed) | "Lancer un défi" |
| Feed action workout | "a terminé une séance {name}" |
| Like | "{N}" (heart icon) |
| Comment | "{N}" (chat icon) |
| Joined chip | "Inscrit" |
| Challenge rank CTA | "Voir le classement" |
| Challenge join CTA | "Rejoindre" |
| No challenges | "Aucun défi actif pour l'instant." |
| No challenges sub | "Reviens plus tard pour rejoindre des défis communautaires." |
| Groups AI body | "Vu ton niveau et tes records, le groupe '{name}' serait pertinent. {N} membres, très actif." |
| Groups AI action | "Rejoindre" |
| Create group | "Créer un groupe" |
| Groups coming soon title | "Groupes bientôt disponibles" |
| Groups coming soon sub | "Les groupes sont en cours de développement. Reviens bientôt !" |
| Empty feed | "Ton fil est vide pour l'instant." |
| Empty feed sub | "Ajoute des amis pour voir leur activité ici." |
| Find friends CTA | "Trouver des amis" |

---

## 9. Component Inventory

### New Components (Phase 37)

| Component | Location | Purpose |
|---|---|---|
| `NutritionPlugin` | `plugins/nutrition/src/screens/NutritionPlugin.tsx` | 4-tab nutrition entrypoint |
| `HydrationPlugin` | `plugins/hydration/src/screens/HydrationPlugin.tsx` | 3-tab hydration entrypoint |
| `HabitsPlugin` | `plugins/habits/src/screens/HabitsPlugin.tsx` | 3-tab habits entrypoint |
| `AIProgramsPlugin` | `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx` | 3-tab AI programs entrypoint |
| `CoachIAPlugin` | `plugins/persona/src/screens/CoachIAPlugin.tsx` | 3-tab coach IA entrypoint |
| `CommunityDashboard` (replaced) | `plugins/community/src/screens/CommunityDashboard.tsx` | 3-tab community entrypoint |
| `CalorieRing` | Inline in NutritionPlugin (not extracted) | SVG ring 92×92px |
| `HydrationBottle` | Inline in HydrationPlugin (not extracted) | SVG bottle fill |
| `HabitsHeatmap` | Inline in HabitsPlugin (not extracted) | 30-day dot grid |

### Reused Components (do not modify)

| Component | Package | Usage in Phase 37 |
|---|---|---|
| `SubTabs` | `@ziko/ui` | All 6 plugins |
| `AISuggestion` | `@ziko/ui` | All 6 plugins (1 per tab minimum) |
| `PluginHeader` | `@ziko/ui` | All 6 plugins |
| `WeekStrip` | `@ziko/ui` | Not used in Phase 37 (used in Habits Historique via custom heatmap instead) |
| `STRow` | `@ziko/ui` | Nutrition Réglages, Hydration Réglages, Coach IA Réglages |

### SubTabs Update Required

The existing `SubTabs.tsx` uses underline style. Phase 37 requires pill-style segmented control (container background + active pill with shadow). Update component body while preserving the `tabs: string[]` / `active` / `onChange` interface.

### Files to Delete (after replacement verified)

```
plugins/nutrition/src/screens/NutritionDashboard.tsx
plugins/hydration/src/screens/HydrationDashboard.tsx
plugins/habits/src/screens/HabitsDashboardScreen.tsx
plugins/ai-programs/src/screens/AIProgramsDashboard.tsx
plugins/persona/src/screens/PersonaCustomizeScreen.tsx
```

Deletion protocol: grep for all imports of each file, verify zero references, then delete. No stub files.

---

## 10. Data Hooks

| Plugin | Hook Name | Query |
|---|---|---|
| Nutrition Aujourd'hui | `useNutritionToday` | `nutrition_logs` WHERE user_id + date=today, aggregated |
| Nutrition Historique | `useNutritionHistory(days=7)` | `nutrition_logs` grouped by date |
| Nutrition recents | `useRecentFoods(limit=5)` | `nutrition_logs` ORDER BY created_at DESC, distinct food_name |
| Hydration Today | `useHydrationToday` | `hydration_logs` WHERE user_id + date=today, sum(amount_ml) |
| Hydration History | `useHydrationHistory(days=7)` | `hydration_logs` grouped by date |
| Habits Today | `useHabitsToday` | `habits` + `habit_logs` WHERE date=today |
| Habits History | `useHabitsHistory(days=30)` | `habit_logs` last 30 days |
| AI Programs | `useAIPrograms` | `ai_generated_programs` WHERE user_id |
| Active Program | `useActiveProgram` | `ai_generated_programs` WHERE user_id + is_active=true, single |
| Conversations | `useAIConversations` | `ai_conversations` WHERE user_id ORDER BY updated_at DESC |
| Community Feed | `useCommunityFeed` | `workout_sessions` JOIN `friendships` |
| Challenges | `useChallenges` | `challenges` WHERE end_date > now() |
| User Groups | `useUserGroups` | community groups tables |

All hooks follow TanStack Query pattern:
```ts
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['hookName', userId, ...params],
  queryFn: async () => { /* supabase query */ },
  staleTime: 60_000,
})
```

---

## 11. AISuggestion Rule Matrix

| Plugin | Tab | Rule | Trigger Condition |
|---|---|---|---|
| Nutrition | Aujourd'hui | Protein deficit | `protein_g < 0.30 * protein_target_g` |
| Nutrition | Ajouter | Photo IA promotion | Always shown |
| Nutrition | Historique | Calorie pattern analysis | `max(daily_cals) / min(daily_cals) > 1.3` (high variance) |
| Nutrition | Réglages | TDEE recommendation | Always shown with user's data |
| Hydration | Aujourd'hui | Timing distribution | `pct_logged_after_14h > 0.6` (most intake after 2pm) |
| Hydration | Historique | Workout day delta | `avg(workout_day_ml) / avg(rest_day_ml) > 1.2` |
| Habits | Aujourd'hui | Habit miss pattern | Any habit missed ≥ 4/7 last days |
| Habits | Aujourd'hui (good) | Streak encouragement | All habits < 3 misses in 7 days |
| Habits | Nouvelle | Sleep + goal tip | `last_sleep_duration < 7h AND user_profiles.goal = 'force'` |
| AI Programs | Programme | Recovery tip | `last_sleep_quality >= 4` → increase load; else → lighter session |
| AI Programs | Générer | Program recommendation | Derived from `user_profiles.goal + workout_days_per_week` |
| AI Programs | Bibliothèque | Progress motivation | `count(completed_programs) >= 1` |
| Coach IA | Réglages | Daily notif tip | Always shown |
| Community | Fil | PR challenge prompt | Any friend PR in last 7 days |
| Community | Groupes | Group recommendation | User has ≥ 3 sessions of powerlifting exercises |

**Fallback:** If rule condition cannot be evaluated (data unavailable), show a generic positive tip. Never show an empty AISuggestion.

---

## 12. SVG Specifications

### 12.1 Calorie Ring (Nutrition)

```
Component: inline SVG via react-native-svg
Size: 92×92 (width/height props)
viewBox: "0 0 92 92"
Center: cx=46, cy=46
Radius: r=38
Track: stroke=rgba(28,26,23,0.07), strokeWidth=8
Progress: stroke=#FF5C1A, strokeWidth=8
Circumference: 2 * π * 38 = 238.76
strokeDasharray: [(consumed/target) * 238.76, 1000]
strokeLinecap: "round"
SVG rotation: style={{ transform: [{ rotate: '-90deg' }] }}

Center label overlay: absoluteFill, alignItems center, justifyContent center
```

### 12.2 Hydration Bottle Fill

```
Component: inline SVG via react-native-svg
Size: 80×140 (width/height props)
viewBox: "0 0 80 140"

Bottle outline:
  Path: M28 8h24v14l8 14v100a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V36l8-14V8z
  fill: none, stroke: #2E7BF6, strokeWidth: 2

ClipPath id: "hydration-bottle-clip"
  Defs > ClipPath: same path

Fill body rect:
  x=0, y={140 - fillRatio * 120}, width=80, height={fillRatio * 120}
  fill: #2E7BF6, fillOpacity: 0.25
  clipPath: url(#hydration-bottle-clip)

Surface line rect:
  x=0, y={140 - fillRatio * 120}, width=80, height=3
  fill: #2E7BF6, fillOpacity: 0.85
  clipPath: url(#hydration-bottle-clip)

fillRatio = Math.min(1, Math.max(0, today_ml / goal_ml))
```

### 12.3 Habits Heatmap

```
Not an SVG — implemented as React Native View grid:

Container: flexDirection row, flexWrap wrap,
  width: (cellSize + gap) * 10 (10 columns)
  gap: 4

30 cells (one per day, D-29 to D-0):
  Each cell: View
    width: (availableWidth - 9 * gap) / 10   ← dynamic, ~28px at 390 screen
    aspectRatio: 1
    borderRadius: 6
    backgroundColor:
      Done day: #FF5C1A, opacity: 0.4 + (completionRate * 0.6)
        where completionRate = habitsCompleted/totalHabits for that day
      No log: rgba(28,26,23,0.05)

The grid renders 30 cells left-to-right = oldest (D-29) top-left to newest (D-0) bottom-right
```

---

## 13. Motion Design

**Motion personality:** Snappy (fitness app = energetic)
- Entrance: 200ms, `ease-out`
- Tab switch: 150ms crossfade
- Interactive feedback: 100ms scale press

### Motion contracts per plugin

#### 13.1 All Plugins — SubTab Switch

```
Tab press → content fade transition:
  Outgoing: opacity 1 → 0, duration 100ms, ease-in
  Incoming: opacity 0 → 1, translateY 8 → 0, duration 200ms, ease-out
  Overlap: none (sequential: hide then show)

Implementation: Animated.Value + useEffect on activeTab change
or: use React Native's built-in `Animated.timing`
```

#### 13.2 All Plugins — Screen Entrance

```
On mount: translateY 16 → 0, opacity 0 → 1
Duration: 250ms, ease-out
Stagger: card elements stagger 30ms apart using Animated.stagger
```

#### 13.3 Calorie Ring (Nutrition)

```
On tab 'today' mount or data load:
  strokeDasharray animates from [0, 1000] → [final, 1000]
  Duration: 700ms, ease-out
  react-native-svg: Animated SVG stroke value via Animated.Value
```

#### 13.4 Hydration Bottle Fill

```
On mount / data load:
  fillRatio animates from 0 → actual
  Affects both rect y and height dynamically
  Duration: 800ms, ease-out (spring-like feel)
  Use Animated.Value → interpolate for y and height
```

#### 13.5 Hydration Quick Log — Confirmation Flash

```
On log button press success:
  Card backgroundColor briefly pulses: surface → rgba(46,123,246,0.12) → surface
  Duration: 300ms (150ms in, 150ms out)
  Bottle fill level re-animates with new value (300ms)
```

#### 13.6 Habit Completion Toggle

```
On checkbox press:
  Scale: 1.0 → 1.2 → 1.0 (spring)
  Duration: 200ms total, overshoot
  Color fill: transparent → habit.color (100ms)
  If all done: summary card count animates number counter (100ms)
```

#### 13.7 AI Programs — Progress Bar

```
On mount:
  Width animates from 0% → actual%
  Duration: 600ms, ease-out
  Active program hero progress gradient animates left to right
```

#### 13.8 Persona Card Selection

```
On persona tap:
  Border color transition: border → persona.color (150ms)
  "Actif" chip: scale 0 → 1 (spring, 200ms)
  Previous active persona: border fades back (150ms)
```

#### 13.9 Community Feed — Card Entrance

```
Feed cards stagger on initial load:
  Each card: translateY 12 → 0, opacity 0 → 1
  Stagger: 60ms between cards
  Duration per card: 200ms, ease-out
```

#### 13.10 Skeleton → Content Transition

```
All loading states:
  Skeleton shimmer: animated gradient sweep (LinearGradient animated from left to right)
  On data load: skeleton fades out (150ms), content fades in (200ms)
  No position jump — skeleton is same height as final content
```

---

## 14. Skeleton/Loading Specs

All skeletons use:
```
backgroundColor: rgba(28,26,23,0.06)
borderRadius: same as final element
Animated shimmer: horizontal gradient sweep from left (rgba(255,255,255,0)) through center (rgba(255,255,255,0.5)) to right (transparent)
Cycle duration: 1400ms, repeat
```

### Per-plugin loading states

**Nutrition Aujourd'hui:**
- Calorie ring placeholder: gray circle 92×92 + 3 thin shimmer bars
- 3 meal card skeletons: height 56, full width, gap 8

**Hydration Aujourd'hui:**
- Bottle placeholder: gray rect 80×140 + 3 text shimmer lines
- 4 quick-log button shimmer squares

**Habits Aujourd'hui:**
- Summary card shimmer (height 70) + 5 habit row shimmer (height 52 each)

**AI Programs Programme:**
- Hero card shimmer (height 200, dark variant) + AISuggestion shimmer (height 64)

**Coach IA Discussion:**
- Persona banner shimmer (height 70) + 3 conversation row shimmer (height 60 each)

**Community Fil:**
- AISuggestion shimmer (height 64) + 3 activity card shimmer (height 120 each)

---

## 15. File Deletion Checklist

Before deleting each old file, executor must verify zero imports:

```bash
# Nutrition
grep -r "NutritionDashboard" apps/ plugins/ --include="*.tsx" --include="*.ts"

# Hydration
grep -r "HydrationDashboard" apps/ plugins/ --include="*.tsx" --include="*.ts"

# Habits
grep -r "HabitsDashboardScreen" apps/ plugins/ --include="*.tsx" --include="*.ts"

# AI Programs
grep -r "AIProgramsDashboard" apps/ plugins/ --include="*.tsx" --include="*.ts"

# Persona
grep -r "PersonaCustomizeScreen" apps/ plugins/ --include="*.tsx" --include="*.ts"
```

All must return zero results before deletion.

---

## 16. Accessibility

- All touch targets: minimum 44×44px (habit completion button 36×36 — add 4px padding around)
- All interactive elements: `accessibilityRole` prop set (button / tab / etc.)
- AISuggestion card: `accessibilityLabel="Coach IA suggestion: {text}"`
- Hydration log buttons: `accessibilityLabel="Logger {amount}ml d'eau"`
- Habit completion: `accessibilityLabel="{name} — {done ? 'Complété' : 'Non complété'}"`
- Calorie ring SVG: `accessibilityLabel="Calories : {consumed} sur {target} kcal consommées"`
- Color contrast: all text on surface (#FFFFFF) meets 4.5:1. Primary (#FF5C1A) on white: 3.1:1 (use for decorative only, not body text)

---

## Pre-Population Sources

| Decision | Source |
|---|---|
| 4-tab Nutrition structure | PLUG-N-01 (REQUIREMENTS) + mockup NutritionPlugin |
| Calorie ring SVG spec | mockup NutritionToday, PLUG-N-02 |
| Bottle fill SVG spec | mockup HydrationToday, PLUG-H-01 |
| 30-day heatmap | PLUG-HAB-03 + mockup HabitsHistory |
| AI Programs 3 tabs | PLUG-AI-01 + D-10/D-11/D-12 |
| Générer = navigate to ai-generate.tsx | D-10 (locked) |
| Réactiver is_active flag | D-11 (locked) |
| Prochaine séance → session.tsx | D-12 (locked) |
| Coach IA 3 tabs (Discussion/Personas/Réglages) | mockup CoachIAPlugin |
| Persona data (Max/Zoé/Léo/Rio) | mockup PERSONAS array |
| Chat = ai_conversations list | D-07 (locked) |
| Coaching settings in user_profiles.settings | D-08 (locked) |
| Persona → system prompt injection | D-09 (locked) |
| Community only dashboard redesigned | D-04 (locked) |
| Fil = workout_sessions JOIN friendships | D-05 (locked) |
| Groupes = real data or empty state | D-06 (locked) |
| All design tokens | Phase 32 design system (locked) |
| NativeWind className styling | CLAUDE.md (locked) |
| showAlert (not Alert.alert) | CLAUDE.md (locked) |
| paddingBottom: 100 on ScrollViews | CLAUDE.md (locked) |
| AISuggestion rule conditions | REQUIREMENTS §PLUG-N-06, §PLUG-HAB-05, §PLUG-AI-05 |

---

*Phase 37 UI-SPEC — Draft*
*Written: 2026-05-25*
*Checker: gsd-ui-checker*

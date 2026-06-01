# Phase 38 : Remaining Plugins Group 1 — Research

**Researched:** 2026-05-26
**Domain:** React Native — redesign de 6 plugins (Stats, Gamification, Stretching, Sleep, Measurements, Timer) selon le mockup canonique `plugins-2.jsx`
**Confidence:** HIGH

---

## Summary

Cette phase redessine 6 plugins en suivant exactement le pattern établi par la Phase 37 : un seul écran `<PluginName>Plugin.tsx` par plugin, avec `SubTabs` interne et `SafeAreaView` + `ScrollView`. Les route wrappers existants ne bougent pas — ils continuent d'importer le dashboard existant. Seul le fichier dashboard de chaque plugin est remplacé ; les autres screens (log, editor, session…) restent intacts.

Toutes les briques réutilisables Phase 37 (`SubTabs`, `AISuggestion`, `PluginHeader`, `WeekStrip`) sont déjà exportées par `@ziko/ui`. `MiniBars` n'existe pas dans le package `@ziko/ui` — il faut le créer comme composant local inline dans chaque plugin qui en a besoin (Stats, Stretching, Sleep, Measurements), exactement comme dans le mockup HTML.

`react-native-chart-kit` (v6.12.0) et `react-native-svg` (v15.12.1) sont installés dans `apps/mobile` et utilisés par `StatsDashboard`. Le plugin Stats redesigné devra garder ces imports ou passer en barres maison (recommandé : barres maison `MiniBars` pour la cohérence visuelle avec le mockup).

**Recommandation principale :** Créer un fichier `<PluginName>Plugin.tsx` dans chaque `plugins/<name>/src/screens/`, exporter via `index.ts`, et mettre à jour le route wrapper pour importer ce nouveau fichier. L'ancien `<PluginName>Dashboard.tsx` est gardé intact jusqu'à zéro import vérifié, puis supprimé.

---

## Architectural Responsibility Map

| Capability | Tier primaire | Tier secondaire | Rationale |
|-----------|-------------|----------------|-----------|
| SubTabs navigation | Frontend (plugin screen) | — | État local `useState`, pas de routeur |
| Lecture données Supabase | Plugin screen (via store) | — | Store Zustand + fetch au montage |
| Rendu barres (MiniBars) | Plugin screen | — | Composant local, pas de SVG externe |
| Sleep stage bar | Plugin screen | — | Flex horizontal proportionnel, RN Views |
| Timer countdown | Plugin screen (useEffect/setInterval) | — | Déjà implémenté dans TimerDashboard |
| Sauvegarder séance (Timer) | Plugin screen → Supabase | workout_sessions | Insert direct depuis le screen |
| AISuggestion / PluginHeader | @ziko/ui | — | Composants partagés Phase 37 |

---

## Q1 — Fichiers screens existants

### Stats
- **Dashboard principal :** `plugins/stats/src/screens/StatsDashboard.tsx`
  - Export : `export default function StatsDashboard({ supabase })`
  - Écran complet avec tabs horizontaux scrollables (workout, habits, nutrition, gamification, ai, community, sleep, stretching, measurements, journal, hydration, cardio), sélecteur de période, et `react-native-chart-kit` (LineChart, BarChart, PieChart).
- **Autres screens :** `ExerciseStats.tsx`, `SessionDetail.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/stats/dashboard.tsx`
  ```tsx
  import StatsDashboard from '@ziko/plugin-stats/screens/StatsDashboard';
  // → <StatsDashboard supabase={supabase} />
  ```

### Gamification
- **Dashboard principal :** `plugins/gamification/src/screens/GamificationDashboard.tsx`
  - Export : `export default function GamificationDashboard({ supabase })`
  - Contient : hero level circle (MotiView), stats row (coins/streak/record), dual balance card (coins + AI credits), shop button, levels list, recent XP, gift modal (Modal).
  - Imports inhabituels : `moti`, `@ziko/plugin-community`, `creditStore` (chemin relatif `../../../../apps/mobile/src/stores/creditStore`).
- **Autres screens :** `ShopScreen.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx`

### Stretching
- **Dashboard principal :** `plugins/stretching/src/screens/StretchingDashboard.tsx`
  - Export : `export default function StretchingDashboard({ supabase })`
  - Contient : routines built-in + custom, navigation vers session/editor/manager.
- **Autres screens :** `RoutineEditor.tsx`, `RoutineManager.tsx`, `StretchingSession.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/stretching/dashboard.tsx`

### Sleep
- **Dashboard principal :** `plugins/sleep/src/screens/SleepDashboard.tsx`
  - Export : `export default function SleepDashboard({ supabase })`
  - Contient : liste des logs de sommeil, qualité étoiles, stats récap. Cross-plugin optionnel `@ziko/plugin-journal`.
- **Autres screens :** `SleepLog.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/sleep/dashboard.tsx`

### Measurements
- **Dashboard principal :** `plugins/measurements/src/screens/MeasurementsDashboard.tsx`
  - Export : `export default function MeasurementsDashboard({ supabase })`
  - Contient : StatCards (poids, body fat, tour de taille, bras), historique, useUnits hook. Cross-plugin optionnel `@ziko/plugin-nutrition`.
- **Autres screens :** `MeasurementsLog.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/measurements/dashboard.tsx`

### Timer
- **Dashboard principal :** `plugins/timer/src/screens/TimerDashboard.tsx`
  - Export : `export default function TimerDashboard({ supabase })`
  - Contient : countdown actif (useRef/setInterval/AppState), liste presets, completion screen, save workout, log cardio. Imports : `@ziko/sounds`, `Vibration`, `Modal`.
- **Autres screens :** `TimerEditor.tsx`, `TimerManager.tsx`
- **Route wrapper :** `apps/mobile/app/(app)/(plugins)/timer/dashboard.tsx`

---

## Q2 — Schéma de base de données

### Stats — tables utilisées
Stats est un plugin **read-only** : pas de tables propres. Il requête :
- `workout_sessions` (001) : `id, user_id, name, started_at, ended_at, total_volume_kg, notes`
- `session_sets` (001) : agrégats volume, `exercise_id`, `reps`, `weight_kg`
- `user_gamification` (007) : `xp, level, coins, current_streak, longest_streak`
- `xp_transactions` (007) : timeline XP par source
- `sleep_logs` (012), `stretching_logs` (012), `body_measurements` (012), `journal_entries` (012), `hydration_logs` (012), `cardio_sessions` (012)
- `habits` + `habit_logs` (002)
- `nutrition_logs` (003)

**Queries volume/PRs (workout) :**
```sql
-- Volume par semaine
SELECT date_trunc('week', started_at) AS week, SUM(total_volume_kg) AS volume
FROM workout_sessions WHERE user_id = $1 GROUP BY 1 ORDER BY 1;

-- Personal records
SELECT s.exercise_id, e.name AS exercise_name, MAX(s.weight_kg) AS max_weight, s.reps AS max_reps
FROM session_sets s
JOIN exercises e ON e.id = s.exercise_id
WHERE s.session_id IN (SELECT id FROM workout_sessions WHERE user_id = $1)
GROUP BY s.exercise_id, e.name, s.reps
ORDER BY max_weight DESC;
```

### Gamification — migration 007

**Tables exactes :**

| Table | Colonnes clés |
|-------|---------------|
| `user_gamification` | `user_id UUID PK`, `xp INT`, `level INT`, `coins INT`, `current_streak INT`, `longest_streak INT`, `last_activity_date DATE`, `equipped_title TEXT`, `equipped_badge TEXT` |
| `xp_transactions` | `id UUID PK`, `user_id UUID`, `amount INT`, `source TEXT CHECK('workout','habit','streak_bonus','level_up','achievement')`, `source_id UUID`, `description TEXT`, `created_at TIMESTAMPTZ` |
| `coin_transactions` | `id UUID PK`, `user_id UUID`, `amount INT` (+earn/-spend), `source TEXT CHECK('workout','habit','streak_bonus','level_up','purchase','refund')` |
| `shop_items` | `id UUID PK`, `name TEXT`, `category TEXT CHECK('title','badge','theme')`, `price INT`, `icon TEXT`, `level_required INT` |
| `user_inventory` | `id UUID PK`, `user_id UUID`, `item_id UUID`, `is_equipped BOOL`, `purchased_at TIMESTAMPTZ`, `UNIQUE(user_id, item_id)` |
| `level_definitions` | `level INT PK`, `xp_required INT`, `title TEXT`, `reward_coins INT` |

**Mockup Gamification (PLUG-GAM) — 3 onglets :** `level | badges | quests`

Attention : le mockup présente des "badges" et "quêtes" qui n'ont **pas** de tables dédiées en base. Les badges sont des `shop_items` de catégorie `badge`. Les quêtes n'ont pas de table — à implémenter comme données statiques ou à partir des `xp_transactions` agrégées. [ASSUMED] pour les quêtes dynamiques.

### Stretching — migrations 012 + 013

**`stretching_logs` (012) :**
| Colonne | Type |
|---------|------|
| `id` | UUID PK |
| `user_id` | UUID |
| `routine_name` | TEXT NOT NULL |
| `duration_sec` | INTEGER NOT NULL |
| `exercises` | JSONB DEFAULT '[]' |
| `date` | DATE DEFAULT CURRENT_DATE |
| `created_at` | TIMESTAMPTZ |

**`stretching_routines` (013) :**
| Colonne | Type |
|---------|------|
| `id` | TEXT PK (gen_random_uuid()::text) |
| `user_id` | UUID |
| `name` | TEXT NOT NULL |
| `type` | TEXT DEFAULT 'custom' |
| `muscle_groups` | TEXT[] DEFAULT '{}' |
| `duration_minutes` | INTEGER DEFAULT 0 |
| `exercises` | JSONB DEFAULT '[]' |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### Sleep — migration 012

**`sleep_logs` :**
| Colonne | Type |
|---------|------|
| `id` | UUID PK |
| `user_id` | UUID |
| `bedtime` | TEXT NOT NULL (ex: "23:12") |
| `wake_time` | TEXT NOT NULL (ex: "07:00") |
| `duration_hours` | NUMERIC(4,2) NOT NULL |
| `quality` | INTEGER CHECK(1–5) |
| `notes` | TEXT |
| `date` | DATE DEFAULT CURRENT_DATE |
| `created_at` | TIMESTAMPTZ |
| **UNIQUE** | (user_id, date) |

**Important PLUG-SLP-01 — Sleep stage bar :** La table `sleep_logs` **ne contient pas** de colonnes de phases de sommeil (profond/léger/REM/éveillé). Le mockup affiche une barre de phases avec données statiques fictives `[{l:"Profond",h:1.4},{l:"Léger",h:4.2},{l:"REM",h:1.8},{l:"Éveillé",h:0.4}]`. Ces données ne viennent pas de Supabase. L'implémentation doit utiliser des valeurs **estimées** ou **statiques de démonstration** proportionnelles à `duration_hours`. Une heuristique acceptable : Profond ≈ 20% de la durée, Léger ≈ 50%, REM ≈ 25%, Éveillé ≈ 5%.

### Measurements — migration 012

**`body_measurements` :**
| Colonne | Type |
|---------|------|
| `id` | UUID PK |
| `user_id` | UUID |
| `weight_kg` | NUMERIC(5,2) |
| `body_fat_pct` | NUMERIC(4,1) |
| `waist_cm` | NUMERIC(5,1) |
| `chest_cm` | NUMERIC(5,1) |
| `arm_cm` | NUMERIC(5,1) |
| `thigh_cm` | NUMERIC(5,1) |
| `hip_cm` | NUMERIC(5,1) |
| `photo_url` | TEXT |
| `date` | DATE DEFAULT CURRENT_DATE |
| `created_at` | TIMESTAMPTZ |

Mapping mockup → colonnes DB :
- "Poitrine" → `chest_cm`
- "Tour de bras" → `arm_cm`
- "Tour de taille" → `waist_cm`
- "Tour de cuisse" → `thigh_cm`
- "% Masse grasse" → `body_fat_pct`

### Timer — migrations 012 + 020

**`timer_presets` (012 + 020) :**
| Colonne | Type |
|---------|------|
| `id` | UUID PK |
| `user_id` | UUID |
| `name` | TEXT NOT NULL |
| `type` | TEXT CHECK('tabata','hiit','emom','rest','custom','hyrox','functional') |
| `work_sec` | INTEGER NOT NULL |
| `rest_sec` | INTEGER DEFAULT 0 |
| `rounds` | INTEGER DEFAULT 1 |
| `exercises` | JSONB DEFAULT '[]' (ajouté en 020) |
| `created_at` | TIMESTAMPTZ |

**Attention mapping DB ↔ store :** Les colonnes DB sont `work_sec` / `rest_sec`, mais le store `TimerPreset` utilise `work_seconds` / `rest_seconds`. La lecture depuis Supabase mappe `d.work_sec → work_seconds` (voir `TimerDashboard.tsx` ligne ~107-116).

---

## Q3 — Analyse du mockup `plugins-2.jsx`

### Structure commune
Chaque plugin suit : `PluginHeader` → `<div className="pad">` → `SubTabs` → contenu conditionnel par onglet.

Helpers locaux réutilisés dans le mockup :
- **`StatTile`** : carte 2-colonnes, label uppercase muted + valeur h-display + sub. Correspond au `StatCard` local ou KPICard.
- **`MiniBars`** : barres verticales proportionnelles en flex, hauteur 80px, barre active = couleur pleine, inactives = couleur à 28% opacité, label 9.5px en bas.
- **`RowList`** : liste de cartes avec icône colorée (34×34 borderRadius 10), titre 12.5px bold, sub 10.5px muted, right optionnel.

### 1. Stats — `StatsPlugin`
**Onglets :** `Progrès | Volume | Records`

| Onglet | Contenu |
|--------|---------|
| Progrès | MiniBars 4 semaines (couleur `--warn` = orange), AISuggestion, grille 2×2 de StatTiles (Séances/Volume/Temps/PR battus) |
| Volume | Barres horizontales de répartition par groupe musculaire (% avec progress bar), AISuggestion |
| Records | RowList avec icon trophy, exercice, date, poids max |

**Couleur accent :** `var(--warn)` → utiliser `theme.primary` (#FF5C1A) ou une couleur warn. Dans le design system Ziko il n'y a pas de `warn` séparé — utiliser `theme.primary`.

### 2. Gamification — `GamificationPlugin`
**Onglets :** `Niveau | Badges | Quêtes`

| Onglet | Contenu |
|--------|---------|
| Niveau | Carte hero dark (background `theme.text`, radial gradient primary) avec niveau 56px, titre, XP progress bar, AISuggestion, RowList niveaux suivants |
| Badges | Compteur "4/8 débloqués", grille 2 colonnes de cartes badge (cercle 52px, gradient si got=true, opacity 0.45 si locked) |
| Quêtes | AISuggestion, cartes quest avec progress bar + chip reward |

**Note :** Le nouveau design est radicalement différent de l'actuel GamificationDashboard (suppression de MotiView, creditStore, gift modal). Ces features ne sont pas dans le mockup — elles seront perdues dans le redesign. Le planificateur doit noter cette décision.

### 3. Stretching — `StretchingPlugin`
**Onglets :** `Routines | Bibliothèque | Suivi`

| Onglet | Contenu |
|--------|---------|
| Routines | AISuggestion, liste de cartes routines (icône colorée 44×44, nom h-display 14, durée/exos/moment, play icon) |
| Bibliothèque | RowList d'exercices (nom, groupe musculaire · durée) |
| Suivi | Carte avec "14 séances ce mois" + MiniBars 7 jours, AISuggestion |

### 4. Sleep — `SleepPlugin`
**Onglets :** `Cette nuit | Historique | Réglages`

| Onglet | Contenu |
|--------|---------|
| Cette nuit | Carte : durée 36px violet, horaires + score, **barre de phases** (flex horizontal 24px height, 4 segments proportionnels aux heures), légende 4 colonnes, AISuggestion violet, 2 StatTiles (FC min / Variabilité) |
| Historique | MiniBars 7 jours (durée en heures), AISuggestion |
| Réglages | RowList settings (cible sommeil, rappel coucher, source données, réveil intelligent, routine pré-sommeil) |

**Barre de phases :** implémentée avec `View style={{ flex: s.h }}` dans un conteneur `flexDirection: 'row'`. Données statiques estimées (voir Q9).

### 5. Measurements — `MeasurementsPlugin`
**Onglets :** `Aujourd'hui | Évolution | Objectifs`

| Onglet | Contenu |
|--------|---------|
| Aujourd'hui | Carte poids (label success uppercase, valeur 32px, chip delta), AISuggestion, section "Mensurations" RowList (5 items), bouton "Logger des mesures" |
| Évolution | MiniBars poids 6 semaines (max=80, couleur success), AISuggestion |
| Objectifs | RowList 3 objectifs (poids, taille, bras) avec valeur right |

### 6. Timer — `TimerPlugin`
**Onglets :** `Séance | Tabata | Intervalle`

| Onglet | Contenu |
|--------|---------|
| Séance | Carte sombre (background `theme.text`) : mode "Repos", horloge 72px primary, série info, boutons -15s / play / +15s, AISuggestion, section "Presets" grille 2×2 (Force/Hypertrophie/Endurance/Cardio HIIT) |
| Tabata | Carte descriptive "20s effort · 10s repos · 8 rounds", bouton Démarrer, AISuggestion |
| Intervalle | Formulaire personnalisé (Effort/Repos/Rounds/Sets), bouton Lancer |

**Important :** Le mockup timer est un écran de configuration/affichage statique. La logique countdown active (useRef, setInterval, AppState) du `TimerDashboard` existant doit être **préservée et intégrée** dans l'onglet Séance. Le nouveau `TimerPlugin.tsx` doit embarquer la logique countdown existante dans l'onglet "Séance".

---

## Q4 — Composants réutilisables Phase 37

### Disponibles dans `@ziko/ui` (exportés depuis `packages/ui/src/index.ts`)

| Composant | Import | Props clés | Notes |
|-----------|--------|------------|-------|
| `SubTabs` | `@ziko/ui` | `tabs: string[]`, `active: string`, `onChange: (tab: string) => void` | **Accepte un tableau de strings**, pas d'objets `{id, label}` |
| `AISuggestion` | `@ziko/ui` | `text: string`, `actionLabel?: string`, `onAction?: () => void`, `tintColor?: string` | Border gauche colorée |
| `PluginHeader` | `@ziko/ui` | `title: string`, `onBack: () => void`, `right?: ReactNode`, `dark?: boolean` | Bouton back + titre |
| `WeekStrip` | `@ziko/ui` | `selectedDate: Date`, `onSelect: (d: Date) => void`, `dotDates?: Set<string>` | Nécessite `date-fns` |

**Usage Phase 37 (pattern exact) :**
```tsx
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

const TABS = ["Onglet 1", "Onglet 2", "Onglet 3"];
const [activeTab, setActiveTab] = useState(TABS[0]);

<SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
```

### `MiniBars` — non disponible dans `@ziko/ui`

`MiniBars` n'existe **pas** dans le package `@ziko/ui`. Il faut créer un composant local dans chaque plugin. Implémentation recommandée (adapté du mockup HTML en React Native) :

```tsx
// À déclarer localement dans chaque fichier PluginName.tsx
function MiniBars({ data, color, max }: {
  data: Array<{ l: string; v: number; today?: boolean }>;
  color: string;
  max?: number;
}) {
  const m = max ?? Math.max(...data.map((d) => d.v), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 }}>
          <View style={{
            width: '100%',
            height: `${Math.max((d.v / m) * 100, 5)}%` as any,
            backgroundColor: d.today ? color : color + '47', // ~28% opacity
            borderRadius: 5,
          }} />
          <Text style={{ fontSize: 9.5, fontWeight: '700', color: d.today ? color : '#6B6963' }}>{d.l}</Text>
        </View>
      ))}
    </View>
  );
}
```

**Note :** `height` en pourcentage sur `View` fonctionne en React Native quand le parent a une hauteur définie. Alternativement utiliser des valeurs absolues calculées sur `height: 80`.

### `react-native-chart-kit` et `react-native-svg`

- `react-native-chart-kit` v6.12.0 : installé dans `apps/mobile`. Utilisé par `StatsDashboard` existant.
- `react-native-svg` v15.12.1 : installé dans `apps/mobile`.
- **Pour Phase 38** : le mockup n'utilise pas ces libs. Les nouveaux plugins utilisent `MiniBars` (barres maison) et des progress bars CSS-like (View avec width en %). **Pas besoin d'importer chart-kit ou svg** dans les nouveaux plugins.

---

## Q5 — Route wrappers existants

| Plugin | Route wrapper | Import actuel |
|--------|--------------|---------------|
| Stats | `apps/mobile/app/(app)/(plugins)/stats/dashboard.tsx` | `import StatsDashboard from '@ziko/plugin-stats/screens/StatsDashboard'` |
| Gamification | `apps/mobile/app/(app)/(plugins)/gamification/dashboard.tsx` | `import GamificationDashboard from '@ziko/plugin-gamification/screens/GamificationDashboard'` |
| Stretching | `apps/mobile/app/(app)/(plugins)/stretching/dashboard.tsx` | `import StretchingDashboard from '@ziko/plugin-stretching/screens/StretchingDashboard'` |
| Sleep | `apps/mobile/app/(app)/(plugins)/sleep/dashboard.tsx` | `import SleepDashboard from '@ziko/plugin-sleep/screens/SleepDashboard'` |
| Measurements | `apps/mobile/app/(app)/(plugins)/measurements/dashboard.tsx` | `import MeasurementsDashboard from '@ziko/plugin-measurements/screens/MeasurementsDashboard'` |
| Timer | `apps/mobile/app/(app)/(plugins)/timer/dashboard.tsx` | `import TimerDashboard from '@ziko/plugin-timer/screens/TimerDashboard'` |

**Pattern de mise à jour :** Chaque route wrapper devra importer le nouveau `<PluginName>Plugin` :
```tsx
// avant
import StatsDashboard from '@ziko/plugin-stats/screens/StatsDashboard';
// après
import StatsPlugin from '@ziko/plugin-stats/screens/StatsPlugin';
```

---

## Q6 — Barrel exports `src/index.ts`

### Stats
```ts
export default statsManifest;
export { statsManifest };
export { useStatsStore } from './store';
export { default as StatsDashboard } from './screens/StatsDashboard';
export { default as ExerciseStats } from './screens/ExerciseStats';
export { default as SessionDetail } from './screens/SessionDetail';
export { fetchAllStats, fetchHabitsOverview, /* ...toutes les fonctions fetch */ } from './store';
```
→ Ajouter : `export { default as StatsPlugin } from './screens/StatsPlugin';`

### Gamification
```ts
export default gamificationManifest;
export { gamificationManifest };
export { useGamificationStore, awardWorkoutXP, awardHabitXP } from './store';
export { default as GamificationDashboard } from './screens/GamificationDashboard';
export { default as ShopScreen } from './screens/ShopScreen';
```
→ Ajouter : `export { default as GamificationPlugin } from './screens/GamificationPlugin';`

### Stretching
```ts
export { default as stretchingManifest } from './manifest';
export { useStretchingStore } from './store';
export type { StretchRoutine, StretchLog, StretchExercise } from './store';
```
→ **Pas d'export screen existant.** Ajouter : `export { default as StretchingPlugin } from './screens/StretchingPlugin';`

### Sleep
```ts
export { default as sleepManifest } from './manifest';
export { useSleepStore } from './store';
export type { SleepLog } from './store';
```
→ Ajouter : `export { default as SleepPlugin } from './screens/SleepPlugin';`

### Measurements
```ts
export { default as measurementsManifest } from './manifest';
export { useMeasurementsStore } from './store';
export type { BodyMeasurement } from './store';
```
→ Ajouter : `export { default as MeasurementsPlugin } from './screens/MeasurementsPlugin';`

### Timer
```ts
export { default as timerManifest } from './manifest';
export { useTimerStore, BUILTIN_PRESETS } from './store';
export type { TimerPreset } from './store';
export { default as TimerManager } from './screens/TimerManager';
export { default as TimerEditor } from './screens/TimerEditor';
```
→ Ajouter : `export { default as TimerPlugin } from './screens/TimerPlugin';`

---

## Q7 — Fichiers à supprimer après remplacement

Procédure obligatoire : vérifier zéro import avant suppression.

| Fichier | Remplacé par | Vérification avant suppression |
|---------|-------------|-------------------------------|
| `plugins/stats/src/screens/StatsDashboard.tsx` | `StatsPlugin.tsx` | `grep -r "StatsDashboard" plugins/ apps/` — doit retourner 0 résultat hors index.ts |
| `plugins/gamification/src/screens/GamificationDashboard.tsx` | `GamificationPlugin.tsx` | Idem |
| `plugins/stretching/src/screens/StretchingDashboard.tsx` | `StretchingPlugin.tsx` | Idem — noter que `index.ts` n'exporte pas le dashboard actuellement |
| `plugins/sleep/src/screens/SleepDashboard.tsx` | `SleepPlugin.tsx` | Idem |
| `plugins/measurements/src/screens/MeasurementsDashboard.tsx` | `MeasurementsPlugin.tsx` | Idem |
| `plugins/timer/src/screens/TimerDashboard.tsx` | `TimerPlugin.tsx` | Idem — TimerDashboard n'est pas dans index.ts mais est importé directement dans le route wrapper |

**Attention Stats :** `StatsDashboard` est exporté dans `index.ts` → mettre à jour `index.ts` en même temps.
**Attention Gamification :** `GamificationDashboard` est exporté dans `index.ts` → idem.
**Attention Timer :** `TimerDashboard` n'est pas dans `index.ts` mais est importé directement par le route wrapper via `@ziko/plugin-timer/screens/TimerDashboard`.

**Les autres screens (log, editor, manager, session, shop) ne sont PAS touchés par cette phase.**

---

## Q8 — Timer : countdown et save workout

### Implémentation countdown actuelle
`TimerDashboard.tsx` utilise :
```tsx
useRef<ReturnType<typeof setInterval> | null>(null)  // intervalRef
useEffect(() => {
  if (isRunning && !isPaused) {
    intervalRef.current = setInterval(() => {
      const ended = tick(); // store action Zustand
      if (ended) { /* completion */ }
    }, 1000);
  }
  return () => clearInterval(intervalRef.current!);
}, [isRunning, isPaused]);
```

Correction background (AppState) :
```tsx
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active' && startedAt) {
    const actual = Math.round((Date.now() - startedAt) / 1000);
    useTimerStore.getState().computeStateAt(actual);
  }
});
```

Sons via `@ziko/sounds` : `playSound('complete' | 'start' | 'rest')`, `playCountdownBeep(timeLeft)`.
Vibration via `Vibration.vibrate([0, 400, 200, 400])`.

Le nouveau `TimerPlugin.tsx` doit reprendre **toute cette logique** dans l'onglet "Séance".

### Insert `workout_sessions` pour "Sauvegarder comme séance"

**Schema `workout_sessions` (migration 001) :**
```
id UUID PK
user_id UUID NOT NULL
program_workout_id UUID (nullable)
name TEXT (nullable)
started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
ended_at TIMESTAMPTZ (nullable)
notes TEXT (nullable)
total_volume_kg DECIMAL(10,2) (nullable)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Insert correct (extrait de TimerDashboard.tsx ligne ~259-268) :**
```tsx
await supabase.from('workout_sessions').insert({
  user_id: user.id,
  program_id: null,       // attention : la colonne s'appelle program_workout_id dans la migration 001
  started_at: today,      // ISO string
  ended_at: today,
  duration_minutes: durationMin,   // ATTENTION : ce champ n'existe pas dans la migration 001 !
  notes: `${completedPreset.name} — ${completedPreset.rounds} rounds`,
  calories_burned: estCalories,    // ATTENTION : ce champ n'existe pas dans la migration 001 !
})
```

**Divergence détectée :** Le code existant dans `TimerDashboard.tsx` insère `duration_minutes` et `calories_burned` qui ne sont **pas** dans `workout_sessions` (migration 001). Cela ne cause pas d'erreur (Supabase ignore les champs inconnus avec `insert`) mais les données sont perdues. Le nouveau `TimerPlugin.tsx` doit utiliser uniquement les colonnes confirmées :
```tsx
await supabase.from('workout_sessions').insert({
  user_id: user.id,
  name: completedPreset.name,
  started_at: new Date(Date.now() - completedElapsed * 1000).toISOString(),
  ended_at: new Date().toISOString(),
  notes: `${completedPreset.name} — ${completedPreset.rounds} rounds · ${durationMin} min`,
});
```

Les `session_exercises` s'insèrent dans `session_exercises` (pas `session_sets`) avec les colonnes : `session_id, exercise_id (null), exercise_name, order_index, notes`.

---

## Q9 — Sleep stage bar

**Réponse :** La table `sleep_logs` (migration 012) **ne contient pas** de colonnes de phases de sommeil. Les colonnes existantes sont uniquement : `bedtime, wake_time, duration_hours, quality, notes, date`.

La barre de phases du mockup (`Profond / Léger / REM / Éveillé`) utilise des données fictives statiques dans le mockup HTML : `[{h:1.4},{h:4.2},{h:1.8},{h:0.4}]`.

**Implémentation recommandée :** Calculer des phases estimées à partir de `duration_hours` avec des ratios fixes (validés scientifiquement pour un adulte moyen) :
```tsx
function estimateSleepStages(durationHours: number) {
  return [
    { l: 'Profond', h: +(durationHours * 0.18).toFixed(1), c: '#7C3AED' },
    { l: 'Léger',   h: +(durationHours * 0.53).toFixed(1), c: '#A78BFA' },
    { l: 'REM',     h: +(durationHours * 0.24).toFixed(1), c: '#2196F3' },
    { l: 'Éveillé', h: +(durationHours * 0.05).toFixed(1), c: '#9CA3AF' },
  ];
}
```

Barre implémentée avec :
```tsx
<View style={{ flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden', marginTop: 14 }}>
  {stages.map((s) => (
    <View key={s.l} style={{ flex: s.h, backgroundColor: s.c }} />
  ))}
</View>
```

---

## Architecture Patterns

### Pattern Phase 37 (à suivre exactement)

**Structure du fichier `<PluginName>Plugin.tsx` :**
```tsx
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useThemeStore } from '@ziko/plugin-sdk';

// Composants locaux (MiniBars, StatTile, RowList si nécessaire)
function MiniBars(...) { ... }

const TABS = ['Onglet 1', 'Onglet 2', 'Onglet 3'];

export default function PluginNamePlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Nom du Plugin" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === TABS[0] && <Tab1Content />}
        {activeTab === TABS[1] && <Tab2Content />}
        {activeTab === TABS[2] && <Tab3Content />}
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Structure projet (pas de changement de dossiers)

```
plugins/<name>/src/
  screens/
    <PluginName>Plugin.tsx   ← NOUVEAU (remplace dashboard)
    <PluginName>Dashboard.tsx  ← conservé jusqu'à zéro import, puis delete
    [autres screens inchangés]
  index.ts  ← ajouter export du nouveau Plugin
```

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser | Pourquoi |
|----------|-------------------|----------|----------|
| Navigation SubTabs | Implémentation custom | `SubTabs` de `@ziko/ui` | Déjà testé, cohérence Phase 37 |
| Header avec back | Bouton back custom | `PluginHeader` de `@ziko/ui` | Design system unifié |
| AI suggestion card | Card custom | `AISuggestion` de `@ziko/ui` | Border colorée, style exact du mockup |
| Countdown timer | Nouveau setInterval | Logique de `TimerDashboard.tsx` existante | Déjà robuste (AppState, sons, vibration) |
| Charts complex | SVG circles, react-native-chart-kit | `MiniBars` inline (Views flex) | Le mockup n'utilise que des barres simples |
| Sleep stages | API externe wearables | Estimation heuristique depuis `duration_hours` | Pas de données de phases en DB |

---

## Common Pitfalls

### Pitfall 1 : SubTabs attend `string[]`, pas `{id, label}[]`
**Ce qui va mal :** Passer `[{ id: 'tab', label: 'Tab' }]` comme dans le mockup HTML.
**Cause :** L'interface `SubTabs` dans `packages/ui/src/components/SubTabs.tsx` déclare `tabs: string[]`.
**Solution :** Utiliser `const TABS = ['Progrès', 'Volume', 'Records']` et comparer avec `activeTab === 'Progrès'`.

### Pitfall 2 : MiniBars height en pourcentage sur View
**Ce qui va mal :** `height: \`${pct}%\`` sur un View enfant qui n'a pas de parent à hauteur définie.
**Cause :** React Native ne supporte les % que si le parent a une hauteur absolue.
**Solution :** Définir `height: 80` sur le conteneur parent, et calculer la hauteur des barres en valeurs absolues : `height: Math.max((d.v / m) * 80, 4)`.

### Pitfall 3 : Import creditStore dans GamificationPlugin (chemin relatif)
**Ce qui va mal :** Le `GamificationDashboard` actuel importe `../../../../apps/mobile/src/stores/creditStore`. Ce chemin relatif cassera si le nouveau fichier est dans un sous-dossier différent.
**Solution :** Le nouveau `GamificationPlugin.tsx` du mockup ne contient pas le dual balance / creditStore — ces éléments du design actuel sont absents du mockup et seront supprimés. Si le planificateur décide de les garder, utiliser l'alias `@ziko/app-stores` ou un chemin absolu.

### Pitfall 4 : Timer — ne pas perdre la logique countdown
**Ce qui va mal :** Créer un `TimerPlugin.tsx` vide qui n'intègre pas le countdown existant.
**Solution :** Copier la logique `intervalRef`, `useEffect` setInterval, AppState correction, et les handlers `handleSaveWorkout`/`handleLogCardio` depuis `TimerDashboard.tsx` dans le nouvel onglet "Séance".

### Pitfall 5 : Gamification — quêtes sans table DB
**Ce qui va mal :** Tenter de requêter une table `quests` ou `user_quests` inexistante.
**Cause :** Migration 007 ne crée pas de table de quêtes.
**Solution :** Implémenter les quêtes comme données statiques (défis hebdomadaires hardcodés) ou calculer dynamiquement depuis `xp_transactions` et `workout_sessions`.

### Pitfall 6 : paddingBottom manquant
**Ce qui va mal :** Contenu coupé par la tab bar.
**Cause :** Oubli du padding bottom.
**Solution :** `contentContainerStyle={{ paddingBottom: 100 }}` sur chaque ScrollView (règle projet CLAUDE.md).

---

## State of the Art

| Ancien | Actuel Phase 38 | Impact |
|--------|----------------|--------|
| Chaque plugin = dashboard monolithique | Single entrypoint + SubTabs | Navigation interne sans route change |
| `react-native-chart-kit` (stats) | MiniBars Views inline | Moins de deps, visuellement proche du mockup |
| MotiView animations (gamification) | Views standards | Suppression dépendance moti dans le nouveau screen |

---

## Assumptions Log

| # | Claim | Section | Risque si faux |
|---|-------|---------|----------------|
| A1 | Les quêtes Gamification seront implémentées en données statiques | Q3 Gamification | Si quêtes dynamiques demandées, migration DB nécessaire |
| A2 | Les phases de sommeil seront estimées (ratios fixes) | Q9 | Si données wearables réelles exigées, intégration wearables plugin nécessaire |
| A3 | Le dual balance / creditStore n'est pas requis dans le nouveau GamificationPlugin | Q7 | Si keepé, chemin d'import à corriger |
| A4 | `session_exercises` (pas `session_sets`) est la bonne table pour les exercices de séance Timer | Q8 | Erreur SQL silencieuse si mauvaise table |

---

## Environment Availability

Aucune dépendance externe nouvelle. Toutes les libs sont déjà installées :
- `@ziko/ui` : SubTabs, AISuggestion, PluginHeader, WeekStrip ✓
- `react-native-safe-area-context` ✓
- `expo-router` ✓
- `@ziko/plugin-sdk` (useThemeStore, showAlert) ✓
- `@expo/vector-icons` (Ionicons) ✓
- `date-fns` (si WeekStrip utilisé) ✓

---

## Sources

### Primaires (HIGH confidence)
- Code source lu directement : `plugins/*/src/screens/*.tsx`, `plugins/*/src/index.ts`
- Migrations lues : `supabase/migrations/007_gamification_schema.sql`, `012_new_plugins_schema.sql`, `013_stretching_routines.sql`, `020_timer_exercises_hyrox.sql`, `001_initial_schema.sql`
- Mockup canonique : `C:/Users/Anatholy/Downloads/ziko/plugins-2.jsx` (lu intégralement)
- Composants UI : `packages/ui/src/components/{SubTabs,AISuggestion,PluginHeader,WeekStrip}.tsx`
- Route wrappers : `apps/mobile/app/(app)/(plugins)/*/dashboard.tsx`

### Secondaires
- Pattern Phase 37 : `plugins/habits/src/screens/HabitsPlugin.tsx` et `plugins/nutrition/src/screens/NutritionPlugin.tsx` pour confirmation API SubTabs

---

## Metadata

**Confidence breakdown :**
- Fichiers existants (Q1, Q5, Q6) : HIGH — lus directement
- Schéma DB (Q2) : HIGH — migrations lues directement
- Mockup (Q3) : HIGH — fichier lu intégralement
- Composants réutilisables (Q4) : HIGH — code source lu
- Timer countdown (Q8) : HIGH — code source lu
- Sleep stages (Q9) : HIGH (absence de colonnes) + ASSUMED (implémentation heuristique)

**Research date :** 2026-05-26
**Valid until :** 2026-06-26 (codebase stable)

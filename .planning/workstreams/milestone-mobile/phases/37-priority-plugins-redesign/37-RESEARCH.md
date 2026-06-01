# Phase 37: Priority Plugins Redesign — Research

**Researched:** 2026-05-26
**Domain:** React Native plugin screens — Expo SDK 54, NativeWind v4, TanStack Query v5, Supabase
**Confidence:** HIGH (all findings verified directly from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Single entrypoint file per plugin, internal SubTabs state, no Expo Router per-tab routing
- D-02: Nutrition "Ajouter" tab = quick-add shortcuts + navigate to existing LogMealScreen.tsx
- D-03: Old dashboard files deleted after replacement (zero imports verified before deletion)
- D-04: Community redesigns only CommunityDashboard.tsx; all other sub-screens untouched
- D-05: Fil tab = friend workout sessions (workout_sessions JOIN friendships)
- D-06: Groupes tab = real data if groups table exists; otherwise "Groupes bientôt disponibles" empty state
- D-07: Chat tab shows ai_conversations list; tapping opens AIChatDetailScreen with full SSE streaming
- D-08: Coaching settings saved to user_profiles.settings JSONB (keys: ai_language, ai_coaching_style, ai_response_length)
- D-09: Persona selection saved to user_profiles.settings.ai_persona; fetchUserContext() reads + injects into system prompt
- D-10: "Générer" tab navigates to existing apps/mobile/app/(app)/workout/ai-generate.tsx (no wizard duplication)
- D-11: "Réactiver" sets is_active boolean on ai_generated_programs row; Programme tab shows active row
- D-12: "Prochaine séance" navigates to apps/mobile/app/(app)/workout/session.tsx

### Claude's Discretion
- SVG bottle-fill visualization approach (polygon vs linear gradient clip)
- AISuggestion rule-based content per plugin (REQUIREMENTS specify the rules)
- Calendar heatmap component approach (inline vs extracted)
- Défis tab progress bar data structure from challenges table

### Deferred Ideas (OUT OF SCOPE)
- Full community sub-screens redesign (deferred to Phase 40)
- Persona coaching style prompt engineering beyond name injection
- Community Groupes real implementation if table doesn't exist
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLUG-N-01 | Nutrition plugin: 4 SubTabs (Aujourd'hui/Ajouter/Historique/Réglages) | SubTabs.tsx verified, active prop is string |
| PLUG-N-02 | Aujourd'hui: SVG calorie ring + 3 macro bars + meals list from nutrition_logs | Table schema confirmed in migration 001 |
| PLUG-N-03 | Ajouter: search input + 3 quick-add shortcuts; existing LogMealScreen preserved | LogMealScreen.tsx exists at plugins/nutrition/src/screens/LogMealScreen.tsx |
| PLUG-N-04 | Historique: 7-day bar chart + day-selectable log list | nutrition_logs has date + meal_type columns |
| PLUG-N-05 | Réglages: calorie goal slider + macro sliders saved to user_profiles | user_profiles.settings JSONB confirmed in use |
| PLUG-N-06 | AISuggestion: protein < 30% goal → suggest protein boost | Rule-based, no external dependency |
| PLUG-N-07 | Replace NUTRITION_TODAY fixtures with TanStack Query | NutritionDashboard uses Zustand store, not raw fixtures — full rewrite with useQuery |
| PLUG-H-01 | SVG bottle-fill visualization (blue gradient, today_ml / goal_ml) | react-native-svg available (used in Phase 32 FormRing) |
| PLUG-H-02 | Quick log: +250/+500/+750ml/Custom buttons | hydration_logs table confirmed |
| PLUG-H-03 | 7-day MiniBars bar chart | Pattern from Phase 36 WeekStrip |
| PLUG-H-04 | Daily goal editable, saved to user_profiles | user_profiles.settings JSONB in use |
| PLUG-H-05 | Replace WATER fixtures with real hydration_logs TanStack Query | HydrationDashboard uses custom Zustand store |
| PLUG-HAB-01 | Habits: 3 SubTabs (Aujourd'hui/Historique/Nouveau) | SubTabs API confirmed |
| PLUG-HAB-02 | Aujourd'hui: habit rows with completion checkbox + streak dot-grid | habits + habit_logs tables confirmed |
| PLUG-HAB-03 | Historique: 30-day calendar heatmap + per-habit streak list | Build inline; habit_logs.date column available |
| PLUG-HAB-04 | Nouveau: 8 template grid + custom habit form | HabitLogScreen kept for completion logic reference |
| PLUG-HAB-05 | AISuggestion: habit streak encouragement | Rule-based |
| PLUG-HAB-06 | Replace HABITS fixtures with real habits + habit_logs TanStack Query | HabitsDashboardScreen uses custom Zustand store (DEFAULT_HABITS) |
| PLUG-AI-01 | AI Programs: 3 SubTabs (Programme/Générer/Bibliothèque) | SubTabs confirmed |
| PLUG-AI-02 | Programme tab: active program hero card or empty state | ai_generated_programs.is_active BOOLEAN confirmed |
| PLUG-AI-03 | Générer tab launches AIGenerator wizard | Navigate to apps/mobile/app/(app)/workout/ai-generate.tsx |
| PLUG-AI-04 | Bibliothèque: past ai_generated_programs list + Réactiver button | ai_generated_programs schema confirmed |
| PLUG-AI-05 | AISuggestion: program adaptation tip | Rule-based |
| PLUG-AI-06 | Replace AI_PROGRAMS fixtures with real TanStack Query | AIProgramsDashboard uses Zustand store |
| PLUG-CIA-01 | Coach IA: 2 SubTabs (Chat/Persona) | SubTabs confirmed |
| PLUG-CIA-02 | Chat tab: ai_conversations list + credit chip in header | useCreditStore.balance verified |
| PLUG-CIA-03 | Persona tab: 4 persona cards (Max/Zoé/Léo/Rio), saved to user_profiles.settings.ai_persona | user_profiles.settings JSONB pattern confirmed in settings.tsx |
| PLUG-CIA-04 | Settings rows: language, coaching style, response length saved to user_profiles.settings | Same JSONB pattern |
| PLUG-CIA-05 | Replace PERSONAS/COACH_MESSAGES fixtures with real ai_messages + ai_conversations | PersonaCustomizeScreen uses Zustand store + persona_settings table (legacy) |
| PLUG-COM-01 | Community: 3 SubTabs (Fil/Défis/Groupes) | SubTabs confirmed |
| PLUG-COM-02 | Fil tab: friend activity feed from workout_sessions JOIN friendships | friendships: requester_id + addressee_id columns confirmed |
| PLUG-COM-03 | Défis tab: active challenges + progress bar | challenges + challenge_participants tables confirmed |
| PLUG-COM-04 | Groupes tab: groups the user belongs to | NO groups table exists — empty state needed |
| PLUG-COM-05 | Replace FEED fixture with real data | CommunityDashboard uses Zustand community store |
</phase_requirements>

---

## Summary

All 6 plugin screen files and their route wrappers are confirmed in the codebase. The old screens use Zustand stores with real Supabase data (no pure fixture constants for the main data flows), but the architecture diverges from the Phase 37 target: they lack SubTabs, PluginHeader, and AISuggestion cards, and use legacy patterns (SafeAreaView + custom headers + Zustand instead of TanStack Query).

The most critical schema finding: `user_profiles` does NOT have a `settings JSONB` column in any migration, yet `apps/mobile/app/(app)/profile/settings.tsx` already reads/writes `user_profiles.settings.notif_prefs`. This column is missing from the migration history — **Phase 37 Wave 0 must add a migration** to add `settings JSONB DEFAULT '{}'` to `user_profiles` before plans D-08 and D-09 can execute. The community plugin has no `groups` or `community_groups` table, confirming the "Groupes bientôt disponibles" empty state is required. The `ai_generated_programs.is_active` column exists. The `challenges` + `challenge_participants` tables exist with rich schema.

**Primary recommendation:** Each plan's Wave 0 should include: (1) verify the new screen file doesn't import the old screen, (2) update the route wrapper import, (3) confirm zero remaining imports before deleting old file. The `user_profiles.settings` migration gap must be addressed in Plan 37-01 Wave 0 (or a dedicated pre-wave).

---

## Q1: Current Plugin Screen Files

### Nutrition Plugin
- **Existing screen:** `plugins/nutrition/src/screens/NutritionDashboard.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx`
  - Imports: `import NutritionDashboard from '@ziko/plugin-nutrition/screens/NutritionDashboard'`
- **Plugin index:** `plugins/nutrition/src/index.ts` — exports `NutritionDashboard` by name
- **Other screens to KEEP:** `LogMealScreen.tsx`, `TDEECalculatorScreen.tsx`, `ScoreBadge.tsx` component
- **New file target:** `plugins/nutrition/src/screens/NutritionPlugin.tsx`
- **Import locations (main branch only):**
  - `apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx` — route wrapper (UPDATE this)
  - `plugins/nutrition/src/index.ts` — barrel export (UPDATE this)

### Hydration Plugin
- **Existing screen:** `plugins/hydration/src/screens/HydrationDashboard.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/hydration/dashboard.tsx`
  - Imports: `import HydrationDashboard from '@ziko/plugin-hydration/screens/HydrationDashboard'`
- **New file target:** `plugins/hydration/src/screens/HydrationPlugin.tsx`
- **Import locations:** route wrapper + plugin index (check hydration/src/index.ts before deletion)

### Habits Plugin
- **Existing screen:** `plugins/habits/src/screens/HabitsDashboardScreen.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx`
  - Imports: `import HabitsDashboardScreen from '@ziko/plugin-habits/screens/HabitsDashboardScreen'`
- **Other screen to KEEP:** `HabitLogScreen.tsx` (reuse completion logic)
- **New file target:** `plugins/habits/src/screens/HabitsPlugin.tsx`

### AI Programs Plugin
- **Existing screen:** `plugins/ai-programs/src/screens/AIProgramsDashboard.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/ai-programs/dashboard.tsx`
  - Imports: `import AIProgramsDashboard from '@ziko/plugin-ai-programs/screens/AIProgramsDashboard'`
- **Other screens:** `GenerateProgram.tsx` (KEEP, reference only), `ImportFileScreen.tsx` (KEEP)
- **Navigate-to:** `apps/mobile/app/(app)/workout/ai-generate.tsx` — confirmed exists, do NOT modify
- **New file target:** `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx`

### Coach IA / Persona Plugin
- **Existing screen:** `plugins/persona/src/screens/PersonaCustomizeScreen.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/persona/customize.tsx`
  - Imports: `import PersonaCustomizeScreen from '@ziko/plugin-persona/screens/PersonaCustomizeScreen'`
- **Plugin index:** `plugins/persona/src/index.ts` — exports `PersonaCustomizeScreen`, `usePersonaStore`, `buildPersonaSystemPrompt`
- **Legacy storage:** Screen currently saves to `persona_settings` table (separate table, not `user_profiles.settings`)
- **New file target:** `plugins/persona/src/screens/CoachIAPlugin.tsx`

### Community Plugin
- **Existing screen:** `plugins/community/src/screens/CommunityDashboard.tsx` [VERIFIED: codebase]
- **Route wrapper:** `apps/mobile/app/(app)/(plugins)/community/dashboard.tsx`
  - Imports: `import CommunityDashboard from '@ziko/plugin-community/screens/CommunityDashboard'`
- **Plugin index:** `plugins/community/src/index.ts` — exports `CommunityDashboard` + 8 other sub-screens
- **Sub-screens to keep UNTOUCHED:** `ChallengeDetailScreen`, `ChallengesScreen`, `ChatListScreen`, `CommunityDashboard`, `CompareScreen`, `ConversationScreen`, `CreateChallengeScreen`, `FriendsScreen`, `GroupsScreen`, `InviteScreen`, `PostDetailScreen`
- **New file target:** `plugins/community/src/screens/CommunityPlugin.tsx`

### Import verification note
The grep for imports shows that on the main branch, each old dashboard is only imported in two places: the route wrapper file and the plugin's `src/index.ts` barrel. Worktrees (`.claude/worktrees/` and `.worktrees/`) also contain these files but are isolated branches — they do not affect the main-branch deletion check. Before deleting any old file, grep the main branch for the old class/function name to confirm zero remaining imports.

---

## Q2: `ai_generated_programs` Schema — `is_active` Column

**VERIFIED: migration 012_new_plugins_schema.sql line 100**

```sql
CREATE TABLE IF NOT EXISTS public.ai_generated_programs (
  ...
  goal          TEXT NOT NULL,
  ...
  program_data  JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  ...
);
```

The `is_active` BOOLEAN column exists. D-11 can be implemented directly with:
```typescript
// Réactiver: clear all active rows, then set this one
await supabase.from('ai_generated_programs').update({ is_active: false }).eq('user_id', userId);
await supabase.from('ai_generated_programs').update({ is_active: true }).eq('id', programId);
```

**No migration needed for this column.**

---

## Q3: `challenges` Table Schema

**VERIFIED: migration 009_community_schema.sql** [VERIFIED: codebase]

`challenges` table columns:
- `id` UUID PK
- `creator_id` UUID (auth.users)
- `title` TEXT NOT NULL
- `description` TEXT
- `type` TEXT — `'1v1'` or `'team'`
- `program_id` UUID nullable (workout_programs)
- `scoring` TEXT — `'volume'|'sessions'|'xp'|'habits'|'custom'`
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `status` TEXT — `'pending'|'active'|'completed'|'cancelled'`
- `prize_coins` INTEGER
- `created_at` TIMESTAMPTZ

**Join table: `challenge_participants`**
- `id` UUID PK
- `challenge_id` UUID (challenges)
- `user_id` UUID (auth.users)
- `team_id` UUID nullable (challenge_teams)
- `score` NUMERIC DEFAULT 0
- `status` TEXT — `'invited'|'joined'|'completed'`
- `joined_at` TIMESTAMPTZ

**Data for Défis tab progress bar:**
```typescript
// Active challenges the user is participating in
const { data } = await supabase
  .from('challenge_participants')
  .select(`
    score,
    challenge:challenges(id, title, type, scoring, start_date, end_date, status, prize_coins)
  `)
  .eq('user_id', userId)
  .eq('challenges.status', 'active');
```

Progress bar: `score / targetScore` where `targetScore` is derived from `scoring` type and date range (e.g. for `'sessions'` scoring: expected sessions = days_total × (user's workout_frequency or default 3/week ÷ 7)). Days remaining = `end_date - today`.

---

## Q4: Community Groups Schema — CONFIRMED ABSENT

**VERIFIED: migration 009_community_schema.sql** — no `groups`, `community_groups`, or similar table exists. [VERIFIED: codebase]

Tables that DO exist in migration 009: `friendships`, `app_invites`, `community_conversations`, `conversation_members`, `community_messages`, `screen_reactions`, `shared_programs`, `group_workouts`, `group_workout_participants`, `challenges`, `challenge_teams`, `challenge_participants`, `xp_gifts`, `coin_gifts`, `habit_encouragements`, `community_user_stats`.

**Conclusion:** The Groupes tab MUST render the empty state: "Groupes bientôt disponibles". The existing `GroupsScreen.tsx` sub-screen is in scope to keep but is not relevant to Phase 37 (it's the old dedicated screen, not related to the new entrypoint Groupes tab).

---

## Q5: Friendships Schema for Fil Tab

**VERIFIED: migration 009_community_schema.sql** [VERIFIED: codebase]

`friendships` columns: `id`, `requester_id`, `addressee_id`, `status` (`'pending'|'accepted'|'blocked'`), `created_at`, `updated_at`.

**Important:** The friendship uses `requester_id` + `addressee_id`, NOT `user_id` + `friend_id`. To find all friends of a user, both columns must be checked:

```typescript
// Fil tab: get friend IDs, then fetch their recent workout sessions
const { data: friendships } = await supabase
  .from('friendships')
  .select('requester_id, addressee_id')
  .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  .eq('status', 'accepted');

const friendIds = friendships?.map(f =>
  f.requester_id === userId ? f.addressee_id : f.requester_id
) ?? [];

// Then fetch recent sessions from these friends
const { data: sessions } = await supabase
  .from('workout_sessions')
  .select('id, name, user_id, started_at, total_duration_seconds, total_volume_kg, user_profiles(name)')
  .in('user_id', friendIds)
  .order('started_at', { ascending: false })
  .limit(20);
```

RLS policy on `friendships` allows SELECT where `auth.uid() IN (requester_id, addressee_id)` — the `.or()` query works within RLS. `workout_sessions` RLS needs to allow reading friend sessions; check if policy is `user_id = auth.uid()` only — if so, the friend feed query will return empty. This is a **potential RLS gap** — the planner should include a task to verify RLS on `workout_sessions` allows reading sessions where `user_id IN (friend_ids)`, or add a `read_friends_sessions` policy.

---

## Q6: `fetchUserContext()` Current Implementation

**VERIFIED: backend/api/src/context/user.ts** [VERIFIED: codebase]

Current `fetchUserContext()` fetches from `user_profiles` selecting: `name, age, weight_kg, height_cm, goal, units` — **does NOT read `settings`**.

The `buildSystemPrompt()` function in `backend/api/src/routes/ai.ts` assembles sections: BASE_SYSTEM + User Profile + Today's Snapshot + Recent Workouts + Active Plugins.

**Where to add persona injection (D-09):**

1. In `user.ts`: add `settings` to the `user_profiles` select, add `ai_persona?: string | null` to `UserContext` interface:
```typescript
// In fetchUserContext():
db.from('user_profiles')
  .select('name, age, weight_kg, height_cm, goal, units, settings')
  .eq('id', userId)
  .single(),
// In return:
profile: {
  ...,
  ai_persona: (profileRes.data?.settings as any)?.ai_persona ?? null,
}
```

2. In `routes/ai.ts`, inside `buildSystemPrompt()`, add after User Profile section:
```typescript
if (userCtx.profile?.ai_persona) {
  sections.push(`## Coaching Persona\nYou are coaching as "${userCtx.profile.ai_persona}". Adopt this persona's communication style throughout this conversation.`);
}
```

The `UserContext` interface in `user.ts` must be extended. The `buildSystemPrompt` function receives the whole `UserContext` object so the injection is straightforward.

---

## Q7: Persona Current State

**VERIFIED: plugins/persona/src/screens/PersonaCustomizeScreen.tsx** [VERIFIED: codebase]

The current `PersonaCustomizeScreen` is a custom freeform AI coach builder (NOT the 4-persona Max/Zoé/Léo/Rio selector from the mockup). It saves to **`persona_settings` table** (separate table) with columns: `agent_name`, `traits TEXT[]`, `habits TEXT[]`, `backstory`, `system_prompt_addition`, `coaching_style`.

**Key differences from Phase 37 target:**
- Currently: free-form agent name + trait chips + backstory textarea + coaching style cards (4 preset styles)
- Phase 37 target: 4 fixed persona cards (Max/Zoé/Léo/Rio with descriptions) saved as a single string to `user_profiles.settings.ai_persona`
- The existing `persona_settings` table is **legacy** — Phase 37 does not migrate its data; it saves the new simplified selection to `user_profiles.settings`

The existing `usePersonaStore` from `plugins/persona/src/store.ts` and `buildPersonaSystemPrompt()` are legacy and will NOT be used in the new `CoachIAPlugin.tsx`. The new screen reads/writes `user_profiles.settings` directly via Supabase.

The 4 persona definitions for the new screen (from CONTEXT.md § Specific Ideas):
- **Max** — persona card, orange initials circle
- **Zoé** — persona card, violet initials circle
- **Léo** — persona card
- **Rio** — persona card

These are defined inline in the new screen component (no external data source needed).

---

## Q8: Phase 36 Patterns — SubTabs + Real Data Wiring

**VERIFIED: .planning/workstreams/milestone-mobile/phases/36-workout-stack-redesign/36-04-PLAN.md** [VERIFIED: codebase]

### SubTabs internal state pattern (established Phase 36):
```typescript
const [activeTab, setActiveTab] = useState<string>('Aujourd\'hui');
// ...
<SubTabs tabs={['Aujourd\'hui', 'Ajouter', 'Historique', 'Réglages']} active={activeTab} onChange={setActiveTab} />
{activeTab === 'Aujourd\'hui' && <TodayTab />}
{activeTab === 'Ajouter' && <AddTab />}
```

### TanStack Query pattern for Supabase (established Phases 33–36):
```typescript
const { data: session, isLoading, isError, refetch } = useQuery({
  queryKey: ['session', sessionId],
  queryFn: async () => {
    const { data } = await supabase.from('workout_sessions').select('*').eq('id', sessionId).single();
    return data;
  },
  enabled: !!sessionId,
});
```

### useMutation pattern for writes:
```typescript
const logMutation = useMutation({
  mutationFn: async (entry: { amount_ml: number }) => {
    const { error } = await supabase.from('hydration_logs').insert({ ...entry, user_id: userId, date: today });
    if (error) throw error;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hydration', today] }),
});
```

### Delete-after-verify pattern (Phase 36 WORK-10):
Before deleting old screen: grep codebase for import references → verify zero → delete → confirm build succeeds.

---

## Q9: Design System Components — Prop Signatures

**VERIFIED: packages/ui/src/components/** [VERIFIED: codebase]

### SubTabs.tsx
```typescript
interface SubTabsProps {
  tabs: string[];
  active: string;      // string — NOT index number
  onChange: (tab: string) => void;
}
```
**Current visual style:** underline indicator (bottom border 2px orange). **UI-SPEC requires update to pill container style.** The API (props) stays the same — only the render body changes.

Pill style update per 037-UI-SPEC.md §0:
```
Container: flexDirection row, gap 4, padding 4, backgroundColor rgba(28,26,23,0.05), borderRadius 12, marginBottom 16
Each tab: flex 1, paddingVertical 8, paddingHorizontal 8, borderRadius 8, fontSize 12, fontWeight 700
Active: backgroundColor #FFF, shadowOpacity 0.08, shadowRadius 4, elevation 1
Inactive: backgroundColor transparent, color muted
```

### AISuggestion.tsx
```typescript
interface AISuggestionProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tintColor?: string;   // defaults to theme.primary
}
```
**Missing from current implementation:** "Coach IA · suggestion" label above tip text (UI-SPEC §0 AISuggestion Rendering). The plan must include adding this label to the component body (label tier, fontWeight 700, uppercase, letterSpacing 0.06em).

### PluginHeader.tsx
```typescript
interface PluginHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  dark?: boolean;
}
```
Current implementation matches spec: 34×34 back button, borderRadius 11, `theme.text + '10'` bg. No changes needed.

### WeekStrip.tsx
```typescript
interface WeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  dotDates?: Set<string>;   // Set of 'yyyy-MM-dd' strings for dot indicators
}
```
Renders Mon–Sun of current week. Orange pill on selected day. Dot indicator for days with data.

---

## Q10: Credit Balance for Coach IA Header

**VERIFIED: apps/mobile/src/stores/creditStore.ts** [VERIFIED: codebase]

```typescript
import { useCreditStore } from 'apps/mobile/src/stores/creditStore';
// In CoachIAPlugin.tsx:
const balance = useCreditStore((s) => s.balance);
const fetchBalance = useCreditStore((s) => s.fetchBalance);
// In useEffect:
fetchBalance(session.access_token);
// In PluginHeader right prop:
right={<Text style={{ color: '#FF5C1A', fontSize: 13, fontWeight: '700' }}>⚡{balance}</Text>}
```

`useCreditStore` state includes: `balance: number`, `dailyEarned: number`, `dailyCap: number`, `resetTimestamp: string | null`. `fetchBalance(accessToken)` calls `GET /credits/balance`.

Import path from within a plugin screen: `import { useCreditStore } from '../../../../src/stores/creditStore'` (relative from `plugins/persona/src/screens/`) — or set up as an alias. Check other plugin files for the correct relative import depth.

---

## Critical Findings Summary

### CRITICAL-1: `user_profiles.settings` JSONB column is MISSING from migrations

`user_profiles` in migration 001 has NO `settings` column. The existing `profile/settings.tsx` already reads/writes `user_profiles.settings.notif_prefs` — this means the column was added outside the tracked migrations (likely manually or via a lost migration).

**Action required:** Plan 37-01 (or a Wave 0 pre-task before ALL plans) must add:
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
```
This migration must run before D-08 (coaching settings) and D-09 (persona injection) can be implemented. Since `profile/settings.tsx` already uses it in production, this is either already applied on the live DB (but undocumented in migrations/) or the app silently handles the missing column. Either way, a migration must be added to ensure schema consistency.

### CRITICAL-2: Persona migration — two storage systems conflict

The old `PersonaCustomizeScreen` saves to `persona_settings` table (a separate table with `agent_name`, `traits`, `coaching_style` etc.). Phase 37 saves persona to `user_profiles.settings.ai_persona`. These are two different storage locations for conceptually related data. The planner must note: Phase 37 does NOT migrate data from `persona_settings` to `user_profiles.settings`. The old `persona_settings` table continues to exist alongside the new storage — but `buildSystemPrompt` in `ai.ts` currently reads NOTHING from `persona_settings`. Phase 37's D-09 adds a new injection from `user_profiles.settings.ai_persona` only.

### CRITICAL-3: Community Fil tab — potential RLS gap on workout_sessions

`workout_sessions` RLS is: `USING (auth.uid() = user_id)` — users can only read their own sessions. The Fil tab requires reading friends' sessions. A supplementary RLS policy is needed:
```sql
CREATE POLICY "workout_sessions_friends_read" ON public.workout_sessions
  FOR SELECT USING (
    user_id IN (
      SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END
      FROM public.friendships
      WHERE auth.uid() IN (requester_id, addressee_id) AND status = 'accepted'
    )
  );
```
This migration must be part of Plan 37-06 (Community plan).

### CRITICAL-4: SubTabs needs visual update

The existing `SubTabs.tsx` uses an underline indicator style. Phase 37 requires a pill container style. Plan 37-01 or a shared Wave 0 task must update `packages/ui/src/components/SubTabs.tsx` body while keeping the prop API identical.

### CRITICAL-5: AISuggestion needs "Coach IA · suggestion" label

The existing `AISuggestion.tsx` does not render the "Coach IA · suggestion" label above the tip text that the UI-SPEC requires. This addition must be part of Plan 37-01 Wave 0 (shared component used by all 6 plugins).

---

## Standard Stack

| Library | Purpose | Status |
|---------|---------|--------|
| `react-native-svg` | SVG calorie ring, SVG bottle-fill | Already installed (Phase 32 FormRing) |
| `@tanstack/react-query` | useQuery / useMutation for all data | Already installed (Phases 33–36) |
| `@react-native-community/slider` | Calorie/macro sliders in Nutrition Réglages | Already installed (Phase 35) |
| `date-fns` | Date formatting, WeekStrip, heatmap | Already installed |
| `expo-router` | Navigation (router.push, router.back) | Already installed |
| `@ziko/ui` | SubTabs, AISuggestion, PluginHeader, WeekStrip | Already installed (Phase 32) |
| `@ziko/plugin-sdk` | useThemeStore, useTranslation, showAlert | Already installed |

No new packages needed for Phase 37.

---

## Architecture Patterns

### Single Entrypoint Pattern (D-01)
```typescript
// plugins/nutrition/src/screens/NutritionPlugin.tsx
export default function NutritionPlugin({ supabase }: { supabase: any }) {
  const [activeTab, setActiveTab] = useState<string>('Aujourd\'hui');
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Nutrition" onBack={router.back} right={...} />
      <SubTabs tabs={['Aujourd\'hui', 'Ajouter', 'Historique', 'Réglages']} active={activeTab} onChange={setActiveTab} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
        {activeTab === 'Aujourd\'hui' && <TodayTab supabase={supabase} />}
        {activeTab === 'Ajouter' && <AddTab />}
        {activeTab === 'Historique' && <HistoriqueTab supabase={supabase} />}
        {activeTab === 'Réglages' && <ReglagesTab supabase={supabase} />}
      </ScrollView>
    </View>
  );
}
```

### Route Wrapper Update Pattern
Each route wrapper must be updated to import the new screen name:
```typescript
// apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx
import NutritionPlugin from '@ziko/plugin-nutrition/screens/NutritionPlugin';
export default function NutritionDashboardRoute() {
  return <NutritionPlugin supabase={supabase} />;
}
```

### user_profiles.settings JSONB Read/Write Pattern
Established in `apps/mobile/app/(app)/profile/settings.tsx`:
```typescript
// Read
const { data } = await supabase.from('user_profiles').select('settings').eq('id', userId).single();
const aiPersona = (data as any)?.settings?.ai_persona ?? null;

// Write (merge with existing)
const { data: fresh } = await supabase.from('user_profiles').select('settings').eq('id', userId).single();
const current = (fresh as any)?.settings ?? {};
await supabase.from('user_profiles').update({ settings: { ...current, ai_persona: 'Max' } }).eq('id', userId);
```

### Fil Tab Friend Feed Query
```typescript
// 1. Get friend IDs (both directions)
const { data: friendships } = await supabase
  .from('friendships')
  .select('requester_id, addressee_id')
  .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  .eq('status', 'accepted');

const friendIds = (friendships ?? []).map(f =>
  f.requester_id === userId ? f.addressee_id : f.requester_id
);

// 2. Fetch recent sessions (requires RLS policy update — see CRITICAL-3)
const { data: sessions } = await supabase
  .from('workout_sessions')
  .select('id, name, user_id, started_at, total_duration_seconds, total_volume_kg, user_profiles!inner(name)')
  .in('user_id', friendIds)
  .order('started_at', { ascending: false })
  .limit(20);
```

### Persona Injection in fetchUserContext + buildSystemPrompt
```typescript
// user.ts — extend profile select
db.from('user_profiles').select('name, age, weight_kg, height_cm, goal, units, settings')

// Return type — add to profile object:
ai_persona: (profileRes.data?.settings as any)?.ai_persona ?? null

// ai.ts — add section in buildSystemPrompt:
if (userCtx.profile?.ai_persona) {
  sections.push(`## Coaching Persona\nYou are ${userCtx.profile.ai_persona}, a dedicated fitness coach persona. Maintain this character consistently.`);
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Segmented tabs | Custom tab bar | `SubTabs` from `@ziko/ui` |
| AI tip card | Custom styled box | `AISuggestion` from `@ziko/ui` |
| Plugin header | Custom header | `PluginHeader` from `@ziko/ui` |
| 7-day week strip | Custom day grid | `WeekStrip` from `@ziko/ui` |
| SVG ring | Canvas / custom | `react-native-svg` (Svg, Circle, G) |
| Sliders | Custom gesture | `@react-native-community/slider` |
| Destructive alerts | Custom modal | `showAlert` from `@ziko/plugin-sdk` |
| Credit balance | Direct API call | `useCreditStore` from creditStore.ts |

---

## Common Pitfalls

### Pitfall 1: Importing old dashboard in route wrapper after creating new screen
**What goes wrong:** New screen created, but route wrapper still imports old screen name. App shows old screen.
**Prevention:** Update route wrapper import in the same task as creating the new screen.

### Pitfall 2: Forgetting to update plugin's `src/index.ts` barrel
**What goes wrong:** Route wrapper's `@ziko/plugin-*` import resolves to old screen via barrel export.
**Prevention:** Update `src/index.ts` exports in same task as route wrapper update.

### Pitfall 3: Friendship query returns empty — wrong column names
**What goes wrong:** Query uses `user_id + friend_id` — columns don't exist; query silently returns empty.
**Prevention:** Use `requester_id + addressee_id` with `.or()` clause as documented in Q5.

### Pitfall 4: `user_profiles.settings` column missing in some environments
**What goes wrong:** `settings` column doesn't exist → Supabase returns error → persona save fails silently.
**Prevention:** Add `ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'` migration in Wave 0.

### Pitfall 5: SubTabs `active` prop passed as number instead of string
**What goes wrong:** `active={0}` fails type check; `active={'Aujourd\'hui'}` is correct.
**Prevention:** `useState<string>('Aujourd\'hui')` — string value matching the tabs array entry.

### Pitfall 6: Community Fil tab returns empty due to RLS on workout_sessions
**What goes wrong:** Friends' sessions are filtered by RLS; feed shows empty even with friends.
**Prevention:** Add `workout_sessions_friends_read` policy in Plan 37-06 Wave 0 migration.

### Pitfall 7: Persona storage mismatch — writing to wrong table
**What goes wrong:** New persona selection written to `persona_settings` table (old pattern) instead of `user_profiles.settings`.
**Prevention:** Use `supabase.from('user_profiles').update({ settings: { ...current, ai_persona: name } })` only.

---

## Environment Availability

All dependencies are already installed — no new packages required.

| Dependency | Status | Version |
|------------|--------|---------|
| react-native-svg | Installed (Phase 32) | Confirmed in use |
| @tanstack/react-query | Installed (Phase 33) | v5 |
| @react-native-community/slider | Installed (Phase 35) | Confirmed in use |
| date-fns | Installed | Confirmed in use |
| @ziko/ui components | Built (Phase 32) | SubTabs, AISuggestion, PluginHeader, WeekStrip |

---

## Open Questions

1. **`user_profiles.settings` column — is it already on the live database?**
   - What we know: Not in any tracked migration. Code in `profile/settings.tsx` uses it.
   - What's unclear: Was it added manually in production? Applied via a lost migration?
   - Recommendation: Add `IF NOT EXISTS` migration regardless — safe, idempotent.

2. **`workout_sessions` RLS — does a friends-read policy already exist?**
   - What we know: Base RLS is `user_id = auth.uid()` only (migration 001). No friends policy found.
   - What's unclear: Was one added in a later migration not checked?
   - Recommendation: Plan 37-06 explicitly verifies and adds if missing.

3. **`ai_conversations` RLS — can user query their own conversations list for Chat tab?**
   - What we know: Table exists, user_id column confirmed in migration 001.
   - Assumption: RLS policy is `user_id = auth.uid()` — standard pattern throughout codebase.
   - Recommendation: Executor verifies on first query attempt.

---

## Sources

All findings are [VERIFIED: codebase] — verified by direct file reads during this research session.

- `supabase/migrations/001_initial_schema.sql` — user_profiles, persona_settings, nutrition_logs, ai_conversations schemas
- `supabase/migrations/009_community_schema.sql` — friendships, challenges, challenge_participants, groups (absent) schemas
- `supabase/migrations/012_new_plugins_schema.sql` — ai_generated_programs.is_active column
- `backend/api/src/context/user.ts` — fetchUserContext full implementation
- `backend/api/src/routes/ai.ts` — buildSystemPrompt implementation
- `packages/ui/src/components/SubTabs.tsx` — prop signature, current underline style
- `packages/ui/src/components/AISuggestion.tsx` — prop signature, missing label
- `packages/ui/src/components/PluginHeader.tsx` — prop signature, confirmed correct
- `packages/ui/src/components/WeekStrip.tsx` — prop signature, dotDates Set pattern
- `apps/mobile/src/stores/creditStore.ts` — useCreditStore, balance, fetchBalance
- `apps/mobile/app/(app)/profile/settings.tsx` — user_profiles.settings JSONB read/write pattern
- `apps/mobile/app/(app)/(plugins)/*/` — all 6 route wrapper files
- `plugins/*/src/screens/` — all 6 existing dashboard screens
- `plugins/*/src/index.ts` — nutrition, persona, community barrel exports
- `plugins/persona/src/screens/PersonaCustomizeScreen.tsx` — legacy persona storage confirmed
- `.planning/workstreams/milestone-mobile/phases/36-workout-stack-redesign/36-04-PLAN.md` — TanStack Query + SubTabs patterns from Phase 36

# Phase 37: Priority Plugins Redesign - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the 6 priority plugins — **Nutrition, Hydration, Habits, AI Programs, Coach IA (Persona), Community** — to match the `plugins.jsx` canonical mockup. Each plugin ships: a new single-entrypoint screen with SubTabs, AISuggestion card with real rule-based content, and all fixture data replaced by TanStack Query hooks.

**In scope:** NutritionPlugin, HydrationPlugin, HabitsPlugin, AIProgramsPlugin, CoachIAPlugin (Persona + Chat), CommunityPlugin entrypoint. Backend change to `fetchUserContext()` for persona injection.

**Out of scope:** `session.tsx` (active workout — never touched), community sub-screens beyond the entrypoint (ChatListScreen, FriendsScreen, GroupsScreen, etc. stay as-is), any new backend routes beyond user.ts persona injection, Générer wizard duplication (navigate to existing ai-generate.tsx).

</domain>

<decisions>
## Implementation Decisions

### Plugin Screen Structure

- **D-01:** Each plugin uses a **single entrypoint file** with internal SubTabs state (e.g., `NutritionPlugin.tsx`). All tab content rendered inline via conditional on `activeTab`. Pattern from Phase 36 (ExerciseDetail 3-tab, ProgramDetail 2-tab). No Expo Router per-tab routing.
- **D-02:** **Nutrition "Ajouter" tab** = quick-add shortcuts row (scanner / Photo IA / recent items) + a CTA that navigates to the existing `LogMealScreen.tsx` for the full add flow. The tab does NOT embed LogMealScreen inline.
- **D-03:** Existing dashboard files (`NutritionDashboard.tsx`, `HydrationDashboard.tsx`, `HabitsDashboardScreen.tsx`, `AIProgramsDashboard.tsx`, `PersonaCustomizeScreen.tsx`) are **deleted** after replacement. Each plan verifies zero remaining imports before deletion. No stub files.

### Community Scope

- **D-04:** Phase 37 redesigns **only `CommunityDashboard.tsx`** — the plugin entrypoint — with 3 SubTabs (Fil / Défis / Groupes) and real data wiring. Existing sub-screens (ChatListScreen, FriendsScreen, GroupsScreen, PostDetailScreen, InviteScreen, ChallengeDetailScreen, ConversationScreen, CompareScreen) stay untouched.
- **D-05:** **Fil tab** = activity feed where each card represents a **friend's completed workout session**: friend name, workout name, duration, XP gained, ago-time. Data: `workout_sessions` JOIN `friendships` (user_id = friend). Aligns with PLUG-COM-02.
- **D-06:** **Groupes tab** = real data if a groups table exists in migration 009 schema; otherwise a clean empty state: "Groupes bientôt disponibles" with a future CTA. Researcher confirms schema at plan time.

### Coach IA / Persona (PLUG-CIA)

- **D-07:** **Chat tab** shows the user's `ai_conversations` list. Tapping a conversation opens a full `AIChatDetailScreen` using existing AIBridge SSE streaming. Credit chip ⚡N shown in the plugin header. No simplified/inline chat — full existing streaming.
- **D-08:** **Coaching settings** (language, coaching style, response length from PLUG-CIA-04) saved to `user_profiles.settings JSONB`. Keys: `ai_language`, `ai_coaching_style`, `ai_response_length`. Pattern from Phase 35 NotifSubScreen.
- **D-09:** **Persona selection** (Max / Zoé / Léo / Rio) saved to `user_profiles.settings.ai_persona`. The Hono AI orchestrator's `fetchUserContext()` in `backend/api/src/context/user.ts` reads this field and injects the persona name into the system prompt. **This is a backend change** within Phase 37 scope — no new endpoint needed, piggybacks on existing user context injection.

### AI Programs (PLUG-AI)

- **D-10:** **"Générer" tab** = a launch card showing last-program metadata + "Générer un programme" CTA that navigates to the existing `apps/mobile/app/(app)/workout/ai-generate.tsx`. No wizard duplication. Same AIGenerator built in Phase 36.
- **D-11:** **"Réactiver"** on a past `ai_generated_programs` row sets an `is_active` boolean (or equivalent flag) on that row and clears it on previously-active rows. Programme tab always shows the currently-active row. Researcher confirms the column name in the existing schema.
- **D-12:** **"Prochaine séance" CTA** on the Programme tab navigates to `apps/mobile/app/(app)/workout/session.tsx` (the active workout session screen). Consistent with Workout Stack flow from Phase 36.

### Claude's Discretion

- SVG bottle-fill visualization approach (Hydration plugin PLUG-H-01) — React Native SVG polygon or linear gradient clip approach
- AISuggestion rule-based content per plugin: rules are specified in REQUIREMENTS (e.g., PLUG-N-06: protein < 30% goal → suggest protein boost) — implement exactly as written
- Calendar heatmap component for Habits Historique tab (PLUG-HAB-03) — build inline or extract as shared component; Claude decides based on complexity
- Défis tab progress bar data structure — derive from `challenges` table schema found in migration 009

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mockup Files (source of truth for all 6 plugins)
- `C:/Users/Anatholy/Downloads/ziko/plugins.jsx` — all 6 priority plugins (Nutrition, Hydration, Habits, AI Programs, Coach IA/Persona, Community) — primary visual reference
- `C:/Users/Anatholy/Downloads/ziko/plugins-2.jsx` — reference only (Phase 38 plugins, do NOT implement)

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-N — PLUG-N-01–07 (Nutrition)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-H — PLUG-H-01–05 (Hydration)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-HAB — PLUG-HAB-01–06 (Habits)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-AI — PLUG-AI-01–06 (AI Programs)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-CIA — PLUG-CIA-01–05 (Coach IA / Persona)
- `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` §PLUG-COM — PLUG-COM-01–05 (Community)
- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 37 — success criteria + 7-plan breakdown

### Existing Screens (to replace or reference)
- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — REPLACE with single entrypoint
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — KEEP; navigate to from Ajouter tab
- `plugins/nutrition/src/screens/TDEECalculatorScreen.tsx` — KEEP; Réglages tab can link to it
- `plugins/nutrition/src/components/ScoreBadge.tsx` — KEEP; reuse in redesign
- `plugins/habits/src/screens/HabitsDashboardScreen.tsx` — REPLACE
- `plugins/habits/src/screens/HabitLogScreen.tsx` — KEEP; reuse completion logic
- `plugins/hydration/src/screens/HydrationDashboard.tsx` — REPLACE
- `plugins/ai-programs/src/screens/AIProgramsDashboard.tsx` — REPLACE
- `plugins/ai-programs/src/screens/GenerateProgram.tsx` — KEEP (reference only)
- `plugins/persona/src/screens/PersonaCustomizeScreen.tsx` — REPLACE with CoachIA 2-tab entrypoint
- `plugins/community/src/screens/CommunityDashboard.tsx` — REPLACE (entry point only)

### Existing Routes (navigate-to, do NOT modify)
- `apps/mobile/app/(app)/workout/ai-generate.tsx` — AIGenerator wizard; navigate to from AI Programs "Générer" tab
- `apps/mobile/app/(app)/workout/session.tsx` — Active workout session; navigate to from "Prochaine séance" CTA

### Backend (persona wiring)
- `backend/api/src/context/user.ts` — `fetchUserContext()` needs persona name injection from `user_profiles.settings.ai_persona`

### Design System (all built in Phase 32)
- `packages/ui/src/components/SubTabs.tsx` — segmented tab bar (all 6 plugins)
- `packages/ui/src/components/AISuggestion.tsx` — AI tip card (all 6 plugins)
- `packages/ui/src/components/PluginHeader.tsx` — plugin header with optional right element
- `packages/ui/src/components/WeekStrip.tsx` — 7-day strip (Habits, Hydration)

### Database Tables
- `nutrition_logs` — PLUG-N-02, N-04, N-07
- `hydration_logs` — PLUG-H-01, H-02, H-05
- `habits` + `habit_logs` — PLUG-HAB-02, HAB-03, HAB-06
- `ai_generated_programs` — PLUG-AI-01 through AI-06 (researcher confirms `is_active` column)
- `ai_conversations` + `ai_messages` — PLUG-CIA-02, CIA-05
- `user_profiles.settings JSONB` — persona + coaching prefs (D-08, D-09)
- `friendships` + `workout_sessions` — PLUG-COM-02 (Fil tab)
- `challenges` — PLUG-COM-03 (migration 009 schema — researcher confirms)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ui/SubTabs` — import and use in every plugin entrypoint; `tabs: string[]`, `active`, `onChange` props
- `packages/ui/AISuggestion` — import for the AI tip card; `body`, optional `actionLabel + onPress` props
- `packages/ui/PluginHeader` — standard header with title + optional right element
- `packages/ui/WeekStrip` — 7-day grid; use in Habits Historique tab
- `plugins/nutrition/src/components/ScoreBadge.tsx` — reusable Nutri-Score badge in Nutrition redesign
- `apps/mobile/app/(app)/workout/ai-generate.tsx` — full AIGenerator wizard; navigate to, do NOT copy
- `apps/mobile/src/stores/workoutStore.ts` — `recentSessions`, `loadRecentSessions` available for AI Programs Programme tab

### Established Patterns
- **NativeWind v4** — all styling via className strings; no StyleSheet
- **TanStack Query** — `useQuery`/`useMutation` for all Supabase fetches (from Phases 33–36)
- **`showAlert`** from `@ziko/plugin-sdk` — required in all plugin screens (not `Alert.alert`)
- **`paddingBottom: 100`** on all ScrollViews for tab bar clearance
- **Design tokens** via `useThemeStore((s) => s.theme)` — `theme.primary (#FF5C1A)`, `theme.background (#F7F6F3)`, `theme.surface`, `theme.text`, `theme.muted`, `theme.border`
- **Single entrypoint + internal SubTabs** — `const [activeTab, setActiveTab] = useState(0)` + conditional rendering; established in Phase 36 (ExerciseDetail, ProgramDetail)
- **Delete-after-verify** — grep for imports before deleting old screen files (from Phase 36 WORK-10 pattern)

### Integration Points
- Plugin route files in `apps/mobile/app/(app)/(plugins)/<plugin>/` — thin wrappers; may need updating when dashboard file names change
- `backend/api/src/context/user.ts` `fetchUserContext()` — add persona name lookup from `user_profiles.settings.ai_persona`
- `ai_generated_programs` `is_active` flag — researcher confirms schema; if column absent, add migration

</code_context>

<specifics>
## Specific Ideas

- **Nutrition calorie ring**: SVG ring (consumed/goal ratio) with orange fill — same approach as FormRing from Phase 32 (4 segments); single segment here
- **Hydration bottle fill**: SVG polygon or `clip-path` approach using blue gradient fill level = today_ml / goal_ml ratio
- **Habits calendar heatmap**: 30-day grid, orange intensity by completion rate — build inline in Habits entrypoint (not a shared component)
- **Community Fil tab**: activity cards in orange accent on friend name, gray for timestamps — consistent with existing card shadow pattern (`shadowOpacity: 0.08, radius: 12, elevation: 3`)
- **Coach IA persona cards**: initials circle (orange background), description text, orange ring on selected state — 4 cards in 2×2 grid

</specifics>

<deferred>
## Deferred Ideas

- Full community sub-screens redesign (ChatListScreen, FriendsScreen, GroupsScreen, PostDetailScreen, InviteScreen, ChallengeDetailScreen) — deferred to Phase 40 (Extra Screens) or a future community-specific phase
- Persona coaching style effect on AI response quality (prompt engineering beyond name injection) — deferred; Phase 37 only injects persona name
- Community Groupes real implementation (if table doesn't exist) — deferred to when feature is built out

</deferred>

---

*Phase: 37-priority-plugins-redesign*
*Context gathered: 2026-05-25*

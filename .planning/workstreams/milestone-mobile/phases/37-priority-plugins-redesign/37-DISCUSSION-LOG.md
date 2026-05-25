# Phase 37: Priority Plugins Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 37-priority-plugins-redesign
**Areas discussed:** Plugin screen structure, Community scope, Coach IA embedded chat, AI Programs / Workout overlap

---

## Plugin Screen Structure

**Q1: Tab structure per plugin**

| Option | Description | Selected |
|--------|-------------|----------|
| Single entrypoint (Recommended) | One file with internal SubTabs state. Pattern from Phase 36. | ✓ |
| Keep separate screens + wrapper | Existing screens stay as files; SubTabs wrapper routes between them. | |
| Mix: single where possible | Simple plugins → single file; complex → keep sub-screens. | |

**User's choice:** Single entrypoint (Recommended)

---

**Q2: Nutrition "Ajouter" tab**

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to LogMealScreen (Recommended) | Quick-add shortcuts + CTA pushes to full LogMealScreen. | ✓ |
| Embed LogMealScreen inline | Full add flow inside Ajouter tab; entrypoint gets large. | |

**User's choice:** Navigate to LogMealScreen (Recommended)

---

**Q3: Old dashboard file disposal**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete old screens (Recommended) | Clean replacement; verify imports before deletion. | ✓ |
| Keep as stubs temporarily | Old files stay as empty re-exports. | |

**User's choice:** Delete old screens (Recommended)

---

## Community Scope

**Q1: What gets redesigned**

| Option | Description | Selected |
|--------|-------------|----------|
| Entry point only (Recommended) | Only CommunityDashboard.tsx redesigned with 3 SubTabs. Sub-screens stay as-is. | ✓ |
| Dashboard + 3 primary sub-screens | Dashboard + GroupsScreen + ChallengesScreen + social Fil. | |
| Full community redesign | All 11 screens redesigned. Significantly larger scope. | |

**User's choice:** Entry point only (Recommended)

---

**Q2: Fil tab activity card type**

| Option | Description | Selected |
|--------|-------------|----------|
| Workout session completed (Recommended) | Cards: friend name, workout, duration, XP, ago-time. workout_sessions JOIN friendships. | ✓ |
| Any activity (workout + habit + milestone) | More varied; more DB queries. | |
| You decide | Claude picks. | |

**User's choice:** Workout session completed (Recommended)

---

**Q3: Groupes tab data**

| Option | Description | Selected |
|--------|-------------|----------|
| Real data if table exists, empty state if not (Recommended) | Researcher checks migration 009. Empty state if no groups table. | ✓ |
| Empty state only | Always placeholder; community groups deferred. | |

**User's choice:** Real data if table exists, empty state if not (Recommended)

---

## Coach IA Embedded Chat

**Q1: What "embedded AIChatScreen" means**

| Option | Description | Selected |
|--------|-------------|----------|
| Conversation list + active thread (Recommended) | ai_conversations list; tap opens AIChatDetailScreen with AIBridge SSE. Credit chip in header. | ✓ |
| Single active conversation only | Always one embedded conversation (latest). | |
| Redirect to standalone AIChatScreen | Chat tab = launcher card navigating to Phase 40 screen. | |

**User's choice:** Conversation list + active thread (Recommended)

---

**Q2: Coaching settings persistence**

| Option | Description | Selected |
|--------|-------------|----------|
| user_profiles.settings JSONB (Recommended) | Reuses existing JSONB column. Keys: ai_language, ai_coaching_style, ai_response_length. | ✓ |
| Separate ai_preferences table | New table; needs migration. | |
| ai_conversations metadata JSONB | Per-conversation persona; changes per session. | |

**User's choice:** user_profiles.settings JSONB (Recommended)

---

**Q3: Persona selection and system prompt**

| Option | Description | Selected |
|--------|-------------|----------|
| Visual only in Phase 37 (Recommended) | Saved to user_profiles.settings; system prompt NOT modified. | |
| Wire persona to system prompt | fetchUserContext() reads persona and injects name into system prompt. | ✓ |

**User's choice:** Wire persona to system prompt
**Notes:** User explicitly chose to wire persona to the system prompt — not just visual. Follow-up resolved this as: save `ai_persona` to `user_profiles.settings JSONB`, have Hono `fetchUserContext()` read and inject persona name. No new endpoint needed.

---

**Q4: Backend wiring approach**

| Option | Description | Selected |
|--------|-------------|----------|
| user_profiles + backend reads it (Recommended) | Mobile saves to user_profiles.settings.ai_persona; fetchUserContext() injects into system prompt. | ✓ |
| New PATCH /ai/persona endpoint | Dedicated endpoint; clean separation but extra route. | |

**User's choice:** user_profiles + backend reads it (Recommended)

---

## AI Programs / Workout Overlap

**Q1: AIGenerator in the plugin**

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to ai-generate.tsx (Recommended) | Générer tab = launch card + CTA pushes to existing workout/ai-generate. No duplication. | ✓ |
| Embed wizard inline in the plugin | Duplicate/import wizard steps; independent but code duplication. | |

**User's choice:** Navigate to ai-generate.tsx (Recommended)

---

**Q2: "Réactiver" behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| Set as active program (Recommended) | Sets is_active flag on selected row; clears others. Programme tab shows active row. | ✓ |
| Duplicate + set as active | Creates a copy with today's date; preserves history untouched. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Set as active program (Recommended)

---

**Q3: "Prochaine séance" CTA navigation**

| Option | Description | Selected |
|--------|-------------|----------|
| To workout/session.tsx (active session) (Recommended) | Starts workout session directly. Consistent with Phase 36 flow. | ✓ |
| To workout/index.tsx (Séance tab) | Shows program detail; user starts from there. | |
| You decide | Claude picks most natural path. | |

**User's choice:** To workout/session.tsx (Recommended)

---

## Claude's Discretion

- SVG bottle-fill visualization approach (Hydration PLUG-H-01) — polygon or clip-path
- Calendar heatmap (Habits PLUG-HAB-03) — build inline or extract; Claude decides based on complexity
- Défis tab data structure — derives from `challenges` schema in migration 009
- AISuggestion rules — implement exactly as written in REQUIREMENTS (e.g., PLUG-N-06 protein < 30%)

## Deferred Ideas

- Full community sub-screens redesign — deferred to Phase 40 or future phase
- Persona prompt engineering beyond name injection — deferred; Phase 37 injects name only
- Community Groupes real implementation if table doesn't exist — deferred until feature built out

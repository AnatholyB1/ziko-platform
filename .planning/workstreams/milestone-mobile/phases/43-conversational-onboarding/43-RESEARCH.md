# Phase 43: Conversational Onboarding - Research

**Researched:** 2026-09-01
**Domain:** AI SDK v6 interactive agentic turn (onboarding chat) + Postgres SECURITY DEFINER write path + mobile auth-gated flow insertion, on top of an already-shipped `athlete_state`/`athlete_decisions` foundation (Phase 42, live in production)
**Confidence:** HIGH — this phase is almost entirely composition of already-shipped, directly-inspected code (Phase 42's live RPC, `routes/ai.ts`, `context/conversation.ts`, `tools/registry.ts`, `PluginLoader.tsx`, `(auth)/_layout.tsx`, `step-7.tsx`). The two genuinely open technical questions (credit-gating the mandatory chat, and the missing per-athlete locale source) are flagged LOW/MEDIUM and require a product decision, not further research.

## Summary

Phase 43 has no new-technology risk — `ai` v6, `@ai-sdk/anthropic`, Hono, and Supabase Postgres are already wired for exactly this shape of work (`routes/ai.ts`'s existing `/ai/chat/stream`, `context/conversation.ts`, `tools/registry.ts`). The real work is: (1) a new onboarding-mode branch in `routes/ai.ts` with its own `stopWhen` constant and a purpose-built system prompt naming the 3 required signal categories; (2) a new `assess_profile` tool following the exact `AITool`/`parameters` JSON-Schema convention already used by every other tool in `tools/registry.ts` (not a raw Zod `inputSchema` — that conversion happens once, centrally, in `buildSDKTools()`); (3) a new mobile chat screen reusing `apps/mobile/app/(app)/ai/index.tsx`'s FlatList/markdown/streaming pattern, inserted into `step-7.tsx`'s `handleFinish()` before `router.replace('/(app)')`; (4) calling Phase 42's already-live `record_athlete_decision()` RPC — signature, return shapes, and `p_state_patch` keys are all confirmed from the migration file, no guessing required.

Three load-bearing findings emerged that are **not** covered by CONTEXT.md's decisions and must shape the plan:

1. **The mandatory-chat gate is currently unenforceable.** `(auth)/_layout.tsx` redirects to `/(app)` based solely on `profile.onboarding_done` (a `user_profiles` boolean), which `step-7.tsx` sets to `true` **before** the Ziko chat would run. If the app is killed mid-chat, the athlete reopens the app and lands straight in `/(app)`, skipping the mandatory conversation entirely — directly contradicting D-02. The gate must be changed to also require `athlete_state.status !== 'onboarding'` (equivalently: an `athlete_state` row exists with `status = 'active'`).
2. **There is no per-athlete persisted app locale anywhere in the stack.** `useI18nStore` (`packages/plugin-sdk/src/i18n.ts`) defaults to `'fr'` and is never written to by any code in the mobile app (`setLocale` has zero call sites) — `user_profiles` has no `locale` column either. D-11's "AI generates in the athlete's stored app locale" premise has no data source to read from; the mobile client must pass its local `useI18nStore` locale explicitly in the onboarding chat request body, it cannot be looked up server-side.
3. **Gating the mandatory onboarding chat behind the standard `chat` credit cost is very likely to strand new athletes.** `CREDIT_COSTS.chat = 4`, `DAILY_QUOTAS.chat = { base: 1, bonus: 2 }`, and `user_ai_credits.balance` starts at `0` for a brand-new signup — a fresh athlete with zero activity has no way to earn the "bonus" credits before their first message. A mandatory, no-skip flow (D-02) cannot depend on a credit balance the athlete has no way to have yet.

**Primary recommendation:** Treat Phase 43 as three small, independently-verifiable slices — (a) backend: onboarding branch + `assess_profile` tool + `ONBOARDING_MAX_STEPS` constant, uncredited/exempt from `creditCheck`; (b) mobile: new screen + wired into `step-7.tsx` + auth-gate fix; (c) retroactive recompute: one lazy check added to the existing app-open profile-refresh path. All three write through the single, already-hardened `record_athlete_decision()` RPC — no new write path, no new migration required for the core mechanism.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ziko chat UI (bubbles, streaming, mission card, celebration) | Browser / Client (Expo/RN) | — | Pure presentation + local animation state, reuses `ai/index.tsx` pattern |
| Onboarding conversation orchestration (system prompt, `stopWhen`, tool loop) | API / Backend (Hono) | — | `routes/ai.ts` already owns all chat orchestration; onboarding is a new branch, not a new tier |
| `assess_profile` extraction + evidence assembly | API / Backend | — | Tool executor must independently query `athlete_state`/onboarding answers server-side before writing — never trust client-asserted profile fields |
| Starting `athlete_state` write | Database (Postgres RPC) | API / Backend (caller) | `record_athlete_decision()` is the sole write path (Phase 42, DB-enforced via REVOKE); backend only ever calls it, never writes the tables directly |
| Conversation persistence (`ai_conversations`/`ai_messages`) | Database / Storage | API / Backend | Existing `context/conversation.ts` functions, reused as-is |
| Mandatory-flow gate (no-skip enforcement) | Browser / Client (`(auth)/_layout.tsx`) | Database (source of truth: `athlete_state.status`) | Client reads a DB-backed status, but the *decision* of "can this athlete reach `/(app)`" is a client-side route guard — must not rely on a client-only flag (`profile.onboarding_done`) as the sole gate |
| Micro-action completion detection | Browser / Client (`useFocusEffect` re-poll) | Database (real per-domain log table) | Same tier split as every other "did the user actually do X" check in this codebase — client triggers the re-check, DB is the source of truth, never a client-only "I did it" flag |
| Retroactive recompute trigger | Browser / Client (app-open hook) | API / Backend (the actual AI computation) | Mirrors the v1.4 lazy-daily-reset precedent: client-side trigger on a cheap read, backend does the real work |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBOARD-01 | ≤4 free-text questions, mascotte-led, complementing the existing 7-step flow | `stopWhen` constant + onboarding system-prompt branch in `routes/ai.ts` (see Code Examples); existing chat UI pattern in `ai/index.tsx` |
| ONBOARD-02 | AI infers experience/confidence/adherence-risk profile from free text, with self-reported per-attribute confidence | `assess_profile` tool `parameters` shape (see Code Examples); `onboarding_profile JSONB` column already exists on `athlete_state` (Phase 42) |
| ONBOARD-03 | Micro-action within 5 minutes, adapted to inferred profile | Curated 3-action pool (hydration/journal/measurements — manifests + routes confirmed below); mission-card CTA deep-links via existing Expo Router paths, no new screens needed |
| ONBOARD-04 | Completing the micro-action triggers a mascotte + animation celebration | `useFocusEffect` re-poll pattern already precedented in `ai/index.tsx` (credit balance refetch-on-focus); `FadeInUp.springify().damping(12)` reusable from `step-7.tsx`'s `OBReady` |
| ONBOARD-05 | Onboarding writes starting level/palier/focus to `athlete_state` | `record_athlete_decision()` — confirmed live signature, `p_state_patch` keys `level`/`tier`/`current_focus_summary`/`onboarding_profile`/`status`/`readiness` all accepted (see Code Examples) |
| ONBOARD-06 | Pre-v1.18 athletes get a retroactively AI-computed starting level on next app open, never a flat default | Lazy trigger point identified in `authStore.refreshProfile()`/root layout (see Architecture Patterns); real-activity query shape modeled on `context/user.ts`'s `fetchUserContext()` |

## Standard Stack

### Core (all already installed — apply, add nothing)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^6.0.116` | `streamText`/`generateText`, `stopWhen`, `tool()`, `jsonSchema()` | Already the exact mechanism `routes/ai.ts` uses for `/ai/chat/stream`; onboarding is a same-shaped branch, not new infrastructure |
| `@ai-sdk/anthropic` | `^3.0.58` | Claude provider (`AGENT_MODEL`) | Same `AGENT_MODEL` constant (`claude-sonnet-4-20250514`) from `backend/api/src/config/models.ts` — no model change needed for this phase |
| Supabase Postgres (existing `athlete_state`/`athlete_decisions`, Phase 42) | live in production (`ziko`, ref `slkobhavpwsubnsmuhya`) | Starting-state storage, append-only journal | Already shipped, RLS-locked, RPC-gated — Phase 43 is purely a *caller* of this schema |
| Expo Router v6 / React Native 0.81 | existing | New onboarding screen route | Matches every other screen in `apps/mobile/app/` |
| `react-native-reanimated` | existing (already used in `step-7.tsx`) | Celebration entrance animation | `FadeInUp.springify().damping(12)` is a direct, already-proven reuse target |

**No new npm packages for this phase.** Confirm nothing has drifted from Phase 42's pinned versions:
```bash
npm view ai@6 version                  # confirm still 6.x-compatible with installed ^6.0.116
npm view @ai-sdk/anthropic@3 version   # confirm still 3.x-compatible with installed ^3.0.58
```
[VERIFIED: codebase] — both packages and their exact versions were directly confirmed present in `backend/api/package.json` per the milestone-level `STACK.md` research (2026-08-30), itself Context7-verified against `/vercel/ai` current docs.

### Supporting — none new required

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Reusing `routes/ai.ts` with a new branch | A fully separate `backend/api/src/onboarding/` route module | Rejected for this phase: the milestone's own `ARCHITECTURE.md` explicitly scopes onboarding as a *branch* inside `routes/ai.ts` (`buildSystemPrompt()` gains an onboarding-mode section when `athlete_state.status === 'onboarding'` or no row exists), not a parallel module — keep it that way unless the branch grows unmanageably complex |
| Reusing the existing chat conversation shape (`ai_conversations`/`ai_messages`, tagged via `plugin_context`) | A new dedicated `onboarding_conversations` table | Not needed — `ai_conversations.plugin_context JSONB` already exists and is already populated by the mobile `createConversation()` call (`aiStore.ts`); tag it `{ type: 'ziko_onboarding' }` instead of a schema change |
| `useFocusEffect` re-poll for micro-action completion (D-14, client-driven) | A dedicated backend "check completion" endpoint | Client-driven re-poll of the plugin's own table (e.g. `hydration_logs` via existing Supabase client + RLS) is simpler, matches the `ai/index.tsx` credit-balance precedent exactly, and needs no new backend route — recommended unless a cross-domain aggregation becomes necessary later |

**Installation:** none — no new packages.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new external packages (backend or mobile). No `npm install` step exists for this phase's core mechanism; skip the legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```
Athlete finishes 7-step onboarding
        │
        ▼
step-7.tsx OBReady "C'est parti" ──▶ handleFinish()
        │  upserts user_profiles (onboarding_done=true, goal/level/etc.)
        │  ⚠ MUST NOT router.replace('/(app)') directly anymore
        ▼
NEW: router.replace('/(auth)/onboarding/ziko-chat')  ◀── mandatory, no back button
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ Mobile: Ziko chat screen (reuses ai/index.tsx bubble/stream shape) │
│  - on mount: POST /ai/onboarding/stream (or /ai/chat/stream +      │
│    conversation_type flag — see Open Question 1) with locale       │
│  - resumes an existing 'ziko_onboarding'-tagged open conversation  │
│    if one exists (D-04 mid-flow resume)                            │
│  - streams Ziko's questions, athlete free-types answers            │
│  - final assistant message includes mission-card JSON payload      │
└───────────────────────────┬───────────────────────────────────────┘
                             │ SSE stream, same wire format as /ai/chat/stream
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│ Backend: routes/ai.ts — onboarding branch                          │
│  buildOnboardingSystemPrompt() — names 3 signal categories,        │
│    instructs Ziko voice (tutoiement, no emoji), athlete's locale   │
│    (passed from client body, see Open Question 2)                  │
│  stopWhen: [isStepCount(ONBOARDING_MAX_STEPS), hasToolCall(         │
│    'assess_profile')]                                              │
│  tools: { assess_profile } only — scope the tool surface down,     │
│    do not expose the full allToolSchemas registry to this turn     │
└───────────────────────────┬───────────────────────────────────────┘
                             │ tool call: assess_profile(input)
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│ assess_profile executor (backend/api/src/tools/onboarding.ts, NEW) │
│  - builds evidence JSONB from the conversation transcript          │
│    (the model's own extraction — this IS the evidence for an       │
│    onboarding_profile decision; there is no prior real-activity    │
│    data to re-verify against for a brand-new athlete)              │
│  - picks ONE micro-action from the curated 3-item pool based on    │
│    inferred readiness                                              │
│  - calls record_athlete_decision(                                  │
│      p_decision_type='onboarding_profile', p_source='onboarding_tool', │
│      p_state_patch={ level, tier, readiness, status:'active',      │
│        onboarding_profile, current_focus_summary })                │
└───────────────────────────┬───────────────────────────────────────┘
                             ▼
                 Supabase: record_athlete_decision() RPC (Phase 42, live)
                    - self-heals athlete_state row (INSERT ON CONFLICT DO NOTHING)
                    - patches level/tier/readiness/status/onboarding_profile
                    - journals the decision row (athlete_decisions)
                             │
                             ▼
        Mobile: mission card renders, athlete taps CTA
                             │  deep-link, e.g. router.push('/(plugins)/hydration/dashboard')
                             ▼
        Athlete logs (hydration_log / journal_log_mood / measurements_log)
                             │
                             ▼
        Ziko chat screen useFocusEffect() re-polls the real log table
                             │  row found for today? ──▶ full-screen celebration
                             ▼
                    router.replace('/(app)')
```

### Recommended Project Structure

```
backend/api/src/
├── routes/ai.ts                     # MODIFIED — onboarding branch (buildOnboardingSystemPrompt, stopWhen)
├── tools/
│   ├── registry.ts                  # MODIFIED — register assess_profile schema + executor
│   └── onboarding.ts                # NEW — assess_profile executor + micro-action pool logic
├── config/models.ts                 # MODIFIED — add ONBOARDING_MAX_STEPS constant
apps/mobile/app/(auth)/onboarding/
├── step-7.tsx                       # MODIFIED — handleFinish() routes to ziko-chat instead of /(app)
├── ziko-chat.tsx                    # NEW — chat screen (FlatList/stream/markdown reused from ai/index.tsx)
└── _layout.tsx                      # MODIFIED (maybe) — ensure ziko-chat is in the mandatory step stack
apps/mobile/app/(auth)/_layout.tsx   # MODIFIED — gate on athlete_state.status, not just profile.onboarding_done
apps/mobile/src/stores/
└── authStore.ts                     # MODIFIED — retroactive-recompute check in refreshProfile() or a sibling hook
packages/plugin-sdk/src/i18n.ts      # MODIFIED — new coach.onboarding.* (or ziko.*) fr/en keys for static chrome
```

### Pattern 1: Scoped `stopWhen` constant, not the shared chat default

**What:** A new named constant, `ONBOARDING_MAX_STEPS`, placed in `backend/api/src/config/models.ts` next to `AGENT_MODEL`/`VISION_MODEL` — the file's own established "change limits in one file" convention.
**When to use:** Only the onboarding branch of `routes/ai.ts`. Never touch the shared `/ai/chat` route's `stepCountIs(5)`.
**Why 8, not 5 or 20:** ≤4 *logical* questions plus one terminal `assess_profile` call is realistically 2 model round-trips per question (ask, then process the athlete's free-text reply before deciding the next question) — `isStepCount(8)` gives headroom without opening the SDK's full 20-step default. [CITED: `.planning/research/STACK.md`, itself Context7-verified against `/vercel/ai` current docs for `stopWhen`/`isStepCount`/`hasToolCall`]
```ts
// backend/api/src/config/models.ts — ADD
export const ONBOARDING_MAX_STEPS = 8;
```
```ts
// backend/api/src/routes/ai.ts — onboarding branch
import { isStepCount, hasToolCall } from 'ai';
import { ONBOARDING_MAX_STEPS } from '../config/models.js';

stopWhen: [isStepCount(ONBOARDING_MAX_STEPS), hasToolCall('assess_profile')],
```
**Failure mode to handle explicitly:** if the cap is hit before `assess_profile` was called, the athlete has answered questions but no `athlete_state` write happened. Check `result.steps` (or `onStepFinish`) for whether `assess_profile` actually ran; if not, either force a final synthesis turn or fail visibly rather than silently landing the athlete in `/(app)` with no starting state. This directly extends the same "failure mode at the cap" caution the milestone-level `STACK.md` research already flagged for the weekly-review turn — it applies equally here.

### Pattern 2: `assess_profile` tool — registry.ts's existing `AITool`/`parameters` convention, not raw Zod

**What:** `tools/registry.ts` defines every tool as a plain `AITool { name, description, parameters: JSONSchemaObject }` and a matching `executors[name]` function. `routes/ai.ts`'s `buildSDKTools()` is the **single place** that wraps each into an SDK `tool({ inputSchema: jsonSchema(s.parameters), execute })`. `assess_profile` must follow this exact shape — do not hand-write a Zod `inputSchema` directly in a route file, it would break the registry's existing "one conversion point" pattern.
**Source:** `backend/api/src/tools/registry.ts:120-142` (direct inspection), `backend/api/src/routes/ai.ts:118-142` (`buildSDKTools`).
```ts
// backend/api/src/tools/onboarding.ts — NEW
export const assessProfileSchema: AITool = {
  name: 'assess_profile',
  description:
    "Extract the athlete's experience, confidence, and adherence-risk profile from the " +
    "conversation so far, and assign one starting micro-action. Call this once you have " +
    "enough signal across all 3 categories (usually after 2-4 exchanges), never before.",
  parameters: {
    type: 'object',
    properties: {
      experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
      experience_confidence: { type: 'integer', description: 'Self-reported confidence 1-5 in the experience_level inference' },
      adherence_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
      adherence_confidence: { type: 'integer', description: 'Self-reported confidence 1-5 in the adherence_risk inference' },
      readiness: { type: 'string', enum: ['fragile', 'building', 'ready'], description: 'Matches athlete_state.readiness CHECK constraint exactly' },
      readiness_confidence: { type: 'integer', description: 'Self-reported confidence 1-5 in the readiness inference' },
      profile_summary: { type: 'string', description: 'One or two sentences in Ziko\'s voice summarizing what was learned, athlete-facing' },
      micro_action: { type: 'string', enum: ['hydration_log', 'journal_mood', 'measurements_weight'], description: 'One of the curated 3-item pool, chosen to match readiness — never anything else' },
    },
    required: ['experience_level', 'experience_confidence', 'adherence_risk', 'adherence_confidence', 'readiness', 'readiness_confidence', 'profile_summary', 'micro_action'],
  },
};
```
**`readiness` enum must be `'fragile' | 'building' | 'ready'` verbatim** — this is a Postgres `CHECK` constraint on `athlete_state.readiness` (`20260831120000_athlete_state.sql:20`), not a convention; passing any other string makes the `UPDATE` inside `record_athlete_decision()` fail. [VERIFIED: migration file, direct read]

### Pattern 3: Calling `record_athlete_decision()` — confirmed live signature

**Source:** `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` (direct read, live in production per `42-02-SUMMARY.md`).
```ts
// backend/api/src/tools/onboarding.ts — inside the assess_profile executor
import { clientForUser } from './db.js';

export async function assess_profile(
  input: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken); // service-role client — has the sole EXECUTE grant on this RPC

  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'onboarding_profile',
    p_week_of: null,
    p_summary: input.profile_summary,
    p_rationale: `Inferred from onboarding conversation: experience=${input.experience_level}, adherence_risk=${input.adherence_risk}`,
    p_evidence: {
      // Evidence for an onboarding_profile decision IS the conversation-derived
      // extraction — there is no prior real-activity table to re-verify against
      // for a brand-new athlete. This is the one legitimate exception to
      // PITFALLS.md's Pitfall 1 "never trust model-asserted data" rule, and it
      // must be documented as such: Phase 44's weekly engine is the correction
      // mechanism for exactly this noise (per FEATURES.md's dependency notes).
      experience_level: input.experience_level,
      experience_confidence: input.experience_confidence,
      adherence_risk: input.adherence_risk,
      adherence_confidence: input.adherence_confidence,
      readiness_confidence: input.readiness_confidence,
    },
    p_outcome: { level: /* mapped from readiness, see Open Question 3 */ 1, tier: 1, micro_action: input.micro_action },
    p_source: 'onboarding_tool',
    p_state_patch: {
      level: 1, // starting level — see Open Question 3 for the readiness→level mapping
      tier: 1,
      readiness: input.readiness,
      status: 'active', // ← MUST be set here; default is 'onboarding' and nothing else flips it
      current_focus_summary: input.profile_summary,
      onboarding_profile: {
        experience_level: input.experience_level,
        adherence_risk: input.adherence_risk,
        confidences: {
          experience: input.experience_confidence,
          adherence: input.adherence_confidence,
          readiness: input.readiness_confidence,
        },
      },
    },
  });

  if (error) throw new Error(`record_athlete_decision failed: ${error.message}`);
  return data; // { success: true, decision_id } | { success: false, error: 'evidence_required' | 'duplicate' }
}
```
**Return-shape handling is mandatory, not optional:** the RPC returns `{ success: false, error: ... }` rather than throwing on a guard failure (evidence missing, or — irrelevant here since `decision_type='onboarding_profile'` has no idempotency index — duplicate). The executor must check `data.success` and surface a real error to the model/athlete if `false`, not treat any non-thrown call as success.

### Pattern 4: Fixing the mandatory-flow gate

**What goes wrong today:** `apps/mobile/app/(auth)/_layout.tsx` — `if (session && profile?.onboarding_done) return <Redirect href="/(app)" />`. `step-7.tsx`'s `handleFinish()` sets `user_profiles.onboarding_done = true` in the very first `await`, before any Ziko chat exists. An app kill between that upsert and Ziko chat completion, followed by relaunch, sends the athlete straight to `/(app)` via this redirect — the mandatory chat (D-02) never runs and never can run again through this gate.
**Fix:** gate on `athlete_state.status` (self-created by `record_athlete_decision()` with `status='onboarding'` default, patched to `'active'` only by the onboarding tool). Requires one additional read, since `athlete_state` is not currently fetched into `authStore`'s `profile` object.
```ts
// apps/mobile/src/stores/authStore.ts — extend refreshProfile() or add a sibling field
refreshProfile: async () => {
  const user = get().user;
  if (!user) return;
  const [{ data: profileData }, { data: stateData }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).single(),
    supabase.from('athlete_state').select('status').eq('user_id', user.id).maybeSingle(),
    // RLS SELECT-own policy already permits this read — no new grant needed
  ]);
  if (profileData) set({ profile: profileData as UserProfile });
  set({ athleteOnboardingComplete: stateData?.status === 'active' });
},
```
```tsx
// apps/mobile/app/(auth)/_layout.tsx
if (session && profile?.onboarding_done && athleteOnboardingComplete) {
  return <Redirect href="/(app)" />;
}
```
A brand-new athlete has no `athlete_state` row at all (`stateData` is `null`, `maybeSingle()` returns `null` not an error) — `athleteOnboardingComplete` correctly evaluates `false`, keeping them inside `(auth)` until the RPC self-heals the row with `status='active'`.

### Pattern 5: Micro-action completion detection — `useFocusEffect` re-poll (D-14)

**Precedent already in this exact codebase:** `apps/mobile/app/(app)/ai/index.tsx:189-199` re-fetches the credit balance every time the AI screen regains focus, via `useFocusEffect(useCallback(() => { ...fetchBalance... }, []))`. Apply the identical pattern to the mission-card completion check — no new backend endpoint needed, the client already has an RLS-scoped Supabase session that can read its own `hydration_logs`/`journal_entries`/`body_measurements` rows directly.
```tsx
// apps/mobile/app/(auth)/onboarding/ziko-chat.tsx (or wherever the mission card lives)
useFocusEffect(
  useCallback(() => {
    if (!missionAction) return;
    checkMicroActionCompleted(missionAction, userId).then((done) => {
      if (done) setShowCelebration(true);
    });
  }, [missionAction])
);

// checkMicroActionCompleted queries the REAL table for today, e.g.:
// hydration_log → supabase.from('hydration_logs').select('id').eq('user_id', userId).gte('created_at', todayStart).limit(1)
// journal_mood → supabase.from('journal_entries').select('id').eq('user_id', userId).gte('created_at', todayStart).limit(1)
// measurements_weight → supabase.from('body_measurements').select('id').eq('user_id', userId).gte('created_at', todayStart).limit(1)
```
Table names for the curated 3-action pool must be confirmed against the actual per-domain migrations at plan/implementation time (not re-verified in this research pass beyond the manifest-declared tool names below) — `hydration_log`/`journal_log_mood`/`measurements_log` tool executors already exist in `backend/api/src/tools/{hydration,journal,measurements}.ts` and can be grepped for their exact underlying table names in one pass.

### Pattern 6: Retroactive recompute trigger point (ONBOARD-06)

**Where:** `authStore.refreshProfile()` (called on every app open, `app/_layout.tsx:60-63`) is the natural hook — same file already modified for Pattern 4's `athlete_state.status` read, so this can be one combined query rather than two.
```ts
// Conceptual addition to refreshProfile(), after the athlete_state read above:
if (profileData?.onboarding_done && stateData === null) {
  // Pre-v1.18 athlete: onboarding_done=true (old 7-step flow) but athlete_state
  // was never created (they never went through Ziko). Trigger the lazy
  // retroactive-compute backend call — fire-and-forget, do not block app load.
  triggerRetroactiveRecompute(user.id).catch(() => {}); // POST /ai/onboarding/retroactive or a new tool call
}
```
**Backend side — real-activity query shape**, modeled directly on `context/user.ts`'s existing `fetchUserContext()` (6-parallel-query pattern, already the codebase's established "aggregate, don't dump raw rows" convention):
```ts
// Conceptual — backend/api/src/tools/onboarding.ts, retroactive path
const [workouts, habits, nutrition] = await Promise.all([
  db.from('workout_sessions').select('started_at, total_volume_kg').eq('user_id', userId).order('started_at', { ascending: false }).limit(30),
  db.from('habit_logs').select('date, value').eq('user_id', userId).gte('date', ninetyDaysAgo),
  db.from('nutrition_logs').select('date').eq('user_id', userId).gte('date', ninetyDaysAgo),
  // extend with sleep_logs / journal_entries / cardio_sessions / body_measurements
  // as needed for a richer signal — start with the 3 highest-signal tables
]);
// Feed AGGREGATED counts/deltas (session count, active days, streak length) into a
// single generateObject call with the SAME assess_profile-shaped Zod schema output —
// this is a single-shot structured extraction from real data, not a multi-turn chat,
// so it should use generateObject directly, not streamText/stopWhen (mirrors the
// milestone-level STACK.md recommendation for the weekly-review call's shape).
```
This retroactive path should call `record_athlete_decision()` with `p_source: 'app_open_fallback'` (already an allowed `source` enum value on `athlete_decisions` per the Phase 42 migration) and `p_evidence` containing the actual queried aggregates — this one genuinely can and must satisfy Pitfall 1's grounding discipline, unlike the fresh-onboarding case, because real activity history exists to ground it.

### Anti-Patterns to Avoid

- **Exposing the full `allToolSchemas` registry to the onboarding turn.** The onboarding branch's `tools` object should contain only `assess_profile` (scope it down explicitly in `buildSDKTools`-equivalent for this branch), not every plugin tool — there is no reason for Ziko to call `hydration_log` or `nutrition_log_meal` mid-onboarding-conversation, and a wider tool surface increases the chance of an off-task tool call burning a step inside the tight `ONBOARDING_MAX_STEPS` budget.
- **Writing `athlete_state` directly from the tool executor.** Every write must go through `record_athlete_decision()` — the table-level `REVOKE INSERT, UPDATE, DELETE` (Phase 42) makes any other path fail outright, not just violate convention.
- **Letting the redirect gate stay keyed on `profile.onboarding_done` alone.** See Pattern 4 — this is the single highest-risk gap found in this research pass.
- **Treating the retroactive recompute's evidence the same way as the fresh-onboarding case (conversation-derived).** The retroactive path has real activity data available and must use it — falling back to a flat/generic profile for pre-v1.18 athletes directly violates ONBOARD-06's explicit "never a flat default" requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conversation persistence / mid-flow resume | A new onboarding-specific messages table | `ai_conversations`/`ai_messages` + `getOrCreateConversation()`/`appendMessages()` (already exist), tagged via the existing `plugin_context JSONB` column | D-04 explicitly calls for reusing this exact stack; the JSONB column already supports arbitrary tagging with zero migration |
| Starting-state write validation/idempotency | Custom application-level dedupe logic | `record_athlete_decision()`'s existing guard-first, error-shaped-JSONB pattern | Already handles the evidence-required guard and self-heals the parent row; re-implementing any of this client-side or in a second code path reopens exactly the write-path risk Phase 42's REVOKE lockdown was built to close |
| Micro-action completion polling | A new backend "poll status" endpoint | Direct client-side Supabase read of the target log table (RLS already scopes it to the athlete's own rows) | Matches the exact precedent already shipped in `ai/index.tsx`'s credit-balance refetch-on-focus; no new backend surface needed |
| Celebration entrance animation | A new animation library or hand-tuned spring config | `FadeInUp.springify().damping(12)` from `step-7.tsx`'s `OBReady` (`react-native-reanimated`, already installed) | D-15 explicitly calls for reusing this exact pattern |

**Key insight:** this phase's entire backend surface is additive composition of Phase 42's already-hardened write path and the existing `/ai/chat/stream` orchestration shape — nothing here justifies a new abstraction layer, table, or package.

## Common Pitfalls

### Pitfall 1: Mandatory-flow gate bypass on app kill mid-chat
**What goes wrong:** Athlete force-quits or the app crashes between `step-7.tsx`'s `user_profiles.onboarding_done = true` upsert and Ziko chat completion. On relaunch, `(auth)/_layout.tsx`'s current redirect condition (`profile?.onboarding_done` alone) sends them straight to `/(app)`, permanently skipping the mandatory chat.
**Why it happens:** The two "onboarding complete" signals (structured-flow-done vs. Ziko-chat-done) are conflated into a single boolean today; nothing distinguishes them.
**How to avoid:** Implement Pattern 4 above — gate on `athlete_state.status === 'active'` in addition to `profile.onboarding_done`, before writing any onboarding UI code.
**Warning signs:** QA test "kill app mid-Ziko-chat, relaunch" lands on the home tab instead of resuming the chat.

### Pitfall 2: Mandatory chat blocked by insufficient AI credits
**What goes wrong:** If the onboarding route is gated behind the standard `creditCheck('chat')`/`creditDeduct('chat')` middleware (as `/ai/chat/stream` is), a brand-new athlete — `user_ai_credits.balance` starts at `0`, `DAILY_QUOTAS.chat.base = 1` — has at most 1 free message-worth of credit (cost 4/message) before hitting a 402, mid-mandatory-flow, with no legal skip per D-02.
**Why it happens:** Copy-pasting the existing `creditCheck`/`creditDeduct` middleware onto the new route "because that's how every other chat route works" without noticing this route has no opt-out.
**How to avoid:** Exempt the onboarding route from `creditCheck`/`creditDeduct` entirely — this is a system-mandated flow, not user-discretionary chat, closer in spirit to the milestone's own weekly-review engine (also explicitly *not* behind `creditCheck` per `PITFALLS.md`/`ARCHITECTURE.md`) than to `/ai/chat`. This needs an explicit product decision recorded before implementation (see Open Questions).
**Warning signs:** A fresh-signup QA account hits a 402/credit-exhaustion sheet mid-Ziko-chat.

### Pitfall 3: Missing per-athlete locale source treated as solved
**What goes wrong:** A plan/task description that says "generate questions in the athlete's stored app locale" without specifying *where* that locale is read from will silently default to hardcoding `'fr'` or guessing from device locale, since no DB column or synced store currently holds it.
**Why it happens:** D-11 in CONTEXT.md assumes a "stored app locale" exists; it doesn't (confirmed: `useI18nStore` defaults `'fr'`, zero `setLocale` call sites in the mobile app, no `locale` column in `user_profiles` or elsewhere).
**How to avoid:** Client passes its current `useI18nStore.getState().locale` value explicitly in the onboarding chat request body (e.g. `{ locale: 'fr' | 'en' }`); backend uses it directly in the system prompt instruction ("respond in {locale}"). Do not attempt a server-side lookup — there is nothing to look up.
**Warning signs:** English-locale test device receives French-generated Ziko questions (or vice versa).

### Pitfall 4: Treating onboarding's own extraction as grounded evidence in the Pitfall-1 sense
**What goes wrong:** Applying the milestone's general "AI decisions must be grounded in real logged data" rule too literally to the fresh-onboarding case, where — by definition — there is no real activity data yet, and blocking the write, or trying to fabricate fake "evidence" to satisfy the RPC's `evidence_required` guard.
**Why it happens:** `PITFALLS.md`'s Pitfall 1 is written generally across all of v1.18; a plan/task author pattern-matching on it without noticing the fresh-onboarding case is architecturally different (no history exists to re-query) could either block correctly-working code or invent synthetic evidence.
**How to avoid:** For `decision_type='onboarding_profile'`, the legitimate evidence *is* the conversation-derived extraction (self-reported confidence scores included) — document this explicitly as the one intentional exception, and rely on Phase 44's weekly engine (already scoped as the "safety net for onboarding profiling errors" per `FEATURES.md`) to correct any noise once real data exists. Do not conflate this with the retroactive-recompute path (Pattern 6), which DOES have real data and must use it.
**Warning signs:** A future code review flags the onboarding tool for "not grounding in real data" — this is expected and correct for this one decision type, confirm intentionality rather than "fixing" it into a contradiction with ONBOARD-06's requirement that the retroactive path use real data.

## Code Examples

See Architecture Patterns 1-6 above — every example is either a direct excerpt from already-shipped code (`record_athlete_decision()` signature, `buildSDKTools()`, `useFocusEffect` credit-balance pattern, `FadeInUp` entrance) or a minimal, clearly-marked NEW addition following those exact conventions.

## State of the Art

Not applicable in the "library version drift" sense — no external library research needed. The one relevant "state of the art" shift is internal to this codebase: Phase 42 (shipped 2026-08-31, one day before this research) changed the Postgres-layer contract for anything touching athlete state — any pre-Phase-42 mental model of "the backend service-role key can write these tables" is now wrong (`REVOKE INSERT, UPDATE, DELETE ... FROM authenticated, service_role` — service-role is explicitly locked out too, only `record_athlete_decision()` itself, running as the function owner, can write).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The curated micro-action pool's underlying table names (`hydration_logs`, `journal_entries`/similar, `body_measurements`/similar) match what Pattern 5's completion-check queries assume — confirmed only by manifest/tool-schema names, not by directly reading each plugin's own migration in this research pass | Pattern 5 | Low — a one-grep check (`grep -r "CREATE TABLE" supabase/migrations \| grep -iE "hydration\|journal\|measurement"`) at plan/implementation time resolves this trivially; flagged so the planner doesn't skip it |
| A2 | A starting `level`/`tier` value mapping from the inferred `readiness` enum (`fragile`→level 1? `ready`→level 2 or 3?) is not specified anywhere in CONTEXT.md or Phase 42's docs — this research infers `level: 1, tier: 1` for all readiness values as the safe default (matching `athlete_state`'s own column DEFAULT) but this is a product/design call, not a technical one | Pattern 3 (Code Example) | Medium — if planning proceeds without an explicit decision here, different plans could pick different mappings inconsistently; should be raised as a discretion item during planning, not silently decided by whichever task happens to write the tool executor |
| A3 | Exempting the onboarding route from `creditCheck`/`creditDeduct` (Pitfall 2's recommended fix) is this research's recommendation, not a decision already made anywhere in CONTEXT.md, ROADMAP.md, or REQUIREMENTS.md | Pitfall 2 | High if unaddressed — shipping with the default `creditCheck('chat')` gate copy-pasted from `/ai/chat/stream` would strand real new users, silently breaking ONBOARD-01/03/05 for exactly the population (brand-new signups) this phase exists to serve |

## Open Questions

1. **Dedicated endpoint vs. flag on `/ai/chat/stream`?**
   - What we know: `ARCHITECTURE.md` (milestone-level) describes an "onboarding branch when `athlete_state.status = 'onboarding'`" inside the *existing* `buildSystemPrompt()`/route, implying reuse of `/ai/chat/stream` with conditional behavior rather than a new route.
   - What's unclear: A conditional branch inside the shared route means the shared route's credit-gating middleware (`creditCheck('chat')`, applied at the route level via Hono's middleware chaining — `router.post('/chat/stream', creditCheck('chat'), creditDeduct('chat'), ...)`) would apply to onboarding messages too, directly colliding with Pitfall 2's finding. A **new dedicated route** (e.g. `POST /ai/onboarding/stream`), separately mountable without `creditCheck`, cleanly avoids this collision and keeps the shared route's tool surface untouched (Anti-Patterns section).
   - Recommendation: **new dedicated route**, sharing `buildSystemPrompt()`'s helper functions and `context/conversation.ts` calls but registered without the credit middleware. This also makes the `stopWhen` constant and restricted tool surface (Pattern 1/Anti-Patterns) trivially route-scoped rather than conditionally branched inside a route that otherwise defaults to the full registry.

2. **Exact locale-passing contract between mobile and backend.**
   - What we know: no server-side locale source exists (Pitfall 3); the client must pass it explicitly.
   - What's unclear: whether to pass it as a body field on every onboarding chat request, or once at conversation-creation time and stored in `plugin_context` JSONB alongside the `type` tag.
   - Recommendation: store it once in `plugin_context: { type: 'ziko_onboarding', locale: 'fr' }` at `getOrCreateConversation()` time — avoids re-sending it on every turn and keeps the system-prompt-building code reading from one place (the conversation record) rather than trusting a per-request body field that could drift mid-conversation if the athlete somehow changes locale.

3. **Readiness→starting level/tier mapping (A2 above).**
   - What we know: `athlete_state.level`/`tier` both default to `1`; nothing in Phase 42's docs specifies a non-1 starting value for any readiness tier.
   - What's unclear: whether "expérimenté peut démarrer plus haut" (referenced in `FEATURES.md`'s adherence-risk-first skip logic differentiator) should translate into `level > 1` at onboarding time for a `readiness: 'ready'` athlete, or whether level progression is entirely a Phase 44/weekly-engine concern and onboarding should always write `level: 1` regardless of inferred readiness.
   - Recommendation: default to `level: 1, tier: 1` for all readiness values at onboarding time (safest, matches `PluginLoader`'s planned Phase 46 fail-safe-to-level-1 default), and let `readiness` alone (not `level`) carry the "start gentler vs. start further along" signal for now — `readiness` is scoped to Phase 43/44's actual reads, while `level`'s only current consumer (`PluginLoader.minLevel` gating) doesn't exist until Phase 46. Confirm this against ROADMAP.md's Phase 44/46 scope during planning; do not let Phase 43 pre-invent gating logic that belongs to a later phase.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies beyond what's already running in this environment (Node 20, existing Supabase project, existing Vercel deployment). No new CLI, database engine, or service integration is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v3 (`backend/api/vitest.config.ts`) |
| Config file | `backend/api/vitest.config.ts` |
| Quick run command | `cd backend/api && npx vitest run test/rls/athlete-decisions.spec.ts test/rls/athlete-state.spec.ts` |
| Full suite command | `cd backend/api && npm run test` (also `npm run test:rls` for the RLS-specific subset) |

RLS/RPC specs require `SUPABASE_TEST_URL` matching `SUPABASE_URL` in the test environment (`RUN_DB` guard, `describe.skipIf(!RUN_DB)`) — this is a pre-existing environment gap already flagged in Phase 42's summaries (`.env.test` not configured in the current sandbox), not something Phase 43 introduces or must fix, but any new spec file for this phase inherits the same guard.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | ≤4-question flow terminates and calls `assess_profile` within `ONBOARDING_MAX_STEPS` | integration (route-level, mocked `generateText`/`streamText` or a recorded transcript) | `npx vitest run test/routes/onboarding.spec.ts` | ❌ Wave 0 |
| ONBOARD-02 | `assess_profile` input validates against the enum/required-field contract (readiness values match the DB CHECK) | unit | `npx vitest run test/tools/onboarding.spec.ts` | ❌ Wave 0 |
| ONBOARD-05 | `record_athlete_decision()` call from `assess_profile` results in `athlete_state.status='active'`, correct `onboarding_profile` JSONB | integration (RLS/RPC spec, same house shape as `athlete-decisions.spec.ts`) | `npx vitest run test/rls/onboarding-profile.spec.ts` | ❌ Wave 0 |
| ONBOARD-06 | Retroactive path only fires when `onboarding_done=true` AND no `athlete_state` row exists; writes `p_source='app_open_fallback'` with real evidence | integration | `npx vitest run test/tools/retroactive-recompute.spec.ts` | ❌ Wave 0 |
| Mandatory-gate fix (Pitfall 1) | `(auth)/_layout.tsx` redirect logic requires both `profile.onboarding_done` AND `athlete_state.status==='active'` | unit (React Native Testing Library, if configured) or manual QA checklist item | — | ❌ — mobile test infra for this file not confirmed present, likely manual-only |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <new spec file>`
- **Per wave merge:** `cd backend/api && npm run test:rls` (RLS/RPC changes are the highest-risk surface this phase touches)
- **Phase gate:** full `npm run test` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/api/test/rls/onboarding-profile.spec.ts` — covers ONBOARD-02/ONBOARD-05, following `athlete-decisions.spec.ts`'s exact house shape (`RUN_DB` guard, `getAdminClient`/`createTestUser`/`cleanupTestUsers` fixtures)
- [ ] `backend/api/test/tools/onboarding.spec.ts` — unit coverage for the `assess_profile` executor and micro-action pool selection logic
- [ ] `backend/api/test/tools/retroactive-recompute.spec.ts` — covers ONBOARD-06's real-activity-grounded evidence requirement
- [ ] Mobile: no dedicated test file identified for `(auth)/_layout.tsx` redirect logic — confirm whether mobile has any RTL/Jest setup at all before committing to an automated test here; if not, this is a manual QA checklist item ("kill app mid-Ziko-chat, relaunch, confirm chat resumes not skipped") rather than an automated gap

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Existing `authMiddleware` on all `/ai/*` routes — reused unchanged |
| V3 Session Management | no (new surface) | No new session concept introduced |
| V4 Access Control | yes | `record_athlete_decision()`'s GRANT/REVOKE lockdown (Phase 42) is the enforcement point — this phase must not introduce any code path that writes `athlete_state`/`athlete_decisions` other than through this RPC |
| V5 Input Validation | yes | `assess_profile`'s `parameters` JSON Schema enum constraints (`readiness`, `experience_level`, `adherence_risk`, `micro_action`) — validated by the SDK's `jsonSchema()` wrapping before the executor runs; the DB-layer `CHECK` constraints on `athlete_state.readiness`/`level`/`points`/`tier` are the second, authoritative layer |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Athlete manipulates the onboarding conversation to have the AI assign an inflated `readiness`/`level` (prompt injection via free-text answers) | Elevation of Privilege | Not fully preventable at the LLM layer for this specific decision type (evidence IS the conversation, per Pitfall 4) — the actual mitigation is downstream: `level`/`tier` gating (Phase 46, not yet built) should fail-safe to level 1 on any missing/ambiguous row, and Phase 44's weekly engine is the designed correction mechanism if onboarding profiling is gamed or simply wrong. This phase's own mitigation is scoping `assess_profile`'s enum values tightly (no free-form level/tier field the model could set arbitrarily — only `readiness`, mapped server-side to a fixed `level: 1, tier: 1` per Open Question 3's recommendation) |
| A malicious/compromised client calls the onboarding tool-execute path directly (bypassing the conversational flow) with a forged `p_evidence`/self-reported confidence | Tampering | The tool executor — not the client — constructs `p_evidence` and `p_state_patch` server-side from the model's structured output; the client never has EXECUTE on `record_athlete_decision()` directly (REVOKE'd from `authenticated`), so a compromised client at worst can send garbage chat messages, not forge a decision |
| Onboarding route reachable without auth | Spoofing | `router.use('*', authMiddleware)` already applies to the entire `/ai` router in `routes/ai.ts` — confirm the new dedicated onboarding route (Open Question 1) is mounted under the same router, not a separate unauthenticated router |

## Sources

### Primary (HIGH confidence, direct repository inspection)
- `supabase/migrations/20260831120000_athlete_state.sql`, `20260831120100_athlete_decisions.sql`, `20260831120200_athlete_decisions_rpc.sql` — live schema, RLS, RPC signature/return-shapes/grants
- `.planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-02-SUMMARY.md` — confirms RPC is live, no caller yet, exact `p_state_patch` key contract
- `backend/api/src/routes/ai.ts`, `backend/api/src/context/conversation.ts`, `backend/api/src/context/user.ts`, `backend/api/src/tools/registry.ts`, `backend/api/src/tools/db.ts`, `backend/api/src/config/models.ts`, `backend/api/src/config/credits.ts`, `backend/api/src/middleware/creditGate.ts` — direct reads
- `apps/mobile/app/(auth)/onboarding/step-7.tsx`, `apps/mobile/app/(auth)/_layout.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/src/stores/authStore.ts`, `apps/mobile/src/stores/aiStore.ts`, `apps/mobile/src/lib/PluginLoader.tsx`, `apps/mobile/app/(app)/ai/index.tsx` — direct reads
- `plugins/hydration/src/manifest.ts`, `plugins/journal/src/manifest.ts`, `plugins/measurements/src/manifest.ts` — confirmed micro-action pool candidates' tool names and route paths
- `packages/plugin-sdk/src/i18n.ts` — confirmed `useI18nStore` default and absence of any `setLocale` call site in the mobile app
- `supabase/migrations/001_initial_schema.sql`, `026_ai_credits.sql` — `ai_conversations` schema (`plugin_context JSONB` reuse target), credit balance defaults
- `backend/api/test/rls/athlete-decisions.spec.ts`, `backend/api/vitest.config.ts` — test house shape and framework confirmation

### Secondary (MEDIUM-HIGH confidence, milestone-level research from 2026-08-30, Context7-verified for AI SDK v6 claims)
- `.planning/research/STACK.md` — `stopWhen`/`isStepCount`/`hasToolCall` API, Context7-verified against `/vercel/ai` current docs
- `.planning/research/ARCHITECTURE.md` — onboarding-branch-in-`routes/ai.ts` recommendation, `coaching-engine/` module shape (Phase 44+, informative context only)
- `.planning/research/PITFALLS.md` — Pitfall 1 (grounding discipline) — applied with the fresh-onboarding exception documented above
- `.planning/research/FEATURES.md` — adherence-risk-first skip logic, weekly-engine-as-safety-net framing
- `.planning/research/SUMMARY.md` — overall phase sequencing rationale

### Tertiary
- None used beyond the above — this phase required no external WebSearch/Context7 lookups since Phase 42's live schema and the existing chat stack fully determine the technical shape; the milestone-level research files already did the Context7 verification for the `ai` v6 APIs this phase reuses.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all APIs already Context7-verified in milestone-level research and directly observed in production code
- Architecture: HIGH — every pattern is either a direct reuse of shipped code or a minimal, precedent-matched addition; the mandatory-gate bug (Pitfall 1) and credit-gating risk (Pitfall 2) were found via direct code inspection, not inference
- Pitfalls: HIGH for the 4 documented here (all traced to specific files/lines); MEDIUM for anything beyond this phase's boundary (Phase 44+ concerns are referenced but not re-verified)

**Research date:** 2026-09-01
**Valid until:** 30 days (stable internal codebase, no external library drift risk for this phase's scope) — re-verify if Phase 42's RPC signature or the credit-gating decision changes before planning begins

---

## RESEARCH COMPLETE

**Phase:** 43 - Conversational Onboarding
**Confidence:** HIGH

### Key Findings
- **Mandatory-flow gate is currently bypassable**: `(auth)/_layout.tsx` redirects on `profile.onboarding_done` alone, which is set `true` before Ziko chat runs — an app kill mid-chat permanently skips the mandatory conversation (D-02) unless the gate is changed to also require `athlete_state.status === 'active'`.
- **No per-athlete locale exists anywhere in the stack** to satisfy D-11's "AI generates in the athlete's stored app locale" — `useI18nStore` defaults to `'fr'` with zero `setLocale` call sites, no `user_profiles.locale` column. The mobile client must pass its local i18n-store locale explicitly in the onboarding request/conversation record.
- **Standard `creditCheck('chat')` gating would very likely strand new athletes** (`balance` starts at 0, `chat` costs 4, daily base grant is only 1) — recommend a dedicated onboarding route exempt from credit gating, since this is a mandatory system flow, not discretionary chat.
- **`record_athlete_decision()`'s exact live signature, return shapes, and accepted `p_state_patch` keys are fully confirmed** from the Phase 42 migration file — no ambiguity remains for the `assess_profile` tool's DB write call.
- **The onboarding conversation's own extraction is the legitimate "evidence"** for its `record_athlete_decision()` call (no prior real-activity data exists for a brand-new athlete) — this is an intentional, documented exception to the general "ground in real data" pitfall, distinct from the retroactive-recompute path (ONBOARD-06), which DOES have real activity data and must use it.

### File Created
`C:\ziko-platform\.planning\workstreams\milestone-mobile\phases\43-conversational-onboarding\43-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new dependencies; all APIs already Context7-verified in milestone-level research and directly observed in shipped code |
| Architecture | HIGH | Every pattern traced to a specific file/line; two load-bearing gaps (mandatory-gate bypass, credit-gating risk) found via direct inspection |
| Pitfalls | HIGH | All 4 pitfalls documented here trace to specific, cited files |

### Open Questions
1. Dedicated `/ai/onboarding/stream` route vs. a flag on `/ai/chat/stream` — recommend dedicated route (avoids credit-gate collision, restricts tool surface cleanly).
2. Exact locale-passing contract — recommend storing once in `ai_conversations.plugin_context` at conversation-creation time.
3. Readiness→starting `level`/`tier` mapping is unspecified anywhere upstream — recommend defaulting to `level: 1, tier: 1` for all readiness values and letting `readiness` alone carry the "start gentler" signal, deferring level-based gating logic entirely to Phase 46.

### Ready for Planning
Research complete. Planner can now create PLAN.md files for Phase 43.

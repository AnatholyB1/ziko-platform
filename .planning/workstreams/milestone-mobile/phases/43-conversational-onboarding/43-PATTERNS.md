# Phase 43: Conversational Onboarding - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 10 (5 new, 5 modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/api/src/routes/ai.ts` (new `/ai/onboarding/stream` route, or new file `routes/onboarding.ts` mounted the same way) | route/controller | streaming (SSE) | `backend/api/src/routes/ai.ts` `POST /chat/stream` (lines 189-286) | exact — same file, sibling route |
| `backend/api/src/tools/onboarding.ts` (NEW) | service/tool-executor | request-response + RPC write | `backend/api/src/tools/coach.ts` (RPC-adjacent call via `../coach/clients/db.ts`) + `backend/api/src/tools/hydration.ts` (simple CRUD tool shape) | role-match, strong |
| `backend/api/src/tools/registry.ts` (MODIFIED — register `assess_profile`) | config/registry | CRUD (schema registration) | same file, existing `hydrationToolSchemas`/`coachToolSchemas` blocks | exact |
| `backend/api/src/config/models.ts` (MODIFIED — add `ONBOARDING_MAX_STEPS`) | config | — | same file, `AGENT_MODEL`/`VISION_MODEL` constants | exact |
| `backend/api/src/context/conversation.ts` (reused as-is, possibly extended for `plugin_context` tagging) | service | CRUD | same file — `getOrCreateConversation`/`appendMessages`/`updateConversationTitle` | exact — direct reuse |
| `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx` (NEW) | component/screen | streaming (SSE consumption) | `apps/mobile/app/(app)/ai/index.tsx` (FlatList bubbles, markdown, streaming) | exact — explicit precedent (D-05) |
| `apps/mobile/app/(auth)/onboarding/step-7.tsx` (MODIFIED — `handleFinish()` redirect target) | component/screen | request-response | same file, `OBReady.handleFinish()` (lines 58-85) | exact |
| `apps/mobile/app/(auth)/_layout.tsx` (MODIFIED — gate condition) | route-guard/provider | request-response | same file (lines 1-21) | exact |
| `apps/mobile/src/stores/authStore.ts` (MODIFIED — `refreshProfile()` extended read + retroactive trigger) | store | CRUD | same file, `refreshProfile()` (lines 70-83) | exact |
| `packages/plugin-sdk/src/i18n.ts` (MODIFIED — new `ziko.onboarding.*`/`coach.onboarding.*` fr/en keys) | config/i18n | — | same file, existing `onboarding.*` namespace (lines 65-80 fr, mirrored at `en` block from line 837) | exact |

## Pattern Assignments

### `backend/api/src/routes/ai.ts` — new onboarding branch/route (route, streaming)

**Analog:** `backend/api/src/routes/ai.ts:189-286` (`POST /chat/stream`)

**Imports pattern** (lines 1-14):
```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { allToolSchemas, getToolExecutor } from '../tools/registry.js';
import { fetchUserContext, type UserContext } from '../context/user.js';
import {
  getOrCreateConversation,
  appendMessages,
  updateConversationTitle,
} from '../context/conversation.js';
import { AGENT_MODEL, VISION_MODEL } from '../config/models.js';
import { creditCheck, creditDeduct } from '../middleware/creditGate.js';
```
For the onboarding branch: add `isStepCount, hasToolCall` to the `ai` import, `ONBOARDING_MAX_STEPS` to the `config/models.js` import — **do not** import `creditCheck`/`creditDeduct` for this route (Pitfall 2 — mandatory flow must not be credit-gated).

**Auth pattern** (line 17): `router.use('*', authMiddleware);` — already applies to the whole `/ai` router; if a new dedicated router is used (Open Question 1 recommendation), mount it the same way, never as a separate unauthenticated router.

**Core streaming pattern** (lines 189-232, adapt directly):
```typescript
router.post('/onboarding/stream', async (c) => {  // NOTE: no creditCheck/creditDeduct
  const { messages = [], conversation_id: bodyConversationId, locale } = await c.req.json<{
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    conversation_id?: string;
    locale?: 'fr' | 'en';
  }>();
  const auth = c.get('auth');
  const userId = auth.userId;
  const userToken = c.req.header('Authorization')?.slice(7);
  const conversation_id = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;

  const convo = await getOrCreateConversation(userId, conversation_id, userToken);
  // tag plugin_context: { type: 'ziko_onboarding', locale } at creation time — see Open Question 2

  const systemPrompt = buildOnboardingSystemPrompt(locale ?? 'fr'); // NEW helper, names the 3 signal categories

  const allMessages = [
    ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  const result = streamText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: { assess_profile: buildOnboardingSDKTool(userId, userToken) }, // scoped tool surface — NOT buildSDKTools()/allToolSchemas
    stopWhen: [isStepCount(ONBOARDING_MAX_STEPS), hasToolCall('assess_profile')],
  });

  // ... same c.header + stream(c, async (s) => { ... }) shape as lines 234-285,
  // same SSE event types (meta/chunk/actions/[DONE]/error), same appendMessages persistence tail
});
```
`buildSDKTools()` (lines 120-142) shows the **general** conversion pattern (`tool({ inputSchema: jsonSchema(...), execute: ... })`); the onboarding branch needs a narrowed version that only wraps `assess_profile`, not the full `allToolSchemas` map (Anti-Pattern: exposing the full registry to onboarding).

**Error handling pattern** (lines 272-277): catch inside the `stream(c, async (s) => {...})` callback, write `{ type: 'error', error: msg }` then `[DONE]`, never throw past the SSE writer.

---

### `backend/api/src/tools/onboarding.ts` (NEW) — `assess_profile` executor (service, RPC write)

**Analog 1 (RPC-call shape):** `backend/api/src/tools/coach.ts:34-76` (`coach_revoke_link` — guard-first, confirmed/errored return-shape pattern)
**Analog 2 (CRUD tool shape / `clientForUser` usage):** `backend/api/src/tools/hydration.ts:6-37` (`hydration_log`)

**Imports pattern** (hydration.ts line 1):
```typescript
import { clientForUser } from './db.js';
```

**Core RPC-call pattern** (modeled on `coach.ts`'s guard-first / error-shaped-return style, `db.ts:12-16`'s `clientForUser`):
```typescript
export async function assess_profile(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken); // service-role client — required, EXECUTE is service_role-only (see migration excerpt below)

  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'onboarding_profile',
    p_week_of: null,
    p_summary: params.profile_summary,
    p_rationale: `Inferred from onboarding conversation: experience=${params.experience_level}, adherence_risk=${params.adherence_risk}`,
    p_evidence: { /* conversation-derived extraction — see PATTERNS note below */ },
    p_outcome: { level: 1, tier: 1, micro_action: params.micro_action },
    p_source: 'onboarding_tool',
    p_state_patch: {
      level: 1, tier: 1, readiness: params.readiness, status: 'active',
      current_focus_summary: params.profile_summary,
      onboarding_profile: { /* ... */ },
    },
  });

  if (error) throw new Error(`record_athlete_decision failed: ${error.message}`);
  // Mandatory: RPC returns { success: false, error: ... } on guard failure — does NOT throw.
  // Follow coach_revoke_link's pattern (coach.ts:50-57, 61-67) of checking the result shape
  // and returning a structured error object rather than assuming success on no-throw.
  return data;
}
```

**`db.ts:1-16` — why `clientForUser` is safe here:**
```typescript
export function clientForUser(_userToken?: string) {
  return createClient(supabaseUrl, serviceKey ?? supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```
`record_athlete_decision()` is `GRANT EXECUTE ... TO service_role` only (`supabase/migrations/20260831120200_athlete_decisions_rpc.sql:141-142`) — `clientForUser` already prefers `SUPABASE_SERVICE_KEY` when set; confirm this env var is genuinely populated in the target deploy environment (Phase 42's own summary flags the publishable-key fallback as `anon`-denied).

**Validation pattern:** `assess_profile`'s `parameters` schema must go in `tools/registry.ts` following the exact `AITool { name, description, parameters }` shape (see registry.ts pattern below) — enum values (`readiness: 'fragile'|'building'|'ready'`) must match the DB `CHECK` constraint verbatim (`athlete_state.sql:20`).

---

### `backend/api/src/tools/registry.ts` — register `assess_profile` schema (config/registry, CRUD)

**Analog:** same file, `hydrationToolSchemas` block (lines 382-410) + `executors` map (lines 133-175)

**Pattern to copy** (schema block shape, lines 382-393):
```typescript
const onboardingToolSchemas: AITool[] = [
  {
    name: 'assess_profile',
    description: "Extract the athlete's experience, confidence, and adherence-risk profile ...",
    parameters: {
      type: 'object',
      properties: {
        experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        readiness: { type: 'string', enum: ['fragile', 'building', 'ready'] },
        micro_action: { type: 'string', enum: ['hydration_log', 'journal_mood', 'measurements_weight'] },
        // ... see 43-RESEARCH.md Pattern 2 for the full field list
      },
      required: ['experience_level', 'adherence_risk', 'readiness', 'profile_summary', 'micro_action'],
    },
  },
];
```
**Note:** decide during planning whether `assess_profile` joins `allToolSchemas` (registry.ts:575-590) — if the onboarding route uses a scoped tool surface (recommended, Anti-Patterns section of RESEARCH.md), `assess_profile` should be registered in `executors` (for `getToolExecutor()` lookup) but importable separately for the onboarding route's narrowed `tools: {...}` object, not spread into the general chat's tool set.

**Executor registration** (line pattern from 159-161):
```typescript
assess_profile: OnboardingTools.assess_profile,
```

---

### `backend/api/src/config/models.ts` — `ONBOARDING_MAX_STEPS` constant (config)

**Analog:** same file, `AGENT_MODEL`/`VISION_MODEL` (lines 1-13) — "change model/limit constants in ONE file" convention.
```typescript
// ADD, next to AGENT_MODEL/VISION_MODEL:
export const ONBOARDING_MAX_STEPS = 8;
```

---

### `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx` (NEW) — chat screen (component, streaming)

**Analog:** `apps/mobile/app/(app)/ai/index.tsx` (full file, 461 lines)

**Imports pattern** (lines 1-25):
```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useThemeStore } from '../../../src/stores/themeStore';
import { useTranslation } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
```
Ziko's screen does NOT need `useAIStore`/`useCreditStore`/`CREDIT_COSTS`/community imports (index.tsx lines 18, 20-21, 23) — those are chat-specific and credit-gated; onboarding is a separate, uncredited flow with its own local streaming state (or a new minimal store), not a reuse of `useAIStore` (which is wired to `/ai/chat/stream` + `aiBridge`).

**Reusable pieces verbatim:**
- `MarkdownText` + `renderMarkdown()` (lines 73-133) — copy as-is for Ziko's bubble rendering.
- `MessageBubble` (lines 135-161) — copy as-is; swap avatar/name from generic AI icon to Ziko's placeholder avatar (D-07).
- `FlatList` + `KeyboardAvoidingView` + input bar shape (lines 313-390) — copy the layout, drop the credit-badge (`CREDIT_COSTS.chat⚡`, lines 384-386) since Ziko is uncredited.

**`useFocusEffect` re-poll pattern** (lines 189-199, this is D-14's precedent):
```typescript
useFocusEffect(
  useCallback(() => {
    const loadBalance = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetchBalance(session.access_token);
      }
    };
    loadBalance();
  }, [])
);
```
Apply the identical shape for the mission-card completion check, replacing `fetchBalance` with a direct `supabase.from('hydration_logs' | 'journal_entries' | 'body_measurements').select('id').eq('user_id', userId).gte('created_at', todayStart).limit(1)` read (RLS already scopes to own rows; table names confirmed live at `supabase/migrations/012_new_plugins_schema.sql:48,112,133`).

**Streaming state pattern:** `apps/mobile/src/stores/aiStore.ts:95-173` (`sendMessage`) shows the SSE-consumption shape via `aiBridge.sendMessage(...)` — Ziko's chat can either reuse `aiBridge` pointed at the new `/ai/onboarding/stream` endpoint, or hand-roll a local fetch+SSE-parse in the screen/store; either way, copy the optimistic-user-message-append + `isStreaming`/`streamingContent` state shape from lines 106-172.

---

### `apps/mobile/app/(auth)/onboarding/step-7.tsx` — MODIFIED redirect target (component)

**Analog:** same file, `OBReady.handleFinish()` (lines 58-85)

**Current pattern (to modify):**
```typescript
const handleFinish = async () => {
  setIsLoading(true);
  try {
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) {
      await supabase.from('user_profiles').upsert({ id: uid, /* ... */ onboarding_done: true });
    }
    await (PluginLoader as any).preloadMandatory?.();
    await refreshProfile();
    router.replace('/(app)');   // ← CHANGE: replace with router.replace('/(auth)/onboarding/ziko-chat')
  } catch (err: any) {
    showAlert('Erreur', err.message ?? 'Une erreur est survenue');
  } finally {
    setIsLoading(false);
  }
};
```
Keep everything before the `router.replace` call unchanged (the `user_profiles.onboarding_done = true` upsert still happens here — D-01 says Ziko chat is inserted *after* this, not instead of it). Also add `ziko-chat` as a `<Stack.Screen>` in `apps/mobile/app/(auth)/onboarding/_layout.tsx` (currently lists `step-1` through `step-7` only, lines 56-62) with `gestureEnabled: false` (already the stack default per line 53) to prevent back-swipe past the mandatory chat.

**Celebration entrance animation to reuse** (lines 6-13, 102-113):
```typescript
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, FadeInUp,
} from 'react-native-reanimated';
// ...
<Animated.View
  entering={FadeInUp.springify().damping(12)}
  style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center', /* shadow */ }}
>
  <Ionicons name="checkmark" size={38} color="#fff" />
</Animated.View>
```
Directly reusable for both the Ziko chat's own entrance and the D-15 full-screen celebration overlay.

---

### `apps/mobile/app/(auth)/_layout.tsx` — MODIFIED mandatory-gate fix (route-guard)

**Analog:** same file (full file, 21 lines) — this is the file being fixed, not an external analog.

**Current (buggy per Pitfall 1):**
```tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (session && profile?.onboarding_done) {
    return <Redirect href="/(app)" />;
  }
  // ...
```
**Required change** (per RESEARCH.md Pattern 4 — add a second store field `athleteOnboardingComplete`, sourced from `athlete_state.status`):
```tsx
const athleteOnboardingComplete = useAuthStore((s) => s.athleteOnboardingComplete);

if (session && profile?.onboarding_done && athleteOnboardingComplete) {
  return <Redirect href="/(app)" />;
}
```

---

### `apps/mobile/src/stores/authStore.ts` — MODIFIED `refreshProfile()` (store, CRUD)

**Analog:** same file, `refreshProfile()` (lines 70-83)

**Current pattern:**
```typescript
refreshProfile: async () => {
  const user = get().user;
  if (!user) return;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!error && data) {
    set({ profile: data as UserProfile });
  }
},
```
**Extension pattern** (add `athlete_state.status` read in parallel, add retroactive-recompute trigger — matches the file's existing single-query style, extended to `Promise.all`):
```typescript
refreshProfile: async () => {
  const user = get().user;
  if (!user) return;

  const [{ data: profileData, error }, { data: stateData }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).single(),
    supabase.from('athlete_state').select('status').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!error && profileData) set({ profile: profileData as UserProfile });
  set({ athleteOnboardingComplete: stateData?.status === 'active' });

  if (profileData?.onboarding_done && stateData === null) {
    // Pre-v1.18 athlete — fire-and-forget retroactive recompute (ONBOARD-06)
    triggerRetroactiveRecompute(user.id).catch(() => {});
  }
},
```
Add `athleteOnboardingComplete: boolean` to the `AuthState` interface (line 7-19) alongside the existing `session`/`user`/`profile` fields.

---

### `packages/plugin-sdk/src/i18n.ts` — MODIFIED new namespace (config/i18n)

**Analog:** same file, existing `onboarding.*` namespace (fr block lines 65-80, mirrored in the `en` block starting at line 837)

**Pattern to copy** (fr entries, lines 66-80):
```typescript
'onboarding.step': 'Étape {current} sur {total}',
'onboarding.whatsYourName': 'Comment tu t\'appelles ?',
// ...
```
Add a new, non-colliding namespace — CONTEXT.md's working name `coach.onboarding.*` risks confusion with the existing `coach.*` namespace (coach-platform-facing); prefer `ziko.*` (e.g. `ziko.placeholder`, `ziko.submitButton`, `ziko.missionCardCta`, `ziko.errorRetry`) to avoid any collision with the pre-existing `onboarding.*` (structured 7-step flow) or `coach.*` (Mon Coach plugin) namespaces already in this file. Add the same keys to BOTH the `fr` dict (near line 80, after the existing `onboarding.*` block) and the `en` dict (near the equivalent point after line 837) — `translations = { fr, en }` (line 1664) requires both to exist or `t()` silently falls back to the key string itself (line 1723's `dict[key] ?? translations.en[key] ?? key` fallback chain).

---

## Shared Patterns

### Backend Supabase client selection (`clientForUser`)
**Source:** `backend/api/src/tools/db.ts:1-16`
**Apply to:** `tools/onboarding.ts`'s `assess_profile` executor and any retroactive-recompute helper — always call `clientForUser(userToken)`, never construct a raw `createClient()` inline (that pattern is reserved for route-level exceptions like `routes/ai.ts`'s `vision/nutrition` storage-download client, lines 373-377, which needs the user's own Bearer token for RLS reasons `clientForUser` doesn't cover).
```typescript
export function clientForUser(_userToken?: string) {
  return createClient(supabaseUrl, serviceKey ?? supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

### AITool schema shape (backend tool registry)
**Source:** `backend/api/src/tools/registry.ts:23-31` (`AITool` interface), reused ~14 times across every existing `*ToolSchemas` block in the same file.
**Apply to:** `assess_profile`'s schema definition — this is the ONE conversion point (`routes/ai.ts:120-142`'s `buildSDKTools()`) that turns these into SDK `tool()` calls; never hand-write a Zod `inputSchema` directly in a route.
```typescript
export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}
```

### SSE stream wire format
**Source:** `backend/api/src/routes/ai.ts:238-285` (`/chat/stream` handler body)
**Apply to:** the new onboarding route — same `data: {"type":"meta"|"chunk"|"actions"|"error",...}\n\n` ... `data: [DONE]\n\n` format, so `ziko-chat.tsx` can reuse the exact same client-side SSE parser as `aiStore.ts`/`aiBridge` (no new wire protocol).

### Credit-gate exemption
**Source:** `backend/api/src/middleware/creditGate.ts` (full file, `creditCheck`/`creditDeduct` factories) — study to understand what NOT to apply.
**Apply to:** the onboarding route must mount WITHOUT `creditCheck('chat')`/`creditDeduct('chat')` in its middleware chain, unlike every other `/ai/*` route (`chat/stream`, `chat`, `vision/nutrition`, `programs/generate` all use this pair). This is the single highest-risk pitfall flagged in RESEARCH.md (Pitfall 2) — a fresh signup has `balance = 0` and cannot legally skip a mandatory flow.

### RPC self-healing write path (`record_athlete_decision`)
**Source:** `supabase/migrations/20260831120200_athlete_decisions_rpc.sql:23-123` (function body, direct read, live in production)
**Apply to:** every write this phase performs to `athlete_state`/`athlete_decisions` — both the fresh-onboarding `assess_profile` call and the retroactive-recompute call MUST go through this RPC. `p_evidence` is a required non-null JSONB object (guard at lines 46-48) or the call returns `{success:false, error:'evidence_required'}` rather than throwing — callers MUST check `data.success`, not just the absence of a thrown `error`.

### Mission-card real-data completion check (`useFocusEffect` re-poll)
**Source:** `apps/mobile/app/(app)/ai/index.tsx:189-199` (credit-balance refetch-on-focus)
**Apply to:** `ziko-chat.tsx`'s mission-card / celebration trigger (D-14) — same `useFocusEffect(useCallback(() => {...}, []))` shape, swap the balance fetch for a direct Supabase read of the target log table.

## No Analog Found

None — every file identified from CONTEXT.md/RESEARCH.md has a direct, closely-matching analog already shipped in this codebase. This phase is explicitly scoped (per RESEARCH.md) as additive composition of already-existing patterns; no net-new architectural shape is introduced.

## Metadata

**Analog search scope:** `backend/api/src/routes/`, `backend/api/src/tools/`, `backend/api/src/context/`, `backend/api/src/config/`, `backend/api/src/middleware/`, `apps/mobile/app/(app)/ai/`, `apps/mobile/app/(auth)/onboarding/`, `apps/mobile/app/(auth)/`, `apps/mobile/src/stores/`, `packages/plugin-sdk/src/`, `supabase/migrations/` (Phase 42 files + `001_initial_schema.sql` + `012_new_plugins_schema.sql`)
**Files scanned:** 15 direct reads (`routes/ai.ts`, `tools/registry.ts`, `tools/hydration.ts`, `tools/coach.ts`, `tools/db.ts`, `context/conversation.ts`, `config/models.ts`, `middleware/creditGate.ts`, `apps/mobile/app/(app)/ai/index.tsx`, `apps/mobile/app/(auth)/onboarding/step-7.tsx`, `apps/mobile/app/(auth)/onboarding/_layout.tsx`, `apps/mobile/app/(auth)/_layout.tsx`, `apps/mobile/src/stores/aiStore.ts`, `apps/mobile/src/stores/authStore.ts`, `packages/plugin-sdk/src/i18n.ts`) + 2 migration files (`20260831120000_athlete_state.sql`, `20260831120200_athlete_decisions_rpc.sql`) + grep confirmation of `hydration_logs`/`journal_entries`/`body_measurements` table names (`012_new_plugins_schema.sql`) and `ai_conversations.plugin_context` column (`001_initial_schema.sql`)
**Pattern extraction date:** 2026-09-01

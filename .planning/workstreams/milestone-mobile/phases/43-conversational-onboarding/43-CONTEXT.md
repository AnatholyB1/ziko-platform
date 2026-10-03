# Phase 43: Conversational Onboarding - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A new athlete is profiled through a short, mascotte-led free-text conversation (≤4 questions), immediately given one achievable micro-action, and their inferred starting state is written to `athlete_state`. This runs as a final step *after* the existing 7-step structured onboarding (`apps/mobile/app/(auth)/onboarding/step-1..7.tsx`) — a complement, not a replacement. Athletes who already completed the pre-v1.18 structured onboarding get a starting level retrospectively computed by the AI from real activity history the next time they open the app — never a flat default.

**In scope:**
- New mascotte ("Ziko") chat screen, mandatory, running once right after `OBReady` (step-7's "ready" state) and before the athlete lands on the home tab
- `assess_profile` AI tool — extracts experience/confidence/adherence-risk profile with self-reported confidence per attribute from free-text answers
- AI-generated (not fixed-bank) question flow, ≤4 questions, structured-but-flexible system prompt guidance
- Micro-action assignment + hand-off to an existing plugin + real-data-verified celebration
- Starting `athlete_state` write via `record_athlete_decision()` (Phase 42's RPC) — level/palier/focus/readiness
- Lazy retroactive recompute path for pre-v1.18 athletes (triggered on next app open, no cron/backfill dependency)

**Out of scope (belongs to later phases):**
- Weekly adaptive decision engine / real-activity-vs-focus comparison — Phase 44
- Reward pool / points / tiers — Phase 45
- `PluginManifest.minLevel` / `PluginLoader` gating — Phase 46 (nothing is locked yet in Phase 43; micro-action target plugins are assumed always-available)
- `athlete_state` as a 7th context query / system-prompt injection for the *ongoing* orchestrator, push notifications, `ai_cost_log` coverage — Phase 47
- Commissioned/real mascotte artwork — placeholder only this phase
- Renaming/customizing Ziko — Ziko is fixed for onboarding, separate from the persona plugin's editable coach identity
- Extended multi-state animated mascotte (explicitly deferred to a future milestone per PROJECT.md SEED-001 framing)

</domain>

<decisions>
## Implementation Decisions

### Trigger & placement (ONBOARD-01, ONBOARD-05)

- **D-01:** The Ziko chat runs once, immediately after the existing `OBReady` screen's "C'est parti" action (`apps/mobile/app/(auth)/onboarding/step-7.tsx`) — inserted between the existing structured flow and the athlete's first view of `/(app)`. Not interleaved with step-7's loading animation, not deferred to a later app-open prompt.
- **D-02:** The Ziko chat is **mandatory** — no skip option. A visible skip button would force a fallback-default `athlete_state` write, which contradicts ONBOARD-06's "never a flat default" principle and the milestone's broader "grounded, not defaulted" discipline.

### Retroactive recompute for pre-v1.18 athletes (ONBOARD-06)

- **D-03:** Lazy, on-next-app-open trigger — mirrors the already-established v1.4 lazy-daily-reset pattern (STATE.md Key Decision, avoids Vercel at-least-once cron double-processing risk). On app open, if `onboarding_done = true` but no `athlete_state` row exists, the AI computes a starting level from real activity history on the spot. No one-time backfill script, no dependency on Phase 44's weekly cron.

### Conversation persistence (ONBOARD-01, ONBOARD-02)

- **D-04:** The Ziko chat reuses the existing AI conversation/persistence stack — `getOrCreateConversation()` / `appendMessages()` (`backend/api/src/context/conversation.ts`), same SSE streaming pattern as `/ai/chat/stream`. A dedicated onboarding conversation type/tag distinguishes it from regular chat. This allows mid-flow resume if the app is killed before the 4 questions complete.

### Mascotte presentation

- **D-05:** Visual shape: static avatar + standard chat-bubble list, reusing the existing chat UI pattern already built in `apps/mobile/app/(app)/ai/index.tsx` (FlatList, streaming bubble rendering, markdown renderer) — not a bespoke full-screen conversational experience, not text-only/no-avatar.
- **D-06:** Name: **Ziko**. Tone: playful but restrained — informal `tu` (tutoiement), energetic/warm word choice, **no emoji**, no slang/argot. Consistent register with (but more playful than) the existing rule-based `AICoachInline` tips tone already shipped in v1.7.
- **D-07:** Avatar artwork: placeholder only this phase (e.g. an Ionicons glyph or a simple `#FF5C1A` circle avatar) — swappable later without touching chat logic. No commissioned/generated character art blocks this phase.
- **D-08:** Ziko is a **separate, fixed identity** from the persona plugin's customizable AI coach (`plugins/persona/`). Ziko is always "Ziko" for the one-time onboarding conversation regardless of whatever name/personality the athlete later configures their ongoing coach to have. Avoids coupling Phase 43 to persona-plugin state that may not exist yet for a brand-new athlete.

### Question content & tone (ONBOARD-02)

- **D-09:** Questions are **fully AI-generated per athlete**, not a fixed/translated question bank and not hand-written by Claude in advance. No fixed copy exists to review line-by-line in CONTEXT.md.
- **D-10:** System prompt gives **structured guidance, free wording**: it must name the 3 required signal categories (experience level, confidence, adherence-risk/constraints) the AI has to extract across ≤4 questions in Ziko's voice — but exact phrasing and question-to-question sequencing (adapting to the prior answer) is the model's discretion. This is the mechanism that guarantees ONBOARD-02 coverage without a fixed script.
- **D-11:** i18n resolution for the dynamic/AI-generated-questions ↔ fr/en tension: the AI generates question text **directly in the athlete's stored app locale** (fr or en) per the system prompt — there is no `t()` key for AI-generated text, since it isn't a fixed string. Static screen chrome around it (input placeholder, submit button, intro/closing copy, error states, the "mission" card copy) **does** go through `useTranslation()` with a new `coach.onboarding.*` (or similar) key namespace in both `fr` and `en`, per the COACH-14 precedent (`packages/plugin-sdk/src/i18n.ts`).

### Micro-action & celebration (ONBOARD-03, ONBOARD-04)

- **D-12:** At the end of the chat, Ziko's final message includes an inline summary/mission card (e.g. "Ta première mission : bois un verre d'eau") with a CTA button. Tapping it deep-links into the target plugin's existing log/completion screen — the micro-action is **not** a self-contained one-tap confirmation inside the onboarding screen itself.
- **D-13:** Micro-action target is drawn from a **small curated set** of low-friction, always-available actions — not any arbitrary installed plugin at the AI's full discretion. Starting candidates (finalize exact list during planning): log a glass of water (hydration), log today's mood (journal), log body weight (measurements). Matches the milestone's own "eau seule pour un débutant fragile" framing and avoids the AI suggesting something that isn't genuinely a 1-tap win for a brand-new athlete with zero history.
- **D-14:** Completion detection is **grounded in real logged data**, not a self-reported tap — returning to/resuming the onboarding flow re-checks the actual underlying table (e.g. a `hydration_logs` row for today) before firing the celebration. This applies the research's Pitfall 1 grounding discipline ("never trust model-asserted or self-reported completion") to the very first athlete interaction in the v1.18 system, not just to later autonomous AI decisions.
- **D-15:** Celebration is a **full-screen Ziko moment** — a brief overlay (Ziko avatar + playful congratulatory copy + simple animation, can reuse the `FadeInUp`/spring entrance pattern already present in `OBReady`) before returning to the home tab. Not a lightweight toast — this is treated as a real "first win" retention beat, not a routine confirmation.

### Claude's Discretion

- Exact final list of curated micro-action target plugins/actions beyond the three starting candidates (D-13) — confirm during planning against what's genuinely zero-setup for a brand-new athlete.
- Exact `coach.onboarding.*` (or equivalent) i18n key namespace naming and full fr/en key set (D-11).
- Exact mechanism for "resume Ziko chat if app was killed mid-flow" (D-04) — e.g., whether the onboarding route checks for an existing open onboarding-tagged conversation on mount.
- Exact placeholder avatar treatment (icon choice, sizing) within D-07's constraint (placeholder only, swappable later).
- Exact polling/refetch mechanism and timing for D-14 (e.g., on-focus refetch via `useFocusEffect` vs. a dedicated "check completion" button) — implementation detail, not a product decision.
- Whether the onboarding-tagged AI conversation uses a distinct `stopWhen` cap (research's SUMMARY.md suggests raising the interactive-turn step cap to a named constant like 8, never touching the shared `/ai/chat` default) — technical detail for planning/research to confirm against the ≤4-question UX requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §Onboarding Conversationnel (ONBOARD) — ONBOARD-01 through ONBOARD-06 acceptance criteria (project-root file, not in the workstream directory)
- `.planning/workstreams/milestone-mobile/ROADMAP.md` §Phase 43 — phase goal, 5 success criteria, dependency on Phase 42
- `.planning/workstreams/milestone-mobile/STATE.md` — Key Decisions locked project-wide (readiness enum, RPC-only write path, weekly-engine funding model, lazy-reset precedent)

### Prior Phase Context (Phase 42 — foundation this phase writes against)

- `.planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-CONTEXT.md` — `readiness` enum (`'fragile' | 'building' | 'ready'`, default `'fragile'`), `record_athlete_decision()` as the sole write path, rolling-summary/recent-window read convention
- `.planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-04-SUMMARY.md` — live schema state: `athlete_state`/`athlete_decisions`/`record_athlete_decision()` are live, empty, RLS-enforced on the production Supabase project (`ziko`, ref `slkobhavpwsubnsmuhya`); `record_athlete_decision()` requires a genuine `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` — the publishable-key fallback authenticates as `anon`, denied EXECUTE by design

### Research (already answers most technical shape questions)

- `.planning/research/SUMMARY.md` — Phase 2/"Conversational Onboarding" rationale, recommended stack (`stopWhen`/`isStepCount` composable conditions, `generateObject` structured extraction), Pitfall 1 (grounding discipline)
- `.planning/research/ARCHITECTURE.md` — `assess_profile` tool shape, onboarding branch in `routes/ai.ts` system-prompt building
- `.planning/research/STACK.md` — `ai` v6 `stopWhen: [isStepCount(8), hasToolCall(...)]` pattern for the interactive onboarding turn (raise from 5 to a named constant, never touch the shared `/ai/chat` default)
- `.planning/research/PITFALLS.md` — Pitfall 1 (AI decisions must be grounded in real logged data, not conversation memory or self-report) — directly informs D-14
- `.planning/research/FEATURES.md` — table-stakes conversational intake + adaptive first-session difficulty + quick-win celebration framing

### Existing Precedent (read before writing any screen/tool/migration)

- `apps/mobile/app/(auth)/onboarding/step-7.tsx` — existing `OBReady`/loading-phase pattern; Ziko's chat is inserted after this screen's "C'est parti" CTA (D-01); reuse its `FadeInUp` entrance animation for the celebration (D-15)
- `apps/mobile/app/(app)/ai/index.tsx` — existing AI chat screen (FlatList bubbles, SSE streaming consumption, inline markdown renderer) — the base pattern for Ziko's chat UI (D-05)
- `backend/api/src/context/conversation.ts` — `getOrCreateConversation()`/`appendMessages()` — the persistence pattern Ziko's chat reuses (D-04)
- `plugins/persona/src/manifest.ts` — the existing customizable-coach-identity plugin Ziko is deliberately kept separate from (D-08)
- `packages/plugin-sdk/src/i18n.ts` — i18n key namespace pattern to extend for onboarding UI chrome (D-11), per the `COACH-14` precedent
- `supabase/migrations/026_ai_credits.sql` — `SECURITY DEFINER` RPC precedent `record_athlete_decision()` (Phase 42) already follows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/app/(app)/ai/index.tsx` — chat bubble list, SSE stream consumption, `renderMarkdown()`/`MarkdownText` inline formatter — directly reusable component shapes for the Ziko chat screen.
- `apps/mobile/app/(auth)/onboarding/step-7.tsx`'s `OBReady` — `FadeInUp.springify().damping(12)` entrance animation, icon-pulse (`withRepeat`/`withSequence`) pattern — reusable for both Ziko's chat entrance and the D-15 celebration overlay.
- `backend/api/src/context/conversation.ts` — conversation persistence functions Ziko's chat calls directly.
- `packages/plugin-sdk/src/i18n.ts` — existing `fr`/`en` dictionary structure to extend with a new `coach.onboarding.*` (working name) namespace.

### Established Patterns
- **Mandatory, no-skip flow gating:** existing onboarding steps (`_layout.tsx`) already enforce sequential step completion — the same pattern (no back-skip past a required screen) applies to inserting Ziko's chat as a new mandatory final step.
- **AI SDK v6 conventions (backend, per CLAUDE.md):** `inputSchema` not `parameters`; `stopWhen: stepCountIs(n)` not `maxSteps`; `input`/`output` not `args`/`result` in tool callbacks. `assess_profile` tool must follow this.
- **Backend ESM import rule:** any new `assess_profile` tool file / onboarding route additions under `backend/api/src/` need `.js`-suffixed relative imports even for `.ts` sources.
- **RLS/write-lockdown from Phase 42:** any `athlete_state` write from this phase's onboarding flow MUST go through `record_athlete_decision()` — direct table writes are revoked at the DB grant level for `authenticated`, `service_role`, and `anon` alike.

### Integration Points
- `backend/api/src/tools/registry.ts` — `assess_profile` registers here alongside existing tool schemas, following the same shape as every other plugin's `aiTools`.
- `record_athlete_decision()` RPC (Phase 42, live) — the single write path for the starting `athlete_state` row this phase produces.
- Target plugins for the micro-action hand-off (D-13) — hydration/journal/measurements log screens, whichever existing routes those plugins already expose for a single quick log entry.

</code_context>

<specifics>
## Specific Ideas

- Mascotte name: **Ziko** (matches the app/brand name itself). Personality: **playful**.
- Tone calibration from discussion: playful + informal `tu`, but explicitly **no emoji**, no slang/argot — "playful but restrained," closer to the app's existing warm-but-clean copy voice than to a cartoonish chatbot register.
- Example question flavor discussed (illustrative, not locked — actual wording is AI-generated per D-09): "Sois honnête avec moi — la dernière fois que t'as fait du sport sérieusement, c'était quand ?"
- Milestone's own framing reused directly in decisions: "eau seule pour un débutant fragile → escalade progressive" — informs both the `readiness` default (Phase 42) and the curated micro-action set (D-13).

</specifics>

<deferred>
## Deferred Ideas

- **Real/commissioned mascotte artwork for Ziko** — explicitly deferred past this phase (D-07). Placeholder avatar only; art production is a separate future effort, not blocking Phase 43's engineering/conversation-design work.
- **Ziko as the persona plugin's default identity** — considered and explicitly rejected for this phase (D-08); Ziko stays a fixed, separate onboarding-only character. If a future need to unify onboarding identity with the ongoing customizable coach emerges, it's a new discussion, not a retrofit here.
- **Fixed/translatable question bank instead of full AI generation** — considered and rejected (D-09); noted here so a future revisit (e.g. if manual review shows the AI drifting off the required signal categories) has the alternative on record.
- **Extended multi-state animated mascotte, factions/leagues/social layer** — already out of scope at the milestone level per PROJECT.md's SEED-001 framing; not re-litigated in this phase's discussion.

None of the areas discussed introduced genuinely new capabilities outside ONBOARD-01–06's existing scope — all four gray areas were implementation-detail and product-voice refinements within the phase boundary.

</deferred>

---

*Phase: 43-conversational-onboarding*
*Context gathered: 2026-09-01*

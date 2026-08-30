# Pitfalls Research

**Domain:** Autonomous AI decision-making layered onto an existing single-orchestrator AI architecture (conversational onboarding, weekly adaptive decision engine, tiered AI-selected rewards, progressive feature unlock, append-only decision journal) — Ziko Platform v1.18 AI Coach Core
**Researched:** 2026-08-30
**Confidence:** MEDIUM-HIGH (grounded in existing codebase precedent + verified platform docs; French ANJ loot-box classification is explicitly unsettled law, flagged LOW where noted)

## Critical Pitfalls

### Pitfall 1: AI decisions grounded in conversation memory instead of real logged data

**What goes wrong:**
The weekly decision engine and the AI tools (`create_goal`, `create_reward`, `create_program`) reason from whatever is in the LLM's context window — including the athlete's own claims in chat ("j'ai fait ma séance") and prior AI-authored summaries in `athlete_decisions` — rather than re-querying `workout_sessions`, `session_sets`, `habit_logs`, etc. at decision time. The model then rewards or escalates a track based on progress that never happened in the database, because LLMs generate plausible continuations of context, they do not verify facts against a source of truth unless forced to.

**Why it happens:**
The existing single-orchestrator pattern (`backend/api/src/context/user.ts` → `fetchUserContext`) already injects a snapshot of DB state into the system prompt once per request. It is tempting to reuse that same snapshot for the weekly engine, or worse, to let the model rely on the running `athlete_decisions` journal ("last week I decided X, so this week must be Y") instead of re-fetching current numbers. A single hallucinated "completed 4/4 sessions" then propagates forward because every subsequent decision cites the prior (wrong) decision as fact rather than re-deriving from source tables.

**How to avoid:**
- The weekly decision engine's tool executors must query real tables at call time (not accept model-asserted counts as input) — the same discipline already used by credit-earn hooks, which are idempotent and DB-verified rather than trusting client/model claims.
- Treat `athlete_decisions` entries as an audit trail, never as the source of truth for "what happened" — always re-derive current-week metrics from `workout_sessions`/`session_sets`/`habit_logs`/`nutrition_logs` directly in the tool executor, and pass only that freshly-queried summary into the prompt for the current run.
- Reward/goal/track-transition tools should validate their own preconditions server-side (e.g. "escalate track" tool checks `SELECT count(*) FROM workout_sessions WHERE ...` itself) rather than trusting an `input` field the model supplies, mirroring the SECURITY DEFINER + server-side-check pattern already used in `deduct_ai_credits`.

**Warning signs:**
- A reward or track escalation happens for a week where the underlying activity tables show no matching rows.
- QA notices the AI citing "as decided last week" language for something that was never actually verified against fresh data.

**Phase to address:**
Moteur de décision adaptatif hebdo (tool executor design) — must be locked before any AI tool is allowed to write `athlete_state`.

---

### Pitfall 2: Naive per-athlete cron fan-out blows Vercel duration/cost budget as the user base grows

**What goes wrong:**
The existing `coach/ai/monitor-cron` precedent iterates coaches → clients in a single sequential `for` loop inside one Hono route, doing cheap Supabase queries only (no LLM calls). If the weekly AI Coach Core engine is built the same way — one cron invocation that sequentially calls the Claude agent (multi-step tool loop, `stopWhen: stepCountIs(5)`) for every athlete — the function will hit Vercel's hard `maxDuration` ceiling (300s Pro default, 800s max) long before all athletes are processed once the athlete count grows, and cost scales linearly and invisibly with active users regardless of whether they engaged that week.

**Why it happens:**
Copy-pasting the working `monitor-cron` pattern feels safe because it already exists in this codebase, but that pattern was designed for lightweight rule-based DB reads, not multi-step LLM tool-calling loops (each Claude call is 1-5+ seconds, sometimes with 3-5 tool round-trips). At even a few hundred athletes, a single-invocation sequential loop will silently truncate mid-run when the function times out, leaving the remaining athletes' weekly decisions never made — with no error surfaced to anyone.

**How to avoid:**
- Do not process athletes inside a single long-lived cron invocation. Use the cron only as a *trigger* that enqueues per-athlete work (Vercel Queues, or a `SELECT ... WHERE due_at <= now()` batch fetch + `waitUntil`/background dispatch to a per-athlete endpoint), so each athlete's decision run is its own bounded, retryable unit.
- Design each per-athlete run to be idempotent and reconciliation-based: mark `athlete_state.week_processed_at` (or similar) transactionally as part of the same operation that writes the decision, so a retried or duplicate invocation (Vercel cron delivery is at-least-once) is a safe no-op rather than a double-decision.
- Budget and log AI cost per weekly run in `ai_cost_log` from day one (reuse v1.4's cost-logging pattern) — an autonomous weekly agent call for every athlete, independent of user-initiated actions, is a new unbounded cost line that the existing €0.75/month/user credit-gated model was never designed to absorb, since these calls are not gated by `creditCheck`/`creditDeduct` (there's no user in the loop to charge).
- Explicitly decide and document: is the weekly decision cost funded by the platform (opex) or should it consume the athlete's own AI credit allocation? This must be a conscious decision, not a default.

**Warning signs:**
- Cron logs show the function returning after the Vercel timeout with only a subset of athletes processed, and no partial-completion bookkeeping to resume from.
- `ai_cost_log` shows no entries for weekly-engine calls (cost invisible) or shows entries that spike unpredictably with total-user-count growth rather than engagement.

**Phase to address:**
Moteur de décision adaptatif hebdo (infrastructure/scheduling design), before any athlete-facing behavior is built on top of it.

---

### Pitfall 3: Reward-pool "AI selects, never rolls dice" mechanic accidentally reintroducing loot-box-adjacent randomness

**What goes wrong:**
French law does not have a bright-line statutory definition of "loot box" — the ANJ (Autorité Nationale des Jeux) publicly declined jurisdiction over loot boxes in 2018, and current legal analysis centers on whether a mechanism involves (1) financial sacrifice, (2) chance, and (3) a patrimonial (real-money-equivalent) gain; a 2024-25 legislative push (JONUM — "jeux en ligne numérique monétisables") is actively narrowing that ambiguity for game-like reward mechanics with monetizable digital objects. A design that is "AI picks from a pool, not a random draw" can still slip into ANJ-adjacent territory if: the pool is gated behind a paid tier or credit spend (financial sacrifice), the AI's selection has any non-deterministic/temperature-driven variance that functions like disguised chance, or rewards ever acquire resale/transfer/exchange value (even informally, e.g. tradeable coins, marketplace, or anything resembling an NFT/token).

**Why it happens:**
"The AI decides, it's not random" is true at the mechanism level but not automatically true at the outcome level — if the AI's selection is driven by an LLM call with default sampling temperature, two athletes with functionally identical profiles could get different tier-3 rewards on different runs, which is legally indistinguishable from chance to a regulator (and confusing to users: "why did they get X and I got Y for the same effort?"). Separately, monetization pressure tends to creep in later ("let's let users trade their reward coins" or "sell a reward-skip") — each such addition independently re-raises the three ANJ criteria even if the original design avoided them.

**How to avoid:**
- Make the AI's reward selection deterministic and explainable given the same inputs: pin `temperature: 0` (or as close to deterministic as the model allows) for the reward-selection tool call specifically, and always persist the selection rationale to `athlete_decisions` so "why did I get this reward" is answerable from the log, not from re-asking the model.
- Hard rule for this milestone (already scoped correctly per PROJECT.md: "pas de tirage aléatoire, conforme ANJ") — never let reward-pool access require spending real money or paid-tier-exclusive credits; keep the earn mechanic tied to the existing gamified coin/points balance (already explicitly separated from the cost-controlled AI-credits balance per the v1.4 dual-balance decision), and never introduce transfer, resale, or exchange of rewards between users or for cash.
- Document the "why this is not a loot box" rationale explicitly in a decision record (financial-sacrifice = no, chance = no/deterministic AI choice, patrimonial gain = no resale value) so it survives team turnover and product-pressure to "spice it up with randomness later."
- Flag this area LOW confidence on the legal side — French loot-box/JONUM law is actively evolving; this should be revisited with actual legal counsel before shipping the reward-pool feature broadly, not just validated by engineering judgment.

**Warning signs:**
- A future feature request proposes "surprise" reveal animations, mystery-box framing, or randomized reward previews — these are UX patterns borrowed from loot-box design even if the underlying selection is deterministic, and should be treated as a red flag regardless of the actual mechanism.
- Any proposal to let coins/rewards be purchased, gifted, traded, or cashed out.

**Phase to address:**
Récompenses par points/palier (mechanic design), with a documented legal-rationale checkpoint before implementation, not after.

---

### Pitfall 4: Non-punitive principle undermined by reward-calculation edge cases, not by explicit punishment logic

**What goes wrong:**
The design principle is "never punish under-performance, reward-only" — but real-world non-punitive systems still fail this in practice through *implicit* punishment: a missed week resets progress toward the next tier to zero (functionally identical to losing a streak), a delta-based reward calculation ("effort above what was asked = better reward") produces a *worse-than-baseline* reward when effort is below ask (even if nominally "still positive"), or feature-unlock logic silently regresses a user's plugin drawer back to a restricted state after an inactive week. Industry precedent (Habitica) shows that punitive streak mechanics have measurably poor recovery rates — only ~0.9% of users who lose a 2-3 day streak return to start a new one — which is exactly the outcome a "reward-only" design is trying to avoid, but can reintroduce accidentally through calculation bugs rather than explicit design intent.

**Why it happens:**
Delta-based logic ("compare real effort to what was asked") is inherently relative, and relative calculations naturally produce values below the baseline when performance is below ask — the question is whether that below-baseline outcome is *rendered* as "you get less than last time" (feels punitive) versus "you still get something, and here's how to get more next time" (feels supportive). Developers implementing the delta formula correctly on paper can still ship a UI/copy layer that frames it punitively, or a tier-progression formula that technically only ever adds points but resets the *visible* progress bar to zero at tier boundaries in a way that reads as loss.

**How to avoid:**
- Define a hard floor in the reward calculation: under-performance yields the *same or smaller positive* reward, never negative, never a downgrade from a previously-achieved tier, and never a visible "you lost points/progress" state. Points/tiers should be monotonically non-decreasing per athlete — model it as a ratchet, not a bank balance that can go down.
- Feature unlocks, once granted, must never auto-revoke due to inactivity or a single bad week — unlock is a one-way gate (test explicitly: "athlete stops logging entirely for 3 weeks — do they keep whatever plugins/tiers they'd already reached?" answer must be yes).
- Review all user-facing copy and animations for implicit-loss framing (progress bars that visibly shrink, "you missed your goal" messaging, badges that disappear) even when the underlying number never actually decreased.
- Add this as an explicit automated or manual test case per feature: "simulate zero logged activity for N weeks — assert `athlete_state` fields are monotonic non-decreasing and no unlock is revoked."

**Warning signs:**
- Any SQL `UPDATE` to `athlete_state` that can *decrease* a level, tier, or points field.
- Product copy review surfaces words like "perdu", "manqué", "réinitialisé" attached to a user-visible number.

**Phase to address:**
Système de review/suivi hebdo + Récompenses par palier — the monotonicity invariant should be a stated, tested contract before the reward calculation is implemented, and re-verified at Déblocage progressif implementation.

---

### Pitfall 5: Progressive feature unlock traps a user in a restricted state indefinitely, or the inverse — unlocks everything immediately

**What goes wrong:**
Two failure modes on opposite ends: (a) a bug or AI miscalibration means a legitimately-progressing athlete's plugin drawer never expands past the starting restricted set — because the unlock decision depends on a condition that's never satisfied (e.g. waiting for an AI judgment call that the weekly cron never successfully produces due to Pitfall 2, or a threshold calibrated for the wrong track/persona), and there is no fallback or manual override, so the user is silently capped forever; (b) the opposite bug — a calibration or off-by-one error unlocks the full 18/19-plugin drawer immediately regardless of the athlete's actual starting level, defeating the entire "restricted then earned" value proposition and overwhelming beginners with everything at once (which the existing onboarding-conversationnel goal explicitly tries to avoid for fragile beginners: "eau seule... escalade progressive").

**Why it happens:**
Unlock-by-AI-judgment is inherently harder to test exhaustively than a fixed threshold table, because the "judgment" can drift with prompt changes, model version changes (models.ts already centralizes this exact risk for other AI features), or context/token truncation cutting off the decision-relevant data. Without a deterministic floor/ceiling and a way to audit *why* a given unlock decision was (or wasn't) made, these bugs are invisible until a support ticket surfaces "I've been doing everything right for 2 months and nothing unlocked."

**How to avoid:**
- Back the AI's unlock judgment with a deterministic minimum-guarantee ladder (e.g. explicit point/week thresholds that guarantee unlock progression exists even if the AI's discretionary judgment stalls) — AI adjusts pacing within known bounds, it does not have unbounded authority to withhold forever or grant everything at once.
- Persist the unlock decision and its stated rationale to `athlete_decisions` on every run (including "no change this week, because X") so a stalled user's history is auditable and support/product can diagnose without guessing.
- Add a coach-side or admin override path (even a manual DB flag initially) to force-unlock or reset a stuck athlete's level — the existing coach-athlete linkage (`coach_client_links`) is a natural fit for a coach-triggered override later, but at minimum an internal escape hatch must exist from day one.
- Test both extremes explicitly: a synthetic "beginner who logs consistently for 8 weeks" must show visible unlock progression by week N; a synthetic "experienced profile per onboarding" must not receive the same restricted starting drawer as a beginner (already scoped: "expérimenté peut démarrer plus haut").

**Warning signs:**
- `athlete_state.level` (or equivalent) shows no change across many consecutive weekly runs for an athlete with clearly-logged consistent activity.
- Support/QA reports a user with near-zero logged activity who nonetheless has full plugin access.

**Phase to address:**
Déblocage progressif de fonctionnalités par niveau — the deterministic floor/ceiling contract must be designed alongside the AI judgment logic, not bolted on after.

---

### Pitfall 6: Append-only decision journal grows unbounded, inflating token cost/latency and causing over-fitting to stale decisions

**What goes wrong:**
`athlete_decisions` is explicitly designed append-only (GSD STATE.md-inspired) and is read back into the AI's context before every future decision. Left naive, this means: (1) token cost and latency for every weekly decision call grows linearly with tenure — an athlete active for 6-12 months accumulates dozens of journal entries, and re-sending the full log every week both costs money and pushes toward the "lost in the middle" effect where the model's attention degrades on relevant recent entries buried among old ones; (2) the AI can over-anchor on old decisions ("last month I decided a conservative track, so I'll stay conservative") even when the athlete's circumstances have materially changed (injury recovered, new goal, coach reassignment), because nothing in an unbounded append-only log signals "this is now stale, weight it less."

**Why it happens:**
Append-only is the right choice for auditability (never lose the historical record, mirroring GSD's own STATE.md pattern this design is explicitly inspired by) but auditability and "what gets fed into every future prompt" are two different concerns that get conflated if the same table/read-path serves both. It's tempting to just `SELECT * FROM athlete_decisions WHERE athlete_id = ? ORDER BY created_at` and paste it into the prompt because it's simple and it works fine in early testing with a handful of rows.

**How to avoid:**
- Separate the audit trail from the prompt-context feed: keep `athlete_decisions` fully append-only and complete for compliance/debugging, but derive a compact `athlete_state` summary (already explicitly planned per PROJECT.md: "état courant compact + journal append-only vérifiable") that is what actually gets injected into the weekly decision prompt — recompute/refresh that compact state each run rather than replaying the full log.
- If recent decision history genuinely matters for context (e.g. "don't escalate two weeks in a row"), cap what's read to a bounded recent window (last N entries or last N weeks) rather than the full history, and treat anything older as informing the compact summary only, not raw context.
- Give the compact `athlete_state` an explicit recency/validity concept — e.g. a field like "weeks since last track change" or "current track set on {date}" — so the model can reason about staleness structurally instead of needing to infer it from reading dozens of old entries.
- Load-test/token-count this specifically for a synthetic long-tenure athlete (12+ months of weekly entries) before shipping, not just for the fresh-onboarding happy path that early testing will naturally exercise.

**Warning signs:**
- Prompt token counts for the weekly decision call rise measurably for older test accounts compared to new ones, with no cap in place.
- The AI's weekly decisions for a long-tenure athlete start citing very old (months-stale) context as justification for staying conservative, ignoring clearly-changed recent activity.

**Phase to address:**
Journal de décisions IA par athlète — the compact-state/append-only-log split must be the initial design, not a later refactor once the log is already large in production.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Feed the full `athlete_decisions` log into the weekly prompt instead of a compact summary | Faster to build, simplest correct-looking output early | Token cost/latency grows unbounded with tenure (Pitfall 6); becomes expensive to refactor once months of production data exist | Never for production — acceptable only in a throwaway prototype with synthetic short histories |
| Reuse the existing sequential `monitor-cron` loop pattern for the weekly AI engine | No new infra, ships fast, matches an existing precedent in the codebase | Silent mid-run truncation once user count grows past what fits in one Vercel invocation (Pitfall 2) | Never — the existing pattern is safe only because it does not call an LLM per user; do not copy it for an LLM-per-athlete loop |
| Let the AI tool accept model-asserted "athlete completed X" as input rather than re-querying | Simpler tool schema, faster to wire up | Reward/decision hallucination risk (Pitfall 1) — silently ungrounded outcomes reach production | Never for anything that writes `athlete_state` or grants a reward |
| Ship reward-pool selection with default LLM sampling temperature | One less parameter to think about | Introduces outcome-level non-determinism that is hard to distinguish from disguised chance (Pitfall 3, ANJ risk) | Only acceptable for exploratory prototyping, never for the shipped reward-selection call |
| Skip the deterministic floor/ceiling on progressive unlock and let AI judgment fully decide | Faster to spec, feels "more AI-native" | Users can get permanently stuck or everything-unlocked-day-one (Pitfall 5) | Never — always pair AI discretion with a hard deterministic bound |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Vercel Cron (weekly engine) | Treating cron delivery as exactly-once and building a non-idempotent per-athlete decision write | Vercel cron is at-least-once; make each athlete's weekly run idempotent (transactional "already processed this week" check), same discipline as the existing lazy daily-reset credit pattern |
| `backend/api/src/tools/registry.ts` (new `create_goal`/`create_reward`/`create_program` tools) | Registering new autonomous-write tools the same way as existing user-initiated tools, without distinguishing "athlete asked for this in chat" from "AI decided this unprompted in a cron run" | New tools that can be invoked from the cron-driven agent need to work with no user JWT in context (same pattern already solved in `coach/ai/monitor-cron` using the service-role client) — audit every tool executor for an implicit assumption that a user session exists |
| Existing credit-gate middleware (`creditGate.ts`) | Assuming the weekly autonomous engine is naturally covered by `creditCheck`/`creditDeduct` because it's "just another AI route" | It isn't — there's no user-initiated request to gate. Cost must be tracked and capped independently (reuse `ai_cost_log` schema/pattern, but decide funding model explicitly, see Pitfall 2) |
| `PluginLoader` static 19-plugin map + `manifest.mandatory` | Building progressive unlock as a second, parallel gating layer that doesn't account for `mandatory: true` plugins (e.g. "Mon coach") which must always be pre-loaded regardless of level | Unlock-by-level logic must explicitly exclude `mandatory` plugins from restriction, and should probably live as a new field/check alongside `mandatory` rather than a separate ungoverned mechanism |
| Existing 7-step onboarding flow being replaced | Cutting over to conversational onboarding for all users at once, including users mid-flow on the old 7-step screens, with no compatibility/migration path | Treat this as a flow migration: version the onboarding state, ensure users already past step N of the old flow aren't dropped into a broken hybrid state; decide explicitly whether existing completed-onboarding athletes get a retroactive AI-computed starting level or are grandfathered |
| Models config (`backend/api/src/config/models.ts`) | Wiring the weekly decision engine to a hardcoded model ID instead of the centralized constant | Weekly engine (and reward-selection call) must reference the centralized `models.ts` constants exactly like every other AI route, so a future model swap doesn't require hunting across a new module |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Sequential per-athlete LLM calls inside one cron invocation | Cron function runs to the Vercel `maxDuration` ceiling and returns with a partial athlete list processed, no error surfaced | Fan-out pattern: cron enqueues work, per-athlete processing happens in separate bounded invocations with idempotent completion tracking | Somewhere between "a few dozen" and "a few hundred" athletes depending on average tool-call round-trips per decision, well within this milestone's likely first-year user growth |
| Unbounded `athlete_decisions` read on every weekly run | Token count and latency per decision creep upward specifically for long-tenure athletes; early testing (all-fresh accounts) won't reveal it | Compact `athlete_state` summary + bounded recent-window log reads (Pitfall 6) | After ~2-3 months of weekly entries per athlete if unaddressed — invisible in the first testing cycles |
| `fetchUserContext`-style 6-parallel-query pattern reused verbatim for the weekly engine, but now multiplied across every athlete every week | Supabase connection/query load spikes on the scheduled run day/hour rather than being spread out | Stagger per-athlete processing (jittered schedule based on user ID or signup date) rather than firing all athletes at the exact same cron minute | Once athlete count is large enough that a single-minute burst of N×6 queries becomes a visible load spike |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New `athlete_state`/`athlete_decisions` tables shipped without RLS | Any authenticated user could read/write another athlete's decision journal or state via a direct Supabase client call from mobile | Enable RLS + `auth.uid() = user_id` policy from the first migration that creates these tables, exactly matching the repo's universal RLS pattern — never ship the table before the policy |
| Cron-triggered tool executors trusting `c.req` input the same way user-initiated routes do | A cron route with a leaked/guessable `CRON_SECRET` (or a route accidentally left reachable without the secret check, as `monitor-cron` explicitly guards against) could be invoked to fabricate rewards/unlocks | Reuse the existing `CRON_SECRET` bearer-check pattern verbatim for the new weekly-engine route, defined before any auth middleware exactly as `monitor-cron` already does, and treat this as a mandatory checklist item for every new cron route |
| Reward/unlock tool writes using the model's own asserted athlete_id instead of a server-validated one | Prompt injection via chat (athlete manipulates the AI mid-conversation into invoking a privileged tool for a different athlete_id) could grant unearned rewards or unlocks | Tool executors must always resolve the target athlete_id from the authenticated session/cron context server-side, never accept it as a model-supplied argument that gets trusted as-is |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Reward/tier explanation is entirely opaque ("the AI decided") | Users distrust the system, especially when a peer with similar effort gets a visibly different reward | Surface a short, always-available human-readable rationale per decision (pulled from the persisted `athlete_decisions` entry, not re-generated on demand) — "why this reward" must be answerable without another AI call |
| Progressive unlock communicated only as a passive drawer change with no signal of *why* or *what's next* | Feels arbitrary/random even though it isn't (undermines the entire "not a loot box" positioning) | Explicitly show the athlete what unlocked and (at least loosely) what's next, reinforcing that progression is earned and legible, not a mystery mechanic |
| Non-punitive design not reinforced by copy/animation review | Even a strictly non-decreasing points system can *feel* punitive if the UI ever shows a shrinking bar, missed-goal red state, or "you could have gotten more" framing | Explicit copy/animation audit pass against the monotonicity invariant (Pitfall 4) before shipping any reward/unlock screen |
| Conversational onboarding (mascot, ≤4 questions) fails to disclose that answers drive an automated leveling/track decision | Users may not realize casual chat answers are determining their starting restriction level, feels like a bait-and-switch when they notice fewer features than a friend | Make the onboarding→starting-level link transparent in-flow (a lightweight "here's your starting point, based on what you told me" moment), not hidden behind the mascot chat framing |

## "Looks Done But Isn't" Checklist

- [ ] **Weekly decision engine:** Often missing idempotent per-athlete completion tracking — verify a duplicate/retried cron invocation for the same athlete+week does not double-write `athlete_state` or double-grant a reward.
- [ ] **Reward-pool AI selection:** Often missing a pinned low/zero temperature and persisted rationale — verify two runs with identical synthetic input produce the same selection, and that the rationale is stored, not just displayed transiently.
- [ ] **Progressive unlock:** Often missing the deterministic floor/ceiling backstop — verify a synthetic "8 weeks of consistent activity" athlete actually unlocks, and a synthetic "zero activity" athlete does not silently unlock everything.
- [ ] **Non-punitive reward calculation:** Often missing an explicit monotonicity test — verify no code path can decrease `athlete_state.points`/`level`/tier fields, including via a raw SQL migration or admin tool.
- [ ] **`athlete_decisions` journal:** Often missing the compact-state/full-log split — verify the weekly prompt-building code path reads a bounded summary, not `SELECT *` on the full history table.
- [ ] **New cron route (`/[whatever]/cron/weekly-decisions` or similar):** Often missing the `CRON_SECRET` bearer check defined before auth middleware — verify by curling the route without the secret and confirming a 401, exactly as the existing `monitor-cron` route does.
- [ ] **AI cost accounting for the autonomous weekly engine:** Often missing entirely because it's not behind `creditCheck`/`creditDeduct` — verify every weekly-engine LLM call writes to `ai_cost_log` and that someone has actually looked at the aggregate monthly cost projection at expected athlete-count scale.
- [ ] **RLS on new tables:** Often missing until a security review catches it — verify `athlete_state` and `athlete_decisions` both have RLS enabled and an `auth.uid() = user_id` (or equivalent) policy before any client-facing code reads/writes them directly.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Cron fan-out timeout mid-run (Pitfall 2) discovered in production | MEDIUM | Add a resumable "processed this week" marker retroactively, re-run the batch job filtered to unprocessed athletes; migrate to a queue-based fan-out before the next scheduled run rather than patching the sequential loop again |
| Hallucinated reward/decision reached production (Pitfall 1) | MEDIUM-HIGH | Because `athlete_decisions` is append-only, do not delete the bad entry — append a correcting entry, and if a reward was granted based on false data, decide explicitly (product call, not engineering) whether to claw back or honor it (clawing back real-money-adjacent rewards has its own ANJ-adjacency risk, see Pitfall 3) |
| Unbounded journal token growth (Pitfall 6) discovered only after months of production data | MEDIUM | Backfill a compact `athlete_state` summary computed from the existing full log for all current athletes in a one-time migration, then switch the prompt-building path over; full log stays intact for audit |
| Progressive-unlock stuck-user bug (Pitfall 5) reported via support | LOW | Manual DB-level override/force-unlock for the affected athlete while the root cause (calibration or a stalled cron) is fixed; this is exactly why the internal escape hatch must exist from day one |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| AI decisions ungrounded from real DB state | Moteur de décision adaptatif hebdo (tool executor design) | Tool executors independently re-query source tables; test with a chat transcript that falsely claims completed activity and confirm the decision doesn't reflect it |
| Cron fan-out cost/duration at scale | Moteur de décision adaptatif hebdo (scheduling infra) | Load test with a synthetic athlete count well above current production scale; confirm no single-invocation truncation and confirm `ai_cost_log` coverage |
| Reward-pool ANJ-adjacent randomness | Récompenses par points/palier (mechanic design + legal-rationale checkpoint) | Two identical synthetic athlete profiles produce the same reward selection; documented rationale reviewed against the three ANJ criteria |
| Implicit punishment via calculation/UI edge cases | Système de review/suivi hebdo + Récompenses par palier | Automated/manual test: zero-activity weeks never decrease `athlete_state` fields or revoke unlocks; copy/animation audit pass |
| Progressive-unlock trap (stuck or everything-day-one) | Déblocage progressif de fonctionnalités par niveau | Synthetic consistent-beginner and synthetic zero-activity test cases both produce the expected (opposite) outcomes; manual override path exists and is tested |
| Unbounded decision-journal context growth | Journal de décisions IA par athlète | Token-count the weekly prompt for a synthetic 12-month-tenure athlete before shipping; confirm compact-state/full-log split is in place from the first migration |

## Sources

- [Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — at-least-once delivery, idempotency/reconciliation guidance (HIGH confidence, official docs)
- [Vercel — Configuring Maximum Duration for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration) — 300s Pro default / 800s max ceiling (HIGH confidence, official docs)
- [Vercel — Limits](https://vercel.com/docs/limits) (HIGH confidence, official docs)
- [Vercel — Queues concepts](https://vercel.com/docs/queues/concepts) — at-least-once delivery for fan-out at scale (HIGH confidence, official docs)
- [GitHub vercel/community — Can Vercel Cron Jobs timeout?](https://github.com/vercel/community/discussions/3302) (MEDIUM confidence, community-verified)
- [ANJ — Étude sur l'offre illégale de jeux d'argent et de hasard (2023 report)](https://anj.fr/sites/default/files/2023-12/ANJ_Offre%20ill%C3%A9gale_Rapport%20final_20231215.pdf) (MEDIUM confidence, official regulator source)
- [Le Mag Juridique — La réglementation des « lootboxes »](https://www.lemag-juridique.com/categories/consommation-15612/articles/la-reglementation-des-lootboxes-2971.htm) — three-criteria test (sacrifice financier, offre publique, espérance de gain patrimonial) (MEDIUM confidence, legal commentary; flag LOW on any specific legal conclusion — recommend counsel review)
- [Assemblée Nationale — Question n°14570, loot box réglementation](https://questions.assemblee-nationale.fr/q15/15-14570QE.htm) (MEDIUM confidence, official parliamentary record)
- [JONUM legislative context summary](https://snurl.com/loot-box-jonum-nouvelle-reglementation-jeux-france.html) (LOW-MEDIUM confidence, secondary summary — law is actively evolving, verify current status before shipping)
- [UX Collective — Gamification: Why Streaks Often Go Wrong](https://uxdesign.cc/gamification-gone-wrong-stop-the-streaks-c3de42618ae) (MEDIUM confidence, industry case study incl. Habitica loss-aversion data)
- [UX Magazine — The Psychology of Hot Streak Game Design](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame) (MEDIUM confidence)
- [Mem0 — Context Window is RAM, Not Storage](https://mem0.ai/blog/context-window-is-ram-not-storage-why-most-agent-failures-happen-how-to-fix-them-in-2026) — linear token growth with unbounded append, lost-in-the-middle effect (MEDIUM confidence, vendor blog but consistent with broader literature)
- [Mastra — Long-Term Memory for AI Agents](https://mastra.ai/articles/long-term-memory-ai-agents) (MEDIUM confidence)
- Internal codebase precedent (HIGH confidence, direct source inspection): `backend/api/src/coach/ai/service.ts` (`monitor-cron` sequential per-coach loop + `CRON_SECRET` guard pattern), `backend/api/vercel.json` (existing 8-cron configuration), `.planning/PROJECT.md` Key Decisions table (v1.4 credit system: SECURITY DEFINER + SELECT FOR UPDATE race prevention, partial unique index idempotency, lazy daily-reset avoiding cron double-reset, dual-balance coin/credit separation)

---
*Pitfalls research for: Autonomous AI decision-making system (rewards, plan adaptation, feature unlocking) added to existing single-orchestrator AI fitness app architecture*
*Researched: 2026-08-30*

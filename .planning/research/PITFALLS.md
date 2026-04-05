# Pitfalls Research

**Domain:** AI credit/quota system with activity-based rewards on Vercel serverless + Supabase
**Researched:** 2026-04-05
**Confidence:** HIGH (critical pitfalls verified via official docs and authoritative post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Race Condition on Credit Deduction — Concurrent Serverless Invocations

**What goes wrong:**
Two AI requests arrive simultaneously (e.g., user double-taps "Send"). Both serverless function instances read the same credit balance (say, 3 credits). Both check "balance >= cost?" in application code and both pass. Both update the row to an absolute new value. Balance goes to -1. The `CHECK (balance >= 0)` constraint is never evaluated because both sessions read the pre-decrement value and write an absolute value — the classic read-modify-write anti-pattern.

With Vercel Fluid Compute (default since early 2025), a single function instance now handles multiple concurrent requests. Module-level variables are shared across simultaneous invocations. In-process "check then act" logic on shared state is therefore even more dangerous than in the traditional one-request-per-instance model.

**Why it happens:**
The pattern `SELECT balance → check in JS → UPDATE SET balance = newValue` is obvious to write and correct in single-threaded testing. Two sessions can both pass the check on the same stale read. Developers rarely test concurrent AI requests in local development.

**How to avoid:**
Move the check-and-decrement into a single atomic `SECURITY DEFINER` PostgreSQL function called via Supabase RPC. The function uses `SELECT ... FOR UPDATE` to row-lock before checking, then uses a relative update (not an absolute value):

```sql
CREATE OR REPLACE FUNCTION deduct_ai_credits(p_user_id UUID, p_cost INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT balance INTO v_balance
  FROM ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;                      -- row lock: concurrent calls queue here

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE ai_credits
  SET balance = balance - p_cost   -- relative: safe against concurrent writes
  WHERE user_id = p_user_id;

  RETURN v_balance - p_cost;
END;
$$;
```

Add a database-level safety net as a last resort:
```sql
ALTER TABLE ai_credits ADD CONSTRAINT positive_balance CHECK (balance >= 0);
```

The API endpoint calls this RPC first; if it raises an exception, return HTTP 402 before calling Claude. Claude is never called if the deduction fails.

**Warning signs:**
- Users reporting "credits went negative" in logs
- `balance` column showing -1 or -2 in production rows
- Two near-simultaneous AI requests both succeed when only one credit remained

**Phase to address:** Credit DB schema + RPC functions phase (Phase 1 of milestone). This must be correct before any AI endpoint is wired to credit checking.

---

### Pitfall 2: Activity Reward Double-Crediting — Non-Idempotent Event Handlers

**What goes wrong:**
A user logs a workout. The backend awards +5 AI credits. The mobile network times out before the response arrives. The mobile client retries. The backend awards +5 again. The user now has 10 credits from one workout. With daily caps, this inflates balances and breaks the €0.75/user/month cost model.

Stigg, a credits infrastructure company, documented this in a post-mortem: "Usage pipelines are at-least-once by design. We thought this would be a minor detail, but retries quickly became one of the hardest problems." Their solution required making every deduction flow idempotent.

**Why it happens:**
Reward grants are added as a side effect of the activity log endpoint with no idempotency key. Mobile clients correctly retry on timeout — which triggers duplicate awards. The problem only surfaces in production on flaky connections.

**How to avoid:**
Create a `credit_events` ledger table with a `UNIQUE` constraint on `(user_id, event_type, idempotency_key)`. The idempotency key must be deterministic from the triggering record — use the database UUID of the source row (workout session ID, habit log ID, etc.):

```sql
CREATE TABLE credit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  event_type    TEXT NOT NULL,        -- 'workout_reward', 'ai_deduction', 'daily_base', etc.
  amount        INT  NOT NULL,        -- positive = grant, negative = deduction
  idempotency_key TEXT NOT NULL,      -- deterministic from source record UUID
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_type, idempotency_key)
);
```

On insert, use `ON CONFLICT DO NOTHING` — duplicate grants are silently skipped on retry. The ledger is also the audit trail for debugging balance discrepancies.

**Warning signs:**
- User balances grow faster than expected after heavy activity logging on slow connections
- `credit_events` shows multiple rows with the same source record ID
- Mobile retry logs show reward endpoint called 2-3 times for one workout save

**Phase to address:** Credit DB schema phase. The `credit_events` table and idempotency strategy must be designed before implementing any reward triggers.

---

### Pitfall 3: Daily Reset Without Persistent Process — Vercel Cron Reliability

**What goes wrong:**
Daily base credit allocation depends on a Vercel cron. Vercel explicitly states: "We cannot assure a timely cron job invocation — a job configured as `0 0 * * *` will trigger anywhere between 00:00 and 00:59." More critically, Vercel's event-driven system "can occasionally deliver the same cron event more than once" — a non-idempotent reset doubles user balances on those days.

If the cron function iterates over all users in a single invocation, it hits the 60-second (Hobby) or 300-second (Pro) function timeout ceiling and leaves a fraction of users without their daily grant, with no retry mechanism.

**Why it happens:**
Developers port a traditional "run at midnight" cron pattern to serverless without accounting for at-least-once delivery semantics and the absence of a persistent process.

**How to avoid:**
Prefer a lazy allocation model over a push cron:
- When a user makes an AI request, check whether today's base allocation has been issued: `WHERE user_id = $1 AND event_type = 'daily_base' AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE`
- If not found, insert it atomically inside the same transaction as the credit check
- This eliminates the cron dependency entirely for base grants

If a batch cron is still required (e.g., for analysis or pro-tier features):
- Use `INSERT ... ON CONFLICT DO NOTHING` keyed on `(user_id, 'daily_base', CURRENT_DATE::text)` as the idempotency key
- Paginate the user batch (200 users per invocation) and chain via a queue rather than iterating all users at once
- Verify the `CRON_SECRET` Authorization header on the endpoint before processing

**Warning signs:**
- Some users receive double base credits on certain days (check `credit_events` for duplicate `daily_base` rows)
- Users in UTC+X time zones report their daily credits reset in the middle of their afternoon
- Cron logs show 504 timeouts when user count grows past ~500

**Phase to address:** Credit allocation architecture phase. Decide lazy vs. batch cron before writing any allocation code — changing the model later requires migrating existing logic.

---

### Pitfall 4: Timezone Inconsistency in Daily Reward Caps

**What goes wrong:**
Activity reward caps are "per day" — e.g., earn credits for up to 2 workouts per day. The backend evaluates "today" using `DATE(created_at)` which defaults to UTC. A user in Paris (UTC+2) logs their first workout at 11:30 PM local time (21:30 UTC = "today" UTC). They log another at 12:10 AM local time (22:10 UTC = still "today" UTC). Both entries fall on the same UTC day and both count against the cap — from the user's perspective, they hit their daily cap in one evening of one day.

**Why it happens:**
`TIMESTAMPTZ` is stored correctly, but cap evaluation queries use `DATE(created_at)` without timezone conversion. Developers test in a single time zone and miss the edge case.

**How to avoid:**
For v1.4 MVP: pick UTC-based resets and communicate them clearly in the UI — "Daily credits reset at midnight UTC." Most games and apps use a standardized server-time reset. Add a visible "Resets in X hours" countdown to the credit balance widget. This is the correct tradeoff for MVP: predictable implementation, clear user communication.

Do not implement per-user timezone resets in v1.4. The added complexity (storing user timezone, converting in every cap query) is not worth it until user timezone data is validated and user complaints confirm it is a pain point.

Cap queries must consistently use:
```sql
DATE(created_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')
```
Never mix `DATE(created_at)` (implicit timezone) with explicit timezone queries in different parts of the codebase.

**Warning signs:**
- User complaints: "I only logged one workout but it says I hit my daily cap"
- Users in UTC+X time zones consistently report cap issues in the evening
- Cap query results differ between two engineers in different time zones when testing locally

**Phase to address:** Cap evaluation logic phase. Commit to the timezone convention in the schema design phase; the convention must be documented and applied consistently everywhere.

---

### Pitfall 5: RLS Credit Check Per Row — Catastrophic Query Performance

**What goes wrong:**
A developer adds an RLS policy to `ai_messages` that includes a credit balance check: `USING (get_user_credits(auth.uid()) > 0)`. This function queries `ai_credits` on every row evaluated by the policy. With 10,000 messages being scanned for a history query, the database executes 10,000 credit lookups — one per row. A query that should take <5ms takes 30+ seconds.

Supabase's own documentation warns: "Policies with subqueries execute for every row. With 10,000 documents, Postgres runs 10,000 subqueries even if you need 10 rows."

**Why it happens:**
RLS feels like the correct place for access control. Credit checks feel like access control. The combination seems architecturally clean. But RLS runs at the row level, not the statement level — every function call in a policy body is re-executed per row unless explicitly wrapped for caching.

**How to avoid:**
Do NOT put credit balance checks in RLS policies. Credit enforcement belongs at the API/service layer:
1. The AI endpoint handler calls `deduct_ai_credits(user_id, cost)` RPC as its first operation
2. If the RPC raises `insufficient_credits`, return HTTP 402 before calling Claude
3. RLS on `ai_credits` itself enforces only ownership: `USING (user_id = (SELECT auth.uid()))`

For any SECURITY DEFINER function that must appear in an RLS policy (for other reasons), always wrap `auth.uid()` in a sub-select — `(SELECT auth.uid())` instead of bare `auth.uid()` — so PostgreSQL can cache the result per-statement rather than per-row:

```sql
-- Slow: evaluated per row
USING (auth.uid() = user_id)

-- Fast: cached per statement (up to 99.99% improvement per Supabase benchmarks)
USING ((SELECT auth.uid()) = user_id)
```

**Warning signs:**
- AI chat endpoints are slow (>500ms) even before Claude is called
- `EXPLAIN ANALYZE` shows thousands of function invocations on an INSERT
- Supabase Performance Advisor flags an `auth_rls_initplan` warning on the table

**Phase to address:** Credit DB schema + RPC functions phase. Establish "credit checks in API layer, not RLS" as an inviolable rule before any RLS policies are written for credit-adjacent tables.

---

### Pitfall 6: Haiku Vision Quality Regression and Deprecated Model ID

**What goes wrong:**
The food photo scan is migrated from Sonnet to Haiku for cost savings. In controlled testing with clean, well-lit images, Haiku performs acceptably. In production, users upload blurry photos, off-angle shots, dark kitchen lighting, and non-Latin packaging. Haiku misidentifies foods, returns inconsistent macro estimates, and occasionally hallucinates brand names. Users stop trusting nutrition tracking.

A separate, urgent issue: `claude-3-haiku-20240307` (the old Haiku model ID) is deprecated and retires on **April 19, 2026** — less than two weeks from the start of this milestone. Any hardcoded reference to the old ID will cause API failures on that date.

The current Haiku model is `claude-haiku-4-5-20251001`. The current Sonnet is `claude-sonnet-4-20250514`.

**Why it happens:**
QA runs with clean stock photos. The cost savings per scan are real ($1/MTok for Haiku input vs $3/MTok for Sonnet). The quality gap on degraded real-world images is not tested before launch. The deprecated model ID issue comes from copied constants that were never updated.

**How to avoid:**
- Grep for `claude-3-haiku-20240307` immediately in phase 1 of the milestone and replace with `claude-haiku-4-5-20251001`
- Build a model routing layer: Haiku first; if the response fails schema validation (missing required fields, out-of-range macro values) or Haiku self-reports low confidence, retry with Sonnet
- Run a blind quality test before committing to Haiku-only: 50 real user photos with varied quality conditions, scored for accuracy vs Sonnet
- Log the model used per scan in `credit_events.metadata` for cost attribution analysis

**Warning signs:**
- User feedback: "The app identified my chicken breast as 'protein bar'"
- Structured output parse failures increase after the model switch
- Support tickets about incorrect calorie counts post-migration
- API errors starting April 19, 2026 from the deprecated model ID

**Phase to address:** Vision model migration phase. Fix the deprecated model ID in Phase 1 (it is a breaking change on a fixed date). Define the fallback strategy and run the image quality test before shipping Haiku-only in production.

---

### Pitfall 7: Rate Limiter and Credit System Double-Gate Confusion

**What goes wrong:**
The existing Upstash Redis rate limiter (from v1.3) blocks at N requests per window. The new credit system blocks when balance = 0. Both produce errors when the user "can't make AI requests." The mobile client receives HTTP 429 (rate limit) or 402 (out of credits) but shows a generic "Service temporarily unavailable" message. Users believe the service is broken, not that they need to earn more credits.

A secondary failure: a developer sets the Redis rate limit window at the same daily request count as the credit quota. Users who spam requests hit the Redis bucket and consume their "rate limit budget" before the credit system runs, even on requests the credit system would have rejected — consuming both gates on a single user flow.

**Why it happens:**
Two independent enforcement mechanisms with overlapping effects are treated as interchangeable. Rate limiting governs request velocity (abuse prevention). Credits govern resource allocation (cost control). They have different semantics, different recovery actions, and different user communication needs.

**How to avoid:**
Keep both systems with distinct, non-overlapping configurations:
- Rate limiter: abuse threshold — high count, short window (e.g., 30 req/min per user). Not a daily budget tool.
- Credit system: daily cost allocation — enforced as a first-class business rule with recovery path

Return distinct error codes and responses:
```json
{ "error": "rate_limited", "retry_after": 60 }        // 429
{ "error": "insufficient_credits", "balance": 0, "resets_at": "2026-04-06T00:00:00Z" }  // 402
```

Mobile client handles each with specific UI:
- 429 → brief toast "Slow down a bit"
- 402 → credit exhaustion modal with "Here's how to earn more credits today" action list

Document the precedence order as a comment in the AI endpoint:
```typescript
// Gate 1: abuse prevention (rate limiter — Upstash Redis)
// Gate 2: cost control (credit system — Supabase RPC)
// Gate 3: Claude API call
```

**Warning signs:**
- Mobile error handler has a single catch-all block for all AI failures
- Users report "out of service" but their credit balance never decreased
- The Redis rate limit threshold equals or is lower than the daily credit quota

**Phase to address:** API endpoint integration phase, after both systems are built individually. The error code taxonomy and client-side handling must be designed explicitly before either system is wired into the AI endpoint.

---

### Pitfall 8: Token Counting Inaccuracy — Cost Budget Drift

**What goes wrong:**
The goal is €0.75/user/month. The team sizes credit costs per feature based on token estimates from the Vercel AI SDK's `usage` object. Six months post-launch, actual Anthropic invoices are 35% higher than projected.

Root cause: the Vercel AI SDK v6 maps Anthropic's token usage inconsistently. The [Vercel AI SDK GitHub issue #9921](https://github.com/vercel/ai/issues/9921) documents "token usage normalization" problems — input tokens are mapped incorrectly to totals, and prompt cache write costs are not represented at all. With the conversation system prompt (user context injection) being cached on repeat requests, cache reads are cheap but cache writes are expensive and untracked — the two errors partially cancel but not fully.

**Why it happens:**
Developers trust `usage.totalTokens` from the AI SDK as ground truth. The SDK abstraction hides provider-specific billing details. Estimates are validated only against each other, not against the Anthropic billing dashboard.

**How to avoid:**
- Use Anthropic's `messages.countTokens` API endpoint to calibrate per-feature token costs before setting credit prices. Count with the actual system prompt and a representative user message.
- Pull actual cost data from the Anthropic usage API weekly during the first month of production — compare against credit system projections
- Track cache hits vs. misses in `credit_events.metadata` — the system prompt is identical per user per request and should hit the cache reliably
- Set conservative hard limits: alert at 60% of monthly budget per user, hard-stop AI at 85%, leaving headroom for estimation error

**Warning signs:**
- Monthly Anthropic invoice consistently 20-40% above projections
- The `usage` object in AI SDK responses shows suspiciously round token counts
- Prompt caching is enabled but the expected cost reduction is not visible in billing

**Phase to address:** Cost modeling phase, before setting credit prices. Validate token estimates with real API calls against the Anthropic billing dashboard — not just SDK approximations.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store balance as a mutable column with no ledger | Simple schema, easy to query | No audit trail; impossible to debug discrepancies; can't reconstruct history | Never — add `credit_events` ledger from day one |
| Skip idempotency keys on reward grants | Faster to build | Double-crediting on mobile retries; inflated balances; broken cost model | Never for production |
| Put credit check in RLS policy | Feels like "proper" access control | Per-row query execution destroys performance at scale | Never |
| UTC midnight resets without communicating it | Simpler cap queries | User confusion for non-UTC users | Acceptable if clearly communicated in UI with countdown |
| Haiku-only for all vision tasks | Lower API cost | Quality regression on real-world photos; user trust damage | Only with Sonnet fallback path in place |
| Cron credit grant without idempotency | Simple cron logic | Double allocation on Vercel's occasional duplicate cron delivery | Never |
| Same error response for rate limit and credit exhaustion | One error handler on mobile | User cannot distinguish "wait" from "earn more credits" — wrong UX recovery action | Never in production |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic API + Vercel AI SDK v6 | Trust `usage.totalTokens` for cost accounting | Reconcile weekly with Anthropic usage API; use `messages.countTokens` for pre-launch calibration |
| Supabase RPC for credit deduction | Ignore exceptions from RPC call | Catch `insufficient_credits` exception; map to HTTP 402, not 500 |
| Vercel Cron for daily allocation | `UPDATE ... SET balance = base_amount` unconditionally | Use `INSERT ... ON CONFLICT DO NOTHING` with date-keyed idempotency; prefer lazy per-request allocation |
| Upstash Redis + credit system | Set rate limit threshold equal to daily credit quota | Rate limiter = abuse threshold (high, per minute); credit system = business rule (daily quota) |
| Haiku vision model | Swap model ID and test with clean images only | Test with degraded real-world photos; build confidence check + Sonnet fallback |
| Mobile client retries | Retry all failed AI requests without idempotency key | Pass deterministic `X-Idempotency-Key` header; backend uses source record UUID for reward dedup |
| Old Haiku model ID | Continue using `claude-3-haiku-20240307` | Migrate to `claude-haiku-4-5-20251001` — old ID retires April 19, 2026 |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS credit check per row | AI endpoints slow >500ms; Supabase timeouts | Move credit enforcement to API layer; never in RLS | ~1,000 rows in the table |
| Missing compound index on `credit_events(user_id, event_type, created_at)` | Daily cap queries do full table scans | Add index on table creation | ~10,000 events |
| Cron iterates all users in one invocation | 504 timeouts from Vercel | Paginate (200 users/invocation) or use lazy per-request allocation | ~500 users |
| `SELECT ... FOR UPDATE` without connection pooling | Connection exhaustion under burst traffic | Use Supabase Supavisor pooler for all serverless connections | ~50 concurrent AI requests |
| Cap query without date filter | Full scan of `credit_events` on every AI request | Always include `created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')` | ~50,000 events |
| No index on `ai_credits(user_id)` | Credit lookup slow under concurrent requests | Add index; `user_id` is the only lookup key | ~10,000 users |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Embed credit balance in JWT claims | JWT is static until refresh; stale balance enables exploitation window | Always query live balance from DB; never gate on JWT-embedded credit data |
| Accept `cost` parameter from client | Client sends `cost: 0` and gets unlimited free AI | Cost per action is hardcoded server-side; never client-supplied |
| Reward endpoint callable without auth check | Unauthenticated POST grants free credits | All reward grants require valid Supabase Bearer token; validate before any DB write |
| Cron endpoint without `CRON_SECRET` verification | Anyone can POST to `/cron/daily-credits` and mass-grant credits | Verify `Authorization: Bearer ${CRON_SECRET}` header; return 401 otherwise |
| `SECURITY DEFINER` function without `SET search_path` | Schema injection attacks | Always set `SET search_path = public` (or empty) in all SECURITY DEFINER functions |
| Log absolute credit balance in application logs | Financial PII leakage | Log only event type and delta amount; never the absolute balance |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No credit balance visible in the UI | Users send requests, get rejected without knowing why | Show balance in the AI chat header and on the photo scan button |
| Generic "error" for credit exhaustion | Users retry repeatedly, burning rate limit budget | Show "No credits left today — earn more by logging a workout" with actionable list |
| No daily reset countdown | Users don't know when to expect their next credits | Show "Resets in X hours" next to balance |
| Credit deducted shown after AI response | Feels like a surprise bill after the fact | Deduct before calling Claude; show "Using 1 credit..." in loading state |
| No feedback when activity earns credits | Users don't discover the reward system | Show "+5 credits" toast after workout/habit/meal logging |
| Daily earn cap not visible until hit | Users log more activities expecting more credits | Show "2/2 workouts rewarded today" progress next to the gamification panel |
| Coins and AI credits visually undifferentiated | Users try to spend coins on AI features | Distinct iconography: coins = shop currency (coin icon); AI credits = AI fuel (lightning bolt icon) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Credit deduction RPC:** Works in isolation — verify the refund path when Claude API call fails after a successful deduction (credits consumed but no response delivered)
- [ ] **Daily reward cap:** Correct count per day — verify the cap query uses identical timezone convention as the allocation reset logic
- [ ] **Haiku migration:** Scans work in QA — verify with degraded image set (blurry, dark, off-angle, non-Latin packaging) before shipping
- [ ] **Cron daily allocation:** Runs in test — verify idempotency when triggered twice in the same minute (Vercel duplicate delivery scenario)
- [ ] **RLS on `ai_credits`:** Allows user to read own balance — verify it blocks reads of other users' balances AND blocks direct INSERT/UPDATE (only the RPC function modifies balances)
- [ ] **Error codes on mobile:** Client handles HTTP 402 — verify it shows the "earn more credits" UI and not the generic error screen
- [ ] **Deprecated model ID audit:** Grep codebase for `claude-3-haiku-20240307` — must be zero results before any deploy
- [ ] **Token cost estimates:** Validated against actual Anthropic API billing — not just AI SDK `usage` object approximations

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Negative balances in production | MEDIUM | Set all negatives to 0 via migration; add `CHECK (balance >= 0)` constraint; deploy `deduct_ai_credits` RPC fix; audit `credit_events` for anomalies |
| Double-credited reward events discovered | LOW | Query `credit_events` for duplicate `idempotency_key` values; calculate over-credited amount; apply corrective debit events (append to ledger, never delete rows); add UNIQUE constraint |
| Cron double-fired and doubled daily allocations | LOW | Add `ON CONFLICT DO NOTHING` to allocation insert; apply corrective debit for the excess; total impact bounded by one day's base grant per user |
| Haiku quality regression causing user churn | HIGH | Roll back to Sonnet immediately (one constant change); analyze misidentification patterns; build Haiku + Sonnet fallback pipeline before re-enabling Haiku |
| Cost budget exceeded due to token estimation errors | MEDIUM | Pull Anthropic usage API data to identify gap; adjust credit costs per feature upward; communicate to users via in-app notice; implement hard per-user spend ceiling |
| RLS policy causing 30-second query timeouts | LOW | Drop the offending policy; move check to API layer; add missing index; deploy in one migration |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Race condition on credit deduction | Credit DB schema + RPC functions | Load test concurrent requests; verify no negative balances after 100 concurrent deductions |
| Activity reward double-crediting | Credit DB schema + RPC functions | Simulate mobile retry; verify `credit_events` UNIQUE constraint fires on second insert |
| Unreliable cron daily reset | Credit allocation architecture | Call the grant endpoint twice in 1 minute; verify idempotent result in `credit_events` |
| Timezone cap inconsistency | Cap evaluation logic | Document UTC-reset decision; add UI "Resets at midnight UTC" label in credit widget |
| RLS performance catastrophe | Credit DB schema + RPC functions | Run `EXPLAIN ANALYZE` on AI message insert; confirm no credit balance function calls appear |
| Haiku vision regression | Vision model migration | Run 50-photo blind test; define fallback trigger; test fallback path end-to-end |
| Rate limiter / credit double-gate confusion | API endpoint integration | Verify distinct HTTP error codes; test mobile error handler per code path |
| Token counting inaccuracy | Cost modeling (pre-launch) | Compare 10 test conversations against Anthropic billing dashboard; adjust credit prices accordingly |
| Deprecated Haiku model ID (breaking April 19, 2026) | Phase 1 — immediate | `grep -r 'claude-3-haiku-20240307' .` must return zero results before any deploy |

---

## Sources

- Stigg engineering blog: "We've built AI Credits. And it was harder than we expected." — idempotency is the hardest problem in usage pipelines (at-least-once delivery)
- [Flexprice: Credit-Based Billing for AI Applications](https://flexprice.io/blog/how-to-implement-credit-based-billing-for-ai-applications) — double-charging, optimistic locking, idempotency keys
- [EnterpriseDB: PostgreSQL Anti-Patterns Read-Modify-Write Cycles](https://www.enterprisedb.com/blog/postgresql-anti-patterns-read-modify-write-cycles) — four solutions to balance race conditions; `FOR UPDATE` pattern
- [blog.pjam.me: Atomic Increment/Decrement in SQL](https://blog.pjam.me/posts/atomic-operations-in-sql/) — relative vs. absolute update, deadlock ordering, `RETURNING` for validation
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — per-row subquery cost; `(SELECT auth.uid())` caching pattern showing up to 99.99% improvement
- [Supabase Performance and Security Advisors](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0003_auth_rls_initplan) — `auth_rls_initplan` lint warning
- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) — no timely guarantee; at-least-once delivery; idempotency requirement explicitly stated
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — concurrent requests on same instance; module-level state sharing risk introduced in early 2025
- [Vercel AI SDK GitHub issue #9921](https://github.com/vercel/ai/issues/9921) — token usage normalization inaccuracies: Anthropic input tokens mapped incorrectly, cache write costs missing
- [Anthropic Models Overview (current, April 2026)](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5-20251001` is current Haiku; `claude-3-haiku-20240307` deprecated April 19 2026
- [GitHub: Supabase SERIALIZABLE isolation discussion #30334](https://github.com/orgs/supabase/discussions/30334) — SERIALIZABLE isolation for high-concurrency updates; Supabase RPC as atomic mechanism
- [Token Counting Explained — Propel 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) — `messages.countTokens` for accurate pre-call estimation

---
*Pitfalls research for: AI credit system with activity rewards — Vercel serverless + Supabase (v1.4 milestone)*
*Researched: 2026-04-05*

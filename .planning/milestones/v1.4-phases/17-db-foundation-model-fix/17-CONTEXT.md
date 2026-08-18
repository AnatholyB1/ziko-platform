# Phase 17: DB Foundation + Model Fix - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The credit system's atomic PostgreSQL foundation exists (migration 026) and the deprecated Haiku model ID is eliminated before its April 19 retirement date. This phase delivers: credit tables with RLS, an atomic deduct RPC, a tier column on user_profiles, welcome credits for all users, and a centralized model constants file with the new Haiku ID.

</domain>

<decisions>
## Implementation Decisions

### Credit Schema Design
- **D-01:** Transaction types use a full set from day one: `deduct`, `earn`, `welcome`, `daily_base`, `monthly_base`, `admin_adjust`, `premium_grant` — avoids migration churn as Phases 18–21 land
- **D-02:** Balance column is INTEGER — 1 credit = EUR 0.001. The EUR 0.75/month ceiling = 750 credits max monthly spend. No fractional credits.
- **D-03:** `ai_credit_transactions` ledger captures full audit columns: `id`, `user_id`, `type`, `amount`, `source`, `idempotency_key`, `balance_after`, `metadata JSONB`, `created_at` — metadata stores model name, token counts, plugin_id for Phase 19 cost reconciliation
- **D-04:** `balance_after` is computed by a BEFORE INSERT trigger on `ai_credit_transactions` — reads current balance from `user_ai_credits` after the update, guarantees consistency regardless of how rows are inserted

### Welcome Credits & Initialization
- **D-05:** New users get welcome credits via a **new dedicated trigger** on `auth.users` — separate from the existing `user_profiles` trigger in migration 001. Clean separation of concerns.
- **D-06:** Welcome credit amount is defined as a **single SQL variable/constant** in the migration — tweakable before deploy without editing multiple INSERT statements
- **D-07:** Bulk insert for existing users uses `INSERT ... ON CONFLICT DO NOTHING` — idempotent, safe to re-run

### Haiku Model Scope
- **D-08:** Grep audit confirms zero occurrences of `claude-3-haiku-20240307` in code (currently true — old ID only appears in planning docs). This audit is the **first commit** of the phase.
- **D-09:** Add `VISION_MODEL = anthropic('claude-haiku-4-5-20251001')` constant ready for Phase 19 vision endpoint
- **D-10:** Extract both `AGENT_MODEL` and `VISION_MODEL` to a shared constants file at `backend/api/src/config/models.ts` — centralized model management as more models get added

### Deduct RPC Design
- **D-11:** `deduct_ai_credits(p_user_id UUID, p_cost INTEGER, p_action_type TEXT, p_idempotency_key TEXT)` — full atomic signature: check balance, deduct, insert transaction with idempotency, all in one RPC call
- **D-12:** RPC returns JSONB: `{ "success": true, "balance_after": 42 }` on success, `{ "success": false, "balance": 0, "required": 3 }` on insufficient credits — rich return for middleware 402 responses
- **D-13:** RPC is `SECURITY DEFINER` with `SELECT ... FOR UPDATE` row lock — prevents negative balance under Vercel Fluid Compute concurrent requests
- **D-14:** Premium tier bypass (`tier = 'premium'`) is **caller-side** — middleware checks tier before calling the RPC. RPC stays focused on credit math only.

### Claude's Discretion
- RLS policy pattern: use `(SELECT auth.uid())` sub-select caching pattern per requirements (not the older `auth.uid() = user_id` direct call)
- Migration numbering: 026
- Exact welcome credit amount: defined as constant, team decides before deploy
- Transaction type column: TEXT with CHECK constraint vs PostgreSQL ENUM — Claude picks based on migration flexibility

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Patterns
- `supabase/migrations/001_initial_schema.sql` — Existing `user_profiles` table definition, auth trigger pattern, RLS policy examples
- `supabase/migrations/007_gamification_schema.sql` — Existing `user_xp` / shop economy tables for dual-balance design reference
- `supabase/migrations/025_storage_buckets.sql` — Latest migration (026 is next)

### Backend Model Constants
- `backend/api/src/routes/ai.ts` L51 — Current `AGENT_MODEL` definition that will move to shared config
- `backend/api/src/tools/ai-programs.ts` — Additional model references that should import from shared config
- `backend/api/src/routes/pantry-recipes.ts` L125 — Another model reference to centralize

### Project Requirements
- `.planning/REQUIREMENTS.md` — CRED-06, CRED-07, PREM-01, COST-01 requirements for this phase
- `.planning/research/SUMMARY.md` — Credit system research with Anthropic pricing data
- `.planning/research/PITFALLS.md` — Concurrency pitfalls, deprecated model ID timeline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/001_initial_schema.sql` — Auth trigger pattern (`handle_new_user`) for new-user credit initialization reference
- `backend/api/src/routes/ai.ts` — `AGENT_MODEL` constant pattern to replicate for `VISION_MODEL`
- Upstash Redis setup in backend — rate limiting infrastructure already separate from credit logic (no overlap)

### Established Patterns
- RLS: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` on every table — upgrade to `(SELECT auth.uid())` sub-select caching
- Migrations: sequential numbering (001–025), each file self-contained with IF NOT EXISTS guards
- Model references: currently inline `anthropic('claude-sonnet-4-20250514')` in 3 files — all need to import from new shared config

### Integration Points
- `user_profiles` table: ALTER TABLE to add `tier TEXT DEFAULT 'free'` column
- `auth.users`: New trigger function for credit initialization (alongside existing `handle_new_user` for profiles)
- `backend/api/src/config/models.ts`: New file, imported by `ai.ts`, `ai-programs.ts`, `pantry-recipes.ts`

</code_context>

<specifics>
## Specific Ideas

- 1 credit = EUR 0.001 — this is the fundamental unit conversion for all downstream cost calculations
- EUR 0.75/month ceiling = 750 credits — this number drives Phase 18 daily cap math
- Welcome credits as a deploy-time constant — allows A/B testing different welcome amounts without code changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-db-foundation-model-fix*
*Context gathered: 2026-04-05*

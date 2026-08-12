# Architecture Research — Waitlist / Founder Tier / Credit-Gate Policy Change

**Domain:** Integration of a public waitlist + lifetime-founder-premium offer + credit-gate policy
change into a live Turborepo monorepo (Ziko Platform)
**Researched:** 2026-08-12
**Confidence:** HIGH — every claim below is grounded in files read directly in this worktree
(`/home/user/ziko-platform/.claude/worktrees/lien-invite`); no invented APIs or guessed line numbers.

## Standard Architecture (as it exists today — verified)

```
┌────────────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js 15, App Router)                                     │
│  [locale]/(marketing)/  — public, SSG (generateStaticParams)           │
│  [locale]/(coach)/      — authenticated coach CRM                      │
│  src/actions/*.ts       — Server Actions ('use server')                │
│  src/lib/supabase/{server,client,admin,middleware}.ts                  │
│  src/lib/ratelimit.ts   — Upstash lazy-singleton sliding-window        │
└───────────────┬──────────────────────────────────────────────┬─────────┘
                │ anon/publishable key (RLS-scoped)              │ service role
                ▼                                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL — RLS on every table, SECURITY DEFINER RPCs for   │
│  anything that needs atomicity or elevated privilege                   │
│  Proven pattern: deduct_ai_credits() — SELECT...FOR UPDATE row lock    │
│  (026_ai_credits.sql:89-134) eliminates the exact class of Vercel      │
│  Fluid-Compute concurrency race this milestone must also solve.        │
└───────────────┬──────────────────────────────────────────────┬─────────┘
                │                                                │
                ▼                                                ▼
┌───────────────────────────────┐   ┌────────────────────────────────────┐
│ backend/api (Hono v4, Vercel)  │   │ Vercel crons (backend/api/vercel.json│
│ middleware/creditGate.ts       │   │ — 7 existing jobs)                  │
│  tier==='premium' bypass       │   └────────────────────────────────────┘
│  (THIS is what changes)        │
└─────────────────────────────────┘
```

### Component Responsibilities Relevant to This Milestone

| Component | Responsibility | Verified location |
|-----------|----------------|--------------------|
| `waitlist_signups` (new table) | Public capture of email + audience, founder-rank assignment | new migration |
| `claim_waitlist_signup()` (new RPC) | Atomic dedupe + founder-rank assignment | new migration |
| `get_waitlist_founder_count()` (new RPC) | Public counter read, no row exposure | new migration |
| `grant_premium_credits()` (new RPC) | Monthly finite top-up for `tier='premium'` | new migration, reuses `ai_credit_transactions.type='premium_grant'` (already in the CHECK constraint, unused) |
| `creditGate.ts` | Gates every paid AI route | `backend/api/src/middleware/creditGate.ts` |
| `account.ts` Server Action | Existing, proven pattern for admin-key user deletion | `apps/web/src/actions/account.ts:45-98` |
| `ratelimit.ts` | Existing Upstash lazy-singleton, reusable for waitlist abuse control | `apps/web/src/lib/ratelimit.ts` |

---

## 1. Data Model — `waitlist_signups`

### DDL sketch (new migration, e.g. `supabase/migrations/20260812_waitlist_founder_offer.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  audience      TEXT NOT NULL CHECK (audience IN ('athlete', 'coach')),
  locale        TEXT CHECK (locale IN ('fr', 'en')),
  is_founder    BOOLEAN NOT NULL DEFAULT false,
  founder_rank  INTEGER,
  utm_source    TEXT,
  utm_campaign  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness — dedupe on normalized email
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email
  ON public.waitlist_signups (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_founder_rank
  ON public.waitlist_signups (founder_rank) WHERE founder_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_audience_created
  ON public.waitlist_signups (audience, created_at DESC);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO policies — see Section 2. No anon/authenticated
-- INSERT or SELECT policy exists. The only door in is the RPC below.
```

**Audience segmentation:** a `CHECK`-constrained `audience TEXT` column (`'athlete' | 'coach'`), matching
the existing convention (`user_profiles.role` uses the identical `TEXT + CHECK` pattern at
`034_coach_role_profiles.sql:16-19`, `user_profiles.tier` at `026_ai_credits.sql:186-188`). Not an enum
type — this codebase never uses Postgres native enums, always `TEXT CHECK (... IN (...))`.

**Duplicate emails:** unique index on `lower(email)`, resolved via `INSERT ... ON CONFLICT (lower(email))
DO NOTHING` inside the RPC (not a bare client-side upsert) so a re-signup returns the person's *existing*
founder status idempotently instead of erroring or silently re-rolling the counter. This mirrors the
anti-enumeration philosophy already used in `apps/web/src/actions/account.ts:73-81` (return a generic
success message whether or not the account existed) — a duplicate waitlist signup should look identical
to the client from a brand new one.

**Founder rank — insertion order vs stored counter (critical decision):** rank must come from a **stored,
atomically-incremented counter**, not `COUNT(*)` and not `ROW_NUMBER() OVER (ORDER BY created_at)` computed
after the fact. Both of those are read-then-decide patterns that reproduce the exact race class this
codebase already hit and fixed once (see `026_ai_credits.sql:84-87`, "SELECT balance FOR UPDATE prevents
concurrent deductions racing" and the Key Decision log: *"Application-layer check-then-deduct races under
Vercel Fluid Compute produce negative balances; DB-level lock eliminates it"* — `.planning/PROJECT.md:276`).

### Concurrency analysis — why the 200-spot cap needs a real primitive

Consider two people submitting the waitlist form within milliseconds of each other, near spot 200,
handled by two different concurrent Vercel serverless invocations (Fluid Compute explicitly allows
concurrent execution — this is the same environment the credit system already had to defend against).

- **`COUNT(*) WHERE is_founder` then `INSERT IF count < 200`** — classic TOCTOU. Under Postgres's default
  Read Committed isolation, both transactions can execute their `COUNT` against a snapshot that has not
  yet seen the other's uncommitted insert, both read `199`, both insert with `is_founder=true`. Result:
  201+ founders. **Rejected.**
- **`SELECT ... FOR UPDATE` on a single-row counter table** (the pattern `deduct_ai_credits` uses at
  `026_ai_credits.sql:103-107`) — correct and consistent with house style: lock the counter row, read,
  increment, compare to 200, release. Concurrent claims serialize behind the row lock (a queue, not a
  race), each seeing the previous transaction's committed increment. **Valid, and the "matches existing
  pattern" choice.**
- **A Postgres `SEQUENCE` + `nextval()`** — **recommended.** `nextval()` is atomic at the engine level and
  is *not* subject to MVCC snapshot visibility the way `SELECT`/`COUNT` is: no two callers can ever receive
  the same value, full stop, regardless of transaction isolation level, and it requires no explicit lock
  (sequences use their own lightweight, non-blocking internal synchronization). Assign
  `founder_rank := nextval('waitlist_founder_seq')` only *after* a successful (non-duplicate) insert, then
  `is_founder := founder_rank <= 200`. Because `nextval()` can never double-issue a value, **at most exactly
  200 rows can ever satisfy `founder_rank <= 200`** — this is true under arbitrary concurrency, with zero
  lock contention on a hot counter row. The only wrinkle (harmless here) is that sequences are
  non-transactional, so a value can be "burned" if the surrounding transaction rolls back after `nextval()`
  runs but before commit — acceptable, since a burned value just creates a small rank gap, never a double
  allocation, and gaps do not affect correctness of the 200-cap or the public count (which counts
  `is_founder=true` rows, not `MAX(founder_rank)`).
- **A partial unique index `WHERE is_founder` alone** does not solve the race by itself — it would prevent
  a *duplicate* rank value from ever committing twice, but two concurrent transactions could each try to
  claim *different* ranks (200 and 201) and both still set `is_founder=true` before either commits, so a
  partial unique index on `founder_rank` (already included above as a defense-in-depth belt-and-braces
  constraint) catches an implementation bug but does not, alone, enforce the *count* cap of 200 — it must
  be paired with the sequence.

### Atomic RPC (SECURITY DEFINER, reuses the sequence)

```sql
CREATE SEQUENCE IF NOT EXISTS public.waitlist_founder_seq;

CREATE OR REPLACE FUNCTION public.claim_waitlist_signup(
  p_email    TEXT,
  p_audience TEXT,
  p_locale   TEXT DEFAULT NULL
)
RETURNS TABLE(is_new BOOLEAN, is_founder BOOLEAN, founder_rank INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email  TEXT := lower(trim(p_email));
  v_id     UUID;
  v_rank   INTEGER;
  v_founder BOOLEAN;
BEGIN
  INSERT INTO public.waitlist_signups (email, audience, locale)
  VALUES (v_email, p_audience, p_locale)
  ON CONFLICT (lower(email)) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT wl.is_founder, wl.founder_rank INTO v_founder, v_rank
    FROM public.waitlist_signups wl WHERE lower(wl.email) = v_email;
    RETURN QUERY SELECT false, COALESCE(v_founder, false), v_rank;
    RETURN;
  END IF;

  v_rank := nextval('public.waitlist_founder_seq');
  v_founder := v_rank <= 200;

  UPDATE public.waitlist_signups
  SET founder_rank = v_rank, is_founder = v_founder
  WHERE id = v_id;

  RETURN QUERY SELECT true, v_founder, v_rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_waitlist_signup(TEXT, TEXT, TEXT) TO anon, authenticated;
```

**Interaction with Section 6 (purge):** the founder counter's credibility depends on `waitlist_signups`
containing *only* genuine external signups by the time the offer goes live — QA testing this exact form
during development will otherwise burn real sequence values and seed fake founders. Treat this as a
pre-launch checklist item (Section 7, Phase F): `TRUNCATE public.waitlist_signups; ALTER SEQUENCE
public.waitlist_founder_seq RESTART WITH 1;` reviewed and run once, immediately before the page goes
public — not an ongoing filter.

---

## 2. RLS for a Public, Unauthenticated INSERT

Every existing table in this schema follows `auth.uid() = user_id` (`.planning/codebase/ARCHITECTURE.md:192`,
confirmed on every migration read: `026_ai_credits.sql:20-22`, `20260527_coach_vocal_feedbacks.sql:18-21`,
`034_coach_role_profiles.sql:50-53`). **This is the first table in the entire schema with no `auth.uid()`
to check against** — a genuinely new class of access pattern for this codebase, so the decision needs to be
explicit rather than pattern-matched from an existing table.

### Options compared

| Option | Mechanism | Verdict |
|---|---|---|
| **A. anon key + `FOR INSERT TO anon WITH CHECK (true)` policy** | Client/Server Action inserts row directly with the publishable key, RLS allows it | **Rejected as primary.** Technically works, but (1) atomic founder-rank assignment then requires a `BEFORE INSERT` trigger doing the `nextval()` logic — workable, but splits the atomicity-critical logic between a trigger and app code instead of one auditable function; (2) it is the *first* table in the schema to grant `INSERT` to `anon` at all — every other write in this codebase goes through an authenticated JWT + `auth.uid()` ownership check, or through service-role backend code. Widening the RLS INSERT surface to `anon` is a permanent posture change to defend for every future column added to this table. |
| **B. Server Action with `SUPABASE_SERVICE_ROLE_KEY`, raw INSERT** | `createAdminClient()` (`apps/web/src/lib/supabase/admin.ts:4-16`) bypasses RLS entirely | **Rejected as primary.** Available and used elsewhere in `apps/web` (`account.ts`), but bypassing RLS means the founder-rank atomicity now depends on *application-level* correctness inside a Next.js Server Action — reintroducing exactly the check-then-write race the project already paid down once in the credit system (Key Decision, `.planning/PROJECT.md:276`). Vercel Fluid Compute runs concurrent Server Action invocations; a naive "count, then insert" in TypeScript is not safe here. |
| **C. `SECURITY DEFINER` function, RLS = deny-all** | `claim_waitlist_signup()` runs with elevated privilege internally regardless of caller role; the table itself has RLS **enabled with zero policies** (default-deny for every role, including anon, authenticated, and even a future admin dashboard role unless explicitly granted) | **Recommended.** This is the codebase's own established idiom for "needs elevated logic beyond simple row ownership" — `deduct_ai_credits`, `earn_ai_credits`, `set_credit_transaction_balance_after` (all `026_ai_credits.sql`/`028_fix_earn_rpc_and_quota_tracking.sql`), and `is_coach_of()` (v1.5, referenced in `.planning/codebase/ARCHITECTURE.md:319`) all follow this exact shape. It lets the atomic sequence logic live in one place, in the database, enforced regardless of which client calls it. |

### Recommendation

Use **Option C**. `waitlist_signups` RLS is enabled with **no INSERT or SELECT policy for any role** — the
table is unreachable by direct query from the anon key even if a future developer forgets and tries
`supabase.from('waitlist_signups').select()`. The only door in is `EXECUTE` on the two RPCs, explicitly
granted to `anon` (`GRANT EXECUTE ... TO anon, authenticated;`).

Call the RPC from a **Next.js Server Action** (`'use server'`, following the existing convention in
`apps/web/src/actions/`) using the normal anon-key server client (`createServerSupabase()` at
`apps/web/src/lib/supabase/server.ts`) — not the service-role admin client. The anon key is sufficient
because the RPC's `SECURITY DEFINER` is what grants the elevation, not the caller's key; using the
service-role key here would add no additional capability and would be an unnecessary widening of where
that secret is invoked. Add IP rate limiting in the Server Action using the already-configured
`apps/web/src/lib/ratelimit.ts` lazy-singleton pattern (mirror `rolePromotionRatelimit` /
`kycUploadRatelimit`, e.g. `Ratelimit.slidingWindow(5, '60 s')`, prefix `ziko:waitlist`) to blunt
bot mass-claiming of founder spots — the RPC's atomicity guarantees *correctness* under concurrency, but
does nothing to stop a script from legitimately claiming all 200 spots with disposable emails; rate
limiting is the mitigation for that separate concern.

**Service-role boundary respected:** `SUPABASE_SERVICE_ROLE_KEY` is available in `apps/web` (used in
`apps/web/src/lib/supabase/admin.ts`) and is explicitly forbidden from `backend/api/src/**` per
`CLAUDE.md`. This entire flow is a `apps/web`-only concern (public marketing page → Server Action →
Supabase RPC) and never touches `backend/api`, so the boundary is naturally respected — no service-role
key is needed at all for the waitlist writes (Option C uses the anon key + RPC elevation), and none should
be introduced for it.

---

## 3. The Public Counter

RLS denies `SELECT` on `waitlist_signups` to every role (Section 2), so the counter cannot be a
client-side `count()` query — it needs its own read path, following the same defense-in-depth principle
as the write path:

```sql
CREATE OR REPLACE FUNCTION public.get_waitlist_founder_count()
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT count(*)::INTEGER FROM public.waitlist_signups WHERE is_founder;
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_founder_count() TO anon, authenticated;
```

This reveals only an integer — never rows, never emails — even if called directly.

**Freshness on an otherwise-static page:** every marketing page in `apps/web` is SSG
(`generateStaticParams` + `setRequestLocale`, confirmed in `coachs/page.tsx:13-15` and `cgu/page.tsx`).
Do not make the whole waitlist page dynamic just for one number. Isolate the counter into its own small
Client Component that fetches from a dedicated Next.js **Route Handler**
(`apps/web/src/app/api/waitlist/count/route.ts`, following the existing convention of Next.js API routes
under `apps/web/src/app/api/` — e.g. `api/credits/balance/`, `api/storage/upload-url/` already exist per
`.planning/codebase/STRUCTURE.md:105-109`) that calls `get_waitlist_founder_count()` via the admin or anon
client and sets a short cache window (`export const revalidate = 30` on the route, or a `fetch(..., {
next: { revalidate: 30 } })` from the client). This keeps the rest of the page fully static while only
the number itself refreshes every ~30s — the same "mostly static, one dynamic sliver" pattern already used
elsewhere in this app (`branding/page.tsx:1` sets `export const revalidate = 0` for a page that must never
be stale, contrasted with the fully-static marketing pages — the waitlist counter sits between those two
extremes and a 30s window is the right compromise for a number that only needs to feel "live", not be
transaction-exact).

**Do not add a Redis-cached counter** (Upstash is already provisioned via `UPSTASH_REDIS_REST_URL`/`TOKEN`
and used in `apps/web/src/lib/ratelimit.ts`) unless traffic volume genuinely warrants it. A waitlist
counter on a marketing page is low-QPS by nature; a second source of truth (Redis `INCR` alongside the
Postgres row) risks drifting from the DB if a Server Action fails between the DB commit and the Redis
write, and buys nothing a 30s Next.js fetch-cache doesn't already provide. Reconsider only if the STACK
research for this milestone flags a specific traffic/launch-spike concern (no `STACK.md` existed in
`.planning/workstreams/lien-invite/research/` at the time of this research — flag for the roadmapper to
reconcile if that changes).

---

## 4. The Credit-Gate Change — Exhaustive Impact List

### Current behavior (verified by reading the full file)

`backend/api/src/middleware/creditGate.ts`:
- **Lines 17-18** (comment): `creditPassThrough=true → free quota slot (D-01/D-02) or premium user
  (PREM-02) — no deduction`
- **Line 44** (docblock): `1. PREM-02: premium users bypass entirely (tier='premium')`
- **Lines 53-63** (the actual bypass): queries `user_profiles.tier`, and if `'premium'`, sets
  `creditPassThrough = true` and calls `next()` **before ever checking quota or balance** — this is the
  literal unlimited-AI behavior.
- **Line 121** (docblock for `creditDeduct`): `- creditPassThrough is false (not a free quota slot / not
  premium)`
- **Lines 133-138**: when `creditPassThrough === true`, `creditDeduct` calls `trackQuotaUsage` (so
  `getQuotaStatus` advances) but explicitly skips `deductCredits` — comment: *"Only track quota for
  non-premium (premium bypass should not consume quota slots)"*.

### Recommended redesign — reuse the balance system, don't special-case premium in the gate

The cleanest fix is **not** to add a parallel `PREMIUM_DAILY_QUOTAS` branch throughout the gate/service —
it is to **delete the special case** and let premium users flow through the exact same
`getQuotaStatus`/`deductCredits` path as free users, funded by a much larger `user_ai_credits.balance`.
This works because the balance/ledger system (`user_ai_credits` + `ai_credit_transactions`) already exists
and is tier-agnostic; the *only* thing that needs to become tier-aware is **how the balance gets topped
up**, which is a monthly grant, not a request-time check. This is a smaller, lower-risk diff than adding
tier-branching logic to every quota-reading call site, and it reuses a value the schema already reserved
for exactly this purpose:

`ai_credit_transactions.type` CHECK constraint already includes `'premium_grant'`
(`026_ai_credits.sql:36`, re-affirmed in `028_fix_earn_rpc_and_quota_tracking.sql:19`) — **this type has
never been written by any code path in the repo** (confirmed: `grep -rn "premium_grant"` matches only the
two CHECK-constraint definitions, zero usages). The schema was already forward-looking for this exact
feature.

### Every file/line that reads `tier`, `premium`, `creditPassThrough`, or `PREM-` (exhaustive grep, verified)

```
backend/api/src/middleware/creditGate.ts:17   comment — creditPassThrough semantics
backend/api/src/middleware/creditGate.ts:18   comment
backend/api/src/middleware/creditGate.ts:21   declare module 'hono' — creditPassThrough: boolean
backend/api/src/middleware/creditGate.ts:44   docblock — "PREM-02: premium users bypass entirely"
backend/api/src/middleware/creditGate.ts:47   docblock
backend/api/src/middleware/creditGate.ts:53   comment — "PREM-02: Premium bypass"
backend/api/src/middleware/creditGate.ts:56   .select('tier')
backend/api/src/middleware/creditGate.ts:60   if (profile?.tier === 'premium')  <-- THE BYPASS, delete this branch
backend/api/src/middleware/creditGate.ts:61-62 c.set('creditPassThrough', true); return next();
backend/api/src/middleware/creditGate.ts:121  docblock
backend/api/src/middleware/creditGate.ts:133-138 comment + special-cased quota tracking for premium
apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx:12-30  reads user_profiles.tier for `isPro`
                                                                   (DA/branding feature gate — NOT the
                                                                   AI-credit path; verify still correct,
                                                                   likely unchanged, see Section 5)
supabase/migrations/026_ai_credits.sql:186-188  tier column definition + comment
                                                  "Enables premium bypass in Phase 18" — comment is now
                                                  stale; DO NOT edit this file (house rule), address in
                                                  the new migration's own comment instead
.planning/PROJECT.md:196  Validated v1.4 requirement text: "middleware bypasses deduction for premium
                            (PREM-01, PREM-02)" — documents old behavior as shipped truth; update at
                            milestone completion (not a code file, but must not be left contradicting
                            the new behavior)
.planning/codebase/ARCHITECTURE.md:192  "Service key bypasses RLS — only used in creditGate.ts..." and
                                          general RLS description — re-verify after change
CLAUDE.md (root, current worktree copy) — the "Critical existing behavior" note quoted in this milestone's
                                            own context block IS this bypass; the maintained CLAUDE.md /
                                            codebase docs need a docs-update pass after the phase ships
```

**Confirmed NOT affected** (checked so a real call site isn't missed by omission): no mobile file
(`apps/mobile/src/**`, `plugins/**`, `packages/**`) references `tier === 'premium'` or `creditPassThrough`
— the one `grep` hit for `.tier` in `apps/mobile/app/(app)/profile/index.tsx:410,468,683,690` is an
unrelated concept (`b.tier` = a gamification *badge* tier, not the credit-system `user_profiles.tier`,
confirmed by reading the surrounding badge-rendering code). No other `apps/web/src` file, and no other
`backend/api/src` file besides `creditGate.ts` itself, references `tier` or `premium`.
`backend/api/src/config/credits.ts` and `backend/api/src/services/creditService.ts` currently have **zero**
tier-awareness — under the recommended design (delete the bypass, fund premium via monthly grant) **neither
file needs to change**, because `CREDIT_COSTS`/`DAILY_QUOTAS`/`MONTHLY_QUOTAS`/`getQuotaStatus`/
`deductCredits` are already tier-agnostic by construction and will correctly serve premium users once their
balance is larger.

### New code required (in addition to deleting the bypass)

1. New migration — `grant_premium_credits(p_user_id UUID, p_amount INTEGER)` SECURITY DEFINER RPC:
   tops up `user_ai_credits.balance`, inserts a `type='premium_grant'` ledger row with a
   month-scoped idempotency key (e.g. `'premium_grant_' || to_char(now(), 'YYYY-MM')`) reusing the
   existing partial unique index `idx_credit_tx_idempotency` (`026_ai_credits.sql:47-49`) so a cron
   re-run mid-month cannot double-grant. Do not reuse `earn_ai_credits` — it enforces `DAILY_EARN_CAP`,
   which is the wrong cap for a monthly grant.
2. `backend/api/src/services/creditService.ts` — add `grantMonthlyPremiumCredits(userId, amount)` wrapping
   the new RPC (same shape as the existing `deductCredits`/`earnCredits` wrappers at lines 87-146).
3. A new Vercel cron route + `backend/api/vercel.json` entry (an 8th job, alongside the 7 already listed
   at `backend/api/vercel.json:6-35`, e.g. `"path": "/credits/cron/premium-grant", "schedule": "0 0 1 * *"`
   — monthly, matching the existing style of `notifications/cron/weekly-digest` etc.) that selects all
   `user_profiles WHERE tier = 'premium'` and calls the grant RPC for each.
4. `backend/api/src/middleware/creditGate.ts` — delete lines 53-63 (the bypass branch) and the now-false
   "premium bypass" framing in the surrounding comments (17-18, 44, 121, 133-138); premium users simply
   fall through to the existing quota/balance logic unmodified.

---

## 5. Lifetime Premium vs the Existing `tier` Column

`tier='premium'` (`026_ai_credits.sql:186-188`) is **not sufficient alone**, once you account for a future
paid subscription that has *already been named* in the roadmap: `.planning/PROJECT.md:72` lists
**v1.12 DA Coach — "Différenciateur Pro 29€/mois"** as a parallel workstream, i.e. a paid subscription
tier is a known, near-term future addition that will also need to set `tier='premium'` (both
`creditGate.ts` and `branding/page.tsx:30`'s `isPro` check care only about the *effective* tier value, not
its provenance).

**The landmine:** if a future subscription-lapse/cancellation webhook (Stripe or similar) reverts
`tier` back to `'free'` on non-payment, and lifetime founders are represented by nothing more than
`tier='premium'`, any such downgrade logic has to remember to explicitly exclude founders — a single
missed `WHERE` clause silently strips a founder's permanent perk. This is exactly the kind of "a missed
call site is a production bug" risk the milestone context warns about, just deferred to a future milestone
instead of this one.

**Recommendation:** add a provenance flag now, in this migration, even though subscriptions don't exist
yet:

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_lifetime_premium BOOLEAN NOT NULL DEFAULT false;
```

- `tier` remains the single "effective access level" every existing call site checks
  (`creditGate.ts`, `branding/page.tsx:30`) — **zero changes needed at those call sites** for this
  distinction to exist.
- `is_lifetime_premium` is purely a provenance/audit flag, set to `true` only by the founder-claim flow
  (when a founder redeems their offer and their `user_profiles.tier` is set to `'premium'`) — no other
  code path ever sets it.
- Any future subscription-lapse logic gets a required, self-documenting guard:
  `WHERE tier = 'premium' AND is_lifetime_premium = false` before reverting `tier`. This pushes the
  "don't touch founders" decision into the schema rather than relying on every future downgrade script
  remembering it independently.
- Simpler than an enum-style `premium_source` column (`'founder_lifetime' | 'subscription'`) for the same
  reason `user_profiles.role`/`tier`/etc. all use plain boolean/CHECK-constrained TEXT rather than
  richer types in this schema — matches house convention, and a boolean is all that's needed since the
  only question that matters downstream is binary ("can this ever be auto-revoked, yes/no").

---

## 6. Test Account Purge

### What identifies a test account here

**No existing marker.** `grep` across `supabase/seed.sql` and all migrations found no `is_test` column,
no test-domain convention, and no admin/QA flag anywhere in the schema. This must be an explicit,
human-reviewed criterion for this milestone — **do not** infer one from a fuzzy pattern like
`email LIKE '%test%'` as the deletion criterion itself (a genuine athlete or coach could have "test" as
a substring of a real name or email; a wrong match here is irreversible, see below). Fuzzy matching is
acceptable only to generate a *candidate* list for human review, never as the executed filter.

### FK map from `auth.users` outward (verified)

Every domain table roots at `auth.users.id` with `ON DELETE CASCADE`, confirmed by reading:
`user_profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` (`001_initial_schema.sql:16`),
`workout_programs.user_id ... ON DELETE CASCADE` (`001_initial_schema.sql:50`),
`workout_sessions.user_id ... ON DELETE CASCADE` (`001_initial_schema.sql:86`),
`user_ai_credits.user_id ... ON DELETE CASCADE` (`026_ai_credits.sql:13`),
`ai_credit_transactions.user_id ... ON DELETE CASCADE` (`026_ai_credits.sql:35`),
`coach_profiles.user_id ... ON DELETE CASCADE` (`034_coach_role_profiles.sql:30`),
`coach_vocal_feedbacks.coach_id`/`athlete_id ... ON DELETE CASCADE` (`20260527_coach_vocal_feedbacks.sql:6-7`).
`grep -l "REFERENCES auth.users"` across `supabase/migrations/` returned 31 files, and every instance
inspected uses `ON DELETE CASCADE` — there is no `ON DELETE SET NULL`/`RESTRICT` case rooted directly at
`auth.users` in this schema.

**Practical consequence:** Supabase's Auth Admin API `deleteUser(userId)` — the exact call already used in
production for the self-service "Supprimer mon compte" flow at `apps/web/src/actions/account.ts:84-85` —
correctly and completely cascades through every domain table with **zero orphan risk**, because the
cascade chain is fully connected back to `auth.users` for every table. There is no need to write a manual
multi-table `DELETE` script; the existing, already-proven mechanism handles it.

**The one real hazard — cross-user tables.** Several tables reference *two* different users
(`coach_vocal_feedbacks.coach_id` + `athlete_id`; `coach_client_links`; program `assigned_to_user_id` /
`created_by_coach_id`). Deleting a "test coach" account cascades away every athlete's feedback/notes tied
to that coach — correct for a real GDPR deletion, but dangerous for a *purge*, because if a genuine beta
tester (a real, non-test athlete) ever linked to a test coach account during QA, purging the test coach
silently deletes that real athlete's coaching data too. The dry-run step below must explicitly surface
these cross-links.

### Recommended procedure (dry-run first, explicit, reversible where possible)

1. **Dry-run (read-only) query** — enumerate every candidate `auth.users.id` + email against a
   human-reviewed allowlist (not a pattern match), and separately surface any row in
   `coach_client_links` / `coach_vocal_feedbacks` / any `assigned_to_user_id` column where a candidate
   is linked to a **non-candidate** (i.e., real) account — flag those pairs for manual review, do not
   auto-include them.
2. **Explicit criterion** — a plain, team-maintained list of exact `user_id`/`email` values known to be
   dev/QA accounts, agreed by a human, not inferred by a query. Pattern-matching (`LIKE '%@ziko-dev%'` or
   similar) may be used to *generate the candidate list for review*, never as the executed filter.
3. **Take a backup checkpoint immediately before executing** — Supabase Auth `deleteUser` is a real,
   non-soft, cascading DELETE; there is no undo button. True reversibility means having a pre-purge
   `pg_dump` of the affected rows or relying on the project's Supabase PITR (point-in-time recovery)
   window, confirmed available, *before* running anything. Run in a low-traffic window.
4. **Execute via the same proven code path** — a one-off script or a manually-triggered (not publicly
   routed) admin action calling `admin.auth.admin.deleteUser(userId)` per reviewed id, exactly like
   `account.ts:84-85`, rather than a raw `DELETE FROM auth.users` SQL statement — the Admin API also
   correctly tears down Supabase's own internal Auth bookkeeping (sessions, refresh tokens, identities),
   which a direct SQL `DELETE` against the `auth` schema is not guaranteed to do consistently.
5. **Explicitly recommend against** any irreversible bulk `DELETE FROM auth.users WHERE ...` executed
   directly in the SQL editor without steps 1-3 having happened first and been reviewed by a human.
6. **Sequencing relative to the founder counter:** this purge is a one-time, pre-launch credibility fix
   (per the milestone context), not an ongoing job — it belongs early in the build order (Section 7,
   Phase B), completed before the waitlist page is opened to the public, alongside the separate
   `waitlist_signups` reset described in Section 1 (test signups made *during this milestone's own QA*
   are a distinct concern from pre-existing test `auth.users` accounts, and both must be clean before
   go-live).

---

## 7. Build Order

```
Phase A — DB foundation (no dependencies, can start immediately)
  ├─ Migration: waitlist_signups + waitlist_founder_seq +
  │             claim_waitlist_signup() + get_waitlist_founder_count() + deny-all RLS
  └─ Migration: user_profiles.is_lifetime_premium + grant_premium_credits() RPC
       (two migrations — independently testable/revertable; both dated, house style)

Phase B — Test account purge (independent of A; BLOCKS Phase F only)
  ├─ Dry-run query + cross-link surfacing
  ├─ Human review of candidate list
  ├─ Backup checkpoint
  └─ Execute via account.ts-style Admin API script

Phase C — Backend credit-gate change (depends on Phase A: grant_premium_credits() must exist)
  ├─ Delete PREM-02 bypass in creditGate.ts (lines 53-63) + stale comments
  ├─ Add grantMonthlyPremiumCredits() wrapper in creditService.ts
  └─ New Vercel cron (vercel.json 8th entry) + cron route calling the grant RPC monthly

Phase D — Waitlist web UI (depends on Phase A: RPCs must exist)
  ├─ (marketing)/waitlist page — form (email + audience) as Client Component + Server Action
  │    calling claim_waitlist_signup via anon key, rate-limited via existing ratelimit.ts
  └─ Public counter — Route Handler (app/api/waitlist/count/route.ts, revalidate: 30) +
       Client Component consumer, page itself stays SSG

Phase E — Legal pages (independent, can run fully in parallel with A-D)
  ├─ New CGV page — new (marketing)/cgv/page.tsx mirroring cgu/page.tsx structure + i18n keys
  └─ Revised CGU — "premium unlocks all features but AI credits remain capped" wording
       (soft dependency: numeric allowance must be finalized in Phase C before this text is
       marked final, but scaffolding can be written in parallel)

Phase F — Go-live (depends on B, C, D, E all complete)
  ├─ Confirm Phase B purge complete
  ├─ TRUNCATE waitlist_signups + RESTART SEQUENCE if any QA signups occurred during Phase D
  └─ Flip page live
```

**Parallelizable:** A, B, and E have no interdependencies and can start simultaneously. C and D both
depend only on Phase A's migrations landing (not on each other) and can then proceed in parallel. F is
the single convergence point gating on everything else.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Deriving founder rank from `COUNT(*)` or `ROW_NUMBER()`
**What people do:** compute "am I under 200?" with a read query, then insert.
**Why it's wrong:** Read Committed isolation lets two concurrent transactions both read the same
under-200 count before either commits — see Section 1's concurrency analysis. This is the identical
class of bug the credit system already fixed once with `SELECT ... FOR UPDATE`.
**Do this instead:** `nextval()` on a dedicated sequence, or the row-lock counter pattern already proven
in `deduct_ai_credits`.

### Anti-Pattern 2: Granting `anon` a table-level INSERT policy for convenience
**What people do:** `CREATE POLICY ... FOR INSERT TO anon WITH CHECK (true)` because it's the fastest way
to get a public form working.
**Why it's wrong:** This is the first table in the schema with any anon-writable surface; every other
write goes through JWT ownership or service-role backend code, and a table-level anon policy is a
permanent, easy-to-forget-about attack surface for every future column added to that table.
**Do this instead:** `SECURITY DEFINER` RPC as the sole entry point, RLS deny-all on the table itself.

### Anti-Pattern 3: Adding tier-branching logic throughout the credit-gate/service layer
**What people do:** thread `if (tier === 'premium') { ...different quota... }` through
`creditCheck`/`creditDeduct`/`getQuotaStatus` to give premium a bigger allowance.
**Why it's wrong:** multiplies the number of call sites that need to reason about tier, increases the
chance of a missed branch (exactly the "missed call site is a production bug" risk flagged in this
milestone), and duplicates logic that the existing balance/ledger system already generalizes.
**Do this instead:** delete the bypass, let premium flow through the same balance-checked path as
everyone, and make the *funding* (monthly `premium_grant` top-up) the only tier-aware code, isolated to
a cron job.

---

## Sources

All findings verified directly against the codebase in this worktree (no external sources needed —
this is an integration research task, not an ecosystem survey):

- `backend/api/src/middleware/creditGate.ts` (full file read)
- `supabase/migrations/026_ai_credits.sql`, `028_fix_earn_rpc_and_quota_tracking.sql`,
  `034_coach_role_profiles.sql`, `053_referral_schema.sql`, `001_initial_schema.sql`,
  `20260527_coach_vocal_feedbacks.sql`
- `backend/api/src/config/credits.ts`, `backend/api/src/services/creditService.ts`
- `apps/web/src/lib/supabase/{admin,server,client}.ts`, `apps/web/src/lib/ratelimit.ts`,
  `apps/web/src/actions/account.ts`
- `apps/web/src/app/[locale]/(marketing)/{coachs,cgu}/page.tsx`,
  `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx`
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`
- Repository-wide `grep` for `tier`, `premium`, `creditPassThrough`, `PREM-`, `premium_grant` across
  `backend/api/src`, `apps/web/src`, `apps/mobile/src`, `plugins`, `packages`, `supabase/migrations`

---
*Architecture research for: waitlist / founder tier / credit-gate policy change (lien-invite workstream)*
*Researched: 2026-08-12*

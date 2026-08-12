# Phase 1: Data Foundation - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 5 (1 migration, 1 Server Action, 3 test files)
**Analogs found:** 5 / 5

## Migration naming convention (verified this session)

```
$ ls supabase/migrations | sort | tail -15
055_forms_schema.sql
056_dashboard_widgets.sql
057_coach_videos_schema.sql
058_form_trigger_engine.sql
059_coach_read_client_own_programs.sql
060_coach_update_client_programs.sql
061_coach_read_client_program_workouts.sql
062_workout_reminder_prefs.sql
063_coach_metric_thresholds.sql
064_unaccent_user_search.sql
20260526_add_user_profiles_settings.sql
20260526_workout_sessions_friends_rls.sql
20260527_coach_exercise_id_program_exercises.sql
20260527_coach_vocal_feedbacks.sql
20260529_fix_trigger_n_sessions.sql
```

**Convention the next migration must use: `YYYYMMDD_description.sql`.** Evidence: the numeric
`NNN_` series stops at `064_unaccent_user_search.sql`; every migration added after it (5 most
recent files, all dated 2026) uses the `YYYYMMDD_description.sql` form. The `NNN_` series is
frozen/historical, not being extended. Filename for this phase: `supabase/migrations/20260812_waitlist_founder_offer.sql`
(2026-08-12 matches "today" in this session and is later than every existing dated migration).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260812_waitlist_founder_offer.sql` | migration | CRUD (RPC-gated) | `supabase/migrations/035_coach_invitations_links_rls.sql` | exact |
| `apps/web/src/actions/waitlist.ts` | controller (Server Action) | request-response | `apps/web/src/actions/account.ts` | role-match (structure exact, but must NOT copy its `headers()`/rate-limit call — see below) |
| `backend/api/test/rls/waitlist-rls.spec.ts` | test | request-response | `backend/api/test/rls/redeem-rpc.spec.ts` + `backend/api/test/rls/fixtures.ts` | exact |
| `apps/web/test/actions/waitlist.concurrency.test.ts` | test | event-driven (concurrency) | `apps/web/test/safe-next.spec.ts` (testability precedent only — no concurrency analog exists in-repo) | partial — see "No Analog Found" |
| `apps/web/vitest.config.ts` (possible edit, `fileParallelism: false`) | config | — | `backend/api/vitest.config.ts` | role-match |

## Pattern Assignments

### `supabase/migrations/20260812_waitlist_founder_offer.sql` (migration, CRUD via RPC)

**Analog:** `supabase/migrations/035_coach_invitations_links_rls.sql` (+ `040_peek_invitation_function.sql`, `026_ai_credits.sql`, `034_coach_role_profiles.sql`)

**SECURITY DEFINER + REVOKE/GRANT idiom** (`035_coach_invitations_links_rls.sql:84-101`) — copy this shape verbatim for every new RPC:
```sql
CREATE OR REPLACE FUNCTION public.is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) TO authenticated;
```
Same `REVOKE...FROM PUBLIC` then `GRANT...TO <role>` pairing repeats at `035_coach_invitations_links_rls.sql:176-177` (`redeem_invitation_code`) and `040_peek_invitation_function.sql:73` (`peek_invitation`) — three independent confirmations of the same idiom. For this phase every `GRANT` targets `service_role` only (per D-01/D-02), never `authenticated` or `anon`.

**Deny-all RLS** — same file's table declarations: `ENABLE ROW LEVEL SECURITY` with zero `CREATE POLICY` statements is the pattern for `waitlist_signups` and `app_config` (DATA-05, D-08). This mirrors `user_ai_credits`/`coach_client_links`'s existing deny-all + RPC-door posture.

**`SECURITY DEFINER SET search_path = public` + `RETURNS JSONB`-style shape** (`026_ai_credits.sql:89-119`, `deduct_ai_credits`) — used only as a shape reference for the plpgsql function skeleton (declare/lock/decide/return), per CONTEXT.md's own citation. **Explicit warning, do not copy its grant posture:** `deduct_ai_credits` has **no** `REVOKE`/`GRANT` statement anywhere in `026_ai_credits.sql` — by Postgres default this makes it reachable by `anon`. This is a known gap in the existing codebase, not a pattern to replicate. Every new waitlist RPC must carry its own explicit `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;` pair, taken from `is_coach_of`/`redeem_invitation_code`/`peek_invitation` instead.

**`TEXT + CHECK` enum convention** (`034_coach_role_profiles.sql:16-19`):
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL
    DEFAULT 'client'
    CHECK (role IN ('client', 'coach', 'both'));
```
Apply identically to `waitlist_signups.audience CHECK (audience IN ('athlete', 'coach'))` and `locale CHECK (locale IN ('fr', 'en'))`. Never use `CREATE TYPE ... AS ENUM` — no migration in this codebase does.

**`gen_random_uuid()` default** — already enabled, e.g. `035_coach_invitations_links_rls.sql:14`; no new `CREATE EXTENSION` needed for `waitlist_signups.id`.

---

### `apps/web/src/actions/waitlist.ts` (controller/Server Action, request-response)

**Analog:** `apps/web/src/actions/account.ts` (`deleteAccount`)

**Structural pattern to copy** (full file read, `apps/web/src/actions/account.ts:1-98`):
- `'use server'` directive at top of file.
- `export type XState = { status: 'idle' | 'success' | 'error'; ...fields; message: string }` — the `useFormState`/`useActionState`-compatible state shape.
- `export async function actionName(prevState: XState, formData: FormData): Promise<XState>` signature.
- `createAdminClient()` from `@/lib/supabase/admin` for the service-role call — same import used here.
- **Anti-enumeration philosophy, directly reusable:** lines 73-81 show the exact "neutral success even when the real answer would leak information" idiom this phase's D-03/D-04 filter must follow:
```typescript
// Find user (anti-enumeration: return success even if not found)
const userId = await findUserIdByEmail(email);

if (!userId) {
  return {
    status: 'success',
    message: 'Si ce compte existe, il a été supprimé.',
  };
}
```
This is the closest in-repo precedent for the waitlist Server Action's D-03/D-04 rule: "return the same shape-neutral success regardless of whether disclosure would occur."

**Explicit deviation from this analog — do NOT copy:** `account.ts:3,50-60` imports `headers` from `next/headers` and calls the Upstash rate limiter inline. Phase 1's `waitlist.ts` must NOT do this (Pitfall 3): rate limiting is deferred to phase 5, and adding `headers()` now makes the Server Action unimportable in a plain Vitest concurrency test (no active Next.js request context). `apps/web/src/actions/coach-identity.ts` is a second instance of the same `headers()` + rate-limit pattern — same caution applies, do not copy that part either.

**Testability precedent for why `headers()` is avoided** — `apps/web/test/safe-next.spec.ts:1-6`, comment: "Mocks Next.js server modules so the `'use server'` file can be imported in a node test environment." This is the workaround the repo already uses when a `'use server'` file must call `next/headers()` and still be tested; phase 1 sidesteps the whole problem by simply not calling `headers()` in `waitlist.ts`.

**D-03/D-04 filter — this phase's own new pattern** (no existing analog forwards an RPC's duplicate-branch truth conditionally; write fresh, following the `is_new` gate shown in RESEARCH.md's Code Examples section):
```typescript
if (!row.is_new) {
  return { status: 'success', isFounder: false, founderRank: null, message: 'Inscription confirmée.' };
}
return {
  status: 'success',
  isFounder: row.is_founder,
  founderRank: row.is_founder ? row.founder_rank : null,
  message: 'Inscription confirmée.',
};
```

---

### `backend/api/test/rls/waitlist-rls.spec.ts` (test, request-response)

**Analog:** `backend/api/test/rls/redeem-rpc.spec.ts` + `backend/api/test/rls/fixtures.ts`

Use `getAdminClient()` / `getAnonClient()` from `fixtures.ts` exactly as the coach-invitation RLS suite does. Deny-all proof pattern:
```typescript
describe('waitlist_signups — deny-all RLS (DATA-05)', () => {
  it('anon SELECT returns zero rows (RLS filters, not an error)', async () => {
    const anon = getAnonClient();
    const { data, error } = await anon.from('waitlist_signups').select('*');
    expect(error).toBeNull();       // RLS filters rows silently for SELECT — no error surfaces
    expect(data).toEqual([]);
  });

  it('anon INSERT is rejected (no policy permits it)', async () => {
    const anon = getAnonClient();
    const { error } = await anon
      .from('waitlist_signups')
      .insert({ email: 'x@example.com', email_normalized: 'x@example.com', audience: 'athlete' });
    expect(error).not.toBeNull();
  });
});
```
`redeem-rpc.spec.ts` is also the source of the "constant-time / non-enumerable response shape" test technique referenced in RESEARCH.md's Don't Hand-Roll table — reuse its single-`SELECT`/single-`CASE`/one-`RETURN`-shape idiom rather than inventing a new timing-normalization wrapper.

Run with `backend/api/vitest.config.ts`'s existing settings: `environment: 'node'`, `fileParallelism: false`, `sequence: { concurrent: false }` — already configured, no change needed for this test file.

---

### `apps/web/test/actions/waitlist.concurrency.test.ts` (test, event-driven/concurrency)

**No direct in-repo analog** — `apps/web` currently has zero DB-touching tests (its existing suite is pure unit/component tests plus one mocked-SDK factory test). This is the first `apps/web` test hitting a real Supabase instance. Build fresh from RESEARCH.md's Code Examples "Concurrency harness" section, importing `claimWaitlistSpot` directly (never the raw RPC) so the test proves the actual production path per D-05.

Config note: `apps/web/vitest.config.ts` (`environment: 'node'`, `globals: true`, no `fileParallelism` override) should gain `fileParallelism: false` — mirroring `backend/api/vitest.config.ts` — if more than one DB-mutating spec file lands under `apps/web/test/actions/`, to avoid sequence-collision the same way `backend/api`'s RLS suite already documents.

## Shared Patterns

### `SECURITY DEFINER` + explicit `REVOKE`/`GRANT` (mandatory, not stylistic)
**Source:** `supabase/migrations/035_coach_invitations_links_rls.sql:84-101,176-177`, `040_peek_invitation_function.sql:73`
**Apply to:** all three new RPCs (`claim_waitlist_signup`, `get_waitlist_founder_status`, `anonymize_waitlist_signup`) — every one needs its own `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;` pair. PostgreSQL grants `EXECUTE` to `PUBLIC` by default; omitting this is the single most consequential gap this phase must avoid (see `deduct_ai_credits` counter-example above).

### Deny-all RLS as the sole access door
**Source:** `035_coach_invitations_links_rls.sql` (coach_invitations/coach_client_links), `026_ai_credits.sql` (user_ai_credits)
**Apply to:** both new tables, `waitlist_signups` and `app_config` — `ENABLE ROW LEVEL SECURITY`, zero `CREATE POLICY` statements, all access mediated by `SECURITY DEFINER` RPCs.

### `TEXT + CHECK` instead of native enums
**Source:** `034_coach_role_profiles.sql:16-19`, `026_ai_credits.sql:186-188`
**Apply to:** `waitlist_signups.audience`, `waitlist_signups.locale`.

### Anti-enumeration / neutral-response shaping
**Source:** `apps/web/src/actions/account.ts:73-81`
**Apply to:** `apps/web/src/actions/waitlist.ts`'s D-03/D-04 filter — same "same success shape regardless of what would otherwise be disclosed" philosophy, extended here to founder status rather than account existence.

### Service-role client for Server Actions
**Source:** `apps/web/src/lib/supabase/admin.ts` (`createAdminClient()`), consumed identically by `account.ts` and `coach-identity.ts`
**Apply to:** `waitlist.ts` — no new client needed.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/web/test/actions/waitlist.concurrency.test.ts` | test | event-driven/concurrency | No existing `apps/web` test hits a real DB or races concurrent Server Action calls; `backend/api`'s RLS suite is DB-integration but not concurrency-racing. Build from RESEARCH.md's harness sketch; resolve the `setval`-seeding helper mechanism during planning (open question — no generic SQL-exec RPC found in this codebase). |

## Metadata

**Analog search scope:** `supabase/migrations/`, `apps/web/src/actions/`, `apps/web/src/lib/supabase/`, `backend/api/test/rls/`, `apps/web/test/`, `apps/web/vitest.config.ts`, `backend/api/vitest.config.ts`
**Files scanned:** ~10 (all directly read this session or in the upstream research session per its Sources section)
**Pattern extraction date:** 2026-08-12
</content>

# Phase 1: Data Foundation - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the waitlist capture backend: the `waitlist_signups` table, the founder-rank
sequence, the `SECURITY DEFINER` RPCs that are the only door into it, a shared `app_config`
key/value table, and the Next.js Server Action that calls the write RPC — plus the tests that
prove the 200-founder cap holds under concurrency.

**In scope:** SQL migration (table, sequence, indexes, deny-all RLS, `app_config`), the write RPC,
the counter read RPC, the anonymization RPC, the Server Action, concurrency and RLS tests.

**Out of scope:** every pixel of UI (phase 5), the consent checkbox and privacy notice themselves
(phase 3 — phase 1 only shapes the columns that will hold their output), the retention *duration*
value (phase 3 writes it into `app_config`), disposable-domain rejection (WAIT-04, phase 5),
the credit-gate feature flag's *behaviour* (phase 4 — phase 1 only provides the table it lives in).

</domain>

<decisions>
## Implementation Decisions

### Call path and execution surface

- **D-01:** The signup reaches the RPC through a **Next.js Server Action** that uses the
  service-role client (`apps/web/src/lib/supabase/admin.ts`). No `GRANT` is issued to `anon`.
  This preserves the posture of all 73 existing migrations, where every `GRANT EXECUTE` targets
  `authenticated` or `service_role` and never `anon`. It also gives a server-side chokepoint for
  the rate limiting and disposable-domain rejection that phase 5 will need.
  — **Reversibility:** costly — switching to a direct browser call later needs a new migration
  granting `anon`, a rewrite of the submission path, and a fresh abuse-protection story that the
  server chokepoint currently provides for free.

- **D-02:** The RPCs follow the codebase's existing grant idiom exactly: `REVOKE EXECUTE ON
  FUNCTION ... FROM PUBLIC;` immediately followed by `GRANT EXECUTE ... TO <role>;`. This was
  **not** a discussion item — it is established precedent (`is_coach_of` at
  `035_coach_invitations_links_rls.sql:100-101`, `redeem_invitation_code` at `:176-177`,
  `peek_invitation` at `040_peek_invitation_function.sql:73`). The `REVOKE` is mandatory, not
  stylistic: PostgreSQL grants `EXECUTE` to `PUBLIC` by default, so a `SECURITY DEFINER` function
  without it is reachable by `anon` even when no explicit grant is written.

- **D-03:** The Server Action returns the **real founder status only for a genuinely new signup**.
  A duplicate submission receives a neutral success confirmation carrying no rank and no status.
  — **Reversibility:** costly — the response shape is the contract phase 5's success state is
  built against, and changing it later means reworking both the action's tests and the UI.

- **D-04:** **DATA-07 has been rewritten** as a direct consequence of D-03. Its original wording
  ("réponse indistinguable") is incompatible with WAIT-05, which requires the page to confirm the
  founder status obtained: once the 200 spots are gone, a new signup necessarily returns
  `founder=false` while an already-registered founder would return `true`, and that gap is an
  oracle. The requirement now guarantees that **a third party's founder status** cannot be
  determined; waitlist *membership* is explicitly accepted as disclosable. `REQUIREMENTS.md`
  DATA-07 and this phase's success criterion 5 in `ROADMAP.md` were both updated.
  — **Reversibility:** costly — reverting means returning to a neutral-always response and
  removing the on-page rank reveal from phase 5's design.

  **Residual risk, recorded deliberately:** an attacker who submits a third party's address still
  learns whether it was already registered, because a new signup shows a rank and a duplicate does
  not. Rate limiting on the Server Action raises the cost of mass scanning but does not remove the
  oracle. This was surfaced explicitly and accepted.

- **D-05:** Phase 1 delivers the Server Action, not only the SQL. Rationale: the phase's headline
  promise is the 200-cap under concurrency, and that is only testable end-to-end through the path
  production will actually take.

### Counter and configuration

- **D-06:** The read RPC returns an object **already arbitrated by the threshold** —
  `{ should_display, remaining, is_full }` — applying the reveal threshold inside the database
  rather than in Next.js. The exact remaining count never leaves the database while the page is
  not supposed to show it, and the whole 200-spot rule lives beside the sequence that allocates
  them.
  — **Reversibility:** costly — phase 5 renders directly against this shape.

- **D-07:** An erasure request **anonymizes** the row (blanking email and identifying fields,
  keeping the row and its rank) rather than deleting it. This resolves a real collision between
  FOND-04 (the displayed number must never rise) and LEGAL-09 (right to erasure): deleting a
  founder's row would free a spot and make the counter climb. An irreversibly anonymized row falls
  outside GDPR's scope, so this satisfies an erasure request; the founder spot stays consumed,
  which is also the honest outcome for everyone behind them in line.
  — **Reversibility:** one-way — anonymization destroys the address by design, and switching to
  hard deletion afterwards would break FOND-04's monotonicity guarantee.

- **D-08:** A shared **`app_config`** key/value table is created in phase 1 (deny-all RLS, read
  through an RPC like everything else here). Phase 1 stores the reveal threshold in it, satisfying
  FOND-06's "configurable without redeploy". **Phase 4 reuses it for CRED-05's feature flag**
  instead of inventing a second configuration mechanism — `ROADMAP.md` phase 4's "Depends on" was
  updated to record this.
  — **Reversibility:** costly — phase 4 is now coupled to it; removing it means a migration plus
  rework in a downstream phase.

- **D-09:** The counter is served from a **short cache with a monotonic floor**: the value served
  can never exceed the last value served, so FOND-04 holds even when two nodes hold different
  cached values. The shared state uses Upstash Redis, already configured
  (`apps/web/src/lib/ratelimit.ts`).

### Email identity

- **D-10:** Normalization **neutralizes sub-addressing** — the `+suffix` is stripped for all
  domains, and dots are stripped for Gmail and Googlemail only, where the provider genuinely
  ignores them. 200 lifetime-premium spots are a real incentive to farm with `me+1@`, `me+2@`;
  this closes the trivial path while matching how the affected mailboxes actually behave. Blanket
  dot-stripping across all domains was rejected because it would wrongly merge distinct addresses
  at providers where the dot is significant.
  — **Reversibility:** one-way — once rows exist under one normalization scheme, changing it
  requires a data migration that can surface unresolvable collisions (two stored rows normalizing
  to the same key, with no rule for which keeps the founder rank).

- **D-11:** Two columns, not one: the address **as typed** (used for delivery) and its
  **normalized form** (carrying the unique index). This changes the sketch in
  `research/ARCHITECTURE.md` §1, where the unique index sits on `lower(email)` and the
  `ON CONFLICT` target follows it — both now key off the normalized column.

- **D-12:** Normalization runs **inside the RPC, in plpgsql**, not in the Server Action. The
  guarantee belongs where the constraint lives, so no future caller — an admin script, a second
  action, a manual import — can write an unnormalized form and defeat the unique index.

- **D-13:** A **minimal format `CHECK`** on the table as a last net (an `@` and a plausible
  domain). It does not attempt to validate deliverability, which no regex achieves; richer
  validation and disposable-domain rejection stay at the form layer (WAIT-04, phase 5).

### Stored fields and GDPR footprint

- **D-14:** Beyond DATA-01's email / audience / timestamp / rank, the table stores **`locale`,
  `utm_source` and `utm_campaign`**. `locale` is functionally necessary — the offer is bilingual
  and the founder rank is announced by email, which must go out in the right language. The UTM
  pair makes ENTRY-06 ("conversions measurable") actually exploitable. Note for phase 3: UTM values
  are not personal data alone, but tied to an email they become so, and LEGAL-07's collection-point
  notice must cover them.

- **D-15:** **Consent-proof columns ship in phase 1** — the consent timestamp and the version of
  the accepted text. Phase 3 only fills them from the form. GDPR Article 7(1) requires being able
  to *demonstrate* consent, and the earliest founders are precisely the cohort that could never be
  retrofitted. Phase 1 defines the columns; phase 3 defines what goes in them.

- **D-16:** Phase 1 also delivers the **anonymization RPC** and the `anonymized_at` column; phase 3
  writes the retention *duration* into `app_config` once counsel has advised. The mechanism and its
  monotonicity guarantee are therefore tested in the phase that promises them, while the legal
  parameter stays changeable without a redeploy.

### Claude's Discretion

- Exact migration filename and numbering (the repo mixes `NNN_description.sql` and
  `YYYYMMDD_description.sql`; the newer dated form fits a 2026 migration).
- Column naming, index naming, and the internal structure of the plpgsql normalization helper.
- The concrete concurrency-test technique proving the 200-cap (parallel sessions, `pgbench`, or a
  Vitest harness driving concurrent RPC calls).
- Cache TTL for the counter, provided the monotonic floor of D-09 holds.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — DATA-01→07 are this phase's requirements;
  **DATA-07 was rewritten during this discussion** (see D-04) and its revised wording governs.
- `.planning/workstreams/lien-invite/ROADMAP.md` — phase 1 goal and success criteria; criterion 5
  was rewritten to match D-04, and phase 4's "Depends on" now records the `app_config` coupling.
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §1 — the DDL sketch, the concurrency
  analysis rejecting `COUNT(*)` and `ROW_NUMBER()`, and the `SEQUENCE` rationale. **Superseded in
  one respect:** its unique index and `ON CONFLICT` target sit on `lower(email)`; D-11 moves both
  to the normalized column.

### Codebase idioms this phase must follow
- `supabase/migrations/026_ai_credits.sql:89-119` — `deduct_ai_credits`: the `SECURITY DEFINER` +
  `SET search_path = public` + `RETURNS JSONB` shape, and the row-lock-beats-read-then-decide
  lesson that motivates the sequence.
- `supabase/migrations/035_coach_invitations_links_rls.sql:100-101, 176-177` — the mandatory
  `REVOKE ... FROM PUBLIC` then `GRANT ... TO <role>` pairing (D-02).
- `supabase/migrations/040_peek_invitation_function.sql:73` — same idiom, third instance.
- `supabase/migrations/034_coach_role_profiles.sql:16-19` — `TEXT` + `CHECK (... IN (...))` for
  enumerated columns; this codebase never uses native Postgres enums.

### Web integration points
- `apps/web/src/lib/supabase/admin.ts` — the service-role client the Server Action calls through.
- `apps/web/src/lib/ratelimit.ts` — the Upstash limiter, already used by `coach-identity.ts`;
  serves both the action's rate limiting and D-09's monotonic floor.
- `apps/web/src/actions/account.ts` — closest existing Server Action model, and the source of the
  generic-response anti-enumeration philosophy this phase inherits.
- `apps/web/src/actions/coach-identity.ts` — a Server Action already wired to the rate limiter.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Service-role Supabase client (`apps/web/src/lib/supabase/admin.ts`) — no new client needed.
- Upstash rate limiter (`apps/web/src/lib/ratelimit.ts`) — already instantiated and in use.
- Three existing Server Actions in `apps/web/src/actions/` as structural models.

### Established Patterns
- **No `anon` grants anywhere.** Across 73 migrations every `GRANT EXECUTE` targets `authenticated`
  or `service_role`. D-01 keeps that intact.
- **`REVOKE ... FROM PUBLIC` before every `GRANT`** on `SECURITY DEFINER` functions.
- **`TEXT` + `CHECK (... IN (...))`** for enumerated columns, never native enums.
- **Deny-all RLS plus a `SECURITY DEFINER` door** is already the house pattern for sensitive tables.
- **Backend relative imports need a `.js` extension** — applies only if any backend code is touched;
  this phase's action lives in `apps/web`, which does not have that constraint.

### Integration Points
- New migration in `supabase/migrations/`; CI applies migrations automatically on push to `main`
  when that directory changes.
- New Server Action under `apps/web/src/actions/`, consumed by phase 5's form.
- New `app_config` table, consumed again by phase 4.

### Constraint worth flagging to the planner
`supabase/migrations/019_remove_dead_brands.sql:15-21` grants `FOR ALL TO anon USING (true)` on the
supplement tables — a pre-existing wide-open policy unrelated to this phase. It is noted only so it
is not mistaken for a precedent supporting an `anon` grant here.

</code_context>

<specifics>
## Specific Ideas

- The founder rank must be announced to its owner. Combined with D-03, the rank is shown on-page to
  a genuinely new signup, which keeps the gratification moment WAIT-05 asks for.
- The counter must be credible: D-06 keeps the exact number inside the database until the reveal
  threshold is crossed, so a pre-reveal page cannot leak it in a network response.

</specifics>

<deferred>
## Deferred Ideas

- **Rate limiting parameters on the Server Action** — the limiter exists and D-01 makes it
  attachable, but the concrete thresholds belong with the form in phase 5.
- **Disposable-domain rejection (WAIT-04)** — form layer, phase 5.
- **Retention duration value (LEGAL-08)** — phase 3 writes it into `app_config`; phase 1 only
  builds the mechanism.
- **Consent checkbox and collection-point privacy notice (LEGAL-06, LEGAL-07)** — phase 3 for the
  text, phase 5 for the UI. Phase 1 provides the columns only.
- **The `tier='premium'` production count (CRED-01)** — phase 4's blocking gate, unaffected here.

</deferred>

---

*Phase: 1-Data Foundation*
*Context gathered: 2026-08-12*

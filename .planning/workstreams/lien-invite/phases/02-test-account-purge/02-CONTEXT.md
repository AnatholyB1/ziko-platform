# Phase 2: Test-Account Purge - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers a written, human-reviewed test-account deletion procedure for production, applying
the locked `@ziko-app.com` domain criterion (D-01): a dry-run (read-only) export tool, an export
backup step, and the deletion script itself — built and rehearsed through the same Admin API path
already proven in `apps/web/src/actions/account.ts:84-85` (`admin.auth.admin.deleteUser()`).

**In scope:** the dry-run export applying the `@ziko-app.com` criterion (including cross-link
detection against `coach_client_links` / `coach_vocal_feedbacks` / any `assigned_to_user_id`
column), the human review of that literal query result, the pre-delete row export, a PITR-status
check, the delete script built on the Admin API path, and post-deletion orphan verification — all
built and verified structurally/via dry-run.

**Out of scope:** the actual irreversible execution of the real deletion against production (see
D-03 — deliberately deferred to a separate, explicitly human-triggered step outside this phase);
the `waitlist_signups` test-row reset described in `research/ARCHITECTURE.md` §1/§6 (a distinct
concern from pre-existing `auth.users` test accounts — the mechanism already exists from Phase 1's
`reset_waitlist_founder_sequence()` RPC, and its timing naturally belongs with Phase 6's
convergence/activation checks, not this phase); resolving cross-linked pairs flagged by the dry-run
(per D-05, they are excluded from this purge run and revisited later, outside this phase).

</domain>

<decisions>
## Implementation Decisions

### Test-account identification

- **D-01:** The criterion is **locked**: every `auth.users` account with an `@ziko-app.com` email
  is test/dev data; every other domain is a real account — **no exceptions**. This is a genuine,
  human-provided rule (not inferred), consistent with `research/ARCHITECTURE.md` §6 and
  `PITFALLS.md` Pitfall 13, which both reject a fuzzy match (`email LIKE '%test%'` or similar) as
  the *executed* filter — `@ziko-app.com` is not a fuzzy heuristic, it is the explicit, confirmed
  team domain used for dev/QA accounts. No existing marker was found anywhere in the schema (no
  `is_test` column, no test-domain convention — confirmed by grep across `supabase/seed.sql` and
  all migrations during Phase 1's research), so this domain rule *is* the written criterion PURGE-01
  requires.
  — **Reversibility:** one-way in effect — deletion executed under this rule cannot be undone by
  changing the rule afterward; get the domain confirmed correct before the real run (D-03).

- **D-02:** Because the criterion is already fixed, no separate "obtain the allowlist" checkpoint
  is needed. What PURGE-01/PURGE-02 still require is a **human review of the literal query result**:
  the dry-run task runs `... WHERE email LIKE '%@ziko-app.com'` and the plan's review step is the
  user inspecting that concrete row set (not the abstract rule) before the real delete — catching
  any surprise (e.g., a real user who was mistakenly given a `@ziko-app.com` alias) that the rule
  alone wouldn't reveal.
  — **Reversibility:** reversible — a review-gate placement is a planning-order detail.

### Execution scope

- **D-03:** This phase **builds and rehearses the full purge but does not run the real delete**.
  Deliverables: a dry-run export tool applying the D-01 criterion, proven against read-only
  queries, the backup/export step, and the delete script itself — all built, tested, and verified
  structurally (and via dry-run output where the data allows). The actual irreversible run against
  **production** (distinct from the `ziko` *test* project Phase 1 used) is a separate, explicitly
  human-triggered step outside this phase's auto tasks, matching the AGENTS.md/system-level
  guidance that hard-to-reverse, production-affecting actions get confirmed, not auto-executed.
  — **Reversibility:** one-way — reversing this decision mid-phase (i.e., deciding later that the
  phase *should* execute the real delete after all) means re-opening the phase-acceptance
  checkpoint and re-confirming production credentials/authorization from the user.

  **Practical consequence:** no production `SUPABASE_SERVICE_ROLE_KEY` has been available via any
  tool this session has used through Phase 1 or Phase 2 discussion — the same gap that limited
  literal test execution in Phase 1 applies here, at much higher stakes (production, irreversible
  delete vs. a test-project RLS/RPC proof).

### Backup mechanism

- **D-04 (backup):** The **export is the primary, unconditional safety net** — the exact affected
  rows (`pg_dump`/CSV — IDs, emails, `created_at`, `tier`, any waitlist rows) are exported
  immediately before deleting, regardless of PITR status, because it restores just the affected
  rows fast. Whether Supabase PITR is enabled on the **production** project is **not yet known** —
  that becomes a verification task at execution time, not assumed here — and PITR, if available,
  is treated as a secondary, more disruptive fallback behind the export, not a co-equal requirement.
  This still matches `PITFALLS.md` Pitfall 13's "how to avoid" step 3, just with the export as the
  primary mechanism and PITR as backstop rather than both gating equally.

### Cross-linked accounts

- **D-05:** When the dry-run flags a test-account candidate cross-linked to a real user (e.g., a
  genuine athlete whose coach is a test account, via `coach_client_links` or
  `coach_vocal_feedbacks` — the exact hazard `research/ARCHITECTURE.md` §6 names as "the one real
  hazard"), that pair is **automatically excluded** from this purge run. Only unambiguous
  candidates get deleted now; flagged pairs are surfaced in the dry-run report and revisited
  manually later, outside this phase.
  — **Reversibility:** reversible — a stricter/looser cross-link policy can be revisited on the
  next purge run without touching already-deleted rows.

### Claude's Discretion

- Exact shape/location of the dry-run export tool and the delete script (one-off Node/tsx script
  under `scripts/`, following the existing `scripts/*.js` pattern in this repo, vs. some other
  form) — no existing precedent script hits the Supabase Admin API from this codebase, so the
  planner should pick the simplest option consistent with "one person runs it, a second person
  reviews the dry-run output first" (Pitfall 13's two-person rule).
- Exact query form for applying the `@ziko-app.com` criterion (case sensitivity, whitespace
  handling) — D-01 fixes the rule, not the SQL syntax.
- Whether the backup export step is a manual `pg_dump` invocation documented in a runbook, or a
  small script — as long as the unconditional row export happens and PITR status is checked (D-04).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — PURGE-01→05 are this phase's requirements.
- `.planning/workstreams/lien-invite/ROADMAP.md` — Phase 2 goal and the 5 success criteria (PURGE-01
  through PURGE-05, each mapped 1:1 to a numbered criterion).
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §6 "Test Account Purge" — the full
  reviewed procedure (dry-run → explicit criterion → backup checkpoint → execute via Admin API →
  explicit recommendation against raw bulk `DELETE`), the FK-cascade map from `auth.users` outward
  (31 files, all `ON DELETE CASCADE`, zero orphan risk when done via the Admin API), and the
  cross-user-table hazard this phase's D-05 responds to.
- `.planning/workstreams/lien-invite/research/PITFALLS.md` Pitfall 13 "Deleting test accounts from
  production goes wrong" — the concrete failure modes (cascade over-deletion, no dry run, no
  backup, ambiguous criteria matching real users, `auth.users` vs `user_profiles` orphaning, no
  transaction) and the numbered "how to avoid" procedure this phase's decisions implement directly.

### Codebase idioms this phase must follow
- `apps/web/src/actions/account.ts:1-97` (full file) — the proven `admin.auth.admin.deleteUser()`
  call and its `findUserIdByEmail` helper; this phase's delete script follows the same Admin API
  call, not a raw SQL `DELETE FROM auth.users`.
- `scripts/csv-to-seed.js`, `scripts/json-to-seed.js`, `apps/web/scripts/*.js` — this repo's
  existing convention for one-off Node scripts (plain `.js`, `node scripts/<name>.js`, no
  TypeScript build step) — the closest structural precedent for where a purge script would live,
  though none of them touch Supabase Auth today.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `admin.auth.admin.deleteUser(userId)` call pattern, proven in production via `account.ts:84-85`
  (self-service account deletion) — reused directly for the purge script.
- Phase 1's `reset_waitlist_founder_sequence()` RPC — already the right tool for the *separate*
  `waitlist_signups` QA-row cleanup noted as out of scope for this phase (see `<domain>`).

### Established Patterns
- **Every domain table roots at `auth.users.id` with `ON DELETE CASCADE`** — confirmed across 31
  migration files during Phase 1's research; the Admin API delete cascades correctly and
  completely with zero manual multi-table `DELETE` script needed.
- **`SECURITY DEFINER` + deny-all RLS** is the house pattern for sensitive operations, but does not
  apply directly here — deletion goes through the Admin API (a service-role HTTP/SDK call), not a
  Postgres RPC, because the target is `auth.users` itself, which Supabase manages.

### Integration Points
- No new migration is anticipated for this phase's core deliverable (the purge script and
  procedure are operational, not schema); a migration would only be needed if a supporting artifact
  (e.g., a written audit-log table of what was purged and when) is decided during planning.
- The purge script is a standalone operational tool, not something wired into any user-facing
  route — it runs manually, once, by one person, reviewed by a second (Pitfall 13's two-person
  rule).

</code_context>

<specifics>
## Specific Ideas

- The test-account rule is exact and absolute: **every** `@ziko-app.com` address is test/dev,
  **every** other domain is real — no exception list to track.
- The purge is explicitly framed as "rehearse, don't fire" for this phase: every piece of tooling
  proven correct and ready, but the loaded gun stays on the table until the user pulls the trigger
  outside of this phase's automated tasks.

</specifics>

<deferred>
## Deferred Ideas

- **`waitlist_signups` QA-row reset** — distinct from `auth.users` test accounts; the RPC already
  exists from Phase 1 (`reset_waitlist_founder_sequence()`); timing belongs with Phase 6's
  go-live convergence checks.
- **Resolving cross-linked flagged pairs** (D-05) — excluded from this purge run by design;
  revisited manually later, outside this phase.
- **The actual production deletion run** (D-03) — this phase builds and rehearses; the real
  execution is a separate, explicitly human-triggered step, likely tracked as its own follow-up
  task/session once the user has production credentials ready and has reviewed the dry-run output.

</deferred>

---

*Phase: 2-Test-Account Purge*
*Context gathered: 2026-08-13*

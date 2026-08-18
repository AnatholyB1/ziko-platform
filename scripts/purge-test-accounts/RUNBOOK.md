# Test-Account Purge — RUNBOOK

**Audience:** a second person who has not read any planning document and is about to authorize an
irreversible action. Read this file top to bottom before running anything or approving anyone else's
run.

---

## 1. The criterion (PURGE-01, decision D-01)

An `auth.users` account is test/dev data **if and only if** its email domain is exactly
`ziko-app.com` — evaluated case-insensitively, with whitespace trimmed, as an exact equality on the
text after the final `@` sign. **Every other domain is a real account. There is no exception list.**

This rule is deliberately an equality check, never a fuzzy or wildcard pattern, because a substring
or contains-style match cannot distinguish the real domain from a domain that merely resembles it.
The following are all **real accounts** and must never be treated as test data, even though each one
visually resembles the test domain:

- `notziko-app.com`
- `sub.ziko-app.com`
- `ziko-app.co`
- `ziko-app.com.attacker.tld`

The lookalikes above are not a hypothetical — they are the entire reason the criterion is written as
exact domain equality rather than a pattern. A reviewer who sees any of these four addresses in a
`to_delete` row should treat that as a bug in the tooling, not a real test account.

This rule is the human-provided criterion of record for PURGE-01. It was confirmed by the project
owner, not inferred from a database query. **Changing it requires a new written decision recorded in
`.planning/workstreams/lien-invite/phases/02-test-account-purge/02-CONTEXT.md` (or its successor
decision record), never a silent edit to a script.**

---

## 2. What deleting an account actually does

Every domain table in this codebase roots at `auth.users.id` with `ON DELETE CASCADE`, confirmed
across 31 migration files (`research/ARCHITECTURE.md` §6). Deleting one `auth.users` row therefore
also removes that account's workouts, nutrition logs, AI conversations, credit ledger entries, and
coach links — the cascade is total and by design, and there is no way to delete "just the auth row."

The one real hazard this creates (`research/ARCHITECTURE.md` §6): a test-domain coach or athlete
account can be linked to a **real** account through any of the 18 tables in `supabase/migrations/`
that pair two `auth.users` foreign keys: `coach_client_links`, `coach_vocal_feedbacks`,
`workout_programs`, `coach_invitations`, `friendships`, `app_invites`, `screen_reactions`,
`shared_programs`, `xp_gifts`, `coin_gifts`, `habit_encouragements`, `coach_client_tags`,
`coach_client_notes`, `coach_alerts`, `ai_tool_audit`, `dashboard_configs`, `coach_client_videos`,
and `coach_metric_thresholds` (canonical list: `CROSS_LINK_SOURCES` in
`scripts/purge-test-accounts/lib.mjs`). Deleting that test account would silently sever the real
counterpart's coaching relationship, social connection, or coach-authored data pointing at them, even
though the counterpart's own account is completely real. `scripts/purge-test-accounts/dry-run.mjs`
automatically withholds any test-domain candidate that is cross-linked to a non-candidate (real)
account, on either user column of each of those tables, and lists it in the report's `flagged`
section instead of `to_delete`. Flagged pairs are **excluded from this purge run** and revisited
manually later, outside this procedure (D-05).

---

## 3. The two-person rule

Per `research/PITFALLS.md` Pitfall 13 step 6: **one person runs the purge, and a second person who did
not run it reviews the dry-run output first.** This runbook exists because a two-person rule needs a
document the second person can actually read and act on — the review checkpoint below is that gate,
and it is never skipped and never auto-approved.

---

## 4. Environment

Every command in this runbook loads its configuration the same way:

```
node --env-file=apps/web/.env.local scripts/purge-test-accounts/<script>.mjs ...
```

Node 22 is in use, so `--env-file` loads the variables below with no extra tooling.

| Variable | Required by | Notes |
|---|---|---|
| `SUPABASE_URL` | every script | project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | every script except `pitr.mjs` | server-only — never expose to a client, never commit it |
| `SUPABASE_ACCESS_TOKEN` | `export.mjs` (via `pitr.mjs`) | optional; its absence downgrades the PITR read to the honest `unknown` state rather than an error |

---

## 5. The procedure

Each step names its literal command and what to read in the output. Steps 1–2 and 4–7 are performed
by the operator; step 3 is performed by a second person.

1. Load the environment with `node --env-file=apps/web/.env.local`, confirming `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are set and, if a PITR read is wanted this run, that
   `SUPABASE_ACCESS_TOKEN` is set too.

2. Run the dry-run:

   ```
   node --env-file=apps/web/.env.local scripts/purge-test-accounts/dry-run.mjs [--out <dir>]
   ```

   Read the four printed totals: `users_scanned`, `candidates`, `flagged_cross_linked`, `to_delete`.
   **This step removes nothing** — it only enumerates and writes a JSON report plus a `to_delete.csv`
   to a git-ignored export directory.

3. **Second-person review.** A person who did **not** run step 2 opens the written CSV and reads every
   row. This is the two-person rule from Pitfall 13 step 6 and it is the gate PURGE-01 and PURGE-02
   exist for — the reviewer is checking the concrete row set produced this run, not re-approving the
   abstract rule from section 1. Look for: an address that does not look like a QA/dev alias, a recent
   `last_sign_in_at`, or any non-zero `flagged_cross_linked` count worth reading in full before
   continuing.

4. Run the export immediately after review, before any deletion:

   ```
   node --env-file=apps/web/.env.local scripts/purge-test-accounts/export.mjs --report <path> [--out <dir>]
   ```

   This step is **unconditional** — it is the primary safety net (D-04) and it always runs regardless
   of PITR status. It writes a CSV of every `to_delete` row plus a hashed manifest. The manifest's
   `manifest_sha256` covers `candidate_ids`, `generated_at`, and `pitr` together (WR-01) — not just
   the id list — so none of the three fields the next step gates on can be edited on disk without
   tripping the mismatch check. A manifest older than 60 minutes is refused by the next step precisely
   so "run the export immediately before deleting" stays true rather than becoming a stale
   convenience.

5. Read the PITR line the export prints (`pitr status: <enabled|disabled|unknown> (<detail>)`). PITR
   is the **secondary** backstop behind the export (D-04) — not a co-equal requirement. An `unknown`
   result is a real, honestly-reported outcome (an absent `SUPABASE_ACCESS_TOKEN`, an unreachable
   Management API, or a non-OK response), never an error and never a guess. Proceeding on `unknown`
   requires the `--accept-unknown-pitr` acknowledgement flag on the next step — that flag is the
   operator making the decision on the record, not the tooling assuming it on their behalf.

6. Run the delete with the manifest from step 4. Show the inert form first:

   ```
   node --env-file=apps/web/.env.local scripts/purge-test-accounts/delete.mjs --manifest <path>
   ```

   This prints the planned deletions and exits having touched nothing — the confirmation flag is the
   only difference between this and the real run:

   ```
   node --env-file=apps/web/.env.local scripts/purge-test-accounts/delete.mjs --manifest <path> --confirm [--accept-unknown-pitr] [--max-manifest-age-minutes <n>]
   ```

   Before attempting any deletion, `delete.mjs` recomputes `manifest_sha256` over the manifest's
   `candidate_ids`, `generated_at`, and `pitr` together and refuses to run on a mismatch, checks the
   manifest's age against `--max-manifest-age-minutes` (default 60), confirms the referenced export
   CSV still exists on disk, and enforces the PITR acknowledgement from step 5. Every check runs and
   every failure is reported at once, so a stale or tampered manifest is never partially trusted.

7. Run the post-purge verification with both the manifest and the original report:

   ```
   node --env-file=apps/web/.env.local scripts/purge-test-accounts/verify-purge.mjs --manifest <path> --report <path>
   ```

   A pass looks like: no manifest id survives (`deleted_still_present` is empty), every surviving
   account matching the criterion was already named in advance as withheld
   (`expected_remaining` accounts for it, `unexpected_matches` is empty), the surviving account count
   is at or above the scanned-minus-purged floor, and the cross-table orphan total is zero. **Read the
   conservation line most carefully** — it is the only check able to catch a real account destroyed by
   an over-broad criterion, since such an account leaves no residual match and no orphan behind for the
   other two checks to see.

---

## 6. Recovery

Restoring from the **export CSV written in step 4 is the fast path** — it restores only the affected
rows and is the primary recovery mechanism (D-04). **PITR is the slow, project-wide fallback behind
it**, used only if the export itself is somehow unusable.

Every deletion in this procedure goes through the Supabase Admin API
(`admin.auth.admin.deleteUser()`, the exact call already proven in production at
`apps/web/src/actions/account.ts:84-85`) — this is what keeps Supabase's own sessions, refresh tokens,
and identities consistent as each account is torn down. Issuing a raw bulk statement against the auth
schema directly in the SQL editor is **not** an alternative to this procedure;
`research/ARCHITECTURE.md` §6 step 5 recommends explicitly against it, and no step in this runbook
ever asks anyone to do so.

---

## 7. Scope: what this phase does not do (D-03)

The real production run is **deliberately outside phase 2**. The tooling documented above is built,
tested, and rehearsed end to end against fixture data — no task in phase 2 executed the deletion
against production. Firing it for real is a separate, explicitly human-triggered step, taken once
production Supabase credentials (`SUPABASE_SERVICE_ROLE_KEY` for the production project, and
`SUPABASE_ACCESS_TOKEN` for the PITR read) are in hand and the review in step 3 has actually happened
against the real dry-run output.

No script in this directory is invoked automatically, on a schedule, or as part of any deploy. Every
run of every script in this procedure is a manual, human-initiated action.

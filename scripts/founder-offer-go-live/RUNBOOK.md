# Founder Offer Go-Live — RUNBOOK

**Audience:** a person who has not read any planning document for this milestone and is about to
change production. Read this file top to bottom before running anything. This document **is** the
whole procedure — its section order is a safety property, not a convenience. Sections 4 through 11
are added by later plans in this same phase (06-02, 06-03, 06-04). If you find this file with only
sections 0 through 3 present, **do not improvise the missing sections from memory or from this
phase's planning docs** — stop and wait for the plan that adds them.

No secret value is ever written into this runbook, into the evidence log
(`06-GO-LIVE-LOG.md`), or into a chat transcript when results are pasted back. Only command names and
result values are recorded — never a token, a key, or a connection string.

---

## Section 0 — Preconditions

Confirm all four of the following before touching anything. Each has its own literal check and its
own fallback if it fails.

**0.1 — You hold production credentials.**
You need `SUPABASE_ACCESS_TOKEN` for the CLI path used in Section 1/2, and
`SUPABASE_SERVICE_ROLE_KEY` (or Supabase SQL Editor access) for the direct-query path used in
Section 3 and later sections. No Claude session in this milestone has ever held either of these for
production — every check and command in this document was written and rehearsed without a real
credential, never fired. If you are a Claude session reading this: you cannot complete this section
and must stop here; this is a human-only document from this point forward.

**0.2 — The two GitHub Actions secrets are actually configured on the repository.**
CI's `migrate-supabase` job (`.github/workflows/ci.yml`) reads `SUPABASE_PROJECT_ID` and
`SUPABASE_ACCESS_TOKEN` as repository secrets. Confirm both are present:

```
gh secret list --repo AnatholyB1/ziko-platform
```

or open the repository's Settings → Secrets and variables → Actions page directly. Their absence is
not hypothetical — `STATE.md` already records an unresolved analogue for `test-rls.yml`'s own
`SUPABASE_TEST_PROJECT_ID`/`SUPABASE_TEST_SERVICE_ROLE_KEY`/`SUPABASE_TEST_URL` secrets, so treat this
as a real, precedented risk, not a formality. **Fallback if either secret is missing:** do not merge
and hope. Apply the three pending migration files by hand through the Supabase SQL Editor instead —
`supabase/migrations/20260815_waitlist_retention_config.sql`,
`supabase/migrations/20260816_premium_credit_flag.sql`, and
`supabase/migrations/20260816_premium_credit_grant.sql` — pasting each file's contents in order, then
proceed to Section 3's confirmation queries as normal.

**0.3 — The production project ref.**
Every verification query in this document is run against project ref **`slkobhavpwsubnsmuhya`**
specifically — never against whichever project a terminal or MCP session happens to be linked to at
the time. `.github/workflows/test-rls.yml` runs a near-identical migration-apply block against a
*different* project (`SUPABASE_TEST_PROJECT_ID`); confusing the two is the single most likely way to
believe production is live when it is not (see Section 2's closing note).

**0.4 — The real production web domain.**
Before running any URL check later in this document (CGU/CGV liveness, entry-point spot-check),
confirm the actual production site domain by reading `apps/web/.env.local`'s `NEXT_PUBLIC_SITE_URL`
directly. This research could not read that value — it is a gitignored env file — so any domain named
in this document's examples (e.g. `ziko-app.com`) is an unconfirmed convenience, not a verified fact.
Say what the value actually is before using it in a command.

---

## Section 1 — Merge the milestone branch to `main`

**State as of planning (2026-08-18):** `git rev-list --count main..HEAD` is 157,
`git rev-list --count HEAD..main` is 0, and `git diff main --name-status -- supabase/migrations/`
shows all four migration files as additions (`A`), not modifications — including
`20260812_waitlist_founder_offer.sql`, which reached production out-of-band during Phase 1's own
testing, never through this repository's CI.

**Do not trust those numbers.** The branch moves. Re-run all three yourself right now:

```
git rev-list --count main..HEAD
git rev-list --count HEAD..main
git diff main --name-status -- supabase/migrations/
```

Report what you actually see.

**Open a pull request from the milestone branch to `main` and land it as a single merge commit or a
single squash commit.** This is not a style preference — it is load-bearing for Section 2. CI's
migration-change detector (`.github/workflows/ci.yml`'s `migrate-supabase` job) diffs only the
checked-out `HEAD` against its immediate parent (`git diff --name-only HEAD~1 HEAD`), and the job's
checkout uses `fetch-depth: 2`, which fetches exactly enough history for that single comparison to
resolve and no more. A raw multi-commit fast-forward push of this branch still fires the workflow
once, but the detector then examines only the very last of however many commits landed in that push —
if that last commit does not itself touch `supabase/migrations/`, the detector resolves `changed=false`,
the entire `Setup Supabase CLI` / `Push migrations` step block is skipped by its own guard, and the job
finishes green having applied nothing. A single merge or squash commit collapses the push to exactly
one commit against `main`'s prior tip, which is what the detector is actually built to see.

Record the PR number and the merge commit SHA.

---

## Section 2 — Confirm CI applied the migrations

Open the GitHub Actions run triggered by the merge **push event on `main`** — not a pull-request run.
The `migrate-supabase` job's condition is `github.event_name == 'push' && github.ref ==
'refs/heads/main'`; it does not fire on `pull_request` events at all, so a PR's own checks tell you
nothing about the migration apply.

Expand the `Apply Supabase migrations` job and read the state of each step:

- `Check for migration changes` — always runs, sets `changed=true` or `changed=false`.
- `Setup Supabase CLI` — should show as **executed**, not skipped.
- `Push migrations` — should show as **executed**, not skipped.

A skipped `Setup Supabase CLI` / `Push migrations` pair means the change detector resolved `false` and
nothing was applied, **regardless of the job's overall colour**. A green job with those two steps
skipped is not a success — it is Pitfall 2 from `06-RESEARCH.md` happening in real time.

**The badge is not the evidence.** Even if both steps show as executed, do not treat that as proof —
proceed immediately to Section 3's direct read. Two independent things can go wrong even on a "green"
run: `supabase migration repair ... || true` silently swallows a repair failure (Assumption A3), and
`.github/workflows/test-rls.yml` runs an almost identical apply block against a *different* project
(`SUPABASE_TEST_PROJECT_ID`) — a green run of that workflow proves nothing about production. Only a
direct query against `slkobhavpwsubnsmuhya` distinguishes "migrations applied to production" from
"migrations applied to the test project" or "not applied at all."

---

## Section 3 — Confirm the pipeline moved, on one artifact at each end

This is the tracer confirmation. It is deliberately narrow: two checks, one per end of the pipeline,
both run immediately after Section 2.

**3.1 — Database end.** Run, against production (`slkobhavpwsubnsmuhya`) specifically:

```sql
SELECT key, value FROM public.app_config ORDER BY key;
```

Before this merge, production held exactly one row: `waitlist_reveal_threshold`. A
`premium_credit_cap_enabled` row now being present is unambiguous proof that a previously-unapplied
migration landed — this row did not exist by any other path before this plan ran
(`supabase/migrations/20260816_premium_credit_flag.sql:44`). If the result set is still one row, the
apply did not happen: say so and stop here, do not retry blind. Escalate to whichever failure shape
applies — a skipped CI step pair points at the change detector and merge strategy (Section 1/2); an
executed-looking CI run with no schema change points at the secrets precondition (Section 0.2) or a
silently swallowed repair failure.

**3.2 — Deploy end.** Run:

```
curl -s https://ziko-api-lilac.vercel.app/health
```

and confirm HTTP 200. Then open the Vercel dashboard and confirm the current production deployment's
commit SHA equals the merge commit SHA recorded in Section 1. **A 200 alone only proves the API is
up** — it does not prove which code is running. The SHA match is what proves Phase 4's credit-gate
code (the code that reads `premium_credit_cap_enabled` instead of unconditionally bypassing the
credit gate for `tier='premium'`) is the code actually deployed, not just that some earlier deploy is
still serving traffic.

---

**Both checks in Section 3 must pass before proceeding to any later section of this document.** The
full three-migration confirmation (all three pending migrations, not just the one flag row), the
purge re-check, the waitlist smoke test and cleanup, the legal-liveness gate, and the flag flip all
live in sections 4 through 9, added by plan 06-02 and 06-03. **Do not attempt those from memory if
they are not yet present in this file** — this document is written to be complete for the step it
covers and incomplete on purpose for the steps it doesn't, so that nobody improvises a destructive
step from a planning conversation instead of a written, reviewed procedure.

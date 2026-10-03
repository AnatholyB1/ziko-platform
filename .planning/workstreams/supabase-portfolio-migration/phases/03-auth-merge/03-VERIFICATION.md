---
phase: 03-auth-merge
verified: 2026-10-01T18:00:00Z
status: human_needed
score: 5/6 success criteria verified (SC5 deferred to Phase 6 by design)
overrides_applied: 0
gaps: []
deferred:
  - truth: "Ziko users have been informed that a re-login will be required post-cutover (SC5 / AUTHMIG-05)"
    addressed_in: "Phase 6 - Cutover"
    evidence: "D-12 and 03-VALIDATION Phase Notes: Phase 3 delivers template, live recipient list, send script (dry-run default) and inert in-app surfaces; the send date is chosen in Phase 6"
human_verification:
  - test: "Revoke the two temporary Supabase access tokens in the dashboard (ziko-auth-merge-temp, ziko-auth-merge-temp-2)"
    expected: "Both tokens absent from Account > Access Tokens. The local file scripts/auth-merge/.access-token is already deleted and gitignored."
    why_human: "Dashboard action; 03-12 SUMMARY says the executor did not and could not do it."
  - test: "Phase 6: run 07-notify-relogin.mjs --send with the real cutover date; enable and verify the web banner and mobile alert"
    expected: "Notice delivered to all non-test ziko users; AUTHMIG-05 can then be closed"
    why_human: "External email send and a date decision that belongs to Phase 6 (D-12)"
  - test: "Phase 4: consume scripts/auth-merge/uuid-remap.json when copying data (ea0f0b65... -> 2b6a60fa...)"
    expected: "Every ziko_* row keyed to the source collision UUID is rewritten to the portfolio UUID before FK validation"
    why_human: "Future-phase work. The remap file exists and is correct; its use cannot be checked yet."
  - test: "Phase 6: signup paths pass options.data { app: 'ziko' } (03-PHASE6-HANDOFF.md section 1) and Google OAuth stays disabled or gets a fallback"
    expected: "New ziko signups on portfolio get profile + credits; unflagged signups get none"
    why_human: "Client change that ships in the cutover binary"
---

# Phase 3: Auth Merge Verification Report

**Phase Goal:** Ziko's 39 users exist in portfolio's shared auth pool with IDs preserved and no cross-tenant side effects from shared `auth.users` triggers.
**Verified:** 2026-10-01
**Status:** human_needed (no failed truths; one criterion deferred by design; manual follow-ups listed)
**Re-verification:** No, initial verification

Evidence was gathered from the repo and from live read-only checks. I ran the committed `06-verify.mjs` checks against portfolio (`ubxllsvanurkwkohzxau`), with ziko (`slkobhavpwsubnsmuhya`) as read-only source, through the Supabase CLI session. No Management API was used. Nothing was written to portfolio, ziko or scratch. The first run of two checks hit a transient CLI error; the re-run passed.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 39 ziko users in portfolio, identical UUIDs, working hashes | VERIFIED | Live `--check users`: `ziko=39 imported=38 merged=1 compared=38 mismatched=0`. Live `--check gotrue`: admin lookup for 39 users passes. This covers the earlier HTTP 500, fixed by the user-authorized single-row fill of 4 NULL token columns (3 commits: 10aa08a3, fa441cce, 2b2f8648). 38 users keep their ziko UUID, hash and metadata. 1 collision is merged under the portfolio UUID per D-02 (password filled, `instance_id` filled). The caveat is that the collision user's UUID differs, so literal "identical UUIDs" holds for 38/39. The remap is recorded. |
| 2 | `auth.identities` copied | VERIFIED | Live `--check identities`: `compared=38 collisions=1`. Collision identity re-pointed to the portfolio UUID. Ziko has zero OAuth identities (hand-off section 2), so these are email identities. |
| 3 | Gated triggers fire only for Ziko signups | VERIFIED (accepted split) | Live `--check triggers`: `triggers=2 probe=0 0 0 1 1 1 residual=0`. Unflagged insert makes 0 Ziko rows, flagged insert makes 1/1/1, and the probe rolls back. Gate SQL is tracked: `supabase/portfolio-migrations/20261002090000_portfolio_ziko_auth_gate_functions.sql` and `...090001_..._triggers.sql`. Real GoTrue signups ran on scratch only (03-08: `--check signup` PASS, re-import creates 0 profiles/credits). The ROADMAP wording ("test signup on rh_*/gecko_*") was not literally done on portfolio, per the 03-VALIDATION Phase Notes split that this verification is told to accept. |
| 4 | Portfolio auth config merged additively | VERIFIED | Tracked redacted snapshots: `ubxllsvanurkwkohzxau-before(-apply)` has `uri_allow_list=[]`; `-after` has `["ziko://**","https://ziko-app.com"]`; `site_url` stays `https://sevalys.com` throughout. 03-12 records `--diff` PASS (no removed URIs, no other key changed). I did not re-run `--diff` live because it needs the Management API. I relied on the committed snapshots and diff record. Email templates were not changed; the diff shows all non-allow-list keys equal. |
| 5 | Ziko users informed of re-login | DEFERRED (not passed) | Tooling only: `packages/email/src/templates/ReloginNotice.tsx` (FR/EN), `scripts/auth-merge/07-notify-relogin.mjs` (dry-run default, `--send` explicit, UUID-only log), web banner `ReloginNoticeBanner.tsx` mounted in the coach layout, mobile `reloginNotice.ts` wired in `app/(app)/_layout.tsx`. The dry-run was proven in 03-03 (total=39, to_send=39). No email was sent. By D-12 the send is a Phase 6 task. |
| 6 | `ziko_waitlist_founder_seq` set to ziko live value | VERIFIED | Live `--check sequence`: `sequence equal (87/true)`. The 03-11 summary records portfolio 1/false -> 87/true. |

**Score:** 5/6 verified, 1/6 deferred by design. No FAILED truths.

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `scripts/auth-merge/*.mjs` (00 to 07, lib, rehearsal-seed) plus tests | VERIFIED | Present and substantive. `node --test "scripts/auth-merge/*.test.mjs"` gives 65 pass, 0 fail. |
| `scripts/auth-merge/uuid-remap.json` | VERIFIED | One remap, source `ea0f0b65...` to target `2b6a60fa...`, with `password_filled`, `identity_inserted` and `instance_id_filled` true and `token_columns_filled=4`. No `@` or hash in the file. Tracked, as the Phase 4 input. |
| `scripts/auth-merge/RUNBOOK.md`, `03-PHASE6-HANDOFF.md`, `03-UUID-REMAP-SPEC.md` | VERIFIED | Present. |
| `scripts/auth-merge/baseline/*.json`, `config/*.redacted.json` | VERIFIED | Present and tracked, with no emails, bcrypt hashes or keys. |
| `scripts/auth-merge/sql/trigger-gate-probe.sql` | VERIFIED | Present. It is exercised live by `--check triggers`. |
| Portfolio gate migrations (`supabase/portfolio-migrations/20261002090000/1`) | VERIFIED | Tracked and applied (2 triggers enabled). |

## Behavioral Spot-Checks and Probes

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests | `node --test "scripts/auth-merge/*.test.mjs"` | 65/65 pass | PASS |
| users (live portfolio) | `06-verify --check users` | compared=38 mismatched=0 | PASS |
| identities | `--check identities` | compared=38 collisions=1 | PASS |
| gotrue | `--check gotrue` | admin lookup 39 users | PASS |
| triggers + rolled-back probe | `--check triggers` | 2 triggers, 0/0/0/1/1/1, residual 0 | PASS |
| sequence | `--check sequence` | equal 87/true | PASS |
| tenants regression | `--check tenants --baseline baseline/portfolio-baseline.json --allow-instance-id-fill --allow-token-fill` | baseline users=6, warnings=0 | PASS |

Not re-run: `--check signup` (scratch only, by design) and config `--diff` (Management API; token deleted).

## Secrets and PII

- Tracked `scripts/auth-merge` and the workstream planning tree contain no bcrypt hashes, `sbp_`/`eyJ`/`sb_secret_`/`re_` keys, or real email addresses. The only match is a `%@ziko.test` LIKE pattern in a Phase 2 plan.
- `scripts/auth-merge/.access-token` is absent and gitignored (`.gitignore:44`).
- `uuid-remap.json` holds UUIDs only.

## Requirements Coverage (correct status for REQUIREMENTS.md)

| Requirement | Evidence | Correct status | Currently in file |
|-------------|----------|----------------|-------------------|
| AUTHMIG-01 | SC1 verified live | Complete (correct, though it was ticked early by an executor and is now justified) | `[x]` / Complete |
| AUTHMIG-02 | SC2 verified live | Should be Complete | `[ ]` / Pending |
| AUTHMIG-03 | SC3 verified live (probe) plus scratch signup | Should be Complete | `[ ]` / Pending |
| AUTHMIG-04 | SC4 snapshots and diff | Complete (correct, though ticked early and now justified) | `[x]` / Complete |
| AUTHMIG-05 | Tooling only, nothing sent | Must stay Pending (partial); close only after the Phase 6 send | `[ ]` / Pending |

The orchestrator should tick AUTHMIG-02 and AUTHMIG-03 in both the checklist and the traceability table. AUTHMIG-05 stays open. I did not edit REQUIREMENTS.md.

## State and Roadmap Consistency

- ROADMAP: Phase 3 has `[x]`, "13 plans", progress table `13/13 Complete 2026-10-01`, and all 13 plan lines are `[x]`. 13 PLAN and 13 SUMMARY files exist. This is consistent.
- STATE.md has stale fields that need a cleanup. Frontmatter says `status: executing` and `stopped_at: Phase 3 context gathered`. The body says "Phase 3 (Auth Merge) - EXECUTING, Plan 13 of 13, Ready to execute". The counts (22/22 plans, 3/7 phases) are fine. The first two should become "phase complete / verified" once the human items below are acknowledged. Not a blocker.
- Open blocker in STATE: the 03-11 "NULL token columns" line is now resolved and could be moved out of Blockers.

## Anti-Patterns

No unreferenced TBD/FIXME/XXX debt markers were found in the phase's `scripts/auth-merge` files (not exhaustively audited beyond the secret and PII greps). `deferred-items.md` notes a pre-existing tsc error in `apps/web test/purge`, outside this phase.

## Human Verification Required

1. Revoke the dashboard tokens `ziko-auth-merge-temp` and `ziko-auth-merge-temp-2` (the local file is already deleted).
2. Phase 6: perform the re-login notice send (SC5 / AUTHMIG-05) and the `app: 'ziko'` signup-flag changes.
3. Phase 4: use `uuid-remap.json` for the collision UUID.

## Gaps Summary

No gaps. Every criterion is verified or explicitly deferred by design. Open items are the dashboard token revocation, the Phase 6 send, the Phase 4 remap use, and the REQUIREMENTS.md and STATE.md bookkeeping above.

---

_Verified: 2026-10-01_
_Verifier: Claude (gsd-verifier)_

---
phase: 05-storage-migration
verified: 2026-10-02T20:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (SC4 with a documented, handed-off scope limit)
overrides_applied: 0
re_verification: false
gaps: []
deferred:
  - truth: "6 backend routes behind the deferred table-name codemod and 10 UI-level flows were not exercised under real sessions on portfolio"
    addressed_in: "Phase 6 (Cutover)"
    evidence: "ROADMAP Phase 6 'Carried from Phase 5 (explicit smoke-test items)', STATE.md and HANDOFF.json (17 items)"
human_verification:
  - test: "Revoke the PAT `ziko-storage-phase5` at https://supabase.com/dashboard/account/tokens and record 'revoked'"
    expected: "Token no longer listed. The local token file is deleted, but 05-11-SUMMARY records revocation as PENDING."
    why_human: "Dashboard action; not verifiable from the repo."
  - test: "Judge deviation: harness fix a1c2c7cc made after the typed authorization without a new checkpoint:decision"
    expected: "Accept (recommended) or reject. If accepted, optionally record an override."
    why_human: "Process-compliance decision belongs to the plan owner."
---

# Phase 5: Storage Migration Verification Report

**Goal:** All ziko storage buckets and objects exist in portfolio, fully functional under real authenticated sessions.
**Status:** passed. Every must-have is evidenced and there are no code gaps. Human items resolved 2026-10-02: PAT ziko-storage-phase5 revoked in the dashboard; user accepted the a1c2c7cc harness-fix deviation (typed: accept).
**Re-verification:** No (initial).

## Evidence basis (read this first)

No portfolio credential was available to the verifier. The Management API token file was deleted on purpose and was not recreated. The live portfolio state was therefore not re-queried. Portfolio and scratch results rest on the committed PII-safe reports in `scripts/portfolio-migration/reports/`. Those reports were produced by the phase's own scripts, so they are the executor's evidence and not an independent re-run. I did independently run the unit tests, read the code and policy migration, and grep the repo and history for secrets. The committed reports are internally consistent with each other and with the SUMMARY numbers.

## Observable Truths (ROADMAP Phase 5 success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All buckets exist on portfolio as `ziko-<id>` with identical config (live count 10 governs; roadmap says 9) | VERIFIED | `portfolio-storage-verify.json` `buckets`: 10 source and 10 `ziko-` on target, 0 missing, 0 config mismatches, 0 target-only. D-01 config is read live from ziko. |
| 2 | Object count and checksums match source and destination | VERIFIED | `objects`: 2699 vs 2699 and 214,205,001 vs 214,205,001 bytes, 0 missing/size/content-type mismatches. `hashes`: 2699 hashed both sides, no sampling, 0 mismatched. `rekey`: 36 of 36 under the target UUID, 0 left under the source UUID. `urls`: 0 leftover tables, 3 rewritten = 3. `portfolio-storage-copy.json`: failed=0, dest_only=0. |
| 3 | Storage RLS policies rebuilt and enforce the same per-user access | VERIFIED | The migration `supabase/portfolio-migrations/20261002160000_portfolio_ziko_storage_policies.sql` has 25 CREATE POLICY statements (D-03). `policies`: 25/25 match, 0 stale. `tenants`: 7 non-ziko buckets and 17 non-ziko policies unchanged. Behavior is evidenced by the allow/deny matrix (cross-user deny cases passed on portfolio). |
| 4 | Signed-URL upload/download works under real authenticated (non-service-role) sessions, per plugin | VERIFIED (scope-limited by design) | Scratch full matrix: pass 50, fail 0, deferred 6, missing 0. Portfolio smoke (D-10, read-only): pass 16, fail 0, deferred 0, missing 0, across 8 buckets and 5 surfaces (mobile-profile, web-coach, plugin-coach, plugin-nutrition, backend). Throwaway users were cleaned up (asserted 0). |

Score: 4/4.

SC4 limit, stated honestly: 6 backend routes that depend on the not-yet-merged table-name codemod were "deferred" on scratch. They are `/coach/clients/links/me`, the three `/coach/videos` routes, `/coach/exercises/:id/media-url` and `POST /coach/imports`. Portfolio ran a smaller smoke by design (D-10), so `ziko-coach-videos`, `ziko-exports` and mutating uploads were not re-exercised on portfolio. D-10 explicitly allows this: "portfolio: a smaller read-only check", with UI flows deferred to Phase 6. All 17 items are recorded in the Phase 6 ROADMAP block, STATE and HANDOFF. They are legitimately deferred (Phase 6 smoke) and do not block Phase 5. Nothing for them was falsely marked as passed.

## Decisions D-01..D-10

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 live bucket config | Honored | `buckets` check, 0 config mismatches. |
| D-02 profile-photos quirk | Honored | Copied as-is (the smoke records a `baseline-public-url` case) and carried as a residual note. |
| D-03 policies | Honored | 25 `ziko_`-prefixed policies, applied before the copy, stale check 0. |
| D-04 codemod built, not merged | Honored | The patch, manifest and unmerged branch `gsd/phase-5-bucket-codemod` exist, and the tree is clean. No app code changed on main (`git diff` of backend/apps/plugins/packages over the final plan commits is empty). |
| D-05 in-flight URL rewrite | Honored | The loader reported `url_rewrites` 3 and the verify `urls` check passed. |
| D-06 Node `.mjs` transport, re-key | Honored | `08-copy-storage.mjs` is idempotent. 36 re-keyed objects are verified. |
| D-07 add-only | Honored | No remove/delete path in `08`, and `lib-storage` has a `.remove(` forbidden-pattern guard. Target writes are restricted to `^ziko-` by `assertTargetBucket`. dest_only=0. |
| D-08 scratch then typed checkpoint, retire creds | Honored for the typed phrase and scratch rehearsal. The token file was deleted locally. Dashboard revocation is pending, see human items. |
| D-09 full checks, no sampling, PII-safe | Honored | All 2699 objects hashed. The reports contain only masked UUIDs and no emails. |
| D-10 scratch full plus portfolio smoke | Honored | See SC4. |

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| STORAGE-01 buckets (10, not 9) | SATISFIED | SC1. |
| STORAGE-02 copy with count/checksum | SATISFIED | SC2. |
| STORAGE-03 storage policies | SATISFIED | SC3. |
| STORAGE-04 authenticated flows per plugin | SATISFIED, subject to the Phase 6 hand-off above | SC4. |

No orphaned requirements. The REQUIREMENTS.md "9 buckets" wording is stale (live is 10, and ROADMAP and CONTEXT already note this). This is cosmetic.

## Safety checks

- No writes to ziko: the ziko role is only used to list and download. The `--generate` and `--check` paths of `07` are read-only, and the `08` write path asserts a `ziko-` target. This was established by code reading and the reports, not a live audit.
- `rh_*`/`gecko_*` untouched: the `tenants` checks passed on both storage (7 buckets, 17 policies) and data (39 tables, 0 deltas).
- Token never committed: `git grep "sbp_"` finds only regex/gate text in plan files and a pre-existing test fixture. No `sbp_` plus 20 or more characters credential appears in the tree. `git log -S/-G` on history matched only two earlier commits (04-03 and 02-02), and `git show` on them found no token. `scripts/auth-merge/.access-token` and `.tmp-*` are not tracked, and `git ls-files` shows no such files.
- Unit tests: `node --test "scripts/portfolio-migration/*.test.mjs"` gave 197 tests, 197 pass, 0 fail.

## Judgement on the orchestrator-reported deviation (a1c2c7cc)

The commit is a 3-line change: `await res.arrayBuffer().catch(() => undefined)` after two read-only public fetches. The root cause was reproduced with a probe, the change was validated on scratch (pass 50, fail 0), and it adds no new write class or permission. It does not weaken any assertion, because it only drains bodies.

It was nonetheless a process breach. The plan required a new checkpoint for any code change after typed authorization, and none was obtained. The author disclosed this in the SUMMARY. I classify it as a WARNING, not a BLOCKER:

- The outcome is not impaired, and the risk was low and bounded.
- Cost: the interrupted launches left 4 temporary test users each on the shared auth pool until cleaned. The cleanup was by `ziko-storage-test-*` email prefix, and the final count of 0 was verified.
- The deleted users' trigger-created `ziko_` rows were removed with them, and post-smoke tenant verification was green.

Recommendation: accept it, and have the user record the acceptance. Future plans should state explicitly that a harness-only fix needs no checkpoint.

## Anti-patterns

None blocking. A scan of the touched phase files found no TBD/FIXME/XXX debt markers and no stubs. Known caveats are all documented: `created_at` is reset on copied objects, so the scan-photos 90-day cleanup clock restarts, and the CDN may serve an already-read response to a revoked coach.

## Human Verification Required

1. **Revoke PAT `ziko-storage-phase5`.** Go to the Supabase dashboard account tokens page and revoke it, then record "revoked". The file is deleted locally but the token stays valid until revoked.
2. **Accept or reject the a1c2c7cc deviation.** Recommended: accept.

## Gaps Summary

No blocking gaps. Phase 5 delivers the goal for the storage layer. Both human items are now resolved (token revoked; deviation a1c2c7cc accepted by the user), so the status is `passed`.

---
_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_

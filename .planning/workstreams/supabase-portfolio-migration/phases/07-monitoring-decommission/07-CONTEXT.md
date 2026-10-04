# Phase 7: Monitoring & Decommission - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Retire and delete the `ziko` Supabase project. Deletion happens only after: a write-freeze, a full cold backup proven restorable, a full per-table/per-bucket verification (no sampling) of frozen ziko vs portfolio, and a separate explicit human confirmation. Deletion is the final, logged action of the milestone.

Requirements: DECOM-01..05. Out of scope: any new feature, the iOS release, the cron fix, the Anthropic balance (all deferred, see below).

**User waiver (2026-10-04):** the rollback window (DECOM-01 as written: kept live for a window tied to mobile binary renewal) is WAIVED. Rationale: no real mobile users yet, 39 ziko profiles, 0 new accounts since the flip. Deletion may happen the same day once everything is clean.

</domain>

<decisions>
## Implementation Decisions

### Rollback window & read-only
- **D-01:** No rollback window. DECOM-01 is recorded as `WAIVED by user` (not "done"), with the rationale above. Do not mark it satisfied in REQUIREMENTS.md; mark it waived. The earlier "fixed 14 days" answer was superseded by this decision during discussion.
- **D-02:** A brief **write-freeze** on ziko still happens, immediately before the backup, so the backup and verification see one frozen, consistent state. Enforced by `REVOKE INSERT/UPDATE/DELETE` on the ziko `public` schema (reversible with `GRANT`) for the app-facing roles. Reads and rollback stay possible until deletion. Old binaries hitting ziko get a clear error (consistent with the hard cut of Phase 6 D-02).
- **D-03:** No 24-48h post-backup freeze period and no Supabase pause (plan-tier support unverified, and a pause would remove the instant-rollback path). Deletion can follow the same day.
- **D-04:** No fixed monitoring regime. The gate is the verification in D-10..D-12, not elapsed time. Stragglers on old binaries are accepted (Phase 6 D-02 hard cut stands); write attempts rejected by the freeze are not a blocker.

### Cold backup & restore proof
- **D-05:** Backup scope is **full**: `pg_dump` of the whole ziko DB (public + auth schemas, roles/grants), a full storage export of every ziko bucket with checksums, and a manifest (function/trigger/RLS inventory, extension and Postgres versions, env/config key names WITHOUT secret values).
- **D-06:** Storage: **encrypted archive outside the repo (never committed) plus a second off-machine copy** (e.g. Google Drive or external disk). Only the manifest and checksums are committed to the repo. The backup contains PII of 39 users: encryption is mandatory, and a passphrase must not land in the repo or logs.
- **D-07:** Restorability proof: restore the dump into the **existing scratch project** (wiped first), then run `06-verify-data` (row counts/checksums vs ziko) and `09-verify-storage` against the restored data, and re-upload exported storage objects with checksum compare. The scratch project is deleted afterwards (see D-14).
- **D-08:** Retention after deletion: **keep indefinitely, review at 6 months** (it is the only copy of the original ziko state; revisit GDPR retention at the review).

### Full verification gate
- **D-09:** Basis of comparison: **frozen ziko vs portfolio, accounting for post-flip writes**. Every ziko table and bucket is compared to its `ziko_*` counterpart. A difference is acceptable only when explained as a post-flip write on portfolio (portfolio >= ziko by an expected delta). Nothing present only on ziko may be missing from portfolio. Zero unexplained gaps = pass.
- **D-10:** Coverage is every `ziko_*` table and every ziko bucket, no sampling (DECOM-03). Reuse `scripts/portfolio-migration/06-verify-data.mjs`, `09-verify-storage.mjs`, and `scripts/auth-merge/06-verify.mjs` plus the integrity checks (RLS 99/99, triggers, FK 144, orphans 0) as the baseline.
- **D-11:** **Blockers:** any data or storage gap (rows/objects missing in portfolio), orphan FKs, or RLS disabled/regressed, and any unexplained `rh_`/`gecko_` regression. **Not blockers:** waived mobile device checks, the empty Anthropic balance, `sv_*` (Sevalys) live-traffic drift (not ours, verify only that it is not a ziko regression).

### Carried items & deletion protocol
- **D-12:** Must be resolved BEFORE deletion: (a) **env scopes still on ziko** — Preview/Development Vercel scopes of shared web records and `SUPABASE_PUBLISHABLE_KEY` on ziko-web; (b) **scratch project + stale CI token** — delete the scratch project after the restore proof, revoke `ziko-ci-portfolio` (keep `ziko-ci-portfolio-2`), repoint CI verify secrets off scratch (PR #40 follow-up).
- **D-13:** **Deferred as non-blocking** (carried to milestone close-out): API crons returning 401 (CRON_SECRET/Bearer mismatch, pre-existing), iOS release (Sign in with Apple in provisioning profile), Play Console confirmation of Android 1.5.0, Anthropic balance / AI chat never verified on portfolio, orphan test PNG in `ziko-coach-exercises`.
- **D-14:** **Credential retirement (06-20 Task 3) happens AFTER deletion**, not before: Claude needs a PAT to call the delete API. Order: delete ziko -> delete `.access-token`, bypass file, tmp storage-copy file -> user revokes PAT `ziko-cutover-phase6` and rotates the Vercel bypass -> user replies `revoked`.
- **D-15:** **Confirmation = a plain, explicit "yes" at its own dedicated checkpoint** (DECOM-04), asked only after the user has seen the backup-restore proof and the verification report, in a separate step from the cutover/backup sign-offs. It is never bundled with an earlier approval. (The user chose the simple yes over a typed phrase; this is lighter than Phase 6's typed-phrase pattern.)
- **D-16:** **Claude performs the deletion via the Supabase Management API** after the D-15 "yes", then confirms the project is gone via the API and writes the deletion log (timestamp, project ref, evidence pointers to backup manifest and verification report) as the final action of the milestone (DECOM-05). Because deletion is irreversible and outward-facing, the planner must make the delete task fail closed: it only runs if every gate (backup restored, verification pass, D-12 items done, D-15 yes) is recorded as passed, and it targets the ziko project ref explicitly (never portfolio).

### Claude's Discretion
- Exact freeze mechanism details (which roles, the exact GRANT/REVOKE statements), as long as it is reversible and leaves reads working.
- Archive format, encryption tool, and file layout of the backup; naming of the verification report.
- Whether the delete call goes through the Management API directly or an existing helper in `scripts/`, provided D-16's fail-closed gating holds.
- Whether the post-flip delta explanations (D-09) are computed from a timestamp column or from a final delta snapshot.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and requirements
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 7 goal and success criteria 1-5 (criterion 1 is waived by D-01); Phase 6 status block and carried items
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — DECOM-01..05 (DECOM-01 to be marked WAIVED, not done)
- `.planning/workstreams/supabase-portfolio-migration/STATE.md` — accumulated decisions, pending todos, blockers (including the unverified pause/plan-tier concern, now moot per D-03)
- `.planning/PROJECT.md` — milestone core value: delete ziko only after explicit, separate confirmation

### Prior phase context and hand-off
- `.planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-CONTEXT.md` — D-02 (hard cut for old binaries), D-10 (rollback = revert env + redeploy, ziko authoritative until Phase 7)
- `.planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-20-SUMMARY.md` — Phase 7 hand-off, open items, credential-retirement Task 3, file paths to delete
- `.planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-AUTHORIZATIONS.md` — typed-phrase authorization log pattern from Phase 6
- `.planning/HANDOFF.json` — key `phase7_handoff_from_phase6` (backend_flip_at, web_flip_at, ziko_untouched, 12 open items)
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` and `SUMMARY.md` — decommission and rollback-window pitfalls from research

### Operational docs and evidence
- `scripts/portfolio-migration/RUNBOOK.md` — migration runbook (section 6.7 "As executed"); Phase 7 runbook section goes here
- `scripts/auth-merge/RUNBOOK.md` — auth merge runbook
- `scripts/portfolio-migration/reports/portfolio-cutover-final.json` — final tenant regression evidence (PII-free)
- `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` — pre-cutover tenant baseline (currently untracked)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/portfolio-migration/06-verify-data.mjs` (+ `lib-data.mjs`, `lib-verify.mjs`): per-table row-count/checksum/integrity verification, `--check tenants` mode. Base for D-09/D-10 and the restore proof D-07.
- `scripts/portfolio-migration/09-verify-storage.mjs` (+ `lib-storage.mjs`): per-bucket object verification and tenant policy regression check.
- `scripts/portfolio-migration/08-copy-storage.mjs`: storage copy logic; its listing/download code is the starting point for the storage export in D-05.
- `scripts/auth-merge/06-verify.mjs`: auth tenant verification.
- `scripts/portfolio-migration/lib-conn.mjs`, `lib-cutover.mjs`: connection and cutover helpers (PAT handling, env audit).
- `scripts/portfolio-migration/17-env-switch.mjs`: audited env matrix, usable to inspect/repoint the leftover Vercel scopes in D-12(a).
- `scripts/portfolio-migration/16-ci-migration-guard.mjs`, `portfolio-migrations.watermark`: CI guard, relevant to repointing CI verify secrets.

### Established Patterns
- Numbered scripts (`NN-name.mjs`) with a sibling `.test.mjs`, fail-closed scans, PII-free JSON reports under `scripts/portfolio-migration/reports/`.
- Typed-phrase / explicit-checkpoint authorizations logged in a phase `*-AUTHORIZATIONS.md`; secrets never written to docs (grep gate for `@`, UUIDs, JWT fragments).
- Planning docs edited by hand where `gsd-sdk` handlers would overstate completion; CRLF newlines preserved.

### Integration Points
- **Project refs (CORRECTED 2026-10-04; an earlier draft wrongly named the portfolio ref as ziko):** ziko = `slkobhavpwsubnsmuhya`, portfolio = `ubxllsvanurkwkohzxau`, scratch = `rkirvurggtgjlkeuhded` (source of truth: `PROJECTS` in `scripts/auth-merge/lib.mjs`; `supabase/.temp/linked-project.json` confirms name `ziko`). The delete step MUST take refs only from `PROJECTS`, refuse portfolio and scratch, and verify `GET /v1/projects/{ref}` returns name `ziko` immediately before deleting.
- **Research-driven adjustments (Claude's discretion, no change to user decisions):** (1) ziko is a Vercel Marketplace-managed project (org slug `vercel_icfg_*`), so API delete may be refused; the plan needs an early read-only probe and a dashboard-deletion fallback (user clicks, Claude verifies and logs). (2) No pg_dump/psql/Docker on this machine: install PostgreSQL client tools via a human-gated step and add a pure-Node COPY export as an independent second data layer. (3) Existing verifiers need a new delta-aware verifier for D-09 (every ziko PK must exist in portfolio); never re-run `13-cutover-delta --apply` or `05-load-data --apply` (they TRUNCATE ziko_* tables and would wipe post-flip data). (4) D-07 restore proof verifies same-name tables on scratch (restored data is unprefixed), not literally `06-verify-data`. (5) The freeze snapshots grants for exact `--unfreeze`, disables signups, and its real gate is identical table/object snapshots before and after the backup (SECURITY DEFINER functions, GoTrue and Storage bypass REVOKE). (6) Scratch must be fully wiped (DB, auth, storage) before the restore proof. (7) CI verify secrets must be repointed before scratch is deleted; default to disabling those CI steps rather than pointing fixtures at shared portfolio.
- Vercel (API + ziko-web projects) env scopes, GitHub Actions secrets (CI verify secrets, `ziko-ci-portfolio-2`), Supabase account tokens page (PAT revocation).

</code_context>

<specifics>
## Specific Ideas

- The user wants speed: "we can delete today if everything is clean". The plan should be a short, linear sequence (freeze -> backup -> restore proof -> full verify -> env/CI cleanup -> confirmation checkpoint -> delete -> credential retirement -> log), not a long monitoring period.
- The deletion log is the last action of the milestone.

</specifics>

<deferred>
## Deferred Ideas

- API crons returning 401 (CRON_SECRET / Bearer mismatch on the API project) — milestone close-out
- iOS release: enable Sign in with Apple on the App ID, regenerate provisioning profile, tag v1.5.2 — milestone close-out
- Play Console confirmation of Android 1.5.0 (versionCode 16) — milestone close-out
- Anthropic balance empty; AI chat never verified on portfolio — milestone close-out
- Orphan test PNG in `ziko-coach-exercises` — housekeeping (that bucket goes away with ziko; confirm it was not migrated)
- Backup retention review at 6 months (GDPR) — future reminder

</deferred>

---

*Phase: 7-Monitoring & Decommission*
*Context gathered: 2026-10-04*

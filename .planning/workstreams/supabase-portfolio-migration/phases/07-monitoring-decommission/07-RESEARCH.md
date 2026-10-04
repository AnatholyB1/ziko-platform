# Phase 7: Monitoring & Decommission - Research

**Researched:** 2026-10-04
**Domain:** Supabase project retirement (write-freeze, cold backup, restore proof, frozen-vs-portfolio verification, irreversible Management API delete) on Windows with no pg_dump/Docker
**Confidence:** MEDIUM (repo facts HIGH; Windows pg_dump-through-pooler and freeze coverage of SECURITY DEFINER / GoTrue / Storage writes are ASSUMED and must be probed in Wave 0)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** No rollback window. DECOM-01 is recorded as `WAIVED by user` (not "done"), with the rationale (no real mobile users yet, 39 ziko profiles, 0 new accounts since the flip). Do not mark it satisfied in REQUIREMENTS.md; mark it waived. The earlier "fixed 14 days" answer was superseded.
- **D-02:** A brief **write-freeze** on ziko still happens, immediately before the backup, so backup and verification see one frozen, consistent state. Enforced by `REVOKE INSERT/UPDATE/DELETE` on the ziko `public` schema (reversible with `GRANT`) for the app-facing roles. Reads and rollback stay possible until deletion. Old binaries hitting ziko get a clear error.
- **D-03:** No 24-48h post-backup freeze period and no Supabase pause. Deletion can follow the same day.
- **D-04:** No fixed monitoring regime. The gate is the verification in D-10..D-12, not elapsed time. Stragglers on old binaries accepted; write attempts rejected by the freeze are not a blocker.
- **D-05:** Backup scope is **full**: `pg_dump` of the whole ziko DB (public + auth schemas, roles/grants), a full storage export of every ziko bucket with checksums, and a manifest (function/trigger/RLS inventory, extension and Postgres versions, env/config key names WITHOUT secret values).
- **D-06:** Storage: **encrypted archive outside the repo (never committed) plus a second off-machine copy**. Only manifest and checksums are committed. Backup contains PII of 39 users: encryption mandatory; passphrase must not land in repo or logs.
- **D-07:** Restorability proof: restore the dump into the **existing scratch project** (wiped first), then run `06-verify-data` and `09-verify-storage` against restored data, and re-upload exported storage objects with checksum compare. Scratch deleted afterwards (D-14 ref in CONTEXT; see D-12b).
- **D-08:** Retention after deletion: **keep indefinitely, review at 6 months**.
- **D-09:** Basis of comparison: **frozen ziko vs portfolio, accounting for post-flip writes**. Every ziko table and bucket compared to its `ziko_*` counterpart. A difference is acceptable only when explained as a post-flip write on portfolio (portfolio >= ziko by an expected delta). Nothing present only on ziko may be missing from portfolio. Zero unexplained gaps = pass.
- **D-10:** Coverage is every `ziko_*` table and every ziko bucket, no sampling (DECOM-03). Reuse `06-verify-data.mjs`, `09-verify-storage.mjs`, `scripts/auth-merge/06-verify.mjs` plus integrity checks (RLS 99/99, triggers, FK 144, orphans 0) as baseline.
- **D-11:** **Blockers:** any data/storage gap (rows/objects missing in portfolio), orphan FKs, RLS disabled/regressed, any unexplained `rh_`/`gecko_` regression. **Not blockers:** waived mobile device checks, empty Anthropic balance, `sv_*` live-traffic drift.
- **D-12:** Must be resolved BEFORE deletion: (a) env scopes still on ziko (Preview/Development Vercel scopes of shared web records, `SUPABASE_PUBLISHABLE_KEY` on ziko-web); (b) delete scratch project after restore proof, revoke `ziko-ci-portfolio` (keep `ziko-ci-portfolio-2`), repoint CI verify secrets off scratch (PR #40 follow-up).
- **D-13:** Deferred non-blocking: API crons 401, iOS release, Play Console confirmation, Anthropic balance, orphan test PNG in `ziko-coach-exercises`.
- **D-14:** Credential retirement (06-20 Task 3) happens AFTER deletion. Order: delete ziko -> delete `.access-token`, bypass file, tmp storage-copy file -> user revokes PAT `ziko-cutover-phase6` and rotates the Vercel bypass -> user replies `revoked`.
- **D-15:** Confirmation = a plain, explicit "yes" at its own dedicated checkpoint (DECOM-04), asked only after the user has seen the backup-restore proof and the verification report, separate from earlier sign-offs. Never bundled.
- **D-16:** Claude performs deletion via the Management API after the D-15 "yes", confirms the project is gone via the API, writes the deletion log (timestamp, project ref, evidence pointers) as the final action of the milestone (DECOM-05). Delete task must fail closed: only runs if every gate is recorded passed, and it targets the ziko project ref explicitly (never portfolio).

### Claude's Discretion
- Exact freeze mechanism details (roles, exact GRANT/REVOKE), as long as reversible and reads keep working.
- Archive format, encryption tool, file layout of the backup; naming of the verification report.
- Whether delete goes through the Management API directly or an existing helper in `scripts/`, provided D-16 fail-closed gating holds.
- Whether post-flip delta explanations (D-09) are computed from a timestamp column or a final delta snapshot.

### Deferred Ideas (OUT OF SCOPE)
- API crons 401; iOS release (Sign in with Apple); Play Console confirmation of Android 1.5.0; Anthropic balance / AI chat on portfolio; orphan test PNG in `ziko-coach-exercises`; backup retention review at 6 months.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECOM-01 | ziko kept live read-only for a rollback window | WAIVED by D-01. Record `WAIVED by user` in REQUIREMENTS.md/traceability; the freeze (section Freeze) still gives read-only state during the backup and verify steps |
| DECOM-02 | Cold backup (pg_dump + storage export) confirmed restorable | Backup tooling gap (no pg_dump/Docker), scoop `postgresql` 18.4, node `pg-copy-streams` fallback, 7-Zip AES / gpg, restore into scratch, new restore-verify script |
| DECOM-03 | Complete per-table/per-bucket checklist | Existing 06/09 scripts cover counts/integrity but assert strict equality; new delta-aware mode needed (PK-subset gate) |
| DECOM-04 | Explicit separate confirmation before irreversible deletion | Dedicated checkpoint, gate-file design, `07-AUTHORIZATIONS.md` entry |
| DECOM-05 | ziko deleted only after all items validated | `DELETE /v1/projects/{ref}` (scope `projects:write` / `project_admin_write`), fail-closed gate script, post-delete GET 404 confirmation |
</phase_requirements>

## Summary

**CRITICAL FACT-CHECK (blocks the whole phase if missed):** CONTEXT.md "Integration Points" says the ziko project ref `ubxllsvanurkwkohzxau` "appears in the leftover tmp file name". That ref is the **PORTFOLIO** project, not ziko. `[VERIFIED: scripts/auth-merge/lib.mjs PROJECTS]`: ziko = `slkobhavpwsubnsmuhya`, portfolio = `ubxllsvanurkwkohzxau`, scratch = `rkirvurggtgjlkeuhded`. The leftover file `.tmp-storage-copy-ubxllsvanurkwkohzxau.json` is named after the copy TARGET (portfolio) by `08-copy-storage.mjs` (`.tmp-storage-copy-${run.targetRef}.json`). Corroborated by `supabase/.temp/project-ref` + `linked-project.json` (= `slkobhavpwsubnsmuhya`, name `ziko`), RUNBOOK `--source-ref slkobhavpwsubnsmuhya` / `--project-ref ubxllsvanurkwkohzxau --confirm-ref ubxllsvanurkwkohzxau`, and `DEFAULT_PHRASE` in 13-cutover-delta. Deleting `ubxllsvanurkwkohzxau` would destroy the shared portfolio (rh_*, gecko_*, sv_*, and all migrated ziko data). The delete script must hard-code the ziko ref from `PROJECTS.ziko`, refuse `PROJECTS.portfolio` and `PROJECTS.scratch`, and double-check by `GET /v1/projects/{ref}` returning name `ziko` (linked-project.json shows name `ziko`) before the call.

The environment has no `pg_dump`, `pg_restore`, `psql` or Docker. `supabase db dump` shells pg_dump inside a Docker container, so it is unusable here. Available: Node (+ `pg`, `pg-copy-streams` already installed), 7-Zip (scoop), gpg, openssl, Supabase CLI 2.116.0 (via npx), Vercel CLI 59.24.0 (logged in as anatholyb1), `gh`. No `age`, no `eas`. Recommended: install the PostgreSQL client tools through scoop (`postgresql` 18.4 in main bucket, newer than ziko Postgres 17.6.1.084, which is fine for dumping) in Wave 0, with a pure-Node COPY-based data export as a second, independent layer.

The existing verify suite is built for scratch/portfolio vs ziko with strict count equality; after the flip portfolio legitimately diverges. D-09 therefore needs a new delta-aware verifier (primary-key subset gate) rather than re-running `06-verify-data --check counts`, which will fail on any post-flip write. Also: re-running `13-cutover-delta --apply` / `05-load-data --apply` now is dangerous (guarded TRUNCATE of the 99 `ziko_*` tables would wipe post-flip portfolio writes).

**Primary recommendation:** Linear plan: pre-flight ref/gate scaffolding (new `18-decom-*.mjs` scripts with tests) -> freeze (grant snapshot first) -> measured-freeze proof -> backup (pg_dump -Fc + COPY layer + storage export + manifest, 7-Zip AES-256 encrypted, second copy) -> wipe scratch (DB + auth + storage) and restore -> restore-verify -> delta-aware verify ziko vs portfolio -> env/CI cleanup -> D-15 checkpoint -> fail-closed delete -> post-delete confirm -> credential retirement -> deletion log.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Write-freeze | Database (grants on ziko) | Auth config (disable signup via Management API) | Privileges are the only DB-enforced, reversible lever; GoTrue/Storage write through their own roles |
| Cold backup + checksum + encryption | Local operator workstation (Node/pg tools) | Off-machine copy | No server-side backup path on this plan; archive must stay out of git |
| Restore proof | Scratch Supabase project | Local verify scripts | Existing scratch is the only throwaway target |
| Frozen-vs-portfolio verification | Local Node scripts via `supabase db query` / pooler | Storage API (hash download) | Reuses runSql/getProjectApiKeys patterns |
| Env/CI scope cleanup | Vercel (API+web projects), GitHub Actions, EAS | Local env files | These are where ziko values may still live |
| Deletion | Supabase Management API | Vercel Marketplace (cleanup) | Irreversible; org is Vercel-managed |

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Node ESM `.mjs` scripts + `node:test` | Node 20+ (installed) | New `18-*.mjs` scripts and sibling `.test.mjs` | Established repo pattern (`NN-name.mjs` + test) `[VERIFIED: repo]` |
| `pg` + `pg-copy-streams` | already in node_modules | Direct SQL and COPY TO STDOUT export / COPY FROM STDIN restore | Already used by `05-load-data.mjs` `[VERIFIED: repo]` |
| `lib-conn.mjs` (`connectClient`, `createLoginRole`, `getSessionPooler`) | repo | Short-lived `cli_login_postgres` role via `POST /v1/projects/{ref}/cli/login-role`, session pooler 5432, TLS on, `SET ROLE postgres` (BYPASSRLS) | Existing credential-safe connection layer `[VERIFIED: repo]` |
| `runSql(ref, sql)` from `scripts/auth-merge/lib.mjs` | repo | `npx supabase db query --linked --project-ref <ref> --file` | Needs no DB password; multi-statement; returns last statement rows `[VERIFIED: repo]` |
| PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) | scoop `postgresql` 18.4 | Real `pg_dump -Fc` for D-05 | Missing today; `scoop search postgresql` shows 18.4 in main `[VERIFIED: scoop search]` — install is a Wave 0 task |
| 7-Zip (`7z`) | 26.01 (scoop) | AES-256 encrypted archive, `-mhe=on` encrypts file names | Installed `[VERIFIED: scoop list]` |
| `sha256` via `node:crypto` | built-in | Per-object / per-file checksums | `sha256Hex` in lib-storage `[VERIFIED: repo]` |

### Supporting
| Tool | Version | Purpose | When to Use |
|---|---|---|---|
| gpg | /usr/bin/gpg (Git Bash) | Alternative symmetric AES256 (`--symmetric --cipher-algo AES256`) | If 7z unsuitable; passphrase via `--passphrase-fd`, never argv |
| Vercel CLI | 59.24.0, logged in | `vercel env ls/pull` per environment, `vercel link --cwd <tmp>` | D-12a scope audit (pattern from 17-env-switch verify-remote) |
| `gh` | installed | `gh secret list/set`, `gh run` | D-12b CI secrets repoint |
| Supabase CLI | 2.116.0 (2.119.0 available) | `projects delete`/`api-keys`, login | Optional; Management API fetch is used by lib-conn already |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| scoop `postgresql` (pg_dump) | Docker Desktop + `supabase db dump` | Docker absent, heavy install; rejected |
| scoop `postgresql` | Pure-Node COPY export only | No DDL/roles fidelity, not a "pg_dump"; keep only as complementary data layer / fallback |
| 7-Zip AES | `age` | `age` not installed; 7z already present; passphrase must be fed non-interactively (see pitfalls) |

**Installation (Wave 0, human-gated env change):**
```bash
scoop install postgresql    # provides pg_dump/pg_restore/psql 18.x (server binaries are installed but never started)
pg_dump --version
```

**Version verification:** `scoop search postgresql` -> 18.4 (main). ziko Postgres = `17.6.1.084` `[VERIFIED: supabase/.temp/postgres-version]`. pg_dump >= server major is required; 18 >= 17 OK. `[ASSUMED]` that restore of a 18-produced custom-format dump into scratch (check scratch major; the Phase 1 parity check says projects match 17.x) works: pg_restore of newer-format archives into an older server can emit `SET` errors for unknown GUCs (e.g. `transaction_timeout` from 17, new in 18 dumps). Mitigate by pinning to `postgresql17` if scoop `versions` bucket is available, or by post-filtering with `pg_restore -f` to SQL and removing unsupported SETs. Wave 0 must test restore into scratch early.

## Package Legitimacy Audit

No new npm packages are required (`pg`, `pg-copy-streams`, `@supabase/supabase-js` already installed). Installing `postgresql` through scoop is a system tool, not an npm/PyPI dependency; slopcheck is not applicable. `scoop` `main` bucket is the official bucket.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| postgresql (scoop main) | scoop | n/a | n/a | ScoopInstaller/Main | n/a (not npm/PyPI/crates) | Approved; planner gates install behind a `checkpoint:human-action` since it changes the machine `[ASSUMED]` |

**Packages removed due to slopcheck [SLOP]:** none (slopcheck not run; no new language packages).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
operator (Claude + user)
   |
   |  PAT (scripts/auth-merge/.access-token, gitignored, short-lived "ziko-cutover-phase6")
   v
[A. Pre-flight] -- assert refs: ziko=slkobhavpwsubnsmuhya, portfolio=ubxl..., scratch=rkirv...
   |  GET /v1/projects/{ziko} name=="ziko"
   v
[B. FREEZE ziko] snapshot grants -> REVOKE write on public (anon,authenticated,service_role)
   |            + disable_signup (auth config PATCH, reversible)
   |            -> measured proof: counts+md5 snapshot T0, re-snapshot T1 after backup; T0==T1
   v
[C. BACKUP]  pg_dump -Fc (public+auth) via session pooler temp login role (--role postgres)
   |         COPY-to-file layer (per table, sha256) | storage export (download all, sha256 manifest)
   |         manifest.json (inventory, versions, key NAMES only)
   |         7z AES-256 -mhe=on  -> outside repo -> copy #2 off machine
   v
[D. RESTORE PROOF into SCRATCH]  wipe scratch (public schema, auth rows, ziko-* buckets, objects)
   |         pg_restore / COPY restore -> upload storage from archive
   |         restore-verify: same-name tables, exact count + md5 per table; auth.users/identities fingerprint; object sha256
   v
[E. DELTA VERIFY ziko(frozen) vs PORTFOLIO]  06-verify-data (rls,triggers,fk,orphans,sequence,remap,tenants)
   |         + new delta mode (PK subset, portfolio>=ziko, explained by updated_at>flip)
   |         + 09-verify-storage (buckets,policies,hashes,rekey) + new object-subset mode
   |         + auth-merge/06-verify (users,identities,tenants)
   |         -> reports/decom-verify-*.json (PII free)
   v
[F. CLEANUP] D-12a env scopes (Vercel preview/dev, EAS) | D-12b delete scratch, revoke ziko-ci-portfolio, repoint CI secrets
   v
[G. D-15 CHECKPOINT] user sees restore proof + verify report -> plain "yes" -> logged in 07-AUTHORIZATIONS.md
   v
[H. DELETE]  gate file all-pass? ref==ziko? name==ziko? -> DELETE /v1/projects/slkobhavpwsubnsmuhya
   |         -> GET -> 404/absent (poll) -> Vercel Marketplace cleanup check
   v
[I. credential retirement] delete .access-token, .vercel-bypass, .tmp-storage-copy-*.json -> user revokes PAT, replies "revoked"
   v
[J. deletion log] timestamp, ref, evidence pointers (final milestone action)
```

### Recommended Project Structure
```
scripts/portfolio-migration/
├── 18-decom-guard.mjs        # ref constants, gate file read/write, fail-closed predicates (+ .test.mjs)
├── 19-decom-freeze.mjs       # --plan/--apply/--unfreeze/--status (grant snapshot + REVOKE/GRANT) (+ test)
├── 20-decom-backup.mjs       # pg_dump orchestration, COPY layer, storage export, manifest, encrypt (+ test)
├── 21-decom-restore-proof.mjs# wipe scratch, restore, restore-verify (+ test)
├── 22-decom-verify.mjs       # delta-aware ziko-vs-portfolio verifier (+ test)
├── 23-decom-env-audit.mjs    # Vercel/EAS/GitHub scope audit by fingerprint/ref-substring (+ test)
├── 24-decom-delete.mjs       # fail-closed delete + confirm-gone + log (+ test)
├── reports/decom-*.json      # PII-free evidence (committed)
├── baseline/decom-gates.json # gate states (committed, no secrets)
└── RUNBOOK.md                # add "Phase 7" section
.planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
```
(Numbering continues the repo's `NN-name.mjs` pattern after 17; adjust to the next free numbers.)

### Pattern 1: Fail-closed gate file
**What:** `baseline/decom-gates.json` with keys `freeze_proven`, `backup_encrypted`, `backup_second_copy`, `restore_proven`, `verify_pass`, `env_scopes_clean`, `scratch_deleted`, `ci_token_revoked`, `confirmation_yes` each `{passed:boolean, at, evidence:path}`. `24-decom-delete.mjs` exits 1 unless every key is true, `--confirm-ref` equals `PROJECTS.ziko`, ref != portfolio/scratch, and the evidence files exist with matching sha256 recorded in the gate. Mirrors `assertWriteAllowed` and 13-cutover-delta's typed-authorization pattern. `confirmation_yes` is only written by an explicit Claude action after the user's literal "yes" at the D-15 checkpoint, and `07-AUTHORIZATIONS.md` records the timestamp.
**When to use:** the delete step and every freeze/unfreeze.

### Pattern 2: Temp login role + SET ROLE
**What:** `connectClient(ref, {token})` from lib-conn returns a pg client already `SET ROLE postgres`. For `pg_dump`, take `createLoginRole` + `getSessionPooler` and pass host/user (`<role>.<ref>`) / password via environment (`PGPASSWORD`, `PGSSLMODE=require`), plus `--role=postgres` so pg_dump runs `SET ROLE postgres`. Never build a URL (lib-conn rule). `deleteLoginRoles(ref)` afterwards.
**Caveat:** `[ASSUMED]` that `cli_login_postgres` can `SET ROLE postgres` under pg_dump and read the `auth` schema; lib-conn proves it for queries. TLS: RUNBOOK notes system CAs do not validate the pooler chain, so `sslmode=require` (encrypted, not verified) is what pg tools will do unless a CA PEM is supplied (lib-conn accepts `caPem`; reuse the CA PEM approach recorded in RUNBOOK section 4).

### Anti-Patterns to Avoid
- **Reusing `--check counts` for D-09:** strict equality (`evaluateCounts`) fails on any post-flip write; do not loosen it globally, add a delta mode.
- **Re-running `13-cutover-delta --mode apply` or `05-load-data --apply` after the flip:** guarded TRUNCATE of 99 `ziko_*` tables destroys post-flip portfolio rows. Any ziko-only row is repaired by a targeted, reviewed insert, never a reload.
- **Using `supabase db dump`:** requires Docker; absent.
- **Putting the archive passphrase on argv or in a file under the repo:** appears in process listings / logs.
- **Trusting `supabase/.temp/project-ref` for targeting:** the working dir is linked to **ziko**; `--linked` without `--project-ref` hits ziko. `runSql` always passes `--project-ref` explicitly; keep that rule and never use bare `supabase ... --linked` for destructive ops.

## Findings per research question

### 1. Management API delete-project
- `DELETE https://api.supabase.com/v1/projects/{ref}`; auth `Authorization: Bearer <token>`; required OAuth scope `projects:write`, or fine-grained token permission `project_admin_write`. Responses documented: 200 (body `{id, ref, name}`), 401, 403, 429. `[CITED: supabase.com/docs/reference/api/v1-delete-a-project]`. The existing PAT `ziko-cutover-phase6` is a classic PAT (full account access), so scope is satisfied `[ASSUMED]` (classic PATs act as the user); a fine-grained token would need `project_admin_write`.
- No documented soft-delete/recovery: "all artifacts are permanently removed ... cannot recover" including backups and storage files. `[CITED: supabase.com/docs/guides/platform/delete-project]`. Pause is Free-tier only and was rejected by D-03.
- Confirm gone: no dedicated "deleted" endpoint is documented `[ASSUMED]`; use `GET /v1/projects/{ref}` expecting 404 (or absence from `GET /v1/projects` list), polled with backoff for ~2 minutes, plus `GET /v1/projects/{ref}/health` or a `db query` failing. Treat "still returns 200 with status REMOVED/ GOING_DOWN" as in-progress, not done. Record the pre-delete GET (name/status/region) in the log. Probe the exact post-delete status code when scripting; do not hard-code beyond "not 200 ACTIVE".
- **Vercel Marketplace caveat:** `supabase/.temp/linked-project.json` shows `organization_slug` `vercel_icfg_*`, i.e. the ziko project lives in a **Vercel-managed Supabase organization**. Per Supabase troubleshooting docs, deleting from the Supabase side marks the resource "uninstalled" in Vercel and a stale entry may need "Delete Database" in the Vercel Storage tab; deleting from Vercel removes both. `[CITED: supabase.com/docs/guides/troubleshooting/how-to-delete-vercel-linked-projects-9d08aa]` (search result, MEDIUM). Plan an early read-only probe (`GET /v1/projects/slkobhavpwsubnsmuhya` + `GET /v1/organizations`) to see if a Vercel-managed project accepts API deletion; the planner needs a fallback task: delete via Vercel dashboard (human action) if the API returns 403. Also the integration may auto-sync `SUPABASE_*`/`POSTGRES_*` env vars into linked Vercel projects, a plausible origin of the stale Preview/Development values in D-12a; check the integration's linked projects and remove/disable the sync before cleaning env scopes, else deleted vars can reappear. `[ASSUMED]` re: auto-sync.
- Rate limit 429: back off; do not retry the delete blindly (check state by GET first).

### 2. Reversible write-freeze
Facts `[ASSUMED: standard Postgres/Supabase behavior, verify with a probe]`:
- Supabase grants ALL on `public` tables to `anon`, `authenticated`, `service_role` by default; `service_role` has `BYPASSRLS` but still needs table privileges, so `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;` blocks PostgREST writes from all three. `postgres` (table owner) keeps rights; `PUBLIC` pseudo-role may also hold grants: check `relacl` and revoke from `PUBLIC` if present.
- Snapshot first: query `pg_class.relacl` / `information_schema.role_table_grants` for schema `public`, store `baseline/decom-ziko-grants-prefreeze.json` (role, table, privilege only, PII-free). `--unfreeze` replays exactly those grants (not a blanket GRANT ALL) so the state is restored byte-equal; verify by re-snapshot diff.
- Also `ALTER DEFAULT PRIVILEGES` is irrelevant (no new tables), but the freeze should not touch it.
- **Gaps the REVOKE does not close:**
  1. `SECURITY DEFINER` functions (e.g. `deduct_ai_credits`, `record_athlete_decision`, triggers) execute as their owner (postgres) and can still write. Mitigation: revoke `EXECUTE` on those functions from `PUBLIC, anon, authenticated, service_role` (snapshot first via `pg_proc.proacl`), or accept and rely on the measured proof below.
  2. GoTrue writes `auth.*` as `supabase_auth_admin` (sign-in updates `last_sign_in_at`, refresh tokens; signup inserts and fires `handle_new_user*` triggers which write `public`). Reduce with auth config `PATCH /v1/projects/{ref}/config/auth {"disable_signup": true}` (reversible; capture the prior value first). Session/token rows will still change: auth verification already excludes volatile columns (`VOLATILE_AUTH_USER_COLUMNS` in lib.mjs), so use those exclusions in the frozen comparison.
  3. Storage: the Storage API writes as `supabase_storage_admin` (owner of `storage.objects`); a REVOKE for `service_role` on `storage.objects` may or may not take effect `[ASSUMED]` and `postgres` may not own it (08-copy-storage's privilege probe exists for this reason). Do not depend on it; use measured freeze proof (object list+size+etag/updated_at snapshot identical at T0 and T1).
  4. Realtime/cron-like writers: ziko API crons were mounted on the API project, which is flipped to portfolio, so no ziko writer should remain; the measured proof confirms.
- **Measured freeze proof (recommended gate `freeze_proven`):** snapshot per public table `count(*)` + `md5(string_agg(t::text,'|' ORDER BY ctid-independent PK))` and `max(updated_at)` where present, plus storage object count/bytes per bucket, at T0 (right after REVOKE), and again T1 (after backup completes); require T0 == T1. If tables lack a PK or ordering key, use row-text md5 with `ORDER BY t::text`. Data volume is small (39 users) so this is cheap.
- Old binaries hitting ziko get Postgres `permission denied` surfaced as an API 4xx/5xx (not a custom message); acceptable per D-02/D-04.
- Execution path: `runSql(PROJECTS.ziko, sql)` works (CLI login) but all existing scripts refuse ziko writes (`assertWriteAllowed`). The freeze script needs its own narrow allowance: ref hard-coded to ziko, mode `--apply --confirm-ref slkobhavpwsubnsmuhya`, only a fixed statement set (REVOKE/GRANT), no free-form SQL.

### 3. Backup tooling
- **Connection:** `lib-conn.mjs` uses the Management API `POST /v1/projects/{ref}/cli/login-role` (temp role `cli_login_postgres`, NOINHERIT member of postgres), `GET /v1/projects/{ref}/config/database/pooler` (PRIMARY `*.pooler.supabase.com`, session mode port 5432 only, 6543 refused), TLS on, `database: postgres`, user `<role>.<ref>`. No DB password in the repo. `[VERIFIED: lib-conn.mjs]`
- **Installed on this machine** `[VERIFIED: Bash probe 2026-10-04]`: pg_dump MISSING, pg_restore MISSING, psql MISSING, docker MISSING, 7z present (scoop 26.01), gpg present (/usr/bin/gpg), openssl present, node present, age MISSING, scoop present (has `postgresql` 18.4), `eas` not on PATH (use `npx eas-cli@24.10.0` per 17-env-switch pin), `vercel` and `gh` present.
- **pg_dump plan:** `pg_dump --format=custom --no-owner? ` NO: keep owners/ACLs for fidelity: `pg_dump -Fc --schema=public --schema=auth --role=postgres --file ziko-full.dump` (host/user/password via env from the temp login role, `PGSSLMODE=require`). Add `--schema-only` variant for the manifest and a `--data-only` plain COPY variant for greppable checks if needed. Storage schema metadata (`storage.buckets`, `storage.objects` rows) is dumped as data-only `--schema=storage --data-only` for reference; object blobs come from the export.
- **Roles/grants (D-05):** `pg_dumpall --roles-only` needs superuser on Supabase and fails; instead capture into the manifest: `pg_roles` (non-system), `role_table_grants`, `pg_default_acl`, RLS policies (`pg_policies`), function list with `proacl`, triggers (`pg_trigger` non-internal), extensions with versions, `SHOW server_version`, bucket configs. This is the same style as the Phase 1 inventory.
- **Pure-Node data layer (independent, also the fallback if pg_dump through the pooler fails):** `COPY public."<t>" TO STDOUT` per table via `pg-copy-streams` (pattern at lib-data `buildCopySql`) into `tables/<name>.copy`, sha256 per file in `checksums.sha256`; `auth.users`, `auth.identities` likewise (exclude nothing; archive is encrypted).
- **Storage export:** reuse the listing/download core from `08-copy-storage.mjs` (`OBJECTS_SQL` listing via runSql on `storage.objects`, `createClient(url, secret)`, `downloadBuffer` with `withRetry`, `mapPool` concurrency, `sha256Hex`). Today those helpers are not exported (only `resolveRun`, `decideObject`, `uploadStrategy`, `checkGlobalLimit`, `buildCopyReport`, `main`), so the plan either extracts them into `lib-storage.mjs` or the export script duplicates them with tests. Write `objects/<bucket>/<name>` plus `storage-manifest.json` (bucket config, name, size, mimetype, cacheControl, sha256). Object names are not PII-safe (may contain UUIDs/user ids); keep the real manifest inside the encrypted archive, commit only an aggregate report (per-bucket counts/bytes/sha256-of-manifest) via `assertReportSafe` style masking (`maskObjectKey`). Note the bucket `ziko-coach-exercises` mention in CONTEXT: that name is a portfolio-prefixed bucket; on ziko the bucket is `coach-exercises`; the bucket map `bucket-map.generated.json` lists the 10 buckets (STORAGE-01). Confirm the orphan test PNG is exported too (full export).
- **Secrets in the archive:** do NOT include `.env` files or API keys; manifest lists env key NAMES only (D-05). Use the 17-env-switch name matrix for names.
- **Encryption:** `7z a -t7z -mhe=on -p<pass> -mx=3 archive.7z <dir>` encrypts contents and names with AES-256 `[ASSUMED: 7-Zip behavior, widely documented]`. Passing `-p<pass>` on argv leaks via process list; 7z also reads the password from stdin prompt only when `-p` is bare, so drive it with Node `spawn` and write the passphrase to the child's stdin `[ASSUMED]` or, simpler, use `gpg --batch --pinentry-mode loopback --passphrase-fd 0 --symmetric --cipher-algo AES256 file.tar` after `tar`/`7z a -tzip -mx=0` (store-only) with the passphrase supplied on fd 0. Generate the passphrase with `crypto.randomBytes(24).toString('base64url')`, hand it to the user once via the checkpoint (user stores in a password manager); it must never be echoed to logs or written to a file in the repo. Verify decryptability by decrypting and re-hashing before declaring the backup done (a gate).
- **Location:** archive outside the repo (e.g. `C:\ziko-backups\ziko-final-<date>\`, never under `C:\ziko-platform`); add the path pattern to `.gitignore` anyway as defense in depth. Second off-machine copy is a human action (Drive/external disk) with the user confirming the post-copy sha256 matches (`backup_second_copy` gate).
- **Checksum approach:** sha256 of the final encrypted archive (committed in the manifest), sha256 of every inner file and every object (inside the encrypted manifest and aggregated in the committed report).
- The CONTEXT "Established patterns" grep gate (`@`, UUIDs, JWT fragments) applies to everything committed.

### 4. Restore proof into scratch
- Scratch = `rkirvurggtgjlkeuhded` (ziko-migration-scratch) `[VERIFIED: PROJECTS.scratch + RUNBOOK section 2]`. Scratch currently holds the full portfolio-style ziko_* schema from the Phase 2-6 rehearsals, `rh_`/`gecko_` simulated tenants, rehearsal auth users, and ziko- buckets with objects (add-only copies). Therefore **"wiped first" must cover**: DB (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + re-grant defaults to anon/authenticated/service_role), auth data (`TRUNCATE auth.users CASCADE` as the postgres role, careful with GoTrue-owned objects), storage buckets and objects (remove every object through the Storage API, then delete buckets). If storage is not wiped, `09-verify-storage` would pass on stale copies and the proof is vacuous (key pitfall). Safe because scratch is a throwaway, but the script must hard-assert `ref === PROJECTS.scratch` and refuse portfolio/ziko.
- Restore mechanics: `pg_restore --no-owner --role=postgres -d` via the same session-pooler temp role (`--exit-on-error` off but capture and classify errors; Supabase-managed object collisions are expected). Restoring the `auth` schema onto a live GoTrue schema is the riskiest step: tables/types already exist. Recommended split: restore `public` from the dump (schema+data); restore `auth.users` and `auth.identities` via the COPY layer into the existing GoTrue tables (same technique 05-load-data uses with triggers disabled; check how it disables triggers and reuse), and compare the auth DDL via the manifest inventory rather than re-creating GoTrue DDL. State this honestly in the proof report: auth is proven by data restore + `auth-merge/06-verify`-style fingerprints, not by replaying GoTrue DDL.
- **What existing verify scripts can and cannot do for the restore proof:**
  - `06-verify-data.mjs` `--project-ref <scratch> --source-ref <ziko> --check counts` compares `ziko_<name>` tables on the target (plan from `rename-map.generated.json`) with unprefixed source tables. A raw restore of ziko into scratch produces **unprefixed** tables, so `06-verify-data` (counts/rls/triggers/fk/orphans/sequence/remap) does not apply as-is. Flags: `--project-ref`, `--source-ref` (must equal ziko), `--check counts|rls|triggers|fk|orphans|sequence|remap|tenants|all`, `--remap-file`, `--baseline`, `--json-out`, `--snapshot-tenants --out`; exit 0 pass / 1 fail / 2 bad args; refuses ziko as `--project-ref`. It reads counts only (no checksums).
  - CONTEXT D-07 says run 06/09 "against restored data". Two compliant options: (a) **restore under the prefixed names**: transform the restored `public` into `ziko_*` using the rename map (that is exactly what `02-dump-and-rewrite.js` / the migration SQL did; more moving parts), or (b) **write a restore-verify mode** (`21-decom-restore-proof --verify`) with same-name comparison: per public table exact `count(*)` and md5 of ordered row text for ziko vs scratch, auth.users/identities fingerprints (`fetchEmailFingerprints`, `fetchNonGeneratedColumns` minus `VOLATILE_*`), RLS/policy/trigger/function inventory diff vs the manifest, FK validation. Recommend (b) as primary and, to honor D-07 literally, additionally run `06-verify-data --check rls|fk|orphans` equivalents by parameterizing the SQL builders (`lib-verify` SQL constants take the `ziko_` plan, so reuse is partial). Record this deviation explicitly for the user so D-07's wording is not silently diluted.
  - `09-verify-storage.mjs` `--project-ref <scratch> --source-ref <ziko> --check buckets|policies|objects|hashes|rekey|urls|tenants|all --remap-file <path> [--baseline] [--json-out]`: compares ziko objects against `ziko-<id>` buckets on the target (re-keyed by uuid remap, `rekeyObjectName`), `hashes` downloads both sides and compares sha256 with no sampling (concurrency 4, 3 attempts), `objects` requires exact count+bytes parity per bucket, plus destination-only count. `--remap-file` is parsed by `parseRemapFile` which checks projectRef/sourceRef match the file; the scratch remap file was `scripts/portfolio-migration/.tmp-uuid-remap.scratch.json` (gitignored `.tmp-*`), may no longer exist, regenerate via `02-import-auth.mjs --remap-out` or generate an identity remap for the restore proof (a raw backup restore has no uuid remapping; the remap file must say so). So for the restore proof, **upload objects from the archive into scratch `ziko-<id>` buckets** (bucket config from the manifest; use the 08-copy-storage upload strategy: SDK upload with `cacheControl` or raw POST for non-`max-age` cache-control) then run `09-verify-storage --check buckets,objects,hashes` with an identity remap; `policies`/`urls`/`tenants` checks reference the portfolio migration and should be skipped for scratch-restore.
- Because `evaluateObjects`/`hashes` are driven from the live ziko source, the restore proof for storage = "archive -> scratch -> compare scratch to LIVE FROZEN ziko" plus "sha256 of archive objects == sha256 of scratch objects" (stronger: proves the archive itself).
- After the proof, **delete scratch** (D-12b) via `DELETE /v1/projects/rkirvurggtgjlkeuhded` with a guard identical to the ziko one (ref must equal `PROJECTS.scratch`, name `ziko-migration-scratch`). Do this only after the proof report is written and the ziko-deletion decision does not depend on scratch anymore; keep scratch until the D-15 "yes" is NOT required (user can inspect it at the checkpoint). Order recommendation: scratch is deleted before the D-15 checkpoint only if the user does not want to inspect the restored data; default: delete scratch right after the `restore_proven` gate is written, since the evidence is the report, not the project.

### 5. Leftover env scopes and CI
- `17-env-switch.mjs` (names + 8-char sha256 fingerprints only; flags `--surface api|web|mobile --target portfolio|ziko --dest local|vercel|eas --plan|--apply|--audit|--verify-remote --vercel-project --vercel-scope --vercel-env --git-branch --eas-env --confirm-ref --authorization-file`):
  - `--audit` is a **code-level** audit only: it scans `backend/api/src`, `apps/web/src`, mobile, plugins, packages for `process.env.*SUPABASE*` names not in the matrix. It does not inspect Vercel.
  - `--verify-remote --dest vercel --vercel-env production|preview|development [--git-branch X] --vercel-project <name>` does `vercel link --cwd <tmp>` + `vercel env ls <env>` and checks only that matrix NAMES are present, not their values. It cannot tell whether a Preview/Development value still points at ziko. `[VERIFIED: repo]`
  - Matrix: api `SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY`; web `NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`; mobile `EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY`. Preview writes require `--git-branch` (the script refuses all-branches Preview writes) and Development is not writable by `buildVercelCommands` (only production/preview), so Development cleanup needs a small extension or manual `vercel env`.
  - **Value audit needed (new 23-decom-env-audit):** for each Vercel project (API and ziko-web; IDs exist as GitHub secrets `VERCEL_PROJECT_ID`, `VERCEL_WEB_PROJECT_ID`, names to be discovered via `vercel project ls` read-only; no `.vercel` link dirs exist in the repo) and for each of `production`, `preview` (all branches AND branch-specific), `development`: `vercel env ls <env> --cwd <tmp>` for the name inventory, then `vercel env pull <file> --environment=<env> [--git-branch]` into a gitignored tmp file `[CITED: vercel CLI docs, MEDIUM; flags to verify with --help]`; scan values for the ziko ref substring `slkobhavpwsubnsmuhya` (URL vars) and compare 8-char fingerprints of key vars against `getProjectApiKeys(PROJECTS.ziko)` fingerprints (reuse `fingerprint` from 17-env-switch); legacy JWT keys also carry a `ref` claim that can be decoded without printing it. Sensitive-type vars cannot be pulled (empty value): for those, either rotate/overwrite to portfolio values (safe: `--target portfolio`) or treat unknown as unclean. Output names + boolean `points_at_ziko` only; delete tmp files in `finally`.
  - The two named leftovers: Preview/Development scopes of shared web records, and `SUPABASE_PUBLISHABLE_KEY` on ziko-web (not in the web matrix, which has `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`_KEY`; likely a legacy/stale name; audit shows whether code still reads it: the code-level `--audit --surface web` fails on unknown names read by code; if code does not read it, remove it with `vercel env rm`; if it does, set to portfolio value).
  - EAS: `eas env:list --environment production|preview|development` (cwd `apps/mobile`, `npx eas-cli@24.10.0`) with the same ref/fingerprint scan; 17-env-switch EAS writes require the typed authorization line for mobile.
  - Local files: `apps/mobile/.env`, `backend/api/.env.local`, `apps/web/.env.local` contain **0** occurrences of the ziko ref `[VERIFIED: grep count, values not printed]`.
  - Repo refs to ziko ref: `supabase/.temp/*` (CLI link state, gitignored? it is tracked in status as modified `cli-latest`, so `.temp` is tracked; relink the CLI to portfolio before deletion so `--linked` stops pointing at a dead project, or accept), `apps/web/test/purge/purge-export.test.ts` (test literal; harmless), `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (comment), `scripts/founder-offer-go-live/RUNBOOK.md` (operational runbook still targeting ziko production; mark obsolete or update), plus migration scripts/tests that hard-code the ref. Do NOT remove migration-script refs (the verification still needs them until deletion); after deletion add a note in RUNBOOK that the scripts are historical.
- **CI:** `.github/workflows/ci.yml` job env uses secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the RLS/verify tests; lines ~33-35, set 2026-10-03T15:53Z and, per STATE, deliberately pointing at **scratch**), and the `migrate-portfolio` job uses `SUPABASE_ACCESS_TOKEN` (`ziko-ci-portfolio-2`, updated 2026-10-03T17:14Z) + `SUPABASE_PROJECT_ID` (portfolio, ref-locked, `PORTFOLIO_MIGRATIONS_ENABLED` var). `gh secret list` shows: EXPO_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN, VERCEL_WEB_PROJECT_ID `[VERIFIED: gh secret list]`. After scratch deletion the three verify secrets would point at a dead project, so they must be repointed **before** scratch deletion (otherwise CI goes red): target = portfolio (PR #40 notes two remote timing specs skip on CI; repointing to portfolio means CI RLS/verify tests would run against the shared production project, which creates test users/rows in portfolio. This is a real design decision: open question 2). `gh secret set` takes the value on stdin (`gh secret set NAME < file` / `--body` leaks via argv; prefer stdin); values come from `getProjectApiKeys`.
- **Token revocation:** `ziko-ci-portfolio` revocation is a **user action** in the Supabase account tokens page (the Management API has no documented list/revoke endpoint for PATs `[ASSUMED]`; Claude cannot revoke it). Confirm `ziko-ci-portfolio-2` is the one in `SUPABASE_ACCESS_TOKEN` (set after the other) by a successful CI run of the migrate-portfolio job (`gh workflow run`/`gh run list`) or by Supabase's "last used" column in the tokens page before the user revokes the old one. Revoking the wrong token breaks CI.
- Also: three `rh_`/`gecko_`... tenants are untouched by this phase, but `portfolio-baseline-precutover.json` (auth-merge/baseline) is currently untracked: commit it (PII check) because the final `tenants` check consumes it. `scripts/portfolio-migration/supabase/` is an untracked empty dir (git status): ignore or remove.

### 6. Exact refs `[VERIFIED: repo, no secrets printed]`
| Project | Ref | Evidence |
|---|---|---|
| ziko (TO DELETE) | `slkobhavpwsubnsmuhya` | `PROJECTS.ziko` in `scripts/auth-merge/lib.mjs`; `supabase/.temp/project-ref`, `linked-project.json` name `ziko`; RUNBOOK `--source-ref`; `pooler-url` |
| portfolio (NEVER DELETE) | `ubxllsvanurkwkohzxau` | `PROJECTS.portfolio`; RUNBOOK `--project-ref`/`--confirm-ref`; `DEFAULT_PHRASE` in 13-cutover-delta |
| scratch (delete after proof) | `rkirvurggtgjlkeuhded` | `PROJECTS.scratch`; RUNBOOK section 2 (name `ziko-migration-scratch`) |
| Earlier orphan scratch attempt | `agrkkwqhgdiunovcpeju` | RUNBOOK line ~50 "earlier provisioning attempt ... uncaptured DB": a possibly still-existing stray project; check `GET /v1/projects` and clean up (user decision) |

**CONTEXT.md correction required:** the "Integration Points" sentence mapping `ubxllsvanurkwkohzxau` to ziko is wrong and must be corrected in 07-CONTEXT.md (and called out in the plan) so no task copies it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| DB credentials for tools | Password handling, connection URLs | `lib-conn.mjs` temp login role + session pooler | Redaction, TLS, no URL leaks |
| SQL execution | New CLI wrappers | `runSql` / `runSqlExpectError` | Explicit `--project-ref`, tested |
| Dump/restore | Custom SQL dumper | `pg_dump -Fc` / `pg_restore` (scoop postgresql) | DDL, ACL, sequence, dependency ordering |
| Row transport | Custom COPY parser | `pg-copy-streams` (already used) | Text format escapes |
| Encryption | Custom crypto | 7-Zip AES-256 (`-mhe=on`) or `gpg --symmetric` | Vetted tools |
| Checksums | Ad-hoc hashing | `sha256Hex` (lib-storage) + `sha256sum`-style manifest | Reuse |
| PII-safe reports | Free-form JSON | `assertReportSafe`, `maskObjectKey`, `maskUuid`, `redactPii` | Existing grep-gate semantics |
| Typed/explicit authorizations | Chat-only approvals | `07-AUTHORIZATIONS.md` lines in the 06-AUTHORIZATIONS style | Auditable gate |
| Env value comparison | Printing values | `fingerprint()` from 17-env-switch + ref-substring boolean | Never print secrets |

**Key insight:** every irreversible-step safeguard already exists in this repo as a pattern (ref constants, confirm-ref, typed authorization, PII-free reports). The phase is mostly new thin scripts that compose them plus two genuinely new capabilities (delta-aware compare, backup+restore proof).

## Runtime State Inventory

(Decommission/removal phase: what still references ziko after the repo is clean.)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | ziko DB (39 profiles, 99 public tables, auth.users/identities, 10 buckets); portfolio holds migrated copies plus post-flip writes | Freeze, backup, restore proof, delta verify, then delete |
| Live service config | Vercel Marketplace link (org `vercel_icfg_*`) possibly auto-syncing SUPABASE_*/POSTGRES_* env; Supabase auth config (redirect URLs, templates) lives in ziko's dashboard only; Vercel Preview/Development scopes may hold ziko values; GitHub Actions secrets point at scratch; Supabase account PATs `ziko-cutover-phase6`, `ziko-ci-portfolio`(stale), `ziko-ci-portfolio-2` | Audit Vercel (all environments incl. branch-scoped Preview), disable integration sync, repoint secrets, user revokes PATs; export ziko auth config (`GET /v1/projects/{ref}/config/auth`, key names/values without secrets) into the manifest before deletion |
| OS-registered state | None found: no Task Scheduler/pm2 entries in repo; none verified on the machine (not probed) | None; state explicitly in runbook after a quick `schtasks`/pm2 check by the planner |
| Secrets/env vars | Local env files have 0 ziko-ref hits; `SUPABASE_PUBLISHABLE_KEY` on ziko-web (Vercel); EAS env scopes; gitignored `scripts/auth-merge/.access-token`, `.vercel-bypass`, `.tmp-storage-copy-ubxl....json` (detail file, name contains portfolio ref) | Delete files after deletion (D-14); remove/repoint remote vars (D-12a) |
| Build artifacts / installed packages | `supabase/.temp/*` (tracked) links the CLI to ziko; old mobile binaries (Android 1.5.0 older builds) embed ziko URL/key; `.next` builds; docs referencing ziko ref | Relink CLI (`supabase link --project-ref <portfolio>`) after delete or leave with note; old binaries get connection errors (accepted, D-04) |

## Common Pitfalls

### Pitfall 1: Deleting the wrong project
**What goes wrong:** CONTEXT.md names `ubxllsvanurkwkohzxau` as ziko; it is portfolio.
**Why:** The tmp file name contains the copy target ref.
**Avoid:** constants only from `PROJECTS`; refuse portfolio/scratch; require `GET` name == `ziko`; unit-test the refusal; require `--confirm-ref slkobhavpwsubnsmuhya`.
**Warning signs:** any plan task containing a literal ref that is not copied from `PROJECTS`.

### Pitfall 2: Strict count equality fails after post-flip writes
**Avoid:** delta-aware mode; hard gate is "every ziko PK exists on portfolio" and no ziko-only rows; classify differences (explained by portfolio `updated_at/created_at` > `web_flip_at 2026-10-03T15:08:02Z` or `backend_flip_at 2026-10-03T14:29:36Z` from HANDOFF.json). Tables without timestamps need a final delta snapshot (portfolio-count-at-flip vs now unavailable) so report them as `unexplained-needs-review` rather than pass.
**Also:** uuid remap (1 known collision, `KNOWN_COLLISION_SOURCE_IDS`) and in-flight storage URL rewrites mean row text hashes legitimately differ on affected rows; compare through the remap/rewrite transforms (lib-data `createRemapTransform`) or limit the row-level check to PKs plus counts, and document.

### Pitfall 3: Ziko-only rows from old binaries
Old binaries post-flip may have written to ziko after the final delta (D-04 says stragglers accepted, D-09 says ziko-only rows are a blocker). Resolution path must exist in the plan: targeted insert of missing rows into portfolio (new reviewed script, add-only, `--confirm-ref` portfolio, authorization line) and re-verify. Never the reload scripts (TRUNCATE).

### Pitfall 4: Freeze illusions
SECURITY DEFINER functions, GoTrue, and Storage still write; the measured T0==T1 proof, not the REVOKE statement, is the gate. Capture grants before REVOKE; unfreeze replays them.

### Pitfall 5: Vacuous restore proof
Scratch already contains migrated data and objects; if not wiped, verification passes on stale content. Gate: assert target tables empty (count 0) and buckets empty immediately before restore, and assert nonzero afterward.

### Pitfall 6: Dump version / GoTrue DDL
pg_dump 18 vs server 17 restore SET errors; auth schema restore over live GoTrue DDL. Test early (Wave 0 spike: dump `public` of scratch and restore into a temp schema), keep the COPY layer as the data-of-record proof.

### Pitfall 7: Login-role TTL and pooler staleness
lib-conn retries 4x with 4s delay; temp roles expire quickly. Long pg_dump should connect once (auth happens at connect). Re-create roles per step; call `deleteLoginRoles` in `finally`.

### Pitfall 8: Passphrase and archive leaks
No passphrase in argv/logs/repo; archive outside repo; `.gitignore` guard; test that committed files pass the grep gate (no `@`, UUIDs, JWT fragments).

### Pitfall 9: Vercel Marketplace-managed project
API delete may be refused or leave an "uninstalled" resource; integration can re-inject env vars. Probe early; human fallback.

### Pitfall 10: CI goes red when scratch is deleted before secrets repoint
Order: repoint secrets -> confirm green CI -> delete scratch -> revoke old PAT.

### Pitfall 11: Wrong default `--linked` target
CLI is linked to ziko; any `supabase ... --linked` without `--project-ref` acts on ziko. Fine for the freeze, dangerous in other contexts; always pass `--project-ref`.

### Pitfall 12: Mojibake/CRLF in planning docs
Edit REQUIREMENTS.md/STATE.md with file tools, preserve CRLF (CONTEXT pattern); do not use gsd-sdk handlers that overstate completion.

## Code Examples

### Fail-closed delete guard (shape)
```js
// Source: pattern from scripts/auth-merge/lib.mjs assertWriteAllowed + CONTEXT D-16 (NEW script)
import { PROJECTS, assertProjectRefFormat, loadAccessToken } from '../auth-merge/lib.mjs';

export function assertDeleteAllowed({ ref, confirmRef, gates }) {
  assertProjectRefFormat(ref);
  if (ref !== PROJECTS.ziko) throw new Error('refusing: only the ziko project may be deleted');
  if (ref === PROJECTS.portfolio || ref === PROJECTS.scratch) throw new Error('refusing: protected project');
  if (confirmRef !== PROJECTS.ziko) throw new Error('--confirm-ref must equal the ziko ref');
  const required = ['freeze_proven','backup_encrypted','backup_second_copy','restore_proven',
    'verify_pass','env_scopes_clean','scratch_deleted','ci_token_revoked','confirmation_yes'];
  const missing = required.filter((k) => gates?.[k]?.passed !== true);
  if (missing.length) throw new Error(`gates not passed: ${missing.join(', ')}`);
}

export async function deleteProject(ref, { token, fetchImpl = fetch }) {
  const get = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!get.ok) throw new Error(`pre-delete GET returned ${get.status}`);
  const info = await get.json();
  if (info?.name !== 'ziko' || info?.id !== ref && info?.ref !== ref) throw new Error('project identity mismatch');
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`delete returned ${res.status}`); // never auto-retry; check state by GET first
}
```

### Freeze statements (shape, to be probed first on scratch)
```sql
-- Source: standard Postgres privilege semantics; Supabase default grants [ASSUMED]
-- 1) snapshot: SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role','PUBLIC');
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
-- unfreeze: replay the snapshot as GRANT <priv> ON public."<t>" TO <role>;
```

### Read-only measured-freeze snapshot (shape)
```sql
SELECT 'public."'||relname||'"' AS tbl,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', relname), false, true, '')))[1]::text::bigint AS n
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r';
```

### Existing CLI usage (verified from repo)
```bash
node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check rls
node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check tenants --baseline scripts/portfolio-migration/baseline/portfolio-tenants-precutover.json
node scripts/portfolio-migration/09-verify-storage.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check hashes --remap-file scripts/auth-merge/uuid-remap.json
node scripts/auth-merge/06-verify.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check users
```
On portfolio, `--check all` requires `--baseline`. `counts` inside `all` will FAIL post-flip; run the individual checks or add the delta mode.

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Soft-pause then delete | Pause is Free-tier only; deletion is permanent, backups removed | Cold backup is the only recovery |
| `supabase db dump` (Docker) | Not usable here | Install pg client tools via scoop or Node COPY |
| Fixed monitoring window | Verification-gated same-day deletion (D-01/D-03) | Evidence gates replace elapsed time |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Classic PAT `ziko-cutover-phase6` has `projects:write`-equivalent power for DELETE | Q1 | Delete returns 403; use dashboard/fine-grained token |
| A2 | Vercel-managed Supabase org may block or complicate API deletion and leaves an "uninstalled" Vercel resource | Q1 | Need human dashboard step |
| A3 | Integration auto-syncs SUPABASE_*/POSTGRES_* env vars into Vercel projects | Q1, Q5 | Env cleanup is undone by the integration |
| A4 | REVOKE on public blocks anon/authenticated/service_role writes; SECURITY DEFINER, GoTrue, Storage still write | Q2 | Backup not consistent; mitigated by measured T0==T1 gate |
| A5 | `pg_dump --role=postgres` through session pooler with the temp login role can read public+auth | Q3 | Fall back to Node COPY layer |
| A6 | scoop `postgresql` 18.4 dump restores into scratch (Postgres 17) without fatal errors | Q3 | Use pinned 17 client or filter SETs |
| A7 | 7z `-mhe=on` AES-256 + stdin passphrase works non-interactively; gpg loopback alternative | Q3 | Use gpg route |
| A8 | No Management API endpoint for deleting a project's confirmed "gone" status other than GET 404 | Q1 | Poll shape differs; handle both |
| A9 | Management API cannot revoke PATs | Q5 | User action anyway |
| A10 | `vercel env pull --environment=<env> [--git-branch]` supports preview/development value pulls; sensitive vars are not pullable | Q5 | Need dashboard review |
| A11 | Phase 1 parity: scratch and ziko share major Postgres 17 | Q3 | Restore errors |
| A12 | Scratch has post-migration state needing a full wipe (DB+auth+storage) | Q4 | Vacuous proof if skipped |

## Open Questions

1. **Does the ziko Vercel-managed org permit Management API deletion?**
   - Known: org slug `vercel_icfg_*`. Unknown: API behavior.
   - Recommendation: read-only probe in Wave 0 (`GET /v1/projects/<ziko>`, org info); plan a human fallback task (delete from Vercel Storage tab) and an "uninstalled" cleanup check.
2. **Where should CI verify secrets point after scratch is deleted?**
   - Pointing at portfolio runs RLS/verify test fixtures (create users/rows) on the shared production project, which Phase 6 avoided on purpose.
   - Recommendation: ask the user at planning: (a) a new throwaway "ziko-ci" project, (b) portfolio with test-prefixed cleanup, or (c) disable those CI steps until a later milestone. Default recommendation (c) with a documented TODO if the user wants speed, since D-12b only requires "off scratch".
3. **How to prove D-07 literally with `06-verify-data` when restored tables are unprefixed?** Recommendation above: same-name restore-verify (new) plus reuse of SQL constants; surface the wording deviation to the user.
4. **Are there ziko-only rows or objects written after the final delta?** Unknown until the delta verify runs; plan the targeted-repair branch.
5. **Stray project `agrkkwqhgdiunovcpeju`** from the earlier scratch attempt may still exist; confirm with `GET /v1/projects` and decide cleanup (user).
6. **ziko auth config export:** no email templates/redirect URLs from ziko are archived anywhere except the merged config; include `GET config/auth` (secret-free fields) in the manifest.
7. **Edge Functions, Realtime publications, cron (pg_cron) jobs, Vault secrets, webhooks on ziko:** not in D-05 scope; inventory shows none known, but the manifest should list `supabase_functions`, `pg_cron`, `vault` presence so nothing is silently lost.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | all scripts | yes | v20+ (nvm4w) | none needed |
| `pg`, `pg-copy-streams` | COPY export/restore | yes | in node_modules | none needed |
| pg_dump / pg_restore / psql | D-05 backup, D-07 restore | **no** | - | `scoop install postgresql` (18.4), else Node COPY layer only |
| Docker | `supabase db dump` | **no** | - | not needed |
| 7-Zip | encryption | yes | 26.01 | gpg |
| gpg / openssl | encryption/hash | yes | Git Bash | - |
| age | encryption | no | - | 7z/gpg |
| Supabase CLI | `runSql`, api-keys | yes (npx) | 2.116.0 (2.119.0 avail) | - |
| Vercel CLI | env audit | yes | 59.24.0, logged in as anatholyb1 | dashboard |
| gh CLI | CI secrets | yes (secret list works) | - | dashboard |
| eas-cli | EAS env audit | not on PATH | pinned 24.10.0 via npx | skip EAS if no token |
| Supabase PAT | delete/login-role | file `scripts/auth-merge/.access-token` present per 06-20 (not read) | - | user creates new PAT |
| Second off-machine copy target | D-06 | user action | - | external disk |

**Missing with no fallback:** none blocking.
**Missing with fallback:** pg_dump suite (scoop install, human-gated); age (unneeded).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` for `scripts/portfolio-migration/*.test.mjs` (repo pattern); root `package.json` also has vitest but scripts tests use node:test `[VERIFIED: 05-load-data.test.mjs]` |
| Config file | none (run by path) |
| Quick run command | `node --test scripts/portfolio-migration/18-decom-guard.test.mjs scripts/portfolio-migration/24-decom-delete.test.mjs` |
| Full suite command | `node --test scripts/portfolio-migration/ scripts/auth-merge/` (all `*.test.mjs`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECOM-01 | Waiver recorded, not "done" in REQUIREMENTS.md / traceability | doc grep check | `grep -n "DECOM-01" ... \| grep -i waived` (script test reading the file) | Wave 0 |
| DECOM-02 | Freeze snapshot/replay symmetric (pure SQL builders; unfreeze restores byte-equal grant list) | unit | `node --test .../19-decom-freeze.test.mjs` | Wave 0 |
| DECOM-02 | Measured freeze T0==T1 comparison fails on any diff | unit (pure evaluator) + live | `node --test .../19-decom-freeze.test.mjs`; live: `node .../19-decom-freeze.mjs --status --prove` | Wave 0 |
| DECOM-02 | Backup manifest has every table/bucket, checksums verify, archive decrypts and re-hashes equal, no secret/PII patterns in committed files | unit + live | `node --test .../20-decom-backup.test.mjs`; live `node .../20-decom-backup.mjs --verify-archive` | Wave 0 |
| DECOM-02 | Restore proof: wipe asserted empty before, restore, same-name count+md5 equal, objects sha256 equal, report passed | unit (evaluators) + live | `node --test .../21-decom-restore-proof.test.mjs`; live `node .../21-decom-restore-proof.mjs --verify --json-out reports/decom-restore-proof.json` (exit 0) | Wave 0 |
| DECOM-03 | Delta evaluator: portfolio>=ziko pass, ziko-only PK fails, unexplained diff fails, sv_* excluded, rh_/gecko_ regression fails | unit | `node --test .../22-decom-verify.test.mjs` | Wave 0 |
| DECOM-03 | Live full verification (RLS 99/99, triggers, FK 144, orphans 0, PK subset, storage hashes, tenants baselines) | live read-only | `node .../22-decom-verify.mjs --project-ref ubxl... --source-ref slko... --json-out reports/decom-verify.json` (exit 0) plus existing `06-verify-data --check rls\|triggers\|fk\|orphans\|tenants`, `09-verify-storage --check buckets\|hashes\|rekey`, `auth-merge/06-verify --check users\|identities\|tenants` | Wave 0 |
| DECOM-04 | Delete refuses without `confirmation_yes` gate and without matching authorization line; gate only written after explicit checkpoint | unit | `node --test .../24-decom-delete.test.mjs` | Wave 0 |
| DECOM-05 | Delete refuses portfolio/scratch ref, wrong confirm-ref, wrong project name, any gate false, missing evidence files; mocked fetch never calls DELETE in those cases | unit | same | Wave 0 |
| DECOM-05 | Post-delete: GET shows project gone; deletion log exists with ref+timestamp+evidence pointers and passes grep gate | live + doc check | `node .../24-decom-delete.mjs --confirm-gone`; `grep` gate | Wave 0 |
| D-12 | No env scope (prod/preview/dev, API+web, EAS) points at ziko; CI secrets not scratch; scratch deleted | live read-only | `node .../23-decom-env-audit.mjs --all --json-out reports/decom-env-audit.json` (exit 0); `gh secret list`; API GET scratch not found | Wave 0 |

### Sampling Rate
- **Per task commit:** the touched script's `node --test` file (seconds, no network, mocked fetch/runSql).
- **Per wave merge:** `node --test scripts/portfolio-migration/ scripts/auth-merge/` (existing suites must stay green: the new code must not change existing script behavior).
- **Phase gate:** all live gate commands exit 0 and `decom-gates.json` fully true except `confirmation_yes` until D-15; then the delete step.

### Wave 0 Gaps
- [ ] `18-decom-guard.mjs` + test, `19-decom-freeze`, `20-decom-backup`, `21-decom-restore-proof`, `22-decom-verify`, `23-decom-env-audit`, `24-decom-delete` each with `.test.mjs`
- [ ] Install pg client tools (human-gated) and a probe spike: dump+restore a small schema on scratch
- [ ] Probe: Management API read of ziko project (name, status, org), Vercel integration state
- [ ] Probe: freeze coverage on scratch (REVOKE then attempt writes as anon/authenticated/service_role, a SECURITY DEFINER function, a storage upload, a signup)
- [ ] `.gitignore` entries for backup paths and `.tmp-decom-*`
- [ ] Commit untracked `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` after PII check

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (PAT, login roles) | short-lived login role, PAT file gitignored, retire after deletion (D-14) |
| V3 Session Management | no | - |
| V4 Access Control | yes | freeze via privileges, ref-lock guards, RLS regression checks (99/99) |
| V5 Input Validation | yes | `assertProjectRefFormat`, ident regex (`IDENT_RE`), fixed SQL statement sets only |
| V6 Cryptography | yes | 7-Zip AES-256 or gpg AES256, never hand-rolled; random passphrase via `crypto.randomBytes` |
| V8/V9 Data protection | yes | PII backup encrypted, outside repo, second copy, PII-free committed reports (`assertReportSafe`) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Wrong-project deletion | Tampering/DoS | PROJECTS constants, name check, confirm-ref, gate file |
| Secret/PII leakage in repo or logs | Info disclosure | redactSecrets/redactPii, grep gate, archive outside repo, stdin passphrase |
| Credential left behind | Elevation | D-14 retirement, revoke PAT, delete temp files, `deleteLoginRoles` |
| Stale CI token | Elevation | revoke `ziko-ci-portfolio` after confirming `-2` works |
| Backup tampering/corruption | Tampering | sha256 manifest, decrypt-and-rehash gate, restore proof |
| Accidental bundled approval | Repudiation | separate D-15 checkpoint recorded in `07-AUTHORIZATIONS.md` |

## Project Constraints (from CLAUDE.md)
- Backend relative imports need `.js`; the new scripts are `.mjs` under `scripts/` (no extension issue) but any backend change would follow this.
- Never edit an existing migration; this phase needs no new migration (ziko schema is not touched in portfolio). No new DB objects on portfolio except none.
- `SUPABASE_SERVICE_ROLE_KEY` must not be imported from `backend/api/src/**` (irrelevant: scripts only).
- Files with emoji/accents: edit with file tools, not shell echo/heredoc. Planning docs preserve CRLF; edit by hand.
- GSD: planning docs committed; update STATE.md/HANDOFF.json; phase branch `gsd/phase-{phase}-{slug}`; `commit_docs: true`; nyquist validation on (section above).
- User global CLAUDE.md: prefix shell commands with `rtk` where applicable (planner should write task commands accordingly; node/script runs pass through unchanged).
- Mockup/UI rules do not apply (no UI deliverable); `ui_phase` gate not relevant.
- Project memory: user prefers strong recommendations; accepts Recommended answers.

## Sources

### Primary (HIGH confidence)
- Repo: `scripts/auth-merge/lib.mjs` (PROJECTS, runSql, getProjectApiKeys, loadAccessToken), `scripts/portfolio-migration/lib-conn.mjs`, `06-verify-data.mjs`, `09-verify-storage.mjs`, `08-copy-storage.mjs`, `17-env-switch.mjs`, `13-cutover-delta.mjs`, `lib-verify.mjs`, `.github/workflows/ci.yml`, `supabase/.temp/*`, `RUNBOOK.md`, `06-20-SUMMARY.md`, ROADMAP/STATE/REQUIREMENTS
- Bash probes 2026-10-04: tool availability, `gh secret list` (names only), `vercel whoami`, `scoop search postgresql`, ziko-ref grep counts in local env files

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/reference/api/v1-delete-a-project (endpoint, scopes, responses)
- https://supabase.com/docs/guides/platform/delete-project (permanent deletion, no recovery)
- https://supabase.com/docs/guides/troubleshooting/how-to-delete-vercel-linked-projects-9d08aa and https://github.com/orgs/supabase/discussions/39514 (Vercel-linked deletion)

### Tertiary (LOW confidence)
- Freeze semantics, pg_dump through pooler, 7z/gpg non-interactive passphrase, Vercel env pull flags: training knowledge, all in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack / repo reuse: HIGH (read the code)
- Refs and tooling availability: HIGH (verified)
- Delete API: MEDIUM (docs fetched; Vercel-managed org behavior unverified)
- Freeze/backup/restore mechanics: MEDIUM-LOW (needs Wave 0 probes on scratch)
- Pitfalls: HIGH for repo-derived, MEDIUM otherwise

**Research date:** 2026-10-04
**Valid until:** 2026-10-11 (fast-moving: tokens, project state, same-day execution intended)

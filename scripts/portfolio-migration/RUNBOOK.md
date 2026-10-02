# Ziko → Portfolio Schema Migration — RUNBOOK

**Audience:** the person about to run this phase's dry-run-then-real-apply sequence against a
shared production Supabase project. Read this file before running anything.

---

## 1. Scratch project provisioning (SCHEMA-05)

**Corrected finding (2026-09-22):** `02-RESEARCH.md`'s Pitfall 1 documented that `portfolio`'s org
(`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`, Vercel-Marketplace-managed) can only have new Supabase
projects created via the Vercel dashboard, and that `supabase projects create` (CLI) and the MCP
`create_project` tool would both fail or be rejected. **This was empirically re-verified and found
incorrect for this org** — `supabase projects create` succeeded directly:

```bash
supabase projects create ziko-migration-scratch \
  --org-id vercel_icfg_y5brWcl0o23xn4A50p4NAUFG \
  --region eu-west-3 \
  --db-password "<generated>"
```

returned `status: ACTIVE_HEALTHY` and the project was independently confirmed via
`supabase projects list`. This contradicts Supabase's own docs (cited in RESEARCH.md as the
source of the dashboard-only claim) — the org type may not enforce that restriction in practice,
or the restriction may have changed. **Do not assume this generalizes to other Vercel-Marketplace
orgs without re-testing** — if the CLI command is rejected in a future run, fall back to the
original dashboard-only procedure below.

**Original (fallback) procedure, if CLI creation is ever rejected:**
1. Open the Vercel dashboard, navigate to the Integrations tab for the project that hosts the
   `portfolio` Supabase integration (installation `icfg_y5brWcl0o23xn4A50p4NAUFG`).
2. Use the Supabase-for-Vercel integration's "Create Database"/new-resource flow to provision a
   new, throwaway Supabase project in the same org. Name it clearly as scratch/dry-run.
3. Copy the new project's ref from Project Settings → General.

---

## 2. This execution's scratch project

| Field | Value |
|---|---|
| Project ref | `rkirvurggtgjlkeuhded` |
| Name | `ziko-migration-scratch` |
| Org | `vercel_icfg_y5brWcl0o23xn4A50p4NAUFG` (same org as `portfolio`) |
| Region | `eu-west-3` |
| Postgres version (live-confirmed) | `17.6` — matches `ziko`/`portfolio`'s `17.6.1.x` build family per `01-INVENTORY.md` |
| Linked locally | Yes — `supabase link --project-ref rkirvurggtgjlkeuhded` |

An earlier provisioning attempt created project ref `agrkkwqhgdiunovcpeju` with an uncaptured DB
password; it was deleted (`supabase projects delete agrkkwqhgdiunovcpeju --yes`) before
`rkirvurggtgjlkeuhded` was created. Only `rkirvurggtgjlkeuhded` should exist going forward.

---

## 3. Sequencing gate (the whole point of this phase's structure)

This migration is **irreversible-in-practice** once applied to a live, multi-tenant project
(`portfolio` hosts `rh_*`/`gecko_*` tenants that must see zero regression). The phase is
deliberately sequenced so nothing touches `portfolio` until a dry run has passed:

1. **Plan 03** generates the two migration files (schema+RLS, then functions+triggers+grants).
2. **Plan 04** builds the verification tooling (stale-reference grep, RLS-enabled check,
   authenticated owner/non-owner smoke test).
3. **Plan 05** `[BLOCKING]` applies the migration files to **this scratch project** via
   `supabase db push` and runs the full verification suite against it — the actual SCHEMA-05 dry
   run.
4. **Plan 06** is an explicit **human confirmation checkpoint** — the dry run must be reviewed and
   approved by a person before Plan 07 is allowed to run. This is the deliberate, cheap insurance
   a one-shot infrastructure consolidation still needs.
5. **Plan 07** `[BLOCKING]` applies the same, already-scratch-verified migration series to
   `portfolio` for real and re-runs the full verification suite against it.

**Never skip step 4.** Never apply the migration files to `portfolio` before they have applied and
verified clean against the scratch project first.

---

## 4. Teardown (not part of this phase — noted for later reference)

`supabase projects delete rkirvurggtgjlkeuhded --yes` should work per Supabase's CLI docs (already
exercised once in this session against the discarded `agrkkwqhgdiunovcpeju` project — confirmed
working). Teardown of the scratch project used for the real dry run is out of scope for this
phase; do it once Plan 07 has completed and the migration is confirmed live on `portfolio`.

---

## Phase 4 — Data copy & integrity verification

Refs: ziko `slkobhavpwsubnsmuhya` (source, read-only), portfolio `ubxllsvanurkwkohzxau`,
scratch `rkirvurggtgjlkeuhded`. Loader: `05-load-data.mjs`. Verifier: `06-verify-data.mjs`.

### 4.1 Prerequisites

- Supabase CLI logged in. The verify suite and `05-load-data --plan` need only this (they use
  `db query --linked`); no PAT and no DB password.
- `--probe` and `--apply` also need a short-lived PAT named `ziko-data-copy-phase4`, exported as
  `SUPABASE_ACCESS_TOKEN` or written to the gitignored `scripts/auth-merge/.access-token`.
- System CAs do not validate the pooler chain (observed in the scratch rehearsal), so the Supabase
  root CA is required: save it under the gitignored `scripts/portfolio-migration/.ca/` and pass
  `--ca-file <path>`. Never disable TLS verification.
- Login roles (`cli_login_<parent>`) are NOINHERIT members of their parent and have no BYPASSRLS or
  table grants of their own. `lib-conn` therefore runs `SET ROLE <parent>` (session scoped) after
  connect and refuses to continue unless the effective role has BYPASSRLS. The pooler may briefly
  reject or serve stale state for a just-recreated role name, so connect is retried (fresh role).
- Never reset any project's postgres password: other tenants depend on portfolio's.
- One client per side (max_connections is 60); never run two loads or verifiers concurrently.

### 4.2 Scratch rehearsal

1. Auth precondition on scratch:

        node scripts/auth-merge/rehearsal-seed-collision.mjs --project-ref rkirvurggtgjlkeuhded --reset
        node scripts/auth-merge/rehearsal-seed-collision.mjs --project-ref rkirvurggtgjlkeuhded --seed
        node scripts/auth-merge/02-import-auth.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --apply --remap-out scripts/portfolio-migration/.tmp-uuid-remap.scratch.json
        node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check users
        node scripts/auth-merge/06-verify.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check identities

2. Load, in order:

        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --remap-file scripts/portfolio-migration/.tmp-uuid-remap.scratch.json --plan
        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --remap-file scripts/portfolio-migration/.tmp-uuid-remap.scratch.json --probe
        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --remap-file scripts/portfolio-migration/.tmp-uuid-remap.scratch.json --apply

3. Verify:

        node scripts/portfolio-migration/06-verify-data.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --check all --remap-file scripts/portfolio-migration/.tmp-uuid-remap.scratch.json

4. Prove idempotence (D-03): run `--apply` a second time and the same `--check all` again; results
   must be identical (the load begins with a guarded truncate).

Counts are exact with no exclusions. If `counts` fails because ziko took writes after the load,
re-run load then verify back-to-back; never exclude a table.

### 4.3 Portfolio gate

- Auto-chain is disabled for this step. Read-only pre-flight first:

        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --remap-file scripts/auth-merge/uuid-remap.json --plan
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check rls
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check triggers
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check fk
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check orphans
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check sequence
        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --snapshot-tenants --out scripts/portfolio-migration/baseline/portfolio-tenants-preload.json

- The operator types the exact phrase `approve ubxllsvanurkwkohzxau option-load-data`; it is
  recorded in `04-06-SUMMARY.md`.

### 4.4 Portfolio load

1. Mechanically grep the recorded typed line in `04-06-SUMMARY.md` before proceeding.
2. Run `--probe`, then `--apply`, with `--confirm-ref ubxllsvanurkwkohzxau`:

        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --remap-file scripts/auth-merge/uuid-remap.json --confirm-ref ubxllsvanurkwkohzxau --probe
        node scripts/portfolio-migration/05-load-data.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --remap-file scripts/auth-merge/uuid-remap.json --confirm-ref ubxllsvanurkwkohzxau --apply

3. Verify, including the tenant regression guard:

        node scripts/portfolio-migration/06-verify-data.mjs --project-ref ubxllsvanurkwkohzxau --source-ref slkobhavpwsubnsmuhya --check all --remap-file scripts/auth-merge/uuid-remap.json --baseline scripts/portfolio-migration/baseline/portfolio-tenants-preload.json --json-out <report path>

### 4.5 Recovery (D-06)

Any failure leaves earlier tables committed and later ones empty. Recovery is to re-run `--apply`
from the start (it begins with the guarded truncate). Never hand-edit rows, never
`TRUNCATE ... CASCADE`, never `UPDATE` to fix the remap after the load.

### 4.6 Phase 6 reuse (D-03)

Inside the write-freeze, run the Phase 3 auth delta first (`scripts/auth-merge/RUNBOOK.md`
section 4) so that new ziko signups exist in portfolio `auth.users` before the data reload;
otherwise their rows would be orphaned FKs. Then run the identical `05-load-data --apply` and
`06-verify-data --check all`. With ziko frozen, counts must match exactly.

### 4.7 Known open items (not Phase 4 scope)

- 3 ziko rows (`user_profiles` 2, `body_measurements` 1) store full storage URLs containing the
  ziko project ref. They are copied verbatim and must be handled in Phase 5/6 (RESEARCH Pitfall 7). Resolved in Phase 5: see section 5.4.
- The UUID remap also rewrites `<uuid>/file` storage paths inside rows, so Phase 5 must key the
  collision user's objects by the target UUID (spec section 8). Resolved in Phase 5: see section 5.4.

### 4.8 Token retirement

At phase end, on every path, delete `scripts/auth-merge/.access-token` and revoke the PAT at
https://supabase.com/dashboard/account/tokens.

## Phase 5 — Storage migration

Refs: ziko `slkobhavpwsubnsmuhya` (source, read-only), portfolio `ubxllsvanurkwkohzxau`,
scratch `rkirvurggtgjlkeuhded`. Scripts: `07-generate-storage-policies.mjs`, `08-copy-storage.mjs`,
`05-load-data.mjs` (URL rewrite hook), `06-verify-data.mjs`, `09-verify-storage.mjs`,
`10-storage-auth-tests.mjs`, `11-codemod-buckets.mjs`. Buckets are renamed `ziko-<id>`; policies `ziko_*`.

### 5.1 Prerequisites

- Supabase CLI logged in. The plan/check/verify commands use only this.
- A short-lived PAT named `ziko-storage-phase5` (project scope: portfolio, ziko, scratch) in the gitignored
  `scripts/auth-merge/.access-token` or `SUPABASE_ACCESS_TOKEN`. It is needed for loader `--probe`/`--apply`,
  the global storage limit read, and the storage auth harness (API keys).
- Supabase root CA at `scripts/portfolio-migration/.ca/supabase-ca.crt`, passed as `--ca-file` to loader commands.
- Regenerate-and-check rule: `bucket-map.generated.json` and the policies migration are generated read-only from
  live ziko. Before every apply run `07-generate-storage-policies.mjs --check --source-ref slkobhavpwsubnsmuhya`;
  if it reports drift or stale references, regenerate with `--generate`, review the diff, commit, and only then continue.
- One writer per target at a time. Never delete objects or buckets by hand.

### 5.2 Scratch rehearsal (exact order; verified PASS)

1. Auth precondition (same as 4.2 step 1; regenerates the scratch remap `R=scripts/portfolio-migration/.tmp-uuid-remap.scratch.json`).
2. Tenant baseline: `node scripts/portfolio-migration/09-verify-storage.mjs --project-ref rkirvurggtgjlkeuhded --snapshot-tenants --out scripts/portfolio-migration/.tmp-scratch-storage-tenants.json`
3. Policies FIRST (before any bucket or object write):

        node scripts/portfolio-migration/07-generate-storage-policies.mjs --check --source-ref slkobhavpwsubnsmuhya
        node scripts/portfolio-migration/07-generate-storage-policies.mjs --apply --project-ref rkirvurggtgjlkeuhded

4. Copy: `08-copy-storage.mjs --source-ref slkobhavpwsubnsmuhya --project-ref rkirvurggtgjlkeuhded --remap-file $R --plan`, then `--apply --report-out scripts/portfolio-migration/reports/scratch-storage-copy.json`.
5. Loader re-run with URL rewrite: `05-load-data.mjs ... --remap-file $R --ca-file scripts/portfolio-migration/.ca/supabase-ca.crt` with `--plan`, `--probe`, `--apply --report-out scripts/portfolio-migration/reports/scratch-load-phase5.json`; then `06-verify-data.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --remap-file $R --check all`.
6. `09-verify-storage.mjs --project-ref rkirvurggtgjlkeuhded --source-ref slkobhavpwsubnsmuhya --remap-file $R --baseline scripts/portfolio-migration/.tmp-scratch-storage-tenants.json --check all --json-out scripts/portfolio-migration/reports/scratch-storage-verify.json`
7. Auth matrix (run `git apply --check` of the patch first, see 5.6a): `10-storage-auth-tests.mjs --project-ref rkirvurggtgjlkeuhded --mode full --with-codemod-patch scripts/portfolio-migration/patches/05-bucket-codemod.patch --report-out scripts/portfolio-migration/reports/scratch-storage-auth.json`; afterwards `git status --porcelain -- apps backend plugins packages/plugin-sdk scripts/exercise-import` must be empty.
8. Idempotence: repeat the copy `--apply` (expect copied 0, destination-only 0) and `09-verify-storage --check all`.

### 5.3 Portfolio gate

- Auto-chain is disabled. Read-only pre-flight:

        node scripts/portfolio-migration/07-generate-storage-policies.mjs --check --source-ref slkobhavpwsubnsmuhya
        node scripts/portfolio-migration/08-copy-storage.mjs --source-ref slkobhavpwsubnsmuhya --project-ref ubxllsvanurkwkohzxau --remap-file scripts/auth-merge/uuid-remap.json --plan
        node scripts/portfolio-migration/09-verify-storage.mjs --project-ref ubxllsvanurkwkohzxau --snapshot-tenants --out scripts/portfolio-migration/baseline/portfolio-storage-tenants-preload.json

- The operator types the exact phrase `approve ubxllsvanurkwkohzxau option-storage-migration`; it is recorded in the plan SUMMARY and grepped mechanically before any write.

### 5.4 Portfolio run order

policies -> copy -> loader re-run -> `06-verify-data --check all` -> `09-verify-storage --check all` -> auth smoke -> tenants.
Every write command passes `--confirm-ref ubxllsvanurkwkohzxau`; `--baseline` is the pre-load tenant snapshot:

        07-generate-storage-policies.mjs --apply --project-ref ubxllsvanurkwkohzxau --confirm-ref ubxllsvanurkwkohzxau
        08-copy-storage.mjs ... --project-ref ubxllsvanurkwkohzxau --remap-file scripts/auth-merge/uuid-remap.json --confirm-ref ubxllsvanurkwkohzxau --apply
        05-load-data.mjs ... --confirm-ref ubxllsvanurkwkohzxau --probe, then --apply   (rewrites the 3 ziko storage URL rows in flight)
        06-verify-data.mjs ... --check all
        09-verify-storage.mjs ... --check all --baseline <pre-load snapshot>
        10-storage-auth-tests.mjs --project-ref ubxllsvanurkwkohzxau --mode smoke --confirm-ref ubxllsvanurkwkohzxau

The collision user's objects are keyed by the target UUID via the remap file (36 objects on the rehearsal).

### 5.5 Recovery

Re-run `08-copy-storage --apply` (idempotent, add/replace only). Never delete objects, buckets or policies by hand.
Loader failures: follow 4.5 (re-run `--apply`).

### 5.6 Phase 6 delta

Auth delta, then loader reload, then `08-copy-storage --apply` (add-only), `09-verify-storage --check all`, and a manual
review of any destination-only objects. Re-apply the codemod on a fresh main
(`11-codemod-buckets.mjs --apply`, or rebase `gsd/phase-5-bucket-codemod`) and merge it together with the Vercel env flip.

### 5.6a Codemod patch drift

If HEAD gains commits touching any file listed in `scripts/portfolio-migration/patches/05-bucket-codemod.manifest.txt`
after 05-08 (and before 05-11 or Phase 6), the patch is stale. Run `git apply --check` of the patch before every
`--with-codemod-patch` use. On failure regenerate the patch with the script (repeat 05-08 Task 1 steps 1-6: `--scan`,
`--apply --manifest-out`, `--check`, residual grep gate, capture, restore) before any `git apply`. Never hand-merge the patch.

### 5.7 Known items

- profile-photos quirk (D-02): bucket is private yet a public-role SELECT policy exists and there is no DELETE policy. Carried as is; the matrix records the baseline observations.
- Cache-control (A2): raw-header uploads preserved the source cache-control on scratch (0 mismatches over 2699 objects).
- The Storage CDN caches an authenticated response already served, so a revoked coach can re-download the same already-read path for the cache lifetime. The policy itself denies (fresh path, signed URL and SQL simulation all deny). Pre-existing platform behavior, not a migration defect.
- Policy comparison ignores the `public.` schema prefix on function calls (pg_policies deparses without it).
- `created_at` is reset on copied objects (scan-photos cleanup clock restarts).
- Backend coach routes that query unprefixed tables are `deferred-table-codemod` and become named Phase 6 smoke items.

### 5.8 Token retirement

At phase end, on every path, delete `scripts/auth-merge/.access-token` and revoke the PAT `ziko-storage-phase5` at
https://supabase.com/dashboard/account/tokens.

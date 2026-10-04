# Phase 7: Monitoring & Decommission - Pattern Map

**Mapped:** 2026-10-04
**Files analyzed:** 22 new/modified (7 scripts + 7 tests + 8 docs/config/evidence)
**Analogs found:** 22 / 22 (every script has a role-match analog; several sub-behaviors are new, see "No Analog Found")

Ground truth for refs (copy from code, never from prose): `PROJECTS` in `scripts/auth-merge/lib.mjs` lines 29-33: ziko `slkobhavpwsubnsmuhya` (DELETE), portfolio `ubxllsvanurkwkohzxau` (NEVER), scratch `rkirvurggtgjlkeuhded`. The "Integration Points" correction in CONTEXT.md is already applied; RESEARCH flags the same trap. No plan task may contain a literal ref that is not imported from `PROJECTS` (tests may declare literals as 13-cutover-delta.test.mjs does).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/portfolio-migration/18-decom-guard.mjs` | utility (guards, gate file) | request-response (pure predicates + JSON file I/O) | `scripts/auth-merge/lib.mjs` (`assertWriteAllowed`) + `13-cutover-delta.mjs` (`checkAuthorization`) | role-match |
| `scripts/portfolio-migration/19-decom-freeze.mjs` | script (privileged SQL writer) | request-response / batch | `13-cutover-delta.mjs` (mode/confirm gates) + `auth-merge/lib.mjs` `runSql` | role-match |
| `scripts/portfolio-migration/20-decom-backup.mjs` | script | file-I/O + streaming (COPY, storage download) | `05-load-data.mjs` (COPY streams) + `08-copy-storage.mjs` (download pool) + `lib-conn.mjs` | role-match |
| `scripts/portfolio-migration/21-decom-restore-proof.mjs` | script | batch (wipe, restore, verify) | `05-load-data.mjs` + `08-copy-storage.mjs` upload + `06-verify-data.mjs` | role-match |
| `scripts/portfolio-migration/22-decom-verify.mjs` | script (read-only verifier) | transform / request-response | `06-verify-data.mjs` + `lib-verify.mjs` evaluators + `09-verify-storage.mjs` | exact (role) |
| `scripts/portfolio-migration/23-decom-env-audit.mjs` | script (read-only auditor) | request-response (CLI subprocess) | `17-env-switch.mjs` (`fingerprint`, `--verify-remote`, `defaultRun`) | role-match |
| `scripts/portfolio-migration/24-decom-delete.mjs` | script (irreversible, fail-closed) | request-response (HTTP) | `13-cutover-delta.mjs` (gate order) + RESEARCH delete-guard shape + `lib-conn.mjs` `api()` | role-match |
| `scripts/portfolio-migration/18..24-*.test.mjs` (7) | test | offline unit, injected deps | `13-cutover-delta.test.mjs`, `lib-conn.test.mjs` | exact |
| `scripts/portfolio-migration/RUNBOOK.md` (add "Phase 7") | docs | n/a | RUNBOOK "Phase 6 - Cutover" section (line 277+) | exact |
| `.gitignore` | config | n/a | lines 44-53 (Phase 3/4/6 ignore blocks) | exact |
| `scripts/portfolio-migration/reports/decom-*.json` | evidence (PII-free) | file-I/O | `reports/portfolio-cutover-final.json`, `06-verify-data` `--json-out` | exact |
| `scripts/portfolio-migration/baseline/decom-gates.json` + `decom-ziko-grants-prefreeze.json` | evidence/state | file-I/O | `baseline/portfolio-tenants-precutover.json` | role-match |
| `.planning/.../07-monitoring-decommission/07-AUTHORIZATIONS.md` | docs (auth log) | n/a | `06-cutover/06-AUTHORIZATIONS.md` | exact |
| `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` (hand edits) | docs | n/a | Phase 6 close commit `3e1ad0c7` (waiver wording) | exact |
| `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` (commit untracked) | evidence | n/a | sibling baseline files | exact |

## Pattern Assignments

### Shared CLI skeleton for all scripts 18-24 (script, request-response)

**Analog:** `scripts/portfolio-migration/13-cutover-delta.mjs`

Imports (lines 22-27) and header contract (lines 1-21: purpose, modes, exit codes, "PII-free"):
```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, parseCliArgs, assertProjectRefFormat, assertWriteAllowed, isMain, redactPii } from '../auth-merge/lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
```

Arg parsing (lines 179-204, 225-234): declare a `SPEC` map (`'flag-name': 'string'|'boolean'|'list'`), a `HELP` template, then `run(argv, depsIn)` returns an exit code. `parseCliArgs` (lib.mjs 65-88) camel-cases flags and calls `exit(2)` on unknown args, so inject `exit` to get testability:
```js
export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...depsIn };
  const { log, errlog } = deps;
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) { log(HELP); return 0; }
```
`defaultDeps()` (lines 206-223) holds every side effect (runner, readText, writeText, removeFile, log, errlog, tmpdir). Copy this so tests inject fakes. Entrypoint guard (lines 406-414):
```js
if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    console.error(`ERROR: ${maskOutput(e?.message ?? e)}`); process.exit(1);
  });
}
```
Exit codes: 0 ok | 1 refused/failed | 2 bad args (repo-wide convention; 13 adds 4/5 for specific stops, 24 may add one for "deleted but not yet confirmed gone").

Output masking (13 lines 49-53): `maskOutput = redactPii(text).replace(JWT_RE, '[jwt]')`; also use `redactSecrets(text, [token, password])` from `lib-conn.mjs` lines 20-27 for anything touching a token or passphrase.

---

### `18-decom-guard.mjs` (utility, pure predicates + gate file)

**Analog 1:** `scripts/auth-merge/lib.mjs` `assertWriteAllowed` (lines 107-115) - throw-on-violation guard style:
```js
export function assertWriteAllowed({ projectRef, confirmRef } = {}) {
  assertProjectRefFormat(projectRef);
  if (projectRef === PROJECTS.ziko) {
    throw new Error('Refusing to write: ziko is the live source and is read-only in Phase 3');
  }
  if (projectRef === PROJECTS.portfolio && confirmRef !== PROJECTS.portfolio) {
    throw new Error('Refusing to write to portfolio without --confirm-ref equal to the portfolio ref');
  }
}
```
Important: this guard REFUSES ziko writes outright. Phase 7 scripts 19 and 24 must NOT call it for ziko; 18 provides narrow replacements (`assertZikoFreezeAllowed`, `assertDeleteAllowed`). Existing scripts (06/09/13/05/08) keep refusing ziko; do not weaken `lib.mjs`.

**Analog 2:** `13-cutover-delta.mjs` `checkAuthorization` (lines 57-63), exact-line match tolerant of trailing `\r` only:
```js
export function checkAuthorization(text, phrase) {
  const want = `Typed authorization: ${phrase}`;
  return String(text ?? '').split('\n').some((line) => line.replace(/\r$/, '') === want);
}
```
For D-15 the confirmation is a plain "yes" (not a typed phrase), so the planner should define a distinct line format in `07-AUTHORIZATIONS.md` (e.g. `Confirmation: yes` + `Timestamp:` + `Reply: "<verbatim>"`) and a sibling `checkConfirmation(text)` with the same exact-line semantics. Only the `confirmation_yes` gate reads it.

**Gate file** (RESEARCH Pattern 1): `baseline/decom-gates.json`, keys `freeze_proven, backup_encrypted, backup_second_copy, restore_proven, verify_pass, env_scopes_clean, scratch_deleted, ci_token_revoked, confirmation_yes`, each `{passed, at, evidence, sha256}`. Write with the JSON convention from 06-verify-data line 320: `` `${JSON.stringify(doc, null, 2)}\n` `` after `assertReportSafe(doc)`.

**Report safety** (`lib-verify.mjs` lines 480-492), import and call on every committed JSON:
```js
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
const FULL_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export function assertReportSafe(obj) { /* throws on email or full UUID */ }
```
Note `assertReportSafe` does not catch JWT fragments or secrets; add a JWT/`sbp_` check in 18 (CONTEXT grep gate: `@`, UUIDs, JWT fragments) reusing `JWT_RE` from 13 line 49.

---

### `19-decom-freeze.mjs` (script, privileged SQL, `--plan/--apply/--unfreeze/--status`)

**Analog:** `13-cutover-delta.mjs` gate ordering (lines 243-314): format-check refs -> role check -> mode check -> confirm-ref -> authorization -> only then side effects. Gate 1 there is "ziko can never be the target"; here invert to "target must equal `PROJECTS.ziko`, hard-coded, no `--project-ref` flag at all":
```js
// 13 lines 247-258 (shape to invert)
if (args.projectRef === PROJECTS.ziko) { errlog('ERROR: ziko can never be the target'); return 1; }
if (args.projectRef !== PROJECTS.portfolio && args.projectRef !== PROJECTS.scratch) { errlog('ERROR: ...'); return 2; }
if (args.mode !== 'plan' && args.mode !== 'apply') { errlog('ERROR: --mode plan|apply is required'); return 2; }
```
**SQL execution:** `runSql(ref, sql)` (lib.mjs 252-266): writes SQL to a temp file, `npx supabase db query --linked --project-ref <ref> --file`, returns rows of the LAST statement, errors pass through `redactPii`. Sequential use only. Always explicit `--project-ref` (RESEARCH Pitfall 11). Fixed statement set only (no free-form SQL param): snapshot query, `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role`, and unfreeze replaying the snapshot rows as per-table GRANTs. Build statements with the identifier discipline from `lib-data.mjs` (`quoteIdent`, lines 86-93 use it); reject names not matching an ident regex.

**Pure/evaluator split for tests:** make snapshot-diff (`T0 == T1`) and grant replay builders pure exported functions (same style as `evaluateCounts` in `lib-verify.mjs` 135, `evaluateTriggers` 184: `({rows}) -> {ok, detail, data}`); `main` only does I/O.

**Auth-config PATCH (disable signup):** copy the `api()` helper from `lib-conn.mjs` lines 33-44 (Bearer token, `fetchImpl` injectable), snapshot prior `disable_signup` first. Token from `loadAccessToken()` (lib.mjs 337-349).

---

### `20-decom-backup.mjs` (script, file-I/O + streaming)

**Analog 1 (connection):** `lib-conn.mjs` `connectClient` (lines 159-184) returns `{client, role, effective}` already `SET ROLE postgres`; password is nulled in `finally`. For `pg_dump` use the lower-level pieces: `createLoginRole` (47-66), `getSessionPooler` (91-105), `deleteLoginRoles` (69-77) in `finally`; pass credentials to the child via `env` (`PGHOST/PGUSER=<role>.<ref>/PGPASSWORD/PGSSLMODE`) and never build a URL (rule at lib-conn.mjs line 5). The 13 runner pattern for children:
```js
spawnSync(process.execPath /* or 'pg_dump' */, argv, { env: process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
```
Pass the passphrase for 7z/gpg via child stdin (`input:`), never argv (17-env-switch does the same for Vercel values: "handed to Vercel on stdin", `buildVercelCommands` `stdin: true`, lines 127-144; `defaultRun` line 228 takes `{input, cwd}`).

**Analog 2 (COPY layer):** `05-load-data.mjs` lines 71 and 495-500:
```js
const { to: copyTo, from: copyFrom } = copyStreams;   // import copyStreams from 'pg-copy-streams'
await pipeline(src.query(copyTo(buildCopyToSql(source, columns))), transform, dst.query(copyFrom(...)));
```
Use `copyTo('COPY public."<t>" TO STDOUT')` piped to `createWriteStream` plus a `createHash('sha256')` tee. `buildCopyToSql` in `lib-data.mjs` 86-88 is `COPY public.<quoteIdent> (cols) TO STDOUT`; reuse the quoting. Note `assertZikoTable` is applied only on the FROM side (target); do not reuse `buildCopyFromSql` for unprefixed restore (it asserts `ziko_` prefix).

**Analog 3 (storage export):** `08-copy-storage.mjs` helpers are NOT exported (RESEARCH). Lines to copy or extract into `lib-storage.mjs`: `OBJECTS_SQL` (221), `isRetryable`/`withRetry` (234-252), `mapPool` (254-263), `downloadBuffer` (265-271):
```js
async function downloadBuffer(client, bucket, name) {
  return withRetry(async () => {
    const { data, error } = await client.storage.from(bucket).download(name);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  });
}
```
Client creation: line 437 `createClient(`https://${run.sourceRef}.supabase.co`, srcKeys.secret, authOpts)` with `getProjectApiKeys(ref)` (lib.mjs 308-322). Checksums: `sha256Hex` from `lib-storage.mjs` line 437. Committed aggregate must use `maskObjectKey` (lib-storage 441) and `assertReportSafe`. The real object manifest stays inside the encrypted archive. If extracting helpers to `lib-storage.mjs`, existing `08-copy-storage.test.mjs` and `lib-storage.test.mjs` must stay green (RESEARCH per-wave gate).

**Archive location:** outside the repo (e.g. `C:\ziko-backups\...`), plus defense-in-depth `.gitignore` entry.

---

### `21-decom-restore-proof.mjs` (script, batch wipe/restore/verify)

**Analog:** `05-load-data.mjs` (transactional COPY with trigger handling, lines 485-514) + `06-verify-data.mjs` structure. Key reuse points:
- Trigger-safe loading: `SET LOCAL session_replication_role = replica` and verify it took (lines 490-493), or `buildTriggerToggleSql`.
- Count verify after load, ROLLBACK on mismatch (lines 503-514), `evaluateLoadedTable`.
- Hard ref assert: copy 13's gate shape but require `ref === PROJECTS.scratch` and refuse ziko and portfolio. Wipe-first guard: assert tables empty (count 0) and buckets empty immediately before restore, nonzero after (RESEARCH Pitfall 5).
- Storage upload: `uploadStrategy(cacheControl)` and `uploadObject` (08 lines 131, 273-300) for re-upload from archive.
- Verify evaluators: `evaluateHashes` / `evaluateObjects` in `lib-storage.mjs` (334, 376) take `{source,target,remap}` / pairs; pass an identity remap for a restore (no uuid remapping).
- D-07 deviation note: `06-verify-data` is prefix-bound (`buildTablePlan(loadRenameMap())`, `getPlan` line 121), so same-name comparison is a new evaluator; keep the report wording honest.

---

### `22-decom-verify.mjs` (script, read-only delta-aware verifier)

**Analog:** `06-verify-data.mjs` (exact structure to copy). Core pattern lines 112-117, 258-267, 279-331:
```js
const ok = (detail, data) => ({ ok: true, detail, data });
const fail = (detail, data) => ({ ok: false, detail, data });
const RUNNERS = { counts: checkCounts, rls: checkRls, ... };   // name -> async (ctx) => {ok, detail, data}
// main: for (const name of names) { try { r = await RUNNERS[name](ctx) } catch (err) { r = fail(`error: ${safeText(err.message)}`, null) } ... }
console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${name}: ${safeText(r.detail)}`);
// report: buildJsonReport({ targetRef, sourceRef, results }) -> assertReportSafe(report); writeFile(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`)
process.exit(allOk ? 0 : 1);
```
Arg block (lines 280-289): `'project-ref','source-ref',check,'remap-file',baseline,'json-out'`; `requireRef(args,'projectRef')` (lib.mjs 96-105, "no default ref"); `resolveChecks` throws `UsageError` -> exit 2; `--source-ref` must equal `PROJECTS.ziko` (line 82). Add: `--project-ref` must be portfolio (refuse ziko and scratch).

Safety text helper (line 115-117): `safeText = redactPii(...).replace(FULL_UUID_G, (u) => `${u.slice(0,8)}-…`).slice(0, 400)`.

Reuse rather than rewrite: call existing `06-verify-data --check rls|triggers|fk|orphans|tenants`, `09-verify-storage --check buckets|hashes|rekey|tenants`, `auth-merge/06-verify --check users|identities|tenants` as child steps via 13's `buildSteps`/`runSteps` composition (lines 91-175: step objects `{name, script, argv}`, runner returns `{status, stdout, stderr}`, stop at first non-zero, `extractCounts` keeps only numeric `key=value`). Use baselines exactly as the post-cutover run did: `baseline/portfolio-tenants-precutover.json`, `baseline/portfolio-storage-tenants-precutover.json`, `scripts/auth-merge/baseline/portfolio-baseline-precutover.json`. Do NOT use `--check counts` (strict equality, `evaluateCounts` lib-verify 135) and do NOT call `13-cutover-delta --mode apply` or `05-load-data --apply` (TRUNCATE ziko_*).

New piece (no analog): PK-subset gate (every ziko PK present in portfolio; classify extra portfolio rows via `created_at/updated_at` > flip times from `.planning/HANDOFF.json` `phase7_handoff_from_phase6`; tables without timestamps -> `unexplained-needs-review`, not pass). Tenant carve-out per D-11 matches `portfolio-cutover-final.json`: `sv_*` drift is explanatory only, `rh_/gecko_` changes must be 0. Model the final evidence report on `reports/portfolio-cutover-final.json` (keys: `tenants.{data,storage,auth}`, `integrity.{rls,triggers,fk,orphans}`, `leftovers`; RLS expectation "PASS 99/99", FK 144, orphans 0).

---

### `23-decom-env-audit.mjs` (script, read-only, CLI subprocess)

**Analog:** `17-env-switch.mjs`. Reuse (export or import) rather than copy:
- `fingerprint(value)` (line 63): `sha256(value).hex.slice(0, 8)`; output only names and 8-char fingerprints, never values.
- `ENV_MATRIX` (lines 30-47) for the name inventory per surface.
- `defaultRun(cmd, args, {input, cwd})` (228-231): `spawnSync(..., {encoding:'utf8', shell: process.platform==='win32', maxBuffer})`; `vercel env ls` / temp-dir `vercel link --cwd` pattern from `--verify-remote`; EAS pinned `EAS_CLI_VERSION = '24.10.0'` via `npx eas-cli@24.10.0`.
- `getProjectApiKeys(PROJECTS.ziko)` fingerprints to compare against Vercel pulled values; plus ref-substring boolean `value.includes(PROJECTS.ziko)`. Output `points_at_ziko: boolean` per `{project, environment, branch, name}`. Pulled values go to a gitignored tmp file (`.tmp-decom-*`, see .gitignore) removed in `finally`.
- Existing `--audit` is code-level only (`auditEnvNames`, line 177); `--verify-remote` checks names only. The value scan is new.
- Note `buildVercelCommands` (127-144) refuses Preview writes without `--git-branch` and has no `development` branch; any remediation (rm/overwrite) needs a new, narrow command builder with the same refusal style, or a human step. Prefer read-only audit + human-gated or typed-line-gated remediation.

---

### `24-decom-delete.mjs` (script, irreversible, fail-closed)

**Analog:** RESEARCH code example (shape already specified) composed with `13-cutover-delta.mjs` gate ordering and `lib-conn.mjs` `api()`/`fetchImpl` injection (lines 33-44, 47-66 for error-handling style `fail(message, [token])`).

Gate order to implement (each a distinct, unit-tested refusal that returns 1 before any network call):
1. `assertProjectRefFormat(ref)`; `ref === PROJECTS.ziko`; refuse `PROJECTS.portfolio`, `PROJECTS.scratch`.
2. `--confirm-ref === PROJECTS.ziko`.
3. Gate file: all 9 keys `passed === true`, evidence files exist, sha256 matches the recorded value.
4. `07-AUTHORIZATIONS.md` contains the D-15 confirmation line (read via injected `readText`, like 13 lines 299-313).
5. Pre-delete `GET /v1/projects/{ref}`: `name === 'ziko'` and id/ref match; record name/status/region for the log.
6. `DELETE`; never auto-retry (on 429 or error, GET the state first). Then poll `GET` until 404/absent (`--confirm-gone` separate mode); "200 with REMOVED/GOING_DOWN" = in progress.
7. Write deletion log (timestamp, ref, evidence pointers to backup manifest and verify report) through `assertReportSafe`. Final milestone action (DECOM-05).

Fallback: if API returns 403 (Vercel Marketplace-managed org, RESEARCH A2), the script has a `--confirm-gone`-only path so the human deletes via Vercel dashboard and Claude verifies and logs; the gates still apply.

Test shape: mocked `fetchImpl` records calls; assert that DELETE is never called in any refusal case (see test patterns below).

---

### Test files `18..24-*.test.mjs` (test, offline unit)

**Analogs:** `13-cutover-delta.test.mjs` and `lib-conn.test.mjs`. Runner: `node:test` + `node:assert/strict` (not vitest). Imports and fixtures (13.test lines 3-22): ref literals declared locally, fake zero-pattern UUIDs only (`00000000-0000-0000-0000-00000000000a`), no real data.

Injected-dependency harness (13.test lines 39-69), copy verbatim in spirit:
```js
function fakeRunner(script = {}) {
  const calls = [];
  const runner = (step) => { calls.push(step); const r = script[step.name] ?? {};
    return { status: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }; };
  runner.calls = calls; return runner;
}
function makeDeps({ script = {}, files = {} } = {}) {
  const runner = fakeRunner(script); const written = {};
  return { runner, written, tmpdir: 'tmp', log: () => {}, errlog: () => {},
    readText: async (p0) => { const p = String(p0).replaceAll('\\', '/'); if (p in files) return files[p]; throw new Error(`ENOENT ${p}`); },
    writeText: async (p, t) => { written[p] = t; }, removeFile: async () => {} };
}
```
Refusal tests assert both exit code and zero side effects (13.test D4, lines 122-130):
```js
assert.equal(await run(argvNoFile, noFile), 1);
assert.equal(noFile.runner.calls.length, 0);
```
Network mocking (lib-conn.test lines 15-22, 62-69): recorder `fetchImpl` returning `{ok, status, json}`; test that invalid refs reject before any fetch (`assert.equal(calls.length, 0)`). Apply to 24: for wrong ref, portfolio, scratch, wrong confirm-ref, wrong project name, any gate false, missing evidence: `calls.filter(c => c[1]?.method === 'DELETE').length === 0`.

Secret-redaction test style (lib-conn.test 40-47): assert token/passphrase never appear in output and `[secret]` marker appears. Exact-line authorization tests (13.test D3, 113-120): trailing text, leading space, prefix text, and an abort line must all be false.

Pure evaluators get table-driven tests (RESEARCH DECOM-03 map): portfolio>=ziko passes, ziko-only PK fails, unexplained diff fails, `sv_*` excluded, `rh_/gecko_` regression fails; freeze T0==T1 fails on any diff; grant snapshot -> replay symmetric.

Run commands (RESEARCH Validation): `node --test scripts/portfolio-migration/18-decom-guard.test.mjs scripts/portfolio-migration/24-decom-delete.test.mjs`; full `node --test scripts/portfolio-migration/ scripts/auth-merge/`.

---

### `RUNBOOK.md` Phase 7 section (docs)

**Analog:** `scripts/portfolio-migration/RUNBOOK.md` section "Phase 6 - Cutover" (line 277+): header, "Refs:" line (ziko/portfolio/scratch), "Scripts:" list, pointer to manual checklist, then numbered subsections `6.1 Prerequisites`, `6.2 Order`, ... Follow as `## Phase 7 - Monitoring & Decommission` with `7.1 Prerequisites` (PAT in `scripts/auth-merge/.access-token`, scoop postgresql, 7z, CA at `.ca/supabase-ca.crt`), `7.2 Order` (freeze -> backup -> restore proof -> verify -> env/CI cleanup -> D-15 -> delete -> credential retirement -> log), and a final note that migration scripts hard-coding the ziko ref are historical after deletion. Edit with file tools, preserve CRLF/encoding.

### `.gitignore` (config)

**Analog:** lines 44-53 block style: comment line stating phase and "never commit", then paths. Add `scripts/portfolio-migration/.tmp-decom-*` is already covered by `scripts/portfolio-migration/.tmp-*` (line 49); add explicit defense-in-depth for backup paths (e.g. `ziko-backups/`, `*.7z`, `*.dump` near the repo) with a `# Phase 7 decommission backup - PII, never commit` comment. `scripts/auth-merge/.access-token` and `.vercel-bypass` are already ignored.

### `07-AUTHORIZATIONS.md` (docs)

**Analog:** `06-cutover/06-AUTHORIZATIONS.md`. Copy structure: title, "Append-only", `## Rules` (block of lines: authorization line, timestamp, `Reply: "<verbatim user reply>"`; Claude never writes an approve line that is not the user's verbatim reply; never edit earlier blocks), "phrases are documentation only", example lines prefixed `Phrase:` so no line starts with the approval prefix, then `## Log` with `### 07-NN <step>` blocks. Block format from lines 39-42:
```
### 06-13 final delta
Typed authorization: approve ubxllsvanurkwkohzxau option-cutover-delta
Timestamp: 2026-10-03T13:51:10Z
Reply: "approve ubxllsvanurkwkohzxau option-cutover-delta"
```
Phase 7 specifics: D-15 is a plain "yes" at its own checkpoint, so record e.g. `Confirmation: yes (delete ziko slkobhavpwsubnsmuhya)`, still with `Timestamp:` and `Reply:`; never bundle it with freeze/backup approvals (those, if logged, get their own blocks). Note 06 also records non-phrase decisions (06-17 `verify-secrets: scratch`, 06-19 `Release decision:`), a precedent for logging CI-target (Open Question 2) and waiver decisions here.

### `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` (hand edits, CRLF, UTF-8)

**Analog:** Phase 6 close commit `3e1ad0c7` and its wording. REQUIREMENTS traceability row style (REQUIREMENTS.md line 106):
`| CUTOVER-03 | Phase 6 - Cutover | Complete with waiver, user closed 2026-10-04 (<rationale>) |`
Current DECOM rows (lines 109-113) are `Pending`. DECOM-01 must read waived, never complete (D-01), e.g. `| DECOM-01 | Phase 7 - Monitoring & Decommission | WAIVED by user 2026-10-04 (no real mobile users, 39 profiles, 0 new accounts since flip) |`, and the checkbox on line 57 should not be ticked as done. ROADMAP waiver style (ROADMAP line 148): `- [x] <item> (WAIVED, <reason>. <evidence>)`, with the `**Status: CLOSED <date> by user decision, with waivers**` block (line 160) and the phase table row (line 210). File is `Unicode text, CRLF`: use Edit/Write file tools, never heredoc/sed; do not use `gsd-sdk` handlers that overstate completion (CONTEXT).

### Evidence reports `reports/decom-*.json` and `baseline/decom-*.json`

**Analog:** `reports/portfolio-cutover-final.json` (hand-shaped summary, `generated_at`, `target`, result strings, counts, explanations, no emails/UUIDs) and `buildJsonReport` in 06-verify-data (lines 94-110: `generated_at`, `target_ref`, `source_ref`, `passed`, `checks{name:{ok,detail,data}}`, `assertReportSafe(report)` before write). Tenant baselines in `baseline/` are the model for any frozen-state snapshot (counts per table, no row text). Grant snapshot (`decom-ziko-grants-prefreeze.json`): role, table, privilege only. Stage `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` (currently untracked) after a PII grep.

## Shared Patterns

### Ref-lock and write guards
**Source:** `scripts/auth-merge/lib.mjs` lines 29-33, 90-115; `13-cutover-delta.mjs` lines 236-314
**Apply to:** all of 18-24
Rules: no default ref, `assertProjectRefFormat` first, refs only from `PROJECTS`, `--confirm-ref` for every write, refuse the other two projects explicitly. Existing guards are ziko-write-refusing; Phase 7 adds narrow ziko-only paths (19 freeze, 24 delete) with fixed statement sets and hard-coded ref, each unit-tested for refusing portfolio/scratch.

### Credential handling
**Source:** `lib-conn.mjs` lines 1-10, 20-27, 159-184; `lib.mjs` `loadAccessToken` 337-349
**Apply to:** 19, 20, 21, 22, 24
Short-lived login role in memory, session pooler port 5432 only, TLS verification on (CA via `.ca/supabase-ca.crt`, `caPem`), no URLs, `redactSecrets(msg, [token, password])` on every thrown error, `deleteLoginRoles` in `finally`, passphrase and values on stdin/env never argv or logs. Token from `SUPABASE_ACCESS_TOKEN` or gitignored `scripts/auth-merge/.access-token`.

### PII-free reporting
**Source:** `lib-verify.mjs` 480-492 (`assertReportSafe`, `maskUuid`), `lib.mjs` 123-138 (`redactPii`), `lib-storage.mjs` 441 (`maskObjectKey`), `06-verify-data.mjs` 115-117 (`safeText`)
**Apply to:** every committed JSON and every log line
Add JWT/`sbp_`/passphrase patterns on top (gap in `assertReportSafe`).

### Check result shape and exit codes
**Source:** `06-verify-data.mjs` 112-113, 306-323
**Apply to:** 19 (`--status --prove`), 21 (`--verify`), 22, 23
`{ok, detail, data}` per check, `[PASS]/[FAIL] name: detail` lines, final `VERIFICATION PASSED|FAILED`, exit 0/1, usage errors 2.

### Composing child scripts
**Source:** `13-cutover-delta.mjs` `buildSteps` / `runSteps` / `defaultDeps.runner` (91-175, 206-223)
**Apply to:** 22 (reuse 06/09/auth-merge verifiers), optionally 21
Step objects, `extractCounts`, stop on first non-zero, summary JSON written via injected `writeText`.

### Retry/concurrency for network I/O
**Source:** `08-copy-storage.mjs` 230-263 (`RETRY_DELAYS_MS`, `withRetry`, `mapPool`)
**Apply to:** 20, 21 (storage export/re-upload), 22 hash compare. Do not retry the Management API DELETE (24).

## No Analog Found

| File / Behavior | Role | Data Flow | Reason |
|---|---|---|---|
| Delta-aware PK-subset comparison in 22 | evaluator | transform | All existing verifiers assert strict equality or tenant baselines; new pure evaluator, test per RESEARCH DECOM-03 row |
| `pg_dump -Fc` / `pg_restore` orchestration in 20/21 | script | streaming (child process) | No pg client tools used anywhere yet; only Node `pg` + `pg-copy-streams`. Use RESEARCH Q3 guidance and the Wave 0 spike |
| Archive encryption (7z/gpg, stdin passphrase) in 20 | utility | file-I/O | No encryption code in repo; closest stdin-secret handoff is 17-env-switch Vercel `stdin: true` |
| Management API `DELETE /v1/projects/{ref}` and post-delete polling in 24 | script | request-response | No project-level API calls beyond login-role/pooler in `lib-conn.mjs`; follow its `api()` helper and RESEARCH Q1 |
| Reversible grant freeze with snapshot/replay in 19 | script | batch | No REVOKE/GRANT scripts exist; closest are `buildTriggerToggleSql` (05-load-data) for symmetric toggle SQL builders |
| Vercel/EAS value audit by fingerprint in 23 | script | request-response | 17-env-switch only checks names remotely; value scan is new but reuses `fingerprint` |
| Scratch wipe (DB + auth + storage) in 21 | script | batch | Nothing deletes objects or drops schemas; note `lib-storage.mjs` has `findDeleteCalls` (line 462), a guard that scans for delete calls in copy scripts, so any new delete/wipe code must live in 21 only and must not be imported by 08/09 |

## Metadata

**Analog search scope:** `scripts/portfolio-migration/`, `scripts/auth-merge/`, `.planning/workstreams/supabase-portfolio-migration/phases/06-cutover/`, `.gitignore`, `reports/`, `baseline/`
**Files scanned/read:** 13-cutover-delta (+test), auth-merge/lib.mjs, lib-conn (+test), 17-env-switch (head), 06-verify-data (80-339), lib-verify (report safety), 08-copy-storage (helpers), 05-load-data (COPY), 06-AUTHORIZATIONS.md, RUNBOOK Phase 6 head, REQUIREMENTS/ROADMAP waiver wording, portfolio-cutover-final.json
**Pattern extraction date:** 2026-10-04

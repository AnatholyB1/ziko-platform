/**
 * Test-account purge — guarded Admin API deletion of exactly the reviewed,
 * hashed, freshly-exported manifest set.
 *
 * Usage: node scripts/purge-test-accounts/delete.mjs --manifest <path> --confirm
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * THIS SCRIPT IS IRREVERSIBLE. It is run once, by one person, after a second
 * person has reviewed the dry-run report — Pitfall 13 step 6's two-person
 * rule. Every deletion goes through the same `admin.auth.admin.deleteUser()`
 * call already proven in `apps/web/src/actions/account.ts:84-85`; no raw
 * bulk SQL statement against the auth schema exists anywhere in this file
 * (PURGE-04). The id set acted on comes exclusively from the manifest's
 * `candidate_ids` — this module never re-derives or re-enumerates a
 * candidate set of its own (D-02).
 *
 * `confirm` defaults to false and is set only by the literal `--confirm`
 * flag: that default is the D-03 property that makes the ordinary
 * invocation inert. Per D-03, no task in this phase runs this script
 * against a real Supabase project — it is proven against injected fakes
 * only.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPurgeAdminClient } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI argument parsing ────────────────────────────────────────────────

/**
 * Parses `--manifest <path>`, `--confirm`, `--accept-unknown-pitr`,
 * `--max-manifest-age-minutes <n>` (default 60) and `--out <dir>` (default
 * the export directory resolved from this module's own location).
 * `confirm` and `acceptUnknownPitr` are booleans set only by the literal
 * flag — there is no way to default either to true.
 * @param {string[]} argv
 * @returns {{ manifestPath: string | null, confirm: boolean, acceptUnknownPitr: boolean, maxManifestAgeMinutes: number, outDir: string }}
 */
export function parsePurgeArgs(argv) {
  const manifestIdx = argv.indexOf('--manifest');
  const manifestPath = manifestIdx !== -1 && argv[manifestIdx + 1] ? argv[manifestIdx + 1] : null;

  const confirm = argv.includes('--confirm');
  const acceptUnknownPitr = argv.includes('--accept-unknown-pitr');

  const maxAgeIdx = argv.indexOf('--max-manifest-age-minutes');
  const maxManifestAgeMinutes =
    maxAgeIdx !== -1 && argv[maxAgeIdx + 1] !== undefined ? Number(argv[maxAgeIdx + 1]) : 60;

  const outIdx = argv.indexOf('--out');
  const outDir = outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : join(__dirname, 'exports');

  return { manifestPath, confirm, acceptUnknownPitr, maxManifestAgeMinutes, outDir };
}

// ── Manifest integrity guard (T-02-15, T-02-17, T-02-18) ────────────────

/**
 * Pure guard: accumulates every failing check rather than returning on the
 * first, so a single run of this function reports the manifest's complete
 * failure surface. The hash check binds this run to the exact row set a
 * human actually reviewed (D-02) — without it the manifest is just a file
 * anyone could widen between review and execution (T-02-15). The age check
 * stops an export from yesterday standing in for a backup taken minutes ago
 * (Pitfall 13 step 3, T-02-17). The PITR check converts a silent
 * `unknown` assumption into a recorded operator decision (D-04, T-02-18).
 * @param {{ manifest: object, now: Date, maxAgeMinutes: number, acceptUnknownPitr: boolean, fileExists: (path: string) => boolean }} args
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertManifestIntegrity({ manifest, now, maxAgeMinutes, acceptUnknownPitr, fileExists }) {
  const errors = [];
  const candidateIds = Array.isArray(manifest?.candidate_ids) ? manifest.candidate_ids : [];

  if (candidateIds.length === 0) {
    errors.push('manifest candidate_ids is empty — nothing to delete, refusing to run');
  }

  const recomputedHash = createHash('sha256').update(candidateIds.join('\n')).digest('hex');
  if (recomputedHash !== manifest?.candidate_ids_sha256) {
    errors.push(
      `manifest candidate_ids_sha256 mismatch: recomputed ${recomputedHash}, recorded ${manifest?.candidate_ids_sha256} — the manifest may have been widened after review`
    );
  }

  if (!fileExists(manifest?.export_csv)) {
    errors.push(`manifest export_csv is missing from disk: ${manifest?.export_csv}`);
  }

  const generatedAtMs = Date.parse(manifest?.generated_at ?? '');
  if (Number.isNaN(generatedAtMs)) {
    errors.push(`manifest generated_at is not a valid timestamp: ${manifest?.generated_at}`);
  } else {
    const ageMinutes = (now.getTime() - generatedAtMs) / 60000;
    if (ageMinutes > maxAgeMinutes) {
      errors.push(
        `manifest is ${ageMinutes.toFixed(1)} minutes old, exceeding the ${maxAgeMinutes}-minute limit — a stale export cannot stand in for a fresh backup`
      );
    }
  }

  if (manifest?.pitr?.status === 'unknown' && !acceptUnknownPitr) {
    errors.push(
      'manifest PITR status is unknown — pass --accept-unknown-pitr to proceed with an explicit acknowledgement (D-04)'
    );
  }

  return { ok: errors.length === 0, errors };
}

// ── Deletion loop (D-02, D-03, T-02-16, T-02-20, T-02-21) ────────────────

/**
 * Takes its id set from `manifest.candidate_ids` and nowhere else — this
 * function is given no client and no enumeration function, so re-deriving a
 * candidate set is not merely discouraged, it is impossible (T-02-21). When
 * `confirm` is false, `deleteAccount` is never invoked (T-02-16) — this is
 * the inert default invocation D-03 requires. When true, iterates the ids in
 * manifest order, awaits one call per id, records every outcome, and
 * continues past a failure rather than aborting (T-02-20).
 * @param {{ manifest: object, deleteAccount: (id: string) => Promise<{ error: { message?: string } | null }>, confirm: boolean, now?: () => Date }} args
 * @returns {Promise<object>}
 */
export async function runDelete({ manifest, deleteAccount, confirm, now = () => new Date() }) {
  const candidateIds = manifest.candidate_ids;

  if (!confirm) {
    return {
      confirmed: false,
      run_at: now().toISOString(),
      attempted: 0,
      succeeded: 0,
      failed: [],
      planned: candidateIds,
    };
  }

  const results = [];
  const failed = [];
  let succeeded = 0;

  for (const id of candidateIds) {
    let outcome;
    try {
      outcome = await deleteAccount(id);
    } catch (err) {
      outcome = { error: { message: err instanceof Error ? err.message : String(err) } };
    }
    const error = outcome?.error ?? null;
    const ok = !error;
    const errorMessage = error ? error.message ?? String(error) : null;

    results.push({ id, ok, error: errorMessage });
    if (ok) {
      succeeded += 1;
    } else {
      failed.push({ id, error: errorMessage });
    }
  }

  return {
    confirmed: true,
    run_at: now().toISOString(),
    attempted: candidateIds.length,
    succeeded,
    failed,
    results,
  };
}

// ── Delete log (T-02-20) ─────────────────────────────────────────────────

/**
 * Writes `result` (the full per-row outcome set, plus the manifest path and
 * hash the caller merges in) as `delete-log-<timestamp>.json` under
 * `outDir` (created recursively), and returns the path written. A per-row
 * failure recorded here but never persisted would be unauditable — this is
 * the write side of T-02-20's mitigation.
 * @param {object} result
 * @param {string} outDir
 * @returns {Promise<string>}
 */
export async function writeDeleteLog(result, outDir) {
  const resolvedOutDir = resolve(outDir);
  await mkdir(resolvedOutDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/:/g, '-');
  const logPath = join(resolvedOutDir, `delete-log-${stamp}.json`);
  await writeFile(logPath, JSON.stringify(result, null, 2), 'utf8');

  return logPath;
}

// ── CLI ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parsePurgeArgs(process.argv.slice(2));

  if (!args.manifestPath) {
    console.error('Missing required --manifest <path>');
    console.error('Usage: node scripts/purge-test-accounts/delete.mjs --manifest <path> --confirm');
    process.exit(1);
    return;
  }

  const resolvedManifestPath = resolve(args.manifestPath);
  const manifest = JSON.parse(await readFile(resolvedManifestPath, 'utf8'));

  const integrity = assertManifestIntegrity({
    manifest,
    now: new Date(),
    maxAgeMinutes: args.maxManifestAgeMinutes,
    acceptUnknownPitr: args.acceptUnknownPitr,
    fileExists: existsSync,
  });

  if (!integrity.ok) {
    console.error('Test-account purge — delete: manifest failed integrity checks, nothing was touched:');
    for (const err of integrity.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
    return;
  }

  if (!args.confirm) {
    console.log('Test-account purge — delete: --confirm not set, this is a dry inspection only.');
    console.log(`  planned deletions (${manifest.candidate_ids.length}):`);
    for (const id of manifest.candidate_ids) {
      console.log(`    ${id}`);
    }
    console.log('  Pass --confirm to actually delete these accounts.');
    process.exit(0);
    return;
  }

  // The exact call already proven in production, apps/web/src/actions/account.ts:84-85.
  // Unlike that web action, which swallows the error for anti-enumeration
  // reasons, every per-row outcome here is logged verbosely — this is an
  // operational tool, and a silent failure is what makes a purge
  // unauditable (T-02-20).
  const client = createPurgeAdminClient();
  const deleteAccount = (id) => client.auth.admin.deleteUser(id);

  const result = await runDelete({ manifest, deleteAccount, confirm: true });

  const logPayload = {
    ...result,
    manifest_path: resolvedManifestPath,
    manifest_hash: manifest.candidate_ids_sha256,
    written_at: new Date().toISOString(),
  };
  const logPath = await writeDeleteLog(logPayload, args.outDir);

  console.log('Test-account purge — delete');
  console.log(`  attempted:  ${result.attempted}`);
  console.log(`  succeeded:  ${result.succeeded}`);
  console.log(`  failed:     ${result.failed.length}`);
  if (result.failed.length > 0) {
    console.log('  failed ids:');
    for (const f of result.failed) {
      console.log(`    ${f.id}: ${f.error}`);
    }
  }
  console.log(`  log written to: ${logPath}`);

  process.exit(result.failed.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('delete failed:', err.message);
    process.exit(1);
  });
}

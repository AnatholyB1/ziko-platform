/**
 * Test-account purge — pre-delete row export with a hashed manifest.
 *
 * Usage: node scripts/purge-test-accounts/export.mjs --report <path> [--out <dir>]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * D-04: this export is the unconditional primary safety net for the purge —
 * it runs regardless of PITR status, and it never re-derives its own
 * candidate set. It reads `report.to_delete` exactly as the human reviewed
 * it (D-02) and nothing else. The manifest it writes carries a SHA-256 over
 * that exact id list; plan 02-03's delete step recomputes the hash and
 * refuses to run on a mismatch (T-02-08).
 *
 * This module contains no destructive Admin API call and no raw SQL against
 * the auth schema — it is read-only against Supabase, writing only to the
 * local git-ignored export directory.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPurgeAdminClient } from './lib.mjs';
import { checkPitrStatus } from './pitr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Column order is a contract with plan 02-03 and the two-person review step
// — do not reorder without updating both.
const CSV_HEADER =
  'user_id,email,created_at,last_sign_in_at,tier,subscription_tier,profile_created_at,waitlist_emails';

// Mirrors CROSS_LINK_BATCH_SIZE in lib.mjs — the same PostgREST URL-length
// limit applies to `.in()` calls here.
const CHUNK_SIZE = 200;

/** @param {string[]} arr @param {number} size @returns {string[][]} */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Renders a CSV field, quoting when it contains a comma, quote, or newline.
 * Also neutralizes a leading `=`, `+`, `-`, or `@` (OWASP CSV-injection
 * trigger characters) with a leading `'` before quoting, since this CSV is
 * read by a human in Excel/Sheets as part of the two-person review gate
 * (WR-02) and the email/waitlist_emails columns are attacker-influenceable
 * data.
 */
function csvField(value) {
  let str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`; // neutralize formula injection
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** @param {object} row @returns {string} */
function rowToCsvLine(row) {
  return [
    row.user_id,
    row.email,
    row.created_at,
    row.last_sign_in_at,
    row.tier,
    row.subscription_tier,
    row.profile_created_at,
    row.waitlist_emails,
  ]
    .map(csvField)
    .join(',');
}

/** @param {string} waitlistEmails @returns {string[]} */
function splitWaitlistEmails(waitlistEmails) {
  return waitlistEmails ? waitlistEmails.split(';').filter(Boolean) : [];
}

// ── Row collection (D-02) ───────────────────────────────────────────────

/**
 * Reads the exact candidate set from `report.to_delete` — never re-queries
 * for candidates, since the whole point of D-02 is that the human reviewed
 * one specific row set and this pipeline acts on that set and nothing else.
 * Joins the injected profile and waitlist fetchers in memory, keyed by id
 * and by lowercased email, emitting one row per `to_delete` entry in report
 * order. A missing profile is an orphan state worth capturing, not an
 * error — its profile-derived columns come back as empty strings.
 * @param {{ report: object, fetchProfiles: (ids: string[]) => Promise<Array<{id: string, tier?: string, subscription_tier?: string, created_at?: string}>>, fetchWaitlistRows: (emails: string[]) => Promise<Array<{email?: string}>> }} args
 * @returns {Promise<Array<{user_id: string, email: string, created_at: string, last_sign_in_at: string, tier: string, subscription_tier: string, profile_created_at: string, waitlist_emails: string}>>}
 */
export async function collectExportRows({ report, fetchProfiles, fetchWaitlistRows }) {
  const toDelete = report.to_delete ?? [];
  const ids = toDelete.map((c) => c.id);
  const emails = toDelete
    .map((c) => (typeof c.email === 'string' ? c.email.toLowerCase() : ''))
    .filter(Boolean);

  const profiles = ids.length ? await fetchProfiles(ids) : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const waitlistRows = emails.length ? await fetchWaitlistRows(emails) : [];
  const waitlistEmailsByKey = new Map();
  for (const row of waitlistRows) {
    if (typeof row.email !== 'string' || !row.email) continue;
    const key = row.email.toLowerCase();
    const existing = waitlistEmailsByKey.get(key) ?? [];
    existing.push(row.email);
    waitlistEmailsByKey.set(key, existing);
  }

  return toDelete.map((candidate) => {
    const profile = profileById.get(candidate.id);
    const email = typeof candidate.email === 'string' ? candidate.email : '';
    const matchedWaitlistEmails = waitlistEmailsByKey.get(email.toLowerCase()) ?? [];

    return {
      user_id: candidate.id,
      email,
      created_at: candidate.created_at ?? '',
      // Not present in the DryRunReport's to_delete shape (id/email/created_at
      // only) — kept honest as empty rather than guessed. See plan 02-02
      // SUMMARY.md "Known Stubs" for the rationale.
      last_sign_in_at: candidate.last_sign_in_at ?? '',
      tier: profile?.tier ?? '',
      subscription_tier: profile?.subscription_tier ?? '',
      profile_created_at: profile?.created_at ?? '',
      waitlist_emails: matchedWaitlistEmails.join(';'),
    };
  });
}

// ── Manifest (T-02-08) ──────────────────────────────────────────────────

/**
 * Builds the export manifest binding the reviewed candidate set to this
 * export via a SHA-256 over every safety-relevant field
 * `assertManifestIntegrity` gates on — `candidate_ids`, `generated_at` (the
 * staleness check, T-02-17), and `pitr` (the unknown-PITR acknowledgement
 * gate, T-02-18) — not just the id list (WR-01). Hashing only
 * `candidate_ids` would let `generated_at` or `pitr.status` be edited on
 * disk without tripping the "manifest may have been widened" error. Plan
 * 02-03 recomputes this hash the same way and refuses to act on a mismatch,
 * so a manifest edited between review and execution cannot pass.
 * @param {{ report: object, reportPath: string, csvPath: string, rows: Array<object>, pitr: {status: string, checked_at: string, detail: string}, now?: () => Date }} args
 * @returns {object}
 */
export function buildManifest({ report, reportPath, csvPath, rows, pitr, now = () => new Date() }) {
  const candidateIds = (report.to_delete ?? []).map((c) => c.id);
  const generated_at = now().toISOString();
  const manifestSha256 = createHash('sha256')
    .update(JSON.stringify({ candidate_ids: candidateIds, generated_at, pitr }))
    .digest('hex');

  const profilesFound = rows.filter(
    (r) => r.tier !== '' || r.subscription_tier !== '' || r.profile_created_at !== ''
  ).length;
  const waitlistRowCount = rows.reduce(
    (sum, r) => sum + splitWaitlistEmails(r.waitlist_emails).length,
    0
  );

  return {
    generated_at,
    source_report: resolve(reportPath),
    export_csv: resolve(csvPath),
    candidate_ids: candidateIds,
    manifest_sha256: manifestSha256,
    counts: {
      accounts: rows.length,
      profiles: profilesFound,
      waitlist_rows: waitlistRowCount,
    },
    pitr,
  };
}

// ── Disk write (T-02-11) ────────────────────────────────────────────────

/**
 * Writes the CSV and the manifest to `outDir` (created recursively). File
 * names are stamped from `manifest.generated_at`, mirroring `writeReport`
 * in lib.mjs. The manifest written to disk always carries the exact
 * `export_csv` path it was written to, regardless of what was passed into
 * `buildManifest` — this guarantees the file the manifest points at always
 * exists.
 * @param {{ rows: Array<object>, manifest: object, outDir: string }} args
 * @returns {Promise<{ csvPath: string, manifestPath: string }>}
 */
export async function writeExport({ rows, manifest, outDir }) {
  const resolvedOutDir = resolve(outDir);
  await mkdir(resolvedOutDir, { recursive: true });

  const stamp = manifest.generated_at.replace(/:/g, '-');
  const csvPath = join(resolvedOutDir, `export-${stamp}.csv`);
  const manifestPath = join(resolvedOutDir, `export-${stamp}.manifest.json`);

  const csvBody = [CSV_HEADER, ...rows.map(rowToCsvLine)].join('\n') + '\n';
  await writeFile(csvPath, csvBody, 'utf8');

  const finalManifest = { ...manifest, export_csv: csvPath };
  await writeFile(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf8');

  return { csvPath, manifestPath };
}

// ── Supabase-bound fetchers (CLI only — not exported, not used by tests) ──

function bindFetchProfiles(client) {
  return async (ids) => {
    const rows = [];
    for (const batch of chunk(ids, CHUNK_SIZE)) {
      const { data, error } = await client
        .from('user_profiles')
        .select('id, tier, subscription_tier, created_at')
        .in('id', batch);
      if (error) {
        throw new Error(`export: user_profiles query failed: ${error.message}`);
      }
      rows.push(...(data ?? []));
    }
    return rows;
  };
}

function bindFetchWaitlistRows(client) {
  return async (emails) => {
    const rows = [];
    for (const batch of chunk(emails, CHUNK_SIZE)) {
      const { data, error } = await client.from('waitlist_signups').select('email').in('email', batch);
      if (error) {
        throw new Error(`export: waitlist_signups query failed: ${error.message}`);
      }
      rows.push(...(data ?? []));
    }
    return rows;
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const reportIdx = argv.indexOf('--report');
  const reportPath = reportIdx !== -1 ? argv[reportIdx + 1] : null;
  if (!reportPath) {
    console.error('Usage: node scripts/purge-test-accounts/export.mjs --report <path> [--out <dir>]');
    process.exit(1);
  }

  const outIdx = argv.indexOf('--out');
  const outDir = outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : join(__dirname, 'exports');

  return { reportPath, outDir };
}

async function main() {
  const { reportPath, outDir } = parseArgs(process.argv.slice(2));
  const resolvedReportPath = resolve(reportPath);
  const report = JSON.parse(await readFile(resolvedReportPath, 'utf8'));

  const client = createPurgeAdminClient();
  const fetchProfiles = bindFetchProfiles(client);
  const fetchWaitlistRows = bindFetchWaitlistRows(client);

  // Rows are collected before PITR is checked (T-02-13) — a hanging
  // Management API can never prevent the export from having gathered its
  // data.
  const rows = await collectExportRows({ report, fetchProfiles, fetchWaitlistRows });

  const pitr = await checkPitrStatus({
    supabaseUrl: process.env.SUPABASE_URL,
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
  });
  console.log(`  pitr status: ${pitr.status} (${pitr.detail})`);

  const stampDate = new Date();
  const stamp = stampDate.toISOString().replace(/:/g, '-');
  const resolvedOutDir = resolve(outDir);
  const plannedCsvPath = join(resolvedOutDir, `export-${stamp}.csv`);

  const manifest = buildManifest({
    report,
    reportPath: resolvedReportPath,
    csvPath: plannedCsvPath,
    rows,
    pitr,
    now: () => stampDate,
  });

  const { csvPath, manifestPath } = await writeExport({ rows, manifest, outDir: resolvedOutDir });

  console.log('Test-account purge — export');
  console.log(`  accounts:       ${rows.length}`);
  console.log(`  profiles found: ${manifest.counts.profiles}`);
  console.log(`  waitlist rows:  ${manifest.counts.waitlist_rows}`);
  console.log(`  csv written to:      ${csvPath}`);
  console.log(`  manifest written to: ${manifestPath}`);

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('export failed:', err.message);
    process.exit(1);
  });
}

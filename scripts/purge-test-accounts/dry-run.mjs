#!/usr/bin/env node
/**
 * Read-only dry-run for the test-account purge — enumerates auth.users,
 * applies the @ziko-app.com criterion (D-01), detects cross-links to real
 * accounts (D-05), and writes a review report to disk.
 *
 * Usage: node scripts/purge-test-accounts/dry-run.mjs [--out <dir>]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This file imports nothing capable of removing an account and performs no
 * write against Supabase — it is read-only by construction.
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  createPurgeAdminClient,
  listAllUsers,
  fetchCrossLinks,
  runDryRun,
  writeReport,
} from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseOutDir(argv) {
  const idx = argv.indexOf('--out');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return join(__dirname, 'exports');
}

async function main() {
  const outDir = parseOutDir(process.argv.slice(2));
  const client = createPurgeAdminClient();

  const report = await runDryRun({
    listUsers: () => listAllUsers(client),
    fetchCrossLinks: (candidateIds) => fetchCrossLinks(client, candidateIds),
  });

  const { jsonPath, csvPath } = await writeReport(report, outDir);

  console.log('Test-account purge — dry run');
  console.log(`  users_scanned:        ${report.totals.users_scanned}`);
  console.log(`  candidates:           ${report.totals.candidates}`);
  console.log(`  flagged_cross_linked: ${report.totals.flagged_cross_linked}`);
  console.log(`  to_delete:            ${report.totals.to_delete}`);
  if (report.totals.flagged_cross_linked > 0) {
    console.log(
      `  ⚠ ${report.totals.flagged_cross_linked} candidate(s) flagged as cross-linked to a real account — excluded from to_delete, see report`
    );
  }
  console.log(`  report written to:    ${jsonPath}`);
  if (csvPath) console.log(`  csv written to:       ${csvPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('dry-run failed:', err.message);
  process.exit(1);
});

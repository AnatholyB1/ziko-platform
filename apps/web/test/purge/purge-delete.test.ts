// Phase 02-03 — guarded Admin API deletion (task 1), extended with
// post-purge reconciliation proofs (task 2). Imports the .mjs modules by
// relative path across the workspace boundary into the root scripts folder,
// mirroring apps/web/test/purge/purge-export.test.ts (phase 02-02).
import { describe, expect, it, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parsePurgeArgs,
  assertManifestIntegrity,
  runDelete,
  writeDeleteLog,
} from '../../../../scripts/purge-test-accounts/delete.mjs';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function sha256(ids: string[]): string {
  return createHash('sha256').update(ids.join('\n')).digest('hex');
}

function makeManifest(overrides: Record<string, unknown> = {}) {
  const candidateIds = ['a', 'b', 'c'];
  return {
    generated_at: '2026-08-13T12:00:00.000Z',
    source_report: '/tmp/report.json',
    export_csv: '/tmp/export.csv',
    candidate_ids: candidateIds,
    candidate_ids_sha256: sha256(candidateIds),
    counts: { accounts: 3, profiles: 0, waitlist_rows: 0 },
    pitr: { status: 'enabled', checked_at: '2026-08-13T12:00:00.000Z', detail: 'Management API reported pitr_enabled=true' },
    ...overrides,
  };
}

const NOW = new Date('2026-08-13T12:30:00.000Z'); // 30 minutes after generated_at
const alwaysExists = () => true;

describe('parsePurgeArgs', () => {
  it('parses --manifest, --confirm and --accept-unknown-pitr', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--confirm', '--accept-unknown-pitr']);
    expect(args.manifestPath).toBe('/tmp/m.json');
    expect(args.confirm).toBe(true);
    expect(args.acceptUnknownPitr).toBe(true);
  });

  it('defaults confirm and acceptUnknownPitr to false when the flags are absent', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json']);
    expect(args.confirm).toBe(false);
    expect(args.acceptUnknownPitr).toBe(false);
  });

  it('defaults --max-manifest-age-minutes to 60', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json']);
    expect(args.maxManifestAgeMinutes).toBe(60);
  });

  it('reads an explicit --max-manifest-age-minutes value', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--max-manifest-age-minutes', '15']);
    expect(args.maxManifestAgeMinutes).toBe(15);
  });

  it('reads an explicit --out directory', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--out', '/tmp/custom-out']);
    expect(args.outDir).toBe('/tmp/custom-out');
  });

  it('leaves manifestPath null when --manifest is absent', () => {
    const args = parsePurgeArgs([]);
    expect(args.manifestPath).toBeNull();
  });
});

describe('assertManifestIntegrity', () => {
  it('accepts a fresh, hash-matching, PITR-enabled manifest', () => {
    const manifest = makeManifest();
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a manifest whose PITR status is disabled', () => {
    const manifest = makeManifest({ pitr: { status: 'disabled', checked_at: 't', detail: 'off' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a manifest whose recorded hash disagrees with the recomputed hash', () => {
    const manifest = makeManifest({ candidate_ids_sha256: 'deadbeef' });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /sha256|hash/i.test(e))).toBe(true);
  });

  it('rejects a manifest generated 120 minutes ago against a 60-minute limit', () => {
    const manifest = makeManifest({ generated_at: '2026-08-13T10:30:00.000Z' }); // 120 min before NOW
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /minute/i.test(e))).toBe(true);
  });

  it('rejects a manifest whose exported CSV is missing from disk', () => {
    const manifest = makeManifest();
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /export_csv|csv/i.test(e))).toBe(true);
  });

  it('rejects a manifest with an empty id list', () => {
    const manifest = makeManifest({ candidate_ids: [], candidate_ids_sha256: sha256([]) });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /empty/i.test(e))).toBe(true);
  });

  it('rejects a manifest whose PITR status is unknown, without the acknowledgement flag', () => {
    const manifest = makeManifest({ pitr: { status: 'unknown', checked_at: 't', detail: 'no token' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /pitr/i.test(e))).toBe(true);
  });

  it('accepts that same unknown-PITR manifest when the acknowledgement flag is set', () => {
    const manifest = makeManifest({ pitr: { status: 'unknown', checked_at: 't', detail: 'no token' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: true,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
  });

  it('accumulates every failing check rather than stopping at the first', () => {
    const manifest = makeManifest({
      candidate_ids: [],
      candidate_ids_sha256: 'deadbeef',
      generated_at: '2026-08-13T10:30:00.000Z',
      pitr: { status: 'unknown', checked_at: 't', detail: 'no token' },
    });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('runDelete', () => {
  it('is inert without confirm: the deletion fake is never called and nothing is attempted', async () => {
    const manifest = makeManifest();
    let calls = 0;
    const result = await runDelete({
      manifest,
      deleteAccount: async () => {
        calls += 1;
        return { error: null };
      },
      confirm: false,
    });
    expect(calls).toBe(0);
    expect(result.confirmed).toBe(false);
    expect(result.attempted).toBe(0);
    expect(result.planned).toEqual(['a', 'b', 'c']);
  });

  it('calls the deletion fake exactly once per manifest id, in manifest order, with confirm true', async () => {
    const manifest = makeManifest();
    const seen: string[] = [];
    const result = await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toEqual([]);
  });

  it('never passes an id present in a live database but absent from the manifest', async () => {
    const manifest = makeManifest(); // candidate_ids: a, b, c
    const liveDatabaseIds = ['a', 'b', 'c', 'z']; // z is a real account, not in the manifest
    const seen: string[] = [];
    await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).not.toContain('z');
    expect(liveDatabaseIds).toContain('z'); // sanity: z really was live-only
  });

  it('continues past a mid-run failure, names it, and reports overall failure', async () => {
    const manifest = makeManifest();
    const seen: string[] = [];
    const result = await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        if (id === 'b') return { error: { message: 'Admin API: user not found' } };
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).toEqual(['a', 'b', 'c']); // c still attempted after b's failure
    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe('b');
    expect(result.failed[0].error).toMatch(/not found/);
  });
});

describe('writeDeleteLog', () => {
  it('writes a delete-log JSON file naming every id with its outcome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'purge-delete-'));
    tmpDirs.push(dir);

    const result = {
      confirmed: true,
      attempted: 2,
      succeeded: 1,
      failed: [{ id: 'b', error: 'boom' }],
      results: [
        { id: 'a', ok: true, error: null },
        { id: 'b', ok: false, error: 'boom' },
      ],
      manifest_path: '/tmp/m.json',
      manifest_hash: 'abc123',
    };

    const logPath = await writeDeleteLog(result, dir);
    expect(logPath).toMatch(/delete-log-.*\.json$/);

    const written = JSON.parse(readFileSync(logPath, 'utf8'));
    expect(written.results).toHaveLength(2);
    expect(written.results.map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
    expect(written.manifest_hash).toBe('abc123');
  });
});

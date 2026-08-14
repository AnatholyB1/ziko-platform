// Phase 02-02 — export-shape and manifest-hash proofs (task 1), extended
// with PITR-degradation proofs (task 2). Imports the .mjs modules by
// relative path across the workspace boundary into the root scripts folder,
// mirroring apps/web/test/purge/purge-lib.test.ts (phase 02-01).
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  collectExportRows,
  buildManifest,
  writeExport,
} from '../../../../scripts/purge-test-accounts/export.mjs';
import { checkPitrStatus, resolveProjectRef } from '../../../../scripts/purge-test-accounts/pitr.mjs';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeToDelete() {
  return [
    { id: 'u1', email: 'qa1@ziko-app.com', created_at: '2026-01-01T00:00:00Z' },
    { id: 'u2', email: 'qa2@ziko-app.com', created_at: '2026-01-02T00:00:00Z' },
    { id: 'u3', email: 'qa3@ziko-app.com', created_at: '2026-01-03T00:00:00Z' },
  ];
}

function makeReport(toDelete: Array<{ id: string; email: string; created_at: string }>) {
  return {
    generated_at: '2026-08-13T12:00:00.000Z',
    criterion: { rule: 'exact domain', decision: 'D-01', domain: 'ziko-app.com' },
    totals: {
      users_scanned: toDelete.length,
      candidates: toDelete.length,
      flagged_cross_linked: 0,
      to_delete: toDelete.length,
    },
    candidates: toDelete,
    flagged: [],
    to_delete: toDelete,
  };
}

const emptyPitr = { status: 'unknown', checked_at: 't', detail: 'not run yet' };

// A minimal, dependency-free CSV parser used only to assert that quoting
// survives a comma/quote embedded in a field without shifting the column
// count — a naive `.split(',')` would over-count on such a field.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

describe('collectExportRows', () => {
  it('returns one row per to_delete entry, in report order', async () => {
    const toDelete = makeToDelete();
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [],
      fetchWaitlistRows: async () => [],
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r: { user_id: string }) => r.user_id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('produces an empty-tier row for an account with no matching profile, rather than throwing', async () => {
    const toDelete = [{ id: 'u1', email: 'qa1@ziko-app.com', created_at: 't1' }];
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [],
      fetchWaitlistRows: async () => [],
    });
    expect(rows[0].tier).toBe('');
    expect(rows[0].subscription_tier).toBe('');
    expect(rows[0].profile_created_at).toBe('');
  });

  it('fills tier, subscription_tier and profile_created_at from a matching profile row', async () => {
    const toDelete = [{ id: 'u1', email: 'qa1@ziko-app.com', created_at: 't1' }];
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [
        { id: 'u1', tier: 'free', subscription_tier: 'free', created_at: 'p1' },
      ],
      fetchWaitlistRows: async () => [],
    });
    expect(rows[0]).toMatchObject({ tier: 'free', subscription_tier: 'free', profile_created_at: 'p1' });
  });

  it('lists a matching waitlist_signups email in waitlist_emails', async () => {
    const toDelete = [{ id: 'u1', email: 'qa1@ziko-app.com', created_at: 't1' }];
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [],
      fetchWaitlistRows: async () => [{ email: 'qa1@ziko-app.com' }],
    });
    expect(rows[0].waitlist_emails).toBe('qa1@ziko-app.com');
  });

  it('leaves waitlist_emails empty when no waitlist row matches', async () => {
    const toDelete = [{ id: 'u1', email: 'qa1@ziko-app.com', created_at: 't1' }];
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [],
      fetchWaitlistRows: async () => [],
    });
    expect(rows[0].waitlist_emails).toBe('');
  });
});

describe('buildManifest', () => {
  it('produces candidate_ids identical in order and content to the report to_delete ids', () => {
    const toDelete = makeToDelete();
    const report = makeReport(toDelete);
    const manifest = buildManifest({
      report,
      reportPath: '/tmp/report.json',
      csvPath: '/tmp/export.csv',
      rows: [],
      pitr: emptyPitr,
    });
    expect(manifest.candidate_ids).toEqual(['u1', 'u2', 'u3']);
  });

  it('produces a manifest_sha256 that is stable across two calls on the same input', () => {
    const toDelete = makeToDelete();
    const report = makeReport(toDelete);
    const args = {
      report,
      reportPath: '/tmp/report.json',
      csvPath: '/tmp/export.csv',
      rows: [],
      pitr: emptyPitr,
      now: () => new Date('2026-08-13T12:00:00.000Z'),
    };
    const m1 = buildManifest(args);
    const m2 = buildManifest(args);
    expect(m1.manifest_sha256).toBe(m2.manifest_sha256);
  });

  it('changes manifest_sha256 when any id changes', () => {
    const report1 = makeReport(makeToDelete());
    const report2 = makeReport([
      ...makeToDelete().slice(0, 2),
      { id: 'u9', email: 'qa9@ziko-app.com', created_at: 't' },
    ]);
    const m1 = buildManifest({
      report: report1,
      reportPath: 'r',
      csvPath: 'c',
      rows: [],
      pitr: emptyPitr,
    });
    const m2 = buildManifest({
      report: report2,
      reportPath: 'r',
      csvPath: 'c',
      rows: [],
      pitr: emptyPitr,
    });
    expect(m1.manifest_sha256).not.toBe(m2.manifest_sha256);
  });

  // WR-01: the hash must also change when generated_at or pitr.status
  // change on their own — hashing only candidate_ids would let either be
  // edited on disk without tripping the mismatch check.
  it('changes manifest_sha256 when generated_at changes but candidate_ids and pitr do not', () => {
    const report = makeReport(makeToDelete());
    const args = { report, reportPath: 'r', csvPath: 'c', rows: [], pitr: emptyPitr };
    const m1 = buildManifest({ ...args, now: () => new Date('2026-08-13T12:00:00.000Z') });
    const m2 = buildManifest({ ...args, now: () => new Date('2026-08-13T13:00:00.000Z') });
    expect(m1.candidate_ids).toEqual(m2.candidate_ids);
    expect(m1.manifest_sha256).not.toBe(m2.manifest_sha256);
  });

  it('changes manifest_sha256 when pitr.status changes but candidate_ids and generated_at do not', () => {
    const report = makeReport(makeToDelete());
    const now = () => new Date('2026-08-13T12:00:00.000Z');
    const m1 = buildManifest({ report, reportPath: 'r', csvPath: 'c', rows: [], pitr: emptyPitr, now });
    const m2 = buildManifest({
      report,
      reportPath: 'r',
      csvPath: 'c',
      rows: [],
      pitr: { status: 'enabled', checked_at: 't', detail: 'Management API reported pitr_enabled=true' },
      now,
    });
    expect(m1.generated_at).toBe(m2.generated_at);
    expect(m1.manifest_sha256).not.toBe(m2.manifest_sha256);
  });
});

describe('writeExport', () => {
  it('writes both the CSV and the manifest to disk, with export_csv pointing at the file that exists', async () => {
    const toDelete = makeToDelete();
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [],
      fetchWaitlistRows: async () => [],
    });
    const dir = mkdtempSync(join(tmpdir(), 'purge-export-'));
    tmpDirs.push(dir);

    const manifest = buildManifest({
      report,
      reportPath: join(dir, 'report.json'),
      csvPath: join(dir, 'placeholder.csv'),
      rows,
      pitr: emptyPitr,
    });
    const { csvPath, manifestPath } = await writeExport({ rows, manifest, outDir: dir });

    const csvContent = readFileSync(csvPath, 'utf8');
    const writtenManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(csvContent.split('\n')[0]).toBe(
      'user_id,email,created_at,last_sign_in_at,tier,subscription_tier,profile_created_at,waitlist_emails'
    );
    expect(writtenManifest.export_csv).toBe(csvPath);
  });

  it('survives a CSV field containing a comma or double quote without shifting the column count', async () => {
    const toDelete = [{ id: 'u1', email: 'qa1@ziko-app.com', created_at: 't1' }];
    const report = makeReport(toDelete);
    const rows = await collectExportRows({
      report,
      fetchProfiles: async () => [
        { id: 'u1', tier: 'free, "special"', subscription_tier: 'free', created_at: 't' },
      ],
      fetchWaitlistRows: async () => [],
    });
    const dir = mkdtempSync(join(tmpdir(), 'purge-export-'));
    tmpDirs.push(dir);

    const manifest = buildManifest({
      report,
      reportPath: 'r',
      csvPath: join(dir, 'x.csv'),
      rows,
      pitr: emptyPitr,
    });
    const { csvPath } = await writeExport({ rows, manifest, outDir: dir });

    const lines = readFileSync(csvPath, 'utf8').trim().split('\n');
    const parsed = parseCsvLine(lines[1]);
    expect(parsed).toHaveLength(8);
  });
});

describe('resolveProjectRef', () => {
  it('extracts the project ref from a Supabase project URL', () => {
    expect(resolveProjectRef('https://slkobhavpwsubnsmuhya.supabase.co')).toBe(
      'slkobhavpwsubnsmuhya'
    );
  });

  it('returns null for a URL that is not a Supabase project URL', () => {
    expect(resolveProjectRef('https://example.com')).toBeNull();
  });
});

describe('checkPitrStatus', () => {
  it('yields enabled when the Management API reports pitr_enabled true', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ pitr_enabled: true }) });
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: 'tk',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('enabled');
    expect(result.checked_at).toBeTruthy();
  });

  it('yields disabled when the Management API reports pitr_enabled false', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ pitr_enabled: false }) });
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: 'tk',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('disabled');
  });

  it('yields unknown naming the status code on a 401 response, and does not throw', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: 'tk',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('unknown');
    expect(result.detail).toMatch(/401/);
  });

  it('yields unknown naming the status code on a 403 response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}) });
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: 'tk',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('unknown');
    expect(result.detail).toMatch(/403/);
  });

  it('yields unknown naming the failure when fetch rejects, and does not throw', async () => {
    const fetchImpl = async () => {
      throw new Error('network unreachable');
    };
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: 'tk',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('unknown');
    expect(result.detail).toMatch(/network unreachable/);
  });

  it('yields unknown without issuing any request when the access token is absent', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ pitr_enabled: true }) };
    };
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: '',
      fetchImpl: fetchImpl as never,
    });
    expect(result.status).toBe('unknown');
    expect(called).toBe(false);
  });

  it('never includes the injected fake token in the returned detail', async () => {
    const fakeToken = 'sbp_totally_fake_secret_token_value';
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const result = await checkPitrStatus({
      supabaseUrl: 'https://abc.supabase.co',
      accessToken: fakeToken,
      fetchImpl: fetchImpl as never,
    });
    expect(result.detail).not.toContain(fakeToken);
  });
});

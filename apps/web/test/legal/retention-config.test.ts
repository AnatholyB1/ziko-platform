// Phase 03-legal-cgv-cgu — 03-03 Task 1: credential-free structural proof that the
// retention period a visitor reads on the privacy page and the value seeded into
// app_config are the same number, and that the append-only migration rule holds.
//
// Reads the migration file as text with readFileSync + resolve(__dirname, ...)
// reaching up to the repo root — the idiom already used in
// apps/web/test/purge/purge-delete.test.ts and apps/web/test/legal/cgv-locale.test.ts
// for cross-workspace-boundary reads. This is the suite that actually runs in this
// environment; backend/api/test/rls/waitlist-config-rpc.spec.ts's extension is the
// CI-side, live-database complement.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { WAITLIST_RETENTION_YEARS } from '../../src/content/legal/founder-offer';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260815_waitlist_retention_config.sql'
);

// The pre-existing migration this file's fixture proves was never edited in
// place (T-03-13). Recorded once, at the time this test was written.
const PRIOR_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260812_waitlist_founder_offer.sql'
);
const PRIOR_MIGRATION_BYTE_LENGTH = 13749;
const PRIOR_MIGRATION_SHA256 = '3f5d63de2dbef0b9d1bce7115331aef27d956c01e7995a394b4f050d399580a0';

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

describe('waitlist retention config migration (LEGAL-08, D-05, D-16)', () => {
  it('the migration file exists at the expected path', () => {
    expect(() => readFileSync(MIGRATION_PATH, 'utf8')).not.toThrow();
  });

  const raw = readFileSync(MIGRATION_PATH, 'utf8');
  const stripped = stripSqlComments(raw);

  it('inserts the retention row idempotently, with ON CONFLICT DO NOTHING', () => {
    expect(stripped).toContain('INSERT INTO public.app_config');
    expect(stripped).toContain('waitlist_retention_years');
    expect(stripped).toContain('ON CONFLICT (key) DO NOTHING');
  });

  it("seeds the literal '3', matching WAITLIST_RETENTION_YEARS exactly", () => {
    const match = stripped.match(/'waitlist_retention_years'\s*,\s*'(\d+)'/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(String(WAITLIST_RETENTION_YEARS));
  });

  it('contains no DDL, GRANT, or policy statement — additive seed only', () => {
    expect(stripped).not.toContain('GRANT');
    expect(stripped).not.toContain('CREATE POLICY');
    expect(stripped).not.toContain('DROP');
    expect(stripped).not.toContain('ALTER TABLE');
  });

  it('never edits 20260812_waitlist_founder_offer.sql — byte length and sha256 unchanged (T-03-13)', () => {
    const buf = readFileSync(PRIOR_MIGRATION_PATH);
    expect(buf.length).toBe(PRIOR_MIGRATION_BYTE_LENGTH);

    const sha256 = createHash('sha256').update(buf).digest('hex');
    expect(sha256).toBe(PRIOR_MIGRATION_SHA256);
  });
});

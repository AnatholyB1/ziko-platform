// Phase 03-legal-cgv-cgu — 03-03 Task 2: hand-rolled-fake proof of the waitlist
// erasure script's argument parsing and result mapping (LEGAL-09, D-06). Imports
// the .mjs module by relative path across the workspace boundary into the root
// scripts folder, mirroring apps/web/test/purge/purge-delete.test.ts. No network,
// no credentials, no real address in any fixture.
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { parseErasureArgs, runErasure, writeErasureLog } from '../../../../scripts/waitlist-erasure/erase.mjs';

const REPO_ROOT = resolve(__dirname, '../../../..');

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseErasureArgs', () => {
  it('throws when --confirm is absent', () => {
    expect(() => parseErasureArgs(['--email', 'a@b.test'])).toThrow(/confirm/i);
  });

  it('throws when --email is absent', () => {
    expect(() => parseErasureArgs(['--confirm'])).toThrow(/email/i);
  });

  it("throws on an address with no '@'", () => {
    expect(() => parseErasureArgs(['--email', 'not-an-address', '--confirm'])).toThrow();
  });

  it('returns the address unchanged (no lowercasing, no trimming beyond surrounding whitespace) on a well-formed invocation', () => {
    const args = parseErasureArgs(['--email', '  Mixed.Case+tag@Example.com  ', '--confirm']);
    expect(args.email).toBe('Mixed.Case+tag@Example.com');
    expect(args.confirm).toBe(true);
  });

  it('defaults logPath to a path under os.tmpdir() when --log is omitted, outside the repository root', () => {
    const args = parseErasureArgs(['--email', 'a@b.test', '--confirm']);
    expect(args.logPath.startsWith(tmpdir())).toBe(true);
    expect(args.logPath.startsWith(REPO_ROOT)).toBe(false);
  });

  it('reads an explicit --log path when provided', () => {
    const args = parseErasureArgs(['--email', 'a@b.test', '--confirm', '--log', '/tmp/custom-erasure.jsonl']);
    expect(args.logPath).toBe('/tmp/custom-erasure.jsonl');
  });
});

describe('runErasure', () => {
  it("calls client.rpc exactly once with 'anonymize_waitlist_signup' and the address passed through verbatim, unnormalized", async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const fakeClient = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: true, error: null };
      },
    };

    await runErasure(fakeClient, 'a@b.test');

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('anonymize_waitlist_signup');
    expect(calls[0].args).toEqual({ p_email: 'a@b.test' });
  });

  it('returns { ok: true, anonymized: true } for an RPC returning { data: true, error: null }', async () => {
    const fakeClient = { rpc: async () => ({ data: true, error: null }) };
    const result = await runErasure(fakeClient, 'a@b.test');
    expect(result).toEqual({ ok: true, anonymized: true, error: null });
  });

  it('returns { ok: true, anonymized: false } for an RPC returning { data: false, error: null } — a legitimate "not found" outcome', async () => {
    const fakeClient = { rpc: async () => ({ data: false, error: null }) };
    const result = await runErasure(fakeClient, 'never-registered@b.test');
    expect(result).toEqual({ ok: true, anonymized: false, error: null });
  });

  it('returns ok: false with the error surfaced for an RPC error', async () => {
    const fakeClient = { rpc: async () => ({ data: null, error: { message: 'connection reset' } }) };
    const result = await runErasure(fakeClient, 'a@b.test');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/connection reset/);
  });
});

describe('writeErasureLog', () => {
  it('writes one parseable JSON line per call to a temp path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'erasure-log-'));
    tmpDirs.push(dir);
    const logPath = join(dir, 'erasure-log.jsonl');

    await writeErasureLog(
      { email: 'a@b.test', result: { ok: true, anonymized: true, error: null } },
      logPath
    );
    await writeErasureLog(
      { email: 'c@d.test', result: { ok: true, anonymized: false, error: null } },
      logPath
    );

    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    expect(first.email).toBe('a@b.test');
    expect(first.ok).toBe(true);
    expect(first.anonymized).toBe(true);

    const second = JSON.parse(lines[1]);
    expect(second.email).toBe('c@d.test');
    expect(second.anonymized).toBe(false);
  });
});

describe('erase.mjs source guards (T-03-15)', () => {
  it('contains SUPABASE_SERVICE_ROLE_KEY and neither SUPABASE_PUBLISHABLE_KEY nor ANON_KEY', () => {
    const source = readFileSync(resolve(REPO_ROOT, 'scripts/waitlist-erasure/erase.mjs'), 'utf8');
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(source).not.toContain('ANON_KEY');
  });
});

describe('RUNBOOK.md content (T-03-11)', () => {
  it('names the support channel, the confirm flag, the RPC, and a requester-identity verification step', () => {
    const runbook = readFileSync(resolve(REPO_ROOT, 'scripts/waitlist-erasure/RUNBOOK.md'), 'utf8');
    expect(runbook).toContain('support@ziko-app.com');
    expect(runbook).toContain('--confirm');
    expect(runbook).toContain('anonymize_waitlist_signup');
    expect(runbook.toLowerCase()).toMatch(/confirm the requesting address|verify the requester|owns the address/);
  });
});

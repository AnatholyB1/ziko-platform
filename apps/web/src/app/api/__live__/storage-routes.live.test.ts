/**
 * STORAGE-04 live spec: calls the REAL web route handlers (api/photo, api/storage/upload-url)
 * against a target Supabase project with real user sessions.
 *
 * Skipped unless ZIKO_STORAGE_LIVE_FIXTURE points at the fixture written by
 * scripts/portfolio-migration/10-storage-auth-tests.mjs. Bucket names and users come only from
 * that fixture. Observed statuses are written to ZIKO_STORAGE_LIVE_RESULTS for the orchestrator.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

type Role = 'A' | 'B' | 'C' | 'D';
interface Fixture {
  url: string;
  publishable: string;
  mode: 'full' | 'smoke';
  users: Record<Role, { id: string; jwt: string; refresh: string }>;
  buckets: Record<string, string>;
}

const state = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => state.client,
}));

const fixturePath = process.env.ZIKO_STORAGE_LIVE_FIXTURE;
const resultsPath = process.env.ZIKO_STORAGE_LIVE_RESULTS;

function statusOf(code: number): 'allow' | 'deny' | 'reject' | 'error' {
  if (code === 200) return 'allow';
  if (code === 401 || code === 403) return 'deny';
  if (code === 400) return 'reject';
  return 'error';
}

describe.skipIf(!fixturePath)('storage route handlers (live)', () => {
  let fx: Fixture;
  const observed: Record<string, string> = {};
  const clients = {} as Record<Role, SupabaseClient>;
  let photoGET: (req: NextRequest) => Promise<Response>;
  let uploadGET: (req: NextRequest) => Promise<Response>;

  async function as(role: Role) {
    state.client = clients[role];
  }

  beforeAll(async () => {
    fx = JSON.parse(readFileSync(fixturePath as string, 'utf8')) as Fixture;
    for (const role of ['A', 'B', 'C', 'D'] as Role[]) {
      const c = createClient(fx.url, fx.publishable, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await c.auth.setSession({ access_token: fx.users[role].jwt, refresh_token: fx.users[role].refresh });
      if (error) throw new Error('setSession failed');
      clients[role] = c;
    }
    photoGET = (await import('@/app/api/photo/route')).GET as typeof photoGET;
    uploadGET = (await import('@/app/api/storage/upload-url/route')).GET as typeof uploadGET;
  });

  afterAll(() => {
    if (resultsPath) writeFileSync(resultsPath, JSON.stringify(observed));
  });

  const upload = (bucket: string, p: string) =>
    uploadGET(new NextRequest(`http://localhost/api/storage/upload-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(p)}`));
  const photo = (p: string) => photoGET(new NextRequest(`http://localhost/api/photo?path=${encodeURIComponent(p)}`));

  it('ck-web-upload-url-own: C own folder returns a signed token', async () => {
    await as('C');
    const res = await upload(fx.buckets['coach-kyc'], `${fx.users.C.id}/st-web.png`);
    observed['ck-web-upload-url-own'] = statusOf(res.status);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string };
    expect(typeof body.token).toBe('string');
  });

  it('ck-web-upload-url-foreign: D into C folder is refused', async () => {
    await as('D');
    const res = await upload(fx.buckets['coach-kyc'], `${fx.users.C.id}/st-web.png`);
    observed['ck-web-upload-url-foreign'] = statusOf(res.status);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('ck-web-upload-url-unknown-bucket: unknown bucket is 400', async () => {
    await as('C');
    const res = await upload('st-nonexistent-bucket', `${fx.users.C.id}/st-web.png`);
    observed['ck-web-upload-url-unknown-bucket'] = statusOf(res.status);
    expect(res.status).toBe(400);
  });

  it('ck-web-photo-foreign: A requesting C path is 403', async () => {
    await as('A');
    const res = await photo(`${fx.users.C.id}/seed.png`);
    observed['ck-web-photo-foreign'] = statusOf(res.status);
    expect(res.status).toBe(403);
  });

  it('ck-web-photo-own: C own seeded coach-kyc path is 200 (full only)', async () => {
    if (fx.mode !== 'full') return; // smoke seeds no object
    await as('C');
    const res = await photo(`${fx.users.C.id}/seed.png`);
    observed['ck-web-photo-own'] = statusOf(res.status);
    expect(res.status).toBe(200);
  });
});

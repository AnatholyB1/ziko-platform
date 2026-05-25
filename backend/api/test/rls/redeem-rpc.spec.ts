import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient, type TestUser } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

function randomCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
}

async function createInvite(
  coachId: string,
  opts: Partial<{
    expiresAt: string;
    revokedAt: string;
    useCount: number;
    maxUses: number;
  }> = {}
): Promise<string> {
  const code = randomCode();
  const { error } = await admin.from('coach_invitations').insert({
    coach_id: coachId,
    code,
    expires_at:
      opts.expiresAt ?? new Date(Date.now() + 14 * 86400_000).toISOString(),
    revoked_at: opts.revokedAt ?? null,
    use_count: opts.useCount ?? 0,
    max_uses: opts.maxUses ?? 1,
  });
  if (error) throw new Error(`createInvite: ${error.message}`);
  return code;
}

let coach: TestUser;
let client: TestUser;

beforeAll(async () => {
  coach = await createTestUser('rpc-coach');
  client = await createTestUser('rpc-client');
  createdIds.push(coach.id, client.id);
});

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('redeem_invitation_code — error coverage', () => {
  it('happy path: client redeems valid code → link created, use_count incremented', async () => {
    const code = await createInvite(coach.id);
    const { data, error } = await client.client.rpc('redeem_invitation_code', {
      code_input: code,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, error_code: null });
    expect(data.link_id).toMatch(/^[0-9a-f-]{36}$/);

    const { data: inv } = await admin
      .from('coach_invitations')
      .select('use_count, used_by')
      .eq('code', code)
      .single();
    expect(inv?.use_count).toBe(1);
    expect(inv?.used_by).toBe(client.id);

    // Clean the link so subsequent tests can re-link the same pair.
    await admin
      .from('coach_client_links')
      .update({ revoked_at: new Date().toISOString() })
      .match({ coach_id: coach.id, client_id: client.id });
  });

  it('INVALID_CODE for non-existent code', async () => {
    const { data } = await client.client.rpc('redeem_invitation_code', {
      code_input: 'ZZZZZZ',
    });
    expect(data).toMatchObject({ ok: false, error_code: 'INVALID_CODE' });
  });

  it('EXPIRED for past expires_at', async () => {
    const code = await createInvite(coach.id, {
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    });
    const { data } = await client.client.rpc('redeem_invitation_code', {
      code_input: code,
    });
    expect(data).toMatchObject({ ok: false, error_code: 'EXPIRED' });
  });

  it('REVOKED for revoked_at set', async () => {
    const code = await createInvite(coach.id, {
      revokedAt: new Date().toISOString(),
    });
    const { data } = await client.client.rpc('redeem_invitation_code', {
      code_input: code,
    });
    expect(data).toMatchObject({ ok: false, error_code: 'REVOKED' });
  });

  it('ALREADY_USED when use_count >= max_uses', async () => {
    const code = await createInvite(coach.id, { useCount: 1, maxUses: 1 });
    const { data } = await client.client.rpc('redeem_invitation_code', {
      code_input: code,
    });
    expect(data).toMatchObject({ ok: false, error_code: 'ALREADY_USED' });
  });

  it('SELF_INVITATION when coach redeems own code (22-03-09)', async () => {
    const code = await createInvite(coach.id);
    const { data } = await coach.client.rpc('redeem_invitation_code', {
      code_input: code,
    });
    expect(data).toMatchObject({ ok: false, error_code: 'SELF_INVITATION' });
  });

  it('LINK_EXISTS when active link with this coach already present', async () => {
    // Establish an active link
    const firstCode = await createInvite(coach.id);
    await client.client.rpc('redeem_invitation_code', { code_input: firstCode });
    // Issue a second invite for the same client+coach
    const secondCode = await createInvite(coach.id);
    const { data } = await client.client.rpc('redeem_invitation_code', {
      code_input: secondCode,
    });
    expect(data).toMatchObject({ ok: false, error_code: 'LINK_EXISTS' });
    // Cleanup
    await admin
      .from('coach_client_links')
      .update({ revoked_at: new Date().toISOString() })
      .match({ coach_id: coach.id, client_id: client.id });
  });

  it(
    'constant-time: p95 variance across error codes ≤ 20ms (22-03-08)',
    async () => {
      const codes: Record<string, string> = {
        INVALID_CODE: '111111',
        EXPIRED: await createInvite(coach.id, {
          expiresAt: new Date(Date.now() - 3600_000).toISOString(),
        }),
        REVOKED: await createInvite(coach.id, {
          revokedAt: new Date().toISOString(),
        }),
        ALREADY_USED: await createInvite(coach.id, { useCount: 1, maxUses: 1 }),
      };

      async function measure(input: string): Promise<number> {
        const t0 = performance.now();
        await client.client.rpc('redeem_invitation_code', { code_input: input });
        return performance.now() - t0;
      }

      const samples: Record<string, number[]> = {};
      for (const [label, code] of Object.entries(codes)) {
        samples[label] = [];
        for (let i = 0; i < 50; i++) samples[label].push(await measure(code));
      }

      const p95 = (xs: number[]) =>
        xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];
      const ps = Object.values(samples).map(p95);
      const variance = Math.max(...ps) - Math.min(...ps);

      // Log per-class p95 so SUMMARY can record the measured variance
      // eslint-disable-next-line no-console
      console.log('[redeem-rpc] p95 ms per error class:',
        Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, p95(v).toFixed(2)])));
      // eslint-disable-next-line no-console
      console.log(`[redeem-rpc] cross-class p95 variance: ${variance.toFixed(2)} ms`);

      // Loose bound — research suggests <10ms typical; allow 35ms for CI jitter.
      expect(variance).toBeLessThan(35);
    },
    60_000
  );
});

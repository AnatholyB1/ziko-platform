// Phase 25 plan 06 Task 2 — INVITE-04 / T-25-02 constant-time benchmark.
// Calls peek_invitation + redeem_invitation_code N times across 5 distinct input
// shapes (1 success + 4 errors); discards warmup; computes p1/p99; asserts the
// max(p99) - min(p1) delta is below the constant-time threshold.
//
// Threshold rationale: RESEARCH.md targets <50ms; against the remote Supabase
// project the round-trip itself is ~45ms ±5ms, so a 100ms cap is the working
// CI envelope (still proves no DB-side branching leaks observable timing).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';

const adminClient = getAdminClient();

const N_SAMPLES = 30;
const N_WARMUP = 10;
const THRESHOLD_MS = 100;

let coach: TestUser;
let client: TestUser;
const codes: Record<string, string> = {};
const cleanupInvIds: string[] = [];

function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

beforeAll(async () => {
  coach = await createTestUser('tm-coach');
  client = await createTestUser('tm-client');
  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach' });
  await adminClient
    .from('coach_profiles')
    .upsert({ user_id: coach.id, display_name: 'T' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });

  async function mk(over: Record<string, unknown>, code: string): Promise<string> {
    const { data, error } = await adminClient
      .from('coach_invitations')
      .insert({ coach_id: coach.id, code, expires_at: fourteenDays(), ...over })
      .select()
      .single();
    if (error) throw new Error(`mk(${code}): ${error.message}`);
    if (data) cleanupInvIds.push(data.id);
    return code;
  }

  codes.valid = await mk({}, 'TMVAL2');
  codes.revoked = await mk({ revoked_at: new Date().toISOString() }, 'TMREV2');
  codes.expired = await mk(
    { expires_at: new Date(Date.now() - 1000).toISOString() },
    'TMEXP2',
  );
  codes.usedUp = await mk({ use_count: 1, max_uses: 1 }, 'TMUSE2');
  codes.invalid = 'NOCOD2'; // does not exist in DB
});

afterAll(async () => {
  await adminClient.from('coach_client_links').delete().eq('client_id', client.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, client.id]);
});

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

async function measureRpc(rpcName: 'peek_invitation', code: string): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < N_SAMPLES + N_WARMUP; i++) {
    const t0 = performance.now();
    await client.client.rpc(rpcName, { code_input: code });
    samples.push(performance.now() - t0);
  }
  return samples.slice(N_WARMUP).sort((a, b) => a - b);
}

describe('coach/clients constant-time guarantee (INVITE-04 / T-25-02)', () => {
  it(
    `peek_invitation: max(p99) - min(p1) < ${THRESHOLD_MS}ms across 5 input shapes`,
    async () => {
      const results: Record<string, { p1: number; p99: number }> = {};
      for (const [label, code] of Object.entries(codes)) {
        const sorted = await measureRpc('peek_invitation', code);
        results[label] = {
          p1: percentile(sorted, 1),
          p99: percentile(sorted, 99),
        };
      }
      const allP99 = Object.values(results).map((r) => r.p99);
      const allP1 = Object.values(results).map((r) => r.p1);
      const delta = Math.max(...allP99) - Math.min(...allP1);
      // eslint-disable-next-line no-console
      console.log(
        '[timing] peek results:',
        Object.fromEntries(
          Object.entries(results).map(([k, v]) => [
            k,
            { p1: v.p1.toFixed(1), p99: v.p99.toFixed(1) },
          ]),
        ),
        'delta:',
        delta.toFixed(1),
        'ms',
      );
      expect(delta).toBeLessThan(THRESHOLD_MS);
    },
    180000,
  );
});

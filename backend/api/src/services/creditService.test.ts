/**
 * Unit tests for creditService.ts's grantMonthlyPremiumCredits (Phase 4 plan 04-02,
 * v1.16 — CRED-03, D-02). Mocks @supabase/supabase-js so `supabase.rpc` is a spy
 * this suite controls per case, mirroring the coach/videos/service.test.ts and
 * creditGate.test.ts house pattern: mock external deps, import the module under
 * test after the mocks are registered, assert on the exact arguments the spy
 * received.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

// Import AFTER the mock is registered
import { grantMonthlyPremiumCredits } from './creditService.js';
import { PREMIUM_MONTHLY_GRANT } from '../config/credits.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grantMonthlyPremiumCredits (CRED-03, T-04-05)', () => {
  it('called with only a user id invokes the RPC with that user id and the configured allowance — the default argument is wired, not merely declared', async () => {
    mockRpc.mockResolvedValue({ data: { granted: true, amount: PREMIUM_MONTHLY_GRANT }, error: null });

    await grantMonthlyPremiumCredits('user-1');

    // Asserted against the imported symbol, not a bare 300 — this is what
    // actually proves D-02's single-source-of-truth property holds at the
    // call site; a literal 300 here would let the two drift apart silently.
    expect(mockRpc).toHaveBeenCalledWith('grant_premium_credits', {
      p_user_id: 'user-1',
      p_amount: PREMIUM_MONTHLY_GRANT,
    });
  });

  it('called with an explicit amount passes that amount through instead', async () => {
    mockRpc.mockResolvedValue({ data: { granted: true, amount: 50 }, error: null });

    await grantMonthlyPremiumCredits('user-1', 50);

    expect(mockRpc).toHaveBeenCalledWith('grant_premium_credits', {
      p_user_id: 'user-1',
      p_amount: 50,
    });
  });

  it('a successful grant payload from the RPC returns a truthy granted', async () => {
    mockRpc.mockResolvedValue({ data: { granted: true, amount: PREMIUM_MONTHLY_GRANT }, error: null });

    const result = await grantMonthlyPremiumCredits('user-1');

    expect(result.granted).toBe(true);
  });

  it('a duplicate-grant payload (already granted this month) returns a falsy granted and does not throw', async () => {
    mockRpc.mockResolvedValue({ data: { granted: false, reason: 'duplicate' }, error: null });

    await expect(grantMonthlyPremiumCredits('user-1')).resolves.toEqual({ granted: false });
  });

  it('an RPC-error response returns a falsy granted and does not throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    await expect(grantMonthlyPremiumCredits('user-1')).resolves.toEqual({ granted: false });
  });

  it('calls the grant RPC by name and never the earn or deduct RPCs', async () => {
    mockRpc.mockResolvedValue({ data: { granted: true, amount: PREMIUM_MONTHLY_GRANT }, error: null });

    await grantMonthlyPremiumCredits('user-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('grant_premium_credits', expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith('earn_ai_credits', expect.anything());
    expect(mockRpc).not.toHaveBeenCalledWith('deduct_ai_credits', expect.anything());
  });
});

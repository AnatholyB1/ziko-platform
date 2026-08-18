// Phase 5 plan 05-03 (T-05-06) — pins the /api/waitlist/count contract: the route
// relays get_waitlist_founder_status()'s three verdicts verbatim, never touches
// `waitlist_signups` directly, calls the RPC exactly once per request with no
// arguments, and degrades to the same honest safe-default on any RPC failure —
// cached at the edge on success, never cached on the fallback.
//
// Node environment (this file matches `**/*.test.ts`, not `.test.tsx`, so
// `environmentMatchGlobs` leaves it on the default `node` environment — no DOM
// needed for a Route Handler). The service-role admin client module imports
// `server-only`, whose default export throws outside a React Server Component;
// mocked here the same way the existing waitlist suites mock it, hoisted above the
// dynamic import of the route below.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

const { GET } = await import('../../../src/app/api/waitlist/count/route');

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/waitlist/count (T-05-06)', () => {
  it('relays a pre-threshold verdict verbatim', async () => {
    rpcMock.mockResolvedValue({
      data: [{ should_display: false, remaining: 170, is_full: false }],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ shouldDisplay: false, remaining: 170, isFull: false });
  });

  it('relays a counter-visible verdict verbatim', async () => {
    rpcMock.mockResolvedValue({
      data: [{ should_display: true, remaining: 12, is_full: false }],
      error: null,
    });

    const response = await GET();
    const body = await response.json();
    expect(body.shouldDisplay).toBe(true);
    expect(body.remaining).toBe(12);
  });

  it('relays a complete verdict verbatim', async () => {
    rpcMock.mockResolvedValue({
      data: [{ should_display: true, remaining: 0, is_full: true }],
      error: null,
    });

    const response = await GET();
    const body = await response.json();
    expect(body.isFull).toBe(true);
  });

  it('falls back to the safe default on an RPC error, still with a 200', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ shouldDisplay: false, remaining: null, isFull: false });
  });

  it('falls back to the safe default on an empty row array', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const response = await GET();
    const body = await response.json();
    expect(body).toEqual({ shouldDisplay: false, remaining: null, isFull: false });
  });

  it('carries a thirty-second shared-cache Cache-Control on success', async () => {
    rpcMock.mockResolvedValue({
      data: [{ should_display: false, remaining: 170, is_full: false }],
      error: null,
    });

    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=30, stale-while-revalidate=60');
  });

  it('carries a no-store Cache-Control on the fallback', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('never touches `from` across success and failure cases', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ should_display: true, remaining: 12, is_full: false }],
      error: null,
    });
    await GET();

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await GET();

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('calls the RPC exactly once, with the founder-status function name and no arguments', async () => {
    rpcMock.mockResolvedValue({
      data: [{ should_display: false, remaining: 170, is_full: false }],
      error: null,
    });

    await GET();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('get_waitlist_founder_status');
  });
});

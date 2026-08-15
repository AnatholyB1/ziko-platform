// Unit tests for scripts/exercise-import/lib/supabase-client.ts
// Follows the hoisted vi.mock('@supabase/supabase-js') pattern from
// backend/api/src/coach/videos/service.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}));

import { createClient } from '@supabase/supabase-js';
import { createReadOnlyClient, fetchAllProductionExercises } from './supabase-client';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeUuid(i: number): string {
  const hex = i.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function makeRow(i: number) {
  return {
    id: makeUuid(i),
    name: `Exercise ${i}`,
    name_fr: null,
    category: null,
    body_part: null,
    equipment: null,
    target_muscle: null,
    secondary_muscles: null,
    is_custom: false,
  };
}

function makeRows(count: number, offset = 0) {
  return Array.from({ length: count }, (_, idx) => makeRow(offset + idx));
}

type Page = { data: unknown[] | null; error: unknown };

/**
 * Builds a stub Supabase client recording every method call, following the
 * same chain shape as the real supabase-js query builder:
 * from().select().eq().order().range() — a fresh chain per range() call,
 * matching Pattern 2's per-iteration query construction.
 */
function makeStubClient(pages: Page[]) {
  let rangeCallIndex = 0;
  const fromCalls: string[] = [];
  const eqCalls: Array<[string, unknown]> = [];
  const rangeCalls: Array<[number, number]> = [];

  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const del = vi.fn();
  const rpc = vi.fn();

  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn(async (from: number, to: number) => {
      rangeCalls.push([from, to]);
      const page = pages[rangeCallIndex];
      rangeCallIndex += 1;
      return page ?? { data: [], error: null };
    }),
    insert,
    update,
    upsert,
    delete: del,
  };

  const client: any = {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      return builder;
    }),
    rpc,
  };

  return { client, fromCalls, eqCalls, rangeCalls, insert, update, upsert, delete: del, rpc };
}

// ─── fetchAllProductionExercises ───────────────────────────────────────────

describe('fetchAllProductionExercises', () => {
  it('returns exactly 2350 rows across a 1000/1000/350 three-page scenario (Pitfall 2 regression)', async () => {
    const pages: Page[] = [
      { data: makeRows(1000, 0), error: null },
      { data: makeRows(1000, 1000), error: null },
      { data: makeRows(350, 2000), error: null },
    ];
    const { client } = makeStubClient(pages);

    const result = await fetchAllProductionExercises(client);
    expect(result.length).toBe(2350);
  });

  it('calls .eq with (\'is_custom\', false) on every page', async () => {
    const pages: Page[] = [
      { data: makeRows(1000, 0), error: null },
      { data: makeRows(1000, 1000), error: null },
      { data: makeRows(350, 2000), error: null },
    ];
    const { client, eqCalls } = makeStubClient(pages);

    await fetchAllProductionExercises(client);

    expect(eqCalls.length).toBe(3);
    for (const call of eqCalls) {
      expect(call).toEqual(['is_custom', false]);
    }
  });

  it('calls .from with \'exercises\' on every page and never with \'coach_exercises\'', async () => {
    const pages: Page[] = [
      { data: makeRows(1000, 0), error: null },
      { data: makeRows(1000, 1000), error: null },
      { data: makeRows(350, 2000), error: null },
    ];
    const { client, fromCalls } = makeStubClient(pages);

    await fetchAllProductionExercises(client);

    expect(fromCalls.length).toBe(3);
    expect(fromCalls.every((t) => t === 'exercises')).toBe(true);
    expect(fromCalls).not.toContain('coach_exercises');
  });

  it('propagates a Supabase error on page 2 as a thrown error (no partial silent result)', async () => {
    const pages: Page[] = [
      { data: makeRows(1000, 0), error: null },
      { data: null, error: new Error('boom') },
    ];
    const { client } = makeStubClient(pages);

    await expect(fetchAllProductionExercises(client)).rejects.toThrow('boom');
  });

  it('ZERO-WRITE: never invokes insert/update/upsert/delete/rpc', async () => {
    const pages: Page[] = [{ data: makeRows(3, 0), error: null }];
    const { client, insert, update, upsert, delete: del, rpc } = makeStubClient(pages);

    await fetchAllProductionExercises(client);

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('breaks pagination on an empty page even before reaching PAGE_SIZE', async () => {
    const pages: Page[] = [{ data: makeRows(5, 0), error: null }];
    const { client, rangeCalls } = makeStubClient(pages);

    const result = await fetchAllProductionExercises(client);

    expect(result.length).toBe(5);
    expect(rangeCalls.length).toBe(1); // stops after a short page, no extra request
  });
});

// ─── createReadOnlyClient ───────────────────────────────────────────────────

describe('createReadOnlyClient', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when SUPABASE_PUBLISHABLE_KEY is unset', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_PUBLISHABLE_KEY;

    expect(() => createReadOnlyClient()).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
  });

  it('throws when SUPABASE_URL is unset', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

    expect(() => createReadOnlyClient()).toThrow(/SUPABASE_URL/);
  });

  it('builds a client via createClient when both env vars are present', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

    createReadOnlyClient();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-publishable-key',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
  });
});

// Unit tests for scripts/exercise-import/lib/supabase-write-client.ts
// Follows the hoisted vi.mock('@supabase/supabase-js') pattern from
// lib/supabase-client.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}));

import { createClient } from '@supabase/supabase-js';
import { createWriteClient } from './supabase-write-client';

describe('createWriteClient', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('builds a client via createClient when both env vars are present', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    const result = createWriteClient();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-service-key',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('passes { auth: { persistSession: false, autoRefreshToken: false } } as the third argument', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    createWriteClient();

    const thirdArg = (createClient as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(thirdArg).toEqual({ auth: { persistSession: false, autoRefreshToken: false } });
  });

  it('throws an error naming SUPABASE_SERVICE_KEY when that var is unset', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => createWriteClient()).toThrow(/SUPABASE_SERVICE_KEY/);
  });

  it('throws an error naming SUPABASE_URL when that var is unset', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    expect(() => createWriteClient()).toThrow(/SUPABASE_URL/);
  });

  it('still throws when SUPABASE_SERVICE_KEY is unset but SUPABASE_PUBLISHABLE_KEY IS set — no silent downgrade', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => createWriteClient()).toThrow(/SUPABASE_SERVICE_KEY/);
  });

  it('does not include the key value in the thrown error message', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'super-secret-value-xyz';
    delete process.env.SUPABASE_URL;

    try {
      createWriteClient();
      throw new Error('expected createWriteClient to throw');
    } catch (err) {
      expect((err as Error).message).not.toContain('super-secret-value-xyz');
    }
  });
});

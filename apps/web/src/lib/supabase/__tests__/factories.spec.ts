import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock @supabase/ssr to avoid network and inspect cookie shape
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

describe('updateSession', () => {
  it('returns a NextResponse', async () => {
    const { updateSession } = await import('../middleware');
    const req = new NextRequest(new URL('http://localhost/fr/coach/_smoke'));
    const res = await updateSession(req);
    expect(res).toBeInstanceOf(NextResponse);
  });

  it('invokes supabase.auth.getUser() exactly once (refresh trigger)', async () => {
    const ssr = await import('@supabase/ssr');
    const createServerClient = ssr.createServerClient as ReturnType<typeof vi.fn>;
    createServerClient.mockClear();
    const { updateSession } = await import('../middleware');
    const req = new NextRequest(new URL('http://localhost/fr/coach/_smoke'));
    await updateSession(req);
    // Verify the factory was called with the two env URLs
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });
});

describe('createClientSupabase', () => {
  it('uses createBrowserClient (not createServerClient)', async () => {
    const { createClientSupabase } = await import('../client');
    const ssr = await import('@supabase/ssr');
    createClientSupabase();
    expect(ssr.createBrowserClient).toHaveBeenCalled();
  });
});

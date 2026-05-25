import 'server-only';
// Source: Context7 /supabase/ssr Server Component pattern
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies — middleware refreshes instead.
            // No-op intentional.
          }
        },
      },
      global: {
        // ARCH-06: every Supabase HTTP request opts out of Next.js Data Cache.
        // Without this, RSC may share cached fetches between users (cross-coach leak).
        fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  );
}

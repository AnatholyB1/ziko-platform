// PHASE 23 SMOKE — DELETE IN PHASE 24 (route group + this folder both go in Phase 24's first task)
// ARCH-05 layer 2 (already triggered by layout); page also fetches user for display.
// ARCH-06: force-dynamic + revalidate = 0
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { SmokeButton } from './SmokeButton';

export default async function SmokePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  // Layout already redirected on !user; non-null here.
  return (
    <main style={{ padding: 24 }}>
      <h1>Phase 23 smoke route</h1>
      <p>Signed in as <code>{user!.id}</code></p>
      <SmokeButton />
    </main>
  );
}

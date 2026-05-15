// PHASE 23 SMOKE — DELETE IN PHASE 24 (real layout ships in Phase 24 with login/dashboard chrome)
// ARCH-05 layer 2: Server Component layout guard.
// ARCH-06: force-dynamic + revalidate = 0 — no shared cache between requests.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Hard-coded redirect target — no searchParams.next interpolation (avoids open-redirect Tampering threat).
    // Phase 24 ships the real /fr/login UI; Phase 23 placeholder 404s.
    redirect('/fr/login');
  }

  return <>{children}</>;
}

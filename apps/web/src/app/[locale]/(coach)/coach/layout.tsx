// ARCH-06: force-dynamic + revalidate=0 on all (coach) routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { CoachSidebar } from '@/components/coach/CoachSidebar';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const locale = await getLocale();

  if (!user) {
    // ARCH-05 layer 2: server-side auth guard. No open-redirect — fixed target.
    redirect(`/${locale}/login`);
  }

  // D-03: non-coach user gets redirected to onboarding
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['coach', 'both'].includes(profile.role)) {
    redirect(`/${locale}/coach/onboarding`);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <CoachSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}

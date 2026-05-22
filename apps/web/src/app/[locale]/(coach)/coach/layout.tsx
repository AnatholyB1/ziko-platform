// ARCH-06: force-dynamic + revalidate=0 on all (coach) routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCachedCoachUser, getCachedAlertCount } from '@/lib/coach/auth';
import { CoachSidebar } from '@/components/coach/CoachSidebar';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, unreadAlertCount] = await Promise.all([
    getCachedCoachUser(),
    getCachedAlertCount(),
  ]);

  // user is guaranteed non-null here — getCachedCoachUser redirects if not authed/coach
  void user;

  return (
    <div className="flex min-h-screen bg-background">
      <CoachSidebar unreadAlertCount={unreadAlertCount} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}

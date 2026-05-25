// ARCH-06: force-dynamic + revalidate=0 on all (coach) routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCachedCoachUser, getCachedAlertCount } from '@/lib/coach/auth';
import { CoachSidebar } from '@/components/coach/CoachSidebar';
import { MobileNav } from '@/components/coach/MobileNav';

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
      <main className="flex-1 flex flex-col overflow-hidden h-screen">
        <div className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-white flex-shrink-0">
          <span className="text-2xl font-bold text-primary">ZIKO</span>
        </div>
        <div className="flex-1 overflow-auto min-h-0 relative">
          <div className="mx-auto max-w-6xl px-4 lg:px-8 py-10 pb-16 lg:pb-10 min-h-full">
            {children}
          </div>
        </div>
        <MobileNav />
      </main>
    </div>
  );
}

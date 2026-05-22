export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { WelcomeCard } from '@/components/coach/WelcomeCard';
import { AlertsPanel } from '@/components/coach/AlertsPanel';

export default async function DashboardPage() {
  const { user } = await getCachedCoachUser();
  const supabase = await createServerSupabase();

  const [{ data: profile }, { data: { session } }, { data: alerts }] = await Promise.all([
    supabase
      .from('coach_profiles')
      .select('display_name, kyc_status')
      .eq('user_id', user.id)
      .single(),
    supabase.auth.getSession(),
    supabase
      .from('coach_alerts')
      .select('id, client_id, alert_type, severity, summary, is_read, created_at')
      .eq('coach_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  void session; // session fetched for sidebar badge count only
  const displayName = profile?.display_name ?? user.email ?? 'Coach';
  const kycStatus = profile?.kyc_status ?? 'pending';

  return (
    <div className="flex flex-col gap-8">
      <WelcomeCard displayName={displayName} kycStatus={kycStatus} />
      <AlertsPanel initialAlerts={alerts ?? []} />
    </div>
  );
}

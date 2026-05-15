export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { WelcomeCard } from '@/components/coach/WelcomeCard';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/fr/login');

  const { data: profile } = await supabase
    .from('coach_profiles')
    .select('display_name, kyc_status')
    .eq('user_id', user.id)
    .single();

  const displayName = profile?.display_name ?? user.email ?? 'Coach';
  const kycStatus = profile?.kyc_status ?? 'pending';

  return (
    <div className="max-w-2xl">
      <WelcomeCard displayName={displayName} kycStatus={kycStatus} />
    </div>
  );
}

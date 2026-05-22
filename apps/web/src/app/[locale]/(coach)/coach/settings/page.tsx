export const revalidate = 60;

import { getTranslations } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const { user } = await getCachedCoachUser();
  const [t, supabase] = await Promise.all([
    getTranslations('Settings'),
    createServerSupabase(),
  ]);

  const { data: profile } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
      <SettingsClient
        userId={user.id}
        initialProfile={profile ?? null}
      />
    </div>
  );
}

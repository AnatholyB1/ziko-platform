export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const [{ data: { user } }, locale, t] = await Promise.all([
    supabase.auth.getUser(),
    getLocale(),
    getTranslations('Settings'),
  ]);
  if (!user) redirect(`/${locale}/login`);

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

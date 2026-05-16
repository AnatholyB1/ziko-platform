export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const [{ data: { user } }, locale] = await Promise.all([supabase.auth.getUser(), getLocale()]);
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <h1 className="text-xl font-bold text-text">Paramètres du profil</h1>
      <SettingsClient
        userId={user.id}
        initialProfile={profile ?? null}
      />
    </div>
  );
}

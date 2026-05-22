export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { AIChatClient } from './AIChatClient';

export default async function AIPage() {
  const supabase = await createServerSupabase();
  const [{ data: { user } }, locale] = await Promise.all([
    supabase.auth.getUser(),
    getLocale(),
  ]);
  if (!user) redirect(`/${locale}/login`);

  // Fetch last coach conversation
  const { data: lastConvo } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', user.id)
    .contains('plugin_context', { context: 'coach' })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get access token
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  // Fetch unread alert count (used in Plan 04 sidebar update)
  const { count: unreadAlertCount } = await supabase
    .from('coach_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)
    .eq('is_read', false);

  void unreadAlertCount; // will be used in Plan 04

  return (
    <AIChatClient
      accessToken={accessToken}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
      initialConversationId={lastConvo?.id ?? null}
    />
  );
}

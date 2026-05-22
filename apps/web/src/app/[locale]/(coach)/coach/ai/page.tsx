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

  return (
    <AIChatClient initialConversationId={lastConvo?.id ?? null} />
  );
}

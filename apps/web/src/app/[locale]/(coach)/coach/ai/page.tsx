import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { AIChatClient } from './AIChatClient';

export default async function AIPage() {
  const { user } = await getCachedCoachUser();
  const supabase = await createServerSupabase();

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

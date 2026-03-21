import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Get or create a conversation and return its ID + existing messages */
export async function getOrCreateConversation(
  userId: string,
  conversationId?: string,
): Promise<{ conversationId: string; history: StoredMessage[] }> {
  const db = admin();

  if (conversationId) {
    // Load existing conversation messages
    const { data: msgs } = await db
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return {
      conversationId,
      history: (msgs ?? []) as StoredMessage[],
    };
  }

  // Create new conversation
  const { data, error } = await db
    .from('ai_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error || !data) throw new Error('Failed to create conversation');
  return { conversationId: data.id, history: [] };
}

/** Append messages to a conversation */
export async function appendMessages(
  conversationId: string,
  messages: StoredMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const db = admin();

  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    role: m.role,
    content: m.content,
  }));

  const { error } = await db.from('ai_messages').insert(rows);
  if (error) console.error('[Conversation] Failed to persist messages:', error.message);
}

/** Update conversation title (auto-generated from first user message) */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  const db = admin();
  await db
    .from('ai_conversations')
    .update({ title: title.slice(0, 100), updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

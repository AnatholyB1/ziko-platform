import { clientForUser } from '../tools/db.js';

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Get or create a conversation and return its ID + existing messages.
 *
 * Phase 43 plan 03 (ONBOARD-01/04): the fourth `pluginContext` parameter is
 * strictly additive — it is optional, does not reorder existing parameters,
 * and does not change the create branch's default when omitted (`{}` is
 * already the column's own DEFAULT). The four existing `routes/ai.ts` call
 * sites pass three positional arguments and destructure only
 * `conversationId`/`history`; they remain unaffected by this widened return
 * shape and continue to type-check without modification.
 */
export async function getOrCreateConversation(
  userId: string,
  conversationId?: string,
  userToken?: string,
  pluginContext?: Record<string, unknown>,
): Promise<{
  conversationId: string;
  history: StoredMessage[];
  pluginContext: Record<string, unknown>;
  userId: string;
}> {
  const db = clientForUser(userToken);

  if (conversationId) {
    // Load existing conversation messages + the parent row's owner/tag in
    // parallel — the parent read is what lets callers (e.g. the onboarding
    // route) enforce an ownership + plugin_context tag gate before any model
    // call, without a second round trip.
    const [{ data: msgs }, { data: convoRow, error: convoError }] = await Promise.all([
      db
        .from('ziko_ai_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      db
        .from('ziko_ai_conversations')
        .select('user_id, plugin_context')
        .eq('id', conversationId)
        .maybeSingle(),
    ]);

    if (convoError || !convoRow) {
      throw new Error(`conversation_not_found: ${convoError?.message ?? 'no parent row for conversation ' + conversationId}`);
    }

    return {
      conversationId,
      history: (msgs ?? []) as StoredMessage[],
      pluginContext: (convoRow.plugin_context ?? {}) as Record<string, unknown>,
      userId: convoRow.user_id as string,
    };
  }

  // Create new conversation
  const { data, error } = await db
    .from('ziko_ai_conversations')
    .insert({ user_id: userId, plugin_context: pluginContext ?? {} })
    .select('id, user_id, plugin_context')
    .single();

  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message ?? error?.code ?? 'no data returned'}`);
  return {
    conversationId: data.id,
    history: [],
    pluginContext: (data.plugin_context ?? {}) as Record<string, unknown>,
    userId: data.user_id as string,
  };
}

/** Append messages to a conversation */
export async function appendMessages(
  conversationId: string,
  messages: StoredMessage[],
  userToken?: string,
): Promise<void> {
  if (messages.length === 0) return;
  const db = clientForUser(userToken);

  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    role: m.role,
    content: m.content,
  }));

  const { error } = await db.from('ziko_ai_messages').insert(rows);
  if (error) console.error('[Conversation] Failed to persist messages:', error.message);
}

/** Update conversation title (auto-generated from first user message) */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
  userToken?: string,
): Promise<void> {
  const db = clientForUser(userToken);
  await db
    .from('ziko_ai_conversations')
    .update({ title: title.slice(0, 100), updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

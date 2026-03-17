import { create } from 'zustand';
import type { AIMessage, AIConversation } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { aiBridge } from '../lib/ai';
import { useAuthStore } from './authStore';

interface AIStore {
  conversations: AIConversation[];
  currentConversationId: string | null;
  messages: AIMessage[];
  isStreaming: boolean;
  streamingContent: string;
  isChatOpen: boolean;
  activePluginContext: Record<string, unknown>;

  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;

  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  setPluginContext: (pluginId: string, context: unknown) => void;
}

export const useAIStore = create<AIStore>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  isChatOpen: false,
  activePluginContext: {},

  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),

  loadConversations: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (data) set({ conversations: data as AIConversation[] });
  },

  createConversation: async () => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, plugin_context: get().activePluginContext })
      .select()
      .single();

    if (error) throw error;
    const id = (data as AIConversation).id;
    set((s) => ({
      conversations: [data as AIConversation, ...s.conversations],
      currentConversationId: id,
      messages: [],
    }));
    return id;
  },

  selectConversation: async (id) => {
    set({ currentConversationId: id });
    await get().loadMessages(id);
  },

  loadMessages: async (conversationId) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) set({ messages: data as AIMessage[] });
  },

  sendMessage: async (content) => {
    const { currentConversationId, messages, activePluginContext } = get();
    const profile = useAuthStore.getState().profile;
    const user = useAuthStore.getState().user;
    if (!user) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await get().createConversation();
    }

    // Optimistically add user message
    const userMsg: AIMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));

    // Save user message to DB
    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content,
    });

    set({ isStreaming: true, streamingContent: '' });

    let fullResponse = '';

    try {
      await aiBridge.sendMessage(
        conversationId,
        content,
        messages,
        {
          profile,
          today_workout: null,
          active_plugins: Object.keys(activePluginContext),
          plugin_contexts: activePluginContext,
        },
        (chunk) => {
          fullResponse += chunk;
          set({ streamingContent: fullResponse });
        },
      );
    } catch (err) {
      set({ isStreaming: false, streamingContent: '' });
      throw err;
    }

    // Save assistant message to DB
    const { data: savedMsg } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fullResponse,
      })
      .select()
      .single();

    const assistantMsg: AIMessage = savedMsg as AIMessage ?? {
      id: `assistant-${Date.now()}`,
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      isStreaming: false,
      streamingContent: '',
    }));

    // Update conversation timestamp
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  },

  setPluginContext: (pluginId, context) =>
    set((s) => ({
      activePluginContext: { ...s.activePluginContext, [pluginId]: context },
    })),
}));

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, useTranslation, useI18nStore } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

// ── Inline Markdown Renderer ────────────────────────────────
// Copied verbatim from apps/mobile/app/(app)/ai/index.tsx per D-05 (the
// explicit chat-UI precedent this screen reuses), with one delta: the
// heading branch below is trimmed to the two sizes this phase's locked
// typography scale actually declares (18/700 Heading, 15/400 Body) — the
// original's mid-tier 16px heading size does not exist in 43-UI-SPEC.md's
// four-row table (13/15/18/28).
function MarkdownText({ text, color }: { text: string; color: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<Text key={key++} style={{ color }}>{text.slice(last, m.index)}</Text>);
    if (m[2] != null) parts.push(<Text key={key++} style={{ color, fontWeight: '700' }}>{m[2]}</Text>);
    else if (m[3] != null) parts.push(<Text key={key++} style={{ color, fontStyle: 'italic' }}>{m[3]}</Text>);
    else if (m[4] != null) parts.push(<Text key={key++} style={{ color, fontFamily: 'monospace', backgroundColor: color + '18', borderRadius: 3 }}> {m[4]} </Text>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Text key={key++} style={{ color }}>{text.slice(last)}</Text>);
  return <Text style={{ color, fontSize: 15, lineHeight: 22 }}>{parts}</Text>;
}

function renderMarkdown(content: string, textColor: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    // Heading: ## or ### — only the Heading (18/700) and Body (15/400) rows
    // exist in this phase's typography scale, so every heading level maps
    // onto 18px/700, never the original precedent's 16px mid-tier.
    if (/^#{1,3} /.test(line)) {
      const level = (line.match(/^(#+)/) ?? [''])[0].length;
      const txt = line.replace(/^#+\s*/, '');
      const fs = level === 1 ? 18 : 15;
      nodes.push(<Text key={i} style={{ color: textColor, fontSize: fs, fontWeight: '700', lineHeight: fs === 18 ? 24 : 22, marginTop: 4 }}>{txt}</Text>);
      i++; continue;
    }
    // Bullet list: - or * or •
    if (/^[-*•] /.test(line)) {
      nodes.push(
        <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Text style={{ color: textColor, fontSize: 15, lineHeight: 22, marginTop: 1 }}>•</Text>
          <View style={{ flex: 1 }}><MarkdownText text={line.replace(/^[-*•] /, '')} color={textColor} /></View>
        </View>
      );
      i++; continue;
    }
    // Numbered list: 1. 2. etc.
    if (/^\d+\. /.test(line)) {
      const num = (line.match(/^(\d+)\./) ?? ['', ''])[1];
      nodes.push(
        <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Text style={{ color: textColor, fontSize: 15, lineHeight: 22, marginTop: 1, minWidth: 18 }}>{num}.</Text>
          <View style={{ flex: 1 }}><MarkdownText text={line.replace(/^\d+\.\s*/, '')} color={textColor} /></View>
        </View>
      );
      i++; continue;
    }
    // Normal paragraph
    nodes.push(<MarkdownText key={i} text={line} color={textColor} />);
    i++;
  }
  return nodes;
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  const theme = useThemeStore((s) => s.theme);
  const textColor = isUser ? '#fff' : theme.text;
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 16, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          backgroundColor: isUser ? theme.primary : theme.surface,
          borderWidth: isUser ? 0 : 1,
          borderColor: theme.border,
          gap: 4,
        }}
      >
        {isUser
          ? <Text style={{ color: textColor, fontSize: 15, lineHeight: 22 }}>{content}</Text>
          : renderMarkdown(content, textColor)}
      </View>
    </View>
  );
}

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type OutgoingMessage = { role: 'user' | 'assistant'; content: string };

type MissionState = {
  micro_action: string;
  mission_title: string;
  decision_id: string;
};

type SSEEvent =
  | { type: 'meta'; conversation_id: string }
  | { type: 'chunk'; content: string }
  | { type: 'mission'; mission: MissionState }
  | { type: 'cap_reached' }
  | { type: 'error'; error: string };

const ONBOARDING_STREAM_URL = `${process.env.EXPO_PUBLIC_API_URL ?? ''}/ai/onboarding/stream`;

export default function ZikoChatScreen() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  // The screen "opens already streaming" (D-05/UI-SPEC) — the very first
  // paint should already read as in-flight rather than a blank empty state.
  const [isStreaming, setIsStreaming] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [missionState, setMissionState] = useState<MissionState | null>(null);
  const [errorState, setErrorState] = useState<'stream' | 'capReached' | null>(null);

  const flatlistRef = useRef<FlatList>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<OutgoingMessage[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  // ── Network layer: local XHR + onprogress SSE reader ────────────────
  // Mirrors packages/ai-client/src/AIBridge.ts's buffer/split/`data: `
  // parse loop — React Native's `fetch` does not expose a reliable
  // readable stream here, and AIBridge itself is not extended (it
  // hardcodes /chat/stream, the credited general-chat endpoint).
  const runSend = (newMessages: OutgoingMessage[]) => {
    lastSentRef.current = newMessages;
    setErrorState(null);
    setIsStreaming(true);
    setStreamingContent('');

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!mountedRef.current) return;
      // T-43-24: a missing session renders the error state, never an
      // unauthenticated request.
      if (!token) {
        setIsStreaming(false);
        setErrorState('stream');
        return;
      }

      const locale = useI18nStore.getState().locale === 'en' ? 'en' : 'fr';

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', ONBOARDING_STREAM_URL);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (conversationIdRef.current) {
        xhr.setRequestHeader('X-Conversation-Id', conversationIdRef.current);
      }

      let processedLength = 0;
      let buffer = '';
      let assistantBuffer = '';
      let done = false;
      let sawCapReached = false;
      let sawError = false;

      const finalize = () => {
        if (done) return;
        done = true;
        if (!mountedRef.current) return;
        if (assistantBuffer) {
          const assistantMsg: LocalMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantBuffer,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
        setStreamingContent('');
        setIsStreaming(false);
        if (sawCapReached) setErrorState('capReached');
        else if (sawError) setErrorState('stream');
      };

      const processChunk = (text: string) => {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          if (data === '[DONE]') { finalize(); continue; }

          try {
            const evt = JSON.parse(data) as SSEEvent;
            if (evt.type === 'meta') {
              // Stored in a ref only — subsequent turns and a relaunch
              // resume reuse it, but it never drives a re-render on its own.
              conversationIdRef.current = evt.conversation_id;
            } else if (evt.type === 'chunk') {
              assistantBuffer += evt.content;
              if (mountedRef.current) setStreamingContent(assistantBuffer);
            } else if (evt.type === 'mission') {
              if (mountedRef.current) setMissionState(evt.mission);
            } else if (evt.type === 'cap_reached') {
              sawCapReached = true;
            } else if (evt.type === 'error') {
              sawError = true;
            }
          } catch {
            // Ignore JSON parse errors for partial chunks — the buffer
            // above already holds back any incomplete trailing line.
          }
        }
      };

      xhr.onprogress = () => {
        if (done) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        if (done) return;
        // Every non-2xx status (including the 403 conversation_forbidden
        // ownership/tag gate) must render the stream-error state, never a
        // blank screen.
        if (xhr.status < 200 || xhr.status >= 300) {
          done = true;
          if (mountedRef.current) {
            setStreamingContent('');
            setIsStreaming(false);
            setErrorState('stream');
          }
          return;
        }
        const remaining = xhr.responseText.slice(processedLength);
        if (remaining) processChunk(remaining);
        finalize();
      };

      xhr.onerror = () => {
        done = true;
        if (mountedRef.current) {
          setStreamingContent('');
          setIsStreaming(false);
          setErrorState('stream');
        }
      };
      xhr.ontimeout = xhr.onerror;

      xhr.send(
        JSON.stringify({
          messages: newMessages,
          conversation_id: conversationIdRef.current ?? undefined,
          locale,
        }),
      );
    })();
  };

  // ── Resume-on-mount (D-04) ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) {
          if (!cancelled) { setIsStreaming(false); setErrorState('stream'); }
          return;
        }

        const { data: convRows } = await supabase
          .from('ai_conversations')
          .select('id')
          .eq('user_id', uid)
          .eq('plugin_context->>type', 'ziko_onboarding')
          .order('created_at', { ascending: false })
          .limit(1);

        if (cancelled) return;

        const existingConvId = convRows && convRows.length > 0 ? (convRows[0] as { id: string }).id : null;

        if (existingConvId) {
          conversationIdRef.current = existingConvId;

          const { data: msgRows } = await supabase
            .from('ai_messages')
            .select('id, role, content')
            .eq('conversation_id', existingConvId)
            .order('created_at', { ascending: true });

          if (cancelled) return;

          if (msgRows && msgRows.length > 0) {
            // History exists — render it and simply wait for the athlete's
            // answer, never re-issue an opening turn (would duplicate
            // Ziko's question).
            setMessages(
              msgRows.map((m) => ({
                id: (m as { id: string }).id,
                role: (m as { role: 'user' | 'assistant' }).role,
                content: (m as { content: string }).content,
              })),
            );
            setIsStreaming(false);
            return;
          }
        }

        // History empty (or no conversation exists yet) — kick off the
        // opening turn. locale is resolved and attached inside runSend.
        if (!cancelled) runSend([]);
      } catch {
        if (!cancelled) {
          setIsStreaming(false);
          setErrorState('stream');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    const userMsg: LocalMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    runSend([{ role: 'user', content: text }]);
  };

  const handleRetry = () => {
    if (isStreaming) return;
    runSend(lastSentRef.current);
  };

  const handleForceFinish = () => {
    if (isStreaming) return;
    const locale = useI18nStore.getState().locale === 'en' ? 'en' : 'fr';
    const instruction = locale === 'en'
      ? 'Please wrap up now and give me my mission.'
      : "Conclus maintenant et donne-moi ma mission, s'il te plaît.";
    const userMsg: LocalMessage = { id: `user-${Date.now()}`, role: 'user', content: instruction };
    setMessages((prev) => [...prev, userMsg]);
    runSend([{ role: 'user', content: instruction }]);
  };

  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      setTimeout(() => flatlistRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isStreaming]);

  const showConnecting = messages.length === 0 && !streamingContent && isStreaming;

  const displayMessages: LocalMessage[] = [
    ...messages,
    ...(streamingContent
      ? [{ id: 'streaming', role: 'assistant' as const, content: streamingContent }]
      : []),
    ...(showConnecting
      ? [{ id: 'connecting', role: 'assistant' as const, content: t('coach.onboarding.connecting') }]
      : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* happy-outline (not sparkles, the ongoing coach's icon) so Ziko
                reads as a visually distinct identity — D-08 */}
            <Ionicons name="happy-outline" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Ziko</Text>
            <Text style={{ color: isStreaming ? '#4CAF50' : theme.muted, fontSize: 13 }}>
              {isStreaming
                ? `● ${t('coach.onboarding.thinking')}`
                : `● ${t('coach.onboarding.online')}`}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <FlatList
            ref={flatlistRef}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
            contentContainerStyle={{ paddingVertical: 16 }}
          />

          {errorState ? (
            // T-43-23 / D-14: an error or cap-reached state never
            // auto-navigates to /(app) — the athlete stays here until a
            // real assess_profile mission write succeeds.
            <View
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                backgroundColor: theme.background,
                gap: 8,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>
                {errorState === 'capReached'
                  ? t('coach.onboarding.error.capReached')
                  : t('coach.onboarding.error.stream')}
              </Text>
              <TouchableOpacity
                onPress={errorState === 'capReached' ? handleForceFinish : handleRetry}
                style={{
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: theme.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {errorState === 'capReached'
                    ? t('coach.onboarding.error.forceFinish')
                    : t('coach.onboarding.error.retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : missionState ? null : (
            /* Input row — no credit-cost label, this route is uncredited */
            <View
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                backgroundColor: theme.background,
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 8,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('coach.onboarding.placeholder')}
                placeholderTextColor={theme.muted}
                multiline
                style={{
                  flex: 1,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  fontSize: 15,
                  maxHeight: 100,
                  color: theme.text,
                }}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || isStreaming}
                accessibilityLabel={t('coach.onboarding.sendA11y')}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: input.trim() && !isStreaming ? theme.primary : theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

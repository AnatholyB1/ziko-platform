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
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';

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

export default function ZikoChatScreen() {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [input, setInput] = useState('');
  const flatlistRef = useRef<FlatList>(null);

  // Task 3 fills in the real SSE network layer (resume-on-mount, send,
  // mission/cap_reached/error handling). This stub keeps the layout
  // independently reviewable — it deliberately does nothing yet.
  const sendToZiko = async (_text: string) => {
    // TODO(Task 3): POST to /ai/onboarding/stream and consume the SSE reply.
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendToZiko(text);
  };

  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      setTimeout(() => flatlistRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isStreaming]);

  const displayMessages: LocalMessage[] = [
    ...messages,
    ...(isStreaming && streamingContent
      ? [{ id: 'streaming', role: 'assistant' as const, content: streamingContent }]
      : []),
    ...(isConnecting && messages.length === 0 && !isStreaming
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

          {/* Input row — no credit-cost label, this route is uncredited */}
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
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

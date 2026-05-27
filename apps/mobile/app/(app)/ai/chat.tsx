import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
import { ErrorScreen } from '@ziko/ui';

// ── Types ─────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  preview: string;
}

// ── Static seed data ──────────────────────────────────────────

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    text: "Salut ! J'ai analysé tes 3 dernières séances. Tu as bien progressé en force mais ton volume global est en baisse — probablement à cause du manque de sommeil ces derniers jours. Comment je peux t'aider aujourd'hui ?",
  },
];

const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    title: 'Programme pour 3 séances/sem',
    date: 'Aujourd\'hui',
    preview: "J'ai créé un programme Push/Pull/Legs adapté à ton niveau et tes objectifs...",
  },
  {
    id: 'c2',
    title: 'Analyse nutrition semaine 18',
    date: 'Hier',
    preview: 'Tes apports en protéines sont corrects (178g/jour) mais les glucides pre-workout...',
  },
  {
    id: 'c3',
    title: 'Récupération épaule gauche',
    date: 'Lun.',
    preview: "Voici un protocole de mobilité en 4 étapes pour l'épaule : rotations externes...",
  },
  {
    id: 'c4',
    title: 'PR squat — analyse technique',
    date: '2 mai',
    preview: "Bravo pour les 140kg ! Pour continuer à progresser, concentre-toi sur la profondeur...",
  },
];

const SUGGESTIONS = [
  'Analyse ma séance d\'hier',
  'Plan repas pour cette semaine',
  'Pourquoi je stagne au squat ?',
  'Programme pour 3 séances/sem',
];

// ── Credit Chip ───────────────────────────────────────────────

function CreditChip({ balance }: { balance: number }) {
  const isLow = balance <= 5;
  const bg = isLow ? 'rgba(239,68,68,0.1)' : 'rgba(255,92,26,0.1)';
  const color = isLow ? '#EF4444' : '#FF5C1A';
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: bg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    }}>
      <Ionicons name="flash-outline" size={12} color={color} style={{ marginRight: 4 }} />
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>
        {balance} crédits
      </Text>
    </View>
  );
}

// ── Streaming Dots ────────────────────────────────────────────

function StreamingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makeAnim = (dot: Animated.Value) =>
      Animated.sequence([
        Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]);

    const loop = Animated.loop(
      Animated.stagger(200, [makeAnim(dot1), makeAnim(dot2), makeAnim(dot3)])
    );
    loop.start();
    return () => {
      loop.stop();
      dot1.setValue(0.3);
      dot2.setValue(0.3);
      dot3.setValue(0.3);
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{
      flexDirection: 'row',
      gap: 4,
      padding: 12,
      alignSelf: 'flex-start',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      shadowColor: '#1C1A17',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    }}>
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B6963', opacity: dot1 }} />
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B6963', opacity: dot2 }} />
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B6963', opacity: dot3 }} />
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────

function MessageBubble({ msg, theme }: { msg: ChatMessage; theme: any }) {
  const isUser = msg.role === 'user';
  return (
    <View style={{
      flexDirection: 'row',
      marginBottom: 10,
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <View style={{
          width: 28, height: 28, borderRadius: 9,
          marginRight: 8,
          backgroundColor: theme.text,
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Ionicons name="sparkles" size={13} color="#FFE6D9" />
        </View>
      )}
      <View style={{
        maxWidth: '78%',
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 14,
        borderTopRightRadius: isUser ? 4 : 14,
        borderTopLeftRadius: isUser ? 14 : 4,
        backgroundColor: isUser ? theme.primary : theme.surface,
        borderWidth: isUser ? 0 : 1,
        borderColor: theme.border,
      }}>
        <Text style={{
          fontSize: 13,
          lineHeight: 19,
          color: isUser ? '#fff' : theme.text,
        }}>
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

// ── AIChatScreen ──────────────────────────────────────────────

export default function AIChatScreen() {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<'chat' | 'list'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>('c1');

  const scrollRef = useRef<ScrollView>(null);

  // ── Credits query ─────────────────────────────────────────

  const { data: creditsData, isError: creditsError } = useQuery({
    queryKey: ['userCredits'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('user_profiles')
        .select('ai_credits_balance')
        .eq('id', user.id)
        .limit(1)
        .single();
      return data;
    },
    staleTime: 30_000,
  });

  const creditsBalance = creditsData?.ai_credits_balance ?? 0;

  // ── Error guard ───────────────────────────────────────────
  if (creditsError) {
    return <ErrorScreen variant="network" onRetry={() => {}} onGoBack={() => router.back()} />;
  }

  // ── Scroll helpers ────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    // Simulated response — real API wired later via ai-client SSE
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: "Bien noté. Je décale ta séance à demain matin et j'ajuste ta planification de la semaine. Pour aujourd'hui, je te recommande 30 min de marche + 10 min de mobilité épaules — ça aidera ta récup sans creuser ta dette de sommeil. ✓ J'ai mis à jour ton calendrier.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreaming(false);
    }, 1400);
  }, [input, streaming]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    setView('chat');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 34, height: 34, borderRadius: 11,
              backgroundColor: `${theme.text}0F`,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>

          {/* Title */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 22, height: 22, borderRadius: 7,
                backgroundColor: theme.text,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="sparkles" size={11} color="#FFE6D9" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
                Coach Ziko
              </Text>
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
                backgroundColor: `${theme.success}24`,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.success }}>
                  en ligne
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 10.5, color: theme.muted }}>
              claude-sonnet-4 · contexte injecté
            </Text>
          </View>

          {/* Credit chip */}
          <CreditChip balance={creditsBalance} />

          {/* Toggle view */}
          <TouchableOpacity
            onPress={() => setView((v) => (v === 'chat' ? 'list' : 'chat'))}
            style={{
              width: 34, height: 34, borderRadius: 11,
              backgroundColor: `${theme.text}0F`,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons
              name={view === 'chat' ? 'ellipsis-horizontal' : 'close'}
              size={16}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {/* ── Conversation list ── */}
        {view === 'list' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Nouvelle conversation button */}
            <TouchableOpacity
              onPress={startNewConversation}
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Ionicons name="add-outline" size={18} color="#FFFFFF" />
              <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 14 }}>
                Nouvelle conversation
              </Text>
            </TouchableOpacity>

            <Text style={{
              fontSize: 10.5, fontWeight: '800', color: theme.muted,
              letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Conversations
            </Text>

            <View style={{ gap: 6 }}>
              {CONVERSATIONS.map((c) => {
                const isActive = activeConvId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setActiveConvId(c.id);
                      setView('chat');
                    }}
                    style={{
                      backgroundColor: isActive ? 'rgba(255,92,26,0.04)' : '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isActive ? '#FF5C1A' : '#E2E0DA',
                      padding: 12,
                      marginBottom: 0,
                    }}
                  >
                    <Text style={{
                      fontWeight: '600',
                      fontSize: 14,
                      color: '#1C1A17',
                      marginBottom: 2,
                    }} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <Text style={{
                      fontSize: 11,
                      color: '#6B6963',
                      marginTop: 2,
                    }}>
                      {c.date}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          /* ── Chat view ── */
          <>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            >
              {/* Empty state */}
              {messages.length === 0 && !streaming && (
                <View style={{
                  flex: 1, alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 60, paddingHorizontal: 24,
                }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 18,
                    backgroundColor: theme.text,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <Ionicons name="sparkles" size={26} color="#FFE6D9" />
                  </View>
                  <Text style={{
                    fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4,
                  }}>
                    Comment je peux t'aider ?
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center', lineHeight: 18 }}>
                    Pose-moi une question — j'ai accès à tes séances, tes plugins et ton historique.
                  </Text>
                </View>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} theme={theme} />
              ))}

              {/* Streaming indicator */}
              {streaming && (
                <View style={{ flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 9,
                    marginRight: 8,
                    backgroundColor: theme.text,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="sparkles" size={13} color="#FFE6D9" />
                  </View>
                  <StreamingDots />
                </View>
              )}
            </ScrollView>

            {/* Suggestion chips — shown only when no messages */}
            {messages.length === 0 && !streaming && (
              <View style={{
                paddingHorizontal: 14,
                paddingBottom: 8,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setInput(s)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: theme.surface,
                      borderWidth: 1, borderColor: theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.text, fontWeight: '500' }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Input bar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopWidth: 1,
              borderTopColor: theme.border,
              backgroundColor: theme.background,
            }}>
              {/* Text field */}
              <View style={{
                flex: 1,
                paddingHorizontal: 12, paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Pose ta question…"
                  placeholderTextColor={theme.muted}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  multiline
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: theme.text,
                    maxHeight: 100,
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                />
              </View>

              {/* Send button */}
              <TouchableOpacity
                onPress={send}
                disabled={!input.trim() || streaming}
                style={{
                  width: 42, height: 42, borderRadius: 12,
                  backgroundColor: theme.primary,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: !input.trim() || streaming ? 0.4 : 1,
                }}
              >
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCommunityStore, loadMessages, sendMessage } from '../store';

function Avatar({ name, size = 32 }: { name: string | null; size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

const GIF_EMOJIS = ['😂', '🔥', '💪', '👏', '❤️', '🎉', '😤', '💯', '⭐', '🏆', '👊', '🫡'];

export default function ConversationScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeMessages, activeConversationId } = useCommunityStore();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  const load = useCallback(() => {
    if (id) loadMessages(supabase, id);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [activeMessages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !id) return;
    setText('');
    await sendMessage(supabase, id, trimmed, 'text');
  };

  const handleSendEmoji = async (emoji: string) => {
    if (!id) return;
    setShowEmoji(false);
    await sendMessage(supabase, id, emoji, 'emoji');
  };

  const messages = activeConversationId === id ? activeMessages : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
        backgroundColor: theme.surface,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chatbubble" size={16} color={theme.primary} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginLeft: 10, flex: 1 }}>Chat</Text>
        <TouchableOpacity onPress={load}>
          <Ionicons name="refresh" size={20} color="#7A7670" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: 8 }}
        >
          {messages.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="chatbubbles-outline" size={40} color="#E2E0DA" />
              <Text style={{ color: theme.muted, marginTop: 8 }}>Commence la conversation !</Text>
            </View>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            return (
              <View key={msg.id} style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                marginBottom: 4,
              }}>
                <View style={{
                  backgroundColor: isMe ? theme.primary : theme.surface,
                  borderRadius: 18,
                  borderTopRightRadius: isMe ? 4 : 18,
                  borderTopLeftRadius: isMe ? 18 : 4,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: isMe ? 0 : 1, borderColor: theme.border,
                }}>
                  {msg.type === 'emoji' ? (
                    <Text style={{ fontSize: 32 }}>{msg.content}</Text>
                  ) : msg.type === 'gif' ? (
                    <Text style={{ fontSize: 13, color: isMe ? theme.surface : theme.text }}>🎬 GIF</Text>
                  ) : (
                    <Text style={{ fontSize: 15, color: isMe ? theme.surface : theme.text, lineHeight: 20 }}>
                      {msg.content}
                    </Text>
                  )}
                </View>
                <Text style={{
                  fontSize: 10, color: '#B0ADA8', marginTop: 2,
                  textAlign: isMe ? 'right' : 'left', paddingHorizontal: 4,
                }}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Emoji bar */}
        {showEmoji && (
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12,
            backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
          }}>
            {GIF_EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => handleSendEmoji(e)}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.background }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 16, paddingVertical: 10,
          backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
        }}>
          <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: showEmoji ? theme.primary + '18' : theme.background, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="happy-outline" size={22} color={showEmoji ? theme.primary : theme.muted} />
          </TouchableOpacity>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center',
            backgroundColor: theme.background, borderRadius: 20, paddingHorizontal: 14, height: 40,
          }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message..."
              placeholderTextColor="#B0ADA8"
              style={{ flex: 1, fontSize: 15, color: theme.text }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity onPress={handleSend}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: text.trim() ? theme.primary : theme.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

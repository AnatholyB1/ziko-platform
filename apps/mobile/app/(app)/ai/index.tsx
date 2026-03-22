import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAIStore } from '../../../src/stores/aiStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import { useCommunityStore, loadCommunity, getOrCreateDMConversation } from '@ziko/plugin-community';
import { supabase } from '../../../src/lib/supabase';

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 16, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: isUser ? 18 : 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          backgroundColor: isUser ? theme.primary : theme.surface,
          borderWidth: isUser ? 0 : 1,
          borderColor: theme.border,
        }}
      >
        <Text style={{ color: isUser ? '#fff' : theme.text, fontSize: 15, lineHeight: 22 }}>{content}</Text>
      </View>
    </View>
  );
}

export default function AIScreen() {
  const messages = useAIStore((s) => s.messages);
  const isStreaming = useAIStore((s) => s.isStreaming);
  const streamingContent = useAIStore((s) => s.streamingContent);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const createConversation = useAIStore((s) => s.createConversation);
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const flatlistRef = useRef<FlatList>(null);

  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const communityEnabled = enabledPlugins.includes('community');
  const friends = useCommunityStore((s) => s.friends);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [creatingDM, setCreatingDM] = useState(false);

  useEffect(() => {
    createConversation().catch(() => {});
  }, []);

  useEffect(() => {
    if (communityEnabled) loadCommunity(supabase);
  }, [communityEnabled]);

  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      setTimeout(() => flatlistRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isStreaming]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      // Error handled in store
    }
  };

  const handleStartDM = async (friendId: string) => {
    setCreatingDM(true);
    try {
      const conversationId = await getOrCreateDMConversation(supabase, friendId);
      setShowFriendPicker(false);
      router.push(`/(app)/(plugins)/community/conversation?id=${conversationId}` as any);
    } catch {
      // Silently ignore
    }
    setCreatingDM(false);
  };

  const suggestions = [
    t('ai.suggestion1'),
    t('ai.suggestion2'),
    t('ai.suggestion3'),
    t('ai.suggestion4'),
  ];

  const displayMessages = [
    ...messages,
    ...(isStreaming && streamingContent ? [{ id: 'streaming', role: 'assistant', content: streamingContent, conversation_id: '', created_at: '' }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{t('ai.title')}</Text>
            <Text style={{ color: isStreaming ? '#4CAF50' : theme.muted, fontSize: 11 }}>
              {isStreaming ? `● ${t('ai.thinking')}` : `● ${t('ai.online')}`}
            </Text>
          </View>
          {communityEnabled && (
            <TouchableOpacity
              onPress={() => setShowFriendPicker(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: theme.primary + '18', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
              }}
            >
              <Ionicons name="people" size={16} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>{t('ai.friends')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatlistRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
          contentContainerStyle={{ paddingVertical: 16 }}
          ListEmptyComponent={
            <View style={{ padding: 24 }}>
              <Image
                source={require('../../../assets/image/no_ai_conv.png')}
                style={{ width: 180, height: 180, alignSelf: 'center', marginBottom: 16 }}
                contentFit="contain"
                transition={300}
              />
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
                {t('ai.welcome')}
              </Text>
              <Text style={{ color: theme.muted, textAlign: 'center', marginBottom: 28 }}>
                {t('ai.welcomeDesc')}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>{t('ai.trySuggestions')}</Text>
              {suggestions.map((s) => (
                <TouchableOpacity key={s} onPress={() => setInput(s)}
                  style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ color: theme.text, fontSize: 14 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        {/* Input */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('ai.placeholder')}
            placeholderTextColor="#7A7670"
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: theme.text,
              fontSize: 15,
              borderWidth: 1,
              borderColor: theme.border,
              maxHeight: 100,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !isStreaming ? theme.primary : theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isStreaming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Friend conversation picker Modal */}
      <Modal visible={showFriendPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{t('ai.newConversation')}</Text>
            <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          {/* Existing conversations link */}
          <TouchableOpacity
            onPress={() => {
              setShowFriendPicker(false);
              router.push('/(app)/(plugins)/community/chat' as any);
            }}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <Ionicons name="chatbubbles" size={20} color={theme.primary} />
            <Text style={{ flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 }}>{t('ai.viewConversations')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#7A7670" />
          </TouchableOpacity>

          <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
            {t('ai.startConvoWith')}
          </Text>

          {friends.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Ionicons name="people-outline" size={40} color="#E2E0DA" />
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>{t('ai.noFriends')}</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              renderItem={({ item: friend }) => (
                <TouchableOpacity
                  onPress={() => handleStartDM(friend.id)}
                  disabled={creatingDM}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                      {(friend.name ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 }}>
                    {friend.name ?? 'Unknown'}
                  </Text>
                  <Ionicons name="chatbubble-ellipses" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
          {creatingDM && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

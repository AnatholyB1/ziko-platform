import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore, loadCommunity, getOrCreateDMConversation } from '../store';

export default function ChatListScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { conversations, friends, isLoading } = useCommunityStore();
  const [showNewChat, setShowNewChat] = useState(false);
  const [creatingDM, setCreatingDM] = useState(false);

  const load = useCallback(() => loadCommunity(supabase), []);
  useEffect(() => { load(); }, [load]);

  const getConversationName = (conv: any) => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct' && conv.conversation_members) {
      const otherMember = conv.conversation_members?.find((m: any) =>
        friends.some((f) => f.id === m.user_id)
      );
      if (otherMember) {
        const friend = friends.find((f) => f.id === otherMember.user_id);
        return friend?.name || 'Conversation';
      }
    }
    return 'Conversation';
  };

  const handleStartDM = async (friendId: string) => {
    setCreatingDM(true);
    try {
      const conversationId = await getOrCreateDMConversation(supabase, friendId);
      setShowNewChat(false);
      router.push(`/(app)/(plugins)/community/conversation?id=${conversationId}` as any);
    } catch {}
    setCreatingDM(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}>Messages</Text>
        <TouchableOpacity
          onPress={() => setShowNewChat(true)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
      >
        {/* AI Coach */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/ai' as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: theme.surface, borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: theme.primary + '44', marginBottom: 16,
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Ziko AI Coach</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>
              Ton coach personnel IA
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>

        {/* Friends section label */}
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Conversations
        </Text>

        {conversations.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.border} />
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucune conversation</Text>
            <TouchableOpacity onPress={() => setShowNewChat(true)} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>Envoyer un message</Text>
            </TouchableOpacity>
          </View>
        ) : (
          conversations.map((conv) => (
            <TouchableOpacity key={conv.id}
              onPress={() => router.push(`/(app)/(plugins)/community/conversation?id=${conv.id}` as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border, marginBottom: 8,
              }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: conv.type === 'group' ? '#4CAF5018' : theme.primary + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={conv.type === 'group' ? 'people' : 'person'} size={22}
                  color={conv.type === 'group' ? '#4CAF50' : theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                  {getConversationName(conv)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>
                  {conv.last_message?.content ?? 'Aucun message'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#B0ADA8' }}>
                {new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* New conversation modal */}
      <Modal visible={showNewChat} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, flex: 1 }}>Nouvelle conversation</Text>
            <TouchableOpacity onPress={() => setShowNewChat(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
              Choisir un ami
            </Text>

            {friends.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 48 }}>
                <Ionicons name="people-outline" size={40} color={theme.border} />
                <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucun ami pour le moment</Text>
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
                      {friend.name ?? 'Inconnu'}
                    </Text>
                    <Ionicons name="chatbubble-ellipses" size={18} color={theme.primary} />
                  </TouchableOpacity>
                )}
              />
            )}
            {creatingDM && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

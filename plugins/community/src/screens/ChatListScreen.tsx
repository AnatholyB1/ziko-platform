import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore, loadCommunity } from '../store';

function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#FF5C1A18', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#FF5C1A', fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

export default function ChatListScreen({ supabase }: { supabase: any }) {
  const { conversations, friends, isLoading } = useCommunityStore();

  const load = useCallback(() => loadCommunity(supabase), []);
  useEffect(() => { load(); }, [load]);

  const getConversationName = (conv: any) => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct' && conv.conversation_members) {
      const { data: { user } } = { data: { user: null } }; // We'll use friends list
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1C1A17', flex: 1 }}>Messages</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 8, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#FF5C1A" />}
      >
        {conversations.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="chatbubbles-outline" size={56} color="#E2E0DA" />
            <Text style={{ color: '#7A7670', fontSize: 15, marginTop: 12 }}>Aucune conversation</Text>
            <Text style={{ color: '#B0ADA8', fontSize: 13, marginTop: 4 }}>
              Envoie un message à un ami pour commencer
            </Text>
          </View>
        )}
        {conversations.map((conv) => (
          <TouchableOpacity key={conv.id}
            onPress={() => router.push(`/(app)/(plugins)/community/conversation?id=${conv.id}` as any)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: '#E2E0DA',
            }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: conv.type === 'group' ? '#4CAF5018' : '#FF5C1A18',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={conv.type === 'group' ? 'people' : 'person'} size={22}
                color={conv.type === 'group' ? '#4CAF50' : '#FF5C1A'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1C1A17' }}>
                {getConversationName(conv)}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 13, color: '#7A7670', marginTop: 2 }}>
                {conv.last_message?.content ?? 'Aucun message'}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#B0ADA8' }}>
              {new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

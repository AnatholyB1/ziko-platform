import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore, loadCommunity, type Challenge } from '../store';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: 'En cours', bg: '#4CAF5018', color: '#4CAF50' },
    pending: { label: 'En attente', bg: '#FFB80018', color: '#FFB800' },
    completed: { label: 'Terminé', bg: '#7A767018', color: '#7A7670' },
    cancelled: { label: 'Annulé', bg: '#E2E0DA', color: '#7A7670' },
  };
  const s = map[status] ?? map.pending;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.color }}>{s.label}</Text>
    </View>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const playerCount = challenge.participants?.length ?? 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000));

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/(plugins)/community/challenge-detail?id=${challenge.id}` as any)}
      style={{
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: challenge.status === 'active' ? '#FF5C1A33' : '#E2E0DA',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: challenge.type === '1v1' ? '#FF5C1A18' : '#FFB80018',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={challenge.type === '1v1' ? 'flash' : 'people'} size={22}
            color={challenge.type === '1v1' ? '#FF5C1A' : '#FFB800'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>{challenge.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: '#7A7670' }}>
              {challenge.type === '1v1' ? '1v1' : 'Équipe'} · {playerCount} joueur{playerCount > 1 ? 's' : ''}
            </Text>
            {challenge.prize_coins > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 12 }}>🪙</Text>
                <Text style={{ fontSize: 12, color: '#FFB800', fontWeight: '600' }}>{challenge.prize_coins}</Text>
              </View>
            )}
          </View>
        </View>
        <StatusBadge status={challenge.status} />
      </View>

      {challenge.description && (
        <Text numberOfLines={2} style={{ fontSize: 13, color: '#7A7670', marginTop: 10, lineHeight: 18 }}>
          {challenge.description}
        </Text>
      )}

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
        paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0EEE9' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="calendar-outline" size={14} color="#7A7670" />
          <Text style={{ fontSize: 12, color: '#7A7670' }}>
            {new Date(challenge.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {' → '}
            {new Date(challenge.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
        {challenge.status === 'active' && (
          <Text style={{ fontSize: 12, color: '#FF5C1A', fontWeight: '600' }}>
            {daysLeft} jour{daysLeft !== 1 ? 's' : ''} restant{daysLeft !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ChallengesScreen({ supabase }: { supabase: any }) {
  const { challenges, isLoading } = useCommunityStore();

  const load = useCallback(() => loadCommunity(supabase), []);
  useEffect(() => { load(); }, [load]);

  const active = challenges.filter((c) => c.status === 'active' || c.status === 'pending');
  const past = challenges.filter((c) => c.status === 'completed' || c.status === 'cancelled');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1C1A17" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1C1A17' }}>Défis</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/create-challenge' as any)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#FF5C1A" />}
      >
        {challenges.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="trophy-outline" size={56} color="#E2E0DA" />
            <Text style={{ color: '#7A7670', fontSize: 15, marginTop: 12 }}>Aucun défi</Text>
            <Text style={{ color: '#B0ADA8', fontSize: 13, marginTop: 4 }}>Lance un défi à tes amis !</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/(plugins)/community/create-challenge' as any)}
              style={{ marginTop: 16, backgroundColor: '#FF5C1A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Créer un défi</Text>
            </TouchableOpacity>
          </View>
        )}

        {active.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="flash" size={18} color="#FF5C1A" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>En cours ({active.length})</Text>
            </View>
            {active.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
          </View>
        )}

        {past.length > 0 && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="time" size={18} color="#7A7670" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#7A7670' }}>Terminés ({past.length})</Text>
            </View>
            {past.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

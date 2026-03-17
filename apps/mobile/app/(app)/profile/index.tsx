import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const GOAL_LABELS: Record<string, string> = {
    muscle_gain: 'Build Muscle 💪',
    fat_loss: 'Lose Fat 🔥',
    maintenance: 'Maintenance ⚖️',
    endurance: 'Endurance 🏃',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ padding: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#F0F0F5' }}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/profile/settings')}>
          <Ionicons name="settings-outline" size={22} color="#8888A8" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {/* Avatar & name */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 28 }}>
              {profile?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 20 }}>{profile?.name ?? 'Athlete'}</Text>
          {profile?.goal && (
            <Text style={{ color: '#8888A8', fontSize: 14, marginTop: 4 }}>{GOAL_LABELS[profile.goal]}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
          <View style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center' }}>
            <Text style={{ color: '#6C63FF', fontWeight: '700', fontSize: 20 }}>{profile?.weight_kg ?? '—'}</Text>
            <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>kg</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center' }}>
            <Text style={{ color: '#FF6584', fontWeight: '700', fontSize: 20 }}>{profile?.height_cm ?? '—'}</Text>
            <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>cm</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2E2E40', alignItems: 'center' }}>
            <Text style={{ color: '#FF9800', fontWeight: '700', fontSize: 20 }}>{profile?.age ?? '—'}</Text>
            <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>years</Text>
          </View>
        </View>

        {/* Menu items */}
        {[
          { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/(app)/profile/settings') },
          { icon: 'grid-outline', label: 'Manage Plugins', onPress: () => router.push('/(app)/store') },
          { icon: 'chatbubble-outline', label: 'AI Conversations', onPress: () => router.push('/(app)/ai') },
          { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
        ].map((item) => (
          <TouchableOpacity key={item.label} onPress={item.onPress}
            style={{ backgroundColor: '#1A1A24', borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#2E2E40' }}>
            <Ionicons name={item.icon as any} size={20} color="#6C63FF" />
            <Text style={{ color: '#F0F0F5', fontWeight: '500', fontSize: 15, flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#8888A8" />
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={handleSignOut}
          style={{ backgroundColor: '#F4433611', borderRadius: 14, padding: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F4433633' }}>
          <Ionicons name="log-out-outline" size={20} color="#F44336" />
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 15 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

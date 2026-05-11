import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
}

const GROUPS = [
  { id: '1', name: 'Powerlifting France',    members: 1240, activity: 'actif',      icon: 'barbell-outline' as const,    tint: '#FF5C1A' },
  { id: '2', name: 'Mes potes 💪',           members: 6,    activity: 'très actif', icon: 'people-outline' as const,     tint: '#7B5BD0' },
  { id: '3', name: 'Calisthénie débutants',  members: 432,  activity: 'actif',      icon: 'body-outline' as const,       tint: '#2E9E5B' },
  { id: '4', name: 'Nutrition smart',        members: 890,  activity: 'modéré',     icon: 'nutrition-outline' as const,  tint: '#E8A33A' },
];

export default function GroupsScreen({ supabase: _supabase }: Props) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* AI suggestion */}
      <View style={{
        backgroundColor: theme.info + '10', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: theme.info + '30', marginBottom: 12,
        flexDirection: 'row', gap: 10,
      }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.info, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17 }}>
            Vu ton niveau et tes records, le groupe{' '}
            <Text style={{ fontWeight: '700' }}>Powerlifting France</Text>
            {' '}serait pertinent. 1 240 membres, très actif.
          </Text>
          <TouchableOpacity onPress={() => showAlert('Rejoindre', 'Fonctionnalité bientôt disponible.')}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.info, marginTop: 6 }}>Rejoindre →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {GROUPS.map((g) => (
        <TouchableOpacity
          key={g.id}
          onPress={() => showAlert(g.name, `${g.members} membres · ${g.activity}`)}
          style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 12,
            flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: g.tint + '18', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={g.icon} size={17} color={g.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{g.name}</Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
              {g.members.toLocaleString()} membres · {g.activity}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={theme.muted} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={() => showAlert('Créer un groupe', 'Fonctionnalité bientôt disponible.')}
        style={{
          padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
        }}
      >
        <Ionicons name="add" size={14} color={theme.muted} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.muted }}>Créer un groupe</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

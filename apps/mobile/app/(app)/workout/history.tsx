import React, { useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { format, formatDistanceToNow } from 'date-fns';

export default function WorkoutHistoryScreen() {
  const sessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { loadRecentSessions(90); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecentSessions(90);
    setRefreshing(false);
  };

  const totalVolume = sessions.reduce((acc, s) => acc + (s.total_volume_kg ?? 0), 0);
  const avgDuration = sessions
    .filter((s) => s.ended_at)
    .reduce((acc, s) => {
      const dur = (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000;
      return acc + dur;
    }, 0) / (sessions.filter((s) => s.ended_at).length || 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 26, fontWeight: '800', color: '#1C1A17' }}>History</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />}
      >
        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#FF5C1A', fontWeight: '700', fontSize: 22 }}>{sessions.length}</Text>
            <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 2 }}>Workouts (90d)</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#FF9800', fontWeight: '700', fontSize: 22 }}>
              {(totalVolume / 1000).toFixed(1)}t
            </Text>
            <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 2 }}>Total volume</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 22 }}>
              {Math.round(avgDuration)}m
            </Text>
            <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 2 }}>Avg duration</Text>
          </View>
        </View>

        <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>All Sessions</Text>

        {sessions.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={{ color: '#1C1A17', fontSize: 16, fontWeight: '600', marginTop: 12 }}>No sessions yet</Text>
            <Text style={{ color: '#7A7670', marginTop: 8 }}>Complete your first workout to see history</Text>
          </View>
        )}

        {sessions.map((session) => {
          const duration = session.ended_at
            ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)
            : null;
          return (
            <View key={session.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E0DA' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 15 }}>{session.name ?? 'Workout'}</Text>
                  <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 2 }}>
                    {format(new Date(session.started_at), 'EEEE, MMM d · HH:mm')}
                  </Text>
                </View>
                {session.total_volume_kg != null && (
                  <Text style={{ color: '#FF5C1A', fontWeight: '600', fontSize: 13 }}>
                    {session.total_volume_kg.toLocaleString()} kg
                  </Text>
                )}
              </View>
              {duration != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Ionicons name="time-outline" size={12} color="#7A7670" />
                  <Text style={{ color: '#7A7670', fontSize: 11 }}>{duration} min</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

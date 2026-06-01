import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import WSHeader from '../../../src/components/WSHeader';

function getGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'dd MMM', { locale: fr });
}

function getSessionDuration(session: { started_at: string; ended_at?: string | null }): number | null {
  if (!session.ended_at) return null;
  return Math.round(
    (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000
  );
}

export default function WorkoutHistoryScreen() {
  const sessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    loadRecentSessions(90);
  }, []);

  // Group sessions by date
  const groups: Array<{ label: string; dateKey: string; items: typeof sessions }> = [];
  const seen: Record<string, number> = {};
  for (const session of sessions) {
    const dateKey = format(new Date(session.started_at), 'yyyy-MM-dd');
    if (seen[dateKey] === undefined) {
      seen[dateKey] = groups.length;
      groups.push({ label: getGroupLabel(session.started_at), dateKey, items: [] });
    }
    groups[seen[dateKey]].items.push(session);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <WSHeader
        title="Historique"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sessions.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              marginTop: 64,
              paddingHorizontal: 24,
            }}
          >
            <Ionicons name="calendar-outline" size={48} color={theme.border} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: theme.text,
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              Pas encore de séances
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.muted,
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Tes séances terminées apparaissent ici
            </Text>
          </View>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.dateKey}>
                {/* Date group header */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: theme.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    paddingTop: 16,
                    paddingBottom: 8,
                    paddingHorizontal: 16,
                  }}
                >
                  {group.label}
                </Text>

                {/* Session rows */}
                {group.items.map((session, index) => {
                  const duration = getSessionDuration(session);
                  const volume = session.total_volume_kg ?? 0;
                  const globalIndex = sessions.indexOf(session);

                  return (
                    <MotiView
                      key={session.id}
                      from={{ opacity: 0, translateY: 8 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{
                        type: 'timing',
                        duration: 220,
                        delay: Math.min(globalIndex * 40, 320),
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          router.push(`/(app)/workout/session/${session.id}` as any)
                        }
                        style={{
                          marginHorizontal: 16,
                          marginBottom: 8,
                          borderRadius: 14,
                          padding: 16,
                          backgroundColor: theme.surface,
                          borderWidth: 1,
                          borderColor: theme.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                        activeOpacity={0.7}
                      >
                        {/* Icon badge */}
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            backgroundColor: 'rgba(255,92,26,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="barbell-outline" size={18} color="#FF5C1A" />
                        </View>

                        {/* Name + meta */}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                            {session.name ?? 'Séance'}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: theme.muted,
                              marginTop: 2,
                            }}
                          >
                            {format(new Date(session.started_at), 'dd MMM', { locale: fr })}
                            {duration != null ? ` · ${duration}min` : ''}
                          </Text>
                        </View>

                        {/* Volume badge */}
                        {volume > 0 ? (
                          <View
                            style={{
                              backgroundColor: 'rgba(255,92,26,0.12)',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }}>
                              {volume >= 1000
                                ? `${(volume / 1000).toFixed(1)}t`
                                : `${Math.round(volume)}kg`}
                            </Text>
                          </View>
                        ) : null}

                        <Ionicons name="chevron-forward" size={14} color={theme.muted} />
                      </TouchableOpacity>
                    </MotiView>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

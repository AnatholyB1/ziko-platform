import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@ziko/ui';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Monday-based weekday (0=Mon … 6=Sun)
function firstWeekdayMon(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7;
}

export default function CalendarScreen() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const startOfMonth = new Date(year, month, 1).toISOString();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['calendar', userId, year, month],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('id, created_at')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sessions ?? [];
    },
    enabled: !!userId,
    refetchOnWindowFocus: false,
  });

  const sessionsByDate = useMemo(() => {
    const map: Record<string, boolean> = {};
    data?.forEach((s) => {
      const d = new Date(s.created_at).toISOString().split('T')[0];
      map[d] = true;
    });
    return map;
  }, [data]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstWeekdayMon(year, month);
  const todayStr = new Date().toISOString().split('T')[0];

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 6,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: theme.text + '0F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: theme.text }}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: theme.text + '0F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={14} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: theme.text + '0F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-forward" size={14} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <ActivityIndicator color="#FF5C1A" />
          </View>
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Impossible de charger"
            message="Vérifie ta connexion et réessaie"
          />
        ) : (
          <>
            {/* Weekday labels */}
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6, marginTop: 8 }}>
              {WEEKDAYS.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: theme.muted,
                      letterSpacing: 0.8,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {/* Leading blanks */}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasSession = sessionsByDate[dateStr] ?? false;
                const isToday = dateStr === todayStr;

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => {
                      if (hasSession) {
                        router.push({
                          pathname: '/(app)/workout/history',
                          params: { date: dateStr },
                        } as any);
                      }
                    }}
                    activeOpacity={hasSession ? 0.7 : 1}
                    style={{
                      width: `${100 / 7 - 0.6}%`,
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: hasSession ? '#FF5C1A' : 'transparent',
                        borderWidth: isToday && !hasSession ? 1.5 : 0,
                        borderColor: isToday && !hasSession ? '#FF5C1A' : 'transparent',
                        opacity: hasSession ? 1 : isToday ? 1 : 0.9,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: hasSession ? '700' : '400',
                          color: hasSession
                            ? '#FFFFFF'
                            : isToday
                            ? '#FF5C1A'
                            : '#1C1A17',
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Month summary or empty state */}
            {Object.keys(sessionsByDate).length === 0 ? (
              <EmptyState
                variant="no-data"
                title="Aucune séance ce mois"
                message="Commence un entraînement pour le voir apparaître ici"
                ctaLabel="Démarrer une séance"
                onCta={() => router.push('/(app)/workout' as any)}
              />
            ) : (
              <Text
                style={{
                  fontSize: 15,
                  color: '#6B6963',
                  marginTop: 16,
                  textAlign: 'center',
                }}
              >
                {Object.keys(sessionsByDate).length} séances en{' '}
                {new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' })}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

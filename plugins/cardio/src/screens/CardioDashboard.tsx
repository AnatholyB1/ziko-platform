import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS, formatPace } from '../store';
import type { CardioSession } from '../store';

// Cross-plugin: measurements for weight display
let useMeasurementsStore: any = null;
try { useMeasurementsStore = require('@ziko/plugin-measurements').useMeasurementsStore; } catch {}

function formatDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h${m > 0 ? m + 'min' : ''}`;
  return `${m}min`;
}

// 7-day bar chart
function WeeklyChart({ sessions, theme }: { sessions: CardioSession[]; theme: any }) {
  const days: { label: string; dist: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dist = sessions
      .filter((s) => s.date.startsWith(dateStr))
      .reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
    days.push({
      label: d.toLocaleDateString('fr-FR', { weekday: 'narrow' }),
      dist,
      date: dateStr,
    });
  }
  const maxDist = Math.max(...days.map((d) => d.dist), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 18, padding: 16,
      borderWidth: 1, borderColor: theme.border, marginBottom: 20,
    }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 14 }}>
        Cette semaine
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 6 }}>
        {days.map((day) => {
          const barH = Math.max(4, (day.dist / maxDist) * 56);
          const isToday = day.date === today;
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{
                width: '100%', height: barH, borderRadius: 4,
                backgroundColor: isToday ? '#FF5C1A' : day.dist > 0 ? '#FF5C1A' + '60' : theme.border,
              }} />
              <Text style={{ color: isToday ? '#FF5C1A' : theme.muted, fontSize: 10, marginTop: 4, fontWeight: isToday ? '700' : '400' }}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 8 }}>
        {days.reduce((s, d) => s + d.dist, 0).toFixed(1)} km cette semaine
      </Text>
    </View>
  );
}

// Personal Records
function PersonalRecords({ sessions, theme }: { sessions: CardioSession[]; theme: any }) {
  if (sessions.length === 0) return null;

  const runSessions = sessions.filter((s) => s.activity_type === 'running' && s.distance_km);
  const cycleSessions = sessions.filter((s) => s.activity_type === 'cycling' && s.distance_km);

  const bestRunDist = runSessions.length > 0 ? Math.max(...runSessions.map((s) => s.distance_km ?? 0)) : null;
  const bestRunPace = runSessions.filter((s) => s.avg_pace_sec_per_km).length > 0
    ? Math.min(...runSessions.filter((s) => s.avg_pace_sec_per_km).map((s) => s.avg_pace_sec_per_km!))
    : null;
  const bestCycleDist = cycleSessions.length > 0 ? Math.max(...cycleSessions.map((s) => s.distance_km ?? 0)) : null;
  const totalAllTime = sessions.reduce((s, c) => s + (c.distance_km ?? 0), 0);

  const records = [
    ...(bestRunDist ? [{ label: 'Sortie course', value: `${bestRunDist.toFixed(1)} km`, icon: '🏃' }] : []),
    ...(bestRunPace ? [{ label: 'Meilleure allure', value: formatPace(bestRunPace), icon: '⚡' }] : []),
    ...(bestCycleDist ? [{ label: 'Sortie vélo', value: `${bestCycleDist.toFixed(1)} km`, icon: '🚴' }] : []),
    { label: 'Total all time', value: `${totalAllTime.toFixed(0)} km`, icon: '🌍' },
  ];

  if (records.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
        Records personnels
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {records.map((r) => (
          <View
            key={r.label}
            style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: theme.border, marginRight: 10, minWidth: 110,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 24, marginBottom: 6 }}>{r.icon}</Text>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>{r.value}</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{r.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Session card — Strava-like
function SessionCard({ session, theme, onPress }: { session: CardioSession; theme: any; onPress: () => void }) {
  const activity = ACTIVITY_LABELS[session.activity_type] ?? ACTIVITY_LABELS.other;
  const date = new Date(session.date);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.surface, borderRadius: 18, marginBottom: 12,
        borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
      }}
    >
      {/* Color stripe */}
      <View style={{ height: 3, backgroundColor: activity.color }} />
      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: activity.color + '20',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
              {session.title ?? activity.label}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
              {formatDuration(session.duration_min)}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 11 }}>Durée</Text>
          </View>
          {session.distance_km != null && (
            <View>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
                {session.distance_km.toFixed(2)}<Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted }}> km</Text>
              </Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Distance</Text>
            </View>
          )}
          {session.avg_pace_sec_per_km != null && (
            <View>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
                {formatPace(session.avg_pace_sec_per_km)}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Allure</Text>
            </View>
          )}
          {!session.distance_km && session.calories_burned != null && (
            <View>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
                {session.calories_burned}<Text style={{ fontSize: 14, fontWeight: '400', color: theme.muted }}> kcal</Text>
              </Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Calories</Text>
            </View>
          )}
        </View>

        {/* Elevation badge if available */}
        {session.elevation_gain_m != null && session.elevation_gain_m > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
            <Ionicons name="trending-up" size={13} color="#4CAF50" />
            <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>
              +{Math.round(session.elevation_gain_m)} m dénivelé
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CardioDashboard({ supabase }: { supabase: any }) {
  const { sessions, setSessions, loading, setLoading, getTotalDistance, getTotalDuration, getSessionCount } = useCardioStore();
  const theme = useThemeStore((s) => s.theme);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100);
      setSessions(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalDist7 = getTotalDistance(7);
  const totalDur7 = getTotalDuration(7);
  const sessionCount7 = getSessionCount(7);

  // Group sessions by date for feed
  const grouped: { dateLabel: string; items: CardioSession[] }[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.date);
    const dateStr = d.toISOString().split('T')[0];
    const label = (() => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (dateStr === today) return "Aujourd'hui";
      if (dateStr === yesterday) return 'Hier';
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    })();
    if (!seen.has(dateStr)) {
      seen.add(dateStr);
      grouped.push({ dateLabel: label, items: [s] });
    } else {
      grouped[grouped.length - 1].items.push(s);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900' }}>Cardio</Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 2 }}>
              {totalDist7.toFixed(1)} km · {sessionCount7} sorties cette semaine
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/(plugins)/cardio/log' as any)}
              style={{
                backgroundColor: theme.surface, borderRadius: 12,
                width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Ionicons name="create-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(plugins)/cardio/tracker' as any)}
              style={{
                backgroundColor: theme.primary, borderRadius: 12,
                width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: '#FF5722', fontWeight: '800', fontSize: 20 }}>{totalDist7.toFixed(1)}</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>km / 7j</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: '#2196F3', fontWeight: '800', fontSize: 20 }}>{formatDuration(totalDur7)}</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>temps / 7j</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: '#4CAF50', fontWeight: '800', fontSize: 20 }}>{sessionCount7}</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>sorties / 7j</Text>
          </View>
        </View>

        {/* Weekly chart */}
        <WeeklyChart sessions={sessions} theme={theme} />

        {/* Personal records */}
        <PersonalRecords sessions={sessions} theme={theme} />

        {/* Cross-plugin: weight */}
        {useMeasurementsStore && (() => {
          const mStore = useMeasurementsStore();
          const latest = mStore.getLatest?.();
          if (!latest?.weight_kg) return null;
          return (
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/measurements/dashboard' as any)}
              style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 20,
                borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <Ionicons name="scale-outline" size={24} color="#FF9800" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{latest.weight_kg} kg</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Poids actuel · Voir mesures</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>
          );
        })()}

        {/* Activity feed */}
        {loading && sessions.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>Chargement...</Text>
        ) : sessions.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/cardio/tracker' as any)}
            style={{
              alignItems: 'center', marginTop: 40, padding: 32,
              backgroundColor: theme.surface, borderRadius: 20,
              borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
            }}
          >
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🏃</Text>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20, marginBottom: 8 }}>
              Prêt(e) pour ta première sortie ?
            </Text>
            <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 14, marginBottom: 20 }}>
              Enregistre ton parcours avec le GPS ou saisis une session manuellement.
            </Text>
            <View style={{
              backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
              flexDirection: 'row', gap: 8, alignItems: 'center',
            }}>
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>Démarrer GPS</Text>
            </View>
          </TouchableOpacity>
        ) : (
          grouped.map(({ dateLabel, items }) => (
            <View key={dateLabel}>
              <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4, letterSpacing: 0.3 }}>
                {dateLabel.toUpperCase()}
              </Text>
              {items.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  theme={theme}
                  onPress={() => router.push({ pathname: '/(plugins)/cardio/[id]' as any, params: { id: s.id } })}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

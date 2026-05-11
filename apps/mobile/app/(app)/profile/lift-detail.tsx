import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { supabase } from '../../../src/lib/supabase';

// ── Types ────────────────────────────────────────────────────

interface SessionBest {
  date: string;
  maxWeight: number;
  bestReps: number;
  isPR: boolean;
}

interface LiftStats {
  totalVolumeKg: number;
  sessionCount: number;
  progressionPct: number | null;
  estimated1RM: number;
}

// ── Plages ───────────────────────────────────────────────────

const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: '1a', label: '1A', days: 365 },
  { id: 'all', label: 'Tout', days: 0 },
];

// ── Chart ────────────────────────────────────────────────────

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 100;

function MiniChart({ data, primaryColor }: { data: number[]; primaryColor: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: (i / 3) * CHART_HEIGHT, height: 1, backgroundColor: '#E2E0DA', opacity: 0.5 }} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 1 }}>
        {data.map((v, i) => {
          const barH = ((v - min) / range) * (CHART_HEIGHT - 8) + 4;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, height: barH, backgroundColor: isLast ? primaryColor : `${primaryColor}44`, borderRadius: 2 }} />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{min} kg</Text>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{max} kg</Text>
      </View>
    </View>
  );
}

// ── Loader ───────────────────────────────────────────────────

async function loadLiftHistory(
  exerciseId: string,
  rangeDays: number
): Promise<{ history: SessionBest[]; stats: LiftStats }> {
  let query = supabase
    .from('session_sets')
    .select('weight_kg, reps, session_id, workout_sessions!inner(started_at)')
    .eq('exercise_id', exerciseId)
    .not('weight_kg', 'is', null)
    .order('workout_sessions(started_at)', { ascending: true });

  if (rangeDays > 0) {
    const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
    query = query.gte('workout_sessions.started_at', since);
  }

  const { data } = await query.limit(500);
  if (!data || data.length === 0) {
    return { history: [], stats: { totalVolumeKg: 0, sessionCount: 0, progressionPct: null, estimated1RM: 0 } };
  }

  const sessionMap = new Map<string, { date: string; maxWeight: number; bestReps: number; totalVolumeKg: number }>();
  for (const row of data as any[]) {
    const sid = row.session_id;
    const w = Number(row.weight_kg);
    const r = Number(row.reps ?? 1);
    const date = (row.workout_sessions as any)?.started_at ?? '';
    const existing = sessionMap.get(sid);
    if (!existing) {
      sessionMap.set(sid, { date, maxWeight: w, bestReps: r, totalVolumeKg: w * r });
    } else {
      sessionMap.set(sid, {
        date,
        maxWeight: Math.max(existing.maxWeight, w),
        bestReps: w > existing.maxWeight ? r : existing.bestReps,
        totalVolumeKg: existing.totalVolumeKg + w * r,
      });
    }
  }

  const sorted = [...sessionMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  let runningMax = 0;
  const history: SessionBest[] = sorted.map((s) => {
    const isPR = s.maxWeight > runningMax;
    if (isPR) runningMax = s.maxWeight;
    return { date: s.date, maxWeight: s.maxWeight, bestReps: s.bestReps, isPR };
  });

  const totalVolumeKg = [...sessionMap.values()].reduce((acc, s) => acc + s.totalVolumeKg, 0);
  const sessionCount = sessionMap.size;
  const firstMax = history[0]?.maxWeight ?? 0;
  const lastMax = history[history.length - 1]?.maxWeight ?? 0;
  const progressionPct = firstMax > 0 && history.length >= 2
    ? Math.round(((lastMax - firstMax) / firstMax) * 100)
    : null;
  const best = [...sessionMap.values()].reduce((a, b) => a.maxWeight > b.maxWeight ? a : b);
  const estimated1RM = Math.round(best.maxWeight * (1 + best.bestReps / 30) * 10) / 10;

  return { history, stats: { totalVolumeKg, sessionCount, progressionPct, estimated1RM } };
}

// ── Screen ───────────────────────────────────────────────────

export default function LiftDetailScreen() {
  const { lift, exerciseId } = useLocalSearchParams<{ lift: string; exerciseId: string }>();
  const theme = useThemeStore((s) => s.theme);
  const [range, setRange] = useState('3m');
  const [history, setHistory] = useState<SessionBest[]>([]);
  const [stats, setStats] = useState<LiftStats | null>(null);
  const [loading, setLoading] = useState(true);

  const exerciseName = lift ?? 'Exercice';

  useEffect(() => {
    if (!exerciseId) { setLoading(false); return; }
    setLoading(true);
    const r = RANGES.find((r) => r.id === range) ?? RANGES[1];
    loadLiftHistory(exerciseId, r.days).then(({ history: h, stats: s }) => {
      setHistory(h);
      setStats(s);
      setLoading(false);
    });
  }, [range, exerciseId]);

  const chartData = useMemo(() => history.map((h) => h.maxWeight), [history]);
  const currentPR = history.length > 0 ? history[history.length - 1].maxWeight : null;
  const prHistory = useMemo(() => history.filter((h) => h.isPR).reverse(), [history]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${theme.text}0F`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>{exerciseName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          {/* PR Hero card */}
          <View style={{ backgroundColor: '#1C1A17', borderRadius: 16, padding: 18, marginBottom: 14, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: `${theme.primary}55`, opacity: 0.6 }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Record actuel</Text>
            {currentPR !== null ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 44, fontWeight: '800', color: '#FFFAF6', lineHeight: 48 }}>{currentPR}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: 'rgba(255,250,246,0.7)' }}>kg</Text>
                  {stats?.progressionPct !== null && stats?.progressionPct !== undefined && (
                    <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: ((stats.progressionPct ?? 0) >= 0 ? '#2E9E5B' : '#E53E3E') + '44' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: (stats.progressionPct ?? 0) >= 0 ? '#2E9E5B' : '#E53E3E' }}>
                        {(stats.progressionPct ?? 0) >= 0 ? '+' : ''}{stats.progressionPct}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.6)' }}>
                  {prHistory[0] ? formatDate(prHistory[0].date) : ''}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 16, color: 'rgba(255,250,246,0.5)' }}>Aucune donnée</Text>
            )}
          </View>

          {/* Range selector */}
          <View style={{ flexDirection: 'row', gap: 4, padding: 4, marginBottom: 14, backgroundColor: `${theme.text}0D`, borderRadius: 10 }}>
            {RANGES.map((r) => {
              const active = range === r.id;
              return (
                <TouchableOpacity key={r.id} onPress={() => setRange(r.id)} style={{ flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center', backgroundColor: active ? theme.surface : 'transparent' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? theme.text : theme.muted }}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chart */}
          {chartData.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 14 }}>
              <MiniChart data={chartData} primaryColor={theme.primary} />
            </View>
          )}

          {/* Stats grid */}
          {stats && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[
                {
                  label: 'Volume total',
                  value: stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)} t` : `${Math.round(stats.totalVolumeKg)} kg`,
                  sub: `Sur ${RANGES.find((r) => r.id === range)?.label ?? 'tout'}`,
                  icon: 'barbell-outline' as const,
                  color: '#FF5C1A',
                },
                {
                  label: 'Séances',
                  value: String(stats.sessionCount),
                  sub: `Sur ${RANGES.find((r) => r.id === range)?.label ?? 'tout'}`,
                  icon: 'calendar-outline' as const,
                  color: '#2E7BF6',
                },
                {
                  label: 'Progression',
                  value: stats.progressionPct !== null ? `${(stats.progressionPct ?? 0) >= 0 ? '+' : ''}${stats.progressionPct}%` : '—',
                  sub: 'Sur la période',
                  icon: 'trending-up-outline' as const,
                  color: '#2E9E5B',
                },
                {
                  label: '1RM estimé',
                  value: `${stats.estimated1RM} kg`,
                  sub: 'Formule Epley',
                  icon: 'flash-outline' as const,
                  color: '#E8A33A',
                },
              ].map((s, i) => (
                <View key={i} style={{ width: '47.5%', backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${s.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={s.icon} size={14} color={s.color} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>{s.label}</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, lineHeight: 20 }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{s.sub}</Text>
                </View>
              ))}
            </View>
          )}

          {/* PR History */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
            Records personnels
          </Text>
          {prHistory.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 13, paddingLeft: 4 }}>Aucun PR enregistré pour cet exercice.</Text>
          ) : (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
              {prHistory.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                      {h.maxWeight} kg{' '}
                      <Text style={{ color: theme.muted, fontWeight: '600' }}>· {h.bestReps > 1 ? `${h.bestReps} reps` : '1 rep'}</Text>
                    </Text>
                    <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 2 }}>{formatDate(h.date)}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: `${theme.primary}22` }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>PR</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

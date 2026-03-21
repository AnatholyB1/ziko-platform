import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import {
  fetchExerciseProgression, type ExerciseProgressionPoint, type Period,
} from '../store';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const PERIODS: { label: string; value: Period }[] = [
  { label: '7J', value: '7d' },
  { label: '30J', value: '30d' },
  { label: '90J', value: '90d' },
  { label: 'Tout', value: 'all' },
];

function getChartBase(theme: any) {
  return {
    backgroundColor: theme.surface,
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalCount: 0,
    labelColor: () => theme.muted,
    propsForDots: { r: '4', strokeWidth: '2' },
    propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '' },
    style: { borderRadius: 12 },
  };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function pickLabels(labels: string[], max: number): string[] {
  if (labels.length <= max) return labels;
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}

export default function ExerciseStats({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { exerciseId, exerciseName } = useLocalSearchParams<{
    exerciseId: string;
    exerciseName: string;
  }>();

  const [period, setPeriod] = useState<Period>('90d');
  const [data, setData] = useState<ExerciseProgressionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pts = await fetchExerciseProgression(supabase, exerciseId!, period);
    setData(pts);
    setLoading(false);
  }, [exerciseId, period]);

  useEffect(() => { load(); }, [load]);

  // Derived stats
  const maxWeight = data.length > 0 ? Math.max(...data.map((d) => d.max_weight)) : 0;
  const latestWeight = data.length > 0 ? data[data.length - 1].max_weight : 0;
  const firstWeight = data.length > 0 ? data[0].max_weight : 0;
  const weightDelta = latestWeight - firstWeight;
  const totalVolume = data.reduce((s, d) => s + d.total_volume, 0);
  const avgRpe = (() => {
    const rpes = data.filter((d) => d.avg_rpe != null).map((d) => d.avg_rpe!);
    return rpes.length > 0 ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 8, paddingBottom: 12, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }} numberOfLines={1}>
            {exerciseName ?? 'Exercice'}
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted }}>Progression</Text>
        </View>
      </View>

      {/* Period picker */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={{
              height: 36, paddingHorizontal: 16, borderRadius: 20,
              justifyContent: 'center',
              backgroundColor: period === p.value ? theme.primary : theme.surface,
              borderWidth: 1,
              borderColor: period === p.value ? theme.primary : theme.border,
            }}
          >
            <Text style={{
              fontSize: 14, fontWeight: '600',
              color: period === p.value ? theme.surface : theme.muted,
            }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MiniKPI label="Max" value={`${maxWeight}kg`} color={theme.primary} />
          <MiniKPI
            label="Δ"
            value={`${weightDelta >= 0 ? '+' : ''}${weightDelta}kg`}
            color={weightDelta >= 0 ? '#10B981' : '#EF4444'}
          />
          <MiniKPI label="Vol. total" value={`${Math.round(totalVolume)}kg`} color="#2563EB" />
          <MiniKPI label="RPE" value={avgRpe != null ? `${avgRpe}` : '—'} color="#7C3AED" />
        </View>

        {/* Weight progression */}
        {data.length > 1 && (
          <Card title="Poids max (kg)">
            <LineChart
              data={{
                labels: pickLabels(data.map((d) => shortDate(d.date)), 6),
                datasets: [{ data: data.map((d) => d.max_weight || 0) }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={{
                ...getChartBase(theme),
                color: (o = 1) => `rgba(255, 92, 26, ${o})`,
                propsForDots: { ...getChartBase(theme).propsForDots, stroke: theme.primary },
              }}
              bezier
              style={{ borderRadius: 12 }}
              withVerticalLines={false}
              fromZero
            />
          </Card>
        )}

        {/* Volume progression */}
        {data.length > 1 && (
          <Card title="Volume par séance (kg)">
            <LineChart
              data={{
                labels: pickLabels(data.map((d) => shortDate(d.date)), 6),
                datasets: [{ data: data.map((d) => d.total_volume || 0) }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={{
                ...getChartBase(theme),
                color: (o = 1) => `rgba(37, 99, 235, ${o})`,
                propsForDots: { ...getChartBase(theme).propsForDots, stroke: '#2563EB' },
              }}
              bezier
              style={{ borderRadius: 12 }}
              withVerticalLines={false}
              fromZero
            />
          </Card>
        )}

        {/* Reps progression */}
        {data.length > 1 && (
          <Card title="Reps moy. par série">
            <LineChart
              data={{
                labels: pickLabels(data.map((d) => shortDate(d.date)), 6),
                datasets: [{ data: data.map((d) => d.avg_reps || 0) }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={{
                ...getChartBase(theme),
                color: (o = 1) => `rgba(16, 185, 129, ${o})`,
                propsForDots: { ...getChartBase(theme).propsForDots, stroke: '#10B981' },
              }}
              bezier
              style={{ borderRadius: 12 }}
              withVerticalLines={false}
              fromZero
            />
          </Card>
        )}

        {/* RPE trend */}
        {data.filter((d) => d.avg_rpe != null).length > 1 && (
          <Card title="RPE moyen">
            <LineChart
              data={{
                labels: pickLabels(
                  data.filter((d) => d.avg_rpe != null).map((d) => shortDate(d.date)),
                  6,
                ),
                datasets: [{
                  data: data.filter((d) => d.avg_rpe != null).map((d) => d.avg_rpe!),
                }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={{
                ...getChartBase(theme),
                color: (o = 1) => `rgba(124, 58, 237, ${o})`,
                propsForDots: { ...getChartBase(theme).propsForDots, stroke: '#7C3AED' },
              }}
              bezier
              style={{ borderRadius: 12 }}
              withVerticalLines={false}
              fromZero
            />
          </Card>
        )}

        {/* Raw data table */}
        {data.length > 0 && (
          <Card title="Historique">
            <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: theme.muted }}>Date</Text>
              <Text style={{ width: 60, fontSize: 12, fontWeight: '700', color: theme.muted, textAlign: 'right' }}>Poids</Text>
              <Text style={{ width: 50, fontSize: 12, fontWeight: '700', color: theme.muted, textAlign: 'right' }}>Reps</Text>
              <Text style={{ width: 60, fontSize: 12, fontWeight: '700', color: theme.muted, textAlign: 'right' }}>Volume</Text>
              <Text style={{ width: 40, fontSize: 12, fontWeight: '700', color: theme.muted, textAlign: 'right' }}>RPE</Text>
            </View>
            {[...data].reverse().map((d) => (
              <View key={d.date} style={{
                flexDirection: 'row', paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: theme.background,
              }}>
                <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>{shortDate(d.date)}</Text>
                <Text style={{ width: 60, fontSize: 13, color: theme.text, textAlign: 'right' }}>{d.max_weight}kg</Text>
                <Text style={{ width: 50, fontSize: 13, color: theme.text, textAlign: 'right' }}>{d.avg_reps}</Text>
                <Text style={{ width: 60, fontSize: 13, color: theme.text, textAlign: 'right' }}>{d.total_volume}kg</Text>
                <Text style={{ width: 40, fontSize: 13, color: theme.muted, textAlign: 'right' }}>
                  {d.avg_rpe != null ? d.avg_rpe : '—'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Empty state */}
        {!loading && data.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="bar-chart-outline" size={48} color="#E2E0DA" />
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
              Aucune donnée pour cet exercice
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────
function MiniKPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center',
    }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

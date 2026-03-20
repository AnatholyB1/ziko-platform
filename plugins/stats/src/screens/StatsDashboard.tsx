import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import {
  useStatsStore, fetchAllStats,
  type Period, type VolumePoint, type SessionPoint, type MuscleGroupData,
} from '../store';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const PERIODS: { label: string; value: Period }[] = [
  { label: '7J', value: '7d' },
  { label: '30J', value: '30d' },
  { label: '90J', value: '90d' },
  { label: 'Tout', value: 'all' },
];

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalCount: 0,
  color: (opacity = 1) => `rgba(255, 92, 26, ${opacity})`,
  labelColor: () => '#6B6963',
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF5C1A' },
  propsForBackgroundLines: { stroke: '#E2E0DA', strokeDasharray: '' },
  style: { borderRadius: 12 },
};

// ── Helpers ─────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function shortWeek(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Component ───────────────────────────────────────────
export default function StatsDashboard({ supabase }: { supabase: any }) {
  const {
    period, isLoading, volumeTimeline, sessionFrequency,
    muscleDistribution, topExercises, recentSessions, personalRecords,
    totalSessions, totalVolume, avgSessionDuration, avgRpe,
    setPeriod,
  } = useStatsStore();

  const load = useCallback(() => fetchAllStats(supabase, period), [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1C1A17' }}>Analytics</Text>
      </View>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: period === p.value ? '#FF5C1A' : '#FFFFFF',
              borderWidth: 1,
              borderColor: period === p.value ? '#FF5C1A' : '#E2E0DA',
            }}
          >
            <Text style={{
              fontSize: 14, fontWeight: '600',
              color: period === p.value ? '#FFFFFF' : '#6B6963',
            }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#FF5C1A" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── KPI Cards ──────────────────────────────────── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <KPICard
            icon="barbell-outline"
            label="Séances"
            value={`${totalSessions}`}
            color="#FF5C1A"
          />
          <KPICard
            icon="trending-up-outline"
            label="Volume total"
            value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`}
            color="#2563EB"
          />
          <KPICard
            icon="time-outline"
            label="Durée moy."
            value={formatDuration(avgSessionDuration)}
            color="#7C3AED"
          />
          <KPICard
            icon="flame-outline"
            label="RPE moy."
            value={avgRpe != null ? `${avgRpe}` : '—'}
            color="#EF4444"
          />
        </View>

        {/* ── Volume Trend ───────────────────────────────── */}
        {volumeTimeline.length > 1 && (
          <ChartCard title="Volume (kg)" icon="trending-up">
            <LineChart
              data={{
                labels: pickLabels(volumeTimeline.map((v) => shortDate(v.date)), 6),
                datasets: [{ data: volumeTimeline.map((v) => v.volume || 0) }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={{ borderRadius: 12 }}
              withVerticalLines={false}
              fromZero
            />
          </ChartCard>
        )}

        {/* ── Sessions / Week ────────────────────────────── */}
        {sessionFrequency.length > 1 && (
          <ChartCard title="Séances / semaine" icon="calendar">
            <BarChart
              data={{
                labels: pickLabels(sessionFrequency.map((s) => shortWeek(s.week)), 6),
                datasets: [{ data: sessionFrequency.map((s) => s.count) }],
              }}
              width={CHART_W}
              height={200}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              }}
              style={{ borderRadius: 12 }}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          </ChartCard>
        )}

        {/* ── Muscle Distribution ────────────────────────── */}
        {muscleDistribution.length > 0 && (
          <ChartCard title="Groupes musculaires" icon="body">
            <PieChart
              data={muscleDistribution.slice(0, 8).map((m) => ({
                name: m.name,
                population: m.sets,
                color: m.color,
                legendFontColor: '#6B6963',
                legendFontSize: 12,
              }))}
              width={CHART_W}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute={false}
            />
          </ChartCard>
        )}

        {/* ── Top Exercises ──────────────────────────────── */}
        {topExercises.length > 0 && (
          <ChartCard title="Exercices les plus fréquents" icon="trophy">
            {topExercises.slice(0, 5).map((ex, i) => (
              <TouchableOpacity
                key={ex.exercise_id}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/(plugins)/stats/exercise',
                    params: { exerciseId: ex.exercise_id, exerciseName: ex.name },
                  } as any)
                }
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: i < topExercises.length - 1 && i < 4 ? 1 : 0,
                  borderBottomColor: '#E2E0DA',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: '#FF5C1A15', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF5C1A' }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 14, color: '#1C1A17', flex: 1 }}
                    numberOfLines={1}
                  >
                    {ex.name}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF5C1A' }}>
                    {ex.count}x
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#6B6963" />
                </View>
              </TouchableOpacity>
            ))}
          </ChartCard>
        )}

        {/* ── Personal Records ───────────────────────────── */}
        {personalRecords.length > 0 && (
          <ChartCard title="Records personnels" icon="medal">
            {personalRecords.slice(0, 5).map((pr, i) => (
              <View
                key={pr.exercise_id}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: i < 4 ? 1 : 0,
                  borderBottomColor: '#E2E0DA',
                }}
              >
                <Text
                  style={{ fontSize: 14, color: '#1C1A17', flex: 1 }}
                  numberOfLines={1}
                >
                  {pr.exercise_name}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF5C1A' }}>
                  {pr.max_weight}kg × {pr.max_reps}
                </Text>
              </View>
            ))}
          </ChartCard>
        )}

        {/* ── Recent Sessions ────────────────────────────── */}
        {recentSessions.length > 0 && (
          <ChartCard title="Dernières séances" icon="list">
            {recentSessions.slice(0, 8).map((s, i) => {
              const date = new Date(s.started_at);
              const dur = s.ended_at
                ? Math.round((new Date(s.ended_at).getTime() - date.getTime()) / 1000)
                : s.total_duration_active_seconds ?? 0;

              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/(plugins)/stats/session',
                      params: { sessionId: s.id },
                    } as any)
                  }
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: i < 7 ? 1 : 0,
                    borderBottomColor: '#E2E0DA',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17' }} numberOfLines={1}>
                      {s.name ?? 'Séance libre'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>
                      {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' • '}
                      {formatDuration(dur)}
                      {s.total_sets != null && ` • ${s.total_sets} séries`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF5C1A' }}>
                      {s.total_volume_kg != null ? `${Math.round(s.total_volume_kg)}kg` : '—'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ChartCard>
        )}

        {/* Empty state */}
        {!isLoading && totalSessions === 0 && (
          <View style={{
            alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
          }}>
            <Ionicons name="stats-chart-outline" size={64} color="#E2E0DA" />
            <Text style={{ fontSize: 16, color: '#6B6963', marginTop: 12, textAlign: 'center' }}>
              Pas encore de données.{'\n'}Termine une séance pour voir tes stats !
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────
function KPICard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <View style={{
      flex: 1, minWidth: (SCREEN_W - 64) / 2,
      backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: '#E2E0DA',
    }}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17', marginTop: 8 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ChartCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <View style={{
      backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: '#E2E0DA',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon as any} size={18} color="#FF5C1A" />
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Utility: pick evenly-spaced labels ──────────────────
function pickLabels(labels: string[], max: number): string[] {
  if (labels.length <= max) return labels;
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}

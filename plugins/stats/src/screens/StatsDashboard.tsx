import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import {
  useStatsStore, fetchAllStats,
  fetchHabitsOverview, fetchHabitsCompletionTimeline, fetchHabitPerformances,
  fetchNutritionOverview, fetchNutritionTimeline, fetchMealTypeDistribution,
  fetchGamificationOverview, fetchXPTimeline, fetchXPBySource,
  fetchAIOverview, fetchConversationActivity,
  fetchCommunityOverview, fetchCommunityActivity,
  type Period, type HabitsOverview, type NutritionOverview,
  type GamificationOverview, type AIOverview, type CommunityOverview,
  type HabitCompletionPoint, type NutritionDayPoint, type CommunityActivityPoint,
  type XPTimelinePoint, type ConversationActivity,
  type HabitPerformance, type MealTypeDistribution, type XPBySource,
} from '../store';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const PERIODS: { label: string; value: Period }[] = [
  { label: '7J', value: '7d' },
  { label: '30J', value: '30d' },
  { label: '90J', value: '90d' },
  { label: 'Tout', value: 'all' },
];

type Tab = 'workout' | 'habits' | 'nutrition' | 'gamification' | 'ai' | 'community';

const BASE_TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'workout', label: 'Séances', icon: 'barbell' },
  { key: 'habits', label: 'Habitudes', icon: 'checkmark-circle' },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
  { key: 'gamification', label: 'Récompenses', icon: 'trophy' },
  { key: 'ai', label: 'IA', icon: 'chatbubble-ellipses' },
];

function getChartConfig(theme: any) {
  return {
    backgroundColor: theme.surface,
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalCount: 0,
    color: (opacity = 1) => `rgba(255, 92, 26, ${opacity})`,
    labelColor: () => theme.muted,
    propsForDots: { r: '4', strokeWidth: '2', stroke: theme.primary },
    propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '' },
    style: { borderRadius: 12 },
  };
}

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

function getCutoff(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Component ───────────────────────────────────────────
export default function StatsDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const {
    period, isLoading, volumeTimeline, sessionFrequency,
    muscleDistribution, topExercises, recentSessions, personalRecords,
    totalSessions, totalVolume, avgSessionDuration, avgRpe,
    setPeriod,
  } = useStatsStore();

  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const communityEnabled = enabledPlugins.includes('community');

  const tabs = useMemo(() => {
    if (!communityEnabled) return BASE_TABS;
    return [...BASE_TABS, { key: 'community' as Tab, label: 'Social', icon: 'people' }];
  }, [communityEnabled]);

  const [activeTab, setActiveTab] = useState<Tab>('workout');

  // Extra data states
  const [habitsOverview, setHabitsOverview] = useState<HabitsOverview | null>(null);
  const [habitsTimeline, setHabitsTimeline] = useState<HabitCompletionPoint[]>([]);
  const [habitPerformances, setHabitPerformances] = useState<HabitPerformance[]>([]);
  const [nutritionOverview, setNutritionOverview] = useState<NutritionOverview | null>(null);
  const [nutritionTimeline, setNutritionTimeline] = useState<NutritionDayPoint[]>([]);
  const [mealDistribution, setMealDistribution] = useState<MealTypeDistribution[]>([]);
  const [gamifOverview, setGamifOverview] = useState<GamificationOverview | null>(null);
  const [xpTimeline, setXpTimeline] = useState<XPTimelinePoint[]>([]);
  const [xpBySource, setXpBySource] = useState<XPBySource[]>([]);
  const [aiOverview, setAiOverview] = useState<AIOverview | null>(null);
  const [convoActivity, setConvoActivity] = useState<ConversationActivity[]>([]);
  const [communityOverview, setCommunityOverview] = useState<CommunityOverview | null>(null);
  const [communityActivity, setCommunityActivity] = useState<CommunityActivityPoint[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const cutoff = getCutoff(period);

  const loadTab = useCallback(async (tab: Tab) => {
    setTabLoading(true);
    try {
      if (tab === 'workout') {
        await fetchAllStats(supabase, period);
      } else if (tab === 'habits') {
        const [ov, tl, perf] = await Promise.all([
          fetchHabitsOverview(supabase, cutoff),
          fetchHabitsCompletionTimeline(supabase, cutoff),
          fetchHabitPerformances(supabase, cutoff),
        ]);
        setHabitsOverview(ov); setHabitsTimeline(tl); setHabitPerformances(perf);
      } else if (tab === 'nutrition') {
        const [ov, tl, md] = await Promise.all([
          fetchNutritionOverview(supabase, cutoff),
          fetchNutritionTimeline(supabase, cutoff),
          fetchMealTypeDistribution(supabase, cutoff),
        ]);
        setNutritionOverview(ov); setNutritionTimeline(tl); setMealDistribution(md);
      } else if (tab === 'gamification') {
        const [ov, tl, src] = await Promise.all([
          fetchGamificationOverview(supabase, cutoff),
          fetchXPTimeline(supabase, cutoff),
          fetchXPBySource(supabase, cutoff),
        ]);
        setGamifOverview(ov); setXpTimeline(tl); setXpBySource(src);
      } else if (tab === 'ai') {
        const [ov, act] = await Promise.all([
          fetchAIOverview(supabase, cutoff),
          fetchConversationActivity(supabase, cutoff),
        ]);
        setAiOverview(ov); setConvoActivity(act);
      } else if (tab === 'community') {
        const [ov, act] = await Promise.all([
          fetchCommunityOverview(supabase, cutoff),
          fetchCommunityActivity(supabase, cutoff),
        ]);
        setCommunityOverview(ov); setCommunityActivity(act);
      }
    } finally {
      setTabLoading(false);
    }
  }, [period, cutoff]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, period]);

  const handleTabChange = (tab: Tab) => { setActiveTab(tab); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>Analytics</Text>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingTop: 4, paddingBottom: 8 }}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => handleTabChange(t.key)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 36, paddingHorizontal: 14, borderRadius: 20,
              backgroundColor: activeTab === t.key ? theme.primary : theme.surface,
              borderWidth: 1,
              borderColor: activeTab === t.key ? theme.primary : theme.border,
            }}
          >
            <Ionicons
              name={t.icon as any}
              size={16}
              color={activeTab === t.key ? theme.surface : theme.muted}
            />
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: activeTab === t.key ? theme.surface : theme.muted,
            }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
              backgroundColor: period === p.value ? theme.text : theme.surface,
              borderWidth: 1,
              borderColor: period === p.value ? theme.text : theme.border,
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: period === p.value ? theme.surface : theme.muted,
            }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading || tabLoading} onRefresh={() => loadTab(activeTab)} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'workout' && <WorkoutTab
          volumeTimeline={volumeTimeline} sessionFrequency={sessionFrequency}
          muscleDistribution={muscleDistribution} topExercises={topExercises}
          recentSessions={recentSessions} personalRecords={personalRecords}
          totalSessions={totalSessions} totalVolume={totalVolume}
          avgSessionDuration={avgSessionDuration} avgRpe={avgRpe}
          isLoading={isLoading}
        />}
        {activeTab === 'habits' && <HabitsTab
          overview={habitsOverview} timeline={habitsTimeline}
          performances={habitPerformances} loading={tabLoading}
        />}
        {activeTab === 'nutrition' && <NutritionTab
          overview={nutritionOverview} timeline={nutritionTimeline}
          mealDistribution={mealDistribution} loading={tabLoading}
        />}
        {activeTab === 'gamification' && <GamificationTab
          overview={gamifOverview} xpTimeline={xpTimeline}
          xpBySource={xpBySource} loading={tabLoading}
        />}
        {activeTab === 'ai' && <AITab
          overview={aiOverview} activity={convoActivity} loading={tabLoading}
        />}
        {activeTab === 'community' && <CommunityTab
          overview={communityOverview} activity={communityActivity} loading={tabLoading}
        />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════
// WORKOUT TAB (original dashboard content)
// ════════════════════════════════════════════════════════
function WorkoutTab({
  volumeTimeline, sessionFrequency, muscleDistribution, topExercises,
  recentSessions, personalRecords, totalSessions, totalVolume,
  avgSessionDuration, avgRpe, isLoading,
}: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <>
      {/* KPI Cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="barbell-outline" label="Séances" value={`${totalSessions}`} color={theme.primary} />
        <KPICard
          icon="trending-up-outline" label="Volume total"
          value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`}
          color="#2563EB"
        />
        <KPICard icon="time-outline" label="Durée moy." value={formatDuration(avgSessionDuration)} color="#7C3AED" />
        <KPICard icon="flame-outline" label="RPE moy." value={avgRpe != null ? `${avgRpe}` : '—'} color="#EF4444" />
      </View>

      {/* Volume Trend */}
      {volumeTimeline.length > 1 && (
        <ChartCard title="Volume (kg)" icon="trending-up">
          <LineChart
            data={{
              labels: pickLabels(volumeTimeline.map((v: any) => shortDate(v.date)), 6),
              datasets: [{ data: volumeTimeline.map((v: any) => v.volume || 0) }],
            }}
            width={CHART_W} height={200} chartConfig={getChartConfig(theme)}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
          />
        </ChartCard>
      )}

      {/* Sessions / Week */}
      {sessionFrequency.length > 1 && (
        <ChartCard title="Séances / semaine" icon="calendar">
          <BarChart
            data={{
              labels: pickLabels(sessionFrequency.map((s: any) => shortWeek(s.week)), 6),
              datasets: [{ data: sessionFrequency.map((s: any) => s.count) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(37, 99, 235, ${o})` }}
            style={{ borderRadius: 12 }} fromZero showValuesOnTopOfBars
            yAxisLabel="" yAxisSuffix=""
          />
        </ChartCard>
      )}

      {/* Muscle Distribution */}
      {muscleDistribution.length > 0 && (
        <ChartCard title="Groupes musculaires" icon="body">
          <PieChart
            data={muscleDistribution.slice(0, 8).map((m: any) => ({
              name: m.name, population: m.sets, color: m.color,
              legendFontColor: theme.muted, legendFontSize: 12,
            }))}
            width={CHART_W} height={200} chartConfig={getChartConfig(theme)}
            accessor="population" backgroundColor="transparent" paddingLeft="8" absolute={false}
          />
        </ChartCard>
      )}

      {/* Top Exercises */}
      {topExercises.length > 0 && (
        <ChartCard title="Exercices les plus fréquents" icon="trophy">
          {topExercises.slice(0, 5).map((ex: any, i: number) => (
            <TouchableOpacity
              key={ex.exercise_id}
              onPress={() => router.push({ pathname: '/(app)/(plugins)/stats/exercise', params: { exerciseId: ex.exercise_id, exerciseName: ex.name } } as any)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: theme.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 14, color: theme.text, flex: 1 }} numberOfLines={1}>{ex.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>{ex.count}x</Text>
                <Ionicons name="chevron-forward" size={16} color="#6B6963" />
              </View>
            </TouchableOpacity>
          ))}
        </ChartCard>
      )}

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <ChartCard title="Records personnels" icon="medal">
          {personalRecords.slice(0, 5).map((pr: any, i: number) => (
            <View
              key={pr.exercise_id}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: theme.border,
              }}
            >
              <Text style={{ fontSize: 14, color: theme.text, flex: 1 }} numberOfLines={1}>{pr.exercise_name}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>{pr.max_weight}kg × {pr.max_reps}</Text>
            </View>
          ))}
        </ChartCard>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <ChartCard title="Dernières séances" icon="list">
          {recentSessions.slice(0, 8).map((s: any, i: number) => {
            const date = new Date(s.started_at);
            const dur = s.ended_at
              ? Math.round((new Date(s.ended_at).getTime() - date.getTime()) / 1000)
              : s.total_duration_active_seconds ?? 0;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => router.push({ pathname: '/(app)/(plugins)/stats/session', params: { sessionId: s.id } } as any)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10, borderBottomWidth: i < 7 ? 1 : 0, borderBottomColor: theme.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                    {s.name ?? 'Séance libre'}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {' • '}{formatDuration(dur)}
                    {s.total_sets != null && ` • ${s.total_sets} séries`}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>
                  {s.total_volume_kg != null ? `${Math.round(s.total_volume_kg)}kg` : '—'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ChartCard>
      )}

      {/* Empty state */}
      {!isLoading && totalSessions === 0 && <EmptyState icon="barbell-outline" text="Pas encore de séance.\nTermine un entraînement pour voir tes stats !" />}
    </>
  );
}

// ════════════════════════════════════════════════════════
// HABITS TAB
// ════════════════════════════════════════════════════════
function HabitsTab({ overview, timeline, performances, loading }: {
  overview: HabitsOverview | null;
  timeline: HabitCompletionPoint[];
  performances: HabitPerformance[];
  loading: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  if (loading && !overview) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />;
  if (!overview || overview.totalHabits === 0) return <EmptyState icon="checkmark-circle-outline" text="Pas encore d'habitudes.\nCrée tes habitudes quotidiennes !" />;

  return (
    <>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="checkmark-done-outline" label="Habitudes" value={`${overview.totalHabits}`} color="#10B981" />
        <KPICard icon="trending-up-outline" label="Taux moyen" value={`${overview.avgDailyCompletion}%`} color={theme.primary} />
        <KPICard icon="star-outline" label="Meilleur jour" value={overview.bestDay ? `${overview.bestDayRate}%` : '—'} color="#F59E0B" />
        <KPICard icon="calendar-outline" label="Jours actifs" value={`${overview.activeDays}`} color="#2563EB" />
      </View>

      {/* Completion Timeline */}
      {timeline.length > 1 && (
        <ChartCard title="Taux de complétion quotidien" icon="analytics">
          <LineChart
            data={{
              labels: pickLabels(timeline.map(t => shortDate(t.date)), 6),
              datasets: [{ data: timeline.map(t => t.rate) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(16, 185, 129, ${o})` }}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
            formatYLabel={(v) => `${v}%`}
          />
        </ChartCard>
      )}

      {/* Habit detail cards */}
      {performances.length > 0 && (
        <ChartCard title="Performance par habitude" icon="list">
          {performances.map((h, i) => (
            <View
              key={h.id}
              style={{
                paddingVertical: 12,
                borderBottomWidth: i < performances.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 22 }}>{h.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{h.name}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted }}>
                    {h.totalCompletions} complétions • 🔥 {h.currentStreak}j streak
                  </Text>
                </View>
                <View style={{
                  backgroundColor: h.completionRate >= 80 ? '#DCFCE7' : h.completionRate >= 50 ? '#FEF9C3' : '#FEE2E2',
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                }}>
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: h.completionRate >= 80 ? '#16A34A' : h.completionRate >= 50 ? '#CA8A04' : '#DC2626',
                  }}>
                    {h.completionRate}%
                  </Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3 }}>
                <View style={{
                  width: `${Math.min(h.completionRate, 100)}%`,
                  height: '100%', backgroundColor: h.color, borderRadius: 3,
                }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted }}>Record: {h.longestStreak}j</Text>
                <Text style={{ fontSize: 11, color: theme.muted }}>
                  {h.type === 'count' ? `Objectif: ${h.target}` : 'Oui/Non'}
                </Text>
              </View>
            </View>
          ))}
        </ChartCard>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════
// NUTRITION TAB
// ════════════════════════════════════════════════════════
function NutritionTab({ overview, timeline, mealDistribution, loading }: {
  overview: NutritionOverview | null;
  timeline: NutritionDayPoint[];
  mealDistribution: MealTypeDistribution[];
  loading: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  if (loading && !overview) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />;
  if (!overview || overview.totalMeals === 0) return <EmptyState icon="nutrition-outline" text="Pas encore de données nutrition.\nLog tes repas pour suivre tes macros !" />;

  return (
    <>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="restaurant-outline" label="Repas logués" value={`${overview.totalMeals}`} color={theme.primary} />
        <KPICard icon="flame-outline" label="Cal/jour moy." value={`${overview.avgDailyCalories}`} color="#EF4444" />
        <KPICard icon="calendar-outline" label="Jours trackés" value={`${overview.daysTracked}`} color="#2563EB" />
        <KPICard icon="nutrition-outline" label="Protéines/j" value={`${overview.avgProtein}g`} color="#10B981" />
      </View>

      {/* Calories Timeline */}
      {timeline.length > 1 && (
        <ChartCard title="Calories quotidiennes" icon="flame">
          <LineChart
            data={{
              labels: pickLabels(timeline.map(t => shortDate(t.date)), 6),
              datasets: [{ data: timeline.map(t => t.calories || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(239, 68, 68, ${o})` }}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
          />
        </ChartCard>
      )}

      {/* Macros Trend */}
      {timeline.length > 1 && (
        <ChartCard title="Macronutriments (g/jour)" icon="pie-chart">
          <LineChart
            data={{
              labels: pickLabels(timeline.map(t => shortDate(t.date)), 6),
              datasets: [
                { data: timeline.map(t => t.protein || 0), color: (o = 1) => `rgba(16, 185, 129, ${o})` },
                { data: timeline.map(t => t.carbs || 0), color: (o = 1) => `rgba(37, 99, 235, ${o})` },
                { data: timeline.map(t => t.fat || 0), color: (o = 1) => `rgba(245, 158, 11, ${o})` },
              ],
              legend: ['Protéines', 'Glucides', 'Lipides'],
            }}
            width={CHART_W} height={220}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(16, 185, 129, ${o})` }}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
          />
        </ChartCard>
      )}

      {/* Meal Type Distribution */}
      {mealDistribution.length > 0 && (
        <ChartCard title="Répartition par repas" icon="restaurant">
          <PieChart
            data={mealDistribution.map(m => ({
              name: m.label, population: m.count, color: m.color,
              legendFontColor: theme.muted, legendFontSize: 12,
            }))}
            width={CHART_W} height={200} chartConfig={getChartConfig(theme)}
            accessor="population" backgroundColor="transparent" paddingLeft="8" absolute={false}
          />
          {/* Avg calories per meal type */}
          <View style={{ marginTop: 12, gap: 8 }}>
            {mealDistribution.map(m => (
              <View key={m.type} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                  <Text style={{ fontSize: 13, color: theme.text }}>{m.label}</Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {m.count}x • ~{m.avgCalories} cal
                </Text>
              </View>
            ))}
          </View>
        </ChartCard>
      )}

      {/* Top Foods */}
      {overview.topFoods.length > 0 && (
        <ChartCard title="Aliments les plus logués" icon="leaf">
          {overview.topFoods.slice(0, 8).map((f, i) => (
            <View
              key={f.name}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 8,
                borderBottomWidth: i < Math.min(overview.topFoods.length, 8) - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 14, color: theme.text }} numberOfLines={1}>{f.name}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981' }}>{f.count}x</Text>
            </View>
          ))}
        </ChartCard>
      )}

      {/* Macros Summary */}
      <ChartCard title="Moyenne quotidienne" icon="stats-chart">
        <View style={{ gap: 12 }}>
          <MacroBar label="Protéines" value={overview.avgProtein} unit="g" color="#10B981" max={Math.max(overview.avgProtein, overview.avgCarbs, overview.avgFat)} />
          <MacroBar label="Glucides" value={overview.avgCarbs} unit="g" color="#2563EB" max={Math.max(overview.avgProtein, overview.avgCarbs, overview.avgFat)} />
          <MacroBar label="Lipides" value={overview.avgFat} unit="g" color="#F59E0B" max={Math.max(overview.avgProtein, overview.avgCarbs, overview.avgFat)} />
        </View>
      </ChartCard>
    </>
  );
}

// ════════════════════════════════════════════════════════
// GAMIFICATION TAB
// ════════════════════════════════════════════════════════
function GamificationTab({ overview, xpTimeline, xpBySource, loading }: {
  overview: GamificationOverview | null;
  xpTimeline: XPTimelinePoint[];
  xpBySource: XPBySource[];
  loading: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  if (loading && !overview) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />;
  if (!overview) return <EmptyState icon="trophy-outline" text="Pas encore de données gamification.\nTermine un entraînement pour gagner de l'XP !" />;

  return (
    <>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="flash-outline" label="XP total" value={`${overview.totalXP}`} color={theme.primary} />
        <KPICard icon="shield-outline" label={`Niveau ${overview.currentLevel}`} value={overview.levelTitle} color="#7C3AED" />
        <KPICard icon="logo-bitcoin" label="Pièces" value={`${overview.totalCoins}`} color="#F59E0B" />
        <KPICard icon="flame-outline" label="Streak" value={`${overview.currentStreak}j`} color="#EF4444" />
      </View>

      {/* XP Cumulative Timeline */}
      {xpTimeline.length > 1 && (
        <ChartCard title="XP cumulé" icon="trending-up">
          <LineChart
            data={{
              labels: pickLabels(xpTimeline.map(t => shortDate(t.date)), 6),
              datasets: [{ data: xpTimeline.map(t => t.cumulative || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(124, 58, 237, ${o})` }}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
          />
        </ChartCard>
      )}

      {/* XP Daily earnings */}
      {xpTimeline.length > 1 && (
        <ChartCard title="XP gagné par jour" icon="bar-chart">
          <BarChart
            data={{
              labels: pickLabels(xpTimeline.map(t => shortDate(t.date)), 6),
              datasets: [{ data: xpTimeline.map(t => t.xp || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(255, 92, 26, ${o})` }}
            style={{ borderRadius: 12 }} fromZero showValuesOnTopOfBars
            yAxisLabel="" yAxisSuffix=""
          />
        </ChartCard>
      )}

      {/* XP by Source */}
      {xpBySource.length > 0 && (
        <ChartCard title="Sources d'XP" icon="git-branch">
          <PieChart
            data={xpBySource.map(s => ({
              name: s.label, population: s.total, color: s.color,
              legendFontColor: theme.muted, legendFontSize: 12,
            }))}
            width={CHART_W} height={200} chartConfig={getChartConfig(theme)}
            accessor="population" backgroundColor="transparent" paddingLeft="8" absolute={false}
          />
          <View style={{ marginTop: 12, gap: 8 }}>
            {xpBySource.map(s => (
              <View key={s.source} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                  <Text style={{ fontSize: 13, color: theme.text }}>{s.label}</Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {s.total} XP ({s.count}x)
                </Text>
              </View>
            ))}
          </View>
        </ChartCard>
      )}

      {/* Extra stats */}
      <ChartCard title="Résumé" icon="information-circle">
        <View style={{ gap: 10 }}>
          <StatRow label="Record streak" value={`${overview.longestStreak} jours`} icon="🔥" />
          <StatRow label="Jours actifs" value={`${overview.daysActive}`} icon="📅" />
          <StatRow label="Objets achetés" value={`${overview.itemsOwned}`} icon="🛍️" />
          <StatRow label="Pièces dépensées" value={`${overview.coinsSpent}`} icon="💰" />
          <StatRow label="Achats" value={`${overview.totalPurchases}`} icon="🧾" />
        </View>
      </ChartCard>
    </>
  );
}

// ════════════════════════════════════════════════════════
// AI TAB
// ════════════════════════════════════════════════════════
function AITab({ overview, activity, loading }: {
  overview: AIOverview | null;
  activity: ConversationActivity[];
  loading: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  if (loading && !overview) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />;
  if (!overview || overview.totalConversations === 0) return <EmptyState icon="chatbubble-ellipses-outline" text="Pas encore de conversations IA.\nDiscute avec ton coach pour voir tes stats !" />;

  return (
    <>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="chatbubbles-outline" label="Conversations" value={`${overview.totalConversations}`} color="#2563EB" />
        <KPICard icon="chatbox-outline" label="Messages" value={`${overview.totalMessages}`} color={theme.primary} />
        <KPICard icon="swap-horizontal-outline" label="Msg/convo moy." value={`${overview.avgMessagesPerConvo}`} color="#7C3AED" />
        <KPICard icon="calendar-outline" label="Jours actifs" value={`${overview.activeDays}`} color="#10B981" />
      </View>

      {/* Activity Timeline */}
      {activity.length > 1 && (
        <ChartCard title="Messages par jour" icon="bar-chart">
          <BarChart
            data={{
              labels: pickLabels(activity.map(a => shortDate(a.date)), 6),
              datasets: [{ data: activity.map(a => a.messages || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(37, 99, 235, ${o})` }}
            style={{ borderRadius: 12 }} fromZero showValuesOnTopOfBars
            yAxisLabel="" yAxisSuffix=""
          />
        </ChartCard>
      )}

      {/* Conversations par jour */}
      {activity.length > 1 && (
        <ChartCard title="Conversations par jour" icon="chatbubbles">
          <LineChart
            data={{
              labels: pickLabels(activity.map(a => shortDate(a.date)), 6),
              datasets: [{ data: activity.map(a => a.conversations || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(124, 58, 237, ${o})` }}
            bezier style={{ borderRadius: 12 }} withVerticalLines={false} fromZero
          />
        </ChartCard>
      )}

      {/* Message split */}
      <ChartCard title="Répartition des messages" icon="analytics">
        <PieChart
          data={[
            { name: 'Toi', population: overview.userMessages, color: theme.primary, legendFontColor: theme.muted, legendFontSize: 12 },
            { name: 'Coach IA', population: overview.assistantMessages, color: '#2563EB', legendFontColor: theme.muted, legendFontSize: 12 },
          ]}
          width={CHART_W} height={180} chartConfig={getChartConfig(theme)}
          accessor="population" backgroundColor="transparent" paddingLeft="8" absolute={false}
        />
      </ChartCard>

      {/* Summary */}
      <ChartCard title="Résumé" icon="information-circle">
        <View style={{ gap: 10 }}>
          <StatRow label="Convos/semaine moy." value={`${overview.avgConvosPerWeek}`} icon="💬" />
          <StatRow label="Messages envoyés" value={`${overview.userMessages}`} icon="📤" />
          <StatRow label="Réponses IA" value={`${overview.assistantMessages}`} icon="🤖" />
          {overview.longestConversation && (
            <StatRow
              label="Plus longue convo"
              value={`${overview.longestConversation.messageCount} msg`}
              icon="📏"
            />
          )}
        </View>
      </ChartCard>
    </>
  );
}

// ════════════════════════════════════════════════════════
// COMMUNITY TAB
// ════════════════════════════════════════════════════════
function CommunityTab({ overview, activity, loading }: {
  overview: CommunityOverview | null;
  activity: CommunityActivityPoint[];
  loading: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  if (loading && !overview) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />;
  if (!overview || (overview.totalFriends === 0 && overview.messagesSent === 0))
    return <EmptyState icon="people-outline" text="Pas encore d'activité sociale.\nAjoute des amis pour commencer !" />;

  const winRate = overview.challengesTotal > 0
    ? Math.round((overview.challengesWon / overview.challengesTotal) * 100)
    : 0;

  return (
    <>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPICard icon="people-outline" label="Amis" value={`${overview.totalFriends}`} color="#2563EB" />
        <KPICard icon="chatbox-outline" label="Messages" value={`${overview.messagesSent}`} color={theme.primary} />
        <KPICard icon="trophy-outline" label="Défis gagnés" value={`${overview.challengesWon}/${overview.challengesTotal}`} color="#10B981" />
        <KPICard icon="gift-outline" label="XP offert" value={`${overview.xpGifted}`} color="#7C3AED" />
      </View>

      {/* Message Activity Timeline */}
      {activity.length > 1 && (
        <ChartCard title="Messages envoyés par jour" icon="bar-chart">
          <BarChart
            data={{
              labels: pickLabels(activity.map(a => shortDate(a.date)), 6),
              datasets: [{ data: activity.map(a => a.messages || 0) }],
            }}
            width={CHART_W} height={200}
            chartConfig={{ ...getChartConfig(theme), color: (o = 1) => `rgba(37, 99, 235, ${o})` }}
            style={{ borderRadius: 12 }} fromZero showValuesOnTopOfBars
            yAxisLabel="" yAxisSuffix=""
          />
        </ChartCard>
      )}

      {/* Challenge Results */}
      {overview.challengesTotal > 0 && (
        <ChartCard title="Résultats des défis" icon="podium">
          <PieChart
            data={[
              { name: 'Gagnés', population: overview.challengesWon || 0, color: '#10B981', legendFontColor: theme.muted, legendFontSize: 12 },
              { name: 'Perdus', population: overview.challengesLost || 0, color: '#EF4444', legendFontColor: theme.muted, legendFontSize: 12 },
              ...(overview.challengesTied > 0 ? [{ name: 'Égalités', population: overview.challengesTied, color: '#F59E0B', legendFontColor: theme.muted, legendFontSize: 12 }] : []),
            ].filter(d => d.population > 0)}
            width={CHART_W} height={200} chartConfig={getChartConfig(theme)}
            accessor="population" backgroundColor="transparent" paddingLeft="8" absolute={false}
          />
          <View style={{
            alignSelf: 'center', marginTop: 8,
            backgroundColor: winRate >= 50 ? '#DCFCE7' : '#FEE2E2',
            paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
          }}>
            <Text style={{
              fontSize: 14, fontWeight: '700',
              color: winRate >= 50 ? '#16A34A' : '#DC2626',
            }}>
              Taux de victoire : {winRate}%
            </Text>
          </View>
        </ChartCard>
      )}

      {/* Gifts & Encouragements */}
      <ChartCard title="Échanges sociaux" icon="heart">
        <View style={{ gap: 10 }}>
          <StatRow label="XP offert" value={`${overview.xpGifted}`} icon="🎁" />
          <StatRow label="XP reçu" value={`${overview.xpReceived}`} icon="📥" />
          <StatRow label="Pièces offertes" value={`${overview.coinsGifted}`} icon="💰" />
          <StatRow label="Pièces reçues" value={`${overview.coinsReceived}`} icon="🪙" />
          <StatRow label="Encouragements envoyés" value={`${overview.encouragementsSent}`} icon="💪" />
          <StatRow label="Encouragements reçus" value={`${overview.encouragementsReceived}`} icon="❤️" />
        </View>
      </ChartCard>

      {/* Summary */}
      <ChartCard title="Résumé" icon="information-circle">
        <View style={{ gap: 10 }}>
          <StatRow label="Programmes partagés" value={`${overview.programsShared}`} icon="📤" />
          <StatRow label="Entraînements de groupe" value={`${overview.groupWorkoutsDone}`} icon="🏋️" />
          <StatRow label="Réactions envoyées" value={`${overview.reactionsSent}`} icon="👍" />
          <StatRow label="Invitations envoyées" value={`${overview.invitesSent}`} icon="✉️" />
          <StatRow label="Invitations acceptées" value={`${overview.invitesAccepted}`} icon="✅" />
        </View>
      </ChartCard>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────
function KPICard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flex: 1, minWidth: (SCREEN_W - 64) / 2,
      backgroundColor: theme.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 8 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ChartCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon as any} size={18} color={theme.primary} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function MacroBar({ label, value, unit, color, max }: {
  label: string; value: number; unit: string; color: string; max: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 13, color: theme.muted }}>{value}{unit}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: theme.border, borderRadius: 4 }}>
        <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function StatRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0EFE9',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ fontSize: 14, color: theme.text }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{value}</Text>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <Ionicons name={icon as any} size={64} color="#E2E0DA" />
      <Text style={{ fontSize: 16, color: theme.muted, marginTop: 12, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

// ── Utility: pick evenly-spaced labels ──────────────────
function pickLabels(labels: string[], max: number): string[] {
  if (labels.length <= max) return labels;
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}

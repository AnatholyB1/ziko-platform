import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Modal, TextInput, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { supabase } from '../../src/lib/supabase';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../src/stores/themeStore';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import { SearchOverlay } from '../../src/components/SearchOverlay';
import { ErrorScreen } from '../../src/components/ErrorScreen';
import { Skeleton, FormRing, PluginsDrawer } from '@ziko/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useActiveAIProgram,
  useWeeklySessions,
  useRecentSessions,
  useProfile,
  parseWorkoutFrequency,
  useSleepToday,
  useHydrationToday,
  useNutritionToday,
  useStreak,
  HOME_DEFAULTS,
} from '../../src/hooks/useHomeData';
import { useAITips, dismissTip } from '../../src/hooks/useAITips';
import { useSmartActions } from '../../src/hooks/useSmartActions';

// ── fireAndForget ─────────────────────────────────────────────────────────────
async function fireAndForget(tool: string, input: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${process.env.EXPO_PUBLIC_API_URL}/ai/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tool, input }),
  }).catch(() => {}); // silent fire-and-forget
}

// ── MissionCardContent ────────────────────────────────────────────────────────
// Renders loading/empty/populated states — receives pre-computed data
function MissionCardContent({
  isLoading,
  activeProgram,
  onStart,
}: {
  isLoading: boolean;
  activeProgram: any | null;
  onStart: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  // Loading state
  if (isLoading) {
    return (
      <View style={{ backgroundColor: '#1C1A17', borderRadius: 12, padding: 18 }}>
        <View style={{ backgroundColor: 'rgba(255,250,246,0.12)', height: 14, borderRadius: 6, width: '40%', marginBottom: 10 }} />
        <View style={{ backgroundColor: 'rgba(255,250,246,0.12)', height: 14, borderRadius: 6, width: '75%', marginBottom: 8 }} />
        <View style={{ backgroundColor: 'rgba(255,250,246,0.12)', height: 14, borderRadius: 6, width: '55%' }} />
      </View>
    );
  }

  // Empty state
  if (!activeProgram) {
    return (
      <View style={{
        backgroundColor: '#1C1A17', borderRadius: 12, padding: 18,
        alignItems: 'center', overflow: 'hidden', position: 'relative',
      }}>
        <Svg width="100%" height={180} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Circle cx={300} cy={-20} r={160} fill="#FF5C1A" opacity={0.14} />
        </Svg>
        <View style={{
          width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,92,26,0.15)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="barbell-outline" size={28} color="#FF8E5A" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFAF6', marginTop: 14 }}>
          Aucun programme actif
        </Text>
        <Text style={{
          fontSize: 13, color: 'rgba(255,250,246,0.60)', marginTop: 6,
          textAlign: 'center', lineHeight: 18,
        }}>
          Génère un programme sur mesure avec l'IA Ziko en quelques secondes.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/ai-programs/dashboard' as any)}
          activeOpacity={0.8}
          style={{
            marginTop: 16, paddingHorizontal: 20, paddingVertical: 12,
            borderRadius: 9999, backgroundColor: '#FF5C1A',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>
            Créer un programme IA
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Populated state — parse program_data defensively
  const sessions: any[] = activeProgram?.program_data?.sessions ?? activeProgram?.program_data?.workouts ?? activeProgram?.program_data?.days ?? [];
  const todaySession = sessions[0] ?? null;
  const exercises: any[] = todaySession?.exercises ?? todaySession?.sets ?? [];
  const sessionName: string = todaySession?.name ?? todaySession?.title ?? activeProgram?.goal ?? 'Séance du jour';
  const programName: string = activeProgram?.goal ?? 'Programme IA';
  const duration: number = todaySession?.duration_minutes ?? todaySession?.duration ?? 45;

  return (
    <View style={{ backgroundColor: '#1C1A17', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      <Svg width="100%" height={180} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={300} cy={-20} r={160} fill="#FF5C1A" opacity={0.14} />
      </Svg>
      <View style={{ padding: 18 }}>
        <Text style={{
          fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: 0.10 * 11, color: 'rgba(255,250,246,0.65)',
        }}>
          Mission du jour
        </Text>
        <Text style={{
          fontSize: 22, fontWeight: '800', lineHeight: 22 * 1.1,
          color: '#FFFAF6', marginTop: 6, maxWidth: '85%',
        }}>
          {sessionName}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.60)', marginTop: 4 }}>
          {programName} · {exercises.length} exos · ~{duration} min
        </Text>
        <View style={{ gap: 6, marginTop: 14, marginBottom: 14 }}>
          {exercises.slice(0, 3).map((e: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 18, height: 18, borderRadius: 5,
                backgroundColor: 'rgba(255,92,26,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFB287' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: 'rgba(255,250,246,0.92)', fontSize: 12 }}>
                {e.name ?? e.exercise_name ?? 'Exercice'}
              </Text>
              <Text style={{ color: 'rgba(255,250,246,0.55)', fontSize: 11 }}>
                {e.scheme ?? e.sets != null ? `${e.sets ?? ''}×${e.reps ?? ''}` : ''}
              </Text>
            </View>
          ))}
          {exercises.length > 3 && (
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.50)', paddingLeft: 26, marginTop: 2 }}>
              +{exercises.length - 3} autres exercices
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={onStart}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FF5C1A', borderRadius: 10, height: 48,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Ionicons name="play-outline" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Allez, c'est parti !</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/(plugins)/ai-programs/${activeProgram?.id}` as any)}
            style={{
              width: 48, height: 48, backgroundColor: 'rgba(255,250,246,0.10)',
              borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-down-outline" size={16} color="#FFFAF6" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── HomeWeekStrip ─────────────────────────────────────────────────────────────
function HomeWeekStrip({
  weeklyCount, weeklyGoal, sessionDates,
}: { weeklyCount: number; weeklyGoal: number; sessionDates: Set<string> }) {
  const theme = useThemeStore((s) => s.theme);
  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const today = startOfDay(new Date());
  const jsToday = getDay(today);
  const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
  const monday = addDays(today, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = format(date, 'yyyy-MM-dd');
    const isToday = differenceInCalendarDays(date, today) === 0;
    const done = sessionDates.has(key) && differenceInCalendarDays(date, today) <= 0;
    return { label: DAY_LABELS[i], num: format(date, 'd'), isToday, done };
  });

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 14,
      shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
          Semaine · <Text style={{ color: '#FF5C1A', fontSize: 12, fontWeight: '700' }}>{weeklyCount}/{weeklyGoal}</Text>
        </Text>
        {weeklyGoal - weeklyCount > 0 && (
          <Text style={{ fontSize: 11, color: '#6B6963' }}>+{weeklyGoal - weeklyCount} pour atteindre l'objectif</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {days.map((d, i) => {
          let bg = 'transparent';
          let textColor = '#6B6963';
          let borderStyle: object = { borderWidth: 1, borderColor: '#E2E0DA' };
          if (d.done) { bg = '#22C55E'; textColor = '#fff'; borderStyle = {}; }
          else if (d.isToday) { bg = '#1C1A17'; textColor = '#fff'; borderStyle = {}; }
          return (
            <View key={i} style={[{
              flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: bg,
              alignItems: 'center', justifyContent: 'center',
            }, borderStyle]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: textColor, opacity: 0.75 }}>{d.label}</Text>
              {d.done ? (
                <Ionicons name="checkmark-outline" size={12} color="#fff" style={{ marginTop: 2 }} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '800', color: textColor, marginTop: 2 }}>{d.num}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── DashboardScreen ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const startSession = useWorkoutStore((s) => s.startSession);
  const { width: screenWidth } = useWindowDimensions();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = useAuthStore((s) => s.user?.id);
  // authProfile is populated during initialize() before the home screen mounts —
  // use it as an immediate name source while the TanStack Query resolves.
  const authProfile = useAuthStore((s) => s.profile);

  // ── TanStack Query hooks ──────────────────────────────────────────────────
  const { data: profile } = useProfile();
  const { data: streak = 0 } = useStreak();
  const { data: activeProgram, isLoading: programLoading } = useActiveAIProgram();
  const { data: weeklySessions = [], isLoading: weekLoading } = useWeeklySessions();
  const { data: recentSessions = [], isLoading: recentLoading } = useRecentSessions();
  const { data: sleepData, isLoading: sleepLoading } = useSleepToday();
  const { data: hydrationData, isLoading: hydrationLoading } = useHydrationToday();
  const { data: nutritionData, isLoading: nutritionLoading } = useNutritionToday();

  // ── Installed plugins from user_plugins (HOME-08) ─────────────────────────
  const { data: installedPluginIds } = useQuery({
    queryKey: ['user_plugins', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_plugins')
        .select('plugin_id')
        .eq('user_id', userId!)
        .eq('is_enabled', true);
      if (error) throw error;
      return (data ?? []).map((r: { plugin_id: string }) => r.plugin_id);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Derived wellness values ───────────────────────────────────────────────
  const sleepH = sleepData?.duration_hours ?? 0;
  const sleepPct = Math.min(100, Math.round((sleepH / HOME_DEFAULTS.sleepTargetH) * 100));
  const waterMl = hydrationData?.totalMl ?? 0;
  const waterPct = Math.min(100, Math.round((waterMl / HOME_DEFAULTS.hydrationGoalMl) * 100));
  const kcal = nutritionData?.totalCalories ?? 0;
  const nutritionPct = Math.min(100, Math.round((kcal / 2200) * 100));
  const weeklyGoal = parseWorkoutFrequency(profile?.workout_frequency);
  const weeklyCount = weeklySessions.length;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDone = weeklySessions.some((s: { started_at: string }) => s.started_at.startsWith(todayStr));
  // Rest day = no workout goal OR weekly target already reached
  const isRestDay = weeklyGoal === 0 || weeklyCount >= weeklyGoal;
  const loadPct = (todayDone || isRestDay) ? 100 : 0;
  const trackerPcts = [sleepPct, waterPct, nutritionPct, loadPct];
  const score = Math.round(trackerPcts.reduce((a, b) => a + b, 0) / trackerPcts.length);

  // ── Week strip dates ──────────────────────────────────────────────────────
  const weeklySessionDates = useMemo(() => {
    return new Set(weeklySessions.map((s) => s.started_at.split('T')[0]));
  }, [weeklySessions]);

  // ── AI Tips ───────────────────────────────────────────────────────────────
  const { tips } = useAITips({
    sleepDurationH: sleepH,
    hydrationMl: waterMl,
    hydrationGoalMl: HOME_DEFAULTS.hydrationGoalMl,
    unmetHabitName: undefined, // DEFERRED: habit tip requires useHabitsToday (Phase 37)
  });
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (tips.length === 0) return;
    const id = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 6500);
    return () => clearInterval(id);
  }, [tips.length]);
  const currentTip = tips[tipIndex % Math.max(1, tips.length)];

  // ── Start Mission handler ─────────────────────────────────────────────────
  const handleStartMission = async () => {
    const sessions: any[] = activeProgram?.program_data?.sessions ?? activeProgram?.program_data?.workouts ?? activeProgram?.program_data?.days ?? [];
    const sessionName: string = sessions[0]?.name ?? sessions[0]?.title ?? activeProgram?.goal ?? 'Séance du jour';
    await startSession(undefined, sessionName);
    router.push('/(app)/workout/session' as any);
  };

  // ── Smart Actions ─────────────────────────────────────────────────────────
  const smartActions = useSmartActions(
    { hour: new Date().getHours(), nutritionPct, hydrationPct: waterPct, sleepPct },
    (path) => router.push(path as any),
  );

  // ── UI State ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // QuickLog state
  const [waterConfirmed, setWaterConfirmed] = useState(false);
  const [moodConfirmed, setMoodConfirmed] = useState(false);
  const [weightConfirmed, setWeightConfirmed] = useState(false);
  const [showMoodSheet, setShowMoodSheet] = useState(false);
  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  }, []);

  // Use TanStack Query profile (authoritative) or auth store profile (available immediately on mount).
  // Guard against email-as-name: the Supabase trigger stores the email as name for email/password signups
  // when no full_name metadata is present, so we discard any value containing '@'.
  const resolvedName = profile?.name ?? authProfile?.name ?? null;
  const firstName = (resolvedName && !resolvedName.includes('@'))
    ? resolvedName.split(' ')[0]
    : 'Athlete';

  // ── QuickLog handlers ─────────────────────────────────────────────────────
  const handleLogWater = () => {
    fireAndForget('hydration_log', { amount_ml: 250 });
    queryClient.invalidateQueries({ queryKey: ['hydration', 'today'] });
    setWaterConfirmed(true);
    setTimeout(() => setWaterConfirmed(false), 2000);
  };

  const handleLogMood = (score: number) => {
    const h = new Date().getHours();
    const context = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    fireAndForget('journal_log_mood', { mood: score, context });
    setMoodConfirmed(true);
    setShowMoodSheet(false);
    setTimeout(() => setMoodConfirmed(false), 2000);
  };

  const handleLogWeight = () => {
    const value = parseFloat(weightInput);
    if (!Number.isFinite(value)) return;
    fireAndForget('measurements_log', { weight_kg: value });
    setWeightConfirmed(true);
    setShowWeightSheet(false);
    setWeightInput('');
    setTimeout(() => setWeightConfirmed(false), 2000);
  };

  const handleLogMeal = () => {
    router.push('/(app)/(plugins)/nutrition/log' as any);
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['program', 'active'] }),
      queryClient.invalidateQueries({ queryKey: ['workouts', 'weekly'] }),
      queryClient.invalidateQueries({ queryKey: ['workouts', 'recent'] }),
      queryClient.invalidateQueries({ queryKey: ['sleep', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['hydration', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['streak'] }),
    ]).catch(() => setLoadError(true));
    setRefreshing(false);
  };

  if (loadError) {
    return (
      <ErrorScreen kind="error" onAction={() => { setLoadError(false); onRefresh(); }} />
    );
  }

  // ── Score headline copy ───────────────────────────────────────────────────
  const scoreHeadline = score >= 70
    ? "Tu es en forme aujourd'hui"
    : score >= 40
      ? 'Journée correcte — pousse un peu'
      : 'Corps en récupération — écoute-toi';

  const isWellnessLoading = sleepLoading || hydrationLoading || nutritionLoading;

  // ── Segment rows ──────────────────────────────────────────────────────────
  const segmentParts = [
    { value: sleepPct, max: 100, color: '#8B5CF6', icon: 'moon-outline' as const, label: 'Sommeil', sub: sleepH > 0 ? `${Math.floor(sleepH)}h${Math.round((sleepH % 1) * 60) > 0 ? Math.round((sleepH % 1) * 60) + 'min' : ''}` : 'Pas de données' },
    { value: waterPct, max: 100, color: '#3B82F6', icon: 'water-outline' as const, label: 'Hydratation', sub: waterMl > 0 ? `${(waterMl / 1000).toFixed(1)}L / ${(HOME_DEFAULTS.hydrationGoalMl / 1000).toFixed(1)}L` : 'Pas de données' },
    { value: nutritionPct, max: 100, color: '#FF5C1A', icon: 'restaurant-outline' as const, label: 'Nutrition', sub: kcal > 0 ? `${kcal} kcal` : 'Loggue ton repas' },
    { value: loadPct, max: 100, color: '#22C55E', icon: 'flash-outline' as const, label: 'Charge', sub: `${weeklyCount}/${weeklyGoal} séances` },
  ];

  // ── QuickLog cell width ───────────────────────────────────────────────────
  const cellWidth = (screenWidth - 32 - 24) / 4;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SearchOverlay visible={showSearch} onClose={() => setShowSearch(false)} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 16 + insets.top, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{greeting}</Text>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 }}>
              {firstName}<Text style={{ color: theme.primary }}>.</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {streak > 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(255,92,26,0.10)',
                borderWidth: 1, borderColor: 'rgba(255,92,26,0.20)',
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
              }}>
                <Ionicons name="flame" size={13} color="#FF5C1A" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FF5C1A' }}>
                  {streak} jours
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setShowSearch(true)}
              style={{
                width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="search-outline" size={16} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(app)/notifications' as any)}
              style={{
                width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={16} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(app)/profile' as any)}
              style={{
                width: 36, height: 36, borderRadius: 12, backgroundColor: theme.primary,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                {(profile?.name ?? 'A').slice(0, 2).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FormeDuJour ────────────────────────────────── */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 20, padding: 16,
          shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
          marginBottom: 12,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.muted }}>
            Forme du jour
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 }}>
            {scoreHeadline}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
            {isWellnessLoading ? (
              <>
                <Skeleton width={160} height={160} borderRadius={80} />
                <View style={{ flex: 1, gap: 10 }}>
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={26} borderRadius={8} />)}
                </View>
              </>
            ) : (
              <>
                <View style={{ width: 160, height: 160, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                  <FormRing
                    score={score}
                    size={160}
                    parts={[
                      { value: sleepPct, max: 100, color: '#8B5CF6' },
                      { value: waterPct, max: 100, color: '#3B82F6' },
                      { value: nutritionPct, max: 100, color: '#FF5C1A' },
                      { value: loadPct, max: 100, color: '#22C55E' },
                    ]}
                  />
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  {segmentParts.map((p) => (
                    <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: p.color + '22',
                      }}>
                        <Ionicons name={p.icon} size={13} color={p.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{p.label}</Text>
                        <Text style={{ fontSize: 10, color: theme.muted }}>{p.sub}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: p.color }}>{p.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── MissionCard ────────────────────────────────── */}
        <View style={{ marginBottom: 12 }}>
          <MissionCardContent isLoading={programLoading} activeProgram={activeProgram ?? null} onStart={handleStartMission} />
        </View>

        {/* ── AICoachInline ──────────────────────────────── */}
        {currentTip && (
          <View style={{
            borderRadius: 12, padding: 14, borderWidth: 1,
            borderColor: 'rgba(255,92,26,0.22)',
            backgroundColor: 'rgba(255,92,26,0.04)',
            marginBottom: 20,
          }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: '#1C1A17', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Ionicons name="sparkles" size={16} color="#FFE6D9" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FF5C1A', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    Coach Ziko
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.muted }}>· {currentTip.tag}</Text>
                </View>
                <Text key={tipIndex} style={{ fontSize: 13.5, lineHeight: 19, color: theme.text }}>{currentTip.text}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      dismissTip(currentTip.key + '_apply').then(() =>
                        setTipIndex((i) => (i + 1) % tips.length),
                      );
                      if (currentTip.key === 'hydration') {
                        fireAndForget('hydration_log', { amount_ml: 250 });
                        queryClient.invalidateQueries({ queryKey: ['hydration', 'today'] });
                      } else if (currentTip.key === 'habit') {
                        router.push('/(app)/(plugins)/habits/dashboard' as any);
                      }
                    }}
                    style={{
                      backgroundColor: '#1C1A17', borderRadius: 99,
                      paddingHorizontal: 12, paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>J'applique</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      dismissTip(currentTip.key).then(() =>
                        setTipIndex((i) => (i + 1) % tips.length),
                      );
                    }}
                    style={{
                      backgroundColor: theme.border, borderRadius: 99,
                      paddingHorizontal: 12, paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: '600' }}>Plus tard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Quick log ──────────────────────────────────── */}
        <Text style={{
          fontSize: 11, fontWeight: '700', letterSpacing: 0.66,
          textTransform: 'uppercase', color: '#6B6963', marginBottom: 10,
        }}>
          Quick log
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {/* Water */}
          <TouchableOpacity
            onPress={handleLogWater}
            activeOpacity={0.7}
            style={{
              width: cellWidth, backgroundColor: '#FFFFFF',
              borderRadius: 12, borderWidth: waterConfirmed ? 1.5 : 1,
              borderColor: waterConfirmed ? '#3B82F6' : '#E2E0DA',
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              paddingVertical: 10, paddingHorizontal: 8,
              alignItems: 'center', gap: 4,
            }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.14)' }}>
              <Ionicons name="water-outline" size={15} color="#3B82F6" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1C1A17' }}>
              {waterConfirmed ? `${(waterMl / 1000).toFixed(2)}L` : '+250ml'}
            </Text>
            {waterConfirmed && (
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#3B82F6' }}>+250ml</Text>
            )}
          </TouchableOpacity>
          {/* Mood */}
          <TouchableOpacity
            onPress={() => setShowMoodSheet(true)}
            activeOpacity={0.7}
            style={{
              width: cellWidth, backgroundColor: '#FFFFFF',
              borderRadius: 12, borderWidth: moodConfirmed ? 1.5 : 1,
              borderColor: moodConfirmed ? '#22C55E' : '#E2E0DA',
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              paddingVertical: 10, paddingHorizontal: 8,
              alignItems: 'center', gap: 4,
            }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,197,94,0.14)' }}>
              <Ionicons name="happy-outline" size={15} color="#22C55E" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1C1A17' }}>Humeur</Text>
            {moodConfirmed && (
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#22C55E' }}>✓ logué</Text>
            )}
          </TouchableOpacity>
          {/* Weight */}
          <TouchableOpacity
            onPress={() => setShowWeightSheet(true)}
            activeOpacity={0.7}
            style={{
              width: cellWidth, backgroundColor: '#FFFFFF',
              borderRadius: 12, borderWidth: weightConfirmed ? 1.5 : 1,
              borderColor: weightConfirmed ? '#F59E0B' : '#E2E0DA',
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              paddingVertical: 10, paddingHorizontal: 8,
              alignItems: 'center', gap: 4,
            }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,158,11,0.14)' }}>
              <Ionicons name="scale-outline" size={15} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1C1A17' }}>Poids</Text>
            {weightConfirmed && (
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#F59E0B' }}>✓ logué</Text>
            )}
          </TouchableOpacity>
          {/* Meal */}
          <TouchableOpacity
            onPress={handleLogMeal}
            activeOpacity={0.7}
            style={{
              width: cellWidth, backgroundColor: '#FFFFFF',
              borderRadius: 12, borderWidth: 1,
              borderColor: '#E2E0DA',
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              paddingVertical: 10, paddingHorizontal: 8,
              alignItems: 'center', gap: 4,
            }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,92,26,0.14)' }}>
              <Ionicons name="restaurant-outline" size={15} color="#FF5C1A" />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1C1A17' }}>Repas</Text>
          </TouchableOpacity>
        </View>

        {/* ── Pour toi maintenant (SmartActions) ─────────── */}
        {smartActions.length > 0 && (
          <>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.66,
              textTransform: 'uppercase', color: '#6B6963', marginBottom: 10,
            }}>
              Pour toi maintenant
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 4, marginBottom: 20 }}
            >
              {smartActions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                  style={{
                    width: 232, borderRadius: 12, backgroundColor: '#FFFFFF',
                    borderWidth: 1, borderColor: '#E2E0DA',
                    shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
                    padding: 14,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: action.tintColor + '1A', marginBottom: 8,
                  }}>
                    <Ionicons name={action.icon as any} size={18} color={action.tintColor} />
                  </View>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: action.tintColor, marginBottom: 2 }}>
                    {action.tag}
                  </Text>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#1C1A17', lineHeight: 20, marginBottom: 2 }}>
                    {action.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#6B6963' }}>{action.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Cette semaine (HomeWeekStrip) ──────────────── */}
        <Text style={{
          fontSize: 11, fontWeight: '700', letterSpacing: 0.66,
          textTransform: 'uppercase', color: '#6B6963', marginBottom: 10,
        }}>
          Cette semaine
        </Text>
        <View style={{ marginBottom: 20 }}>
          {weekLoading ? (
            <View style={{
              backgroundColor: theme.surface, borderRadius: 20, padding: 14,
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Skeleton width={120} height={14} borderRadius={6} />
                <Skeleton width={80} height={12} borderRadius={6} />
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} width={undefined} height={40} borderRadius={10} style={{ flex: 1 }} />
                ))}
              </View>
            </View>
          ) : (
            <HomeWeekStrip
              weeklyCount={weeklyCount}
              weeklyGoal={weeklyGoal}
              sessionDates={weeklySessionDates}
            />
          )}
        </View>

        {/* ── Récent ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.66,
            textTransform: 'uppercase', color: '#6B6963',
          }}>
            Récent
          </Text>
          <TouchableOpacity onPress={() => router.push('/(app)/workout/history' as any)}>
            <Text style={{ color: '#FF5C1A', fontSize: 11, fontWeight: '600' }}>Tout voir</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8, marginBottom: 20 }}>
          {recentLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{
                  backgroundColor: theme.surface, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Skeleton width={36} height={36} borderRadius={10} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="70%" height={13} borderRadius={6} />
                    <Skeleton width="50%" height={11} borderRadius={6} />
                  </View>
                  <Skeleton width={48} height={13} borderRadius={6} />
                </View>
              ))}
            </>
          ) : recentSessions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="barbell-outline" size={40} color="#6B6963" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1A17', marginTop: 10 }}>
                Aucune séance récente
              </Text>
              <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 4, textAlign: 'center' }}>
                Lance ta première séance via l'onglet Séance.
              </Text>
            </View>
          ) : (
            recentSessions.map((session) => (
              <View key={session.id} style={{
                backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: '#E2E0DA',
                shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,92,26,0.12)',
                }}>
                  <Ionicons name="barbell-outline" size={16} color="#FF5C1A" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: '#1C1A17', fontWeight: '700', fontSize: 13 }}>
                    {session.name ?? 'Workout'}
                  </Text>
                  <Text style={{ color: '#6B6963', fontSize: 11 }}>
                    {format(new Date(session.started_at), 'd MMM')} · {Math.round((session.duration_seconds ?? 0) / 60)} min
                  </Text>
                </View>
                <Text style={{ color: '#22C55E', fontWeight: '800', fontSize: 13 }}>
                  {session.total_volume_kg
                    ? session.total_volume_kg.toLocaleString('fr-FR') + ' kg'
                    : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Tous mes outils ────────────────────────────── */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          activeOpacity={0.75}
          style={{
            backgroundColor: theme.surface, borderRadius: 18, padding: 14,
            borderWidth: 1, borderColor: theme.border,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View style={{
            width: 38, height: 38, borderRadius: 11,
            backgroundColor: '#1C1A1712', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="grid-outline" size={18} color={theme.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Tous mes outils</Text>
            <Text style={{ color: theme.muted, fontSize: 11 }}>Garde-manger, sommeil, mesures…</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── PluginsDrawer ───────────────────────────────── */}
      <PluginsDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={(path) => router.push(path as any)}
        installedPluginIds={installedPluginIds}
      />

      {/* ── Mood Bottom Sheet ───────────────────────────── */}
      <Modal visible={showMoodSheet} transparent animationType="slide" onRequestClose={() => setShowMoodSheet(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={() => setShowMoodSheet(false)}
        />
        <View style={{
          backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 20, paddingBottom: 36, gap: 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Comment tu te sens ?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {(['\uD83D\uDE2B', '\uD83D\uDE15', '\uD83D\uDE10', '\uD83D\uDE42', '\uD83D\uDE01'] as string[]).map((emoji, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleLogMood(idx + 1)}
                style={{ alignItems: 'center', gap: 4 }}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
                <Text style={{ fontSize: 11, color: theme.muted }}>{idx + 1}/5</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Weight Bottom Sheet ─────────────────────────── */}
      <Modal visible={showWeightSheet} transparent animationType="slide" onRequestClose={() => setShowWeightSheet(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={() => setShowWeightSheet(false)}
        />
        <View style={{
          backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 20, paddingBottom: 36, gap: 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Log ton poids</Text>
          <TextInput
            keyboardType="decimal-pad"
            placeholder="70.0"
            value={weightInput}
            onChangeText={setWeightInput}
            style={{
              borderWidth: 1, borderColor: theme.border, borderRadius: 12,
              padding: 14, fontSize: 16, color: theme.text, backgroundColor: theme.background,
            }}
            placeholderTextColor={theme.muted}
          />
          <TouchableOpacity
            onPress={handleLogWeight}
            disabled={!weightInput || !Number.isFinite(parseFloat(weightInput))}
            style={{
              backgroundColor: !weightInput || !Number.isFinite(parseFloat(weightInput)) ? '#E2E0DA' : '#F59E0B',
              borderRadius: 14, padding: 16, alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

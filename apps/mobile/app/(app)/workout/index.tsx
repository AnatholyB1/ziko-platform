import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showAlert } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../../src/stores/themeStore';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import WSHeader from '../../../src/components/WSHeader';
import type { WorkoutSession } from '@ziko/plugin-sdk';

// ── ResumeBar ──────────────────────────────────────────────────────────────────
function ResumeBar({ session, theme }: { session: WorkoutSession; theme: any }) {
  const elapsed = session.started_at
    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
    : 0;
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/workout/session')}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: theme.cardDark ?? '#1C1A17',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.primary + '33',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="pulse" size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFAF6', fontWeight: '700', fontSize: 15 }}>
          Séance en cours
        </Text>
        <Text style={{ color: 'rgba(255,250,246,0.7)', fontSize: 13, marginTop: 2 }}>
          {session.name ?? 'Workout'} · {elapsed}min
        </Text>
      </View>
      <View
        style={{
          backgroundColor: theme.primary,
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 14,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reprendre</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── SubTabs ────────────────────────────────────────────────────────────────────
function SubTabs({
  tabs,
  active,
  onPress,
  theme,
}: {
  tabs: string[];
  active: number;
  onPress: (i: number) => void;
  theme: any;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(28,26,23,0.05)',
      }}
    >
      {tabs.map((label, i) => (
        <TouchableOpacity
          key={label}
          onPress={() => onPress(i)}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: active === i ? theme.surface : 'transparent',
            alignItems: 'center',
            shadowColor: active === i ? theme.text : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: active === i ? 0.08 : 0,
            shadowRadius: 3,
            elevation: active === i ? 1 : 0,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: active === i ? theme.text : theme.muted,
            }}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── DayRow (Semaine type tab) ──────────────────────────────────────────────────
interface SessionEntry {
  name: string;
  focus?: string;
  exercises?: Array<{ name: string; sets: number; reps: string; exercise_id?: string }>;
}

function DayRow({
  dayLabel,
  session,
  isRest,
  theme,
}: {
  dayLabel: string;
  session: SessionEntry | null;
  isRest: boolean;
  theme: any;
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        opacity: isRest ? 0.6 : 1,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          ...(isRest
            ? {
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: 'dashed',
                backgroundColor: 'transparent',
              }
            : {
                backgroundColor: 'rgba(255,92,26,0.12)',
              }),
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: isRest ? theme.muted : '#FF5C1A',
          }}
        >
          {dayLabel}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
          {session?.name ?? 'Repos'}
        </Text>
        {session?.focus ? (
          <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>
            {session.focus}
          </Text>
        ) : null}
        {session?.exercises && session.exercises.length > 0 ? (
          <View style={{ marginTop: 4, gap: 2 }}>
            {session.exercises.slice(0, 3).map((ex, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() =>
                  ex.exercise_id
                    ? router.push(
                        `/(app)/workout/exercise/${ex.exercise_id}` as any,
                      )
                    : null
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ fontSize: 10, color: theme.muted }}>
                  {ex.name} · {ex.sets} × {ex.reps}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      {!isRest && (
        <Ionicons name="chevron-forward" size={14} color={theme.muted} />
      )}
    </View>
  );
}

// ── WeekRow (N semaines tab) ───────────────────────────────────────────────────
function WeekRow({
  week,
  state,
  theme,
}: {
  week: { w: number; sessions?: SessionEntry[] };
  state: 'done' | 'current' | 'future';
  theme: any;
}) {
  const isCurrent = state === 'current';
  const isDone = state === 'done';

  return (
    <View
      style={{
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: isCurrent ? 'rgba(255,92,26,0.06)' : theme.surface,
        borderWidth: isCurrent ? 1.5 : 1,
        borderColor: isCurrent ? '#FF5C1A' : theme.border,
        opacity: isDone ? 0.65 : 1,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDone
            ? 'rgba(34,197,94,0.14)'
            : isCurrent
            ? '#FF5C1A'
            : 'rgba(28,26,23,0.05)',
        }}
      >
        {isDone ? (
          <Ionicons name="checkmark" size={14} color={theme.success ?? '#22C55E'} />
        ) : (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: isCurrent ? '#fff' : theme.text,
            }}
          >
            S{week.w}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
            Semaine {week.w}
          </Text>
          {isCurrent && (
            <Text
              style={{
                fontSize: 10,
                color: '#FF5C1A',
                fontWeight: '700',
                marginLeft: 8,
              }}
            >
              EN COURS
            </Text>
          )}
        </View>
        {week.sessions && week.sessions.length > 0 ? (
          <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>
            {week.sessions.length} séance{week.sessions.length > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── SessionCard (recent sessions strip) ────────────────────────────────────────
function SessionCard({ session, theme }: { session: WorkoutSession; theme: any }) {
  function fmtDate(s: WorkoutSession) {
    const d = s.started_at ? new Date(s.started_at) : null;
    if (!d) return '';
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function fmtDuration(s: WorkoutSession) {
    if (!s.started_at || !s.ended_at) return null;
    const min = Math.floor(
      (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
    );
    return `${min}min`;
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/workout/history' as any)}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: theme.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="barbell-outline" size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
          {session.name ?? 'Séance'}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>
          {fmtDate(session)}
          {fmtDuration(session) ? ` · ${fmtDuration(session)}` : ''}
        </Text>
      </View>
      {session.total_volume_kg != null && session.total_volume_kg > 0 && (
        <View
          style={{
            backgroundColor: theme.primary + '18',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '700' }}>
            {Math.round(session.total_volume_kg)}kg
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── workout_programs / program_workouts / program_exercises shape ──────────────
// NOTE: coach-assigned programs have user_id = coach_id, assigned_to_user_id =
// the athlete's id (see backend/api/src/coach/programs/db.ts assignProgram).
// Own athlete-created programs have user_id = athlete's id, assigned_to_user_id
// = null. This screen must show both.
interface ProgramWeek {
  w: number;
  sessions?: SessionEntry[];
}

interface ProgramExerciseRow {
  id: string;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  order_index: number;
  exercises?: { name: string; name_fr?: string | null } | null;
}

interface ProgramWorkoutRow {
  id: string;
  day_of_week: number | null;
  name: string;
  order_index: number;
  program_exercises?: ProgramExerciseRow[];
}

interface WorkoutProgramRow {
  id: string;
  user_id: string;
  assigned_to_user_id?: string | null;
  created_by_coach_id?: string | null;
  name: string;
  description: string | null;
  goal?: string | null;
  is_active: boolean;
  cycle_weeks: number | null;
  current_cycle_week: number | null;
  created_at: string;
  program_workouts?: ProgramWorkoutRow[];
}

// ── Main screen ────────────────────────────────────────────────────────────────
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WorkoutIndexScreen() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const currentSession = useWorkoutStore((s) => s.currentSession);
  const recentSessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);

  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();
  const programsQueryKey = ['workout-programs', userId];

  useEffect(() => {
    loadRecentSessions(90);
  }, [userId]);

  // Real programs: own (user_id = self) + coach-assigned (assigned_to_user_id = self).
  // Replaces the old ai_generated_programs query — that table holds one-off
  // AI-suggested single sessions, not the persistent, coach-assignable,
  // editable program model (workout_programs / program_workouts / program_exercises).
  const { data: programsData, isLoading } = useQuery<{
    active: WorkoutProgramRow | null;
    others: WorkoutProgramRow[];
  }>({
    queryKey: programsQueryKey,
    queryFn: async () => {
      if (!userId) return { active: null, others: [] };
      const { data, error } = await supabase
        .from('workout_programs')
        .select('*, program_workouts(*, program_exercises(*, exercises(name, name_fr)))')
        .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error || !data) return { active: null, others: [] };
      const programs = data as WorkoutProgramRow[];
      const active = programs.find((p) => p.is_active) ?? programs[0] ?? null;
      const others = programs.filter((p) => p.id !== active?.id);
      return { active, others };
    },
    enabled: !!userId,
  });

  const activeProgram = programsData?.active ?? null;
  const otherPrograms = programsData?.others ?? [];

  // "Semaine type" — one entry per weekday (1=Mon..7=Sun), null = rest day.
  const weekSessions: (SessionEntry | null)[] = DAY_LABELS.map((_, i) => {
    const dayNum = i + 1;
    const wo = activeProgram?.program_workouts?.find((w) => w.day_of_week === dayNum);
    if (!wo) return null;
    return {
      name: wo.name,
      exercises: (wo.program_exercises ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((pe) => ({
          name: pe.exercises?.name ?? 'Exercice',
          sets: pe.sets ?? 0,
          reps: pe.reps != null ? String(pe.reps) : pe.reps_min && pe.reps_max ? `${pe.reps_min}-${pe.reps_max}` : '',
          exercise_id: pe.exercise_id ?? undefined,
        })),
    };
  });

  const totalWeeks = activeProgram?.cycle_weeks ?? 1;
  const currentWeek = activeProgram?.current_cycle_week ?? 1;
  const progressPct = totalWeeks > 0 ? (currentWeek / totalWeeks) * 100 : 0;
  const filledSessions = weekSessions.filter((s): s is SessionEntry => !!s);
  const weeks: ProgramWeek[] = Array.from({ length: totalWeeks }, (_, i) => ({
    w: i + 1,
    sessions: filledSessions,
  }));

  // Today's session name for sticky CTA
  const todayIndex = (new Date().getDay() + 6) % 7; // 0=Mon … 6=Sun
  const todaySessionName = weekSessions[todayIndex]?.name ?? filledSessions[0]?.name ?? 'Séance';

  const tabLabels = ['Semaine type', `${totalWeeks} semaine${totalWeeks > 1 ? 's' : ''}`];

  const isCoachAssigned = !!activeProgram?.assigned_to_user_id;
  const ownsProgram = activeProgram?.user_id === userId;

  const handleProgramActions = () => {
    if (!activeProgram) return;
    const buttons: Array<{ text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }> = [
      {
        text: 'Modifier',
        onPress: () => router.push(`/(app)/workout/${activeProgram.id}` as any),
      },
    ];
    if (!activeProgram.is_active) {
      buttons.push({
        text: 'Activer',
        onPress: async () => {
          await useWorkoutStore.getState().setActiveProgram(activeProgram.id);
          queryClient.invalidateQueries({ queryKey: programsQueryKey });
        },
      });
    }
    // Only the athlete's own programs can be deleted from here — a
    // coach-assigned program (user_id = coach) has no DELETE RLS grant
    // for the athlete, and shouldn't be removable from their side anyway.
    if (ownsProgram) {
      buttons.push({
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_programs').delete().eq('id', activeProgram.id);
          queryClient.invalidateQueries({ queryKey: programsQueryKey });
        },
      });
    }
    buttons.push({ text: 'Annuler', style: 'cancel' });
    showAlert(activeProgram.name, undefined, buttons);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* WSHeader — only when active program */}
      {activeProgram ? (
        <WSHeader
          title={activeProgram.name}
          sub={isCoachAssigned ? 'Assigné par ton coach' : 'Programme personnel'}
          right={
            <TouchableOpacity
              onPress={handleProgramActions}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: 'rgba(28,26,23,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                •••
              </Text>
            </TouchableOpacity>
          }
        />
      ) : !isLoading ? (
        /* Simple title row when no program */
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <Text style={{ flex: 1, fontSize: 28, fontWeight: '700', color: theme.text }}>
            Au boulot.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/calendar' as any)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/ai-generate' as any)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
          >
            <Ionicons name="add" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ResumeBar */}
        {currentSession && <ResumeBar session={currentSession} theme={theme} />}

        {/* Loading state */}
        {isLoading && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        )}

        {/* ProgramDetail — when active program exists */}
        {!isLoading && activeProgram ? (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Hero card */}
            <LinearGradient
              colors={['#1C1A17', '#2A211B']}
              start={{ x: 0.13, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 14,
                padding: 16,
                overflow: 'hidden',
                position: 'relative',
                marginTop: 8,
              }}
            >
              {/* Orange glow orb */}
              <View
                style={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: 'rgba(255,92,26,0.35)',
                }}
              />

              {/* Status badges */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {activeProgram.is_active ? (
                  <Text
                    style={{
                      fontSize: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: '#FF5C1A',
                      color: '#fff',
                      fontWeight: '700',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      overflow: 'hidden',
                    }}
                  >
                    ACTIF
                  </Text>
                ) : null}
                {activeProgram.goal ? (
                  <Text
                    style={{
                      fontSize: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,250,246,0.1)',
                      color: '#FFFAF6',
                      fontWeight: '700',
                      overflow: 'hidden',
                    }}
                  >
                    {activeProgram.goal}
                  </Text>
                ) : null}
              </View>

              {/* Week progress row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 16,
                  marginTop: 12,
                }}
              >
                <View style={{ alignItems: 'flex-start' }}>
                  <Text
                    style={{
                      fontSize: 34,
                      fontWeight: '700',
                      color: '#FFFAF6',
                      lineHeight: 34,
                    }}
                  >
                    {currentWeek}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,250,246,0.55)',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginTop: 2,
                    }}
                  >
                    semaine
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    color: 'rgba(255,250,246,0.45)',
                    fontWeight: '400',
                  }}
                >
                  /
                </Text>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: 'rgba(255,250,246,0.7)',
                      lineHeight: 16,
                    }}
                  >
                    {totalWeeks}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,250,246,0.4)',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginTop: 2,
                    }}
                  >
                    total
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View
                style={{
                  marginTop: 16,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,250,246,0.12)',
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['#FF5C1A', '#FFB07A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                  }}
                />
              </View>
            </LinearGradient>

            {/* Description */}
            {activeProgram.description ? (
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.muted,
                  marginTop: 16,
                  paddingHorizontal: 4,
                }}
              >
                {activeProgram.description}
              </Text>
            ) : null}

            {/* SubTabs */}
            <SubTabs
              tabs={tabLabels}
              active={activeTab}
              onPress={setActiveTab}
              theme={theme}
            />

            {/* Tab content */}
            <View style={{ marginTop: 8 }}>
              {activeTab === 0 ? (
                /* Semaine type */
                weekSessions.map((session, i) => (
                  <DayRow
                    key={i}
                    dayLabel={DAY_LABELS[i] ?? String(i + 1)}
                    session={session}
                    isRest={!session}
                    theme={theme}
                  />
                ))
              ) : (
                /* N semaines (progressive overload cycle) */
                weeks.map((week, i) => (
                  <WeekRow
                    key={week.w}
                    week={week}
                    state={i + 1 < currentWeek ? 'done' : i + 1 === currentWeek ? 'current' : 'future'}
                    theme={theme}
                  />
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* Other programs — history + coach-assigned programs not currently active */}
        {!isLoading && otherPrograms.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
              Autres programmes
            </Text>
            {otherPrograms.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/(app)/workout/${p.id}` as any)}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: theme.primary + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{p.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>
                    {p.assigned_to_user_id ? 'Assigné par ton coach' : 'Programme personnel'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state — no active program */}
        {!isLoading && !activeProgram && (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 24,
              marginBottom: 16,
              borderRadius: 14,
              padding: 24,
              backgroundColor: theme.surface,
              borderWidth: 1.5,
              borderColor: theme.border,
              borderStyle: 'dashed',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="barbell-outline"
              size={36}
              color={theme.muted}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 4,
              }}
            >
              Aucun programme actif
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.muted,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              Structure tes entraînements pour progresser
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/workout/ai-generate' as any)}
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                Créer un programme
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent sessions strip — always visible */}
        {recentSessions.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>
                Séances récentes
              </Text>
              <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>
                  Tout voir →
                </Text>
              </TouchableOpacity>
            </View>
            {recentSessions.slice(0, 3).map((session) => (
              <SessionCard key={session.id} session={session} theme={theme} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer CTA — only when active program */}
      {activeProgram && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/session')}
            style={{
              width: '100%',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: '#FF5C1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              Démarrer la séance d'aujourd'hui · {todaySessionName}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

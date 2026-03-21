import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { supabase } from '../../../src/lib/supabase';
import type { ProgramExercise, Exercise } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { awardWorkoutXP } from '@ziko/plugin-gamification/store';

const { width: SCREEN_W } = Dimensions.get('window');

type ExerciseWithInfo = ProgramExercise & { exercises?: Exercise };

// What mode is a program exercise?
type ExMode = 'reps' | 'repRange' | 'time' | 'timeRange';
const getExMode = (pe: ProgramExercise): ExMode => {
  if (pe.duration_min && pe.duration_max) return 'timeRange';
  if (pe.duration_seconds) return 'time';
  if (pe.reps_min && pe.reps_max) return 'repRange';
  return 'reps';
};

const needsTimer = (pe: ProgramExercise) => {
  const m = getExMode(pe);
  return m === 'time' || m === 'timeRange';
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

// ── Set tracking ────────────────────────────────────────
interface TrackedSet {
  setNumber: number;
  completed: boolean;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  started_at: string | null;
  completed_at: string | null;
  rest_seconds_taken: number | null;
  prescribed_reps: number | null;
  prescribed_weight_kg: number | null;
  prescribed_duration_seconds: number | null;
  prescribed_rest_seconds: number | null;
}

// ── Phases ──────────────────────────────────────────────
type Phase = 'review' | 'exercise' | 'rest' | 'complete';

export default function WorkoutSessionScreen() {
  const { t, tExercise, tMuscle } = useTranslation();
  const currentSession = useWorkoutStore((s) => s.currentSession);
  const workoutExercises = useWorkoutStore((s) => s.currentWorkoutExercises);
  const endSession = useWorkoutStore((s) => s.endSession);
  const exercises = useWorkoutStore((s) => s.exercises);
  const loadExercises = useWorkoutStore((s) => s.loadExercises);
  const startSession = useWorkoutStore((s) => s.startSession);
  const theme = useThemeStore((s) => s.theme);

  const isGuided = workoutExercises.length > 0;

  // ── Session elapsed timer ──────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Guided workout state ───────────────────────────────
  const [phase, setPhase] = useState<Phase>('review');
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [trackedSets, setTrackedSets] = useState<Map<number, TrackedSet[]>>(new Map());

  // ── Exercise timer (for timed exercises) ───────────────
  const [exTimer, setExTimer] = useState(0);
  const [exTimerRunning, setExTimerRunning] = useState(false);
  const exTimerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Rest timer ─────────────────────────────────────────
  const [restTimer, setRestTimer] = useState(0);
  const [restTimerMax, setRestTimerMax] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval>>();

  // ── Editable values for current set ────────────────────
  const [editReps, setEditReps] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editRpe, setEditRpe] = useState<number | null>(null);

  // ── Timing refs for per-set tracking ────────────────────
  const setStartedAtRef = useRef<string | null>(null);
  const lastSetCompletedAtRef = useRef<string | null>(null);
  const exerciseStartedAtRef = useRef<Map<number, string>>(new Map());
  const sessionExerciseIdsRef = useRef<Map<number, string>>(new Map());

  // ── Free workout state (no program) ────────────────────
  const [freeExercises, setFreeExercises] = useState<{ id: string; name: string; sets: { reps: string; weight: string; completed: boolean }[] }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (exercises.length === 0) loadExercises();
    // Start a free session if no guided workout
    if (!isGuided && !currentSession) {
      startSession(undefined, t('workout.quickStart'));
    }
  }, []);

  // Session clock
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Exercise timer
  useEffect(() => {
    if (exTimerRunning) {
      exTimerRef.current = setInterval(() => setExTimer((t) => t + 1), 1000);
    } else {
      clearInterval(exTimerRef.current);
    }
    return () => clearInterval(exTimerRef.current);
  }, [exTimerRunning]);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer > 0) {
      restRef.current = setInterval(() => {
        setRestTimer((t) => {
          if (t <= 1) {
            clearInterval(restRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer > 0]);

  // ── Initialize tracked sets from program ───────────────
  useEffect(() => {
    if (!isGuided) return;
    const map = new Map<number, TrackedSet[]>();
    workoutExercises.forEach((pe, idx) => {
      const numSets = pe.sets ?? 3;
      const mode = getExMode(pe);
      const prescribedDuration = mode === 'timeRange' ? pe.duration_max : pe.duration_seconds;
      const sets: TrackedSet[] = Array.from({ length: numSets }, (_, i) => ({
        setNumber: i + 1,
        completed: false,
        reps: pe.reps ?? null,
        weight_kg: pe.weight_kg ?? null,
        duration_seconds: pe.duration_seconds ?? null,
        rpe: null,
        started_at: null,
        completed_at: null,
        rest_seconds_taken: null,
        prescribed_reps: pe.reps ?? pe.reps_min ?? null,
        prescribed_weight_kg: pe.weight_kg ?? null,
        prescribed_duration_seconds: prescribedDuration ?? null,
        prescribed_rest_seconds: pe.rest_seconds ?? null,
      }));
      map.set(idx, sets);
    });
    setTrackedSets(map);
  }, [workoutExercises]);

  // ── Current exercise data ──────────────────────────────
  const currentEx = isGuided ? workoutExercises[currentExIdx] : null;
  const currentExMode = currentEx ? getExMode(currentEx) : 'reps';
  const currentExSets = trackedSets.get(currentExIdx) ?? [];
  const totalExercises = workoutExercises.length;

  // ── Navigation helpers ─────────────────────────────────
  const initSetEdits = useCallback((exIdx: number, setIdx: number) => {
    const pe = workoutExercises[exIdx];
    const sets = trackedSets.get(exIdx) ?? [];
    const s = sets[setIdx];
    if (!pe) return;
    setEditSets(String(sets.length));
    setEditReps(String(s?.reps ?? pe.reps ?? pe.reps_min ?? ''));
    setEditWeight(String(s?.weight_kg ?? pe.weight_kg ?? ''));
    setExTimer(0);
    setExTimerRunning(false);
  }, [workoutExercises, trackedSets]);

  const goToExercise = (exIdx: number, setIdx: number = 0) => {
    setCurrentExIdx(exIdx);
    setCurrentSetIdx(setIdx);
    initSetEdits(exIdx, setIdx);
    setEditRpe(null);
    setPhase('exercise');

    // Record set start time
    setStartedAtRef.current = new Date().toISOString();

    // Record exercise start time & create session_exercises row
    if (!exerciseStartedAtRef.current.has(exIdx)) {
      const now = new Date().toISOString();
      exerciseStartedAtRef.current.set(exIdx, now);

      // Insert session_exercises row for this exercise
      const pe = workoutExercises[exIdx];
      if (pe && currentSession) {
        const mode = getExMode(pe);
        supabase.from('session_exercises').insert({
          session_id: currentSession.id,
          exercise_id: pe.exercise_id,
          program_exercise_id: pe.id,
          order_index: exIdx,
          started_at: now,
          prescribed_sets: pe.sets ?? 3,
          prescribed_reps: pe.reps ?? null,
          prescribed_reps_min: pe.reps_min ?? null,
          prescribed_reps_max: pe.reps_max ?? null,
          prescribed_duration_seconds: pe.duration_seconds ?? null,
          prescribed_duration_min: pe.duration_min ?? null,
          prescribed_duration_max: pe.duration_max ?? null,
          prescribed_rest_seconds: pe.rest_seconds ?? null,
          prescribed_weight_kg: pe.weight_kg ?? null,
          exercise_type: mode,
          sets_planned: (trackedSets.get(exIdx) ?? []).length,
        }).select('id').single().then(({ data }) => {
          if (data) sessionExerciseIdsRef.current.set(exIdx, data.id);
        });
      }
    } else if (setIdx > 0) {
      // Starting a new set within the same exercise
      setStartedAtRef.current = new Date().toISOString();
    }
  };

  const startWorkout = () => {
    if (workoutExercises.length === 0) return;
    goToExercise(0, 0);
  };

  // ── Update number of sets for current exercise ─────────
  const updateSetsCount = (newCount: number) => {
    if (newCount < 1 || newCount > 20) return;
    const pe = workoutExercises[currentExIdx];
    const mode = getExMode(pe);
    const prescribedDuration = mode === 'timeRange' ? pe.duration_max : pe.duration_seconds;
    setTrackedSets((prev) => {
      const map = new Map(prev);
      const existing = map.get(currentExIdx) ?? [];
      if (newCount > existing.length) {
        const extra: TrackedSet[] = Array.from({ length: newCount - existing.length }, (_, i) => ({
          setNumber: existing.length + i + 1,
          completed: false,
          reps: pe.reps ?? null,
          weight_kg: pe.weight_kg ?? null,
          duration_seconds: pe.duration_seconds ?? null,
          rpe: null,
          started_at: null,
          completed_at: null,
          rest_seconds_taken: null,
          prescribed_reps: pe.reps ?? pe.reps_min ?? null,
          prescribed_weight_kg: pe.weight_kg ?? null,
          prescribed_duration_seconds: prescribedDuration ?? null,
          prescribed_rest_seconds: pe.rest_seconds ?? null,
        }));
        map.set(currentExIdx, [...existing, ...extra]);
      } else {
        map.set(currentExIdx, existing.slice(0, newCount));
      }
      return map;
    });
    setEditSets(String(newCount));
  };

  // ── Complete current set ───────────────────────────────
  const completeCurrentSet = async () => {
    if (!currentSession || !currentEx) return;

    const reps = parseInt(editReps) || null;
    const weight = parseFloat(editWeight) || null;
    const duration = needsTimer(currentEx) ? exTimer : null;
    const completedAt = new Date().toISOString();
    const startedAt = setStartedAtRef.current;

    // Calculate actual rest: time between last set completed_at and this set started_at
    let restSecondsTaken: number | null = null;
    if (lastSetCompletedAtRef.current && startedAt) {
      restSecondsTaken = Math.round(
        (new Date(startedAt).getTime() - new Date(lastSetCompletedAtRef.current).getTime()) / 1000
      );
    }

    // Prescribed values from the program exercise
    const mode = getExMode(currentEx);
    const prescribedDuration = mode === 'timeRange' ? currentEx.duration_max : currentEx.duration_seconds;

    await supabase.from('session_sets').insert({
      session_id: currentSession.id,
      exercise_id: currentEx.exercise_id,
      set_number: currentSetIdx + 1,
      reps,
      weight_kg: weight,
      duration_seconds: duration,
      completed: true,
      rpe: editRpe,
      exercise_order: currentExIdx,
      started_at: startedAt,
      completed_at: completedAt,
      rest_seconds_taken: restSecondsTaken,
      prescribed_reps: currentEx.reps ?? currentEx.reps_min ?? null,
      prescribed_weight_kg: currentEx.weight_kg ?? null,
      prescribed_duration_seconds: prescribedDuration ?? null,
      prescribed_rest_seconds: currentEx.rest_seconds ?? null,
    });

    // Update tracked set in local state
    const updatedSets = new Map(trackedSets);
    const sets = [...(updatedSets.get(currentExIdx) ?? [])];
    sets[currentSetIdx] = {
      ...sets[currentSetIdx],
      completed: true,
      reps,
      weight_kg: weight,
      duration_seconds: duration,
      rpe: editRpe,
      started_at: startedAt,
      completed_at: completedAt,
      rest_seconds_taken: restSecondsTaken,
    };
    updatedSets.set(currentExIdx, sets);
    setTrackedSets(updatedSets);

    // Store completion timestamp for rest calculation
    lastSetCompletedAtRef.current = completedAt;

    setExTimerRunning(false);
    setEditRpe(null);

    const isLastSet = currentSetIdx >= sets.length - 1;
    const isLastExercise = currentExIdx >= totalExercises - 1;

    // Update session_exercises when last set of this exercise is done
    if (isLastSet) {
      const sessionExId = sessionExerciseIdsRef.current.get(currentExIdx);
      if (sessionExId) {
        const exSets = updatedSets.get(currentExIdx) ?? [];
        const completedSets = exSets.filter((s) => s.completed);
        const totalReps = completedSets.reduce((acc, s) => acc + (s.reps ?? 0), 0);
        const totalVol = completedSets.reduce((acc, s) => acc + ((s.reps ?? 0) * (s.weight_kg ?? 0)), 0);
        const totalDur = completedSets.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
        const totalRest = completedSets.reduce((acc, s) => acc + (s.rest_seconds_taken ?? 0), 0);
        const rpeValues = completedSets.map((s) => s.rpe).filter((r): r is number => r !== null);
        const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;

        await supabase.from('session_exercises').update({
          completed_at: completedAt,
          sets_completed: completedSets.length,
          total_reps: totalReps,
          total_volume_kg: totalVol,
          total_duration_seconds: totalDur,
          total_rest_seconds: totalRest,
          avg_rpe: avgRpe,
        }).eq('id', sessionExId);
      }
    }

    if (isLastSet && isLastExercise) {
      setPhase('complete');
      return;
    }

    const restSec = currentEx.rest_seconds ?? 60;
    setRestTimerMax(restSec);
    setRestTimer(restSec);
    setPhase('rest');
  };

  // ── Skip / advance after rest ──────────────────────────
  const advanceAfterRest = useCallback(() => {
    const sets = trackedSets.get(currentExIdx) ?? [];
    const isLastSet = currentSetIdx >= sets.length - 1;

    // Record new set start time (after rest)
    setStartedAtRef.current = new Date().toISOString();

    if (isLastSet) {
      const nextEx = currentExIdx + 1;
      if (nextEx < totalExercises) {
        goToExercise(nextEx, 0);
      } else {
        setPhase('complete');
      }
    } else {
      const nextSet = currentSetIdx + 1;
      setCurrentSetIdx(nextSet);
      initSetEdits(currentExIdx, nextSet);
      setEditRpe(null);
      setPhase('exercise');
    }
  }, [currentExIdx, currentSetIdx, trackedSets, totalExercises]);

  const skipRest = () => {
    setRestTimer(0);
    advanceAfterRest();
  };

  // Auto-advance when rest timer finishes
  useEffect(() => {
    if (restTimer === 0 && phase === 'rest') {
      advanceAfterRest();
    }
  }, [restTimer, phase]);

  // ── Save all stats and close ────────────────────────────
  const saveSessionStats = async () => {
    if (!currentSession) return;

    let totalSetsCount = 0;
    let totalRepsCount = 0;
    let totalVolume = 0;
    let totalRestSec = 0;
    let totalDurationActiveSec = 0;
    let exercisesCount = 0;

    trackedSets.forEach((sets) => {
      const completedSets = sets.filter((s) => s.completed);
      if (completedSets.length > 0) exercisesCount++;
      completedSets.forEach((s) => {
        totalSetsCount++;
        totalRepsCount += s.reps ?? 0;
        totalVolume += (s.reps ?? 0) * (s.weight_kg ?? 0);
        totalRestSec += s.rest_seconds_taken ?? 0;
        if (s.started_at && s.completed_at) {
          totalDurationActiveSec += Math.round(
            (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000
          );
        }
      });
    });

    // Resolve program_id from the workout
    let programId: string | null = null;
    if (currentSession.program_workout_id) {
      const { data: pw } = await supabase
        .from('program_workouts')
        .select('program_id')
        .eq('id', currentSession.program_workout_id)
        .single();
      if (pw) programId = pw.program_id;
    }

    await supabase.from('workout_sessions').update({
      ended_at: new Date().toISOString(),
      total_volume_kg: totalVolume,
      total_sets: totalSetsCount,
      total_reps: totalRepsCount,
      total_exercises: exercisesCount,
      total_rest_seconds: totalRestSec,
      total_duration_active_seconds: totalDurationActiveSec,
      day_of_week: new Date().getDay() || 7,
      program_id: programId,
    }).eq('id', currentSession.id);

    await endSession();
  };

  // ── End session ────────────────────────────────────────
  const handleEndSession = () => {
    Alert.alert(t('workout.endWorkout'), t('workout.endWorkoutConfirm'), [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('workout.finish'), onPress: async () => {
          await saveSessionStats();
          try { await awardWorkoutXP(supabase, currentSession!.id); } catch {}
          router.back();
        },
      },
    ]);
  };

  const handleFinish = async () => {
    await saveSessionStats();
    try { await awardWorkoutXP(supabase, currentSession!.id); } catch {}
    router.back();
  };

  // ── Exercise description ───────────────────────────────
  const describeExercise = (pe: ExerciseWithInfo) => {
    const mode = getExMode(pe);
    const parts: string[] = [];
    parts.push(`${pe.sets ?? 3} sets`);
    if (mode === 'reps') parts.push(`${pe.reps ?? '?'} reps`);
    else if (mode === 'repRange') parts.push(`${pe.reps_min}-${pe.reps_max} reps`);
    else if (mode === 'time') parts.push(`${pe.duration_seconds}s`);
    else if (mode === 'timeRange') parts.push(`${pe.duration_min}-${pe.duration_max}s`);
    if (pe.weight_kg) parts.push(`@ ${pe.weight_kg}kg`);
    if (pe.rest_seconds) parts.push(`${pe.rest_seconds}s rest`);
    return parts.join(' · ');
  };

  // ── Free workout helpers ───────────────────────────────
  const addFreeExercise = (ex: { id: string; name: string }) => {
    setFreeExercises((prev) => [...prev, { id: ex.id, name: ex.name, sets: [{ reps: '', weight: '', completed: false }] }]);
    setShowPicker(false);
  };
  const addFreeSet = (exIdx: number) => {
    setFreeExercises((prev) => {
      const u = [...prev];
      u[exIdx] = { ...u[exIdx], sets: [...u[exIdx].sets, { reps: '', weight: '', completed: false }] };
      return u;
    });
  };
  const updateFreeSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight', value: string) => {
    setFreeExercises((prev) => {
      const u = [...prev];
      const sets = [...u[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      u[exIdx] = { ...u[exIdx], sets };
      return u;
    });
  };
  const completeFreeSet = async (exIdx: number, setIdx: number) => {
    if (!currentSession) return;
    const ex = freeExercises[exIdx];
    const s = ex.sets[setIdx];
    const now = new Date().toISOString();
    await supabase.from('session_sets').insert({
      session_id: currentSession.id,
      exercise_id: ex.id,
      set_number: setIdx + 1,
      reps: parseInt(s.reps) || null,
      weight_kg: parseFloat(s.weight) || null,
      completed: true,
      exercise_order: exIdx,
      started_at: now,
      completed_at: now,
    });
    setFreeExercises((prev) => {
      const u = [...prev];
      const sets = [...u[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], completed: true };
      u[exIdx] = { ...u[exIdx], sets };
      return u;
    });
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ═══════════════════════════════════════════════════════
  // GUIDED WORKOUT
  // ═══════════════════════════════════════════════════════

  if (isGuided) {
    // ── REVIEW PHASE ─────────────────────────────────────
    if (phase === 'review') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Ionicons name="chevron-back" size={24} color="#7A7670" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>
                {currentSession?.name ?? 'Workout'}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>{totalExercises} exercises</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 120 }}>
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
              Program Overview
            </Text>

            {workoutExercises.map((pe, idx) => (
              <MotiView
                key={pe.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: idx * 60 }}
              >
                <View style={{
                  backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10,
                  borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 14,
                }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12, backgroundColor: theme.primary + '18',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 16 }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                      {tExercise(pe.exercises?.name ?? 'Exercise')}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 3 }}>
                      {describeExercise(pe)}
                    </Text>
                    {pe.notes ? (
                      <Text style={{ color: theme.primary, fontSize: 11, marginTop: 3, fontStyle: 'italic' }}>
                        {pe.notes}
                      </Text>
                    ) : null}
                  </View>
                  {needsTimer(pe) && (
                    <Ionicons name="timer-outline" size={18} color={theme.primary} />
                  )}
                </View>
              </MotiView>
            ))}
          </ScrollView>

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: theme.background }}>
            <TouchableOpacity onPress={startWorkout}
              style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Start Workout</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // ── EXERCISE PHASE ───────────────────────────────────
    if (phase === 'exercise' && currentEx) {
      const mode = currentExMode;
      const isTimedEx = needsTimer(currentEx);
      const allSets = trackedSets.get(currentExIdx) ?? [];

      const timeMin = currentEx.duration_min ?? currentEx.duration_seconds ?? 0;
      const timeMax = currentEx.duration_max ?? currentEx.duration_seconds ?? 0;
      const timerTarget = mode === 'timeRange' ? (currentEx.duration_max ?? 0) : (currentEx.duration_seconds ?? 0);
      const timerProgress = timerTarget > 0 ? Math.min(exTimer / timerTarget, 1) : 0;
      const hitMin = mode === 'timeRange' && exTimer >= (currentEx.duration_min ?? 0);
      const hitMax = mode === 'timeRange' && exTimer >= (currentEx.duration_max ?? 0);

      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 8 }}>
            <TouchableOpacity onPress={handleEndSession} style={{ marginRight: 12 }}>
              <Ionicons name="chevron-back" size={24} color="#7A7670" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                Exercise {currentExIdx + 1}/{totalExercises} · Set {currentSetIdx + 1}/{allSets.length}
              </Text>
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>{formatTime(elapsed)}</Text>
            </View>
            <TouchableOpacity onPress={handleEndSession}
              style={{ backgroundColor: '#F4433622', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 13 }}>End</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
            {/* Exercise name */}
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' }}
            >
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 24, textAlign: 'center', marginBottom: 4 }}>
                {tExercise(currentEx.exercises?.name ?? 'Exercise')}
              </Text>
              {currentEx.notes ? (
                <Text style={{ color: theme.primary, fontSize: 12, textAlign: 'center', marginBottom: 8, fontStyle: 'italic' }}>
                  {currentEx.notes}
                </Text>
              ) : null}
            </MotiView>

            {/* Timer display for timed exercises */}
            {isTimedEx && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 100 }}
                style={{ alignItems: 'center', marginVertical: 20 }}
              >
                <View style={{
                  width: 200, height: 200, borderRadius: 100,
                  borderWidth: 8,
                  borderColor: hitMax ? '#4CAF50' : hitMin ? theme.primary : theme.border,
                  alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
                }}>
                  <Text style={{
                    fontSize: 42, fontWeight: '800',
                    color: hitMax ? '#4CAF50' : hitMin ? theme.primary : theme.text,
                  }}>
                    {formatTime(exTimer)}
                  </Text>
                  {mode === 'timeRange' ? (
                    <View style={{ alignItems: 'center', marginTop: 4 }}>
                      {!hitMin && (
                        <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600' }}>
                          Min: {formatTime(currentEx.duration_min ?? 0)}
                        </Text>
                      )}
                      {hitMin && !hitMax && (
                        <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>
                          ✓ Min reached! Target: {formatTime(currentEx.duration_max ?? 0)}
                        </Text>
                      )}
                      {hitMax && (
                        <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '700' }}>
                          ✓ Target reached!
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                      Target: {formatTime(currentEx.duration_seconds ?? 0)}
                    </Text>
                  )}
                </View>

                {/* Time range progress bar */}
                {mode === 'timeRange' && (
                  <View style={{ width: SCREEN_W - 80, marginTop: 16 }}>
                    <View style={{ height: 8, backgroundColor: theme.border, borderRadius: 4 }}>
                      {timeMax > 0 && (
                        <View style={{
                          position: 'absolute', left: `${(timeMin / timeMax) * 100}%`,
                          top: -3, width: 2, height: 14, backgroundColor: theme.primary, borderRadius: 1,
                        }} />
                      )}
                      <View style={{
                        height: 8, borderRadius: 4,
                        backgroundColor: hitMin ? '#4CAF50' : theme.primary,
                        width: `${Math.min(timerProgress * 100, 100)}%`,
                      }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ color: theme.muted, fontSize: 10 }}>0s</Text>
                      <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '600' }}>min {timeMin}s</Text>
                      <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '600' }}>max {timeMax}s</Text>
                    </View>
                  </View>
                )}

                {/* Timer controls */}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
                  {!exTimerRunning ? (
                    <TouchableOpacity onPress={() => setExTimerRunning(true)}
                      style={{ backgroundColor: theme.primary, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="play" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                        {exTimer > 0 ? 'Resume' : 'Start Timer'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setExTimerRunning(false)}
                      style={{ backgroundColor: '#F4433622', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="pause" size={18} color="#F44336" />
                      <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 15 }}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  {exTimer > 0 && (
                    <TouchableOpacity onPress={() => { setExTimer(0); setExTimerRunning(false); }}
                      style={{ backgroundColor: theme.border, borderRadius: 16, padding: 14 }}>
                      <Ionicons name="refresh" size={18} color="#7A7670" />
                    </TouchableOpacity>
                  )}
                </View>
              </MotiView>
            )}

            {/* Reps / Rep range display */}
            {!isTimedEx && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 100 }}
                style={{ alignItems: 'center', marginVertical: 20 }}
              >
                <View style={{
                  width: 200, height: 200, borderRadius: 100,
                  borderWidth: 8, borderColor: theme.primary,
                  alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
                }}>
                  {mode === 'repRange' ? (
                    <>
                      <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>TARGET</Text>
                      <Text style={{ fontSize: 40, fontWeight: '800', color: theme.text }}>
                        {currentEx.reps_min}-{currentEx.reps_max}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>reps</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>TARGET</Text>
                      <Text style={{ fontSize: 48, fontWeight: '800', color: theme.text }}>
                        {currentEx.reps ?? '?'}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>reps</Text>
                    </>
                  )}
                </View>
              </MotiView>
            )}

            {/* Editable fields */}
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}>
              {/* Sets count */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>Sets</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => updateSetsCount(allSets.length - 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="remove" size={16} color="#7A7670" />
                  </TouchableOpacity>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, minWidth: 24, textAlign: 'center' }}>{allSets.length}</Text>
                  <TouchableOpacity onPress={() => updateSetsCount(allSets.length + 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={16} color="#7A7670" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reps (only for non-timed) */}
              {!isTimedEx && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>
                    {mode === 'repRange' ? `Reps done (${currentEx.reps_min}-${currentEx.reps_max})` : 'Reps done'}
                  </Text>
                  <TextInput
                    value={editReps}
                    onChangeText={setEditReps}
                    keyboardType="number-pad"
                    placeholder={String(currentEx.reps ?? currentEx.reps_min ?? '10')}
                    placeholderTextColor="#7A7670"
                    style={{
                      backgroundColor: theme.background, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
                      paddingHorizontal: 16, paddingVertical: 10, color: theme.text, fontWeight: '700',
                      fontSize: 18, width: 80, textAlign: 'center',
                    }}
                  />
                </View>
              )}

              {/* Weight */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>Weight (kg)</Text>
                <TextInput
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="decimal-pad"
                  placeholder={String(currentEx.weight_kg ?? '0')}
                  placeholderTextColor="#7A7670"
                  style={{
                    backgroundColor: theme.background, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
                    paddingHorizontal: 16, paddingVertical: 10, color: theme.text, fontWeight: '700',
                    fontSize: 18, width: 80, textAlign: 'center',
                  }}
                />
              </View>
            </View>

            {/* Sets overview dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              {allSets.map((s, i) => (
                <TouchableOpacity key={i} onPress={() => { if (!s.completed) { setCurrentSetIdx(i); initSetEdits(currentExIdx, i); } }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: s.completed ? '#4CAF50' : i === currentSetIdx ? theme.primary : theme.border,
                  }}>
                    {s.completed ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={{ color: i === currentSetIdx ? '#fff' : theme.muted, fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Exercise navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TouchableOpacity
                disabled={currentExIdx === 0}
                onPress={() => goToExercise(currentExIdx - 1, 0)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: currentExIdx === 0 ? 0.3 : 1 }}
              >
                <Ionicons name="chevron-back" size={16} color="#7A7670" />
                <Text style={{ color: theme.muted, fontSize: 13 }}>Prev exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={currentExIdx >= totalExercises - 1}
                onPress={() => goToExercise(currentExIdx + 1, 0)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: currentExIdx >= totalExercises - 1 ? 0.3 : 1 }}
              >
                <Text style={{ color: theme.muted, fontSize: 13 }}>Next exercise</Text>
                <Ionicons name="chevron-forward" size={16} color="#7A7670" />
              </TouchableOpacity>
            </View>

            {/* RPE selector */}
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
                RPE (Perceived Effort)
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                  const selected = editRpe === val;
                  const rpeColor = val <= 3 ? '#4CAF50' : val <= 6 ? '#FFC107' : val <= 8 ? '#FF9800' : '#F44336';
                  return (
                    <TouchableOpacity key={val} onPress={() => setEditRpe(selected ? null : val)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: selected ? rpeColor : theme.background,
                        borderWidth: 1, borderColor: selected ? rpeColor : theme.border,
                      }}>
                      <Text style={{ color: selected ? '#fff' : theme.muted, fontWeight: '700', fontSize: 12 }}>{val}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Complete set button */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: theme.background }}>
            <TouchableOpacity onPress={completeCurrentSet}
              disabled={isTimedEx && !exTimerRunning && exTimer === 0}
              style={{
                backgroundColor: (isTimedEx && !exTimerRunning && exTimer === 0) ? theme.border : '#4CAF50',
                borderRadius: 16, paddingVertical: 18, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                Complete Set {currentSetIdx + 1}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // ── REST PHASE ───────────────────────────────────────
    if (phase === 'rest') {
      const restProgress = restTimerMax > 0 ? (restTimerMax - restTimer) / restTimerMax : 0;
      const sets = trackedSets.get(currentExIdx) ?? [];
      const isLastSet = currentSetIdx >= sets.length - 1;
      const nextExIdx = isLastSet ? currentExIdx + 1 : currentExIdx;
      const nextSetIdx = isLastSet ? 0 : currentSetIdx + 1;
      const nextEx = workoutExercises[nextExIdx];
      const nextLabel = isLastSet
        ? `Next: ${nextEx?.exercises?.name ?? 'Exercise'}`
        : `Next: Set ${nextSetIdx + 1}`;

      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
            >
              <Text style={{ color: theme.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 }}>
                Rest Time
              </Text>

              <View style={{
                width: 220, height: 220, borderRadius: 110,
                borderWidth: 10, borderColor: theme.primary,
                alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
                alignSelf: 'center',
              }}>
                <Text style={{ fontSize: 52, fontWeight: '800', color: theme.text }}>
                  {formatTime(restTimer)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
                  / {formatTime(restTimerMax)}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={{ width: SCREEN_W - 80, height: 6, backgroundColor: theme.border, borderRadius: 3, marginTop: 24, alignSelf: 'center' }}>
                <View
                  style={{ height: 6, borderRadius: 3, backgroundColor: theme.primary, width: `${restProgress * 100}%` }}
                />
              </View>

              <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginTop: 24 }}>
                {nextLabel}
              </Text>

              <View style={{ flexDirection: 'row', gap: 16, marginTop: 24, justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => setRestTimer((t) => Math.max(0, t - 15))}
                  style={{ backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 13 }}>-15s</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRestTimer((t) => t + 15)}
                  style={{ backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 13 }}>+15s</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>

          <View style={{ padding: 20, paddingBottom: 36 }}>
            <TouchableOpacity onPress={skipRest}
              style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Skip Rest</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // ── COMPLETE PHASE ───────────────────────────────────
    if (phase === 'complete') {
      let totalSetsCount = 0;
      let totalRepsCount = 0;
      let totalVolume = 0;
      let totalRestSec = 0;
      trackedSets.forEach((sets) => {
        sets.forEach((s) => {
          if (s.completed) {
            totalSetsCount++;
            totalRepsCount += s.reps ?? 0;
            totalVolume += (s.reps ?? 0) * (s.weight_kg ?? 0);
            totalRestSec += s.rest_seconds_taken ?? 0;
          }
        });
      });

      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, paddingBottom: 120 }}>
            <MotiView
              from={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <Text style={{ fontSize: 64, textAlign: 'center' }}>🎉</Text>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 28, textAlign: 'center', marginTop: 16 }}>
                {t('workout.complete')}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', marginTop: 8 }}>
                {t('workout.completeDesc')}
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80 }}>
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{formatTime(elapsed)}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{t('workout.duration')}</Text>
                </View>
                <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80 }}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#4CAF50" />
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{totalSetsCount}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{t('workout.sets')}</Text>
                </View>
                <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80 }}>
                  <Ionicons name="fitness-outline" size={20} color={theme.primary} />
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{totalRepsCount}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{t('workout.reps')}</Text>
                </View>
                <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80 }}>
                  <Ionicons name="barbell-outline" size={20} color={theme.primary} />
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{Math.round(totalVolume)}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>Vol. (kg)</Text>
                </View>
                {totalRestSec > 0 && (
                  <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80 }}>
                    <Ionicons name="hourglass-outline" size={20} color="#7A7670" />
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{formatTime(totalRestSec)}</Text>
                    <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{t('workout.rest')}</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 24, width: SCREEN_W - 60 }}>
                {workoutExercises.map((pe, idx) => {
                  const sets = trackedSets.get(idx) ?? [];
                  const done = sets.filter((s) => s.completed).length;
                  return (
                    <View key={pe.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Ionicons name={done === sets.length ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done === sets.length ? '#4CAF50' : theme.border} />
                      <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{pe.exercises?.name ?? 'Exercise'}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{done}/{sets.length} sets</Text>
                    </View>
                  );
                })}
              </View>
            </MotiView>
          </ScrollView>

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: theme.background }}>
            <TouchableOpacity onPress={handleFinish}
              style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>{t('workout.finishSave')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // FREE WORKOUT (no program)
  // ═══════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>{t('workout.quickStart')}</Text>
          <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity onPress={handleEndSession}
          style={{ backgroundColor: '#F4433622', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 14 }}>End</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 120 }}>
        {freeExercises.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Text style={{ fontSize: 40 }}>🏋️</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>{t('workout.addFirstExercise')}</Text>
            <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>{t('workout.addFirstExerciseDesc')}</Text>
          </View>
        )}

        {freeExercises.map((ex, exIdx) => (
          <View key={`${ex.id}-${exIdx}`} style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>{ex.name}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: theme.muted, fontSize: 12, width: 30 }}>Set</Text>
              <Text style={{ color: theme.muted, fontSize: 12, flex: 1, textAlign: 'center' }}>Reps</Text>
              <Text style={{ color: theme.muted, fontSize: 12, flex: 1, textAlign: 'center' }}>Weight (kg)</Text>
              <View style={{ width: 40 }} />
            </View>
            {ex.sets.map((s, setIdx) => (
              <View key={setIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 14, width: 22 }}>{setIdx + 1}</Text>
                <TextInput value={s.reps} onChangeText={(v) => updateFreeSet(exIdx, setIdx, 'reps', v)}
                  placeholder="12" placeholderTextColor="#7A7670" keyboardType="number-pad"
                  style={{
                    flex: 1, backgroundColor: s.completed ? '#4CAF5018' : theme.background, borderRadius: 8, padding: 10,
                    color: theme.text, textAlign: 'center', borderWidth: 1, borderColor: s.completed ? '#4CAF50' : theme.border,
                  }} />
                <TextInput value={s.weight} onChangeText={(v) => updateFreeSet(exIdx, setIdx, 'weight', v)}
                  placeholder="60" placeholderTextColor="#7A7670" keyboardType="decimal-pad"
                  style={{
                    flex: 1, backgroundColor: s.completed ? '#4CAF5018' : theme.background, borderRadius: 8, padding: 10,
                    color: theme.text, textAlign: 'center', borderWidth: 1, borderColor: s.completed ? '#4CAF50' : theme.border,
                  }} />
                <TouchableOpacity onPress={() => completeFreeSet(exIdx, setIdx)} disabled={s.completed}
                  style={{ backgroundColor: s.completed ? '#4CAF50' : '#4CAF5022', borderRadius: 8, padding: 8 }}>
                  <Ionicons name="checkmark" size={16} color={s.completed ? '#fff' : '#4CAF50'} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => addFreeSet(exIdx)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 13 }}>{t('workout.addSet')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity onPress={() => { setSearchQuery(''); setShowPicker(true); }}
          style={{ borderWidth: 1.5, borderColor: theme.primary, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="add" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 15 }}>{t('workout.addExercise')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {showPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{t('workout.chooseExercise')}</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Ionicons name="close" size={24} color="#7A7670" />
                </TouchableOpacity>
              </View>
              <TextInput value={searchQuery} onChangeText={setSearchQuery}
                placeholder={t('workout.searchExercise')} placeholderTextColor="#7A7670"
                style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, marginBottom: 12 }} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
              {filteredExercises.map((ex) => (
                <TouchableOpacity key={ex.id} onPress={() => addFreeExercise(ex)}
                  style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14 }}>{ex.name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{ex.muscle_groups.join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

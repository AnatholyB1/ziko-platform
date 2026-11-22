import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, useCreditStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { useStretchingStore } from '../store';
import { fetchRoutine, insertLog } from '../data';
import { formatMeasure } from '../lib';
import { ErrorCard, PrimaryButton, Skeleton } from '../components/ui';

// Awaitable credit earn helper — returns { credited } for toast triggering
async function earnCredit(supabase: any, source: string, key: string): Promise<{ credited: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { credited: false };
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const res = await fetch(`${API_URL}/credits/earn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ source, idempotency_key: key }),
    });
    if (!res.ok) return { credited: false };
    const data: any = await res.json();
    return { credited: data.credited === true };
  } catch {
    return { credited: false };
  }
}

/**
 * Lecture guidee d'une routine. Lancee depuis l'onglet Routines ou depuis la carte de debut de seance
 * (retour a l'ecran precedent a la fin). Terminer ecrit un log ziko_stretching_logs et rien d'autre :
 * un log de stretching ne compte jamais comme serie validee (G-04).
 */
export default function StretchingSession({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const { startRoutine, nextExercise, stopRoutine, activeRoutine, currentExerciseIndex } = useStretchingStore();
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [side, setSide] = useState(1);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => (await supabase.auth.getUser()).data?.user ?? null,
  });
  const userId: string | undefined = authData?.id;

  const { data: routine, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stretching_routine', userId, routineId],
    queryFn: () => fetchRoutine(supabase, userId as string, routineId as string),
    enabled: !!userId && !!routineId,
  });

  useEffect(() => {
    if (routine && routine.exercises.length > 0) startRoutine(routine);
    return () => { stopRoutine(); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [routine?.id]);

  const exercise = activeRoutine?.exercises[currentExerciseIndex];

  // Nouvel exercice ou nouveau cote : remet le minuteur (exercice en duree) et demarre.
  useEffect(() => {
    setSide(1);
  }, [currentExerciseIndex]);
  useEffect(() => {
    if (exercise && exercise.measure === 'duration') {
      setTimer(exercise.duration_seconds);
      setIsRunning(true);
    } else {
      setIsRunning(false);
      setTimer(0);
    }
  }, [currentExerciseIndex, side, activeRoutine]);

  useEffect(() => {
    if (isRunning && timer > 0) {
      intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timer > 0]);

  const close = () => { stopRoutine(); router.back(); };

  if (isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16, justifyContent: 'center' }}>
        <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger la routine'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }
  if (isLoading || !userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
        <Skeleton count={2} />
      </SafeAreaView>
    );
  }
  if (!routine || routine.exercises.length === 0 || !activeRoutine || !exercise) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
          {routine && routine.exercises.length === 0 ? 'Cette routine est vide' : 'Routine introuvable'}
        </Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton label="Retour" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const isLastExercise = currentExerciseIndex === activeRoutine.exercises.length - 1;
  const isLastStep = isLastExercise && side === exercise.sides;
  const progress = (currentExerciseIndex + 1) / activeRoutine.exercises.length;

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const logId = await insertLog(supabase, userId, activeRoutine);
      if (logId) {
        earnCredit(supabase, 'stretch', logId).then((r) => {
          if (r.credited) useCreditStore.getState().showEarnToast();
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stretching_logs'] }),
      ]);
      stopRoutine();
      router.back();
    } catch (e: any) {
      setSaving(false);
      showAlert('Séance non enregistrée', e?.message ?? "Impossible d'enregistrer la séance. Réessaie.");
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      finish();
    } else if (side < exercise.sides) {
      setSide(side + 1);
    } else {
      nextExercise();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 20, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Quitter la routine" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.muted, fontSize: 14 }}>
            {activeRoutine.name} · {currentExerciseIndex + 1} / {activeRoutine.exercises.length}
          </Text>
        </View>

        <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginTop: 12 }}>
          <View style={{ height: 4, backgroundColor: getActionPrimary(theme), borderRadius: 2, width: `${progress * 100}%` }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{exercise.name}</Text>
          {exercise.sides === 2 ? (
            <Text style={{ color: '#B53D05', fontSize: 15, fontWeight: '700', marginTop: 8 }}>
              {side === 1 ? 'Côté gauche' : 'Côté droit'} · {side} sur 2
            </Text>
          ) : null}
          {exercise.instructions ? (
            <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 22 }}>
              {exercise.instructions}
            </Text>
          ) : null}

          {exercise.measure === 'duration' ? (
            <>
              <View
                style={{
                  marginTop: 32, width: 140, height: 140, borderRadius: 70, borderWidth: 6,
                  borderColor: timer > 0 ? getActionPrimary(theme) : '#2E7D32', justifyContent: 'center', alignItems: 'center',
                }}
                accessible
                accessibilityLabel={`${timer} secondes restantes`}
              >
                <Text style={{ color: theme.text, fontSize: 40, fontWeight: '800' }}>{timer}</Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>sec</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsRunning(!isRunning)}
                accessibilityRole="button"
                accessibilityLabel={isRunning ? 'Pause' : 'Reprendre'}
                style={{ marginTop: 16, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name={isRunning ? 'pause-circle' : 'play-circle'} size={48} color={getActionPrimary(theme)} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ marginTop: 32, alignItems: 'center' }} accessible accessibilityLabel={formatMeasure(exercise)}>
              <Text style={{ color: theme.text, fontSize: 56, fontWeight: '800' }}>{exercise.reps}</Text>
              <Text style={{ color: theme.muted, fontSize: 15 }}>répétition{exercise.reps > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        <PrimaryButton
          label={saving ? 'Enregistrement…' : isLastStep ? 'Terminer' : side < exercise.sides ? 'Côté suivant' : 'Suivant'}
          onPress={handleNext}
          disabled={saving}
        />
        <View style={{ height: 20 }} />
      </View>
    </SafeAreaView>
  );
}

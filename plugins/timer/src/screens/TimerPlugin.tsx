import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  AppState,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playSound, playCountdownBeep } from '@ziko/sounds';

const TABS = ['Séance', 'Tabata', 'Intervalle'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (s: number): string =>
  Math.floor(s / 60)
    .toString()
    .padStart(2, '0') +
  ':' +
  (s % 60).toString().padStart(2, '0');

// ─── Main Component ─────────────────────────────────────────────────────────
export default function TimerPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('Séance');

  // ── Countdown state (shared across tabs) ─────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [currentRound, setCurrentRound] = useState(1);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Intervalle tab state
  const [effortSec, setEffortSec] = useState(45);
  const [restSec, setRestSec] = useState(15);
  const [rounds, setRounds] = useState(10);
  const [sets, setSets] = useState(3);

  // ── Query: timer presets ─────────────────────────────────────────────────
  const { data: dbPresets } = useQuery({
    queryKey: ['timer_presets', 'user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('timer_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        work_seconds: row.work_sec,
        rest_seconds: row.rest_sec,
        rounds: row.rounds ?? 1,
        exercises: row.exercises ?? [],
      }));
    },
  });

  // Builtin presets (fallback si aucun preset DB)
  const builtinPresets = [
    { id: 'b1', name: 'Force', type: 'custom', work_seconds: 180, rest_seconds: 90, rounds: 5 },
    { id: 'b2', name: 'Hypertrophie', type: 'hiit', work_seconds: 90, rest_seconds: 60, rounds: 8 },
    { id: 'b3', name: 'Endurance', type: 'emom', work_seconds: 45, rest_seconds: 15, rounds: 10 },
    { id: 'b4', name: 'Cardio HIIT', type: 'tabata', work_seconds: 20, rest_seconds: 10, rounds: 8 },
  ];

  const presetsToShow =
    dbPresets && dbPresets.length > 0 ? dbPresets : builtinPresets;

  // ── Mutation: save workout session ────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { error } = await supabase.from('workout_sessions').insert({
        user_id: user.id,
        name: selectedPreset?.name ?? 'Séance Timer',
        started_at: sessionStart?.toISOString() ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        notes: selectedPreset
          ? `${selectedPreset.name} — ${selectedPreset.rounds ?? 1} rounds`
          : '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showAlert('Séance sauvegardée', 'Ta séance a été enregistrée dans ton historique.');
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible de sauvegarder la séance');
    },
  });

  // ── Countdown logic (D-08) ────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    Vibration.vibrate([0, 400, 200, 400]);
    playSound('complete');
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            handleComplete();
            return 0;
          }
          if (s <= 3) {
            playCountdownBeep(s);
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, handleComplete]);

  // AppState correction (D-08) — background correction
  useEffect(() => {
    const totalSeconds = selectedPreset?.work_seconds ?? 90;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && startedAtRef.current && isRunning && !isPaused) {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSecondsLeft(Math.max(0, totalSeconds - elapsed));
      }
    });
    return () => {
      sub.remove();
    };
  }, [isRunning, isPaused, selectedPreset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    const now = new Date();
    setSessionStart(now);
    startedAtRef.current = Date.now();
    playSound('start');
  }, []);

  const handlePause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
    playSound('rest');
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    // Recalibrate startedAt to reflect the paused gap
    startedAtRef.current =
      Date.now() - ((selectedPreset?.work_seconds ?? 90) - secondsLeft) * 1000;
  }, [secondsLeft, selectedPreset]);

  const handleAdjust = useCallback((delta: number) => {
    setSecondsLeft((s) => Math.max(0, s + delta));
  }, []);

  const selectPreset = useCallback(
    (p: any) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSelectedPreset(p);
      setSecondsLeft(p.work_seconds);
      setIsRunning(false);
      setIsPaused(false);
      setCurrentRound(1);
    },
    [],
  );

  // ── Card shadow style ─────────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Timer" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── ONGLET SÉANCE ──────────────────────────────────────────────── */}
        {activeTab === 'Séance' && (
          <>
            {/* Carte dark countdown */}
            <View
              style={{
                backgroundColor: '#1C1A17',
                borderRadius: 20,
                padding: 24,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  opacity: 0.6,
                  fontWeight: '700',
                  letterSpacing: 0.1,
                  textTransform: 'uppercase',
                  color: '#FFFAF6',
                  textAlign: 'center',
                }}
              >
                Effort
              </Text>

              <Text
                style={{
                  fontSize: 72,
                  fontWeight: '900',
                  color: '#FF5C1A',
                  textAlign: 'center',
                  marginTop: 8,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatTime(secondsLeft)}
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  opacity: 0.55,
                  color: '#FFFAF6',
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                Série {currentRound}/{selectedPreset?.rounds ?? 1} ·{' '}
                {selectedPreset?.name ?? '—'}
              </Text>

              {/* Contrôles */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 18,
                  alignItems: 'center',
                }}
              >
                {/* -15s */}
                <TouchableOpacity
                  onPress={() => handleAdjust(-15)}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: 'rgba(255,250,246,0.2)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFAF6' }}>
                    -15s
                  </Text>
                </TouchableOpacity>

                {/* Bouton central */}
                <TouchableOpacity
                  onPress={
                    !isRunning
                      ? handleStart
                      : isPaused
                      ? handleResume
                      : handlePause
                  }
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#FF5C1A',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons
                    name={isRunning && !isPaused ? 'pause-outline' : 'play-outline'}
                    size={26}
                    color="#fff"
                  />
                </TouchableOpacity>

                {/* +15s */}
                <TouchableOpacity
                  onPress={() => handleAdjust(15)}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: 'rgba(255,250,246,0.2)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFAF6' }}>
                    +15s
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CTA Sauvegarder */}
              {!isRunning && sessionStart !== null && (
                <TouchableOpacity
                  onPress={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  style={{
                    padding: 12,
                    backgroundColor: 'rgba(255,92,26,0.14)',
                    borderRadius: 12,
                    marginTop: 12,
                  }}
                >
                  <Text
                    style={{
                      color: '#FF5C1A',
                      fontWeight: '700',
                      textAlign: 'center',
                    }}
                  >
                    {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder comme séance'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AISuggestion */}
            <View style={{ marginBottom: 16 }}>
              <AISuggestion
                text="Commence par 2 min de mobilité articulaire avant chaque séance pour prévenir les blessures et améliorer tes performances."
              />
            </View>

            {/* Section Presets */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: theme.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.05,
                marginBottom: 8,
              }}
            >
              Presets
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {presetsToShow.map((p: any) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => selectPreset(p)}
                  style={{
                    backgroundColor:
                      selectedPreset?.id === p.id
                        ? theme.primary + '18'
                        : theme.surface,
                    borderRadius: 16,
                    padding: 14,
                    width: '48%',
                    borderWidth: 1,
                    borderColor:
                      selectedPreset?.id === p.id ? theme.primary : theme.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.muted,
                      fontWeight: '700',
                      letterSpacing: 0.05,
                      textTransform: 'uppercase',
                    }}
                  >
                    {p.type}
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: theme.primary,
                      marginTop: 4,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}
                  >
                    {p.work_seconds}s effort · {p.rest_seconds}s repos
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── ONGLET TABATA ──────────────────────────────────────────────── */}
        {activeTab === 'Tabata' && (
          <>
            <View style={cardStyle}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.muted,
                  fontWeight: '700',
                  letterSpacing: 0.05,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                TABATA CLASSIQUE
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, marginTop: 4 }}>
                20s effort · 10s repos · 8 rounds
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                4 minutes intense — méthode validée pour le HIIT
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const tabataPreset = {
                    id: 'tabata-classic',
                    name: 'Tabata classique',
                    type: 'tabata' as const,
                    work_seconds: 20,
                    rest_seconds: 10,
                    rounds: 8,
                  };
                  selectPreset(tabataPreset);
                  setActiveTab('Séance');
                }}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  padding: 12,
                  width: '100%',
                  marginTop: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Démarrer Tabata
                </Text>
              </TouchableOpacity>
            </View>

            <AISuggestion
              text="Tabata mardi + jeudi maximise l'EPOC sans entamer ta récup force."
            />
          </>
        )}

        {/* ── ONGLET INTERVALLE ──────────────────────────────────────────── */}
        {activeTab === 'Intervalle' && (
          <>
            <View style={cardStyle}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.muted,
                  fontWeight: '700',
                  letterSpacing: 0.05,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                PERSONNALISÉ
              </Text>

              {/* Effort */}
              {[
                {
                  label: 'Effort',
                  value: effortSec,
                  unit: 's',
                  inc: () => setEffortSec((v) => v + 5),
                  dec: () => setEffortSec((v) => Math.max(5, v - 5)),
                },
                {
                  label: 'Repos',
                  value: restSec,
                  unit: 's',
                  inc: () => setRestSec((v) => v + 5),
                  dec: () => setRestSec((v) => Math.max(0, v - 5)),
                },
                {
                  label: 'Rounds',
                  value: rounds,
                  unit: '',
                  inc: () => setRounds((v) => v + 1),
                  dec: () => setRounds((v) => Math.max(1, v - 1)),
                },
                {
                  label: 'Sets',
                  value: sets,
                  unit: '',
                  inc: () => setSets((v) => v + 1),
                  dec: () => setSets((v) => Math.max(1, v - 1)),
                },
              ].map(({ label, value, unit, inc, dec }) => (
                <View
                  key={label}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 14, color: theme.text, fontWeight: '600' }}>
                    {label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      onPress={dec}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: theme.border,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '700' }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, minWidth: 36, textAlign: 'center' }}>
                      {value}{unit}
                    </Text>
                    <TouchableOpacity
                      onPress={inc}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: theme.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => {
                  const intervalPreset = {
                    id: `interval-${Date.now()}`,
                    name: `Intervalle ${effortSec}s/${restSec}s`,
                    type: 'custom' as const,
                    work_seconds: effortSec,
                    rest_seconds: restSec,
                    rounds: rounds * sets,
                  };
                  selectPreset(intervalPreset);
                  setSecondsLeft(effortSec);
                  setActiveTab('Séance');
                }}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  padding: 12,
                  width: '100%',
                  marginTop: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Lancer · {Math.round((effortSec * rounds * sets) / 60)} min
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

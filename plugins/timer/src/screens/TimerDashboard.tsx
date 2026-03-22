import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Vibration, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore, usePluginRegistry } from '@ziko/plugin-sdk';
import { useTimerStore, BUILTIN_PRESETS } from '../store';
import type { TimerPreset } from '../store';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PresetCard({ preset, theme, onStart, showBadge }: {
  preset: TimerPreset; theme: any; onStart: () => void; showBadge?: boolean;
}) {
  const typeColors: Record<string, string> = {
    tabata: '#F44336', hiit: '#FF9800', emom: '#2196F3', custom: '#9C27B0',
  };
  const totalSeconds = (preset.work_seconds + preset.rest_seconds) * preset.rounds;
  const totalMin = Math.ceil(totalSeconds / 60);

  return (
    <TouchableOpacity
      onPress={onStart}
      style={{
        backgroundColor: theme.surface, borderRadius: 14, padding: 16,
        marginBottom: 10, borderWidth: 1, borderColor: theme.border,
        flexDirection: 'row', alignItems: 'center',
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: typeColors[preset.type] + '20',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
      }}>
        <Ionicons name="timer" size={22} color={typeColors[preset.type]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{preset.name}</Text>
          {showBadge && (
            <View style={{
              backgroundColor: typeColors[preset.type] + '22', borderRadius: 6,
              paddingHorizontal: 6, paddingVertical: 2,
            }}>
              <Text style={{ color: typeColors[preset.type], fontSize: 10, fontWeight: '700' }}>PERSO</Text>
            </View>
          )}
        </View>
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          {preset.work_seconds > 0 ? `${preset.work_seconds}s work` : ''}
          {preset.rest_seconds > 0 ? ` / ${preset.rest_seconds}s rest` : ''}
          {' · '}{preset.rounds} rounds · ~{totalMin} min
        </Text>
      </View>
      <Ionicons name="play" size={24} color={theme.primary} />
    </TouchableOpacity>
  );
}

// Map timer type to cardio activity_type
function timerTypeToCardioActivity(type: string): string {
  if (type === 'hiit' || type === 'tabata') return 'hiit';
  return 'other';
}

export default function TimerDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const isCardioInstalled = usePluginRegistry((s) => s.enabledPlugins).includes('cardio');
  const params = useLocalSearchParams<{ autoStartPresetId?: string }>();
  const {
    activePreset, currentRound, timeLeft,
    isWork, isRunning, isPaused, elapsedSeconds,
    customPresets, setCustomPresets,
    startTimer, tick, togglePause, stopTimer,
  } = useTimerStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedPreset, setCompletedPreset] = useState<TimerPreset | null>(null);
  const [completedElapsed, setCompletedElapsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const autoStartHandled = useRef(false);

  // Load custom presets from Supabase
  const loadCustomPresets = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('timer_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped: TimerPreset[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        work_seconds: d.work_sec,
        rest_seconds: d.rest_sec,
        rounds: d.rounds,
        is_builtin: false,
      }));
      setCustomPresets(mapped);
    } catch {
      // silent
    }
  }, [supabase]);

  useEffect(() => {
    if (!loaded) {
      loadCustomPresets();
      setLoaded(true);
    }
  }, [loaded]);

  // Auto-start a preset when navigated from AI with autoStartPresetId
  useEffect(() => {
    if (!params.autoStartPresetId || autoStartHandled.current || !loaded) return;
    autoStartHandled.current = true;

    const allPresets = [...BUILTIN_PRESETS, ...customPresets];
    const preset = allPresets.find((p) => p.id === params.autoStartPresetId);
    if (preset) {
      startTimer(preset);
    } else {
      // Preset might not be loaded yet — try fetching from DB
      (async () => {
        try {
          const { data } = await supabase
            .from('timer_presets')
            .select('*')
            .eq('id', params.autoStartPresetId)
            .single();
          if (data) {
            const mapped: TimerPreset = {
              id: data.id,
              name: data.name,
              type: data.type,
              work_seconds: data.work_sec,
              rest_seconds: data.rest_sec,
              rounds: data.rounds,
              is_builtin: false,
            };
            startTimer(mapped);
          }
        } catch {
          // silently fail
        }
      })();
    }
  }, [params.autoStartPresetId, loaded, customPresets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomPresets();
    setRefreshing(false);
  }, [loadCustomPresets]);

  // Timer interval
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        const ended = tick();
        if (ended) {
          Vibration.vibrate([0, 400, 200, 400]);
          const store = useTimerStore.getState();
          setCompletedPreset(store.activePreset);
          setCompletedElapsed(store.elapsedSeconds);
          setCompleted(true);
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isPaused]);

  const handleDismissComplete = () => {
    setCompleted(false);
    setCompletedPreset(null);
    setCompletedElapsed(0);
    stopTimer();
  };

  const handleLogCardio = () => {
    if (!completedPreset) return;
    const durationMin = Math.round(completedElapsed / 60 * 10) / 10;
    const activityType = timerTypeToCardioActivity(completedPreset.type);
    // Estimate calories: ~8-12 kcal/min for HIIT
    const estCalories = Math.round(durationMin * 10);

    handleDismissComplete();
    router.push({
      pathname: '/(plugins)/cardio/log' as any,
      params: {
        prefill_activity: activityType,
        prefill_duration: String(durationMin),
        prefill_calories: String(estCalories),
        prefill_notes: `${completedPreset.name} — ${completedPreset.rounds} rounds`,
      },
    });
  };

  // Completion screen
  if (completed && completedPreset) {
    const elapsedMin = Math.floor(completedElapsed / 60);
    const elapsedSec = completedElapsed % 60;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            Chrono terminé !
          </Text>
          <Text style={{ color: theme.muted, fontSize: 16, marginTop: 8 }}>{completedPreset.name}</Text>

          {/* Stats */}
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 20, marginTop: 28,
            width: '100%', borderWidth: 1, borderColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>
                  {elapsedMin}:{elapsedSec.toString().padStart(2, '0')}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Durée</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>
                  {completedPreset.rounds}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Rounds</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>
                  {Math.round(completedElapsed / 60 * 10)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>~kcal</Text>
              </View>
            </View>
          </View>

          {/* Cardio integration */}
          {isCardioInstalled && (
            <TouchableOpacity
              onPress={handleLogCardio}
              style={{
                backgroundColor: theme.primary, borderRadius: 14,
                paddingHorizontal: 28, paddingVertical: 16, marginTop: 28,
                flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="bicycle" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Enregistrer en session cardio
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleDismissComplete}
            style={{
              borderRadius: 14, paddingHorizontal: 28, paddingVertical: 16, marginTop: 12,
              borderWidth: 1, borderColor: theme.border, width: '100%', alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Active timer view
  if (activePreset && isRunning) {
    const workColor = '#FF5C1A';
    const restColor = '#2196F3';
    const currentColor = isWork ? workColor : restColor;
    const progress = activePreset
      ? (isWork
        ? 1 - timeLeft / (activePreset.work_seconds || 1)
        : 1 - timeLeft / (activePreset.rest_seconds || 1))
      : 0;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {/* Preset name */}
          <Text style={{ color: theme.muted, fontSize: 16, fontWeight: '600' }}>{activePreset.name}</Text>
          <Text style={{ color: currentColor, fontSize: 18, fontWeight: '800', marginTop: 8 }}>
            {isWork ? '💪 WORK' : '😮‍💨 REST'}
          </Text>

          {/* Timer circle */}
          <View style={{
            width: 200, height: 200, borderRadius: 100, borderWidth: 8,
            borderColor: currentColor, justifyContent: 'center', alignItems: 'center',
            marginTop: 32,
          }}>
            <Text style={{ color: theme.text, fontSize: 56, fontWeight: '800' }}>{formatTime(timeLeft)}</Text>
          </View>

          {/* Round */}
          <Text style={{ color: theme.muted, fontSize: 16, marginTop: 20 }}>
            Round {currentRound} / {activePreset.rounds}
          </Text>

          {/* Elapsed */}
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 6 }}>
            Temps écoulé : {formatTime(elapsedSeconds)}
          </Text>

          {/* Progress bar */}
          <View style={{ width: '80%', height: 6, backgroundColor: theme.border, borderRadius: 3, marginTop: 16 }}>
            <View style={{ height: 6, backgroundColor: currentColor, borderRadius: 3, width: `${progress * 100}%` }} />
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 40 }}>
            <TouchableOpacity
              onPress={togglePause}
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center',
                borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { stopTimer(); }}
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#F4433620', justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="stop" size={28} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // All presets combined
  const allPresets = [...BUILTIN_PRESETS, ...customPresets];

  // Preset selection
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Timer</Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>HIIT · Tabata · EMOM · Repos</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/timer/manager' as any)}
            style={{
              backgroundColor: theme.primary, borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row',
              alignItems: 'center', gap: 6,
            }}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Gérer</Text>
          </TouchableOpacity>
        </View>

        {/* Builtin presets */}
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
          Presets
        </Text>
        {BUILTIN_PRESETS.map((p) => (
          <PresetCard key={p.id} preset={p} theme={theme} onStart={() => startTimer(p)} />
        ))}

        {/* Custom presets */}
        {customPresets.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                Mes chronos
              </Text>
              <TouchableOpacity onPress={() => router.push('/(plugins)/timer/editor' as any)}>
                <Ionicons name="add-circle" size={26} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {customPresets.map((p) => (
              <PresetCard key={p.id} preset={p} theme={theme} onStart={() => startTimer(p)} showBadge />
            ))}
          </>
        )}

        {customPresets.length === 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/timer/editor' as any)}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 20,
              marginTop: 24, borderWidth: 1, borderColor: theme.border,
              borderStyle: 'dashed', alignItems: 'center',
            }}
          >
            <Ionicons name="add-circle-outline" size={32} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 15, marginTop: 8 }}>
              Créer un chrono personnalisé
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              Définis tes propres intervalles, repos et rounds
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

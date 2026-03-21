import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useTimerStore } from '../store';
import type { TimerPreset } from '../store';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PresetCard({ preset, theme, onStart }: { preset: TimerPreset; theme: any; onStart: () => void }) {
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
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{preset.name}</Text>
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

export default function TimerDashboard() {
  const theme = useThemeStore((s) => s.theme);
  const {
    presets, activePreset, currentRound, timeLeft,
    isWork, isRunning, isPaused, startTimer, tick, togglePause, stopTimer,
  } = useTimerStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        const ended = tick();
        if (ended) {
          Vibration.vibrate([0, 400, 200, 400]);
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isPaused]);

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
              onPress={stopTimer}
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

  // Preset selection
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Timer</Text>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>HIIT · Tabata · EMOM · Repos</Text>

        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
          Presets
        </Text>
        {presets.map((p) => (
          <PresetCard key={p.id} preset={p} theme={theme} onStart={() => startTimer(p)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

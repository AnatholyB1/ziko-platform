import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { PluginHeader } from '@ziko/ui';
import { calc1RM, rpeToPercent, rpeToRIR, RPE_VALUES, TRAINING_ZONES } from '../index';
import { useRpeStore } from '../store';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY = '#FF5C1A';
const DARK_CARD = '#1C1A17';
const REPS_CHIPS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const RPE_CHIPS = [5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function rpeColor(rpe: number): string {
  if (rpe <= 6) return '#2E9E5B';
  if (rpe <= 8) return '#F59E0B';
  return '#E94B3C';
}

// ─── RPEPlugin ────────────────────────────────────────────────────────────────

export default function RPEPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const { lastWeight, lastReps, lastRpe, setLast } = useRpeStore();

  const [weight, setWeight] = useState(lastWeight);
  const [reps, setReps] = useState(lastReps);
  const [rpe, setRpe] = useState(lastRpe);

  const oneRM = useMemo(() => calc1RM(weight, reps, rpe), [weight, reps, rpe]);
  const pct = useMemo(() => rpeToPercent(reps, rpe), [reps, rpe]);
  const rir = useMemo(() => rpeToRIR(rpe), [rpe]);
  const currentColor = rpeColor(rpe);

  // Persist last values
  useEffect(() => {
    setLast(weight, reps, rpe);
  }, [weight, reps, rpe]);

  const adjustWeight = (delta: number) => {
    setWeight((prev) => Math.max(0, Math.min(500, Math.round((prev + delta) * 10) / 10)));
  };

  const adjustReps = (delta: number) => {
    setReps((prev) => Math.max(1, Math.min(20, prev + delta)));
  };

  const adjustRpe = (delta: number) => {
    const next = Math.round((rpe + delta) * 10) / 10;
    if (next >= 5 && next <= 10) setRpe(next);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Calculateur RPE" onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Dark 1RM Card ── */}
        <View
          style={{
            backgroundColor: DARK_CARD,
            borderRadius: 20,
            padding: 24,
            marginBottom: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: 'rgba(255,250,246,0.55)',
              letterSpacing: 0.08,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            1RM ESTIMÉ
          </Text>
          <Text
            style={{
              fontSize: 56,
              fontWeight: '900',
              color: PRIMARY,
              textAlign: 'center',
              lineHeight: 64,
            }}
          >
            {weight > 0 ? oneRM.toFixed(1) : '—'}
            {weight > 0 ? (
              <Text style={{ fontSize: 24, fontWeight: '700', color: 'rgba(255,250,246,0.7)' }}> kg</Text>
            ) : null}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              marginTop: 8,
            }}
          >
            <Text
              style={{ fontSize: 12, color: 'rgba(255,250,246,0.65)' }}
            >
              {rir} rep(s) en réserve
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.4)' }}>·</Text>
            <Text
              style={{ fontSize: 12, color: 'rgba(255,250,246,0.65)' }}
            >
              {pct}% du 1RM
            </Text>
          </View>
        </View>

        {/* ── Input: Weight ── */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="barbell-outline" size={20} color={PRIMARY} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600', marginBottom: 4 }}>
                Charge (kg)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => adjustWeight(-2.5)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>−</Text>
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.text,
                    minWidth: 70,
                    textAlign: 'center',
                  }}
                >
                  {weight}
                </Text>
                <TouchableOpacity
                  onPress={() => adjustWeight(2.5)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── Input: Reps ── */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Ionicons name="repeat-outline" size={20} color={PRIMARY} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600', marginBottom: 4 }}>
                Répétitions
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => adjustReps(-1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>−</Text>
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.text,
                    minWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  {reps}
                </Text>
                <TouchableOpacity
                  onPress={() => adjustReps(1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
              {/* Reps Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {REPS_CHIPS.map((r) => {
                    const active = r === reps;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setReps(r)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: active ? PRIMARY : 'rgba(255,92,26,0.1)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: active ? '#fff' : PRIMARY,
                          }}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ── Input: RPE ── */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Ionicons name="flame-outline" size={20} color={currentColor} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600', marginBottom: 4 }}>
                RPE (effort perçu)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => adjustRpe(-0.5)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>−</Text>
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: currentColor,
                    minWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  {rpe}
                </Text>
                <TouchableOpacity
                  onPress={() => adjustRpe(0.5)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,92,26,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, color: PRIMARY, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
              {/* RPE Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {RPE_CHIPS.map((r) => {
                    const active = r === rpe;
                    const c = rpeColor(r);
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setRpe(r)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: active ? c : `${c}1A`,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: active ? '#fff' : c,
                          }}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ── Training Zones Table ── */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.text,
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          Zones d'entraînement
        </Text>

        {TRAINING_ZONES.map((zone) => {
          const currentPct = pct / 100;
          const isCurrentZone = currentPct >= zone.pct - 0.025 && currentPct <= zone.pct + 0.025;
          return (
            <View
              key={zone.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isCurrentZone ? PRIMARY : theme.border,
                padding: 10,
                marginBottom: 6,
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isCurrentZone ? PRIMARY : theme.border,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: '700',
                  color: isCurrentZone ? PRIMARY : theme.text,
                }}
              >
                {zone.label}
              </Text>
              <Text style={{ fontSize: 11, color: theme.muted }}>
                {(oneRM * zone.pct).toFixed(1)} kg
              </Text>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

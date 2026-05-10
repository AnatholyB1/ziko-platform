import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';

const RANGES = [
  { id: '1m', label: '1M', count: 8 },
  { id: '3m', label: '3M', count: 24 },
  { id: '6m', label: '6M', count: 48 },
  { id: '1a', label: '1A', count: 96 },
  { id: 'all', label: 'Tout', count: 144 },
];

const MOCK_HISTORY = [
  { date: '12 nov 2025', weight: '175 kg', reps: '1×1', pr: true },
  { date: '28 oct 2025', weight: '170 kg', reps: '1×1', pr: true },
  { date: '10 oct 2025', weight: '165 kg', reps: '1×3', pr: false },
  { date: '22 sep 2025', weight: '160 kg', reps: '1×1', pr: true },
  { date: '8 sep 2025', weight: '155 kg', reps: '3×3', pr: false },
  { date: '15 août 2025', weight: '150 kg', reps: '1×1', pr: true },
];

const STATS = [
  { label: 'Volume total', value: '84,2 t', sub: 'Sur 6 mois', icon: 'barbell-outline' as const, color: '#FF5C1A' },
  { label: 'Séances', value: '47', sub: 'Sur 6 mois', icon: 'calendar-outline' as const, color: '#2E7BF6' },
  { label: 'Progression', value: '+25 %', sub: 'vs il y a 6m', icon: 'trending-up-outline' as const, color: '#2E9E5B' },
  { label: '1RM estimé', value: '182 kg', sub: 'Epley · RPE', icon: 'flash-outline' as const, color: '#E8A33A' },
];

function generateData(count: number): number[] {
  const start = 140;
  const end = 175;
  return Array.from({ length: count }).map((_, i) => {
    const t = i / (count - 1);
    const noise = Math.sin(i * 0.7) * 2 + Math.cos(i * 1.3) * 1.5;
    return Math.round(start + (end - start) * Math.pow(t, 1.1) + noise);
  });
}

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 100;

function MiniChart({ data, primaryColor }: { data: number[]; primaryColor: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
      {/* Y gridlines */}
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (i / 3) * CHART_HEIGHT,
            height: 1,
            backgroundColor: '#E2E0DA',
            opacity: 0.5,
          }}
        />
      ))}

      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 1 }}>
        {data.map((v, i) => {
          const barH = ((v - min) / range) * (CHART_HEIGHT - 8) + 4;
          const isLast = i === data.length - 1;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: barH,
                backgroundColor: isLast ? primaryColor : `${primaryColor}44`,
                borderRadius: 2,
              }}
            />
          );
        })}
      </View>

      {/* Min / Max labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{min} kg</Text>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{max} kg</Text>
      </View>
    </View>
  );
}

export default function LiftDetailScreen() {
  const { lift } = useLocalSearchParams<{ lift: string }>();
  const theme = useThemeStore((s) => s.theme);
  const [range, setRange] = useState('3m');

  const exerciseName = lift ?? 'Soulevé de terre';

  const data = useMemo(() => {
    const r = RANGES.find((r) => r.id === range) ?? RANGES[1];
    return generateData(r.count);
  }, [range]);

  const currentPR = data[data.length - 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: `${theme.text}0F`,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Dos · Bilatéral
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>
            {exerciseName}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* PR Hero card */}
        <View style={{
          backgroundColor: '#1C1A17',
          borderRadius: 16, padding: 18, marginBottom: 14, overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: 70,
            backgroundColor: `${theme.primary}55`,
            opacity: 0.6,
          }} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
            Record actuel
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: '#FFFAF6', lineHeight: 48 }}>
              {currentPR}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'rgba(255,250,246,0.7)' }}>kg</Text>
            <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: `${theme.success}44` }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.success }}>+5 kg</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.6)' }}>5 × 1 · RPE 9 · il y a 3 jours</Text>
        </View>

        {/* Range selector */}
        <View style={{
          flexDirection: 'row', gap: 4, padding: 4, marginBottom: 14,
          backgroundColor: `${theme.text}0D`, borderRadius: 10,
        }}>
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setRange(r.id)}
                style={{
                  flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center',
                  backgroundColor: active ? theme.surface : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11.5, fontWeight: '700',
                  color: active ? theme.text : theme.muted,
                }}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Chart card */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: theme.border, marginBottom: 14,
        }}>
          <MiniChart data={data} primaryColor={theme.primary} />
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {STATS.map((s, i) => (
            <View key={i} style={{
              width: '47.5%', backgroundColor: theme.surface, borderRadius: 14,
              borderWidth: 1, borderColor: theme.border, padding: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: `${s.color}22`, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={s.icon} size={14} color={s.color} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>
                  {s.label}
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, lineHeight: 20 }}>
                {s.value}
              </Text>
              <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* PR History */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
        }}>
          Records personnels
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {MOCK_HISTORY.map((h, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border, gap: 10,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                  {h.weight}{' '}
                  <Text style={{ color: theme.muted, fontWeight: '600' }}>· {h.reps}</Text>
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 2 }}>{h.date}</Text>
              </View>
              {h.pr && (
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: `${theme.primary}22`,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    PR
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

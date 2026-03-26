import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { calc1RM, rpeToPercent, rpeToRIR, RPE_VALUES, TRAINING_ZONES } from '../index';

const REPS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function rpeColor(rpe: number): string {
  if (rpe <= 6) return '#4CAF50';
  if (rpe <= 8) return '#FF9800';
  return '#F44336';
}

function rpeLabel(rpe: number): string {
  if (rpe <= 5) return 'Très facile';
  if (rpe <= 6) return 'Modéré';
  if (rpe <= 7) return 'Difficile';
  if (rpe <= 8) return 'Très difficile';
  if (rpe <= 9) return 'Effort maximum';
  return 'Limite absolue';
}

function roundToNearest(val: number, step: number): string {
  return (Math.round(val / step) * step).toFixed(step < 1 ? 1 : 0);
}

export default function RPECalculatorScreen({ showBack = true }: { showBack?: boolean }) {
  const theme = useThemeStore((s) => s.theme);

  const [weight, setWeight] = useState(100);
  const [weightText, setWeightText] = useState('100');
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(8);

  const parsedWeight = parseFloat(weightText) || 0;
  const oneRM = parsedWeight > 0 ? calc1RM(parsedWeight, reps, rpe) : 0;
  const pctUsed = rpeToPercent(reps, rpe);
  const rir = rpeToRIR(rpe);
  const color = rpeColor(rpe);

  const adjustWeight = (delta: number) => {
    const next = Math.max(0, parseFloat(weightText || '0') + delta);
    const rounded = parseFloat(next.toFixed(1));
    setWeightText(String(rounded));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          {showBack && (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 24 }}>Calculateur RPE</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>1RM estimé selon l'effort perçu</Text>
          </View>
        </View>

        {/* Weight input */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
            Charge (kg)
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={weightText}
              onChangeText={(v) => setWeightText(v.replace(',', '.'))}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: theme.surface, borderRadius: 14, borderWidth: 2,
                borderColor: theme.primary, padding: 14, color: theme.text,
                fontWeight: '800', fontSize: 28, width: 110, textAlign: 'center',
              }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[-5, -2.5, -1].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => adjustWeight(d)}
                    style={{
                      flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 8,
                      alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 13 }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[+1, +2.5, +5].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => adjustWeight(d)}
                    style={{
                      flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 8,
                      alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 13 }}>+{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Reps selector */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
            Répétitions effectuées
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {REPS_OPTIONS.map((r) => {
                const selected = r === reps;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReps(r)}
                    style={{
                      width: 48, height: 48, borderRadius: 14,
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderWidth: 2, borderColor: selected ? theme.primary : theme.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      color: selected ? '#fff' : theme.text,
                      fontWeight: '800', fontSize: 16,
                    }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* RPE selector */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
            RPE (effort perçu)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RPE_VALUES.map((r) => {
                const selected = r === rpe;
                const c = rpeColor(r);
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRpe(r)}
                    style={{
                      minWidth: 54, paddingHorizontal: 10, height: 54, borderRadius: 14,
                      backgroundColor: selected ? c : theme.surface,
                      borderWidth: 2, borderColor: selected ? c : theme.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      color: selected ? '#fff' : c,
                      fontWeight: '800', fontSize: 16,
                    }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: color, fontWeight: '600', fontSize: 13 }}>
              RPE {rpe} · {rpeLabel(rpe)} · {rir === 0 ? 'Aucune rép en réserve' : `${rir} rép${rir > 1 ? 's' : ''} en réserve`}
            </Text>
          </View>
        </View>

        {/* 1RM Result */}
        {parsedWeight > 0 ? (
          <View style={{
            backgroundColor: color + '12',
            borderRadius: 20, padding: 24, marginBottom: 24,
            borderWidth: 2, borderColor: color + '40',
            alignItems: 'center',
          }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              1RM ESTIMÉ
            </Text>
            <Text style={{ color: color, fontSize: 64, fontWeight: '900', letterSpacing: -2 }}>
              {oneRM}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 18, fontWeight: '700', marginTop: -4 }}>kg</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{pctUsed}%</Text>
                <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>de ton 1RM</Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{reps} × {parsedWeight} kg</Text>
                <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>@ RPE {rpe}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 20, padding: 24, marginBottom: 24,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.muted, fontSize: 15 }}>Entre ta charge pour calculer</Text>
          </View>
        )}

        {/* Training zones table */}
        {oneRM > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Zones d'entraînement
            </Text>
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16,
              borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.background }}>
                <Text style={{ flex: 1, color: theme.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>%</Text>
                <Text style={{ flex: 1, color: theme.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' }}>Charge</Text>
                <Text style={{ flex: 2, color: theme.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Barres standard</Text>
              </View>
              {TRAINING_ZONES.map(({ label, pct }, i) => {
                const kg = oneRM * pct;
                const isHighlight = pct === 0.8 || pct === 0.85 || pct === 0.9;
                return (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: i < TRAINING_ZONES.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                      backgroundColor: isHighlight ? theme.primary + '08' : 'transparent',
                    }}
                  >
                    <Text style={{ flex: 1, color: isHighlight ? theme.primary : theme.muted, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                    <Text style={{ flex: 1, color: theme.text, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
                      {kg.toFixed(1)} kg
                    </Text>
                    <Text style={{ flex: 2, color: theme.muted, fontSize: 12, textAlign: 'right' }}>
                      {roundToNearest(kg, 2.5)} kg arrondi
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* RPE scale legend */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>Échelle RPE</Text>
          {[
            { range: '5–6', label: 'Modéré · beaucoup de rép en réserve', color: '#4CAF50' },
            { range: '7', label: 'Difficile · 3 rép en réserve', color: '#8BC34A' },
            { range: '8', label: 'Très difficile · 2 rép en réserve', color: '#FF9800' },
            { range: '9', label: 'Maximum · 1 rép en réserve', color: '#FF5722' },
            { range: '10', label: 'Limite absolue · 0 rép en réserve', color: '#F44336' },
          ].map(({ range, label, color: c }) => (
            <View key={range} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 24, borderRadius: 6, backgroundColor: c + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c, fontWeight: '800', fontSize: 12 }}>{range}</Text>
              </View>
              <Text style={{ color: theme.muted, fontSize: 13, flex: 1 }}>{label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

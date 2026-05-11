import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface Answers {
  energy: number;
  duration: 30 | 45 | 60 | 90;
  focus: 'haut' | 'bas' | 'full';
  equipment: 'salle' | 'maison' | 'rien';
}

const FOCUS_OPTIONS: Array<{ id: Answers['focus']; label: string; icon: string }> = [
  { id: 'haut', label: 'Haut du corps', icon: 'body-outline' },
  { id: 'bas', label: 'Bas du corps', icon: 'walk-outline' },
  { id: 'full', label: 'Full body', icon: 'fitness-outline' },
];

const EQUIP_OPTIONS: Array<{ id: Answers['equipment']; label: string; icon: string }> = [
  { id: 'salle', label: 'Salle complète', icon: 'barbell-outline' },
  { id: 'maison', label: 'Maison / haltères', icon: 'home-outline' },
  { id: 'rien', label: 'Sans matériel', icon: 'body-outline' },
];

const DURATIONS: Array<30 | 45 | 60 | 90> = [30, 45, 60, 90];

export default function AIGenerateScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>({ energy: 7, duration: 45, focus: 'haut', equipment: 'salle' });

  const next = () => {
    if (step === 3) {
      setStep(4);
      setTimeout(() => setStep(5), 2000);
    } else {
      setStep((s) => (s + 1) as Step);
    }
  };

  if (step === 4) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          Coach IA travaille…
        </Text>
        <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center', lineHeight: 18 }}>
          On adapte la séance à ton énergie ({answers.energy}/10),{'\n'}ton historique et le matériel dispo.
        </Text>
      </View>
    );
  }

  if (step === 5) {
    const exos = [
      { name: 'Développé incliné haltères', sets: '3 × 8-10', note: `charge légère vu énergie ${answers.energy}/10` },
      { name: 'Développé couché barre', sets: '4 × 6-8' },
      { name: 'Écarté machine', sets: '3 × 12' },
      { name: 'Dips lestés', sets: '3 × 8' },
      { name: 'Extensions triceps poulie', sets: '3 × 12' },
    ];
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => setStep(0)} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Ta séance générée</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>~{answers.duration} min · adapté à toi</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
          <View style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 14,
            flexDirection: 'row', gap: 10,
            borderWidth: 1, borderColor: theme.primary + '22', marginBottom: 12,
          }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={15} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
                Adaptations IA
              </Text>
              <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                Ton énergie est {answers.energy >= 8 ? 'bonne' : 'moyenne'} ({answers.energy}/10) → charge{' '}
                {answers.energy >= 8 ? 'standard' : 'allégée'} sur le 1er exo.
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            {exos.length} exercices
          </Text>
          {exos.map((ex, i) => (
            <View key={i} style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
            }}>
              <View style={{
                width: 26, height: 26, borderRadius: 8,
                backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{ex.name}</Text>
                <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>
                  {ex.sets}{ex.note ? ` · ${ex.note}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/workout/session')}
            style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Démarrer cette séance</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stepTitles = ['Ton énergie du jour', 'Durée souhaitée', 'Zone de travail', 'Équipement disponible'];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12 }}>
        <TouchableOpacity onPress={step === 0 ? () => router.back() : () => setStep((s) => (s - 1) as Step)} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Générer avec IA</Text>
      </View>

      <View style={{ marginHorizontal: 18, height: 4, backgroundColor: theme.border, borderRadius: 2, marginBottom: 24 }}>
        <View style={{ width: `${((step + 1) / 4) * 100}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 2 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{stepTitles[step]}</Text>

        {step === 0 && (
          <View>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 24 }}>Sur 10, comment te sens-tu aujourd'hui ?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setAnswers((a) => ({ ...a, energy: n }))}
                  style={{
                    width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: answers.energy === n ? theme.primary : theme.surface,
                    borderWidth: 1, borderColor: answers.energy === n ? theme.primary : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '700', color: answers.energy === n ? '#fff' : theme.text }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setAnswers((a) => ({ ...a, duration: d }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
                  backgroundColor: answers.duration === d ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.duration === d ? theme.primary : theme.border,
                }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{d} minutes</Text>
                {answers.duration === d && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {FOCUS_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setAnswers((a) => ({ ...a, focus: f.id }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: answers.focus === f.id ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.focus === f.id ? theme.primary : theme.border,
                }}
              >
                <Ionicons name={f.icon as any} size={20} color={answers.focus === f.id ? theme.primary : theme.muted} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{f.label}</Text>
                {answers.focus === f.id && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {EQUIP_OPTIONS.map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => setAnswers((a) => ({ ...a, equipment: e.id }))}
                style={{
                  padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: answers.equipment === e.id ? theme.primary + '10' : theme.surface,
                  borderWidth: 1, borderColor: answers.equipment === e.id ? theme.primary : theme.border,
                }}
              >
                <Ionicons name={e.icon as any} size={20} color={answers.equipment === e.id ? theme.primary : theme.muted} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text }}>{e.label}</Text>
                {answers.equipment === e.id && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 }}>
        <TouchableOpacity
          onPress={next}
          style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {step === 3 ? 'Générer ma séance' : 'Suivant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

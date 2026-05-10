import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rpe: number;
}

interface ProgramDay {
  name: string;
  color: string;
  exercises: Exercise[];
}

interface ProgramMeta {
  name: string;
  weeks: number;
  freq: number;
}

const DEFAULT_DAYS: ProgramDay[] = [
  {
    name: 'Push', color: '#FF5C1A',
    exercises: [
      { name: 'Développé couché', sets: 4, reps: '6-8', rpe: 8 },
      { name: 'Développé incliné haltères', sets: 3, reps: '8-10', rpe: 7 },
      { name: 'Dips lestés', sets: 3, reps: '8', rpe: 8 },
      { name: 'Élévations latérales', sets: 4, reps: '12-15', rpe: 7 },
    ],
  },
  {
    name: 'Pull', color: '#2E7BF6',
    exercises: [
      { name: 'Soulevé de terre', sets: 4, reps: '5', rpe: 8 },
      { name: 'Tractions lestées', sets: 4, reps: '6-8', rpe: 8 },
      { name: 'Rowing barre', sets: 3, reps: '8-10', rpe: 7 },
    ],
  },
  {
    name: 'Legs', color: '#2E9E5B',
    exercises: [
      { name: 'Squat barre', sets: 4, reps: '6-8', rpe: 8 },
      { name: 'Presse à cuisses', sets: 3, reps: '10-12', rpe: 7 },
    ],
  },
  { name: 'Repos', color: '#6B6963', exercises: [] },
];

const STEP_LABELS = ['Bases', 'Jours', 'Exercices', 'Récap'];

export default function ProgramBuilderScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState<ProgramMeta>({ name: 'Push Pull Legs Custom', weeks: 8, freq: 4 });
  const [days, setDays] = useState<ProgramDay[]>(DEFAULT_DAYS);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const totalSets = days.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.sets, 0), 0);
  const totalExercises = days.reduce((a, d) => a + d.exercises.length, 0);

  const updateDayName = (index: number, name: string) => {
    setDays((prev) => prev.map((d, i) => i === index ? { ...d, name } : d));
  };

  const addDay = () => {
    setDays((prev) => [...prev, { name: `Jour ${prev.length + 1}`, color: '#6B6963', exercises: [] }]);
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const programData = {
        name: meta.name,
        weeks: meta.weeks,
        frequency: meta.freq,
        days: days.map((d) => ({
          name: d.name,
          exercises: d.exercises,
        })),
      };

      const { error } = await supabase
        .from('ai_generated_programs')
        .insert({
          user_id: user.id,
          goal: 'custom',
          split: meta.name,
          program_data: programData,
        });

      if (error) throw error;

      showAlert('Programme créé', `"${meta.name}" a été enregistré avec succès.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la création';
      showAlert('Erreur', msg);
    } finally {
      setIsSaving(false);
    }
  };

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
            Étape {step + 1}/4 — {STEP_LABELS[step]}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>
            Nouveau programme
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingBottom: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 999,
              backgroundColor: i <= step ? theme.primary : `${theme.text}14`,
            }}
          />
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>

        {/* STEP 0 — Meta */}
        {step === 0 && (
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
              D'abord, les bases.
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
              Donne un nom à ton programme et choisis la fréquence.
            </Text>

            <Text style={{
              fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
              textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
            }}>
              Nom
            </Text>
            <TextInput
              value={meta.name}
              onChangeText={(t) => setMeta((m) => ({ ...m, name: t }))}
              style={{
                fontSize: 16, fontWeight: '700', color: theme.text,
                backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                borderWidth: 1.5, borderColor: theme.border, marginBottom: 20,
              }}
            />

            <Text style={{
              fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
              textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
            }}>
              Durée (semaines)
            </Text>
            <View style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: theme.border, marginBottom: 20,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
                <Text style={{ fontSize: 36, fontWeight: '800', color: theme.text }}>{meta.weeks}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>semaines</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => setMeta((m) => ({ ...m, weeks: Math.max(2, m.weeks - 1) }))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${theme.text}0F`, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="remove" size={22} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, height: 4, backgroundColor: `${theme.text}11`, borderRadius: 2 }}>
                  <View style={{
                    width: `${((meta.weeks - 2) / 14) * 100}%`,
                    height: '100%', backgroundColor: theme.primary, borderRadius: 2,
                  }} />
                </View>
                <TouchableOpacity
                  onPress={() => setMeta((m) => ({ ...m, weeks: Math.min(16, m.weeks + 1) }))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="add" size={22} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{
              fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
              textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
            }}>
              Séances par semaine
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[2, 3, 4, 5, 6, 7].map((n) => {
                const selected = meta.freq === n;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setMeta((m) => ({ ...m, freq: n }))}
                    style={{
                      flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderWidth: 1, borderColor: selected ? theme.primary : theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '800', color: selected ? '#fff' : theme.text }}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 1 — Days */}
        {step === 1 && (
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
              Structure les jours.
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
              Nomme chaque jour. Tu pourras y ajouter des exercices ensuite.
            </Text>
            <View style={{ gap: 8 }}>
              {days.map((d, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: theme.surface, borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: theme.border,
                }}>
                  <View style={{
                    width: 34, height: 34, borderRadius: 10,
                    backgroundColor: `${d.color}22`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: d.color }}>{i + 1}</Text>
                  </View>
                  <TextInput
                    value={d.name}
                    onChangeText={(t) => updateDayName(i, t)}
                    style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.text }}
                  />
                  <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '700' }}>
                    {d.exercises.length} exo
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={addDay}
                style={{
                  padding: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                  + Ajouter un jour
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2 — Exercises */}
        {step === 2 && (
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 16 }}>
              Exercices par jour.
            </Text>

            {/* Day tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {days.map((d, i) => {
                  const active = i === selectedDay;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedDay(i)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                        backgroundColor: active ? d.color : `${theme.text}0F`,
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: '700',
                        color: active ? '#fff' : theme.text,
                      }}>
                        {d.name}
                        <Text style={{ opacity: 0.7 }}> · {d.exercises.length}</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Exercise list */}
            <View style={{ gap: 8 }}>
              {days[selectedDay]?.exercises.map((ex, i) => (
                <View key={i} style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: theme.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 8,
                      backgroundColor: `${theme.text}0D`, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="barbell-outline" size={14} color={theme.muted} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: theme.text }}>
                      {ex.name}
                    </Text>
                    <Ionicons name="ellipsis-horizontal" size={16} color={theme.muted} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[
                      { label: 'Sets', value: String(ex.sets) },
                      { label: 'Reps', value: ex.reps },
                      { label: 'RPE', value: String(ex.rpe) },
                    ].map((f, j) => (
                      <View key={j} style={{
                        flex: 1, backgroundColor: `${theme.text}06`,
                        borderRadius: 8, paddingVertical: 8, alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 9, color: theme.muted, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                          {f.label}
                        </Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 2 }}>
                          {f.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {days[selectedDay]?.exercises.length === 0 && (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Ionicons name="moon-outline" size={28} color={theme.muted} />
                  <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>
                    Jour de repos. Aucun exercice.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => showAlert('Bientôt disponible', 'L\'ajout d\'exercice sera disponible prochainement.')}
                style={{
                  padding: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                  + Ajouter un exercice
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3 — Recap */}
        {step === 3 && (
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
              Tout est prêt.
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20, lineHeight: 20 }}>
              Vérifie le récap puis enregistre. Tu pourras modifier plus tard.
            </Text>

            {/* Hero card */}
            <View style={{
              backgroundColor: '#1C1A17', borderRadius: 16, padding: 20, marginBottom: 16,
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: 65,
                backgroundColor: `${theme.primary}55`, opacity: 0.6,
              }} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFAF6', lineHeight: 26 }}>
                {meta.name}
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.7)', marginTop: 4 }}>
                {meta.weeks} semaines · {meta.freq} séances/sem
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                {days.map((d, i) => (
                  <View key={i} style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                    backgroundColor: d.color === '#6B6963' ? 'rgba(255,250,246,0.1)' : `${d.color}55`,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{d.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Stats rows */}
            <View style={{
              backgroundColor: theme.surface, borderRadius: 14,
              borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
            }}>
              {[
                { label: 'Volume hebdo estimé', value: `${totalSets} sets` },
                { label: 'Exercices uniques', value: String(totalExercises) },
                { label: 'Durée moyenne', value: '55-65 min' },
                { label: 'Niveau requis', value: 'Intermédiaire' },
              ].map((r, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                }}>
                  <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{r.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24,
        borderTopWidth: 1, borderTopColor: theme.border,
        backgroundColor: theme.background,
        flexDirection: 'row', gap: 10,
      }}>
        {step > 0 && (
          <TouchableOpacity
            onPress={() => setStep((s) => s - 1)}
            style={{
              paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
              backgroundColor: `${theme.text}0F`,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => step < 3 ? setStep((s) => s + 1) : handleFinish()}
          disabled={isSaving}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14,
            backgroundColor: theme.text, alignItems: 'center',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
            {isSaving ? 'Création…' : step < 3 ? 'Continuer' : 'Créer le programme'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

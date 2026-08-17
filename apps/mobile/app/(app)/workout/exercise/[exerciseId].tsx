import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeStore } from '@ziko/plugin-sdk';
import { showAlert } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { AttributedMedia, EmptyState } from '@ziko/ui';
import { supabase } from '../../../../src/lib/supabase';
import WSHeader from '../../../../src/components/WSHeader';
import ExercisePicker from '../../../../src/components/ExercisePicker';

type InstructionSteps = { en?: string[]; fr?: string[] };

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const theme = useThemeStore((s) => s.theme);
  const { t, tExercise, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch exercise metadata
  const {
    data: exercise,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['exercises', 'v2', exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!exerciseId,
  });

  const publicGifUrl = exercise?.gif
    ? supabase.storage.from('exercise-media').getPublicUrl(exercise.gif).data.publicUrl
    : null;

  // Fetch user session for userId
  const { data: sessionData } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const userId = sessionData?.user?.id;

  // Fetch exercise history
  const { data: history = [] } = useQuery({
    queryKey: ['exercise-history', exerciseId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_sets')
        .select('*, workout_sessions!inner(started_at, user_id)')
        .eq('exercise_id', exerciseId)
        .eq('workout_sessions.user_id', userId)
        .eq('completed', true)
        .order('workout_sessions.started_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!exerciseId && !!userId,
  });

  // Compute stats from history
  const maxWeight = history.length > 0
    ? Math.max(...history.map((s: any) => s.weight_kg ?? 0))
    : 0;

  const sessionIds = [...new Set(history.map((s: any) => s.workout_sessions?.started_at?.slice(0, 10)))];
  const sessionCount = sessionIds.length;

  // Compute trend: compare volume of last 2 sessions
  const last5 = history.slice(0, 5);
  let trendPct: number | null = null;
  if (last5.length >= 2) {
    const latestVol = (last5[0] as any).weight_kg ?? 0;
    const prevVol = (last5[1] as any).weight_kg ?? 0;
    if (prevVol > 0) {
      trendPct = Math.round(((latestVol - prevVol) / prevVol) * 100);
    }
  }

  // Group history by session for bar chart (last 5 sessions)
  type SessionGroup = { date: string; volume: number; best: string };
  const sessionGroups: SessionGroup[] = [];
  const seenDates = new Set<string>();
  for (const set of history) {
    const dateKey = (set as any).workout_sessions?.started_at?.slice(0, 10);
    if (!dateKey || seenDates.has(dateKey)) continue;
    seenDates.add(dateKey);
    const setsForSession = history.filter(
      (s: any) => s.workout_sessions?.started_at?.slice(0, 10) === dateKey,
    );
    const totalVol = setsForSession.reduce(
      (acc: number, s: any) => acc + (s.weight_kg ?? 0) * (s.reps ?? 1),
      0,
    );
    const bestSet = setsForSession.reduce((best: any, s: any) =>
      (s.weight_kg ?? 0) > (best?.weight_kg ?? 0) ? s : best,
      null,
    );
    const relativeDate = formatDistanceToNow(new Date(dateKey), { locale: fr, addSuffix: true });
    sessionGroups.push({
      date: `il y a ${relativeDate.replace('il y a ', '')}`,
      volume: totalVol,
      best: bestSet ? `${bestSet.weight_kg} kg × ${bestSet.reps}` : '—',
    });
    if (sessionGroups.length >= 5) break;
  }

  const maxVol = sessionGroups.length > 0
    ? Math.max(...sessionGroups.map((g) => g.volume))
    : 1;

  // Structured instructions — direct JSONB read, locale-aware (MOBILE-04/05)
  const instructionSteps = exercise?.instruction_steps as InstructionSteps | null | undefined;
  const steps: string[] = instructionSteps?.[locale] ?? instructionSteps?.en ?? [];

  const legacyInstructions: string =
    (locale === 'fr'
      ? exercise?.instructions_fr ?? exercise?.instructions
      : exercise?.instructions ?? exercise?.instructions_fr
    )?.trim() ?? '';

  const secondaryMuscles: string[] = Array.isArray(exercise?.muscle_groups)
    ? exercise.muscle_groups
    : [];

  const TABS = ['Consignes', 'Muscles', 'Historique'];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <WSHeader title="Exercice" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </View>
    );
  }

  if (isError || !exercise) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <WSHeader title="Exercice" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: theme.text, fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
            Impossible de charger les données. Réessaie.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <WSHeader
        title={exercise ? tExercise(exercise.name, exercise.name_fr) : 'Exercice'}
        sub={`${exercise?.target_muscle ?? ''} · ${exercise?.difficulty ?? ''}`}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
        >
          {/* Hero media card — attributed square GIF */}
          <View
            style={{
              borderRadius: 14,
              aspectRatio: 1,
              overflow: 'hidden',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: theme.text,
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AttributedMedia uri={publicGifUrl} showBadge />
          </View>

          {/* 3 Stat tiles */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {/* Record */}
            <View
              style={{
                flex: 1,
                borderRadius: 14,
                padding: 12,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: theme.text,
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Record
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, lineHeight: 16 }}>
                  {maxWeight > 0 ? maxWeight : '—'}
                </Text>
                {maxWeight > 0 && (
                  <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '500', marginLeft: 1 }}>
                    kg
                  </Text>
                )}
              </View>
            </View>

            {/* Séances */}
            <View
              style={{
                flex: 1,
                borderRadius: 14,
                padding: 12,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: theme.text,
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Séances
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, lineHeight: 16, marginTop: 4 }}>
                {sessionCount}
              </Text>
            </View>

            {/* Tendance */}
            <View
              style={{
                flex: 1,
                borderRadius: 14,
                padding: 12,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: theme.text,
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Tendance
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  lineHeight: 16,
                  marginTop: 4,
                  color: trendPct !== null && trendPct > 0
                    ? '#4CAF50'
                    : trendPct !== null && trendPct < 0
                    ? '#E53E3E'
                    : theme.text,
                }}
              >
                {trendPct !== null
                  ? `${trendPct > 0 ? '↑' : '↓'} ${Math.abs(trendPct)}%`
                  : '—'}
              </Text>
            </View>
          </View>

          {/* SubTabs */}
          <View
            style={{
              marginTop: 16,
              flexDirection: 'row',
              gap: 4,
              padding: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(28,26,23,0.05)',
            }}
          >
            {TABS.map((tab, index) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(index)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 999,
                  backgroundColor: activeTab === index ? theme.surface : 'transparent',
                  alignItems: 'center',
                  shadowColor: activeTab === index ? '#000' : 'transparent',
                  shadowOpacity: activeTab === index ? 0.08 : 0,
                  shadowRadius: 3,
                  elevation: activeTab === index ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: activeTab === index ? theme.text : theme.muted,
                  }}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={{ marginTop: 14 }}>
            {/* Consignes tab */}
            {activeTab === 0 && (
              <View
                style={{
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  shadowColor: theme.text,
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#FF5C1A',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 10,
                  }}
                >
                  Points clés d'exécution
                </Text>
                {steps.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {steps.map((step, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            backgroundColor: 'rgba(255,92,26,0.14)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FF5C1A' }}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, lineHeight: 18, flex: 1, color: theme.text }}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : legacyInstructions ? (
                  <Text style={{ fontSize: 12, lineHeight: 18, color: theme.text }}>
                    {legacyInstructions}
                  </Text>
                ) : (
                  <EmptyState
                    variant="no-data"
                    title={t('exercise.instructionsEmptyTitle')}
                    message={t('exercise.instructionsEmptyBody')}
                  />
                )}

                {/* AISuggestion block */}
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 10,
                    padding: 10,
                    backgroundColor: 'rgba(255,92,26,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,92,26,0.22)',
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <Ionicons name="sparkles" size={14} color="#FF5C1A" />
                  <Text style={{ fontSize: 12, lineHeight: 16, flex: 1, color: theme.text }}>
                    <Text style={{ fontWeight: '700' }}>Coach IA : </Text>
                    sur ta dernière séance tu cassais la cambrure sur les dernières reps. Pense à garder la poitrine sortie.
                  </Text>
                </View>
              </View>
            )}

            {/* Muscles tab */}
            {activeTab === 1 && (
              <View
                style={{
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  shadowColor: theme.text,
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 10,
                  }}
                >
                  Muscles travaillés
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {exercise?.target_muscle && (
                    <View
                      style={{
                        backgroundColor: '#FF5C1A',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                        {exercise.target_muscle} · primaire
                      </Text>
                    </View>
                  )}
                  {secondaryMuscles.map((muscle) => (
                    <View
                      key={muscle}
                      style={{
                        backgroundColor: 'rgba(255,92,26,0.12)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF5C1A' }}>
                        {muscle}
                      </Text>
                    </View>
                  ))}
                </View>

                {exercise?.equipment && (
                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: theme.muted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 8,
                      }}
                    >
                      Matériel
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                      {exercise.equipment}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Historique tab */}
            {activeTab === 2 && (
              <View
                style={{
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  shadowColor: theme.text,
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 12,
                  }}
                >
                  5 dernières séances
                </Text>

                {/* Mini bar chart — oldest left → newest right */}
                {sessionGroups.length > 0 ? (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                        height: 70,
                        marginBottom: 10,
                      }}
                    >
                      {[...sessionGroups].reverse().map((group, i) => {
                        const heightPct = maxVol > 0 ? (group.volume / maxVol) : 0;
                        const isNewest = i === sessionGroups.length - 1;
                        return (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              height: Math.max(4, heightPct * 70),
                              borderRadius: 4,
                              backgroundColor: isNewest
                                ? '#FF5C1A'
                                : 'rgba(255,92,26,0.30)',
                            }}
                          />
                        );
                      })}
                    </View>

                    {/* Session rows */}
                    <View style={{ gap: 0 }}>
                      {sessionGroups.map((group, i) => (
                        <View
                          key={i}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 6,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: theme.border,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>
                              {group.date}
                            </Text>
                            <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>
                              Meilleure : {group.best}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                            {group.volume > 0 ? `${(group.volume / 1000).toFixed(2)}t` : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center' }}>
                      Aucun historique disponible pour cet exercice.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={{ gap: 8, marginTop: 14 }}>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.text,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFAF6', fontSize: 13, fontWeight: '700' }}>
                Ajouter à ma séance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                showAlert(
                  'Substituer',
                  'La substitution en séance sera disponible dans une prochaine mise à jour.',
                )
              }
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>
                Substituer dans la séance en cours
              </Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </ScrollView>

      {/* ExercisePicker modal */}
      <ExercisePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAdd={(ids) => {
          setShowPicker(false);
          showAlert('Ajouté', `${ids.length} exercice(s) ajouté(s) à ta séance.`);
        }}
      />
    </View>
  );
}

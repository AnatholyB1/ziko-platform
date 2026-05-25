import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { MotiView } from 'moti';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../../src/lib/supabase';

export default function HistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const theme = useThemeStore((s) => s.theme);

  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      return data;
    },
    enabled: !!sessionId,
  });

  const { data: sets = [] } = useQuery({
    queryKey: ['session-sets', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_sets')
        .select('*, exercises(name, target_muscle)')
        .eq('session_id', sessionId)
        .eq('completed', true)
        .order('order_index');
      return data ?? [];
    },
    enabled: !!sessionId,
  });

  const sessionDate = session?.started_at
    ? format(new Date(session.started_at), 'EEEE d MMM yyyy', { locale: fr })
    : '';

  const duration =
    session?.duration_minutes ??
    (session?.started_at && session?.ended_at
      ? Math.round(
          (new Date(session.ended_at).getTime() -
            new Date(session.started_at).getTime()) /
            60000
        )
      : null);

  // Group sets by exercise name
  const exerciseGroups: Record<string, typeof sets> = {};
  for (const s of sets) {
    const name = s.exercises?.name ?? 'Exercice';
    if (!exerciseGroups[name]) exerciseGroups[name] = [];
    exerciseGroups[name].push(s);
  }

  const totalVolume = sets.reduce(
    (acc, s) => acc + ((s.weight_kg ?? 0) * (s.reps ?? 0)),
    0
  );

  const moreOptions = () => {
    showAlert('Options', 'Que veux-tu faire ?', [
      { text: 'Partager', onPress: () => {} },
      { text: 'Supprimer', style: 'destructive', onPress: () => {} },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: theme.background + 'F0',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: 'rgba(28,26,23,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Chargement…</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.muted, fontSize: 12 }}>Chargement de la séance…</Text>
        </View>
      </View>
    );
  }

  if (isError || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: theme.background + 'F0',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: 'rgba(28,26,23,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Séance</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
            Impossible de charger les données. Réessaie.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 12,
              backgroundColor: theme.text,
            }}
          >
            <Text style={{ color: '#FFFAF6', fontSize: 12, fontWeight: '700' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* WSHeader inline (light variant) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: theme.background + 'F0',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: 'rgba(28,26,23,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: theme.text }}>
            {session.name ?? 'Séance'}
          </Text>
          {sessionDate ? (
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{sessionDate}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={moreOptions}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            backgroundColor: 'rgba(28,26,23,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
        >
          {/* 4-up Stats Card */}
          <View
            style={{
              borderRadius: 14,
              padding: 16,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                {
                  value: duration != null ? `${duration}` : '—',
                  unit: 'min',
                  label: 'DURÉE',
                },
                {
                  value: totalVolume > 0 ? (totalVolume / 1000).toFixed(2) : '—',
                  unit: 't',
                  label: 'VOLUME',
                },
                {
                  value: `${sets.length}`,
                  unit: '',
                  label: 'SÉRIES',
                },
                {
                  value: session.avg_heart_rate != null ? `${session.avg_heart_rate}` : '—',
                  unit: session.avg_heart_rate != null ? 'bpm' : '',
                  label: 'FC MOY.',
                },
              ].map((stat) => (
                <View key={stat.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: theme.text }}>
                      {stat.value}
                    </Text>
                    {stat.unit ? (
                      <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '400', marginLeft: 1 }}>
                        {stat.unit}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: theme.muted,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginTop: 4,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Note Card (conditional) */}
          {session.notes ? (
            <View
              style={{
                borderRadius: 14,
                padding: 16,
                marginTop: 12,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                NOTE
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: theme.text }}>
                „{session.notes}"
              </Text>
            </View>
          ) : null}

          {/* Exercises section */}
          {Object.keys(exerciseGroups).length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 8,
                }}
              >
                EXERCICES
              </Text>
              <View style={{ gap: 8 }}>
                {Object.entries(exerciseGroups).map(([exerciseName, exerciseSets], exIndex) => (
                  <View
                    key={exerciseName}
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    {/* Header row */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 7,
                          backgroundColor: 'rgba(28,26,23,0.06)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text }}>
                          {exIndex + 1}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }}>
                        {exerciseName}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted }}>
                        {exerciseSets.length} séries
                      </Text>
                    </View>

                    {/* Set chips row */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {exerciseSets.map((s, j) => (
                        <View
                          key={j}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: 'rgba(28,26,23,0.05)',
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>
                            S{j + 1}
                          </Text>
                          <Text style={{ fontSize: 10, color: theme.text, fontWeight: '700' }}>
                            {s.weight_kg != null ? ` ${s.weight_kg}kg` : ''}
                            {s.reps != null ? ` × ${s.reps}` : ''}
                            {!s.weight_kg && !s.reps ? ' —' : ''}
                          </Text>
                          {s.rpe != null ? (
                            <Text
                              style={{
                                fontSize: 10,
                                color: '#FF5C1A',
                                fontWeight: '700',
                                marginLeft: 4,
                              }}
                            >
                              · {s.rpe}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={{ gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => {}}
              style={{
                backgroundColor: theme.text,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="play" size={13} color="#FFFAF6" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>
                Refaire cette séance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {}}
              style={{
                borderRadius: 14,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                Comparer avec la précédente
              </Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </ScrollView>
    </View>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { supabase } from '../../../src/lib/supabase';
import WSHeader from '../../../src/components/WSHeader';

export default function WorkoutSummaryScreen() {
  const theme = useThemeStore((s) => s.theme);
  const session = useWorkoutStore((s) => s.lastCompletedSession);
  const [notes, setNotes] = useState(() => '');
  const [isSaving, setIsSaving] = useState(false);

  if (!session) {
    router.replace('/(app)/workout/');
    return null;
  }

  // Derived values
  const durationMin = Math.round((session.durationSeconds ?? 0) / 60);
  const totalSets = session.exercises?.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;
  const totalVolume =
    session.exercises?.reduce((acc, ex) => acc + ex.totalVolume, 0) ?? 0;
  const prs = session.exercises?.filter((ex) => ex.isNewPR) ?? [];
  const avgHr: number | null = session.avgHr ?? null;
  const estimatedMaxHr: number | null = avgHr != null ? Math.round(avgHr * 1.25) : null;

  const saveNotes = async () => {
    if (!session.id || !notes) return;
    await supabase
      .from('workout_sessions')
      .update({ notes })
      .eq('id', session.id);
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      await saveNotes();
      useWorkoutStore.getState().saveSessionNotes(session.id, notes);
      useWorkoutStore.getState().clearLastCompletedSession();
    } catch (_) {
      // non-blocking
    } finally {
      setIsSaving(false);
    }
    router.replace('/(app)/(tabs)/workout' as any);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${session.highlight ?? 'Séance'}\n${durationMin} min · ${totalSets} séries · ${(totalVolume / 1000).toFixed(1)}t${prs.length ? '\n' + prs.map((p) => p.name).join(', ') + ' — nouveau record !' : ''}`,
      });
    } catch (_) {
      // user cancelled
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <WSHeader
        title="Séance terminée"
        sub="Bravo pour cette session"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 280 }}
        >
          {/* Hero dark card */}
          <View
            style={{
              borderRadius: 14,
              padding: 16,
              backgroundColor: theme.text,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Orange glow orb */}
            <View
              style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: 'rgba(255,92,26,0.28)',
              }}
            />

            {/* Highlight label row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <Ionicons name="trophy" size={14} color="#FF5C1A" />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: '#FF5C1A',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Highlight
              </Text>
            </View>

            {/* Highlight text */}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                lineHeight: 20,
                color: '#FFFAF6',
                marginBottom: 16,
              }}
            >
              {session.highlight ??
                `${durationMin} min · ${totalSets} séries complétées`}
            </Text>

            {/* 4-up stats grid */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { v: `${durationMin}`, u: 'min', l: 'DURÉE' },
                {
                  v:
                    totalVolume >= 1000
                      ? `${(totalVolume / 1000).toFixed(1)}`
                      : `${totalVolume}`,
                  u: totalVolume >= 1000 ? 't' : 'kg',
                  l: 'VOLUME',
                },
                { v: `${totalSets}`, u: '', l: 'SÉRIES' },
                {
                  v: avgHr != null ? `${avgHr}` : '—',
                  u: avgHr != null ? 'bpm' : '',
                  l: 'FC MOY.',
                },
              ].map((x) => (
                <View key={x.l} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        lineHeight: 16,
                        color: '#FFFAF6',
                      }}
                    >
                      {x.v}
                    </Text>
                    {x.u ? (
                      <Text
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,250,246,0.5)',
                          fontWeight: '400',
                          marginLeft: 1,
                        }}
                      >
                        {x.u}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,250,246,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      fontWeight: '700',
                      marginTop: 3,
                    }}
                  >
                    {x.l}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* PRs section — conditional */}
          {prs.length > 0 ? (
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
                Records battus{' '}
                <Text style={{ color: '#FF5C1A' }}>{prs.length}</Text>
              </Text>
              {prs.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                    backgroundColor: 'rgba(255,92,26,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,92,26,0.15)',
                  }}
                >
                  {/* Trophy badge */}
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      backgroundColor: '#FF5C1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#FF5C1A',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 14,
                      elevation: 6,
                    }}
                  >
                    <Ionicons name="trophy" size={20} color="#fff" />
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                      {pr.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      Nouveau record · +{pr.delta ?? '?'}kg
                    </Text>
                  </View>

                  {/* Best weight */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
                      <Text
                        style={{ fontSize: 16, fontWeight: '700', color: '#FF5C1A' }}
                      >
                        {pr.bestWeight ?? '—'}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '400' }}>
                        kg
                      </Text>
                    </View>
                    {pr.sets.length > 0 && pr.sets[0].reps != null ? (
                      <Text style={{ fontSize: 10, color: theme.muted }}>
                        ×{pr.sets[0].reps}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* HR sparkline — CONDITIONAL on avgHr !== null */}
          {avgHr !== null && (
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
                Fréquence cardiaque
              </Text>
              <View
                style={{
                  borderRadius: 14,
                  padding: 16,
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
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                        {avgHr}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted }}>moy</Text>
                      {estimatedMaxHr != null ? (
                        <Text style={{ fontSize: 10, color: theme.muted }}>
                          · {estimatedMaxHr} max
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                      Zone Z3 (cardio) majoritaire
                    </Text>
                  </View>
                </View>

                {/* Estimation FC label */}
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.muted,
                    marginBottom: 6,
                  }}
                >
                  Estimation FC
                </Text>

                {/* SVG sparkline */}
                <Svg width="100%" height={70} viewBox="0 0 280 70">
                  <Defs>
                    <SvgLinearGradient id="hrFill" x1="0" x2="0" y1="0" y2="1">
                      <Stop offset="0%" stopColor="#FF5C1A" stopOpacity={0.25} />
                      <Stop offset="100%" stopColor="#FF5C1A" stopOpacity={0} />
                    </SvgLinearGradient>
                  </Defs>
                  {/* Filled area */}
                  <Path
                    d="M0,55 Q15,38 30,40 T60,32 Q75,20 90,28 T120,22 Q135,15 150,25 T180,32 Q200,28 215,20 T245,18 Q260,22 280,30 L280,70 L0,70 Z"
                    fill="url(#hrFill)"
                  />
                  {/* Stroke line */}
                  <Path
                    d="M0,55 Q15,38 30,40 T60,32 Q75,20 90,28 T120,22 Q135,15 150,25 T180,32 Q200,28 215,20 T245,18 Q260,22 280,30"
                    stroke="#FF5C1A"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            </View>
          )}

          {/* Per-exercise breakdown */}
          {session.exercises && session.exercises.length > 0 ? (
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
                Détail par exercice
              </Text>
              {session.exercises.map((ex) => (
                <View
                  key={ex.name}
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  {/* Icon badge */}
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      backgroundColor: ex.isNewPR ? '#FF5C1A' : 'rgba(28,26,23,0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={ex.isNewPR ? 'trophy' : 'barbell-outline'}
                      size={13}
                      color={ex.isNewPR ? '#fff' : theme.text}
                    />
                  </View>

                  {/* Name + sub */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                        {ex.name}
                      </Text>
                      {ex.isNewPR ? (
                        <Text
                          style={{
                            fontSize: 10,
                            color: '#FF5C1A',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            marginLeft: 6,
                          }}
                        >
                          · PR
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      {ex.sets.length} séries · meilleure : {ex.bestSetLabel ?? '—'}
                    </Text>
                  </View>

                  {/* Volume right */}
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                    {ex.totalVolume >= 1000
                      ? `${(ex.totalVolume / 1000).toFixed(1)}t`
                      : ex.totalVolume > 0
                      ? `${ex.totalVolume}kg`
                      : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Notes textarea */}
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
              Note de séance
            </Text>
            <TextInput
              multiline
              value={notes}
              onChangeText={setNotes}
              onBlur={saveNotes}
              placeholder="Comment t'es-tu senti ? Énergie, sommeil, ressenti…"
              placeholderTextColor={theme.muted}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 12,
                lineHeight: 18,
                textAlignVertical: 'top',
                minHeight: 80,
                color: theme.text,
              }}
            />
          </View>
        </MotiView>
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingBottom: 32,
          paddingTop: 12,
          flexDirection: 'row',
          gap: 8,
          backgroundColor: theme.background + 'E0',
        }}
      >
        {/* Partager ghost button */}
        <TouchableOpacity
          onPress={handleShare}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="share-social-outline" size={14} color={theme.text} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
            Partager
          </Text>
        </TouchableOpacity>

        {/* Sauvegarder & fermer */}
        <TouchableOpacity
          onPress={handleSaveAndClose}
          disabled={isSaving}
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: theme.text,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>
            {isSaving ? 'Sauvegarde…' : 'Sauvegarder & fermer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

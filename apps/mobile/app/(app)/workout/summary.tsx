import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useWorkoutStore } from '../../../src/stores/workoutStore';

export default function WorkoutSummaryScreen() {
  const theme = useThemeStore((s) => s.theme);
  const session = useWorkoutStore((s) => s.lastCompletedSession);
  const [notes, setNotes] = useState('');

  if (!session) {
    router.replace('/(app)/workout/');
    return null;
  }

  const durationMin = Math.floor((session.durationSeconds ?? 0) / 60);
  const totalVolume = session.exercises?.reduce(
    (acc, ex) => acc + ex.totalVolume,
    0
  ) ?? 0;
  const totalSets = session.exercises?.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;
  const prs = session.exercises?.filter((ex) => ex.isNewPR) ?? [];

  const handleSave = () => {
    useWorkoutStore.getState().saveSessionNotes(session.id, notes);
    useWorkoutStore.getState().clearLastCompletedSession();
    router.replace('/(app)/workout/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12,
        backgroundColor: theme.background,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Séance terminée</Text>
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>Bravo pour cette session</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
        {/* Hero dark card */}
        <View style={{
          backgroundColor: theme.cardDark, borderRadius: 18,
          padding: 18, overflow: 'hidden', position: 'relative',
        }}>
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: 80,
            backgroundColor: theme.primary + '30',
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="trophy" size={12} color={theme.primary} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Highlight
            </Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.cardDarkText, lineHeight: 22, marginBottom: 16 }}>
            {session.highlight ?? `${durationMin} min · ${totalSets} séries complétées`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { v: `${durationMin} min`, l: 'durée' },
              { v: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`, l: 'volume' },
              { v: `${totalSets}`, l: 'séries' },
              { v: session.avgHr ? `${session.avgHr}` : '—', l: 'FC moy.' },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: theme.cardDarkText, lineHeight: 18 }}>{x.v}</Text>
                <Text style={{ fontSize: 9, color: theme.cardDarkText + '70', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>{x.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* PRs */}
        {prs.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
              Records battus{' '}
              <Text style={{ color: theme.primary }}>{prs.length}</Text>
            </Text>
            {prs.map((pr) => (
              <View key={pr.name} style={{
                backgroundColor: theme.primary + '08',
                borderRadius: 14, padding: 14,
                flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
                borderWidth: 1, borderColor: theme.primary + '22',
              }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 14,
                  backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="trophy" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{pr.name}</Text>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                    Nouveau record · +{pr.delta ?? '?'}kg
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary }}>
                  {pr.bestWeight}
                  <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '500' }}>kg</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercise breakdown */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            Détail par exercice
          </Text>
          {(session.exercises ?? []).map((ex) => (
            <View key={ex.name} style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
            }}>
              <View style={{
                width: 30, height: 30, borderRadius: 9,
                backgroundColor: ex.isNewPR ? theme.primary : theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={ex.isNewPR ? 'trophy' : 'barbell-outline'} size={13} color={ex.isNewPR ? '#fff' : theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
                  {ex.name}
                  {ex.isNewPR && <Text style={{ fontSize: 9.5, color: theme.primary, fontWeight: '800', marginLeft: 6 }}> · PR</Text>}
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>
                  {ex.sets.length} séries · meilleure : {ex.bestSetLabel ?? '—'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                {ex.totalVolume >= 1000 ? `${(ex.totalVolume / 1000).toFixed(1)}t` : ex.totalVolume > 0 ? `${ex.totalVolume}kg` : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Session notes */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            Note de séance
          </Text>
          <TextInput
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Comment t'es-tu senti ? Énergie, sommeil, ressenti…"
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.surface, borderRadius: 12,
              borderWidth: 1, borderColor: theme.border,
              padding: 14, color: theme.text, fontSize: 13, lineHeight: 20,
              textAlignVertical: 'top', minHeight: 80,
            }}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 18, paddingBottom: 32, paddingTop: 12,
        flexDirection: 'row', gap: 8,
        backgroundColor: theme.background + 'E0',
      }}>
        <TouchableOpacity
          onPress={() => showAlert('Partager', 'Fonctionnalité bientôt disponible.')}
          style={{
            paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
            borderWidth: 1, borderColor: theme.border,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          <Ionicons name="share-outline" size={14} color={theme.text} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14,
            backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.cardDarkText }}>Sauvegarder & fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

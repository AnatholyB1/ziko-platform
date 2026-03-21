import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchSessionDetail } from '../store';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`;
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

function rpeColor(rpe: number, theme: any): string {
  if (rpe <= 3) return '#10B981';
  if (rpe <= 6) return '#F59E0B';
  if (rpe <= 8) return theme.primary;
  return '#EF4444';
}

export default function SessionDetail({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchSessionDetail(supabase, sessionId!);
    setSession(res.session);
    setExercises(res.exercises);
    setSets(res.sets);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  if (!session && !loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted }}>Séance introuvable</Text>
      </SafeAreaView>
    );
  }

  const dur = session?.ended_at && session?.started_at
    ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
    : session?.total_duration_active_seconds ?? 0;

  const date = session ? new Date(session.started_at) : new Date();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 8, paddingBottom: 12, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }} numberOfLines={1}>
            {session?.name ?? 'Séance libre'}
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted }}>
            {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary KPIs */}
        {session && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <SummaryKPI icon="time-outline" label="Durée" value={formatDuration(dur)} />
            <SummaryKPI
              icon="trending-up-outline"
              label="Volume"
              value={`${Math.round(session.total_volume_kg ?? 0)}kg`}
            />
            <SummaryKPI icon="layers-outline" label="Séries" value={`${session.total_sets ?? 0}`} />
            <SummaryKPI icon="repeat-outline" label="Reps" value={`${session.total_reps ?? 0}`} />
            <SummaryKPI icon="barbell-outline" label="Exercices" value={`${session.total_exercises ?? exercises.length}`} />
            <SummaryKPI
              icon="pause-outline"
              label="Repos total"
              value={session.total_rest_seconds != null ? formatDuration(session.total_rest_seconds) : '—'}
            />
          </View>
        )}

        {/* Exercise breakdown */}
        {exercises.map((ex: any, exIdx: number) => {
          const exSets = sets.filter((s: any) => s.exercise_id === ex.exercise_id);
          const exName = ex.exercises?.name ?? 'Exercice';
          const muscles: string[] = ex.exercises?.muscle_groups ?? [];

          return (
            <View
              key={ex.id}
              style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: theme.border,
              }}
            >
              {/* Exercise header */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(app)/(plugins)/stats/exercise',
                    params: { exerciseId: ex.exercise_id, exerciseName: exName },
                  } as any)
                }
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                    {exIdx + 1}. {exName}
                  </Text>
                  {muscles.length > 0 && (
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                      {muscles.join(', ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B6963" />
              </TouchableOpacity>

              {/* Prescribed vs actual mini */}
              {(ex.prescribed_sets != null || ex.sets_completed > 0) && (
                <View style={{
                  flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10,
                  borderTopWidth: 1, borderTopColor: theme.background,
                }}>
                  <MiniStat label="Séries" value={`${ex.sets_completed}/${ex.sets_planned ?? '?'}`} />
                  <MiniStat label="Reps" value={`${ex.total_reps}`} />
                  <MiniStat label="Volume" value={`${Math.round(ex.total_volume_kg)}kg`} />
                  {ex.avg_rpe != null && (
                    <MiniStat label="RPE" value={`${ex.avg_rpe}`} color={rpeColor(ex.avg_rpe, theme)} />
                  )}
                </View>
              )}

              {/* Sets table */}
              {exSets.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  {/* Table header */}
                  <View style={{
                    flexDirection: 'row', paddingVertical: 6,
                    borderBottomWidth: 1, borderBottomColor: theme.border,
                  }}>
                    <Text style={{ width: 36, fontSize: 11, fontWeight: '700', color: theme.muted }}>Set</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: theme.muted, textAlign: 'center' }}>Poids</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: theme.muted, textAlign: 'center' }}>Reps</Text>
                    <Text style={{ width: 40, fontSize: 11, fontWeight: '700', color: theme.muted, textAlign: 'center' }}>RPE</Text>
                    <Text style={{ width: 50, fontSize: 11, fontWeight: '700', color: theme.muted, textAlign: 'right' }}>Repos</Text>
                  </View>
                  {exSets.map((s: any) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: 'row', paddingVertical: 8,
                        borderBottomWidth: 1, borderBottomColor: theme.background,
                        opacity: s.completed ? 1 : 0.5,
                      }}
                    >
                      <Text style={{ width: 36, fontSize: 13, color: theme.text }}>
                        {s.set_number}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13, color: theme.text, textAlign: 'center' }}>
                        {s.weight_kg != null ? `${s.weight_kg}kg` : '—'}
                        {s.prescribed_weight_kg != null && s.weight_kg !== s.prescribed_weight_kg && (
                          <Text style={{ fontSize: 11, color: theme.muted }}>
                            {' '}({s.prescribed_weight_kg})
                          </Text>
                        )}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13, color: theme.text, textAlign: 'center' }}>
                        {s.reps ?? '—'}
                        {s.prescribed_reps != null && s.reps !== s.prescribed_reps && (
                          <Text style={{ fontSize: 11, color: theme.muted }}>
                            {' '}({s.prescribed_reps})
                          </Text>
                        )}
                      </Text>
                      <Text style={{
                        width: 40, fontSize: 13, textAlign: 'center',
                        color: s.rpe != null ? rpeColor(s.rpe, theme) : theme.muted,
                        fontWeight: s.rpe != null ? '700' : '400',
                      }}>
                        {s.rpe ?? '—'}
                      </Text>
                      <Text style={{ width: 50, fontSize: 13, color: theme.muted, textAlign: 'right' }}>
                        {s.rest_seconds_taken != null ? `${s.rest_seconds_taken}s` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Empty */}
        {!loading && exercises.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="document-text-outline" size={48} color="#E2E0DA" />
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8 }}>
              Aucun détail disponible
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────
function SummaryKPI({ icon, label, value }: { icon: string; label: string; value: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      minWidth: '30%', flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center',
    }}>
      <Ionicons name={icon as any} size={18} color={theme.primary} />
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? theme.text }}>{value}</Text>
      <Text style={{ fontSize: 10, color: theme.muted }}>{label}</Text>
    </View>
  );
}

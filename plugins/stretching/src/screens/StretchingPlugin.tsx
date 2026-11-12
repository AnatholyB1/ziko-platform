import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';
import { SubTabs, PluginHeader } from '@ziko/ui';
import {
  fetchLibrary, fetchRoutines, fetchLogs,
} from '../data';
import {
  ZONES, zoneLabel, filterLibrary, filterCounts, formatMeasure, isPerso, routineSummary,
  computeStats, buildMonthGrid, calendarCellLabel, lastSessionLabel, MONTH_NAMES,
  type LibraryExercise, type LibraryFilter, type RoutineRow,
} from '../lib';
import {
  CARD_SHADOW, ORANGE_TEXT, Badge, Chip, ErrorCard, PrimaryButton, SecondaryButton, Skeleton,
} from '../components/ui';

// Ordre du contrat de design (lot C, ST-6) : Bibliotheque / Routines / Suivi.
const TABS = ['Bibliothèque', 'Routines', 'Suivi'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function StretchingPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<string>('Bibliothèque');

  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });
  const userId: string | undefined = authData?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Stretching" onBack={() => router.back()} />
      <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Bibliothèque' && <LibraryTab supabase={supabase} userId={userId} />}
      {activeTab === 'Routines' && <RoutinesTab supabase={supabase} userId={userId} />}
      {activeTab === 'Suivi' && <TrackingTab supabase={supabase} userId={userId} onLaunch={() => setActiveTab('Routines')} />}
    </SafeAreaView>
  );
}

// ─── Bibliotheque (STRE-01, STRE-02) ──────────────────────────────────────────

function LibraryTab({ supabase, userId }: { supabase: any; userId?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: library = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stretching_library', userId],
    queryFn: () => fetchLibrary(supabase),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const counts = useMemo(() => filterCounts(library), [library]);
  const rows = useMemo(() => filterLibrary(library, filter), [library, filter]);
  const zones = ZONES.filter((z) => counts[z] > 0);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {isError ? (
        <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger la bibliothèque'} onRetry={() => refetch()} />
      ) : isLoading || !userId ? (
        <Skeleton />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            <Chip label="Tous" count={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} />
            {zones.map((z) => (
              <Chip key={z} label={zoneLabel(z)} count={counts[z]} active={filter === z} onPress={() => setFilter(z)} />
            ))}
            <Chip label="Mes exercices" count={counts.mine} active={filter === 'mine'} onPress={() => setFilter('mine')} />
          </ScrollView>

          {rows.length === 0 ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 24, alignItems: 'center', ...CARD_SHADOW }}>
              <Ionicons name="body-outline" size={36} color={theme.muted} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 10 }}>
                {filter === 'mine' ? 'Aucun exercice à toi' : 'Aucun exercice'}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                {filter === 'mine'
                  ? 'Ajoute un étirement que tu fais déjà : nom, zone, durée. Il rejoint la bibliothèque et tes routines.'
                  : 'Aucun exercice dans cette zone.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map((ex) => (
                <ExerciseRow key={ex.id} ex={ex} open={openId === ex.id} onToggle={() => setOpenId(openId === ex.id ? null : ex.id)} />
              ))}
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton
              label="Créer un exercice"
              icon="add"
              onPress={() => router.push('/(app)/(plugins)/stretching/exercise' as any)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ExerciseRow({ ex, open, onToggle }: { ex: LibraryExercise; open: boolean; onToggle: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const measure = formatMeasure({
    measure: ex.measure, duration_seconds: ex.duration_seconds ?? 30, reps: ex.reps ?? 10, sides: ex.sides,
  });
  return (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${ex.name}, ${zoneLabel(ex.muscle_group)}, ${measure}${isPerso(ex) ? ', exercice perso' : ''}`}
      accessibilityState={{ expanded: open }}
      style={{
        backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
        padding: 12, minHeight: 64, ...CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(207,69,9,0.10)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="body-outline" size={20} color={ORANGE_TEXT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{ex.name}</Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{zoneLabel(ex.muscle_group)} · {measure}</Text>
        </View>
        {isPerso(ex) ? <Badge label="PERSO" /> : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
      </View>
      {open ? (
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 10, lineHeight: 20 }}>
          {ex.instructions?.trim() ? ex.instructions : 'Pas de consigne pour cet exercice.'}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Routines (STRE-03, STRE-05) ──────────────────────────────────────────────

function RoutinesTab({ supabase, userId }: { supabase: any; userId?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const primary = getActionPrimary(theme);

  const { data: routines = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stretching_routines', userId],
    queryFn: () => fetchRoutines(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const launch = (r: RoutineRow) =>
    router.push({ pathname: '/(app)/(plugins)/stretching/session' as any, params: { routineId: r.id } });
  const edit = (r: RoutineRow) =>
    router.push({ pathname: '/(app)/(plugins)/stretching/editor' as any, params: { editId: r.id } });
  const create = () => router.push('/(app)/(plugins)/stretching/editor' as any);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {isError ? (
        <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger les routines'} onRetry={() => refetch()} />
      ) : isLoading || !userId ? (
        <Skeleton count={3} />
      ) : (
        <>
          <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 12, lineHeight: 20 }}>
            La routine par défaut s'ajoute au début de chaque séance. Tu peux la passer d'un tap.
          </Text>

          {routines.length === 0 ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 24, alignItems: 'center', ...CARD_SHADOW }}>
              <Ionicons name="list-outline" size={36} color={theme.muted} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 10 }}>Aucune routine</Text>
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                Assemble des exercices de la bibliothèque dans l'ordre que tu veux.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {routines.map((r) => (
                <View
                  key={r.id}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 16, padding: 14,
                    borderWidth: r.is_default ? 2 : 1, borderColor: r.is_default ? primary : theme.border,
                    ...CARD_SHADOW,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => launch(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lancer ${r.name}, ${routineSummary(r.exercises)}${r.is_default ? ', routine par défaut' : ''}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{r.name}</Text>
                        {r.is_default ? <Badge label="PAR DÉFAUT" /> : null}
                      </View>
                      <Text style={{ fontSize: 14, color: theme.muted, marginTop: 3 }}>{routineSummary(r.exercises)}</Text>
                    </View>
                    <Ionicons name="play-circle" size={32} color={primary} />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <SecondaryButton label="Modifier" onPress={() => edit(r)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Créer une routine" icon="add" onPress={create} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Suivi (STRE-04) ──────────────────────────────────────────────────────────

function TrackingTab({ supabase, userId, onLaunch }: { supabase: any; userId?: string; onLaunch: () => void }) {
  const theme = useThemeStore((s) => s.theme);

  const { data: logs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stretching_logs', userId],
    queryFn: () => fetchLogs(supabase, userId as string),
    enabled: !!userId,
    staleTime: 0,
  });

  const now = new Date();
  const stats = useMemo(() => computeStats(logs, new Date()), [logs]);
  const grid = useMemo(() => buildMonthGrid(new Date(), stats.days), [stats.days]);

  if (isError) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <ErrorCard message={(error as Error)?.message ?? 'Impossible de charger le suivi'} onRetry={() => refetch()} />
      </ScrollView>
    );
  }
  if (isLoading || !userId) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <Skeleton count={3} />
      </ScrollView>
    );
  }

  const empty = logs.length === 0;
  const lastMinutes = stats.last ? Math.round((stats.last.duration_sec ?? 0) / 60) : 0;
  const tile = (value: number, unit: string) => (
    <View
      style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 12, ...CARD_SHADOW }}
      accessible
      accessibilityLabel={`${value} ${unit}`}
    >
      <Text style={{ fontSize: 26, fontWeight: '800', color: ORANGE_TEXT }}>{value}</Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{unit}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {empty ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 24, alignItems: 'center', marginBottom: 12, ...CARD_SHADOW }}>
          <Ionicons name="calendar-outline" size={36} color={theme.muted} />
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 10 }}>Aucune séance pour l'instant</Text>
          <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
            Fais une première routine : tes minutes, ta série et ton calendrier apparaîtront ici.
          </Text>
          <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
            <PrimaryButton label="Lancer une routine" onPress={onLaunch} />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        {tile(stats.weekSessions, stats.weekSessions > 1 ? 'séances cette semaine' : 'séance cette semaine')}
        {tile(stats.weekMinutes, 'min cumulées')}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {tile(stats.streak, stats.streak > 1 ? 'jours de série' : 'jour de série')}
        <View
          style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 12, ...CARD_SHADOW }}
          accessible
          accessibilityLabel={stats.last ? `Dernière séance, ${lastSessionLabel(stats.last.date, now)}, ${stats.last.routine_name ?? 'routine'}, ${lastMinutes} minutes` : 'Dernière séance, aucune'}
        >
          <Text style={{ fontSize: 13, color: theme.muted }}>Dernière séance</Text>
          {stats.last ? (
            <>
              <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, marginTop: 2 }}>{lastSessionLabel(stats.last.date, now)}</Text>
              <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }} numberOfLines={2}>
                {stats.last.routine_name ?? 'Routine'}, {lastMinutes} min
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.muted, marginTop: 2 }}>Aucune</Text>
          )}
        </View>
      </View>

      <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, ...CARD_SHADOW }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 10 }}>
          {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>{d}</Text>
            </View>
          ))}
        </View>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((c) => (
              <View key={c.key} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                {c.inMonth ? (
                  <View
                    accessible
                    accessibilityLabel={calendarCellLabel(c)}
                    style={{
                      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: c.hasSession ? 'rgba(207,69,9,0.16)' : 'transparent',
                      borderWidth: c.isToday ? 2 : 0, borderColor: theme.text,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: c.hasSession ? ORANGE_TEXT : theme.text, fontWeight: c.hasSession ? '800' : '400' }}>
                      {c.day}
                    </Text>
                  </View>
                ) : (
                  <View style={{ width: 38, height: 38 }} />
                )}
              </View>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(207,69,9,0.16)' }} />
          <Text style={{ fontSize: 13, color: theme.muted }}>Jour avec séance · contour noir : aujourd'hui</Text>
        </View>
      </View>
    </ScrollView>
  );
}

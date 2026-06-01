import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

const { width: SCREEN_W } = Dimensions.get('window');

const TABS = ['Progrès', 'Volume', 'Records'];

// ── MiniBars local (D-02 / D-12) ─────────────────────────────────────────────
function MiniBars({
  data,
  color,
  max,
}: {
  data: Array<{ l: string; v: number; today?: boolean }>;
  color: string;
  max?: number;
}) {
  const m = max ?? Math.max(...data.map((d) => d.v), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {data.map((d, i) => (
        <View
          key={i}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 }}
        >
          <View
            style={{
              width: '100%',
              height: Math.max((d.v / m) * 80, 4),
              backgroundColor: d.today ? color : color + '47',
              borderRadius: 5,
            }}
          />
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: '700',
              color: d.today ? color : '#6B6963',
            }}
          >
            {d.l}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── StatTile local ────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E0DA',
        padding: 12,
        shadowColor: '#1C1A17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: '#6B6963',
          fontWeight: '700',
          letterSpacing: 0.06,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: color ?? '#1C1A17',
          marginTop: 4,
        }}
      >
        {value}
      </Text>
      {sub && (
        <Text style={{ fontSize: 10.5, color: '#6B6963', marginTop: 1 }}>{sub}</Text>
      )}
    </View>
  );
}

// ── RowList local ─────────────────────────────────────────────────────────────
function RowList({
  items,
  accent,
}: {
  items: Array<{
    icon?: string;
    iconColor?: string;
    title: string;
    sub?: string;
    right?: string;
    rightColor?: string;
  }>;
  accent?: string;
}) {
  const accentColor = accent ?? '#FF5C1A';
  return (
    <View style={{ gap: 6 }}>
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E2E0DA',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#1C1A17',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {it.icon && (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: (it.iconColor ?? accentColor) + '24',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={it.icon as any}
                size={15}
                color={it.iconColor ?? accentColor}
              />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1C1A17' }}>
              {it.title}
            </Text>
            {it.sub && (
              <Text style={{ fontSize: 10.5, color: '#6B6963', marginTop: 1 }}>
                {it.sub}
              </Text>
            )}
          </View>
          {it.right && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: it.rightColor ?? '#1C1A17',
              }}
            >
              {it.right}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E0DA',
        padding: 16,
        shadowColor: '#1C1A17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      {title && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#1C1A17',
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StatsPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  // Récupérer l'utilisateur courant
  const { data: userSession } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const userId = userSession?.user?.id;

  // Query: séances du mois + stats
  const { data: monthData, isLoading: loadingMonth, refetch: refetchMonth } = useQuery({
    queryKey: ['workout_sessions_month', userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, started_at, ended_at, total_volume_kg')
        .eq('user_id', userId)
        .gte('started_at', since.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query: volume 4 semaines pour MiniBars
  const { data: weeklyData, isLoading: loadingWeekly } = useQuery({
    queryKey: ['volume_4weeks', userId],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const weeks: { label: string; volume: number; isCurrentWeek: boolean }[] = [];
      for (let w = 3; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - (w + 1) * 7);
        const end = new Date(now);
        end.setDate(now.getDate() - w * 7);
        const { data } = await supabase
          .from('workout_sessions')
          .select('total_volume_kg')
          .eq('user_id', userId)
          .gte('started_at', start.toISOString())
          .lt('started_at', end.toISOString());
        const vol = (data ?? []).reduce(
          (sum: number, s: any) => sum + (s.total_volume_kg ?? 0),
          0,
        );
        weeks.push({ label: `S${4 - w}`, volume: Math.round(vol), isCurrentWeek: w === 0 });
      }
      return weeks;
    },
  });

  // Query: répartition par groupe musculaire (onglet Volume)
  const { data: muscleData, isLoading: loadingMuscle } = useQuery({
    queryKey: ['muscle_volume_month', userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      // Récupérer les sessions du mois
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('started_at', since.toISOString());
      if (!sessions || sessions.length === 0) return [];
      const sessionIds = sessions.map((s: any) => s.id);

      // Récupérer les sets avec infos exercice
      const { data: sets } = await supabase
        .from('session_sets')
        .select('weight_kg, reps, exercises(category, muscle_groups)')
        .in('session_id', sessionIds);
      if (!sets) return [];

      const grouped: Record<string, number> = {};
      for (const s of sets) {
        const category = (s.exercises as any)?.category ?? 'Autre';
        const vol = (s.weight_kg ?? 0) * (s.reps ?? 0);
        grouped[category] = (grouped[category] ?? 0) + vol;
      }
      const total = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(grouped)
        .map(([name, vol]) => ({ name, pct: Math.round((vol / total) * 100) }))
        .sort((a, b) => b.pct - a.pct);
    },
  });

  // Query: records personnels
  const { data: recordsData, isLoading: loadingRecords } = useQuery({
    queryKey: ['personal_records', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Récupérer toutes les sessions de l'utilisateur
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('user_id', userId);
      if (!sessions || sessions.length === 0) return [];
      const sessionIds = sessions.map((s: any) => s.id);
      const sessionDateMap: Record<string, string> = {};
      for (const s of sessions) sessionDateMap[s.id] = s.started_at;

      const { data: sets } = await supabase
        .from('session_sets')
        .select('session_id, exercise_id, reps, weight_kg, exercises(name)')
        .in('session_id', sessionIds);
      if (!sets) return [];

      // Grouper par exercise_id pour trouver le max weight
      const records: Record<
        string,
        { name: string; maxWeight: number; reps: number; sessionId: string }
      > = {};
      for (const s of sets) {
        const exId = s.exercise_id;
        const name = (s.exercises as any)?.name ?? 'Exercice';
        const w = s.weight_kg ?? 0;
        if (!records[exId] || w > records[exId].maxWeight) {
          records[exId] = { name, maxWeight: w, reps: s.reps ?? 0, sessionId: s.session_id };
        }
      }
      return Object.values(records)
        .sort((a, b) => b.maxWeight - a.maxWeight)
        .slice(0, 10)
        .map((r) => ({
          ...r,
          daysAgo: Math.round(
            (Date.now() - new Date(sessionDateMap[r.sessionId] ?? Date.now()).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        }));
    },
  });

  // Calcul des StatTiles depuis monthData
  const sessionCount = monthData?.length ?? 0;
  const totalVolume = Math.round(
    (monthData ?? []).reduce((sum: number, s: any) => sum + (s.total_volume_kg ?? 0), 0),
  );
  const volumeDisplay =
    totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`;
  const estimatedHours = Math.round((sessionCount * 50) / 60);

  // Calcul AISuggestion progression (S3 vs S4)
  const s3vol = weeklyData?.[2]?.volume ?? 0;
  const s4vol = weeklyData?.[3]?.volume ?? 0;
  const progressPct = s3vol > 0 ? Math.round(((s4vol - s3vol) / s3vol) * 100) : 0;
  const progressText =
    progressPct >= 5
      ? `Belle progression ! Volume +${progressPct}% cette semaine — continue sur ta lancée.`
      : `Ton volume est stable — essaie d'augmenter les charges sur 1 exercice cette semaine.`;

  // AISuggestion Volume
  const weakestMuscle = muscleData && muscleData.length > 0
    ? muscleData.reduce((min: any, g: any) => (g.pct < min.pct ? g : min), muscleData[0])
    : null;
  const volumeSuggestion = weakestMuscle
    ? `Tes ${weakestMuscle.name.toLowerCase()} sont sous-stimulés (${weakestMuscle.pct}%). Ajoute 1 séance isolation par semaine pour équilibrer.`
    : 'Log tes séances pour voir la répartition par groupe musculaire.';

  const isLoading = loadingMonth || loadingWeekly;

  const renderProgressTab = () => {
    if (isLoading) {
      return (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      );
    }

    const miniBarsData = (weeklyData ?? []).map((w) => ({
      l: w.label,
      v: w.volume,
      today: w.isCurrentWeek,
    }));

    const hasData = miniBarsData.some((d) => d.v > 0);

    return (
      <View style={{ gap: 12 }}>
        <Card title="Volume soulevé · 4 semaines">
          {hasData ? (
            <>
              <MiniBars data={miniBarsData} color="#FF5C1A" />
              <Text
                style={{
                  fontSize: 11,
                  color: progressPct >= 5 ? '#2E9E5B' : '#6B6963',
                  marginTop: 10,
                  fontWeight: '700',
                }}
              >
                {progressPct >= 5
                  ? `↑ +${progressPct}% cette semaine`
                  : progressPct < 0
                  ? `↓ ${progressPct}% cette semaine`
                  : '→ Volume stable cette semaine'}
              </Text>
            </>
          ) : (
            <Text style={{ color: '#6B6963', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
              Commence tes séances pour voir ton volume ici
            </Text>
          )}
        </Card>

        <AISuggestion text={progressText} actionLabel="Suggestions" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ width: '48%' }}>
            <StatTile label="Séances" value={`${sessionCount}`} sub="ce mois" color="#FF5C1A" />
          </View>
          <View style={{ width: '48%' }}>
            <StatTile label="Volume total" value={volumeDisplay} sub="ce mois" />
          </View>
          <View style={{ width: '48%' }}>
            <StatTile label="Temps" value={`${estimatedHours}h`} sub="d'effort" />
          </View>
          <View style={{ width: '48%' }}>
            <StatTile label="PR battus" value="—" sub="ce mois" color="#2E9E5B" />
          </View>
        </View>
      </View>
    );
  };

  const renderVolumeTab = () => {
    if (loadingMuscle) {
      return (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      );
    }

    return (
      <View style={{ gap: 12 }}>
        <Card title="Répartition par groupe (mois)">
          {muscleData && muscleData.length > 0 ? (
            muscleData.map((g: any) => (
              <View key={g.name} style={{ marginBottom: 9 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#1C1A17' }}>
                    {g.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#6B6963' }}>{g.pct}%</Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: 'rgba(28,26,23,0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${g.pct}%` as any,
                      height: '100%',
                      backgroundColor: '#FF5C1A',
                      borderRadius: 999,
                    }}
                  />
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: '#6B6963', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
              Commence tes séances pour voir ta répartition ici
            </Text>
          )}
        </Card>

        <AISuggestion text={volumeSuggestion} actionLabel="Programmer" />
      </View>
    );
  };

  const renderRecordsTab = () => {
    if (loadingRecords) {
      return (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      );
    }

    if (!recordsData || recordsData.length === 0) {
      return (
        <Text
          style={{
            color: '#6B6963',
            fontSize: 14,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          Aucun record encore — commence à t'entraîner !
        </Text>
      );
    }

    const items = recordsData.map((r) => ({
      icon: 'trophy-outline' as const,
      iconColor: '#FF5C1A',
      title: r.name,
      sub: `${r.reps} rep${r.reps > 1 ? 's' : ''} · il y a ${r.daysAgo}j`,
      right: `${r.maxWeight}kg`,
      rightColor: '#FF5C1A',
    }));

    return <RowList items={items} accent="#FF5C1A" />;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Stats" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <View style={{ marginTop: 16 }}>
          {activeTab === 'Progrès' && renderProgressTab()}
          {activeTab === 'Volume' && renderVolumeTab()}
          {activeTab === 'Records' && renderRecordsTab()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

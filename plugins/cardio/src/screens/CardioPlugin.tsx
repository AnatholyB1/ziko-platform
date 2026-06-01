import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDIO_ACCENT = '#E94B3C';

const TABS = ['Activités', 'Plan', 'Stats'];

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const ACTIVITIES = [
  { l: 'Course', icon: 'walk-outline' as const, c: '#E94B3C' },
  { l: 'Vélo', icon: 'bicycle-outline' as const, c: '#2E7BF6' },
  { l: 'Rameur', icon: 'barbell-outline' as const, c: '#7B5BD0' },
  { l: 'Marche', icon: 'footsteps-outline' as const, c: '#2E9E5B' },
  { l: 'Hyrox', icon: 'flame-outline' as const, c: '#F59E0B' },
  { l: 'Functional', icon: 'body-outline' as const, c: '#FF5C1A' },
];

const ACTIVITY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  course: 'walk-outline',
  running: 'walk-outline',
  vélo: 'bicycle-outline',
  cycling: 'bicycle-outline',
  rameur: 'barbell-outline',
  rowing: 'barbell-outline',
  marche: 'footsteps-outline',
  walking: 'footsteps-outline',
  hyrox: 'flame-outline',
  functional: 'body-outline',
};

const PLANNED_SESSIONS = [
  { title: 'Demain · Tempo run', sub: '20 min · Z3', right: '5 km' },
  { title: 'Vendredi · Intervalles', sub: '6×400m R=90s', right: 'Z4-5' },
  { title: 'Dimanche · Sortie longue', sub: 'Easy · Z2', right: '10 km' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const entryDateStr = date.toISOString().split('T')[0];

  if (entryDateStr === todayStr) return "Auj.";
  if (entryDateStr === yesterdayStr) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

function getActivityIcon(type: string): keyof typeof Ionicons.glyphMap {
  return ACTIVITY_ICON_MAP[type?.toLowerCase()] ?? 'walk-outline';
}

// ─── MiniBars (local) ─────────────────────────────────────────────────────────

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
          <Text style={{ fontSize: 9.5, fontWeight: '700', color: d.today ? color : '#6B6963' }}>
            {d.l}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── StatTile (local) ─────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E0DA',
        padding: 14,
        alignItems: 'center',
        ...CARD_SHADOW,
      }}
    >
      <Text style={{ color: color ?? '#1C1A17', fontWeight: '800', fontSize: 22 }}>{value}</Text>
      <Text style={{ color: '#1C1A17', fontSize: 12, fontWeight: '600', marginTop: 2 }}>{label}</Text>
      {sub && <Text style={{ color: '#6B6963', fontSize: 11, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

// ─── CardioPlugin ──────────────────────────────────────────────────────────────

export default function CardioPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>('Activités');

  // ── Fetch userId ──────────────────────────────────────────────────────────

  const { data: userId } = useQuery({
    queryKey: ['cardio_user_id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: Infinity,
  });

  // ── Cardio recent sessions ────────────────────────────────────────────────

  const { data: recentSessions = [], isLoading: recentLoading } = useQuery({
    queryKey: ['cardio_recent', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Cardio this week ──────────────────────────────────────────────────────

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: cardioWeek = [] } = useQuery({
    queryKey: ['cardio_week', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Sleep logs (for plan rule) ────────────────────────────────────────────

  const { data: sleepLogs = [] } = useQuery({
    queryKey: ['sleep_recent', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('quality')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Cardio stats (7 days) ─────────────────────────────────────────────────

  const { data: statsData = [] } = useQuery({
    queryKey: ['cardio_stats', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('cardio_sessions')
        .select('distance_km, duration_min, created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Derived AI suggestion text ────────────────────────────────────────────

  const aiSuggestionText = (() => {
    if (cardioWeek.length < 2) {
      return `Seulement ${cardioWeek.length} séance(s) cette semaine. Ajoute une sortie LISS dimanche pour récup active.`;
    }
    const sleepAvg =
      sleepLogs.length > 0
        ? sleepLogs.reduce((s: number, l: any) => s + (l.quality ?? 3), 0) / sleepLogs.length
        : 3;
    if (sleepAvg < 3) {
      return 'Récupération faible — privilégie une marche légère aujourd\'hui.';
    }
    return 'Belle régularité ! Prêt pour une séance plus intensive ?';
  })();

  // ── Plan card rule ────────────────────────────────────────────────────────

  const planTitle = (() => {
    if (cardioWeek.length < 2) return 'Construire ta base cardio';
    const sleepAvg =
      sleepLogs.length > 0
        ? sleepLogs.reduce((s: number, l: any) => s + (l.quality ?? 3), 0) / sleepLogs.length
        : 3;
    if (sleepAvg < 3) return 'Récupération active prioritaire';
    return '5K en moins de 22 min';
  })();

  const planDescription = (() => {
    if (cardioWeek.length < 2) return 'Objectif : 3 séances/sem · progression progressive';
    const sleepAvg =
      sleepLogs.length > 0
        ? sleepLogs.reduce((s: number, l: any) => s + (l.quality ?? 3), 0) / sleepLogs.length
        : 3;
    if (sleepAvg < 3) return 'Marche légère + étirements · pas d\'intensité cette semaine';
    return 'Objectif : 4 sem · 3 sorties/sem · variabilité Z2/Z4';
  })();

  const weekNumber = Math.min(cardioWeek.length + 1, 4);
  const progressPct = Math.min((cardioWeek.length / 3) * 100, 100);

  // ── Stats calculation ─────────────────────────────────────────────────────

  const totalKm = statsData.reduce((s: number, d: any) => s + (d.distance_km ?? 0), 0);
  const totalMin = statsData.reduce((s: number, d: any) => s + (d.duration_min ?? 0), 0);
  const sessionCount = statsData.length;
  const avgPace = totalKm > 0 ? (totalMin / totalKm).toFixed(1) + ' min/km' : '—';

  // ── Stats bar data (7 days distance) ─────────────────────────────────────

  const statsBarsData = (() => {
    const result: Array<{ l: string; v: number; today?: boolean }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayKm = statsData
        .filter((s: any) => s.created_at?.startsWith(dateStr))
        .reduce((sum: number, s: any) => sum + (s.distance_km ?? 0), 0);
      result.push({ l: DAY_LABELS[d.getDay()], v: dayKm, today: i === 0 });
    }
    return result;
  })();

  // ─── Tab: Activités ───────────────────────────────────────────────────────

  const renderActivites = () => (
    <View style={{ gap: 12 }}>
      <AISuggestion tintColor={CARDIO_ACCENT} text={aiSuggestionText} />

      {/* Démarrer section */}
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#6B6963',
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          marginBottom: 4,
          marginTop: 4,
        }}
      >
        Démarrer
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACTIVITIES.map((a) => (
          <TouchableOpacity
            key={a.l}
            onPress={() =>
              router.push(
                `/(app)/(plugins)/cardio/tracker?activity_type=${a.l.toLowerCase()}` as any
              )
            }
            style={{
              width: '48%',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: '#E2E0DA',
              ...CARD_SHADOW,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                backgroundColor: a.c + '24',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={a.icon} size={18} color={a.c} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>{a.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Récents section */}
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#6B6963',
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          marginBottom: 4,
          marginTop: 8,
        }}
      >
        Récents
      </Text>

      {recentLoading ? (
        <Text style={{ color: '#6B6963', fontSize: 13 }}>Chargement…</Text>
      ) : recentSessions.length === 0 ? (
        <Text style={{ color: '#6B6963', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          Aucune séance — commence ta première activité !
        </Text>
      ) : (
        recentSessions.map((s: any) => (
          <View
            key={s.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E2E0DA',
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              ...CARD_SHADOW,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: CARDIO_ACCENT + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={getActivityIcon(s.activity_type)} size={18} color={CARDIO_ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>
                {s.title ?? s.activity_type ?? 'Séance'}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>
                {s.distance_km ? `${Number(s.distance_km).toFixed(1)} km · ` : ''}
                {s.duration_min ? `${s.duration_min} min` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#6B6963' }}>
              {getRelativeDate(s.created_at)}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  // ─── Tab: Plan ────────────────────────────────────────────────────────────

  const renderPlan = () => (
    <View style={{ gap: 12 }}>
      {/* Dark plan card */}
      <View
        style={{
          backgroundColor: '#1C1A17',
          borderRadius: 20,
          padding: 20,
          ...CARD_SHADOW,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(233,75,60,0.2)',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 3,
            alignSelf: 'flex-start',
            marginBottom: 10,
          }}
        >
          <Text style={{ color: CARDIO_ACCENT, fontSize: 11, fontWeight: '700' }}>Plan IA</Text>
        </View>
        <Text style={{ color: '#FFFAF6', fontSize: 17, fontWeight: '700' }}>{planTitle}</Text>
        <Text style={{ color: 'rgba(255,250,246,0.65)', fontSize: 12, marginTop: 4 }}>
          {planDescription}
        </Text>
        {/* Progress bar */}
        <View
          style={{
            height: 6,
            backgroundColor: 'rgba(255,250,246,0.12)',
            borderRadius: 999,
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: CARDIO_ACCENT,
              borderRadius: 999,
            }}
          />
        </View>
        <Text style={{ color: 'rgba(255,250,246,0.55)', fontSize: 10, marginTop: 4 }}>
          Semaine {weekNumber}/4
        </Text>
      </View>

      {/* Planned sessions */}
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#6B6963',
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          marginBottom: 4,
        }}
      >
        Prochaines séances
      </Text>

      {PLANNED_SESSIONS.map((s, i) => (
        <View
          key={i}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E2E0DA',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            ...CARD_SHADOW,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: CARDIO_ACCENT + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="walk-outline" size={18} color={CARDIO_ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>{s.title}</Text>
            <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>{s.sub}</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: CARDIO_ACCENT }}>{s.right}</Text>
        </View>
      ))}
    </View>
  );

  // ─── Tab: Stats ───────────────────────────────────────────────────────────

  const renderStats = () => (
    <View style={{ gap: 12 }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E2E0DA',
          padding: 16,
          ...CARD_SHADOW,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17', marginBottom: 12 }}>
          Distance · 7 jours
        </Text>
        <MiniBars data={statsBarsData} color={CARDIO_ACCENT} />
        <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 10 }}>
          {totalKm.toFixed(1)} km cette semaine
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="Total km" value={totalKm.toFixed(1)} color={CARDIO_ACCENT} />
        <StatTile label="Séances" value={String(sessionCount)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="Durée totale" value={`${totalMin}min`} />
        <StatTile label="Vitesse moy" value={avgPace} />
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PluginHeader title="Cardio" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === 'Activités' && renderActivites()}
        {activeTab === 'Plan' && renderPlan()}
        {activeTab === 'Stats' && renderStats()}
      </ScrollView>
    </SafeAreaView>
  );
}

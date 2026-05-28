import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#FF5C1A';
const TABS = ['Routines', 'Bibliothèque', 'Suivi'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const ICON_COLORS = ['#FF5C1A', '#2E7BF6', '#7C3AED', '#2E9E5B'];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── MiniBars (local, absolute pixel heights) ─────────────────────────────────

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
          style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80, gap: 5 }}
        >
          <View
            style={{
              width: '100%',
              height: Math.max((d.v / m) * 72, 4),
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StretchingPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<string>('Routines');
  const library: Array<{ name: string; sub: string }> = [];

  // ── Auth user ────────────────────────────────────────────────────────────
  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });
  const userId = authData?.id;

  // ── Routines query ───────────────────────────────────────────────────────
  const { data: routines = [], isLoading: loadingRoutines } = useQuery({
    queryKey: ['stretching_routines', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('stretching_routines')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Logs 7 days ──────────────────────────────────────────────────────────
  const { data: logs7 = [] } = useQuery({
    queryKey: ['stretching_logs_7days', userId],
    queryFn: async () => {
      if (!userId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from('stretching_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Count this month ─────────────────────────────────────────────────────
  const { data: countMonth = 0 } = useQuery({
    queryKey: ['stretching_count_month', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await supabase
        .from('stretching_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('date', getMonthStart());
      return count ?? 0;
    },
    enabled: !!userId,
  });

  // ── AISuggestion logic — Routines tab ────────────────────────────────────
  const lastLog = logs7.length > 0 ? logs7[logs7.length - 1] : null;
  const today = getToday();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  let routinesAISuggestion = 'Continue sur ta lancée — mobilité quotidienne !';
  if (lastLog) {
    const daysSince = Math.floor(
      (new Date(today).getTime() - new Date(lastLog.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince > 2) {
      routinesAISuggestion = `Tu as fait ${lastLog.routine_name ?? 'une séance'} il y a ${daysSince}j — la routine Post-séance réduira tes courbatures.`;
    }
  }

  // ── MiniBars 7 days data ─────────────────────────────────────────────────
  const last7Days = getLast7Days();
  const barsData = last7Days.map((date, i) => {
    const log = logs7.find((l: any) => l.date === date);
    return {
      l: DAY_LABELS[i],
      v: log ? Math.round(log.duration_sec / 60) : 0,
      today: i === 6,
    };
  });

  // ── AISuggestion — Suivi tab ─────────────────────────────────────────────
  const missedDays = last7Days.filter((date) => !logs7.find((l: any) => l.date === date));
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  let suiviAISuggestion = 'Super constance cette semaine !';
  if (missedDays.length > 0) {
    const missedDayName = dayNames[new Date(missedDays[0]).getDay()];
    suiviAISuggestion = `Tu sautes les routines le ${missedDayName}. Ajoute un rappel à 21h ?`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Stretching" onBack={() => router.back()} />
      <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── ROUTINES ──────────────────────────────────────────────────────── */}
      {activeTab === 'Routines' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <AISuggestion text={routinesAISuggestion} />

          {loadingRoutines ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
          ) : routines.length === 0 ? (
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                marginTop: 16,
                ...CARD_SHADOW,
              }}
            >
              <Ionicons name="body-outline" size={40} color={PRIMARY + '66'} />
              <Text
                style={{
                  color: theme.text,
                  fontSize: 15,
                  fontWeight: '600',
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Aucune routine créée
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Commence par en créer une !
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 8 }}>
              {routines.map((routine: any, index: number) => {
                const accentColor = ICON_COLORS[index % 4];
                const exoCount =
                  Array.isArray(routine.exercises) ? routine.exercises.length : 0;
                return (
                  <View
                    key={routine.id}
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      ...CARD_SHADOW,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: accentColor + '24',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="body-outline" size={20} color={accentColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                        {routine.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                        {routine.duration_minutes ?? 0} min · {exoCount} exos · {routine.type ?? 'custom'}
                      </Text>
                    </View>
                    <Ionicons name="play-outline" size={16} color={accentColor} />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── BIBLIOTHÈQUE ─────────────────────────────────────────────────── */}
      {activeTab === 'Bibliothèque' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: theme.muted,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            6 exercices essentiels
          </Text>
          <View style={{ gap: 8 }}>
            {library.map((item) => (
              <View
                key={item.name}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  ...CARD_SHADOW,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: 'rgba(255,92,26,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="body-outline" size={16} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>
                    {item.sub}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.muted} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── SUIVI ────────────────────────────────────────────────────────── */}
      {activeTab === 'Suivi' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Monthly summary */}
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              ...CARD_SHADOW,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: PRIMARY }}>
                {countMonth}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>séances ce mois</Text>
            </View>
          </View>

          {/* MiniBars 7 days */}
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              ...CARD_SHADOW,
            }}
          >
            <Text
              style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 12 }}
            >
              7 derniers jours
            </Text>
            <MiniBars data={barsData} color={PRIMARY} />
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 10 }}>
              Durée en minutes par session
            </Text>
          </View>

          <AISuggestion text={suiviAISuggestion} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

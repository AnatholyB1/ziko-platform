import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIOLET = '#7C3AED';
const TABS = ['Cette nuit', 'Historique', 'Réglages'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── Static settings ──────────────────────────────────────────────────────────

const SETTINGS = [
  { label: 'Cible de sommeil', sub: '8h00 / nuit', icon: 'moon-outline' as const },
  { label: 'Rappel coucher', sub: 'Tous les jours à 22h30', icon: 'notifications-outline' as const },
  { label: 'Source données', sub: 'Non connectée', icon: 'watch-outline' as const },
  { label: 'Réveil intelligent', sub: 'Désactivé', icon: 'timer-outline' as const },
  { label: 'Routine pré-sommeil', sub: 'Désactivée', icon: 'body-outline' as const },
];

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

function formatDuration(h: number): string {
  return Math.floor(h) + 'h' + Math.round((h % 1) * 60).toString().padStart(2, '0');
}

// ─── Sleep stage heuristic (D-04) ────────────────────────────────────────────

function estimateSleepStages(dh: number) {
  return [
    { l: 'Profond', h: +(dh * 0.18).toFixed(1), c: '#7C3AED' },
    { l: 'Léger',   h: +(dh * 0.53).toFixed(1), c: '#A78BFA' },
    { l: 'REM',     h: +(dh * 0.24).toFixed(1), c: '#2196F3' },
    { l: 'Éveillé', h: +(dh * 0.05).toFixed(1), c: '#9CA3AF' },
  ];
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

// ─── StatTile ─────────────────────────────────────────────────────────────────

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
        borderRadius: 14,
        padding: 12,
        ...CARD_SHADOW,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: '#6B6963',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: color ?? '#1C1A17' }}>{value}</Text>
      {sub ? (
        <Text style={{ fontSize: 10, color: '#6B6963', marginTop: 2 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SleepPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<string>('Cette nuit');

  // ── Auth user ────────────────────────────────────────────────────────────
  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });
  const userId = authData?.id;

  // ── Last night ───────────────────────────────────────────────────────────
  const { data: lastLog } = useQuery({
    queryKey: ['sleep_last', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!userId,
  });

  // ── Last 7 nights ────────────────────────────────────────────────────────
  const { data: logs7 = [] } = useQuery({
    queryKey: ['sleep_7days', userId],
    queryFn: async () => {
      if (!userId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── MiniBars data ────────────────────────────────────────────────────────
  const last7Days = getLast7Days();
  const barsData = last7Days.map((date, i) => {
    const log = logs7.find((l: any) => l.date === date);
    return {
      l: DAY_LABELS[i],
      v: log ? Number(log.duration_hours) : 0,
      today: i === 6,
    };
  });

  // ── Average duration ─────────────────────────────────────────────────────
  const avgDuration =
    logs7.length > 0
      ? logs7.reduce((sum: number, l: any) => sum + Number(l.duration_hours), 0) / logs7.length
      : 0;

  // ── AISuggestion Cette nuit ───────────────────────────────────────────────
  let tonightSuggestion = 'Aucune donnée — commence à tracker ton sommeil !';
  if (lastLog) {
    const q = lastLog.quality ?? 0;
    if (q < 3) {
      tonightSuggestion =
        'Ton sommeil profond est faible. Évite la caféine après 14h ?';
    } else if (q >= 4) {
      tonightSuggestion = 'Excellente nuit ! Continue cette routine sommeil.';
    } else {
      tonightSuggestion = 'Nuit correcte. Vise 8h pour une récupération optimale.';
    }
  }

  // ── AISuggestion Historique ───────────────────────────────────────────────
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  let historySuggestion = 'Aucune donnée sur 7 jours pour analyser.';
  if (logs7.length > 0) {
    const worst = logs7.reduce(
      (min: any, l: any) =>
        Number(l.duration_hours) < Number(min.duration_hours) ? l : min,
      logs7[0]
    );
    const worstDayName = dayNames[new Date(worst.date).getDay()];
    historySuggestion = `Tu dors mal le ${worstDayName}. Décale ta séance avant 19h ?`;
  }

  // ── Sleep stages for last night ───────────────────────────────────────────
  const stages = lastLog ? estimateSleepStages(Number(lastLog.duration_hours)) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Sommeil" onBack={() => router.back()} />
      <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── CETTE NUIT ───────────────────────────────────────────────────── */}
      {activeTab === 'Cette nuit' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {!lastLog ? (
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                ...CARD_SHADOW,
              }}
            >
              <Ionicons name="moon-outline" size={40} color={VIOLET + '66'} />
              <Text
                style={{
                  color: theme.text,
                  fontSize: 15,
                  fontWeight: '600',
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Aucune nuit enregistrée
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Commence à tracker ton sommeil !
              </Text>
            </View>
          ) : (
            <>
              {/* Main card */}
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  ...CARD_SHADOW,
                }}
              >
                {/* Duration */}
                <Text style={{ fontSize: 36, fontWeight: '700', color: VIOLET }}>
                  {formatDuration(Number(lastLog.duration_hours))}
                </Text>
                {/* Horaires + quality */}
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                  {lastLog.bedtime} → {lastLog.wake_time} · score {(lastLog.quality ?? 0) * 20}/100
                </Text>

                {/* Stage bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    height: 24,
                    borderRadius: 6,
                    overflow: 'hidden',
                    marginTop: 14,
                  }}
                >
                  {stages.map((s) => (
                    <View key={s.l} style={{ flex: s.h, backgroundColor: s.c }} />
                  ))}
                </View>

                {/* Legend */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 10,
                  }}
                >
                  {stages.map((s) => (
                    <View key={s.l} style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          backgroundColor: s.c,
                          marginBottom: 3,
                        }}
                      />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text }}>
                        {s.l}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted }}>{s.h}h</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* AISuggestion violet */}
              <AISuggestion text={tonightSuggestion} tintColor={VIOLET} />

              {/* StatTiles */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <StatTile
                  label="Fréq. card. min"
                  value="— bpm"
                  sub="non disponible"
                  color={VIOLET}
                />
                <StatTile
                  label="Variabilité"
                  value="— ms"
                  sub="non disponible"
                  color={VIOLET}
                />
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── HISTORIQUE ───────────────────────────────────────────────────── */}
      {activeTab === 'Historique' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
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
            <MiniBars data={barsData} color={VIOLET} />
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 10 }}>
              Moyenne : {avgDuration > 0 ? formatDuration(avgDuration) : '—'}h · cible 8h00
            </Text>
          </View>

          <AISuggestion text={historySuggestion} tintColor={VIOLET} />
        </ScrollView>
      )}

      {/* ── RÉGLAGES ─────────────────────────────────────────────────────── */}
      {activeTab === 'Réglages' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 8 }}>
            {SETTINGS.map((item) => (
              <View
                key={item.label}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 14,
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
                    backgroundColor: VIOLET + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={item.icon} size={18} color={VIOLET} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {item.sub}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.muted} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

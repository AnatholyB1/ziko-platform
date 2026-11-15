import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary, formatDateFr } from '@ziko/plugin-sdk';
import { SubTabs, PluginHeader } from '@ziko/ui';
import JournalForm, { resolveUser, type JournalAuthProps } from './JournalForm';
import {
  JOURNAL_TEAL,
  JOURNAL_TEAL_TINT,
  buildTrend,
  weekStats,
  formatAvg,
  trendDescription,
  moodMeta,
  contextLabel,
  localDateKey,
  classifySaveError,
  type TrendEntry,
} from '../logic';

const TAB_TODAY = "Aujourd'hui";
const TAB_HISTORY = 'Historique';
const TABS = [TAB_TODAY, TAB_HISTORY];

const CARD = {
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
};

function formatRelativeDate(entry: { date?: string | null; created_at?: string | null }): string {
  const key = entry.date ? String(entry.date).slice(0, 10) : entry.created_at ? localDateKey(new Date(entry.created_at)) : '';
  const now = new Date();
  if (key === localDateKey(now)) return "Aujourd'hui";
  if (key === localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Hier';
  const d = key ? new Date(`${key}T12:00:00`) : new Date(entry.created_at ?? Date.now());
  return formatDateFr(d, { weekday: 'short', day: 'numeric', month: 'short' });
}

function TrendCard({ entries }: { entries: TrendEntry[] }) {
  const days = buildTrend(entries);
  const stats = weekStats(entries);
  const HEIGHT = 80;
  return (
    <View style={CARD}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17', marginBottom: 12 }}>Humeur · 7 jours</Text>
      <View
        accessibilityRole="image"
        accessibilityLabel={trendDescription(days)}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: HEIGHT + 24 }}
      >
        {days.map((d) => (
          <View key={d.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
            {/* jour sans entree = barre absente (pas une barre de hauteur 0) */}
            {d.avg !== null && (
              <View
                style={{
                  width: '100%',
                  height: Math.max((d.avg / 5) * HEIGHT, 4),
                  backgroundColor: d.today ? JOURNAL_TEAL : JOURNAL_TEAL + '66',
                  borderRadius: 5,
                }}
              />
            )}
            <Text style={{ fontSize: 14, fontWeight: '700', color: d.today ? JOURNAL_TEAL : '#6B6963' }}>{d.label}</Text>
          </View>
        ))}
      </View>
      {stats.current !== null ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>{`${formatAvg(stats.current)} / 5`}</Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 2 }}>
            {stats.delta === null
              ? 'Pas de semaine précédente à comparer'
              : stats.delta === 0
              ? 'Stable par rapport à la semaine passée'
              : `${stats.delta > 0 ? '+' : '−'}${formatAvg(Math.abs(stats.delta))} par rapport à la semaine passée`}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 12 }}>Aucune humeur notée cette semaine.</Text>
      )}
    </View>
  );
}

export default function JournalPlugin({
  supabase,
  requireUser,
  onReauth,
}: JournalAuthProps) {
  const theme = useThemeStore((s) => s.theme);
  const actionColor = getActionPrimary(theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(TAB_TODAY);

  // Utilisateur lu a la demande : jamais mis en cache a vie (staleTime court, pas de null persistant).
  const { data: userId } = useQuery({
    queryKey: ['journal_user_id'],
    queryFn: async () => (await resolveUser({ supabase, requireUser })).id,
    staleTime: 30_000,
    retry: 2,
  });

  const { data: historyEntries = [], isLoading: historyLoading, isError: historyError, error: historyErr, refetch: refetchHistory } = useQuery({
    queryKey: ['journal_history', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ziko_journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: trendEntries = [] } = useQuery({
    queryKey: ['journal_trends', userId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data, error } = await supabase
        .from('ziko_journal_entries')
        .select('mood, date, created_at')
        .eq('user_id', userId)
        .gte('date', localDateKey(since))
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const renderHistory = () => (
    <View style={{ gap: 12 }}>
      <TrendCard entries={trendEntries} />
      {historyLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 24 }}>
          <ActivityIndicator color={JOURNAL_TEAL} />
        </View>
      ) : historyError && historyEntries.length === 0 ? (
        // Une erreur de lecture n'est pas "aucune entree" : 401 -> Session expiree + Se reconnecter, sinon connexion.
        <View accessibilityRole="alert" style={{ ...CARD, gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#B91C1C' }}>
            {classifySaveError(historyErr) === 'expired' ? 'Session expirée' : 'Impossible de charger'}
          </Text>
          <Text style={{ fontSize: 14, color: '#7F1D1D' }}>
            {classifySaveError(historyErr) === 'expired' ? 'Reconnecte-toi pour retrouver ton journal.' : 'Vérifie ta connexion, puis réessaie.'}
          </Text>
          {classifySaveError(historyErr) === 'expired' && onReauth ? (
            <TouchableOpacity
              onPress={onReauth}
              accessibilityRole="button"
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Se reconnecter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => refetchHistory()}
              accessibilityRole="button"
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Réessayer</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : historyEntries.length === 0 ? (
        <View style={{ ...CARD, alignItems: 'center', gap: 12 }}>
          <Ionicons name="journal-outline" size={32} color={JOURNAL_TEAL} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>Aucune entrée pour l'instant</Text>
          <TouchableOpacity
            onPress={() => setActiveTab(TAB_TODAY)}
            accessibilityRole="button"
            style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Noter ma journée</Text>
          </TouchableOpacity>
        </View>
      ) : (
        historyEntries.map((entry: any) => {
          const m = moodMeta(entry.mood);
          return (
            <View key={entry.id} style={{ ...CARD, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ alignItems: 'center', width: 56, gap: 4 }}>
                <Ionicons name={m.icon as any} size={28} color={JOURNAL_TEAL} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1A17' }}>{m.label}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, color: '#6B6963', fontWeight: '700' }}>
                  {`${formatRelativeDate(entry)} · ${contextLabel(entry.context)}`}
                </Text>
                <Text numberOfLines={2} style={{ fontSize: 14, color: '#1C1A17', marginTop: 3 }}>
                  {entry.notes ? entry.notes : 'Sans note'}
                </Text>
                {(entry.energy || entry.stress) && (
                  <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 3 }}>
                    {[entry.energy ? `Énergie ${entry.energy}/5` : null, entry.stress ? `Stress ${entry.stress}/5` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PluginHeader title="Journal" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === TAB_TODAY && <JournalForm supabase={supabase} requireUser={requireUser} onReauth={onReauth} />}
        {activeTab === TAB_HISTORY && renderHistory()}
      </ScrollView>
    </SafeAreaView>
  );
}

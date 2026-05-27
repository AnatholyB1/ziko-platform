import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIOLET = '#7B5BD0';

const TABS = ["Aujourd'hui", 'Historique', 'Tendances'];

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const MOODS = [
  { v: 1, e: '😞', l: 'Mauvais' },
  { v: 2, e: '😕', l: 'Bof' },
  { v: 3, e: '😐', l: 'Ok' },
  { v: 4, e: '🙂', l: 'Bien' },
  { v: 5, e: '🤩', l: 'Excellent' },
];

const CONTEXTS = ['Matin', 'Post-séance', 'Pré-séance', 'Soir'];

const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '🤩',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const entryDateStr = date.toISOString().split('T')[0];

  if (entryDateStr === todayStr) return "Aujourd'hui";
  if (entryDateStr === yesterdayStr) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
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

// ─── JournalPlugin ────────────────────────────────────────────────────────────

export default function JournalPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("Aujourd'hui");
  const [mood, setMood] = useState<number>(4);
  const [selectedContext, setSelectedContext] = useState<string>('Matin');
  const [notes, setNotes] = useState<string>('');

  // ── Fetch userId ──────────────────────────────────────────────────────────

  const { data: userId } = useQuery({
    queryKey: ['journal_user_id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: Infinity,
  });

  // ── History query ─────────────────────────────────────────────────────────

  const {
    data: historyEntries = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['journal_history', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Trends query (7 last entries) ────────────────────────────────────────

  const { data: trendEntries = [] } = useQuery({
    queryKey: ['journal_trends', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('mood, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Insert mutation ───────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (payload: { mood: number; context: string; notes: string; user_id: string }) => {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: payload.user_id,
        mood: payload.mood,
        context: payload.context.toLowerCase().replace('-', '_'),
        notes: payload.notes,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMood(4);
      setNotes('');
      setSelectedContext('Matin');
      queryClient.invalidateQueries({ queryKey: ['journal_history', userId] });
      queryClient.invalidateQueries({ queryKey: ['journal_trends', userId] });
    },
    onError: (err: any) => {
      showAlert('Erreur', err?.message ?? 'Impossible d\'enregistrer l\'entrée.');
    },
  });

  // ── Build trends bar data ─────────────────────────────────────────────────

  const trendBarsData = (() => {
    const result: Array<{ l: string; v: number; today?: boolean }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = trendEntries.find((e: any) => e.created_at?.startsWith(dateStr));
      result.push({
        l: DAY_LABELS[d.getDay()],
        v: entry ? entry.mood : 0,
        today: i === 0,
      });
    }
    return result;
  })();

  const avgMood =
    trendEntries.length > 0
      ? trendEntries.reduce((sum: number, e: any) => sum + (e.mood ?? 0), 0) / trendEntries.length
      : 0;

  const aiSuggestionText =
    avgMood === 0
      ? 'Commence à noter ton humeur pour suivre ta semaine mentale.'
      : avgMood < 3
      ? 'Ta semaine a été éprouvante. Planifie une activité plaisir demain.'
      : avgMood >= 4
      ? 'Belle semaine mentalement ! Continue sur cette lancée.'
      : 'Humeur stable cette semaine. Une sortie cardio peut booster l\'énergie.';

  // ── Handle save ───────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!userId) {
      showAlert('Erreur', 'Utilisateur non connecté.');
      return;
    }
    mutation.mutate({ mood, context: selectedContext, notes, user_id: userId });
  };

  // ─── Tab: Aujourd'hui ─────────────────────────────────────────────────────

  const renderToday = () => (
    <View style={{ gap: 12 }}>
      {/* Mood card */}
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
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17', marginBottom: 14 }}>
          Comment tu te sens aujourd'hui ?
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {MOODS.map((m) => (
            <TouchableOpacity
              key={m.v}
              onPress={() => setMood(m.v)}
              style={{
                flex: 1,
                padding: 12,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: mood === m.v ? 'rgba(123,91,208,0.14)' : 'transparent',
                borderWidth: mood === m.v ? 1.5 : 1,
                borderColor: mood === m.v ? VIOLET : '#E2E0DA',
              }}
            >
              <Text style={{ fontSize: 24 }}>{m.e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ textAlign: 'center', fontSize: 11, color: '#6B6963', marginTop: 8 }}>
          {MOODS.find((m) => m.v === mood)?.l}
        </Text>
      </View>

      {/* Context chips */}
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
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17', marginBottom: 10 }}>
          Contexte
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONTEXTS.map((ctx) => (
            <TouchableOpacity
              key={ctx}
              onPress={() => setSelectedContext(ctx)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: selectedContext === ctx ? VIOLET : 'rgba(123,91,208,0.10)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selectedContext === ctx ? '#fff' : VIOLET,
                }}
              >
                {ctx}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes card */}
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
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17', marginBottom: 10 }}>
          Note du jour
        </Text>
        <TextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Énergie, douleurs, motivation…"
          placeholderTextColor="#6B6963"
          style={{
            minHeight: 60,
            fontSize: 13,
            color: '#1C1A17',
            backgroundColor: 'transparent',
            textAlignVertical: 'top',
          }}
        />
      </View>

      {/* AI suggestion */}
      <AISuggestion
        tintColor={VIOLET}
        text="Note ton humeur chaque jour pour suivre l'impact de tes entraînements sur ton bien-être mental."
      />

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={mutation.isPending}
        style={{
          backgroundColor: VIOLET,
          borderRadius: 14,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        }}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Enregistrer</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ─── Tab: Historique ──────────────────────────────────────────────────────

  const renderHistory = () => {
    if (historyLoading) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color={VIOLET} />
        </View>
      );
    }

    if (historyEntries.length === 0) {
      return (
        <Text style={{ color: '#6B6963', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
          Pas encore d'entrée — commence à écrire aujourd'hui
        </Text>
      );
    }

    return (
      <View style={{ gap: 8 }}>
        {historyEntries.map((entry: any) => (
          <View
            key={entry.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E2E0DA',
              padding: 12,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              ...CARD_SHADOW,
            }}
          >
            <Text style={{ fontSize: 24 }}>{MOOD_EMOJI[entry.mood as number] ?? '😐'}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, color: '#6B6963', fontWeight: '700' }}>
                {formatRelativeDate(entry.created_at)}
              </Text>
              <Text style={{ fontSize: 12, color: '#1C1A17', marginTop: 3, lineHeight: 17 }}>
                {entry.notes ? entry.notes.slice(0, 40) : 'Sans note'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ─── Tab: Tendances ───────────────────────────────────────────────────────

  const renderTrends = () => (
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
          Humeur · 7 jours
        </Text>
        <MiniBars data={trendBarsData} color={VIOLET} max={5} />
        {avgMood > 0 && (
          <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 10 }}>
            Moyenne : {avgMood.toFixed(1)}/5
          </Text>
        )}
      </View>
      <AISuggestion tintColor={VIOLET} text={aiSuggestionText} />
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PluginHeader title="Journal" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === "Aujourd'hui" && renderToday()}
        {activeTab === 'Historique' && renderHistory()}
        {activeTab === 'Tendances' && renderTrends()}
      </ScrollView>
    </SafeAreaView>
  );
}

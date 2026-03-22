import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useJournalStore } from '../store';
import type { JournalEntry } from '../store';

// Cross-plugin: sleep for recovery correlation
let useSleepStore: any = null;
try { useSleepStore = require('@ziko/plugin-sleep').useSleepStore; } catch {}
// Cross-plugin: workout store for last session
let useWorkoutStoreExt: any = null;
try { useWorkoutStoreExt = require('@ziko/plugin-cardio').useCardioStore; } catch {}

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'];
const CONTEXT_LABELS: Record<string, string> = {
  pre_workout: 'Pré-séance',
  post_workout: 'Post-séance',
  morning: 'Matin',
  evening: 'Soir',
  general: 'Général',
};

export default function JournalDashboard({ supabase }: { supabase: any }) {
  const { entries, setEntries, loading, setLoading, getAverageMood, getAverageEnergy, getAverageStress } = useJournalStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);

      setEntries(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const avgMood = getAverageMood(7);
  const avgEnergy = getAverageEnergy(7);
  const avgStress = getAverageStress(7);

  const renderStat = (label: string, value: number, icon: string, color: string) => (
    <View style={{
      flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center',
    }}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20, marginTop: 6 }}>
        {value > 0 ? value.toFixed(1) : '—'}
      </Text>
      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );

  const renderEntry = (entry: JournalEntry) => (
    <View
      key={entry.id}
      style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 28 }}>{MOOD_EMOJI[entry.mood - 1] ?? '😐'}</Text>
          <View>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>
              {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {CONTEXT_LABELS[entry.context] ?? entry.context}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="flash" size={14} color="#FF9800" />
            <Text style={{ color: theme.muted, fontSize: 12 }}>{entry.energy}/5</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="pulse" size={14} color="#F44336" />
            <Text style={{ color: theme.muted, fontSize: 12 }}>{entry.stress}/5</Text>
          </View>
        </View>
      </View>
      {entry.notes ? (
        <Text style={{ color: theme.muted, fontSize: 13, marginTop: 10, lineHeight: 18 }} numberOfLines={3}>
          {entry.notes}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Journal</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Humeur & mindset</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(plugins)/journal/entry' as any)}
            style={{
              backgroundColor: theme.primary, borderRadius: 12,
              width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Weekly stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {renderStat('Humeur', avgMood, 'happy-outline', '#4CAF50')}
          {renderStat('Énergie', avgEnergy, 'flash-outline', '#FF9800')}
          {renderStat('Stress', avgStress, 'pulse-outline', '#F44336')}
        </View>

        {/* Cross-plugin insights */}
        {(useSleepStore) && (() => {
          const sleepData = useSleepStore ? useSleepStore() : null;
          const lastSleep = sleepData?.logs?.[0];
          const recoveryScore = sleepData?.getRecoveryScore?.() ?? 0;
          if (!lastSleep) return null;
          const recoveryColor = recoveryScore >= 70 ? '#4CAF50' : recoveryScore >= 40 ? '#FF9800' : '#F44336';
          return (
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/sleep/dashboard' as any)}
              activeOpacity={0.75}
              style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 16,
                borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#9C27B018', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="moon" size={18} color="#9C27B0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Sommeil : {lastSleep.duration_hours ? `${Math.floor(lastSleep.duration_hours)}h${Math.round((lastSleep.duration_hours % 1) * 60) > 0 ? Math.round((lastSleep.duration_hours % 1) * 60) : ''}` : '—'}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Qualité {lastSleep.quality}/5 · Récup. {recoveryScore}%</Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: recoveryColor }} />
            </TouchableOpacity>
          );
        })()}

        {/* Entries */}
        {loading && entries.length === 0 ? (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>Chargement...</Text>
        ) : entries.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📝</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
              Aucune entrée
            </Text>
            <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 14 }}>
              Commencez à noter votre humeur pour suivre votre bien-être mental.
            </Text>
          </View>
        ) : (
          entries.map(renderEntry)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

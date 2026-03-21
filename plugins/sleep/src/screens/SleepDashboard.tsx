import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useSleepStore } from '../store';

function QualityStars({ quality, theme }: { quality: number; theme: any }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= quality ? 'star' : 'star-outline'} size={14} color={i <= quality ? '#FFB800' : theme.border} />
      ))}
    </View>
  );
}

export default function SleepDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { logs, setLogs, isLoading, setIsLoading, getAverageDuration, getAverageQuality, getRecoveryScore } = useSleepStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('sleep_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      if (data) setLogs(data);
    } catch {}
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const avgDuration = getAverageDuration();
  const avgQuality = getAverageQuality();
  const recovery = getRecoveryScore();
  const hours = Math.floor(avgDuration / 60);
  const mins = avgDuration % 60;
  const recoveryColor = recovery >= 70 ? '#4CAF50' : recovery >= 40 ? '#FF9800' : '#F44336';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Sommeil</Text>
        <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>Suivi & récupération</Text>

        {/* Recovery score */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 20,
          marginTop: 20, borderWidth: 1, borderColor: theme.border, alignItems: 'center',
        }}>
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>Score de récupération</Text>
          <View style={{
            width: 100, height: 100, borderRadius: 50, borderWidth: 6,
            borderColor: recoveryColor, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 32, fontWeight: '800' }}>{recovery}</Text>
          </View>
          <Text style={{ color: recoveryColor, fontSize: 14, fontWeight: '600', marginTop: 8 }}>
            {recovery >= 70 ? 'Bien reposé ✓' : recovery >= 40 ? 'Récupération moyenne' : 'Repos insuffisant'}
          </Text>
        </View>

        {/* Weekly stats */}
        <View style={{
          flexDirection: 'row', marginTop: 16, gap: 12,
        }}>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '800' }}>{hours}h{mins > 0 ? `${mins}` : ''}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Moy. durée</Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '800' }}>{avgQuality}/5</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Moy. qualité</Text>
          </View>
        </View>

        {/* Log button */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/sleep/log')}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 20,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Logger mon sommeil</Text>
        </TouchableOpacity>

        {/* Recent logs */}
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
          Historique récent
        </Text>
        {logs.slice(0, 10).map((log) => {
          const h = Math.floor(log.duration_minutes / 60);
          const m = log.duration_minutes % 60;
          return (
            <View key={log.id} style={{
              backgroundColor: theme.surface, borderRadius: 12, padding: 14,
              marginBottom: 8, borderWidth: 1, borderColor: theme.border,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{log.date}</Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>{log.bedtime} → {log.wake_time} · {h}h{m > 0 ? m + 'min' : ''}</Text>
              </View>
              <QualityStars quality={log.quality} theme={theme} />
            </View>
          );
        })}
        {logs.length === 0 && (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>
            Aucun sommeil enregistré
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

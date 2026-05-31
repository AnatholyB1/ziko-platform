import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useWearablesStore } from '../store';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#2E7BF6';
const TABS = ["Aujourd'hui", 'Connexion'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface WearableDailySummary {
  user_id: string;
  date: string;
  steps: number;
  calories_burned: number;
  active_minutes: number;
  heart_rate_avg: number;
  sleep_hours: number;
  last_synced_at: string;
}

interface HealthSyncLog {
  user_id: string;
  platform: 'apple_health' | 'health_connect';
  last_sync_at: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

function platformDisplayName(platform: string): string {
  if (platform === 'apple_health') return 'Apple Health';
  if (platform === 'health_connect') return 'Health Connect';
  return platform;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon,
  value,
  label,
  color,
  theme,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  theme: any;
}) {
  return (
    <View style={{
      ...CARD_SHADOW,
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: color + '24',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
      }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WearablesPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const today = getToday();

  const {
    syncStatus,
    isLoading: storeLoading,
    error: storeError,
    initialize,
    requestPermissions,
    syncAll,
  } = useWearablesStore();

  // Auto-initialize on Android when entering Connexion tab
  useEffect(() => {
    if (activeTab === TABS[1] && Platform.OS === 'android' && !syncStatus.isConnected) {
      initialize();
    }
  }, [activeTab]);

  async function handleHealthConnectConnect() {
    await initialize();
    // re-read store state after initialize
    const { syncStatus: s } = useWearablesStore.getState();
    if (!s.isConnected) return; // storeError is already set
    const granted = await requestPermissions();
    if (granted) {
      showAlert('Health Connect', 'Permissions accordées. Synchronisation en cours…');
      syncAll();
    } else {
      showAlert(
        'Health Connect',
        'Permissions refusées. Ouvre les paramètres Health Connect pour les accorder manuellement.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir les paramètres',
            onPress: () => {
              try {
                const HC = require('react-native-health-connect');
                HC.openHealthConnectSettings();
              } catch {
                // fallback: open HC package via Linking
                const { Linking } = require('react-native');
                Linking.openURL('package:com.google.android.apps.healthdata').catch(() => {});
              }
            },
          },
        ],
      );
    }
  }

  async function handleSync() {
    await syncAll();
    showAlert('Synchronisation', 'Données mises à jour.');
  }

  // ─── Auth query ─────────────────────────────────────────────────────────────

  const { data: userInfo } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = userInfo?.id ?? null;

  // ─── Today summary query ─────────────────────────────────────────────────────

  const { data: summaryRows = [], isLoading: loadingSummary } = useQuery<WearableDailySummary[]>({
    queryKey: ['wearable_daily_summary', userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('wearable_daily_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const summary: WearableDailySummary | null = summaryRows.length > 0 ? summaryRows[0] : null;

  // ─── Health sync log query ────────────────────────────────────────────────────

  const { data: syncLogs = [], isLoading: loadingSync } = useQuery<HealthSyncLog[]>({
    queryKey: ['health_sync_log', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('health_sync_log')
        .select('*')
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ─── AI suggestion text ──────────────────────────────────────────────────────

  const aiText = summary
    ? summary.steps < 5000
      ? `Seulement ${summary.steps.toLocaleString('fr-FR')} pas aujourd'hui. Un tour de 20 min = +2000 pas.`
      : `Belle activité ! Tes ${summary.steps.toLocaleString('fr-FR')} pas d'aujourd'hui contribuent à ta santé cardiaque.`
    : "Connecte ton Apple Health ou Health Connect pour suivre tes données santé automatiquement.";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Wearables" onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ─── Tab: Aujourd'hui ─────────────────────────────────────── */}
        {activeTab === TABS[0] && (
          <View>
            {loadingSummary ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
            ) : !summary ? (
              /* Empty state */
              <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
                <Ionicons name="watch-outline" size={48} color={theme.muted} />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 14, textAlign: 'center' }}>
                  Aucune donnée pour aujourd'hui
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                  Synchronise ton appareil
                </Text>
                <View style={{ marginTop: 20, width: '100%' }}>
                  <AISuggestion
                    tintColor={ACCENT}
                    text={aiText}
                  />
                </View>
              </View>
            ) : (
              /* Metric grid 2×2 */
              <>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <MetricCard
                    icon="footsteps-outline"
                    value={summary.steps?.toLocaleString('fr-FR') ?? '—'}
                    label="Pas aujourd'hui"
                    color={ACCENT}
                    theme={theme}
                  />
                  <MetricCard
                    icon="heart-outline"
                    value={summary.heart_rate_avg ? `${summary.heart_rate_avg} bpm` : '—'}
                    label="FC moy."
                    color="#E94B3C"
                    theme={theme}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  <MetricCard
                    icon="flame-outline"
                    value={summary.calories_burned ? `${summary.calories_burned} kcal` : '—'}
                    label="Calories brûlées"
                    color="#F59E0B"
                    theme={theme}
                  />
                  <MetricCard
                    icon="moon-outline"
                    value={summary.sleep_hours ? `${Number(summary.sleep_hours).toFixed(1)}h` : '—'}
                    label="Sommeil"
                    color="#7B5BD0"
                    theme={theme}
                  />
                </View>
                <AISuggestion
                  tintColor={ACCENT}
                  text={aiText}
                />
              </>
            )}
          </View>
        )}

        {/* ─── Tab: Connexion ───────────────────────────────────────── */}
        {activeTab === TABS[1] && (
          <View>
            {storeLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
            ) : syncStatus.isConnected ? (
              /* Connected: store status */
              <>
                <View style={{
                  ...CARD_SHADOW,
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#2E9E5B24',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark-circle" size={20} color="#2E9E5B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                      {platformDisplayName(syncStatus.platform)}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                      {syncStatus.permissionsGranted ? 'Permissions accordées' : 'Permissions en attente'}
                      {syncStatus.lastSyncAt ? ` · Sync : ${formatSyncTime(syncStatus.lastSyncAt)}` : ''}
                    </Text>
                  </View>
                  {!syncStatus.permissionsGranted ? (
                    <TouchableOpacity onPress={handleHealthConnectConnect}>
                      <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '600' }}>Autoriser</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleSync}>
                      <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '600' }}>Sync</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* DB sync logs */}
                {syncLogs.map((log, idx) => (
                  <View
                    key={idx}
                    style={{
                      ...CARD_SHADOW,
                      backgroundColor: theme.surface,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Ionicons name="cloud-done-outline" size={18} color="#2E9E5B" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>
                        Dernière sync BD : {formatSyncTime(log.last_sync_at)} · {log.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              /* Not connected */
              <>
                {storeError && (
                  <View style={{
                    backgroundColor: '#E94B3C18',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <Ionicons name="warning-outline" size={18} color="#E94B3C" />
                    <Text style={{ color: '#E94B3C', fontSize: 12, flex: 1 }}>{storeError}</Text>
                  </View>
                )}

                {/* Apple Health — iOS only, informational */}
                <View style={{
                  ...CARD_SHADOW,
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: Platform.OS === 'ios' ? 1 : 0.4,
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'rgba(46,123,246,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="phone-portrait-outline" size={18} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>Apple Health</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>iOS uniquement</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                </View>

                {/* Health Connect — Android, tappable */}
                <TouchableOpacity
                  style={{
                    ...CARD_SHADOW,
                    backgroundColor: theme.surface,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: Platform.OS === 'android' ? ACCENT + '44' : theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: Platform.OS === 'android' ? 1 : 0.4,
                  }}
                  onPress={Platform.OS === 'android' ? handleHealthConnectConnect : undefined}
                  activeOpacity={0.75}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'rgba(46,123,246,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="logo-android" size={18} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>Health Connect</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                      {Platform.OS === 'android' ? 'Appuie pour connecter' : 'Android uniquement'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Platform.OS === 'android' ? ACCENT : theme.muted} />
                </TouchableOpacity>

                <Text style={{
                  color: theme.muted,
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 18,
                }}>
                  La connexion native nécessite l'app mobile avec permissions activées.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

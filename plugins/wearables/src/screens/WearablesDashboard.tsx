import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useWearablesStore } from '../store';
import type { HealthSummary, StepData } from '../store';

const STEPS_GOAL = 10000;

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon, label, value, unit, color, theme }: {
  icon: string; label: string; value: string; unit: string; color: string; theme: any;
}) {
  return (
    <View style={{
      flex: 1, minWidth: '45%', backgroundColor: theme.surface, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: theme.border, gap: 8,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>{value}</Text>
        <Text style={{ color: theme.muted, fontSize: 12 }}>{unit}</Text>
      </View>
    </View>
  );
}

function StepBar({ data, maxSteps, theme }: { data: StepData; maxSteps: number; theme: any }) {
  const pct = Math.min(data.count / Math.max(maxSteps, 1), 1);
  const dayLabel = new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'short' });
  const reached = data.count >= STEPS_GOAL;

  return (
    <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
      <Text style={{ color: theme.muted, fontSize: 10 }}>
        {data.count >= 1000 ? `${(data.count / 1000).toFixed(1)}k` : data.count}
      </Text>
      <View style={{
        width: 24, height: 100, borderRadius: 12,
        backgroundColor: theme.border, overflow: 'hidden', justifyContent: 'flex-end',
      }}>
        <View style={{
          width: '100%', height: `${Math.round(pct * 100)}%`,
          backgroundColor: reached ? '#4CAF50' : theme.primary,
          borderRadius: 12,
        }} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '500' }}>{dayLabel}</Text>
    </View>
  );
}

export default function WearablesDashboard({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const {
    syncStatus, todaySummary, weeklySteps, isLoading, error,
    initialize, requestPermissions, syncAll,
  } = useWearablesStore();
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const doInit = useCallback(async () => {
    await initialize();
    setInitialized(true);
  }, []);

  useEffect(() => { doInit(); }, []);

  useEffect(() => {
    if (initialized && syncStatus.isConnected && syncStatus.permissionsGranted) {
      syncAll();
    }
  }, [initialized, syncStatus.isConnected, syncStatus.permissionsGranted]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncAll();
    setRefreshing(false);
  };

  const handleConnect = async () => {
    if (!syncStatus.isConnected) {
      await initialize();
      if (!useWearablesStore.getState().syncStatus.isConnected) {
        if (Platform.OS === 'android') {
          showAlert(
            'Health Connect requis',
            'L\'application Health Connect est nécessaire pour synchroniser vos données de santé. Voulez-vous l\'installer depuis le Play Store ?',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Installer',
                onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
              },
            ],
          );
        } else {
          showAlert('Non disponible', 'Apple Health n\'est pas disponible sur cet appareil.');
        }
        return;
      }
    }
    if (!syncStatus.permissionsGranted) {
      const granted = await requestPermissions();
      if (!granted) {
        showAlert('Permissions refusées', 'Autorisez l\'accès aux données de santé dans les réglages.');
        return;
      }
    }
    await syncAll();
  };

  const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const platformIcon = Platform.OS === 'ios' ? 'logo-apple' : 'fitness';
  const summary = todaySummary;

  const maxWeeklySteps = weeklySteps.reduce((max, s) => Math.max(max, s.count), STEPS_GOAL);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Wearables</Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
            Données de santé via {platformName}
          </Text>
        </View>

        {/* Connection status */}
        <TouchableOpacity
          onPress={handleConnect}
          style={{
            backgroundColor: syncStatus.isConnected && syncStatus.permissionsGranted
              ? '#4CAF50' + '11' : theme.primary + '11',
            borderRadius: 16, padding: 16, marginBottom: 24,
            borderWidth: 1,
            borderColor: syncStatus.isConnected && syncStatus.permissionsGranted
              ? '#4CAF50' + '33' : theme.primary + '33',
            flexDirection: 'row', alignItems: 'center', gap: 14,
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: syncStatus.isConnected ? '#4CAF5018' : theme.primary + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons
              name={platformIcon as any}
              size={24}
              color={syncStatus.isConnected ? '#4CAF50' : theme.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
              {platformName}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {syncStatus.isConnected && syncStatus.permissionsGranted
                ? syncStatus.lastSyncAt
                  ? `Dernière sync : ${formatTime(syncStatus.lastSyncAt)}`
                  : 'Connecté — tirez pour synchroniser'
                : syncStatus.isConnected
                  ? 'Appuyez pour autoriser l\'accès'
                  : 'Appuyez pour connecter'}
            </Text>
          </View>
          <View style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: syncStatus.isConnected && syncStatus.permissionsGranted ? '#4CAF50' : '#FF9800',
          }} />
        </TouchableOpacity>

        {/* Error */}
        {error && (
          <View style={{
            backgroundColor: '#F4433611', borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: '#F4433633', marginBottom: 20,
          }}>
            <Text style={{ color: '#F44336', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Today summary cards */}
        {summary && (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Aujourd'hui
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <StatCard
                icon="footsteps"
                label="Pas"
                value={summary.steps.toLocaleString('fr-FR')}
                unit={`/ ${(STEPS_GOAL / 1000).toFixed(0)}k`}
                color={summary.steps >= STEPS_GOAL ? '#4CAF50' : theme.primary}
                theme={theme}
              />
              <StatCard
                icon="flame"
                label="Calories actives"
                value={String(summary.calories_active)}
                unit="kcal"
                color="#FF5722"
                theme={theme}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              <StatCard
                icon="heart"
                label="Fréq. cardiaque"
                value={summary.heart_rate_avg ? String(summary.heart_rate_avg) : '—'}
                unit={summary.heart_rate_avg ? 'bpm' : ''}
                color="#E91E63"
                theme={theme}
              />
              <StatCard
                icon="moon"
                label="Sommeil"
                value={summary.sleep_hours ? `${summary.sleep_hours}` : '—'}
                unit={summary.sleep_hours ? 'h' : ''}
                color="#673AB7"
                theme={theme}
              />
            </View>

            {/* Resting HR */}
            {summary.heart_rate_resting && (
              <View style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: theme.border, marginBottom: 24,
                flexDirection: 'row', alignItems: 'center', gap: 14,
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: '#E91E6318', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="heart-half" size={20} color="#E91E63" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>Fréquence au repos</Text>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>
                    {summary.heart_rate_resting} bpm
                  </Text>
                </View>
                <Text style={{
                  color: summary.heart_rate_resting <= 70 ? '#4CAF50' : '#FF9800',
                  fontWeight: '600', fontSize: 13,
                }}>
                  {summary.heart_rate_resting <= 60 ? 'Excellent' :
                    summary.heart_rate_resting <= 70 ? 'Bon' :
                      summary.heart_rate_resting <= 80 ? 'Normal' : 'Élevé'}
                </Text>
              </View>
            )}

            {/* Exercises */}
            {summary.exercises.length > 0 && (
              <>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
                  Activités du jour
                </Text>
                {summary.exercises.map((ex, i) => (
                  <View key={i} style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: theme.border, marginBottom: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="barbell" size={18} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, textTransform: 'capitalize' }}>
                        {ex.type}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>
                        {ex.duration_min} min
                        {ex.calories > 0 ? ` · ${ex.calories} kcal` : ''}
                        {ex.distance_km ? ` · ${ex.distance_km} km` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={{ height: 16 }} />
              </>
            )}
          </>
        )}

        {/* Weekly steps chart */}
        {weeklySteps.length > 0 && (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Pas — 7 derniers jours
            </Text>
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 20,
              borderWidth: 1, borderColor: theme.border, marginBottom: 24,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
                {weeklySteps
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((s) => (
                    <StepBar key={s.date} data={s} maxSteps={maxWeeklySteps} theme={theme} />
                  ))}
              </View>
              <View style={{
                borderTopWidth: 1, borderTopColor: theme.border, marginTop: 12, paddingTop: 12,
                flexDirection: 'row', justifyContent: 'space-between',
              }}>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  Moyenne : {Math.round(weeklySteps.reduce((s, d) => s + d.count, 0) / weeklySteps.length).toLocaleString('fr-FR')} pas
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  Objectif : {STEPS_GOAL.toLocaleString('fr-FR')}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Not connected state */}
        {!syncStatus.isConnected && !isLoading && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 20, padding: 32,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center', gap: 16,
          }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: theme.primary + '11', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="watch-outline" size={40} color={theme.primary} />
            </View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
              Connectez votre montre
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Synchronisez vos pas, fréquence cardiaque, sommeil et activités via {platformName}.
            </Text>
            <TouchableOpacity
              onPress={handleConnect}
              style={{
                backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                Connecter {platformName}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cross-plugin links */}
        {syncStatus.isConnected && (
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/sleep/dashboard' as any)}
              style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#673AB718', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="moon" size={18} color="#673AB7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Sommeil</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Analyse détaillée du sommeil</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/cardio/dashboard' as any)}
              style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="fitness" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Cardio</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Sessions cardio détaillées</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(app)/(plugins)/measurements/dashboard' as any)}
              style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#00968818', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="body" size={18} color="#009688" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Mesures</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Poids et composition corporelle</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.muted} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

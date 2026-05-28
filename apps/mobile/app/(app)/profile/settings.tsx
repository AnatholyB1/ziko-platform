import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Modal,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert, usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import { STGroup, STRow, STToggle } from '@ziko/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { useUserPrefsStore } from '../../../src/stores/userPrefsStore';

// ── Shared chrome ──────────────────────────────────────────────
function STHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    }}>
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: 'rgba(28,26,23,0.06)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>{title}</Text>
    </View>
  );
}

// ── Notifications sub-screen ───────────────────────────────────
function NotifSubScreen({ onBack, userId }: { onBack: () => void; userId: string }) {
  const theme = useThemeStore((s) => s.theme);
  const [isLoading, setIsLoading] = useState(true);
  const [notifDenied, setNotifDenied] = useState(false);
  const [s, setS] = useState({
    push_enabled: true,
    coach_enabled: true,
    workout_enabled: true,
    gamification_enabled: true,
    health_enabled: true,
    system_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 7,
  });
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ canAskAgain, status }) => {
      setNotifDenied(status === 'denied' && !canAskAgain);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const tzOffset = Math.round(-new Date().getTimezoneOffset() / 60);
        await supabase
          .from('notification_preferences')
          .upsert(
            {
              user_id: userId,
              push_enabled: true,
              coach_enabled: true,
              workout_enabled: true,
              gamification_enabled: true,
              health_enabled: true,
              system_enabled: true,
              quiet_hours_start: 22,
              quiet_hours_end: 7,
              timezone_offset: tzOffset,
            },
            { onConflict: 'user_id', ignoreDuplicates: true }
          );
        const { data } = await supabase
          .from('notification_preferences')
          .select('push_enabled, coach_enabled, workout_enabled, gamification_enabled, health_enabled, system_enabled, quiet_hours_start, quiet_hours_end')
          .eq('user_id', userId)
          .single();
        if (data) {
          setS({
            push_enabled: data.push_enabled ?? true,
            coach_enabled: data.coach_enabled ?? true,
            workout_enabled: data.workout_enabled ?? true,
            gamification_enabled: data.gamification_enabled ?? true,
            health_enabled: data.health_enabled ?? true,
            system_enabled: data.system_enabled ?? true,
            quiet_hours_start: data.quiet_hours_start ?? 22,
            quiet_hours_end: data.quiet_hours_end ?? 7,
          });
        }
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    })();
  }, [userId]);

  const handleChange = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch };
    setS(next);
    clearTimeout(saveRef.current);
    const tzOffset = Math.round(-new Date().getTimezoneOffset() / 60);
    saveRef.current = setTimeout(async () => {
      await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: userId,
            push_enabled: next.push_enabled,
            coach_enabled: next.coach_enabled,
            workout_enabled: next.workout_enabled,
            gamification_enabled: next.gamification_enabled,
            health_enabled: next.health_enabled,
            system_enabled: next.system_enabled,
            quiet_hours_start: next.quiet_hours_start,
            quiet_hours_end: next.quiet_hours_end,
            timezone_offset: tzOffset,
          },
          { onConflict: 'user_id' }
        );
    }, 600);
  };

  const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => ({
    id: String(i),
    label: `${i}h00`,
  }));

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <STHeader onBack={onBack} title="Notifications" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#FF5C1A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        {notifDenied && (
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              paddingHorizontal: 20,
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Ionicons name="notifications-off-outline" size={20} color="#FF5C1A" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: '#1C1A17' }}>
                Réactiver les notifications
              </Text>
              <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>
                Les notifications sont bloquées — ouvrir les réglages système
              </Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color="#6B6963" />
          </TouchableOpacity>
        )}
        <STGroup>
          <STRow
            icon="notifications-outline"
            tint="#FF5C1A"
            label="Toutes les notifications"
            toggleValue={s.push_enabled}
            onToggle={(v) => handleChange({ push_enabled: v })}
          />
        </STGroup>

        <View style={{ opacity: s.push_enabled ? 1 : 0.4 }} pointerEvents={s.push_enabled ? 'auto' : 'none'}>
          <STGroup title="Catégories">
            <STRow
              icon="person-outline"
              tint="#FF5C1A"
              label="Coach"
              toggleValue={s.coach_enabled}
              onToggle={(v) => handleChange({ coach_enabled: v })}
            />
            <STRow
              icon="barbell-outline"
              tint="#E94B3C"
              label="Workout"
              toggleValue={s.workout_enabled}
              onToggle={(v) => handleChange({ workout_enabled: v })}
            />
            <STRow
              icon="trophy-outline"
              tint="#E8A33A"
              label="Gamification"
              toggleValue={s.gamification_enabled}
              onToggle={(v) => handleChange({ gamification_enabled: v })}
            />
            <STRow
              icon="heart-outline"
              tint="#22C55E"
              label="Santé & Habitudes"
              toggleValue={s.health_enabled}
              onToggle={(v) => handleChange({ health_enabled: v })}
            />
            <STRow
              icon="phone-portrait-outline"
              tint="#6B6963"
              label="App"
              toggleValue={s.system_enabled}
              onToggle={(v) => handleChange({ system_enabled: v })}
            />
          </STGroup>
        </View>

        {s.push_enabled && (
          <STGroup title="Heures silencieuses">
            <STRow
              icon="moon-outline"
              tint="#6B6963"
              label="De"
              right={`${s.quiet_hours_start}h00`}
              onPress={() => setStartPickerVisible(true)}
            />
            <STRow
              icon="sunny-outline"
              tint="#E8A33A"
              label="À"
              right={`${s.quiet_hours_end}h00`}
              onPress={() => setEndPickerVisible(true)}
            />
          </STGroup>
        )}
      </ScrollView>

      <InlinePicker
        visible={startPickerVisible}
        items={HOUR_ITEMS}
        selectedId={String(s.quiet_hours_start)}
        onSelect={(id) => {
          handleChange({ quiet_hours_start: parseInt(id, 10) });
          setStartPickerVisible(false);
        }}
        onClose={() => setStartPickerVisible(false)}
        theme={theme}
      />
      <InlinePicker
        visible={endPickerVisible}
        items={HOUR_ITEMS}
        selectedId={String(s.quiet_hours_end)}
        onSelect={(id) => {
          handleChange({ quiet_hours_end: parseInt(id, 10) });
          setEndPickerVisible(false);
        }}
        onClose={() => setEndPickerVisible(false)}
        theme={theme}
      />
    </SafeAreaView>
  );
}

// ── Appearance sub-screen ──────────────────────────────────────
const LANGUAGES = [
  { id: 'fr' as const, label: 'Français' },
  { id: 'en' as const, label: 'English' },
];

const REGIONS = [
  { id: 'FR', label: 'France' },
  { id: 'BE', label: 'Belgique' },
  { id: 'CH', label: 'Suisse' },
  { id: 'CA', label: 'Canada' },
  { id: 'US', label: 'États-Unis' },
];

type PickerItem = { id: string; label: string };

function InlinePicker({
  visible,
  items,
  selectedId,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  theme: any;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{
          backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 32, paddingTop: 8,
        }}>
          <View style={{
            width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA',
            alignSelf: 'center', marginBottom: 16,
          }} />
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => { onSelect(item.id); onClose(); }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 14, paddingHorizontal: 20,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#E2E0DA',
              }}
            >
              <Text style={{ fontSize: 16, color: theme.text, fontWeight: item.id === selectedId ? '700' : '400' }}>
                {item.label}
              </Text>
              {item.id === selectedId && (
                <Ionicons name="checkmark" size={18} color="#FF5C1A" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function AppearanceSubScreen({ onBack, userId }: { onBack: () => void; userId: string }) {
  const theme = useThemeStore((s) => s.theme);
  const { units, language, region, setPrefs } = useUserPrefsStore();
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('user_profiles').select('units, language, region').eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            units: (data as any).units ?? 'metric',
            language: (data as any).language ?? 'fr',
            region: (data as any).region ?? 'FR',
          });
        }
      });
  }, [userId]);

  const handleLanguageSelect = async (id: 'fr' | 'en') => {
    setPrefs({ language: id });
    await supabase.from('user_profiles').update({ language: id }).eq('id', userId);
  };

  const handleRegionSelect = async (id: string) => {
    setPrefs({ region: id });
    await supabase.from('user_profiles').update({ region: id }).eq('id', userId);
  };

  const handleUnitSelect = async (id: 'metric' | 'imperial') => {
    setPrefs({ units: id });
    await supabase.from('user_profiles').update({ units: id }).eq('id', userId);
  };

  const langLabel = LANGUAGES.find((l) => l.id === language)?.label ?? 'Français';
  const regionLabel = REGIONS.find((r) => r.id === region)?.label ?? region;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Apparence" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>

        <STGroup title="Langue & région">
          <STRow
            icon="globe-outline"
            tint="#3B82F6"
            label="Langue"
            right={langLabel}
            onPress={() => setLangPickerVisible(true)}
          />
          <STRow
            icon="flag-outline"
            tint="#FF5C1A"
            label="Région"
            right={regionLabel}
            onPress={() => setRegionPickerVisible(true)}
          />
        </STGroup>

        {/* Units section */}
        <Text style={{
          fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase',
          color: theme.muted, paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
        }}>UNITÉS</Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 12, overflow: 'hidden',
          shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
        }}>
          {([
            { id: 'metric' as const,   label: 'Métrique', sub: 'kg · cm · km' },
            { id: 'imperial' as const, label: 'Impérial',  sub: 'lb · in · mi' },
          ]).map((u, i) => (
            <TouchableOpacity
              key={u.id}
              onPress={() => handleUnitSelect(u.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
                borderTopWidth: i ? 1 : 0, borderTopColor: '#E2E0DA',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{u.label}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{u.sub}</Text>
              </View>
              {units === u.id && (
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <InlinePicker
        visible={langPickerVisible}
        items={LANGUAGES}
        selectedId={language}
        onSelect={(id) => handleLanguageSelect(id as 'fr' | 'en')}
        onClose={() => setLangPickerVisible(false)}
        theme={theme}
      />
      <InlinePicker
        visible={regionPickerVisible}
        items={REGIONS}
        selectedId={region}
        onSelect={handleRegionSelect}
        onClose={() => setRegionPickerVisible(false)}
        theme={theme}
      />
    </SafeAreaView>
  );
}

// ── Integrations sub-screen ────────────────────────────────────
const INTEGRATIONS_LIST = [
  { id: 'apple_health', name: 'Apple Health',   sub: 'Activité, sommeil, fréquence cardiaque', icon: 'heart-outline' as const,     tint: '#FF3B30' },
  { id: 'apple_watch',  name: 'Apple Watch',    sub: 'Synchro auto · 47 séances importées',   icon: 'watch-outline' as const,     tint: '#1C1A17' },
  { id: 'strava',       name: 'Strava',          sub: 'Importer tes activités outdoor',        icon: 'flash-outline' as const,     tint: '#FC4C02' },
  { id: 'garmin',       name: 'Garmin Connect', sub: 'Montres et capteurs Garmin',             icon: 'watch-outline' as const,     tint: '#1C1A17' },
  { id: 'myfitnesspal', name: 'MyFitnessPal',   sub: 'Synchro nutrition bidirectionnelle',    icon: 'nutrition-outline' as const, tint: '#0072CE' },
  { id: 'whoop',        name: 'Whoop',           sub: 'Récup, sommeil, charge',                icon: 'pulse-outline' as const,     tint: '#3B3B3B' },
];

function IntegrationsSubScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: connectedPlatforms = [] } = useQuery({
    queryKey: ['integrations', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('health_sync_log')
        .select('platform, synced_at')
        .eq('user_id', userId!)
        .order('synced_at', { ascending: false });
      const seen = new Set<string>();
      return (data ?? []).filter((r: any) => {
        if (seen.has(r.platform)) return false;
        seen.add(r.platform);
        return true;
      }).map((r: any) => r.platform as string);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Intégrations" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        {/* Info card */}
        <View style={{
          padding: 16, borderRadius: 12, marginBottom: 16,
          backgroundColor: 'rgba(46,123,246,0.06)',
          borderWidth: 1, borderColor: 'rgba(46,123,246,0.18)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="information-circle-outline" size={14} color="#2E7BF6" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E7BF6' }}>
              Tes données restent à toi
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.muted, lineHeight: 17 }}>
            Connexions chiffrées · révocables à tout moment · jamais revendues.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          {INTEGRATIONS_LIST.map((it) => {
            const isConnected = connectedPlatforms.includes(it.id);
            return (
              <View key={it.id} style={{
                padding: 16, borderRadius: 12,
                backgroundColor: theme.surface,
                shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: it.tint + '24',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={it.icon} size={17} color={it.tint} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{it.name}</Text>
                    {isConnected && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 18 }}>{it.sub}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isConnected) {
                      showAlert('Intégration active', `${it.name} est connecté. Gestion avancée bientôt disponible.`);
                    } else if (it.id === 'apple_health') {
                      if (Platform.OS === 'ios') {
                        Linking.openURL('App-Prefs:Privacy&path=HEALTH').catch(() =>
                          showAlert('Impossible', 'Ouvre Réglages > Confidentialité > Santé pour autoriser Ziko.')
                        );
                      } else {
                        showAlert('Android Health Connect', 'La connexion Health Connect sera disponible dans la prochaine mise à jour.');
                      }
                    } else {
                      showAlert(`${it.name}`, 'Cette intégration sera disponible dans une prochaine mise à jour. Reste connecté !');
                    }
                  }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: isConnected ? 'rgba(28,26,23,0.07)' : '#1C1A17',
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: isConnected ? theme.text : '#fff',
                  }}>
                    {isConnected ? 'Géré' : 'Connecter'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main Settings Screen ───────────────────────────────────────
type SubView = 'notifications' | 'appearance' | 'integrations' | null;

export default function SettingsScreen() {
  const theme = useThemeStore((s) => s.theme);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const installedPlugins = usePluginRegistry((s) => s.installedPlugins);
  const [sub, setSub] = useState<SubView>(null);
  const { t } = useTranslation();
  const role = profile?.role ?? 'client';
  const userId = user?.id ?? '';
  const tier = (profile as any)?.subscription_tier ?? 'free';

  const { data: connectedCount = 0 } = useQuery({
    queryKey: ['integrations-count', userId],
    queryFn: async () => {
      const { data } = await supabase.from('health_sync_log')
        .select('platform').eq('user_id', userId!);
      const seen = new Set((data ?? []).map((r: any) => r.platform));
      return seen.size;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: coachData } = useQuery({
    queryKey: ['coach-link-settings', userId],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return null;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!(role === 'client' || role === 'both') && !!userId,
    staleTime: 30_000,
  });

  const { data: credits } = useQuery({
    queryKey: ['credits-balance', userId],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return null;
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ ai_credits: number; daily_cap: number }>;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  const linkedCoachName = coachData?.preview?.display_name ?? null;

  if (sub === 'notifications') return <NotifSubScreen onBack={() => setSub(null)} userId={userId} />;
  if (sub === 'appearance')    return <AppearanceSubScreen onBack={() => setSub(null)} userId={userId} />;
  if (sub === 'integrations')  return <IntegrationsSubScreen onBack={() => setSub(null)} />;

  const initials = (profile?.name ?? user?.email ?? 'ZK').slice(0, 2).toUpperCase();
  const displayName = profile?.name ?? user?.email ?? 'Utilisateur';
  const email = user?.email ?? '';

  const handleSignOut = () => {
    showAlert('Se déconnecter ?', 'Tu seras déconnecté de ton compte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: async () => {
        try {
          await signOut();
          router.replace('/(auth)/login');
        } catch {
          showAlert('Erreur', 'La déconnexion a échoué. Réessaie.');
        }
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données seront effacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => {
          showAlert('Contacte le support', 'Pour supprimer ton compte, contacte support@ziko.app');
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={() => router.back()} title="Paramètres" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}>

        {/* Account card */}
        <View style={{
          padding: 16, borderRadius: 12, marginBottom: 16,
          backgroundColor: theme.surface,
          shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 12,
            backgroundColor: '#FF5C1A',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: '#fff' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }} numberOfLines={1}>{displayName}</Text>
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }} numberOfLines={1}>{email}</Text>
          </View>
          <View style={{
            paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999,
            backgroundColor: tier === 'premium' ? '#FF5C1A' : 'rgba(28,26,23,0.12)',
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tier === 'premium' ? '#fff' : theme.text, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {tier === 'premium' ? 'PREMIUM' : 'FREE'}
            </Text>
          </View>
        </View>

        <STGroup title="Compte">
          <STRow icon="person-outline" tint="#FF5C1A" label="Informations personnelles" sub="Nom, email, téléphone" onPress={() => router.push('/(app)/profile/edit' as any)} />
          <STRow icon="lock-closed-outline" tint="#1C1A17" label="Mot de passe" sub="Modifier" onPress={() => router.push('/(app)/profile/security' as any)} />
          <STRow icon="shield-checkmark-outline" tint="#3B82F6" label="Confidentialité" sub="Profil public · Données partagées" onPress={() => router.push('/(app)/profile/security' as any)} />
          <STRow icon="trash-outline" tint="#E94B3C" label="Supprimer le compte" danger onPress={handleDeleteAccount} />
        </STGroup>

        <STGroup title="Abonnement">
          <STRow icon="sparkles-outline" tint="#FF5C1A" label="Plan actuel" right="Premium · 9,99€/mois" onPress={() => router.push('/(app)/paywall' as any)} />
          <STRow icon="flash-outline" tint="#E8A33A" label="Crédits IA" right={credits ? `${credits.ai_credits} / ${credits.daily_cap}` : '—'} onPress={() => router.push('/(app)/ai')} />
          <STRow icon="card-outline" tint="#1C1A17" label="Moyen de paiement" sub="Visa •• 4242" onPress={() => showAlert('Paiement', 'Gestion des paiements bientôt disponible.')} />
          <STRow icon="receipt-outline" tint="#6B6963" label="Historique facturation" onPress={() => showAlert('Facturation', 'Historique bientôt disponible.')} />
        </STGroup>

        <STGroup title="Préférences">
          <STRow icon="notifications-outline" tint="#8B5CF6" label="Notifications" sub="Push, email, sons" onPress={() => setSub('notifications')} />
          <STRow icon="color-palette-outline" tint="#3B82F6" label="Apparence" sub="Thème · Langue · Unités" onPress={() => setSub('appearance')} />
          <STRow icon="link-outline" tint="#22C55E" label="Intégrations" right={connectedCount > 0 ? `${connectedCount} active${connectedCount > 1 ? 's' : ''}` : 'Aucune'} onPress={() => setSub('integrations')} />
          <STRow icon="layers-outline" tint="#FF5C1A" label="Modules activés" right={`${enabledPlugins.length} / ${installedPlugins.length}`} onPress={() => router.push('/(app)/modules' as any)} />
          <STRow
            icon="gift-outline"
            tint="#E8A33A"
            label="Parrainage"
            sub="Code promo · Inviter un ami"
            onPress={() => router.push('/(app)/profile/referral' as any)}
          />
        </STGroup>

        {(role === 'client' || role === 'both') && linkedCoachName && (
          <STGroup title={t('coach.settings_section')}>
            <STRow
              icon="person-outline"
              tint="#FF5C1A"
              label={linkedCoachName}
              sub="Gérer"
              onPress={() => router.push('/(plugins)/coach/dashboard' as any)}
            />
          </STGroup>
        )}

        <STGroup title="Aide & infos">
          <STRow icon="help-circle-outline" tint="#1C1A17" label="Centre d'aide" onPress={() => router.push('/(app)/profile/help' as any)} />
          <STRow icon="chatbubble-outline" tint="#3B82F6" label="Contacter le support" onPress={() => showAlert('Support', 'Envoie un email à support@ziko.app')} />
          <STRow icon="star-outline" tint="#E8A33A" label="Noter l'app" onPress={() => {
            const url = Platform.OS === 'ios'
              ? 'https://apps.apple.com/app/id6744155867' // TODO: remplacer par l'ID App Store réel
              : 'https://play.google.com/store/apps/details?id=com.ziko.mobile';
            Linking.openURL(url).catch(() =>
              showAlert('Impossible', "Impossible d'ouvrir le store. Cherche 'Ziko fitness' manuellement.")
            );
          }} />
          <STRow icon="information-circle-outline" tint="#6B6963" label="À propos" right="v2.4.1" />
          <STRow icon="document-text-outline" tint="#6B6963" label="Mentions légales" onPress={() => router.push('/(app)/profile/legal' as any)} />
        </STGroup>

        {/* Se déconnecter */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          style={{
            paddingVertical: 16, borderRadius: 16, alignItems: 'center',
            borderWidth: 1, borderColor: theme.border,
            backgroundColor: 'transparent', marginTop: 16,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 14, color: '#E94B3C' }}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', paddingTop: 20, paddingBottom: 8, fontSize: 12, color: theme.muted }}>
          Ziko · v2.4.1 · build 8842
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

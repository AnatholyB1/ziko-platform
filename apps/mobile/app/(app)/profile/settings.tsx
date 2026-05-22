import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert, usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import { STGroup, STRow, STToggle } from '@ziko/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

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
  const [s, setS] = useState({
    sessionsReminder: true, hydration: true, streakAlert: true, coach: true,
    achievements: true, social: true, marketing: false,
    sound: true, haptics: true,
  });
  const saveRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId) return;
    supabase.from('user_profiles').select('settings').eq('id', userId).single()
      .then(({ data }) => {
        const prefs = (data as any)?.settings?.notif_prefs;
        if (prefs) setS((prev) => ({ ...prev, ...prefs }));
      });
  }, [userId]);

  const updateToggle = (k: keyof typeof s) => (v: boolean) => {
    const next = { ...s, [k]: v };
    setS(next);
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      const current = (existing as any)?.settings ?? {};
      supabase.from('user_profiles').upsert({
        id: userId,
        settings: { ...current, notif_prefs: next },
      });
    }, 500);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        <STGroup title="Coach & rappels">
          <STRow icon="barbell-outline" tint="#FF5C1A" label="Rappels de séance" sub="60 min avant" toggleValue={s.sessionsReminder} onToggle={updateToggle('sessionsReminder')} />
          <STRow icon="water-outline" tint="#3B82F6" label="Hydratation" sub="Toutes les 2h" toggleValue={s.hydration} onToggle={updateToggle('hydration')} />
          <STRow icon="flame-outline" tint="#E94B3C" label="Alerte streak" sub="Avant que la chaîne casse" toggleValue={s.streakAlert} onToggle={updateToggle('streakAlert')} />
          <STRow icon="sparkles-outline" tint="#FF5C1A" label="Coach IA quotidien" sub="Insight du matin" toggleValue={s.coach} onToggle={updateToggle('coach')} />
        </STGroup>
        <STGroup title="Activité">
          <STRow icon="trophy-outline" tint="#E8A33A" label="PR & badges" toggleValue={s.achievements} onToggle={updateToggle('achievements')} />
          <STRow icon="people-outline" tint="#3B82F6" label="Communauté" sub="Likes, commentaires, follows" toggleValue={s.social} onToggle={updateToggle('social')} />
          <STRow icon="notifications-outline" tint="#6B6963" label="Promotions & nouveautés" toggleValue={s.marketing} onToggle={updateToggle('marketing')} />
        </STGroup>
        <STGroup title="Style">
          <STRow icon="musical-note-outline" tint="#8B5CF6" label="Sons" toggleValue={s.sound} onToggle={updateToggle('sound')} />
          <STRow icon="flash-outline" tint="#F59E0B" label="Vibrations" toggleValue={s.haptics} onToggle={updateToggle('haptics')} />
        </STGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Appearance sub-screen ──────────────────────────────────────
const THEMES = [
  { id: 'light', label: 'Clair', bg: '#F6F4EF', fg: '#1C1A17' },
  { id: 'dark',  label: 'Sombre', bg: '#1C1A17', fg: '#FFFAF6' },
  { id: 'auto',  label: 'Auto', bg: '#888', fg: '#fff' },
];

function AppearanceSubScreen({ onBack, userId }: { onBack: () => void; userId: string }) {
  const theme = useThemeStore((s) => s.theme);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    if (!userId) return;
    supabase.from('user_profiles').select('settings').eq('id', userId).single()
      .then(({ data }) => {
        const a = (data as any)?.settings?.appearance;
        if (a?.units_preference) setUnits(a.units_preference);
      });
  }, [userId]);

  const handleUnitSelect = async (id: 'metric' | 'imperial') => {
    setUnits(id);
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('settings')
      .eq('id', userId)
      .single();
    const current = (existing as any)?.settings ?? {};
    supabase.from('user_profiles').upsert({
      id: userId,
      settings: { ...current, appearance: { ...(current.appearance ?? {}), units_preference: id } },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Apparence" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        {/* Theme section */}
        <Text style={{
          fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase',
          color: theme.muted, paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
        }}>THÈME</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {THEMES.map((t) => {
            const active = t.id === 'light';
            const isLocked = t.id !== 'light';
            const card = (
              <TouchableOpacity
                key={t.id}
                activeOpacity={isLocked ? 1 : 0.7}
                style={{
                  flex: 1, borderRadius: 12, overflow: 'hidden',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : '#E2E0DA',
                }}
              >
                <View style={{ height: 70, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', fontSize: 18, color: t.fg }}>Aa</Text>
                </View>
                <Text style={{
                  textAlign: 'center', paddingVertical: 8, fontSize: 12, fontWeight: '700',
                  color: active ? '#FF5C1A' : '#1C1A17',
                }}>{t.label}</Text>
              </TouchableOpacity>
            );
            if (isLocked) {
              return (
                <View key={t.id} style={{ flex: 1, opacity: 0.5 }} pointerEvents="none">
                  {card}
                </View>
              );
            }
            return card;
          })}
        </View>

        <STGroup title="Langue & région">
          <STRow icon="globe-outline" tint="#3B82F6" label="Langue" right="Français" />
          <STRow icon="flag-outline" tint="#FF5C1A" label="Région" right="France" />
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
    </SafeAreaView>
  );
}

// ── Integrations sub-screen ────────────────────────────────────
const INTEGRATIONS = [
  { id: 1, name: 'Apple Health',   sub: 'Activité, sommeil, fréquence cardiaque', icon: 'heart-outline' as const,          tint: '#FF3B30', connected: true },
  { id: 2, name: 'Apple Watch',    sub: 'Synchro auto · 47 séances importées',    icon: 'watch-outline' as const,          tint: '#1C1A17', connected: true },
  { id: 3, name: 'Strava',         sub: 'Importer tes activités outdoor',         icon: 'flash-outline' as const,          tint: '#FC4C02', connected: false },
  { id: 4, name: 'Garmin Connect', sub: 'Montres et capteurs Garmin',             icon: 'watch-outline' as const,          tint: '#1C1A17', connected: false },
  { id: 5, name: 'MyFitnessPal',   sub: 'Synchro nutrition bidirectionnelle',     icon: 'nutrition-outline' as const,      tint: '#0072CE', connected: false },
  { id: 6, name: 'Whoop',          sub: 'Récup, sommeil, charge',                 icon: 'pulse-outline' as const,         tint: '#3B3B3B', connected: false },
];

function IntegrationsSubScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Intégrations" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        {/* Info banner */}
        <View style={{
          padding: 14, borderRadius: 12, marginBottom: 16,
          backgroundColor: 'rgba(59,130,246,0.06)',
          borderWidth: 1, borderColor: 'rgba(59,130,246,0.18)',
          flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        }}>
          <Ionicons name="information-circle-outline" size={14} color="#3B82F6" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6', marginBottom: 4 }}>
              Tes données restent à toi
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted, lineHeight: 17 }}>
              Connexions chiffrées · révocables à tout moment · jamais revendues.
            </Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {INTEGRATIONS.map((it) => (
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
                  {it.connected && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                  )}
                </View>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{it.sub}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => !it.connected && showAlert('Connexion', `La connexion ${it.name} sera disponible prochainement.`)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: it.connected ? 'rgba(28,26,23,0.07)' : '#1C1A17',
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: it.connected ? '#1C1A17' : '#fff',
                }}>
                  {it.connected ? 'Géré' : 'Connecter'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
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

  const { data: coachData } = useQuery({
    queryKey: ['coach-link-settings', profile?.id],
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
    enabled: !!(role === 'client' || role === 'both') && !!profile?.id,
    staleTime: 30_000,
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
            backgroundColor: '#FF5C1A',
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.6, textTransform: 'uppercase' }}>PREMIUM</Text>
          </View>
        </View>

        <STGroup title="Compte">
          <STRow icon="person-outline" tint="#FF5C1A" label="Informations personnelles" sub="Nom, email, téléphone" onPress={() => showAlert('Bientôt', 'Cette section arrive dans la prochaine version.')} />
          <STRow icon="lock-closed-outline" tint="#1C1A17" label="Mot de passe" sub="Modifier" onPress={() => router.push('/(auth)/forgot' as any)} />
          <STRow icon="shield-checkmark-outline" tint="#3B82F6" label="Confidentialité" sub="Profil public · Données partagées" onPress={() => showAlert('Confidentialité', 'Tes données sont chiffrées et ne sont jamais revendues.')} />
          <STRow icon="trash-outline" tint="#E94B3C" label="Supprimer le compte" danger onPress={handleDeleteAccount} />
        </STGroup>

        <STGroup title="Abonnement">
          <STRow icon="sparkles-outline" tint="#FF5C1A" label="Plan actuel" right="Premium · 9,99€/mois" onPress={() => router.push('/(app)/paywall' as any)} />
          <STRow icon="flash-outline" tint="#E8A33A" label="Crédits IA" right="47 / 100" onPress={() => router.push('/(app)/ai')} />
          <STRow icon="card-outline" tint="#1C1A17" label="Moyen de paiement" sub="Visa •• 4242" onPress={() => showAlert('Paiement', 'Gestion des paiements bientôt disponible.')} />
          <STRow icon="receipt-outline" tint="#6B6963" label="Historique facturation" onPress={() => showAlert('Facturation', 'Historique bientôt disponible.')} />
        </STGroup>

        <STGroup title="Préférences">
          <STRow icon="notifications-outline" tint="#8B5CF6" label="Notifications" sub="Push, email, sons" onPress={() => setSub('notifications')} />
          <STRow icon="color-palette-outline" tint="#3B82F6" label="Apparence" sub="Thème · Langue · Unités" onPress={() => setSub('appearance')} />
          <STRow icon="link-outline" tint="#22C55E" label="Intégrations" right="2 actives" onPress={() => setSub('integrations')} />
          <STRow icon="layers-outline" tint="#FF5C1A" label="Modules activés" right={`${enabledPlugins.length} / ${installedPlugins.length}`} onPress={() => router.push('/(app)/modules' as any)} />
          <STRow icon="gift-outline" tint="#E8A33A" label="Parrainage" sub="Code promo · Inviter un ami" onPress={() => router.push('/(app)/referral' as any)} />
        </STGroup>

        {(role === 'client' || role === 'both') && linkedCoachName && (
          <STGroup title={t('coach.settings_section')}>
            <STRow
              icon="person-outline"
              tint="#FF5C1A"
              label={linkedCoachName}
              onPress={() => router.push('/(plugins)/coach/dashboard' as any)}
            />
          </STGroup>
        )}

        <STGroup title="Aide & infos">
          <STRow icon="help-circle-outline" tint="#1C1A17" label="Centre d'aide" onPress={() => router.push('/(app)/help' as any)} />
          <STRow icon="chatbubble-outline" tint="#3B82F6" label="Contacter le support" onPress={() => showAlert('Support', 'Envoie un email à support@ziko.app')} />
          <STRow icon="star-outline" tint="#E8A33A" label="Noter l'app" onPress={() => showAlert('Merci !', "Ton avis nous aide à améliorer l'app.")} />
          <STRow icon="information-circle-outline" tint="#6B6963" label="À propos" right="v2.4.1" />
          <STRow icon="document-text-outline" tint="#6B6963" label="Mentions légales" onPress={() => router.push('/(app)/legal' as any)} />
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

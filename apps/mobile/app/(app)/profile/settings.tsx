import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

// ── Shared chrome ──────────────────────────────────────────────
function STHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 10 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 34, height: 34, borderRadius: 11,
          backgroundColor: theme.text + '10',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>{title}</Text>
    </View>
  );
}

function STGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{
        fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase',
        color: theme.muted, paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
      }}>{title}</Text>
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16,
        borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
      }}>
        {React.Children.map(children, (child, i) => (
          <>
            {i > 0 && <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }} />}
            {child}
          </>
        ))}
      </View>
    </View>
  );
}

function STRow({
  icon, tint, label, sub, right, danger, onPress, toggleValue, onToggle,
}: {
  icon: string; tint: string; label: string; sub?: string;
  right?: string; danger?: boolean; onPress?: () => void;
  toggleValue?: boolean; onToggle?: (v: boolean) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress || onToggle ? 0.7 : 1}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, paddingHorizontal: 10 }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 9,
        backgroundColor: tint + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon as any} size={15} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: danger ? '#E94B3C' : theme.text }}>{label}</Text>
        {sub && <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{sub}</Text>}
      </View>
      {onToggle !== undefined ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: '#2E9E5B' }}
          thumbColor="#fff"
        />
      ) : right ? (
        <Text style={{ fontSize: 12, color: theme.muted, fontWeight: '600', marginRight: 4 }}>{right}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={14} color={theme.muted} />
      ) : null}
    </TouchableOpacity>
  );
}

// ── Notifications sub-screen ───────────────────────────────────
function NotifSubScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const [s, setS] = useState({
    sessionsReminder: true, hydration: true, streakAlert: true,
    achievements: true, social: true, coach: true, marketing: false,
    sound: true, haptics: true,
  });
  const set = (k: keyof typeof s) => (v: boolean) => setS((prev) => ({ ...prev, [k]: v }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        <STGroup title="Coach & rappels">
          <STRow icon="barbell-outline" tint="#FF5C1A" label="Rappels de séance" sub="60 min avant" toggleValue={s.sessionsReminder} onToggle={set('sessionsReminder')} />
          <STRow icon="water-outline" tint="#2E7BF6" label="Hydratation" sub="Toutes les 2h" toggleValue={s.hydration} onToggle={set('hydration')} />
          <STRow icon="flame-outline" tint="#E94B3C" label="Alerte streak" sub="Avant que la chaîne casse" toggleValue={s.streakAlert} onToggle={set('streakAlert')} />
          <STRow icon="sparkles-outline" tint="#FF5C1A" label="Coach IA quotidien" sub="Insight du matin" toggleValue={s.coach} onToggle={set('coach')} />
        </STGroup>
        <STGroup title="Activité">
          <STRow icon="trophy-outline" tint="#E8A33A" label="PR & badges" toggleValue={s.achievements} onToggle={set('achievements')} />
          <STRow icon="people-outline" tint="#2E7BF6" label="Communauté" sub="Likes, commentaires, follows" toggleValue={s.social} onToggle={set('social')} />
          <STRow icon="megaphone-outline" tint={theme.muted} label="Promotions & nouveautés" toggleValue={s.marketing} onToggle={set('marketing')} />
        </STGroup>
        <STGroup title="Style">
          <STRow icon="musical-notes-outline" tint="#7B5BD0" label="Sons" toggleValue={s.sound} onToggle={set('sound')} />
          <STRow icon="phone-portrait-outline" tint="#E8A33A" label="Vibrations" toggleValue={s.haptics} onToggle={set('haptics')} />
        </STGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Appearance sub-screen ──────────────────────────────────────
function AppearanceSubScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  const THEMES = [
    { id: 'light', label: 'Clair', bg: '#F7F6F3', fg: '#1C1A17' },
    { id: 'dark',  label: 'Sombre', bg: '#1C1A17', fg: '#FFFAF6' },
    { id: 'auto',  label: 'Auto', bg: '#888', fg: '#fff' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Apparence" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        <Text style={{
          fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase',
          color: theme.muted, paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
        }}>Thème</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          {THEMES.map((t) => (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.7}
              style={{
                flex: 1, borderRadius: 14, overflow: 'hidden',
                borderWidth: 2, borderColor: t.id === 'light' ? '#FF5C1A' : theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <View style={{ height: 60, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '800', fontSize: 18, color: t.fg }}>Aa</Text>
              </View>
              <Text style={{
                textAlign: 'center', padding: 8, fontSize: 12, fontWeight: '700',
                color: t.id === 'light' ? '#FF5C1A' : theme.text,
              }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <STGroup title="Langue & région">
          <STRow icon="globe-outline" tint="#2E7BF6" label="Langue" right="Français" />
          <STRow icon="flag-outline" tint="#FF5C1A" label="Région" right="France" />
        </STGroup>

        <Text style={{
          fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase',
          color: theme.muted, paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
        }}>Unités</Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {([
            { id: 'metric',   label: 'Métrique', sub: 'kg · cm · km' },
            { id: 'imperial', label: 'Impérial',  sub: 'lb · in · mi' },
          ] as const).map((u, i) => (
            <TouchableOpacity
              key={u.id}
              onPress={() => setUnits(u.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 14,
                borderTopWidth: i ? 1 : 0, borderTopColor: theme.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: theme.text }}>{u.label}</Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{u.sub}</Text>
              </View>
              {units === u.id && (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
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
function IntegrationsSubScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);

  const INTEGRATIONS = [
    { id: 1, name: 'Apple Health',   sub: 'Activité, sommeil, fréquence cardiaque', icon: 'heart-outline' as const,          tint: '#FF3B30', connected: true },
    { id: 2, name: 'Apple Watch',    sub: 'Synchro auto · 47 séances importées',    icon: 'watch-outline' as const,          tint: '#1C1A17', connected: true },
    { id: 3, name: 'Strava',         sub: 'Importer tes activités outdoor',         icon: 'bicycle-outline' as const,        tint: '#FC4C02', connected: false },
    { id: 4, name: 'Garmin Connect', sub: 'Montres et capteurs Garmin',             icon: 'location-outline' as const,       tint: '#007AC1', connected: false },
    { id: 5, name: 'MyFitnessPal',   sub: 'Synchro nutrition bidirectionnelle',     icon: 'nutrition-outline' as const,      tint: '#0072CE', connected: false },
    { id: 6, name: 'Whoop',          sub: 'Récup, sommeil, charge',                 icon: 'pulse-outline' as const,         tint: '#3B3B3B', connected: false },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={onBack} title="Intégrations" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}>
        {/* Info banner */}
        <View style={{
          padding: 14, borderRadius: 14, marginBottom: 16,
          backgroundColor: '#2E7BF6' + '10',
          borderWidth: 1, borderColor: '#2E7BF6' + '25',
          flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        }}>
          <Ionicons name="information-circle-outline" size={16} color="#2E7BF6" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2E7BF6', marginBottom: 2 }}>
              Tes données restent à toi
            </Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, lineHeight: 17 }}>
              Connexions chiffrées · révocables à tout moment · jamais revendues.
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {INTEGRATIONS.map((it) => (
            <View key={it.id} style={{
              padding: 14, borderRadius: 16,
              backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <View style={{
                width: 40, height: 40, borderRadius: 11,
                backgroundColor: it.tint + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={it.icon} size={18} color={it.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>{it.name}</Text>
                  {it.connected && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E9E5B' }} />
                  )}
                </View>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{it.sub}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => !it.connected && showAlert('Connexion', `La connexion ${it.name} sera disponible prochainement.`)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: it.connected ? theme.text + '10' : theme.text,
                }}
              >
                <Text style={{
                  fontSize: 11.5, fontWeight: '700',
                  color: it.connected ? theme.text : '#fff',
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
  const [sub, setSub] = useState<SubView>(null);

  if (sub === 'notifications') return <NotifSubScreen onBack={() => setSub(null)} />;
  if (sub === 'appearance')    return <AppearanceSubScreen onBack={() => setSub(null)} />;
  if (sub === 'integrations')  return <IntegrationsSubScreen onBack={() => setSub(null)} />;

  const initials = (profile?.name ?? user?.email ?? 'ZK').slice(0, 2).toUpperCase();
  const displayName = profile?.name ?? user?.email ?? 'Utilisateur';
  const email = user?.email ?? '';

  const handleSignOut = () => {
    showAlert('Se déconnecter', 'Confirmes-tu la déconnexion ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
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
          padding: 14, borderRadius: 16, marginBottom: 20,
          backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: '#FF5C1A',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontWeight: '800', fontSize: 18, color: '#fff' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.text }} numberOfLines={1}>{displayName}</Text>
            <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2 }} numberOfLines={1}>{email}</Text>
          </View>
          <View style={{
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
            backgroundColor: '#FF5C1A',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 }}>FREE</Text>
          </View>
        </View>

        <STGroup title="Compte">
          <STRow icon="person-outline" tint="#FF5C1A" label="Informations personnelles" sub="Nom, email, téléphone" onPress={() => showAlert('Bientôt', 'Cette section arrive dans la prochaine version.')} />
          <STRow icon="lock-closed-outline" tint={theme.text} label="Mot de passe" sub="Modifier" onPress={() => router.push('/(auth)/forgot' as any)} />
          <STRow icon="shield-checkmark-outline" tint="#2E7BF6" label="Confidentialité" sub="Profil public · Données partagées" onPress={() => showAlert('Confidentialité', 'Tes données sont chiffrées et ne sont jamais revendues.')} />
          <STRow icon="trash-outline" tint="#E94B3C" label="Supprimer le compte" danger onPress={handleDeleteAccount} />
        </STGroup>

        <STGroup title="Abonnement">
          <STRow icon="sparkles-outline" tint="#FF5C1A" label="Plan actuel" right="Free" onPress={() => router.push('/(app)/paywall' as any)} />
          <STRow icon="flash-outline" tint="#E8A33A" label="Crédits IA" right="Voir solde" onPress={() => router.back()} />
          <STRow icon="card-outline" tint={theme.text} label="Passer Premium" sub="9,99€/mois — annulable à tout moment" onPress={() => router.push('/(app)/paywall' as any)} />
        </STGroup>

        <STGroup title="Préférences">
          <STRow icon="notifications-outline" tint="#7B5BD0" label="Notifications" sub="Push, sons, rappels" onPress={() => setSub('notifications')} />
          <STRow icon="color-palette-outline" tint="#2E7BF6" label="Apparence" sub="Thème · Langue · Unités" onPress={() => setSub('appearance')} />
          <STRow icon="link-outline" tint="#2E9E5B" label="Intégrations" right="2 actives" onPress={() => setSub('integrations')} />
          <STRow icon="layers-outline" tint="#FF5C1A" label="Modules activés" right="17 / 17" onPress={() => router.push('/(app)/modules' as any)} />
          <STRow icon="gift-outline" tint="#E8A33A" label="Parrainage" sub="Code promo · Inviter un ami" onPress={() => router.push('/(app)/referral' as any)} />
        </STGroup>

        <STGroup title="Aide & infos">
          <STRow icon="help-circle-outline" tint={theme.text} label="Centre d'aide" onPress={() => router.push('/(app)/help' as any)} />
          <STRow icon="chatbubble-outline" tint="#2E7BF6" label="Contacter le support" onPress={() => showAlert('Support', 'Envoie un email à support@ziko.app')} />
          <STRow icon="star-outline" tint="#E8A33A" label="Noter l'app" onPress={() => showAlert('Merci !', "Ton avis nous aide à améliorer l'app.")} />
          <STRow icon="information-circle-outline" tint={theme.muted} label="À propos" right="v2.0.0" />
          <STRow icon="document-text-outline" tint={theme.muted} label="Mentions légales" onPress={() => router.push('/(app)/legal' as any)} />
        </STGroup>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          style={{
            paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            borderWidth: 1, borderColor: theme.border,
            backgroundColor: 'transparent', marginTop: 8,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 14, color: '#E94B3C' }}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', fontSize: 10.5, color: theme.muted, marginTop: 16 }}>
          Ziko · v2.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

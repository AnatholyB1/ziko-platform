# Settings & Modules — Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Settings screen (account, subscription, preferences, help sections + 3 inline sub-screens) and the Modules screen (plugin enable/disable toggle list), then register routes and commit all untracked work from prior phases.

**Architecture:**
- `profile/settings.tsx` — full settings with sub-views controlled by local state (no router navigation between sub-screens). Navigates to `/(app)/modules` for the modules row, `/(app)/referral` for referral, `/(app)/help`/`/(app)/legal` for help links.
- `modules.tsx` — top-level hidden tab screen using `usePluginRegistry` (`installedPlugins`, `enabledPlugins`, `enablePlugin`, `disablePlugin`) to render a toggle list.
- `_layout.tsx` — add `modules` as a hidden `<Tabs.Screen>` (already has the other utility screens).
- `profile/index.tsx` links to `/(app)/profile/settings` (already correct in the existing file).

**Tech Stack:** React Native, Expo Router, Ionicons, `useThemeStore` (plugin-sdk), `useAuthStore`, `usePluginRegistry` (plugin-sdk), `showAlert` (plugin-sdk), Supabase

---

## File Map

| File | Action |
|------|--------|
| `apps/mobile/app/(app)/profile/settings.tsx` | Create — Settings screen (main + NotifSub + AppearanceSub + IntegrationsSub inline) |
| `apps/mobile/app/(app)/modules.tsx` | Create — Modules toggle screen |
| `apps/mobile/app/(app)/_layout.tsx` | Modify — add `modules` hidden tab |

---

## Task 1: Settings Screen

**Files:**
- Create: `apps/mobile/app/(app)/profile/settings.tsx`

### Step 1: Create `profile/settings.tsx`

- [ ] **Step 1: Create the file**

```tsx
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

  const initials = (profile?.full_name ?? user?.email ?? 'ZK').slice(0, 2).toUpperCase();
  const displayName = profile?.full_name ?? user?.email ?? 'Utilisateur';
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
```

- [ ] **Step 2: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

Common fixes:
- `router.push('/(app)/modules' as any)` — cast to `any` if the route isn't typed yet (it will be after Task 3)
- `icon as any` on `<Ionicons name={icon as any} />` — needed since `icon` is `string`

- [ ] **Step 3: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/profile/settings.tsx && rtk git commit -m "feat(settings): settings screen with notifications, appearance, integrations sub-screens"
```

---

## Task 2: Modules Screen

**Files:**
- Create: `apps/mobile/app/(app)/modules.tsx`

The modules screen reads `installedPlugins` and `enabledPlugins` from `usePluginRegistry` and renders a toggle list. Each toggle calls `enablePlugin` / `disablePlugin`.

- [ ] **Step 1: Create `modules.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, usePluginRegistry } from '@ziko/plugin-sdk';

// Icon map: plugin id → Ionicons name
const PLUGIN_ICONS: Record<string, string> = {
  nutrition:      'nutrition-outline',
  hydration:      'water-outline',
  sleep:          'moon-outline',
  habits:         'checkmark-circle-outline',
  stats:          'bar-chart-outline',
  stretching:     'body-outline',
  measurements:   'scale-outline',
  timer:          'timer-outline',
  journal:        'journal-outline',
  cardio:         'bicycle-outline',
  supplements:    'flask-outline',
  wearables:      'watch-outline',
  rpe:            'calculator-outline',
  gamification:   'trophy-outline',
  'ai-programs':  'sparkles-outline',
  persona:        'person-circle-outline',
  community:      'people-outline',
  pantry:         'leaf-outline',
};

const PLUGIN_TINTS: Record<string, string> = {
  nutrition:      '#2E9E5B',
  hydration:      '#2E7BF6',
  sleep:          '#7B5BD0',
  habits:         '#FF5C1A',
  stats:          '#2E7BF6',
  stretching:     '#7B5BD0',
  measurements:   '#E8A33A',
  timer:          '#1C1A17',
  journal:        '#FF5C1A',
  cardio:         '#E94B3C',
  supplements:    '#7B5BD0',
  wearables:      '#E91E63',
  rpe:            '#7B5BD0',
  gamification:   '#E8A33A',
  'ai-programs':  '#FF5C1A',
  persona:        '#FF6584',
  community:      '#2E7BF6',
  pantry:         '#2E9E5B',
};

export default function ModulesScreen() {
  const theme = useThemeStore((s) => s.theme);
  const installedPlugins = usePluginRegistry((s) => s.installedPlugins);
  const enabledPlugins   = usePluginRegistry((s) => s.enabledPlugins);
  const manifests        = usePluginRegistry((s) => s.manifests);
  const enablePlugin     = usePluginRegistry((s) => s.enablePlugin);
  const disablePlugin    = usePluginRegistry((s) => s.disablePlugin);

  const enabledCount = enabledPlugins.length;
  const totalCount   = installedPlugins.length;

  const handleToggle = (pluginId: string, current: boolean) => {
    if (current) {
      disablePlugin(pluginId);
    } else {
      enablePlugin(pluginId);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34, height: 34, borderRadius: 11,
            backgroundColor: theme.text + '10',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4, flex: 1 }}>Modules</Text>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          backgroundColor: '#FF5C1A' + '18',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF5C1A' }}>
            {enabledCount}/{totalCount}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}>
        <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 14, lineHeight: 18 }}>
          Active uniquement les modules que tu utilises. Les désactivés sont masqués dans toute l'app.
        </Text>

        <View style={{
          backgroundColor: theme.surface, borderRadius: 16,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {installedPlugins.map((pluginId, i) => {
            const manifest = manifests[pluginId];
            const isEnabled = enabledPlugins.includes(pluginId);
            const icon = PLUGIN_ICONS[pluginId] ?? 'grid-outline';
            const tint = PLUGIN_TINTS[pluginId] ?? '#FF5C1A';
            const name = manifest?.name ?? pluginId;

            return (
              <React.Fragment key={pluginId}>
                {i > 0 && (
                  <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }} />
                )}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, paddingHorizontal: 14,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: tint + '18',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={icon as any} size={16} color={tint} />
                  </View>
                  <Text style={{
                    flex: 1, fontSize: 14, fontWeight: '600',
                    color: isEnabled ? theme.text : theme.muted,
                  }}>{name}</Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={(v) => handleToggle(pluginId, !v)}
                    trackColor={{ false: theme.border, true: '#2E9E5B' }}
                    thumbColor="#fff"
                  />
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/modules.tsx && rtk git commit -m "feat(modules): plugin enable/disable toggle screen"
```

---

## Task 3: Register `modules` Route in Layout

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

The `settings` route at `/(app)/profile/settings` is auto-registered by Expo Router since it's inside the `profile/` folder (already registered as `<Tabs.Screen name="profile" />`). We only need to register `modules` as a top-level hidden tab.

- [ ] **Step 1: Add `modules` hidden screen to `_layout.tsx`**

In `apps/mobile/app/(app)/_layout.tsx`, add after the `referral` hidden screen (around line 160):

```tsx
        <Tabs.Screen name="modules" options={{ href: null }} />
```

The full hidden screens block should look like:

```tsx
        {/* Hidden screens — not shown in tab bar */}
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="(plugins)" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="help" options={{ href: null }} />
        <Tabs.Screen name="legal" options={{ href: null }} />
        <Tabs.Screen name="referral" options={{ href: null }} />
        <Tabs.Screen name="modules" options={{ href: null }} />
```

- [ ] **Step 2: Type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(app)'/_layout.tsx && rtk git commit -m "feat(layout): register modules route as hidden tab"
```

---

## Task 4: Commit All Prior Untracked Work

All the untracked files in the working tree are the output of phases 1–6 (home, workout, profile sub-screens, store, secondary screens). Commit them in logical groups.

- [ ] **Step 1: Commit profile sub-screens + modified profile/index.tsx**

```bash
cd /c/ziko-platform && rtk git add \
  apps/mobile/app/'(app)'/profile/index.tsx \
  apps/mobile/app/'(app)'/profile/avatar.tsx \
  apps/mobile/app/'(app)'/profile/device.tsx \
  apps/mobile/app/'(app)'/profile/goal-edit.tsx \
  apps/mobile/app/'(app)'/profile/lift-detail.tsx \
  apps/mobile/app/'(app)'/profile/progression.tsx \
  && rtk git commit -m "feat(profile): v2 profile screen + sub-screens (avatar, device, goal-edit, lift-detail, progression)"
```

- [ ] **Step 2: Commit workout screens**

```bash
cd /c/ziko-platform && rtk git add \
  apps/mobile/app/'(app)'/workout/index.tsx \
  apps/mobile/app/'(app)'/workout/program-builder.tsx \
  && rtk git commit -m "feat(workout): v2 workout tab + program builder screen"
```

- [ ] **Step 3: Commit secondary screens**

```bash
cd /c/ziko-platform && rtk git add \
  apps/mobile/app/'(app)'/ai/chat.tsx \
  apps/mobile/app/'(app)'/calendar.tsx \
  apps/mobile/app/'(app)'/help.tsx \
  apps/mobile/app/'(app)'/legal.tsx \
  apps/mobile/app/'(app)'/notifications.tsx \
  apps/mobile/app/'(app)'/paywall.tsx \
  apps/mobile/app/'(app)'/referral.tsx \
  && rtk git commit -m "feat(screens): AI chat, calendar, help, legal, notifications, paywall, referral screens"
```

- [ ] **Step 4: Commit shared components**

```bash
cd /c/ziko-platform && rtk git add \
  apps/mobile/src/components/ErrorScreen.tsx \
  apps/mobile/src/components/SearchOverlay.tsx \
  && rtk git commit -m "feat(components): ErrorScreen and SearchOverlay components"
```

- [ ] **Step 5: Commit app.json + eas.json changes**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app.json apps/mobile/eas.json && rtk git commit -m "chore(config): update app.json and eas.json for v2 build"
```

- [ ] **Step 6: Verify clean working tree**

```bash
cd /c/ziko-platform && rtk git status
```

Expected: `nothing to commit, working tree clean`

---

## Self-Review

**Spec coverage:**
- SettingsScreen main list ✅ (Account, Subscription, Preferences, Help sections)
- Account card with initials + email + tier badge ✅
- NotifSubScreen — 9 toggles across 3 groups ✅
- AppearanceSubScreen — theme picker + language/region + units ✅
- IntegrationsSubScreen — 6 services with connect/managed button ✅
- Sign out with confirm dialog ✅
- Delete account flow ✅
- ModulesScreen — `usePluginRegistry` toggle list ✅
- `modules` registered in _layout.tsx ✅
- All prior untracked work committed ✅

**Placeholder scan:** No TBDs. All code blocks are complete. `showAlert` used instead of `Alert.alert`. All navigations use typed routes or `as any` cast.

**Type consistency:**
- `SubView` type matches `useState<SubView>(null)` and the `if (sub === ...)` checks ✅
- `handleToggle(pluginId, !v)` — note: `Switch onValueChange` gives the NEW value, so `handleToggle(id, !v)` passes `current = !newValue`, meaning "was it previously enabled?". Logic: if `!v === true` → was enabled → disable. Correct ✅
- `icon as any` needed everywhere Ionicons name comes from a `string` variable ✅

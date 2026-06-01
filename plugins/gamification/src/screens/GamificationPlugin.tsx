import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

const TABS = ['Niveau', 'Badges', 'Quêtes'];

// Map nom d'icône badge → Ionicons
const BADGE_ICON_MAP: Record<string, string> = {
  play: 'play-outline',
  check: 'checkmark-outline',
  flame: 'flame-outline',
  trophy: 'trophy-outline',
  shoe: 'footsteps-outline',
  barbell: 'barbell-outline',
  leaf: 'leaf-outline',
  drop: 'water-outline',
};

// Quêtes statiques (D-06 — pas de table quests)
const STATIC_QUESTS = [
  {
    name: 'Battre un PR cette semaine',
    reward: '+50 XP',
    pct: 60,
    sub: 'Squat à 145kg',
  },
  {
    name: '5 séances en 7 jours',
    reward: '+30 XP',
    pct: 80,
    sub: '4/5 faites',
  },
  {
    name: '3 jours hydratation parfaite',
    reward: '+15 XP',
    pct: 67,
    sub: '2/3 jours',
  },
];

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E0DA',
        padding: 12,
        shadowColor: '#1C1A17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}

// ── RowList local ─────────────────────────────────────────────────────────────
function RowList({
  items,
}: {
  items: Array<{ icon?: string; title: string; sub?: string; right?: string }>;
}) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E2E0DA',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#1C1A17',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {it.icon && (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: '#FF5C1A24',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={it.icon as any} size={15} color="#FF5C1A" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1C1A17' }}>
              {it.title}
            </Text>
            {it.sub && (
              <Text style={{ fontSize: 10.5, color: '#6B6963', marginTop: 1 }}>
                {it.sub}
              </Text>
            )}
          </View>
          {it.right && (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>
              {it.right}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GamificationPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  // Récupérer la session auth
  const { data: userSession } = useQuery({
    queryKey: ['auth-session-gamif'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const userId = userSession?.user?.id;

  // Query: user_gamification
  const { data: gamifData, isLoading: loadingGamif } = useQuery({
    queryKey: ['user_gamification', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_gamification')
        .select('xp, level, coins, current_streak, longest_streak, equipped_title, equipped_badge')
        .eq('user_id', userId)
        .single();
      if (error) return null;
      return data;
    },
  });

  // Query: badges (shop_items WHERE category = 'badge' + user_inventory)
  const { data: badgesData, isLoading: loadingBadges } = useQuery({
    queryKey: ['badges', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [shopRes, inventoryRes] = await Promise.all([
        supabase
          .from('shop_items')
          .select('id, name, category, icon')
          .eq('category', 'badge'),
        supabase
          .from('user_inventory')
          .select('item_id')
          .eq('user_id', userId),
      ]);
      const shopItems = shopRes.data ?? [];
      const ownedIds = new Set((inventoryRes.data ?? []).map((i: any) => i.item_id));
      return shopItems.map((item: any) => ({
        ...item,
        got: ownedIds.has(item.id),
      }));
    },
  });

  const xp = gamifData?.xp ?? 0;
  const level = gamifData?.level ?? 1;
  const equippedTitle = gamifData?.equipped_title ?? 'ATHLÈTE';
  const xpThreshold = level * 500;
  const xpPct = Math.min((xp / xpThreshold) * 100, 100);
  const xpRemaining = Math.max(xpThreshold - xp, 0);

  const unlockedCount = (badgesData ?? []).filter((b: any) => b.got).length;
  const totalBadgeCount = (badgesData ?? []).length;

  // AISuggestion Niveau
  const levelSuggestion = `2 quêtes en cours — termine-les pour gagner +95 XP et passer plus vite niv. ${level + 1}.`;

  const renderNiveauTab = () => {
    if (loadingGamif) {
      return (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      );
    }

    return (
      <View style={{ gap: 12 }}>
        {/* Carte hero dark */}
        <View
          style={{
            backgroundColor: '#1C1A17',
            borderRadius: 20,
            padding: 24,
            overflow: 'hidden',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Gradient radial simulé */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,92,26,0.18)',
              borderRadius: 20,
            }}
          />

          <View style={{ position: 'relative', alignItems: 'center', width: '100%' }}>
            {/* Numéro niveau */}
            <Text
              style={{
                fontSize: 56,
                fontWeight: '900',
                color: '#FF5C1A',
                textAlign: 'center',
                lineHeight: 64,
              }}
            >
              {level}
            </Text>

            {/* Titre équipé */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: 'rgba(255,250,246,0.8)',
                textTransform: 'uppercase',
                letterSpacing: 0.08,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              NIVEAU · {equippedTitle.toUpperCase()}
            </Text>

            {/* XP text */}
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(255,250,246,0.55)',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              {xp} / {xpThreshold} XP
            </Text>

            {/* Barre XP */}
            <View
              style={{
                height: 8,
                backgroundColor: 'rgba(255,250,246,0.12)',
                borderRadius: 999,
                marginTop: 8,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <View
                style={{
                  width: `${xpPct}%` as any,
                  height: '100%',
                  backgroundColor: '#FF5C1A',
                  borderRadius: 999,
                }}
              />
            </View>

            {/* XP restant */}
            <Text
              style={{
                fontSize: 10,
                color: 'rgba(255,250,246,0.55)',
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              {xpRemaining} XP avant niveau {level + 1}
            </Text>
          </View>
        </View>

        <AISuggestion text={levelSuggestion} actionLabel="Voir quêtes" />

        <RowList
          items={[
            {
              icon: 'trophy-outline',
              title: `Niveau ${level + 1} — Pro`,
              sub: `${(level + 1) * 500 - xp} XP restants`,
            },
            {
              icon: 'trophy-outline',
              title: `Niveau ${level + 2} — Élite`,
              sub: 'Déblocage : avatar doré',
            },
            {
              icon: 'trophy-outline',
              title: `Niveau ${level + 3} — Légende`,
              sub: 'Déblocage : titre exclusif',
            },
          ]}
        />
      </View>
    );
  };

  const renderBadgesTab = () => {
    if (loadingBadges) {
      return (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      );
    }

    const badges =
      badgesData && badgesData.length > 0
        ? badgesData
        : // Fallback statique si pas de données
          [
            { name: 'Premier pas', desc: 'Première séance', got: true, icon: 'play' },
            { name: 'Constant', desc: '10 séances', got: true, icon: 'check' },
            { name: 'Streak 30', desc: '30j d\'affilée', got: true, icon: 'flame' },
            { name: 'PR Hunter', desc: '10 records battus', got: true, icon: 'trophy' },
            { name: 'Marathonien', desc: '100 séances', got: false, icon: 'shoe' },
            { name: 'Hercule', desc: '200kg en cumul', got: false, icon: 'barbell' },
            { name: 'Méditant', desc: '100 médits', got: false, icon: 'leaf' },
            { name: 'Aqua-pro', desc: '30j hydratation parfaite', got: false, icon: 'drop' },
          ];

    const displayBadges = badges.slice(0, 8);
    const unlocked = displayBadges.filter((b: any) => b.got).length;

    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 12, color: '#6B6963', marginBottom: 4 }}>
          {unlocked} / {displayBadges.length} débloqués
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {displayBadges.map((b: any, i: number) => {
            const ionIcon = BADGE_ICON_MAP[b.icon] ?? 'star-outline';
            return (
              <View
                key={i}
                style={{
                  width: '48%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 12,
                  alignItems: 'center',
                  opacity: b.got ? 1 : 0.45,
                  shadowColor: '#1C1A17',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 3,
                  borderWidth: 1,
                  borderColor: '#E2E0DA',
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: b.got ? '#FF5C1A' : 'rgba(28,26,23,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={ionIcon as any}
                    size={22}
                    color={b.got ? '#FFFFFF' : '#6B6963'}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#1C1A17',
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  {b.name}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#6B6963',
                    marginTop: 1,
                    textAlign: 'center',
                  }}
                >
                  {b.desc ?? b.description ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderQuetesTab = () => {
    return (
      <View style={{ gap: 8 }}>
        <AISuggestion
          text="Choisis 3 quêtes max simultanément. Trop = dispersion. Vise les +50 XP en priorité."
          actionLabel="Filtrer"
        />
        {STATIC_QUESTS.map((q, i) => (
          <View
            key={i}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E2E0DA',
              padding: 12,
              shadowColor: '#1C1A17',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>
                  {q.name}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 1 }}>
                  {q.sub}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: 'rgba(255,92,26,0.12)',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{ fontSize: 11, color: '#FF5C1A', fontWeight: '700' }}
                >
                  {q.reward}
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 5,
                backgroundColor: 'rgba(28,26,23,0.06)',
                borderRadius: 999,
                marginTop: 9,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${q.pct}%` as any,
                  height: '100%',
                  backgroundColor: '#FF5C1A',
                  borderRadius: 999,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Récompenses" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <View style={{ marginTop: 16 }}>
          {activeTab === 'Niveau' && renderNiveauTab()}
          {activeTab === 'Badges' && renderBadgesTab()}
          {activeTab === 'Quêtes' && renderQuetesTab()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

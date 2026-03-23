import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeStore, BANNER_REGISTRY } from '../../../src/stores/themeStore';
import { usePluginRegistry, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
import { useGamificationStore, loadGamification } from '@ziko/plugin-gamification/store';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { theme, equippedBanner, setTheme, setBanner } = useThemeStore();
  const { t } = useTranslation();
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const gamifEnabled = enabledPlugins.includes('gamification');
  const gamifProfile = useGamificationStore((s) => s.profile);
  const levels = useGamificationStore((s) => s.levels);
  const xpProgress = useGamificationStore((s) => s.xpProgress);
  const xpToNext = useGamificationStore((s) => s.xpToNext);
  const nextLevel = useGamificationStore((s) => s.nextLevel);

  const load = useCallback(async () => {
    if (gamifEnabled) {
      await loadGamification(supabase);
      const gp = useGamificationStore.getState().profile;
      if (gp?.equipped_theme) setTheme(gp.equipped_theme);
      if (gp?.equipped_banner_name) setBanner(gp.equipped_banner_name);
      else setBanner(null);
    }
  }, [gamifEnabled]);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = () => {
    showAlert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('general.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const GOAL_LABELS: Record<string, string> = {
    muscle_gain: t('profile.goalMuscle'),
    fat_loss: t('profile.goalFatLoss'),
    maintenance: t('profile.goalMaintenance'),
    endurance: t('profile.goalEndurance'),
  };

  const bannerColors = equippedBanner?.colors ?? null;
  const avatarSize = 96;
  const ringSize = avatarSize + 12;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text }}>{t('profile.title')}</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/profile/settings')}>
          <Ionicons name="settings-outline" size={22} color={theme.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        {/* Avatar with banner ring + gamification */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {/* Avatar ring */}
          <View style={{ marginBottom: 12 }}>
            {bannerColors ? (
              <LinearGradient
                colors={bannerColors as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: ringSize, height: ringSize, borderRadius: ringSize / 2,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={{
                    width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
                    borderWidth: 3, borderColor: theme.background,
                  }} />
                ) : (
                  <View style={{
                    width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
                    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 3, borderColor: theme.background,
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>
                      {profile?.name?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{
                  width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
                }} />
              ) : (
                <View style={{
                  width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
                  backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>
                    {profile?.name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )
            )}
          </View>

          {/* Name + badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 22 }}>
              {profile?.name ?? 'Athlete'}
            </Text>
            {gamifProfile?.equipped_badge && (
              <Text style={{ fontSize: 20 }}>{gamifProfile.equipped_badge}</Text>
            )}
          </View>

          {/* Goal */}
          {profile?.goal && (
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>
              {GOAL_LABELS[profile.goal]}
            </Text>
          )}

          {/* Level & Title (gamification) */}
          {gamifEnabled && gamifProfile && (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              {/* Level badge */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: theme.primary + '15', borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 8,
              }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    {gamifProfile.level}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                    {gamifProfile.equipped_title}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.muted }}>
                    {gamifProfile.xp.toLocaleString()} XP
                  </Text>
                </View>
              </View>

              {/* XP Progress bar */}
              {nextLevel && (
                <View style={{ width: '80%', marginTop: 10 }}>
                  <View style={{
                    height: 6, backgroundColor: theme.border, borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${Math.round(xpProgress * 100)}%`,
                      height: '100%', backgroundColor: theme.primary, borderRadius: 3,
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 4 }}>
                    {t('profile.xpForLevel', { xp: String(xpToNext), level: String(nextLevel.level) })}
                  </Text>
                </View>
              )}

              {/* Coins & Streak row */}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 16 }}>💰</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#F59E0B' }}>
                    {gamifProfile.coins.toLocaleString()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>
                    {gamifProfile.current_streak}j
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 16 }}>🏆</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.primary }}>
                    {gamifProfile.longest_streak}j
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 20 }}>{profile?.weight_kg ?? '—'}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>kg</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: '#FF6584', fontWeight: '700', fontSize: 20 }}>{profile?.height_cm ?? '—'}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>cm</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}>
            <Text style={{ color: '#FF9800', fontWeight: '700', fontSize: 20 }}>{profile?.age ?? '—'}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>ans</Text>
          </View>
        </View>

        {/* Level progression (if gamification) */}
        {gamifEnabled && gamifProfile && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: theme.border, marginBottom: 16,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
              {t('profile.levelProgression')}
            </Text>
            {levels.slice(0, 12).map((lv) => {
              const unlocked = gamifProfile.level >= lv.level;
              const isCurrent = gamifProfile.level === lv.level;
              return (
                <View
                  key={lv.level}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12,
                    opacity: unlocked ? 1 : 0.4,
                    borderBottomWidth: lv.level < 12 ? 1 : 0, borderBottomColor: theme.border,
                  }}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isCurrent ? theme.primary : unlocked ? theme.primary + '30' : theme.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '800',
                      color: isCurrent ? '#fff' : unlocked ? theme.primary : theme.muted,
                    }}>
                      {lv.level}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 14, fontWeight: isCurrent ? '700' : '500',
                      color: isCurrent ? theme.primary : theme.text,
                    }}>
                      {lv.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.muted }}>
                      {lv.xp_required.toLocaleString()} XP
                      {lv.reward_coins > 0 ? ` • +${lv.reward_coins} 💰` : ''}
                    </Text>
                  </View>
                  {unlocked && (
                    <Ionicons name={isCurrent ? 'star' : 'checkmark-circle'} size={18}
                      color={isCurrent ? '#F59E0B' : '#10B981'} />
                  )}
                  {!unlocked && <Ionicons name="lock-closed" size={16} color={theme.muted} />}
                </View>
              );
            })}
          </View>
        )}

        {/* Menu items */}
        {[
          { icon: 'person-outline', label: t('profile.editProfile'), onPress: () => router.push('/(app)/profile/settings') },
          { icon: 'grid-outline', label: t('store.managePlugins'), onPress: () => router.push('/(app)/store') },
          ...(gamifEnabled ? [{ icon: 'cart-outline', label: t('store.shop'), onPress: () => router.push('/(app)/(plugins)/gamification/shop' as any) }] : []),
          { icon: 'chatbubble-outline', label: t('ai.title'), onPress: () => router.push('/(app)/ai') },
          { icon: 'help-circle-outline', label: t('profile.helpSupport'), onPress: () => {} },
        ].map((item) => (
          <TouchableOpacity key={item.label} onPress={item.onPress}
            style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: theme.border }}>
            <Ionicons name={item.icon as any} size={20} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: '500', fontSize: 15, flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={handleSignOut}
          style={{ backgroundColor: '#F4433611', borderRadius: 14, padding: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F4433633' }}>
          <Ionicons name="log-out-outline" size={20} color="#F44336" />
          <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 15 }}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useGamificationStore, loadGamification } from '../store';

const { width: SCREEN_W } = Dimensions.get('window');

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function GamificationDashboard({ supabase }: { supabase: any }) {
  const {
    profile, isLoading, nextLevel, xpToNext, xpProgress,
    recentXP, recentCoins, levels,
  } = useGamificationStore();

  const load = useCallback(() => loadGamification(supabase), []);
  useEffect(() => { load(); }, [load]);

  const currentLevelDef = levels.find((l) => l.level === (profile?.level ?? 1));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#FF5C1A" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: Level Circle ──────────────────────── */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 14 }}
          style={{
            alignItems: 'center', paddingTop: 24, paddingBottom: 20,
            backgroundColor: '#FFFFFF', borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
            borderWidth: 1, borderColor: '#E2E0DA', borderTopWidth: 0,
          }}
        >
          {/* Level ring */}
          <View style={{
            width: 120, height: 120, borderRadius: 60,
            borderWidth: 6, borderColor: '#E2E0DA',
            alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Progress arc (simplified as background tint) */}
            <View style={{
              position: 'absolute', width: 120, height: 120, borderRadius: 60,
              borderWidth: 6, borderColor: '#FF5C1A',
              borderRightColor: xpProgress > 0.25 ? '#FF5C1A' : 'transparent',
              borderBottomColor: xpProgress > 0.5 ? '#FF5C1A' : 'transparent',
              borderLeftColor: xpProgress > 0.75 ? '#FF5C1A' : 'transparent',
              transform: [{ rotate: '-90deg' }],
            }} />
            <Text style={{ fontSize: 36, fontWeight: '900', color: '#FF5C1A' }}>
              {profile?.level ?? 1}
            </Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17', marginTop: 12 }}>
            {profile?.equipped_title ?? currentLevelDef?.title ?? 'Débutant'}
          </Text>
          {profile?.equipped_badge && (
            <Text style={{ fontSize: 28, marginTop: 4 }}>{profile.equipped_badge}</Text>
          )}

          {/* XP Bar */}
          <View style={{ width: SCREEN_W - 80, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, color: '#6B6963' }}>
                {profile?.xp ?? 0} XP
              </Text>
              <Text style={{ fontSize: 13, color: '#6B6963' }}>
                {nextLevel ? `${nextLevel.xp_required} XP` : 'MAX'}
              </Text>
            </View>
            <View style={{ height: 10, backgroundColor: '#E2E0DA', borderRadius: 5, overflow: 'hidden' }}>
              <MotiView
                from={{ width: '0%' }}
                animate={{ width: `${Math.round(xpProgress * 100)}%` as any }}
                transition={{ type: 'timing', duration: 800 }}
                style={{
                  height: '100%', backgroundColor: '#FF5C1A', borderRadius: 5,
                }}
              />
            </View>
            {nextLevel && (
              <Text style={{ fontSize: 12, color: '#6B6963', textAlign: 'center', marginTop: 4 }}>
                Encore {xpToNext} XP pour niveau {nextLevel.level}
              </Text>
            )}
          </View>
        </MotiView>

        {/* ── Stats Row ──────────────────────────────── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
          <StatCard icon="💰" label="Pièces" value={`${profile?.coins ?? 0}`} color="#F59E0B" />
          <StatCard icon="🔥" label="Streak" value={`${profile?.current_streak ?? 0}j`} color="#EF4444" />
          <StatCard icon="🏆" label="Record" value={`${profile?.longest_streak ?? 0}j`} color="#7C3AED" />
        </View>

        {/* ── Shop Button ────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/gamification/shop' as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            marginHorizontal: 20, marginTop: 20,
            backgroundColor: '#FF5C1A', borderRadius: 16, paddingVertical: 16, gap: 10,
          }}
        >
          <Ionicons name="cart" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            Boutique
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF30', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              💰 {profile?.coins ?? 0}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── XP Rewards ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B6963', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Gains d'XP
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA',
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16,
            }}>
              <RewardInfo emoji="💪" label="Séance" value="+50 XP" sub="+25 🪙" />
              <View style={{ width: 1, backgroundColor: '#E2E0DA' }} />
              <RewardInfo emoji="✅" label="Habitude" value="+10 XP" sub="+5 🪙" />
              <View style={{ width: 1, backgroundColor: '#E2E0DA' }} />
              <RewardInfo emoji="🔥" label="Streak 7j" value="+100 XP" sub="+50 🪙" />
            </View>
          </View>
        </View>

        {/* ── Levels Preview ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B6963', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Niveaux
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA',
            padding: 16,
          }}>
            {levels.map((lvl, i) => {
              const isCurrent = lvl.level === (profile?.level ?? 1);
              const isUnlocked = (profile?.xp ?? 0) >= lvl.xp_required;
              return (
                <View
                  key={lvl.level}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                    borderBottomWidth: i < levels.length - 1 ? 1 : 0,
                    borderBottomColor: '#F7F6F3',
                    opacity: isUnlocked ? 1 : 0.5,
                  }}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isCurrent ? '#FF5C1A' : isUnlocked ? '#FF5C1A22' : '#E2E0DA',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '800',
                      color: isCurrent ? '#FFFFFF' : isUnlocked ? '#FF5C1A' : '#6B6963',
                    }}>
                      {lvl.level}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{
                      fontSize: 14, fontWeight: isCurrent ? '800' : '600',
                      color: isCurrent ? '#FF5C1A' : '#1C1A17',
                    }}>
                      {lvl.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6B6963' }}>
                      {lvl.xp_required} XP
                    </Text>
                  </View>
                  {lvl.reward_coins > 0 && (
                    <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '600' }}>
                      +{lvl.reward_coins} 🪙
                    </Text>
                  )}
                  {isCurrent && (
                    <View style={{
                      backgroundColor: '#FF5C1A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
                      marginLeft: 8,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>ACTUEL</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Recent Activity ────────────────────────── */}
        {recentXP.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B6963', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Activité récente
            </Text>
            <View style={{
              backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA',
              padding: 16,
            }}>
              {recentXP.slice(0, 8).map((tx, i) => (
                <View
                  key={tx.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: i < 7 ? 1 : 0,
                    borderBottomColor: '#F7F6F3',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#1C1A17' }} numberOfLines={1}>
                      {tx.description ?? tx.source}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>
                      {formatDate(tx.created_at)}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 14, fontWeight: '700',
                    color: tx.amount > 0 ? '#10B981' : '#EF4444',
                  }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} XP
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────
function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: '#E2E0DA', alignItems: 'center',
    }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C1A17', marginTop: 4 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function RewardInfo({ emoji, label, value, sub }: {
  emoji: string; label: string; value: string; sub: string;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#FF5C1A', marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#F59E0B', marginTop: 1 }}>{sub}</Text>
    </View>
  );
}

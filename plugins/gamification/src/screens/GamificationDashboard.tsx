import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
  Modal, FlatList, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useGamificationStore, loadGamification } from '../store';
import { usePluginRegistry, useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useCommunityStore, loadCommunity, sendXpGift, sendCoinGift } from '@ziko/plugin-community';
import { useCreditStore } from '../../../../apps/mobile/src/stores/creditStore';

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
  const theme = useThemeStore((s) => s.theme);

  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const communityEnabled = enabledPlugins.includes('community');
  const friends = useCommunityStore((s) => s.friends);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftType, setGiftType] = useState<'xp' | 'coins'>('xp');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [sending, setSending] = useState(false);

  const creditBalance = useCreditStore((s) => s.balance);
  const dailyEarned = useCreditStore((s) => s.dailyEarned);
  const dailyCap = useCreditStore((s) => s.dailyCap);
  const fetchCreditBalance = useCreditStore((s) => s.fetchBalance);

  const load = useCallback(() => loadGamification(supabase), []);
  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      const loadCredits = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) fetchCreditBalance(session.access_token);
      };
      loadCredits();
    }, [])
  );

  useEffect(() => {
    if (communityEnabled) loadCommunity(supabase);
  }, [communityEnabled]);

  const handleSendGift = async (friendId: string) => {
    const amount = parseInt(giftAmount, 10);
    if (!amount || amount <= 0) {
      showAlert('Erreur', 'Saisis un montant valide.');
      return;
    }
    setSending(true);
    try {
      if (giftType === 'xp') {
        await sendXpGift(supabase, friendId, amount, giftMessage || undefined);
      } else {
        await sendCoinGift(supabase, friendId, amount, giftMessage || undefined);
      }
      showAlert('Envoyé !', `${amount} ${giftType === 'xp' ? 'XP' : 'pièces'} envoyé(es).`);
      setShowGiftModal(false);
      setGiftAmount('');
      setGiftMessage('');
      await load();
    } catch (e: any) {
      showAlert('Erreur', e?.message ?? 'Envoi impossible.');
    }
    setSending(false);
  };

  const currentLevelDef = levels.find((l) => l.level === (profile?.level ?? 1));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: Level Circle ──────────────────────── */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 14 }}
          style={{
            alignItems: 'center', paddingTop: 24, paddingBottom: 20,
            backgroundColor: theme.surface, borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
            borderWidth: 1, borderColor: theme.border, borderTopWidth: 0,
          }}
        >
          {/* Level ring */}
          <View style={{
            width: 120, height: 120, borderRadius: 60,
            borderWidth: 6, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Progress arc (simplified as background tint) */}
            <View style={{
              position: 'absolute', width: 120, height: 120, borderRadius: 60,
              borderWidth: 6, borderColor: theme.primary,
              borderRightColor: xpProgress > 0.25 ? theme.primary : 'transparent',
              borderBottomColor: xpProgress > 0.5 ? theme.primary : 'transparent',
              borderLeftColor: xpProgress > 0.75 ? theme.primary : 'transparent',
              transform: [{ rotate: '-90deg' }],
            }} />
            <Text style={{ fontSize: 36, fontWeight: '900', color: theme.primary }}>
              {profile?.level ?? 1}
            </Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 12 }}>
            {profile?.equipped_title ?? currentLevelDef?.title ?? 'Débutant'}
          </Text>
          {profile?.equipped_badge && (
            <Text style={{ fontSize: 28, marginTop: 4 }}>{profile.equipped_badge}</Text>
          )}

          {/* XP Bar */}
          <View style={{ width: SCREEN_W - 80, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, color: theme.muted }}>
                {profile?.xp ?? 0} XP
              </Text>
              <Text style={{ fontSize: 13, color: theme.muted }}>
                {nextLevel ? `${nextLevel.xp_required} XP` : 'MAX'}
              </Text>
            </View>
            <View style={{ height: 10, backgroundColor: theme.border, borderRadius: 5, overflow: 'hidden' }}>
              <MotiView
                from={{ width: '0%' }}
                animate={{ width: `${Math.round(xpProgress * 100)}%` as any }}
                transition={{ type: 'timing', duration: 800 }}
                style={{
                  height: '100%', backgroundColor: theme.primary, borderRadius: 5,
                }}
              />
            </View>
            {nextLevel && (
              <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center', marginTop: 4 }}>
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

        {/* ── Dual Balance Card (D-01: coins + AI credits) ── */}
        <View style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginTop: 16,
          marginBottom: 0,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.border,
        }}>
          {/* Coins side */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 24 }}>💰</Text>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>{(profile?.coins ?? 0).toLocaleString()}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>coins</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, height: 48, backgroundColor: theme.border }} />

          {/* AI Credits side */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Ionicons name="flash" size={24} color="#FFB800" />
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>{creditBalance}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>credits IA</Text>
          </View>
        </View>

        {/* Daily earn progress (EARN-09) */}
        <View style={{
          marginHorizontal: 16,
          marginTop: 10,
          marginBottom: 0,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: '#FFB80010',
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Ionicons name="flash" size={14} color="#FFB800" />
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {dailyEarned} / {dailyCap} bonus credits earned today
          </Text>
        </View>

        {/* ── Shop Button ────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/(plugins)/gamification/shop' as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            marginHorizontal: 20, marginTop: 20,
            backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16, gap: 10,
          }}
        >
          <Ionicons name="cart" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.surface }}>
            Boutique
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF30', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.surface }}>
              💰 {profile?.coins ?? 0}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Gift Button (community plugin) ─────────── */}
        {communityEnabled && (
          <TouchableOpacity
            onPress={() => setShowGiftModal(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              marginHorizontal: 20, marginTop: 10,
              backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 16, gap: 10,
              borderWidth: 1, borderColor: theme.primary,
            }}
          >
            <Ionicons name="gift" size={22} color={theme.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
              Envoyer un cadeau
            </Text>
          </TouchableOpacity>
        )}

        {/* ── XP Rewards ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Gains d'XP
          </Text>
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16,
            }}>
              <RewardInfo emoji="💪" label="Séance" value="+50 XP" sub="+25 🪙" />
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <RewardInfo emoji="✅" label="Habitude" value="+10 XP" sub="+5 🪙" />
              <View style={{ width: 1, backgroundColor: theme.border }} />
              <RewardInfo emoji="🔥" label="Streak 7j" value="+100 XP" sub="+50 🪙" />
            </View>
          </View>
        </View>

        {/* ── Levels Preview ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Niveaux
          </Text>
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
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
                    borderBottomColor: theme.background,
                    opacity: isUnlocked ? 1 : 0.5,
                  }}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isCurrent ? theme.primary : isUnlocked ? theme.primary + '22' : theme.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '800',
                      color: isCurrent ? theme.surface : isUnlocked ? theme.primary : theme.muted,
                    }}>
                      {lvl.level}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{
                      fontSize: 14, fontWeight: isCurrent ? '800' : '600',
                      color: isCurrent ? theme.primary : theme.text,
                    }}>
                      {lvl.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted }}>
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
                      backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
                      marginLeft: 8,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.surface }}>ACTUEL</Text>
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
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Activité récente
            </Text>
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
              padding: 16,
            }}>
              {recentXP.slice(0, 8).map((tx, i) => (
                <View
                  key={tx.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: i < 7 ? 1 : 0,
                    borderBottomColor: theme.background,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.text }} numberOfLines={1}>
                      {tx.description ?? tx.source}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
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

      {/* Gift sending modal */}
      <Modal visible={showGiftModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>Envoyer un cadeau</Text>
            <TouchableOpacity onPress={() => setShowGiftModal(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          {/* Gift type toggle */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setGiftType('xp')}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                backgroundColor: giftType === 'xp' ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: giftType === 'xp' ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>⚡</Text>
              <Text style={{ color: giftType === 'xp' ? theme.surface : theme.text, fontWeight: '700', fontSize: 14, marginTop: 4 }}>XP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setGiftType('coins')}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                backgroundColor: giftType === 'coins' ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: giftType === 'coins' ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>💰</Text>
              <Text style={{ color: giftType === 'coins' ? theme.surface : theme.text, fontWeight: '700', fontSize: 14, marginTop: 4 }}>Pièces</Text>
              <Text style={{ color: giftType === 'coins' ? '#FFFFFF99' : theme.muted, fontSize: 11, marginTop: 2 }}>
                Solde: {profile?.coins ?? 0}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>Montant</Text>
          <TextInput
            value={giftAmount}
            onChangeText={setGiftAmount}
            placeholder="Ex: 50"
            placeholderTextColor="#7A7670"
            keyboardType="numeric"
            style={{
              backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
              paddingHorizontal: 16, paddingVertical: 14, color: theme.text, fontSize: 16,
              fontWeight: '700', marginBottom: 12,
            }}
          />

          {/* Message input */}
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>Message (optionnel)</Text>
          <TextInput
            value={giftMessage}
            onChangeText={setGiftMessage}
            placeholder="Bravo pour ta séance ! 💪"
            placeholderTextColor="#7A7670"
            style={{
              backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
              paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 20,
            }}
          />

          {/* Friend list */}
          <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
            Envoyer à :
          </Text>
          {friends.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Ionicons name="people-outline" size={40} color="#E2E0DA" />
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucun ami pour le moment</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              renderItem={({ item: friend }) => (
                <TouchableOpacity
                  onPress={() => handleSendGift(friend.id)}
                  disabled={sending || !giftAmount}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
                    opacity: !giftAmount ? 0.5 : 1,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                      {(friend.name ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 }}>
                    {friend.name ?? 'Unknown'}
                  </Text>
                  <Ionicons name="gift" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
          {sending && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────
function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center',
    }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 4 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function RewardInfo({ emoji, label, value, sub }: {
  emoji: string; label: string; value: string; sub: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: theme.primary, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#F59E0B', marginTop: 1 }}>{sub}</Text>
    </View>
  );
}

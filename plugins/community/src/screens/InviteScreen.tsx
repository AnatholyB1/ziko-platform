import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  Share, RefreshControl,
} from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  useCommunityStore, sendXpGift, sendCoinGift, sendEncouragement, createInvite,
} from '../store';

type Tab = 'gifts' | 'encourage' | 'invite';

export default function InviteScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const params = useLocalSearchParams<{ friendId?: string; tab?: string }>();
  const { friends, stats, recentEncouragements } = useCommunityStore();
  const [activeTab, setActiveTab] = useState<Tab>((params.tab as Tab) || 'gifts');
  const [refreshing, setRefreshing] = useState(false);

  // Gift state
  const [giftFriendId, setGiftFriendId] = useState(params.friendId || '');
  const [giftType, setGiftType] = useState<'xp' | 'coins'>('xp');
  const [giftAmount, setGiftAmount] = useState('10');
  const [giftMessage, setGiftMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Encouragement state
  const [encFriendId, setEncFriendId] = useState(params.friendId || '');
  const [encEmoji, setEncEmoji] = useState('💪');
  const [encMessage, setEncMessage] = useState('');

  // Invite state
  const [generatedCode, setGeneratedCode] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Nothing critical to reload — just toggle
    setRefreshing(false);
  }, []);

  const handleSendGift = async () => {
    if (!giftFriendId) return Alert.alert('Erreur', 'Choisis un ami');
    const amount = parseInt(giftAmount) || 0;
    if (amount <= 0) return Alert.alert('Erreur', 'Montant invalide');

    setSending(true);
    try {
      if (giftType === 'xp') {
        await sendXpGift(supabase, giftFriendId, amount, giftMessage || undefined);
      } else {
        await sendCoinGift(supabase, giftFriendId, amount, giftMessage || undefined);
      }
      Alert.alert('Envoyé !', `${amount} ${giftType === 'xp' ? 'XP' : '🪙'} envoyé(es)`);
      setGiftAmount('10');
      setGiftMessage('');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Envoi échoué');
    } finally {
      setSending(false);
    }
  };

  const handleSendEncouragement = async () => {
    if (!encFriendId) return Alert.alert('Erreur', 'Choisis un ami');
    setSending(true);
    try {
      await sendEncouragement(supabase, encFriendId, undefined, encEmoji, encMessage || undefined);
      Alert.alert('Envoyé !', 'Encouragement envoyé 🎉');
      setEncMessage('');
    } catch {
      Alert.alert('Erreur', 'Envoi échoué');
    } finally {
      setSending(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const code = await createInvite(supabase);
      setGeneratedCode(code);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le code');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: `Rejoins-moi sur Ziko ! Utilise mon code : ${generatedCode}\nhttps://ziko.app/invite/${generatedCode}`,
      });
    } catch {}
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'gifts', label: 'Cadeaux', icon: 'gift' },
    { key: 'encourage', label: 'Encourager', icon: 'heart' },
    { key: 'invite', label: 'Inviter', icon: 'share' },
  ];

  const EMOJIS = ['💪', '🔥', '👏', '⭐', '🎯', '🏆', '❤️', '🚀'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}>
          {activeTab === 'gifts' ? 'Envoyer un cadeau' : activeTab === 'encourage' ? 'Encourager' : 'Inviter un ami'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 4 }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 40, borderRadius: 12,
                backgroundColor: active ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: active ? theme.primary : theme.border,
              }}>
              <Ionicons name={t.icon as any} size={16} color={active ? theme.surface : theme.muted} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? theme.surface : theme.text }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── GIFTS TAB ── */}
        {activeTab === 'gifts' && (
          <View style={{ gap: 16 }}>
            {/* Stats summary */}
            {stats && (
              <View style={{
                flexDirection: 'row', gap: 10,
              }}>
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                }}>
                  <Text style={{ fontSize: 11, color: theme.muted }}>XP offert</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary }}>{stats.xp_gifted}</Text>
                </View>
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                }}>
                  <Text style={{ fontSize: 11, color: theme.muted }}>Pièces offertes</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary }}>{stats.coins_gifted}</Text>
                </View>
              </View>
            )}

            {/* Select friend */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>À qui ?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {friends.map((f) => {
                  const active = giftFriendId === f.id;
                  return (
                    <TouchableOpacity key={f.id} onPress={() => setGiftFriendId(f.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 12, height: 38, borderRadius: 19,
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>
                        {f.name || 'Ami'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Gift type */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Type de cadeau</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {([['xp', '⭐ XP'], ['coins', '🪙 Pièces']] as const).map(([val, label]) => {
                  const active = giftType === val;
                  return (
                    <TouchableOpacity key={val} onPress={() => setGiftType(val)}
                      style={{
                        flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: active ? theme.surface : theme.text }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Amount */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Montant</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {[5, 10, 25, 50, 100].map((amt) => (
                  <TouchableOpacity key={amt} onPress={() => setGiftAmount(String(amt))}
                    style={{
                      flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: giftAmount === String(amt) ? theme.primary : theme.surface,
                      borderWidth: 1, borderColor: giftAmount === String(amt) ? theme.primary : theme.border,
                    }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '700',
                      color: giftAmount === String(amt) ? theme.surface : theme.text,
                    }}>{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={giftAmount}
                onChangeText={setGiftAmount}
                keyboardType="numeric"
                placeholder="Montant personnalisé"
                placeholderTextColor="#B0ADA8"
                style={{
                  backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, height: 44, fontSize: 15, color: theme.text,
                }}
              />
            </View>

            {/* Message */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Message (optionnel)</Text>
              <TextInput
                value={giftMessage}
                onChangeText={setGiftMessage}
                placeholder="Bien joué, continue comme ça !"
                placeholderTextColor="#B0ADA8"
                style={{
                  backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, height: 44, fontSize: 14, color: theme.text,
                }}
              />
            </View>

            {/* Send */}
            <TouchableOpacity onPress={handleSendGift} disabled={sending}
              style={{
                backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', opacity: sending ? 0.6 : 1,
              }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                {sending ? 'Envoi...' : `Envoyer ${giftAmount} ${giftType === 'xp' ? 'XP ⭐' : 'pièces 🪙'}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ENCOURAGE TAB ── */}
        {activeTab === 'encourage' && (
          <View style={{ gap: 16 }}>
            {/* Select friend */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Encourager qui ?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {friends.map((f) => {
                  const active = encFriendId === f.id;
                  return (
                    <TouchableOpacity key={f.id} onPress={() => setEncFriendId(f.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 12, height: 38, borderRadius: 19,
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>
                        {f.name || 'Ami'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Emoji picker */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Emoji</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {EMOJIS.map((e) => {
                  const active = encEmoji === e;
                  return (
                    <TouchableOpacity key={e} onPress={() => setEncEmoji(e)}
                      style={{
                        width: 48, height: 48, borderRadius: 14,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: active ? theme.primary + '14' : theme.surface,
                        borderWidth: 2, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{ fontSize: 24 }}>{e}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Message */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Message (optionnel)</Text>
              <TextInput
                value={encMessage}
                onChangeText={setEncMessage}
                placeholder="Continue comme ça, tu gères !"
                placeholderTextColor="#B0ADA8"
                multiline
                style={{
                  backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.text,
                  minHeight: 70, textAlignVertical: 'top',
                }}
              />
            </View>

            {/* Send */}
            <TouchableOpacity onPress={handleSendEncouragement} disabled={sending}
              style={{
                backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', opacity: sending ? 0.6 : 1,
              }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                {sending ? 'Envoi...' : `Encourager ${encEmoji}`}
              </Text>
            </TouchableOpacity>

            {/* Recent encouragements received */}
            {recentEncouragements.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>
                  Encouragements reçus
                </Text>
                {recentEncouragements.slice(0, 5).map((enc) => (
                  <View key={enc.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 6,
                    borderWidth: 1, borderColor: theme.border,
                  }}>
                    <Text style={{ fontSize: 28 }}>{enc.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      {enc.message && (
                        <Text style={{ fontSize: 13, color: theme.text }}>{enc.message}</Text>
                      )}
                      <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                        {new Date(enc.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── INVITE TAB ── */}
        {activeTab === 'invite' && (
          <View style={{ gap: 16, alignItems: 'center' }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: theme.primary + '14', alignItems: 'center', justifyContent: 'center',
              marginTop: 20,
            }}>
              <Ionicons name="share-outline" size={40} color={theme.primary} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
              Invite tes amis sur Ziko
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20 }}>
              Génère un code d'invitation unique et partage-le avec tes potes pour qu'ils rejoignent l'app !
            </Text>

            {generatedCode ? (
              <View style={{
                backgroundColor: theme.surface, borderRadius: 16, padding: 20,
                borderWidth: 1, borderColor: theme.border, width: '100%', alignItems: 'center', gap: 12,
              }}>
                <Text style={{ fontSize: 12, color: theme.muted, fontWeight: '600' }}>TON CODE</Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: theme.primary, letterSpacing: 4 }}>
                  {generatedCode}
                </Text>
                <TouchableOpacity onPress={handleShareInvite}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
                  }}>
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={{ color: theme.surface, fontWeight: '700', fontSize: 15 }}>Partager</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleCreateInvite} disabled={creatingInvite}
                style={{
                  backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16,
                  paddingHorizontal: 30, opacity: creatingInvite ? 0.6 : 1,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                  {creatingInvite ? 'Génération...' : 'Générer un code'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Invite stats */}
            {stats && (stats.invites_sent > 0 || stats.invites_accepted > 0) && (
              <View style={{
                flexDirection: 'row', gap: 10, width: '100%', marginTop: 12,
              }}>
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                }}>
                  <Text style={{ fontSize: 11, color: theme.muted }}>Invitations envoyées</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary }}>{stats.invites_sent}</Text>
                </View>
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: theme.border,
                }}>
                  <Text style={{ fontSize: 11, color: theme.muted }}>Acceptées</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#22C55E' }}>{stats.invites_accepted}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Share, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';

const REFERRAL_CODE = 'ZIKO-K8X2';
const INVITED_COUNT = 3;
const TARGET_COUNT = 5;

const INVITED_FRIENDS = [
  { initials: 'MA', name: 'Marie A.', status: 'Inscrite · +1 mois pour toi', confirmed: true, color: '#7B5BD0' },
  { initials: 'TK', name: 'Tom K.', status: 'Inscrit · +1 mois pour toi', confirmed: true, color: '#3B82F6' },
  { initials: 'JP', name: 'Julie P.', status: 'Inscrite · +1 mois pour toi', confirmed: true, color: '#22C55E' },
  { initials: 'SR', name: 'Sam R.', status: 'Code envoye · pas encore inscrit', confirmed: false, color: '#9CA3AF' },
];

type TabId = 'referral' | 'promo';

export default function ReferralScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [tab, setTab] = useState<TabId>('referral');
  const [promoCode, setPromoCode] = useState('');
  const [promoState, setPromoState] = useState<null | 'ok' | 'ko'>(null);

  const handleCopyCode = () => {
    Clipboard.setString(REFERRAL_CODE);
    showAlert('Code copie !', `${REFERRAL_CODE} est dans ton presse-papiers.`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Rejoins-moi sur Ziko, l'app fitness IA ! Utilise mon code ${REFERRAL_CODE} pour obtenir 1 mois gratuit. https://ziko.app/invite/${REFERRAL_CODE}`,
        title: 'Invitation Ziko',
      });
    } catch {
      // user dismissed share sheet
    }
  };

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'ZIKO20') {
      setPromoState('ok');
    } else {
      setPromoState('ko');
    }
  };

  const progress = INVITED_COUNT / TARGET_COUNT;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>
          {tab === 'referral' ? 'Parrainage' : 'Code promo'}
        </Text>
      </View>

      {/* Tab switcher */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            padding: 4,
            backgroundColor: `${theme.text}0D`,
            borderRadius: 12,
          }}
        >
          {([
            { id: 'referral' as TabId, label: 'Parraine un ami' },
            { id: 'promo' as TabId, label: 'Code promo' },
          ] as const).map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  paddingHorizontal: 8,
                  borderRadius: 9,
                  backgroundColor: active ? theme.background : 'transparent',
                  alignItems: 'center',
                  shadowColor: active ? '#000' : 'transparent',
                  shadowOpacity: active ? 0.06 : 0,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: active ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: active ? theme.text : theme.muted,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {tab === 'referral' ? (
          <>
            {/* Hero card */}
            <View
              style={{
                borderRadius: 18,
                backgroundColor: '#1C1A17',
                padding: 18,
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              {/* Glow blob */}
              <View
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -30,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: 'rgba(255,92,26,0.35)',
                  opacity: 0.8,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: theme.primary,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Donne · Recois
              </Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '800',
                  color: '#FFFFFF',
                  lineHeight: 32,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                {'1 mois offert\npar ami inscrit'}
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: 'rgba(255,250,246,0.7)',
                  lineHeight: 19,
                  textAlign: 'center',
                }}
              >
                Ton ami recoit aussi 1 mois gratuit. Pas de plafond — invite autant d'amis que tu veux.
              </Text>
            </View>

            {/* Code section */}
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '800',
                color: theme.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                paddingHorizontal: 4,
                paddingBottom: 8,
                paddingTop: 4,
              }}
            >
              Ton code
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                backgroundColor: `${theme.primary}10`,
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: `${theme.primary}55`,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: theme.primary,
                  letterSpacing: 1.5,
                }}
              >
                {REFERRAL_CODE}
              </Text>
              <TouchableOpacity
                onPress={handleCopyCode}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: theme.primary,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Copier</Text>
              </TouchableOpacity>
            </View>

            {/* Share buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: theme.text,
                }}
              >
                <Ionicons name="chatbubble-outline" size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: theme.text,
                }}
              >
                <Ionicons name="share-outline" size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>Partager</Text>
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                  Progres du defi
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
                  {INVITED_COUNT}/{TARGET_COUNT}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: `${theme.text}10`,
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: '100%',
                    backgroundColor: theme.primary,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11.5, color: theme.muted, lineHeight: 17 }}>
                Atteins <Text style={{ fontWeight: '700', color: theme.text }}>5 amis</Text> et
                debloque le badge{' '}
                <Text style={{ fontWeight: '700', color: theme.text }}>Ambassadeur</Text> + 6 mois
                bonus.
              </Text>
            </View>

            {/* Friends list */}
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '800',
                color: theme.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                paddingHorizontal: 4,
                paddingBottom: 8,
                paddingTop: 4,
              }}
            >
              Tes invitations
            </Text>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
              }}
            >
              {INVITED_FRIENDS.map((friend, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 11,
                    paddingHorizontal: 10,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: friend.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                      {friend.initials}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                      {friend.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
                      {friend.status}
                    </Text>
                  </View>
                  {friend.confirmed && (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: theme.success,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Promo code tab */}
            <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 20, marginBottom: 14 }}>
              Tu as un code promo ou de parrainage ? Entre-le ci-dessous pour activer la reduction.
            </Text>

            <TextInput
              value={promoCode}
              onChangeText={(v) => {
                setPromoCode(v.toUpperCase());
                setPromoState(null);
              }}
              placeholder="Ex : ZIKO20"
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
              style={{
                width: '100%',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderRadius: 14,
                backgroundColor: theme.surface,
                color: theme.text,
                fontWeight: '700',
                fontSize: 16,
                letterSpacing: 1.5,
                textAlign: 'center',
              }}
            />

            {promoState === 'ok' && (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  backgroundColor: `${theme.success}14`,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: `${theme.success}40`,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: theme.success,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                    Code valide
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1 }}>
                    -20% sur ton premier mois Premium
                  </Text>
                </View>
              </View>
            )}

            {promoState === 'ko' && (
              <Text style={{ marginTop: 12, fontSize: 12, color: '#E94B3C', paddingHorizontal: 4 }}>
                Code introuvable ou expire.
              </Text>
            )}

            <TouchableOpacity
              onPress={handleApplyPromo}
              disabled={promoCode.length < 3}
              activeOpacity={0.8}
              style={{
                marginTop: 14,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor:
                  promoCode.length < 3 ? `${theme.text}30` : theme.text,
                alignItems: 'center',
                opacity: promoCode.length < 3 ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                Appliquer le code
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                fontSize: 11,
                color: theme.muted,
                marginTop: 18,
                lineHeight: 18,
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ fontWeight: '700', color: theme.text }}>Astuce</Text>
              {' · Indique ZIKO20 pour tester un code valide.'}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

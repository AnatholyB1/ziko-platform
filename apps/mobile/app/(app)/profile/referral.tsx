import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

// ── Types ──────────────────────────────────────────────────────
interface ReferralData {
  code: string | null;
  invites: {
    pending: number;
    accepted: number;
    reward_pending: number;
    rewarded: number;
  };
  total_accepted: number;
}

// ── Status label map ───────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:        { label: 'En attente',       color: '#6B6963' },
  accepted:       { label: 'Accepté',          color: '#22C55E' },
  reward_pending: { label: 'Récompense en attente', color: '#E8A33A' },
  rewarded:       { label: 'Crédité',          color: '#22C55E' },
};

// ── Progress bar ───────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, value / max);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, color: '#6B6963' }}>
          {value}/{max} amis → badge Ambassadeur
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <View style={{
        height: 6, borderRadius: 99,
        backgroundColor: 'rgba(28,26,23,0.08)',
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          borderRadius: 99,
          backgroundColor: '#FF5C1A',
        }} />
      </View>
    </View>
  );
}

// ── Tab 1: Parraine un ami ─────────────────────────────────────
function InviteTab({ data, isLoading }: { data: ReferralData | undefined; isLoading: boolean }) {
  const theme = useThemeStore((s) => s.theme);

  const handleShare = async () => {
    if (!data?.code) return;
    try {
      await Share.share({
        message: `Rejoins-moi sur Ziko avec mon code ${data.code} et commence ton voyage fitness ! https://ziko-app.com`,
        title: 'Ziko — Code de parrainage',
      });
    } catch {
      // user cancelled
    }
  };

  const handleCopy = async () => {
    if (!data?.code) return;
    // expo-clipboard not installed — open share sheet to let user copy
    try {
      await Share.share({
        message: data.code,
        title: 'Copier le code',
      });
    } catch {
      showAlert('Code', `Ton code : ${data.code}`);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
        <ActivityIndicator size="small" color="#FF5C1A" />
      </View>
    );
  }

  const code = data?.code ?? '---';
  const totalAccepted = data?.total_accepted ?? 0;
  const invites = data?.invites ?? { pending: 0, accepted: 0, reward_pending: 0, rewarded: 0 };
  const allInvites = Object.entries(invites).filter(([, v]) => v > 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}>

      {/* Hero card */}
      <View style={{
        backgroundColor: '#1C1A17', borderRadius: 16, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 }}>
          1 mois offert par ami inscrit
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 }}>
          Notre équipe valide chaque parrainage et crédite la récompense sous 48h.
        </Text>
      </View>

      {/* Code card */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 20,
        borderWidth: 1.5, borderColor: '#FF5C1A', borderStyle: 'dashed',
        shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
        alignItems: 'center', gap: 16,
      }}>
        <Text style={{ fontSize: 13, color: '#6B6963', textAlign: 'center' }}>
          Ton code personnel
        </Text>
        <Text style={{
          fontSize: 26, fontWeight: '800', color: '#1C1A17',
          letterSpacing: 3, fontVariant: ['tabular-nums'],
          fontFamily: 'monospace',
        }}>
          {code}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.7}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 12, borderRadius: 12,
              backgroundColor: 'rgba(255,92,26,0.10)',
            }}
          >
            <Ionicons name="copy-outline" size={15} color="#FF5C1A" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF5C1A' }}>Copier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 12, borderRadius: 12,
              backgroundColor: '#1C1A17',
            }}
          >
            <Ionicons name="share-outline" size={15} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Partager</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress card */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 20,
        shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
        gap: 12,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>
          Progression
        </Text>
        <ProgressBar value={Math.min(totalAccepted, 5)} max={5} />
        {totalAccepted >= 5 && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(232,163,58,0.12)', borderRadius: 10, padding: 12,
          }}>
            <Ionicons name="medal-outline" size={16} color="#E8A33A" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#E8A33A' }}>
              Badge Ambassadeur debloque !
            </Text>
          </View>
        )}
      </View>

      {/* Invitations list */}
      {allInvites.length > 0 && (
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 20,
          shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
          gap: 8,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17', marginBottom: 4 }}>
            Tes invitations
          </Text>
          {allInvites.map(([status, count]) => {
            const info = STATUS_LABELS[status] ?? { label: status, color: '#6B6963' };
            return (
              <View key={status} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: '#E2E0DA',
              }}>
                <Text style={{ fontSize: 13, color: '#6B6963' }}>{info.label}</Text>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: info.color + '20',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: info.color }}>
                    {count as number}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Info note */}
      <View style={{
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: 'rgba(46,123,246,0.06)',
        borderWidth: 1, borderColor: 'rgba(46,123,246,0.18)',
        borderRadius: 12, padding: 14,
      }}>
        <Ionicons name="information-circle-outline" size={14} color="#2E7BF6" style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 12, color: '#6B6963', lineHeight: 18 }}>
          L'ami doit s'inscrire avec ton code pour que la récompense soit validée.
          Validation sous 48h par notre equipe.
        </Text>
      </View>

    </ScrollView>
  );
}

// ── Tab 2: Code promo ──────────────────────────────────────────
function PromoTab() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState('');
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validDescription, setValidDescription] = useState<string | null>(null);
  const [validDiscount, setValidDiscount] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const getToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session?.session?.access_token ?? null;
  };

  const handleBlur = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setValidationState('idle');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/promo/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!res.ok) {
        setValidationState('invalid');
        setValidDescription(null);
        setValidDiscount(null);
        return;
      }

      const data = await res.json() as { valid: boolean; description?: string; discount_pct?: number };
      if (data.valid) {
        setValidationState('valid');
        setValidDescription(data.description ?? null);
        setValidDiscount(data.discount_pct ?? null);
      } else {
        setValidationState('invalid');
        setValidDescription(null);
        setValidDiscount(null);
      }
    } catch {
      setValidationState('invalid');
    }
  };

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || validationState !== 'valid') return;

    setIsApplying(true);
    try {
      const token = await getToken();
      if (!token) {
        showAlert('Erreur', 'Session expirée. Reconnecte-toi.');
        return;
      }

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/promo/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json() as { ok?: boolean; error?: string; discount_pct?: number };

      if (!res.ok || !data.ok) {
        showAlert('Code invalide', data.error ?? 'Ce code ne peut pas être appliqué.');
        return;
      }

      showAlert(
        'Code appliqué !',
        validDiscount
          ? `Ton code te donne ${validDiscount}% de réduction. Il sera appliqué lors de ta prochaine transaction.`
          : 'Ton code promo a bien été enregistré.'
      );
      setCode('');
      setValidationState('idle');
      setValidDescription(null);
      setValidDiscount(null);
    } catch {
      showAlert('Erreur', 'Une erreur est survenue. Réessaie.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}>

      {/* Instruction card */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 20,
        shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
        gap: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="pricetag-outline" size={18} color="#FF5C1A" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>
            Appliquer un code promo
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: '#6B6963', lineHeight: 19 }}>
          Saisis ton code promo pour bénéficier d'une réduction sur ton abonnement. Un seul code peut être appliqué à la fois.
        </Text>
      </View>

      {/* Input card */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 20,
        shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
        gap: 14,
      }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B6963', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Code promo
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setValidationState('idle');
              }}
              onBlur={handleBlur}
              placeholder="EX: ZIKO20"
              placeholderTextColor="#6B6963"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                flex: 1,
                paddingVertical: 12, paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: validationState === 'valid'
                  ? '#22C55E'
                  : validationState === 'invalid'
                    ? '#E94B3C'
                    : '#E2E0DA',
                fontSize: 15, fontWeight: '700', color: '#1C1A17',
                letterSpacing: 1.5,
                backgroundColor: validationState === 'valid'
                  ? 'rgba(34,197,94,0.05)'
                  : validationState === 'invalid'
                    ? 'rgba(233,75,60,0.05)'
                    : '#F7F6F3',
              }}
            />
            {validationState === 'valid' && (
              <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
            )}
            {validationState === 'invalid' && (
              <Ionicons name="close-circle" size={22} color="#E94B3C" />
            )}
          </View>
          {validationState === 'valid' && (
            <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>
              Code valide{validDiscount ? ` — ${validDiscount}% de réduction` : ''}{validDescription ? ` · ${validDescription}` : ''}
            </Text>
          )}
          {validationState === 'invalid' && (
            <Text style={{ fontSize: 12, color: '#E94B3C', fontWeight: '600' }}>
              Code invalide ou expiré.
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleApply}
          activeOpacity={0.7}
          disabled={validationState !== 'valid' || isApplying}
          style={{
            paddingVertical: 14, borderRadius: 12, alignItems: 'center',
            backgroundColor: validationState === 'valid' ? '#FF5C1A' : 'rgba(28,26,23,0.10)',
          }}
        >
          {isApplying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{
              fontSize: 14, fontWeight: '700',
              color: validationState === 'valid' ? '#fff' : '#6B6963',
            }}>
              Appliquer
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* FAQ note */}
      <View style={{
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: 'rgba(46,123,246,0.06)',
        borderWidth: 1, borderColor: 'rgba(46,123,246,0.18)',
        borderRadius: 12, padding: 14,
      }}>
        <Ionicons name="help-circle-outline" size={14} color="#2E7BF6" style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 12, color: '#6B6963', lineHeight: 18 }}>
          Les codes promo sont à usage unique et ne sont pas cumulables avec d'autres offres.
        </Text>
      </View>

    </ScrollView>
  );
}

// ── Main ReferralScreen ────────────────────────────────────────
export default function ReferralScreen() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [activeTab, setActiveTab] = useState<'invite' | 'promo'>('invite');

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ['referral', userId],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/referral`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch referral data');
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: 'rgba(28,26,23,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>Parrainage</Text>
      </View>

      {/* Tab bar */}
      <View style={{
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
        backgroundColor: 'rgba(28,26,23,0.07)', borderRadius: 12, padding: 4,
      }}>
        {([
          { id: 'invite' as const, label: 'Parraine un ami', icon: 'people-outline' as const },
          { id: 'promo' as const, label: 'Code promo', icon: 'pricetag-outline' as const },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 10, borderRadius: 10,
              backgroundColor: activeTab === tab.id ? theme.surface : 'transparent',
              shadowColor: activeTab === tab.id ? '#1C1A17' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === tab.id ? 0.08 : 0,
              shadowRadius: 4, elevation: activeTab === tab.id ? 2 : 0,
            }}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={activeTab === tab.id ? '#FF5C1A' : '#6B6963'}
            />
            <Text style={{
              fontSize: 13, fontWeight: activeTab === tab.id ? '700' : '500',
              color: activeTab === tab.id ? '#1C1A17' : '#6B6963',
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'invite' ? (
        <InviteTab data={data} isLoading={isLoading} />
      ) : (
        <PromoTab />
      )}

    </SafeAreaView>
  );
}

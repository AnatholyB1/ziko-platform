import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useGamificationStore, loadGamification, purchaseItem, equipItem,
  type ShopItem,
} from '../store';
import { useThemeStore } from '@ziko/plugin-sdk';

type Category = 'all' | 'title' | 'badge' | 'theme' | 'banner';

const CATEGORIES: { label: string; value: Category; icon: string }[] = [
  { label: 'Tout', value: 'all', icon: 'grid' },
  { label: 'Titres', value: 'title', icon: 'ribbon' },
  { label: 'Badges', value: 'badge', icon: 'shield' },
  { label: 'Bannières', value: 'banner', icon: 'ellipse' },
  { label: 'Thèmes', value: 'theme', icon: 'color-palette' },
];

export default function ShopScreen({ supabase, onEquip }: { supabase: any; onEquip?: (item: ShopItem) => void }) {
  const {
    profile, shopItems, inventory, isLoading,
  } = useGamificationStore();
  const theme = useThemeStore((s) => s.theme);

  const [category, setCategory] = useState<Category>('all');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const load = useCallback(() => loadGamification(supabase), []);
  useEffect(() => { load(); }, [load]);

  const filtered = category === 'all'
    ? shopItems
    : shopItems.filter((i) => i.category === category);

  const ownedIds = new Set(inventory.map((i) => i.item_id));
  const equippedIds = new Set(inventory.filter((i) => i.is_equipped).map((i) => i.item_id));

  const handlePurchase = async (item: ShopItem) => {
    if (ownedIds.has(item.id)) {
      // Already owned — equip
      await equipItem(supabase, item.id, item.category);
      await load();
      onEquip?.(item);
      return;
    }

    Alert.alert(
      `Acheter ${item.icon ?? ''} ${item.name} ?`,
      `Coût : ${item.price} pièces`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Acheter',
          onPress: async () => {
            setPurchasing(item.id);
            const result = await purchaseItem(supabase, item.id);
            if (result.success) {
              await load();
            } else {
              Alert.alert('Erreur', result.error ?? 'Achat impossible');
            }
            setPurchasing(null);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 8, paddingBottom: 12, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>Boutique</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: '#F59E0B20', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 16 }}>💰</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#F59E0B' }}>
            {profile?.coins ?? 0}
          </Text>
        </View>
      </View>

      {/* Category tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => setCategory(cat.value)}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 4, paddingVertical: 10, borderRadius: 12,
              backgroundColor: category === cat.value ? theme.primary : theme.surface,
              borderWidth: 1,
              borderColor: category === cat.value ? theme.primary : theme.border,
            }}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={category === cat.value ? theme.surface : theme.muted}
            />
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: category === cat.value ? theme.surface : theme.muted,
            }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Items grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {filtered.map((item, idx) => {
            const owned = ownedIds.has(item.id);
            const equipped = equippedIds.has(item.id);
            const canAfford = (profile?.coins ?? 0) >= item.price;
            const levelOk = (profile?.level ?? 1) >= item.level_required;
            const isPurchasing = purchasing === item.id;

            return (
              <MotiView
                key={item.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: idx * 50 }}
                style={{
                  width: (Dimensions.get('window').width - 44) / 2,
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: equipped ? theme.primary : owned ? '#10B981' : theme.border,
                }}
              >
                {/* Visual preview based on category */}
                {item.category === 'banner' ? (
                  <BannerPreview metadata={item.metadata} icon={item.icon} />
                ) : item.category === 'theme' ? (
                  <ThemePreview name={item.name} icon={item.icon} />
                ) : (
                  <Text style={{ fontSize: 36, textAlign: 'center' }}>
                    {item.icon ?? '🎁'}
                  </Text>
                )}

                {/* Name */}
                <Text style={{
                  fontSize: 14, fontWeight: '700', color: theme.text,
                  textAlign: 'center', marginTop: 8,
                }} numberOfLines={1}>
                  {item.name}
                </Text>

                {/* Description */}
                {item.description && (
                  <Text style={{
                    fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 4,
                  }} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                {/* Level requirement */}
                {item.level_required > 1 && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 4, marginTop: 8,
                  }}>
                    <Ionicons
                      name={levelOk ? 'lock-open' : 'lock-closed'}
                      size={12}
                      color={levelOk ? '#10B981' : '#EF4444'}
                    />
                    <Text style={{
                      fontSize: 11,
                      color: levelOk ? '#10B981' : '#EF4444',
                      fontWeight: '600',
                    }}>
                      Niv. {item.level_required}
                    </Text>
                  </View>
                )}

                {/* Action button */}
                <TouchableOpacity
                  onPress={() => handlePurchase(item)}
                  disabled={(!owned && (!canAfford || !levelOk)) || isPurchasing}
                  style={{
                    marginTop: 12, paddingVertical: 10, borderRadius: 12,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: equipped
                      ? theme.primary
                      : owned
                        ? '#10B981'
                        : canAfford && levelOk
                          ? theme.text
                          : theme.border,
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: equipped || owned || (canAfford && levelOk) ? theme.surface : theme.muted,
                  }}>
                    {equipped
                      ? '✓ Équipé'
                      : owned
                        ? 'Équiper'
                        : `💰 ${item.price}`}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </View>

        {/* Empty state */}
        {filtered.length === 0 && !isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="cart-outline" size={48} color="#E2E0DA" />
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8 }}>
              Aucun article dans cette catégorie
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Banner Preview: gradient ring around avatar initial ─
function BannerPreview({ metadata, icon }: { metadata: Record<string, unknown>; icon: string | null }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = (metadata?.colors as string[]) ?? [theme.primary, '#FF9800'];
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <View style={{
          width: 46, height: 46, borderRadius: 23,
          backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: theme.surface,
        }}>
          <Text style={{ fontSize: 22 }}>{icon ?? '🎨'}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ── Theme color definitions for preview ──
const THEME_COLORS: Record<string, { bg: string; primary: string; border: string; text: string }> = {
  'Bleu Océan':    { bg: '#EFF6FF', primary: '#2563EB', border: '#BFDBFE', text: '#1E293B' },
  'Violet Royal':  { bg: '#F5F3FF', primary: '#7C3AED', border: '#C4B5FD', text: '#1E1B4B' },
  'Vert Forêt':    { bg: '#F0FDF4', primary: '#16A34A', border: '#BBF7D0', text: '#14532D' },
  'Rouge Feu':     { bg: '#FEF2F2', primary: '#DC2626', border: '#FECACA', text: '#450A0A' },
  'Or Prestige':   { bg: '#FFFBEB', primary: '#D97706', border: '#FDE68A', text: '#451A03' },
  'Noir Carbone':  { bg: '#0F0F0F', primary: '#FF5C1A', border: '#333333', text: '#F5F5F5' },
};

// ── Theme Preview: mini mockup card ─────────────────────
function ThemePreview({ name, icon }: { name: string; icon: string | null }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = THEME_COLORS[name] ?? { bg: theme.background, primary: theme.primary, border: theme.border, text: theme.text };
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        width: 60, height: 48, borderRadius: 10,
        backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
        padding: 6, justifyContent: 'space-between',
      }}>
        {/* Mini header bar */}
        <View style={{ height: 6, width: '70%', backgroundColor: colors.primary, borderRadius: 3 }} />
        {/* Mini content lines */}
        <View style={{ gap: 3 }}>
          <View style={{ height: 4, width: '100%', backgroundColor: colors.border, borderRadius: 2 }} />
          <View style={{ height: 4, width: '60%', backgroundColor: colors.border, borderRadius: 2 }} />
        </View>
        {/* Mini button */}
        <View style={{ height: 6, width: '50%', backgroundColor: colors.primary, borderRadius: 3, alignSelf: 'center' }} />
      </View>
      <Text style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{icon}</Text>
    </View>
  );
}
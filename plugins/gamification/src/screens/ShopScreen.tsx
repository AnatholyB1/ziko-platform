import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import {
  useGamificationStore, loadGamification, purchaseItem, equipItem,
  type ShopItem,
} from '../store';

type Category = 'all' | 'title' | 'badge' | 'theme';

const CATEGORIES: { label: string; value: Category; icon: string }[] = [
  { label: 'Tout', value: 'all', icon: 'grid' },
  { label: 'Titres', value: 'title', icon: 'ribbon' },
  { label: 'Badges', value: 'badge', icon: 'shield' },
  { label: 'Thèmes', value: 'theme', icon: 'color-palette' },
];

export default function ShopScreen({ supabase }: { supabase: any }) {
  const {
    profile, shopItems, inventory, isLoading,
  } = useGamificationStore();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 8, paddingBottom: 12, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }}>Boutique</Text>
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
              backgroundColor: category === cat.value ? '#FF5C1A' : '#FFFFFF',
              borderWidth: 1,
              borderColor: category === cat.value ? '#FF5C1A' : '#E2E0DA',
            }}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={category === cat.value ? '#FFFFFF' : '#6B6963'}
            />
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: category === cat.value ? '#FFFFFF' : '#6B6963',
            }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#FF5C1A" />}
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: equipped ? '#FF5C1A' : owned ? '#10B981' : '#E2E0DA',
                }}
              >
                {/* Icon */}
                <Text style={{ fontSize: 36, textAlign: 'center' }}>
                  {item.icon ?? '🎁'}
                </Text>

                {/* Name */}
                <Text style={{
                  fontSize: 14, fontWeight: '700', color: '#1C1A17',
                  textAlign: 'center', marginTop: 8,
                }} numberOfLines={1}>
                  {item.name}
                </Text>

                {/* Description */}
                {item.description && (
                  <Text style={{
                    fontSize: 11, color: '#6B6963', textAlign: 'center', marginTop: 4,
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
                      ? '#FF5C1A'
                      : owned
                        ? '#10B981'
                        : canAfford && levelOk
                          ? '#1C1A17'
                          : '#E2E0DA',
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: equipped || owned || (canAfford && levelOk) ? '#FFFFFF' : '#6B6963',
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
            <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8 }}>
              Aucun article dans cette catégorie
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


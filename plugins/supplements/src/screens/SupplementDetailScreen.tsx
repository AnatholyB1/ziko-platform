import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, useTranslation, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { useSupplementsStore, MAX_COMPARE } from '../store';
import type { Supplement } from '../store';
import { Card, PrimaryButton, SecondaryButton, VisualTile, ACCENT_TEXT } from '../components/ui';
import AddToStackSheet from '../components/AddToStackSheet';
import { useUserId, STACK_KEY } from '../hooks';
import { fetchStackItem } from '../lib/data';
import type { StackEntry } from '../lib/moments';
import {
  bestOfferId,
  formatPerDay,
  formatPrice,
  isOfferOpenable,
  latestScrapeLabel,
  pricePerDay,
  sortOffers,
  toPriceNumber,
  PRICE_NOT_COMMUNICATED,
  type Offer,
} from '../lib/pricing';

/** C15 + C16 : detail produit, comparateur d'offres (SUPP-03, 06) et ajout au stack (SUPP-04). */
export default function SupplementDetailScreen({ supabase }: { supabase: any }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const qc = useQueryClient();
  const userId = useUserId(supabase);
  const { addToCompare, compareList } = useSupplementsStore();
  const [supplement, setSupplement] = useState<Supplement | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stackItem, setStackItem] = useState<StackEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    const { data, error } = await supabase
      .from('ziko_supplements')
      .select('*, supplement_brands:ziko_supplement_brands(*), supplement_categories:ziko_supplement_categories(*)')
      .eq('id', id)
      .single();
    if (error || !data) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setSupplement(data);
    const { data: priceData } = await supabase.from('ziko_supplement_prices').select('*').eq('supplement_id', id);
    setOffers(sortOffers((priceData ?? []) as Offer[]));
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const loadStackItem = useCallback(async () => {
    if (!userId || !id) return;
    try {
      setStackItem(await fetchStackItem(supabase, userId, id));
    } catch {
      setStackItem(null);
    }
  }, [userId, id, supabase]);

  useEffect(() => {
    loadStackItem();
  }, [loadStackItem]);

  const openOffer = async (offer: Offer) => {
    if (!isOfferOpenable(offer)) return;
    try {
      await Linking.openURL(offer.source_url as string);
    } catch {
      showAlert("Impossible d'ouvrir l'offre", 'Aucun navigateur disponible.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={getActionPrimary(theme)} />
      </SafeAreaView>
    );
  }

  if (failed || !supplement) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Produit introuvable</Text>
        <Text style={{ color: theme.muted, fontSize: 13.5, textAlign: 'center', marginBottom: 18 }}>
          Impossible de charger ce produit. Vérifie ta connexion.
        </Text>
        <PrimaryButton label="Réessayer" onPress={load} />
        <View style={{ height: 10 }} />
        <SecondaryButton label="Retour" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const bestId = bestOfferId(offers);
  const pricedOffers = offers.filter((o) => toPriceNumber(o.price) !== null);
  const dateLabel = latestScrapeLabel(offers);
  const inCompare = compareList.some((c) => c.id === supplement.id);
  const nutrition = supplement.nutrition_per_serving ?? {};
  const nutritionKeys = Object.keys(nutrition);
  const subtitle = [
    supplement.supplement_brands?.name,
    supplement.supplement_categories?.name,
  ].filter(Boolean).join(' · ');
  const packaging = [supplement.serving_size, supplement.servings_per_container ? `${supplement.servings_per_container} prises` : null]
    .filter(Boolean)
    .join(' · ');

  const sectionTitle = { color: theme.text, fontWeight: '800' as const, fontSize: 15, marginBottom: 10 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.text }} numberOfLines={2}>
          {supplement.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Visuel + marque */}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          {supplement.image_url ? (
            <Image
              source={{ uri: supplement.image_url }}
              style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: theme.border }}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <VisualTile size={72} />
          )}
          <View style={{ flex: 1 }}>
            {subtitle ? <Text style={{ color: theme.muted, fontSize: 13.5 }}>{subtitle}</Text> : null}
            {packaging ? <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600', marginTop: 2 }}>{packaging}</Text> : null}
          </View>
        </View>

        {/* Comparateur d'offres */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text testID="supp-offers-title" style={sectionTitle}>Comparer les prix</Text>
            <Text style={{ color: theme.muted, fontSize: 12.5, marginBottom: 10 }}>
              {offers.length} offre{offers.length > 1 ? 's' : ''}
            </Text>
          </View>

          {offers.length === 0 ? (
            <Text testID="supp-offers-empty" style={{ color: theme.muted, fontSize: 13.5, paddingVertical: 6 }}>
              Prix indisponible : aucune offre relevée pour ce produit.
            </Text>
          ) : (
            offers.map((offer, i) => {
              const priced = toPriceNumber(offer.price) !== null;
              const perDay = formatPerDay(pricePerDay(offer, supplement.servings_per_container));
              const best = offer.id === bestId;
              const openable = isOfferOpenable(offer);
              return (
                <View
                  key={offer.id}
                  testID={`supp-offer-${i}`}
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }}>{offer.source}</Text>
                      {best ? (
                        <View style={{ backgroundColor: getActionPrimary(theme), borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 }}>MEILLEUR PRIX</Text>
                        </View>
                      ) : null}
                    </View>
                    {priced ? (
                      perDay ? <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{perDay}</Text> : null
                    ) : (
                      <Text style={{ color: theme.muted, fontSize: 12.5, marginTop: 2 }}>{PRICE_NOT_COMMUNICATED}</Text>
                    )}
                  </View>

                  {priced ? (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: best ? ACCENT_TEXT : theme.text, fontSize: 17, fontWeight: '800' }}>
                        {formatPrice(offer.price)}
                      </Text>
                      {offer.in_stock === false ? (
                        <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: '700' }}>Indisponible</Text>
                      ) : null}
                      {openable ? (
                        <TouchableOpacity
                          testID={`supp-offer-link-${i}`}
                          accessibilityRole="link"
                          accessibilityLabel={`Voir l'offre ${offer.source}`}
                          onPress={() => openOffer(offer)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, justifyContent: 'center' }}
                        >
                          <Text style={{ color: ACCENT_TEXT, fontSize: 13, fontWeight: '700' }}>Voir l'offre</Text>
                          <Ionicons name="open-outline" size={14} color={ACCENT_TEXT} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={{ color: theme.muted, fontSize: 12.5, fontWeight: '700' }}>Indisponible</Text>
                  )}
                </View>
              );
            })
          )}

          {pricedOffers.length > 0 && dateLabel ? (
            <Text testID="supp-scrape-date" style={{ color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
              Prix relevés le {dateLabel}. Ils peuvent avoir changé chez le marchand.
            </Text>
          ) : null}
        </Card>

        {/* Ajout au stack */}
        <View style={{ marginBottom: 12 }}>
          <PrimaryButton
            testID="supp-add-to-stack"
            label={stackItem ? 'Modifier dans mon stack' : 'Ajouter à mon stack'}
            icon={stackItem ? 'create-outline' : 'add'}
            disabled={!userId}
            onPress={() => setSheetOpen(true)}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <SecondaryButton
            testID="supp-compare-products"
            label={inCompare ? 'Voir le comparateur' : `Comparer avec d'autres produits (${compareList.length}/${MAX_COMPARE})`}
            icon="git-compare-outline"
            onPress={() => {
              const cheapest = pricedOffers[0];
              const latest = cheapest
                ? {
                    ...cheapest,
                    supplement_id: supplement.id,
                    currency: 'EUR',
                    in_stock: cheapest.in_stock !== false,
                    price: toPriceNumber(cheapest.price) as number,
                    price_per_serving: toPriceNumber(cheapest.price_per_serving),
                    scraped_at: cheapest.scraped_at ?? '',
                  }
                : null;
              if (!inCompare && !addToCompare({ ...supplement, latest_price: latest })) {
                showAlert(t('supplements.compareFull'), t('supplements.compareFullMsg'));
                return;
              }
              router.push('/(app)/(plugins)/supplements/compare' as any);
            }}
          />
        </View>

        {nutritionKeys.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={sectionTitle}>{t('supplements.nutritionPerServing')}</Text>
            {nutritionKeys.map((key) => (
              <View
                key={key}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}
              >
                <Text style={{ color: theme.text, fontSize: 13 }}>
                  {t(`supplements.nutrient.${key}`) !== `supplements.nutrient.${key}` ? t(`supplements.nutrient.${key}`) : key}
                </Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{String(nutrition[key])}</Text>
              </View>
            ))}
          </Card>
        )}

        {supplement.flavors && supplement.flavors.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={sectionTitle}>{t('supplements.flavors')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {supplement.flavors.map((flavor) => (
                <View key={flavor} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 12 }}>{flavor}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {supplement.ingredients ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={sectionTitle}>{t('supplements.ingredients')}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{supplement.ingredients}</Text>
          </Card>
        ) : null}

        {supplement.description ? (
          <Card>
            <Text style={sectionTitle}>{t('supplements.description')}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{supplement.description}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <AddToStackSheet
        supabase={supabase}
        userId={userId}
        target={
          sheetOpen
            ? {
                supplementId: supplement.id,
                name: supplement.name,
                servingSize: supplement.serving_size,
                ...(stackItem
                  ? { dose: stackItem.dose, doseUnit: stackItem.doseUnit, moments: stackItem.moments }
                  : {}),
              }
            : null
        }
        onClose={() => setSheetOpen(false)}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: [STACK_KEY, userId] });
          qc.invalidateQueries({ queryKey: ['supplement_intakes', userId] });
          loadStackItem();
        }}
      />
    </SafeAreaView>
  );
}

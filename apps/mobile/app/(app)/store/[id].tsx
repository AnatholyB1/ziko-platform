import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { showAlert } from '@ziko/plugin-sdk';

import { useThemeStore } from '../../../src/stores/themeStore';
import { usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';

// ── Types ─────────────────────────────────────────────────
interface Review {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  user_name?: string;
}

const CATEGORY_META: Record<string, { labelKey: string; color: string }> = {
  coaching:  { labelKey: 'store.catCoaching',  color: '#FF5C1A' },
  nutrition: { labelKey: 'store.catNutrition', color: '#4CAF50' },
  analytics: { labelKey: 'store.catAnalytics', color: '#FF9800' },
  persona:   { labelKey: 'store.catPersona',   color: '#FF6584' },
  social:    { labelKey: 'store.catSocial',     color: '#00BCD4' },
};

const PERM_KEYS: Record<string, string> = {
  read_profile: 'store.permReadProfile',
  write_profile: 'store.permWriteProfile',
  read_workout_history: 'store.permReadWorkout',
  write_workout: 'store.permWriteWorkout',
  read_nutrition: 'store.permReadNutrition',
  write_nutrition: 'store.permWriteNutrition',
  read_habits: 'store.permReadHabits',
  write_habits: 'store.permWriteHabits',
  read_ai_history: 'store.permReadAi',
  notifications: 'store.permNotifications',
  camera: 'store.permCamera',
};

// ── Detail screen ─────────────────────────────────────────
export default function PluginDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { registerPlugin } = usePluginRegistry();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [manifest, setManifest] = useState<PluginManifest | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    const [regRes, reviewsRes] = await Promise.all([
      supabase.from('plugins_registry').select('manifest').eq('plugin_id', id).single(),
      supabase.from('plugin_reviews').select('*').eq('plugin_id', id).order('created_at', { ascending: false }),
    ]);

    if (regRes.data) setManifest(regRes.data.manifest as PluginManifest);

    const allReviews = (reviewsRes.data ?? []) as Review[];

    // Fetch user names for reviews
    const userIds = [...new Set(allReviews.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', userIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.name || t('store.user'); });
      allReviews.forEach((r) => { r.user_name = nameMap[r.user_id] || t('store.user'); });
    }

    setReviews(allReviews);

    if (user) {
      setMyReview(allReviews.find((r) => r.user_id === user.id) ?? null);
      const { data: up } = await supabase
        .from('user_plugins').select('plugin_id')
        .eq('user_id', user.id).eq('plugin_id', id).maybeSingle();
      setIsInstalled(!!up);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Install / Uninstall ────────
  const install = async () => {
    if (!user || !manifest || !id) return;
    const perms = manifest.requiredPermissions ?? [];
    showAlert(
      t('store.installConfirm', { name: manifest.name }),
      perms.length > 0
        ? t('store.permRequired', { perms: perms.map((p) => `• ${t(PERM_KEYS[p] || '') || p}`).join('\n') })
        : t('store.noPerm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('store.install'), onPress: async () => {
            const { error } = await supabase.from('user_plugins').upsert({ user_id: user.id, plugin_id: id, is_enabled: true });
            if (!error) { setIsInstalled(true); registerPlugin(manifest); }
          },
        },
      ],
    );
  };

  const uninstall = async () => {
    if (!user || !id) return;
    showAlert(t('store.uninstall') + ' ?', t('store.uninstallConfirm'), [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('store.uninstall'), style: 'destructive', onPress: async () => {
          await supabase.from('user_plugins').delete().eq('user_id', user.id).eq('plugin_id', id);
          setIsInstalled(false);
        },
      },
    ]);
  };

  const openPlugin = () => {
    if (!manifest) return;
    const mainRoute = manifest.routes.find((r) => r.showInTabBar) ?? manifest.routes[0];
    if (mainRoute) router.push(mainRoute.path as any);
  };

  // ── Submit review ──────────────
  const submitReview = async () => {
    if (!user || !id) return;
    setSubmitting(true);
    const payload = {
      user_id: user.id,
      plugin_id: id,
      rating: reviewRating,
      title: reviewTitle.trim() || null,
      body: reviewBody.trim() || null,
    };

    if (myReview) {
      await supabase.from('plugin_reviews').update(payload).eq('id', myReview.id);
    } else {
      await supabase.from('plugin_reviews').insert(payload);
    }

    setSubmitting(false);
    setShowReviewForm(false);
    setReviewTitle('');
    setReviewBody('');
    await load();
  };

  const deleteReview = async () => {
    if (!myReview) return;
    showAlert(t('store.deleteReviewConfirm'), '', [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('general.delete'), style: 'destructive', onPress: async () => {
          await supabase.from('plugin_reviews').delete().eq('id', myReview.id);
          setMyReview(null);
          await load();
        },
      },
    ]);
  };

  // ── Rating stats ───────────────
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length > 0 ? reviews.filter((r) => r.rating === star).length / reviews.length : 0,
  }));

  if (!manifest) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted }}>{t('store.loading')}</Text>
      </SafeAreaView>
    );
  }

  const catMeta = CATEGORY_META[manifest.category] ?? { labelKey: 'store.catCoaching', color: theme.primary };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color="#1C1A17" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: theme.text }}>{t('store.details')}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
          {/* Hero section */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 20, backgroundColor: catMeta.color + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={(manifest.icon || 'grid') as any} size={32} color={catMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{manifest.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: catMeta.color + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ color: catMeta.color, fontSize: 12, fontWeight: '600' }}>{t(catMeta.labelKey)}</Text>
                  </View>
                  <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 13 }}>
                    {manifest.price === 'free' ? t('store.free') : `${manifest.price} €`}
                  </Text>
                </View>
                {reviews.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Stars rating={avgRating} size={14} />
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      {avgRating.toFixed(1)} · {t('store.reviewCount', { count: String(reviews.length) })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              {isInstalled ? (
                <>
                  <TouchableOpacity onPress={openPlugin}
                    style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('store.open')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={uninstall}
                    style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' }}>
                    <Ionicons name="trash-outline" size={18} color="#F44336" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={install}
                  style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('store.install')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Description */}
          <Card>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 8 }}>{t('store.description')}</Text>
            <Text style={{ color: '#555', fontSize: 14, lineHeight: 22 }}>{manifest.description}</Text>
          </Card>

          {/* Permissions */}
          {(manifest.requiredPermissions?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                {t('store.permissionsRequired')}
              </Text>
              {manifest.requiredPermissions.map((perm) => (
                <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={theme.primary} />
                  </View>
                  <Text style={{ color: '#555', fontSize: 13 }}>{t(PERM_KEYS[perm] || '') || perm}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* AI Skills */}
          {(manifest.aiSkills?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                🤖 {t('store.aiSkills')}
              </Text>
              {manifest.aiSkills.map((skill) => (
                <View key={skill.name} style={{ marginBottom: 10 }}>
                  <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>{skill.name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>{skill.description}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Routes / Screens */}
          {(manifest.routes?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                {t('store.screens')}
              </Text>
              {manifest.routes.map((route) => (
                <View key={route.path} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F4F3F0', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={(route.icon || 'document-text') as any} size={14} color="#7A7670" />
                  </View>
                  <Text style={{ color: '#555', fontSize: 13 }}>{route.title}</Text>
                  {route.showInTabBar && (
                    <View style={{ backgroundColor: '#4CAF5018', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '600' }}>Tab</Text>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}

          {/* Rating breakdown */}
          <Card>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              {t('store.ratingsReviews')}
            </Text>

            {reviews.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
                {/* Big number */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 42, fontWeight: '800', color: theme.text }}>
                    {avgRating.toFixed(1)}
                  </Text>
                  <Stars rating={avgRating} size={16} />
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                    {t('store.reviewCount', { count: String(reviews.length) })}
                  </Text>
                </View>

                {/* Distribution bars */}
                <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                  {ratingDist.map(({ star, count, pct }) => (
                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: theme.muted, fontSize: 11, width: 12, textAlign: 'right' }}>{star}</Text>
                      <Ionicons name="star" size={10} color="#FFB800" />
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F4F3F0' }}>
                        <View style={{ width: `${Math.max(pct * 100, 2)}%`, height: 6, borderRadius: 3, backgroundColor: '#FFB800' }} />
                      </View>
                      <Text style={{ color: '#B0ADA8', fontSize: 11, width: 20, textAlign: 'right' }}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="chatbubble-outline" size={32} color="#E2E0DA" />
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>{t('store.noReviews')}</Text>
              </View>
            )}

            {/* Write / edit review button */}
            {isInstalled && (
              <TouchableOpacity onPress={() => {
                if (myReview) {
                  setReviewRating(myReview.rating);
                  setReviewTitle(myReview.title ?? '');
                  setReviewBody(myReview.body ?? '');
                }
                setShowReviewForm(true);
              }}
                style={{
                  backgroundColor: theme.text, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {myReview ? '✏️  ' + t('store.editReview') : '⭐  ' + t('store.giveReview')}
                </Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Review form */}
          {showReviewForm && (
            <Card>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                {myReview ? t('store.editReview') : t('store.writeReview')}
              </Text>

              {/* Star picker */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons
                      name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= reviewRating ? '#FFB800' : '#D4D2CD'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={reviewTitle}
                onChangeText={setReviewTitle}
                placeholder={t('store.titleOptional')}
                placeholderTextColor="#B0ADA8"
                style={{
                  backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: theme.text, marginBottom: 10,
                }}
              />

              <TextInput
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder={t('store.yourReview')}
                placeholderTextColor="#B0ADA8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.text,
                  minHeight: 100, marginBottom: 12,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setShowReviewForm(false)}
                  style={{ flex: 1, backgroundColor: '#F4F3F0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 14 }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitReview} disabled={submitting}
                  style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    {submitting ? t('store.sending') : t('store.publish')}
                  </Text>
                </TouchableOpacity>
              </View>

              {myReview && (
                <TouchableOpacity onPress={deleteReview} style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ color: '#F44336', fontSize: 13 }}>{t('store.deleteReview')}</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}

          {/* Existing reviews */}
          {reviews.length > 0 && (
            <View style={{ paddingHorizontal: 20 }}>
              {reviews.filter((r) => r.user_id !== user?.id).map((review) => (
                <View key={review.id}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10,
                    borderWidth: 1, borderColor: theme.border,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
                          {(review.user_name ?? 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{review.user_name ?? t('store.user')}</Text>
                    </View>
                    <Stars rating={review.rating} size={12} />
                  </View>
                  {review.title && (
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginTop: 8 }}>{review.title}</Text>
                  )}
                  {review.body && (
                    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{review.body}</Text>
                  )}
                  <Text style={{ color: '#B0ADA8', fontSize: 11, marginTop: 8 }}>
                    {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* My review displayed separately at top of list */}
          {myReview && !showReviewForm && (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{
                backgroundColor: '#FFF8F5', borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: theme.primary + '33',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{t('store.myReview')}</Text>
                  </View>
                  <Stars rating={myReview.rating} size={12} />
                </View>
                {myReview.title && (
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginTop: 8 }}>{myReview.title}</Text>
                )}
                {myReview.body && (
                  <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{myReview.body}</Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable components ───────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  const th = useThemeStore((s) => s.theme);
  return (
    <View style={{
      backgroundColor: th.surface, borderRadius: 16, padding: 18, marginHorizontal: 20,
      marginBottom: 14, borderWidth: 1, borderColor: th.border,
    }}>
      {children}
    </View>
  );
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={i <= Math.round(rating) ? '#FFB800' : '#D4D2CD'}
      />
    );
  }
  return <View style={{ flexDirection: 'row', gap: 1 }}>{stars}</View>;
}

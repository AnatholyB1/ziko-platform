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

import { usePluginRegistry, useTranslation } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';

// ── Design tokens ──────────────────────────────────────────
const BG      = '#F7F6F3';
const SURFACE = '#FFFFFF';
const BORDER  = '#E2E0DA';
const TEXT    = '#1C1A17';
const MUTED   = '#6B6963';
const PRIMARY = '#FF5C1A';
const DARK    = '#1C1A17';

const SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

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

const CATEGORY_LABELS: Record<string, string> = {
  coaching:  'Coaching',
  nutrition: 'Nutrition',
  analytics: 'Analytics',
  persona:   'Persona',
  social:    'Social',
  health:    'Santé',
  training:  'Entraînement',
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
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: MUTED }}>{t('store.loading')}</Text>
      </SafeAreaView>
    );
  }

  const catLabel = CATEGORY_LABELS[manifest.category] ?? manifest.category ?? 'Module';
  const screenshots = (manifest as any).screenshots as string[] | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Back bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {/* ── Dark header ─────────────────── */}
          <View style={{
            backgroundColor: DARK,
            marginHorizontal: 16,
            borderRadius: 20,
            padding: 24,
            marginBottom: 16,
            ...SHADOW,
          }}>
            {/* Icon */}
            <View style={{
              width: 64, height: 64, borderRadius: 18,
              backgroundColor: 'rgba(255,92,26,0.2)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name={(manifest.icon || 'grid') as any} size={30} color={PRIMARY} />
            </View>

            {/* Name */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFAF6' }}>{manifest.name}</Text>

            {/* Category chip */}
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,92,26,0.2)',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              marginTop: 8,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>{catLabel}</Text>
            </View>

            {/* Short description */}
            <Text style={{ fontSize: 13, color: 'rgba(255,250,246,0.7)', marginTop: 10, lineHeight: 20 }}>
              {manifest.description}
            </Text>

            {/* Full-width CTA */}
            {isInstalled ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={openPlugin}
                  style={{
                    flex: 1, backgroundColor: PRIMARY, borderRadius: 14,
                    height: 48, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('store.open')}</Text>
                </TouchableOpacity>
                {!manifest.mandatory && (
                  <TouchableOpacity
                    onPress={uninstall}
                    style={{
                      backgroundColor: 'rgba(255,250,246,0.12)', borderRadius: 14,
                      height: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#F44336" />
                  </TouchableOpacity>
                )}
                {manifest.mandatory && (
                  <TouchableOpacity
                    onLongPress={() => showAlert(t('store.mandatory_tooltip'), '')}
                    style={{
                      backgroundColor: 'rgba(255,250,246,0.12)', borderRadius: 14,
                      height: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
                      opacity: 0.5,
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#F44336" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={install}
                style={{
                  backgroundColor: PRIMARY, borderRadius: 14,
                  height: 48, alignItems: 'center', justifyContent: 'center',
                  marginTop: 16,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Installer gratuitement</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── À propos ────────────────────── */}
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 10 }}>À propos</Text>
            <Text style={{ color: MUTED, fontSize: 14, lineHeight: 22 }}>{manifest.description}</Text>
            {/* Screenshots */}
            {screenshots && screenshots.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 14 }}
                contentContainerStyle={{ gap: 10 }}
              >
                {screenshots.map((url, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 140, height: 260, borderRadius: 12,
                      backgroundColor: BG,
                      borderWidth: 1, borderColor: BORDER,
                      overflow: 'hidden',
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </Card>

          {/* ── Permissions ─────────────────── */}
          {(manifest.requiredPermissions?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 12 }}>
                {t('store.permissionsRequired')}
              </Text>
              {manifest.requiredPermissions.map((perm) => (
                <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#2E9E5B" />
                  <Text style={{ color: TEXT, fontSize: 13, flex: 1 }}>
                    {t(PERM_KEYS[perm] || '') || perm}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {/* ── AI Skills ───────────────────── */}
          {(manifest.aiSkills?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 10 }}>
                {t('store.aiSkills')}
              </Text>
              {manifest.aiSkills.map((skill) => (
                <View key={skill.name} style={{ marginBottom: 10 }}>
                  <Text style={{ color: PRIMARY, fontWeight: '600', fontSize: 14 }}>{skill.name}</Text>
                  <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{skill.description}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* ── Ratings & Reviews ──────────── */}
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 12 }}>
              {t('store.ratingsReviews')}
            </Text>

            {reviews.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 42, fontWeight: '800', color: TEXT }}>
                    {avgRating.toFixed(1)}
                  </Text>
                  <Stars rating={avgRating} size={16} />
                  <Text style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                    {t('store.reviewCount', { count: String(reviews.length) })}
                  </Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                  {ratingDist.map(({ star, count, pct }) => (
                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: MUTED, fontSize: 11, width: 12, textAlign: 'right' }}>{star}</Text>
                      <Ionicons name="star" size={10} color="#FFB800" />
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: BG }}>
                        <View style={{ width: `${Math.max(pct * 100, 2)}%`, height: 6, borderRadius: 3, backgroundColor: '#FFB800' }} />
                      </View>
                      <Text style={{ color: MUTED, fontSize: 11, width: 20, textAlign: 'right' }}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="chatbubble-outline" size={32} color={BORDER} />
                <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>{t('store.noReviews')}</Text>
              </View>
            )}

            {isInstalled && (
              <TouchableOpacity
                onPress={() => {
                  if (myReview) {
                    setReviewRating(myReview.rating);
                    setReviewTitle(myReview.title ?? '');
                    setReviewBody(myReview.body ?? '');
                  }
                  setShowReviewForm(true);
                }}
                style={{ backgroundColor: TEXT, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {myReview ? t('store.editReview') : t('store.giveReview')}
                </Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Review form */}
          {showReviewForm && (
            <Card>
              <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                {myReview ? t('store.editReview') : t('store.writeReview')}
              </Text>
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
                placeholderTextColor={MUTED}
                style={{
                  backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT, marginBottom: 10,
                }}
              />
              <TextInput
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder={t('store.yourReview')}
                placeholderTextColor={MUTED}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: TEXT,
                  minHeight: 100, marginBottom: 12,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setShowReviewForm(false)}
                  style={{ flex: 1, backgroundColor: BG, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: MUTED, fontWeight: '600', fontSize: 14 }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitReview} disabled={submitting}
                  style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}>
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

          {/* My review */}
          {myReview && !showReviewForm && (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{
                backgroundColor: '#FFF8F5', borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: PRIMARY + '33',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <Text style={{ color: TEXT, fontWeight: '700', fontSize: 13 }}>{t('store.myReview')}</Text>
                  </View>
                  <Stars rating={myReview.rating} size={12} />
                </View>
                {myReview.title && (
                  <Text style={{ color: TEXT, fontWeight: '600', fontSize: 14, marginTop: 8 }}>{myReview.title}</Text>
                )}
                {myReview.body && (
                  <Text style={{ color: MUTED, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{myReview.body}</Text>
                )}
              </View>
            </View>
          )}

          {/* Other reviews */}
          {reviews.length > 0 && (
            <View style={{ paddingHorizontal: 20 }}>
              {reviews.filter((r) => r.user_id !== user?.id).map((review) => (
                <View key={review.id} style={{
                  backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 10,
                  borderWidth: 1, borderColor: BORDER,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 13 }}>
                          {(review.user_name ?? 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: TEXT, fontWeight: '600', fontSize: 13 }}>{review.user_name ?? t('store.user')}</Text>
                    </View>
                    <Stars rating={review.rating} size={12} />
                  </View>
                  {review.title && (
                    <Text style={{ color: TEXT, fontWeight: '600', fontSize: 14, marginTop: 8 }}>{review.title}</Text>
                  )}
                  {review.body && (
                    <Text style={{ color: MUTED, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{review.body}</Text>
                  )}
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
                    {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable components ───────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: SURFACE, borderRadius: 16, padding: 18, marginHorizontal: 16,
      marginBottom: 14, borderWidth: 1, borderColor: BORDER, ...SHADOW,
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

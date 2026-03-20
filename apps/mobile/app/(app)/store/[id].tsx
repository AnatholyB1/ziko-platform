import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
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

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  coaching:  { label: 'Coaching',    color: '#FF5C1A' },
  nutrition: { label: 'Nutrition',   color: '#4CAF50' },
  analytics: { label: 'Analytics',   color: '#FF9800' },
  persona:   { label: 'Personnalité',color: '#FF6584' },
  social:    { label: 'Social',      color: '#00BCD4' },
};

const PERM_LABELS: Record<string, string> = {
  read_profile: 'Lire votre profil',
  write_profile: 'Modifier votre profil',
  read_workout_history: 'Historique des séances',
  write_workout: 'Modifier les séances',
  read_nutrition: 'Données nutritionnelles',
  write_nutrition: 'Modifier la nutrition',
  read_habits: 'Données des habitudes',
  write_habits: 'Modifier les habitudes',
  read_ai_history: 'Historique IA',
  notifications: 'Notifications',
  camera: 'Caméra',
};

// ── Detail screen ─────────────────────────────────────────
export default function PluginDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { registerPlugin } = usePluginRegistry();

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
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.name || 'Utilisateur'; });
      allReviews.forEach((r) => { r.user_name = nameMap[r.user_id] || 'Utilisateur'; });
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
    Alert.alert(
      `Installer ${manifest.name} ?`,
      perms.length > 0
        ? `Ce plugin nécessite :\n${perms.map((p) => `• ${PERM_LABELS[p] || p}`).join('\n')}`
        : 'Aucune permission spéciale requise.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Installer', onPress: async () => {
            const { error } = await supabase.from('user_plugins').upsert({ user_id: user.id, plugin_id: id, is_enabled: true });
            if (!error) { setIsInstalled(true); registerPlugin(manifest); }
          },
        },
      ],
    );
  };

  const uninstall = async () => {
    if (!user || !id) return;
    Alert.alert('Désinstaller ?', 'Ce plugin sera retiré.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Désinstaller', style: 'destructive', onPress: async () => {
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
    Alert.alert('Supprimer votre avis ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#7A7670' }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  const catMeta = CATEGORY_META[manifest.category] ?? { label: manifest.category, color: '#FF5C1A' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color="#1C1A17" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>Détails</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />}>
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
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }}>{manifest.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: catMeta.color + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ color: catMeta.color, fontSize: 12, fontWeight: '600' }}>{catMeta.label}</Text>
                  </View>
                  <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 13 }}>
                    {manifest.price === 'free' ? 'Gratuit' : `${manifest.price} €`}
                  </Text>
                </View>
                {reviews.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Stars rating={avgRating} size={14} />
                    <Text style={{ color: '#7A7670', fontSize: 13 }}>
                      {avgRating.toFixed(1)} · {reviews.length} avis
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
                    style={{ flex: 1, backgroundColor: '#FF5C1A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ouvrir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={uninstall}
                    style={{ backgroundColor: '#F4F3F0', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' }}>
                    <Ionicons name="trash-outline" size={18} color="#F44336" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={install}
                  style={{ flex: 1, backgroundColor: '#FF5C1A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Installer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Description */}
          <Card>
            <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 8 }}>Description</Text>
            <Text style={{ color: '#555', fontSize: 14, lineHeight: 22 }}>{manifest.description}</Text>
          </Card>

          {/* Permissions */}
          {(manifest.requiredPermissions?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                Permissions requises
              </Text>
              {manifest.requiredPermissions.map((perm) => (
                <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FF5C1A12', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#FF5C1A" />
                  </View>
                  <Text style={{ color: '#555', fontSize: 13 }}>{PERM_LABELS[perm] || perm}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* AI Skills */}
          {(manifest.aiSkills?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                🤖 Compétences IA
              </Text>
              {manifest.aiSkills.map((skill) => (
                <View key={skill.name} style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#FF5C1A', fontWeight: '600', fontSize: 14 }}>{skill.name}</Text>
                  <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 2 }}>{skill.description}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Routes / Screens */}
          {(manifest.routes?.length ?? 0) > 0 && (
            <Card>
              <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                Écrans inclus
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
            <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              Notes & avis
            </Text>

            {reviews.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
                {/* Big number */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 42, fontWeight: '800', color: '#1C1A17' }}>
                    {avgRating.toFixed(1)}
                  </Text>
                  <Stars rating={avgRating} size={16} />
                  <Text style={{ color: '#7A7670', fontSize: 12, marginTop: 4 }}>
                    {reviews.length} avis
                  </Text>
                </View>

                {/* Distribution bars */}
                <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                  {ratingDist.map(({ star, count, pct }) => (
                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#7A7670', fontSize: 11, width: 12, textAlign: 'right' }}>{star}</Text>
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
                <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 8 }}>Aucun avis pour le moment</Text>
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
                  backgroundColor: '#1C1A17', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {myReview ? '✏️  Modifier mon avis' : '⭐  Donner mon avis'}
                </Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Review form */}
          {showReviewForm && (
            <Card>
              <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                {myReview ? 'Modifier mon avis' : 'Écrire un avis'}
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
                placeholder="Titre (optionnel)"
                placeholderTextColor="#B0ADA8"
                style={{
                  backgroundColor: '#F7F6F3', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1C1A17', marginBottom: 10,
                }}
              />

              <TextInput
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder="Votre avis…"
                placeholderTextColor="#B0ADA8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  backgroundColor: '#F7F6F3', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1C1A17',
                  minHeight: 100, marginBottom: 12,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setShowReviewForm(false)}
                  style={{ flex: 1, backgroundColor: '#F4F3F0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#7A7670', fontWeight: '600', fontSize: 14 }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitReview} disabled={submitting}
                  style={{ flex: 1, backgroundColor: '#FF5C1A', borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    {submitting ? 'Envoi…' : 'Publier'}
                  </Text>
                </TouchableOpacity>
              </View>

              {myReview && (
                <TouchableOpacity onPress={deleteReview} style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ color: '#F44336', fontSize: 13 }}>Supprimer mon avis</Text>
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
                    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
                    borderWidth: 1, borderColor: '#E2E0DA',
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF5C1A18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#FF5C1A', fontWeight: '700', fontSize: 13 }}>
                          {(review.user_name ?? 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 13 }}>{review.user_name ?? 'Utilisateur'}</Text>
                    </View>
                    <Stars rating={review.rating} size={12} />
                  </View>
                  {review.title && (
                    <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 14, marginTop: 8 }}>{review.title}</Text>
                  )}
                  {review.body && (
                    <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 4, lineHeight: 19 }}>{review.body}</Text>
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
                borderWidth: 1, borderColor: '#FF5C1A33',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 13 }}>Mon avis</Text>
                  </View>
                  <Stars rating={myReview.rating} size={12} />
                </View>
                {myReview.title && (
                  <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 14, marginTop: 8 }}>{myReview.title}</Text>
                )}
                {myReview.body && (
                  <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 4, lineHeight: 19 }}>{myReview.body}</Text>
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
  return (
    <View style={{
      backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginHorizontal: 20,
      marginBottom: 14, borderWidth: 1, borderColor: '#E2E0DA',
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

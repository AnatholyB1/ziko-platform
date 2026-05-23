import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import * as ImagePicker from 'expo-image-picker';
import { ProfileHero, PRStatCard } from '@ziko/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

// ── Badge type ───────────────────────────────────────────────────
type BadgeItem = {
  slug: string;
  name: string;
  icon: string;  // emoji
  tier: number;
  earned: boolean;
  earned_at: string | null;
};

// ── Design tokens ────────────────────────────────────────────────
const colors = {
  bg: '#F7F6F3', surface: '#FFFFFF', border: '#E2E0DA', primary: '#FF5C1A',
  text: '#1C1A17', muted: '#6B6963', success: '#22C55E', danger: '#E94B3C', warn: '#E8A33A',
};
const shadow = {
  card: {
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
};

// ── fmtN helper ─────────────────────────────────────────────────
const fmtN = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);

// ── Static badge fallback data ──────────────────────────────────
const STATIC_BADGES = [
  { id: 'regulier',   name: 'Régulier',    icon: 'flame-outline',    tint: '#E94B3C', date: 'JAN 2025' },
  { id: 'force',      name: 'Force x2',    icon: 'barbell-outline',  tint: '#FF5C1A', date: 'FÉV 2025' },
  { id: '100seances', name: '100 séances', icon: 'trophy-outline',   tint: '#E8A33A', date: 'MAR 2025' },
  { id: 'hydro',      name: 'Hydro pro',   icon: 'water-outline',    tint: '#3B82F6', date: 'AVR 2025' },
  { id: 'leve-tot',   name: 'Lève-tôt',   icon: 'sunny-outline',    tint: '#F0B96B', date: 'AVR 2025' },
  { id: 'amis',       name: '+50 amis',    icon: 'people-outline',   tint: '#8B5CF6', date: 'MAI 2025' },
];
const LOCKED_COUNT = 3;

// ── Gallery fallback colors ─────────────────────────────────────
const GALLERY_COLORS = ['#3a342b', '#4a3a2a', '#5a3a25', '#6a3a20'];

// ── PRStatsTab ───────────────────────────────────────────────────
function PRStatsTab({
  stats,
  prRows,
}: {
  stats: { sessions: number; streak: number; prs: number; weeks: number };
  prRows: Array<{ exercise: string; date: string; weight: number; delta: number }>;
}) {
  return (
    <View style={{ gap: 12 }}>
      {/* 2x2 stat grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ width: '48%' }}>
          <PRStatCard icon="barbell-outline" tint="#FF5C1A" value={stats.sessions} label="Séances totales" />
        </View>
        <View style={{ width: '48%' }}>
          <PRStatCard icon="flame-outline" tint="#E94B3C" value={stats.streak} label="Jours d'affilée" />
        </View>
        <View style={{ width: '48%' }}>
          <PRStatCard icon="trophy-outline" tint="#E8A33A" value={stats.prs} label="PR battus" />
        </View>
        <View style={{ width: '48%' }}>
          <PRStatCard icon="flash-outline" tint="#22C55E" value={stats.weeks} label="Semaines actives" />
        </View>
      </View>

      {/* PR récents card */}
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.surface,
          ...shadow.card,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
            PR récents
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/profile/progression' as any)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 999,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
              Tout voir
            </Text>
          </TouchableOpacity>
        </View>

        {/* PR rows */}
        {prRows.length === 0 ? (
          <Text
            style={{
              color: colors.muted,
              textAlign: 'center',
              paddingVertical: 16,
              fontSize: 13,
            }}
          >
            Aucun record pour l'instant
          </Text>
        ) : (
          prRows.map((pr, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 6,
              }}
            >
              {/* Icon */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,92,26,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trophy-outline" size={14} color={colors.primary} />
              </View>
              {/* Text block */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {pr.exercise}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{pr.date}</Text>
              </View>
              {/* Right block */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {pr.weight} kg
                </Text>
                {pr.delta > 0 ? (
                  <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700' }}>
                    +{pr.delta} kg
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ── PRProgressTab ────────────────────────────────────────────────
function PRProgressTab({
  measurements,
  userId,
}: {
  measurements: Array<{ id: string; photo_url: string | null; created_at: string; weight_kg: number | null }>;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleAddPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission refusée', "Autorise l'accès à la galerie dans les Réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', { uri, name: `${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      const fileName = `${userId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, formData, { contentType: 'multipart/form-data', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
      const photoUrl = urlData.publicUrl;
      const { error: insertError } = await supabase.from('body_measurements').insert({
        user_id: userId,
        photo_url: photoUrl,
        date: new Date().toISOString().split('T')[0],
      });
      if (insertError) throw insertError;
      queryClient.invalidateQueries({ queryKey: ['measurements', userId] });
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('storage') || msg.includes('upload')) {
        showAlert('Erreur upload', "Impossible d'envoyer la photo. Vérifie ta connexion.");
      } else if (msg.includes('body_measurements') || msg.includes('column')) {
        showAlert('Erreur base de données', 'La photo a été uploadée mais non sauvegardée.');
      } else {
        showAlert('Erreur', msg || "L'upload a échoué. Réessaie.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoUrl: string, id: string) => {
    showAlert(
      'Supprimer cette photo ?',
      'La photo sera définitivement supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // Extraire le path du storage depuis l'URL publique
            // URL format: .../storage/v1/object/public/profile-photos/{userId}/{timestamp}.jpg
            const urlParts = photoUrl.split('/profile-photos/');
            if (urlParts.length > 1) {
              await supabase.storage.from('profile-photos').remove([urlParts[1]]);
            }
            await supabase.from('body_measurements').delete().eq('id', id);
            queryClient.invalidateQueries({ queryKey: ['measurements', userId] });
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Header line */}
      <Text style={{ fontSize: 12, color: colors.muted, paddingHorizontal: 4 }}>
        {measurements.length} photos · classées par date
      </Text>

      {/* 2-column photo grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {measurements.length === 0 && (
          <Text
            style={{
              width: '100%',
              fontSize: 12,
              color: colors.muted,
              paddingHorizontal: 4,
              marginBottom: 4,
            }}
          >
            Aucune photo pour l'instant
          </Text>
        )}

        {measurements.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onLongPress={() => {
              if (item.photo_url) {
                handleDeletePhoto(item.photo_url, item.id);
              }
            }}
            delayLongPress={500}
            activeOpacity={0.9}
            style={{
              width: '48%',
              aspectRatio: 4 / 5,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: GALLERY_COLORS[index % GALLERY_COLORS.length],
            }}
          >
            {item.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={{ width: '100%', height: '100%', borderRadius: 16 }}
                resizeMode="cover"
              />
            ) : null}
            {/* Label pill */}
            <View
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.42)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {`Sem. ${index + 1}`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Ajouter dashed card */}
        <TouchableOpacity
          onPress={handleAddPhoto}
          disabled={uploading}
          style={{
            width: '48%',
            aspectRatio: 1 / 1.1,
            borderRadius: 16,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.border,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color={colors.muted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>
                Ajouter
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tier tint colors ─────────────────────────────────────────────
const TIER_TINT: Record<number, string> = {
  1: '#E8A33A', // bronze
  2: '#9CA3AF', // silver
  3: '#FFD700', // gold
};
const getTierTint = (tier: number) => TIER_TINT[tier] ?? '#FF5C1A';

// ── PRBadgesTab ──────────────────────────────────────────────────
function PRBadgesTab({ badges }: { badges: BadgeItem[] }) {
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);

  return (
    <View style={{ gap: 12 }}>
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingHorizontal: 4,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {earnedBadges.length} obtenus · {unearnedBadges.length} à débloquer
        </Text>
        <TouchableOpacity style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 }} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Tout voir</Text>
        </TouchableOpacity>
      </View>

      {/* 3-column badge grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {/* Earned badges — full color */}
        {earnedBadges.map((b) => {
          const tint = getTierTint(b.tier);
          return (
            <View
              key={b.slug}
              style={{
                width: '30%',
                padding: 12,
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.surface,
                borderRadius: 12,
                ...shadow.card,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: tint + '24',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>{b.icon}</Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  lineHeight: 14,
                  textAlign: 'center',
                  color: colors.text,
                }}
                numberOfLines={2}
              >
                {b.name}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                }}
              >
                {b.earned_at
                  ? new Date(b.earned_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase()
                  : ''}
              </Text>
            </View>
          );
        })}

        {/* Unearned badges — greyed out at opacity 0.4 */}
        {unearnedBadges.map((b) => {
          const tint = getTierTint(b.tier);
          return (
            <View
              key={b.slug}
              style={{
                width: '30%',
                padding: 12,
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.surface,
                borderRadius: 12,
                opacity: 0.4,
                ...shadow.card,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: tint + '24',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  lineHeight: 14,
                  textAlign: 'center',
                  color: colors.text,
                }}
                numberOfLines={2}
              >
                {b.name}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                }}
              >
                Verrouillé
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── ProfileScreen ────────────────────────────────────────────────
export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stats' | 'progress' | 'badges'>('stats');

  const userId = user?.id ?? null;

  // ── TanStack Query: profile data (extended to include streak + prs) ─
  const { data, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const [profileRes, sessionsRes, followersRes, followingRes, habitLogsRes, prCountRes, prRowsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('name, goal, avatar_color, avatar_url, bio, handle')
          .eq('id', userId!)
          .single(),
        supabase
          .from('workout_sessions')
          .select('id, started_at')
          .eq('user_id', userId!),
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', userId!),
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!),
        supabase
          .from('habit_logs')
          .select('date')
          .eq('user_id', userId!)
          .eq('completed', true)
          .gte('date', sixtyDaysAgoStr)
          .order('date', { ascending: false }),
        supabase
          .from('session_sets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .eq('is_pr', true),
        supabase
          .from('session_sets')
          .select('exercise_id, weight_kg, performed_at, exercises(name)')
          .eq('user_id', userId!)
          .order('weight_kg', { ascending: false }),
      ]);

      const sessions = sessionsRes.data?.length ?? 0;

      // Weeks: count distinct week numbers from workout sessions
      const weeks = (() => {
        const dates = (sessionsRes.data ?? []).map((s: any) => new Date(s.started_at));
        const weekStrs = new Set(
          dates.map((d: Date) => `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`)
        );
        return weekStrs.size;
      })();

      // Streak: consecutive days backward from today using habit_logs
      const streak = (() => {
        const logDates = (habitLogsRes.data ?? []).map((l: any) => l.date as string);
        const uniqueDates = [...new Set(logDates)].sort().reverse();
        let count = 0;
        let current = today;
        for (const d of uniqueDates) {
          if (d === current) {
            count++;
            const prev = new Date(current);
            prev.setDate(prev.getDate() - 1);
            current = prev.toISOString().split('T')[0];
          } else {
            break;
          }
        }
        return count;
      })();

      // PRs: count from session_sets is_pr=true (fallback: 0 if column doesn't exist)
      const prs = prCountRes.error ? 0 : (prCountRes.count ?? 0);

      // PR rows: top 3 distinct exercises by max weight
      const prRows = (() => {
        const rows = prRowsRes.data ?? [];
        const exerciseMap = new Map<string, { exercise: string; weight: number; date: string }>();
        for (const row of rows as any[]) {
          const exerciseId = row.exercise_id;
          const exerciseName = row.exercises?.name ?? exerciseId ?? 'Exercice';
          const weight = row.weight_kg ?? 0;
          const date = row.performed_at
            ? new Date(row.performed_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
            : '';
          if (!exerciseMap.has(exerciseId) || exerciseMap.get(exerciseId)!.weight < weight) {
            exerciseMap.set(exerciseId, { exercise: exerciseName, weight, date });
          }
        }
        return [...exerciseMap.values()]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((r) => ({ ...r, delta: 0 }));
      })();

      return {
        profile: profileRes.data,
        stats: { sessions, weeks, streak, prs },
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        prRows,
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  // ── TanStack Query: measurements (gallery photos) ───────────────
  const { data: measurementsData } = useQuery({
    queryKey: ['measurements', userId],
    queryFn: async () => {
      const { data: mdata } = await supabase
        .from('body_measurements')
        .select('id, photo_url, created_at, weight_kg')
        .eq('user_id', userId!)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4);
      return (mdata ?? []) as Array<{ id: string; photo_url: string | null; created_at: string; weight_kg: number | null }>;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // ── TanStack Query: badges (user_badges JOIN badge_definitions) ─
  const { data: badgesData } = useQuery<BadgeItem[]>({
    queryKey: ['badges', userId],
    queryFn: async () => {
      const [allBadgesRes, earnedRes] = await Promise.all([
        supabase.from('badge_definitions').select('slug, name, icon, tier'),
        supabase.from('user_badges').select('badge_slug, earned_at').eq('user_id', userId!),
      ]);
      if (allBadgesRes.error || !allBadgesRes.data) return [];
      const earnedSlugs = new Set<string>((earnedRes.data ?? []).map((e) => e.badge_slug));
      const earnedMap = new Map<string, string>(
        (earnedRes.data ?? []).map((e) => [e.badge_slug, e.earned_at]),
      );
      const items: BadgeItem[] = allBadgesRes.data.map((b) => ({
        slug: b.slug,
        name: b.name,
        icon: b.icon,
        tier: b.tier,
        earned: earnedSlugs.has(b.slug),
        earned_at: earnedMap.get(b.slug) ?? null,
      }));
      // Sort: earned first, then by tier DESC
      return items.sort((a, b) => {
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return b.tier - a.tier;
      });
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  // ── Fire-and-forget: check_and_award_badges after profile loads ─
  const sessionCount = data?.stats?.sessions;
  useEffect(() => {
    if (userId && sessionCount !== undefined) {
      supabase
        .rpc('check_and_award_badges', { p_user_id: userId })
        .then(() => queryClient.invalidateQueries({ queryKey: ['badges', userId] }));
    }
  }, [sessionCount, userId]);

  // ── Derived values ─────────────────────────────────────────────
  const avatarColor = data?.profile?.avatar_color ?? '#FF5C1A';
  const avatarUrl = data?.profile?.avatar_url ?? null;
  const profileName = data?.profile?.name ?? 'Athlète';
  const initials = profileName
    .split(' ')
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AT';

  const handle =
    data?.profile?.handle ??
    '@' + (data?.profile?.name ?? 'athlete').toLowerCase().replace(/\s+/g, '');

  // ── Skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ height: 160, backgroundColor: '#E2E0DA', opacity: 0.5 }} />
        <View style={{ paddingHorizontal: 16, marginTop: -44 }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              backgroundColor: '#E2E0DA',
              marginBottom: 12,
            }}
          />
          <View
            style={{
              width: 160,
              height: 18,
              backgroundColor: '#E2E0DA',
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <View
            style={{
              height: 48,
              backgroundColor: '#E2E0DA',
              borderRadius: 12,
              marginBottom: 8,
            }}
          />
          <View
            style={{
              height: 36,
              backgroundColor: '#E2E0DA',
              borderRadius: 4,
            }}
          />
        </View>
      </View>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* Hero */}
        <ProfileHero
          avatarColor={avatarColor}
          initials={initials}
          onBack={router.canGoBack() ? () => router.back() : undefined}
          onSettings={() => router.push('/(app)/profile/settings' as any)}
        />

        {/* Identity section */}
        <View style={{ paddingHorizontal: 16, marginTop: -44, zIndex: 2 }}>
          {/* Avatar row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Avatar */}
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                backgroundColor: avatarColor,
                borderWidth: 4,
                borderColor: colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 22,
                elevation: 8,
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: 84, height: 84, borderRadius: 24 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#FFFFFF' }}>
                  {initials}
                </Text>
              )}
            </View>

            {/* Right side — Modifier button */}
            <View style={{ flex: 1, paddingBottom: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/(app)/profile/edit' as any)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={12} color={colors.text} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                  Modifier
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 24,
                color: colors.text,
              }}
            >
              {profileName}
            </Text>
          </View>

          {/* Handle */}
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
            {handle}
          </Text>

          {/* Bio */}
          {data?.profile?.bio ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '400',
                lineHeight: 20,
                color: colors.text,
                marginBottom: 12,
              }}
            >
              {data.profile.bio}
            </Text>
          ) : null}

          {/* Goal pill card */}
          <View
            style={{
              padding: 8,
              paddingHorizontal: 12,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              marginBottom: 16,
              backgroundColor: 'rgba(255,92,26,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,92,26,0.18)',
              borderRadius: 12,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="radio-button-on-outline" size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.primary,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                OBJECTIF
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 1 }}
              >
                {data?.profile?.goal ?? 'Ajoute ton objectif'}
              </Text>
            </View>
          </View>

          {/* Followers row */}
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              paddingVertical: 8,
              paddingBottom: 16,
              paddingHorizontal: 4,
            }}
          >
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {fmtN(data?.followers ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                ABONNÉS
              </Text>
            </View>

            <View
              style={{ width: 1, backgroundColor: colors.border, alignSelf: 'stretch' }}
            />

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {fmtN(data?.following ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                ABONNEMENTS
              </Text>
            </View>

            <View
              style={{ width: 1, backgroundColor: colors.border, alignSelf: 'stretch' }}
            />

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {fmtN(data?.stats.weeks ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                SEMAINES
              </Text>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View
          style={{
            backgroundColor: colors.bg,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
          }}
        >
          {(
            [
              { key: 'stats', label: 'Stats' },
              { key: 'progress', label: 'Progrès' },
              { key: 'badges', label: 'Badges' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 8,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor:
                  activeTab === tab.key ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeTab === tab.key ? colors.text : colors.muted,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}>
          {(data?.stats.sessions ?? 0) === 0 ? (
            /* Empty state */
            <View
              style={{
                padding: 32,
                paddingHorizontal: 24,
                backgroundColor: colors.surface,
                borderRadius: 16,
                alignItems: 'center',
                ...shadow.card,
              }}
            >
              <Ionicons name="stats-chart-outline" size={40} color={colors.muted} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.text,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Aucune activité pour l'instant
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.muted,
                  lineHeight: 20,
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                Complète ton profil et commence ta première séance pour voir tes stats.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  try {
                    router.push('/(app)/(workout)/session' as any);
                  } catch {
                    showAlert('Navigation', 'Lance une séance depuis le menu principal.');
                  }
                }}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  marginTop: 16,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  Démarrer une séance
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Real tab content */
            <>
              {activeTab === 'stats' && (
                <PRStatsTab
                  stats={data!.stats}
                  prRows={data?.prRows ?? []}
                />
              )}
              {activeTab === 'progress' && (
                <PRProgressTab measurements={measurementsData ?? []} userId={userId ?? ''} />
              )}
              {activeTab === 'badges' && (
                <PRBadgesTab badges={badgesData ?? []} />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

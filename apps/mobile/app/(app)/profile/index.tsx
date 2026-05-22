import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { ProfileHero } from '@ziko/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

// ── fmtN helper ─────────────────────────────────────────────────
const fmtN = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);

// ── ProfileScreen ────────────────────────────────────────────────
export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<'stats' | 'progress' | 'badges'>('stats');

  const userId = user?.id ?? null;

  // ── TanStack Query ─────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const [profileRes, sessionsRes, followersRes, followingRes] = await Promise.all([
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
      ]);

      const sessions = sessionsRes.data?.length ?? 0;
      const weeks = (() => {
        const dates = (sessionsRes.data ?? []).map((s: any) => new Date(s.started_at));
        const weekStrs = new Set(
          dates.map((d: Date) => `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`)
        );
        return weekStrs.size;
      })();

      return {
        profile: profileRes.data,
        stats: { sessions, weeks, streak: 0, prs: 0 },
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  // ── Derived values ─────────────────────────────────────────────
  const avatarColor = data?.profile?.avatar_color ?? '#FF5C1A';
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
      <View style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
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
    <View style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
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
                borderColor: '#F7F6F3',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 22,
                elevation: 8,
              }}
            >
              <Text style={{ fontSize: 32, fontWeight: '700', color: '#FFFFFF' }}>
                {initials}
              </Text>
            </View>

            {/* Right side — Modifier button */}
            <View style={{ flex: 1, paddingBottom: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/(app)/profile/settings' as any)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#E2E0DA',
                  backgroundColor: 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={12} color="#1C1A17" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1C1A17' }}>
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
                color: '#1C1A17',
              }}
            >
              {profileName}
            </Text>
          </View>

          {/* Handle */}
          <Text style={{ fontSize: 12, color: '#6B6963', marginBottom: 8 }}>
            {handle}
          </Text>

          {/* Bio */}
          {data?.profile?.bio ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '400',
                lineHeight: 20,
                color: '#1C1A17',
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
                backgroundColor: '#FF5C1A',
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
                  color: '#FF5C1A',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                OBJECTIF
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: '#1C1A17', marginTop: 1 }}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {fmtN(data?.followers ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#6B6963',
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
              style={{ width: 1, backgroundColor: '#E2E0DA', alignSelf: 'stretch' }}
            />

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {fmtN(data?.following ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#6B6963',
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
              style={{ width: 1, backgroundColor: '#E2E0DA', alignSelf: 'stretch' }}
            />

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1C1A17' }}>
                {fmtN(data?.stats.weeks ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#6B6963',
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
            backgroundColor: '#F7F6F3',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 4,
            borderBottomWidth: 1,
            borderBottomColor: '#E2E0DA',
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
                  activeTab === tab.key ? '#FF5C1A' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeTab === tab.key ? '#1C1A17' : '#6B6963',
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
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                alignItems: 'center',
                shadowColor: '#1C1A17',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Ionicons name="stats-chart-outline" size={40} color="#6B6963" />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#1C1A17',
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Aucune activité pour l'instant
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#6B6963',
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
                  backgroundColor: '#FF5C1A',
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
            /* Tabs placeholder — wired in plan 35-02 */
            <View />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

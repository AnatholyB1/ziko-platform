import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../../apps/mobile/src/stores/authStore';
import { useRouter } from 'expo-router';

// ── Types ───────────────────────────────────────────────────────────────────

interface VideoPlayerScreenProps {
  supabase: any;
  videoId: string;
}

interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
  type?: 'text' | 'voice';
  audio_path?: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const micBadgeStyle = {
  width: 20, height: 20, borderRadius: 10,
  backgroundColor: '#FFF0E8',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexShrink: 0,
  marginTop: 1,
};

function formatMmSs(s: number): string {
  return (
    String(Math.floor(s / 60)).padStart(2, '0') +
    ':' +
    String(Math.floor(s % 60)).padStart(2, '0')
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VideoPlayerScreen({ supabase, videoId }: VideoPlayerScreenProps) {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [duration, setDuration] = useState(0);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  // ── Signed URL fetch ──
  const { data: signedUrl, isLoading: urlLoading, isError: urlError } = useQuery<string>({
    queryKey: ['coach-video-signed-url', videoId],
    queryFn: async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token ?? '';
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/signed-url`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('Failed to get signed URL');
      return (await res.json()).signedUrl as string;
    },
    enabled: !!videoId,
    staleTime: 10 * 60 * 1000, // 10 min (URL expires in 15, refresh before)
  });

  // ── Annotations fetch ──
  const { data: annotations = [] } = useQuery<Annotation[]>({
    queryKey: ['coach-video-annotations', videoId],
    queryFn: async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token ?? '';
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/annotations`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return [];
      return (await res.json()) as Annotation[];
    },
    enabled: !!videoId,
  });

  // ── expo-video player ──
  const player = useVideoPlayer(signedUrl ?? '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });

  // Track current time (full initial state to satisfy TimeUpdateEventPayload type)
  useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: player.currentTime,
  });

  // Listen for status changes to get duration
  const { status: playerStatus } = useEvent(player, 'statusChange', { status: player.status });

  // Set duration when player is ready
  React.useEffect(() => {
    if (playerStatus === 'readyToPlay' && player.duration > 0) {
      setDuration(player.duration);
    }
  }, [playerStatus, player.duration]);

  // ── Layout ──
  const { width: screenWidth } = Dimensions.get('window');
  const trackWidth = screenWidth - 32; // 16px padding each side

  // Active annotation
  const activeAnnotation = annotations.find((a) => a.id === activeAnnotationId);

  // ── Render ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          height: 48,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.background,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#1C1A17',
            flex: 1,
          }}
          numberOfLines={1}
        >
          Vidéo
        </Text>
      </View>

      {/* Video area */}
      {urlLoading || !signedUrl ? (
        <View
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: '#000000',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {urlError ? (
            <>
              <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  marginTop: 8,
                }}
              >
                Impossible de charger la vidéo
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '400',
                  color: '#6B6963',
                  marginTop: 4,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                }}
              >
                Revenez plus tard ou contactez votre coach.
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator color="#FF5C1A" size="large" />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '400',
                  color: '#FFFFFF',
                  marginTop: 8,
                }}
              >
                Chargement de la vidéo...
              </Text>
            </>
          )}
        </View>
      ) : (
        <VideoView
          player={player}
          style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000' }}
          contentFit="contain"
          nativeControls={true}
          allowsPictureInPicture={false}
        />
      )}

      {/* Annotation Timeline Strip */}
      <View
        style={{
          height: 36,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E0DA',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E0DA',
          position: 'relative',
        }}
      >
        {/* Track bar */}
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: '50%',
            transform: [{ translateY: -1.5 }],
            height: 3,
            backgroundColor: '#E2E0DA',
            borderRadius: 2,
          }}
        />

        {/* Annotation dots — only render when duration > 0 */}
        {duration > 0 &&
          annotations.map((a) => {
            const leftOffset = (a.timestamp_s / duration) * trackWidth + 16;
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => {
                  player.currentTime = a.timestamp_s;
                  setActiveAnnotationId(a.id);
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: leftOffset - 22,
                  transform: [{ translateY: -22 }],
                  width: 44,
                  height: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#FF5C1A',
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    shadowColor: '#1C1A17',
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                    elevation: 3,
                  }}
                />
              </TouchableOpacity>
            );
          })}
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
      >
        {/* Active annotation card */}
        {activeAnnotation && (
          <View
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#FF5C1A',
              shadowColor: '#1C1A17',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            {/* Close button */}
            <TouchableOpacity
              onPress={() => setActiveAnnotationId(null)}
              style={{ position: 'absolute', top: 8, right: 8 }}
              accessibilityLabel="Fermer le commentaire"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#6B6963" />
            </TouchableOpacity>

            {/* Timestamp chip — with mic badge for voice annotations */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {activeAnnotation.type === 'voice' && (
                <View style={micBadgeStyle}>
                  <Ionicons name="mic-outline" size={10} color="#FF5C1A" />
                </View>
              )}
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFF0E8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '400', color: '#C2410C', fontVariant: ['tabular-nums'] }}>
                  {formatMmSs(activeAnnotation.timestamp_s)}
                </Text>
              </View>
            </View>

            {/* Annotation text */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: '400',
                color: '#1C1A17',
                lineHeight: 21,
                marginTop: 8,
                paddingRight: 24,
              }}
            >
              {activeAnnotation.content}
            </Text>
          </View>
        )}

        {/* Annotation list */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#1C1A17',
            paddingVertical: 12,
          }}
        >
          Tous les commentaires ({annotations.length})
        </Text>

        {annotations.length === 0 ? (
          <View
            style={{
              paddingVertical: 32,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#E2E0DA" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#1C1A17',
              }}
            >
              Aucun commentaire
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '400',
                color: '#6B6963',
                textAlign: 'center',
              }}
            >
              Votre coach n'a pas encore ajouté d'annotations.
            </Text>
          </View>
        ) : (
          annotations.map((a, index) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => {
                player.currentTime = a.timestamp_s;
                setActiveAnnotationId(a.id);
              }}
              activeOpacity={0.7}
              accessibilityLabel={a.type === 'voice' ? `Annotation vocale à ${formatMmSs(a.timestamp_s)} : ${a.content}` : undefined}
              style={{
                paddingVertical: 10,
                borderBottomWidth: index < annotations.length - 1 ? 1 : 0,
                borderBottomColor: '#E2E0DA',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              {/* Mic badge — voice annotations only */}
              {a.type === 'voice' && (
                <View style={micBadgeStyle}>
                  <Ionicons name="mic-outline" size={10} color="#FF5C1A" />
                </View>
              )}

              {/* Timestamp chip */}
              <View
                style={{
                  backgroundColor: '#FFF0E8',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '400',
                    color: '#C2410C',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatMmSs(a.timestamp_s)}
                </Text>
              </View>

              {/* Annotation content */}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '400',
                  color: '#1C1A17',
                  flex: 1,
                  lineHeight: 21,
                }}
              >
                {a.content}
              </Text>
              {/* TODO: audio player on mobile — post-v1.13 */}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

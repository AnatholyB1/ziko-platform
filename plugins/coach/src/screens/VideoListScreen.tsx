import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../../apps/mobile/src/stores/authStore';
import { useRouter } from 'expo-router';
import { VideoUploadSheet } from './VideoUploadSheet';

// ── Types ──────────────────────────────────────────────────────────────────

interface VideoListScreenProps {
  supabase: any;
}

type VideoStatus = 'uploading' | 'ready' | 'annotated';

interface VideoRow {
  id: string;
  title: string;
  created_at: string;
  status: VideoStatus;
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, theme }: { status: VideoStatus; theme: any }) {
  if (status === 'uploading') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <ActivityIndicator size="small" color={theme.muted} />
        <Text style={{ fontSize: 11, color: theme.muted }}>En cours...</Text>
      </View>
    );
  }

  if (status === 'ready') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#2E9E5B',
          }}
        />
        <Text style={{ fontSize: 11, color: '#2E9E5B', fontWeight: '600' }}>Prête</Text>
      </View>
    );
  }

  // annotated
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.primary,
        }}
      />
      <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>Annotée</Text>
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function VideoListScreen({ supabase }: VideoListScreenProps) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [showUploadSheet, setShowUploadSheet] = useState(false);

  // ── Videos query ──
  const { data: videos = [], isLoading } = useQuery<VideoRow[]>({
    queryKey: ['coach-videos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('coach_client_videos')
        .select('id, title, created_at, status')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // ── Handlers ──
  function handleUploadComplete() {
    queryClient.invalidateQueries({ queryKey: ['coach-videos'] });
    setShowUploadSheet(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1.2,
            color: theme.primary,
            textTransform: 'uppercase',
          }}
        >
          MES VIDÉOS
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
      >
        {/* Loading state */}
        {isLoading && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {/* Empty state */}
        {!isLoading && videos.length === 0 && (
          <View
            style={{
              alignItems: 'center',
              paddingTop: 80,
              paddingHorizontal: 32,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={48} color={theme.muted} />
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: theme.text,
                marginTop: 16,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Aucune vidéo uploadée
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.muted,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Appuie sur le bouton + pour uploader ta première vidéo
            </Text>
          </View>
        )}

        {/* Video list */}
        {!isLoading &&
          videos.map((video) => (
            <TouchableOpacity
              key={video.id}
              activeOpacity={0.7}
              onPress={() => {
                if (video.status === 'annotated' || video.status === 'ready') {
                  router.push(`/(plugins)/coach/video-player?videoId=${video.id}` as any);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                marginBottom: 8,
                padding: 14,
              }}
            >
              {/* Icon */}
              <View style={{ marginRight: 12 }}>
                <Ionicons name="videocam-outline" size={24} color={theme.muted} />
              </View>

              {/* Title + date */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: 3,
                  }}
                  numberOfLines={1}
                >
                  {video.title}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted }}>
                  {format(new Date(video.created_at), 'dd MMMM yyyy', { locale: fr })}
                </Text>
              </View>

              {/* Status badge */}
              <StatusBadge status={video.status} theme={theme} />
            </TouchableOpacity>
          ))}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => setShowUploadSheet(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Upload sheet */}
      <VideoUploadSheet
        visible={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        onUploadComplete={handleUploadComplete}
        supabase={supabase}
        apiUrl={process.env.EXPO_PUBLIC_API_URL ?? ''}
      />
    </SafeAreaView>
  );
}

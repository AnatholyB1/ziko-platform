import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VideoUploadSheetProps {
  visible: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  supabase: any;
  apiUrl: string;
}

interface PickedAsset {
  uri: string;
  durationMs: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function todayTitle(): string {
  return 'Exercice ' + new Date().toISOString().slice(0, 10);
}

// ── Component ──────────────────────────────────────────────────────────────

export function VideoUploadSheet({
  visible,
  onClose,
  onUploadComplete,
  supabase,
  apiUrl,
}: VideoUploadSheetProps) {
  const theme = useThemeStore((s) => s.theme);

  const [title, setTitle] = useState(todayTitle());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<PickedAsset | null>(null);

  // Track whether we've already shown the picker dialog for this open
  const pickerShownRef = useRef(false);

  useEffect(() => {
    if (visible && !pickerShownRef.current) {
      pickerShownRef.current = true;
      // Reset state on each open
      setTitle(todayTitle());
      setUploadProgress(0);
      setIsUploading(false);
      setPickedAsset(null);
      // Show source picker after short delay so Modal renders first
      setTimeout(() => {
        showAlert('Source vidéo', 'Choisir une source', [
          { text: 'Annuler', style: 'cancel', onPress: onClose },
          { text: 'Galerie', onPress: pickFromLibrary },
          { text: 'Caméra', onPress: recordWithCamera },
        ]);
      }, 100);
    }
    if (!visible) {
      pickerShownRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Picker functions ────────────────────────────────────────────────────

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission refusée', "L'accès à la galerie est nécessaire.");
      onClose();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      videoMaxDuration: 0,
    });

    if (result.canceled || !result.assets?.[0]) {
      onClose();
      return;
    }

    const asset = result.assets[0];
    setPickedAsset({ uri: asset.uri, durationMs: asset.duration ?? 0 });
  }

  async function recordWithCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission refusée', "L'accès à la caméra est nécessaire.");
      onClose();
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      videoMaxDuration: 0,
    });

    if (result.canceled || !result.assets?.[0]) {
      onClose();
      return;
    }

    const asset = result.assets[0];
    setPickedAsset({ uri: asset.uri, durationMs: asset.duration ?? 0 });
  }

  // ── XHR upload ──────────────────────────────────────────────────────────

  async function uploadVideoWithProgress(
    signedUrl: string,
    localUri: string,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', 'video/mp4');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      // React Native: send file URI directly (not fetch().blob())
      xhr.send({ uri: localUri, type: 'video/mp4', name: 'upload.mp4' } as any);
    });
  }

  // ── Main upload flow ────────────────────────────────────────────────────

  async function handleUpload() {
    if (!pickedAsset) return;
    if (!title.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Step 2: Request signed upload URL from Hono
      const urlRes = await fetch(`${apiUrl}/coach/videos/upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!urlRes.ok) throw new Error(`upload-url error: ${urlRes.status}`);
      const { signedUrl, videoId } = await urlRes.json();

      // Step 3: XHR PUT directly to Supabase Storage
      await uploadVideoWithProgress(signedUrl, pickedAsset.uri, (pct) => {
        setUploadProgress(pct);
      });

      // Step 4: Complete the upload — Hono inserts DB row and sends push
      const durationS = Math.round(pickedAsset.durationMs / 1000);
      const completeRes = await fetch(`${apiUrl}/coach/videos/${videoId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim(), duration_s: durationS }),
      });

      if (!completeRes.ok) throw new Error(`complete error: ${completeRes.status}`);

      // Step 5: Notify parent
      onUploadComplete();
      onClose();
    } catch (err) {
      console.error('[VideoUploadSheet] Upload error:', err);
      showAlert('Erreur', "L'upload a échoué. Réessaie.");
      setIsUploading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const isUploadDisabled = !title.trim() || isUploading || !pickedAsset;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            disabled={isUploading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: `${theme.text}0F`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '700',
              color: theme.text,
            }}
          >
            Uploader une vidéo
          </Text>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 }}>
          {/* Video picked indicator */}
          {pickedAsset && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 14,
                marginBottom: 20,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: `${theme.primary}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="videocam" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 2 }}
                >
                  Vidéo sélectionnée
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted }}>
                  Durée : {formatDuration(pickedAsset.durationMs)}
                </Text>
              </View>
            </View>
          )}

          {/* Title input */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: theme.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            Titre de la vidéo *
          </Text>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 24,
            }}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Titre de la vidéo"
              placeholderTextColor={theme.muted}
              style={{ fontSize: 15, color: theme.text }}
              editable={!isUploading}
              returnKeyType="done"
            />
          </View>

          {/* Progress bar */}
          {isUploading && (
            <View style={{ marginBottom: 20 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 12, color: theme.muted }}>Upload en cours…</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
                  {uploadProgress}%
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  backgroundColor: `${theme.primary}20`,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    backgroundColor: theme.primary,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          )}

          {/* Upload button */}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={isUploadDisabled}
            style={{
              backgroundColor: isUploadDisabled ? `${theme.primary}60` : theme.primary,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            )}
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              {isUploading ? 'Upload en cours…' : 'Uploader la vidéo'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

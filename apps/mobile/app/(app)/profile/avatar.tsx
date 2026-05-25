import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

interface AvatarPreset {
  id: string;
  color: string;
}

const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'orange', color: '#FF5C1A' },
  { id: 'blue',   color: '#2E7BF6' },
  { id: 'green',  color: '#2E9E5B' },
  { id: 'violet', color: '#7B5BD0' },
  { id: 'red',    color: '#E94B3C' },
  { id: 'pink',   color: '#E91E63' },
  { id: 'amber',  color: '#E8A33A' },
  { id: 'teal',   color: '#2EC4B6' },
  { id: 'dark',   color: '#1C1A17' },
  { id: 'gray',   color: '#6B6963' },
  { id: 'indigo', color: '#4338CA' },
  { id: 'rose',   color: '#F43F5E' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AvatarUploadScreen() {
  const theme = useThemeStore((s) => s.theme);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [selectedPreset, setSelectedPreset] = useState(
    profile?.avatar_color ?? 'orange'
  );
  const [displayName, setDisplayName] = useState(profile?.name ?? '');
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const preset = AVATAR_PRESETS.find((p) => p.id === selectedPreset) ?? AVATAR_PRESETS[0];
  const initials = getInitials(displayName || profile?.name || 'AT');

  // ── Upload helpers ────────────────────────────────────────

  async function uploadToStorage(uri: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Resize to max 800px before upload
    let finalUri = uri;
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      finalUri = resized.uri;
    } catch {
      // fallback to original if manipulator fails (Android compat)
    }

    const path = `${user.id}/avatar.jpg`;

    // FormData approach — fetch(localUri).blob() fails on Android physical devices
    const formData = new FormData();
    formData.append('file', { uri: finalUri, name: 'avatar.jpg', type: 'image/jpeg' } as any);

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, formData, { upsert: true, contentType: 'image/jpeg' });

    if (error) {
      console.warn('[Avatar] Storage upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Bust cache so the new image loads immediately
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  // ── Handlers ─────────────────────────────────────────────

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission refusée', "L'accès à la galerie est nécessaire pour changer ta photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const publicUrl = await uploadToStorage(result.assets[0].uri);
      if (!publicUrl) {
        showAlert('Erreur', "Impossible d'uploader la photo. Réessaie.");
        return;
      }
      setLocalAvatarUri(publicUrl);

      // Persist avatar_url immediately
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);
        await refreshProfile();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission refusée', "L'accès à la caméra est nécessaire pour prendre une photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const publicUrl = await uploadToStorage(result.assets[0].uri);
      if (!publicUrl) {
        showAlert('Erreur', "Impossible d'uploader la photo. Réessaie.");
        return;
      }
      setLocalAvatarUri(publicUrl);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);
        await refreshProfile();
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePickPhotoSheet = () => {
    showAlert('Photo de profil', 'Choisir une source', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Galerie photo', onPress: handlePickPhoto },
      { text: 'Appareil photo', onPress: handleTakePhoto },
    ]);
  };

  const handleRemovePhoto = () => {
    showAlert(
      'Retirer la photo',
      'Ta photo de profil sera remplacée par tes initiales.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Delete from storage (best-effort)
              await supabase.storage
                .from('avatars')
                .remove([`${user.id}/avatar.jpg`]);

              await supabase
                .from('user_profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

              setLocalAvatarUri(null);
              await refreshProfile();
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const updates: Record<string, string> = {
        avatar_color: selectedPreset,
      };
      if (displayName.trim()) updates.name = displayName.trim();

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;

      await refreshProfile();
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde';
      showAlert('Erreur', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: `${theme.text}0F`,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Identité
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>
            Modifier le profil
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Avatar preview card */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 24,
          borderWidth: 1, borderColor: theme.border,
          alignItems: 'center', gap: 14, marginBottom: 16,
        }}>
          {/* Avatar circle */}
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: preset.color,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: preset.color,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
            overflow: 'hidden',
          }}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : localAvatarUri ? (
              <Image
                source={{ uri: localAvatarUri }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{initials}</Text>
            )}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={handlePickPhotoSheet}
              disabled={uploading}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                backgroundColor: theme.primary,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Ionicons name="camera-outline" size={15} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Importer une photo</Text>
            </TouchableOpacity>
            {localAvatarUri && (
              <TouchableOpacity
                onPress={handleRemovePhoto}
                disabled={uploading}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: `${theme.text}0F`,
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <Ionicons name="trash-outline" size={15} color={theme.muted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>Retirer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Color presets */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
        }}>
          Couleur d'avatar
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: theme.border, marginBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {AVATAR_PRESETS.map((p) => {
              const selected = selectedPreset === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPreset(p.id)}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: p.color,
                    borderWidth: 3,
                    borderColor: selected ? theme.text : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Display name */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
        }}>
          Nom affiché
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: theme.border, marginBottom: 24,
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 11,
            borderWidth: 1, borderColor: theme.border, borderRadius: 12,
            backgroundColor: theme.background,
          }}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={{ flex: 1, fontSize: 13, color: theme.text }}
              placeholder="Ton nom complet"
              placeholderTextColor={theme.muted}
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || uploading}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', opacity: (isSaving || uploading) ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

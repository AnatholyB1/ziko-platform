import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

interface AvatarPreset {
  id: string;
  color: string;
  initials: string;
}

const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'orange', color: '#FF5C1A', initials: 'LM' },
  { id: 'blue', color: '#2E7BF6', initials: 'LM' },
  { id: 'green', color: '#2E9E5B', initials: 'LM' },
  { id: 'violet', color: '#7B5BD0', initials: 'LM' },
  { id: 'red', color: '#E94B3C', initials: 'LM' },
  { id: 'pink', color: '#E91E63', initials: 'LM' },
  { id: 'amber', color: '#E8A33A', initials: 'LM' },
  { id: 'teal', color: '#2EC4B6', initials: 'LM' },
  { id: 'dark', color: '#1C1A17', initials: 'LM' },
  { id: 'gray', color: '#6B6963', initials: 'LM' },
  { id: 'indigo', color: '#4338CA', initials: 'LM' },
  { id: 'rose', color: '#F43F5E', initials: 'LM' },
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

  const [selectedPreset, setSelectedPreset] = useState('orange');
  const [displayName, setDisplayName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const preset = AVATAR_PRESETS.find((p) => p.id === selectedPreset) ?? AVATAR_PRESETS[0];
  const initials = getInitials(displayName) || preset.initials;

  const handlePickPhoto = () => {
    showAlert(
      'Importer une photo',
      'Pour importer une photo, va dans Réglages > Profil > Modifier. La galerie photo est disponible depuis cet écran.',
      [{ text: 'OK' }]
    );
  };

  const handleRemovePhoto = () => {
    showAlert(
      'Retirer la photo',
      'Ta photo de profil sera remplacée par tes initiales.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const updates: Record<string, string> = {};
      if (displayName.trim()) updates.name = displayName.trim();

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      }

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
          }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{initials}</Text>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={handlePickPhoto}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                backgroundColor: theme.primary,
              }}
            >
              <Ionicons name="camera-outline" size={15} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Importer une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRemovePhoto}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                backgroundColor: `${theme.text}0F`,
              }}
            >
              <Ionicons name="trash-outline" size={15} color={theme.muted} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>Retirer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Color presets */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
        }}>
          Ou choisis une couleur
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
                    borderWidth: selected ? 3 : 3,
                    borderColor: selected ? theme.text : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
                    {initials}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Public info form */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
        }}>
          Infos publiques
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: theme.border, gap: 16, marginBottom: 20,
        }}>
          {/* Name field */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Nom complet
            </Text>
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

          {/* Handle field */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Pseudo
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 11,
              borderWidth: 1, borderColor: theme.border, borderRadius: 12,
              backgroundColor: theme.background,
            }}>
              <Text style={{ fontSize: 13, color: theme.muted, fontWeight: '600' }}>@</Text>
              <TextInput
                value={handle}
                onChangeText={setHandle}
                style={{ flex: 1, fontSize: 13, color: theme.text }}
                placeholder="ton.pseudo"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Bio field */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Bio
            </Text>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 11,
              borderWidth: 1, borderColor: theme.border, borderRadius: 12,
              backgroundColor: theme.background,
            }}>
              <TextInput
                value={bio}
                onChangeText={(t) => t.length <= 120 && setBio(t)}
                multiline
                numberOfLines={3}
                style={{ fontSize: 13, color: theme.text, minHeight: 60, textAlignVertical: 'top' }}
                placeholder="Dis quelque chose sur toi…"
                placeholderTextColor={theme.muted}
              />
            </View>
            <Text style={{ fontSize: 10, color: theme.muted, textAlign: 'right', marginTop: 4 }}>
              {bio.length}/120
            </Text>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', opacity: isSaving ? 0.6 : 1,
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

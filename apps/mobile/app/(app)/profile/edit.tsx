import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

// ── Design tokens ────────────────────────────────────────────────
const colors = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E2E0DA',
  primary: '#FF5C1A',
  text: '#1C1A17',
  muted: '#6B6963',
  success: '#22C55E',
  danger: '#E94B3C',
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

// ── Options objectif ─────────────────────────────────────────────
const GOAL_OPTIONS = [
  { id: 'muscle_gain', label: 'Prise de muscle' },
  { id: 'fat_loss', label: 'Perte de poids' },
  { id: 'maintenance', label: 'Maintien' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'strength', label: 'Force' },
  { id: 'health', label: 'Santé générale' },
];

type GoalId = 'muscle_gain' | 'fat_loss' | 'maintenance' | 'endurance' | 'strength' | 'health';

// ── STHeader local ───────────────────────────────────────────────
function STHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: 'rgba(28,26,23,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>{title}</Text>
    </View>
  );
}

// ── EditProfileScreen ────────────────────────────────────────────
export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const theme = useThemeStore((s) => s.theme);

  const userId = user?.id ?? '';

  // ── State ──────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [goal, setGoal] = useState<GoalId | ''>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState('#FF5C1A');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  // ── Pré-remplissage depuis profile store ────────────────────────
  useEffect(() => {
    if (profile) {
      setName((profile as any).name ?? '');
      setBio((profile as any).settings?.bio ?? (profile as any).bio ?? '');
      setGoal(((profile as any).goal as GoalId) ?? '');
      setAvatarUrl((profile as any).avatar_url ?? null);
      setAvatarColor((profile as any).avatar_color ?? '#FF5C1A');
    }
  }, [profile]);

  // ── Initiales ──────────────────────────────────────────────────
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AT';

  // ── Upload avatar ──────────────────────────────────────────────
  const uploadAvatar = async (uri: string) => {
    if (!userId) return;
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/avatar.jpg`, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        showAlert('Erreur', uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${userId}/avatar.jpg`);

      const publicUrl = urlData.publicUrl;

      // Upsert avatar_url dans user_profiles
      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, avatar_url: publicUrl });

      if (upsertError) {
        showAlert('Erreur', upsertError.message);
        return;
      }

      setAvatarUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (err: any) {
      showAlert('Erreur', err?.message ?? 'Impossible de télécharger la photo.');
    } finally {
      setUploading(false);
    }
  };

  // ── Sélection avatar ───────────────────────────────────────────
  const handleAvatarPress = () => {
    showAlert('Photo de profil', 'Choisir une option', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            await uploadAvatar(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Choisir dans la galerie',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            await uploadAvatar(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Annuler',
        style: 'cancel',
      },
    ]);
  };

  // ── Enregistrer ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Charger settings existants
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();

      const existingSettings = (existing as any)?.settings ?? {};

      const { error } = await supabase.from('user_profiles').upsert({
        id: userId,
        name: name.trim(),
        goal: goal || null,
        settings: { ...existingSettings, bio: bio.trim() },
      });

      if (error) {
        showAlert('Erreur', error.message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      router.back();
    } catch (err: any) {
      showAlert('Erreur', err?.message ?? 'Impossible de sauvegarder les modifications.');
    } finally {
      setSaving(false);
    }
  };

  // ── Libellé objectif ───────────────────────────────────────────
  const goalLabel = GOAL_OPTIONS.find((o) => o.id === goal)?.label ?? 'Choisir un objectif';

  // ── Rendu ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <STHeader onBack={() => router.back()} title="Modifier le profil" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section avatar ──────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
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
              ...shadow.card,
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

            {/* Overlay chargement */}
            {uploading && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                }}
              >
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
          </View>

          {/* Bouton Modifier photo */}
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={uploading}
            style={{ marginTop: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
              Modifier la photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Formulaire ─────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            ...shadow.card,
            paddingVertical: 4,
          }}
        >
          {/* Nom */}
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              Nom
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ton prénom"
              placeholderTextColor={colors.muted}
              style={{
                fontSize: 14,
                color: colors.text,
                paddingTop: 4,
              }}
            />
          </View>

          {/* Bio */}
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              Bio
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Une courte description..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={{
                fontSize: 14,
                color: colors.text,
                paddingTop: 4,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Objectif */}
          <TouchableOpacity
            onPress={() => setShowGoalPicker(true)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                Objectif
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: goal ? colors.text : colors.muted,
                  paddingTop: 4,
                }}
              >
                {goalLabel}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Bouton Enregistrer ──────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || uploading}
          style={{
            marginTop: 24,
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: saving || uploading ? 0.7 : 1,
          }}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : null}
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
            Enregistrer
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Goal Picker bottom sheet ─────────────────────────── */}
      {showGoalPicker && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 12,
            paddingBottom: 32,
            ...shadow.card,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: colors.text,
              textAlign: 'center',
              marginBottom: 8,
              paddingHorizontal: 16,
            }}
          >
            Choisir un objectif
          </Text>

          {GOAL_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                setGoal(option.id as GoalId);
                setShowGoalPicker(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderBottomWidth: index < GOAL_OPTIONS.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: goal === option.id ? '700' : '400',
                  color: goal === option.id ? colors.primary : colors.text,
                }}
              >
                {option.label}
              </Text>
              {goal === option.id && (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}

          {/* Annuler */}
          <TouchableOpacity
            onPress={() => setShowGoalPicker(false)}
            style={{
              marginTop: 8,
              marginHorizontal: 16,
              paddingVertical: 12,
              alignItems: 'center',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

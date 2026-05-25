import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { STGroup, STRow } from '@ziko/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

// ── Shared header ──────────────────────────────────────────────
function STHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    }}>
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: 'rgba(28,26,23,0.06)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>{title}</Text>
    </View>
  );
}

// ── Types ──────────────────────────────────────────────────────
interface PrivacyState {
  is_public: boolean;
  show_stats: boolean;
  show_activities: boolean;
}

// ── Main screen ────────────────────────────────────────────────
export default function SecurityScreen() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  // Password state
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);

  // Privacy state
  const [privacy, setPrivacy] = useState<PrivacyState>({
    is_public: true,
    show_stats: true,
    show_activities: true,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load privacy prefs on mount
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_profiles')
      .select('settings, is_public')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const prefs = (data as any)?.settings?.privacy;
        // is_public: direct column takes priority; fallback to settings JSONB for migration smoothness
        setPrivacy({
          is_public: (data as any)?.is_public ?? prefs?.is_public ?? true,
          show_stats: prefs?.show_stats ?? true,
          show_activities: prefs?.show_activities ?? true,
        });
      });
  }, [userId]);

  // Derived validation
  const pwdTooShort = newPwd.length > 0 && newPwd.length < 8;
  const pwdMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;
  const canSavePwd = newPwd.length >= 8 && confirmPwd.length > 0 && newPwd === confirmPwd;

  // Save password
  const savePassword = async () => {
    if (!newPwd || newPwd.length < 8) {
      showAlert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPwd !== confirmPwd) {
      showAlert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setNewPwd('');
      setConfirmPwd('');
      showAlert('Succès', 'Mot de passe modifié.');
    } catch (err: any) {
      showAlert('Erreur', err.message ?? 'Impossible de modifier le mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  // Update privacy with optimistic update + debounced upsert
  const updatePrivacy = (key: keyof PrivacyState) => async (value: boolean) => {
    const next = { ...privacy, [key]: value };
    setPrivacy(next);

    if (key === 'is_public') {
      // is_public: write directly to the dedicated column (migration 051)
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        await supabase.from('user_profiles').upsert({ id: userId, is_public: value });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }, 500);
    } else {
      // show_stats / show_activities: remain in settings JSONB (no dedicated columns)
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const { data: fresh } = await supabase
          .from('user_profiles')
          .select('settings')
          .eq('id', userId)
          .single();
        const current = (fresh as any)?.settings ?? {};
        await supabase.from('user_profiles').update({
          settings: { ...current, privacy: { ...current.privacy, [key]: value } },
        }).eq('id', userId);
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }, 500);
    }
  };

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 0,
    overflow: 'hidden' as const,
  };

  const inputRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  };

  const inputStyle = {
    flex: 1,
    fontSize: 14,
    fontWeight: '400' as const,
    color: theme.text,
    paddingVertical: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <STHeader onBack={() => router.back()} title="Sécurité & Confidentialité" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}>

        {/* Section 1 — Mot de passe */}
        <Text style={{
          fontSize: 12, fontWeight: '700', letterSpacing: 0.96,
          textTransform: 'uppercase', color: theme.muted,
          paddingHorizontal: 4, paddingBottom: 8,
        }}>
          Mot de passe
        </Text>

        <View style={cardStyle}>
          {/* Nouveau mot de passe */}
          <View style={inputRowStyle}>
            <View style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: 'rgba(28,26,23,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="lock-closed-outline" size={15} color={theme.text} />
            </View>
            <TextInput
              style={inputStyle}
              secureTextEntry
              placeholder="Nouveau mot de passe"
              placeholderTextColor={theme.muted}
              value={newPwd}
              onChangeText={setNewPwd}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Min-length hint */}
          {newPwd.length > 0 && newPwd.length < 8 && (
            <Text style={{ fontSize: 11, color: '#E94B3C', marginTop: 4, marginHorizontal: 52 }}>
              Minimum 8 caractères ({newPwd.length}/8)
            </Text>
          )}

          {/* Séparateur */}
          <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }} />

          {/* Confirmer mot de passe */}
          <View style={inputRowStyle}>
            <View style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: 'rgba(28,26,23,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark-circle-outline" size={15} color={theme.text} />
            </View>
            <TextInput
              style={inputStyle}
              secureTextEntry
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={theme.muted}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Validation inline */}
        {pwdTooShort && (
          <Text style={{ fontSize: 12, color: '#E94B3C', marginTop: 6, marginHorizontal: 4 }}>
            8 caractères minimum
          </Text>
        )}
        {pwdMismatch && (
          <Text style={{ fontSize: 12, color: '#E94B3C', marginTop: 6, marginHorizontal: 4 }}>
            Les mots de passe ne correspondent pas
          </Text>
        )}

        {/* Bouton Enregistrer */}
        <TouchableOpacity
          onPress={savePassword}
          disabled={!canSavePwd || saving}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FF5C1A',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            opacity: canSavePwd && !saving ? 1 : 0.5,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
              Enregistrer le mot de passe
            </Text>
          )}
        </TouchableOpacity>

        {/* Section 2 — Confidentialité */}
        <View style={{ marginTop: 24 }}>
          <STGroup title="Confidentialité">
            <STRow
              icon="people-outline"
              tint="#3B82F6"
              label="Profil public"
              sub="Visible des autres utilisateurs"
              toggleValue={privacy.is_public}
              onToggle={updatePrivacy('is_public')}
            />
            <STRow
              icon="stats-chart-outline"
              tint="#FF5C1A"
              label="Afficher mes stats"
              sub="Séances, records"
              toggleValue={privacy.show_stats}
              onToggle={updatePrivacy('show_stats')}
            />
            <STRow
              icon="flash-outline"
              tint="#22C55E"
              label="Afficher mes activités"
              sub="Cardio, programmes"
              toggleValue={privacy.show_activities}
              onToggle={updatePrivacy('show_activities')}
            />
          </STGroup>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

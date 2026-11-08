import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  signInWithGoogle, signInWithApple, handleSocialResult, isAppleSignInSupported,
  type SocialAuthResult,
} from '../lib/socialAuth';

/**
 * Google / Apple sign-in buttons for the light auth screens (login, register).
 * The welcome screen has its own dark variant; both use the same flow.
 * Apple is iOS-only (isAppleSignInSupported), so Android shows Google only.
 */
export default function SocialAuthButtons() {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  const run = async (kind: 'google' | 'apple') => {
    if (busy) return;
    setBusy(kind);
    try {
      const result: SocialAuthResult = await (kind === 'google' ? signInWithGoogle() : signInWithApple());
      await handleSocialResult(result, {
        alert: showAlert,
        replace: (href) => router.replace(href as any),
        // Load the profile first so (app)/_layout does not bounce a returning
        // user to onboarding.
        beforeRoute: async () => {
          const { data } = await supabase.auth.getSession();
          useAuthStore.getState().setSession(data.session);
          await useAuthStore.getState().refreshProfile();
        },
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {isAppleSignInSupported() && (
        <TouchableOpacity
          onPress={() => run('apple')}
          disabled={busy !== null}
          style={{
            paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
            backgroundColor: '#1C1A17', opacity: busy && busy !== 'apple' ? 0.5 : 1,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <Ionicons name="logo-apple" size={16} color="#FFFFFF" />
          <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#FFFFFF' }}>
            {busy === 'apple' ? 'Connexion…' : 'Continuer avec Apple'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => run('google')}
        disabled={busy !== null}
        style={{
          paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
          borderWidth: 1, borderColor: '#E2E0DA', backgroundColor: '#FFFFFF',
          opacity: busy && busy !== 'google' ? 0.5 : 1,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        <Ionicons name="logo-google" size={16} color="#1C1A17" />
        <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#1C1A17' }}>
          {busy === 'google' ? 'Connexion…' : 'Continuer avec Google'}
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E0DA' }} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          ou
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E0DA' }} />
      </View>
    </View>
  );
}

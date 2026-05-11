import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const valid = email.length > 3 && password.length >= 4;

  const handleLogin = async () => {
    if (!valid) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/(app)');
    } catch (err: any) {
      showAlert('Connexion impossible', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14, flex: 1,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 12 }}>
              Bon retour
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              Connecte-toi
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              Reprends là où tu t'es arrêté.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            {/* Email */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="toi@email.com" placeholderTextColor={theme.muted}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                style={fieldStyle}
              />
            </View>

            {/* Password + show/hide */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mot de passe</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
              }}>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={theme.muted}
                  secureTextEntry={!showPw} autoComplete="password"
                  style={{ ...fieldStyle, borderWidth: 0 }}
                />
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={{ paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{showPw ? 'Cacher' : 'Voir'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot link */}
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot' as any)}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FF5C1A' }}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!valid || isLoading}
              style={{
                paddingVertical: 14, borderRadius: 14,
                backgroundColor: valid ? theme.text : theme.text + '30',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                {isLoading ? 'Connexion…' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 12.5, color: theme.muted }}>
              {'Pas encore de compte ? '}
              <Text onPress={() => router.push('/(auth)/register')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                Créer
              </Text>
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

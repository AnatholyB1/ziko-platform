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

function getStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-4
}

const STRENGTH_LABELS = ['', 'Faible', 'Correct', 'Fort', 'Excellent'];
const STRENGTH_COLORS = ['transparent', '#E94B3C', '#E8A33A', '#2E9E5B', '#2E9E5B'];

export default function RegisterScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const strength = getStrength(password);
  const valid = name.length > 1 && email.length > 3 && password.length >= 6;

  const handleRegister = async () => {
    if (!valid) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      router.replace('/(auth)/onboarding/step-1');
    } catch (err: any) {
      showAlert('Inscription impossible', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14,
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
              Bienvenue
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              Crée ton compte
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              2 minutes pour démarrer. Tu pourras compléter ton profil ensuite.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            {/* Name */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Prénom</Text>
              <TextInput
                value={name} onChangeText={setName}
                placeholder="Comment on t'appelle ?" placeholderTextColor={theme.muted}
                autoComplete="name"
                style={fieldStyle}
              />
            </View>

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

            {/* Password + strength */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mot de passe</Text>
              <TextInput
                value={password} onChangeText={setPassword}
                placeholder="6 caractères minimum" placeholderTextColor={theme.muted}
                secureTextEntry
                style={fieldStyle}
              />
              {password.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        backgroundColor: i < strength ? STRENGTH_COLORS[strength] : theme.border,
                      }} />
                    ))}
                  </View>
                  <Text style={{
                    fontSize: 10.5, fontWeight: '700',
                    color: STRENGTH_COLORS[strength], minWidth: 60, textAlign: 'right',
                  }}>
                    {STRENGTH_LABELS[strength]}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 16 }} />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleRegister}
              disabled={!valid || isLoading}
              style={{
                paddingVertical: 14, borderRadius: 14,
                backgroundColor: valid ? '#FF5C1A' : '#FF5C1A' + '40',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                {isLoading ? 'Création…' : 'Continuer'}
              </Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 12.5, color: theme.muted }}>
              {'Déjà un compte ? '}
              <Text onPress={() => router.push('/(auth)/login')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                Se connecter
              </Text>
            </Text>

            <Text style={{
              textAlign: 'center', fontSize: 10.5, color: theme.muted,
              lineHeight: 15, paddingHorizontal: 12,
            }}>
              En créant ton compte tu acceptes nos CGU et notre politique de confidentialité.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

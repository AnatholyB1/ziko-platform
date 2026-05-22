import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
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
      // T-34-01: generic message to avoid leaking account existence
      showAlert('Connexion impossible', 'Email ou mot de passe incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
    paddingHorizontal: 14, paddingVertical: 14,
    color: '#1C1A17', fontSize: 14, flex: 1,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: 'rgba(28,26,23,0.06)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={16} color="#1C1A17" />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 12 }}>
              Bon retour
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#1C1A17', lineHeight: 34, letterSpacing: -0.6 }}>
              Connecte-toi
            </Text>
            <Text style={{ fontSize: 13.5, color: '#6B6963', marginTop: 8, lineHeight: 19.5 }}>
              Reprends là où tu t'es arrêté.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            {/* Email */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963', marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="toi@email.com" placeholderTextColor="#6B6963"
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                style={fieldStyle}
              />
            </View>

            {/* Password + show/hide */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963', marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mot de passe</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
              }}>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor="#6B6963"
                  secureTextEntry={!showPw} autoComplete="password"
                  style={{ ...fieldStyle, borderWidth: 0 }}
                />
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={{ paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B6963' }}>{showPw ? 'Cacher' : 'Voir'}</Text>
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
                backgroundColor: valid ? '#1C1A17' : 'rgba(28,26,23,0.18)',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                {isLoading ? 'Connexion…' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 12.5, color: '#6B6963' }}>
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

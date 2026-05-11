import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

const AVATAR_COLORS = ['#FF5C1A', '#7B5BD0', '#2E9E5B', '#E8A33A'];

export default function WelcomeScreen() {
  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showAlert('Erreur', error.message);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1C1A17' }}>
      {/* Orange glow top-right */}
      <View style={{
        position: 'absolute', top: -120, right: -80, width: 320, height: 320,
        borderRadius: 160, backgroundColor: 'rgba(255,92,26,0.35)',
      }} pointerEvents="none" />
      {/* Violet glow bottom-left */}
      <View style={{
        position: 'absolute', bottom: -100, left: -60, width: 260, height: 260,
        borderRadius: 130, backgroundColor: 'rgba(123,91,208,0.25)',
      }} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 18 }}>

          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 36 }}>
            <View style={{
              width: 30, height: 30, borderRadius: 9, backgroundColor: '#FF5C1A',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: '#fff' }}>Z</Text>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#FFFAF6', letterSpacing: 1 }}>ZIKO</Text>
          </View>

          {/* Hero copy */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{
              fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase',
              color: '#FF5C1A', marginBottom: 14,
            }}>Coach IA · 18 modules</Text>

            <Text style={{
              fontSize: 42, fontWeight: '800', color: '#FFFAF6', lineHeight: 44,
              letterSpacing: -0.8, marginBottom: 16,
            }}>
              {'Ton corps,\n'}
              <Text style={{ color: '#FF5C1A' }}>ton plan</Text>
              {',\nton coach.'}
            </Text>

            <Text style={{
              fontSize: 14, color: 'rgba(255,250,246,0.72)', lineHeight: 21, marginBottom: 28,
            }}>
              Programmes adaptatifs, suivi nutritionnel, communauté qui pousse.
              Construit pour ceux qui ne lâchent rien.
            </Text>

            {/* Social proof */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {AVATAR_COLORS.map((c, i) => (
                  <View key={i} style={{
                    width: 24, height: 24, borderRadius: 12, backgroundColor: c,
                    borderWidth: 2, borderColor: '#1C1A17',
                    marginLeft: i ? -7 : 0,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>
                      {(['MA', 'TK', 'JP', 'SR'] as const)[i]}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,250,246,0.65)', lineHeight: 16 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>240k+ </Text>
                {'athlètes — '}
                <Text style={{ color: '#fff', fontWeight: '700' }}>4.8★</Text>
                {' · 18k avis'}
              </Text>
            </View>
          </View>

          {/* CTAs */}
          <View style={{ gap: 10 }}>
            {/* Google */}
            <TouchableOpacity
              onPress={handleGoogle}
              style={{
                paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                backgroundColor: '#fff',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <Ionicons name="logo-google" size={16} color="#1C1A17" />
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#1C1A17' }}>Continuer avec Google</Text>
            </TouchableOpacity>

            {/* Email → Sign up */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              style={{
                paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                borderWidth: 1, borderColor: 'rgba(255,250,246,0.16)',
                backgroundColor: 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#FFFAF6' }}>Continuer avec un email</Text>
            </TouchableOpacity>

            {/* Sign in link */}
            <Text style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,250,246,0.6)', marginTop: 4 }}>
              {'Déjà un compte ? '}
              <Text
                onPress={() => router.push('/(auth)/login')}
                style={{ color: '#FF5C1A', fontWeight: '700' }}
              >
                Connecte-toi
              </Text>
            </Text>

            <Text style={{
              textAlign: 'center', fontSize: 10.5, color: 'rgba(255,250,246,0.4)',
              lineHeight: 15, paddingHorizontal: 12, marginTop: 4,
            }}>
              En continuant tu acceptes nos CGU et notre politique de confidentialité.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

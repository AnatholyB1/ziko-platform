import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

export default function ForgotScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (email.length < 4) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      showAlert('Erreur', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 14,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Back button */}
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
              Pas de panique
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              {sent ? 'Vérifie ta boîte' : 'Mot de passe oublié ?'}
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              {sent
                ? "On t'a envoyé un lien de réinitialisation. Vérifie aussi ton dossier spam."
                : "Entre ton email, on t'envoie un lien pour le réinitialiser."}
            </Text>
          </View>

          {!sent ? (
            <>
              <View style={{ paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="toi@email.com"
                  placeholderTextColor={theme.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  style={fieldStyle}
                />
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ padding: 24, paddingTop: 16 }}>
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={email.length < 4 || isLoading}
                  style={{
                    paddingVertical: 14, borderRadius: 14,
                    backgroundColor: email.length >= 4 ? theme.text : theme.text + '30',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                    {isLoading ? 'Envoi…' : 'Envoyer le lien'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={{ paddingHorizontal: 24 }}>
                <View style={{
                  padding: 16, borderRadius: 16,
                  backgroundColor: '#2E9E5B' + '14',
                  borderWidth: 1, borderColor: '#2E9E5B' + '40',
                  flexDirection: 'row', gap: 12, alignItems: 'flex-start',
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 11, backgroundColor: '#2E9E5B',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
                      Email envoyé à {email}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4, lineHeight: 17 }}>
                      {'Le lien expire dans 30 minutes. '}
                      <Text onPress={() => setSent(false)} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                        Renvoyer
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ padding: 24, paddingTop: 16 }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>Retour à la connexion</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { showAlert, useThemeStore } from '@ziko/plugin-sdk';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Button, Input, spacing } from '@ziko/ui';
import { useTranslation } from '@ziko/plugin-sdk';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(t('general.error'), t('auth.fillAll'));
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/(app)');
    } catch (err: any) {
      showAlert('Login failed', err.message ?? 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showAlert('Error', error.message);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + tagline */}
          <MotiView
            from={{ opacity: 0, translateY: -16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={{ marginTop: 48, marginBottom: 48 }}
          >
            <Image
              source={require('../../assets/image/logo.png')}
              style={{ width: 160, height: 50 }}
              contentFit="contain"
              transition={300}
            />
            <Text style={{ fontSize: 16, color: theme.muted, marginTop: 6 }}>
              {t('auth.tagline')}
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 450, delay: 100 }}
          >
            <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text, marginBottom: 28 }}>
              {t('auth.welcomeBack')}
            </Text>

            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />

            <Button
              title={isLoading ? t('general.loading') : t('auth.login')}
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
              style={{ marginTop: 8, borderRadius: 14 }}
            />

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <Text style={{ color: theme.muted, marginHorizontal: 12, fontSize: 13 }}>{t('general.or')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            {/* Google */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <Text style={{ color: theme.text, fontWeight: '500', fontSize: 15 }}>
                Continuer avec Google
              </Text>
            </TouchableOpacity>

            {/* Register link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
              <Text style={{ color: theme.muted }}>{t('auth.noAccount')} </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('auth.register')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

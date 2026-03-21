import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Button, Input, colors, spacing } from '@ziko/ui';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/(app)');
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) Alert.alert('Error', error.message);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
            <Text style={{ fontSize: 44, fontWeight: '800', color: colors.primary, letterSpacing: -1 }}>
              Ziko
            </Text>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 6 }}>
              Your AI fitness coach ✦
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 450, delay: 100 }}
          >
            <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 28 }}>
              Welcome back
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />

            <Button
              title={isLoading ? 'Signing in…' : 'Sign In'}
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
              style={{ marginTop: 8, borderRadius: 14 }}
            />

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.textMuted, marginHorizontal: 12, fontSize: 13 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* Google */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Register link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
              <Text style={{ color: colors.textMuted }}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

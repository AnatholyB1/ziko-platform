import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginTop: 48, marginBottom: 48 }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: '#6C63FF', letterSpacing: -1 }}>
              Ziko
            </Text>
            <Text style={{ fontSize: 16, color: '#8888A8', marginTop: 8 }}>
              Your AI fitness coach
            </Text>
          </View>

          <Text style={{ fontSize: 28, fontWeight: '700', color: '#F0F0F5', marginBottom: 32 }}>
            Welcome back
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8888A8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                backgroundColor: '#1A1A24',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#2E2E40',
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: '#F0F0F5',
                fontSize: 15,
              }}
            />
          </View>

          {/* Password */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#8888A8"
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: '#1A1A24',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#2E2E40',
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: '#F0F0F5',
                fontSize: 15,
              }}
            />
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#5A52D5' : '#6C63FF',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 24,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2E2E40' }} />
            <Text style={{ color: '#8888A8', marginHorizontal: 12, fontSize: 13 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2E2E40' }} />
          </View>

          {/* Google */}
          <TouchableOpacity
            onPress={handleGoogleLogin}
            style={{
              backgroundColor: '#1A1A24',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#2E2E40',
            }}
          >
            <Text style={{ color: '#F0F0F5', fontWeight: '500', fontSize: 15 }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Register link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
            <Text style={{ color: '#8888A8' }}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#6C63FF', fontWeight: '600' }}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

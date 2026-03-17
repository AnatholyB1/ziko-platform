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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

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
      Alert.alert('Registration failed', err.message ?? 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E40',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F0F0F5',
    fontSize: 15,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 8, marginBottom: 32 }}>
            <Text style={{ color: '#6C63FF', fontSize: 15 }}>← Back</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 28, fontWeight: '700', color: '#F0F0F5', marginBottom: 8 }}>
            Create account
          </Text>
          <Text style={{ color: '#8888A8', fontSize: 15, marginBottom: 32 }}>
            Start your fitness journey today
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Full name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor="#8888A8"
              autoComplete="name"
              style={fieldStyle}
            />
          </View>

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
              style={fieldStyle}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor="#8888A8"
              secureTextEntry
              style={fieldStyle}
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#5A52D5' : '#6C63FF',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
              {isLoading ? 'Creating account…' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
            <Text style={{ color: '#8888A8' }}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#6C63FF', fontWeight: '600' }}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

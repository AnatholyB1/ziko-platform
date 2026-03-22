import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { useTranslation } from '@ziko/plugin-sdk';

export default function OnboardingStep2() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const isValid = age && weight && height;

  const handleNext = async () => {
    if (!isValid) return;
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase
      .from('user_profiles')
      .update({
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
      })
      .eq('id', uid);
    router.push('/(auth)/onboarding/step-3');
  };

  const fieldStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E0DA',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#1C1A17',
    fontSize: 15,
    marginBottom: 16,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 2 ? '#FF5C1A' : '#E2E0DA' }} />
          ))}
        </View>

        <Image
          source={require('../../../assets/image/step2.png')}
          style={{ width: '100%', height: 180, alignSelf: 'center', marginTop: 16 }}
          contentFit="contain"
          transition={300}
        />

        <Text style={{ color: '#7A7670', marginTop: 24, fontSize: 13 }}>{t('onboarding.step', { current: '2', total: '5' })}</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>
          {t('onboarding.measurements')}
        </Text>
        <Text style={{ color: '#7A7670', marginTop: 8, fontSize: 15, marginBottom: 32 }}>
          {t('onboarding.measurementsDesc')}
        </Text>

        <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>{t('onboarding.age')}</Text>
        <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#7A7670" keyboardType="number-pad" style={fieldStyle} />
        <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>{t('onboarding.weight')}</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor="#7A7670" keyboardType="decimal-pad" style={fieldStyle} />
        <Text style={{ color: '#7A7670', fontSize: 13, marginBottom: 6 }}>{t('onboarding.height')}</Text>
        <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor="#7A7670" keyboardType="decimal-pad" style={fieldStyle} />

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#7A7670', fontWeight: '600' }}>{t('general.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} disabled={!isValid} style={{ flex: 2, backgroundColor: isValid ? '#FF5C1A' : '#E2E0DA', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('onboarding.continue')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

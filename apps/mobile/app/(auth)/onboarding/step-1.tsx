import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { colors, Input, Button } from '@ziko/ui';
import { useTranslation } from '@ziko/plugin-sdk';

export default function OnboardingStep1() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');

  const handleNext = async () => {
    if (!name.trim()) return;
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase
      .from('user_profiles')
      .update({ name: name.trim() })
      .eq('id', uid);
    router.push('/(auth)/onboarding/step-2');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 24 }}>
        {/* Progress dots */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ type: 'spring', delay: i * 60 }}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: i <= 1 ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
        >
          <Text style={{ color: colors.textMuted, marginTop: 32, fontSize: 13 }}>{t('onboarding.step', { current: '1', total: '5' })}</Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 8 }}>
            {t('onboarding.whatsYourName')}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 15 }}>
            {t('onboarding.personalise')}
          </Text>

          <View style={{ marginTop: 32 }}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.firstName')}
              autoFocus
              style={{ fontSize: 18 }}
            />
          </View>
        </MotiView>

        <View style={{ flex: 1 }} />

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 350, delay: 350 }}
        >
          <Button
            title={t('onboarding.continue')}
            onPress={handleNext}
            disabled={!name.trim()}
            size="lg"
            style={{ borderRadius: 14, marginBottom: 16 }}
          />
        </MotiView>
      </View>
    </SafeAreaView>
  );
}


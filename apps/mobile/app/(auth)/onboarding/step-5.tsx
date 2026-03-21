import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { useTranslation } from '@ziko/plugin-sdk';

export default function OnboardingStep5() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      await supabase
        .from('user_profiles')
        .update({ onboarding_done: true })
        .eq('id', uid);
      await refreshProfile();
      router.replace('/(app)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6, position: 'absolute', top: 24 + 8, left: 24, right: 24 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#FF5C1A' }} />
          ))}
        </View>

        <Text style={{ fontSize: 64, marginBottom: 24 }}>🎉</Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#1C1A17', textAlign: 'center' }}>
          {t('onboarding.allSet')}
        </Text>
        <Text style={{ color: '#7A7670', marginTop: 12, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
          {t('onboarding.allSetDesc')}
        </Text>

        <View style={{ marginTop: 48, gap: 12, width: '100%' }}>
          {[t('onboarding.bullet1'), t('onboarding.bullet2'), t('onboarding.bullet3')].map((item) => (
            <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FF5C1A', fontSize: 12 }}>✓</Text>
              </View>
              <Text style={{ color: '#1C1A17', fontSize: 15 }}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleFinish}
          disabled={isLoading}
          style={{
            position: 'absolute',
            bottom: 32,
            left: 24,
            right: 24,
            backgroundColor: '#FF5C1A',
            borderRadius: 16,
            paddingVertical: 18,
            alignItems: 'center',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {isLoading ? t('general.loading') : t('onboarding.getStarted')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

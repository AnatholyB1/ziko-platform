import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@ziko/plugin-sdk';

const FEATURES = [
  { emoji: '🏋️', titleKey: 'onboarding.featureWorkout', descKey: 'onboarding.featureWorkoutDesc' },
  { emoji: '🤖', titleKey: 'onboarding.featureAI', descKey: 'onboarding.featureAIDesc' },
  { emoji: '🔌', titleKey: 'onboarding.featurePlugins', descKey: 'onboarding.featurePluginsDesc' },
  { emoji: '📊', titleKey: 'onboarding.featureCharts', descKey: 'onboarding.featureChartsDesc' },
];

export default function OnboardingStep4() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 4 ? '#FF5C1A' : '#E2E0DA' }} />
          ))}
        </View>

        <Text style={{ color: '#7A7670', marginTop: 32, fontSize: 13 }}>{t('onboarding.step', { current: '4', total: '5' })}</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>
          {t('onboarding.whatZikoOffers')}
        </Text>
        <Text style={{ color: '#7A7670', marginTop: 8, fontSize: 15, marginBottom: 32 }}>
          {t('onboarding.whatZikoOffersDesc')}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E0DA',
                padding: 20,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 16 }}>{t(f.titleKey)}</Text>
                <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 2 }}>{t(f.descKey)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E0DA' }}>
            <Text style={{ color: '#7A7670', fontWeight: '600' }}>{t('general.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/onboarding/step-5')} style={{ flex: 2, backgroundColor: '#FF5C1A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('onboarding.continue')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

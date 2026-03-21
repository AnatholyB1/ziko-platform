import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { supabase } from '../../../src/lib/supabase';
import { useTranslation, useI18nStore, type FitnessGoal } from '@ziko/plugin-sdk';

const GOALS: { id: FitnessGoal; labelKey: string }[] = [
  { id: 'muscle_gain', labelKey: 'profile.goalMuscle' },
  { id: 'fat_loss', labelKey: 'profile.goalFatLoss' },
  { id: 'maintenance', labelKey: 'profile.goalMaintenance' },
  { id: 'endurance', labelKey: 'profile.goalEndurance' },
];

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const theme = useThemeStore((s) => s.theme);
  const { t, locale } = useTranslation();
  const setLocale = useI18nStore((s) => s.setLocale);
  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() ?? '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? '');
  const [goal, setGoal] = useState<FitnessGoal | null>(profile?.goal ?? null);
  const [isSaving, setIsSaving] = useState(false);

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 15,
    marginBottom: 16,
  } as const;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('user_profiles').update({
      name: name.trim(),
      age: age ? parseInt(age) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      height_cm: height ? parseFloat(height) : null,
      goal,
    }).eq('id', user.id);

    if (error) {
      Alert.alert(t('general.error'), error.message);
    } else {
      await refreshProfile();
      Alert.alert(t('profile.saved'), t('profile.savedDesc'));
    }
    setIsSaving(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>{t('profile.editProfile')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('profile.fullName')}</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#7A7670" style={fieldStyle} />

        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('profile.age')}</Text>
        <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#7A7670" keyboardType="number-pad" style={fieldStyle} />

        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('profile.weight')}</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor="#7A7670" keyboardType="decimal-pad" style={fieldStyle} />

        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('profile.height')}</Text>
        <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor="#7A7670" keyboardType="decimal-pad" style={fieldStyle} />

        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 10 }}>{t('profile.fitnessGoal')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {GOALS.map((g) => (
            <TouchableOpacity key={g.id} onPress={() => setGoal(g.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: goal === g.id ? theme.primary : theme.surface, borderWidth: 1, borderColor: goal === g.id ? theme.primary : theme.border }}>
              <Text style={{ color: goal === g.id ? '#fff' : theme.muted, fontWeight: '500', fontSize: 14 }}>{t(g.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 10 }}>{t('profile.language')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
          {(['fr', 'en'] as const).map((lang) => (
            <TouchableOpacity key={lang} onPress={() => setLocale(lang)}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: locale === lang ? theme.primary : theme.surface, borderWidth: 1, borderColor: locale === lang ? theme.primary : theme.border, alignItems: 'center' }}>
              <Text style={{ color: locale === lang ? '#fff' : theme.muted, fontWeight: '600', fontSize: 14 }}>
                {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleSave} disabled={isSaving}
          style={{ backgroundColor: isSaving ? '#5A52D5' : theme.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', opacity: isSaving ? 0.7 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{isSaving ? t('habits.saving') : t('profile.saveChanges')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

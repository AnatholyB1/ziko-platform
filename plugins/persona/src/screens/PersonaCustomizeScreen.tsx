import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePersonaStore } from '../store';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { format } from 'date-fns';

const ALL_TRAIT_KEYS: string[] = [
  'persona.traitEncouraging', 'persona.traitDirect', 'persona.traitScience', 'persona.traitHumorous', 'persona.traitEmpathetic',
  'persona.traitChallenging', 'persona.traitPatient', 'persona.traitEnergetic', 'persona.traitCalm', 'persona.traitDetail',
];

// English IDs used as store values (unchanged for DB compatibility)
const TRAIT_IDS = [
  'Encouraging', 'Direct', 'Science-based', 'Humorous', 'Empathetic',
  'Challenging', 'Patient', 'Energetic', 'Calm', 'Detail-oriented',
];

const COACHING_STYLES: { id: string; labelKey: string; emoji: string; descKey: string }[] = [
  { id: 'motivational', labelKey: 'persona.styleMotivational', emoji: '🔥', descKey: 'persona.styleDescMotivational' },
  { id: 'analytical', labelKey: 'persona.styleAnalytical', emoji: '📊', descKey: 'persona.styleDescAnalytical' },
  { id: 'friendly', labelKey: 'persona.styleFriendly', emoji: '😊', descKey: 'persona.styleDescFriendly' },
  { id: 'strict', labelKey: 'persona.styleStrict', emoji: '⚡', descKey: 'persona.styleDescStrict' },
];

export default function PersonaCustomizeScreen({ supabase }: { supabase: any }) {
  const {
    agentName, traits, backstory, coachingStyle, habits,
    setAgentName, toggleTrait, setBackstory, setCoachingStyle,
    addHabit, removeHabit, completeHabit,
  } = usePersonaStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [saving, setSaving] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<'daily' | 'weekly'>('daily');
  const [previewOpen, setPreviewOpen] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  const savePersona = async () => {
    setSaving(true);
    const { error } = await supabase.from('persona_settings').upsert({
      agent_name: agentName,
      traits,
      backstory,
      coaching_style: coachingStyle,
      habits,
    });
    setSaving(false);
    if (error) { Alert.alert(t('general.error'), error.message); return; }
    Alert.alert(t('persona.saved'), t('persona.savedDesc'));
  };

  const submitHabit = () => {
    if (!newHabit.trim()) return;
    addHabit(newHabit.trim(), newHabitFrequency);
    setNewHabit('');
    setShowHabitModal(false);
  };

  const previewPrompt = `You are ${agentName}, a ${coachingStyle} fitness coach with traits: ${traits.join(', ')}.${backstory ? ` ${backstory}` : ''}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#7A7670" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>🧠 {t('persona.title')}</Text>
        <TouchableOpacity onPress={savePersona} disabled={saving}
          style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, opacity: saving ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t('general.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 120 }}>

        {/* Agent name */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('persona.coachName')}
          </Text>
          <TextInput
            value={agentName}
            onChangeText={setAgentName}
            placeholder={t('persona.coachNamePlaceholder')}
            placeholderTextColor="#7A7670"
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, fontSize: 16, fontWeight: '600' }}
          />
        </View>

        {/* Coaching style */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('persona.style')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COACHING_STYLES.map((style) => {
              const active = coachingStyle === style.id;
              return (
                <TouchableOpacity key={style.id} onPress={() => setCoachingStyle(style.id as any)}
                  style={{ flex: 1, minWidth: '45%', backgroundColor: active ? theme.primary + '20' : theme.surface, borderRadius: 14, borderWidth: 1.5, borderColor: active ? theme.primary : theme.border, padding: 12 }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{style.emoji}</Text>
                  <Text style={{ color: active ? theme.primary : theme.text, fontWeight: '600', fontSize: 14 }}>{t(style.labelKey)}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11 }}>{t(style.descKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Traits */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('persona.traitCount', { count: String(traits.length) })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TRAIT_KEYS.map((traitKey, idx) => {
              const traitId = TRAIT_IDS[idx];
              const active = traits.includes(traitId);
              const atMax = traits.length >= 5 && !active;
              return (
                <TouchableOpacity key={traitKey} onPress={() => !atMax && toggleTrait(traitId)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? theme.primary : theme.surface, borderWidth: 1, borderColor: active ? theme.primary : theme.border, opacity: atMax ? 0.4 : 1 }}>
                  <Text style={{ color: active ? '#fff' : theme.muted, fontWeight: '600', fontSize: 13 }}>{t(traitKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Backstory */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('persona.backstory')}
          </Text>
          <TextInput
            value={backstory}
            onChangeText={setBackstory}
            placeholder={t('persona.backstoryPlaceholder')}
            placeholderTextColor="#7A7670"
            multiline
            numberOfLines={4}
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top' }}
          />
        </View>

        {/* Preview */}
        <TouchableOpacity onPress={() => setPreviewOpen(!previewOpen)}
          style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('persona.previewPrompt')}</Text>
          <Ionicons name={previewOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.primary} />
        </TouchableOpacity>
        {previewOpen && (
          <View style={{ backgroundColor: '#0D0D18', borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14, marginTop: -16, marginBottom: 24 }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontFamily: 'monospace' }}>{previewPrompt}</Text>
          </View>
        )}

        {/* Habits */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('persona.dailyHabits')}
            </Text>
            <TouchableOpacity onPress={() => setShowHabitModal(true)}>
              <Ionicons name="add-circle" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {habits.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 13 }}>{t('persona.noHabits')}</Text>
          ) : (
            habits.map((habit) => {
              const done = habit.completedDates.includes(today);
              return (
                <View key={habit.id} style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: done ? theme.primary + '40' : theme.border, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => completeHabit(habit.id, today)} style={{ marginRight: 12 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: done ? theme.primary : theme.muted, backgroundColor: done ? theme.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: done ? theme.muted : theme.text, fontWeight: '500', textDecorationLine: done ? 'line-through' : undefined }}>{habit.label}</Text>
                    <Text style={{ color: theme.muted, fontSize: 11 }}>{habit.frequency}</Text>
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert(t('persona.removeHabit'), t('persona.removeHabitConfirm', { name: habit.label }), [
                    { text: t('general.cancel'), style: 'cancel' },
                    { text: t('persona.removeHabit'), style: 'destructive', onPress: () => removeHabit(habit.id) },
                  ])}>
                    <Ionicons name="trash-outline" size={18} color="#7A7670" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add habit modal */}
      <Modal visible={showHabitModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 24 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{t('persona.addHabit')}</Text>
            <TextInput
              value={newHabit}
              onChangeText={setNewHabit}
              placeholder={t('persona.habitPlaceholder')}
              placeholderTextColor="#7A7670"
              autoFocus
              style={{ backgroundColor: theme.background, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10, color: theme.text, marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['daily', 'weekly'] as const).map((f) => (
                <TouchableOpacity key={f} onPress={() => setNewHabitFrequency(f)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: newHabitFrequency === f ? theme.primary : theme.background, alignItems: 'center', borderWidth: 1, borderColor: newHabitFrequency === f ? theme.primary : theme.border }}>
                  <Text style={{ color: newHabitFrequency === f ? '#fff' : theme.muted, fontWeight: '600', textTransform: 'capitalize' }}>{f === 'daily' ? t('persona.daily') : t('persona.weekly')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowHabitModal(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.background, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                <Text style={{ color: theme.muted, fontWeight: '600' }}>{t('general.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitHabit} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('persona.addHabit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

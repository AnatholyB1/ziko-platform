import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHabitsStore } from '../store';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import type { Habit } from '../store';
import {
  requestNotificationPermission,
  scheduleHabitReminder,
} from '../notifications';

let usePersonaStore: any = null;
try { usePersonaStore = require('@ziko/plugin-persona').usePersonaStore; } catch {}

const EMOJI_OPTIONS = ['✅', '💧', '🏋️', '🥗', '😴', '📚', '🧘', '🚶', '🏃', '💊', '🧠', '❤️', '🎯', '🌿', '☀️', '🍎', '🚴', '🧹', '📝', '🎵'];
const BASE_COLOR_OPTIONS = ['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FF6584', '#FF5722', '#607D8B'];

export default function HabitLogScreen({ supabase }: { supabase: any }) {
  const agentName = usePersonaStore ? usePersonaStore((s: any) => s.agentName) : 'Ziko';
  const { habits, setHabits } = useHabitsStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const COLOR_OPTIONS = [theme.primary, ...BASE_COLOR_OPTIONS];
  const { label, input } = getStyles(theme);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [color, setColor] = useState(theme.primary);
  const [type, setType] = useState<'boolean' | 'count'>('boolean');
  const [target, setTarget] = useState('1');
  const [unit, setUnit] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isValid = name.trim().length > 0 && (type === 'boolean' || parseInt(target, 10) > 0);

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validate reminder time format if provided
      if (reminderTime && !/^\d{1,2}:\d{2}$/.test(reminderTime)) {
        showAlert(t('habits.invalidTime'), t('habits.invalidTimeDesc'));
        return;
      }

      const newHabit = {
        user_id: user.id,
        name: name.trim(),
        emoji,
        color,
        type,
        target: parseInt(target, 10),
        unit: unit.trim() || null,
        source: 'manual' as const,
        reminder_time: reminderTime.trim() || null,
        is_active: true,
        sort_order: habits.length,
      };

      const { data, error } = await supabase.from('habits').insert(newHabit).select('*').single();
      if (error) throw error;

      // Schedule notification if reminder set
      if (data.reminder_time) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleHabitReminder(data as Habit, agentName);
        }
      }

      setHabits([...habits, data as Habit]);
      router.back();
    } catch (err: any) {
      showAlert(t('general.error'), err.message ?? 'Failed to save habit');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>{t('habits.addHabit')}</Text>
        </View>

        {/* Name */}
        <Text style={label}>{t('habits.habitName')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('habits.habitNamePlaceholder')}
          placeholderTextColor="#7A7670"
          style={input}
          autoFocus
        />

        {/* Emoji picker */}
        <Text style={label}>{t('habits.icon')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {EMOJI_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 48, height: 48, borderRadius: 14, marginRight: 8,
                backgroundColor: emoji === e ? color + '44' : theme.surface,
                borderWidth: 2, borderColor: emoji === e ? color : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Color picker */}
        <Text style={label}>{t('habits.color')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {COLOR_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: c,
                borderWidth: 3,
                borderColor: color === c ? '#fff' : 'transparent',
              }}
            />
          ))}
        </View>

        {/* Type */}
        <Text style={label}>{t('habits.type')}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {(['boolean', 'count'] as const).map((tp) => (
            <TouchableOpacity
              key={tp}
              onPress={() => setType(tp)}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 12,
                backgroundColor: type === tp ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: type === tp ? theme.primary : theme.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: type === tp ? '#fff' : theme.muted, fontWeight: '600' }}>
                {tp === 'boolean' ? t('habits.typeDone') : t('habits.typeCount')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Target (count only) */}
        {type === 'count' && (
          <>
            <Text style={label}>{t('habits.dailyTarget')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TextInput
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
                style={[input, { flex: 1 }]}
                placeholder="8"
                placeholderTextColor="#7A7670"
              />
              <TextInput
                value={unit}
                onChangeText={setUnit}
                style={[input, { flex: 2 }]}
                placeholder={t('habits.unitPlaceholder')}
                placeholderTextColor="#7A7670"
              />
            </View>
          </>
        )}

        {/* Reminder */}
        <Text style={label}>{t('habits.dailyReminder')}</Text>
        <TextInput
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="08:30"
          placeholderTextColor="#7A7670"
          keyboardType="numbers-and-punctuation"
          style={input}
        />
        <Text style={{ color: theme.muted, fontSize: 12, marginTop: -12, marginBottom: 20 }}>
          {t('habits.reminderFormat')}
        </Text>

        {/* Preview */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 28,
          borderWidth: 1, borderColor: color + '44', flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </View>
          <View>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{name || 'Habit name'}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {type === 'count' ? t('habits.targetPreview', { target, unit: unit || 'times' }) : t('habits.dailyCheckbox')}
              {reminderTime ? `  ·  ⏰ ${reminderTime}` : ''}
            </Text>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || isSaving}
          style={{
            backgroundColor: isValid ? theme.primary : theme.border,
            borderRadius: 14, paddingVertical: 16, alignItems: 'center',
          }}
        >
          <Text style={{ color: isValid ? '#fff' : theme.muted, fontWeight: '700', fontSize: 16 }}>
            {isSaving ? t('habits.saving') : t('habits.createHabit')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: any) {
  return {
    label: { color: theme.muted, fontSize: 13, fontWeight: '500' as const, marginBottom: 8 },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: theme.text,
      fontSize: 15,
      marginBottom: 20,
    },
  };
}

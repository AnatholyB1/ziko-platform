import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHabitsStore } from '../store';
import type { Habit } from '../store';
import {
  requestNotificationPermission,
  scheduleHabitReminder,
} from '../notifications';

let usePersonaStore: any = null;
try { usePersonaStore = require('@ziko/plugin-persona').usePersonaStore; } catch {}

const EMOJI_OPTIONS = ['✅', '💧', '🏋️', '🥗', '😴', '📚', '🧘', '🚶', '🏃', '💊', '🧠', '❤️', '🎯', '🌿', '☀️', '🍎', '🚴', '🧹', '📝', '🎵'];
const COLOR_OPTIONS = ['#6C63FF', '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FF6584', '#FF5722', '#607D8B'];

export default function HabitLogScreen({ supabase }: { supabase: any }) {
  const agentName = usePersonaStore ? usePersonaStore((s: any) => s.agentName) : 'Ziko';
  const { habits, setHabits } = useHabitsStore();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [color, setColor] = useState('#6C63FF');
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
        Alert.alert('Invalid time', 'Please use HH:MM format (e.g. 08:30)');
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
      Alert.alert('Error', err.message ?? 'Failed to save habit');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#6C63FF" />
          </TouchableOpacity>
          <Text style={{ color: '#F0F0F5', fontWeight: '800', fontSize: 22 }}>New Habit</Text>
        </View>

        {/* Name */}
        <Text style={label}>Habit name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Drink water"
          placeholderTextColor="#8888A8"
          style={input}
          autoFocus
        />

        {/* Emoji picker */}
        <Text style={label}>Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {EMOJI_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 48, height: 48, borderRadius: 14, marginRight: 8,
                backgroundColor: emoji === e ? color + '44' : '#1A1A24',
                borderWidth: 2, borderColor: emoji === e ? color : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Color picker */}
        <Text style={label}>Color</Text>
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
        <Text style={label}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {(['boolean', 'count'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 12,
                backgroundColor: type === t ? '#6C63FF' : '#1A1A24',
                borderWidth: 1, borderColor: type === t ? '#6C63FF' : '#2E2E40',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: type === t ? '#fff' : '#8888A8', fontWeight: '600' }}>
                {t === 'boolean' ? '✅ Done / Not done' : '🔢 Count'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Target (count only) */}
        {type === 'count' && (
          <>
            <Text style={label}>Daily target</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TextInput
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
                style={[input, { flex: 1 }]}
                placeholder="8"
                placeholderTextColor="#8888A8"
              />
              <TextInput
                value={unit}
                onChangeText={setUnit}
                style={[input, { flex: 2 }]}
                placeholder="glasses, km, minutes…"
                placeholderTextColor="#8888A8"
              />
            </View>
          </>
        )}

        {/* Reminder */}
        <Text style={label}>Daily reminder (optional)</Text>
        <TextInput
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="08:30"
          placeholderTextColor="#8888A8"
          keyboardType="numbers-and-punctuation"
          style={input}
        />
        <Text style={{ color: '#8888A8', fontSize: 12, marginTop: -12, marginBottom: 20 }}>
          Format HH:MM — leave empty for no reminder
        </Text>

        {/* Preview */}
        <View style={{
          backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, marginBottom: 28,
          borderWidth: 1, borderColor: color + '44', flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </View>
          <View>
            <Text style={{ color: '#F0F0F5', fontWeight: '600', fontSize: 15 }}>{name || 'Habit name'}</Text>
            <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>
              {type === 'count' ? `Target: ${target} ${unit || 'times'}/day` : 'Daily checkbox'}
              {reminderTime ? `  ·  ⏰ ${reminderTime}` : ''}
            </Text>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || isSaving}
          style={{
            backgroundColor: isValid ? '#6C63FF' : '#2E2E40',
            borderRadius: 14, paddingVertical: 16, alignItems: 'center',
          }}
        >
          <Text style={{ color: isValid ? '#fff' : '#8888A8', fontWeight: '700', fontSize: 16 }}>
            {isSaving ? 'Saving…' : 'Create Habit'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const label: any = { color: '#8888A8', fontSize: 13, fontWeight: '500', marginBottom: 8 };
const input: any = {
  backgroundColor: '#1A1A24',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#2E2E40',
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: '#F0F0F5',
  fontSize: 15,
  marginBottom: 20,
};

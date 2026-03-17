import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePersonaStore } from '../store';
import { format } from 'date-fns';

const ALL_TRAITS = [
  'Encouraging', 'Direct', 'Science-based', 'Humorous', 'Empathetic',
  'Challenging', 'Patient', 'Energetic', 'Calm', 'Detail-oriented',
];

const COACHING_STYLES: { id: string; label: string; emoji: string; desc: string }[] = [
  { id: 'motivational', label: 'Motivational', emoji: '🔥', desc: 'High-energy hype' },
  { id: 'analytical', label: 'Analytical', emoji: '📊', desc: 'Data & science' },
  { id: 'friendly', label: 'Friendly', emoji: '😊', desc: 'Supportive buddy' },
  { id: 'strict', label: 'Strict', emoji: '⚡', desc: 'No-excuses drill sergeant' },
];

export default function PersonaCustomizeScreen({ supabase }: { supabase: any }) {
  const {
    agentName, traits, backstory, coachingStyle, habits,
    setAgentName, toggleTrait, setBackstory, setCoachingStyle,
    addHabit, removeHabit, completeHabit,
  } = usePersonaStore();

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
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Saved', 'Your AI coach persona has been updated!');
  };

  const submitHabit = () => {
    if (!newHabit.trim()) return;
    addHabit(newHabit.trim(), newHabitFrequency);
    setNewHabit('');
    setShowHabitModal(false);
  };

  const previewPrompt = `You are ${agentName}, a ${coachingStyle} fitness coach with traits: ${traits.join(', ')}.${backstory ? ` ${backstory}` : ''}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#8888A8" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#F0F0F5' }}>🧠 My AI Coach</Text>
        <TouchableOpacity onPress={savePersona} disabled={saving}
          style={{ backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, opacity: saving ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 120 }}>

        {/* Agent name */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#8888A8', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Coach Name
          </Text>
          <TextInput
            value={agentName}
            onChangeText={setAgentName}
            placeholder="Name your AI coach…"
            placeholderTextColor="#8888A8"
            style={{ backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 16, paddingVertical: 12, color: '#F0F0F5', fontSize: 16, fontWeight: '600' }}
          />
        </View>

        {/* Coaching style */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#8888A8', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Coaching Style
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COACHING_STYLES.map((style) => {
              const active = coachingStyle === style.id;
              return (
                <TouchableOpacity key={style.id} onPress={() => setCoachingStyle(style.id as any)}
                  style={{ flex: 1, minWidth: '45%', backgroundColor: active ? '#6C63FF20' : '#1A1A24', borderRadius: 14, borderWidth: 1.5, borderColor: active ? '#6C63FF' : '#2E2E40', padding: 12 }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{style.emoji}</Text>
                  <Text style={{ color: active ? '#6C63FF' : '#F0F0F5', fontWeight: '600', fontSize: 14 }}>{style.label}</Text>
                  <Text style={{ color: '#8888A8', fontSize: 11 }}>{style.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Traits */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#8888A8', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Personality Traits ({traits.length}/5)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TRAITS.map((trait) => {
              const active = traits.includes(trait);
              const atMax = traits.length >= 5 && !active;
              return (
                <TouchableOpacity key={trait} onPress={() => !atMax && toggleTrait(trait)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#6C63FF' : '#1A1A24', borderWidth: 1, borderColor: active ? '#6C63FF' : '#2E2E40', opacity: atMax ? 0.4 : 1 }}>
                  <Text style={{ color: active ? '#fff' : '#8888A8', fontWeight: '600', fontSize: 13 }}>{trait}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Backstory */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: '#8888A8', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Coach Backstory (optional)
          </Text>
          <TextInput
            value={backstory}
            onChangeText={setBackstory}
            placeholder="Give your coach a story or special instructions…"
            placeholderTextColor="#8888A8"
            multiline
            numberOfLines={4}
            style={{ backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 16, paddingVertical: 12, color: '#F0F0F5', fontSize: 14, minHeight: 100, textAlignVertical: 'top' }}
          />
        </View>

        {/* Preview */}
        <TouchableOpacity onPress={() => setPreviewOpen(!previewOpen)}
          style={{ backgroundColor: '#1A1A24', borderRadius: 14, borderWidth: 1, borderColor: '#2E2E40', padding: 14, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#6C63FF', fontWeight: '600' }}>Preview System Prompt</Text>
          <Ionicons name={previewOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6C63FF" />
        </TouchableOpacity>
        {previewOpen && (
          <View style={{ backgroundColor: '#0D0D18', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', padding: 14, marginTop: -16, marginBottom: 24 }}>
            <Text style={{ color: '#8888A8', fontSize: 12, fontFamily: 'monospace' }}>{previewPrompt}</Text>
          </View>
        )}

        {/* Habits */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#8888A8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Daily Habits
            </Text>
            <TouchableOpacity onPress={() => setShowHabitModal(true)}>
              <Ionicons name="add-circle" size={22} color="#6C63FF" />
            </TouchableOpacity>
          </View>

          {habits.length === 0 ? (
            <Text style={{ color: '#8888A8', fontSize: 13 }}>No habits yet. Add some to track daily!</Text>
          ) : (
            habits.map((habit) => {
              const done = habit.completedDates.includes(today);
              return (
                <View key={habit.id} style={{ backgroundColor: '#1A1A24', borderRadius: 14, borderWidth: 1, borderColor: done ? '#6C63FF40' : '#2E2E40', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => completeHabit(habit.id, today)} style={{ marginRight: 12 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: done ? '#6C63FF' : '#8888A8', backgroundColor: done ? '#6C63FF' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: done ? '#8888A8' : '#F0F0F5', fontWeight: '500', textDecorationLine: done ? 'line-through' : undefined }}>{habit.label}</Text>
                    <Text style={{ color: '#8888A8', fontSize: 11 }}>{habit.frequency}</Text>
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert('Remove', `Remove "${habit.label}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeHabit(habit.id) },
                  ])}>
                    <Ionicons name="trash-outline" size={18} color="#8888A8" />
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
          <View style={{ backgroundColor: '#1A1A24', borderRadius: 20, padding: 24 }}>
            <Text style={{ color: '#F0F0F5', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Add Habit</Text>
            <TextInput
              value={newHabit}
              onChangeText={setNewHabit}
              placeholder="e.g. Drink 2L water"
              placeholderTextColor="#8888A8"
              autoFocus
              style={{ backgroundColor: '#0F0F14', borderRadius: 10, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 14, paddingVertical: 10, color: '#F0F0F5', marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['daily', 'weekly'] as const).map((f) => (
                <TouchableOpacity key={f} onPress={() => setNewHabitFrequency(f)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: newHabitFrequency === f ? '#6C63FF' : '#0F0F14', alignItems: 'center', borderWidth: 1, borderColor: newHabitFrequency === f ? '#6C63FF' : '#2E2E40' }}>
                  <Text style={{ color: newHabitFrequency === f ? '#fff' : '#8888A8', fontWeight: '600', textTransform: 'capitalize' }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowHabitModal(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0F0F14', alignItems: 'center', borderWidth: 1, borderColor: '#2E2E40' }}>
                <Text style={{ color: '#8888A8', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitHabit} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6C63FF', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

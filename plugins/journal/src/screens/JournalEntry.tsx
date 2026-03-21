import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useJournalStore } from '../store';

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_LABELS = ['Mauvais', 'Pas top', 'Neutre', 'Bien', 'Super'];

const CONTEXTS = [
  { value: 'morning', label: 'Matin', icon: 'sunny-outline' },
  { value: 'pre_workout', label: 'Pré-séance', icon: 'barbell-outline' },
  { value: 'post_workout', label: 'Post-séance', icon: 'checkmark-circle-outline' },
  { value: 'evening', label: 'Soir', icon: 'moon-outline' },
  { value: 'general', label: 'Général', icon: 'ellipsis-horizontal' },
] as const;

export default function JournalEntry({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { addEntry } = useJournalStore();

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [context, setContext] = useState<string>('general');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const entry = {
        user_id: user.id,
        mood,
        energy,
        stress,
        context,
        notes: notes.trim(),
        date: today,
      };

      const { data, error } = await supabase
        .from('journal_entries')
        .insert(entry)
        .select('*')
        .single();

      if (error) throw error;

      addEntry(data);
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const renderScale = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    emojis: string[],
    labels: string[],
    color: string,
  ) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15, marginBottom: 12 }}>{label}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {emojis.map((e, i) => {
          const isSelected = i + 1 === value;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onChange(i + 1)}
              style={{
                alignItems: 'center', gap: 4, flex: 1,
              }}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: isSelected ? color + '22' : theme.surface,
                borderWidth: 2, borderColor: isSelected ? color : theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </View>
              <Text style={{
                color: isSelected ? color : theme.muted, fontSize: 10, fontWeight: isSelected ? '600' : '400',
              }}>
                {labels[i]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>Nouvelle entrée</Text>
        </View>

        {/* Mood */}
        {renderScale(
          'Comment tu te sens ?',
          mood, setMood,
          MOOD_EMOJI, MOOD_LABELS,
          '#4CAF50',
        )}

        {/* Energy */}
        {renderScale(
          'Niveau d\'énergie',
          energy, setEnergy,
          ['🔋', '🪫', '⚡', '💪', '🚀'],
          ['Épuisé', 'Fatigué', 'Normal', 'Énergique', 'On fire'],
          '#FF9800',
        )}

        {/* Stress */}
        {renderScale(
          'Niveau de stress',
          stress, setStress,
          ['😌', '🙂', '😐', '😰', '🤯'],
          ['Zen', 'Calme', 'Normal', 'Stressé', 'Submergé'],
          '#F44336',
        )}

        {/* Context */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15, marginBottom: 12 }}>Moment</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {CONTEXTS.map((c) => {
            const isSelected = context === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => setContext(c.value)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: isSelected ? theme.primary : theme.surface,
                  borderWidth: 1, borderColor: isSelected ? theme.primary : theme.border,
                }}
              >
                <Ionicons name={c.icon as any} size={16} color={isSelected ? '#fff' : theme.muted} />
                <Text style={{ color: isSelected ? '#fff' : theme.muted, fontWeight: '500', fontSize: 13 }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15, marginBottom: 12 }}>Notes (optionnel)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Pensées, réflexions, gratitude..."
          placeholderTextColor={theme.muted}
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 16,
            color: theme.text, fontSize: 15, minHeight: 120, textAlignVertical: 'top',
            borderWidth: 1, borderColor: theme.border, marginBottom: 32,
          }}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 18, alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

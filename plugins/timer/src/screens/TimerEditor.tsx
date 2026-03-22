import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useTimerStore } from '../store';

const TYPES = [
  { key: 'hiit', label: 'HIIT', color: '#FF9800', icon: 'flash' as const },
  { key: 'tabata', label: 'Tabata', color: '#F44336', icon: 'flame' as const },
  { key: 'emom', label: 'EMOM', color: '#2196F3', icon: 'repeat' as const },
  { key: 'custom', label: 'Custom', color: '#9C27B0', icon: 'settings' as const },
];

export default function TimerEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const params = useLocalSearchParams<{ presetId?: string }>();
  const { customPresets, addCustomPreset, updateCustomPreset } = useTimerStore();

  const existing = params.presetId
    ? customPresets.find((p) => p.id === params.presetId)
    : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<string>(existing?.type ?? 'hiit');
  const [workSec, setWorkSec] = useState(existing ? String(existing.work_seconds) : '30');
  const [restSec, setRestSec] = useState(existing ? String(existing.rest_seconds) : '15');
  const [rounds, setRounds] = useState(existing ? String(existing.rounds) : '8');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0
    && parseInt(rounds) > 0
    && (parseInt(workSec) > 0 || parseInt(restSec) > 0);

  const totalSeconds = (parseInt(workSec || '0') + parseInt(restSec || '0')) * parseInt(rounds || '1');
  const totalMin = Math.ceil(totalSeconds / 60);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const preset = {
        name: name.trim(),
        type: type as 'hiit' | 'tabata' | 'emom' | 'custom',
        work_sec: parseInt(workSec) || 0,
        rest_sec: parseInt(restSec) || 0,
        rounds: parseInt(rounds) || 1,
      };

      if (existing) {
        const { error } = await supabase
          .from('timer_presets')
          .update(preset)
          .eq('id', existing.id);
        if (error) throw error;
        updateCustomPreset(existing.id, {
          name: preset.name,
          type: preset.type,
          work_seconds: preset.work_sec,
          rest_seconds: preset.rest_sec,
          rounds: preset.rounds,
        });
      } else {
        const { data, error } = await supabase
          .from('timer_presets')
          .insert({ ...preset, user_id: user.id })
          .select('*')
          .single();
        if (error) throw error;
        addCustomPreset({
          id: data.id,
          name: data.name,
          type: data.type,
          work_seconds: data.work_sec,
          rest_seconds: data.rest_sec,
          rounds: data.rounds,
          is_builtin: false,
        });
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    color: theme.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>
            {existing ? 'Modifier le chrono' : 'Nouveau chrono'}
          </Text>
        </View>

        {/* Name */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>Nom *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Mon chrono HIIT"
          placeholderTextColor={theme.muted}
          style={inputStyle}
        />

        {/* Type selector */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {TYPES.map((t) => {
            const selected = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={{
                  flex: 1, alignItems: 'center', padding: 12, borderRadius: 12,
                  backgroundColor: selected ? t.color + '22' : theme.surface,
                  borderWidth: 2, borderColor: selected ? t.color : theme.border,
                }}
              >
                <Ionicons name={t.icon} size={20} color={selected ? t.color : theme.muted} />
                <Text style={{
                  color: selected ? t.color : theme.muted, fontWeight: '700',
                  fontSize: 11, marginTop: 4,
                }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Work seconds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Travail (secondes)
        </Text>
        <TextInput
          value={workSec}
          onChangeText={setWorkSec}
          placeholder="30"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Rest seconds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Repos (secondes)
        </Text>
        <TextInput
          value={restSec}
          onChangeText={setRestSec}
          placeholder="15"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Rounds */}
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
          Nombre de rounds *
        </Text>
        <TextInput
          value={rounds}
          onChangeText={setRounds}
          placeholder="8"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Preview */}
        {isValid && (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: theme.border, marginBottom: 20,
          }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>
              Aperçu
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {parseInt(workSec) > 0 ? `${workSec}s travail` : ''}
              {parseInt(restSec) > 0 ? ` / ${restSec}s repos` : ''}
              {' · '}{rounds} rounds · ~{totalMin} min
            </Text>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || saving}
          style={{
            backgroundColor: isValid ? theme.primary : theme.border,
            borderRadius: 14, padding: 18, alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Enregistrement...' : existing ? 'Modifier' : 'Créer le chrono'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

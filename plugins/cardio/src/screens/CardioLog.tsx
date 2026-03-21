import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS } from '../store';

const ACTIVITY_TYPES = Object.entries(ACTIVITY_LABELS);

export default function CardioLog({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { addSession } = useCardioStore();

  const [activityType, setActivityType] = useState('running');
  const [durationMin, setDurationMin] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = durationMin.trim().length > 0 && parseFloat(durationMin) > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const duration = parseFloat(durationMin);
      const distance = distanceKm ? parseFloat(distanceKm) : null;

      // Compute pace if distance is provided
      let avgPaceSecPerKm: number | null = null;
      if (distance && distance > 0) {
        avgPaceSecPerKm = Math.round((duration * 60) / distance);
      }

      const entry = {
        user_id: user.id,
        activity_type: activityType,
        duration_min: duration,
        distance_km: distance,
        calories_burned: caloriesBurned ? parseInt(caloriesBurned, 10) : null,
        avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate, 10) : null,
        avg_pace_sec_per_km: avgPaceSecPerKm,
        notes: notes.trim(),
        date: today,
      };

      const { data, error } = await supabase
        .from('cardio_sessions')
        .insert(entry)
        .select('*')
        .single();

      if (error) throw error;
      addSession(data);
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

  const labelStyle = {
    color: theme.text,
    fontWeight: '600' as const,
    fontSize: 14,
    marginBottom: 8,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>Nouvelle session</Text>
        </View>

        {/* Activity type selector */}
        <Text style={labelStyle}>Type d'activité</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {ACTIVITY_TYPES.map(([key, { label, emoji, color }]) => {
            const isSelected = activityType === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActivityType(key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8,
                  backgroundColor: isSelected ? color + '22' : theme.surface,
                  borderWidth: 2, borderColor: isSelected ? color : theme.border,
                }}
              >
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                <Text style={{ color: isSelected ? color : theme.muted, fontWeight: '600', fontSize: 13 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Duration */}
        <Text style={labelStyle}>Durée (minutes) *</Text>
        <TextInput
          value={durationMin}
          onChangeText={setDurationMin}
          placeholder="30"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Distance */}
        <Text style={labelStyle}>Distance (km)</Text>
        <TextInput
          value={distanceKm}
          onChangeText={setDistanceKm}
          placeholder="5.0"
          placeholderTextColor={theme.muted}
          keyboardType="decimal-pad"
          style={inputStyle}
        />

        {/* Calories */}
        <Text style={labelStyle}>Calories brûlées</Text>
        <TextInput
          value={caloriesBurned}
          onChangeText={setCaloriesBurned}
          placeholder="300"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Heart Rate */}
        <Text style={labelStyle}>FC moyenne (bpm)</Text>
        <TextInput
          value={avgHeartRate}
          onChangeText={setAvgHeartRate}
          placeholder="145"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* Notes */}
        <Text style={labelStyle}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Sensations, météo, parcours..."
          placeholderTextColor={theme.muted}
          multiline
          numberOfLines={3}
          style={{ ...inputStyle, minHeight: 80, textAlignVertical: 'top' }}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isValid || saving}
          style={{
            backgroundColor: isValid ? theme.primary : theme.border,
            borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer la session'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

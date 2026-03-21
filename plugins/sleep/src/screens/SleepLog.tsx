import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useSleepStore } from '../store';

export default function SleepLog({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { addLog } = useSleepStore();
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const calculateDuration = (): number => {
    const [bh, bm] = bedtime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    let bedMins = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    return wakeMins - bedMins;
  };

  const handleSave = async () => {
    if (!bedtime || !wakeTime) return;
    setSaving(true);
    const duration = calculateDuration();
    const date = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase.from('sleep_logs').insert({
        date, bedtime, wake_time: wakeTime,
        duration_minutes: duration, quality,
        notes: notes || null,
      }).select().single();
      if (error) throw error;
      if (data) addLog(data);
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de sauvegarder');
    }
    setSaving(false);
  };

  const duration = calculateDuration();
  const h = Math.floor(duration / 60);
  const m = duration % 60;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginLeft: 12 }}>Logger sommeil</Text>
        </View>

        {/* Bedtime */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>Heure de coucher</Text>
        <TextInput
          value={bedtime} onChangeText={setBedtime}
          placeholder="23:00" placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.surface, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: theme.border, color: theme.text,
            fontSize: 18, textAlign: 'center', fontWeight: '700',
          }}
        />

        {/* Wake time */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Heure de réveil</Text>
        <TextInput
          value={wakeTime} onChangeText={setWakeTime}
          placeholder="07:00" placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.surface, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: theme.border, color: theme.text,
            fontSize: 18, textAlign: 'center', fontWeight: '700',
          }}
        />

        {/* Duration preview */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 12, padding: 16,
          marginTop: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center',
        }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Durée estimée</Text>
          <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>{h}h{m > 0 ? ` ${m}min` : ''}</Text>
        </View>

        {/* Quality */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Qualité du sommeil</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TouchableOpacity key={i} onPress={() => setQuality(i)}>
              <Ionicons name={i <= quality ? 'star' : 'star-outline'} size={36} color={i <= quality ? '#FFB800' : theme.border} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>Notes (optionnel)</Text>
        <TextInput
          value={notes} onChangeText={setNotes}
          placeholder="Rêves, réveils nocturnes..." placeholderTextColor={theme.muted}
          multiline numberOfLines={3}
          style={{
            backgroundColor: theme.surface, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: theme.border, color: theme.text,
            fontSize: 15, minHeight: 80, textAlignVertical: 'top',
          }}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave} disabled={saving}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 24, opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

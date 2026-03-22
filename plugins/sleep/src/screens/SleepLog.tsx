import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useSleepStore } from '../store';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function StepperDigit({ value, max, onUp, onDown, theme }: {
  value: number; max: number; onUp: () => void; onDown: () => void; theme: any;
}) {
  return (
    <View style={{ alignItems: 'center', width: 56 }}>
      <TouchableOpacity onPress={onUp} style={{ padding: 8 }}>
        <Ionicons name="chevron-up" size={28} color={theme.primary} />
      </TouchableOpacity>
      <View style={{
        backgroundColor: theme.primary + '15', borderRadius: 10,
        width: 52, height: 52, justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text }}>{pad(value)}</Text>
      </View>
      <TouchableOpacity onPress={onDown} style={{ padding: 8 }}>
        <Ionicons name="chevron-down" size={28} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
}

function TimePicker({ value, onChange, theme }: {
  value: string; onChange: (v: string) => void; theme: any;
}) {
  const [hh, mm] = value.split(':').map(Number);
  const setH = (d: number) => {
    const next = (hh + d + 24) % 24;
    onChange(`${pad(next)}:${pad(mm)}`);
  };
  const setM = (d: number) => {
    const next = (mm + d + 60) % 60;
    onChange(`${pad(hh)}:${pad(next)}`);
  };
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
      borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 4,
    }}>
      <StepperDigit value={hh} max={23} onUp={() => setH(1)} onDown={() => setH(-1)} theme={theme} />
      <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginHorizontal: 6 }}>:</Text>
      <StepperDigit value={mm} max={55} onUp={() => setM(5)} onDown={() => setM(-5)} theme={theme} />
    </View>
  );
}

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { data, error } = await supabase.from('sleep_logs').insert({
        user_id: user.id,
        date, bedtime, wake_time: wakeTime,
        duration_hours: parseFloat((duration / 60).toFixed(2)), quality,
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
  const dh = Math.floor(duration / 60);
  const dm = duration % 60;

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
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
          <Ionicons name="moon-outline" size={16} color={theme.primary} /> Heure de coucher
        </Text>
        <TimePicker value={bedtime} onChange={setBedtime} theme={theme} />

        {/* Wake time */}
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 }}>
          <Ionicons name="sunny-outline" size={16} color={theme.primary} /> Heure de réveil
        </Text>
        <TimePicker value={wakeTime} onChange={setWakeTime} theme={theme} />

        {/* Duration preview */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 12, padding: 16,
          marginTop: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center',
        }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Durée estimée</Text>
          <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '800' }}>{dh}h{dm > 0 ? ` ${dm}min` : ''}</Text>
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

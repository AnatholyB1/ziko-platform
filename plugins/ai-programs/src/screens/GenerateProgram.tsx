import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAIProgramsStore } from '../store';

const CREDIT_COSTS = { chat: 4, scan: 3, program: 4 } as const;

const GOALS = [
  { id: 'muscle_gain', label: '💪 Prise de muscle', desc: 'Hypertrophie et volume' },
  { id: 'fat_loss', label: '🔥 Perte de gras', desc: 'Déficit calorique + cardio' },
  { id: 'strength', label: '🏋️ Force', desc: 'Charges lourdes, peu de reps' },
  { id: 'endurance', label: '🏃 Endurance', desc: 'Haute intensité, circuits' },
  { id: 'general_fitness', label: '🎯 Forme générale', desc: 'Équilibré et varié' },
];

const SPLITS = [
  { id: 'full_body', label: 'Full Body' },
  { id: 'upper_lower', label: 'Upper / Lower' },
  { id: 'ppl', label: 'Push / Pull / Legs' },
  { id: 'bro_split', label: 'Bro Split' },
];

const EQUIPMENT = [
  { id: 'full_gym', label: '🏢 Salle complète' },
  { id: 'home', label: '🏠 Home gym' },
  { id: 'dumbbells_only', label: '🏋️ Haltères seuls' },
  { id: 'bodyweight', label: '🤸 Poids du corps' },
];

function OptionButton({ selected, label, onPress, theme, desc }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: selected ? theme.primary + '15' : theme.surface,
        borderRadius: 12, padding: 14, marginBottom: 8,
        borderWidth: 2, borderColor: selected ? theme.primary : theme.border,
      }}
    >
      <Text style={{ color: selected ? theme.primary : theme.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      {desc && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{desc}</Text>}
    </TouchableOpacity>
  );
}

export default function GenerateProgram({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { isGenerating, setIsGenerating, addProgram } = useAIProgramsStore();
  const [goal, setGoal] = useState('');
  const [split, setSplit] = useState('');
  const [days, setDays] = useState(4);
  const [equipment, setEquipment] = useState('full_gym');

  const handleGenerate = async () => {
    if (!goal) { Alert.alert('Erreur', 'Choisis un objectif'); return; }
    if (!split) { Alert.alert('Erreur', 'Choisis un type de split'); return; }
    setIsGenerating(true);
    try {
      const name = `Programme ${GOALS.find(g => g.id === goal)?.label ?? goal} — ${days}j`;
      const { data, error } = await supabase.from('ai_generated_programs').insert({
        name, goal, split_type: split, days_per_week: days,
        experience_level: 'intermediate', equipment,
        program_data: { status: 'pending_generation' },
        is_active: true,
      }).select().single();
      if (error) throw error;
      if (data) addProgram(data);
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Génération impossible');
    }
    setIsGenerating(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginLeft: 12 }}>Générer un programme</Text>
        </View>

        {/* Goal */}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Objectif</Text>
        {GOALS.map((g) => (
          <OptionButton key={g.id} selected={goal === g.id} label={g.label} desc={g.desc}
            onPress={() => setGoal(g.id)} theme={theme} />
        ))}

        {/* Split */}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>Type de split</Text>
        {SPLITS.map((s) => (
          <OptionButton key={s.id} selected={split === s.id} label={s.label}
            onPress={() => setSplit(s.id)} theme={theme} />
        ))}

        {/* Days */}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>Jours par semaine</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[2, 3, 4, 5, 6].map((d) => (
            <TouchableOpacity key={d} onPress={() => setDays(d)}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                backgroundColor: days === d ? theme.primary : theme.surface,
                borderWidth: 1, borderColor: days === d ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: days === d ? '#fff' : theme.text, fontWeight: '700', fontSize: 16 }}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Equipment */}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>Équipement</Text>
        {EQUIPMENT.map((e) => (
          <OptionButton key={e.id} selected={equipment === e.id} label={e.label}
            onPress={() => setEquipment(e.id)} theme={theme} />
        ))}

        {/* Generate */}
        <TouchableOpacity
          onPress={handleGenerate} disabled={isGenerating}
          style={{
            backgroundColor: theme.primary, borderRadius: 14, padding: 16,
            alignItems: 'center', marginTop: 24, opacity: isGenerating ? 0.6 : 1,
            flexDirection: 'row', justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {isGenerating ? 'Génération en cours...' : 'Générer le programme'}
          </Text>
          {!isGenerating && (
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>{CREDIT_COSTS.program}⚡</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

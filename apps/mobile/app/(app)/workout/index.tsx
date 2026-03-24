import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { useCommunityStore, loadCommunity, shareProgram } from '@ziko/plugin-community';

interface Program {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  is_active: boolean;
  created_at: string;
}

export default function WorkoutProgramsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const communityEnabled = enabledPlugins.includes('community');
  const friends = useCommunityStore((s) => s.friends);
  const theme = useThemeStore((s) => s.theme);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [shareModalProgram, setShareModalProgram] = useState<Program | null>(null);
  const [sharing, setSharing] = useState(false);

  const DAY_LABELS = [t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'), t('day.fri'), t('day.sat'), t('day.sun')];
  const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDay = (dayIndex: number) => {
    const dbDay = dayIndex + 1; // 1=Mon..7=Sun
    setSelectedDays((prev) =>
      prev.includes(dbDay) ? prev.filter((d) => d !== dbDay) : [...prev, dbDay].sort((a, b) => a - b)
    );
  };

  const loadPrograms = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPrograms((data ?? []) as Program[]);
    setIsLoading(false);
  };

  useEffect(() => { loadPrograms(); }, [user]);

  useEffect(() => {
    if (communityEnabled) loadCommunity(supabase);
  }, [communityEnabled]);

  const setActiveProgram = useWorkoutStore((s) => s.setActiveProgram);

  const createProgram = async () => {
    if (!newName.trim() || !user || selectedDays.length === 0) return;
    const { data, error } = await supabase
      .from('workout_programs')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() || null, days_per_week: selectedDays.length })
      .select()
      .single();
    if (!error && data) {
      // Create a workout day for each selected day
      const workoutDays = selectedDays.map((dbDay) => ({
        program_id: data.id,
        name: DAY_FULL[dbDay - 1],
        day_of_week: dbDay,
        order_index: dbDay,
      }));
      await supabase.from('program_workouts').insert(workoutDays);

      // Auto-activate the new program so it shows on the home screen
      await setActiveProgram(data.id);

      // Reload local list to reflect active status
      await loadPrograms();
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setSelectedDays([]);
    }
  };

  const deleteProgram = (id: string) => {
    showAlert('Delete Program', 'This will delete the program and all its workouts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('workout_programs').delete().eq('id', id);
          setPrograms(programs.filter((p) => p.id !== id));
        },
      },
    ]);
  };

  const duplicateProgram = async (prog: Program) => {
    if (!user) return;
    // 1. Create a copy of the program
    const { data: newProg, error } = await supabase
      .from('workout_programs')
      .insert({ user_id: user.id, name: `${prog.name} (copy)`, description: prog.description, days_per_week: prog.days_per_week })
      .select()
      .single();
    if (error || !newProg) return;

    // 2. Fetch the source program's workouts + exercises
    const { data: srcWorkouts } = await supabase
      .from('program_workouts')
      .select('*, program_exercises(*)')
      .eq('program_id', prog.id)
      .order('day_of_week');

    if (srcWorkouts && srcWorkouts.length > 0) {
      for (const srcW of srcWorkouts) {
        const { data: newW } = await supabase
          .from('program_workouts')
          .insert({ program_id: newProg.id, name: srcW.name, day_of_week: srcW.day_of_week, order_index: srcW.order_index })
          .select()
          .single();
        if (newW && srcW.program_exercises?.length > 0) {
          const exercises = srcW.program_exercises.map((pe: any) => ({
            workout_id: newW.id,
            exercise_id: pe.exercise_id,
            sets: pe.sets, reps: pe.reps, reps_min: pe.reps_min, reps_max: pe.reps_max,
            duration_seconds: pe.duration_seconds, duration_min: pe.duration_min, duration_max: pe.duration_max,
            rest_seconds: pe.rest_seconds, weight_kg: pe.weight_kg, notes: pe.notes, order_index: pe.order_index,
          }));
          await supabase.from('program_exercises').insert(exercises);
        }
      }
    }

    await loadPrograms();
  };

  const showProgramActions = (prog: Program) => {
    const buttons: any[] = [
      { text: 'Duplicate', onPress: () => duplicateProgram(prog) },
    ];
    if (communityEnabled) {
      buttons.push({ text: 'Share with friend', onPress: () => setShareModalProgram(prog) });
    }
    buttons.push(
      { text: 'Delete', style: 'destructive', onPress: () => deleteProgram(prog.id) },
      { text: 'Cancel', style: 'cancel' },
    );
    showAlert(prog.name, undefined, buttons);
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!shareModalProgram) return;
    setSharing(true);
    try {
      await shareProgram(supabase, friendId, shareModalProgram.id);
      showAlert('Partagé !', 'Le programme a été envoyé à ton ami.');
      setShareModalProgram(null);
    } catch {
      showAlert('Erreur', 'Impossible de partager le programme.');
    }
    setSharing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 26, fontWeight: '800', color: theme.text }}>{t('workout.title')}</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: theme.primary, borderRadius: 10, padding: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick start */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/workout/session')}
        style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: theme.primary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('workout.quickStart')}</Text>
          <Text style={{ color: '#ffffff99', fontSize: 13 }}>{t('workout.quickStartDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ffffff88" />
      </TouchableOpacity>

      {/* Supplements tip */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/(plugins)/supplements/list' as any)}
        style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: theme.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#FF9800' + '44' }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FF980018', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flask" size={20} color="#FF9800" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{t('workout.supplementsTip')}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{t('workout.supplementsTipDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.muted} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{t('workout.myPrograms')}</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
            <Text style={{ color: theme.primary, fontSize: 14 }}>{t('workout.history')} →</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 40 }}>Loading…</Text>}
        {!isLoading && programs.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Image
              source={require('../../../assets/image/no_training.png')}
              style={{ width: 180, height: 180, marginBottom: 8 }}
              contentFit="contain"
              transition={300}
            />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>{t('workout.noPrograms')}</Text>
            <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>{t('workout.noProgramsDesc')}</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('workout.createProgram')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {programs.map((program) => (
          <TouchableOpacity
            key={program.id}
            onPress={() => router.push(`/(app)/workout/${program.id}` as any)}
            onLongPress={() => showProgramActions(program)}
            style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: program.is_active ? theme.primary : theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{program.name}</Text>
                {program.is_active && (
                  <View style={{ backgroundColor: theme.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Active</Text>
                  </View>
                )}
              </View>
              {program.description && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{program.description}</Text>}
              {program.days_per_week != null && (
                <Text style={{ color: theme.primary, fontSize: 12, marginTop: 4 }}>{program.days_per_week}{t('workout.daysPerWeekShort')}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7A7670" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create Program Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{t('workout.newProgram')}</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.programName')} *</Text>
          <TextInput value={newName} onChangeText={setNewName} placeholder="e.g. PPL, Upper/Lower" placeholderTextColor="#7A7670"
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>Description (optional)</Text>
          <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="Brief description" placeholderTextColor="#7A7670" multiline numberOfLines={3}
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16, height: 80, textAlignVertical: 'top' }} />

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.trainingDays')} *</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {DAY_LABELS.map((label, i) => {
              const dbDay = i + 1;
              const isSelected = selectedDays.includes(dbDay);
              return (
                <TouchableOpacity key={label} onPress={() => toggleDay(i)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderWidth: 1, borderColor: isSelected ? theme.primary : theme.border,
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : theme.muted, fontWeight: '600', fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedDays.length > 0 && (
            <Text style={{ color: theme.primary, fontSize: 12, marginBottom: 20 }}>
              {selectedDays.length} day{selectedDays.length > 1 ? 's' : ''} selected
            </Text>
          )}
          {selectedDays.length === 0 && (
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 20 }}>
              Tap the days you want to train
            </Text>
          )}

          <TouchableOpacity onPress={createProgram} disabled={!newName.trim() || selectedDays.length === 0}
            style={{ backgroundColor: newName.trim() && selectedDays.length > 0 ? theme.primary : theme.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('workout.createProgram')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Share with friend Modal */}
      <Modal visible={!!shareModalProgram} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>Partager avec un ami</Text>
            <TouchableOpacity onPress={() => setShareModalProgram(null)}>
              <Ionicons name="close" size={24} color="#7A7670" />
            </TouchableOpacity>
          </View>
          {shareModalProgram && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="barbell" size={18} color={theme.primary} />
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{shareModalProgram.name}</Text>
            </View>
          )}
          {friends.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Ionicons name="people-outline" size={40} color="#E2E0DA" />
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucun ami pour le moment</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              renderItem={({ item: friend }) => (
                <TouchableOpacity
                  onPress={() => handleShareToFriend(friend.id)}
                  disabled={sharing}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                      {(friend.name ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 }}>
                    {friend.name ?? 'Unknown'}
                  </Text>
                  <Ionicons name="send" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
          {sharing && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

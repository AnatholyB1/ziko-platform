import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

interface Program {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  is_active: boolean;
  created_at: string;
}

export default function WorkoutProgramsScreen() {
  const user = useAuthStore((s) => s.user);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDays, setNewDays] = useState('3');

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

  const createProgram = async () => {
    if (!newName.trim() || !user) return;
    const { data, error } = await supabase
      .from('workout_programs')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() || null, days_per_week: parseInt(newDays) })
      .select()
      .single();
    if (!error && data) {
      setPrograms([data as Program, ...programs]);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewDays('3');
    }
  };

  const deleteProgram = (id: string) => {
    Alert.alert('Delete Program', 'This will delete the program and all its workouts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('workout_programs').delete().eq('id', id);
          setPrograms(programs.filter((p) => p.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 26, fontWeight: '800', color: '#F0F0F5' }}>Workout</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: '#6C63FF', borderRadius: 10, padding: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick start */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/workout/session')}
        style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#6C63FF', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Quick Workout</Text>
          <Text style={{ color: '#ffffff99', fontSize: 13 }}>Start a free session now</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ffffff88" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16 }}>My Programs</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
            <Text style={{ color: '#6C63FF', fontSize: 14 }}>History →</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <Text style={{ color: '#8888A8', textAlign: 'center', marginTop: 40 }}>Loading…</Text>}
        {!isLoading && programs.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 48 }}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={{ color: '#F0F0F5', fontSize: 16, fontWeight: '600', marginTop: 12 }}>No programs yet</Text>
            <Text style={{ color: '#8888A8', marginTop: 8, textAlign: 'center' }}>Create your first workout program to get started</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Create Program</Text>
            </TouchableOpacity>
          </View>
        )}

        {programs.map((program) => (
          <TouchableOpacity
            key={program.id}
            onPress={() => router.push(`/(app)/workout/${program.id}` as any)}
            onLongPress={() => deleteProgram(program.id)}
            style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2E2E40', flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#6C63FF22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell" size={20} color="#6C63FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F0F0F5', fontWeight: '600', fontSize: 15 }}>{program.name}</Text>
              {program.description && <Text style={{ color: '#8888A8', fontSize: 12, marginTop: 2 }}>{program.description}</Text>}
              {program.days_per_week && (
                <Text style={{ color: '#6C63FF', fontSize: 12, marginTop: 4 }}>{program.days_per_week}x / week</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8888A8" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create Program Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#0F0F14', padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: '#F0F0F5', fontSize: 22, fontWeight: '700' }}>New Program</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color="#8888A8" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Program name *</Text>
          <TextInput value={newName} onChangeText={setNewName} placeholder="e.g. PPL, Upper/Lower" placeholderTextColor="#8888A8"
            style={{ backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 16, paddingVertical: 14, color: '#F0F0F5', marginBottom: 16 }} />

          <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Description (optional)</Text>
          <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="Brief description" placeholderTextColor="#8888A8" multiline numberOfLines={3}
            style={{ backgroundColor: '#1A1A24', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E40', paddingHorizontal: 16, paddingVertical: 14, color: '#F0F0F5', marginBottom: 16, height: 80, textAlignVertical: 'top' }} />

          <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 6 }}>Days per week</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
            {['2', '3', '4', '5', '6'].map((d) => (
              <TouchableOpacity key={d} onPress={() => setNewDays(d)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: newDays === d ? '#6C63FF' : '#1A1A24', alignItems: 'center', borderWidth: 1, borderColor: newDays === d ? '#6C63FF' : '#2E2E40' }}>
                <Text style={{ color: newDays === d ? '#fff' : '#8888A8', fontWeight: '600' }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={createProgram} disabled={!newName.trim()}
            style={{ backgroundColor: newName.trim() ? '#6C63FF' : '#2E2E40', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Create Program</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

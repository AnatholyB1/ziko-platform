import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@ziko/plugin-sdk';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import WSHeader from '../components/WSHeader';

export interface ExercisePickerProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (selectedIds: string[]) => void;
}

const FILTER_CHIPS = ['Favoris', 'Pectoraux', 'Dos', 'Jambes', 'Épaules', 'Bras', 'Abdos'];

interface ExerciseRow {
  id: string;
  name: string;
  muscle_groups: string[] | null;
  equipment: string | null;
  target_muscle: string | null;
}

export default function ExercisePicker({ visible, onClose, onAdd }: ExercisePickerProps) {
  const theme = useThemeStore((s) => s.theme);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: exercises = [],
    isError,
    refetch,
  } = useQuery<ExerciseRow[]>({
    queryKey: ['exercises-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, muscle_groups, equipment, target_muscle')
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ExerciseRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter logic
  const filteredExercises = exercises.filter((ex) => {
    // Search overrides muscle filter
    if (searchQuery.trim()) {
      return ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    }

    if (!activeFilter) return true;

    if (activeFilter === 'Favoris') {
      // Stub: favorites not yet implemented — show all
      return true;
    }

    if (activeFilter === 'Bras') {
      const target = ex.target_muscle ?? '';
      const groups = ex.muscle_groups ?? [];
      return (
        target === 'Biceps' ||
        target === 'Triceps' ||
        groups.includes('Biceps') ||
        groups.includes('Triceps')
      );
    }

    const target = ex.target_muscle ?? '';
    const groups = ex.muscle_groups ?? [];
    return target === activeFilter || groups.includes(activeFilter);
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAdd = () => {
    if (selectedIds.length === 0) return;
    onAdd(selectedIds);
    // Reset state after add
    setSelectedIds([]);
    setSearchQuery('');
    setActiveFilter(null);
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSearchQuery('');
    setActiveFilter(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <WSHeader
          title="Ajouter un exercice"
          sub={`${filteredExercises.length} exercices · ${selectedIds.length} sélectionnés`}
          onBack={handleClose}
        />

        {/* Search + filters container */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {/* Search input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Ionicons name="search-outline" size={16} color={theme.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un exercice…"
              placeholderTextColor={theme.muted}
              style={{
                flex: 1,
                fontSize: 13,
                color: theme.text,
                padding: 0,
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-outline" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  onPress={() => setActiveFilter(isActive ? null : chip)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? '#FF5C1A' : theme.border,
                    backgroundColor: isActive
                      ? 'rgba(255,92,26,0.10)'
                      : theme.surface,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isActive ? '#FF5C1A' : theme.text,
                    }}
                  >
                    {chip === 'Favoris' ? `★ ${chip}` : chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Exercise list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {isError && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                Impossible de charger les exercices.
              </Text>
              <TouchableOpacity
                onPress={() => refetch()}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Réessaie</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isError && filteredExercises.length === 0 && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center' }}>
                Aucun exercice trouvé.
              </Text>
            </View>
          )}

          <View style={{ gap: 8 }}>
            {filteredExercises.map((ex, index) => {
              const isSelected = selectedIds.includes(ex.id);
              return (
                <MotiView
                  key={ex.id}
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{
                    type: 'timing',
                    duration: 200,
                    delay: Math.min(index * 40, 320),
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleSelection(ex.id)}
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: isSelected
                        ? 'rgba(255,92,26,0.06)'
                        : theme.surface,
                      borderWidth: isSelected ? 1.5 : 1,
                      borderColor: isSelected ? '#FF5C1A' : theme.border,
                      shadowColor: theme.text,
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 3,
                    }}
                  >
                    {/* Checkbox */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: isSelected ? '#FF5C1A' : 'transparent',
                        borderWidth: isSelected ? 0 : 1.5,
                        borderColor: theme.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                    </View>

                    {/* Exercise info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{ fontSize: 12, fontWeight: '700', color: theme.text }}
                        numberOfLines={1}
                      >
                        {ex.name}
                      </Text>
                      <Text
                        style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {[ex.target_muscle, ex.equipment].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <LinearGradient
            colors={[`${theme.background}00`, theme.background]}
            style={{
              paddingHorizontal: 16,
              paddingBottom: 24,
              paddingTop: 8,
            }}
          >
            <TouchableOpacity
              onPress={selectedIds.length > 0 ? handleAdd : undefined}
              style={{
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                backgroundColor: selectedIds.length > 0
                  ? '#FF5C1A'
                  : 'rgba(28,26,23,0.18)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#fff',
                }}
              >
                {selectedIds.length === 0
                  ? 'Sélectionne des exercices'
                  : `Ajouter ${selectedIds.length} exercice${selectedIds.length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

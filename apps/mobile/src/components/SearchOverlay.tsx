import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../stores/themeStore';

// ── Types ──────────────────────────────────────────────────

type SearchType = 'exercise' | 'program' | 'module' | 'user' | 'food';

interface SearchResult {
  type: SearchType;
  title: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}

// ── Static data ────────────────────────────────────────────

const RECENT_SEARCHES = ['Squat', 'Protéines', 'Push Pull Legs', 'Bench press', 'HIIT'];

const SEARCH_INDEX: SearchResult[] = [
  { type: 'exercise', title: 'Squat barre', sub: 'Jambes · Compound', icon: 'barbell-outline', tint: '#FF5C1A' },
  { type: 'exercise', title: 'Développé couché', sub: 'Pectoraux · Compound', icon: 'barbell-outline', tint: '#FF5C1A' },
  { type: 'exercise', title: 'Tractions', sub: 'Dos · Compound', icon: 'fitness-outline', tint: '#2E7BF6' },
  { type: 'exercise', title: 'Soulevé de terre', sub: 'Dos · Compound', icon: 'barbell-outline', tint: '#FF5C1A' },
  { type: 'program', title: 'Push Pull Legs 6j', sub: 'Intermédiaire · IA généré', icon: 'calendar-outline', tint: '#7B5BD0' },
  { type: 'program', title: 'Full Body 3j', sub: 'Débutant · IA généré', icon: 'calendar-outline', tint: '#7B5BD0' },
  { type: 'module', title: 'Nutrition Tracker', sub: 'Suivi calorique + macros', icon: 'restaurant-outline', tint: '#2E9E5B' },
  { type: 'module', title: 'Cardio & Running', sub: 'GPS · Strava-like', icon: 'map-outline', tint: '#2E7BF6' },
  { type: 'module', title: 'Timer & Chrono', sub: 'Tabata, HIIT, EMOM', icon: 'timer-outline', tint: '#E8A33A' },
  { type: 'user', title: 'Marco T.', sub: 'Ami · 3 défis communs', icon: 'person-outline', tint: '#FF5C1A' },
  { type: 'user', title: 'Sophie R.', sub: 'Amie · 240 séances', icon: 'person-outline', tint: '#7B5BD0' },
  { type: 'food', title: 'Blanc de poulet', sub: '165 kcal · 31g protéines / 100g', icon: 'restaurant-outline', tint: '#2E9E5B' },
  { type: 'food', title: 'Flocons d\'avoine', sub: '389 kcal · 17g protéines / 100g', icon: 'leaf-outline', tint: '#2E9E5B' },
  { type: 'food', title: 'Saumon atlantique', sub: '208 kcal · 20g protéines / 100g', icon: 'restaurant-outline', tint: '#2E7BF6' },
];

const TYPE_LABELS: Record<SearchType, string> = {
  exercise: 'Exercices',
  program: 'Programmes',
  module: 'Modules',
  user: 'Personnes',
  food: 'Aliments',
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'Tout' },
  { id: 'exercise', label: 'Exercices' },
  { id: 'program', label: 'Programmes' },
  { id: 'module', label: 'Modules' },
  { id: 'user', label: 'Personnes' },
  { id: 'food', label: 'Aliments' },
];

// ── Helpers ────────────────────────────────────────────────

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, x) => {
    const k = fn(x);
    (acc[k] = acc[k] ?? []).push(x);
    return acc;
  }, {});
}

// ── Sub-components ─────────────────────────────────────────

function SearchItem({ item, divide, theme }: { item: SearchResult; divide: boolean; theme: any }) {
  return (
    <TouchableOpacity
      style={{
        padding: 11,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: divide ? 1 : 0,
        borderTopColor: theme.border,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: item.tint + '24', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ionicons name={item.icon} size={15} color={item.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{item.title}</Text>
        <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{item.sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={theme.muted} />
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────

export function SearchOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setFilter('all');
      // Small delay to allow modal animation to settle before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const results = query
    ? SEARCH_INDEX.filter(
        (r) =>
          (filter === 'all' || r.type === filter) &&
          (r.title.toLowerCase().includes(query.toLowerCase()) ||
            r.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  const grouped = groupBy(results, (r) => r.type);

  const sectionLabel = (label: string) => (
    <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: 12, paddingBottom: 8, paddingHorizontal: 4 }}>
      {label}
    </Text>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Top bar */}
          <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.text + '0D', borderRadius: 14 }}>
              <Ionicons name="search-outline" size={16} color={theme.muted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Cherche un exercice, ami, module…"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, fontSize: 14, color: theme.text, padding: 0 }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>Effacer</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.text + '0D' }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>Annuler</Text>
            </TouchableOpacity>
          </View>

          {/* Filter pills — only when query is active */}
          {query.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}
            >
              {FILTER_OPTIONS.map((f) => {
                const active = filter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? theme.text : theme.text + '0D', marginRight: 6 }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? '#fff' : theme.text }}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Body */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {query.length === 0 ? (
              <>
                {sectionLabel('Récents')}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                  {RECENT_SEARCHES.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setQuery(r)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.text + '0D' }}
                    >
                      <Ionicons name="search-outline" size={11} color={theme.muted} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {sectionLabel('Tendances')}
                <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 4 }}>
                  {SEARCH_INDEX.slice(0, 4).map((item, i) => (
                    <SearchItem key={i} item={item} divide={i > 0} theme={theme} />
                  ))}
                </View>
              </>
            ) : results.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 60 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: theme.text + '0D', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="search-outline" size={24} color={theme.muted} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Aucun résultat</Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>Essaie un autre mot ou catégorie.</Text>
              </View>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <View key={type} style={{ marginTop: 4 }}>
                  {sectionLabel(`${TYPE_LABELS[type as SearchType]} · ${items.length}`)}
                  <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 4 }}>
                    {items.map((item, i) => (
                      <SearchItem key={i} item={item} divide={i > 0} theme={theme} />
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

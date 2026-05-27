import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#2E9E5B';
const TABS = ["Aujourd'hui", 'Mon stack', 'Rappels'];

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplement {
  id: string;
  name: string;
  brand_id?: string;
  category_id?: string;
}

interface SupplementPrice {
  id: string;
  supplement_id: string;
  source: string;
  price_eur: number;
  per_serving_eur: number;
}

interface SupplementWithPrice extends Supplement {
  supplement_prices: SupplementPrice[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Static reminder data ─────────────────────────────────────────────────────

const REMINDERS = [
  { time: '8h00', label: 'Matin', items: ['Vitamine D3', 'Oméga-3'] },
  { time: 'Avant séance', label: 'Pré-entraînement', items: ['Caféine', 'Créatine'] },
  { time: '13h00', label: 'Midi', items: ['Magnésium'] },
  { time: '21h00', label: 'Soir', items: ['Magnésium bisglycinate'] },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupplementsPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  // Tab 2 — search state
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab 3 — reminder toggles
  const [reminderEnabled, setReminderEnabled] = useState<boolean[]>(REMINDERS.map(() => false));

  // ─── Auth query ─────────────────────────────────────────────────────────────

  const { data: userInfo } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = userInfo?.id ?? null;
  const today = getToday();

  // ─── Tab 1: supplements list for checklist ──────────────────────────────────

  const { data: supplementsList = [], isLoading: loadingSupplements } = useQuery<Supplement[]>({
    queryKey: ['supplements_checklist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplements')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []).slice(0, 10); // show first 10 as daily stack
    },
  });

  // AsyncStorage daily checklist state (key: supplements_daily_{userId}_{YYYY-MM-DD})
  const storageKey = userId ? `supplements_daily_${userId}_${today}` : null;
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});

  // Load persisted checklist from AsyncStorage on mount or when userId/today changes
  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then((raw) => {
      try {
        setCheckedState(raw ? JSON.parse(raw) : {});
      } catch {
        setCheckedState({});
      }
    });
  }, [storageKey]);

  const toggleSupplement = (id: string) => {
    const next = { ...checkedState, [id]: !checkedState[id] };
    setCheckedState(next);
    if (storageKey) {
      AsyncStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  const takenCount = supplementsList.filter((s) => checkedState[s.id]).length;
  const totalCount = supplementsList.length;

  // ─── Tab 2: search + prices ──────────────────────────────────────────────────

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  };

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery<SupplementWithPrice[]>({
    queryKey: ['supplements_search', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('supplements')
        .select('*, supplement_prices(*)')
        .order('name');
      if (debouncedSearch.trim()) {
        query = query.ilike('name', `%${debouncedSearch.trim()}%`);
      }
      const { data, error } = await query.limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Compléments" onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ─── Tab: Aujourd'hui ─────────────────────────────────────── */}
        {activeTab === TABS[0] && (
          <View>
            {loadingSupplements ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
            ) : (
              <>
                {/* Counter */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
                    {takenCount}/{totalCount} pris aujourd'hui
                  </Text>

                  {/* Progress bar */}
                  <View style={{
                    height: 6,
                    backgroundColor: 'rgba(28,26,23,0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: totalCount > 0 ? `${(takenCount / totalCount) * 100}%` : '0%',
                      height: '100%',
                      backgroundColor: ACCENT,
                      borderRadius: 999,
                    }} />
                  </View>
                </View>

                {/* AI Suggestion */}
                <View style={{ marginBottom: 20 }}>
                  <AISuggestion
                    tintColor={ACCENT}
                    text={
                      takenCount === 0
                        ? "N'oublie pas de prendre tes compléments du matin avec un grand verre d'eau !"
                        : takenCount < totalCount
                        ? `Bien ! Il te reste ${totalCount - takenCount} complément${totalCount - takenCount > 1 ? 's' : ''} à prendre aujourd'hui.`
                        : 'Excellent ! Tu as pris tous tes compléments du jour.'
                    }
                  />
                </View>

                {/* Supplement checklist */}
                {supplementsList.length === 0 ? (
                  <View style={{
                    ...CARD_SHADOW,
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    padding: 24,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="nutrition-outline" size={40} color={theme.muted} />
                    <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                      Aucun complément dans votre stack.{'\n'}Ajoutez-en depuis l'onglet Mon stack.
                    </Text>
                  </View>
                ) : (
                  supplementsList.map((supp) => {
                    const taken = !!checkedState[supp.id];
                    return (
                      <View
                        key={supp.id}
                        style={{
                          ...CARD_SHADOW,
                          backgroundColor: theme.surface,
                          borderRadius: 14,
                          padding: 14,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: theme.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {/* Checkbox circle */}
                        <TouchableOpacity
                          onPress={() => toggleSupplement(supp.id)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: taken ? ACCENT : 'transparent',
                            borderWidth: taken ? 0 : 2,
                            borderColor: ACCENT,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {taken && (
                            <Ionicons name="checkmark-outline" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>

                        {/* Name + info */}
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            color: theme.text,
                            fontSize: 12.5,
                            fontWeight: '700',
                            textDecorationLine: taken ? 'line-through' : 'none',
                          }}>
                            {supp.name}
                          </Text>
                          <Text style={{ color: theme.muted, fontSize: 10.5, marginTop: 2 }}>
                            1 dose • matin
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}

        {/* ─── Tab: Mon stack ───────────────────────────────────────── */}
        {activeTab === TABS[1] && (
          <View>
            {/* Search input */}
            <View style={{
              ...CARD_SHADOW,
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Ionicons name="search-outline" size={16} color={theme.muted} />
              <TextInput
                value={searchText}
                onChangeText={handleSearchChange}
                placeholder="Rechercher un complément…"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, fontSize: 13, color: theme.text }}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchText(''); setDebouncedSearch(''); }}>
                  <Ionicons name="close-circle-outline" size={16} color={theme.muted} />
                </TouchableOpacity>
              )}
            </View>

            {loadingSearch ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
            ) : searchResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="nutrition-outline" size={40} color={theme.muted} />
                <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                  Aucun résultat — essaie 'créatine', 'whey', 'vitamine'
                </Text>
              </View>
            ) : (
              searchResults.map((supp) => {
                const price = supp.supplement_prices?.[0];
                return (
                  <View
                    key={supp.id}
                    style={{
                      ...CARD_SHADOW,
                      backgroundColor: theme.surface,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Icon */}
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: 'rgba(46,158,91,0.14)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="nutrition-outline" size={16} color={ACCENT} />
                    </View>

                    {/* Name + sub */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        {supp.name}
                      </Text>
                      {price && (
                        <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                          {price.source} · {Number(price.price_eur).toFixed(2)}€
                        </Text>
                      )}
                    </View>

                    {/* Right: per_serving price */}
                    {price && price.per_serving_eur != null && (
                      <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>
                        {Number(price.per_serving_eur).toFixed(2)}€/dose
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─── Tab: Rappels ─────────────────────────────────────────── */}
        {activeTab === TABS[2] && (
          <View>
            {REMINDERS.map((reminder, index) => (
              <View
                key={index}
                style={{
                  ...CARD_SHADOW,
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="alarm-outline" size={18} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                        {reminder.label} · {reminder.time}
                      </Text>
                      <Switch
                        value={reminderEnabled[index]}
                        onValueChange={(val) => {
                          const next = [...reminderEnabled];
                          next[index] = val;
                          setReminderEnabled(next);
                        }}
                        trackColor={{ false: theme.border, true: ACCENT }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                      {reminder.items.join(', ')}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              <AISuggestion
                tintColor={ACCENT}
                text="Prendre tes compléments aux mêmes horaires chaque jour maximise leur efficacité. Active les rappels pour ne jamais oublier."
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

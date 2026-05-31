import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Platform, KeyboardAvoidingView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@ziko/ui';
import { showAlert } from '@ziko/plugin-sdk';

// ── Main component ─────────────────────────────────────────

export function SearchOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setDebouncedQuery('');
      setSentIds(new Set());
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Section 1 — Exercises
  const { data: exercises, isLoading: loadingExercises } = useQuery({
    queryKey: ['search_exercises', debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, category')
        .ilike('name', `%${debouncedQuery}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Section 2 — Programs
  const { data: programs, isLoading: loadingPrograms } = useQuery({
    queryKey: ['search_programs', userId, debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_generated_programs')
        .select('id, goal, created_at')
        .eq('user_id', userId)
        .ilike('goal', `%${debouncedQuery}%`)
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: debouncedQuery.length >= 2 && !!userId,
  });

  // Section 3 — Users (accent + case insensitive via RPC, fallback to ilike)
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['search_users', debouncedQuery],
    queryFn: async () => {
      if (!userId) return [];
      // Try RPC first (migration 064 — accent-insensitive)
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_users_fuzzy', {
        search_query: debouncedQuery.trim(),
        calling_user_id: userId,
        result_limit: 5,
      });
      if (!rpcError && rpcData) return rpcData as { id: string; name: string; avatar_url: string | null }[];
      // Fallback: ilike
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, avatar_url')
        .neq('id', userId)
        .ilike('name', `%${debouncedQuery}%`)
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  const isLoading = loadingExercises || loadingPrograms || loadingUsers;

  const sectionTitle = (label: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: '#6B6963',
        letterSpacing: 0.06,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 16,
      }}
    >
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
          <View
            style={{
              paddingTop: insets.top + 10,
              paddingBottom: 10,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: theme.text + '0D',
                borderRadius: 14,
              }}
            >
              <Ionicons name="search-outline" size={16} color={theme.muted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher un exercice, programme…"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, fontSize: 14, color: theme.text, padding: 0 }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>
                    Effacer
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: theme.text + '0D',
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {debouncedQuery.length < 2 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 14, color: '#6B6963', textAlign: 'center' }}>
                  Tape au moins 2 caractères pour rechercher
                </Text>
              </View>
            ) : isLoading ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <ActivityIndicator color="#FF5C1A" />
              </View>
            ) : (
              <>
                {/* Section Exercices */}
                {sectionTitle('Exercices')}
                {exercises && exercises.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E0DA',
                      overflow: 'hidden',
                    }}
                  >
                    {exercises.map((ex, i) => (
                      <View
                        key={ex.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          gap: 12,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: '#E2E0DA',
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            backgroundColor: '#FF5C1A24',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="barbell-outline" size={20} color="#FF5C1A" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1A17' }}>
                            {ex.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 1 }}>
                            {ex.category}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ height: 80 }}>
                    <EmptyState variant="no-results" title="Aucun résultat" />
                  </View>
                )}

                {/* Section Programmes */}
                {sectionTitle('Programmes')}
                {programs && programs.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E0DA',
                      overflow: 'hidden',
                    }}
                  >
                    {programs.map((prog, i) => (
                      <View
                        key={prog.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          gap: 12,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: '#E2E0DA',
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            backgroundColor: '#7B5BD024',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="list-outline" size={20} color="#7B5BD0" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1A17' }}>
                            {prog.goal}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 1 }}>
                            {new Date(prog.created_at).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ height: 80 }}>
                    <EmptyState variant="no-results" title="Aucun résultat" />
                  </View>
                )}

                {/* Section Utilisateurs */}
                {sectionTitle('Utilisateurs')}
                {users && users.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E0DA',
                      overflow: 'hidden',
                    }}
                  >
                    {users.map((u, i) => {
                      const alreadySent = sentIds.has(u.id);
                      return (
                        <View
                          key={u.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            gap: 12,
                            borderTopWidth: i > 0 ? 1 : 0,
                            borderTopColor: '#E2E0DA',
                          }}
                        >
                          {/* Avatar */}
                          <TouchableOpacity onPress={() => { onClose(); router.push(`/(app)/profile/${u.id}` as any); }}>
                            {u.avatar_url ? (
                              <Image source={{ uri: u.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                            ) : (
                              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF5C1A24', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF5C1A' }}>
                                  {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          {/* Name */}
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => { onClose(); router.push(`/(app)/profile/${u.id}` as any); }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1A17' }}>{u.name}</Text>
                          </TouchableOpacity>

                          {/* Add friend button */}
                          {alreadySent ? (
                            <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E2E0DA' }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B6963' }}>Envoy\u00e9</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  const { error } = await supabase.from('friendships').insert({
                                    requester_id: userId,
                                    addressee_id: u.id,
                                    status: 'pending',
                                  });
                                  if (error) throw error;
                                  setSentIds((prev) => new Set([...prev, u.id]));
                                } catch {
                                  showAlert('Erreur', 'Impossible d\'envoyer la demande');
                                }
                              }}
                              style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#FF5C1A18', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Ionicons name="person-add-outline" size={16} color="#FF5C1A" />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ height: 80 }}>
                    <EmptyState variant="no-results" title="Aucun résultat" />
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

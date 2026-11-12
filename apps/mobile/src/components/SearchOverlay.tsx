import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { supabase, sessionManager } from '../lib/supabase';
import FriendRelationButton from '@ziko/plugin-community/components/FriendRelationButton';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@ziko/ui';
import {
  formatDateFr, goalLabel, exerciseDisplayName, exerciseNames,
  searchUsersWithStatus, sendFriendRequestRpc, requestSentToast, requestFailedBanner, normalizeRelation,
  type FriendRelation,
} from '@ziko/plugin-sdk';

// ── Main component ─────────────────────────────────────────

export function SearchOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  // Etat optimiste par utilisateur : meme notion d'amitie que l'ecran Amis et le profil (SOC-04)
  const [overrides, setOverrides] = useState<Record<string, { relation: FriendRelation; friendship_id?: string | null }>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [sendFailed, setSendFailed] = useState<{ id: string; name: string | null; title: string; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setOverrides({});
      setToast(null);
      setSendFailed(null);
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Section 1 — Exercises
  const { data: exercises, isLoading: loadingExercises } = useQuery({
    queryKey: ['search_exercises', debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ziko_exercises')
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
        .from('ziko_ai_generated_programs')
        .select('id, goal, created_at')
        .eq('user_id', userId)
        .ilike('goal', `%${debouncedQuery}%`)
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: debouncedQuery.length >= 2 && !!userId,
  });

  // Section 3 — Users (RPC serveur : accent-insensible, 2 caracteres min, etat de relation calcule avec auth.uid())
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['search_users', userId, debouncedQuery],
    queryFn: async () => {
      if (!userId) return [];
      return searchUsersWithStatus(supabase, debouncedQuery.trim(), 5);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 0,
  });

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const setBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });

  // Envoi : optimiste, rollback + bandeau precis en cas d'echec (aucun etat faux)
  const addFriend = async (u: { id: string; name: string | null }) => {
    setSendFailed(null);
    setBusy(u.id, true);
    setOverrides((p) => ({ ...p, [u.id]: { relation: 'sent' } }));
    const out = await sendFriendRequestRpc(supabase, u.id, { requireUser: () => sessionManager.requireUser() });
    setBusy(u.id, false);
    if (out.ok) {
      setOverrides((p) => ({ ...p, [u.id]: { relation: out.relation, friendship_id: out.friendshipId } }));
      showToast(out.autoAccepted ? `Tu es maintenant ami avec ${u.name ?? 'cet utilisateur'}` : requestSentToast(u.name));
    } else {
      setOverrides((p) => { const n = { ...p }; delete n[u.id]; return n; });
      const std = requestFailedBanner(u.name);
      setSendFailed({ id: u.id, name: u.name, title: std.title, message: out.reason === 'network' || out.reason === 'unknown' ? std.message : out.message });
    }
  };

  const cancelRequest = async (u: { id: string }, friendshipId: string | null | undefined) => {
    if (!friendshipId) return;
    setBusy(u.id, true);
    const { error } = await supabase.from('ziko_friendships').delete().eq('id', friendshipId);
    setBusy(u.id, false);
    if (!error) setOverrides((p) => ({ ...p, [u.id]: { relation: 'none' } }));
    else showToast('Action impossible. Vérifie ta connexion puis réessaie.');
  };

  const acceptRequest = async (u: { id: string; name: string | null }, friendshipId: string | null | undefined) => {
    if (!friendshipId) return;
    setBusy(u.id, true);
    const { data, error } = await supabase.from('ziko_friendships').update({ status: 'accepted' }).eq('id', friendshipId).select('id');
    setBusy(u.id, false);
    if (!error && (data ?? []).length > 0) {
      setOverrides((p) => ({ ...p, [u.id]: { relation: 'friend', friendship_id: friendshipId } }));
      showToast(`Tu es maintenant ami avec ${u.name ?? 'cet utilisateur'}`);
    } else showToast('Action impossible. Vérifie ta connexion puis réessaie.');
  };

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
                            {exerciseDisplayName(ex.name, (ex as any).name_fr, exerciseNames)}
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
                            {goalLabel(prog.goal)}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 1 }}>
                            {formatDateFr(new Date(prog.created_at))}
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
                {sendFailed ? (
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#FBE9E7', flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="alert-circle" size={20} color="#B3261E" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: '#7A1A14' }}>{sendFailed.title}</Text>
                        <Text style={{ color: '#7A1A14', marginTop: 2 }}>{sendFailed.message}</Text>
                        <TouchableOpacity onPress={() => addFriend({ id: sendFailed.id, name: sendFailed.name })} style={{ marginTop: 8, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <Ionicons name="refresh" size={16} color="#7A1A14" />
                          <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Réessayer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : null}
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
                      const rel = overrides[u.id]?.relation ?? normalizeRelation(u.relation);
                      const fid = overrides[u.id]?.friendship_id ?? u.friendship_id;
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
                          {/* Avatar = initiales (jamais de photo) */}
                          <TouchableOpacity
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            onPress={() => { onClose(); router.push(`/(app)/profile/${u.id}` as any); }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0EFE9', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1A17' }}>
                                {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* Name */}
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => { onClose(); router.push(`/(app)/profile/${u.id}` as any); }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1A17' }}>{u.name}</Text>
                            {u.handle ? <Text style={{ fontSize: 11, color: '#6B6963', marginTop: 1 }}>@{u.handle}</Text> : null}
                          </TouchableOpacity>

                          {/* Bouton d'etat unique : identique a l'ecran Amis et au profil */}
                          <FriendRelationButton
                            relation={rel}
                            name={u.name}
                            busy={busyIds.has(u.id)}
                            onAdd={() => addFriend(u)}
                            onCancel={() => cancelRequest(u, fid)}
                            onAccept={() => acceptRequest(u, fid)}
                          />
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
        {toast ? (
          <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={{
              position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 24, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
              backgroundColor: '#1C1A17', flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#8EDBA9" />
            <Text style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  useThemeStore, formatDateFr, goalLabel, getActionPrimary,
  shouldSearch, resultCountLabel, requestSentToast, requestFailedBanner, initialsOf,
  SEARCH_DEBOUNCE_MS, normalizeRelation,
  type FriendRelation, type FriendSearchResult, type FriendshipEntry,
} from '@ziko/plugin-sdk';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useCommunityStore, loadCommunity, searchUsers,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, cancelFriendRequest,
} from '../store';
import FriendRelationButton from '../components/FriendRelationButton';

// Avatar = initiales sur fond neutre (jamais de photo, contrat lot D)
function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#F0EFE9', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: size * 0.36 }}>{initialsOf(name)}</Text>
    </View>
  );
}

type Tab = 'friends' | 'pending';

interface Override { relation: FriendRelation; friendship_id?: string | null }

interface FailedSend { user: { id: string; name: string | null }; title: string; message: string }

export default function FriendsScreen({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const {
    friends, receivedRequests, sentRequests, friendsLoadFailed, isLoading,
  } = useCommunityStore();
  const [tab, setTab] = useState<Tab>('friends');

  // Recherche en direct (D-01) : debounce 250 ms, 2 caracteres minimum, aucun bouton "Rechercher"
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<FriendSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const seq = useRef(0);

  // Etat optimiste par utilisateur (une seule notion d'amitie : voir friendRelation)
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<FailedSend | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => loadCommunity(supabase), [supabase]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    const mine = ++seq.current;
    setSearching(true);
    setSearchError(false);
    try {
      const rows = await searchUsers(supabase, q);
      if (mine !== seq.current) return;
      setResults(rows);
      setOverrides({});
    } catch {
      if (mine !== seq.current) return;
      setResults(null);
      setSearchError(true);
    } finally {
      if (mine === seq.current) setSearching(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!shouldSearch(debounced)) {
      seq.current++;
      setResults(null);
      setSearching(false);
      setSearchError(false);
      return;
    }
    runSearch(debounced);
  }, [debounced, runSearch]);

  // Effacer / < 2 caracteres : la liste d'amis revient aussitot
  const liveActive = shouldSearch(query);
  const clearQuery = () => { setQuery(''); setDebounced(''); setResults(null); setFailed(null); };

  const setBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });

  const relationOf = (u: FriendSearchResult): FriendRelation => overrides[u.id]?.relation ?? normalizeRelation(u.relation);
  const friendshipIdOf = (u: FriendSearchResult): string | null =>
    overrides[u.id]?.friendship_id ?? u.friendship_id
    ?? receivedRequests.find((r) => r.other_id === u.id)?.friendship_id
    ?? sentRequests.find((r) => r.other_id === u.id)?.friendship_id
    ?? null;

  const handleAdd = async (u: { id: string; name: string | null }) => {
    setFailed(null);
    setBusy(u.id, true);
    setOverrides((p) => ({ ...p, [u.id]: { relation: 'sent' } })); // optimiste
    const out = await sendFriendRequest(supabase, u.id);
    setBusy(u.id, false);
    if (out.ok) {
      setOverrides((p) => ({ ...p, [u.id]: { relation: out.relation, friendship_id: out.friendshipId } }));
      showToast(out.autoAccepted ? `Tu es maintenant ami avec ${u.name ?? 'cet utilisateur'}` : requestSentToast(u.name));
      load();
    } else {
      // rollback : la ligne revient a Ajouter, aucun etat faux (AM-4)
      setOverrides((p) => { const n = { ...p }; delete n[u.id]; return n; });
      const std = requestFailedBanner(u.name);
      setFailed({
        user: u,
        title: std.title,
        message: out.reason === 'network' || out.reason === 'unknown' ? std.message : out.message,
      });
    }
  };

  const handleAcceptFrom = async (otherId: string, friendshipId: string | null, name: string | null) => {
    if (!friendshipId) return;
    setBusy(otherId, true);
    const res = await acceptFriendRequest(supabase, friendshipId);
    setBusy(otherId, false);
    if (res.ok) {
      setOverrides((p) => ({ ...p, [otherId]: { relation: 'friend', friendship_id: friendshipId } }));
      showToast(`Tu es maintenant ami avec ${name ?? 'cet utilisateur'}`);
      load();
    } else {
      showToast(res.message ?? 'Action impossible.');
    }
  };

  const handleDeclineFrom = async (otherId: string, friendshipId: string | null) => {
    if (!friendshipId) return;
    setBusy(otherId, true);
    const res = await declineFriendRequest(supabase, friendshipId);
    setBusy(otherId, false);
    if (res.ok) { setOverrides((p) => ({ ...p, [otherId]: { relation: 'none' } })); load(); }
    else showToast(res.message ?? 'Action impossible.');
  };

  const handleCancelFrom = async (otherId: string, friendshipId: string | null) => {
    if (!friendshipId) return;
    setBusy(otherId, true);
    const res = await cancelFriendRequest(supabase, friendshipId);
    setBusy(otherId, false);
    if (res.ok) { setOverrides((p) => ({ ...p, [otherId]: { relation: 'none' } })); load(); }
    else showToast(res.message ?? 'Action impossible.');
  };

  const openProfile = (id: string) => router.push(`/(app)/profile/${id}` as any);
  const openInvite = () => router.push('/(app)/(plugins)/community/invite?tab=invite' as any);

  const subtitleOf = (e: { level?: number | null; goal?: string | null }) => {
    const parts: string[] = [];
    if (e.level != null) parts.push(`Niveau ${e.level}`);
    if (e.goal) parts.push(goalLabel(e.goal));
    return parts.join(' · ');
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'friends', label: 'Amis', count: friends.length },
    { key: 'pending', label: 'En attente', count: receivedRequests.length }, // badge = reçues (D-03)
  ];

  const card = {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    overflow: 'hidden' as const,
  };

  const Row = ({ onPress, children, minHeight = 68 }: { onPress?: () => void; children: React.ReactNode; minHeight?: number }) => (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight }}
    >
      {children}
    </TouchableOpacity>
  );

  const SectionTitle = ({ label, count }: { label: string; count: number }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
      <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: theme.muted }}>{count}</Text>
    </View>
  );

  const Empty = ({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) => (
    <View style={{ ...card, padding: 24, alignItems: 'center', marginTop: 24 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0EFE9', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={26} color={theme.muted} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 12, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, color: theme.muted, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>{body}</Text>
      {action}
    </View>
  );

  const renderResults = () => {
    if (searching && results === null) {
      return (
        <View style={{ ...card, marginTop: 12 }} accessibilityLabel="Recherche en cours">
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 72, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EFE9' }} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: '#F0EFE9' }} />
                <View style={{ height: 10, width: '35%', borderRadius: 5, backgroundColor: '#F0EFE9' }} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (searchError) {
      return (
        <View style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#FBE9E7', flexDirection: 'row', gap: 10 }}>
          <Ionicons name="alert-circle" size={20} color="#B3261E" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Recherche indisponible</Text>
            <Text style={{ color: '#7A1A14', marginTop: 2 }}>Vérifie ta connexion puis réessaie.</Text>
            <TouchableOpacity onPress={() => runSearch(query.trim())} style={{ marginTop: 10, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Ionicons name="refresh" size={16} color="#7A1A14" />
              <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    if (results === null) return null;
    if (results.length === 0) {
      return (
        <Empty
          icon="search"
          title={`Personne ne s'appelle « ${query.trim()} »`}
          body="Vérifie l'orthographe, ou cherche avec le pseudo exact de ton ami."
        />
      );
    }
    return (
      <>
        <Text style={{ fontSize: 13, color: theme.muted, marginTop: 12, marginBottom: 8 }}>{resultCountLabel(results.length)}</Text>
        <View style={card}>
          {results.map((u, i) => {
            const rel = relationOf(u);
            const fid = friendshipIdOf(u);
            return (
              <View key={u.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                <Row minHeight={72} onPress={() => openProfile(u.id)}>
                  <Avatar name={u.name} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{u.name || 'Utilisateur'}</Text>
                    {u.handle ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>@{u.handle}</Text> : null}
                  </View>
                  <FriendRelationButton
                    relation={rel}
                    name={u.name}
                    busy={busyIds.has(u.id)}
                    onAdd={() => handleAdd(u)}
                    onAccept={() => handleAcceptFrom(u.id, fid, u.name)}
                    onDecline={() => handleDeclineFrom(u.id, fid)}
                    onCancel={() => handleCancelFrom(u.id, fid)}
                  />
                </Row>
              </View>
            );
          })}
        </View>
        {failed ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ padding: 14, borderRadius: 12, backgroundColor: '#FBE9E7', flexDirection: 'row', gap: 10 }}>
              <Ionicons name="alert-circle" size={20} color="#B3261E" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: '#7A1A14' }}>{failed.title}</Text>
                <Text style={{ color: '#7A1A14', marginTop: 2 }}>{failed.message}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleAdd(failed.user)}
              accessibilityRole="button"
              style={{
                marginTop: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
                backgroundColor: theme.surface, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="refresh" size={16} color={theme.text} />
              <Text style={{ fontWeight: '700', color: theme.text }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

  const requestWhen = (e: FriendshipEntry) =>
    e.created_at ? formatDateFr(new Date(e.created_at), { day: 'numeric', month: 'short' }) : '';
  const requestSub = (e: FriendshipEntry) => [e.handle ? `@${e.handle}` : null, requestWhen(e)].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Barre de titre : person-add ouvre le partage du lien (D07), pas une autre recherche */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}>Amis</Text>
        <TouchableOpacity onPress={openInvite} accessibilityRole="button" accessibilityLabel="Partager mon lien d'invitation" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="person-add" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.primary} />}
      >
        {/* Champ de recherche : 1re ligne sous le titre, en direct */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
          paddingHorizontal: 14, height: 48,
        }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un pseudo ou un nom"
            placeholderTextColor={theme.muted}
            accessibilityLabel="Rechercher un pseudo ou un nom"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: theme.text }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} accessibilityRole="button" accessibilityLabel="Effacer la recherche" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>

        {liveActive ? renderResults() : (
          <>
            {/* Onglets : badge d'En attente = nombre de demandes recues */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      height: 40, paddingHorizontal: 16, borderRadius: 20,
                      backgroundColor: active ? theme.text : theme.surface,
                      borderWidth: 1, borderColor: active ? theme.text : theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>{t.label}</Text>
                    {t.count > 0 && (
                      <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? theme.surface : getActionPrimary(theme) }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: active ? theme.text : '#FFFFFF' }}>{t.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {friendsLoadFailed && (
              <View style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#FBE9E7', flexDirection: 'row', gap: 10 }}>
                <Ionicons name="alert-circle" size={20} color="#B3261E" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Amis indisponibles</Text>
                  <Text style={{ color: '#7A1A14', marginTop: 2 }}>Vérifie ta connexion puis réessaie.</Text>
                  <TouchableOpacity onPress={load} style={{ marginTop: 10, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Ionicons name="refresh" size={16} color="#7A1A14" />
                    <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {tab === 'friends' && !friendsLoadFailed && (
              friends.length === 0 ? (
                <Empty
                  icon="people"
                  title="Pas encore d'amis"
                  body="Tape un pseudo dans la recherche, ou partage ton lien pour qu'un ami te trouve."
                  action={
                    <TouchableOpacity
                      onPress={openInvite}
                      accessibilityRole="button"
                      style={{ marginTop: 16, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: getActionPrimary(theme), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                    >
                      <Ionicons name="share-social" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Partager mon lien</Text>
                    </TouchableOpacity>
                  }
                />
              ) : (
                <View style={{ ...card, marginTop: 12 }}>
                  {friends.map((f, i) => (
                    <View key={f.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                      <Row onPress={() => openProfile(f.id)}>
                        <Avatar name={f.name} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{f.name || 'Ami'}</Text>
                          {subtitleOf(f) ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{subtitleOf(f)}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                      </Row>
                    </View>
                  ))}
                </View>
              )
            )}

            {tab === 'pending' && (
              <>
                <SectionTitle label="Reçues" count={receivedRequests.length} />
                {receivedRequests.length === 0 ? (
                  <View style={{ ...card, padding: 16 }}><Text style={{ fontSize: 13, color: theme.muted }}>Aucune demande reçue.</Text></View>
                ) : (
                  <View style={card}>
                    {receivedRequests.map((e, i) => (
                      <View key={e.friendship_id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                        <Row onPress={() => openProfile(e.other_id)} minHeight={88}>
                          <Avatar name={e.name} />
                          <View style={{ flex: 1, gap: 8 }}>
                            <View>
                              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{e.name || 'Utilisateur'}</Text>
                              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{requestSub(e)}</Text>
                            </View>
                            <FriendRelationButton
                              relation="received"
                              name={e.name}
                              busy={busyIds.has(e.other_id)}
                              onAccept={() => handleAcceptFrom(e.other_id, e.friendship_id, e.name)}
                              onDecline={() => handleDeclineFrom(e.other_id, e.friendship_id)}
                            />
                          </View>
                        </Row>
                      </View>
                    ))}
                  </View>
                )}

                <SectionTitle label="Envoyées" count={sentRequests.length} />
                {sentRequests.length === 0 ? (
                  <View style={{ ...card, padding: 16 }}>
                    <Text style={{ fontSize: 13, color: theme.muted }}>Aucune demande en cours. Cherche un ami par son pseudo.</Text>
                  </View>
                ) : (
                  <View style={card}>
                    {sentRequests.map((e, i) => (
                      <View key={e.friendship_id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                        <Row onPress={() => openProfile(e.other_id)} minHeight={72}>
                          <Avatar name={e.name} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{e.name || 'Utilisateur'}</Text>
                            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{requestSub(e)}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleCancelFrom(e.other_id, e.friendship_id)}
                            disabled={busyIds.has(e.other_id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Annuler la demande envoyée à ${e.name || 'cet utilisateur'}`}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Annuler</Text>
                          </TouchableOpacity>
                        </Row>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {toast ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', left: 20, right: 20, bottom: 100, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
            backgroundColor: '#1C1A17', flexDirection: 'row', alignItems: 'center', gap: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#8EDBA9" />
          <Text style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}>{toast}</Text>
        </View>
      ) : null}
      {searching && results !== null ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 70, right: 28 }}>
          <ActivityIndicator size="small" color={theme.muted} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

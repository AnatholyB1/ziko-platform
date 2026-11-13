import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useThemeStore, showAlert, getActionPrimary, goalLabel, exerciseDisplayName, exerciseNames, formatDateFr,
  fetchPublicProfile, sendFriendRequestRpc, normalizeRelation, relationView,
  profileGoalText, xpToNextLabel, levelProgress, initialsOf, streakLabel, relativeDayLabel, daysLeftLabel,
  requestSentToast, requestFailedBanner,
  type PublicProfile, type FriendRelation,
} from '@ziko/plugin-sdk';
import FriendRelationButton from '@ziko/plugin-community/components/FriendRelationButton';
import { getOrCreateDMConversation, acceptFriendRequest, declineFriendRequest, cancelFriendRequest, removeFriend } from '@ziko/plugin-community/store';
import { supabase, sessionManager } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import PrivateProfileNotice from '../../../src/components/PrivateProfileNotice';

// Profil public (P21, SOC-04/06/07/08). Donnees : RPC ziko_get_public_profile (bornee au contrat,
// jamais de sante / poids). Un profil qui ne charge pas affiche la carte D14, jamais un contenu partiel.

const NEUTRAL = '#F0EFE9';
const BADGE_INITIAL_COUNT = 4;
const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

type LoadState = 'loading' | 'error' | 'ready';

export default function PublicProfileScreen() {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useAuthStore((s) => s.user);

  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relation, setRelation] = useState<FriendRelation>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ title: string; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const apply = (p: PublicProfile) => {
    setProfile(p);
    setRelation(p.relation === 'self' ? 'none' : normalizeRelation(p.relation));
    setFriendshipId(p.friendship_id);
  };

  const fetchProfile = useCallback(async (id: string, silent = false) => {
    const mine = ++seq.current;
    if (!silent) setState('loading');
    try {
      const p = await fetchPublicProfile(supabase, id);
      if (mine !== seq.current) return;
      if (!p) { setProfile(null); setState('error'); return; }
      apply(p);
      setState('ready');
    } catch {
      if (mine !== seq.current) return;
      // hors-ligne / erreur serveur : D14, aucun contenu partiel faux (silent = on garde l'ecran actuel)
      if (!silent) { setProfile(null); setState('error'); }
    }
  }, []);

  // Son propre profil : l'ecran de profil perso
  useEffect(() => {
    if (userId && me?.id && userId === me.id) router.replace('/(app)/profile' as any);
  }, [userId, me?.id]);

  useEffect(() => { if (userId) fetchProfile(userId); }, [userId, fetchProfile]);
  // Re-lecture au retour sur l'ecran (relation modifiee ailleurs : Amis, recherche globale)
  useFocusEffect(useCallback(() => { if (userId && profile) fetchProfile(userId, true); }, [userId, profile?.id, fetchProfile]));

  const name = profile?.name ?? '';
  const view = relationView(relation, name, 'profile');

  const onAdd = async () => {
    if (!profile) return;
    setFailed(null);
    setBusy(true);
    setRelation('sent'); // optimiste
    const out = await sendFriendRequestRpc(supabase, profile.id, { requireUser: () => sessionManager.requireUser() });
    setBusy(false);
    if (out.ok) {
      setRelation(out.relation);
      setFriendshipId(out.friendshipId);
      showToast(out.autoAccepted ? `Tu es maintenant ami avec ${name}` : requestSentToast(name));
      fetchProfile(profile.id, true);
    } else {
      setRelation('none');
      const std = requestFailedBanner(name);
      setFailed({ title: std.title, message: out.reason === 'network' || out.reason === 'unknown' ? std.message : out.message });
    }
  };

  const onAccept = async () => {
    if (!friendshipId) return;
    setBusy(true);
    const res = await acceptFriendRequest(supabase, friendshipId);
    setBusy(false);
    if (res.ok) { setRelation('friend'); showToast(`Tu es maintenant ami avec ${name}`); if (profile) fetchProfile(profile.id, true); }
    else showToast(res.message ?? 'Action impossible.');
  };

  const onDecline = async () => {
    if (!friendshipId) return;
    setBusy(true);
    const res = await declineFriendRequest(supabase, friendshipId);
    setBusy(false);
    if (res.ok) { setRelation('none'); setFriendshipId(null); if (profile) fetchProfile(profile.id, true); }
    else showToast(res.message ?? 'Action impossible.');
  };

  const onCancel = async () => {
    if (!friendshipId) return;
    setBusy(true);
    const res = await cancelFriendRequest(supabase, friendshipId);
    setBusy(false);
    if (res.ok) { setRelation('none'); setFriendshipId(null); if (profile) fetchProfile(profile.id, true); }
    else showToast(res.message ?? 'Action impossible.');
  };

  const onRemove = () => {
    if (!friendshipId) return;
    showAlert('Retirer des amis', `Retirer ${name} de ta liste d'amis ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          const res = await removeFriend(supabase, friendshipId);
          if (res.ok) { setRelation('none'); setFriendshipId(null); if (profile) fetchProfile(profile.id, true); }
          else showToast(res.message ?? 'Action impossible.');
        },
      },
    ]);
  };

  const openChat = async () => {
    if (!profile) return;
    try {
      const convId = await getOrCreateDMConversation(supabase, profile.id);
      router.push(`/(app)/(plugins)/community/conversation?id=${convId}` as any);
    } catch {
      showToast('Message indisponible pour le moment.');
    }
  };

  const card = {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  };

  const BackButton = () => (
    <TouchableOpacity
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={{ position: 'absolute', top: insets.top + 8, left: 12, width: 44, height: 44, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}
    >
      <Ionicons name="chevron-back" size={20} color={theme.text} />
    </TouchableOpacity>
  );

  // ── D14 : profil impossible a charger ──
  if (state === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 64, paddingHorizontal: 20 }}>
        <BackButton />
        <View style={{ ...card, padding: 24, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FBE9E7', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cloud-offline" size={26} color="#B3261E" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 12 }}>Profil indisponible</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
            Impossible de charger ce profil. Vérifie ta connexion puis réessaie.
          </Text>
          <TouchableOpacity
            onPress={() => userId && fetchProfile(userId)}
            accessibilityRole="button"
            style={{ marginTop: 16, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={16} color={theme.text} />
            <Text style={{ fontWeight: '700', color: theme.text }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state === 'loading' || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <BackButton />
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const goalText = profileGoalText(profile.goal);
  const identity = [profile.handle ? `@${profile.handle}` : null, goalText ? `Objectif : ${goalText}` : null].filter(Boolean).join(' · ');
  const xpNext = xpToNextLabel(profile);
  const badgesShown = showAllBadges ? profile.badges : profile.badges.slice(0, BADGE_INITIAL_COUNT);
  const badgeExtra = Math.max(0, profile.badges_total - BADGE_INITIAL_COUNT);
  const tierIcon = (tier: number | null) => (tier != null && tier >= 3 ? 'trophy' : tier === 2 ? 'medal' : 'ribbon');
  const sectionTitle = (label: string) => (
    <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 }}>{label}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Banniere neutre 112 dp (+ zone de statut) : aucun controle n'est coupe, aucune fausse photo */}
        <View style={{ height: 112 + insets.top, backgroundColor: NEUTRAL }} />

        {/* L'avatar chevauche la banniere de 44 dp : overflow visible, avatar au-dessus (zIndex) */}
        <View style={{ paddingHorizontal: 16, marginTop: -44, flexDirection: 'row', alignItems: 'flex-end', gap: 12, zIndex: 2, overflow: 'visible' }}>
          <View
            testID="profile-avatar"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 88, height: 88, borderRadius: 44, backgroundColor: theme.surface, borderWidth: 4, borderColor: theme.background,
              alignItems: 'center', justifyContent: 'center', zIndex: 3, elevation: 4,
            }}
          >
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: NEUTRAL, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 30, color: theme.text }}>{initialsOf(name)}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }} />
          {relation !== 'received' && (
            <View style={{ marginBottom: 6 }}>
              <FriendRelationButton
                testID="profile-relation-button"
                relation={relation}
                name={name}
                context="profile"
                busy={busy}
                onAdd={onAdd}
                onCancel={onCancel}
              />
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ marginTop: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{name}</Text>
            {identity ? <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{identity}</Text> : null}
          </View>

          {relation === 'sent' && (
            <TouchableOpacity onPress={onCancel} disabled={busy} accessibilityRole="button" style={{ marginTop: 6, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: getActionPrimary(theme) }}>Annuler la demande</Text>
            </TouchableOpacity>
          )}

          {relation === 'received' && (
            <>
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#E8F0FB', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="person-add" size={18} color="#1F4E9A" />
                <Text style={{ flex: 1, color: '#1F4E9A', fontSize: 14 }}>{`${name.split(' ')[0]} t'a envoyé une demande d'ami.`}</Text>
              </View>
              <View style={{ marginTop: 12 }}>
                <FriendRelationButton relation="received" name={name} context="profile" busy={busy} onAccept={onAccept} onDecline={onDecline} />
              </View>
            </>
          )}

          {failed ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#FBE9E7', flexDirection: 'row', gap: 10 }}>
                <Ionicons name="alert-circle" size={20} color="#B3261E" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#7A1A14' }}>{failed.title}</Text>
                  <Text style={{ color: '#7A1A14', marginTop: 2 }}>{failed.message}</Text>
                  <TouchableOpacity onPress={onAdd} style={{ marginTop: 8, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Ionicons name="refresh" size={16} color="#7A1A14" />
                    <Text style={{ fontWeight: '700', color: '#7A1A14' }}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {profile.is_private ? (
            <PrivateProfileNotice name={name} />
          ) : (
          <>
          {/* Amis / abonnes (Q-P21c : abonnes = amities acceptees ou le profil est destinataire) */}
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{profile.friends_count}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>amis</Text>
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{profile.followers_count}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>abonnés</Text>
            </View>
          </View>

          {/* Niveau + XP */}
          <View style={{ ...card, padding: 16, marginTop: 16 }}>
            {profile.level != null && profile.xp != null ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{`Niveau ${profile.level}`}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#7A5800' }}>{`${num(profile.xp)} XP`}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: NEUTRAL, marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${Math.round(levelProgress(profile) * 100)}%`, backgroundColor: getActionPrimary(theme) }} />
                </View>
                {xpNext ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>{xpNext}</Text> : null}
              </>
            ) : (
              <Text style={{ fontSize: 13, color: theme.muted }}>Pas encore de niveau.</Text>
            )}
          </View>

          {/* Serie */}
          <View style={{ ...card, padding: 12, paddingHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="flame" size={24} color={theme.primary} />
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{streakLabel(profile.streak)}</Text>
              {profile.streak > 0 ? <Text style={{ fontSize: 12, color: theme.muted }}>de série</Text> : null}
            </View>
          </View>

          {/* Badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Badges</Text>
            {profile.badges_total > BADGE_INITIAL_COUNT && (
              <TouchableOpacity onPress={() => setShowAllBadges((v) => !v)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: getActionPrimary(theme) }}>
                  {showAllBadges ? 'Réduire' : `Voir les ${profile.badges_total}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {profile.badges.length === 0 ? (
            <View style={{ ...card, padding: 16 }}><Text style={{ fontSize: 13, color: theme.muted }}>Aucun badge pour le moment.</Text></View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {badgesShown.map((b) => (
                <View key={b.slug} accessible accessibilityLabel={`Badge ${b.name}`} style={{ width: 64, alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FBF1D6', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={tierIcon(b.tier) as any} size={24} color="#7A5800" />
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{b.name}</Text>
                </View>
              ))}
              {!showAllBadges && badgeExtra > 0 ? <Text style={{ fontSize: 13, color: theme.muted }}>{`+ ${badgeExtra}`}</Text> : null}
            </View>
          )}

          {/* Derniers entrainements */}
          {sectionTitle('Derniers entraînements')}
          {profile.recent_workouts.length === 0 ? (
            <View style={{ ...card, padding: 16 }}><Text style={{ fontSize: 13, color: theme.muted }}>Aucun entraînement terminé.</Text></View>
          ) : (
            <View style={{ ...card, overflow: 'hidden' }}>
              {profile.recent_workouts.map((w, i) => (
                <View key={w.id} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{w.name || 'Séance'}</Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>
                      {[relativeDayLabel(w.started_at), w.duration_min ? `${w.duration_min} min` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {w.total_exercises ? <Text style={{ fontSize: 13, color: theme.muted }}>{`${w.total_exercises} exercice${w.total_exercises > 1 ? 's' : ''}`}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {/* Records */}
          {sectionTitle('Records')}
          {profile.records.length === 0 ? (
            <View style={{ ...card, padding: 16 }}><Text style={{ fontSize: 13, color: theme.muted }}>Aucun record enregistré.</Text></View>
          ) : (
            <View style={{ ...card, overflow: 'hidden' }}>
              {profile.records.map((r, i) => (
                <View key={r.exercise_id} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>
                  <Text style={{ flex: 1, fontSize: 15, color: theme.text }} numberOfLines={1}>{exerciseDisplayName(r.exercise_name, null, exerciseNames)}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{`${String(r.weight_kg).replace('.', ',')} kg`}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Defis en commun (2 max) */}
          {sectionTitle('Défis en commun')}
          {profile.common_challenges.length === 0 ? (
            <View style={{ ...card, padding: 16 }}>
              <Text style={{ fontSize: 13, color: theme.muted }}>Aucun défi en commun. Lance-en un depuis l'onglet Communauté.</Text>
            </View>
          ) : (
            <View style={{ ...card, overflow: 'hidden' }}>
              {profile.common_challenges.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push(`/(app)/(plugins)/community/challenge-detail?id=${c.id}` as any)}
                  style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDEBE2', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trophy" size={20} color={getActionPrimary(theme)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>{c.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{daysLeftLabel(c.end_date) || (c.end_date ? formatDateFr(c.end_date) : '')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          </>
          )}

          {/* Actions d'un ami (deplacees depuis la liste d'amis : Message, Comparer, Cadeau) */}
          {relation === 'friend' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              {[
                { icon: 'chatbubble', label: 'Message', onPress: openChat },
                { icon: 'stats-chart', label: 'Comparer', onPress: () => router.push(`/(app)/(plugins)/community/compare?friendId=${profile.id}` as any) },
                { icon: 'gift', label: 'Cadeau', onPress: () => router.push(`/(app)/(plugins)/community/invite?friendId=${profile.id}&tab=gifts` as any) },
              ].map((a) => (
                <TouchableOpacity
                  key={a.label}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  style={{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={a.icon as any} size={16} color={theme.text} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Retirer des amis : danger, confirmation showAlert */}
          {relation === 'friend' && (
            <TouchableOpacity
              onPress={onRemove}
              accessibilityRole="button"
              style={{ marginTop: 24, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#B3261E', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="person-remove" size={18} color="#B3261E" />
              <Text style={{ fontWeight: '700', color: '#B3261E' }}>Retirer des amis</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Retour DANS la banniere (au-dessus de tout) */}
      <BackButton />

      {toast ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 100, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#1C1A17', flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#8EDBA9" />
          <Text style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

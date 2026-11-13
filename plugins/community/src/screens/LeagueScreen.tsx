import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import {
  ackTransition,
  fetchFactionOverview,
  fetchLeagueState,
  joinFaction,
  listCollective,
  requestLeagueRefresh,
  respondCollective,
  type FactionOverview,
} from '../league/api';
import {
  CelebrationCard,
  CollectiveCard,
  ErrorCard,
  FactionCard,
  LockedCard,
  NoCollective,
  SkeletonCards,
  TrackCard,
  WeekCard,
  type LeagueColors,
} from '../league/cards';
import {
  COPY,
  factionByKey,
  factionChangeState,
  suggestFaction,
  type CollectiveProgress,
  type FactionKey,
  type LeagueState,
} from '../league/rules';

// Ecran Ligue (P26, 26-UI-SPEC) : faction -> piste & palier -> cette semaine -> defis de groupe.
// Le score/palier/piste viennent de la base (ziko_league_sync) ; la transition Habitudes -> Performance est decidee
// cote serveur par l'IA (POST /league/refresh) et celebree ici une seule fois. Aucun classement de personnes.

interface Props {
  supabase: any;
}

type Phase = 'loading' | 'error' | 'ready';

export default function LeagueScreen({ supabase }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const colors: LeagueColors = {
    surface: theme.surface,
    border: theme.border,
    text: theme.text,
    muted: theme.muted,
    primary: theme.primary,
    action: getActionPrimary(theme),
    success: '#2E7D32',
  };

  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<LeagueState | null>(null);
  const [factions, setFactions] = useState<FactionOverview | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [collective, setCollective] = useState<CollectiveProgress[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhase('error'); return; }
    const [lg, fo, prof, col] = await Promise.all([
      fetchLeagueState(supabase, user.id),
      fetchFactionOverview(supabase),
      supabase.from('ziko_user_profiles').select('goal').eq('id', user.id).maybeSingle(),
      listCollective(supabase),
    ]);
    if (!lg.ok) {
      setBanner(null);
      setPhase((p) => (p === 'ready' ? 'ready' : 'error'));
      if (state) setBanner(COPY.offline);
      return;
    }
    setBanner(null);
    setState(lg.state);
    if (fo.ok) setFactions(fo.overview);
    setGoal((prof?.data as { goal?: string } | null)?.goal ?? null);
    if (col.ok) setCollective(col.items);
    setPhase('ready');
    if (lg.state.unlocked) {
      // Porte IA : au plus un appel par jour (plafond serveur), aucun si la personne n'est pas eligible.
      const fresh = await requestLeagueRefresh(supabase);
      if (fresh) { setState(fresh); setCelebrate(true); }
    }
  }, [supabase, state]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const doJoin = async (key: FactionKey) => {
    const res = await joinFaction(supabase, key);
    if (!res.ok) {
      if (res.code === 'faction_cooldown') {
        showAlert('Faction', 'Tu pourras changer de faction un peu plus tard.');
      } else {
        setBanner(COPY.actionFailed);
      }
      return;
    }
    setBanner(null);
    setPicking(false);
    const fo = await fetchFactionOverview(supabase);
    if (fo.ok) setFactions(fo.overview);
    setState((s) => (s ? { ...s, faction: key } : s));
  };

  const onPick = (key: FactionKey) => {
    const f = factionByKey(key);
    showAlert(`Rejoindre ${f?.label ?? ''} ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejoindre', onPress: () => { void doJoin(key); } },
    ]);
  };

  const onChange = () => {
    const ch = factionChangeState(factions?.mine?.can_change_at);
    if (ch.allowed) setPicking(true);
    else showAlert('Faction', ch.message);
  };

  const respond = async (item: CollectiveProgress, accept: boolean) => {
    setBusyId(item.id);
    const res = await respondCollective(supabase, item.id, accept);
    setBusyId(null);
    if (!res.ok) { setBanner(COPY.actionFailed); return; }
    setBanner(null);
    const col = await listCollective(supabase);
    if (col.ok) setCollective(col.items);
  };

  const onContinue = async () => {
    const id = state?.pending_celebration?.id;
    if (!id) return;
    const res = await ackTransition(supabase, id);
    if (res.ok) {
      setCelebrate(false);
      setState((s) => (s ? { ...s, pending_celebration: null } : s));
    } else {
      showAlert(COPY.actionFailed, 'Réessaie dans un instant.');
    }
  };

  const mineKey = (state?.faction ?? factions?.mine?.faction ?? null) as FactionKey | null;
  const showGrid = !mineKey || picking;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>{COPY.title}</Text>
        <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2, marginBottom: 16 }}>{COPY.subtitle}</Text>

        {banner ? (
          <View style={{ backgroundColor: theme.primary + '18', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: theme.text, fontSize: 13 }}>{banner}</Text>
          </View>
        ) : null}

        {phase === 'loading' ? <SkeletonCards c={colors} /> : null}
        {phase === 'error' ? <ErrorCard c={colors} onRetry={() => { setPhase('loading'); void load(); }} /> : null}

        {phase === 'ready' && state && !state.unlocked ? <LockedCard c={colors} /> : null}

        {phase === 'ready' && state?.unlocked ? (
          <View>
            <FactionCard
              c={colors}
              mine={showGrid ? null : mineKey}
              suggested={suggestFaction(goal)}
              memberCount={mineKey ? factions?.counts[mineKey] ?? null : null}
              onPick={onPick}
              onChange={onChange}
            />
            {mineKey || !showGrid ? (
              <View>
                <TrackCard c={colors} state={state} />
                <WeekCard c={colors} state={state} />
              </View>
            ) : (
              <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>{COPY.pickFaction}</Text>
            )}
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 12, marginTop: 4 }}>Défis de groupe</Text>
            {collective.length === 0 ? <NoCollective c={colors} /> : null}
            {collective.map((item) => (
              <CollectiveCard
                key={item.id}
                c={colors}
                item={item}
                busy={busyId === item.id}
                onJoin={() => { void respond(item, true); }}
                onDecline={() => { void respond(item, false); }}
                onLeave={() => { void respond(item, false); }}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={celebrate && !!state?.pending_celebration} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.5)', justifyContent: 'center', padding: 24 }}>
          <CelebrationCard c={colors} reason={state?.pending_celebration?.reason ?? ''} onContinue={() => { void onContinue(); }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

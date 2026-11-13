import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Vibration,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { SubTabs, PluginHeader, ErrorScreen } from '@ziko/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playSound, playCountdownBeep } from '@ziko/sounds';
import {
  TIMER_TABS, type TimerTab, type TimerPresetItem, type Phase,
  rowToPreset, visiblePresets, tabForType, presetSummary, totalDuration, formatTotal, buildPhases, phaseAt,
  duplicateName, toDbPayload, PHASE_LABEL,
} from '../presets';

const TAB_PARAM: Record<TimerTab, string> = { 'Séance': 'seance', Tabata: 'tabata', Intervalle: 'intervalle' };
const TAB_ICON: Record<TimerTab, keyof typeof Ionicons.glyphMap> = {
  'Séance': 'timer-outline',
  Tabata: 'flash',
  Intervalle: 'timer',
};
const EMPTY_TITLE: Record<TimerTab, string> = {
  'Séance': 'Aucun preset de séance',
  Tabata: 'Aucun preset Tabata',
  Intervalle: "Aucun preset d'intervalle",
};
const TEXT_ORANGE = '#B53D05';

const formatClock = (s: number): string =>
  Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0');

interface Session {
  preset: TimerPresetItem;
  phases: Phase[];
  /** Secondes ecoulees cumulees avant la derniere reprise. */
  base: number;
  /** Horloge murale (ms) de la derniere reprise, null si en pause / arrete. */
  resumedAt: number | null;
  startedAt: Date | null;
  finished: boolean;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function TimerPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const action = getActionPrimary(theme);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TimerTab>('Séance');
  const [menuPreset, setMenuPreset] = useState<TimerPresetItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastIndexRef = useRef<number>(-1);
  const lastBeepRef = useRef<number>(-1);

  const { data: userInfo } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = userInfo?.id ?? null;

  // ── Presets de l'utilisateur : aucune valeur de repli (TIMR-03) ───────────
  const { data: presets, isLoading: presetsLoading, isError: presetsError, refetch: presetsRefetch } = useQuery({
    queryKey: ['timer_presets', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TimerPresetItem[]> => {
      const { data, error } = await supabase
        .from('ziko_timer_presets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return visiblePresets((data ?? []).map(rowToPreset));
    },
  });

  const tabPresets = useMemo(
    () => (presets ?? []).filter((p) => tabForType(p.type) === activeTab),
    [presets, activeTab],
  );

  const duplicateMutation = useMutation({
    mutationFn: async (p: TimerPresetItem) => {
      const { error } = await supabase.from('ziko_timer_presets').insert({
        ...toDbPayload({ ...p, name: duplicateName(p.name) }),
        exercises: p.exercises,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timer_presets'] }),
    onError: (err: any) => showAlert('Erreur', err?.message ?? 'Impossible de dupliquer le preset'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: TimerPresetItem) => {
      const { error } = await supabase.from('ziko_timer_presets').delete().eq('id', p.id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      setSession((s) => (s && s.preset.id === p.id ? null : s));
      return queryClient.invalidateQueries({ queryKey: ['timer_presets'] });
    },
    onError: (err: any) => showAlert('Erreur', err?.message ?? 'Impossible de supprimer le preset'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { error } = await supabase.from('ziko_workout_sessions').insert({
        user_id: user.id,
        name: session.preset.name,
        started_at: session.startedAt?.toISOString() ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        notes: `${session.preset.name} — ${session.preset.rounds} round${session.preset.rounds > 1 ? 's' : ''}`,
      });
      if (error) throw error;
    },
    onSuccess: () => showAlert('Séance sauvegardée', 'Ta séance a été enregistrée dans ton historique.'),
    onError: (err: any) => showAlert('Erreur', err.message ?? 'Impossible de sauvegarder la séance'),
  });

  // ── Moteur de decompte : base sur l'horloge murale (G-06) ──────────────────
  const running = !!session && session.resumedAt !== null && !session.finished;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = session
    ? Math.floor(session.base + (session.resumedAt !== null ? (now - session.resumedAt) / 1000 : 0))
    : 0;
  const position = session ? phaseAt(session.phases, elapsed) : null;

  // Fin de sequence + changement de phase (sons / vibration)
  useEffect(() => {
    if (!session || !position || session.finished || session.resumedAt === null) return;
    if (position.done) {
      Vibration.vibrate([0, 400, 200, 400]);
      playSound('complete');
      setSession((s) => (s ? { ...s, finished: true, base: totalDuration(s.preset), resumedAt: null } : s));
      return;
    }
    if (position.index !== lastIndexRef.current) {
      lastIndexRef.current = position.index;
      if (position.index > 0) playSound(position.phase?.kind === 'work' ? 'start' : 'rest');
    }
    if (position.secondsLeft <= 3 && position.secondsLeft !== lastBeepRef.current) {
      lastBeepRef.current = position.secondsLeft;
      playCountdownBeep(position.secondsLeft);
    }
  }, [position?.index, position?.secondsLeft, position?.done, session?.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPreset = useCallback((p: TimerPresetItem) => {
    lastIndexRef.current = -1;
    lastBeepRef.current = -1;
    setSession({ preset: p, phases: buildPhases(p), base: 0, resumedAt: null, startedAt: null, finished: false });
  }, []);

  const handlePlayPause = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      if (s.finished) return { ...s, finished: false, base: 0, resumedAt: Date.now(), startedAt: new Date() };
      if (s.resumedAt !== null) {
        const e = s.base + (Date.now() - s.resumedAt) / 1000;
        playSound('rest');
        return { ...s, base: e, resumedAt: null };
      }
      if (s.startedAt === null) playSound('start');
      return { ...s, resumedAt: Date.now(), startedAt: s.startedAt ?? new Date() };
    });
    setNow(Date.now());
  }, []);

  const handleAdjust = useCallback((delta: number) => {
    // +15 s = plus de temps restant ; -15 s = moins de temps restant
    setSession((s) => {
      if (!s || s.finished) return s;
      const cur = s.base + (s.resumedAt !== null ? (Date.now() - s.resumedAt) / 1000 : 0);
      const next = Math.max(0, cur - delta);
      return { ...s, base: next, resumedAt: s.resumedAt !== null ? Date.now() : null };
    });
    setNow(Date.now());
  }, []);

  const openCreate = () => router.push({ pathname: '/(plugins)/timer/editor', params: { tab: TAB_PARAM[activeTab] } } as any);
  const openEdit = (p: TimerPresetItem) => router.push({ pathname: '/(plugins)/timer/editor', params: { presetId: p.id } } as any);

  const closeMenu = () => {
    setMenuPreset(null);
    setConfirmingDelete(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (presetsLoading || (!userId && !presetsError)) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator size="large" color={action} />
    </View>
  );

  if (presetsError) return (
    <ErrorScreen variant="network" onRetry={presetsRefetch} />
  );

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
  } as const;

  const secondsLeft = position ? position.secondsLeft : 0;
  const phaseLabel = session?.finished ? 'Terminé' : position?.phase ? PHASE_LABEL[position.phase.kind] : 'Prêt';
  const isPlaying = !!session && session.resumedAt !== null && !session.finished;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Timer" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <SubTabs
          tabs={TIMER_TABS}
          active={activeTab}
          onChange={(t) => setActiveTab(t as TimerTab)}
        />

        {/* ── Decompte du preset choisi ─────────────────────────────────── */}
        {session && (
          <View style={{ backgroundColor: '#1C1A17', borderRadius: 20, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, opacity: 0.7, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#FFFAF6', textAlign: 'center' }}>
              {phaseLabel}
            </Text>
            <Text
              accessibilityLabel={`${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} secondes restantes`}
              style={{ fontSize: 64, fontWeight: '900', color: '#FF8A4C', textAlign: 'center', marginTop: 6, fontVariant: ['tabular-nums'] }}
            >
              {formatClock(secondsLeft)}
            </Text>
            <Text style={{ fontSize: 13, color: '#FFFAF6', opacity: 0.75, textAlign: 'center', marginTop: 6 }}>
              {session.preset.name}
              {position?.phase ? ` · Round ${position.phase.round}/${session.preset.rounds} · Série ${position.phase.set}/${session.preset.sets}` : ''}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => handleAdjust(-15)}
                accessibilityRole="button"
                accessibilityLabel="Retirer 15 secondes"
                style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,250,246,0.3)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>-15s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePlayPause}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : session.finished ? 'Relancer' : 'Démarrer'}
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: action, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name={isPlaying ? 'pause' : session.finished ? 'refresh' : 'play'} size={26} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleAdjust(15)}
                accessibilityRole="button"
                accessibilityLabel="Ajouter 15 secondes"
                style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,250,246,0.3)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>+15s</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setSession(null)}
                accessibilityRole="button"
                style={{ paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: '#FFFAF6', opacity: 0.8, fontWeight: '700' }}>Fermer</Text>
              </TouchableOpacity>
              {!isPlaying && session.startedAt !== null && (
                <TouchableOpacity
                  onPress={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  accessibilityRole="button"
                  style={{ paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: 'rgba(255,250,246,0.12)', borderRadius: 12 }}
                >
                  <Text style={{ color: '#FFFAF6', fontWeight: '700' }}>
                    {saveMutation.isPending ? 'Enregistrement…' : 'Sauvegarder comme séance'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Mes presets (onglet courant) ──────────────────────────────── */}
        {tabPresets.length === 0 ? (
          <View style={{ ...cardStyle, alignItems: 'center', padding: 28, marginTop: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name={TAB_ICON[activeTab]} size={30} color={TEXT_ORANGE} />
            </View>
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
              {EMPTY_TITLE[activeTab]}
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', marginTop: 6 }}>
              Crée ton premier preset : effort, repos, séries et rounds.
            </Text>
            <TouchableOpacity
              onPress={openCreate}
              accessibilityRole="button"
              style={{ marginTop: 16, minHeight: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: action, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Nouveau preset</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 }}>
              <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
                Mes presets
              </Text>
              <Text style={{ fontSize: 13, color: theme.muted }}>{tabPresets.length}</Text>
            </View>
            <View style={{ ...cardStyle, overflow: 'hidden' }}>
              {tabPresets.map((p, i) => {
                const selected = session?.preset.id === p.id;
                return (
                  <View
                    key={p.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', minHeight: 80,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                      backgroundColor: selected ? theme.background : theme.surface,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => selectPreset(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${presetSummary(p)}, durée ${formatTotal(totalDuration(p))}. Choisir`}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={TAB_ICON[activeTab]} size={22} color={TEXT_ORANGE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{p.name}</Text>
                        <Text numberOfLines={2} style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{presetSummary(p)}</Text>
                        <Text style={{ fontSize: 13, color: TEXT_ORANGE, fontWeight: '700', marginTop: 2 }}>
                          Durée {formatTotal(totalDuration(p))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setMenuPreset(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`Options de ${p.name}`}
                      style={{ width: 48, height: 80, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={22} color={theme.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {tabPresets.length > 0 && (
        <TouchableOpacity
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel="Nouveau preset"
          style={{
            position: 'absolute', right: 16, bottom: 100, minHeight: 52, paddingHorizontal: 20, borderRadius: 26,
            backgroundColor: action, flexDirection: 'row', alignItems: 'center', gap: 8,
            shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800' }}>Nouveau preset</Text>
        </TouchableOpacity>
      )}

      {/* ── Menu d'un preset (C23) ─────────────────────────────────────── */}
      <Modal visible={!!menuPreset} transparent animationType="slide" onRequestClose={closeMenu}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.4)' }} activeOpacity={1} onPress={closeMenu} accessibilityLabel="Fermer" />
          {menuPreset && (
            <View accessibilityViewIsModal style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Preset</Text>
              <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 }}>{menuPreset.name}</Text>

              {!confirmingDelete ? (
                <>
                  <MenuAction icon="create-outline" label="Modifier" color={theme.text} onPress={() => { const p = menuPreset; closeMenu(); openEdit(p); }} />
                  <MenuAction icon="copy-outline" label="Dupliquer" color={theme.text} onPress={() => { const p = menuPreset; closeMenu(); duplicateMutation.mutate(p); }} />
                  <MenuAction icon="trash-outline" label="Supprimer" color="#B3261E" onPress={() => setConfirmingDelete(true)} />
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FDECEA', marginTop: 8 }}>
                    <Ionicons name="alert-circle" size={22} color="#B3261E" />
                    <Text style={{ flex: 1, fontSize: 15, color: '#1C1A17' }}>Supprimer ce preset ? Cette action est définitive.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={closeMenu}
                      accessibilityRole="button"
                      style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontWeight: '700', color: theme.text }}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { const p = menuPreset; closeMenu(); deleteMutation.mutate(p); }}
                      accessibilityRole="button"
                      style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#B3261E', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontWeight: '700', color: '#fff' }}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuAction({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ fontSize: 16, fontWeight: '600', color }}>{label}</Text>
    </TouchableOpacity>
  );
}

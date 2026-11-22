import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary, useCreditStore, exerciseDisplayName, exerciseNames } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { keyboardAvoidBehavior } from '../../../src/lib/keyboardAvoid';
import { setActiveProgram } from '../../../src/lib/programsService';
import { activationToast } from '../../../src/lib/programs';
import { goToTrainingDashboard, refreshProgramQueries } from '../../../src/lib/workoutNav';
import { neutralToast } from '../../../src/lib/neutralToast';
import {
  ATELIER_COPY,
  QUICK_REQUESTS,
  STARTER_PROMPTS,
  applyEvent,
  buildEditOps,
  classifyHttpStatus,
  contextBanner,
  costLabel,
  creditBarLabel,
  draftSubtitle,
  failTurn,
  initialAtelierState,
  inputDisabled,
  placeholderFor,
  prepareRetry,
  sessionLine,
  sessionTitle,
  startTurn,
  stepValue,
  REST_CHOICES,
  type AtelierExercise,
  type AtelierProgram,
  type AtelierState,
  type ExercisePatch,
  type StepField,
} from '../../../src/lib/atelier';
import { AtelierHttpError, createAtelierClient, type AtelierInfo } from '../../../src/lib/atelierService';
import { PERIOD_COPY, resultsLines, shouldPropose, type RelaunchView } from '../../../src/lib/periodization';
import { createPeriodizationClient } from '../../../src/lib/periodizationService';

// Maquette lot A (A10-A15). Bouton plein = getActionPrimary (#CF4509, AA). Aucun emoji : Ionicons.
const SCRIM = 'rgba(28,26,23,0.45)';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const client = createAtelierClient({
  apiUrl: API_URL,
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

// P24 : relance automatique (ouverte depuis le bandeau de l'onglet Seance ou la suite avec ?relaunch=<id>).
const periodClient = createPeriodizationClient({
  apiUrl: API_URL,
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

interface EditTarget {
  session: number;
  exIndex: number;
}

export default function AtelierScreen() {
  const theme = useThemeStore((s) => s.theme);
  const actionBg = getActionPrimary(theme);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const balanceStore = useCreditStore((s) => s.balance);

  const [state, setState] = useState<AtelierState>(initialAtelierState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [info, setInfo] = useState<AtelierInfo | null>(null);
  const [infoFailed, setInfoFailed] = useState(false);
  const [input, setInput] = useState('');
  const [weekIdx, setWeekIdx] = useState(0);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const { relaunch: relaunchParam } = useLocalSearchParams<{ relaunch?: string }>();
  const [relaunchInfo, setRelaunchInfo] = useState<RelaunchView | null>(null);
  const [relaunchBusy, setRelaunchBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadInfo = useCallback(async () => {
    try {
      setInfo(await client.getInfo());
      setInfoFailed(false);
    } catch {
      setInfoFailed(true);
    }
  }, []);

  // Reprise du dernier brouillon actif (meme conversation) + info (cout reel, solde, contexte connu).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await client.getInfo();
        if (!alive) return;
        setInfo(i);
        let draftId: string | null = i.latest_draft?.id ?? null;
        if (relaunchParam) {
          // P24 : relance. Idempotent cote serveur : si la proposition automatique n'est pas encore faite, elle l'est ici
          // (appel absorbe, aucun credit) ; en cas de plafond/panne le bilan s'affiche et l'utilisateur continue a la main.
          setRelaunchBusy(true);
          try {
            const seq = await periodClient.getSequence();
            const r = seq.relaunch && seq.relaunch.id === relaunchParam ? seq.relaunch : null;
            if (r && alive) {
              setRelaunchInfo(r);
              if (shouldPropose(r)) {
                const p = await periodClient.propose(r.id).catch(() => null);
                // une autre requete (bandeau de l'onglet Seance) peut deja generer : on attend sa fin (~24 s max)
                for (let k = 0; p && p.status === 'pending' && p.skipped === 'busy' && k < 8 && alive; k++) {
                  await new Promise((res) => setTimeout(res, 3000));
                  const again = await periodClient.getSequence().catch(() => null);
                  if (!again?.relaunch || again.relaunch.status !== 'proposing') break;
                }
              }
              if (r.draft_id) draftId = r.draft_id;
            }
          } catch {
            /* on retombe sur le dernier brouillon */
          } finally {
            if (alive) setRelaunchBusy(false);
          }
        }
        if (draftId) {
          const { draft, messages } = await client.getDraft(draftId);
          if (!alive) return;
          setState((s) => ({
            ...s,
            draftId: draft.id,
            draft: draft.program ? { revision: draft.revision, program: draft.program } : null,
            messages: messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m, k) => ({ id: `h${k}`, role: m.role as 'user' | 'assistant', text: m.content, tools: [] })),
          }));
        }
      } catch {
        if (alive) setInfoFailed(true);
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  const balance = info?.balance ?? balanceStore;
  const program: AtelierProgram | null = state.draft?.program ?? null;
  const week = program ? program.weeks[Math.min(weekIdx, program.weeks.length - 1)] : null;

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || inputDisabled(stateRef.current.status)) return;
      setInput('');
      setState((s) => startTurn(s, message));
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        await client.streamTurn({
          message,
          draftId: stateRef.current.draftId,
          signal: ac.signal,
          onEvent: (ev) => setState((s) => applyEvent(s, ev)),
        });
        setState((s) => (s.status === 'streaming' ? { ...s, status: 'idle' } : s));
      } catch (e) {
        const err = e instanceof AtelierHttpError ? e : new AtelierHttpError(0, null);
        if (err.status === -1) {
          // Arret demande : on garde ce qui est deja affiche (A13).
          setState((s) => ({ ...s, status: 'idle' }));
        } else if (classifyHttpStatus(err.status) === 'credits') {
          setState((s) => failTurn(s, 'credits'));
          setInput(message);
          if (err.body?.error === 'insufficient_credits') {
            useCreditStore.getState().showExhaustionSheet({
              balance: err.body.balance ?? 0,
              required: err.body.required ?? 0,
              earned_today: err.body.earned_today ?? [],
              earn_hint: err.body.earn_hint ?? '',
              reset_timestamp: err.body.reset_timestamp ?? '',
            });
          }
        } else {
          setState((s) => failTurn(s, 'error'));
        }
      } finally {
        abortRef.current = null;
        loadInfo();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [loadInfo],
  );

  const retry = () => {
    const r = prepareRetry(stateRef.current);
    if (r.message) {
      setState(r.state);
      send(r.message);
    }
  };

  // ── Edition manuelle (A12) : PATCH sans credit ───────────────────────────────────────
  const applyEdit = async (patch: ExercisePatch, allWeeks: boolean) => {
    const cur = stateRef.current;
    if (!cur.draftId || !cur.draft || !edit) return false;
    try {
      const res = await client.patchDraft(
        cur.draftId,
        cur.draft.revision,
        buildEditOps({ week: (week?.w ?? 1), allWeeks, session: edit.session, index: edit.exIndex, patch }),
      );
      if (res.draft.program) setState((s) => ({ ...s, draft: { revision: res.draft.revision, program: res.draft.program! } }));
      return true;
    } catch (e) {
      if (e instanceof AtelierHttpError && e.status === 409 && e.body?.draft?.program) {
        setState((s) => ({ ...s, draft: { revision: e.body.draft.revision, program: e.body.draft.program } }));
        showAlert('Brouillon mis à jour', "L'IA vient de modifier le programme. Recommence ta modification.");
      } else {
        showAlert('Modification impossible', 'Vérifie ta connexion puis réessaie.');
      }
      return false;
    }
  };

  const save = async () => {
    if (!state.draftId || saving) return;
    setSaving(true);
    try {
      const { program_id } = await client.publishDraft(state.draftId);
      void refreshProgramQueries(queryClient);
      showAlert('Programme enregistré', `« ${program?.name ?? 'Programme'} » est dans ta liste.`, [
        { text: 'Plus tard', style: 'cancel', onPress: () => router.replace('/(app)/workout/programs' as any) },
        {
          text: 'Définir comme programme actif',
          onPress: async () => {
            try {
              await setActiveProgram(supabase as any, 'ai', program_id);
              await refreshProgramQueries(queryClient);
            } catch {
              showAlert('Activation impossible', "Active-le depuis la liste de tes programmes.");
              router.replace('/(app)/workout/programs' as any);
              return;
            }
            // UATN-03 : le tableau de l'onglet Entrainement (« Démarrer la séance d'aujourd'hui »), pas la liste.
            neutralToast(activationToast(program?.name ?? 'Programme'));
            goToTrainingDashboard(router);
          },
        },
      ]);
    } catch {
      showAlert('Enregistrement impossible', 'Ton brouillon est conservé. Vérifie ta connexion puis réessaie.');
    } finally {
      setSaving(false);
    }
  };

  // ── Petits composants ────────────────────────────────────────────────────────────────
  const Chip = ({ children, onPress, active }: { children: React.ReactNode; onPress?: () => void; active?: boolean }) => (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: active ? actionBg : theme.border, backgroundColor: active ? '#FFF1EA' : theme.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {children}
    </TouchableOpacity>
  );

  const toolIcon = (name: string) => (name === 'workshop_web_search' ? 'globe-outline' : name === 'workshop_load_skill' || name === 'workshop_list_skills' ? 'library-outline' : name.startsWith('workshop_edit') || name === 'workshop_set_draft' ? 'create-outline' : 'person-outline');

  const renderMessage = (m: AtelierState['messages'][number], isLast: boolean) => {
    if (m.role === 'user') {
      return (
        <View key={m.id} style={{ alignSelf: 'flex-end', marginLeft: 48, backgroundColor: theme.text, borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }}>{m.text}</Text>
        </View>
      );
    }
    return (
      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={16} color={theme.primary} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {m.tools.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {m.tools.map((t) => (
                <View key={t.id} style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: t.state === 'start' ? '#FFD2BC' : theme.border, backgroundColor: t.state === 'start' ? '#FFF1EA' : theme.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {t.state === 'start' ? <Ionicons name="sync" size={14} color={theme.primary} /> : <Ionicons name={toolIcon(t.name) as any} size={14} color={t.state === 'error' ? '#B5301F' : '#2E7D4F'} />}
                  <Text style={{ fontSize: 14, color: theme.text }}>{t.state === 'start' ? `${t.label} en cours…` : t.label}</Text>
                </View>
              ))}
            </View>
          )}
          {m.text.length > 0 && (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 16, lineHeight: 23, color: theme.text }}>
              {m.text}
              {isLast && state.status === 'streaming' ? '▍' : ''}
            </Text>
          )}
          {m.text.length === 0 && m.tools.length === 0 && state.status === 'streaming' && isLast && <ActivityIndicator color={theme.primary} style={{ alignSelf: 'flex-start' }} />}
        </View>
      </View>
    );
  };

  const draftCard = () =>
    program && week ? (
      <View style={{ marginLeft: 42, marginTop: 4, marginBottom: 16, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 4, gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.text }}>{program.name}</Text>
          <View style={{ backgroundColor: '#FFF4D6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#7A5600' }}>{ATELIER_COPY.draftBadge}</Text>
          </View>
        </View>
        <Text style={{ paddingHorizontal: 16, paddingBottom: 8, fontSize: 14, color: theme.muted }}>{draftSubtitle(program)}</Text>
        {program.weeks.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            {program.weeks.map((w, i) => (
              <Chip key={w.w} active={i === weekIdx} onPress={() => setWeekIdx(i)}>
                <Text accessibilityLabel={`Semaine ${w.w}`} style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{`S${w.w}${w.label ? ` · ${w.label}` : ''}`}</Text>
              </Chip>
            ))}
          </ScrollView>
        )}
        {week.sessions.map((s, si) => (
          <View key={`${week.w}-${si}`} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, borderTopWidth: 1, borderTopColor: theme.border }}>
            <View style={{ flex: 1, paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{sessionTitle(s)}</Text>
              <Text numberOfLines={2} style={{ fontSize: 14, color: theme.muted }}>{sessionLine(s)}</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={`Modifier la séance ${s.name}`}
              onPress={() => s.exercises.length > 0 && setEdit({ session: si, exIndex: 0 })}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="pencil" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
          <TouchableOpacity accessibilityLabel="Enregistrer le programme" disabled={saving || state.status === 'streaming'} onPress={save} style={{ height: 48, borderRadius: 14, backgroundColor: actionBg, alignItems: 'center', justifyContent: 'center', opacity: saving || state.status === 'streaming' ? 0.5 : 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{saving ? 'Enregistrement…' : 'Enregistrer le programme'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null;

  const initialView = (
    <View style={{ gap: 12, marginTop: 16 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="sparkles" size={26} color={theme.primary} />
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text }}>{ATELIER_COPY.initialTitle}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: theme.muted }}>{ATELIER_COPY.initialBody}</Text>
      <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{ATELIER_COPY.knows.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {info ? (
          <>
            <Chip><Ionicons name="barbell" size={16} color={theme.text} /><Text style={{ color: theme.text }}>{`${info.context.sessions} séance${info.context.sessions > 1 ? 's' : ''}`}</Text></Chip>
            <Chip><Ionicons name="albums" size={16} color={theme.text} /><Text style={{ color: theme.text }}>{`${info.context.programs} programme${info.context.programs > 1 ? 's' : ''}`}</Text></Chip>
            <Chip><Ionicons name="trophy" size={16} color={theme.text} /><Text style={{ color: theme.text }}>{`${info.context.records} record${info.context.records > 1 ? 's' : ''}`}</Text></Chip>
          </>
        ) : (
          <Text style={{ color: theme.muted }}>{infoFailed ? 'Contexte indisponible pour le moment.' : 'Chargement…'}</Text>
        )}
      </View>
      <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{ATELIER_COPY.start.toUpperCase()}</Text>
      <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        {STARTER_PROMPTS.map((p, i) => (
          <TouchableOpacity key={p.label} onPress={() => send(p.message)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
            <Ionicons name={p.icon as any} size={22} color={theme.primary} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: theme.text }}>{p.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const showInitial = state.messages.length === 0 && !program;
  const disabled = inputDisabled(state.status);
  const streaming = state.status === 'streaming';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <KeyboardAvoidingView behavior={keyboardAvoidBehavior(Platform.OS)} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          <TouchableOpacity accessibilityLabel="Retour" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.text }}>{ATELIER_COPY.title}</Text>
          <View accessibilityLabel={`Solde : ${creditBarLabel(balance ?? 0)}`} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: (balance ?? 1) <= 0 ? '#F0C9C5' : '#FFD2BC', backgroundColor: (balance ?? 1) <= 0 ? '#FBEAE8' : '#FFF1EA', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flash" size={16} color={(balance ?? 1) <= 0 ? '#8F2A21' : theme.primary} />
            <Text style={{ fontWeight: '800', color: (balance ?? 1) <= 0 ? '#8F2A21' : theme.text }}>{balance == null ? '—' : creditBarLabel(balance)}</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {relaunchBusy && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ flex: 1, fontSize: 14, color: theme.muted }}>{PERIOD_COPY.bannerPreparing}</Text>
            </View>
          )}
          {relaunchInfo?.results && (
            <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 16, gap: 6, shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{PERIOD_COPY.resultsTitle.toUpperCase()}</Text>
              {relaunchInfo.program_name ? <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{relaunchInfo.program_name}</Text> : null}
              {resultsLines(relaunchInfo.results).map((l) => (
                <Text key={l} style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>{l}</Text>
              ))}
            </View>
          )}
          {!showInitial && (
            <TouchableOpacity onPress={() => setCtxOpen((v) => !v)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
              <Ionicons name="albums" size={18} color={theme.muted} />
              <Text style={{ flex: 1, fontSize: 14, color: theme.muted }}>{contextBanner(info?.context)}</Text>
              <Ionicons name={ctxOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} />
            </TouchableOpacity>
          )}
          {ctxOpen && info && (
            <Text style={{ marginTop: -8, marginBottom: 16, fontSize: 14, color: theme.muted }}>{`${info.context.records} record${info.context.records > 1 ? 's' : ''} estimé${info.context.records > 1 ? 's' : ''} sur 90 jours, profil, mesures récentes.`}</Text>
          )}
          {showInitial ? initialView : state.messages.map((m, i) => renderMessage(m, i === state.messages.length - 1))}
          {!showInitial && draftCard()}
          {state.status === 'error' && (
            <View style={{ marginLeft: 42, flexDirection: 'row', gap: 10, backgroundColor: '#FBEAE8', borderRadius: 12, borderWidth: 1, borderColor: '#F0C9C5', padding: 12 }}>
              <Ionicons name="cloud-offline" size={20} color="#8F2A21" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontWeight: '800', color: '#8F2A21' }}>{ATELIER_COPY.errorTitle}</Text>
                <Text style={{ color: '#8F2A21' }}>{ATELIER_COPY.errorBody}</Text>
                {state.failedMessage && (
                  <TouchableOpacity onPress={retry} style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="refresh" size={16} color={theme.text} />
                    <Text style={{ fontWeight: '700', color: theme.text }}>{ATELIER_COPY.retry}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 8 }}>
          {state.status === 'credits' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#FFF4D6', borderRadius: 12, padding: 12 }}>
                <Ionicons name="alert-circle" size={20} color="#7A5600" />
                <Text style={{ flex: 1, color: '#5E4300' }}>{ATELIER_COPY.creditsOut}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => useCreditStore.getState().showExhaustionSheet({ balance: balance ?? 0, required: info?.cost ?? 0, earned_today: [], earn_hint: '', reset_timestamp: '' })} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: actionBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{ATELIER_COPY.getCredits}</Text>
                </TouchableOpacity>
                {program && (
                  <TouchableOpacity disabled={saving} onPress={save} style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{ATELIER_COPY.saveDraft}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              {program && !streaming && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {QUICK_REQUESTS.map((q) => (
                    <Chip key={q} onPress={() => send(q)}><Text style={{ fontSize: 14, color: theme.text }}>{q}</Text></Chip>
                  ))}
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  editable={!disabled}
                  placeholder={placeholderFor(state.status, !!program)}
                  placeholderTextColor={theme.muted}
                  multiline
                  maxLength={4000}
                  style={{ flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: disabled ? '#F0EEE9' : '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.text }}
                />
                {streaming ? (
                  <TouchableOpacity accessibilityLabel="Arrêter la réponse" onPress={() => abortRef.current?.abort()} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="stop" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity accessibilityLabel="Envoyer" disabled={!input.trim()} onPress={() => send(input)} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: input.trim() ? actionBg : '#ECEAE4', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-up" size={22} color={input.trim() ? '#FFFFFF' : '#8A877F'} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Cout REEL lu sur le serveur (D-08) : jamais "1 credit par message" en dur. */}
              <Text style={{ textAlign: 'center', fontSize: 14, color: theme.muted }}>{info ? costLabel(info.cost, info.free_left) : ' '}</Text>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {edit && week && week.sessions[edit.session] && (
        <ExerciseSheet
          theme={theme}
          actionBg={actionBg}
          sessionTitleText={sessionTitle(week.sessions[edit.session])}
          weekNumber={week.w}
          exercises={week.sessions[edit.session].exercises}
          initialIndex={edit.exIndex}
          onClose={() => setEdit(null)}
          onSave={async (index, patch, allWeeks) => {
            const ok = await applyEdit(patch, allWeeks).then((r) => r, () => false);
            return ok;
          }}
          onSelectIndex={(i) => setEdit({ ...edit, exIndex: i })}
          onAskAi={(ex) => {
            setEdit(null);
            setInput(`À propos de ${exerciseDisplayName(ex.name, undefined, exerciseNames)} (S${week.w}, ${sessionTitle(week.sessions[edit.session])}) : `);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Stepper({ theme, label, value, onMinus, onPlus, width = 48 }: { theme: any; label: string; value: string; onMinus: () => void; onPlus: () => void; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}>
        <TouchableOpacity accessibilityLabel={`Diminuer ${label}`} onPress={onMinus} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="remove" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ width, textAlign: 'center', fontSize: 18, fontWeight: '800', color: theme.text }}>{value}</Text>
        <TouchableOpacity accessibilityLabel={`Augmenter ${label}`} onPress={onPlus} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ExerciseSheet(props: {
  theme: any;
  actionBg: string;
  sessionTitleText: string;
  weekNumber: number;
  exercises: AtelierExercise[];
  initialIndex: number;
  onClose: () => void;
  onSave: (index: number, patch: ExercisePatch, allWeeks: boolean) => Promise<boolean>;
  onSelectIndex: (i: number) => void;
  onAskAi: (ex: AtelierExercise) => void;
}) {
  const { theme, actionBg } = props;
  const [index, setIndex] = useState(props.initialIndex);
  const ex = props.exercises[index] ?? props.exercises[0];
  const [draft, setDraft] = useState<AtelierExercise>(ex);
  const [allWeeks, setAllWeeks] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(props.exercises[index] ?? props.exercises[0]), [index, props.exercises]);

  const bump = (field: StepField, dir: 1 | -1) => {
    const v = stepValue(field, draft, dir);
    setDraft((d) => ({ ...d, [field]: v }));
  };
  const pick = (i: number) => {
    setIndex(i);
    props.onSelectIndex(i);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <KeyboardAvoidingView behavior={keyboardAvoidBehavior(Platform.OS)} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Fermer" onPress={props.onClose} style={{ flex: 1, backgroundColor: SCRIM, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{props.sessionTitleText.toUpperCase()}</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{draft.name}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Fermer" onPress={props.onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            {props.exercises.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {props.exercises.map((e, i) => (
                  <TouchableOpacity key={`${e.name}-${i}`} onPress={() => pick(i)} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: i === index ? actionBg : theme.border, backgroundColor: i === index ? '#FFF1EA' : theme.surface, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{exerciseDisplayName(e.name, undefined, exerciseNames)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Stepper theme={theme} label="Séries" value={String(draft.sets)} onMinus={() => bump('sets', -1)} onPlus={() => bump('sets', 1)} />
            <Stepper theme={theme} label="Répétitions" value={String(draft.reps)} onMinus={() => bump('reps', -1)} onPlus={() => bump('reps', 1)} />
            <Stepper theme={theme} label="Charge (% du max)" width={56} value={draft.pct_1rm ? String(draft.pct_1rm) : '—'} onMinus={() => bump('pct_1rm', -1)} onPlus={() => bump('pct_1rm', 1)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Repos</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {REST_CHOICES.map((r) => (
                  <TouchableOpacity key={r.seconds} onPress={() => setDraft((d) => ({ ...d, rest_seconds: r.seconds }))} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: draft.rest_seconds === r.seconds ? actionBg : theme.border, backgroundColor: draft.rest_seconds === r.seconds ? '#FFF1EA' : theme.surface, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '700', color: theme.text }}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[false, true].map((all) => (
                <TouchableOpacity key={String(all)} onPress={() => setAllWeeks(all)} style={{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: allWeeks === all ? actionBg : theme.border, backgroundColor: allWeeks === all ? '#FFF1EA' : theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: theme.text }}>{all ? 'Toutes les semaines' : `Semaine ${props.weekNumber}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity onPress={() => props.onAskAi(draft)} style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={16} color={theme.primary} />
                <Text style={{ fontWeight: '800', color: theme.text }}>{ATELIER_COPY.askAi}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const cur = props.exercises[index];
                  const patch: ExercisePatch = {};
                  if (draft.sets !== cur.sets) patch.sets = draft.sets;
                  if (draft.reps !== cur.reps) patch.reps = typeof draft.reps === 'number' ? draft.reps : parseInt(String(draft.reps), 10) || 1;
                  if (draft.pct_1rm !== cur.pct_1rm && draft.pct_1rm) patch.pct_1rm = draft.pct_1rm;
                  if (draft.rest_seconds !== cur.rest_seconds && draft.rest_seconds) patch.rest_seconds = draft.rest_seconds;
                  const ok = Object.keys(patch).length === 0 ? true : await props.onSave(index, patch, allWeeks);
                  setBusy(false);
                  if (ok) props.onClose();
                }}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: actionBg, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{ATELIER_COPY.save}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

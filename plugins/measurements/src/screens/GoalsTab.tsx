import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MEASURES,
  GOAL_MESSAGES,
  getMeasure,
  goalDirection,
  computeGoalProgress,
  remainingToTarget,
  validateGoalDraft,
  parseDecimal,
  formatValue,
  formatShortDate,
  latestPerMeasure,
  currentForGoal,
  type MeasureKey,
  type MeasurementGoalRow,
} from '../lib/goals';
import { describeRevisionChange, reasonLabel, unacknowledged, type GoalRevisionRow } from '../lib/revisions';

const SUCCESS = '#2E7D4F'; // vert texte AA sur blanc
const SUCCESS_BORDER = '#9FD3B4';
const SKELETON = '#ECEAE4';
const DANGER = '#B3261E';

export const GOALS_QUERY_KEY = 'measurement_goals';
export const RECENT_MEASURES_QUERY_KEY = 'measurements_recent_all';

const cardBase = (theme: any) => ({
  backgroundColor: theme.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: theme.border,
  padding: 16,
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
});

// ─── Requêtes ────────────────────────────────────────────────────────────────
export function useMeasurementGoals(supabase: any, userId: string | null) {
  return useQuery({
    queryKey: [GOALS_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MeasurementGoalRow[]> => {
      const { data, error } = await supabase
        .from('ziko_athlete_goals')
        .select('id,user_id,goal_text,measure_key,start_value,target_value,unit,status,start_date,achieved_at,achieved_value,created_at')
        .eq('user_id', userId)
        .not('measure_key', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        ...g,
        start_value: Number(g.start_value),
        target_value: Number(g.target_value),
        achieved_value: g.achieved_value == null ? null : Number(g.achieved_value),
      }));
    },
  });
}

/** v1.20 P16 (MEAS-08) : modifications d'objectif faites par l'IA, non encore acquittees. */
export const REVISIONS_QUERY_KEY = 'measurement_goal_revisions';
export function useGoalRevisions(supabase: any, userId: string | null) {
  return useQuery({
    queryKey: [REVISIONS_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<GoalRevisionRow[]> => {
      const { data, error } = await supabase
        .from('ziko_goal_revisions')
        .select('id,goal_id,measure_key,reason,reason_detail,old_target,new_target,old_target_date,new_target_date,acknowledged_at,created_at')
        .eq('user_id', userId)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, old_target: Number(r.old_target), new_target: Number(r.new_target) }));
    },
  });
}

function RevisionBanner({ revision, unit, onAck, busy }: { revision: GoalRevisionRow; unit: string; onAck: () => void; busy: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      accessibilityRole="alert"
      style={{ ...cardBase(theme), marginBottom: 12, borderColor: theme.primary, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
    >
      <Ionicons name="sparkles-outline" size={22} color="#B53D05" style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Ziko a ajusté ton objectif</Text>
        <Text style={{ fontSize: 15, color: theme.text, marginTop: 4, lineHeight: 22 }}>{describeRevisionChange(revision, unit)}</Text>
        <Text style={{ fontSize: 14, color: theme.muted, marginTop: 4, lineHeight: 20 }}>Raison : {reasonLabel(revision.reason)}</Text>
        <TouchableOpacity
          onPress={onAck}
          disabled={busy}
          accessibilityRole="button"
          style={{ marginTop: 8, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text style={{ color: '#B53D05', fontWeight: '800', fontSize: 15 }}>Compris</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function useRecentMeasures(supabase: any, userId: string | null) {
  return useQuery({
    queryKey: [RECENT_MEASURES_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ziko_body_measurements')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Carte d'objectif ────────────────────────────────────────────────────────
function GoalCard({
  goal,
  rows,
  onPressActive,
  onDefineNext,
}: {
  goal: MeasurementGoalRow;
  rows: any[];
  onPressActive: (g: MeasurementGoalRow, remaining: number) => void;
  onDefineNext: (g: MeasurementGoalRow) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const m = getMeasure(goal.measure_key);
  if (!m) return null;
  const achieved = goal.status === 'achieved';
  const current = currentForGoal(goal, rows);
  const pct = achieved ? 100 : computeGoalProgress(goal.start_value, goal.target_value, current);
  const remaining = remainingToTarget(goal.start_value, goal.target_value, current);
  const dir = goalDirection(goal.start_value, goal.target_value);
  const accent = achieved ? SUCCESS : theme.primary;
  const textAccent = achieved ? SUCCESS : '#B53D05';
  const shown = current ?? goal.start_value;

  return (
    <TouchableOpacity
      activeOpacity={achieved ? 1 : 0.85}
      disabled={achieved}
      onPress={() => onPressActive(goal, remaining)}
      accessibilityRole={achieved ? 'summary' : 'button'}
      accessibilityLabel={`${m.label}, ${achieved ? 'objectif atteint' : 'objectif en cours'}, ${pct} pour cent`}
      style={{ ...cardBase(theme), borderColor: achieved ? SUCCESS_BORDER : theme.border, marginBottom: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: achieved ? '#E6F4EC' : '#FFF0E8',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={m.icon as any} size={22} color={textAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{m.label}</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>
            {`${dir === 'down' ? 'Baisse' : 'Hausse'}, départ ${formatValue(goal.start_value)} ${m.unit}${
              goal.start_date ? ` le ${formatShortDate(goal.start_date)}` : ''
            }`}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: achieved ? '#E6F4EC' : '#FFF0E8',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Ionicons name={achieved ? 'checkmark-circle' : 'lock-closed'} size={12} color={textAccent} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: textAccent, letterSpacing: 0.5 }}>
            {achieved ? 'ATTEINT' : 'EN COURS'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: textAccent }}>{`${pct} %`}</Text>
        {current == null && !achieved ? (
          <Text style={{ fontSize: 14, color: theme.muted }}>Aucune nouvelle mesure</Text>
        ) : (
          <Text style={{ fontSize: 14, color: theme.text }}>
            {`${formatValue(shown)} ${m.unit} ${achieved ? 'pour' : 'vers'} ${formatValue(goal.target_value)} ${m.unit}`}
          </Text>
        )}
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Progression ${m.label}`}
        accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct} pour cent` }}
        style={{ height: 10, borderRadius: 5, backgroundColor: '#ECEAE4', marginTop: 10, overflow: 'hidden' }}
      >
        <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: accent }} />
      </View>

      {achieved ? (
        <>
          <Text style={{ fontSize: 14, color: SUCCESS, fontWeight: '700', marginTop: 10 }}>
            {`Objectif atteint le ${formatShortDate(goal.achieved_at)}. Bravo.`}
          </Text>
          <TouchableOpacity
            onPress={() => onDefineNext(goal)}
            accessibilityRole="button"
            accessibilityLabel="Définir le suivant"
            style={{
              marginTop: 12,
              minHeight: 48,
              borderRadius: 12,
              backgroundColor: getActionPrimary(theme),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Définir le suivant</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Feuille d'information (objectif en cours, E16) ──────────────────────────
function LockedSheet({
  info,
  onClose,
}: {
  info: { goal: MeasurementGoalRow; remaining: number } | null;
  onClose: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const m = info ? getMeasure(info.goal.measure_key) : undefined;
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Fermer"
        style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.4)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 32,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="lock-closed" size={20} color="#B53D05" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Objectif en cours</Text>
          </View>
          {info && m ? (
            <Text style={{ fontSize: 16, color: theme.text, lineHeight: 23 }}>
              {`Tu ne peux pas modifier cet objectif tant qu'il n'est pas atteint. Il te reste ${formatValue(info.remaining)} ${m.unit}.`}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            style={{
              marginTop: 20,
              minHeight: 52,
              borderRadius: 14,
              backgroundColor: getActionPrimary(theme),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Compris</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Création d'un objectif (E13 / E14) ──────────────────────────────────────
const RPC_ERRORS: Record<string, string> = {
  active_goal_exists: 'Tu as déjà un objectif en cours sur cette mesure.',
  out_of_range: 'Cette valeur semble hors de la plage possible.',
  target_equals_start: GOAL_MESSAGES.target_equals_start,
  invalid_measure: 'Mesure inconnue.',
  not_authenticated: 'Session expirée. Reconnecte-toi.',
};

function GoalForm({
  visible,
  initialMeasure,
  supabase,
  userId,
  rows,
  onClose,
}: {
  visible: boolean;
  initialMeasure: MeasureKey | null;
  supabase: any;
  userId: string | null;
  rows: any[];
  onClose: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const latest = useMemo(() => latestPerMeasure(rows), [rows]);

  const [measureKey, setMeasureKey] = useState<MeasureKey | null>(initialMeasure);
  const [startRaw, setStartRaw] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [startTouched, setStartTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Réinitialisation à chaque ouverture.
  React.useEffect(() => {
    if (!visible) return;
    setMeasureKey(initialMeasure);
    setTargetRaw('');
    setServerError(null);
    setStartTouched(false);
    const l = initialMeasure ? latest[initialMeasure] : undefined;
    setStartRaw(l ? formatValue(l.value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialMeasure]);

  const m = getMeasure(measureKey);
  const start = parseDecimal(startRaw);
  const target = parseDecimal(targetRaw);
  const issue = validateGoalDraft({ measureKey, start, target });
  const lastMeasure = measureKey ? latest[measureKey] : undefined;

  const pickMeasure = (k: MeasureKey) => {
    setMeasureKey(k);
    setServerError(null);
    if (!startTouched) {
      const l = latest[k];
      setStartRaw(l ? formatValue(l.value) : '');
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!measureKey || start == null || target == null) throw new Error('Formulaire incomplet');
      const { data, error } = await supabase.rpc('ziko_create_measurement_goal', {
        p_measure_key: measureKey,
        p_start_value: start,
        p_target_value: target,
        p_target_date: null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(RPC_ERRORS[data?.error] ?? "Impossible de créer l'objectif.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOALS_QUERY_KEY] });
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Impossible de créer l'objectif.";
      setServerError(msg);
      showAlert('Erreur', msg);
    },
  });

  // Les erreurs de plage / égalité s'affichent sous le champ concerné une fois qu'il est rempli.
  const targetError =
    target != null && (issue === 'target_equals_start' || issue === 'target_out_of_range') ? GOAL_MESSAGES[issue] : null;
  const startError = start != null && issue === 'start_out_of_range' ? GOAL_MESSAGES.start_out_of_range : null;

  const banner =
    m && start != null && target != null && !issue
      ? target < start
        ? { kind: 'baisse', text: `${formatValue(start - target)} ${m.unit}`, tail: ' à perdre.' }
        : { kind: 'hausse', text: `${formatValue(target - start)} ${m.unit}`, tail: ' à gagner.' }
      : null;

  const inputStyle = (hasError: boolean) => ({
    flex: 1,
    minHeight: 52,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: hasError ? 2 : 1,
    borderColor: hasError ? DANGER : theme.border,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800' as const,
    color: theme.text,
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={26} color={theme.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>Nouvel objectif</Text>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.muted, marginBottom: 8 }}>Mesure</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {MEASURES.map((it) => {
                const sel = it.key === measureKey;
                return (
                  <TouchableOpacity
                    key={it.key}
                    onPress={() => pickMeasure(it.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={`${it.label}${sel ? ', choisi' : ''}`}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      justifyContent: 'center',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: sel ? '#FFF0E8' : theme.surface,
                      borderWidth: sel ? 2 : 1,
                      borderColor: sel ? getActionPrimary(theme) : theme.border,
                    }}
                  >
                    {sel ? <Ionicons name="checkmark" size={16} color="#B53D05" /> : null}
                    <Text style={{ fontSize: 15, fontWeight: '700', color: sel ? '#B53D05' : theme.text }}>{it.chip}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.muted, marginBottom: 6 }}>Point de départ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={startRaw}
                onChangeText={(v) => {
                  setStartTouched(true);
                  setStartRaw(v);
                }}
                keyboardType="decimal-pad"
                accessibilityLabel="Point de départ"
                placeholder="—"
                placeholderTextColor={theme.muted}
                style={inputStyle(!!startError)}
              />
              <Text style={{ width: 36, fontSize: 16, color: theme.muted }}>{m?.unit ?? ''}</Text>
            </View>
            <Text style={{ fontSize: 14, color: startError ? DANGER : theme.muted, marginTop: 6, marginBottom: 16 }}>
              {startError ??
                (lastMeasure
                  ? `Ta dernière mesure${lastMeasure.date ? `, le ${formatShortDate(lastMeasure.date)}` : ''}. Tu peux la corriger.`
                  : m
                    ? 'Aucune mesure enregistrée : saisis ton point de départ.'
                    : 'Choisis une mesure pour pré-remplir ta dernière valeur.')}
            </Text>

            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.muted, marginBottom: 6 }}>Cible</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={targetRaw}
                onChangeText={(v) => {
                  setServerError(null);
                  setTargetRaw(v);
                }}
                keyboardType="decimal-pad"
                accessibilityLabel="Cible"
                placeholder="—"
                placeholderTextColor={theme.muted}
                style={inputStyle(!!targetError)}
              />
              <Text style={{ width: 36, fontSize: 16, color: theme.muted }}>{m?.unit ?? ''}</Text>
            </View>
            {targetError ? (
              <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, color: DANGER, marginTop: 6 }}>
                {targetError}
              </Text>
            ) : null}

            {banner ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: '#FFF0E8',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name={banner.kind === 'baisse' ? 'trending-down' : 'trending-up'} size={18} color="#B53D05" />
                <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>
                  {`Objectif de ${banner.kind} : `}
                  <Text style={{ fontWeight: '800' }}>{banner.text}</Text>
                  {banner.tail}
                </Text>
              </View>
            ) : null}

            {serverError ? (
              <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, color: DANGER, marginTop: 12 }}>
                {serverError}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'flex-start' }}>
              <Ionicons name="lock-closed-outline" size={16} color={theme.muted} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 14, color: theme.muted }}>
                Une fois créé, l'objectif ne peut plus être modifié avant d'être atteint.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!!issue || createMutation.isPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!issue || createMutation.isPending }}
              style={{
                marginTop: 24,
                minHeight: 52,
                borderRadius: 14,
                backgroundColor: getActionPrimary(theme),
                alignItems: 'center',
                justifyContent: 'center',
                opacity: issue || createMutation.isPending ? 0.4 : 1,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
                {createMutation.isPending ? 'Création...' : "Créer l'objectif"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Onglet Objectifs ────────────────────────────────────────────────────────
export default function GoalsTab({ supabase, userId }: { supabase: any; userId: string | null }) {
  const theme = useThemeStore((s) => s.theme);
  const goalsQ = useMeasurementGoals(supabase, userId);
  const rowsQ = useRecentMeasures(supabase, userId);
  const rows = rowsQ.data ?? [];
  const goals = goalsQ.data ?? [];
  const revQ = useGoalRevisions(supabase, userId);
  const queryClient = useQueryClient();
  const ackM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('ziko_ack_goal_revision', { p_revision_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [REVISIONS_QUERY_KEY, userId] }),
  });
  const pendingRevision = unacknowledged(revQ.data ?? [])[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [formMeasure, setFormMeasure] = useState<MeasureKey | null>(null);
  const [locked, setLocked] = useState<{ goal: MeasurementGoalRow; remaining: number } | null>(null);

  const openForm = (m: MeasureKey | null) => {
    setFormMeasure(m);
    setFormOpen(true);
  };

  if (goalsQ.isLoading || rowsQ.isLoading) {
    return (
      <View accessibilityLabel="Chargement des objectifs">
        {[0, 1].map((i) => (
          <View key={i} style={{ height: 132, borderRadius: 16, backgroundColor: SKELETON, marginBottom: 12 }} />
        ))}
      </View>
    );
  }

  if (goalsQ.isError) {
    return (
      <View style={{ ...cardBase(theme), alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
          Impossible de charger tes objectifs
        </Text>
        <TouchableOpacity
          onPress={() => goalsQ.refetch()}
          accessibilityRole="button"
          style={{ marginTop: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}
        >
          <Text style={{ color: '#B53D05', fontWeight: '800', fontSize: 15 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const primaryBtn = (label: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 52,
        borderRadius: 14,
        backgroundColor: getActionPrimary(theme),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {pendingRevision ? (
        <RevisionBanner
          revision={pendingRevision}
          unit={goals.find((g) => g.id === pendingRevision.goal_id)?.unit ?? ''}
          busy={ackM.isPending}
          onAck={() => ackM.mutate(pendingRevision.id)}
        />
      ) : null}
      {goals.length === 0 ? (
        <View style={{ ...cardBase(theme), alignItems: 'center', paddingVertical: 32 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FFF0E8',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="flag-outline" size={30} color="#B53D05" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
            Aucun objectif pour l'instant
          </Text>
          <Text style={{ fontSize: 15, color: theme.muted, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 22 }}>
            Choisis une mesure, un point de départ et une cible. Ziko calcule ta progression en pourcentage.
          </Text>
          {primaryBtn('Définir un objectif', () => openForm(null))}
        </View>
      ) : (
        <>
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              rows={rows}
              onPressActive={(goal, remaining) => setLocked({ goal, remaining })}
              onDefineNext={(goal) => openForm(goal.measure_key)}
            />
          ))}
          <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', marginVertical: 8 }}>
            Un objectif en cours ne se modifie pas. Tu en définis un nouveau quand il est atteint.
          </Text>
          <View style={{ marginTop: 8 }}>{primaryBtn('Ajouter un objectif', () => openForm(null))}</View>
        </>
      )}

      <LockedSheet info={locked} onClose={() => setLocked(null)} />
      <GoalForm
        visible={formOpen}
        initialMeasure={formMeasure}
        supabase={supabase}
        userId={userId}
        rows={rows}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}

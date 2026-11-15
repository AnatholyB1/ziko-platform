import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { PluginHeader, ErrorScreen } from '@ziko/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stepper, NumberSheet } from './Stepper';
import {
  type EditorField, type PresetFields, type TimerTab,
  defaultsForTab, fieldsForTab, formatDurationShort, formatTotal, limitsFor, normalizeForTab,
  rowToPreset, stepField, clampField, tabForType, toDbPayload, totalDuration, validatePreset, LIMITS,
} from '../presets';

const TAB_PARAM: Record<string, TimerTab> = { seance: 'Séance', tabata: 'Tabata', intervalle: 'Intervalle' };

const FIELD_META: Record<EditorField, { label: string; hint?: string; time: boolean }> = {
  warmup_sec: { label: 'Échauffement', hint: 'Avant le premier effort', time: true },
  work_sec: { label: 'Effort', time: true },
  rest_sec: { label: 'Repos', time: true },
  sets: { label: 'Séries par round', time: false },
  rounds: { label: 'Rounds', time: false },
  round_rest_sec: { label: 'Repos entre rounds', time: true },
};

const fieldValueText = (field: EditorField, v: number) =>
  FIELD_META[field].time ? (v === 0 ? 'Aucun' : formatDurationShort(v)) : String(v);

export default function TimerEditor({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ presetId?: string; tab?: string }>();
  const presetId = params.presetId ?? null;
  const action = getActionPrimary(theme);

  const { data: row, isLoading, isError, refetch } = useQuery({
    queryKey: ['timer_preset', presetId],
    enabled: !!presetId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('ziko_timer_presets').select('*').eq('id', presetId).single();
      if (error) throw error;
      return data;
    },
  });

  const initialTab: TimerTab = TAB_PARAM[params.tab ?? ''] ?? 'Intervalle';
  const [tab, setTab] = useState<TimerTab>(initialTab);
  const [values, setValues] = useState<PresetFields>(() => defaultsForTab(initialTab));
  const [loaded, setLoaded] = useState(!presetId);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [editing, setEditing] = useState<EditorField | null>(null);

  useEffect(() => {
    if (row && !loaded) {
      const p = rowToPreset(row);
      setTab(tabForType(p.type));
      setValues(p);
      setLoaded(true);
    }
  }, [row, loaded]);

  const fields = fieldsForTab(tab);
  const check = useMemo(() => validatePreset(values, tab), [values, tab]);
  const total = useMemo(() => totalDuration(normalizeForTab(values, tab)), [values, tab]);

  const setField = (field: EditorField, updater: (prev: number) => number) =>
    setValues((v) => ({ ...v, [field]: updater(v[field]) }));

  const handleSave = async () => {
    setTouched(true);
    if (!check.ok || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const payload = toDbPayload(normalizeForTab(values, tab));
      if (presetId) {
        // `exercises` n'est jamais touche : il est conserve tel quel pour les presets existants.
        const { error } = await supabase.from('ziko_timer_presets').update(payload).eq('id', presetId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ziko_timer_presets').insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['timer_presets'] });
      await queryClient.invalidateQueries({ queryKey: ['timer_preset', presetId] });
      router.back();
    } catch (err: any) {
      showAlert('Erreur', err?.message ?? 'Impossible de sauvegarder le preset');
    } finally {
      setSaving(false);
    }
  };

  if (presetId && isError) return <ErrorScreen variant="network" onRetry={refetch} onGoBack={() => router.back()} />;
  if (presetId && (isLoading || !loaded)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={action} />
      </View>
    );
  }

  const title = presetId ? 'Modifier le preset' : 'Nouveau preset';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 6 }}>Nom</Text>
        <TextInput
          value={values.name}
          onChangeText={(t) => setValues((v) => ({ ...v, name: t }))}
          placeholder="Ex. Côtes 400 m"
          placeholderTextColor={theme.muted}
          maxLength={LIMITS.nameMax}
          accessibilityLabel="Nom du preset"
          style={{
            minHeight: 48, borderRadius: 12, borderWidth: 1.5,
            borderColor: touched && check.errors.name ? '#B3261E' : theme.border,
            backgroundColor: theme.surface, paddingHorizontal: 14, fontSize: 16, color: theme.text,
          }}
        />
        {touched && check.errors.name ? (
          <Text style={{ fontSize: 13, color: '#B3261E', marginTop: 4 }}>{check.errors.name}</Text>
        ) : null}

        <View style={{ marginTop: 12 }}>
          {fields.map((f) => {
            const l = limitsFor(f);
            const v = values[f];
            return (
              <View key={f}>
                <Stepper
                  label={FIELD_META[f].label}
                  hint={FIELD_META[f].hint}
                  valueText={fieldValueText(f, v)}
                  theme={theme}
                  atMin={v <= l.min}
                  atMax={v >= l.max}
                  onStep={(dir, mult) => setField(f, (prev) => stepField(f, prev, dir, mult))}
                  onEditValue={() => setEditing(f)}
                />
                {check.errors[f] ? <Text style={{ fontSize: 13, color: '#B3261E' }}>{check.errors[f]}</Text> : null}
              </View>
            );
          })}
        </View>

        <View
          accessibilityRole="summary"
          style={{
            marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14,
            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
          }}
        >
          <Ionicons name="timer-outline" size={22} color={theme.text} />
          <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>
            Durée totale : <Text style={{ fontWeight: '800' }}>{formatTotal(total)}</Text>
            {fields.includes('warmup_sec') ? ' (échauffement compris).' : '.'}
          </Text>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          style={{ minHeight: 52, borderRadius: 14, backgroundColor: action, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{saving ? 'Enregistrement…' : 'Enregistrer le preset'}</Text>
        </TouchableOpacity>
      </View>

      {editing ? (
        <NumberSheet
          visible
          title={FIELD_META[editing].label}
          unit={FIELD_META[editing].time ? 'secondes' : ''}
          initial={values[editing]}
          min={limitsFor(editing).min}
          max={limitsFor(editing).max}
          theme={theme}
          onClose={() => setEditing(null)}
          onConfirm={(n) => {
            const f = editing;
            setField(f, () => clampField(f, n));
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

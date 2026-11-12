import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';
import {
  CONTEXTS,
  MOODS,
  ENERGY_LEGEND,
  STRESS_LEGEND,
  JOURNAL_TEAL,
  JOURNAL_TEAL_TINT,
  JOURNAL_NEUTRAL_ICON,
  FAILURE_COPY,
  classifySaveError,
  getTodayGeneral,
  saveJournalEntry,
  getDraft,
  setDraft,
  clearDraft,
  localDateKey,
  moodMeta,
  type JournalContext,
  type SaveFailure,
} from '../logic';

export interface JournalAuthProps {
  supabase: any;
  /** Session manager (P2) : utilisateur lu au moment de l'enregistrement. */
  requireUser?: () => Promise<{ id: string }>;
  /** Mene a l'ecran de connexion (bouton « Se reconnecter »). */
  onReauth?: () => void;
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  padding: 16,
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Utilisateur lu a l'instant T (jamais depuis un id mis en cache). */
export async function resolveUser(p: JournalAuthProps): Promise<{ id: string }> {
  if (p.requireUser) return p.requireUser();
  const { data } = await p.supabase.auth.getUser();
  const id = data?.user?.id;
  if (!id) {
    const e = new Error('Session expirée');
    e.name = 'SessionExpiredError';
    throw e;
  }
  return { id };
}

function Scale({
  label,
  icon,
  value,
  onChange,
  legend,
  a11yLabel,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
  legend: { low: string; high: string };
  a11yLabel: string;
}) {
  return (
    <View style={CARD}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name={icon as any} size={20} color={JOURNAL_TEAL} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>{label}</Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const sel = value === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${a11yLabel} ${n} sur 5`}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sel ? JOURNAL_TEAL_TINT : '#FFFFFF',
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? JOURNAL_TEAL : '#E2E0DA',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: sel ? '800' : '600', color: sel ? JOURNAL_TEAL : '#1C1A17' }}>
                {n}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontSize: 14, color: '#6B6963' }}>{legend.low}</Text>
        <Text style={{ fontSize: 14, color: '#6B6963' }}>{legend.high}</Text>
      </View>
    </View>
  );
}

export default function JournalForm({
  supabase,
  requireUser,
  onReauth,
  onSaved,
}: JournalAuthProps & { onSaved?: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const actionColor = getActionPrimary(theme);
  const queryClient = useQueryClient();

  const initial = getDraft();
  const [mood, setMood] = useState<number>(initial?.mood ?? 4);
  const [energy, setEnergy] = useState<number>(initial?.energy ?? 3);
  const [stress, setStress] = useState<number>(initial?.stress ?? 2);
  const [context, setContext] = useState<JournalContext>(initial?.context ?? 'general');
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [saved, setSaved] = useState<'inserted' | 'updated' | null>(null);
  const dirty = useRef<boolean>(initial !== null);
  const today = localDateKey();

  // Entree 'general' du jour (humeur de l'accueil) : pre-selection + « Mettre a jour ».
  const { data: existing } = useQuery({
    queryKey: ['journal_today_general', today],
    queryFn: async () => {
      const user = await resolveUser({ supabase, requireUser });
      return getTodayGeneral(supabase, user.id, today);
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (!existing || dirty.current) return;
    setMood(existing.mood);
    if (existing.energy) setEnergy(existing.energy);
    if (existing.stress) setStress(existing.stress);
    setNotes(existing.notes ?? '');
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(null), 3000);
    return () => clearTimeout(id);
  }, [saved]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  const isUpdate = context === 'general' && !!existing;

  const mutation = useMutation({
    mutationFn: async () => {
      setDraft({ mood, energy, stress, context, notes });
      const user = await resolveUser({ supabase, requireUser });
      return saveJournalEntry(supabase, user.id, { mood, energy, stress, context, notes }, today);
    },
    onSuccess: (kind) => {
      clearDraft();
      dirty.current = false;
      setFailure(null);
      setSaved(kind);
      queryClient.invalidateQueries({ queryKey: ['journal_today_general'] });
      queryClient.invalidateQueries({ queryKey: ['journal_history'] });
      queryClient.invalidateQueries({ queryKey: ['journal_trends'] });
      if (context !== 'general') {
        setNotes('');
      }
      onSaved?.();
    },
    onError: (err: any) => {
      setFailure(classifySaveError(err));
    },
  });

  const submit = () => {
    if (mutation.isPending) return;
    setFailure(null);
    mutation.mutate();
  };

  const buttonLabel = isUpdate ? 'Mettre à jour' : 'Enregistrer';

  return (
    <View style={{ gap: 12 }}>
      {saved && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: JOURNAL_TEAL_TINT, borderRadius: 12, padding: 12 }}
        >
          <Ionicons name="checkmark-circle" size={20} color={JOURNAL_TEAL} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: JOURNAL_TEAL }}>Entrée enregistrée</Text>
        </View>
      )}

      {failure && (
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 14, gap: 10 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle" size={20} color="#B91C1C" />
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#B91C1C' }}>{FAILURE_COPY[failure].title}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#7F1D1D' }}>{FAILURE_COPY[failure].body}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {failure === 'expired' && !!onReauth && (
              <TouchableOpacity
                onPress={onReauth}
                accessibilityRole="button"
                style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Se reconnecter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={submit}
              accessibilityRole="button"
              style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#B91C1C' }}>
                {failure === 'expired' ? "Réessayer l'enregistrement" : 'Réessayer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isUpdate && existing && (
        <View
          accessibilityRole="summary"
          style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: JOURNAL_TEAL_TINT, borderRadius: 12, padding: 12 }}
        >
          <Ionicons name="information-circle" size={20} color={JOURNAL_TEAL} />
          <Text style={{ flex: 1, fontSize: 14, color: '#1C1A17' }}>
            {`Humeur déjà notée aujourd'hui depuis l'accueil : ${moodMeta(existing.mood).label}. Ton enregistrement la met à jour.`}
          </Text>
        </View>
      )}

      {/* Humeur */}
      <View style={CARD}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17', marginBottom: 12 }}>
          Comment tu te sens aujourd'hui ?
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6 }}>
          {MOODS.map((m) => {
            const sel = mood === m.v;
            return (
              <TouchableOpacity
                key={m.v}
                onPress={() => touch(setMood)(m.v)}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={m.label}
                style={{
                  flex: 1,
                  minHeight: 76,
                  paddingVertical: 10,
                  paddingHorizontal: 2,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: sel ? JOURNAL_TEAL_TINT : '#FFFFFF',
                  borderWidth: sel ? 2 : 1,
                  borderColor: sel ? JOURNAL_TEAL : '#E2E0DA',
                }}
              >
                <Ionicons name={m.icon as any} size={28} color={sel ? JOURNAL_TEAL : JOURNAL_NEUTRAL_ICON} />
                <Text
                  style={{ fontSize: 14, fontWeight: sel ? '800' : '500', color: sel ? JOURNAL_TEAL : '#1C1A17', textAlign: 'center' }}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Scale
        label="Niveau d'énergie"
        icon="battery-half"
        value={energy}
        onChange={touch(setEnergy)}
        legend={ENERGY_LEGEND}
        a11yLabel="Énergie"
      />
      <Scale
        label="Niveau de stress"
        icon="pulse"
        value={stress}
        onChange={touch(setStress)}
        legend={STRESS_LEGEND}
        a11yLabel="Stress"
      />

      {/* Moment */}
      <View style={CARD}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17', marginBottom: 10 }}>Moment</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONTEXTS.map((c) => {
            const sel = context === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => touch(setContext)(c.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: sel ? JOURNAL_TEAL_TINT : '#FFFFFF',
                  borderWidth: sel ? 2 : 1,
                  borderColor: sel ? JOURNAL_TEAL : '#E2E0DA',
                }}
              >
                <Ionicons name={c.icon as any} size={16} color={sel ? JOURNAL_TEAL : JOURNAL_NEUTRAL_ICON} />
                <Text style={{ fontSize: 14, fontWeight: sel ? '800' : '500', color: sel ? JOURNAL_TEAL : '#1C1A17' }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Note */}
      <View style={CARD}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17', marginBottom: 10 }}>Note du jour</Text>
        <TextInput
          multiline
          value={notes}
          onChangeText={touch(setNotes)}
          placeholder="Énergie, douleurs, motivation…"
          placeholderTextColor="#6B6963"
          accessibilityLabel="Note du jour"
          style={{ minHeight: 64, fontSize: 15, color: '#1C1A17', textAlignVertical: 'top' }}
        />
      </View>

      <TouchableOpacity
        onPress={submit}
        disabled={mutation.isPending}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        style={{
          backgroundColor: actionColor,
          borderRadius: 14,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
          opacity: mutation.isPending ? 0.7 : 1,
        }}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

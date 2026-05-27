import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

const SUCCESS = '#2E9E5B';
const TABS = ["Aujourd'hui", 'Évolution', 'Objectifs'];

// ─── MiniBars (local) ───────────────────────────────────────────────────────
function MiniBars({
  data,
  color,
  max,
}: {
  data: Array<{ l: string; v: number; today?: boolean }>;
  color: string;
  max?: number;
}) {
  const m = max ?? Math.max(...data.map((d) => d.v), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {data.map((d, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            height: 80,
            gap: 5,
          }}
        >
          <View
            style={{
              width: '100%',
              height: Math.max((d.v / m) * 72, 4),
              backgroundColor: d.today ? color : color + '47',
              borderRadius: 5,
            }}
          />
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: '700',
              color: d.today ? color : '#6B6963',
            }}
          >
            {d.l}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  } catch {
    return dateStr;
  }
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MeasurementsPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("Aujourd'hui");
  const [modalVisible, setModalVisible] = useState(false);

  // Modal form state
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [hip, setHip] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: latestMeasurement } = useQuery({
    queryKey: ['latest_measurement', 'user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(2);
      return data ?? [];
    },
  });

  const latest = latestMeasurement?.[0] ?? null;
  const previous = latestMeasurement?.[1] ?? null;
  const weightDelta =
    latest?.weight_kg != null && previous?.weight_kg != null
      ? parseFloat((latest.weight_kg - previous.weight_kg).toFixed(1))
      : null;

  const { data: measurements6weeks } = useQuery({
    queryKey: ['measurements_6weeks', 'user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const since = new Date();
      since.setDate(since.getDate() - 42);
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: true });
      return data ?? [];
    },
  });

  // Group by week for MiniBars
  const weeklyBars: Array<{ l: string; v: number; today?: boolean }> = (() => {
    if (!measurements6weeks || measurements6weeks.length === 0) {
      return [
        { l: 'S1', v: 0 },
        { l: 'S2', v: 0 },
        { l: 'S3', v: 0 },
        { l: 'S4', v: 0 },
        { l: 'S5', v: 0 },
        { l: 'S6', v: 0 },
      ];
    }
    const weekMap: Record<string, number[]> = {};
    for (const m of measurements6weeks) {
      if (!m.weight_kg) continue;
      const wk = getWeekKey(m.date);
      if (!weekMap[wk]) weekMap[wk] = [];
      weekMap[wk].push(m.weight_kg);
    }
    const weeks = Object.keys(weekMap).sort();
    const currentWeek = getWeekKey(new Date().toISOString());
    return weeks.slice(-6).map((wk, i) => ({
      l: `S${i + 1}`,
      v: parseFloat(
        (weekMap[wk].reduce((a, b) => a + b, 0) / weekMap[wk].length).toFixed(1),
      ),
      today: wk === currentWeek,
    }));
  })();

  // Delta over 6 weeks
  const evolutionDelta =
    measurements6weeks && measurements6weeks.length >= 2
      ? parseFloat(
          (
            measurements6weeks[measurements6weeks.length - 1].weight_kg -
            measurements6weeks[0].weight_kg
          ).toFixed(1),
        )
      : null;

  // ── Mutation ─────────────────────────────────────────────────────────────
  const logMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      if (!weight.trim()) throw new Error('Le poids est requis');
      const weightVal = parseFloat(weight.trim());
      if (isNaN(weightVal) || weightVal <= 0) throw new Error('Poids invalide');
      const payload: Record<string, unknown> = {
        user_id: user.id,
        weight_kg: weightVal,
        date: new Date().toISOString().slice(0, 10),
      };
      if (bodyFat.trim()) payload.body_fat_pct = parseFloat(bodyFat.trim());
      if (waist.trim()) payload.waist_cm = parseFloat(waist.trim());
      if (chest.trim()) payload.chest_cm = parseFloat(chest.trim());
      if (arm.trim()) payload.arm_cm = parseFloat(arm.trim());
      if (thigh.trim()) payload.thigh_cm = parseFloat(thigh.trim());
      if (hip.trim()) payload.hip_cm = parseFloat(hip.trim());
      const { error } = await supabase.from('body_measurements').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest_measurement'] });
      queryClient.invalidateQueries({ queryKey: ['measurements_6weeks'] });
      setModalVisible(false);
      setWeight('');
      setBodyFat('');
      setWaist('');
      setChest('');
      setArm('');
      setThigh('');
      setHip('');
      showAlert('Mesure enregistrée', 'Tes mesures ont bien été sauvegardées.');
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible d\'enregistrer la mesure');
    },
  });

  // ── Card shadow style ─────────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1C1A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
  };

  // ── RowList item helper ───────────────────────────────────────────────────
  function RowItem({
    label,
    sub,
    right,
    rightColor,
  }: {
    label: string;
    sub?: string;
    right?: string;
    rightColor?: string;
  }) {
    return (
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
            {label}
          </Text>
          {sub ? (
            <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{sub}</Text>
          ) : null}
        </View>
        {right ? (
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '700',
              color: rightColor ?? theme.muted,
            }}
          >
            {right}
          </Text>
        ) : null}
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <PluginHeader title="Mesures" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── ONGLET AUJOURD'HUI ──────────────────────────────────────────── */}
        {activeTab === "Aujourd'hui" && (
          <>
            {/* Carte poids */}
            <View style={cardStyle}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: SUCCESS,
                  letterSpacing: 0.06,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                POIDS ACTUEL
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 32, fontWeight: '700', color: theme.text }}>
                  {latest?.weight_kg != null ? latest.weight_kg.toFixed(1) : '—'}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: theme.muted,
                    marginBottom: 4,
                  }}
                >
                  kg
                </Text>
              </View>

              {/* Chip delta */}
              {weightDelta !== null && (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 6,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      backgroundColor:
                        weightDelta < 0
                          ? 'rgba(46,158,91,0.12)'
                          : 'rgba(244,67,54,0.12)',
                      borderRadius: 999,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9.5,
                        color: weightDelta < 0 ? SUCCESS : '#F44336',
                        fontWeight: '700',
                      }}
                    >
                      {weightDelta < 0
                        ? `↓ -${Math.abs(weightDelta)}kg`
                        : `↑ +${weightDelta}kg`}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.muted }}>
                    depuis la dernière mesure
                  </Text>
                </View>
              )}
            </View>

            {/* AISuggestion */}
            <View style={{ marginBottom: 16 }}>
              <AISuggestion
                text="Pèse-toi le matin à jeun, toujours au même moment. Tes dernières mesures sont bien stables."
                tintColor={SUCCESS}
              />
            </View>

            {/* Section Mensurations */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: theme.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.06,
                marginBottom: 8,
              }}
            >
              Mensurations
            </Text>
            <View style={{ gap: 6, marginBottom: 16 }}>
              <RowItem
                label="Poitrine"
                sub={`MAJ le ${formatDate(latest?.date)}`}
                right={latest?.chest_cm != null ? `${latest.chest_cm} cm` : '—'}
              />
              <RowItem
                label="Tour de bras"
                sub={`MAJ le ${formatDate(latest?.date)}`}
                right={latest?.arm_cm != null ? `${latest.arm_cm} cm` : '—'}
              />
              <RowItem
                label="Tour de taille"
                sub={`MAJ le ${formatDate(latest?.date)}`}
                right={latest?.waist_cm != null ? `${latest.waist_cm} cm` : '—'}
                rightColor={
                  latest?.waist_cm != null && previous?.waist_cm != null
                    ? latest.waist_cm < previous.waist_cm
                      ? SUCCESS
                      : undefined
                    : undefined
                }
              />
              <RowItem
                label="Tour de cuisse"
                sub={`MAJ le ${formatDate(latest?.date)}`}
                right={latest?.thigh_cm != null ? `${latest.thigh_cm} cm` : '—'}
              />
              <RowItem
                label="% Masse grasse"
                sub="Dernière mesure"
                right={latest?.body_fat_pct != null ? `${latest.body_fat_pct}%` : '—'}
              />
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              style={{
                backgroundColor: theme.primary,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                Logger des mesures
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ONGLET ÉVOLUTION ─────────────────────────────────────────────── */}
        {activeTab === 'Évolution' && (
          <>
            <View style={cardStyle}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
                Poids · 6 semaines
              </Text>
              <MiniBars data={weeklyBars} color={SUCCESS} max={80} />
              {evolutionDelta !== null && (
                <Text
                  style={{
                    fontSize: 12,
                    color: evolutionDelta < 0 ? SUCCESS : theme.muted,
                    marginTop: 10,
                    fontWeight: '600',
                  }}
                >
                  {evolutionDelta < 0
                    ? `↓ -${Math.abs(evolutionDelta)} kg en 6 semaines (régulier, sain)`
                    : `↑ +${evolutionDelta} kg en 6 semaines`}
                </Text>
              )}
            </View>

            <AISuggestion
              text={
                evolutionDelta !== null && evolutionDelta < 0
                  ? `Tu perds ${Math.abs(evolutionDelta / 6).toFixed(2)} kg/semaine — rythme idéal pour préserver le muscle.`
                  : 'Continue à tracker tes mesures régulièrement pour voir ta progression.'
              }
              tintColor={SUCCESS}
            />
          </>
        )}

        {/* ── ONGLET OBJECTIFS ─────────────────────────────────────────────── */}
        {activeTab === 'Objectifs' && (
          <>
            <View style={{ gap: 8 }}>
              <RowItem
                label="Atteindre 76 kg"
                sub={
                  latest?.weight_kg != null
                    ? `À ${Math.abs(latest.weight_kg - 76).toFixed(1)} kg · ~${Math.ceil(Math.abs(latest.weight_kg - 76) / 0.5)} sem au rythme actuel`
                    : 'Commence par logger ton poids'
                }
                right={latest?.weight_kg != null ? `${latest.weight_kg.toFixed(1)} → 76` : '—'}
              />
              <RowItem
                label="Tour de taille 78 cm"
                sub={
                  latest?.waist_cm != null
                    ? `À ${Math.abs(latest.waist_cm - 78).toFixed(1)} cm · objectif sec`
                    : 'Mesure ta taille pour voir'
                }
                right={latest?.waist_cm != null ? `${latest.waist_cm} → 78` : '—'}
              />
              <RowItem
                label="Bras 40 cm"
                sub={
                  latest?.arm_cm != null
                    ? `+${Math.max(0, 40 - latest.arm_cm).toFixed(1)} cm · phase prise de masse`
                    : 'Mesure tes bras pour voir'
                }
                right={latest?.arm_cm != null ? `${latest.arm_cm} → 40` : '—'}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* ── MODAL SAISIE ──────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: theme.text,
                marginBottom: 20,
              }}
            >
              Logger des mesures
            </Text>

            {/* Champs */}
            {[
              { label: 'Poids (kg) *', value: weight, setter: setWeight },
              { label: '% Masse grasse', value: bodyFat, setter: setBodyFat },
              { label: 'Tour de taille (cm)', value: waist, setter: setWaist },
              { label: 'Poitrine (cm)', value: chest, setter: setChest },
              { label: 'Tour de bras (cm)', value: arm, setter: setArm },
              { label: 'Tour de cuisse (cm)', value: thigh, setter: setThigh },
              { label: 'Hanches (cm)', value: hip, setter: setHip },
            ].map(({ label, value, setter }) => (
              <View key={label} style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 12, color: theme.muted, fontWeight: '600', marginBottom: 4 }}
                >
                  {label}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={setter}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={theme.muted}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 12,
                    fontSize: 15,
                    color: theme.text,
                  }}
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={() => logMutation.mutate()}
              disabled={logMutation.isPending}
              style={{
                backgroundColor: SUCCESS,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {logMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 15 }}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { Banner, PrimaryButton, Stepper, getChipColors } from '../components/controls';
import {
  TIME_STEP_MIN, formatDurationMin, localDateKey, nightLabel, shiftDateKey, stepTime, validateNight,
} from '../lib/sleep';
import { fetchManualNight, saveManualNight } from '../lib/data';

/**
 * C25 / C26 : saisie d'une nuit. Date = jour du reveil. Duree calculee en direct ; > 16 h = message
 * sous le champ + bouton desactive, rien n'est efface (SL-6). Qualite obligatoire, sans valeur par defaut (D-15).
 */
export default function SleepLog({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const qc = useQueryClient();
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [awakenings, setAwakenings] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const touched = useRef(false);

  // Une nuit deja saisie pour cette date s'ouvre en edition (upsert sur user_id + date, pas de doublon).
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const row = await fetchManualNight(supabase, user.id, date);
        if (!live) return;
        setEditing(!!row);
        if (row && !touched.current) {
          setBedtime(String(row.bedtime).slice(0, 5));
          setWakeTime(String(row.wake_time).slice(0, 5));
          setQuality(row.quality);
          setAwakenings(row.awakenings ?? 0);
        }
      } catch {
        /* la saisie reste possible sans prechargement */
      }
    })();
    return () => { live = false; };
  }, [date, supabase]);

  const v = validateNight(bedtime, wakeTime, quality);

  const touch = (fn: () => void) => () => { touched.current = true; fn(); };

  const handleSave = async () => {
    if (!v.ok || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      await saveManualNight(supabase, user.id, {
        date, bedtime, wake_time: wakeTime,
        duration_hours: Math.round((v.durationMin / 60) * 100) / 100,
        quality: quality as number, awakenings,
      });
      await qc.invalidateQueries({ queryKey: ['sleep'] });
      router.back();
    } catch (e: any) {
      showAlert('Erreur', e?.message ?? 'Impossible de sauvegarder');
    }
    setSaving(false);
  };

  const rowStyle = { minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginLeft: 4 }}>Logger ma nuit</Text>
        </View>

        <View style={rowStyle}>
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.4 }}>NUIT</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{nightLabel(date)}</Text>
          </View>
          <Stepper
            theme={theme}
            label="Jour du réveil"
            valueText={date === today ? "Aujourd'hui" : date.slice(8) + '/' + date.slice(5, 7)}
            onDec={() => { touched.current = false; setDate(shiftDateKey(date, -1)); }}
            onInc={() => { if (date < today) { touched.current = false; setDate(shiftDateKey(date, 1)); } }}
          />
        </View>
        {editing ? (
          <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>Une nuit est déjà saisie pour cette date : elle sera modifiée.</Text>
        ) : null}

        <View style={{ gap: 12, marginTop: 8 }}>
          <View style={rowStyle}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Coucher</Text>
            <Stepper
              theme={theme} label="Heure de coucher" valueText={bedtime}
              onDec={touch(() => setBedtime(stepTime(bedtime, -TIME_STEP_MIN)))}
              onInc={touch(() => setBedtime(stepTime(bedtime, TIME_STEP_MIN)))}
            />
          </View>
          <View style={rowStyle}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Lever</Text>
            <Stepper
              theme={theme} label="Heure de lever" valueText={wakeTime} invalid={!!v.error}
              onDec={touch(() => setWakeTime(stepTime(wakeTime, -TIME_STEP_MIN)))}
              onInc={touch(() => setWakeTime(stepTime(wakeTime, TIME_STEP_MIN)))}
            />
          </View>

          {v.error ? (
            <Banner theme={theme} icon="alert-circle" tone="error">{v.error}</Banner>
          ) : (
            <Banner theme={theme} icon="time-outline">
              Durée de la nuit : <Text style={{ fontWeight: '800' }}>{formatDurationMin(v.durationMin)}</Text>
            </Banner>
          )}

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Qualité du sommeil</Text>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Qualité du sommeil">
              {[1, 2, 3, 4, 5].map((q) => {
                const c = getChipColors(theme, quality === q);
                return (
                  <TouchableOpacity
                    key={q}
                    onPress={touch(() => setQuality(q))}
                    accessibilityRole="radio"
                    accessibilityLabel={`Qualité ${q} sur 5`}
                    accessibilityState={{ selected: quality === q }}
                    style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{q}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 13, color: theme.muted }}>1 = très mauvaise, 5 = excellente</Text>
          </View>

          <View style={rowStyle}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 }}>Réveils pendant la nuit</Text>
            <Stepper
              theme={theme} label="Réveils pendant la nuit" valueText={String(awakenings)}
              onDec={touch(() => setAwakenings(Math.max(0, awakenings - 1)))}
              onInc={touch(() => setAwakenings(Math.min(20, awakenings + 1)))}
            />
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
        <PrimaryButton
          theme={theme}
          label={saving ? 'Enregistrement…' : 'Enregistrer la nuit'}
          onPress={handleSave}
          disabled={!v.ok || saving}
        />
      </View>
    </SafeAreaView>
  );
}

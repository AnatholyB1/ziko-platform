import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { SubTabs, PluginHeader, ErrorScreen } from '@ziko/ui';
import {
  Banner, Card, CheckRow, PrimaryButton, SecondaryButton, Segment, SourceBadge, Stepper, Switch,
} from '../components/controls';
import {
  PRE_SLEEP_ROUTINE_ITEMS, TIME_STEP_MIN, buildWeekBars, dayInitial, formatDurationH, formatDurationMin,
  lastNDays, localDateKey, nightLabel, stepGoal, stepTime, weekAccessibilityLabel, weekAverageH,
  type ResolvedNight, type SleepSettings,
} from '../lib/sleep';
import { fetchLatestNight, fetchSleepSettings, fetchWeekDurations, saveSleepSettings } from '../lib/data';
import { loadNotifModule, syncBedtimeReminder } from '../lib/reminders';

const TABS = ['Cette nuit', 'Historique', 'Réglages'];

// Couleurs des phases : decoratives, la liste chiffree porte l'information (§4 contrat).
const STAGE_META = [
  { key: 'deepMin', label: 'Profond', color: '#2A4A8A' },
  { key: 'lightMin', label: 'Léger', color: '#6F8FD0' },
  { key: 'remMin', label: 'REM', color: '#7B5BD0' },
  { key: 'awakeMin', label: 'Éveillé', color: '#9CA3AF' },
] as const;

function EmptyNight({ theme }: { theme: any }) {
  return (
    <Card theme={theme} style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Ionicons name="moon-outline" size={40} color={theme.muted} />
      <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
        Aucune nuit enregistrée
      </Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, textAlign: 'center', maxWidth: 290, lineHeight: 20 }}>
        Note ta nuit à la main en 20 secondes, ou connecte une montre pour que tout arrive tout seul.
      </Text>
      <PrimaryButton theme={theme} label="Logger ma nuit" icon="add" onPress={() => router.push('/(plugins)/sleep/log' as any)} style={{ marginTop: 16, alignSelf: 'stretch' }} />
      <SecondaryButton theme={theme} label="Connecter une source" icon="watch-outline" onPress={() => router.push('/(plugins)/wearables/dashboard' as any)} style={{ marginTop: 8, alignSelf: 'stretch' }} />
    </Card>
  );
}

function StagesBlock({ theme, night }: { theme: any; night: ResolvedNight }) {
  const st = night.stages;
  if (!st) return null;
  const total = STAGE_META.reduce((s, m) => s + st[m.key], 0) || 1;
  return (
    <Card theme={theme} style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 }}>Phases</Text>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {STAGE_META.filter((m) => st[m.key] > 0).map((m) => (
          <View key={m.key} style={{ flex: st[m.key] / total, backgroundColor: m.color }} />
        ))}
      </View>
      <View style={{ marginTop: 10 }}>
        {STAGE_META.map((m) => (
          <View key={m.key} accessible accessibilityLabel={`${m.label} ${formatDurationMin(st[m.key])}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: m.color, marginRight: 10 }} />
            <Text style={{ flex: 1, fontSize: 14, color: theme.text }}>{m.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{formatDurationMin(st[m.key])}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function WeekChart({ theme, bars, goalH }: { theme: any; bars: ReturnType<typeof buildWeekBars>; goalH: number | null }) {
  const avg = weekAverageH(bars);
  const max = Math.max(goalH ?? 0, ...bars.map((b) => b.hours ?? 0), 8);
  const H = 96;
  return (
    <Card theme={theme} style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>7 dernières nuits</Text>
        {goalH != null ? <Text style={{ fontSize: 13, color: theme.muted }}>{`cible ${formatDurationH(goalH)}`}</Text> : null}
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={weekAccessibilityLabel(avg, goalH)}>
        <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          {goalH != null ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: (goalH / max) * H, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: '#BDB9B0' }} />
          ) : null}
          {bars.map((b) => (
            <View key={b.date} style={{ flex: 1, height: b.hours != null ? Math.max(4, (b.hours / max) * H) : 0, backgroundColor: getActionPrimary(theme), borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {bars.map((b) => (
            <Text key={b.date} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: theme.muted }}>{dayInitial(b.date)}</Text>
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>
        {avg != null ? `Moyenne : ${formatDurationH(avg)}. Les jours sans nuit restent vides.` : 'Aucune nuit sur les 7 derniers jours.'}
      </Text>
    </Card>
  );
}

function SettingRow({ theme, icon, title, sub, children }: { theme: any; icon: any; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(28,26,23,0.06)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={theme.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function SleepPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('Cette nuit');
  const today = localDateKey();

  const { data: userId, isLoading: authLoading } = useQuery({
    queryKey: ['auth_user_id'],
    queryFn: async () => (await supabase.auth.getUser()).data?.user?.id ?? null,
  });

  const settingsQ = useQuery({
    queryKey: ['sleep', 'settings', userId],
    queryFn: () => fetchSleepSettings(supabase, userId as string),
    enabled: !!userId,
  });
  const settings = settingsQ.data;

  const nightQ = useQuery({
    queryKey: ['sleep', 'latest', userId, settings?.source ?? 'auto'],
    queryFn: () => fetchLatestNight(supabase, userId as string, settings),
    enabled: !!userId && !!settings,
  });

  const days7 = lastNDays(today, 7);
  const days14 = lastNDays(today, 14);
  const weekQ = useQuery({
    queryKey: ['sleep', 'week', userId, today, settings?.source ?? 'auto'],
    queryFn: () => fetchWeekDurations(supabase, userId as string, days14[0], today, settings as SleepSettings),
    enabled: !!userId && !!settings,
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const updateSettings = async (patch: Partial<SleepSettings>) => {
    if (!settings || !userId) return;
    const next = { ...settings, ...patch };
    qc.setQueryData(['sleep', 'settings', userId], next);
    setSavingSettings(true);
    try {
      await saveSleepSettings(supabase, userId, next);
      if ('reminderEnabled' in patch || 'reminderTime' in patch) {
        const n = loadNotifModule() as any;
        if (n) {
          if (next.reminderEnabled && n.requestPermissionsAsync) {
            const p = await n.getPermissionsAsync?.();
            if (!p?.granted) {
              const r = await n.requestPermissionsAsync();
              if (!r?.granted) {
                showAlert('Notifications désactivées', 'Autorise les notifications dans les réglages du téléphone pour recevoir le rappel du coucher.');
              }
            }
          }
          await syncBedtimeReminder(n, next.reminderEnabled, next.reminderTime);
        }
      }
      await qc.invalidateQueries({ queryKey: ['sleep'] });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: ['sleep', 'settings', userId] });
      showAlert('Erreur', e?.message ?? 'Impossible d’enregistrer le réglage');
    }
    setSavingSettings(false);
  };

  if (authLoading || settingsQ.isLoading || nightQ.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={getActionPrimary(theme)} />
      </View>
    );
  }
  if (settingsQ.isError || nightQ.isError) {
    return <ErrorScreen variant="network" onRetry={() => { settingsQ.refetch(); nightQ.refetch(); }} />;
  }

  const night = nightQ.data ?? null;
  const s = settings as SleepSettings;
  const durations = weekQ.data ?? {};
  const bars7 = buildWeekBars(days7, durations);
  const hasHealth = night?.source === 'health';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Sommeil" onBack={() => router.back()} />
      <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Cette nuit' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {!night ? (
            <EmptyNight theme={theme} />
          ) : (
            <>
              <Card theme={theme}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.4 }}>{`NUIT ${nightLabel(night.date).toUpperCase()}`}</Text>
                  <SourceBadge theme={theme} source={night.source} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <View>
                    <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text }}>{formatDurationH(night.durationH)}</Text>
                    {night.bedtime && night.wakeTime ? <Text style={{ fontSize: 13, color: theme.muted }}>{`${night.bedtime} → ${night.wakeTime}`}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {night.quality != null ? <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>{`${night.quality} / 5`}</Text> : null}
                    {night.quality != null ? (
                      <Text style={{ fontSize: 13, color: theme.muted }}>
                        {night.awakenings ? `qualité · ${night.awakenings} réveil${night.awakenings > 1 ? 's' : ''}` : 'qualité'}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>

              {hasHealth && night.hiddenManualDurationH != null ? (
                <View style={{ marginTop: 12 }}>
                  <Banner theme={theme} icon="information-circle-outline">
                    {`La source prime : ta saisie manuelle de cette nuit (${formatDurationH(night.hiddenManualDurationH)}) est conservée mais n'est plus affichée.`}
                  </Banner>
                </View>
              ) : null}

              <StagesBlock theme={theme} night={night} />

              {!night.stages ? (
                <View style={{ marginTop: 12 }}>
                  <Banner theme={theme} icon="information-circle-outline">
                    {"Les phases ne s'affichent qu'avec une montre ou une app connectée."}
                  </Banner>
                </View>
              ) : null}
            </>
          )}

          {night ? <WeekChart theme={theme} bars={bars7} goalH={s.goalHours} /> : null}

          {night ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <PrimaryButton theme={theme} label="Logger ma nuit" icon="add" onPress={() => router.push('/(plugins)/sleep/log' as any)} />
              {!hasHealth ? (
                <SecondaryButton theme={theme} label="Connecter une source" icon="watch-outline" onPress={() => router.push('/(plugins)/wearables/dashboard' as any)} />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      {activeTab === 'Historique' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {Object.keys(durations).length === 0 ? (
            <EmptyNight theme={theme} />
          ) : (
            <Card theme={theme}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 8 }}>14 derniers jours</Text>
              {[...days14].reverse().filter((d) => durations[d] != null).map((d) => (
                <View key={d} accessible accessibilityLabel={`${nightLabel(d)}, ${formatDurationH(durations[d])}`} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border }}>
                  <Text style={{ fontSize: 14, color: theme.text }}>{nightLabel(d)}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{formatDurationH(durations[d])}</Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      {activeTab === 'Réglages' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <Card theme={theme}>
            <SettingRow theme={theme} icon="moon-outline" title="Cible de sommeil" sub={s.goalHours == null ? 'Non définie' : undefined}>
              <Stepper
                theme={theme}
                label="Cible de sommeil"
                valueText={s.goalHours == null ? '—' : formatDurationH(s.goalHours)}
                a11yValue={s.goalHours == null ? 'non définie' : formatDurationH(s.goalHours)}
                onDec={() => updateSettings({ goalHours: stepGoal(s.goalHours, -1) })}
                onInc={() => updateSettings({ goalHours: stepGoal(s.goalHours, 1) })}
              />
            </SettingRow>

            <SettingRow theme={theme} icon="notifications-outline" title="Rappel du coucher" sub={s.reminderEnabled ? 'Tous les jours' : 'Désactivé'}>
              <Switch theme={theme} label="Rappel du coucher" value={s.reminderEnabled} onChange={(v) => updateSettings({ reminderEnabled: v })} />
            </SettingRow>
            {s.reminderEnabled ? (
              <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
                <Stepper
                  theme={theme} label="Heure du rappel" valueText={s.reminderTime}
                  onDec={() => updateSettings({ reminderTime: stepTime(s.reminderTime, -TIME_STEP_MIN) })}
                  onInc={() => updateSettings({ reminderTime: stepTime(s.reminderTime, TIME_STEP_MIN) })}
                />
              </View>
            ) : null}

            <SettingRow theme={theme} icon="alarm-outline" title="Réveil intelligent" sub={"Fenêtre de 30 min. S'activera avec une source connectée."}>
              <Switch theme={theme} label="Réveil intelligent" value={s.smartWake} onChange={(v) => updateSettings({ smartWake: v })} />
            </SettingRow>

            <View style={{ paddingVertical: 6 }}>
              <SettingRow theme={theme} icon="watch-outline" title="Source des données" sub="La source connectée prime sur la saisie manuelle." />
              <Segment
                theme={theme} label="Source des données"
                value={s.source ?? (hasHealth ? 'health' : 'manual')}
                options={[{ id: 'manual', label: 'Saisie manuelle' }, { id: 'health', label: 'Santé' }]}
                onChange={(id) => updateSettings({ source: id as 'manual' | 'health' })}
              />
            </View>
          </Card>

          <Card theme={theme} style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Routine pré-sommeil</Text>
            {PRE_SLEEP_ROUTINE_ITEMS.map((it) => (
              <CheckRow
                key={it.id} theme={theme} label={it.label} checked={s.routine.includes(it.id)}
                onChange={(on) => updateSettings({ routine: on ? [...s.routine, it.id] : s.routine.filter((x) => x !== it.id) })}
              />
            ))}
          </Card>
          {savingSettings ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8, textAlign: 'center' }}>Enregistrement…</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

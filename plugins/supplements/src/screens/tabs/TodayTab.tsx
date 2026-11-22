import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { Card, EmptyBlock, ACCENT_TEXT } from '../../components/ui';
import { buildTodayGroups, formatDayLabel, formatProgress, intakeKey, MOMENT_ICON, MOMENT_LABEL, type Moment, type StackEntry } from '../../lib/moments';
import { fetchIntakes, localDateKey, setIntake } from '../../lib/data';
import type { ReminderPref } from '../../lib/reminders';

/** C10 : prises du jour groupees Matin / Midi / Soir, cochables, "3 sur 5 pris". */
export default function TodayTab({
  supabase,
  userId,
  stack,
  stackLoading,
  prefs,
  onBrowse,
}: {
  supabase: any;
  userId: string | null;
  stack: StackEntry[];
  stackLoading: boolean;
  prefs: ReminderPref[];
  onBrowse: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const qc = useQueryClient();
  const now = new Date();
  const date = localDateKey(now);
  const key = ['supplement_intakes', userId, date];

  const { data: taken = new Set<string>(), isLoading } = useQuery<Set<string>>({
    queryKey: key,
    queryFn: () => fetchIntakes(supabase, userId as string, date),
    enabled: !!userId,
    staleTime: 0,
  });

  const toggle = async (supplementId: string, moment: Moment) => {
    if (!userId) return;
    const k = intakeKey(supplementId, moment);
    const was = taken.has(k);
    const next = new Set(taken);
    if (was) next.delete(k);
    else next.add(k);
    qc.setQueryData(key, next);
    try {
      await setIntake(supabase, userId, supplementId, moment, date, !was);
    } catch {
      qc.setQueryData(key, taken);
      showAlert('Prise non enregistrée', 'Vérifie ta connexion et réessaie.');
    }
  };

  if (stackLoading || isLoading) {
    return <ActivityIndicator color={getActionPrimary(theme)} style={{ marginTop: 32 }} />;
  }

  if (stack.length === 0) {
    return (
      <EmptyBlock
        icon="flask-outline"
        title="Ton stack est vide"
        message="Choisis un produit dans le Catalogue, règle la dose et le moment de prise. Il apparaîtra ici."
        ctaLabel="Parcourir le catalogue"
        onCta={onBrowse}
      />
    );
  }

  const groups = buildTodayGroups(stack, taken);
  const progress = formatProgress(groups);
  const reminderByMoment = new Map(prefs.filter((p) => p.enabled).map((p) => [p.moment, p.remindTime]));

  return (
    <View>
      <View style={{ marginBottom: 16 }}>
        <Text testID="supp-progress" style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
          {progress.label}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>{formatDayLabel(now)}</Text>
        <View style={{ height: 6, backgroundColor: 'rgba(28,26,23,0.06)', borderRadius: 999, overflow: 'hidden', marginTop: 10 }}>
          <View
            style={{
              width: progress.total > 0 ? `${(progress.taken / progress.total) * 100}%` : '0%',
              height: '100%',
              backgroundColor: getActionPrimary(theme),
              borderRadius: 999,
            }}
          />
        </View>
      </View>

      {groups.map((group) => (
        <View key={group.moment} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name={MOMENT_ICON[group.moment]} size={16} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4 }}>
              {MOMENT_LABEL[group.moment].toUpperCase()}
            </Text>
          </View>
          <Card style={{ padding: 4 }}>
            {group.rows.map((row, i) => (
              <TouchableOpacity
                key={row.key}
                testID={`supp-intake-${row.supplementId}-${row.moment}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.taken }}
                accessibilityLabel={`${row.name}, ${row.doseLabel}, ${MOMENT_LABEL[row.moment]}`}
                onPress={() => toggle(row.supplementId, row.moment)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: row.taken ? getActionPrimary(theme) : 'transparent',
                    borderWidth: row.taken ? 0 : 2,
                    borderColor: theme.border,
                  }}
                >
                  {row.taken ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: row.taken ? theme.muted : theme.text,
                      fontSize: 14.5,
                      fontWeight: '700',
                      textDecorationLine: row.taken ? 'line-through' : 'none',
                    }}
                    numberOfLines={1}
                  >
                    {row.name}
                  </Text>
                  <Text style={{ color: ACCENT_TEXT, fontSize: 12.5, fontWeight: '600', marginTop: 1 }}>
                    {row.doseLabel}
                    {i === 0 && reminderByMoment.has(group.moment) ? ` · ${reminderByMoment.get(group.moment)}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

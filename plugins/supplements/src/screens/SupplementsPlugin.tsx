import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import { SubTabs, PluginHeader } from '@ziko/ui';
import TodayTab from './tabs/TodayTab';
import StackTab from './tabs/StackTab';
import CatalogTab from './tabs/CatalogTab';
import RemindersTab, { PREFS_KEY } from './tabs/RemindersTab';
import { useStack, useUserId } from '../hooks';
import { fetchReminderPrefs } from '../lib/data';
import { buildReminderSlots, planNotifications, withDefaultPrefs, type ReminderPref } from '../lib/reminders';
import { syncSupplementReminders, type SyncStatus } from '../lib/notifications';

// SUPP-01 : 4 onglets, ordre impose.
const TABS = ["Aujourd'hui", 'Mon stack', 'Catalogue', 'Rappels'] as const;
type Tab = (typeof TABS)[number];

export default function SupplementsPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const userId = useUserId(supabase);
  const stackQuery = useStack(supabase, userId);
  const stack = stackQuery.data ?? [];

  const prefsQuery = useQuery<ReminderPref[]>({
    queryKey: [PREFS_KEY, userId],
    queryFn: () => fetchReminderPrefs(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const prefs = useMemo(() => withDefaultPrefs(prefsQuery.data ?? []), [prefsQuery.data]);

  // Reprogramme les notifications locales a chaque changement de stack / d'heure / d'interrupteur (SU-6).
  const plan = useMemo(() => planNotifications(buildReminderSlots(stack, prefs)), [stack, prefs]);
  const planKey = JSON.stringify(plan);
  const ready = !!userId && stackQuery.data !== undefined && prefsQuery.data !== undefined;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    syncSupplementReminders(plan).then((s) => {
      if (alive) setSyncStatus(s);
    });
    return () => {
      alive = false;
    };
    // `plan` est represente par planKey ; activeTab : re-test apres un retour des reglages systeme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, planKey, activeTab === 'Rappels']);

  const goCatalog = () => setActiveTab('Catalogue');
  const refreshToday = () => {
    qc.invalidateQueries({ queryKey: ['supplement_intakes', userId] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Compléments" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SubTabs tabs={[...TABS]} active={activeTab} onChange={(t) => setActiveTab(t as Tab)} />

        {activeTab === "Aujourd'hui" && (
          <TodayTab
            supabase={supabase}
            userId={userId}
            stack={stack}
            stackLoading={!userId || stackQuery.isLoading}
            prefs={prefs}
            onBrowse={goCatalog}
          />
        )}
        {activeTab === 'Mon stack' && (
          <StackTab
            supabase={supabase}
            userId={userId}
            stack={stack}
            loading={!userId || stackQuery.isLoading}
            onBrowse={goCatalog}
            onChanged={refreshToday}
          />
        )}
        {activeTab === 'Catalogue' && <CatalogTab supabase={supabase} />}
        {activeTab === 'Rappels' && (
          <RemindersTab supabase={supabase} userId={userId} stack={stack} prefs={prefs} syncStatus={syncStatus} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

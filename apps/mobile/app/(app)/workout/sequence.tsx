// Phase 24 (v1.20) - ATEL-07/08 : "Ma suite de programmes". Frise ordonnee (termine / en cours / suivant /
// prevu), bilan du dernier programme termine, bouton "Preparer la suite" quand une relance est ouverte.
// Pas de maquette lot-A pour cet ecran (24-CONTEXT G-6) : tokens et composants existants uniquement.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, getActionPrimary, goalLabel } from '@ziko/plugin-sdk';
import { supabase } from '../../../src/lib/supabase';
import { PERIOD_COPY, STATUS_LABEL, itemSubtitle, lastDone, resultsLines, type RelaunchView, type SequenceItem } from '../../../src/lib/periodization';
import { createPeriodizationClient } from '../../../src/lib/periodizationService';

const client = createPeriodizationClient({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

export default function SequenceScreen() {
  const theme = useThemeStore((s) => s.theme);
  const actionBg = getActionPrimary(theme);
  const [items, setItems] = useState<SequenceItem[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [relaunch, setRelaunch] = useState<RelaunchView | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const out = await client.getSequence();
      setItems(out.items);
      setName(out.sequence?.name ?? null);
      setRelaunch(out.relaunch);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const done = items ? lastDone(items) : null;
  const dotColor = (s: SequenceItem['status']) => (s === 'active' ? theme.primary : s === 'done' ? theme.text : theme.border);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        <TouchableOpacity accessibilityLabel="Retour" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.text }}>{PERIOD_COPY.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 12 }}>
        {items === null && !failed && <ActivityIndicator color={theme.primary} style={{ marginTop: 48 }} />}
        {failed && (
          <View style={{ marginTop: 24, gap: 12, alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, color: theme.muted }}>{PERIOD_COPY.loadError}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={load} style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: actionBg, justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{PERIOD_COPY.retry}</Text>
            </TouchableOpacity>
          </View>
        )}
        {items !== null && items.length === 0 && <Text style={{ marginTop: 24, fontSize: 16, lineHeight: 23, color: theme.muted }}>{PERIOD_COPY.empty}</Text>}

        {relaunch && relaunch.status !== 'dismissed' && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={PERIOD_COPY.prepare}
            onPress={() => router.push({ pathname: '/(app)/workout/atelier', params: { relaunch: relaunch.id } } as any)}
            style={{ minHeight: 48, borderRadius: 14, backgroundColor: actionBg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{relaunch.status === 'proposed' ? PERIOD_COPY.review : PERIOD_COPY.prepare}</Text>
          </TouchableOpacity>
        )}

        {name && items && items.length > 0 && <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{name.toUpperCase()}</Text>}
        {items?.map((it, idx) => (
          <View key={it.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 18, backgroundColor: dotColor(it.status) }} />
              {idx < items.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: theme.border }} />}
            </View>
            <View
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: it.status === 'active' ? theme.primary : theme.border,
                backgroundColor: theme.surface,
                shadowColor: '#1C1A17',
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: it.status === 'active' ? theme.primary : theme.muted }}>{`${it.position}. ${STATUS_LABEL[it.status]}`}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{it.name}</Text>
              {itemSubtitle(it, (g) => goalLabel(g, g)) !== '' && <Text style={{ fontSize: 14, color: theme.muted }}>{itemSubtitle(it, (g) => goalLabel(g, g))}</Text>}
            </View>
          </View>
        ))}

        {done?.results && (
          <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted }}>{PERIOD_COPY.resultsTitle.toUpperCase()}</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{done.name}</Text>
            {resultsLines(done.results).map((l) => (
              <Text key={l} style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>{l}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

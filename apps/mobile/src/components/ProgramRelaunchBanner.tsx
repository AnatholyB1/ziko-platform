// Phase 24 (v1.20) - ATEL-09 : bandeau de l'onglet Seance. A l'ouverture, detecte une fin de programme
// (check, sans IA), puis lance en tache de fond la proposition automatique du programme suivant (absorbee,
// aucun credit). Ton neutre : aucune penalite, "Plus tard" masque simplement le bandeau.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { PERIOD_COPY, bannerState, shouldPropose, resultsLines, type RelaunchView } from '../lib/periodization';
import { createPeriodizationClient } from '../lib/periodizationService';

const client = createPeriodizationClient({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

export default function ProgramRelaunchBanner() {
  const theme = useThemeStore((s) => s.theme);
  const actionBg = getActionPrimary(theme);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [relaunch, setRelaunch] = useState<RelaunchView | null>(null);
  const [hasSequence, setHasSequence] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const out = await client.check();
        if (!alive) return;
        setRelaunch(out.relaunch);
        setHasSequence(out.has_sequence);
        // le programme vient d'etre clos : l'onglet doit relire le programme actif
        if (out.closed_program_id) queryClient.invalidateQueries({ queryKey: ['program', 'active'] });
        if (shouldPropose(out.relaunch)) {
          setProposing(true);
          try {
            const p = await client.propose(out.relaunch!.id);
            if (alive) setRelaunch((cur) => (cur ? { ...cur, status: p.status === 'proposed' ? 'proposed' : 'pending' } : cur));
          } catch {
            /* la relance reste "pending" : l'atelier s'ouvre quand meme avec le bilan */
          } finally {
            if (alive) setProposing(false);
          }
        }
      } catch {
        /* silencieux : le bandeau est un bonus, jamais une cause d'erreur de l'onglet */
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const state = bannerState(relaunch, proposing);

  if (state === 'hidden') {
    return hasSequence ? (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={PERIOD_COPY.openSequence}
        onPress={() => router.push('/(app)/workout/sequence' as any)}
        style={{ marginHorizontal: 16, marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Ionicons name="git-branch" size={18} color={theme.muted} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.muted }}>{PERIOD_COPY.openSequence}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.muted} />
      </TouchableOpacity>
    ) : null;
  }
  if (hidden) return null;

  const body = state === 'preparing' ? PERIOD_COPY.bannerPreparing : state === 'ready' ? PERIOD_COPY.bannerReady : PERIOD_COPY.bannerBody;
  const summary = relaunch?.results ? resultsLines(relaunch.results).slice(0, 2) : [];

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        shadowColor: '#1C1A17',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="flag" size={20} color={theme.primary} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: theme.text }}>
          {relaunch?.program_name ? `${PERIOD_COPY.bannerTitle} : ${relaunch.program_name}` : PERIOD_COPY.bannerTitle}
        </Text>
        {state === 'preparing' && <ActivityIndicator color={theme.primary} />}
      </View>
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted }}>{body}</Text>
      {summary.map((l) => (
        <Text key={l} style={{ fontSize: 14, color: theme.text }}>{l}</Text>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={state === 'ready' ? PERIOD_COPY.review : PERIOD_COPY.prepare}
          onPress={() => router.push({ pathname: '/(app)/workout/atelier', params: { relaunch: relaunch!.id } } as any)}
          style={{ flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: actionBg, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{state === 'ready' ? PERIOD_COPY.review : PERIOD_COPY.prepare}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={PERIOD_COPY.later}
          onPress={() => setHidden(true)}
          style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{PERIOD_COPY.later}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

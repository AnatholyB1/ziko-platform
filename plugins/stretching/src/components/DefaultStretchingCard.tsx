import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';
import { fetchDefaultRoutine } from '../data';
import { routineSummary, shouldShowDefaultCard } from '../lib';
import { ORANGE_TEXT, CARD_SHADOW } from './ui';

/**
 * Routine de stretching par defaut, en tete de seance (STRE-06, maquettes C08/C09).
 * - routine par defaut : carte `Ajoutee en debut de seance` (Passer / Modifier ; toucher la carte lance la routine,
 *   puis on revient a la seance) ;
 * - aucune routine par defaut : AUCUNE carte (une simple phrase d'indication, rien a passer) ;
 * - `Passer` n'est pas persiste : l'etat `skipped` vit dans l'ecran de seance (une seance = un etat local).
 * Terminer la routine ecrit un ziko_stretching_logs ; ce n'est jamais une serie validee.
 */
export function DefaultStretchingCard({
  supabase, skipped, onSkip,
}: { supabase: any; skipped: boolean; onSkip: () => void }) {
  const theme = useThemeStore((s) => s.theme);

  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => (await supabase.auth.getUser()).data?.user ?? null,
  });
  const userId: string | undefined = authData?.id;

  const { data: routine, isSuccess } = useQuery({
    queryKey: ['stretching_default', userId],
    queryFn: () => fetchDefaultRoutine(supabase, userId as string),
    enabled: !!userId,
    staleTime: 0,
  });

  if (!isSuccess) return null; // chargement ou erreur : rien (jamais de carte factice)

  if (!routine) {
    return (
      <TouchableOpacity
        onPress={() => router.push('/(app)/(plugins)/stretching/dashboard' as any)}
        accessibilityRole="button"
        accessibilityLabel="Pas de routine d'étirement par défaut. Ouvrir Stretching pour en choisir une."
        style={{ minHeight: 44, justifyContent: 'center', marginBottom: 12 }}
      >
        <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          Pas de routine d'étirement par défaut. Tu peux en choisir une dans Stretching.
        </Text>
      </TouchableOpacity>
    );
  }

  if (!shouldShowDefaultCard(routine, skipped)) return null;

  const primary = getActionPrimary(theme);
  return (
    <View
      accessibilityLabel={`Ajoutée en début de séance, ${routine.name}, ${routineSummary(routine.exercises)}`}
      style={{
        backgroundColor: theme.surface, borderRadius: 16, borderWidth: 2, borderColor: primary,
        padding: 14, marginBottom: 14, ...CARD_SHADOW,
      }}
    >
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/(app)/(plugins)/stretching/session' as any, params: { routineId: routine.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Lancer ${routine.name}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: ORANGE_TEXT, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Ajoutée en début de séance
          </Text>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 3 }}>{routine.name}</Text>
          <Text style={{ color: theme.muted, fontSize: 14, marginTop: 2 }}>{routineSummary(routine.exercises)}</Text>
        </View>
        <Ionicons name="play-circle" size={34} color={primary} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Passer la routine d'étirement pour cette séance"
          style={{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>Passer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(app)/(plugins)/stretching/editor' as any, params: { editId: routine.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${routine.name}`}
          style={{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>Modifier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default DefaultStretchingCard;

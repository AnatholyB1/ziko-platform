// v1.21 Phase 2 - donnees de la carte "Crée ton premier entraînement" (accueil).
// - programme actif : meme lecture que l'accueil (useActiveAIProgram, cle partagee ['program','active']) ;
// - seances terminees : requete legere (count, head) sur ziko_workout_sessions.ended_at ;
// - cout / solde / quota gratuit : GET /ai/workshop/info (cout du chat cote serveur), uniquement quand la carte
//   est affichee (un compte existant ne declenche aucun appel supplementaire).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useActiveAIProgram } from './useHomeData';
import { COUNTABLE_SESSION_OR_FILTER } from '../lib/workoutPlan';
import { createAtelierClient, type AtelierInfo } from '../lib/atelierService';
import {
  firstWorkoutVisibility, computeCreditView, type CardVisibility, type CreditView,
} from '../lib/firstWorkout';

export const FINISHED_SESSIONS_KEY = ['workouts', 'finished'] as const;
export const CREDIT_INFO_KEY = ['credits', 'info'] as const;

const client = createAtelierClient({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

/**
 * D-07 : nombre de seances TERMINEES (ended_at non nul) et comptables (au moins une serie validee, meme predicat que
 * l'accueil : une seance vide fermee n'est pas un entrainement). Colonne confirmee : ziko_workout_sessions.ended_at.
 */
export function useFinishedSessionCount() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...FINISHED_SESSIONS_KEY, userId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('ziko_workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .or(COUNTABLE_SESSION_OR_FILTER);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreditInfo(enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...CREDIT_INFO_KEY, userId],
    queryFn: (): Promise<AtelierInfo> => client.getInfo(),
    enabled: enabled && !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export interface FirstWorkoutState {
  visibility: CardVisibility;
  credit: CreditView;
  /** La lecture cout/solde a echoue : la carte reste utilisable (repli "Consomme des crédits IA", solde "—"). */
  creditFailed: boolean;
}

export function useFirstWorkoutCard(): FirstWorkoutState {
  const program = useActiveAIProgram();
  const sessions = useFinishedSessionCount();
  const visibility = firstWorkoutVisibility({
    program: { isLoading: program.isLoading, isError: program.isError, hasActive: !!program.data },
    sessions: { isLoading: sessions.isLoading, isError: sessions.isError, finishedCount: sessions.data },
  });
  const info = useCreditInfo(visibility === 'show');
  const credit = useMemo(() => computeCreditView(info.isError ? null : info.data), [info.data, info.isError]);
  return { visibility, credit, creditFailed: info.isError };
}

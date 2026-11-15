import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { localDateKey } from '../lib/localDate';
import { getTodayWeight, getTodayMood } from '../lib/quickLog';

// Statut "logue aujourd'hui" = lu en base (source de verite), cle incluant la date
// locale : au changement de jour la cle change et le statut repart a vide.
export function useTodayWeight() {
  const userId = useAuthStore((s) => s.user?.id);
  const date = localDateKey();
  return useQuery({
    queryKey: ['quicklog', 'weight', userId, date],
    queryFn: () => getTodayWeight(supabase, userId!, date),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useTodayMood() {
  const userId = useAuthStore((s) => s.user?.id);
  const date = localDateKey();
  return useQuery({
    queryKey: ['quicklog', 'mood', userId, date],
    queryFn: () => getTodayMood(supabase, userId!, date),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

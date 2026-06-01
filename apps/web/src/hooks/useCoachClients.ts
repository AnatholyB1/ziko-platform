'use client';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';

interface CoachClient {
  id: string;
  name: string;
  email: string;
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

export function useCoachClients(currentClientId: string) {
  return useQuery<CoachClient[]>({
    queryKey: ['coach-clients'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/coach/clients`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) throw new Error(`Failed to fetch clients: ${res.status}`);
      const all: CoachClient[] = await res.json();
      // D-06: exclude current client
      return all.filter((c) => c.id !== currentClientId);
    },
    staleTime: 60_000,
    enabled: !!currentClientId,
  });
}

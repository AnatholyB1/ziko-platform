import { useQuery } from '@tanstack/react-query';
import { fetchStack } from './lib/data';
import type { StackEntry } from './lib/moments';

export const STACK_KEY = 'supplement_stack';

export function useUserId(supabase: any): string | null {
  const { data } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });
  return data?.id ?? null;
}

export function useStack(supabase: any, userId: string | null) {
  return useQuery<StackEntry[]>({
    queryKey: [STACK_KEY, userId],
    queryFn: () => fetchStack(supabase, userId as string),
    enabled: !!userId,
    staleTime: 0,
  });
}

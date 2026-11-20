import { useQuery } from '@tanstack/react-query';
import type { QuestSync } from '@ziko/plugin-gamification/quests';
import { syncQuests } from '@ziko/plugin-gamification/store';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// Quetes de l'accueil (v1.21 phase 1, D-02). La lecture EST la synchro : `ziko_sync_quests` est idempotente
// (cree les quetes de depart manquantes de la periode, mesure la progression, credite une seule fois). L'accueil
// l'appelle a l'ouverture ; apres chaque action loguee, `requestQuestRefresh()` (debounce) relance la synchro et
// invalide le prefixe 'rewards-quests' (QUEST_QUERY_KEYS de questRefreshHandler), ce qui relit cette requete (QNEW-06).
// Contrairement a `syncQuestsQuiet`, une erreur est REMONTEE : le bloc affiche son etat d'erreur avec « Reessayer ».
export const HOME_QUESTS_KEY = 'rewards-quests';

export function useHomeQuests() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<QuestSync>({
    queryKey: [HOME_QUESTS_KEY, 'home', userId],
    queryFn: () => syncQuests(supabase),
    enabled: !!userId,
    staleTime: 0,
    retry: 1,
    retryDelay: 500,
  });
}

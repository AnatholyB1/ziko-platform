/**
 * Branche le rafraichissement des quetes de l'app (UAT run 9, defaut 2) : apres une ecriture qui alimente une metrique
 * (eau, poids, humeur, repas, habitude, mesure), `requestQuestRefresh()` declenche (debounce) `ziko_sync_quests` puis
 * invalide la requete de l'onglet Quetes et le solde. Les quetes terminees par cette synchro sont gardees pour l'annonce
 * a l'affichage de l'ecran Recompenses (la synchro a deja marque la quete : sans cela le toast serait perdu).
 */
import { createQuestRefresher, pushQuestCompletions, setQuestRefreshHandler } from '@ziko/plugin-sdk';
import { syncQuestsQuiet } from '@ziko/plugin-gamification/store';
import { supabase } from './supabase';
import { queryClient } from './queryClient';

export const QUEST_QUERY_KEYS = ['rewards-quests', 'rewards-profile', 'rewards-recent', 'rewards-history'] as const;

export const questRefresher = createQuestRefresher({
  sync: () => syncQuestsQuiet(supabase),
  invalidate: (res) => {
    if (res && res.newlyCompleted.length > 0) pushQuestCompletions(res.newlyCompleted);
    // Prefixe de cle : toutes les requetes de l'utilisateur courant ; les ecrans non montes se rechargeront a l'ouverture.
    for (const key of QUEST_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
  },
});

let installed = false;
/** A appeler une fois (layout racine). Idempotent. */
export function installQuestRefresh(): void {
  if (installed) return;
  installed = true;
  setQuestRefreshHandler(() => questRefresher.schedule());
}

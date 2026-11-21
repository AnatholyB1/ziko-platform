import { useEffect } from 'react';
import { AppState } from 'react-native';
import { requestQuestRefresh } from '@ziko/plugin-sdk';
import { msUntilNextLocalMidnight } from '../lib/homeQuests';

// v1.21 phase 1 (audit M3, D-07) : l'accueil relit les quetes quand l'app revient au premier plan et au passage de
// minuit local, pour que le « Bravo, tout est fait » d'hier ne reste jamais affiche. Passe par le gestionnaire de
// rafraichissement existant (`requestQuestRefresh` : debounce, synchro idempotente, invalidation de 'rewards-quests').
const MIDNIGHT_MARGIN_MS = 1000;

export function useQuestRefreshTriggers(enabled = true, trigger: () => void = requestQuestRefresh): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const disarm = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const arm = () => {
      disarm();
      timer = setTimeout(() => { trigger(); arm(); }, msUntilNextLocalMidnight(new Date()) + MIDNIGHT_MARGIN_MS);
    };
    arm();
    const sub = AppState.addEventListener('change', (s: string) => {
      if (s !== 'active') return;
      trigger();
      arm(); // les minuteurs peuvent avoir ete suspendus en arriere-plan : on recale sur minuit
    });
    return () => { disarm(); sub?.remove?.(); };
  }, [enabled, trigger]);
}
